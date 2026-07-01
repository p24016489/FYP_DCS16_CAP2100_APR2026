import os
import psutil 
import GPUtil
import time
import json
import shutil
import threading
import yaml
import random
import zipfile
import traceback
import torch
import csv
import datetime
from collections import defaultdict
from django.core.cache import cache
from django.core.mail import send_mail
from rest_framework.permissions import AllowAny
from rest_framework import status
from django.db.models.functions import TruncDate
from django.db import connection
from django.conf import settings
from PIL import Image
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from datetime import timedelta
from django.db.models import Count, Avg
from django.contrib.auth import authenticate
from django.utils import timezone
from django.utils.timezone import localtime
from django.contrib.auth.hashers import make_password
from django.core.files.storage import FileSystemStorage
from rest_framework import viewsets, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from ultralytics import YOLO
from .models import CustomUser, AIModel, ImageRecord, DefectResult, ActivityLog, AnnotationClass, WorkspacePreference, ManualCorrection, DatasetVersion, TrainingRun, BatchJobRecord, ValidationRun, DeployedModel
from .serializers import (
    UserSerializer, AIModelSerializer, ImageRecordSerializer, 
    DefectResultSerializer, ActivityLogSerializer, 
    AnnotationClassSerializer, WorkspacePreferenceSerializer 
)

# Standard API Endpoints (For fetching logs, models, and history)
class AIModelViewSet(viewsets.ModelViewSet):
    queryset = AIModel.objects.all()
    serializer_class = AIModelSerializer

class ImageRecordViewSet(viewsets.ModelViewSet):
    queryset = ImageRecord.objects.all()
    serializer_class = ImageRecordSerializer

class ActivityLogViewSet(viewsets.ModelViewSet):
    queryset = ActivityLog.objects.all()
    serializer_class = ActivityLogSerializer

