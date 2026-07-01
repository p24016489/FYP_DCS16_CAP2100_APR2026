import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Square, CheckCircle2, AlertCircle, Trash2, Download, Undo, XCircle, Eye, EyeOff, ZoomIn, ZoomOut, MousePointer2, Hand, Maximize, Cpu } from 'lucide-react';
import { API_BASE_URL } from '../config';

// NEW: Global cache to persist data across page navigations within the app
export const sharedWorkspaceCache = {
  imageSrc: null,
  imageFile: null,
  boxes: [],
  activeClass: '',
  isUnsaved: false,
  savedImageId: null
};

const AVAILABLE_KEYS = ['1','2','3','4','5','6','7','8','9','0','a','b','c','d','e','f','g','i','j','k','l','m','n','o','p','q','r','s','t','u','w','x','y','z'];

const Labelling = () => {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  
  // State Management - Now initialized from our shared cache
  const [imageSrc, setImageSrc] = useState(sharedWorkspaceCache.imageSrc);
  const [imageFile, setImageFile] = useState(sharedWorkspaceCache.imageFile);
  const [boxes, setBoxes] = useState(sharedWorkspaceCache.boxes);
  const [activeClass, setActiveClass] = useState(sharedWorkspaceCache.activeClass);
  const [savedImageId, setSavedImageId] = useState(sharedWorkspaceCache.savedImageId);

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 500 });
  
  const [defectClasses, setDefectClasses] = useState([]);
  const [hoverPos, setHoverPos] = useState(null); 
  
  // Advanced Professional Features State
  const [activeTool, setActiveTool] = useState('draw');
  const [view, setView] = useState({ scale: 1, panX: 0, panY: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [hiddenBoxes, setHiddenBoxes] = useState(new Set()); 
  const [hoveredBoxId, setHoveredBoxId] = useState(null);
  
  const [workspaceSettings, setWorkspaceSettings] = useState({ 
    boxOpacity: 40, enableCrosshair: true, autoSave: true, exportFormat: 'yolo'
  });
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Toast State
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ visible: true, message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500);
  }, []);

  

  // Sync important state to the global cache so it survives unmounting
  useEffect(() => {
    sharedWorkspaceCache.boxes = boxes;
  }, [boxes]);

  useEffect(() => {
    sharedWorkspaceCache.activeClass = activeClass;
  }, [activeClass]);

  // Fetch Settings & Taxonomy
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/api/annotation-settings/`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (response.ok) {
          const data = await response.json();
          const formattedClasses = data.labels.map((l, index) => ({
            id: l.class_name, name: l.class_name.replace(/_/g, ' '), color: l.hex_color, yoloIndex: index, shortcut: AVAILABLE_KEYS[index] || ''
          }));
          setDefectClasses(formattedClasses);
          
          // Only set active class if we don't already have one from the cache
          if (formattedClasses.length > 0 && !sharedWorkspaceCache.activeClass) {
            setActiveClass(formattedClasses[0].id);
          }
          setWorkspaceSettings({ boxOpacity: data.settings.box_opacity, enableCrosshair: data.settings.enable_crosshair, autoSave: data.settings.auto_save, exportFormat: data.settings.export_format });
        }
      } catch (error) { console.error("Failed to load settings:", error); }
    };
    fetchAll();
  }, []);

  // --- DYNAMIC IMAGE SIZING & CENTERING ---
  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setCanvasSize({ width: naturalWidth, height: naturalHeight });
  };

  const resetView = useCallback(() => {
    if (!wrapperRef.current || !canvasSize.width) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    
    // Calculate the perfect scale to fit the entire high-res image inside the wrapper
    const fitScale = Math.min(rect.width / canvasSize.width, rect.height / canvasSize.height) * 0.95; 
    
    const panX = (rect.width - (canvasSize.width * fitScale)) / 2;
    const panY = (rect.height - (canvasSize.height * fitScale)) / 2;
    
    setView({ scale: fitScale, panX, panY });
  }, [canvasSize]);

  useEffect(() => {
    if (imageSrc && canvasSize.width > 0) {
      setTimeout(resetView, 50);
    }
  }, [imageSrc, resetView, canvasSize]);

  // Extended Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (!e.ctrlKey && !e.shiftKey) {
        if (e.key.toLowerCase() === 'v') { setActiveTool('draw'); return; }
        if (e.key.toLowerCase() === 'h') { setActiveTool('pan'); return; }
      }

      if (e.ctrlKey && e.key === 'z') { handleUndo(); return; }

      const keyIndex = AVAILABLE_KEYS.indexOf(e.key.toLowerCase());
      if (keyIndex !== -1 && defectClasses[keyIndex] && !e.shiftKey && !e.ctrlKey) {
        setActiveClass(defectClasses[keyIndex].id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [boxes, defectClasses]);

  const handleWheel = useCallback((e) => {
    if (!imageSrc || !wrapperRef.current) return;
    e.preventDefault(); 
    
    const scaleAdjust = e.deltaY < 0 ? 1.15 : 0.85; 
    const newScale = Math.max(0.05, Math.min(view.scale * scaleAdjust, 10)); 
    
    const rect = wrapperRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newPanX = mouseX - (mouseX - view.panX) * (newScale / view.scale);
    const newPanY = mouseY - (mouseY - view.panY) * (newScale / view.scale);

    setView({ scale: newScale, panX: newPanX, panY: newPanY });
  }, [imageSrc, view]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => { if (wrapper) wrapper.removeEventListener('wheel', handleWheel); };
  }, [handleWheel]);

  // Drawing & Panning Coordinate Math
  const getMousePos = (e) => {
    const rect = wrapperRef.current.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    return { x: (rawX - view.panX) / view.scale, y: (rawY - view.panY) / view.scale };
  };

  // Mathematically clamps mouse coordinates to stay within the true image bounds
  const getClampedMousePos = (e) => {
    const pos = getMousePos(e);
    return {
      x: Math.max(0, Math.min(pos.x, canvasSize.width)),
      y: Math.max(0, Math.min(pos.y, canvasSize.height))
    };
  };

  const handleMouseDown = (e) => {
    if (!imageSrc) return;
    if (activeTool === 'pan') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - view.panX, y: e.clientY - view.panY });
    } else if (activeTool === 'draw' && activeClass) {
      const pos = getClampedMousePos(e); // Restrict starting point to canvas bounds
      setIsDrawing(true);
      setStartPos(pos);
      setCurrentBox({ ...pos, width: 0, height: 0, class: activeClass });
    }
  };

  const handleMouseMove = (e) => {
    if (!imageSrc) return;
    if (activeTool === 'draw') setHoverPos(getClampedMousePos(e)); // Restrict crosshair to canvas bounds

    if (isPanning && activeTool === 'pan') {
      setView(prev => ({ ...prev, panX: e.clientX - startPan.x, panY: e.clientY - startPan.y }));
    } else if (isDrawing && activeTool === 'draw') {
      const pos = getClampedMousePos(e); // Restrict dragging to canvas bounds
      setCurrentBox({
        x: Math.min(startPos.x, pos.x),
        y: Math.min(startPos.y, pos.y),
        width: Math.abs(pos.x - startPos.x),
        height: Math.abs(pos.y - startPos.y),
        class: activeClass
      });
    }
  };

  const handleMouseUp = async () => {
    if (isPanning) setIsPanning(false);
    if (isDrawing) {
      setIsDrawing(false);
      if (currentBox && currentBox.width > 5 && currentBox.height > 5) {
        const newBoxes = [...boxes, { ...currentBox, id: Date.now() }];
        setBoxes(newBoxes);
        sharedWorkspaceCache.isUnsaved = true;
        
      }
      setCurrentBox(null);
    }
  };

  const handleUndo = () => { setBoxes(prev => prev.slice(0, -1)); sharedWorkspaceCache.isUnsaved = true; };
  const handleClearAll = () => { setBoxes([]); sharedWorkspaceCache.isUnsaved = true; };
  const handleDeleteBox = (idToRemove) => { setBoxes(prev => prev.filter(box => box.id !== idToRemove)); sharedWorkspaceCache.isUnsaved = true; };
  
  const toggleBoxVisibility = (boxId, e) => {
    e.stopPropagation();
    setHiddenBoxes(prev => {
      const next = new Set(prev);
      if (next.has(boxId)) next.delete(boxId); else next.add(boxId);
      return next;
    });
  };

  const toggleAllVisibility = () => {
    if (hiddenBoxes.size === boxes.length && boxes.length > 0) {
      setHiddenBoxes(new Set()); 
    } else {
      setHiddenBoxes(new Set(boxes.map(b => b.id))); 
    }
  };

  // Export to YOLO or COCO Format
  const handleExport = () => {
    if (!imageFile || boxes.length === 0) return showToast("No annotations to export.", "error");

    const imgWidth = canvasRef.current.width;
    const imgHeight = canvasRef.current.height;
    const format = workspaceSettings.exportFormat?.toLowerCase() || 'yolo';

    if (format.includes('yolo')) {
      let exportText = "";
      boxes.forEach(box => {
        const classDef = defectClasses.find(c => c.id === box.class);
        if (!classDef) return;
        const xCenter = (box.x + box.width / 2) / imgWidth;
        const yCenter = (box.y + box.height / 2) / imgHeight;
        const normWidth = box.width / imgWidth;
        const normHeight = box.height / imgHeight;
        exportText += `${classDef.yoloIndex} ${xCenter.toFixed(6)} ${yCenter.toFixed(6)} ${normWidth.toFixed(6)} ${normHeight.toFixed(6)}\n`;
      });

      const blob = new Blob([exportText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imageFile.name.split('.')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported YOLO annotations successfully", "success");

    } else if (format.includes('coco')) {
      const cocoData = {
        images: [{ id: 1, file_name: imageFile.name, width: imgWidth, height: imgHeight }],
        annotations: boxes.map((box, idx) => {
          const classDef = defectClasses.find(c => c.id === box.class);
          return {
            id: idx + 1, image_id: 1, category_id: classDef ? classDef.yoloIndex : 0,
            bbox: [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)], area: Math.round(box.width * box.height), iscrowd: 0
          };
        }),
        categories: defectClasses.map(c => ({ id: c.yoloIndex, name: c.name }))
      };
      const blob = new Blob([JSON.stringify(cocoData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${imageFile.name.split('.')[0]}_coco.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported COCO annotations successfully", "success");
    }
  };

  // --- Remove Image Handler ---
  const handleRemoveImage = () => {
    setImageSrc(null);
    setImageFile(null);
    setBoxes([]);
    setSavedImageId(null); // <-- Clear local ID state

    sharedWorkspaceCache.imageSrc = null;
    sharedWorkspaceCache.imageFile = null;
    sharedWorkspaceCache.boxes = [];
    sharedWorkspaceCache.isUnsaved = false;
    sharedWorkspaceCache.savedImageId = null; // <-- Clear cached ID

    localStorage.removeItem('pcb_labelling_draft');
    showToast("Image removed from workspace.", "success");
  };

  // --- NEW: RECOVER TEMPORARY DRAFT ON MOUNT ---
  useEffect(() => {
    const draft = localStorage.getItem('pcb_labelling_draft');
    
    // Only attempt to load the draft if the workspace is currently empty
    if (draft && !sharedWorkspaceCache.imageSrc) {
      try {
        const parsedDraft = JSON.parse(draft);
        if (parsedDraft.imageData) {
           // Convert the saved base64 image back into a File object so Django accepts it later
           fetch(parsedDraft.imageData)
             .then(res => res.blob())
             .then(blob => {
               const file = new File([blob], parsedDraft.fileName, { type: blob.type });
               setImageFile(file);
               setImageSrc(parsedDraft.imageData);
               setBoxes(parsedDraft.boxes);
               
               // Update the shared session cache
               sharedWorkspaceCache.imageFile = file;
               sharedWorkspaceCache.imageSrc = parsedDraft.imageData;
               sharedWorkspaceCache.boxes = parsedDraft.boxes;
               sharedWorkspaceCache.isUnsaved = true;
               
               showToast("Recovered your unsaved workspace draft.", "success");
             });
        }
      } catch (e) {
        console.error("Failed to parse local draft");
      }
    }
  }, [showToast]);

  // --- NEW: AUTO-SAVE TO TEMPORARY LOCAL STORAGE ---
  useEffect(() => {
    // If autoSave is ON, and we have an image, and there are unsaved changes
    if (workspaceSettings.autoSave && imageFile && sharedWorkspaceCache.isUnsaved) {
       const reader = new FileReader();
       reader.onloadend = () => {
         try {
           localStorage.setItem('pcb_labelling_draft', JSON.stringify({
             fileName: imageFile.name,
             imageData: reader.result, // Converts image to Base64
             boxes: boxes
           }));
         } catch (error) {
           console.warn("Image file is too large for local browser storage quota.");
         }
       };
       reader.readAsDataURL(imageFile);
    }
  }, [boxes, imageFile, workspaceSettings.autoSave]);

  // Canvas Drawing Routine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (imageSrc && imageRef.current) ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    if (workspaceSettings.enableCrosshair && hoverPos && !isDrawing && activeTool === 'draw') {
      const activeColorInfo = defectClasses.find(c => c.id === activeClass);
      const crosshairColor = activeColorInfo ? activeColorInfo.color : '#FFFFFF';

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 3 / view.scale; 
      ctx.setLineDash([]); 
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 0); ctx.lineTo(hoverPos.x, canvas.height);
      ctx.moveTo(0, hoverPos.y); ctx.lineTo(canvas.width, hoverPos.y);
      ctx.stroke();

      ctx.strokeStyle = crosshairColor;
      ctx.lineWidth = 1.5 / view.scale; 
      ctx.setLineDash([6 / view.scale, 4 / view.scale]); 
      ctx.beginPath();
      ctx.moveTo(hoverPos.x, 0); ctx.lineTo(hoverPos.x, canvas.height);
      ctx.moveTo(0, hoverPos.y); ctx.lineTo(canvas.width, hoverPos.y);
      ctx.stroke();
      ctx.setLineDash([]); 
    }

    boxes.forEach(box => {
      if (hiddenBoxes.has(box.id)) return;

      const classDef = defectClasses.find(c => c.id === box.class) || { color: '#000', name: box.class };
      const isHovered = box.id === hoveredBoxId;

      if (isHovered) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6 / view.scale;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
        
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3 / view.scale;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      } else {
        ctx.strokeStyle = classDef.color;
        ctx.lineWidth = 2 / view.scale;
        ctx.strokeRect(box.x, box.y, box.width, box.height);
      }
      
      
      const opacityHex = Math.round(workspaceSettings.boxOpacity * 2.55).toString(16).padStart(2, '0');
      ctx.fillStyle = `${classDef.color}${opacityHex}`;
      ctx.fillRect(box.x, box.y, box.width, box.height);
      
      // --- BOUNDARY COLLISION FIX ---
      // 1. Set font first so measureText is accurate
      ctx.font = `${12/view.scale}px system-ui, sans-serif`; 
      
      // 2. Calculate the total width and height needed for the label
      const textWidth = ctx.measureText(classDef.name).width;
      const labelPadding = 8 / view.scale;
      const labelBgWidth = textWidth + labelPadding;
      const labelHeight = 20 / view.scale;

      // 3. Keep label inside the right edge of the canvas
      let labelX = box.x;
      if (labelX + labelBgWidth > canvas.width) {
        labelX = canvas.width - labelBgWidth;
      }
      
      // 4. Keep label below the top edge of the canvas
      let labelY = box.y > labelHeight ? box.y - labelHeight : box.y;

      // 5. Draw Label Background
      ctx.fillStyle = classDef.color;
      ctx.fillRect(labelX, labelY, labelBgWidth, labelHeight);
      
      // 6. Draw Label Text
      ctx.fillStyle = '#FFF';
      ctx.fillText(classDef.name, labelX + (4/view.scale), labelY + (14/view.scale));
    });

    if (currentBox) {
      const classDef = defectClasses.find(c => c.id === currentBox.class) || { color: '#000' };
      ctx.strokeStyle = classDef.color;
      ctx.lineWidth = 2 / view.scale;
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.width, currentBox.height);
    }
  }, [boxes, currentBox, imageSrc, defectClasses, workspaceSettings, hoverPos, isDrawing, hiddenBoxes, hoveredBoxId, view, activeTool, activeClass]);

  // Database Sync
  const saveAnnotations = async (boxList = boxes) => {
    if (!imageFile) return showToast("Please load an image first.", "warning");
    if (boxList.length === 0) return;
    setIsSyncing(true);
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('boxes', JSON.stringify(boxList)); 
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/save-annotations/`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: formData });
      const responseData = await response.json(); 
      if (response.ok) {
        sharedWorkspaceCache.isUnsaved = false;
        
        // --- NEW: Capture the ID returned by Django ---
        setSavedImageId(responseData.image_id);
        sharedWorkspaceCache.savedImageId = responseData.image_id;
        
        localStorage.removeItem('pcb_labelling_draft');
        showToast("Successfully synced to database!", "success");
      } else { 
        showToast(`Failed to sync: ${responseData.error || 'Unknown Server Error'}`, "error"); 
      }
    } catch (error) { 
      showToast("Network error. Is the Django server running?", "error"); 
    } finally { 
      setIsSyncing(false); 
    }
  };

  // Custom CSS Injection for Animations & Polished UI
  const customStyles = `
    .glass-toast { background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(12px); border: 1px solid rgba(226, 232, 240, 0.8); }
    .dot-grid { background-image: radial-gradient(#CBD5E1 1px, transparent 1px); background-size: 24px 24px; }
    .animate-slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
    .animate-fade-in-up { animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
    .animate-pulse-slow { animation: pulseSlow 3s infinite ease-in-out; }
    
    @keyframes slideDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulseSlow { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.05); } }
    
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #F8FAFC; border-radius: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    
    .btn-hover { transition: all 0.2s ease; }
    .btn-hover:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    
    .btn-primary { background: linear-gradient(135deg, #3B82F6, #2563EB); transition: all 0.2s ease; }
    .btn-primary:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4); transform: translateY(-1px); }
    
    .btn-success { background: linear-gradient(135deg, #10B981, #059669); transition: all 0.2s ease; }
    .btn-success:hover:not(:disabled) { box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4); transform: translateY(-1px); }
    
    .list-item-hover { transition: all 0.2s ease; }
    .list-item-hover:hover { transform: translateX(4px); }
  `;

  return (
    <div style={{ display: 'flex', gap: '24px', height: '100%', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <style>{customStyles}</style>

      {toast.visible && (
        <div className="glass-toast animate-slide-down" style={{ position: 'fixed', top: '40px', left: '50%', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 24px', borderRadius: '16px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
          {toast.type === 'success' ? <CheckCircle2 color="#10B981" size={24} /> : <AlertCircle color="#EF4444" size={24} />}
          <span style={{ fontWeight: '600', color: '#1E293B' }}>{toast.message}</span>
        </div>
      )}

      {imageSrc && <img ref={imageRef} src={imageSrc} alt="ref" onLoad={handleImageLoad} style={{ display: 'none' }} />}

      {/* Main Canvas Workspace */}
      <div style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={22} color="#3B82F6" /> Workspace
              {savedImageId && (
                <span style={{ fontSize: '13px', backgroundColor: '#EFF6FF', color: '#3B82F6', padding: '4px 12px', borderRadius: '8px', border: '1px solid #BFDBFE', marginLeft: '8px' }}>
                  Image #{savedImageId}
                </span>
              )}
            </h2>
            
            
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'center' }}>

            {imageSrc && (
              <button onClick={handleRemoveImage} className="btn-hover" style={{ padding: '9px 14px', backgroundColor: '#FEF2F2', color: '#EF4444', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid #FEE2E2', outline: 'none', whiteSpace: 'nowrap' }}>
                <Trash2 size={16} /> Remove Image
              </button>
            )}

            <label className="btn-hover" style={{ padding: '9px 14px', backgroundColor: '#F1F5F9', color: '#334155', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13.5px', display: 'flex', alignItems: 'center', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
              Load Raw Image
              <input type="file" onChange={(e) => { 
                const f = e.target.files[0]; 
                if (f) {
                  const src = URL.createObjectURL(f);
                  setImageFile(f); 
                  setImageSrc(src); 
                  setBoxes([]);
                  
                  // Save directly to cache
                  sharedWorkspaceCache.imageFile = f;
                  sharedWorkspaceCache.imageSrc = src;
                  sharedWorkspaceCache.boxes = [];
                } 
              }} style={{ display: 'none' }} />
            </label>

            <button onClick={handleExport} className="btn-primary" style={{ padding: '9px 14px', color: '#FFF', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', outline: 'none', whiteSpace: 'nowrap' }}>
              <Download size={16} /> Export {(workspaceSettings.exportFormat || '').toLowerCase().includes('coco') ? 'COCO' : 'YOLO'}
            </button>

            <button onClick={() => saveAnnotations()} disabled={boxes.length === 0 || isSyncing} className="btn-success" style={{ padding: '9px 14px', color: '#FFF', border: 'none', borderRadius: '10px', cursor: boxes.length === 0 ? 'not-allowed' : 'pointer', fontWeight: '600', outline: 'none', opacity: boxes.length === 0 ? 0.6 : 1, whiteSpace: 'nowrap' }}>
              {isSyncing ? 'Syncing...' : 'Sync Database'}
            </button>

          </div>
        </div>

        {/* Viewport Wrapper */}
        <div 
          ref={wrapperRef}
          className="dot-grid"
          style={{ 
            flex: 1, 
            position: 'relative', 
            minHeight: 0,
            minWidth: 0,
            backgroundColor: '#F8FAFC', 
            borderRadius: '16px', 
            border: '2px solid #E2E8F0', 
            overflow: 'hidden', 
            touchAction: 'none', 
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' 
          }}
          onMouseLeave={() => { setHoverPos(null); setIsPanning(false); }}
          onMouseDown={handleMouseDown} 
          onMouseMove={handleMouseMove} 
          onMouseUp={handleMouseUp}
        >
          {!imageSrc ? (
            <div className="animate-pulse-slow" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#94A3B8' }}>
              <Square size={64} strokeWidth={1.5} style={{ margin: '0 auto 16px auto', color: '#CBD5E1' }} />
              <p style={{ fontWeight: '500', fontSize: '15px' }}>Awaiting visual input</p>
            </div>
          ) : (
            <div style={{ 
              position: 'absolute',
              top: 0,
              left: 0,
              transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.scale})`, 
              transformOrigin: '0 0', 
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              cursor: activeTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : (workspaceSettings.enableCrosshair ? 'none' : 'crosshair'),
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              backgroundColor: '#FFF'
            }}>
              <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} style={{ display: 'block' }} />
            </div>
          )}

          {/* Pixel Coordinate Overlay */}
          {imageSrc && hoverPos && activeTool === 'draw' && (
            <div style={{ position: 'absolute', bottom: '16px', right: '16px', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(4px)', color: '#F8FAFC', padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: '600', pointerEvents: 'none', zIndex: 10, border: '1px solid rgba(255,255,255,0.1)' }}>
              X: {Math.round(hoverPos.x)}px <span style={{ color: '#64748B', margin: '0 4px' }}>|</span> Y: {Math.round(hoverPos.y)}px
            </div>
          )}
        </div>

        {/* Toolbar Below Canvas */}
        {imageSrc && (
          <div className="animate-fade-in-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', flexWrap: 'wrap', gap: '16px' }}>
            
            {/* Left Side: Undo / Clear */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleUndo} disabled={boxes.length === 0} className="btn-hover" style={{ padding: '8px 14px', backgroundColor: '#F1F5F9', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: boxes.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569', fontWeight: '600', outline: 'none', opacity: boxes.length === 0 ? 0.5 : 1 }}>
                <Undo size={16} /> Undo <span style={{ fontSize: '11px', color: '#94A3B8' }}>(Ctrl+Z)</span>
              </button>
              <button onClick={handleClearAll} disabled={boxes.length === 0} className="btn-hover" style={{ padding: '8px 14px', backgroundColor: '#FEF2F2', borderRadius: '8px', border: '1px solid #FEE2E2', cursor: boxes.length === 0 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: '#EF4444', fontWeight: '600', outline: 'none', opacity: boxes.length === 0 ? 0.5 : 1 }}>
                <XCircle size={16} /> Clear All
              </button>
            </div>
            
            {/* Right Side: Tools & Zoom */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              
              {/* MOVED TOOL SELECTOR */}
              <div style={{ display: 'flex', backgroundColor: '#F1F5F9', borderRadius: '10px', padding: '4px', border: '1px solid #E2E8F0' }}>
                <button onClick={() => setActiveTool('draw')} className="btn-hover" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: activeTool === 'draw' ? '#FFFFFF' : 'transparent', color: activeTool === 'draw' ? '#2563EB' : '#64748B', fontWeight: '600', boxShadow: activeTool === 'draw' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', outline: 'none' }}>
                  <MousePointer2 size={16} /> Draw <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>(V)</span>
                </button>
                <button onClick={() => setActiveTool('pan')} className="btn-hover" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', backgroundColor: activeTool === 'pan' ? '#FFFFFF' : 'transparent', color: activeTool === 'pan' ? '#2563EB' : '#64748B', fontWeight: '600', boxShadow: activeTool === 'pan' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none', outline: 'none' }}>
                  <Hand size={16} /> Pan <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: '2px' }}>(H)</span>
                </button>
              </div>

              {/* EXISTING ZOOM CONTROLS (UPDATED SIZING) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                <button onClick={resetView} className="btn-hover" style={{ padding: '8px 14px', backgroundColor: '#FFF', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: '600', color: '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} title="Reset View">
                  <Maximize size={16} /> Fit
                </button>
                <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>
                <button onClick={() => setView(p => ({ ...p, scale: Math.max(0.05, p.scale - 0.1) }))} className="btn-hover" style={{ padding: '8px', backgroundColor: '#FFF', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomOut size={16} color="#475569" />
                </button>
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#334155', minWidth: '48px', textAlign: 'center' }}>
                  {Math.round(view.scale * 100)}%
                </span>
                <button onClick={() => setView(p => ({ ...p, scale: Math.min(10, p.scale + 0.1) }))} className="btn-hover" style={{ padding: '8px', backgroundColor: '#FFF', borderRadius: '8px', border: 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomIn size={16} color="#475569" />
                </button>
              </div>
              
            </div>
          </div>
        )}
      </div>
      
      {/* Sidebar Tooling */}
      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#64748B', fontWeight: '800', letterSpacing: '0.5px' }}>TARGET DEFECT CLASS</h3>
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '8px' }}>
            {defectClasses.map((defect, idx) => (
              <button 
                key={defect.id} 
                onClick={() => setActiveClass(defect.id)} 
                className="animate-fade-in-up"
                style={{ 
                  animationDelay: `${idx * 40}ms`,
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 14px', borderRadius: '12px', 
                  border: `2px solid ${activeClass === defect.id ? defect.color : '#F1F5F9'}`, 
                  backgroundColor: activeClass === defect.id ? `${defect.color}10` : '#FFF', 
                  cursor: 'pointer', outline: 'none', transition: 'all 0.2s ease',
                  boxShadow: activeClass === defect.id ? `0 4px 12px ${defect.color}25` : 'none'
                }}
              >
                <div style={{ width: '14px', height: '14px', borderRadius: '4px', backgroundColor: defect.color, boxShadow: `0 0 0 2px ${defect.color}40` }}></div>
                <span style={{ fontWeight: activeClass === defect.id ? '700' : '600', color: activeClass === defect.id ? '#0F172A' : '#475569', flex: 1, textAlign: 'left', fontSize: '14px' }}>{defect.name}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: activeClass === defect.id ? defect.color : '#94A3B8', backgroundColor: activeClass === defect.id ? '#FFF' : '#F1F5F9', padding: '4px 8px', borderRadius: '6px', border: `1px solid ${activeClass === defect.id ? defect.color + '40' : 'transparent'}` }}>{defect.shortcut.toUpperCase()}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Annotations List */}
        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', padding: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: '800', letterSpacing: '0.5px' }}>ANNOTATIONS ({boxes.length})</h3>
            
            {boxes.length > 0 && (
              <button onClick={toggleAllVisibility} className="btn-hover" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', outline: 'none' }} title="Toggle All">
                {hiddenBoxes.size === boxes.length ? <><EyeOff size={14} /> Show All</> : <><Eye size={14} /> Hide All</>}
              </button>
            )}
          </div>
          
          {boxes.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94A3B8', gap: '12px' }}>
              <div style={{ padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '50%' }}>
                <MousePointer2 size={24} color="#CBD5E1" />
              </div>
              <p style={{ fontSize: '14px', fontWeight: '500' }}>No defects labeled yet.</p>
            </div>
          ) : (
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', paddingRight: '8px', maxHeight: '280px' }}>
              {boxes.slice().reverse().map((box, idx) => {
                const classDef = defectClasses.find(c => c.id === box.class) || {};
                const isHidden = hiddenBoxes.has(box.id);
                const isHovered = hoveredBoxId === box.id;
                
                return (
                  <div 
                    key={box.id} 
                    className="animate-fade-in-up list-item-hover"
                    onMouseEnter={() => setHoveredBoxId(box.id)}
                    onMouseLeave={() => setHoveredBoxId(null)}
                    style={{ 
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', 
                      backgroundColor: isHovered ? '#F8FAFC' : (isHidden ? '#F1F5F9' : '#FFFFFF'), 
                      borderRadius: '12px', border: `1px solid ${isHovered ? classDef.color : '#E2E8F0'}`, 
                      opacity: isHidden ? 0.5 : 1, cursor: 'default',
                      boxShadow: isHovered ? '0 4px 12px rgba(0,0,0,0.03)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: classDef.color || '#000', boxShadow: isHovered ? `0 0 0 3px ${classDef.color}30` : 'none', transition: 'all 0.2s' }}></div>
                      <span style={{ fontSize: '14px', fontWeight: '600', color: '#334155', lineHeight: 1 }}>{classDef.name || box.class}</span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button onClick={(e) => toggleBoxVisibility(box.id, e)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: isHidden ? '#E2E8F0' : '#F1F5F9', borderRadius: '6px', border: 'none', cursor: 'pointer', color: isHidden ? '#94A3B8' : '#64748B', outline: 'none', transition: 'all 0.2s' }} title={isHidden ? "Show annotation" : "Hide annotation"}>
                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => handleDeleteBox(box.id)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', background: '#FEF2F2', borderRadius: '6px', border: 'none', cursor: 'pointer', color: '#EF4444', outline: 'none', transition: 'all 0.2s' }} title="Delete annotation">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Labelling;