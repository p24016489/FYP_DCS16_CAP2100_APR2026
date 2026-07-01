import React, { useState, useEffect, useRef } from 'react';
import AnnotationSettings from './AnnotationSettings';
import Labelling, { sharedWorkspaceCache } from './Labelling';
import Datasets from './Datasets';
import TrainingPipeline from './TrainingPipeline';
import BatchUpload, { batchWorkspaceCache } from './BatchUpload';
import DatasetRecords from './DatasetRecords';
import TrainingRecords from './TrainingRecords';
import Validation from './Validation';
import ValidationRecords from './ValidationRecords';
import ModelDeployment from './ModelDeployment';
import ModelDeploymentRecords from './ModelDeploymentRecords';
import GlobalAnalytics from './GlobalAnalytics';
import AuditLogs from './AuditLogs';
import InspectionRecords from './InspectionRecords';
import { API_BASE_URL } from '../config';
import { 
  LayoutDashboard, ShieldCheck, Settings, Search, LogOut, User, UploadCloud, 
  Cpu, Activity, Info, PanelLeftClose, Users, Database, Server, 
  UserPlus, HardDrive, ShieldAlert, PlusCircle, Thermometer, Clock,
  Network, Zap, Key, CheckCircle2, CircuitBoard, Mail, Eye, EyeOff, AlertCircle, Trash2,
  Ban, CheckCircle, Camera, Save, Lock, ZoomIn, ZoomOut, Maximize, Edit3, SlidersHorizontal,
  FolderOpen, RefreshCw, X
} from 'lucide-react';

const Dashboard = ({ onLogout, username = "System Admin", userRole = "superadmin" }) => {
  const [activeSystemId, setActiveSystemId] = useState(null);
  
  // --- 1. PERMISSIONS & NAVIGATION MAP ---
  const menuItemsMaster = [
    { icon: <LayoutDashboard size={20} />, label: "Dashboard", allowedRoles: ['superadmin', 'admin'] },
    { icon: <Users size={20} />, label: "User Management", allowedRoles: ['superadmin', 'admin'] },
    { icon: <Database size={20} />, label: "Model Hub", allowedRoles: ['superadmin', 'admin'] },
    { icon: <ShieldCheck size={20} />, label: "Inspection", allowedRoles: ['superadmin', 'admin', 'user'] },
    { icon: <FolderOpen size={20} />, label: "Records", allowedRoles: ['superadmin', 'admin', 'user'] },
    { icon: <ShieldAlert size={20} />, label: "Audit Logs", allowedRoles: ['superadmin'] }
  ];

  // Filter the menu items based on the user's role
  const menuItems = menuItemsMaster.filter(item => item.allowedRoles.includes(userRole));
  
  // Create a list of allowed views (plus 'Profile', which everyone gets)
  const allowedViews = [...menuItems.map(item => item.label), 'Profile'];

  const viewSubTabs = {
    'Dashboard': ['System Health', 'Global Analytics'],
    'User Management': ['Provision Account', 'User Directory'], 
    'Model Hub': ['Model Deployment', 'Datasets', 'Training Pipeline', 'Validation', 'Annotation Settings'],
    'Inspection': ['Live Interface', 'Batch Upload', 'Labelling'],
    'Records': userRole === 'user' 
        ? ['Inspection Records'] 
        : ['Model Deployment Records', 'Dataset Records', 'Training Records', 'Validation Records', 'Inspection Records'],
    'Audit Logs': ['Security Events'],
    'Profile': ['Account Settings']
  };

  // --- 2. STATE MANAGEMENT (Permission-Aware) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('pcb_sidebarOpen');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  // Intelligent View Router: Only allow the user to load a view they have permission for
  const [activeView, setActiveView] = useState(() => {
    const savedView = localStorage.getItem('pcb_activeView');
    // If they have a saved view AND they are allowed to see it, use it
    if (savedView && allowedViews.includes(savedView)) {
        return savedView;
    }
    // Otherwise, default to the VERY FIRST menu item they are allowed to see 
    // (e.g., Admins get Dashboard, QA Engineers get Inspection)
    return allowedViews[0]; 
  }); 

  // Intelligent SubTab Router
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const savedTab = localStorage.getItem('pcb_activeSubTab');
    if (savedTab && viewSubTabs[activeView]?.includes(savedTab)) {
        return savedTab;
    }
    return viewSubTabs[activeView][0];
  });

  const [displayUsername, setDisplayUsername] = useState(username);

  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredTab, setHoveredTab] = useState(null);

  // --- ANIMATED FORM STATE ---
  const [focusedInput, setFocusedInput] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const [provisionData, setProvisionData] = useState({
    username: '', email: '', password: '', role: 'user'
  });
  
  const [formErrors, setFormErrors] = useState({});
  const [provisionStatus, setProvisionStatus] = useState({ loading: false, type: null, message: '' });

  // YOLOv8 Inference State
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef(null);
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.25);


  

  // --- INTERACTIVE VIEWPORT LOGIC ---
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !preview) return;

    const handleNativeWheel = (e) => {
      e.preventDefault(); // Because passive is false, this now successfully stops the page from scrolling!
      
      const scaleAdjust = e.deltaY < 0 ? 1.15 : 0.85; 
      const newZoom = Math.max(0.05, Math.min(zoom * scaleAdjust, 10)); 
      
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
      const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };

    // Attach the listener with { passive: false } to force the browser to respect e.preventDefault()
    viewport.addEventListener('wheel', handleNativeWheel, { passive: false });
    
    return () => {
      viewport.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoom, pan, preview]); // Essential dependencies so the math uses the latest state

const handleMouseDown = (e) => {
  setIsDragging(true);
  setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
};

const handleMouseMove = (e) => {
  if (!isDragging) return;
  setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
};

const handleMouseUp = () => setIsDragging(false);

const resetViewport = () => {
  setZoom(1);
  setPan({ x: 0, y: 0 });
};

