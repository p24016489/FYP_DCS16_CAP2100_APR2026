from rest_framework import serializers
from .models import CustomUser, AIModel, ImageRecord, DefectResult, ActivityLog
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Run the standard password check
        data = super().validate(attrs)
        
        # Add our custom user data to the response payload
        data['role'] = self.user.role
        data['username'] = self.user.username
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'role']

class AIModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModel
        fields = '__all__'

class DefectResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = DefectResult
        fields = '__all__'

class ImageRecordSerializer(serializers.ModelSerializer):
    # This will allow us to see the defects attached to an image when we fetch it
    defects = DefectResultSerializer(many=True, read_only=True)
    
    class Meta:
        model = ImageRecord
        fields = ['image_id', 'user', 'file_path', 'resolution', 'upload_timestamp', 'defects']

class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = '__all__'


from rest_framework import serializers
from .models import CustomUser, AIModel, ImageRecord, DefectResult, ActivityLog, AnnotationClass, WorkspacePreference
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # Run the standard password check
        data = super().validate(attrs)
        
        # Add our custom user data to the response payload
        data['role'] = self.user.role
        data['username'] = self.user.username
        
        return data

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ['id', 'username', 'role']

class AIModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModel
        fields = '__all__'

class DefectResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = DefectResult
        fields = '__all__'

class ImageRecordSerializer(serializers.ModelSerializer):
    # This will allow us to see the defects attached to an image when we fetch it
    defects = DefectResultSerializer(many=True, read_only=True)
    
    class Meta:
        model = ImageRecord
        fields = ['image_id', 'user', 'file_path', 'resolution', 'upload_timestamp', 'defects']

class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = '__all__'


class AnnotationClassSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnnotationClass
        fields = ['class_id', 'class_name', 'hex_color']

class WorkspacePreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspacePreference
        fields = ['export_format', 'enable_crosshair', 'auto_save', 'box_opacity']