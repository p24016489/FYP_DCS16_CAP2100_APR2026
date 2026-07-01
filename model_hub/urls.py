from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AIModelViewSet, ImageRecordViewSet, ActivityLogViewSet, 
    RunInspectionView, system_health_api, provision_user_api, 
    get_users_api, delete_user_api, toggle_user_status_api, 
    logout_api, login_api, update_profile_api, AnnotationSettingsAPIView,
    SaveAnnotationsAPIView, compile_dataset_api, start_training_api,
    get_training_data_api, get_training_runs_api, 
    SaveBatchSummaryView , upload_local_dataset_api, get_datasets_api, get_device_api,
    delete_dataset_api, download_dataset_yaml_api, view_dataset_yaml_api,
    download_weights_api, delete_training_run_api, get_training_results_csv_api,
    abort_training_api, start_validation_api, get_validation_runs_api,
    delete_validation_run_api, get_validation_details_api,
    get_deployment_status_api, deploy_model_api, revert_to_default_model_api,
    delete_deployment_record_api, get_deployment_records_api, global_analytics_api,
    get_audit_logs_api, get_inspection_records_api, delete_inspection_record_api,
    verify_login_otp_api, request_password_reset_api, reset_password_api,
    verify_reset_otp_api, get_current_profile_api, get_training_progress_api
)

router = DefaultRouter()
router.register(r'models', AIModelViewSet)
router.register(r'images', ImageRecordViewSet)
router.register(r'logs', ActivityLogViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('inspect/', RunInspectionView.as_view(), name='run-inspection'),
    path('system-health/', system_health_api, name='system-health'),
    path('provision/', provision_user_api, name='provision-user'),
    path('users/', get_users_api, name='get-users'),
    path('users/<int:user_id>/', delete_user_api, name='delete-user'),
    path('users/<int:user_id>/toggle-status/', toggle_user_status_api, name='toggle-user-status'),
    path('logout/', logout_api, name='logout'),
    path('login/', login_api, name='login'),
    path('update-profile/', update_profile_api, name='update_profile'),
    path('annotation-settings/', AnnotationSettingsAPIView.as_view(), name='annotation_settings'),
    path('save-annotations/', SaveAnnotationsAPIView.as_view(), name='save_annotations'),
    
    # Dataset & Training Endpoints
    path('training-data/', get_training_data_api, name='training_data'),
    path('compile-dataset/', compile_dataset_api, name='compile_dataset'),
    path('upload-local-dataset/', upload_local_dataset_api, name='upload_local_dataset'),
    path('start-training/', start_training_api, name='start_training'),
    path('training-runs/', get_training_runs_api, name='training_runs'),

    path('save-batch-summary/', SaveBatchSummaryView.as_view(), name='save_batch_summary'),

    path('datasets-list/', get_datasets_api, name='get-datasets'),
    path('get-device/', get_device_api, name='get_device'),
    path('datasets/<int:pk>/view/', view_dataset_yaml_api),
    path('datasets/<int:pk>/download/', download_dataset_yaml_api),
    path('datasets/<int:pk>/delete/', delete_dataset_api),

    path('training-runs/<int:pk>/download/', download_weights_api),
    path('training-runs/<int:pk>/delete/', delete_training_run_api),
    path('training-runs/<int:pk>/results/', get_training_results_csv_api),
    path('abort-training/', abort_training_api, name='abort_training'),
    path('start-validation/', start_validation_api, name='start_validation'),
    path('validation-runs/', get_validation_runs_api, name='validation_runs'),

    path('validation-runs/<int:pk>/delete/', delete_validation_run_api, name='delete_validation_run'),
    path('validation-runs/<int:pk>/details/', get_validation_details_api, name='validation_details'),
    path('deployment-status/', get_deployment_status_api, name='deployment_status'),
    path('deploy-model/', deploy_model_api, name='deploy_model'),
    path('revert-model/', revert_to_default_model_api, name='revert_model'),
    path('deployment-records/<int:pk>/delete/', delete_deployment_record_api, name='delete_deployment_record'),
    path('deployment-records/', get_deployment_records_api, name='deployment_records'),
    path('global-analytics/', global_analytics_api, name='global_analytics'),
    path('audit-logs/', get_audit_logs_api, name='audit_logs'),
    path('inspection-records/', get_inspection_records_api, name='inspection_records'),
    path('inspection-records/<str:record_type>/<int:pk>/delete/', delete_inspection_record_api, name='delete_inspection_record'),
    path('verify-login-otp/', verify_login_otp_api, name='verify_login_otp'),
    path('request-password-reset/', request_password_reset_api, name='request_password_reset'),
    path('reset-password/', reset_password_api, name='reset_password'),
    path('verify-reset-otp/', verify_reset_otp_api, name='verify_reset_otp'),
    path('current-profile/', get_current_profile_api, name='current_profile'),
    path('training-progress/<str:pk>/', get_training_progress_api, name='training-progress'),
]