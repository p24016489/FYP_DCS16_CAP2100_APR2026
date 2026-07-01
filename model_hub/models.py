from django.db import models
from django.contrib.auth.models import AbstractUser
import uuid
from django.utils import timezone

# Create your models here.

# 1. User & Admin Entity (Combined into a Custom User Model for Django auth)
class CustomUser(AbstractUser):
    # Define the three distinct roles
    ROLE_CHOICES = (
        ('superadmin', 'Super Admin'),
        ('admin', 'Admin'),
        ('user', 'QA Engineer (User)'),
    )

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    is_online = models.BooleanField(default=False)
    
    # Employee ID for factory floor personnel
    employee_id = models.CharField(max_length=50, unique=True, blank=True)

    # NEW: Track who created this user
    created_by = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='provisioned_users'
    )

    def save(self, *args, **kwargs):
        if not self.employee_id:
            # Generates a random string like "EMP-A1B2C"
            self.employee_id = f"EMP-{uuid.uuid4().hex[:5].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} - {self.get_role_display()}"

# 2. AI Model Entity
class AIModel(models.Model):
    model_id = models.AutoField(primary_key=True)
    admin = models.ForeignKey(CustomUser, on_delete=models.CASCADE, limit_choices_to={'role': 'ADMIN'})
    model_name = models.CharField(max_length=100)
    version_number = models.CharField(max_length=50)
    map_score = models.FloatField()
    weight_file_path = models.FileField(upload_to='models/')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.model_name} v{self.version_number}"

# 3. Image Record Entity
class ImageRecord(models.Model):
    image_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    file_path = models.ImageField(upload_to='pcb_images/')
    resolution = models.CharField(max_length=50) # e.g., "640x640"
    upload_timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image {self.image_id} uploaded by {self.user.username}"

# 4. Defect Result Entity
class DefectResult(models.Model):
    defect_id = models.AutoField(primary_key=True)
    image = models.ForeignKey(ImageRecord, on_delete=models.CASCADE, related_name='defects')
    detected_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True, blank=True)
    classification_label = models.CharField(max_length=100)
    confidence_score = models.FloatField()
    
    # Bounding Box Coordinates
    x_min = models.FloatField()
    y_min = models.FloatField()
    x_max = models.FloatField()
    y_max = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.classification_label} on Image {self.image_id} at {self.created_at}"

# 5. Manual Correction Entity (For Human-in-the-Loop active learning)
class ManualCorrection(models.Model):
    correction_id = models.AutoField(primary_key=True)
    image = models.ForeignKey(ImageRecord, on_delete=models.CASCADE, related_name='corrections')
    corrected_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    corrected_label = models.CharField(max_length=100)
    is_compiled_for_training = models.BooleanField(default=False)
    
    # Corrected Bounding Box Coordinates
    x_min = models.FloatField()
    y_min = models.FloatField()
    x_max = models.FloatField()
    y_max = models.FloatField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Correction on Image {self.image_id} by {self.corrected_by.username} at {self.created_at}"

# 6. Activity Log Entity
class ActivityLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    image = models.OneToOneField('ImageRecord', on_delete=models.CASCADE)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    
    # Capturing precise metrics to drive dynamic success logic
    inspection_duration = models.FloatField(help_text="Duration in milliseconds", null=True, blank=True)
    recorded_map_score = models.FloatField(help_text="mAP score of the run", null=True, blank=True)
    
    success_status = models.BooleanField(default=False) 

    # Override the save method to dynamically force success if metrics are present
    def save(self, *args, **kwargs):
        if self.inspection_duration or self.recorded_map_score:
            self.success_status = True
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Log for Image {self.image.image_id} - Success: {self.success_status}"
    

# 7. Annotation Class Definitions Entity
class AnnotationClass(models.Model):
    class_id = models.AutoField(primary_key=True)
    # This ensures your classes are tied to specific models if needed in the future
    model_reference = models.ForeignKey(AIModel, on_delete=models.CASCADE, null=True, blank=True) 
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    class_name = models.CharField(max_length=100, unique=True)
    hex_color = models.CharField(max_length=7, default='#10B981') # e.g., #FF0000
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.class_name} ({self.hex_color})"
    

