import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Play, Square, Settings2, Sliders, HardDrive, RefreshCw, Dna, Layers, Image as ImageIcon, Zap, Timer, Network, Lightbulb, Flame, RotateCw, Cpu, CheckCircle2, Database, Search, ChevronDown, Check, Bell } from 'lucide-react';
import { API_BASE_URL } from '../config';

// --- SESSION CACHE ---
// These variables live outside the React component. 
// They survive page switches, but reset to default/null on a hard refresh (F5).
let cachedIsTraining = false;
let cachedRunId = null;
let cachedSelectedDatasetId = '';
let cachedModelArch = 'yolov8n.pt';
let cachedRunName = null; 
let cachedEpochs = 100;
let cachedBatchSize = 16;
let cachedImgSize = 640;
let cachedLearningRate = 0.01;
let cachedPatience = 50;
let cachedWeightDecay = 0.0005;
let cachedMosaic = 1.0;
let cachedMixup = 0.0;
let cachedWarmupEpochs = 3.0;
let cachedDegrees = 0.0;

// --- STYLING HELPERS ---
const InputWrapper = ({ label, icon: Icon, children, isLocked }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: isLocked ? 0.6 : 1, transition: 'all 0.3s' }}>
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {Icon && <Icon size={14} color="#94A3B8" />} {label}
    </label>
    <div className="input-ring-container" style={{ position: 'relative' }}>
      {children}
    </div>
  </div>
);

