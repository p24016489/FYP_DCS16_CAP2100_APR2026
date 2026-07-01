import React, { useState, useRef, useCallback, useEffect } from 'react';
import { UploadCloud, Play, CheckCircle2, FileStack, Cpu, FolderUp, ZoomIn, ZoomOut, Maximize, Edit3, Image as ImageIcon, FileText, AlertCircle, RefreshCw } from 'lucide-react';
import { API_BASE_URL } from '../config';

// Global cache to maintain state even when component unmounts
export const batchWorkspaceCache = {
  files: [],
  stats: { totalProcessed: 0, totalDefects: 0, cleanBoards: 0, defectiveBoards: 0, completed: false },
  processedImages: [],
  folderName: "Unknown Folder",
  progress: 0,
  defectBreakdown: {},
  activeIndex: null,
  isProcessing: false, 
  savedBatchId: null 
};

const BatchUpload = ({ onCorrect }) => {
  // Initialize state directly from the global cache
  const [files, setFiles] = useState(batchWorkspaceCache.files);
  const [isProcessing, setIsProcessing] = useState(batchWorkspaceCache.isProcessing);
  const [savedBatchId, setSavedBatchId] = useState(batchWorkspaceCache.savedBatchId); // <-- ADDED THIS
  const [progress, setProgress] = useState(batchWorkspaceCache.progress);
  const [folderName, setFolderName] = useState(batchWorkspaceCache.folderName);
  
  const [stats, setStats] = useState(batchWorkspaceCache.stats);
  const [defectBreakdown, setDefectBreakdown] = useState(batchWorkspaceCache.defectBreakdown);
  const [processedImages, setProcessedImages] = useState(batchWorkspaceCache.processedImages);
  const [activeIndex, setActiveIndex] = useState(batchWorkspaceCache.activeIndex);

  const [operatorInfo, setOperatorInfo] = useState({ name: 'System Admin', id: 'EMP-XXXXX' });

  // --- NEW: Reconnect to background processing if we leave and come back ---
  useEffect(() => {
    let syncInterval;
    if (batchWorkspaceCache.isProcessing) {
      setIsProcessing(true);
      // Poll the global cache every 500ms to update the UI while processing
      syncInterval = setInterval(() => {
        setProgress(batchWorkspaceCache.progress);
        setStats({ ...batchWorkspaceCache.stats });
        setDefectBreakdown({ ...batchWorkspaceCache.defectBreakdown });
        setProcessedImages([...batchWorkspaceCache.processedImages]);
        if (batchWorkspaceCache.activeIndex !== null) setActiveIndex(batchWorkspaceCache.activeIndex);

        // Stop polling if the background process finishes
        if (!batchWorkspaceCache.isProcessing) {
          setIsProcessing(false);
          clearInterval(syncInterval);
        }
      }, 500);
    }
    return () => clearInterval(syncInterval);
  }, []);

  useEffect(() => {
    const fetchOperatorDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        const savedUsername = localStorage.getItem('username');
        const response = await fetch(`${API_BASE_URL}/api/users/`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const users = await response.json();
          const currentUser = users.find(u => u.username === savedUsername);
          if (currentUser) {
            setOperatorInfo({ name: currentUser.username, id: currentUser.employee_id });
          }
        }
      } catch (error) {
        console.error("Could not fetch operator details for report:", error);
      }
    };
    fetchOperatorDetails();
  }, []);

  // Viewport State for the selected image
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageDims, setImageDims] = useState({ width: 0, height: 0 });
  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);

  // --- NEW: Reset Function to clear the pipeline for a new batch ---
  const handleReset = () => {
    setFiles([]);
    setFolderName("Unknown Folder");
    setStats({ totalProcessed: 0, totalDefects: 0, cleanBoards: 0, defectiveBoards: 0, completed: false });
    setDefectBreakdown({});
    setProcessedImages([]);
    setActiveIndex(null);
    setProgress(0);
    setIsProcessing(false);
    setSavedBatchId(null);

    batchWorkspaceCache.files = [];
    batchWorkspaceCache.folderName = "Unknown Folder";
    batchWorkspaceCache.stats = { totalProcessed: 0, totalDefects: 0, cleanBoards: 0, defectiveBoards: 0, completed: false };
    batchWorkspaceCache.defectBreakdown = {};
    batchWorkspaceCache.processedImages = [];
    batchWorkspaceCache.activeIndex = null;
    batchWorkspaceCache.progress = 0;
    batchWorkspaceCache.isProcessing = false;
    batchWorkspaceCache.savedBatchId = null;
    
    // Reset the file input so you can select the exact same folder again if needed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFolderSelect = (e) => {
    const selectedFiles = Array.from(e.target.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (selectedFiles.length > 0) {
      setFiles(selectedFiles);
      const pathParts = selectedFiles[0].webkitRelativePath.split('/');
      const newFolderName = pathParts.length > 1 ? pathParts[0] : 'Unknown Folder';
      setFolderName(newFolderName);
      
      // Reset local state
      const newStats = { totalProcessed: 0, totalDefects: 0, cleanBoards: 0, defectiveBoards: 0, completed: false };
      setStats(newStats);
      setDefectBreakdown({});
      setProcessedImages([]);
      setActiveIndex(null);
      setProgress(0);
      setIsProcessing(false);

      // Force reset global cache immediately
      batchWorkspaceCache.files = selectedFiles;
      batchWorkspaceCache.folderName = newFolderName;
      batchWorkspaceCache.stats = newStats;
      batchWorkspaceCache.defectBreakdown = {};
      batchWorkspaceCache.processedImages = [];
      batchWorkspaceCache.activeIndex = null;
      batchWorkspaceCache.progress = 0;
      batchWorkspaceCache.isProcessing = false;
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processBatch = async () => {
    if (batchWorkspaceCache.files.length === 0 || batchWorkspaceCache.isProcessing) return;
    
    setIsProcessing(true);
    batchWorkspaceCache.isProcessing = true; // Lock globally
    
    let currentStats = { ...batchWorkspaceCache.stats };
    let currentBreakdown = { ...batchWorkspaceCache.defectBreakdown };
    let currentGallery = [ ...batchWorkspaceCache.processedImages ];
    const token = localStorage.getItem('token');

    // Resume from where we left off based on totalProcessed
    const startIndex = currentStats.totalProcessed || 0;

    for (let i = startIndex; i < batchWorkspaceCache.files.length; i++) {
      // Safety check: break loop if user aborts
      if (!batchWorkspaceCache.isProcessing) break; 

      const currentFile = batchWorkspaceCache.files[i];
      const formData = new FormData();
      formData.append('image', currentFile);
      const previewUrl = URL.createObjectURL(currentFile);

      try {
        const response = await fetch(`${API_BASE_URL}/api/inspect/`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        if (response.ok) {
          const data = await response.json();
          const defectsFound = data.total_defects_found || 0;
          
          currentStats.totalProcessed += 1;
          currentStats.totalDefects += defectsFound;
          if (defectsFound > 0) currentStats.defectiveBoards += 1;
          else currentStats.cleanBoards += 1;

          if (data.defects) {
            data.defects.forEach(d => {
              currentBreakdown[d.label] = (currentBreakdown[d.label] || 0) + 1;
            });
          }

          currentGallery.push({
            file: currentFile,
            previewUrl: previewUrl,
            defects: data.defects || [],
            name: currentFile.name
          });

          if (currentGallery.length === 1) {
             batchWorkspaceCache.activeIndex = 0;
             setActiveIndex(0);
          }
        }
      } catch (error) {
        console.error(`Failed to process ${currentFile.name}`, error);
      }

      // 1. UPDATE GLOBAL CACHE DIRECTLY FIRST (Survives Unmounts)
      batchWorkspaceCache.progress = Math.round(((i + 1) / batchWorkspaceCache.files.length) * 100);
      batchWorkspaceCache.stats = { ...currentStats, completed: false };
      batchWorkspaceCache.defectBreakdown = { ...currentBreakdown };
      batchWorkspaceCache.processedImages = [...currentGallery];

      // 2. UPDATE LOCAL STATE (Updates UI if still on the page)
      setProgress(batchWorkspaceCache.progress);
      setStats({ ...currentStats, completed: false });
      setDefectBreakdown({ ...currentBreakdown });
      setProcessedImages([...currentGallery]);
    }

    // --- DATABASE SYNC WHEN COMPLETE ---
    if (batchWorkspaceCache.isProcessing && currentStats.totalProcessed === batchWorkspaceCache.files.length) {
        try {
            const summaryResponse = await fetch(`${API_BASE_URL}/api/save-batch-summary/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  folder_name: batchWorkspaceCache.folderName,
                  total_images: currentStats.totalProcessed,
                  total_defects: currentStats.totalDefects,
                  clean_boards: currentStats.cleanBoards,
                  defective_boards: currentStats.defectiveBoards,
                  defect_breakdown: currentBreakdown
                })
            });

            if (summaryResponse.ok) {
                const summaryData = await summaryResponse.json();
                // Capture the ID returned by Django
                const newBatchId = summaryData.batch_id || summaryData.id;
                setSavedBatchId(newBatchId);
                batchWorkspaceCache.savedBatchId = newBatchId;
            } else {
                console.error("Database Save Failed");
            }
        } catch (e) { 
            console.error("Network error logging batch summary:", e); 
        }

        batchWorkspaceCache.stats.completed = true;
        setStats(prev => ({ ...prev, completed: true }));
    }
    
    batchWorkspaceCache.isProcessing = false;
    setIsProcessing(false);
  };

  // --- REPORT GENERATOR ---
  const generatePDFReport = () => {
    const reportWindow = window.open('', '_blank');
    const date = new Date().toLocaleString();
    
    let tableRows = '';
    Object.entries(defectBreakdown).forEach(([label, count]) => {
      tableRows += `<tr><td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-transform: capitalize; color: #334155; font-weight: 600;">${label.replace('_', ' ')}</td><td style="padding: 12px; border-bottom: 1px solid #E2E8F0; text-align: right; font-weight: 800; color: #0F172A;">${count}</td></tr>`;
    });

    const html = `
      <html>
      <head>
        <title>Batch Inspection Report - ${folderName}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 40px; color: #0F172A; max-width: 800px; margin: 0 auto; }
          h1 { color: #0F172A; margin-bottom: 5px; font-size: 28px; font-weight: 800; }
          .header-meta { color: #64748B; font-size: 14px; margin-bottom: 30px; }
          .summary-box { display: flex; gap: 20px; margin: 30px 0; }
          .box { padding: 20px; border-radius: 12px; flex: 1; border: 1px solid #E2E8F0; }
          .box.danger { background: #FEF2F2; border-color: #FEE2E2; color: #DC2626; }
          .box.success { background: #F0FDF4; border-color: #DCFCE7; color: #15803D; }
          .box.warning { background: #FFFBEB; border-color: #FEF3C7; color: #B45309; }
          .box-title { font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
          .box-value { font-size: 36px; font-weight: 800; margin: 0; line-height: 1; }
          h2 { margin-top: 40px; font-size: 18px; color: #334155; border-bottom: 2px solid #E2E8F0; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { text-align: left; padding: 12px; background: #F8FAFC; border-bottom: 2px solid #CBD5E1; color: #475569; font-size: 13px; text-transform: uppercase; }
          .footer { margin-top: 50px; font-size: 12px; color: #94A3B8; text-align: center; font-style: italic; }
        </style>
      </head>
      <body>
        <h1>Optical Analysis Batch Report</h1>
        <div class="header-meta">
          <p style="margin: 4px 0;"><strong>Target Directory:</strong> /${folderName}</p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${date}</p>
          <p style="margin: 4px 0;"><strong>Operator:</strong> ${operatorInfo.name} (${operatorInfo.id})</p>
          <p style="margin: 4px 0;"><strong>Total Processed:</strong> ${stats.totalProcessed} Boards</p>
        </div>
        
        <div class="summary-box">
          <div class="box danger">
            <div class="box-title">Total Anomalies</div>
            <div class="box-value">${stats.totalDefects}</div>
          </div>
          <div class="box success">
            <div class="box-title">Clean Boards</div>
            <div class="box-value">${stats.cleanBoards}</div>
          </div>
          <div class="box warning">
            <div class="box-title">Defective Boards</div>
            <div class="box-value">${stats.defectiveBoards}</div>
          </div>
        </div>

        <h2>Defect Classification Distribution</h2>
        ${Object.keys(defectBreakdown).length > 0 ? `
          <table>
            <thead><tr><th>Classification Label</th><th style="text-align: right;">Total Occurrences</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
        ` : '<p style="color: #64748B;">No physical defects were detected during this run.</p>'}
        
        <div class="footer">AI-Based Electronics and PCB Defect Inspection and Analysis System</div>
        <script>
          window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `;
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  // --- VIEWPORT INTERACTIVITY LOGIC ---
  const handleImageLoad = (e) => {
    setImageDims({ width: e.target.naturalWidth, height: e.target.naturalHeight });
    resetViewport(e.target.naturalWidth, e.target.naturalHeight);
  };

  const resetViewport = (width = imageDims.width, height = imageDims.height) => {
    if (!viewportRef.current || !width) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const fitScale = Math.min(rect.width / width, rect.height / height) * 0.95; 
    const panX = (rect.width - (width * fitScale)) / 2;
    const panY = (rect.height - (height * fitScale)) / 2;
    setZoom(fitScale);
    setPan({ x: panX, y: panY });
  };

  const handleWheel = useCallback((e) => {
    if (activeIndex === null || !viewportRef.current) return;
    e.preventDefault(); 
    const scaleAdjust = e.deltaY < 0 ? 1.15 : 0.85; 
    const newZoom = Math.max(0.05, Math.min(zoom * scaleAdjust, 10)); 
    
    const rect = viewportRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoom);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [activeIndex, zoom, pan]);

  useEffect(() => {
    const wrapper = viewportRef.current;
    if (wrapper) wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (wrapper) wrapper.removeEventListener('wheel', handleWheel); };
  }, [handleWheel]);

  const activeImageData = activeIndex !== null ? processedImages[activeIndex] : null;

  return (
    <div className="animate-fade-in custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto', paddingRight: '8px', paddingBottom: '40px' }}>
      
      {/* CREATIVE CSS INJECTION FOR MICRO-ANIMATIONS */}
      <style>{`
        @keyframes float-icon {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        @keyframes progress-stripe {
          0% { background-position: 1rem 0; }
          100% { background-position: 0 0; }
        }
        @keyframes slide-right {
          from { opacity: 0; transform: translateX(-15px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-float-icon { animation: float-icon 4s ease-in-out infinite; }
        .animated-progress {
          background-image: linear-gradient(45deg, rgba(255,255,255,0.15) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.15) 75%, transparent 75%, transparent);
          background-size: 1rem 1rem;
          animation: progress-stripe 1s linear infinite;
        }
        .creative-card { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .creative-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.15); border-color: #CBD5E1 !important; }
        .gallery-item { transition: all 0.2s ease; }
        .gallery-item:hover { transform: translateX(6px); border-color: #3B82F6 !important; }
        .btn-creative { transition: all 0.2s ease; position: relative; overflow: hidden; }
        .btn-creative:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3); }
        .btn-creative:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      {/* Top Controls */}
      <div className="creative-card animate-slide-up" style={{ background: 'linear-gradient(120deg, #ffffff 0%, #f0f9ff 100%)', borderRadius: '16px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div className="animate-float-icon" style={{ width: '46px', height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderRadius: '14px', color: '#0EA5E9', boxShadow: '0 8px 16px rgba(14, 165, 233, 0.2)', flexShrink: 0, border: '1px solid #E0F2FE' }}>
              <FileStack size={24} style={{ display: 'block' }} />
            </div>
            <span style={{ background: 'linear-gradient(to right, #0F172A, #3B82F6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              High-Volume Batch Pipeline
            </span>

            {savedBatchId && (
              <span style={{ fontSize: '13px', backgroundColor: '#F0FDF4', color: '#10B981', padding: '4px 12px', borderRadius: '8px', border: '1px solid #DCFCE7', WebkitTextFillColor: 'initial' }}>
                Batch #{savedBatchId}
              </span>
            )}
          </h1>
          <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px', paddingLeft: '60px' }}>Automate YOLOv8 optical analysis across entire manufacturing directories.</p>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <input type="file" webkitdirectory="true" directory="true" multiple ref={fileInputRef} onChange={handleFolderSelect} style={{ display: 'none' }} />
          <button 
            onClick={() => fileInputRef.current.click()} disabled={isProcessing}
            className="btn-hover"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '10px', cursor: isProcessing ? 'not-allowed' : 'pointer', color: '#475569', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s', opacity: isProcessing ? 0.5 : 1, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
          >
            <FolderUp size={18} color="#3B82F6" /> Select Directory
          </button>
          
          {/* UPDATED: DYNAMIC RESET / RUN BUTTON */}
          <button 
            className="btn-creative"
            onClick={stats.completed ? handleReset : processBatch} 
            disabled={isProcessing || (!stats.completed && files.length === 0)}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', 
              background: stats.completed ? 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)', 
              color: '#FFFFFF', border: 'none', borderRadius: '10px', 
              cursor: (isProcessing || (!stats.completed && files.length === 0)) ? 'not-allowed' : 'pointer', 
              fontWeight: '600', fontSize: '14px', 
              opacity: (isProcessing || (!stats.completed && files.length === 0)) ? 0.5 : 1 
            }}
          >
            {isProcessing ? <Cpu size={18} className="animate-spin" /> : stats.completed ? <RefreshCw size={18} /> : <Play size={18} />}
            {isProcessing ? 'Executing Pipeline...' : stats.completed ? 'Clear & Start New Batch' : (stats.totalProcessed > 0 && !stats.completed) ? 'Resume Batch' : 'Start Batch Processing'}
          </button>
        </div>
      </div>

      {/* Main Content Split: Tracker & Analytics */}
      <div style={{ display: 'flex', gap: '24px', flexShrink: 0, alignItems: 'stretch' }}>
        
        {/* Progress Tracker */}
        <div className="creative-card" style={{ flex: '2 1 0', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.4s ease forwards 0.1s', opacity: 0 }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#64748B', fontWeight: '800', letterSpacing: '0.5px' }}>PIPELINE STATUS</h3>
          
          {files.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '2px dashed #CBD5E1', padding: '40px 0', transition: 'all 0.3s' }}>
              <UploadCloud size={56} color="#94A3B8" className="animate-float-icon" style={{ marginBottom: '16px' }} />
              <p style={{ margin: 0, color: '#475569', fontWeight: '700', fontSize: '15px' }}>Awaiting Directory Upload</p>
              <p style={{ margin: '4px 0 0 0', color: '#94A3B8', fontSize: '13px' }}>Select a folder containing PCB images to begin.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>TARGET DIRECTORY</p>
                  <p style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '700' }}>/{folderName}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#94A3B8', fontWeight: '600' }}>QUEUE</p>
                  <p style={{ margin: 0, fontSize: '18px', color: '#0F172A', fontWeight: '700' }}>{stats.totalProcessed} / {files.length} Boards</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: isProcessing ? '#3B82F6' : (stats.completed ? '#10B981' : (stats.totalProcessed > 0 ? '#F59E0B' : '#64748B')) }}>
                    {isProcessing ? 'Processing Tensors...' : (stats.completed ? 'Batch Complete' : (stats.totalProcessed > 0 ? 'Paused' : 'Ready'))}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A' }}>{progress}%</span>
                </div>
                <div style={{ width: '100%', height: '14px', backgroundColor: '#F1F5F9', borderRadius: '8px', overflow: 'hidden', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div className={isProcessing ? "animated-progress" : ""} style={{ width: `${progress}%`, height: '100%', backgroundColor: stats.completed ? '#10B981' : (isProcessing ? '#3B82F6' : '#F59E0B'), transition: 'width 0.4s ease-out', boxShadow: isProcessing ? '0 0 10px rgba(59, 130, 246, 0.5)' : 'none' }}></div>
                </div>
              </div>

              {stats.completed && (
                <div style={{ padding: '16px', backgroundColor: '#F0FDF4', border: '1px solid #DCFCE7', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px', color: '#15803D', boxShadow: '0 4px 12px rgba(22, 163, 74, 0.1)', animation: 'slide-right 0.4s ease' }}>
                  <CheckCircle2 size={28} />
                  <div>
                    <p style={{ margin: 0, fontWeight: '700', fontSize: '15px' }}>Job Successfully Logged</p>
                    <p style={{ margin: '2px 0 0 0', fontSize: '13px', opacity: 0.8 }}>All data synced to the central database.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analytics Readout & Breakdown */}
        <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', animation: 'slide-up 0.4s ease forwards 0.2s', opacity: 0 }}>
            <div className="creative-card" style={{ flex: 1, padding: '24px', backgroundColor: '#FEF2F2', borderRadius: '16px', border: '1px solid #FEE2E2', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05 }}><AlertCircle size={100} /></div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#EF4444', fontWeight: '800', textTransform: 'uppercase', position: 'relative' }}>Anomalies</p>
              <p style={{ margin: 0, fontSize: '36px', fontWeight: '800', color: '#DC2626', lineHeight: 1, position: 'relative' }}>{stats.totalDefects}</p>
            </div>
            <div className="creative-card" style={{ flex: 1, padding: '24px', backgroundColor: '#F0FDF4', borderRadius: '16px', border: '1px solid #DCFCE7', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.05 }}><CheckCircle2 size={100} /></div>
              <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#15803D', fontWeight: '800', textTransform: 'uppercase', position: 'relative' }}>Clean</p>
              <p style={{ margin: 0, fontSize: '36px', fontWeight: '800', color: '#16A34A', lineHeight: 1, position: 'relative' }}>{stats.cleanBoards}</p>
            </div>
          </div>
          
          <div className="creative-card" style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column', animation: 'slide-up 0.4s ease forwards 0.3s', opacity: 0 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
               <h4 style={{ margin: 0, fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Defect Distribution</h4>
               
               <button 
                 onClick={generatePDFReport} 
                 disabled={!stats.completed || files.length === 0}
                 className="btn-hover"
                 style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', cursor: (!stats.completed || files.length === 0) ? 'not-allowed' : 'pointer', color: '#475569', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', opacity: (!stats.completed || files.length === 0) ? 0.5 : 1 }}
                 title="Export PDF Report"
               >
                 <FileText size={14} /> Report
               </button>
             </div>

             <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', maxHeight: '125px' }}>
               {Object.keys(defectBreakdown).length === 0 ? (
                 <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>No defects classified yet.</p>
                 </div>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                   {Object.entries(defectBreakdown).map(([label, count], idx) => (
                     <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid #EF4444', animation: `slide-right 0.3s ease forwards ${idx * 0.1}s` }}>
                       <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155', textTransform: 'capitalize' }}>{label.replace('_', ' ')}</span>
                       <span style={{ fontSize: '13px', fontWeight: '800', color: '#0F172A' }}>{count}</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        </div>

      </div>

      {/* --- INTERACTIVE REVIEW GALLERY --- */}
      {processedImages.length > 0 && (
        <div style={{ display: 'flex', gap: '24px', flexShrink: 0, minHeight: '600px', marginBottom: '40px', animation: 'slide-up 0.4s ease forwards 0.4s', opacity: 0 }}>
          
          {/* File Selector Sidebar */}
          <div className="creative-card" style={{ width: '300px', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B', fontWeight: '800', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={16} /> INSPECTION GALLERY
            </h3>
            
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', paddingRight: '4px', maxHeight: '650px' }}>
              {processedImages.map((img, idx) => (
                <button 
                  key={idx}
                  onClick={() => { 
                    batchWorkspaceCache.activeIndex = idx;
                    setActiveIndex(idx); 
                    setTimeout(() => resetViewport(), 50); 
                  }}
                  className="gallery-item"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', borderRadius: '10px', border: `1px solid ${activeIndex === idx ? '#3B82F6' : '#F1F5F9'}`, backgroundColor: activeIndex === idx ? '#EFF6FF' : '#F8FAFC', cursor: 'pointer', textAlign: 'left', flexShrink: 0 }}
                >
                  <span title={img.name} style={{ fontSize: '13px', fontWeight: '600', color: activeIndex === idx ? '#1E3A8A' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {img.name}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {img.defects.length > 0 ? (
                      <span style={{ fontSize: '11px', fontWeight: '800', color: '#EF4444', backgroundColor: '#FEF2F2', padding: '2px 6px', borderRadius: '6px' }}>{img.defects.length}</span>
                    ) : (
                      <CheckCircle2 size={16} color="#10B981" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Viewport */}
          <div className="creative-card" style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid #E2E8F0', padding: '20px', position: 'relative', display: 'flex', flexDirection: 'column' }}>
            
            {/* Viewport Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(241, 245, 249, 0.8)', padding: '6px', borderRadius: '10px' }}>
                <button onClick={() => resetViewport()} className="btn-hover" style={{ background: '#FFF', border: '1px solid #E2E8F0', cursor: 'pointer', padding: '6px 10px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: '#475569' }}><Maximize size={14} /> Fit</button>
                <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>
                
                <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.05))} className="btn-hover" style={{ background: '#FFF', border: '1px solid #E2E8F0', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex' }}><ZoomOut size={16} color="#475569" /></button>
                
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155', minWidth: '45px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                
                <button onClick={() => setZoom(z => Math.min(z + 0.1, 10))} className="btn-hover" style={{ background: '#FFF', border: '1px solid #E2E8F0', cursor: 'pointer', padding: '6px', borderRadius: '6px', display: 'flex' }}><ZoomIn size={16} color="#475569" /></button>
                
                <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>
                
                <button 
                  className="btn-creative"
                  onClick={() => {
                    if (!activeImageData) return;
                    onCorrect(activeImageData.previewUrl, activeImageData.file, activeImageData.defects);
                  }} 
                  style={{ background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', fontSize: '13px' }}
                >
                  <Edit3 size={15} /> Correct Labels
                </button>
              </div>
            </div>

            {/* Canvas Area */}
            <div 
              ref={viewportRef}
              style={{ flex: 1, position: 'relative', backgroundColor: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', touchAction: 'none' }}
              onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }}
              onMouseMove={(e) => { if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
            >
              {activeImageData && (
                <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: `${imageDims.width}px`, height: `${imageDims.height}px`, cursor: isDragging ? 'grabbing' : 'grab' }}>
                  <img src={activeImageData.previewUrl} alt="Inspection" onLoad={handleImageLoad} style={{ width: '100%', height: '100%', pointerEvents: 'none', display: 'block' }} />
                  
                  {imageDims.width > 0 && activeImageData.defects.length > 0 && (
                    <svg viewBox={`0 0 ${imageDims.width} ${imageDims.height}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                      {activeImageData.defects.map((defect) => {
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
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

export default BatchUpload;