const handleEditLabels = () => {
  // 1. Guard clause: Ensure there is an image and results before jumping
  if (!image || !results) {
    alert("Please run a diagnostic scan on an image before attempting corrections.");
    return;
  }

  const proceedToLabelling = () => {
    // 1. Push Live Interface data directly into the Labelling cache
    sharedWorkspaceCache.imageSrc = preview;
    sharedWorkspaceCache.imageFile = image;
    
    // 2. Parse YOLO boxes into Canvas format
    if (results && results.defects) {
      sharedWorkspaceCache.boxes = results.defects.map(defect => {
        const [x_min, y_min, x_max, y_max] = defect.bbox;
        return {
          id: defect.id,
          x: x_min,
          y: y_min,
          width: x_max - x_min,
          height: y_max - y_min,
          class: defect.label 
        };
      });
    } else {
      sharedWorkspaceCache.boxes = [];
    }
    
    sharedWorkspaceCache.isUnsaved = false;

    // 3. Switch tabs to the Labelling interface
    setActiveView('Inspection');
    setActiveSubTab('Labelling');
  };

  // CHECK FOR UNSAVED WORK IN LABELLING PAGE
  if (sharedWorkspaceCache.isUnsaved) {
    setConfirmModal({
      isOpen: true,
      title: 'Unsaved Annotations Detected',
      message: 'You have unsaved annotations in the Labelling workspace. Proceeding will discard your current progress. Do you want to overwrite the workspace?',
      actionType: 'warning',
      confirmText: 'Discard & Proceed',
      isAlertOnly: false,
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        proceedToLabelling();
      }
    });
  } else {
    proceedToLabelling();
  }
};


  // --- USER DIRECTORY STATE & DATABASE LOGIC ---
  const [usersList, setUsersList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [hoveredFilter, setHoveredFilter] = useState(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // --- PAGINATION STATE ---
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'danger',
    confirmText: '',
    onConfirm: null,
    isAlertOnly: false
  });

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setIsDropdownOpen(false);
    }
  };

  if (isDropdownOpen) {
    document.addEventListener('mousedown', handleClickOutside);
  }
  
  return () => {
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [isDropdownOpen]);

  // Fetch users from database when the directory tab is opened
  useEffect(() => {
    if (activeView === 'User Management' && activeSubTab === 'User Directory') {
      fetchUsers();
    }
  }, [activeView, activeSubTab]);

  useEffect(() => {
  localStorage.setItem('pcb_sidebarOpen', JSON.stringify(isSidebarOpen));
}, [isSidebarOpen]);

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/users/`, {
        headers: {
          'Authorization': `Bearer ${token}` 
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsersList(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // --- ACCOUNT SETTINGS STATE ---
  const [profileData, setProfileData] = useState({
    username: username || '',
    email: '', 
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [profileStatus, setProfileStatus] = useState({ loading: false, type: null, message: '' });

  const [profileErrors, setProfileErrors] = useState({});
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [showProfileOtpModal, setShowProfileOtpModal] = useState(false);
  const [profileOtp, setProfileOtp] = useState('');
  const [maskedProfileEmail, setMaskedProfileEmail] = useState('');
  const [profileResendTimer, setProfileResendTimer] = useState(0);

  
  useEffect(() => {
    if (activeView === 'Profile' && activeSubTab === 'Account Settings') {
      const fetchProfile = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_BASE_URL}/api/current-profile/`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            const data = await response.json();
            setProfileData(prev => ({ ...prev, email: data.email || '' }));
          }
        } catch (err) { console.error("Failed to load profile details", err); }
      };
      fetchProfile();
    }
  }, [activeView, activeSubTab]);

  // Handle the Resend Cooldown Timer
  useEffect(() => {
    let interval;
    if (profileResendTimer > 0) interval = setInterval(() => setProfileResendTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [profileResendTimer]);


  // --- HANDLE PROFILE UPDATE ---
  const validateProfileForm = () => {
    const errors = {};
    if (!profileData.username.trim()) errors.username = "Username is required";
    if (profileData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(profileData.email)) errors.email = "Invalid email format";
    }
    if (profileData.newPassword) {
      const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
      if (!passRegex.test(profileData.newPassword)) errors.newPassword = "Password must meet all requirements.";
      if (!profileData.confirmPassword) errors.confirmPassword = "Confirm password is required.";
      else if (profileData.newPassword !== profileData.confirmPassword) errors.confirmPassword = "Passwords do not match.";
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileUpdate = async (e, isResend = false) => {
    if (e) e.preventDefault();
    if (!validateProfileForm()) return;
    
    // Don't show loading on the main form if we are just resending the OTP inside the modal
    if (!isResend) setProfileStatus({ loading: true, type: null, message: '' });

    try {
      const token = localStorage.getItem('token'); 
      const response = await fetch(`${API_BASE_URL}/api/update-profile/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          original_username: username, 
          new_username: profileData.username,
          email: profileData.email,
          current_password: profileData.currentPassword,
          new_password: profileData.newPassword
        })
      });
      
      const data = await response.json();

      if (response.ok) {
        if (data.require_otp) {
            // Backend requests OTP verification
            setMaskedProfileEmail(data.masked_email);
            setProfileStatus({ loading: false }); // Stop loading on main screen
            if (!isResend) setShowProfileOtpModal(true); // Open Modal
            setProfileResendTimer(60); // Start 60s cooldown
        } else {
            // Password wasn't changed, updated directly without OTP
            setProfileStatus({ loading: false, type: 'success', message: 'Profile updated successfully!' });
            setDisplayUsername(profileData.username);
            localStorage.setItem('username', profileData.username);
        }
      } else {
        // Capture errors from backend (e.g., incorrect current password)
        setProfileStatus({ loading: false, type: 'error', message: data.error || 'Failed to update profile.' });
      }
    } catch (error) {
      setProfileStatus({ loading: false, type: 'error', message: 'Network error. Is the Django server running?' });
    }
  };

  const handleVerifyProfileOtp = async (e) => {
    e.preventDefault();
    setProfileStatus({ loading: true, type: null, message: '' });

    try {
      const token = localStorage.getItem('token'); 
      const response = await fetch(`${API_BASE_URL}/api/update-profile/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          original_username: username, 
          new_username: profileData.username,
          email: profileData.email,
          current_password: profileData.currentPassword,
          new_password: profileData.newPassword,
          otp: profileOtp // Submit the OTP this time!
        })
      });
      
      const data = await response.json();

      if (response.ok) {
        setShowProfileOtpModal(false);
        setProfileOtp('');
        setProfileStatus({ loading: false, type: 'success', message: 'Identity verified. Password & Profile updated!' });
        setProfileData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
        setDisplayUsername(profileData.username);
        localStorage.setItem('username', profileData.username);
      } else {
        setProfileStatus({ loading: false, type: 'error', message: data.error || 'Invalid OTP code.' });
      }
    } catch (error) {
      setProfileStatus({ loading: false, type: 'error', message: 'Network error verifying OTP.' });
    }
  };


  const handleDeleteUser = (userId, usernameToDelete) => {
  // --- SECURITY CHECK (Keep this as is) ---
  if (usernameToDelete === username) {
    setConfirmModal({
      isOpen: true,
      title: 'Security Protocol Blocked',
      message: 'You cannot delete your own active session. Please contact another Super Admin to perform this action.',
      actionType: 'danger',
      confirmText: 'Understood',
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      isAlertOnly: true
    });
    return;
  }

  // --- UPDATED DELETE FUNCTION ---
  setConfirmModal({
    isOpen: true,
    title: 'Confirm Deletion',
    message: `WARNING: Are you sure you want to permanently delete ${usernameToDelete}? All telemetry and logs associated with this user will be removed.`,
    actionType: 'danger',
    confirmText: 'Delete Personnel',
    isAlertOnly: false,
    onConfirm: async () => {
      try {
        const token = localStorage.getItem('token'); // 1. Grab the token
        const response = await fetch(`${API_BASE_URL}/api/users/${userId}/`, { 
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}` // 2. Attach the token to the header
          }
        });
        
        if (response.ok) {
          setUsersList(prev => prev.filter(user => user.id !== userId));
        } else {
          alert("Failed to delete user from database. Check if you have permission.");
        }
      } catch (error) {
        console.error("Network error:", error);
        alert("Network error while trying to delete.");
      }
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  });
};

  const handleToggleStatus = async (userId, currentStatus, targetUsername) => {
    // --- UPGRADED: Security check using custom modal ---
    if (targetUsername === username) {
      setConfirmModal({
        isOpen: true,
        title: 'Security Protocol Blocked',
        message: 'You cannot suspend your own active session. Please contact another Super Admin to modify your access level.',
        actionType: 'warning',
        confirmText: 'Understood',
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        isAlertOnly: true // <-- Tells the modal to hide the Cancel button
      });
      return;
    }

    const isCurrentlySuspended = currentStatus === 'Suspended';
    const newStatus = isCurrentlySuspended ? 'Offline' : 'Suspended'; 
    const actionText = isCurrentlySuspended ? 'activate' : 'suspend';

    setConfirmModal({
      isOpen: true,
      title: `${isCurrentlySuspended ? 'Activate' : 'Suspend'} Access`,
      message: `Are you sure you want to ${actionText} ${targetUsername}'s access to the system?`,
      actionType: isCurrentlySuspended ? 'success' : 'warning',
      confirmText: isCurrentlySuspended ? 'Yes, Activate' : 'Yes, Suspend',
      isAlertOnly: false, // <-- Standard confirm mode
      onConfirm: async () => {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/users/${userId}/toggle-status/`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({ status: newStatus === 'Suspended' ? 'Suspended' : 'Active' })
            });

          if (response.ok) {
            setUsersList(usersList.map(user => 
              user.id === userId ? { ...user, status: newStatus } : user
            ));
          } else {
            alert("Failed to update user status in the database.");
          }
        } catch (error) {
          alert("Network error while trying to update status.");
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };


  // Real-time search & status filtering
  const filteredUsers = usersList.filter(user => {
    // --- NEW: ROLE-BASED VISIBILITY CHECK ---
    // If the current user is just an 'admin', filter out any user in the list who is an 'admin' or 'superadmin'.
    if (userRole === 'admin' && (user.role === 'admin' || user.role === 'superadmin')) {
      return false; 
    }

    // Convert everything to lowercase for easy matching
    const query = searchQuery.toLowerCase();
    
    const matchesSearch = 
      user.username?.toLowerCase().includes(query) || 
      user.email?.toLowerCase().includes(query) ||
      user.employee_id?.toLowerCase().includes(query) || 
      user.role?.toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === 'All' || user.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });


  // --- PAGINATION MATH & LOGIC ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  // Auto-reset to Page 1 when searching, filtering, or changing items per page
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, itemsPerPage]);

  // --- LIVE SYSTEM HEALTH STATE ---
  const [sysHealth, setSysHealth] = useState({
    cpu_percent: 12, ram_used: 4.2, ram_total: 16.0, gpu_used: 2.1, 
    gpu_total: 12.0, disk_used: 120, disk_total: 500, gpu_temp: 45,
    active_model: "yolov8-best.pt", inference_latency: "42ms" 
  });
  
  const [uptimeSeconds, setUptimeSeconds] = useState(0); 
  const [syncStatus, setSyncStatus] = useState('connecting'); 

  

  
  useEffect(() => {
    localStorage.setItem('pcb_activeView', activeView);
    localStorage.setItem('pcb_activeSubTab', activeSubTab);
  }, [activeView, activeSubTab]);

  useEffect(() => {
    setActiveSubTab((prevTab) => {
      if (!viewSubTabs[activeView]?.includes(prevTab)) {
        return viewSubTabs[activeView][0]; 
      }
      return prevTab;
    });
    setProvisionStatus({ loading: false, type: null, message: '' });
    setFormErrors({});
  }, [activeView]);

  // --- BACKGROUND POLLING ---
  useEffect(() => {
    let interval;
    if (activeView === 'Dashboard' && activeSubTab === 'System Health') {
      const fetchHealth = async () => {
        try {
          const token = localStorage.getItem('token'); 
          const response = await fetch(`${API_BASE_URL}/api/system-health/`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const data = await response.json();
            setSysHealth(prev => ({...prev, ...data})); 
            if (data.uptime_seconds) setUptimeSeconds(data.uptime_seconds); 
            setSyncStatus('live'); 
          } else {
            setSyncStatus('offline');
            setUptimeSeconds(0);
            setSysHealth({ cpu_percent: 0, ram_used: 0, ram_total: 16.0, gpu_used: 0, gpu_total: 12.0, disk_used: 0, disk_total: 500, gpu_temp: 0, active_model: "Disconnected", inference_latency: "0ms" });
          }
        } catch (error) {
          setSyncStatus('offline'); 
          setUptimeSeconds(0);
          setSysHealth({ cpu_percent: 0, ram_used: 0, ram_total: 16.0, gpu_used: 0, gpu_total: 12.0, disk_used: 0, disk_total: 500, gpu_temp: 0, active_model: "Disconnected", inference_latency: "0ms" });
        }
      };
      fetchHealth();
      interval = setInterval(fetchHealth, 5000); 
    }
    return () => clearInterval(interval);
  }, [activeView, activeSubTab]);

  useEffect(() => {
    let tick;
    if (syncStatus === 'live') {
      tick = setInterval(() => setUptimeSeconds(prev => prev + 1), 1000);
    }
    return () => clearInterval(tick);
  }, [syncStatus]); 

  const formatUptime = (totalSeconds) => {
    const d = Math.floor(totalSeconds / (3600 * 24));
    const h = Math.floor((totalSeconds % (3600 * 24)) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);
    if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // --- PASSWORD STRENGTH LOGIC ---
  const calculateStrength = (pass) => {
    let score = 0;
    if (!pass) return 0;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;
    return score; // Max score is 5
  };
  const passStrength = calculateStrength(provisionData.password);
  const profilePassStrength = calculateStrength(profileData.newPassword);

  // --- FORM VALIDATION LOGIC ---
  const validateForm = () => {
    const errors = {};
    if (!provisionData.username.trim()) errors.username = "Username is required";
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!provisionData.email) errors.email = "Email is required";
    else if (!emailRegex.test(provisionData.email)) errors.email = "Invalid email format";
    
    // Validates against the 5 requirements
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    if (!passRegex.test(provisionData.password)) {
      errors.password = "Please meet all password requirements below.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // --- HANDLE PROVISIONING SUBMIT ---
  const handleProvisionSubmit = async () => {
    if (!validateForm()) return; 

    setProvisionStatus({ loading: true, type: null, message: '' });

    try {
      const token = localStorage.getItem('token'); 
      const response = await fetch(`${API_BASE_URL}/api/provision/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(provisionData)
      });
      const data = await response.json();

      if (response.ok) {
        setProvisionStatus({ loading: false, type: 'success', message: `Account '${provisionData.username}' created successfully!` });
        setProvisionData({ username: '', email: '', password: '', role: provisionData.role }); 
        setFormErrors({});
      } else {
        setProvisionStatus({ loading: false, type: 'error', message: data.error || 'Failed to create account.' });
      }
    } catch (error) {
      setProvisionStatus({ loading: false, type: 'error', message: 'Network error. Is Django running?' });
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file); setPreview(URL.createObjectURL(file));
      setResults(null); setImageDims({ width: 0, height: 0 });
    }
  };

  const handleImageLoad = (e) => setImageDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });

  const handleUpload = async () => {
    if (!image) return alert("Please select a PCB image first!");
    setLoading(true);
    const formData = new FormData();
    formData.append('image', image);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/inspect/`, { 
        method: 'POST', 
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData 
      });
      const data = await response.json();
      setResults(data); 
      
      
      if (data.image_id) {
         setActiveSystemId(data.image_id);
      }
      
    } catch (error) {
      alert("Failed to upload image. Ensure the Django server is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/api/logout/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: username })
      });
    } catch (error) {
      console.error("Failed to update offline status", error);
    }

    localStorage.removeItem('pcb_activeView');
    localStorage.removeItem('pcb_activeSubTab');

    onLogout();
  };
  


  const getStatusColor = (percent) => {
    if (percent > 85) return '#EF4444'; 
    if (percent > 70) return '#F59E0B'; 
    return '#10B981'; 
  };

  const getCpuGradient = (percent) => {
    if (percent > 85) return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'; 
    if (percent > 70) return 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)'; 
    return 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)'; 
  };
  
  const getRamGradient = (percent) => {
    if (percent > 85) return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'; 
    return 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)'; 
  };

  const getGpuGradient = (percent) => {
    if (percent > 85) return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'; 
    if (percent > 70) return 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)'; 
    return 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'; 
  };

  const getDiskGradient = (percent) => {
    if (percent > 85) return 'linear-gradient(90deg, #EF4444 0%, #F87171 100%)'; 
    return 'linear-gradient(90deg, #8B5CF6 0%, #A78BFA 100%)'; 
  };
  
  const getRoleStyle = (role) => {
  switch (role) {
    case 'superadmin':
      return {
        background: 'linear-gradient(135deg, #0EA5E9, #0284C7)',
        shadow: '0 4px 10px rgba(14, 165, 233, 0.2)',
        textColor: '#0EA5E9'
      };
    case 'admin':
      return {
        background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
        shadow: '0 4px 10px rgba(139, 92, 246, 0.2)',
        textColor: '#8B5CF6'
      };
    default: // 'user' / QA Engineer
      return {
        background: 'linear-gradient(135deg, #10B981, #059669)',
        shadow: '0 4px 10px rgba(16, 185, 129, 0.2)',
        textColor: '#10B981'
      };
  }
};

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F1F5F9', color: '#1E293B', fontFamily: 'system-ui, -apple-system, sans-serif', overflow: 'hidden' }}>
      
      <style>{`
        @keyframes pulse-ring { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        @keyframes pulse-ring-success { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); } 70% { box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
        @keyframes pulse-ring-danger { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes pulse-ring-warning { 0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.5); } 70% { box-shadow: 0 0 0 14px rgba(245, 158, 11, 0); } 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } }
        @keyframes shimmer-bar { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        .health-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .health-card:hover { transform: translateY(-5px); box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.15); border-color: #CBD5E1; }
        .shimmer-effect { background-image: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0) 100%); background-size: 200% 100%; animation: shimmer-bar 2s infinite linear; }
        .stagger-1 { animation: slide-up 0.4s ease forwards 0.1s; opacity: 0; }
        .stagger-2 { animation: slide-up 0.4s ease forwards 0.2s; opacity: 0; }
        .stagger-3 { animation: slide-up 0.4s ease forwards 0.3s; opacity: 0; }
        .error-shake { animation: shake 0.3s ease-in-out; border-color: #EF4444 !important; }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        
        @keyframes fade-in-fast { from { opacity: 0; } to { opacity: 1; backdrop-filter: blur(0px); } }
        @keyframes scale-up-fast { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }

        /* ADD THESE CUSTOM SCROLLBAR RULES */
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #F8FAFC; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

        input:focus { outline: none !important; box-shadow: none !important; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active{
            -webkit-box-shadow: 0 0 0 30px transparent inset !important;
            -webkit-text-fill-color: #0F172A !important;
            transition: background-color 5000s ease-in-out 0s;
        }

        /* --- USER DIRECTORY --- */
        .directory-row { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          position: relative;
        }
        .directory-row:hover { 
          background-color: #F8FAFC !important; 
          transform: translateY(-2px); 
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05); 
          z-index: 10;
        }
        .directory-row td {
          transition: all 0.3s ease;
        }
        
        .directory-row td:first-child {
          box-shadow: inset 4px 0 0 0 transparent !important;
        }
        .directory-row:hover td:first-child {
          box-shadow: inset 4px 0 0 0 #10B981 !important;
        }
        
        .status-dot-online {
          animation: pulse-ring 2s infinite;
        }

      `}</style>

      {/* --- COLLAPSIBLE SIDEBAR --- */}
      <div className="animate-slide-right" style={{ width: isSidebarOpen ? '280px' : '88px', backgroundColor: '#0F172A', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', overflow: 'hidden', boxShadow: '4px 0 24px rgba(15, 23, 42, 0.08)', zIndex: 10, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        <div style={{ background: 'radial-gradient(circle at top right, rgba(16, 185, 129, 0.08), transparent 70%)', position: 'absolute', top: 0, left: 0, right: 0, height: '300px', pointerEvents: 'none' }}></div>

        <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: isSidebarOpen ? 'space-between' : 'center', padding: isSidebarOpen ? '0 24px' : '0', position: 'relative', zIndex: 1, transition: 'all 0.3s ease' }}>
          <div onClick={() => !isSidebarOpen && setIsSidebarOpen(true)} title={!isSidebarOpen ? "Expand Navigation" : ""} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: !isSidebarOpen ? 'pointer' : 'default' }}>
            <div style={{ background: 'linear-gradient(135deg, #10B981, #059669)', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)', transition: 'transform 0.2s', transform: !isSidebarOpen ? 'scale(1.05)' : 'scale(1)' }}>
              <Cpu size={20} color="#FFFFFF" />
            </div>
            {isSidebarOpen && (
              <h2 className="animate-fade-in" style={{ margin: 0, fontSize: '18px', letterSpacing: '1px', fontWeight: '700', color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                PCB<span style={{ color: '#10B981' }}>VISION</span>
              </h2>
            )}
          </div>
          {isSidebarOpen && (
            <button onClick={() => setIsSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '6px', borderRadius: '8px', transition: 'all 0.2s' }} onMouseEnter={(e) => { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.background = 'rgba(16,185,129,0.1)' }} onMouseLeave={(e) => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent' }}>
              <PanelLeftClose size={20} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, padding: isSidebarOpen ? '24px 16px' : '24px 12px', overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {menuItems.map((item, idx) => (
            <div 
              key={idx} 
              onMouseEnter={() => setHoveredItem(idx)} 
              onMouseLeave={() => setHoveredItem(null)} 
              onClick={() => setActiveView(item.label)} /* <-- THIS IS THE ONLY CHANGE */
              title={!isSidebarOpen ? item.label : ""} 
              style={{ display: 'flex', alignItems: 'center', padding: '12px', borderRadius: '10px', justifyContent: isSidebarOpen ? 'flex-start' : 'center', backgroundColor: activeView === item.label ? 'rgba(16, 185, 129, 0.15)' : hoveredItem === idx ? 'rgba(255,255,255,0.04)' : 'transparent', color: activeView === item.label ? '#10B981' : hoveredItem === idx ? '#F8FAFC' : '#94A3B8', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: activeView === item.label ? '600' : '500', width: isSidebarOpen ? '100%' : '52px', margin: isSidebarOpen ? '0' : '0 auto' }}
            >
              <span style={{ display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              {isSidebarOpen && <span className="animate-fade-in" style={{ fontSize: '14.5px', marginLeft: '14px', whiteSpace: 'nowrap' }}>{item.label}</span>}
            </div>
          ))}
        </div>

        <div 
          onClick={() => setActiveView('Profile')} 
          style={{ 
            padding: isSidebarOpen ? '20px 24px' : '20px 0', 
            backgroundColor: 'rgba(0,0,0,0.15)', 
            borderTop: '1px solid rgba(255,255,255,0.06)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: isSidebarOpen ? 'flex-start' : 'center', 
            position: 'relative', 
            zIndex: 1, 
            transition: 'all 0.3s ease',
            cursor: 'pointer' 
          }}
          
        >
          <div style={{ 
            width: '40px', 
            height: '40px', 
            borderRadius: '50%', // Changed from '12px' to '50%' for a perfect circle
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            fontWeight: '700', 
            fontSize: '16px', 
            color: '#FFFFFF', 
            flexShrink: 0,
            paddingBottom: '2px',
            background: userRole === 'superadmin' ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : userRole === 'admin' ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'linear-gradient(135deg, #10B981, #059669)',
            boxShadow: userRole === 'superadmin' ? '0 4px 10px rgba(14, 165, 233, 0.2)' : userRole === 'admin' ? '0 4px 10px rgba(139, 92, 246, 0.2)' : '0 4px 10px rgba(16, 185, 129, 0.2)'
          }}>
            {displayUsername 
              ? displayUsername.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() 
              : 'U'
            }
          </div>
          {isSidebarOpen && (
            <div className="animate-fade-in" style={{ marginLeft: '12px', whiteSpace: 'nowrap' }}>
              <p style={{ margin: 0, fontSize: '13.5px', fontWeight: '600', color: '#F8FAFC', textTransform: 'capitalize' }}>{displayUsername}</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{userRole.replace('superadmin', 'Super Admin')}</p>
            </div>
          )}
        </div>
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <header style={{ height: '80px', backgroundColor: '#FFFFFF', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px', zIndex: 5, boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
          <div style={{ display: 'flex', gap: '32px', height: '100%' }}>
            {viewSubTabs[activeView]?.map((tab) => (
              <div key={tab} onClick={() => setActiveSubTab(tab)} onMouseEnter={() => setHoveredTab(tab)} onMouseLeave={() => setHoveredTab(null)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', borderBottom: activeSubTab === tab ? '3px solid #10B981' : '3px solid transparent', color: activeSubTab === tab ? '#0F172A' : hoveredTab === tab ? '#334155' : '#94A3B8', fontWeight: activeSubTab === tab ? '600' : '500', fontSize: '14.5px', transition: 'all 0.2s ease', height: '100%', marginTop: '3px' }}>
                {tab}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={handleDisconnect} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', color: '#EF4444', cursor: 'pointer', fontSize: '14px', padding: '9px 16px', borderRadius: '10px', fontWeight: '600', transition: 'all 0.2s ease' }} onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FEE2E2'; e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#FEF2F2'; e.currentTarget.style.transform = 'translateY(0)'; }}>
              <LogOut size={15} /> Disconnect
            </button>
          </div>
        </header>

        <div className="animate-slide-up" style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '-4px' }}>
              <span style={{ color: '#94A3B8', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>{activeView.toUpperCase()}</span>
              <span style={{ color: '#CBD5E1', fontSize: '12px' }}>/</span>
              <span style={{ color: '#10B981', fontSize: '12px', fontWeight: '600', letterSpacing: '0.5px' }}>{activeSubTab.toUpperCase()}</span>

            </div>


            {/* INSPECTION (Live Interface) */}
            {activeView === 'Inspection' && activeSubTab === 'Live Interface' && (
              <>
                <div className="stagger-1" style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '28px 32px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <h1 style={{ margin: 0, fontSize: '22px', color: '#0F172A', fontWeight: '700', letterSpacing: '-0.3px' }}>Optical Defect Analysis</h1>
                      
                     
                      {activeSystemId && (
                        <span style={{ fontSize: '13px', backgroundColor: '#F0FDF4', color: '#10B981', padding: '4px 12px', borderRadius: '8px', border: '1px solid #DCFCE7', WebkitTextFillColor: 'initial', fontWeight: '700' }}>
                          Image #{activeSystemId}
                        </span>
                      )}
                    </div>
                    
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Info size={15} color="#10B981" /> Feed high-resolution physical imagery into the centralized YOLOv8 inspection framework.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <input type="file" id="file-upload" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                    <label htmlFor="file-upload" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 20px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', cursor: 'pointer', color: '#475569', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.color = '#10B981'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#475569'; }}>
                      <UploadCloud size={18} /> Select Image
                    </label>
                    <button onClick={handleUpload} disabled={loading || !image} style={{ padding: '11px 24px', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: (loading || !image) ? 'not-allowed' : 'pointer', fontWeight: '600', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', opacity: (loading || !image) ? 0.5 : 1, boxShadow: (loading || !image) ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)' }} onMouseEnter={(e) => { if(!loading && image) e.currentTarget.style.transform = 'translateY(-1px)'; }} onMouseLeave={(e) => { if(!loading && image) e.currentTarget.style.transform = 'translateY(0)'; }}>
                      {loading ? 'Processing Tensors...' : 'Run Diagnostics'}
                    </button>
                  </div>
                </div>

                <div className="stagger-2" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 600px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', minHeight: '520px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '700', letterSpacing: '0.5px' }}>LIVE MATRIX VIEWPORT</span>
                      {image && <span style={{ fontSize: '11.5px', color: '#94A3B8', backgroundColor: '#F8FAFC', padding: '4px 8px', borderRadius: '6px', border: '1px solid #E2E8F0' }}>{imageDims.width} × {imageDims.height} px</span>}
                    </div>
                    <div style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #F1F5F9', position: 'relative', overflow: 'hidden' }}>
                      {!preview ? (
                        <div style={{ textAlign: 'center', padding: '100px 40px' }}>
                          <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', border: '1px solid #DCFCE7' }}><ShieldCheck size={28} color="#10B981" /></div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: '600', color: '#334155' }}>Awaiting Board Input</h4>
                          <p style={{ margin: '0 auto', textAlign: 'center', fontSize: '13px', color: '#94A3B8', maxWidth: '280px' }}>Upload physical component arrays to map optical configurations.</p>
                        </div>
                      ) : (
                        <>
                          {/* FLOATING ACTION OVERLAY */}
                          <div style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, display: 'flex', gap: '8px', backgroundColor: 'rgba(255,255,255,0.9)', padding: '6px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', backdropFilter: 'blur(4px)', alignItems: 'center' }}>
                            <button onClick={() => resetViewport()} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}><Maximize size={14} /> Fit</button>
                            <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>
                            
                            <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.05))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex' }} title="Zoom Out"><ZoomOut size={18} color="#475569" /></button>
                            
                            {/* ZOOM PERCENTAGE TRACKER */}
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155', minWidth: '45px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                            
                            <button onClick={() => setZoom(z => Math.min(z + 0.1, 10))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex' }} title="Zoom In"><ZoomIn size={18} color="#475569" /></button>
                            
                            {/* EDIT / CORRECT BUTTON */}
                            {results && (
                              <>
                                <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>
                                <button 
                                  onClick={handleEditLabels} 
                                  style={{ background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s' }}
                                >
                                  <Edit3 size={15} /> Correct
                                </button>
                              </>
                            )}
                          </div>

                          {/* DRAGGABLE & ZOOMABLE CANVAS */}
                          <div 
                            ref={viewportRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{ width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <div style={{ 
                              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, 
                              transformOrigin: '0 0',
                              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                              position: 'relative',
                              display: 'inline-block' 
                            }}>
                              <img src={preview} alt="PCB" onLoad={handleImageLoad} style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '8px', display: 'block', opacity: loading ? 0.4 : 1, pointerEvents: 'none' }} />
                              
                              {results && imageDims.width > 0 && (
                                <svg viewBox={`0 0 ${imageDims.width} ${imageDims.height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                                  
                                  {results.defects.filter(d => d.confidence >= confidenceThreshold).map((defect) => {
                                    const [x_min, y_min, x_max, y_max] = defect.bbox;
                                    const labelWidth = 160;

                                    const labelX = (x_min + labelWidth > imageDims.width) ? Math.max(0, imageDims.width - labelWidth) : x_min;

                                    return (
                                      <g key={defect.id}>
                                        <rect x={x_min} y={y_min} width={x_max - x_min} height={y_max - y_min} fill="rgba(239, 68, 68, 0.08)" stroke="#EF4444" strokeWidth="3" />
                                        <rect x={labelX} y={y_min > 30 ? y_min - 28 : y_min} width={labelWidth} height="28" fill="#EF4444" rx="4" />
                                        <text x={labelX + 8} y={y_min > 30 ? y_min - 9 : y_min + 19} fill="#FFFFFF" fontSize="13" fontWeight="700">{defect.label.toUpperCase()} {Math.round(defect.confidence * 100)}%</text>
                                      </g>
                                    );
                                  })}
                                </svg>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ flex: '1 1 380px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '700' }}><Activity size={18} color="#10B981" /> Telemetry Matrices</h3>
                    {!results ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #E2E8F0', borderRadius: '12px', padding: '30px', backgroundColor: '#F8FAFC' }}>
                        <p style={{ color: '#94A3B8', fontSize: '13.5px', margin: 0, fontStyle: 'italic', textAlign: 'center' }}>Pipeline waiting for diagnostic scan initialization.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div style={{ backgroundColor: results.total_defects_found > 0 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${results.total_defects_found > 0 ? '#FEE2E2' : '#DCFCE7'}`, padding: '20px', borderRadius: '12px', transition: 'all 0.3s ease' }}>
                          <span style={{ fontSize: '12px', color: results.total_defects_found > 0 ? '#EF4444' : '#15803D', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Anomalies Located</span>
                          <p style={{ margin: '6px 0 0 0', fontSize: '42px', fontWeight: '800', color: results.total_defects_found > 0 ? '#DC2626' : '#16A34A', lineHeight: '1' }}>{results.total_defects_found}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '12px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '700' }}>Target Classification Logs</span>
                          {/* UPDATED CONTAINER BELOW */}
                          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px', maxHeight: '380px', overflowY: 'auto', paddingRight: '8px' }}>
                            {results.defects.length === 0 ? (
                              <div style={{ fontSize: '13.5px', color: '#15803D', fontWeight: '600', backgroundColor: '#F0FDF4', padding: '12px 16px', borderRadius: '10px', border: '1px solid #DCFCE7' }}>Optimal Structure — No physical defects detected.</div>
                            ) : (
                              results.defects.map((d, i) => (
                                <div key={i} style={{ fontSize: '13.5px', color: '#334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '12px 16px', borderRadius: '10px', borderLeft: '4px solid #EF4444', borderTop: '1px solid #E2E8F0', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}>
                                  <span style={{ textTransform: 'capitalize', fontWeight: '600', color: '#1E293B' }}>{d.label.replace('_', ' ')}</span>
                                  <span style={{ fontWeight: '700', color: '#0F172A', backgroundColor: '#E2E8F0', padding: '3px 8px', borderRadius: '6px', fontSize: '12px' }}>{Math.round(d.confidence * 100)}%</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* DASHBOARD (System Health) */}
            {activeView === 'Dashboard' && activeSubTab === 'System Health' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div className="stagger-1" style={{ position: 'relative', overflow: 'hidden', backgroundColor: '#0F172A', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.2)' }}>
                  <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      <div style={{ padding: '16px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', color: '#10B981', border: '1px solid rgba(255,255,255,0.1)' }}><Server size={32} /></div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <h1 style={{ margin: 0, fontSize: '28px', color: '#FFFFFF', fontWeight: '800', letterSpacing: '-0.5px' }}>Server Telemetry</h1>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', transition: 'all 0.3s ease', backgroundColor: syncStatus === 'live' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: syncStatus === 'live' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: syncStatus === 'live' ? '#10B981' : '#EF4444', animation: syncStatus === 'live' ? 'pulse-ring 2s infinite' : 'none' }}></div>
                            <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', color: syncStatus === 'live' ? '#10B981' : '#EF4444' }}>{syncStatus === 'live' ? 'LIVE SYNC' : 'OFFLINE'}</span>
                          </div>
                        </div>
                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '15px' }}>Real-time hardware monitoring and AI pipeline diagnostics.</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 4px 0', color: '#64748B', fontSize: '13px', fontWeight: '600', letterSpacing: '0.5px' }}>SYSTEM UPTIME</p>
                      <h2 style={{ margin: 0, fontSize: '24px', color: '#F8FAFC', fontWeight: '700', fontFamily: 'monospace' }}>{formatUptime(uptimeSeconds)}</h2>
                    </div>
                  </div>
                </div>
                
                <div className="stagger-2" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '16px', color: '#0F172A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#EFF6FF', borderRadius: '8px', color: '#3B82F6' }}><Cpu size={18} /></div>CPU Compute</span>
                      <span style={{ fontSize: '15px', color: getStatusColor(sysHealth.cpu_percent), fontWeight: '800' }}>{sysHealth.cpu_percent}%</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: '8px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${sysHealth.cpu_percent}%`, background: getCpuGradient(sysHealth.cpu_percent), height: '100%', borderRadius: '8px', transition: 'width 0.5s ease', position: 'relative' }}><div className="shimmer-effect" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div></div>
                    </div>
                  </div>

                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '16px', color: '#0F172A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#FFFBEB', borderRadius: '8px', color: '#F59E0B' }}><Activity size={18} /></div>System RAM</span>
                      <span style={{ fontSize: '15px', color: getStatusColor((sysHealth.ram_used/sysHealth.ram_total)*100), fontWeight: '800' }}>{sysHealth.ram_used} / {sysHealth.ram_total} GB</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: '8px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(sysHealth.ram_used/sysHealth.ram_total)*100}%`, background: getRamGradient((sysHealth.ram_used/sysHealth.ram_total)*100), height: '100%', borderRadius: '8px', transition: 'width 0.5s ease', position: 'relative' }}><div className="shimmer-effect" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div></div>
                    </div>
                  </div>

                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '16px', color: '#0F172A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F0FDF4', borderRadius: '8px', color: '#10B981' }}><CircuitBoard size={18} /></div>NVIDIA VRAM</span>
                      <span style={{ fontSize: '15px', color: getStatusColor((sysHealth.gpu_used/sysHealth.gpu_total)*100), fontWeight: '800' }}>{sysHealth.gpu_used} / {sysHealth.gpu_total} GB</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: '8px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(sysHealth.gpu_used/sysHealth.gpu_total)*100}%`, background: getGpuGradient((sysHealth.gpu_used/sysHealth.gpu_total)*100), height: '100%', borderRadius: '8px', transition: 'width 0.5s ease', position: 'relative' }}><div className="shimmer-effect" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div></div>
                    </div>
                  </div>
                  
                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '16px', color: '#0F172A', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F5F3FF', borderRadius: '8px', color: '#8B5CF6' }}><HardDrive size={18} /></div>Disk Storage</span>
                      <span style={{ fontSize: '15px', color: getStatusColor((sysHealth.disk_used/sysHealth.disk_total)*100), fontWeight: '800' }}>{sysHealth.disk_used} / {sysHealth.disk_total} GB</span>
                    </div>
                    <div style={{ width: '100%', backgroundColor: '#F1F5F9', borderRadius: '8px', height: '14px', overflow: 'hidden', position: 'relative' }}>
                      <div style={{ width: `${(sysHealth.disk_used/sysHealth.disk_total)*100}%`, background: getDiskGradient((sysHealth.disk_used/sysHealth.disk_total)*100), height: '100%', borderRadius: '8px', transition: 'width 0.5s ease', position: 'relative' }}><div className="shimmer-effect" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}></div></div>
                    </div>
                  </div>
                </div>

                <div className="stagger-3" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Network size={16} color="#8B5CF6" /> Active AI Weight</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A', lineHeight: '1.2', wordBreak: 'break-all' }}>{sysHealth.active_model}</span>
                    </div>
                  </div>
                  
                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Zap size={16} color="#F59E0B" /> Avg. Latency</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '42px', fontWeight: '800', color: '#10B981', lineHeight: '1' }}>{sysHealth.inference_latency}</span>
                      <span style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600', paddingBottom: '4px' }}>/ frame</span>
                    </div>
                  </div>

                  <div className="health-card" style={{ flex: '1 1 300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', cursor: 'default' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                      <span style={{ fontSize: '14px', color: '#64748B', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}><Thermometer size={16} color="#EF4444" /> Thermal Core</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '42px', fontWeight: '800', color: sysHealth.gpu_temp > 80 ? '#EF4444' : '#0F172A', lineHeight: '1' }}>{sysHealth.gpu_temp}°C</span>
                      <span style={{ fontSize: '15px', color: '#94A3B8', fontWeight: '600', paddingBottom: '4px' }}>Normal: &lt; 80°C</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* USER MANAGEMENT (Provision Account) */}
            {activeView === 'User Management' && activeSubTab === 'Provision Account' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Header Row */}
                <div 
                  className="stagger-1"
                  style={{ 
                    backgroundColor: '#FFFFFF', 
                    borderRadius: '16px', 
                    padding: '36px 32px', 
                    boxShadow: provisionData.role === 'user' ? '0 10px 30px rgba(16, 185, 129, 0.08)' : provisionData.role === 'admin' ? '0 10px 30px rgba(139, 92, 246, 0.08)' : '0 10px 30px rgba(14, 165, 233, 0.08)', 
                    border: `1px solid ${provisionData.role === 'user' ? 'rgba(16, 185, 129, 0.2)' : provisionData.role === 'admin' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(14, 165, 233, 0.2)'}`, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '20px', 
                    position: 'relative', 
                    overflow: 'hidden',
                    transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'default'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  {/* Animated Abstract Background Orbs */}
                  <div style={{ 
                    position: 'absolute', right: '-2%', top: '-30%', width: '250px', height: '250px', 
                    background: provisionData.role === 'user' ? 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)' : provisionData.role === 'admin' ? 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(14, 165, 233, 0.08) 0%, transparent 70%)', 
                    borderRadius: '50%',
                    transition: 'background 0.5s ease',
                  }}></div>
                  <div style={{ 
                    position: 'absolute', right: '15%', bottom: '-40%', width: '180px', height: '180px', 
                    background: provisionData.role === 'user' ? 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, transparent 70%)' : provisionData.role === 'admin' ? 'radial-gradient(circle, rgba(139, 92, 246, 0.06) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(14, 165, 233, 0.06) 0%, transparent 70%)', 
                    borderRadius: '50%',
                    transition: 'background 0.5s ease',
                  }}></div>

                  {/* Dynamic Floating Icon Container */}
                  <div style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '16px', 
                    backgroundColor: provisionData.role === 'user' ? '#F0FDF4' : provisionData.role === 'admin' ? '#F5F3FF' : '#F0F9FF', 
                    borderRadius: '14px', 
                    color: provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9', 
                    position: 'relative', 
                    zIndex: 1,
                    transition: 'all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                    boxShadow: provisionData.role === 'user' ? '0 8px 16px rgba(16, 185, 129, 0.2)' : provisionData.role === 'admin' ? '0 8px 16px rgba(139, 92, 246, 0.2)' : '0 8px 16px rgba(14, 165, 233, 0.2)',
                    transform: 'scale(1.05)'
                  }}>
                    <UserPlus size={32} />
                  </div>

                  {/* Text Content */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>
                      Provision New Account
                    </h1>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px', fontWeight: '500' }}>
                      Create secure credentials and configure access levels for factory personnel.
                    </p>
                  </div>
                </div>

                {/* Split Column Layout */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  
                  {/* The Interactive Role Cards */}
                  <div className="stagger-1" style={{ flex: '1 1 400px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* QA Engineer Card */}
                    <div 
                      onClick={() => setProvisionData({...provisionData, role: 'user'})}
                      style={{ 
                        padding: '24px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        backgroundColor: provisionData.role === 'user' ? '#F0FDF4' : '#FFFFFF', position: 'relative', overflow: 'hidden',
                        border: provisionData.role === 'user' ? '2px solid #10B981' : '1px solid #E2E8F0',
                        boxShadow: provisionData.role === 'user' ? '0 12px 24px rgba(16, 185, 129, 0.15)' : '0 4px 12px rgba(0,0,0,0.02)',
                        transform: provisionData.role === 'user' ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderRadius: '12px', backgroundColor: provisionData.role === 'user' ? '#10B981' : '#F1F5F9', color: provisionData.role === 'user' ? '#FFFFFF' : '#64748B', transition: 'all 0.3s', boxShadow: provisionData.role === 'user' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none' }}><User size={24} /></div>
                          <div>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: provisionData.role === 'user' ? '#064E3B' : '#0F172A', fontWeight: '700', transition: 'color 0.3s' }}>QA Engineer</h3>
                            <p style={{ margin: 0, fontSize: '13.5px', color: provisionData.role === 'user' ? '#047857' : '#64748B', maxWidth: '250px', transition: 'color 0.3s' }}>Standard access for factory floor. Can run YOLO inspections and manual reviews.</p>
                          </div>
                        </div>
                        <div style={{ 
                          transform: provisionData.role === 'user' ? 'scale(1)' : 'scale(0.5)', 
                          opacity: provisionData.role === 'user' ? 1 : 0, 
                          transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                        }}>
                          <CheckCircle2 size={24} color="#10B981" />
                        </div>
                      </div>
                    </div>

                    {/* --- NEW: ONLY SUPER ADMINS CAN SEE AND CLICK THESE CARDS --- */}
                    {userRole === 'superadmin' && (
                      <>
                        {/* Admin Card */}
                        <div 
                          onClick={() => setProvisionData({...provisionData, role: 'admin'})}
                          style={{ 
                            padding: '24px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            backgroundColor: provisionData.role === 'admin' ? '#F5F3FF' : '#FFFFFF', position: 'relative', overflow: 'hidden',
                            border: provisionData.role === 'admin' ? '2px solid #8B5CF6' : '1px solid #E2E8F0',
                            boxShadow: provisionData.role === 'admin' ? '0 12px 24px rgba(139, 92, 246, 0.15)' : '0 4px 12px rgba(0,0,0,0.02)',
                            transform: provisionData.role === 'admin' ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderRadius: '12px', backgroundColor: provisionData.role === 'admin' ? '#8B5CF6' : '#F1F5F9', color: provisionData.role === 'admin' ? '#FFFFFF' : '#64748B', transition: 'all 0.3s', boxShadow: provisionData.role === 'admin' ? '0 4px 12px rgba(139, 92, 246, 0.3)' : 'none' }}><ShieldCheck size={24} /></div>
                              <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: provisionData.role === 'admin' ? '#4C1D95' : '#0F172A', fontWeight: '700', transition: 'color 0.3s' }}>Admin</h3>
                                <p style={{ margin: 0, fontSize: '13.5px', color: provisionData.role === 'admin' ? '#5B21B6' : '#64748B', maxWidth: '250px', transition: 'color 0.3s' }}>Elevated privileges. Can upload datasets, switch models, and manage teams.</p>
                              </div>
                            </div>
                            <div style={{ 
                              transform: provisionData.role === 'admin' ? 'scale(1)' : 'scale(0.5)', 
                              opacity: provisionData.role === 'admin' ? 1 : 0, 
                              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                            }}>
                              <CheckCircle2 size={24} color="#8B5CF6" />
                            </div>
                          </div>
                        </div>

                        {/* Super Admin Card */}
                        <div 
                          onClick={() => setProvisionData({...provisionData, role: 'superadmin'})}
                          style={{ 
                            padding: '24px', borderRadius: '16px', cursor: 'pointer', transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            backgroundColor: provisionData.role === 'superadmin' ? '#F0F9FF' : '#FFFFFF', position: 'relative', overflow: 'hidden',
                            border: provisionData.role === 'superadmin' ? '2px solid #0EA5E9' : '1px solid #E2E8F0',
                            boxShadow: provisionData.role === 'superadmin' ? '0 12px 24px rgba(14, 165, 233, 0.15)' : '0 4px 12px rgba(0,0,0,0.02)',
                            transform: provisionData.role === 'superadmin' ? 'scale(1.02) translateY(-2px)' : 'scale(1) translateY(0)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', borderRadius: '12px', backgroundColor: provisionData.role === 'superadmin' ? '#0EA5E9' : '#F1F5F9', color: provisionData.role === 'superadmin' ? '#FFFFFF' : '#64748B', transition: 'all 0.3s', boxShadow: provisionData.role === 'superadmin' ? '0 4px 12px rgba(14, 165, 233, 0.3)' : 'none' }}><Server size={24} /></div>
                              <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: provisionData.role === 'superadmin' ? '#075985' : '#0F172A', fontWeight: '700', transition: 'color 0.3s' }}>Super Admin</h3>
                                <p style={{ margin: 0, fontSize: '13.5px', color: provisionData.role === 'superadmin' ? '#0369A1' : '#64748B', maxWidth: '250px', transition: 'color 0.3s' }}>Ultimate system control. Access to server hardware, databases, and core security.</p>
                              </div>
                            </div>
                            <div style={{ 
                              transform: provisionData.role === 'superadmin' ? 'scale(1)' : 'scale(0.5)', 
                              opacity: provisionData.role === 'superadmin' ? 1 : 0, 
                              transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)' 
                            }}>
                              <CheckCircle2 size={24} color="#0EA5E9" />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* The Input Form */}
                  <div className="stagger-2" style={{ 
                    flex: '1 1 350px', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '40px', 
                    boxShadow: '0 8px 30px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0',
                    borderTop: `4px solid ${provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9'}`,
                    transition: 'border-color 0.4s ease'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* SYSTEM STATUS NOTIFICATION */}
                      {provisionStatus.message && (
                        <div className="animate-fade-in" style={{ 
                          padding: '16px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px',
                          backgroundColor: provisionStatus.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                          color: provisionStatus.type === 'success' ? '#15803D' : '#DC2626',
                          border: provisionStatus.type === 'success' ? '1px solid #DCFCE7' : '1px solid #FCA5A5'
                        }}>
                          {provisionStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                          <span style={{ fontSize: '14px', fontWeight: '600' }}>{provisionStatus.message}</span>
                        </div>
                      )}

                      {/* Username Input */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>SYSTEM ID (USERNAME)</label>
                          {formErrors.username && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{formErrors.username}</span>}
                        </div>
                        <div className={formErrors.username ? 'error-shake' : ''} style={{ 
                          display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '0 16px',
                          border: formErrors.username ? '2px solid #EF4444' : focusedInput === 'user' ? `2px solid ${provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9'}` : '2px solid transparent',
                          boxShadow: focusedInput === 'user' && !formErrors.username ? `0 0 0 4px ${provisionData.role === 'user' ? 'rgba(16, 185, 129, 0.1)' : provisionData.role === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(14, 165, 233, 0.1)'}` : 'none',
                          transition: 'all 0.2s ease'
                        }}>
                          <User size={18} color={formErrors.username ? '#EF4444' : focusedInput === 'user' ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                          <input 
                            type="text" placeholder="e.g., Engineer_01" 
                            value={provisionData.username}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\s/g, ''); 
                              setProvisionData({...provisionData, username: val});
                              if (formErrors.username) setFormErrors({...formErrors, username: null});
                            }}
                            onFocus={() => setFocusedInput('user')} onBlur={() => setFocusedInput(null)}
                            style={{ width: '100%', padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '500' }} 
                          />
                        </div>
                      </div>

                      {/* Email Input */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>EMPLOYEE EMAIL</label>
                          {formErrors.email && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{formErrors.email}</span>}
                        </div>
                        <div className={formErrors.email ? 'error-shake' : ''} style={{ 
                          display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '0 16px',
                          border: formErrors.email ? '2px solid #EF4444' : focusedInput === 'email' ? `2px solid ${provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9'}` : '2px solid transparent',
                          boxShadow: focusedInput === 'email' && !formErrors.email ? `0 0 0 4px ${provisionData.role === 'user' ? 'rgba(16, 185, 129, 0.1)' : provisionData.role === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(14, 165, 233, 0.1)'}` : 'none',
                          transition: 'all 0.2s ease'
                        }}>
                          <Mail size={18} color={formErrors.email ? '#EF4444' : focusedInput === 'email' ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                          <input 
                            type="email" placeholder="employee@factory.com" 
                            value={provisionData.email}
                            onChange={(e) => {
                              setProvisionData({...provisionData, email: e.target.value});
                              if (formErrors.email) setFormErrors({...formErrors, email: null});
                            }}
                            onFocus={() => setFocusedInput('email')} onBlur={() => setFocusedInput(null)}
                            style={{ width: '100%', padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '500' }} 
                          />
                        </div>
                      </div>

                      {/* Password Input */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>TEMPORARY PASSWORD</label>
                          {formErrors.password && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{formErrors.password}</span>}
                        </div>
                        <div className={formErrors.password ? 'error-shake' : ''} style={{ 
                          display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '0 16px',
                          border: formErrors.password ? '2px solid #EF4444' : focusedInput === 'pass' ? `2px solid ${provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9'}` : '2px solid transparent',
                          boxShadow: focusedInput === 'pass' && !formErrors.password ? `0 0 0 4px ${provisionData.role === 'user' ? 'rgba(16, 185, 129, 0.1)' : provisionData.role === 'admin' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(14, 165, 233, 0.1)'}` : 'none',
                          transition: 'all 0.2s ease'
                        }}>
                          <Key size={18} color={formErrors.password ? '#EF4444' : focusedInput === 'pass' ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                          <input 
                            type={showPassword ? "text" : "password"} placeholder="••••••••" 
                            value={provisionData.password}
                            onChange={(e) => {
                              setProvisionData({...provisionData, password: e.target.value});
                              if (formErrors.password) setFormErrors({...formErrors, password: null});
                            }}
                            onFocus={() => setFocusedInput('pass')} onBlur={() => setFocusedInput(null)}
                            style={{ flex: 1, padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', boxShadow: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '500' }} 
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                            {showPassword ? <Eye size={18} color="#94A3B8" /> : <EyeOff size={18} color="#94A3B8" />}
                          </button>
                        </div>
                        
                        {/* Dynamic Password Strength Meter */}
                        <div style={{ display: 'flex', gap: '4px', marginTop: '10px', height: '4px' }}>
                          <div style={{ flex: 1, borderRadius: '2px', backgroundColor: provisionData.password.length === 0 ? '#E2E8F0' : passStrength >= 1 ? '#EF4444' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                          <div style={{ flex: 1, borderRadius: '2px', backgroundColor: provisionData.password.length === 0 ? '#E2E8F0' : passStrength >= 2 ? '#F59E0B' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                          <div style={{ flex: 1, borderRadius: '2px', backgroundColor: provisionData.password.length === 0 ? '#E2E8F0' : passStrength >= 3 ? '#FBBF24' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                          <div style={{ flex: 1, borderRadius: '2px', backgroundColor: provisionData.password.length === 0 ? '#E2E8F0' : passStrength >= 4 ? '#10B981' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                          <div style={{ flex: 1, borderRadius: '2px', backgroundColor: provisionData.password.length === 0 ? '#E2E8F0' : passStrength >= 5 ? '#059669' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', transition: 'color 0.3s', color: provisionData.password.length >= 8 ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8' }}>8+ Chars</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', transition: 'color 0.3s', color: /[A-Z]/.test(provisionData.password) ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8' }}>Upper</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', transition: 'color 0.3s', color: /[a-z]/.test(provisionData.password) ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8' }}>Lower</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', transition: 'color 0.3s', color: /[0-9]/.test(provisionData.password) ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8' }}>Number</span>
                          <span style={{ fontSize: '10px', fontWeight: '700', transition: 'color 0.3s', color: /[^A-Za-z0-9]/.test(provisionData.password) ? (provisionData.role === 'user' ? '#10B981' : provisionData.role === 'admin' ? '#8B5CF6' : '#0EA5E9') : '#94A3B8' }}>Symbol</span>
                        </div>
                      </div>

                      <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '4px 0' }}></div>

                      {/* Dynamic Gradient Submit Button */}
                      <button 
                        onClick={handleProvisionSubmit}
                        disabled={provisionStatus.loading}
                        style={{ 
                          width: '100%', padding: '16px', borderRadius: '12px', fontWeight: '700', fontSize: '15px', cursor: provisionStatus.loading ? 'not-allowed' : 'pointer', 
                          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                          background: provisionStatus.loading ? '#94A3B8' : 
                            (provisionData.role === 'user' ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 
                             provisionData.role === 'admin' ? 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' : 
                             'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)'), 
                          color: '#FFFFFF', border: 'none',
                          boxShadow: provisionStatus.loading ? 'none' : 
                            (provisionData.role === 'user' ? '0 4px 14px rgba(16, 185, 129, 0.3)' : 
                             provisionData.role === 'admin' ? '0 4px 14px rgba(139, 92, 246, 0.3)' : 
                             '0 4px 14px rgba(14, 165, 233, 0.3)'), 
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', marginTop: '4px'
                        }}
                        onMouseEnter={(e) => { 
                          if(!provisionStatus.loading){ 
                            e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'; 
                            e.currentTarget.style.boxShadow = provisionData.role === 'user' ? '0 8px 20px rgba(16, 185, 129, 0.4)' : provisionData.role === 'admin' ? '0 8px 20px rgba(139, 92, 246, 0.4)' : '0 8px 20px rgba(14, 165, 233, 0.4)'; 
                          } 
                        }} 
                        onMouseLeave={(e) => { 
                          if(!provisionStatus.loading){ 
                            e.currentTarget.style.transform = 'translateY(0) scale(1)'; 
                            e.currentTarget.style.boxShadow = provisionData.role === 'user' ? '0 4px 14px rgba(16, 185, 129, 0.3)' : provisionData.role === 'admin' ? '0 4px 14px rgba(139, 92, 246, 0.3)' : '0 4px 14px rgba(14, 165, 233, 0.3)'; 
                          } 
                        }}
                      >
                        <PlusCircle size={20} /> {provisionStatus.loading ? 'Creating Account...' : 'Generate Secure Credentials'}
                      </button>
                      
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* USER MANAGEMENT (User Directory) */}
            {activeView === 'User Management' && activeSubTab === 'User Directory' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* UPGRADED: Search and Action Bar */}
                <div className="stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', backgroundColor: '#FFFFFF', padding: '24px 32px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '200px', background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.03))', pointerEvents: 'none' }}></div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                      <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        Active System Personnel
                        <span style={{ 
                          padding: '4px 12px', 
                          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
                          color: '#334155', 
                          borderRadius: '20px', 
                          fontSize: '12px', 
                          fontWeight: '700', 
                          border: '1px solid #E2E8F0',
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.05)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}>
                          <span style={{ color: '#10B981', marginRight: '6px', fontSize: '14px' }}>#</span>
                          {filteredUsers.length} Personnel
                        </span>
                      </h2>
                      <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Manage, monitor, and provision factory access credentials.</p>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap', justifyContent: 'flex-end', flex: '1 1 auto' }}>
                    
                    {/* UPGRADED: Smooth Sliding Status Filter Toggle */}
                    <div style={{ position: 'relative', display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                      
                      {/* The physical sliding background pill */}
                      <div style={{
                        position: 'absolute',
                        top: '6px',
                        left: '6px',
                        bottom: '6px',
                        width: '96px', /* Fixed width so it aligns perfectly with the buttons */
                        backgroundColor: '#FFFFFF',
                        borderRadius: '10px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)', /* The smooth glide physics */
                        transform: `translateX(${['All', 'Online', 'Offline', 'Suspended'].indexOf(statusFilter) * 96}px)`,
                        zIndex: 1
                      }}></div>

                      {['All', 'Online', 'Offline', 'Suspended'].map(status => (
                        <button
                          key={status}
                          onClick={() => setStatusFilter(status)}
                          onMouseEnter={() => setHoveredFilter(status)}
                          onMouseLeave={() => setHoveredFilter(null)}
                          style={{
                            position: 'relative',
                            zIndex: 2, /* Keeps the text above the sliding white pill */
                            width: '96px', /* Matches the sliding pill width */
                            padding: '8px 0',
                            textAlign: 'center',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '13px',
                            fontWeight: statusFilter === status ? '800' : '600',
                            backgroundColor: 'transparent', 
                            
                            /* UPGRADED: Pure React color logic */
                            color: statusFilter === status 
                                    ? (status === 'Online' ? '#10B981' : status === 'Suspended' ? '#F59E0B' : status === 'Offline' ? '#64748B' : '#0F172A') 
                                    : (hoveredFilter === status ? '#0F172A' : '#64748B'),
                            
                            cursor: 'pointer',
                            transition: 'color 0.3s ease',
                          }}
                        >
                          {status}
                        </button>
                      ))}
                    </div>

                    {/* EXISTING: Search Input */}
                    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '12px 20px', borderRadius: '14px', border: '2px solid #E2E8F0', width: '100%', maxWidth: '320px', minWidth: '200px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} 
                         onFocus={(e) => { e.currentTarget.style.borderColor = '#10B981'; e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(16,185,129,0.1)'; }} 
                         onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}>
                      <Search size={18} color="#94A3B8" />
                      <input 
                        type="text" 
                        placeholder="Search system records..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14.5px', color: '#1E293B', marginLeft: '12px', width: '100%', fontWeight: '500' }} 
                      />
                    </div>

                  </div>
                </div>

                {/* Users Table */}
                <div className="stagger-2" style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 8px 30px rgba(15, 23, 42, 0.03)', overflow: 'hidden' }}>
                  
                  {isLoadingUsers ? (
                     <div style={{ padding: '80px', textAlign: 'center', color: '#64748B', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#10B981', animation: 'spin 1s linear infinite' }}></div>
                        <span style={{ fontWeight: '600', fontSize: '15px' }}>Syncing with Database...</span>
                     </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="animate-slide-up" style={{ padding: '80px', textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px dashed #CBD5E1' }}>
                        <Users size={32} color="#94A3B8" />
                      </div>
                      <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px', fontWeight: '700' }}>No personnel found</h3>
                      <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>{searchQuery ? "Try adjusting your search criteria." : "No accounts have been provisioned yet."}</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', width: '100%' }}>
                      <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                        <tr>
                          <th style={{ padding: '20px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personnel Identity</th>
                          <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee ID</th>
                          <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clearance Level</th>
                          <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Network Status</th>
                          <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Telemetry</th>
                          <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Created By</th>
                          <th style={{ padding: '20px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Security Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentUsers.map((user, index) => (
                          <tr key={user.id} className="directory-row" style={{ borderBottom: '1px solid #E2E8F0', animation: `slide-up 0.4s ease forwards ${index * 0.05}s`, opacity: 0, backgroundColor: '#FFFFFF' }}>
                            <td style={{ padding: '20px 32px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ 
                                  width: '44px', height: '44px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '16px', color: '#FFFFFF', paddingBottom: '2px',
                                  background: user.role === 'superadmin' ? 'linear-gradient(135deg, #0EA5E9, #0284C7)' : user.role === 'admin' ? 'linear-gradient(135deg, #8B5CF6, #6D28D9)' : 'linear-gradient(135deg, #10B981, #059669)',
                                  boxShadow: user.role === 'superadmin' ? '0 4px 10px rgba(14, 165, 233, 0.2)' : user.role === 'admin' ? '0 4px 10px rgba(139, 92, 246, 0.2)' : '0 4px 10px rgba(16, 185, 129, 0.2)'
                                }}>
                                  {user.username 
                                    ? user.username
                                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                                        .split(/[\s_]+/)
                                        .map(n => n[0])
                                        .join('')
                                        .substring(0, 2)
                                        .toUpperCase()
                                    : 'U'
                                  }
                                </div>
                                <div>
                                  <p style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>{user.username}</p>
                                  <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>{user.email || 'No registry email'}</p>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: '20px 24px', fontSize: '14.5px', color: '#475569', fontWeight: '600', fontFamily: 'monospace' }}>
                              {user.employee_id || `#${user.id}`} 
                            </td>
                            <td style={{ padding: '20px 24px' }}>
                              <span style={{ 
                                whiteSpace: 'nowrap', display: 'inline-block', padding: '6px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px',
                                backgroundColor: user.role === 'superadmin' ? '#F0F9FF' : user.role === 'admin' ? '#F5F3FF' : '#F0FDF4',
                                color: user.role === 'superadmin' ? '#0EA5E9' : user.role === 'admin' ? '#8B5CF6' : '#10B981',
                                border: `1px solid ${user.role === 'superadmin' ? '#E0F2FE' : user.role === 'admin' ? '#EDE9FE' : '#DCFCE7'}`
                              }}>
                                {user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'QA Engineer'}
                              </span>
                            </td>

                            <td style={{ padding: '20px 24px' }}>
                              <span style={{ 
                                color: user.status === 'Online' ? '#15803D' : user.status === 'Offline' ? '#64748B' : '#DC2626', 
                                backgroundColor: user.status === 'Online' ? '#F0FDF4' : user.status === 'Offline' ? '#F8FAFC' : '#FEF2F2',
                                padding: '6px 14px', borderRadius: '20px', 
                                border: `1px solid ${user.status === 'Online' ? '#DCFCE7' : user.status === 'Offline' ? '#E2E8F0' : '#FCA5A5'}`,
                                fontSize: '12.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '8px' 
                              }}>
                                <div className={user.status === 'Online' ? 'status-dot-online' : ''} style={{ 
                                  width: '8px', height: '8px', borderRadius: '50%', 
                                  backgroundColor: user.status === 'Online' ? '#10B981' : user.status === 'Offline' ? '#94A3B8' : '#EF4444'
                                }}></div>
                                {user.status}
                              </span>
                            </td>

                            <td style={{ padding: '20px 24px', fontSize: '13.5px', color: '#64748B', fontWeight: '500' }}>
                              {user.last_login}
                            </td>

                            
                            <td style={{ padding: '20px 24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ 
                                  width: '28px', height: '28px', 
                                  borderRadius: '50%', 
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                  fontWeight: '700', fontSize: '11px', 
                                  lineHeight: 1, 
                                  paddingTop: '1px', 
                                  color: '#475569', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', flexShrink: 0 
                                }}>
                                  {(user.created_by && user.created_by !== 'System') 
                                    ? user.created_by
                                        .replace(/([a-z])([A-Z])/g, '$1 $2')
                                        .split(/[\s_]+/)                     
                                        .map(n => n[0])                      
                                        .join('')                          
                                        .substring(0, 2)                     
                                        .toUpperCase()                   
                                    : 'SY'
                                  }
                                </div>
                                <span style={{ fontSize: '13.5px', color: '#334155', fontWeight: '600' }}>
                                  {user.created_by || 'System'}
                                </span>
                              </div>
                            </td>

                            <td style={{ padding: '20px 32px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                              <button 
                                onClick={() => handleToggleStatus(user.id, user.status, user.username)}
                                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer', padding: '10px', borderRadius: '10px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display: 'inline-flex' }}
                                onMouseEnter={(e) => { 
                                  e.currentTarget.style.color = user.status === 'Suspended' ? '#10B981' : '#F59E0B'; 
                                  e.currentTarget.style.backgroundColor = user.status === 'Suspended' ? '#F0FDF4' : '#FFFBEB'; 
                                  e.currentTarget.style.borderColor = user.status === 'Suspended' ? '#DCFCE7' : '#FEF3C7';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                title={user.status === 'Suspended' ? "Restore Access" : "Suspend Access"}
                              >
                                {user.status === 'Suspended' ? <CheckCircle size={18} /> : <Ban size={18} />}
                              </button>

                              <button 
                                onClick={() => handleDeleteUser(user.id, user.username)}
                                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', cursor: 'pointer', padding: '10px', borderRadius: '10px', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', display: 'inline-flex' }}
                                onMouseEnter={(e) => { 
                                  e.currentTarget.style.color = '#EF4444'; 
                                  e.currentTarget.style.backgroundColor = '#FEF2F2'; 
                                  e.currentTarget.style.borderColor = '#FCA5A5';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = '#64748B'; e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.transform = 'translateY(0)'; }}
                                title="Permanently Delete"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  )}

                  {/* --- NEO-MODERN PAGINATION FOOTER --- */}
                  {!isLoadingUsers && filteredUsers.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
                      
                      {/* Left Side: Custom Animated Dropdown Menu */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                        <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>ROWS PER PAGE</span>
                        
                        {/* The Clickable Button */}
                        <button 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#FFFFFF', borderRadius: '10px', 
                            border: `2px solid ${isDropdownOpen ? '#10B981' : '#E2E8F0'}`, 
                            color: '#0F172A', fontSize: '14px', fontWeight: '700', cursor: 'pointer', 
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: isDropdownOpen ? '0 0 0 4px rgba(16,185,129,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                          }}
                        >
                          {itemsPerPage < 10 ? `0${itemsPerPage}` : itemsPerPage}
                          
                          {/* Animated Chevron Arrow */}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94A3B8' }}>
                            <polyline points="6 9 12 15 18 9"></polyline>
                          </svg>
                        </button>

                        {/* The Floating Dropdown Menu */}
                        <div style={{ 
                          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, left: '95px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '6px',
                          boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', zIndex: 50,
                          opacity: isDropdownOpen ? 1 : 0, 
                          transform: isDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.95)', 
                          pointerEvents: isDropdownOpen ? 'auto' : 'none',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                          {[5, 10, 25, 50].map(num => (
                            <div 
                              key={num}
                              onClick={() => { setItemsPerPage(num); setIsDropdownOpen(false); }}
                              style={{ 
                                padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600',
                                backgroundColor: itemsPerPage === num ? '#F0FDF4' : 'transparent',
                                color: itemsPerPage === num ? '#10B981' : '#475569',
                                transition: 'all 0.2s ease',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                              }}
                              onMouseEnter={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                              onMouseLeave={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              {num < 10 ? `0${num}` : num}
                              {itemsPerPage === num && <CheckCircle2 size={14} color="#10B981" />}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Right Side: Tracker & Connected Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                        
                        {/* Data Tracker Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                          <span style={{ backgroundColor: '#F1F5F9', color: '#0F172A', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid #E2E8F0' }}>
                            {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filteredUsers.length)}
                          </span>
                          of <span style={{ color: '#0F172A', fontWeight: '700' }}>{filteredUsers.length}</span>
                        </div>

                        {/* Segmented Button Group */}
                        <div style={{ display: 'flex', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '4px', border: '1px solid #E2E8F0' }}>
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{ 
                              padding: '6px 16px', borderRadius: '8px', border: 'none', 
                              backgroundColor: currentPage === 1 ? 'transparent' : '#FFFFFF', 
                              color: currentPage === 1 ? '#94A3B8' : '#0F172A', 
                              fontSize: '13px', fontWeight: '700', 
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer', 
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                              boxShadow: currentPage === 1 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' 
                            }}
                            onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                            onMouseLeave={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                          >
                            Prev
                          </button>
                          
                          {/* Divider Line */}
                          <div style={{ width: '1px', backgroundColor: '#E2E8F0', margin: '4px 4px' }}></div>
                          
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={{ 
                              padding: '6px 16px', borderRadius: '8px', border: 'none', 
                              backgroundColor: currentPage === totalPages ? 'transparent' : '#FFFFFF', 
                              color: currentPage === totalPages ? '#94A3B8' : '#0F172A', 
                              fontSize: '13px', fontWeight: '700', 
                              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', 
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                              boxShadow: currentPage === totalPages ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' 
                            }}
                            onMouseEnter={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                            onMouseLeave={(e) => { if (currentPage !== totalPages) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                          >
                            Next
                          </button>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* PROFILE (Account Settings) */}
            {activeView === 'Profile' && activeSubTab === 'Account Settings' && (
              <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
                
                {/* --- NEW: HERO PROFILE BANNER --- */}
                <div className="stagger-1" style={{ width: '100%', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', borderRadius: '16px', padding: '32px 40px', display: 'flex', alignItems: 'center', gap: '24px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.15)' }}>
                  {/* Decorative Animated Orbs */}
                  <div style={{ position: 'absolute', right: '-5%', top: '-50%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-ring 4s infinite alternate' }}></div>
                  <div style={{ position: 'absolute', right: '15%', bottom: '-50%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(14, 165, 233, 0.1) 0%, transparent 70%)', borderRadius: '50%', animation: 'pulse-ring 4s infinite alternate-reverse' }}></div>

                  {/* Giant Avatar */}
                  <div style={{ 
                    position: 'relative', zIndex: 1, width: '84px', height: '84px', borderRadius: '24px', 
                    background: getRoleStyle(userRole).background, 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: '800', color: '#FFFFFF', 
                    boxShadow: getRoleStyle(userRole).shadow 
                  }}>
                    {displayUsername 
                      ? displayUsername.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() 
                      : 'U'
                    }
                  </div>
                  
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <h1 style={{ margin: '0 0 6px 0', fontSize: '28px', color: '#FFFFFF', fontWeight: '800', letterSpacing: '-0.5px' }}>{displayUsername}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: '8px', 
                        backgroundColor: getRoleStyle(userRole).background.replace('linear-gradient(135deg, ', '').split(',')[0] + '33', // 33 adds ~20% opacity
                        border: `1px solid ${getRoleStyle(userRole).textColor}`, 
                        color: getRoleStyle(userRole).textColor, 
                        fontSize: '12px', 
                        fontWeight: '700', 
                        letterSpacing: '0.5px', 
                        textTransform: 'uppercase' 
                      }}>
                        {userRole.replace('superadmin', 'Super Admin')}
                      </span>
                      <span style={{ color: '#94A3B8', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Settings size={14} /> Identity Management
                      </span>
                    </div>
                  </div>
                </div>

                {/* --- FORMS SECTION --- */}
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  
                  {/* Left Column: Form Info */}
                  <div className="stagger-2" style={{ flex: '1 1 500px', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '40px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                    
                    {/* Watermark Icon */}
                    <User size={180} color="#F8FAFC" style={{ position: 'absolute', top: '-20px', right: '-20px', zIndex: 0, transform: 'rotate(-10deg)', pointerEvents: 'none' }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F0F9FF', borderRadius: '10px', color: '#0EA5E9' }}><User size={20} /></div>
                          Profile Credentials
                        </h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Update your system identification and notification routing details.</p>
                      </div>

                      {/* Status Notification */}
                      {profileStatus.message && (
                        <div className="animate-fade-in" style={{ padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: profileStatus.type === 'success' ? '#F0FDF4' : '#FEF2F2', color: profileStatus.type === 'success' ? '#15803D' : '#DC2626', border: profileStatus.type === 'success' ? '1px solid #DCFCE7' : '1px solid #FCA5A5', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                          {profileStatus.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                          <span style={{ fontSize: '14px', fontWeight: '600' }}>{profileStatus.message}</span>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        {/* Username Input */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>SYSTEM ID (USERNAME)</label>
                            {profileErrors.username && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{profileErrors.username}</span>}
                          </div>
                          <div className={profileErrors.username ? 'error-shake' : ''} style={{ 
                            display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0 16px', 
                            border: profileErrors.username ? '2px solid #EF4444' : focusedInput === 'prof_user' ? '2px solid #10B981' : '2px solid transparent', 
                            boxShadow: focusedInput === 'prof_user' && !profileErrors.username ? '0 0 0 4px rgba(16,185,129,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease' 
                          }}>
                            <User size={18} color={profileErrors.username ? '#EF4444' : focusedInput === 'prof_user' ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                            <input 
                              type="text" 
                              value={profileData.username}
                              onChange={(e) => {
                                setProfileData({...profileData, username: e.target.value.replace(/\s/g, '')});
                                if (profileErrors.username) setProfileErrors({...profileErrors, username: null});
                              }}
                              onFocus={() => setFocusedInput('prof_user')} onBlur={() => setFocusedInput(null)}
                              style={{ width: '100%', padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '600' }} 
                            />
                          </div>
                        </div>

                        {/* Email Input */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>EMAIL ADDRESS</label>
                            {profileErrors.email && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{profileErrors.email}</span>}
                          </div>
                          <div className={profileErrors.email ? 'error-shake' : ''} style={{ 
                            display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0 16px', 
                            border: profileErrors.email ? '2px solid #EF4444' : focusedInput === 'prof_email' ? '2px solid #10B981' : '2px solid transparent', 
                            boxShadow: focusedInput === 'prof_email' && !profileErrors.email ? '0 0 0 4px rgba(16,185,129,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease' 
                          }}>
                            <Mail size={18} color={profileErrors.email ? '#EF4444' : focusedInput === 'prof_email' ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                            <input 
                              type="email" 
                              placeholder="Update your email..."
                              value={profileData.email}
                              onChange={(e) => {
                                setProfileData({...profileData, email: e.target.value});
                                if (profileErrors.email) setProfileErrors({...profileErrors, email: null});
                              }}
                              onFocus={() => setFocusedInput('prof_email')} onBlur={() => setFocusedInput(null)}
                              style={{ width: '100%', padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '600' }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Security */}
                  <div className="stagger-3" style={{ flex: '1 1 400px', backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '40px', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.06)', border: '1px solid #E2E8F0', position: 'relative', overflow: 'hidden' }}>
                    
                    {/* Watermark Icon */}
                    <ShieldCheck size={180} color="#F8FAFC" style={{ position: 'absolute', top: '-20px', right: '-20px', zIndex: 0, transform: 'rotate(10deg)', pointerEvents: 'none' }} />

                    <div style={{ position: 'relative', zIndex: 1 }}>
                      <div style={{ marginBottom: '32px' }}>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F0FDF4', borderRadius: '10px', color: '#10B981' }}><Lock size={20} /></div>
                          Security Configuration
                        </h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Verify your current identity to modify security credentials.</p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Current Password */}
                        <div>
                          <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px', marginBottom: '8px' }}>CURRENT PASSWORD</label>
                          <div style={{ 
                            display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0 16px', 
                            border: focusedInput === 'prof_curr_pass' ? '2px solid #10B981' : '2px solid transparent', 
                            boxShadow: focusedInput === 'prof_curr_pass' ? '0 0 0 4px rgba(16,185,129,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease' 
                          }}>
                            <Key size={18} color={focusedInput === 'prof_curr_pass' ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                            <input 
                              type={showCurrentPassword ? "text" : "password"} 
                              placeholder="Required to change password"
                              value={profileData.currentPassword}
                              onChange={(e) => setProfileData({...profileData, currentPassword: e.target.value})}
                              onFocus={() => setFocusedInput('prof_curr_pass')} onBlur={() => setFocusedInput(null)}
                              style={{ flex: 1, padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '600', letterSpacing: showCurrentPassword || !profileData.currentPassword ? 'normal' : '2px' }} 
                            />
                            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                              {showCurrentPassword ? <Eye size={18} color="#94A3B8" /> : <EyeOff size={18} color="#94A3B8" />}
                            </button>
                          </div>
                        </div>

                        <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '8px 0' }}></div>

                        {/* New Password */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>NEW PASSWORD</label>
                            {profileErrors.newPassword && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{profileErrors.newPassword}</span>}
                          </div>
                          <div className={profileErrors.newPassword ? 'error-shake' : ''} style={{ 
                            display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0 16px', 
                            border: profileErrors.newPassword ? '2px solid #EF4444' : focusedInput === 'prof_new_pass' ? '2px solid #10B981' : '2px solid transparent', 
                            boxShadow: focusedInput === 'prof_new_pass' && !profileErrors.newPassword ? '0 0 0 4px rgba(16,185,129,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease' 
                          }}>
                            <Lock size={18} color={profileErrors.newPassword ? '#EF4444' : focusedInput === 'prof_new_pass' ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                            <input 
                              type={showNewPassword ? "text" : "password"} 
                              placeholder="Leave blank to keep current"
                              value={profileData.newPassword}
                              onChange={(e) => {
                                setProfileData({...profileData, newPassword: e.target.value});
                                if (profileErrors.newPassword) setProfileErrors({...profileErrors, newPassword: null});
                              }}
                              onFocus={() => setFocusedInput('prof_new_pass')} onBlur={() => setFocusedInput(null)}
                              style={{ flex: 1, padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '600', letterSpacing: showNewPassword || !profileData.newPassword ? 'normal' : '2px' }} 
                            />
                            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                              {showNewPassword ? <Eye size={18} color="#94A3B8" /> : <EyeOff size={18} color="#94A3B8" />}
                            </button>
                          </div>

                          {/* Dynamic Password Strength Meter for Profile */}
                          {profileData.newPassword.length > 0 && (
                            <div className="animate-fade-in">
                              <div style={{ display: 'flex', gap: '4px', marginTop: '10px', height: '4px' }}>
                                <div style={{ flex: 1, borderRadius: '2px', backgroundColor: profilePassStrength >= 1 ? '#EF4444' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                                <div style={{ flex: 1, borderRadius: '2px', backgroundColor: profilePassStrength >= 2 ? '#F59E0B' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                                <div style={{ flex: 1, borderRadius: '2px', backgroundColor: profilePassStrength >= 3 ? '#FBBF24' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                                <div style={{ flex: 1, borderRadius: '2px', backgroundColor: profilePassStrength >= 4 ? '#10B981' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                                <div style={{ flex: 1, borderRadius: '2px', backgroundColor: profilePassStrength >= 5 ? '#059669' : '#E2E8F0', transition: 'all 0.3s' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: profileData.newPassword.length >= 8 ? '#10B981' : '#94A3B8', transition: 'color 0.3s' }}>8+ Chars</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: /[A-Z]/.test(profileData.newPassword) ? '#10B981' : '#94A3B8', transition: 'color 0.3s' }}>Upper</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: /[a-z]/.test(profileData.newPassword) ? '#10B981' : '#94A3B8', transition: 'color 0.3s' }}>Lower</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: /[0-9]/.test(profileData.newPassword) ? '#10B981' : '#94A3B8', transition: 'color 0.3s' }}>Number</span>
                                <span style={{ fontSize: '10px', fontWeight: '700', color: /[^A-Za-z0-9]/.test(profileData.newPassword) ? '#10B981' : '#94A3B8', transition: 'color 0.3s' }}>Symbol</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Confirm New Password */}
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px' }}>CONFIRM NEW PASSWORD</label>
                            {profileErrors.confirmPassword && <span className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', fontWeight: '600' }}>{profileErrors.confirmPassword}</span>}
                          </div>
                          <div className={profileErrors.confirmPassword ? 'error-shake' : ''} style={{ 
                            display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '0 16px', 
                            border: profileErrors.confirmPassword ? '2px solid #EF4444' : focusedInput === 'prof_conf_pass' ? '2px solid #10B981' : '2px solid transparent', 
                            boxShadow: focusedInput === 'prof_conf_pass' && !profileErrors.confirmPassword ? '0 0 0 4px rgba(16,185,129,0.1)' : 'inset 0 2px 4px rgba(0,0,0,0.02)',
                            transition: 'all 0.2s ease' 
                          }}>
                            <CheckCircle size={18} color={profileErrors.confirmPassword ? '#EF4444' : focusedInput === 'prof_conf_pass' ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.2s' }} />
                            <input 
                              type={showConfirmPassword ? "text" : "password"} 
                              placeholder="Repeat new password"
                              value={profileData.confirmPassword}
                              onChange={(e) => {
                                setProfileData({...profileData, confirmPassword: e.target.value});
                                if (profileErrors.confirmPassword) setProfileErrors({...profileErrors, confirmPassword: null});
                              }}
                              onFocus={() => setFocusedInput('prof_conf_pass')} onBlur={() => setFocusedInput(null)}
                              style={{ flex: 1, padding: '16px 12px', background: 'transparent', border: 'none', outline: 'none', color: '#0F172A', fontSize: '15px', fontWeight: '600', letterSpacing: showConfirmPassword || !profileData.confirmPassword ? 'normal' : '2px' }} 
                            />
                            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform='scale(1.1)'} onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                              {showConfirmPassword ? <Eye size={18} color="#94A3B8" /> : <EyeOff size={18} color="#94A3B8" />}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={handleProfileUpdate}
                        disabled={profileStatus.loading || (profileData.newPassword && !profileData.currentPassword)}
                        style={{ 
                          width: '100%', padding: '16px', borderRadius: '14px', fontWeight: '800', fontSize: '15.5px', marginTop: '36px',
                          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px',
                          background: (profileStatus.loading || (profileData.newPassword && !profileData.currentPassword)) ? '#94A3B8' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)', 
                          color: '#FFFFFF', border: 'none', cursor: (profileStatus.loading || (profileData.newPassword && !profileData.currentPassword)) ? 'not-allowed' : 'pointer',
                          boxShadow: (profileStatus.loading || (profileData.newPassword && !profileData.currentPassword)) ? 'none' : '0 8px 20px -6px rgba(16, 185, 129, 0.5)', 
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onMouseEnter={(e) => { 
                          if(!profileStatus.loading && !(profileData.newPassword && !profileData.currentPassword)){ 
                            e.currentTarget.style.transform = 'translateY(-2px)'; 
                            e.currentTarget.style.boxShadow = '0 12px 25px -8px rgba(16, 185, 129, 0.6)'; 
                          } 
                        }} 
                        onMouseLeave={(e) => { 
                          if(!profileStatus.loading && !(profileData.newPassword && !profileData.currentPassword)){ 
                            e.currentTarget.style.transform = 'translateY(0)'; 
                            e.currentTarget.style.boxShadow = '0 8px 20px -6px rgba(16, 185, 129, 0.5)'; 
                          } 
                        }}
                      >
                        <Save size={20} /> {profileStatus.loading ? 'Updating Identity...' : 'Commit Changes'}
                      </button>
                      
                      {profileData.newPassword && !profileData.currentPassword && (
                        <p className="animate-fade-in" style={{ fontSize: '12px', color: '#EF4444', textAlign: 'center', marginTop: '16px', fontWeight: '700', padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
                          Current password is required to set a new password.
                        </p>
                      )}

                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- Annotation settings page --- */}
            {activeView === 'Model Hub' && activeSubTab === 'Annotation Settings' && (
               <AnnotationSettings />
            )}

            {/* --- Labelling page --- */}
            {activeView === 'Inspection' && activeSubTab === 'Labelling' && (
              <Labelling />
            )}

            {/* --- Datasets page --- */}
            {activeView === 'Model Hub' && activeSubTab === 'Datasets' && (
               <Datasets />
            )}

            {/* --- Training Pipeline page --- */}
            {activeView === 'Model Hub' && activeSubTab === 'Training Pipeline' && (
               <TrainingPipeline />
            )}

            {/* --- Validation page --- */}
            {activeView === 'Model Hub' && activeSubTab === 'Validation' && (
               <Validation />
            )}

            {/* --- Batch Upload page --- */}
            {activeView === 'Inspection' && activeSubTab === 'Batch Upload' && (
               <BatchUpload 
                 onCorrect={(imageSrc, imageFile, resultsData) => {
                    
                    // Step 1: Define the function that actually moves the data
                    const proceedToLabelling = () => {
                        sharedWorkspaceCache.imageSrc = imageSrc;
                        sharedWorkspaceCache.imageFile = imageFile;
                        
                        if (resultsData && resultsData.length > 0) {
                          sharedWorkspaceCache.boxes = resultsData.map(defect => {
                            const [x_min, y_min, x_max, y_max] = defect.bbox;
                            return {
                              id: defect.id,
                              x: x_min,
                              y: y_min,
                              width: x_max - x_min,
                              height: y_max - y_min,
                              class: defect.label 
                            };
                          });
                        } else {
                          sharedWorkspaceCache.boxes = [];
                        }
                        
                        sharedWorkspaceCache.isUnsaved = false;
                        setActiveSubTab('Labelling');
                    };

                    // Step 2: Check for unsaved work BEFORE moving the data!
                    if (sharedWorkspaceCache.isUnsaved) {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Unsaved Annotations Detected',
                          message: 'You have unsaved annotations in the Labelling workspace. Proceeding will discard your current progress. Do you want to overwrite the workspace?',
                          actionType: 'warning',
                          confirmText: 'Discard & Proceed',
                          isAlertOnly: false,
                          onConfirm: () => {
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                            proceedToLabelling();
                          }
                        });
                    } else {
                        // If it's safe (no unsaved work), just proceed normally
                        proceedToLabelling();
                    }
                 }}
               />
            )}

            {activeView === 'Records' && activeSubTab === 'Dataset Records' && (
                <DatasetRecords />
            )}

            {activeView === 'Records' && activeSubTab === 'Training Records' && (
                <TrainingRecords />
            )}

            {activeView === 'Records' && activeSubTab === 'Validation Records' && (
                <ValidationRecords />
            )}

            {activeView === 'Model Hub' && activeSubTab === 'Model Deployment' && (
                <ModelDeployment />
            )}

            {activeView === 'Records' && activeSubTab === 'Model Deployment Records' && (
                <ModelDeploymentRecords />
            )}

            {/* --- GLOBAL ANALYTICS --- */}
            {activeView === 'Dashboard' && activeSubTab === 'Global Analytics' && (
               <GlobalAnalytics />
            )}

            {activeView === 'Audit Logs' && activeSubTab === 'Security Events' && (
                <AuditLogs />
            )}

            {activeView === 'Records' && activeSubTab === 'Inspection Records' && (
                <InspectionRecords />
            )}

            {/* MODULE X: CATCH-ALL PLACEHOLDER FOR UNBUILT TABS            */}
            {!['Live Interface', 'System Health', 'Provision Account', 'User Directory', 'Account Settings', 'Annotation Settings', 'Labelling', 'Datasets', 'Training Pipeline', 'Batch Upload', 'Dataset Records', 'Training Records', 'Validation', 'Validation Records', 'Model Deployment', 'Model Deployment Records', 'Global Analytics', 'Security Events', 'Inspection Records'].includes(activeSubTab) && (
              <div className="animate-fade-in" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #CBD5E1', minHeight: '400px' }}>
                <HardDrive size={48} color="#CBD5E1" style={{ marginBottom: '16px' }} />
                <h2 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '20px' }}>{activeSubTab}</h2>
                <p style={{ color: '#94A3B8', fontSize: '14px' }}>This module is currently under development.</p>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* --- UPGRADED CREATIVE CONFIRMATION MODAL --- */}
      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          {/* Animated Glass Backdrop */}
          <div 
            onClick={() => { if(!confirmModal.isAlertOnly) setConfirmModal(prev => ({...prev, isOpen: false}))}} 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fade-in-fast 0.3s ease-out forwards' }}
          ></div>
          
          {/* Main Modal Card - Added marginTop to make room for the floating icon */}
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'scale-up-fast 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
            
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              
              {/* CREATIVE UPGRADE: Floating Overlap Icon Badge */}
              <div style={{ 
                position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)',
                width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF',
                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: confirmModal.actionType === 'danger' ? '#FEF2F2' : confirmModal.actionType === 'warning' ? '#FFFBEB' : '#F0FDF4', 
                  color: confirmModal.actionType === 'danger' ? '#EF4444' : confirmModal.actionType === 'warning' ? '#F59E0B' : '#10B981',
                  
                  /* UPGRADED: Dynamic Animation Assignment */
                  animation: `${confirmModal.actionType === 'danger' ? 'pulse-ring-danger' : confirmModal.actionType === 'warning' ? 'pulse-ring-warning' : 'pulse-ring-success'} 2s infinite`
                }}>
                  {confirmModal.actionType === 'danger' ? <Trash2 size={28} /> : confirmModal.actionType === 'warning' ? <ShieldAlert size={28} /> : <CheckCircle2 size={28} />}
                </div>
              </div>
              
              <div style={{ marginTop: '12px' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>{confirmModal.title}</h2>
                <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>{confirmModal.message}</p>
              </div>
              
              {/* Button Actions - Made them full width and balanced */}
              <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                
                {/* Only render Cancel button if it's NOT an alert */}
                {!confirmModal.isAlertOnly && (
                  <button 
                    onClick={() => setConfirmModal(prev => ({...prev, isOpen: false}))}
                    style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}
                  >
                    Cancel
                  </button>
                )}

                <button 
                  onClick={confirmModal.onConfirm}
                  style={{ 
                    flex: 1, padding: '14px', borderRadius: '12px', 
                    background: confirmModal.actionType === 'danger' ? 'linear-gradient(135deg, #EF4444, #DC2626)' : confirmModal.actionType === 'warning' ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'linear-gradient(135deg, #10B981, #059669)', 
                    color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s', 
                    boxShadow: `0 4px 14px ${confirmModal.actionType === 'danger' ? 'rgba(239, 68, 68, 0.3)' : confirmModal.actionType === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` 
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 20px ${confirmModal.actionType === 'danger' ? 'rgba(239, 68, 68, 0.4)' : confirmModal.actionType === 'warning' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 4px 14px ${confirmModal.actionType === 'danger' ? 'rgba(239, 68, 68, 0.3)' : confirmModal.actionType === 'warning' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`; }}
                >
                  {confirmModal.confirmText}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- PROFILE MFA VERIFICATION MODAL --- */}
      {showProfileOtpModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          <div 
            onClick={() => { setShowProfileOtpModal(false); setProfileOtp(''); setProfileStatus({ loading: false, type: null, message: ''}); }} 
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fade-in-fast 0.3s ease-out forwards' }}
          ></div>
          
          <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'scale-up-fast 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
            <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              
              
              <button 
                onClick={() => { setShowProfileOtpModal(false); setProfileOtp(''); setProfileStatus({ loading: false, type: null, message: ''}); }}
                style={{ position: 'absolute', top: '20px', right: '20px', background: '#F8FAFC', border: '1px solid #E2E8F0', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748B', transition: 'all 0.2s', zIndex: 10 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; e.currentTarget.style.transform = 'scale(1)'; }}
              >
                <X size={16} />
              </button>
              

              <div style={{ position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', color: '#3B82F6', animation: 'pulse-ring 2s infinite' }}>
                  <ShieldCheck size={28} />
                </div>
              </div>
              
              <div style={{ marginTop: '12px', textAlign: 'center', width: '100%' }}>
                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Verify Identity</h2>
                <p style={{ margin: '0 0 24px 0', fontSize: '14.5px', color: '#64748B', lineHeight: '1.6' }}>
                  To finalize this password change, enter the 6-digit code sent to <strong style={{ color: '#0F172A' }}>{maskedProfileEmail}</strong>.
                </p>

                {/* Show errors inside the modal if the OTP fails */}
                {profileStatus.type === 'error' && (
                  <div style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '10px', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', border: '1px solid #FCA5A5', fontWeight: '600' }}>
                    {profileStatus.message}
                  </div>
                )}

                <form onSubmit={handleVerifyProfileOtp}>
                  <div style={{ marginBottom: '24px' }}>
                    <input 
                      type="text" 
                      maxLength="6"
                      value={profileOtp}
                      onChange={(e) => setProfileOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      autoFocus
                      required 
                      style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '2px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A', outline: 'none', boxSizing: 'border-box', textAlign: 'center', fontSize: '28px', letterSpacing: '16px', fontWeight: '800', fontFamily: 'monospace', transition: 'all 0.3s ease' }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = '#3B82F6'; e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.15)'; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={profileStatus.loading || profileOtp.length !== 6}
                    style={{ width: '100%', padding: '16px', backgroundColor: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 'bold', cursor: (profileStatus.loading || profileOtp.length !== 6) ? 'not-allowed' : 'pointer', opacity: (profileStatus.loading || profileOtp.length !== 6) ? 0.7 : 1, boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)', transition: 'all 0.2s' }}
                    onMouseEnter={e => { if(!profileStatus.loading && profileOtp.length === 6) e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { if(!profileStatus.loading && profileOtp.length === 6) e.currentTarget.style.transform = 'translateY(0)' }}
                  >
                    {profileStatus.loading ? 'Verifying...' : 'Commit Changes'}
                  </button>
                </form>

                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    onClick={(e) => handleProfileUpdate(e, true)}
                    disabled={profileResendTimer > 0 || profileStatus.loading}
                    style={{ fontSize: '13.5px', fontWeight: '700', color: '#3B82F6', background: 'none', border: 'none', cursor: (profileResendTimer > 0 || profileStatus.loading) ? 'not-allowed' : 'pointer', padding: '8px 16px', borderRadius: '8px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', opacity: (profileResendTimer > 0 || profileStatus.loading) ? 0.5 : 1 }}
                    onMouseEnter={e => { if(!(profileResendTimer > 0 || profileStatus.loading)) { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.color = '#2563EB'; } }}
                    onMouseLeave={e => { if(!(profileResendTimer > 0 || profileStatus.loading)) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#3B82F6'; } }}
                  >
                    <RefreshCw size={14} className={(profileStatus.loading && profileResendTimer === 0) ? "animate-spin" : ""} /> 
                    {profileResendTimer > 0 ? `Resend Code in ${profileResendTimer}s` : 'Resend Code'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Dashboard;