const TrainingPipeline = () => {
  // Initialize UI State from Cache
  const [isTraining, setIsTraining] = useState(cachedIsTraining);
  const [currentRunId, setCurrentRunId] = useState(cachedRunId); 
  const [datasets, setDatasets] = useState([]);

  // Custom Alert & Confirm Modals
  const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });

  // Custom Dropdown State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef(null);

  // Core Configuration State (from cache)
  const [selectedDatasetId, setSelectedDatasetId] = useState(cachedSelectedDatasetId);
  const [modelArch, setModelArch] = useState(cachedModelArch); 
  
  // Setup run name dynamically on first load, then cache it
  const initialRunName = cachedRunName || `PCB_Train_${Math.floor(Math.random() * 9000) + 1000}`;
  const [runName, setRunName] = useState(initialRunName);
  if (!cachedRunName) cachedRunName = initialRunName;

  const [baseOutputDir, setBaseOutputDir] = useState('Fetching directory...'); 

  // Training Hyperparameters State (from cache)
  const [epochs, setEpochs] = useState(cachedEpochs);
  const [batchSize, setBatchSize] = useState(cachedBatchSize);
  const [imgSize, setImgSize] = useState(cachedImgSize);
  const [learningRate, setLearningRate] = useState(cachedLearningRate);
  const [patience, setPatience] = useState(cachedPatience);
  const [weightDecay, setWeightDecay] = useState(cachedWeightDecay);
  const [mosaic, setMosaic] = useState(cachedMosaic);
  const [mixup, setMixup] = useState(cachedMixup);
  const [warmupEpochs, setWarmupEpochs] = useState(cachedWarmupEpochs);
  const [degrees, setDegrees] = useState(cachedDegrees);
  const [device, setDevice] = useState('Loading...');
  
  const [progressData, setProgressData] = useState({ epoch: 0, total_epochs: 0, percent: 0 });
  
  const pollingIntervalRef = useRef(null);

  const showMessage = (message) => setCustomAlert({ isOpen: true, message });

  // Custom update functions to sync React State with our Module Cache
  const updateIsTraining = (val) => { setIsTraining(val); cachedIsTraining = val; };
  const updateRunId = (val) => { setCurrentRunId(val); cachedRunId = val; };
  const updateSelectedDatasetId = (val) => { setSelectedDatasetId(val); cachedSelectedDatasetId = val; };
  const updateModelArch = (val) => { setModelArch(val); cachedModelArch = val; };
  const updateRunName = (val) => { setRunName(val); cachedRunName = val; };
  const updateEpochs = (val) => { setEpochs(val); cachedEpochs = val; };
  const updateBatchSize = (val) => { setBatchSize(val); cachedBatchSize = val; };
  const updateImgSize = (val) => { setImgSize(val); cachedImgSize = val; };
  const updateLearningRate = (val) => { setLearningRate(val); cachedLearningRate = val; };
  const updatePatience = (val) => { setPatience(val); cachedPatience = val; };
  const updateWeightDecay = (val) => { setWeightDecay(val); cachedWeightDecay = val; };
  const updateMosaic = (val) => { setMosaic(val); cachedMosaic = val; };
  const updateMixup = (val) => { setMixup(val); cachedMixup = val; };
  const updateWarmupEpochs = (val) => { setWarmupEpochs(val); cachedWarmupEpochs = val; };
  const updateDegrees = (val) => { setDegrees(val); cachedDegrees = val; };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsDropdownOpen(false);
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) setIsModelDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
    return () => stopPolling();
  }, []);

  // Because isTraining and currentRunId load from cache immediately, 
  // this useEffect automatically kicks off the polling loop if you return mid-training!
  useEffect(() => {
    if (isTraining && currentRunId) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [isTraining, currentRunId]);

  const startPolling = () => {
  pollingIntervalRef.current = setInterval(async () => {
    try {
      const token = localStorage.getItem('token');
      
      // Fetch Status
      const response = await fetch(`${API_BASE_URL}/api/training-runs/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const runs = await response.json();
        const activeRun = runs.find(r => r.id === currentRunId); 
        
        if (activeRun) {
          if (['Success', 'Failed', 'Completed'].includes(activeRun.status)) {
            updateIsTraining(false);
            updateRunId(null);
            setProgressData({ epoch: 0, total_epochs: 0, percent: 0 }); // Reset progress on finish
            showMessage(`Training finished with status: ${activeRun.status}`);
            return; // Exit the loop if training is done
          }
        }
      }

      // NEW: Fetch Progress Data
      if (currentRunId) {
        const progRes = await fetch(`${API_BASE_URL}/api/training-progress/${currentRunId}/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (progRes.ok) {
          const pData = await progRes.json();
          setProgressData(pData);
        }
      }

    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 3000);
};

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      
      const dsRes = await fetch(`${API_BASE_URL}/api/training-data/`, { 
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (dsRes.ok) {
        const dsData = await dsRes.json();
        setDatasets(dsData.datasets);
        // Only auto-select the first dataset if we don't already have one in cache
        if (dsData.datasets.length > 0 && !cachedSelectedDatasetId) {
            updateSelectedDatasetId(dsData.datasets[0].version_id);
        }
        if (dsData.base_output_dir) setBaseOutputDir(dsData.base_output_dir);
      }

      const devRes = await fetch(`${API_BASE_URL}/api/get-device/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevice(devData.device); 
      }
    } catch (e) { 
      console.error("Error fetching initial data:", e); 
    }
  };

  const generateRandomName = () => {
    updateRunName(`PCB_Train_${Math.floor(Math.random() * 9000) + 1000}`);
  };

  const toggleTraining = async () => {
    if (isTraining) {
      setConfirmModal({
        isOpen: true,
        title: "Abort Training?",
        message: "Are you sure you want to stop the current training process? This will terminate the GPU thread.",
        onConfirm: async () => {
          if (currentRunId) {
             try {
                const token = localStorage.getItem('token');
                await fetch(`${API_BASE_URL}/api/abort-training/`, {
                   method: 'POST',
                   headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                   body: JSON.stringify({ run_id: currentRunId })
                });
             } catch(e) {
                console.error("Failed to send abort signal");
             }
          }
          updateIsTraining(false);
          updateRunId(null);
          setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });
          showMessage("Abort signal deployed. Training terminated successfully.");
        }
      });
      return;
    }

    if (!selectedDatasetId) return showMessage("Select a dataset first.");
    if (!runName.trim()) return showMessage("Run name is required.");
    
    updateIsTraining(true);
    setProgressData({ epoch: 0, total_epochs: epochs, percent: 0 });
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/start-training/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dataset_id: selectedDatasetId, run_name: runName, model_arch: modelArch,
          epochs: parseInt(epochs), batch_size: parseInt(batchSize), img_size: parseInt(imgSize),
          learning_rate: parseFloat(learningRate), patience: parseInt(patience),
          weight_decay: parseFloat(weightDecay), mosaic: parseFloat(mosaic),
          mixup: parseFloat(mixup), warmup_epochs: parseFloat(warmupEpochs),
          degrees: parseFloat(degrees), device: device,
        })
      });
      
      const data = await response.json(); 
      if (!response.ok) {
        showMessage(`Backend Error: ${data.error || 'Failed to initialize pipeline.'}`);
        updateIsTraining(false);
      } else {
        updateRunId(data.run_id); 
      }
    } catch (error) { 
      showMessage("Network Error: Could not reach the Django server."); 
      updateIsTraining(false);
    }
  };

  const filteredDatasets = datasets.filter(ds => ds.version_name.toLowerCase().includes(searchQuery.toLowerCase()));
  const selectedDataset = datasets.find(ds => ds.version_id === selectedDatasetId);

  const modelOptions = [
    { value: 'yolov8n.pt', label: 'YOLOv8 Nano', subLabel: '(Fastest)', tag: 'NANO', tagBg: '#ECFDF5', tagColor: '#10B981' },
    { value: 'yolov8s.pt', label: 'YOLOv8 Small', subLabel: '', tag: 'SMALL', tagBg: '#EFF6FF', tagColor: '#3B82F6' },
    { value: 'yolov8m.pt', label: 'YOLOv8 Medium', subLabel: '', tag: 'MED', tagBg: '#FFFBEB', tagColor: '#F59E0B' },
    { value: 'yolov8l.pt', label: 'YOLOv8 Large', subLabel: '(Most Accurate)', tag: 'LARGE', tagBg: '#FEF2F2', tagColor: '#EF4444' },
  ];
  const selectedModelObj = modelOptions.find(m => m.value === modelArch);

  return (
    <div className="tp-wrapper">
      <style dangerouslySetInnerHTML={{__html: `
        .tp-wrapper { width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px; }
        @keyframes tpSlideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes tpFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes tpPulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        @keyframes dropdownSlideDown { from { opacity: 0; transform: scaleY(0.95) translateY(-10px); } to { opacity: 1; transform: scaleY(1) translateY(0); } }

        .tp-stagger-1 { animation: tpSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.1s; opacity: 0; }
        .tp-stagger-2 { animation: tpSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.2s; opacity: 0; }
        .tp-stagger-3 { animation: tpSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards 0.3s; opacity: 0; }

        .tp-card { background: #FFFFFF; border-radius: 20px; padding: 32px; border: 1px solid #E2E8F0; box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.05); position: relative; overflow: hidden; transition: all 0.3s ease; }
        .tp-card:hover { border-color: #CBD5E1; box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.1); }
        
        .tp-card-header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border-radius: 20px; padding: 32px 40px; border: 1px solid #334155; display: flex; justify-content: space-between; alignItems: center; box-shadow: 0 15px 35px -10px rgba(15, 23, 42, 0.3); position: relative; overflow: hidden; }

        .tp-input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; font-size: 14.5px; font-weight: 600; transition: all 0.2s ease; box-sizing: border-box; outline: none; }
        .tp-input:focus:not(:disabled) { border-color: #10B981; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
        .tp-input:disabled { background-color: #F1F5F9; color: #94A3B8; cursor: not-allowed; }

        .custom-select-wrapper { position: relative; user-select: none; width: 100%; }
        .custom-select-header { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
        .custom-select-header:hover:not(.disabled) { border-color: #CBD5E1; }
        .custom-select-header.open { border-color: #10B981; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
        .custom-select-header.disabled { background-color: #F1F5F9; color: #94A3B8; cursor: not-allowed; border-color: #E2E8F0; }

        .custom-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); z-index: 50; overflow: hidden; transform-origin: top; animation: dropdownSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .custom-select-search { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; background: #F8FAFC; }
        .custom-select-search input { width: 100%; border: none; background: transparent; outline: none; font-size: 14px; margin-left: 10px; color: #0F172A; font-weight: 500; }
        .custom-select-search input::placeholder { color: #94A3B8; }
        
        .custom-select-list { max-height: 250px; overflow-y: auto; padding: 8px; }
        .custom-select-list::-webkit-scrollbar { width: 6px; }
        .custom-select-list::-webkit-scrollbar-track { background: transparent; }
        .custom-select-list::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        .custom-select-list::-webkit-scrollbar-thumb:hover { background: #94A3B8; }

        .custom-select-item { padding: 12px 14px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 500; color: #334155; transition: all 0.15s ease; }
        .custom-select-item:hover { background-color: #F1F5F9; color: #0F172A; }
        .custom-select-item.selected { background-color: #ECFDF5; color: #059669; font-weight: 700; }

        .path-tooltip-wrapper { position: relative; display: block; }
        .path-tooltip { visibility: hidden; opacity: 0; position: absolute; bottom: calc(100% + 8px); left: 0; background: #0F172A; color: #FFFFFF; padding: 8px 14px; border-radius: 8px; font-size: 12.5px; font-weight: 600; white-space: nowrap; z-index: 100; transition: all 0.2s ease; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.4); pointer-events: none; border: 1px solid #334155; transform: translateY(4px); }
        .path-tooltip::after { content: ''; position: absolute; top: 100%; left: 24px; border-width: 6px; border-style: solid; border-color: #334155 transparent transparent transparent; }
        .path-tooltip-wrapper:hover .path-tooltip { visibility: visible; opacity: 1; transform: translateY(0); }

        .custom-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: tpFadeIn 0.2s ease-out forwards; }
        .custom-modal-box { background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border: 1px solid #334155; border-radius: 20px; padding: 24px 28px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: translateY(20px); animation: tpSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; gap: 16px; }
        .custom-modal-text { color: #E2E8F0; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500; }
        .custom-modal-btn { background: #3B82F6; color: #FFFFFF; border: none; border-radius: 10px; padding: 10px 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; align-self: flex-end; }
        .custom-modal-btn:hover { background: #2563EB; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }

        @keyframes btnShimmer { 0% { transform: translateX(-150%) skewX(-25deg); } 100% { transform: translateX(250%) skewX(-25deg); } }
        @keyframes warningStripes { 0% { background-position: 0 0; } 100% { background-position: 56px 0; } }

        .tp-main-btn { position: relative; padding: 10px 20px; border-radius: 10px; font-weight: 700; font-size: 14px; display: flex; align-items: center; gap: 8px; cursor: pointer; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); border: 1px solid transparent; letter-spacing: 0.5px; overflow: hidden; text-transform: uppercase; z-index: 1; }
        .tp-main-btn svg { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }

        .tp-main-btn-ready { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; border-color: rgba(255,255,255,0.2); animation: tpPulseGreen 3s infinite; }
        .tp-main-btn-ready::before { content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 30%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent); z-index: -1; animation: btnShimmer 3s infinite cubic-bezier(0.4, 0, 0.2, 1); }
        .tp-main-btn-ready:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 15px 35px -10px rgba(16, 185, 129, 0.8); border-color: rgba(255,255,255,0.6); }
        .tp-main-btn-ready:hover svg { transform: translateX(4px) scale(1.1); }

        .tp-main-btn-active { background: repeating-linear-gradient(-45deg, #EF4444, #EF4444 14px, #DC2626 14px, #DC2626 28px); background-size: 56px 56px; color: white; border-color: #991B1B; animation: warningStripes 1.5s linear infinite, tpPulseRed 1.5s infinite; box-shadow: 0 8px 25px -8px rgba(239, 68, 68, 0.7); }
        .tp-main-btn-active:hover { transform: scale(1.03) translateY(-2px); filter: brightness(1.1); }
        .tp-main-btn-active:hover svg { transform: scale(0.85); }

        .tp-main-btn-disabled { background: #1E293B; color: #64748B; border-color: #334155; cursor: not-allowed; box-shadow: none; }
        .tp-main-btn-disabled::before { display: none; }

        .tp-locked-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.4); backdrop-filter: blur(2px); z-index: 10; display: flex; align-items: center; justify-content: center; border-radius: 20px; animation: tpFadeIn 0.3s ease; pointer-events: none; }
      `}} />

      {/* --- CUSTOM ALERT MODAL COMPONENT --- */}
      {customAlert.isOpen && createPortal(
        <div className="custom-modal-overlay">
          <div className="custom-modal-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '10px', color: '#3B82F6' }}>
                  <Bell size={22} />
                </div>
               <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>System Message</h3>
            </div>
            <p className="custom-modal-text">{customAlert.message}</p>
            <button className="custom-modal-btn" onClick={() => setCustomAlert({ isOpen: false, message: '' })}>
              Acknowledge
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* --- CUSTOM CONFIRM MODAL FOR ABORT (PORTAL) --- */}
      {confirmModal.isOpen && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'tpFadeIn 0.3s ease-out forwards' }}
            ></div>
            
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'tpSlideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <div style={{ 
                        position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)',
                        width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{
                            width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backgroundColor: '#FEF2F2', color: '#EF4444', animation: 'tpPulseRed 2s infinite'
                        }}>
                            <Square size={28} fill="currentColor" />
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '12px' }}>
                        <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>{confirmModal.title}</h2>
                        <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>
                            {confirmModal.message}
                        </p>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button 
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={confirmModal.onConfirm}
                            style={{ 
                                flex: 1, padding: '14px', borderRadius: '12px', 
                                background: 'linear-gradient(135deg, #EF4444, #DC2626)', 
                                color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s', 
                                boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' 
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}
                        >
                            Abort Sequence
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* --- HERO HEADER --- */}
      <div className="tp-card-header tp-stagger-1">
        <div style={{ position: 'absolute', top: '-100px', right: '-50px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', bottom: '-100px', right: '200px', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)', borderRadius: '50%' }}></div>

        <div style={{ position: 'relative', zIndex: 1, flex: 1, marginRight: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <Activity color="#38BDF8" size={28} /> 
            </div>
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '800', color: '#FFFFFF', letterSpacing: '-0.5px' }}>
              Training Pipeline
            </h1>
            {isTraining && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '6px 12px', borderRadius: '20px', color: '#34D399', fontSize: '12px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10B981', animation: 'tpPulseRed 1.5s infinite alternate' }} />
                ACTIVE THREAD
              </span>
            )}
          </div>
          <p style={{ margin: 0, color: '#94A3B8', fontSize: '15px' }}>Configure hyperparameters and initialize asynchronous YOLOv8 training.</p>

          {/* --- NEW: REAL-TIME PROGRESS BAR --- */}
          {isTraining && (
            <div style={{ marginTop: '24px', background: 'rgba(15, 23, 42, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(51, 65, 85, 0.8)', maxWidth: '500px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>
                <span style={{ color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '6px' }}><Timer size={14} /> EPOCH PROGRESS</span>
                <span style={{ color: '#10B981' }}>{progressData.epoch} / {progressData.total_epochs} ({progressData.percent}%)</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#1E293B', borderRadius: '4px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)' }}>
                <div style={{ 
                  width: `${progressData.percent}%`, 
                  height: '100%', 
                  background: 'linear-gradient(90deg, #059669, #34D399)', 
                  borderRadius: '4px',
                  transition: 'width 0.5s ease-in-out',
                  boxShadow: '0 0 10px rgba(16, 185, 129, 0.5)'
                }} />
              </div>
            </div>
          )}
        </div>

        <button 
          className={`tp-main-btn ${isTraining ? 'tp-main-btn-active' : datasets.length === 0 ? 'tp-main-btn-disabled' : 'tp-main-btn-ready'}`}
          onClick={toggleTraining} 
          disabled={!isTraining && datasets.length === 0}
          style={{ alignSelf: isTraining ? 'flex-start' : 'center' }} // Keeps button aligned nicely when progress bar pushes container height
        >
          {isTraining ? <Square size={18} fill="#FFF" /> : <Play size={18} fill="#FFF" />}
          {isTraining ? 'ABORT SEQUENCE' : 'INITIALIZE ENGINE'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', width: '100%', flexWrap: 'nowrap' }}>
        
        {/* --- LEFT COLUMN: CORE CONFIG --- */}
        <div className="tp-card tp-stagger-2" style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
          {isTraining && <div className="tp-locked-overlay"></div>}
          
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 8px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: '#F1F5F9', borderRadius: '8px', color: '#475569' }}><Settings2 size={18} /></div>
            Core Configuration
          </h2>

          {/* TARGET DATASET DROPDOWN */}
          <InputWrapper label="Target Dataset" icon={Database} isLocked={isTraining}>
            <div className="custom-select-wrapper" ref={dropdownRef}>
              <div 
                className={`custom-select-header ${isDropdownOpen ? 'open' : ''} ${isTraining ? 'disabled' : ''}`}
                onClick={() => !isTraining && setIsDropdownOpen(!isDropdownOpen)}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedDataset ? `${selectedDataset.version_name} (${selectedDataset.total_images} imgs)` : 'Select a dataset...'}
                </span>
                <ChevronDown size={18} color="#64748B" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
              </div>
              
              {isDropdownOpen && (
                <div className="custom-select-dropdown">
                  <div className="custom-select-search">
                    <Search size={16} color="#94A3B8" />
                    <input 
                      type="text" 
                      placeholder="Search datasets..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="custom-select-list">
                    {filteredDatasets.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: '500' }}>
                        No datasets found for "{searchQuery}"
                      </div>
                    ) : (
                      filteredDatasets.map(ds => (
                        <div 
                          key={ds.version_id} 
                          className={`custom-select-item ${ds.version_id === selectedDatasetId ? 'selected' : ''}`}
                          onClick={() => {
                            updateSelectedDatasetId(ds.version_id);
                            setIsDropdownOpen(false);
                            setSearchQuery('');
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {ds.version_name} 
                            <span style={{ color: ds.version_id === selectedDatasetId ? '#10B981' : '#94A3B8', fontSize: '12.5px', marginLeft: '6px' }}>
                              ({ds.total_images} imgs)
                            </span>
                          </span>
                          {ds.version_id === selectedDatasetId && <Check size={16} color="#10B981" />}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </InputWrapper>

          {/* MODEL ARCHITECTURE DROPDOWN */}
          <InputWrapper label="Model Architecture" icon={Layers} isLocked={isTraining}>
            <div className="custom-select-wrapper" ref={modelDropdownRef}>
              <div 
                className={`custom-select-header ${isModelDropdownOpen ? 'open' : ''} ${isTraining ? 'disabled' : ''}`}
                onClick={() => !isTraining && setIsModelDropdownOpen(!isModelDropdownOpen)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ background: selectedModelObj.tagBg, color: selectedModelObj.tagColor, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px' }}>
                    {selectedModelObj.tag}
                  </span>
                  <span style={{ fontWeight: '600', color: '#0F172A' }}>
                    {selectedModelObj.label} <span style={{ color: '#94A3B8', fontWeight: '500' }}>{selectedModelObj.subLabel}</span>
                  </span>
                </div>
                <ChevronDown size={18} color="#64748B" style={{ transform: isModelDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
              </div>
              
              {isModelDropdownOpen && (
                <div className="custom-select-dropdown">
                  <div className="custom-select-list">
                    {modelOptions.map(option => (
                      <div 
                        key={option.value} 
                        className={`custom-select-item ${option.value === modelArch ? 'selected' : ''}`}
                        onClick={() => {
                          updateModelArch(option.value);
                          setIsModelDropdownOpen(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ background: option.tagBg, color: option.tagColor, padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px', width: '48px', textAlign: 'center' }}>
                            {option.tag}
                          </span>
                          <span>
                            {option.label} <span style={{ color: '#94A3B8', fontSize: '12.5px', marginLeft: '4px' }}>{option.subLabel}</span>
                          </span>
                        </div>
                        {option.value === modelArch && <Check size={16} color="#10B981" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </InputWrapper>

          <InputWrapper label="Execution Run Name" icon={Activity} isLocked={isTraining}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input type="text" className="tp-input" value={runName} onChange={e => updateRunName(e.target.value)} placeholder="e.g. PCB_Detect_V1" disabled={isTraining} />
              <button 
                onClick={generateRandomName} 
                disabled={isTraining} 
                style={{ padding: '0 18px', background: '#F1F5F9', border: '2px solid #E2E8F0', borderRadius: '12px', cursor: isTraining ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', color: '#475569', transition: 'all 0.2s' }} 
                onMouseOver={e => { if(!isTraining) { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.borderColor = '#CBD5E1'; }}} 
                onMouseOut={e => { if(!isTraining) { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.borderColor = '#E2E8F0'; }}}
                title="Generate Random Name"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </InputWrapper>

          {/* Locked Optimizer Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
             <div style={{ background: '#FFFFFF', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0', color: '#3B82F6', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}><Dna size={22} /></div>
             <div style={{ flex: 1 }}>
               <p style={{ margin: 0, fontWeight: '800', color: '#0F172A', fontSize: '14px' }}>Optimizer Strategy</p>
               <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748B' }}>System dynamically locked for stability.</p>
             </div>
             <span style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', padding: '6px 14px', borderRadius: '8px', fontWeight: '800', fontSize: '13px', color: '#0284C7', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14}/> AdamW</span>
          </div>

          <div style={{ marginTop: 'auto' }}>
            <InputWrapper label="Target Output Directory" icon={HardDrive} isLocked={isTraining}>
              <div className="path-tooltip-wrapper">
                <HardDrive size={18} color="#94A3B8" style={{ position: 'absolute', top: '15px', left: '16px', zIndex: 2 }} />
                <input type="text" className="tp-input" value={`${baseOutputDir}/${runName}`} readOnly style={{ paddingLeft: '44px', color: '#94A3B8', cursor: 'not-allowed', backgroundColor: '#F1F5F9' }} />
                {/* The Custom Tooltip */}
                <div className="path-tooltip">
                  {baseOutputDir}/{runName}
                </div>
              </div>
            </InputWrapper>
          </div>
        </div>

        {/* --- RIGHT COLUMN: HYPERPARAMETERS --- */}
        <div className="tp-card tp-stagger-3" style={{ flex: '1.8 1 450px', display: 'flex', flexDirection: 'column', gap: '32px', minWidth: 0 }}>
          {isTraining && <div className="tp-locked-overlay"></div>}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: '#F1F5F9', borderRadius: '8px', color: '#475569' }}><Sliders size={18} /></div>
              Hyperparameter Tuning
            </h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: device === 'GPU' ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${device === 'GPU' ? '#A7F3D0' : '#E2E8F0'}`, padding: '6px 14px', borderRadius: '20px' }}>
              <Cpu size={16} color={device === 'GPU' ? '#10B981' : '#64748B'} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: device === 'GPU' ? '#059669' : '#475569', letterSpacing: '0.5px' }}>
                {device === 'Loading...' ? 'DETECTING...' : `SERVER COMPUTE: ${device}`}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
            <InputWrapper label="Epochs" icon={Timer} isLocked={isTraining}>
              <input type="number" className="tp-input" value={epochs} onChange={e => updateEpochs(e.target.value)} disabled={isTraining} />
            </InputWrapper>
            
            <InputWrapper label="Batch Size" icon={Layers} isLocked={isTraining}>
              <input type="number" className="tp-input" min="1" value={batchSize} onChange={e => updateBatchSize(e.target.value === '' ? '' : parseInt(e.target.value))} disabled={isTraining} />
            </InputWrapper>
            
            <InputWrapper label="Image Size (px)" icon={ImageIcon} isLocked={isTraining}>
              <input type="number" className="tp-input" value={imgSize} onChange={e => updateImgSize(e.target.value)} step="32" disabled={isTraining} />
            </InputWrapper>
          </div>

          <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '0 -8px' }}></div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
            <InputWrapper label="Learning Rate" icon={Zap} isLocked={isTraining}>
              <input type="number" className="tp-input" value={learningRate} onChange={e => updateLearningRate(e.target.value)} step="0.001" disabled={isTraining} />
            </InputWrapper>
            
            <InputWrapper label="Patience" icon={Activity} isLocked={isTraining}>
              <input type="number" className="tp-input" value={patience} onChange={e => updatePatience(e.target.value)} disabled={isTraining} />
            </InputWrapper>
            
            <InputWrapper label="Weight Decay" icon={Network} isLocked={isTraining}>
              <input type="number" className="tp-input" value={weightDecay} onChange={e => updateWeightDecay(e.target.value)} step="0.0001" disabled={isTraining} />
            </InputWrapper>
          </div>

          <div style={{ height: '1px', backgroundColor: '#F1F5F9', margin: '0 -8px' }}></div>

          <div>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Lightbulb size={14} color="#F59E0B" /> Augmentation Parameters
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '24px' }}>
              <InputWrapper label="Mosaic" icon={Layers} isLocked={isTraining}>
                <input type="number" className="tp-input" step="0.1" value={mosaic} onChange={e => {
                  const val = parseFloat(e.target.value);
                  updateMosaic(e.target.value === "" ? "" : Math.min(Math.max(val, 0), 1));
                }} disabled={isTraining} />
              </InputWrapper>
              
              <InputWrapper label="Mixup" icon={Network} isLocked={isTraining}>
                <input type="number" className="tp-input" step="0.1" value={mixup} onChange={e => {
                  const val = parseFloat(e.target.value);
                  updateMixup(e.target.value === "" ? "" : Math.min(Math.max(val, 0), 1));
                }} disabled={isTraining} />
              </InputWrapper>
              
              <InputWrapper label="Warmup Epochs" icon={Flame} isLocked={isTraining}>
                <input type="number" className="tp-input" step="0.1" min="0" value={warmupEpochs} onChange={e => updateWarmupEpochs(e.target.value === "" ? "" : parseFloat(e.target.value))} disabled={isTraining} />
              </InputWrapper>
              
              <InputWrapper label="Degrees (Rotation)" icon={RotateCw} isLocked={isTraining}>
                <input type="number" className="tp-input" step="1" value={degrees} onChange={e => updateDegrees(e.target.value)} disabled={isTraining} />
              </InputWrapper>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default TrainingPipeline;