from django.contrib import admin
from .models import CustomUser

# This tells Django to show our Custom User table in the Admin Panel
admin.site.register(CustomUser)