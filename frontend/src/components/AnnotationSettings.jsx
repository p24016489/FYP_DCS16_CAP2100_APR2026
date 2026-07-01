import React, { useState, useEffect, useRef } from 'react';
import { Tag, Plus, Trash2, Save, Palette, Settings2, Crosshair, FileJson, History, Eye, ChevronDown, Check, Hash, Palette as ColorIcon, X, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

const AnnotationSettings = () => {
  const [labels, setLabels] = useState([]);
  const [newLabel, setNewLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  const [recentColors, setRecentColors] = useState(['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6']);
  
  const [settings, setSettings] = useState({
    exportFormat: 'yolo',
    enableCrosshair: true,
    autoSave: true,
    boxOpacity: 40 
  });

  const [hoveredLabelId, setHoveredLabelId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportDropdownRef = useRef(null);

  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef(null);
  const [hexInput, setHexInput] = useState('');

  // --- NEW: Custom Animated Toast State ---
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
  const toastTimerRef = useRef(null);

  const premiumPalette = [
    '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
    '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
    '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
    '#EC4899', '#F43F5E', '#64748B', '#334155', '#0F172A'
  ];

  const API_URL = `${API_BASE_URL}/api/annotation-settings/`;

  // --- NEW: Notification Trigger Function ---
  const showToast = (message, type = 'success') => {
    setToast({ visible: true, message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 3500); // Auto-hide after 3.5 seconds
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target)) {
        setIsExportDropdownOpen(false);
      }
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target)) {
        setIsColorPickerOpen(false);
      }
    };
    if (isExportDropdownOpen || isColorPickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportDropdownOpen, isColorPickerOpen]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('token'); 
        const response = await fetch(API_URL, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const mappedLabels = data.labels.map(l => ({
            id: l.class_id,
            name: l.class_name,
            color: l.hex_color
          }));
          
          const fetchedSettings = {
            exportFormat: data.settings.export_format || 'yolo',
            enableCrosshair: data.settings.enable_crosshair !== false,
            autoSave: data.settings.auto_save !== false,
            boxOpacity: data.settings.box_opacity ?? 40
          };

          // Update state directly from the backend database payload
          setLabels(mappedLabels);
          setSettings(fetchedSettings);
        }
      } catch (error) {
        console.error("Error connecting to backend database:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleColorSelect = (colorCode) => {
    if (!/^#[0-9A-F]{6}$/i.test(colorCode)) {
       showToast("Please enter a valid 6-character HEX code (e.g. #FF0000).", "warning");
       return;
    }
    const upperColor = colorCode.toUpperCase();
    setSelectedColor(upperColor);
    setHexInput(upperColor.replace('#', ''));
    
    if (!recentColors.includes(upperColor)) {
      setRecentColors(prev => [upperColor, ...prev].slice(0, 5));
    }
    setIsColorPickerOpen(false);
  };

  const handleAddLabel = () => {
    if (!newLabel.trim()) return;
    if (!selectedColor) {
      showToast("Please select a color for your new class.", "warning");
      return;
    }
    const newEntry = {
      id: Date.now(), 
      name: newLabel.trim().toLowerCase().replace(/\s+/g, '_'),
      color: selectedColor
    };
    setLabels([...labels, newEntry]);
    setNewLabel('');
  };

  const handleDeleteLabel = (id) => {
    setLabels(labels.filter(label => label.id !== id));
    setDeleteConfirmId(null); 
  };

  const updateWorkspacePreference = (newSettings) => {
    
    setSettings(newSettings); 
  };


  const handleSaveSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ labels, settings })
      });

      if (response.ok) {
        showToast("Configurations permanently synced to your FYP database!", "success");
      } else {
        showToast("Failed to sync configurations with backend server.", "error");
      }
    } catch (error) {
      console.error("Network error saving configurations:", error);
      showToast("Network connection error. Check if Django backend server is running.", "error");
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: '#64748B' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid #E2E8F0', borderTopColor: '#10B981', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ fontWeight: '600', fontSize: '15px' }}>Synchronizing settings workspace parameters...</span>
      </div>
    );
  }

  const getPreviewColor = () => {
    if (hexInput.length === 6) return `#${hexInput}`;
    return selectedColor || '#E2E8F0';
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '28px', width: '100%', paddingBottom: '40px', position: 'relative' }}>
      
      {/* --- NEW: THE CUSTOM POP-OUT TOAST DESIGN --- */}
      <div style={{
        position: 'fixed', top: toast.visible ? '40px' : '-100px', left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 24px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', borderRadius: '16px',
        border: `1px solid ${toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#F59E0B'}`,
        boxShadow: toast.visible ? `0 20px 40px -10px ${toast.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : toast.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}` : 'none',
        opacity: toast.visible ? 1 : 0, pointerEvents: toast.visible ? 'auto' : 'none',
        transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '50%',
          backgroundColor: toast.type === 'success' ? '#F0FDF4' : toast.type === 'error' ? '#FEF2F2' : '#FFFBEB',
          color: toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#F59E0B'
        }}>
          {toast.type === 'success' ? <Check size={20} strokeWidth={3} /> : <AlertCircle size={20} strokeWidth={2.5} />}
        </div>
        <span style={{ fontSize: '15px', fontWeight: '700', color: '#0F172A', letterSpacing: '-0.2px' }}>
          {toast.message}
        </span>
        <button onClick={() => setToast(prev => ({...prev, visible: false}))} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: '#94A3B8', marginLeft: '12px', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#0F172A'} onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}>
          <X size={18} />
        </button>
      </div>

      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(226, 232, 240, 0.8);
          box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
          border-radius: 20px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .glass-card:hover {
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .input-focus-ring:focus-within {
          box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
          border-color: #10B981 !important;
        }
        .color-preset:hover {
          transform: scale(1.15);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .save-btn {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          box-shadow: 0 4px 14px rgba(16, 185, 129, 0.25);
          transition: all 0.3s ease;
        }
        .save-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }
        .custom-dropdown-item {
          padding: 10px 16px;
          font-size: 14px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: all 0.2s ease;
        }
        .custom-dropdown-item:hover {
          background-color: #F8FAFC;
          color: #10B981;
          padding-left: 20px;
        }
        .grid-color-swatch {
          transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .grid-color-swatch:hover {
          transform: scale(1.3);
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }
        .confirm-hex-btn {
          transition: all 0.2s;
        }
        .confirm-hex-btn:hover {
          background-color: #059669 !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4) !important;
        }
        .advanced-picker-btn:hover {
          background-color: #F1F5F9 !important;
          border-color: #CBD5E1 !important;
        }
        @keyframes slideLeftFade {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .confirm-actions {
          animation: slideLeftFade 0.2s ease-out forwards;
        }
        .action-btn-hover:hover {
          transform: scale(1.1);
        }
        
        /* CUSTOM SCROLLBAR FOR DEFECT LIST */
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #F8FAFC;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>

      {/* HEADER CARD */}
      <div className="stagger-1 glass-card" style={{ padding: '36px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: '-5%', top: '-50%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>
        <div style={{ position: 'absolute', right: '15%', bottom: '-50%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }}></div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F0FDF4', borderRadius: '10px', color: '#10B981', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.1)' }}>
              <Settings2 size={22} />
            </div>
            <h1 style={{ margin: 0, fontSize: '26px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Annotation Configurations</h1>
          </div>
          <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>
            Define YOLO detection classes and workspace preferences for manual labeling.
          </p>
        </div>
        <button onClick={handleSaveSettings} className="save-btn" style={{ position: 'relative', zIndex: 1, padding: '14px 28px', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Save size={20} /> Commit Configurations
        </button>
      </div>

      <div style={{ display: 'flex', gap: '28px', flexWrap: 'nowrap', alignItems: 'flex-start', width: '100%' }}>
        
        {/* CLASS MANAGER CARD */}
        <div className="stagger-2 glass-card" style={{ flex: '2 1 450px', padding: '36px 40px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#EFF6FF', borderRadius: '10px', color: '#3B82F6' }}>
              <Tag size={20}/>
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px' }}>
               Defect Taxonomy
            </h3>
          </div>

          <div className="input-focus-ring" style={{ display: 'flex', gap: '16px', marginBottom: '36px', alignItems: 'center', backgroundColor: '#F8FAFC', padding: '12px 12px 12px 20px', borderRadius: '16px', border: '2px solid #E2E8F0', transition: 'all 0.3s ease' }}>
            <div style={{ flex: 1 }}>
              <input 
                type="text" 
                placeholder="e.g. copper_exposure" 
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: '15px', color: '#0F172A', fontWeight: '500' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
              {recentColors.map(color => (
                <div 
                  key={color}
                  className="color-preset"
                  onClick={() => handleColorSelect(color)}
                  style={{ 
                    width: '24px', height: '24px', borderRadius: '50%', backgroundColor: color, cursor: 'pointer', 
                    border: selectedColor && selectedColor.toUpperCase() === color.toUpperCase() ? '3px solid #0F172A' : '1px solid rgba(0,0,0,0.1)', 
                    transform: selectedColor && selectedColor.toUpperCase() === color.toUpperCase() ? 'scale(1.15)' : 'scale(1)'
                  }}
                />
              ))}

              <div style={{ width: '2px', height: '20px', backgroundColor: '#E2E8F0', margin: '0 4px' }}></div>

              <div ref={colorPickerRef} style={{ position: 'relative' }}>
                <div 
                  title="Open Color Palette"
                  className="color-preset"
                  onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
                  style={{ 
                    position: 'relative', width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', 
                    border: selectedColor && !recentColors.includes(selectedColor.toUpperCase()) ? '3px solid #0F172A' : '2px solid #FFFFFF', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                    background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', 
                    boxShadow: isColorPickerOpen ? '0 0 0 4px rgba(15, 23, 42, 0.1)' : '0 2px 6px rgba(0,0,0,0.15)',
                    transform: isColorPickerOpen || (selectedColor && !recentColors.includes(selectedColor.toUpperCase())) ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.2s'
                  }}
                >
                  {isColorPickerOpen && <div style={{ width: '10px', height: '10px', backgroundColor: '#FFFFFF', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}></div>}
                </div>

                <div style={{ 
                  position: 'absolute', top: 'calc(100% + 16px)', left: '50%', 
                  transform: isColorPickerOpen ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(10px) scale(0.95)', 
                  backgroundColor: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(10px)', borderRadius: '20px', 
                  border: '1px solid rgba(226, 232, 240, 0.8)', padding: '24px',
                  boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.15), 0 0 0 1px rgba(226, 232, 240, 0.5)', zIndex: 100,
                  opacity: isColorPickerOpen ? 1 : 0, pointerEvents: isColorPickerOpen ? 'auto' : 'none',
                  transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)', width: '260px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#475569', letterSpacing: '0.5px' }}>PALETTE</span>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: getPreviewColor(), boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: '2px solid #FFFFFF' }}></div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '24px' }}>
                    {premiumPalette.map(color => (
                      <div 
                        key={color}
                        className="grid-color-swatch"
                        onClick={() => handleColorSelect(color)}
                        style={{ 
                          width: '100%', aspectRatio: '1/1', backgroundColor: color, borderRadius: '8px', cursor: 'pointer',
                          border: selectedColor === color ? '2px solid #0F172A' : '1px solid rgba(0,0,0,0.05)',
                          transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)'
                        }}
                      />
                    ))}
                  </div>

                  <div style={{ marginBottom: '16px', position: 'relative' }}>
                    <label className="advanced-picker-btn input-focus-ring" style={{ width: '100%', padding: '10px', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', position: 'relative', overflow: 'hidden' }}>
                      <ColorIcon size={16} color="#64748B" />
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569' }}>Gradient & Eyedropper</span>
                      <input 
                        type="color" 
                        value={hexInput.length === 6 ? `#${hexInput}` : (selectedColor || '#000000')} 
                        onChange={(e) => {
                          const val = e.target.value.replace('#', '').toUpperCase();
                          setHexInput(val);
                        }}
                        style={{ position: 'absolute', top: '-10px', left: '-10px', width: '200%', height: '200%', opacity: 0, cursor: 'pointer' }}
                      />
                    </label>
                  </div>

                  <span style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: '#94A3B8', letterSpacing: '0.5px', marginBottom: '8px' }}>CONFIRM HEX</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div className="input-focus-ring" style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: '10px', border: '2px solid #E2E8F0', padding: '0 10px', transition: 'all 0.2s' }}>
                      <Hash size={14} color="#94A3B8" />
                      <input 
                        type="text" 
                        placeholder="FFFFFF"
                        value={hexInput}
                        maxLength={6}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
                          setHexInput(val);
                        }}
                        style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', padding: '10px 6px', fontSize: '14px', fontWeight: '700', color: '#0F172A', fontFamily: 'monospace' }}
                      />
                    </div>
                    <button 
                      className="confirm-hex-btn"
                      onClick={() => handleColorSelect(`#${hexInput || '000000'}`)}
                      style={{ padding: '0 16px', backgroundColor: '#10B981', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
                      title="Confirm Color"
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={handleAddLabel} 
              style={{ 
                padding: '12px 20px', backgroundColor: '#0F172A', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(15, 23, 42, 0.3)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(15, 23, 42, 0.2)'; }}
            >
              <Plus size={18} /> Append Class
            </button>
          </div>

          {/* ADDED CUSTOM SCROLLBAR CLASS, MAX-HEIGHT, AND OVERFLOW-Y HERE */}
          <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '410px', overflowY: 'auto', paddingRight: '8px' }}>
            {labels.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px dashed #CBD5E1' }}>
                <Tag size={32} color="#CBD5E1" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#64748B', fontStyle: 'italic', margin: 0, fontWeight: '500' }}>No defect classes defined. Add your first class above.</p>
              </div>
            ) : (
              labels.map((label) => (
                <div 
                  key={label.id} 
                  onMouseEnter={() => setHoveredLabelId(label.id)}
                  onMouseLeave={() => setHoveredLabelId(null)}
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', 
                    border: hoveredLabelId === label.id ? '1px solid #CBD5E1' : '1px solid #E2E8F0', 
                    borderRadius: '12px', backgroundColor: '#FFFFFF',
                    transform: hoveredLabelId === label.id ? 'translateX(4px)' : 'translateX(0)',
                    transition: 'all 0.2s ease',
                    boxShadow: hoveredLabelId === label.id ? '0 4px 12px rgba(0,0,0,0.03)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '6px', backgroundColor: label.color, boxShadow: `0 2px 8px ${label.color}40`, border: '1px solid rgba(0,0,0,0.05)' }}></div>
                    <span style={{ fontWeight: '700', color: '#1E293B', fontSize: '15px' }}>{label.name}</span>
                    <span style={{ fontSize: '12px', color: '#94A3B8', fontFamily: 'monospace', backgroundColor: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>{label.color.toUpperCase()}</span>
                  </div>
                  
                  {deleteConfirmId === label.id ? (
                    <div className="confirm-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: '#EF4444', letterSpacing: '0.5px' }}>DELETE?</span>
                      <button 
                        onClick={() => handleDeleteLabel(label.id)}
                        className="action-btn-hover"
                        style={{ backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s' }}
                        title="Yes, Delete"
                      >
                        <Check size={16} strokeWidth={3} />
                      </button>
                      <button 
                        onClick={() => setDeleteConfirmId(null)}
                        className="action-btn-hover"
                        style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
                        title="Cancel"
                      >
                        <X size={16} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setDeleteConfirmId(label.id)} 
                      style={{ 
                        background: hoveredLabelId === label.id ? '#FEF2F2' : 'transparent', 
                        border: 'none', color: hoveredLabelId === label.id ? '#EF4444' : '#CBD5E1', 
                        cursor: 'pointer', padding: '8px', borderRadius: '8px', transition: 'all 0.2s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      title="Remove Class"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* WORKSPACE PREFERENCES CARD */}
        <div className="stagger-3 glass-card" style={{ flex: '1 1 300px', padding: '36px 40px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#F5F3FF', borderRadius: '10px', color: '#8B5CF6' }}>
              <Palette size={20} />
            </div>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px' }}>
               Workspace UI
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', transition: 'all 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', color: '#475569' }}><FileJson size={18} /></div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1E293B', fontSize: '14.5px' }}>Export Format</p>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px' }}>Default save structure</p>
                </div>
              </div>
              
              <div ref={exportDropdownRef} style={{ position: 'relative' }}>
                <div 
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', 
                    backgroundColor: '#FFFFFF', borderRadius: '10px', 
                    border: `2px solid ${isExportDropdownOpen ? '#10B981' : '#E2E8F0'}`, 
                    color: '#0F172A', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
                    boxShadow: isExportDropdownOpen ? '0 0 0 4px rgba(16,185,129,0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease',
                    minWidth: '140px', justifyContent: 'space-between'
                  }}
                >
                  {settings.exportFormat === 'yolo' ? 'YOLO (.txt)' : 'COCO (.json)'}
                  <ChevronDown size={16} style={{ color: '#94A3B8', transition: 'transform 0.3s ease', transform: isExportDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>

                <div style={{ 
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '100%', 
                  backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '6px',
                  boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', zIndex: 50,
                  opacity: isExportDropdownOpen ? 1 : 0, 
                  transform: isExportDropdownOpen ? 'translateY(0)' : 'translateY(-10px)', 
                  pointerEvents: isExportDropdownOpen ? 'auto' : 'none',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <div 
                    className="custom-dropdown-item"
                    style={{ backgroundColor: settings.exportFormat === 'yolo' ? '#F0FDF4' : 'transparent', color: settings.exportFormat === 'yolo' ? '#10B981' : '#475569', borderRadius: '8px' }}
                    onClick={() => { 
                        const newSettings = {...settings, exportFormat: 'yolo'};
                        setSettings(newSettings);
                        updateWorkspacePreference(newSettings);
                        setIsExportDropdownOpen(false); 
                    }}
                  >
                    YOLO (.txt) {settings.exportFormat === 'yolo' && <Check size={16} />}
                  </div>
                  <div 
                    className="custom-dropdown-item"
                    style={{ backgroundColor: settings.exportFormat === 'coco' ? '#F0FDF4' : 'transparent', color: settings.exportFormat === 'coco' ? '#10B981' : '#475569', borderRadius: '8px' }}
                    onClick={() => { 
                        const newSettings = {...settings, exportFormat: 'coco'};
                        setSettings(newSettings);
                        updateWorkspacePreference(newSettings);
                        setIsExportDropdownOpen(false); 
                    }}
                  >
                    COCO (.json) {settings.exportFormat === 'coco' && <Check size={16} />}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', transition: 'all 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', color: '#475569' }}><Crosshair size={18} /></div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1E293B', fontSize: '14.5px' }}>Canvas Crosshairs</p>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px' }}>Guide lines for accurate boxing</p>
                </div>
              </div>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={settings.enableCrosshair} 
                  onChange={(e) => {
                        const newSettings = {...settings, enableCrosshair: e.target.checked};
                        setSettings(newSettings);
                        updateWorkspacePreference(newSettings);
                    }}
                  style={{ width: '22px', height: '22px', accentColor: '#10B981', cursor: 'pointer', margin: 0 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', transition: 'all 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', color: '#475569' }}><History size={18} /></div>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1E293B', fontSize: '14.5px' }}>Auto-Save Drafts</p>
                  <p style={{ margin: 0, color: '#64748B', fontSize: '12.5px' }}>Prevent data loss on reload</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={settings.autoSave} 
                onChange={(e) => {
                    const newSettings = {...settings, autoSave: e.target.checked};
                    setSettings(newSettings);
                    updateWorkspacePreference(newSettings);
                }}
                style={{ width: '22px', height: '22px', accentColor: '#10B981', cursor: 'pointer', margin: 0 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', backgroundColor: '#F8FAFC', borderRadius: '16px', border: '1px solid #E2E8F0', transition: 'all 0.3s ease' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'} onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', backgroundColor: '#FFFFFF', borderRadius: '8px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)', color: '#475569' }}><Eye size={18} /></div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontWeight: '700', color: '#1E293B', fontSize: '14.5px', display: 'flex', justifyContent: 'space-between' }}>
                    Box Fill Opacity <span style={{ color: '#10B981', backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: '6px' }}>{settings.boxOpacity}%</span>
                  </p>
                </div>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={settings.boxOpacity}
                onChange={(e) => {
                    setSettings({...settings, boxOpacity: parseInt(e.target.value)});
                }}
                onMouseUp={(e) => {
                    updateWorkspacePreference({...settings, boxOpacity: parseInt(e.target.value)});
                }}
                style={{ width: '100%', accentColor: '#10B981', cursor: 'pointer', height: '6px', borderRadius: '4px' }}
              />
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};

export default AnnotationSettings;