import React, { useState, useEffect, useRef } from 'react';
import { Database, FolderGit2, CheckCircle2, AlertCircle, RefreshCw, UploadCloud, Archive, Folder, Layers, Sparkles, Settings, SlidersHorizontal, HardDrive, ChevronDown, Check, Search } from 'lucide-react';
import { API_BASE_URL } from '../config';

export const datasetCache = {
  versionName: '',
  uploadVersionName: '',
  trainSplit: 80,
  mergeBase: true,
  activeTab: 'compile',
  selectedBaseDataset: ''
};

const Datasets = () => {
  const [versionName, setVersionName] = useState(datasetCache.versionName || `Dataset_V${Math.floor(Math.random() * 1000)}`);
  const [uploadVersionName, setUploadVersionName] = useState(datasetCache.uploadVersionName || `Local_Upload_${Math.floor(Math.random() * 1000)}`);
  const [trainSplit, setTrainSplit] = useState(datasetCache.trainSplit);
  const [mergeBase, setMergeBase] = useState(datasetCache.mergeBase);
  const [activeTab, setActiveTab] = useState(datasetCache.activeTab || 'compile');
  const [selectedBaseDataset, setSelectedBaseDataset] = useState(datasetCache.selectedBaseDataset || '');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [datasetSearchQuery, setDatasetSearchQuery] = useState('');
  const dropdownRef = useRef(null);

  const [isCompiling, setIsCompiling] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState(null);
  
  const [uploadMode, setUploadMode] = useState('zip'); 
  const [selectedFile, setSelectedFile] = useState(null); 
  const [uploadSplit, setUploadSplit] = useState(80);
  const [fileCount, setFileCount] = useState(0);

  const [uncompiledCount, setUncompiledCount] = useState(0);
  const [historicalDatasets, setHistoricalDatasets] = useState([]);

  const UPLOAD_LIMIT = 2000; 
  const isLimitExceeded = uploadMode === 'folder' && fileCount > UPLOAD_LIMIT;

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    datasetCache.versionName = versionName;
    datasetCache.uploadVersionName = uploadVersionName;
    datasetCache.trainSplit = trainSplit;
    datasetCache.mergeBase = mergeBase;
    datasetCache.activeTab = activeTab;
    datasetCache.selectedBaseDataset = selectedBaseDataset;
  }, [versionName, uploadVersionName, trainSplit, mergeBase, activeTab, selectedBaseDataset]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsSyncing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/training-data/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setUncompiledCount(data.uncompiled_count);
        setHistoricalDatasets(data.datasets || []);
      }
    } catch (error) {
      console.error("Fetch stats failed");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCompile = async () => {
    if (!versionName.trim()) return setToast({ type: 'error', message: 'Version Name required' });
    if (mergeBase && !selectedBaseDataset) return setToast({ type: 'error', message: 'Please select a base dataset to merge with' });
    
    setIsCompiling(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/compile-dataset/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          version_name: versionName, 
          train_split: trainSplit, 
          merge_base: mergeBase,
          base_version_name: mergeBase ? selectedBaseDataset : null 
        })
      });
      
      const data = await response.json();
      if (response.ok) {
        setToast({ type: 'success', message: data.message });
        setUncompiledCount(0);
        const newName = `Dataset_V${Math.floor(Math.random() * 1000)}`;
        setVersionName(newName);
        datasetCache.versionName = newName;
        fetchStats();
      } else {
        setToast({ type: 'error', message: data.error });
      }
    } catch (error) {
      setToast({ type: 'error', message: "Network Error" });
    }
    setIsCompiling(false);
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpload = async () => {
    if (!uploadVersionName.trim()) return setToast({ type: 'error', message: 'Dataset Batch Name required' });
    if (!selectedFile) return setToast({ type: 'error', message: 'Please select a file or folder' });

    // --- FRONTEND VALIDATION ---
    // If it's a folder, we can instantly check if images/ and labels/ exist.
    if (uploadMode === 'folder') {
      const filesArray = Array.from(selectedFile);
      const hasImages = filesArray.some(f => f.webkitRelativePath.toLowerCase().includes('/images/') || f.webkitRelativePath.toLowerCase().startsWith('images/'));
      const hasLabels = filesArray.some(f => f.webkitRelativePath.toLowerCase().includes('/labels/') || f.webkitRelativePath.toLowerCase().startsWith('labels/'));
      
      if (!hasImages || !hasLabels) {
        setToast({ type: 'error', message: 'Invalid format: Must contain "images" and "labels" folders.' });
        setTimeout(() => setToast(null), 4000); // Start the timer to hide the toast
        return; // Stop the upload process
      }
    }

    setIsUploading(true);
    
    const formData = new FormData();
    formData.append('version_name', uploadVersionName);
    formData.append('upload_mode', uploadMode);
    formData.append('train_split', uploadSplit);

    if (uploadMode === 'zip') {
      formData.append('zip_file', selectedFile);
    } else {
      Array.from(selectedFile).forEach((file) => {
        formData.append('files', file);
        formData.append('paths', file.webkitRelativePath);
      });
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/upload-local-dataset/`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await response.json();
      if (response.ok) {
        setToast({ type: 'success', message: data.message });
        setSelectedFile(null); 
        setFileCount(0);
        
        const newUploadName = `Local_Upload_${Math.floor(Math.random() * 1000)}`;
        setUploadVersionName(newUploadName);
        datasetCache.uploadVersionName = newUploadName;
        
        fetchStats(); 
      } else {
        setToast({ type: 'error', message: data.error || 'Upload failed due to incorrect format.' });
      }
    } catch (error) {
      setToast({ type: 'error', message: "Upload failed. Check server." });
    }
    setIsUploading(false);
    setTimeout(() => setToast(null), 4000);
  };

  const cardStyle = {
    background: '#FFF',
    padding: '32px',
    borderRadius: '16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    border: '1px solid #F1F5F9'
  };

  return (
    <div className="animate-fade-in" style={{ width: '100%', boxSizing: 'border-box' }}>
      
      {toast && (
        <div style={{ position: 'fixed', top: '40px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 24px', backgroundColor: '#FFF', borderRadius: '16px', border: `1px solid ${toast.type === 'success' ? '#10B981' : '#EF4444'}`, boxShadow: '0 20px 40px rgba(0,0,0,0.1)', animation: 'slide-down 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {toast.type === 'success' ? <CheckCircle2 color="#10B981" size={24} /> : <AlertCircle color="#EF4444" size={24} />}
          <span style={{ fontWeight: '600', fontSize: '15px', color: '#0F172A' }}>{toast.message}</span>
        </div>
      )}

      <div style={{ ...cardStyle, marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '24px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers color={activeTab === 'compile' ? "#10B981" : "#3B82F6"} size={26} style={{ transition: 'color 0.3s' }} /> 
            Dataset Management
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14px' }}>Compile active learning annotations or import local YOLO datasets.</p>
        </div>

        <div style={{ position: 'relative', display: 'inline-flex', background: '#F1F5F9', padding: '4px', borderRadius: '16px', gap: '4px', height: '52px', width: '320px' }}>
          <div style={{
            position: 'absolute',
            top: '4px',
            left: activeTab === 'compile' ? '4px' : 'calc(50% + 2px)',
            width: 'calc(50% - 6px)',
            height: 'calc(100% - 8px)',
            backgroundColor: activeTab === 'compile' ? '#10B981' : '#3B82F6',
            borderRadius: '12px',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }} />

          <button onClick={() => setActiveTab('compile')} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '700', color: activeTab === 'compile' ? '#FFF' : '#64748B', cursor: 'pointer', padding: '0 16px', borderRadius: '12px', zIndex: 2, transition: 'color 0.3s' }}>
            <Database size={16} /> Compile
          </button>
          
          <button onClick={() => setActiveTab('upload')} style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'transparent', border: 'none', fontSize: '13px', fontWeight: '700', color: activeTab === 'upload' ? '#FFF' : '#64748B', cursor: 'pointer', padding: '0 16px', borderRadius: '12px', zIndex: 2, transition: 'color 0.3s' }}>
            <Archive size={16} /> Upload
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'stretch', width: '100%', animation: 'fade-in 0.4s ease' }}>
        
        {activeTab === 'compile' && (
          <>
            <div style={{ flex: 1.5, ...cardStyle, animation: 'slide-up 0.4s ease' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                <HardDrive color="#94A3B8" size={20} /> Source Data Integration
              </h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '24px', backgroundColor: uncompiledCount > 0 ? '#F0FDF4' : '#F8FAFC', borderRadius: '16px', border: `2px dashed ${uncompiledCount > 0 ? '#10B981' : '#E2E8F0'}`, marginBottom: '32px', transition: 'all 0.3s', animation: uncompiledCount > 0 ? 'pulse-soft 2s infinite' : 'none' }}>
                <div style={{ padding: '14px', background: uncompiledCount > 0 ? '#D1FAE5' : '#E2E8F0', borderRadius: '14px' }}>
                  <FolderGit2 size={32} color={uncompiledCount > 0 ? "#10B981" : "#94A3B8"} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '800', color: '#0F172A', fontSize: '18px' }}>{uncompiledCount} Pending Annotations</p>
                  <p style={{ margin: 0, fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Images from the database ready to be packaged.</p>
                </div>
                <button onClick={fetchStats} disabled={isSyncing} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF', border: '1px solid #E2E8F0', padding: '10px 16px', borderRadius: '10px', cursor: isSyncing ? 'not-allowed' : 'pointer', color: '#64748B', fontWeight: '600', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.02)', opacity: isSyncing ? 0.5 : 1 }}>
                  <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} /> 
                  {isSyncing ? 'Syncing...' : 'Sync'}
                </button>
              </div>

              <div style={{ backgroundColor: '#FFF', borderRadius: '16px', border: '2px solid #E2E8F0', transition: 'border-color 0.3s' }} onMouseOver={(e) => e.currentTarget.style.borderColor = mergeBase ? '#10B981' : '#CBD5E1'} onMouseOut={(e) => e.currentTarget.style.borderColor = '#E2E8F0'}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '24px' }}>
                  <input type="checkbox" id="mergeCheck" checked={mergeBase} onChange={(e) => setMergeBase(e.target.checked)} style={{ width: '22px', height: '22px', accentColor: '#10B981', cursor: 'pointer' }} />
                  <label htmlFor="mergeCheck" style={{ cursor: 'pointer', flex: 1 }}>
                    <p style={{ margin: 0, fontWeight: '800', color: '#0F172A', fontSize: '16px' }}>Merge with Base Knowledge</p>
                    <p style={{ margin: 0, fontSize: '14px', color: '#64748B', marginTop: '4px' }}>Combine new annotations with a historical dataset.</p>
                  </label>
                </div>
                
                {mergeBase && (
                <div style={{ padding: '0 24px 24px 62px', borderTop: '1px solid #E2E8F0', marginTop: '4px', paddingTop: '20px', animation: 'reveal-down 0.3s ease-out forwards' }}>
                    <label style={{ display: 'block', fontWeight: '800', fontSize: '11px', color: '#475569', marginBottom: '10px', letterSpacing: '0.5px' }}>SELECT BASE DATASET</label>
                    
                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                      <div onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: `2px solid ${isDropdownOpen ? '#10B981' : '#CBD5E1'}`, backgroundColor: isDropdownOpen ? '#FFF' : '#F8FAFC', cursor: 'pointer', transition: 'all 0.2s ease', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 41, outline: 'none' }}>
                        <span style={{ fontSize: '14px', fontWeight: '600', color: selectedBaseDataset ? '#0F172A' : '#94A3B8' }}>
                          {selectedBaseDataset ? `${selectedBaseDataset} (${historicalDatasets.find(d => d.version_name === selectedBaseDataset)?.total_images || 0} images)` : '-- Choose a historical dataset to merge --'}
                        </span>
                        <ChevronDown size={18} color={isDropdownOpen ? '#10B981' : '#64748B'} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                      </div>

                      {isDropdownOpen && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, backgroundColor: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', overflow: 'hidden', zIndex: 50, animation: 'dropdown-pop 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards', transformOrigin: 'top center', maxHeight: '280px', display: 'flex', flexDirection: 'column' }}>
                          
                          <div style={{ padding: '10px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#FFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '8px 12px', transition: 'border-color 0.2s' }}>
                              <Search size={16} color="#94A3B8" style={{ marginRight: '8px' }} />
                              <input type="text" placeholder="Search datasets..." value={datasetSearchQuery} onChange={(e) => setDatasetSearchQuery(e.target.value)} onClick={(e) => e.stopPropagation()} autoFocus style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#0F172A', background: 'transparent' }} />
                            </div>
                          </div>

                          <div style={{ overflowY: 'auto', maxHeight: '200px' }}>
                            {historicalDatasets.filter(ds => ds.version_name.toLowerCase().includes(datasetSearchQuery.toLowerCase())).length === 0 ? (
                              <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: '14px', fontWeight: '500' }}>No datasets found</div>
                            ) : (
                              historicalDatasets
                                .filter(ds => ds.version_name.toLowerCase().includes(datasetSearchQuery.toLowerCase()))
                                .map((ds, idx, arr) => {
                                  const isSelected = selectedBaseDataset === ds.version_name;
                                  return (
                                    <div key={idx} onClick={() => { setSelectedBaseDataset(ds.version_name); setIsDropdownOpen(false); setDatasetSearchQuery(''); }} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'background-color 0.15s ease', backgroundColor: isSelected ? '#F0FDF4' : 'transparent', borderBottom: idx < arr.length - 1 ? '1px solid #F1F5F9' : 'none' }} onMouseOver={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = '#F8FAFC'; }} onMouseOut={(e) => { if(!isSelected) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                      <span style={{ fontSize: '14px', fontWeight: isSelected ? '700' : '500', color: isSelected ? '#10B981' : '#334155' }}>
                                        {ds.version_name} <span style={{ color: '#94A3B8', fontWeight: '400', fontSize: '13px', marginLeft: '4px' }}>({ds.total_images} images)</span>
                                      </span>
                                      {isSelected && <Check size={16} color="#10B981" />}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ flex: 1, ...cardStyle, animation: 'slide-up 0.5s ease', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                <Settings color="#94A3B8" size={20} /> Compile Parameters
              </h2>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontWeight: '800', fontSize: '12px', color: '#475569', marginBottom: '10px', letterSpacing: '0.5px' }}>DATASET BATCH NAME</label>
                <input type="text" value={versionName} onChange={(e) => setVersionName(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #E2E8F0', outline: 'none', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s', backgroundColor: '#F8FAFC' }} onFocus={(e) => { e.target.style.borderColor = '#10B981'; e.target.style.backgroundColor = '#FFF'; }} onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F8FAFC'; }} placeholder="e.g. Dataset_V1" />
              </div>

              <div style={{ marginBottom: '36px', backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '12px', color: '#475569', marginBottom: '16px', letterSpacing: '0.5px' }}>
                  <span>TRAIN / VAL SPLIT</span>
                  <span style={{ color: '#10B981', fontWeight: '800' }}>{trainSplit}% / {100 - trainSplit}%</span>
                </label>
                <input type="range" min="0" max="100" value={trainSplit} onChange={(e) => setTrainSplit(e.target.value)} style={{ width: '100%', height: '8px', borderRadius: '4px', accentColor: '#10B981', outline: 'none', cursor: 'pointer' }} />
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button onClick={handleCompile} disabled={isCompiling || (uncompiledCount === 0 && !mergeBase)} style={{ width: '100%', padding: '16px', background: isCompiling || (uncompiledCount === 0 && !mergeBase) ? '#E2E8F0' : '#10B981', color: isCompiling || (uncompiledCount === 0 && !mergeBase) ? '#94A3B8' : '#FFF', border: 'none', borderRadius: '12px', fontWeight: '800', cursor: isCompiling || (uncompiledCount === 0 && !mergeBase) ? 'not-allowed' : 'pointer', fontSize: '15px', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: isCompiling || (uncompiledCount === 0 && !mergeBase) ? 'none' : '0 10px 25px rgba(16, 185, 129, 0.3)' }} onMouseOver={(e) => { if (!isCompiling && (uncompiledCount > 0 || mergeBase)) e.currentTarget.style.transform = 'translateY(-3px)' }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}>
                  {isCompiling ? 'Generating Files...' : 'Compile YOLO Dataset'}
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'upload' && (
          <>
            <div style={{ flex: 1.5, ...cardStyle, animation: 'slide-up 0.4s ease' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                <Folder color="#94A3B8" size={20} /> Dataset File Upload
              </h2>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: '#F8FAFC', padding: '6px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                 <button onClick={() => setUploadMode('zip')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: 'none', background: uploadMode === 'zip' ? '#FFF' : 'transparent', color: uploadMode === 'zip' ? '#3B82F6' : '#64748B', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', boxShadow: uploadMode === 'zip' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                   <Archive size={18} /> Upload .ZIP Archive
                 </button>
                 <button onClick={() => setUploadMode('folder')} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: 'none', background: uploadMode === 'folder' ? '#FFF' : 'transparent', color: uploadMode === 'folder' ? '#3B82F6' : '#64748B', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s', boxShadow: uploadMode === 'folder' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>
                   <FolderGit2 size={18} /> Upload Local Folder
                 </button>
              </div>

              {uploadMode === 'zip' ? (
                  <input type="file" id="data-upload" accept=".zip" onChange={(e) => {
                      const file = e.target.files[0];
                      setSelectedFile(file);
                      setFileCount(file ? 1 : 0);
                  }} style={{ display: 'none' }} />
              ) : (
                  <input type="file" id="data-upload" webkitdirectory="" directory="" onChange={(e) => {
                      setSelectedFile(e.target.files);
                      setFileCount(e.target.files.length);
                  }} style={{ display: 'none' }} />
              )}
                      
              <label htmlFor="data-upload" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', padding: '40px 20px', border: `3px dashed ${selectedFile ? '#3B82F6' : '#CBD5E1'}`, borderRadius: '16px', cursor: 'pointer', backgroundColor: selectedFile ? '#EFF6FF' : '#F8FAFC', color: '#475569', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#EFF6FF'; e.currentTarget.style.borderColor = '#3B82F6'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = selectedFile ? '#EFF6FF' : '#F8FAFC'; e.currentTarget.style.borderColor = selectedFile ? '#3B82F6' : '#CBD5E1'; }}>
                {uploadMode === 'zip' ? <Archive size={56} color={selectedFile ? "#3B82F6" : "#94A3B8"} style={{ marginBottom: '20px', transition: 'all 0.3s', transform: selectedFile ? 'scale(1.1)' : 'scale(1)' }} /> : <Folder size={56} color={selectedFile ? "#3B82F6" : "#94A3B8"} style={{ marginBottom: '20px', transition: 'all 0.3s', transform: selectedFile ? 'scale(1.1)' : 'scale(1)' }} />}
                <span style={{ fontWeight: '800', fontSize: '18px', textAlign: 'center', wordBreak: 'break-all', color: selectedFile ? '#1D4ED8' : '#64748B' }}>
                  {selectedFile ? (uploadMode === 'zip' ? selectedFile.name : `${selectedFile.length} files successfully selected`) : `Click to browse and select a ${uploadMode === 'zip' ? '.zip archive' : 'local folder'}`}
                </span>
                {!selectedFile && (
                  <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '14px', marginTop: '12px', color: '#94A3B8', fontWeight: '500' }}>or drag and drop your files here</span>
                    <span style={{ fontSize: '12px', marginTop: '8px', color: '#EF4444', fontWeight: '600', backgroundColor: '#FEF2F2', padding: '4px 8px', borderRadius: '6px' }}>* Must contain 'images' and 'labels' folders</span>
                  </span>
                )}
              </label>
            </div>

            <div style={{ flex: 1, ...cardStyle, animation: 'slide-up 0.5s ease', display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>
                <SlidersHorizontal color="#94A3B8" size={20} /> Upload Parameters
              </h2>

              <div style={{ marginBottom: '28px' }}>
                <label style={{ display: 'block', fontWeight: '800', fontSize: '12px', color: '#475569', marginBottom: '10px', letterSpacing: '0.5px' }}>DATASET BATCH NAME</label>
                <input type="text" value={uploadVersionName} onChange={(e) => setUploadVersionName(e.target.value)} style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #E2E8F0', outline: 'none', fontSize: '14px', fontWeight: '600', boxSizing: 'border-box', transition: 'all 0.2s', backgroundColor: '#F8FAFC' }} onFocus={(e) => { e.target.style.borderColor = '#3B82F6'; e.target.style.backgroundColor = '#FFF'; }} onBlur={(e) => { e.target.style.borderColor = '#E2E8F0'; e.target.style.backgroundColor = '#F8FAFC'; }} placeholder="e.g. Upload_V1" />
              </div>

              <div style={{ marginBottom: '36px', backgroundColor: '#F8FAFC', padding: '20px', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '12px', color: '#475569', marginBottom: '16px', letterSpacing: '0.5px' }}>
                  <span>AUTO-SPLIT (TRAIN/VAL)</span>
                  <span style={{ color: '#3B82F6', fontWeight: '800' }}>{uploadSplit}% / {100 - uploadSplit}%</span>
                </label>
                <input 
                  type="range" min="0" max="100" value={uploadSplit} 
                  onChange={(e) => setUploadSplit(parseInt(e.target.value))} 
                  style={{ width: '100%', height: '8px', borderRadius: '4px', accentColor: '#3B82F6', outline: 'none', cursor: 'pointer' }} 
                />
              </div>

              <div style={{ marginTop: 'auto' }}>
                <button 
                  onClick={handleUpload} 
                  disabled={!selectedFile || isUploading || isLimitExceeded} 
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    background: (!selectedFile || isUploading || isLimitExceeded) ? '#E2E8F0' : '#3B82F6', 
                    color: (!selectedFile || isUploading || isLimitExceeded) ? '#94A3B8' : '#FFF', 
                    border: 'none', 
                    borderRadius: '12px', 
                    fontWeight: '800', 
                    cursor: (!selectedFile || isUploading || isLimitExceeded) ? 'not-allowed' : 'pointer',
                    fontSize: '15px',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: (!selectedFile || isUploading || isLimitExceeded) ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.3)'
                  }}
                  onMouseOver={(e) => { if (!(!selectedFile || isUploading || isLimitExceeded)) e.currentTarget.style.transform = 'translateY(-3px)' }} 
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  {isLimitExceeded ? `Too many files (Max ${UPLOAD_LIMIT})` : (isUploading ? 'Processing...' : 'Register Dataset')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes reveal-down {
          0% { opacity: 0; transform: translateY(-15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes dropdown-pop {
          0% { opacity: 0; transform: scaleY(0.95) translateY(-5px); }
          100% { opacity: 1; transform: scaleY(1) translateY(0); }
        }
        @keyframes slide-down {
          0% { opacity: 0; transform: translate(-50%, -30px); }
          100% { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes slide-up {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes pulse-soft {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `}</style>
    </div>
  );
};

export default Datasets;