# 8. Workspace Preferences Entity (Add this at the end of models.py)
class WorkspacePreference(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='workspace_preference')
    export_format = models.CharField(max_length=50, default='yolo')
    enable_crosshair = models.BooleanField(default=True)
    auto_save = models.BooleanField(default=True) 
    box_opacity = models.IntegerField(default=40)         
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Preferences for {self.user.username}"
    


class DatasetVersion(models.Model):
    version_id = models.AutoField(primary_key=True)
    version_name = models.CharField(max_length=100, unique=True) # e.g., "Dataset_V1"
    created_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # Tracking the split
    total_images = models.IntegerField(default=0)
    train_split = models.IntegerField(default=80)
    val_split = models.IntegerField(default=20)
    
    # Path to the generated YAML file required by YOLO
    yaml_file_path = models.CharField(max_length=255, blank=True)

    class_names = models.JSONField(default=list)

    def __str__(self):
        return f"{self.version_name} ({self.total_images} images)"

class TrainingRun(models.Model):
    run_id = models.AutoField(primary_key=True)
    run_name = models.CharField(max_length=100, default="Unknown_Run") 
    dataset = models.ForeignKey(DatasetVersion, on_delete=models.CASCADE)
    started_by = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    
    # Hyperparameters
    model_architecture = models.CharField(max_length=50, default="yolov8n.pt") 
    epochs = models.IntegerField(default=50)
    batch_size = models.IntegerField(default=16)
    img_size = models.IntegerField(default=640)
    learning_rate = models.FloatField(default=0.01) 
    patience = models.IntegerField(default=50) 
    weight_decay = models.FloatField(default=0.0005) # Added
    device = models.CharField(max_length=10, default="0") 
    mosaic = models.FloatField(default=1.0)
    mixup = models.FloatField(default=0.0)
    warmup_epochs = models.FloatField(default=3.0)
    degrees = models.FloatField(default=0.0)
    optimizer_strategy = models.CharField(max_length=50, default="AdamW")

    
    # Status tracking
    status = models.CharField(max_length=50, default="Pending")
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    # Results
    final_map_score = models.FloatField(null=True, blank=True)
    weights_path = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return f"{self.run_name} - {self.status}"
    
class BatchJobRecord(models.Model):
    batch_id = models.AutoField(primary_key=True)
    operator = models.ForeignKey(CustomUser, on_delete=models.SET_NULL, null=True)
    folder_name = models.CharField(max_length=255, default="Batch Upload")
    total_images = models.IntegerField(default=0)
    total_defects_found = models.IntegerField(default=0)
    clean_boards = models.IntegerField(default=0)
    defective_boards = models.IntegerField(default=0)
    
    defect_breakdown = models.JSONField(default=dict, blank=True) 

    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Batch {self.batch_id} by {self.operator.username} - {self.total_images} images"
    
class ValidationRun(models.Model):
    val_id = models.AutoField(primary_key=True)
    run_name = models.CharField(max_length=100, default="Val_Run")
    dataset = models.ForeignKey('DatasetVersion', on_delete=models.CASCADE)
    training_run = models.ForeignKey('TrainingRun', on_delete=models.CASCADE) 
    executed_by = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True)
    
    status = models.CharField(max_length=50, default="Pending")
    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    
    # YOLO Core Metrics
    precision = models.FloatField(null=True, blank=True)
    recall = models.FloatField(null=True, blank=True)
    map50 = models.FloatField(null=True, blank=True)
    map50_95 = models.FloatField(null=True, blank=True)

    # Confusion Matrix Metrics
    tp = models.IntegerField(null=True, blank=True)
    fp = models.IntegerField(null=True, blank=True)
    fn = models.IntegerField(null=True, blank=True)
    tn = models.IntegerField(null=True, blank=True) # Object detection typically omits TN, but included for structure

    def __str__(self):
        return f"{self.run_name} - {self.status}"


# add this to the bottom of models.py
class DeployedModel(models.Model):
    deployment_id = models.AutoField(primary_key=True)
    training_run = models.ForeignKey('TrainingRun', on_delete=models.CASCADE)
    deployed_at = models.DateTimeField(auto_now_add=True)
    deployed_by = models.ForeignKey('CustomUser', on_delete=models.SET_NULL, null=True)
    is_active = models.BooleanField(default=True)

    def save(self, *args, **kwargs):
        # If this model is being set to active, deactivate all others first
        if self.is_active:
            DeployedModel.objects.filter(is_active=True).update(is_active=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Deployment {self.deployment_id} - {self.training_run.run_name}"
    