# The Core Inspection Endpoint
class RunInspectionView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('image')
        
        if not uploaded_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        image_record = ImageRecord.objects.create(
            user=user,
            file_path=uploaded_file,
            resolution="Pending" 
        )

        image_path = image_record.file_path.path

        # LOAD YOLO MODEL AND RUN INFERENCE
        try:
            # --- DYNAMIC DEPLOYMENT LOGIC ---
            active_deployment = DeployedModel.objects.filter(is_active=True).first()
            
            # Check if a model is deployed AND the weights file actually exists
            if active_deployment and active_deployment.training_run.weights_path and os.path.exists(active_deployment.training_run.weights_path):
                model_path = active_deployment.training_run.weights_path
            else:
                # Fallback to your default best.pt in the main folder!
                model_path = os.path.join(settings.BASE_DIR, 'best.pt') 
                
            model = YOLO(model_path)

            
            results = model(image_path)
            
            detected_defects = []

            for box in results[0].boxes:
                x_min, y_min, x_max, y_max = box.xyxy[0].tolist()
                confidence = box.conf[0].item()
                class_id = int(box.cls[0].item())
                label = model.names[class_id]

                defect = DefectResult.objects.create(
                    image=image_record,
                    detected_by=request.user,
                    classification_label=label,
                    confidence_score=confidence,
                    x_min=x_min,
                    y_min=y_min,
                    x_max=x_max,
                    y_max=y_max
                )
                
                detected_defects.append({
                    "id": defect.defect_id,
                    "label": label,
                    "confidence": round(confidence, 4),
                    "bbox": [x_min, y_min, x_max, y_max]
                })

            ActivityLog.objects.create(
                image=image_record,
                user=user,
                inspection_duration=sum(results[0].speed.values()), 
                success_status=True
            )

            return Response({
                "message": "Inspection complete",
                "image_id": image_record.image_id,
                "image_url": request.build_absolute_uri(image_record.file_path.url),
                "total_defects_found": len(detected_defects),
                "defects": detected_defects
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# UPDATE SYSTEM HEALTH API
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def system_health_api(request):
    cpu = psutil.cpu_percent()
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    boot_time = psutil.boot_time()
    uptime_seconds = int(time.time() - boot_time)

    try:
        gpus = GPUtil.getGPUs()
        if gpus:
            gpu = gpus[0]
            gpu_used = round(gpu.memoryUsed / 1024, 1)
            gpu_total = round(gpu.memoryTotal / 1024, 1)
            gpu_temp = int(gpu.temperature)
        else:
            gpu_used, gpu_total, gpu_temp = 0.0, 12.0, 40 
    except Exception:
        gpu_used, gpu_total, gpu_temp = 0.0, 12.0, 40

    # --- DYNAMIC DEPLOYMENT LOGIC ---
    active_deployment = DeployedModel.objects.filter(is_active=True).first()
    if active_deployment:
        active_model_name = f"{active_deployment.training_run.run_name}.pt"
    else:
        active_model_name = "best.pt (Default)"

    avg_latency_dict = ActivityLog.objects.aggregate(Avg('inspection_duration'))
    raw_avg = avg_latency_dict['inspection_duration__avg']
    inference_latency = f"{round(raw_avg, 1)}ms" if raw_avg else "N/A"

    return Response({
        "cpu_percent": cpu,
        "ram_used": round(ram.used / (1024**3), 1),
        "ram_total": round(ram.total / (1024**3), 1),
        "disk_used": round(disk.used / (1024**3), 1),
        "disk_total": round(disk.total / (1024**3), 1),
        "gpu_used": gpu_used,
        "gpu_total": gpu_total,
        "gpu_temp": gpu_temp,
        "uptime_seconds": uptime_seconds,
        "active_model": active_model_name,        
        "inference_latency": inference_latency 
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def provision_user_api(request):
    username = request.data.get('username')
    email = request.data.get('email')
    password = request.data.get('password')
    role = request.data.get('role', 'user')
    user_making_request = request.user

    # --- SECURITY CHECK: Provisioning Rights ---
    # Standard QA Engineers cannot create accounts
    if user_making_request.role == 'user':
        return Response({'error': 'Unauthorized. You do not have permission to create accounts.'}, status=status.HTTP_403_FORBIDDEN)
    
    # Admins cannot create other admins or superadmins
    if user_making_request.role == 'admin' and role in ['admin', 'superadmin']:
        return Response({'error': 'Unauthorized. Admins can only provision QA Engineer accounts.'}, status=status.HTTP_403_FORBIDDEN)
    # ---------------------------------------------

    # Security check: Does this user already exist?
    if CustomUser.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists!'}, status=status.HTTP_400_BAD_REQUEST)

    # Save to PostgreSQL
    try:
        user = CustomUser.objects.create(
            username=username,
            email=email,
            password=make_password(password), # ALWAYS hash passwords!
            role=role,
            created_by=request.user 
        )
        return Response({'message': 'User provisioned successfully!'}, status=status.HTTP_201_CREATED)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_users_api(request):
    """Fetches users from the database to display in the React table based on role."""
    user_making_request = request.user

    try:
        # --- SECURITY CHECK 2: Directory Visibility ---
        if user_making_request.role == 'superadmin':
            users = CustomUser.objects.all().order_by('id')
        elif user_making_request.role == 'admin':
            # Admins only get QA Engineers
            users = CustomUser.objects.filter(role='user').order_by('id')
        else:
            # Normal users shouldn't see the directory at all
            return Response({"error": "Unauthorized access."}, status=status.HTTP_403_FORBIDDEN)
        # ---------------------------------------------

        users_data = []
        
        for user in users:
            # 1. REAL 3-State Status Logic
            if not getattr(user, 'is_active', True):
                status_text = "Suspended"
            elif getattr(user, 'is_online', False):
                status_text = "Online"
            else:
                status_text = "Offline"
                
            # 2. REAL Last Login Tracking
            formatted_last_login = "Never logged in"
            if user.last_login:
                local_time = localtime(user.last_login) # Converts to your local timezone
                formatted_last_login = local_time.strftime('%b %d, %Y %I:%M %p')

            users_data.append({
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "employee_id": user.employee_id,
                "role": getattr(user, 'role', 'user'),
                "status": status_text, 
                "last_login": formatted_last_login,
                "created_by": user.created_by.username if user.created_by else "System" 
            })
            
        return Response(users_data, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_user_api(request, user_id):
    """Deletes a specific user by their ID."""
    user_making_request = request.user

    try:
        target_user = CustomUser.objects.get(id=user_id)

        # --- SECURITY CHECK 3: Deletion Rights ---
        if user_making_request.role == 'user':
            return Response({"error": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)
            
        if user_making_request.role == 'admin' and target_user.role in ['admin', 'superadmin']:
            return Response({"error": "Unauthorized. You can only delete QA Engineers."}, status=status.HTTP_403_FORBIDDEN)
        # ---------------------------------------------

        target_user.delete()
        return Response({"message": f"User {target_user.username} deleted successfully!"}, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def toggle_user_status_api(request, user_id):
    """Suspends or Activates a user by changing their is_active status."""
    user_making_request = request.user

    try:
        target_user = CustomUser.objects.get(id=user_id)

        # --- SECURITY CHECK 4: Modification Rights ---
        if user_making_request.role == 'user':
            return Response({"error": "Unauthorized."}, status=status.HTTP_403_FORBIDDEN)
            
        if user_making_request.role == 'admin' and target_user.role in ['admin', 'superadmin']:
            return Response({"error": "Unauthorized. You can only modify QA Engineers."}, status=status.HTTP_403_FORBIDDEN)
        # ---------------------------------------------

        new_status = request.data.get('status')
        
        # This completely locks them out of the system if suspended!
        if new_status == 'Suspended':
            target_user.is_active = False 
        else:
            target_user.is_active = True
            
        target_user.save() 
        
        return Response({"message": f"User {target_user.username} status updated!"}, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_api(request):
    """Marks the user as Offline in the database when they click Disconnect"""
    username = request.data.get('username')
    try:
        user = CustomUser.objects.get(username=username)
        user.is_online = False
        user.save()
        return Response({"message": "Logged out successfully"}, status=status.HTTP_200_OK)
    except CustomUser.DoesNotExist:
        return Response({"error": "User not found"}, status=status.HTTP_404_NOT_FOUND)
    

# --- 1. MFA LOGIN PHASE 1: Verify Creds & Send OTP ---
@api_view(['POST'])
@permission_classes([AllowAny])
def login_api(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)

    if user is not None:
        if not user.is_active:
            return Response({"error": "This account has been suspended."}, status=status.HTTP_403_FORBIDDEN)
        
        if not user.email:
            return Response({"error": "No email registered to this account for MFA."}, status=status.HTTP_400_BAD_REQUEST)

        # Generate 6-digit OTP
        otp = str(random.randint(100000, 999999))
        
        # Store in cache for 5 minutes (300 seconds)
        cache.set(f"mfa_otp_{username}", otp, timeout=300)

        # Mask email for frontend security (e.g., j***@gmail.com)
        email_parts = user.email.split('@')
        masked_email = f"{email_parts[0][0]}***@{email_parts[1]}"

        try:
            send_mail(
                'PCB VISION - Login OTP',
                f'Your authentication code is: {otp}\n\nThis code expires in 5 minutes.',
                settings.EMAIL_HOST_USER,
                [user.email],
                fail_silently=False,
            )
            return Response({
                "message": "OTP sent",
                "require_otp": True,
                "masked_email": masked_email
            }, status=status.HTTP_200_OK)
        except Exception as e:
            print(e)
            return Response({"error": "Failed to dispatch email. Check server SMTP configuration."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    else:
        return Response({"error": "Invalid System ID or password."}, status=status.HTTP_401_UNAUTHORIZED)


# --- 2. MFA LOGIN PHASE 2: Verify OTP & Issue Token ---
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_login_otp_api(request):
    username = request.data.get('username')
    otp_submitted = request.data.get('otp')

    # Retrieve cached OTP
    cached_otp = cache.get(f"mfa_otp_{username}")

    if cached_otp and cached_otp == str(otp_submitted):
        # OTP is valid, clear it
        cache.delete(f"mfa_otp_{username}")
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(username=username)

        # Update telemetry
        user.last_login = timezone.now()
        user.is_online = True
        user.save()

        refresh = RefreshToken.for_user(user)

        return Response({
            "message": "Login successful",
            "username": user.username,
            "role": getattr(user, 'role', 'user'),
            "token": str(refresh.access_token)
        }, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)


# --- 3. FORGOT PASSWORD PHASE 1: Verify User & Send OTP ---
@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset_api(request):
    username = request.data.get('username')
    email = request.data.get('email')
    
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    try:
        user = User.objects.get(username=username, email=email)
        
        otp = str(random.randint(100000, 999999))
        cache.set(f"reset_otp_{username}", otp, timeout=300)

        send_mail(
            'PCB VISION - Password Reset Request',
            f'Your password reset code is: {otp}\n\nThis code expires in 5 minutes.',
            settings.EMAIL_HOST_USER,
            [user.email],
            fail_silently=False,
        )
        return Response({"message": "Reset code dispatched."}, status=status.HTTP_200_OK)
        
    except User.DoesNotExist:
        # Generic error prevents user enumeration
        return Response({"error": "Invalid User ID or Email combination."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": "Email dispatch failed."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# --- 4. FORGOT PASSWORD PHASE 2: Verify OTP & Change Password ---
@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_api(request):
    username = request.data.get('username')
    otp_submitted = request.data.get('otp')
    new_password = request.data.get('new_password')

    cached_otp = cache.get(f"reset_otp_{username}")

    if cached_otp and cached_otp == str(otp_submitted):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(username=username)
        
        user.set_password(new_password)
        user.save()
        cache.delete(f"reset_otp_{username}")
        
        return Response({"message": "Password updated successfully. You may now log in."}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Invalid or expired reset code."}, status=status.HTTP_400_BAD_REQUEST)
    
# --- 5. FORGOT PASSWORD CHECKPOINT: Verify OTP Only ---
@api_view(['POST'])
@permission_classes([AllowAny])
def verify_reset_otp_api(request):
    username = request.data.get('username')
    otp_submitted = request.data.get('otp')

    cached_otp = cache.get(f"reset_otp_{username}")

    if cached_otp and cached_otp == str(otp_submitted):
        # Do NOT delete the cache here! We still need it for the final reset step.
        return Response({"message": "OTP verified successfully."}, status=status.HTTP_200_OK)
    else:
        return Response({"error": "Invalid or expired reset code."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_profile_api(request):
    """Fetches the current logged-in user's profile data to auto-fill the frontend."""
    user = request.user
    return Response({
        "username": user.username,
        "email": user.email
    }, status=status.HTTP_200_OK)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def update_profile_api(request):
    """Updates user profile and selectively verifies password with MFA OTP."""
    original_username = request.data.get('original_username')
    new_username = request.data.get('new_username')
    email = request.data.get('email')
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    otp_submitted = request.data.get('otp')

    try:
        user = CustomUser.objects.get(username=original_username)

        # THE SECURITY CHECK: If changing password, trigger MFA
        if new_password:
            if not user.check_password(current_password):
                return Response({"error": "Incorrect current password. Changes not saved."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Phase 1: No OTP submitted yet -> Generate and Send it
            if not otp_submitted:
                if not user.email:
                    return Response({"error": "No email registered to receive OTP."}, status=status.HTTP_400_BAD_REQUEST)
                
                otp = str(random.randint(100000, 999999))
                cache.set(f"profile_otp_{original_username}", otp, timeout=300)
                
                send_mail(
                    'PCB VISION - Profile Security Update',
                    f'Your authorization code to change your password is: {otp}\n\nThis code expires in 5 minutes.',
                    settings.EMAIL_HOST_USER,
                    [user.email],
                    fail_silently=False,
                )
                
                masked_email = f"{user.email.split('@')[0][0]}***@{user.email.split('@')[1]}"
                return Response({
                    "require_otp": True, 
                    "masked_email": masked_email,
                    "message": "OTP dispatched."
                }, status=status.HTTP_200_OK)
            
            # Phase 2: OTP was submitted -> Verify it
            else:
                cached_otp = cache.get(f"profile_otp_{original_username}")
                if not cached_otp or cached_otp != str(otp_submitted):
                    return Response({"error": "Invalid or expired OTP code."}, status=status.HTTP_400_BAD_REQUEST)
                
                # OTP is correct! Update password and clear cache.
                user.set_password(new_password)
                cache.delete(f"profile_otp_{original_username}")

        # Apply Username / Email changes (Commits simultaneously with password if OTP passed)
        if new_username and new_username != original_username:
            if CustomUser.objects.filter(username=new_username).exists():
                return Response({"error": "That System ID (Username) is already taken."}, status=status.HTTP_400_BAD_REQUEST)
            user.username = new_username
        
        if email:
            user.email = email
            
        user.save()
        return Response({"message": "Profile updated successfully!"}, status=status.HTTP_200_OK)

    except CustomUser.DoesNotExist:
        return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    


class AnnotationSettingsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 1. GLOBAL TAXONOMY: Everyone sees the exact same master list of defects
        classes = AnnotationClass.objects.all().order_by('class_id')
        class_serializer = AnnotationClassSerializer(classes, many=True)
        
        # 2. PERSONAL PREFERENCES: UI settings remain tied specifically to the logged-in user
        pref, created = WorkspacePreference.objects.get_or_create(user=request.user)
        
        return Response({
            "labels": class_serializer.data,
            "settings": {
                "export_format": pref.export_format or 'yolo',
                "enable_crosshair": pref.enable_crosshair if pref.enable_crosshair is not None else True,
                "auto_save": pref.auto_save if pref.auto_save is not None else True,
                "box_opacity": pref.box_opacity or 40
            }
        }, status=status.HTTP_200_OK)

    def post(self, request):
        user = request.user
        
        # Optional Security: Prevent standard QA Engineers from deleting/modifying the master class list
        if user.role == 'user':
            return Response({"error": "Only Admins can modify the global defect taxonomy."}, status=status.HTTP_403_FORBIDDEN)

        labels_data = request.data.get('labels', [])
        settings_data = request.data.get('settings', {})

        # --- GLOBAL SMART SYNC ---
        incoming_names = [item['name'] for item in labels_data]

        # A. Delete classes from the master database that were removed in the React UI
        AnnotationClass.objects.exclude(class_name__in=incoming_names).delete()
        
        # B. Add or Update the global classes
        for item in labels_data:
            obj, created = AnnotationClass.objects.get_or_create(
                class_name=item['name'],
                defaults={
                    'hex_color': item['color'],
                    'created_by': user # Records which Admin created this specific class
                }
            )
            
            # C. Update Color if an Admin changes it in the UI
            if not created and obj.hex_color != item['color']:
                obj.hex_color = item['color']
                obj.save()

        # --- PERSONAL WORKSPACE SYNC ---
        pref, created = WorkspacePreference.objects.get_or_create(user=user)
        pref.export_format = settings_data.get('exportFormat', 'yolo')
        pref.enable_crosshair = settings_data.get('enableCrosshair', True)
        pref.auto_save = settings_data.get('autoSave', True)
        pref.box_opacity = settings_data.get('boxOpacity', 40)
        pref.save()

        return Response({"message": "Configurations saved successfully!"}, status=status.HTTP_200_OK)
    

class SaveAnnotationsAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        uploaded_file = request.FILES.get('image')
        if not uploaded_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # Parse the bounding boxes sent from React
            boxes_data = json.loads(request.POST.get('boxes', '[]'))
        except Exception:
            return Response({"error": "Invalid boxes data structure"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # --- RENAME LOGIC START ---
            
            # 1. Extract unique defect names from the bounding boxes
            defect_names = set()
            for box in boxes_data:
                defect_class = box.get('class', 'unknown')
                # Replace spaces with underscores for a clean filename
                clean_name = defect_class.replace(' ', '_')
                defect_names.add(clean_name)
            
            # 2. Sort them so the naming is consistent
            sorted_defects = sorted(list(defect_names))
            
            # 3. Create the defect string part of the filename
            if sorted_defects:
                defect_string = "-".join(sorted_defects)
            else:
                defect_string = "no_defect"
                
            # 4. Get the original file extension (e.g., '.jpg', '.png')
            original_extension = os.path.splitext(uploaded_file.name)[1]
            if not original_extension:
                original_extension = '.jpg' # Fallback
                
            # 5. Construct the new file name: e.g., "mouse_bite-spur_1678901234.jpg"
            # Using a timestamp ensures we never overwrite an existing file with the exact same defects
            timestamp = int(time.time())
            new_filename = f"{defect_string}_{timestamp}{original_extension}"
            
            # 6. Apply the new name to the uploaded file object BEFORE saving
            uploaded_file.name = new_filename
            
            # --- RENAME LOGIC END ---

            # 1. Save the new image
            image_record = ImageRecord.objects.create(
                user=request.user,
                file_path=uploaded_file, # Django will use uploaded_file.name to save it
                resolution="Pending" 
            )

            # 2. Map and save all drawn bounding boxes to the database
            corrections = []
            for box in boxes_data:
                corrections.append(ManualCorrection(
                    image=image_record,
                    corrected_by=request.user,
                    corrected_label=box['class'], 
                    is_compiled_for_training=False, 
                    x_min=box['x'],
                    y_min=box['y'],
                    x_max=box['x'] + box['width'],
                    y_max=box['y'] + box['height']
                ))
            
            if corrections:
                ManualCorrection.objects.bulk_create(corrections)

            return Response({
                "message": f"Successfully synced {len(corrections)} annotations!",
                "image_id": image_record.image_id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

# --- DATASET MANAGEMENT APIs ---

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_training_data_api(request):
    """Provides React with uncompiled stats, available datasets, and the dynamic output directory."""
    uncompiled_count = ImageRecord.objects.filter(corrections__isnull=False, corrections__is_compiled_for_training=False).distinct().count()
    
    datasets = list(DatasetVersion.objects.all().order_by('-created_at').values('version_id', 'version_name', 'total_images'))
    
    real_base_dir = os.path.join(settings.BASE_DIR, 'runs', 'detect').replace('\\', '/')
    
    return Response({
        "uncompiled_count": uncompiled_count,
        "datasets": datasets,
        "base_output_dir": real_base_dir
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def compile_dataset_api(request):
    """Physically converts database corrections into YOLO format, merges base data, and re-splits."""
    version_name = request.data.get('version_name')
    train_ratio = int(request.data.get('train_split', 80)) / 100.0
    merge_base = request.data.get('merge_base', True)
    base_version_name = request.data.get('base_version_name') 

    new_images = ImageRecord.objects.filter(corrections__isnull=False, corrections__is_compiled_for_training=False).distinct()
    images_list = list(new_images)
    
    if len(images_list) == 0 and not merge_base:
        return Response({"error": "No new annotated images found to compile."}, status=400)

    dataset_dir = os.path.join(settings.BASE_DIR, 'datasets', version_name)
    
    # --- 1. DETERMINE THE MAP STRATEGY FROM THE BASE DATASET ---
    class_names = []
    if merge_base and base_version_name:
        try:
            base_dataset = DatasetVersion.objects.get(version_name=base_version_name)
            if hasattr(base_dataset, 'class_names') and base_dataset.class_names:
                class_names = base_dataset.class_names
            else:
                # FIX: Change class_id to class_name
                class_names = [c.class_name for c in AnnotationClass.objects.all().order_by('class_name')]
        except DatasetVersion.DoesNotExist:
            return Response({"error": f"Base dataset '{base_version_name}' not found."}, status=400)
    else:
        # FIX: Change class_id to class_name
        class_names = [c.class_name for c in AnnotationClass.objects.all().order_by('class_name')]

    if not class_names:
        class_names = ['missing_hole', 'mouse_bite', 'open_circuit', 'short', 'spur', 'spurious_copper']

    class_map = {name: idx for idx, name in enumerate(class_names)}

    # --- 2. CREATE FLAT TEMPORARY DIRECTORIES ---
    temp_img_dir = os.path.join(dataset_dir, "temp_images")
    temp_lbl_dir = os.path.join(dataset_dir, "temp_labels")
    os.makedirs(temp_img_dir, exist_ok=True)
    os.makedirs(temp_lbl_dir, exist_ok=True)

    total_images_merged = 0

    # --- 3. EXTRACT BASE KNOWLEDGE INTO TEMP POOL ---
    if merge_base and base_version_name:
        if base_dataset.yaml_file_path:
            base_dataset_dir = os.path.dirname(base_dataset.yaml_file_path)
            for subset in ['train', 'val', 'valid']: 
                base_img_dir = os.path.join(base_dataset_dir, 'images', subset)
                base_lbl_dir = os.path.join(base_dataset_dir, 'labels', subset)
                
                if os.path.exists(base_img_dir):
                    for file in os.listdir(base_img_dir):
                        if file.lower().endswith(('.png', '.jpg', '.jpeg')):
                            shutil.copy(os.path.join(base_img_dir, file), os.path.join(temp_img_dir, file))
                            total_images_merged += 1
                            
                if os.path.exists(base_lbl_dir):
                    for file in os.listdir(base_lbl_dir):
                        if file.endswith('.txt'):
                            shutil.copy(os.path.join(base_lbl_dir, file), os.path.join(temp_lbl_dir, file))

    # --- 4. PROCESS NEW DATABASE ANNOTATIONS WITH DYNAMIC MAP ---
    for img_record in images_list:
        img_path = img_record.file_path.path
        filename = os.path.basename(img_path)
        
        try:
            with Image.open(img_path) as img:
                img_width, img_height = img.size
        except Exception:
            continue

        shutil.copy(img_path, os.path.join(temp_img_dir, filename))
        txt_filename = os.path.splitext(filename)[0] + '.txt'
        dest_txt_path = os.path.join(temp_lbl_dir, txt_filename)
        
        corrections = img_record.corrections.filter(is_compiled_for_training=False)
        with open(dest_txt_path, 'w') as f:
            for c in corrections:
                # Use the inherited base class order mapping
                class_idx = class_map.get(c.corrected_label, 0)
                x_center = ((c.x_min + c.x_max) / 2.0) / img_width
                y_center = ((c.y_min + c.y_max) / 2.0) / img_height
                width = (c.x_max - c.x_min) / img_width
                height = (c.y_max - c.y_min) / img_height
                f.write(f"{class_idx} {x_center:.6f} {y_center:.6f} {width:.6f} {height:.6f}\n")
                
                c.is_compiled_for_training = True
                c.save()
        total_images_merged += 1

    # --- 5. UNIFIED SHUFFLE & SPLIT ---
    all_images = os.listdir(temp_img_dir)
    if len(all_images) == 0:
        shutil.rmtree(dataset_dir, ignore_errors=True)
        return Response({"error": "No images available to compile."}, status=400)

    standard_images_dir = os.path.join(dataset_dir, 'images')
    standard_labels_dir = os.path.join(dataset_dir, 'labels')
    
    for sub in ['train', 'val']:
        os.makedirs(os.path.join(standard_images_dir, sub), exist_ok=True)
        os.makedirs(os.path.join(standard_labels_dir, sub), exist_ok=True)

    random.shuffle(all_images)
    split_idx = int(len(all_images) * train_ratio)

    for i, img_name in enumerate(all_images):
        subset = 'train' if i < split_idx else 'val'
        txt_name = os.path.splitext(img_name)[0] + '.txt'
        
        shutil.move(os.path.join(temp_img_dir, img_name), os.path.join(standard_images_dir, subset, img_name))
        
        if os.path.exists(os.path.join(temp_lbl_dir, txt_name)):
            shutil.move(os.path.join(temp_lbl_dir, txt_name), os.path.join(standard_labels_dir, subset, txt_name))
            
    shutil.rmtree(temp_img_dir, ignore_errors=True)
    shutil.rmtree(temp_lbl_dir, ignore_errors=True)

    # --- 6. GENERATE DATA.YAML & UPDATE DB ---
    yaml_path = os.path.join(dataset_dir, 'data.yaml')
    yaml_data = {
        'train': os.path.join(dataset_dir, 'images/train').replace('\\', '/'),
        'val': os.path.join(dataset_dir, 'images/val').replace('\\', '/'),
        'nc': len(class_names),
        'names': class_names
    }
    with open(yaml_path, 'w') as outfile:
        yaml.dump(yaml_data, outfile, default_flow_style=False)

    dataset_obj = DatasetVersion.objects.create(
        version_name=version_name,
        created_by=request.user,
        total_images=total_images_merged,
        train_split=train_ratio * 100,
        val_split=100 - (train_ratio * 100),
        yaml_file_path=yaml_path,
        class_names=class_names # Lock mapping sequence
    )

    return Response({"message": f"Dataset successfully compiled and re-split with {total_images_merged} images!", "id": dataset_obj.version_id}, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_local_dataset_api(request):
    """Handles uploading a .zip file OR a folder containing a YOLO dataset structure."""
    version_name = request.data.get('version_name')
    upload_mode = request.data.get('upload_mode', 'zip')
    train_ratio = int(request.data.get('train_split', 80)) / 100.0

    dataset_dir = os.path.join(settings.BASE_DIR, 'datasets', version_name)
    os.makedirs(dataset_dir, exist_ok=True)

    try:
        # --- LOGIC FOR ZIP UPLOAD ---
        if upload_mode == 'zip':
            zip_file = request.FILES.get('zip_file')
            if not zip_file:
                return Response({"error": "No ZIP file provided."}, status=400)
            
            fs = FileSystemStorage(location=dataset_dir)
            filename = fs.save(zip_file.name, zip_file)
            zip_path = os.path.join(dataset_dir, filename)

            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(dataset_dir)
            os.remove(zip_path)

        # --- LOGIC FOR FOLDER UPLOAD ---
        else:
            files = request.FILES.getlist('files')
            paths = request.POST.getlist('paths')
            
            if not files or not paths:
                return Response({"error": "No files received from folder."}, status=400)

            for file, path in zip(files, paths):
                full_dest_path = os.path.join(dataset_dir, path)
                os.makedirs(os.path.dirname(full_dest_path), exist_ok=True)
                
                with open(full_dest_path, 'wb+') as destination:
                    for chunk in file.chunks():
                        destination.write(chunk)

        # --- 1. FIND ALL IMAGES, LABELS, AND THE YAML FILE ---
        temp_img_dir = os.path.join(dataset_dir, "temp_images")
        temp_lbl_dir = os.path.join(dataset_dir, "temp_labels")
        os.makedirs(temp_img_dir, exist_ok=True)
        os.makedirs(temp_lbl_dir, exist_ok=True)

        detected_class_names = []

        for root, _, files in os.walk(dataset_dir):
            if "temp_images" in root or "temp_labels" in root:
                continue
                
            for f in files:
                file_lower = f.lower()
                
                if file_lower.endswith(('.png', '.jpg', '.jpeg')):
                    shutil.move(os.path.join(root, f), os.path.join(temp_img_dir, f))
                
                # Check for classes.txt
                elif file_lower == 'classes.txt':
                    cls_path = os.path.join(root, f)
                    try:
                        with open(cls_path, 'r') as cls_file:
                            detected_class_names = [line.strip() for line in cls_file.readlines() if line.strip()]
                    except Exception:
                        pass
                    os.remove(cls_path)
                    
                elif file_lower.endswith('.txt'):
                    shutil.move(os.path.join(root, f), os.path.join(temp_lbl_dir, f))
                    
                elif file_lower in ['data.yaml', 'data.yml']:
                    yaml_path_temp = os.path.join(root, f)
                    try:
                        with open(yaml_path_temp, 'r') as yaml_file:
                            uploaded_yaml_data = yaml.safe_load(yaml_file)
                            names_data = uploaded_yaml_data.get('names', [])
                            if isinstance(names_data, dict):
                                detected_class_names = [names_data[k] for k in sorted(names_data.keys())]
                            elif isinstance(names_data, list):
                                detected_class_names = names_data
                    except Exception as e:
                        print(f"Warning: Failed to parse uploaded yaml: {e}")

        # --- 2. STRICT VALIDATION (THE FIX) ---
        if not detected_class_names:
            # If we didn't find a yaml or a classes.txt, we delete the upload and reject it!
            shutil.rmtree(dataset_dir, ignore_errors=True)
            return Response({
                "error": "Missing Class Dictionary! Your upload must contain a 'data.yaml' or 'classes.txt' file to prevent AI mislabeling."
            }, status=400)

        # --- 3. STANDARD FILE VALIDATION ---
        all_images = os.listdir(temp_img_dir)
        all_labels = os.listdir(temp_lbl_dir)

        if len(all_images) == 0 or len(all_labels) == 0:
            shutil.rmtree(dataset_dir, ignore_errors=True)
            return Response({"error": "Invalid format. No image or label files found."}, status=400)

        for item in os.listdir(dataset_dir):
            item_path = os.path.join(dataset_dir, item)
            if os.path.isdir(item_path) and item not in ["temp_images", "temp_labels"]:
                shutil.rmtree(item_path, ignore_errors=True)

        # --- 4. RE-SPLIT DATA ---
        standard_images_dir = os.path.join(dataset_dir, 'images')
        standard_labels_dir = os.path.join(dataset_dir, 'labels')
        
        for sub in ['train', 'val']:
            os.makedirs(os.path.join(standard_images_dir, sub), exist_ok=True)
            os.makedirs(os.path.join(standard_labels_dir, sub), exist_ok=True)
        
        random.shuffle(all_images)
        split_idx = int(len(all_images) * train_ratio)

        for i, img_name in enumerate(all_images):
            subset = 'train' if i < split_idx else 'val'
            txt_name = os.path.splitext(img_name)[0] + '.txt'
            
            shutil.move(os.path.join(temp_img_dir, img_name), os.path.join(standard_images_dir, subset, img_name))
            
            if os.path.exists(os.path.join(temp_lbl_dir, txt_name)):
                shutil.move(os.path.join(temp_lbl_dir, txt_name), os.path.join(standard_labels_dir, subset, txt_name))
                
        shutil.rmtree(temp_img_dir, ignore_errors=True)
        shutil.rmtree(temp_lbl_dir, ignore_errors=True)

        # --- 5. GENERATE A FRESH DATA.YAML ---
        yaml_path = os.path.join(dataset_dir, 'data.yaml')
        yaml_data = {
            'train': os.path.join(dataset_dir, 'images/train').replace('\\', '/'),
            'val': os.path.join(dataset_dir, 'images/val').replace('\\', '/'),
            'nc': len(detected_class_names),
            'names': detected_class_names 
        }
        with open(yaml_path, 'w') as outfile:
            yaml.dump(yaml_data, outfile, default_flow_style=False)

        total_images = len(all_images)

        DatasetVersion.objects.create(
            version_name=version_name,
            created_by=request.user,
            total_images=total_images,
            train_split=train_ratio * 100,
            val_split=100 - (train_ratio * 100),
            yaml_file_path=yaml_path,
            class_names=detected_class_names 
        )

        return Response({"message": f"Local dataset uploaded and split successfully with {total_images} images!"}, status=201)
    
    except Exception as e:
        return Response({"error": f"Failed to process dataset: {str(e)}"}, status=500)
    

ABORT_SIGNALS = {}
TRAINING_PROGRESS = {}

def run_yolo_training_thread(run_id, yaml_path, model_arch, run_name, epochs, batch_size, img_size, learning_rate, patience, weight_decay, device, optimizer, mosaic, mixup, warmup_epochs, degrees):
    connection.close() # Keep DB connection clean

    try:
        run = TrainingRun.objects.get(run_id=run_id)
        run.status = "Training"
        run.save()

        model = YOLO(model_arch)
        project_dir = os.path.join(settings.BASE_DIR, 'runs', 'detect')

        # --- YOLO KILL SWITCH CALLBACK ---
        ABORT_SIGNALS[run_id] = False
        def check_abort(trainer):
            if ABORT_SIGNALS.get(run_id):
                print(f"--- ABORT SIGNAL RECEIVED FOR RUN {run_id} ---")
                trainer.stop = True 
                
        model.add_callback("on_train_batch_end", check_abort)

        # --- NEW: YOLO PROGRESS CALLBACK ---
        TRAINING_PROGRESS[run_id] = {"epoch": 0, "total_epochs": epochs, "percent": 0}
        
        def update_progress(trainer):
            # trainer.epoch is 0-indexed, so we add 1
            current = trainer.epoch + 1
            total = trainer.epochs
            percent = int((current / total) * 100) if total > 0 else 0
            
            TRAINING_PROGRESS[run_id] = {
                "epoch": current,
                "total_epochs": total,
                "percent": percent
            }

        model.add_callback("on_train_epoch_end", update_progress)
        # --------------------------------------

        results = model.train(
            data=yaml_path,
            epochs=epochs,
            batch=batch_size,
            imgsz=img_size,
            lr0=learning_rate,
            patience=patience,
            weight_decay=weight_decay,
            device=device,
            project=project_dir,
            name=run_name,
            optimizer=optimizer,
            mosaic=mosaic,
            mixup=mixup,
            warmup_epochs=warmup_epochs,
            degrees=degrees
        )

        # Check if we stopped because of an abort signal
        if ABORT_SIGNALS.get(run_id):
            run = TrainingRun.objects.get(run_id=run_id)
            run.status = "Failed" # Mark as failed/aborted
            run.end_time = timezone.now()
            run.save()
            ABORT_SIGNALS.pop(run_id, None) # Cleanup
            return

        # --- Normal Success Logic ---
        run.end_time = timezone.now()
        
        try:
            if hasattr(results, 'box') and hasattr(results.box, 'map'):
                run.final_map_score = float(results.box.map)
            elif hasattr(results, 'results_dict'):
                run.final_map_score = float(results.results_dict.get('metrics/mAP50-95(B)', 0.0))
            else:
                run.final_map_score = 0.0
        except Exception as extract_err:
            run.final_map_score = 0.0
        
        run.status = "Completed"
        

        weights_dir = os.path.join(project_dir, run_name, 'weights')
        run.weights_path = os.path.join(weights_dir, 'best.pt')
        run.save()

        
        try:
            print(f"--- INITIALIZING AUTOMATIC ONNX EXPORT FOR RUN: {run_name} ---")
            # We re-load the absolute best trained weights to guarantee peak accuracy conversion
            export_model = YOLO(run.weights_path)
            
            # Export the model. format='onnx' compiles it down perfectly.
            # opset=12 guarantees maximum cross-platform runtime compatibility.
            export_model.export(format='onnx', opset=12)
            print(f"--- ONNX EXPORT SUCCESSFUL: Saved inside {weights_dir}/best.onnx ---")
        except Exception as export_err:
            print(f"--- ONNX EXPORT FAILED: {export_err} ---")


    except Exception as e:
        print(f"Training Exception: {e}")
        traceback.print_exc()
        run = TrainingRun.objects.get(run_id=run_id)
        run.status = "Success" if run.end_time else "Failed"
        run.end_time = timezone.now()
        run.save()
    finally:
        ABORT_SIGNALS.pop(run_id, None)
        TRAINING_PROGRESS.pop(run_id, None)
        connection.close()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_training_progress_api(request, pk):
    """Returns the real-time progress of an active training thread."""
    
    # FIX: Convert the string 'pk' from the URL into an integer 
    # so it correctly matches the integer key in the dictionary.
    run_id = int(pk) if str(pk).isdigit() else pk
    
    progress = TRAINING_PROGRESS.get(run_id)
    
    if progress:
        return Response(progress, status=200)
    
    # Return 0 if the training thread hasn't logged an epoch yet
    return Response({"epoch": 0, "total_epochs": 0, "percent": 0}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def abort_training_api(request):
    """Signals the YOLO thread to stop and marks the database record as Failed."""
    run_id = request.data.get('run_id')
    if not run_id:
        return Response({"error": "Run ID required"}, status=400)
        
    # Trip the kill switch
    ABORT_SIGNALS[run_id] = True
    
    # Instantly update the database so the frontend knows it was aborted
    try:
        run = TrainingRun.objects.get(run_id=run_id)
        run.status = "Failed"
        run.end_time = timezone.now()
        run.save()
    except Exception:
        pass
        
    return Response({"message": "Abort signal deployed successfully."})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_training_api(request):
    data = request.data
    dataset_id = data.get('dataset_id')
    run_name = data.get('run_name', f"PCB_Train_{random.randint(1000, 9999)}")
    model_arch = data.get('model_arch', 'yolov8n.pt') 
    epochs = int(data.get('epochs', 50))
    batch_size = int(data.get('batch_size', 16))
    img_size = int(data.get('img_size', 640))
    learning_rate = float(data.get('learning_rate', 0.01))
    patience = int(data.get('patience', 50))
    weight_decay = float(data.get('weight_decay', 0.0005)) 
    mosaic = float(data.get('mosaic', 1.0))
    mixup = float(data.get('mixup', 0.0))
    warmup_epochs = float(data.get('warmup_epochs', 3.0))
    degrees = float(data.get('degrees', 0.0))
    
    # 1. Define device and optimizer here
    device = '0' if torch.cuda.is_available() else 'cpu'
    optimizer = 'AdamW'
    
    try:
        dataset = DatasetVersion.objects.get(version_id=dataset_id)
        
        # 2. Save to DB
        run = TrainingRun.objects.create(
            dataset=dataset, 
            run_name=run_name,
            started_by=request.user, 
            model_architecture=model_arch,
            epochs=epochs, 
            batch_size=batch_size,
            img_size=img_size,
            learning_rate=learning_rate,
            patience=patience,
            weight_decay=weight_decay,
            device=device,
            optimizer_strategy=optimizer,
            mosaic=mosaic,
            mixup=mixup,
            warmup_epochs=warmup_epochs,
            degrees=degrees
        )

        # 3. Initialize the thread with matching arguments
        thread = threading.Thread(
            target=run_yolo_training_thread, 
            args=(run.run_id, dataset.yaml_file_path, model_arch, run_name, epochs, batch_size, img_size, learning_rate, patience, weight_decay, device, optimizer, mosaic, mixup, warmup_epochs, degrees)
        )
        thread.start()

        return Response({"message": "Training pipeline initialized.", "run_id": run.run_id}, status=200)
    
    except DatasetVersion.DoesNotExist:
        return Response({"error": "Dataset not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_training_runs_api(request):
    """Fetches all training runs for the Training Records page."""
    runs = TrainingRun.objects.all().order_by('-start_time')
    data = []
    for run in runs:
        data.append({
            "id": run.run_id,
            "run_name": run.run_name,
            "dataset_name": run.dataset.version_name if run.dataset else "Unknown",
            "model_architecture": run.model_architecture,
            "epochs": run.epochs,
            "batch_size": run.batch_size,
            "status": run.status,
            "start_time": localtime(run.start_time).strftime('%b %d, %Y %I:%M %p') if run.start_time else "-",
            "end_time": localtime(run.end_time).strftime('%b %d, %Y %I:%M %p') if run.end_time else "-",
            
            "final_map_score": round(run.final_map_score, 4) if run.final_map_score is not None else None,
            
            "weights_path": run.weights_path,
            "started_by": run.started_by.username if run.started_by else "System"
        })
    return Response(data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_weights_api(request, pk):
    """Forces the browser to download the best.pt weights file."""
    run = get_object_or_404(TrainingRun, run_id=pk)
    if run.weights_path and os.path.exists(run.weights_path):
        response = FileResponse(open(run.weights_path, 'rb'), as_attachment=True, filename=f"{run.run_name}_best.pt")
        return response
    return Response({"error": "Weights file not found on server. It may have been deleted or training failed."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_training_run_api(request, pk):
    """Deletes the training record and optionally the physical files."""
    run = get_object_or_404(TrainingRun, run_id=pk)
    
    # Optional: Delete the physical training folder from the hard drive
    if run.weights_path and os.path.exists(run.weights_path):
        try:
            # We delete the entire run folder (e.g., runs/detect/PCB_Train_123)
            run_folder = os.path.dirname(os.path.dirname(run.weights_path)) 
            shutil.rmtree(run_folder)
        except Exception:
            pass # Ignore if file is locked
            
    run.delete()
    return Response({"message": "Training record deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_training_results_csv_api(request, pk):
    """Reads the YOLO results.csv file and returns it as JSON for charting."""
    run = get_object_or_404(TrainingRun, run_id=pk)
    
    if not run.weights_path:
        return Response({"error": "No weights path found to locate results."}, status=404)
        
    # weights_path is like .../runs/detect/PCB_Train_123/weights/best.pt
    # results.csv is located at .../runs/detect/PCB_Train_123/results.csv
    run_folder = os.path.dirname(os.path.dirname(run.weights_path))
    csv_path = os.path.join(run_folder, 'results.csv')
    
    if not os.path.exists(csv_path):
        return Response({"error": "results.csv not found. Training may have failed or was aborted."}, status=404)
        
    data = []
    try:
        with open(csv_path, mode='r') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # YOLOv8 CSV headers have lots of trailing/leading spaces. We strip them.
                clean_row = {k.strip(): v.strip() for k, v in row.items()}
                data.append(clean_row)
        return Response(data, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_device_api(request):
    # Send a user-friendly label instead of the internal code
    device_label = 'GPU' if torch.cuda.is_available() else 'CPU'
    return Response({"device": device_label})

# --- BATCH UPLOAD SUMMARY ENDPOINT ---
class SaveBatchSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            batch = BatchJobRecord.objects.create(
                operator=request.user,
                folder_name=request.data.get('folder_name', 'Unknown Folder'),
                total_images=request.data.get('total_images', 0),
                total_defects_found=request.data.get('total_defects', 0),
                clean_boards=request.data.get('clean_boards', 0),
                defective_boards=request.data.get('defective_boards', 0),
                defect_breakdown=request.data.get('defect_breakdown', {})
            )
            return Response({"message": "Batch summary logged successfully", "batch_id": batch.batch_id}, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_datasets_api(request):
    """Fetches all compiled datasets for the Dataset Records page."""
    datasets = DatasetVersion.objects.all().order_by('-created_at')
    data = []
    for ds in datasets:
        data.append({
            "id": ds.version_id,
            "version_name": ds.version_name,
            "created_at": localtime(ds.created_at).strftime('%b %d, %Y %I:%M %p'),
            "total_images": ds.total_images,
            "split": f"{ds.train_split}% / {ds.val_split}%",
            "yaml_file_path": ds.yaml_file_path,
            "created_by": ds.created_by.username if ds.created_by else "System"
        })
    return Response(data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_dataset_yaml_api(request, pk):
    """Reads the YAML file from the server and sends the text to the frontend."""
    ds = get_object_or_404(DatasetVersion, version_id=pk)
    if ds.yaml_file_path and os.path.exists(ds.yaml_file_path):
        with open(ds.yaml_file_path, 'r') as f:
            content = f.read()
        return Response({"yaml_content": content}, status=status.HTTP_200_OK)
    return Response({"error": "Configuration file missing from server."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def download_dataset_yaml_api(request, pk):
    """Forces the browser to download the YAML file."""
    ds = get_object_or_404(DatasetVersion, version_id=pk)
    if ds.yaml_file_path and os.path.exists(ds.yaml_file_path):
        response = FileResponse(open(ds.yaml_file_path, 'rb'), as_attachment=True, filename=f"{ds.version_name}.yaml")
        return response
    return Response({"error": "File not found on server."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_dataset_api(request, pk):
    """Deletes the dataset record from the database."""
    ds = get_object_or_404(DatasetVersion, version_id=pk)
    
    # Optional: Delete the actual file from the hard drive too
    if ds.yaml_file_path and os.path.exists(ds.yaml_file_path):
        try:
            os.remove(ds.yaml_file_path)
        except Exception as e:
            pass # Ignore if file is locked
            
    ds.delete()
    return Response({"message": "Dataset deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

def run_yolo_validation_thread(val_id, yaml_path, weights_path, run_name):
    connection.close()
    try:
        val_run = ValidationRun.objects.get(val_id=val_id)
        val_run.status = "Validating"
        val_run.save()

        model = YOLO(weights_path)
        project_dir = os.path.join(settings.BASE_DIR, 'runs', 'detect')

        metrics = model.val(
            data=yaml_path,
            project=project_dir,
            name=run_name
        )

        val_run.end_time = timezone.now()

        try:
            # 1. Extract Core Metrics
            val_run.precision = float(metrics.box.mp)
            val_run.recall = float(metrics.box.mr)
            val_run.map50 = float(metrics.box.map50)
            val_run.map50_95 = float(metrics.box.map)
            
            # 2. Extract Matrix Metrics (TP, FP, FN)
            try:
                cm = metrics.confusion_matrix.matrix
                val_run.tp = int(cm.diagonal().sum())
                val_run.fp = int((cm.sum(axis=0) - cm.diagonal()).sum())
                val_run.fn = int((cm.sum(axis=1) - cm.diagonal()).sum())
                val_run.tn = 0 # TN is typically not calculated in standard YOLO box detection
            except Exception as cm_err:
                print(f"Matrix Extraction Warning: {cm_err}")

            # 3. Status Logic
            if val_run.map50_95 is not None or val_run.map50 is not None:
                val_run.status = "Success"
            else:
                val_run.status = "Success"

        except Exception as extract_err:
            print(f"Metrics Extraction Error: {extract_err}")
            # Force success if mAP was recorded despite other extraction errors
            if val_run.map50_95 is not None:
                val_run.status = "Success"
            else:
                val_run.status = "Failed"

        val_run.save()

    except Exception as e:
        print(f"Validation Exception: {e}")
        traceback.print_exc()
        val_run = ValidationRun.objects.get(val_id=val_id)
        if val_run.map50_95 is not None:
            val_run.status = "Success"
        else:
            val_run.status = "Failed"
        val_run.end_time = timezone.now()
        val_run.save()
    finally:
        connection.close()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_validation_api(request):
    data = request.data
    dataset_id = data.get('dataset_id')
    training_run_id = data.get('training_run_id')
    run_name = data.get('run_name', f"Val_Run_{random.randint(1000, 9999)}")

    try:
        dataset = DatasetVersion.objects.get(version_id=dataset_id)
        training_run = TrainingRun.objects.get(run_id=training_run_id)

        if not training_run.weights_path or not os.path.exists(training_run.weights_path):
            return Response({"error": "Selected model weights (best.pt) are missing or deleted."}, status=404)

        val_run = ValidationRun.objects.create(
            run_name=run_name,
            dataset=dataset,
            training_run=training_run,
            executed_by=request.user
        )

        thread = threading.Thread(
            target=run_yolo_validation_thread, 
            args=(val_run.val_id, dataset.yaml_file_path, training_run.weights_path, run_name)
        )
        thread.start()

        return Response({"message": "Validation pipeline initialized.", "val_id": val_run.val_id}, status=200)

    except (DatasetVersion.DoesNotExist, TrainingRun.DoesNotExist):
        return Response({"error": "Dataset or Model not found"}, status=404)
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_validation_details_api(request, pk):
    run = get_object_or_404(ValidationRun, val_id=pk)
    
    data = {
        "id": run.val_id,
        "run_name": run.run_name,
        "status": run.status,
        "metrics": {
            "mAP50_95": round(run.map50_95, 4) if run.map50_95 is not None else 0,
            "mAP50": round(run.map50, 4) if run.map50 is not None else 0,
            "precision": round(run.precision, 4) if run.precision is not None else 0,
            "recall": round(run.recall, 4) if run.recall is not None else 0,
        },
        "matrix": {
            "tp": run.tp if run.tp is not None else 0,
            "fp": run.fp if run.fp is not None else 0,
            "fn": run.fn if run.fn is not None else 0,
            "tn": run.tn if run.tn is not None else 0,
        }
    }
    
    return Response(data, status=status.HTTP_200_OK)

# Keeping these for your future Validation Records page
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_validation_runs_api(request):
    runs = ValidationRun.objects.all().order_by('-start_time')
    data = []
    for run in runs:
        data.append({
            "id": run.val_id,
            "run_name": run.run_name,
            "dataset_name": run.dataset.version_name if run.dataset else "Unknown",
            "model_name": run.training_run.run_name if run.training_run else "Unknown",
            "status": run.status,
            "start_time": localtime(run.start_time).strftime('%b %d, %Y %I:%M %p') if run.start_time else "-",
            "map50_95": round(run.map50_95, 4) if run.map50_95 is not None else None,
            "executed_by": run.executed_by.username if run.executed_by else "System"
        })
    return Response(data, status=200)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_validation_run_api(request, pk):
    run = get_object_or_404(ValidationRun, val_id=pk)
    project_dir = os.path.join(settings.BASE_DIR, 'runs', 'detect')
    val_folder = os.path.join(project_dir, run.run_name)
    
    if os.path.exists(val_folder):
        try:
            shutil.rmtree(val_folder)
        except Exception as e:
            pass 
            
    run.delete()
    return Response({"message": "Deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_deployment_status_api(request):
    history = DeployedModel.objects.all().order_by('-deployed_at')
    active_deployment = history.filter(is_active=True).first()
    
    history_data = []
    for d in history:
        history_data.append({
            "id": d.deployment_id,
            "run_name": d.training_run.run_name,
            "model_architecture": d.training_run.model_architecture,
            "dataset_name": d.training_run.dataset.version_name if d.training_run.dataset else "Unknown",
            "map50_95": round(d.training_run.final_map_score, 4) if d.training_run.final_map_score else 0,
            "deployed_at": localtime(d.deployed_at).strftime('%b %d, %Y %I:%M %p'),
            "deployed_by": d.deployed_by.username if d.deployed_by else "System",
            "is_active": d.is_active
        })
    
    active_data = None
    if active_deployment:
        active_data = {
            "run_name": active_deployment.training_run.run_name,
            "weights_path": active_deployment.training_run.weights_path,
            "model_architecture": active_deployment.training_run.model_architecture,
            "map50_95": round(active_deployment.training_run.final_map_score, 4) if active_deployment.training_run.final_map_score else 0,
            "deployed_at": localtime(active_deployment.deployed_at).strftime('%b %d, %Y %I:%M %p'),
            "deployed_by": active_deployment.deployed_by.username if active_deployment.deployed_by else "System"
        }

    # Get available models to deploy (Only successful training runs)
    available_runs = TrainingRun.objects.filter(status__in=['Success', 'Completed']).order_by('-start_time')
    available_data = [
        {
            "id": r.run_id, 
            "run_name": r.run_name, 
            "map50_95": round(r.final_map_score, 4) if r.final_map_score else 0, 
            "model_architecture": r.model_architecture
        } for r in available_runs
    ]

    return Response({
        "active_model": active_data,
        "history": history_data,
        "available_models": available_data
    }, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def deploy_model_api(request):
    run_id = request.data.get('training_run_id')
    if not run_id:
        return Response({"error": "Training run ID required"}, status=400)
    
    try:
        run = TrainingRun.objects.get(run_id=run_id)
        if not run.weights_path or not os.path.exists(run.weights_path):
            return Response({"error": "Weights file (best.pt) not found for this run. Cannot deploy."}, status=404)
        
        # Automatically deactivates the old model via models.py save() logic
        DeployedModel.objects.create(
            training_run=run,
            deployed_by=request.user,
            is_active=True
        )
        return Response({"message": f"Successfully deployed {run.run_name} to production."}, status=200)
        
    except TrainingRun.DoesNotExist:
        return Response({"error": "Training run not found."}, status=404)
    
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def revert_to_default_model_api(request):
    try:
        # Find any active deployments and deactivate them
        DeployedModel.objects.filter(is_active=True).update(is_active=False)
        return Response({"message": "Successfully reverted to the default system model (best.pt)."}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    
@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_deployment_record_api(request, pk):
    try:
        record = get_object_or_404(DeployedModel, deployment_id=pk)
        
        # If we are deleting the currently active model, we should probably
        # warn the user or just let it happen (which means it falls back to default).
        # We will just delete it.
        record.delete()
        
        return Response({"message": "Deployment record deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_deployment_records_api(request):
    # This queries the table that holds your deployment history
    history = DeployedModel.objects.all().order_by('-deployed_at')
    
    history_data = []
    for d in history:
        history_data.append({
            "id": d.deployment_id,
            "run_name": d.training_run.run_name,
            "model_architecture": d.training_run.model_architecture,
            "map50_95": round(d.training_run.final_map_score, 4) if d.training_run.final_map_score else 0,
            "deployed_at": localtime(d.deployed_at).strftime('%b %d, %Y %I:%M %p'),
            "deployed_by": d.deployed_by.username if d.deployed_by else "System",
            "is_active": d.is_active
        })
    
    return Response(history_data, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_analytics_api(request):
    """Fetches KPI metrics, defect trends, and severity distribution for the dashboard."""
    time_filter = request.GET.get('filter', '30days') # Options: 7days, 30days, 1year
    
    now = timezone.now()
    if time_filter == '7days':
        start_date = now - timedelta(days=7)
    elif time_filter == '1year':
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
        
    try:
        # 1. Filter data based on the selected timeframe
        defects_qs = DefectResult.objects.filter(created_at__gte=start_date)
        inspections_qs = ImageRecord.objects.filter(upload_timestamp__gte=start_date)

        # 2. Calculate Top KPIs
        total_inspections = inspections_qs.count()
        total_defects = defects_qs.count()
        
        # Calculate Average Confidence (handling empty database scenarios safely)
        avg_conf_dict = defects_qs.aggregate(Avg('confidence_score'))
        avg_conf_raw = avg_conf_dict['confidence_score__avg']
        avg_confidence = round(avg_conf_raw * 100, 1) if avg_conf_raw else 0.0

        # 3. Calculate Defect Trends (Grouped by Date)
        trends_query = defects_qs.annotate(date=TruncDate('created_at')) \
                                 .values('date') \
                                 .annotate(defects=Count('defect_id')) \
                                 .order_by('date')
                                 
        trends_data = [{"date": item['date'].strftime('%Y-%m-%d'), "defects": item['defects']} for item in trends_query]

        # 4. Calculate Anomaly Distribution (Grouped by Defect Label)
        dist_query = defects_qs.values('classification_label') \
                               .annotate(value=Count('defect_id')) \
                               .order_by('-value')
                               
        dist_data = [{"name": item['classification_label'].replace('_', ' ').title(), "value": item['value']} for item in dist_query]

        return Response({
            "kpis": {
                "total_inspections": total_inspections,
                "total_defects": total_defects,
                "avg_confidence": avg_confidence
            },
            "trends": trends_data,
            "distribution": dist_data
        }, status=status.HTTP_200_OK)

    except Exception as e:
        print(f"Analytics Error: {e}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_audit_logs_api(request):
    """Aggregates system events from ALL tables into a unified audit trail."""
    
    # 1. Fetch Dataset Uploads
    datasets = DatasetVersion.objects.all().select_related('created_by')
    ds_events = [{
        "id": f"ds_{ds.version_id}",
        "timestamp": ds.created_at,
        "user": ds.created_by.username if ds.created_by else "System",
        "role": ds.created_by.role if ds.created_by else "system",
        "event_type": "DATA_MUTATION",
        "description": f"Provisioned new dataset architecture: '{ds.version_name}' ({ds.total_images} tensor images).",
        "severity": "info"
    } for ds in datasets]

    # 2. Fetch Model Training Runs
    trainings = TrainingRun.objects.all().select_related('started_by')
    tr_events = [{
        "id": f"tr_{tr.run_id}",
        "timestamp": tr.start_time,
        "user": tr.started_by.username if tr.started_by else "System",
        "role": tr.started_by.role if tr.started_by else "system",
        "event_type": "COMPUTE_EXECUTION",
        "description": f"Initialized YOLOv8 training pipeline: '{tr.run_name}' via {tr.device.upper()}.",
        "severity": "warning"
    } for tr in trainings]

    # 3. Fetch Batch Inspections
    batches = BatchJobRecord.objects.all().select_related('operator')
    batch_events = [{
        "id": f"batch_{b.batch_id}",
        "timestamp": b.timestamp,
        "user": b.operator.username if b.operator else "System",
        "role": b.operator.role if b.operator else "system",
        "event_type": "OPTICAL_INSPECTION",
        "description": f"Executed batch inference on '/{b.folder_name}'. Detected {b.total_defects_found} physical anomalies.",
        "severity": "critical" if b.total_defects_found > 0 else "success"
    } for b in batches]

    # 4. Fetch Validation Runs
    validations = ValidationRun.objects.all().select_related('executed_by', 'dataset')
    val_events = [{
        "id": f"val_{v.val_id}",
        "timestamp": v.start_time,
        "user": v.executed_by.username if v.executed_by else "System",
        "role": v.executed_by.role if v.executed_by else "system",
        "event_type": "COMPUTE_EXECUTION",
        "description": f"Executed model validation: '{v.run_name}' on dataset '{v.dataset.version_name if v.dataset else 'Unknown'}'.",
        "severity": "info"
    } for v in validations]

    # 5. Fetch Model Deployments
    deployments = DeployedModel.objects.all().select_related('deployed_by', 'training_run')
    dep_events = [{
        "id": f"dep_{d.deployment_id}",
        "timestamp": d.deployed_at,
        "user": d.deployed_by.username if d.deployed_by else "System",
        "role": d.deployed_by.role if d.deployed_by else "system",
        "event_type": "SYSTEM_CHANGE",
        "description": f"{'Deployed' if d.is_active else 'Archived'} model for active production: '{d.training_run.run_name if d.training_run else 'Unknown'}'.",
        "severity": "critical" if d.is_active else "warning"
    } for d in deployments]

    # 6. Fetch User Provisioning
    users = CustomUser.objects.filter(created_by__isnull=False).select_related('created_by')
    user_events = [{
        "id": f"usr_{u.id}",
        "timestamp": u.date_joined,
        "user": u.created_by.username if u.created_by else "System",
        "role": u.created_by.role if u.created_by else "system",
        "event_type": "ACCESS_CONTROL",
        "description": f"Provisioned new {u.get_role_display()} account: '{u.username}' (ID: {u.employee_id}).",
        "severity": "warning"
    } for u in users]

    # 7. Fetch Annotation Class Creations
    annotations = AnnotationClass.objects.all().select_related('created_by')
    ann_events = [{
        "id": f"ann_{a.class_id}",
        "timestamp": a.created_at,
        "user": a.created_by.username if a.created_by else "System",
        "role": a.created_by.role if a.created_by else "system",
        "event_type": "DATA_MUTATION",
        "description": f"Registered new defect classification profile: '{a.class_name}'.",
        "severity": "info"
    } for a in annotations]

    # 8. Fetch Manual Human-in-the-loop Corrections
    corrections = ManualCorrection.objects.all().select_related('corrected_by')
    corr_events = [{
        "id": f"cor_{c.correction_id}",
        "timestamp": c.created_at,
        "user": c.corrected_by.username if c.corrected_by else "System",
        "role": c.corrected_by.role if c.corrected_by else "system",
        "event_type": "DATA_MUTATION",
        "description": f"Applied manual bounding box correction for label '{c.corrected_label}'.",
        "severity": "success"
    } for c in corrections]

    # 9. Fetch Live Interface Scans (Defect Results)
    defects = DefectResult.objects.all().select_related('detected_by')
    defect_events = [{
        "id": f"def_{d.defect_id}",
        "timestamp": d.created_at,
        "user": d.detected_by.username if getattr(d, 'detected_by', None) else "System",
        "role": d.detected_by.role if getattr(d, 'detected_by', None) else "system",
        "event_type": "OPTICAL_INSPECTION",
        "description": f"Live interface detected anomaly: '{d.classification_label}' ({float(d.confidence_score)*100:.1f}% confidence).",
        "severity": "critical"
    } for d in defects]

    # 10. Fetch Workspace Preferences (Annotation Settings UI)
    preferences = WorkspacePreference.objects.all().select_related('user')
    pref_events = [{
        "id": f"pref_{p.id}",
        "timestamp": p.updated_at,
        "user": p.user.username if getattr(p, 'user', None) else "System",
        "role": p.user.role if getattr(p, 'user', None) else "system",
        "event_type": "SYSTEM_CHANGE",
        "description": f"Updated annotation workspace UI settings (Export: {p.export_format.upper()}, Opacity: {p.box_opacity}%).",
        "severity": "info"
    } for p in preferences]
    
    # Combine ALL events and sort by timestamp (newest first)
    all_events = ds_events + tr_events + batch_events + val_events + dep_events + user_events + ann_events + corr_events + defect_events + pref_events
    all_events.sort(key=lambda x: x['timestamp'], reverse=True)
    
    # Format timestamps for React
    for ev in all_events:
        ev['timestamp'] = localtime(ev['timestamp']).strftime('%b %d, %Y %I:%M:%S %p')

    # Return the 500 most recent events to prevent payload bloat
    return Response(all_events[:500], status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_inspection_records_api(request):
    """Aggregates records and provides full bounding box details for image viewing."""
    try:
        # Check the user's role securely on the backend
        user_role = getattr(request.user, 'role', 'user')

        # SECURITY: If QA Engineer, ONLY fetch their own records. Otherwise, fetch all.
        if user_role in ['admin', 'superadmin']:
            defects_query = DefectResult.objects.all()
            batches_query = BatchJobRecord.objects.all()
            corrections_query = ManualCorrection.objects.all()
        else:
            defects_query = DefectResult.objects.filter(detected_by=request.user)
            batches_query = BatchJobRecord.objects.filter(operator=request.user)
            corrections_query = ManualCorrection.objects.filter(corrected_by=request.user)

        # 1. Fetch & Group Live Interface Records
        defects = defects_query.select_related('detected_by', 'image').order_by('-created_at')[:500]
        live_grouped = defaultdict(list)
        for d in defects:
            if d.image:
                live_grouped[d.image.image_id].append(d)

        live_records = []
        for img_id, defect_list in live_grouped.items():
            first = defect_list[0]
            
            # Create the breakdown (e.g., "Short (1), Mouse Bite (4)") and collect box coordinates
            breakdown = defaultdict(int)
            details = []
            for d in defect_list:
                label = d.classification_label.replace('_', ' ').title()
                breakdown[label] += 1
                details.append({
                    "label": label,
                    "confidence": round(d.confidence_score * 100, 1),
                    "box": [d.x_min, d.y_min, d.x_max, d.y_max]
                })
            
            breakdown_str = ", ".join([f"{k} ({v})" for k, v in breakdown.items()])

            # Get image URL safely
            img_url = request.build_absolute_uri(first.image.file_path.url) if first.image and first.image.file_path else None

            live_records.append({
                "id": f"live_img_{img_id}",
                "raw_id": img_id,
                "record_type": "Live Inspection",
                "timestamp": first.created_at,
                "user": first.detected_by.username if first.detected_by else "System",
                "role": getattr(first.detected_by, 'role', "system"),
                "target": f"Image #{img_id}",
                "result_summary": breakdown_str, # The new detailed summary
                "status": "Detected",
                "image_url": img_url,
                "details": details # The raw boxes for React to draw
            })

        # 2. Fetch Batch Upload Records (No images to render here)
        batches = batches_query.select_related('operator').order_by('-timestamp')[:200]
        batch_records = []
        for b in batches:
            
            # --- USE THE BUILT-IN JSON FIELD ---
            details = []
            
            # Check if the JSON field has data (e.g., {"short": 5, "mouse_bite": 12})
            if b.defect_breakdown:
                for label, count in b.defect_breakdown.items():
                    details.append({
                        "label": label.replace('_', ' ').title(),
                        "count": count
                    })
                    
            # Sort highest count first so the chart looks organized
            details.sort(key=lambda x: x['count'], reverse=True)

            batch_records.append({
                "id": f"batch_{b.batch_id}",
                "raw_id": b.batch_id,
                "record_type": "Batch Processing",
                "timestamp": b.timestamp,
                "user": b.operator.username if b.operator else "System",
                "role": getattr(b.operator, 'role', "system"),
                "target": f"Dir: /{b.folder_name}",
                "result_summary": f"{b.total_images} Imgs | {b.total_defects_found} Anomalies",
                "status": "Completed",
                "image_url": None,
                "details": details # Send the instantly parsed chart data to React
            })

        # 3. Fetch & Group Labelling Records (Manual Correction)
        corrections = corrections_query.select_related('corrected_by', 'image').order_by('-created_at')[:500]
        label_grouped = defaultdict(list)
        for c in corrections:
            if c.image:
                label_grouped[c.image.image_id].append(c)

        label_records = []
        for img_id, correction_list in label_grouped.items():
            first = correction_list[0]
            is_compiled = all(c.is_compiled_for_training for c in correction_list)
            
            # Create breakdown and collect coordinates for manual labels
            breakdown = defaultdict(int)
            details = []
            for c in correction_list:
                label = c.corrected_label.replace('_', ' ').title()
                breakdown[label] += 1
                details.append({
                    "label": label,
                    "box": [c.x_min, c.y_min, c.x_max, c.y_max]
                })
                
            breakdown_str = ", ".join([f"{k} ({v})" for k, v in breakdown.items()])
            img_url = request.build_absolute_uri(first.image.file_path.url) if first.image and first.image.file_path else None

            label_records.append({
                "id": f"label_img_{img_id}",
                "raw_id": img_id,
                "record_type": "Manual Correction",
                "timestamp": first.created_at,
                "user": first.corrected_by.username if first.corrected_by else "System",
                "role": getattr(first.corrected_by, 'role', "system"),
                "target": f"Image #{img_id}",
                "result_summary": breakdown_str,
                "status": "Compiled" if is_compiled else "Pending",
                "image_url": img_url,
                "details": details
            })

        # Combine all records and sort by real timestamp object (newest first)
        all_records = live_records + batch_records + label_records
        all_records.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Format timestamps safely to string after sorting
        for r in all_records:
            try:
                r['timestamp'] = localtime(r['timestamp']).strftime('%b %d, %Y %I:%M %p')
            except Exception:
                r['timestamp'] = r['timestamp'].strftime('%b %d, %Y %I:%M %p')

        return Response(all_records[:500], status=status.HTTP_200_OK)

    except Exception as e:
        print(f"INSPECTION RECORDS ERROR: {str(e)}")
        traceback.print_exc()
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_inspection_record_api(request, record_type, pk):
    """Deletes an inspection record group based on its type."""
    try:
        if record_type == "live":
            # pk is now the image_id. Delete ALL live defects for this image.
            DefectResult.objects.filter(image_id=pk).delete()
        elif record_type == "batch":
            # pk is still the batch_id.
            BatchJobRecord.objects.filter(batch_id=pk).delete()
        elif record_type == "label":
            # pk is now the image_id. Delete ALL manual corrections for this image.
            ManualCorrection.objects.filter(image_id=pk).delete()
            
        return Response({"message": "Record deleted successfully."}, status=status.HTTP_204_NO_CONTENT)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)