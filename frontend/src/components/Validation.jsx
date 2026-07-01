import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Database, Layers, Activity, Target, Bell, BarChart2, CheckCircle, AlertTriangle, Crosshair, Zap, ShieldCheck, Focus, Search, ChevronDown, Check } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_BASE_URL } from '../config';

// --- SESSION CACHE ---
// These variables live outside the React component. 
// They survive page switches (React Router), but reset to null on a hard refresh (F5).
let cachedResult = null;
let cachedIsProcessing = false;
let cachedRunId = null;

const InputWrapper = ({ label, icon: Icon, children, isLocked }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: isLocked ? 0.6 : 1, transition: 'all 0.3s ease-in-out' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {Icon && <Icon size={14} color="#94A3B8" />} {label}
        </label>
        <div style={{ position: 'relative' }}>{children}</div>
    </div>
);

const Validation = () => {
    // Initialize state with our cached variables
    const [isValidating, setIsValidating] = useState(cachedIsProcessing);
    const [currentRunId, setCurrentRunId] = useState(cachedRunId);
    const [validationResult, setValidationResult] = useState(cachedResult);
    
    const [datasets, setDatasets] = useState([]);
    const [trainedModels, setTrainedModels] = useState([]);
    const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
    
    // Config State
    const [selectedDatasetId, setSelectedDatasetId] = useState('');
    const [selectedModelId, setSelectedModelId] = useState('');
    const [runName, setRunName] = useState(`Val_Run_${Math.floor(Math.random() * 9000) + 1000}`);

    // Custom Dropdown State
    const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
    const [modelSearchQuery, setModelSearchQuery] = useState('');
    const modelDropdownRef = useRef(null);

    const [isDatasetDropdownOpen, setIsDatasetDropdownOpen] = useState(false);
    const [datasetSearchQuery, setDatasetSearchQuery] = useState('');
    const datasetDropdownRef = useRef(null);

    const pollingIntervalRef = useRef(null);

    const showMessage = (message) => setCustomAlert({ isOpen: true, message });

    // Custom state updaters to ensure our cache always matches the screen
    const updateResult = (data) => {
        setValidationResult(data);
        cachedResult = data;
    };

    const updateIsProcessing = (status) => {
        setIsValidating(status);
        cachedIsProcessing = status;
    };

    const updateRunId = (id) => {
        setCurrentRunId(id);
        cachedRunId = id;
    };

    // Handle clicking outside to close dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modelDropdownRef.current && !modelDropdownRef.current.contains(event.target)) {
                setIsModelDropdownOpen(false);
            }
            if (datasetDropdownRef.current && !datasetDropdownRef.current.contains(event.target)) {
                setIsDatasetDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchInitialData();
        
        // If we navigated away while a model was still validating, resume the polling!
        if (cachedIsProcessing && cachedRunId) {
            startPolling(cachedRunId);
        }

        return () => stopPolling();
    }, []);

    const fetchInitialData = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // Fetch Datasets
            const dsRes = await fetch(`${API_BASE_URL}/api/datasets-list/`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (dsRes.ok) {
                const dsData = await dsRes.json();
                setDatasets(dsData);
                if (dsData.length > 0) setSelectedDatasetId(dsData[0].id);
            }
            
            // Fetch Trained Models
            const runRes = await fetch(`${API_BASE_URL}/api/training-runs/`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (runRes.ok) {
                const runData = await runRes.json();
                const successRuns = runData.filter(r => r.status === 'Success' || r.status === 'Completed');
                setTrainedModels(successRuns);
                if (successRuns.length > 0) setSelectedModelId(successRuns[0].id);
            }

        } catch (e) {
            console.error("Error fetching data:", e);
        }
    };

    const startPolling = (valId) => {
        updateRunId(valId);
        if (!cachedIsProcessing) updateResult(null);

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`${API_BASE_URL}/api/validation-runs/${valId}/details/`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'Success' || data.status === 'Failed') {
                        updateResult(data);
                        updateIsProcessing(false);
                        stopPolling();
                        
                        if(data.status === 'Success') showMessage("Validation run completed successfully.");
                        else showMessage("Validation run failed. Check backend logs.");
                    }
                }
            } catch (e) { 
                console.error("Error polling:", e); 
            }
        }, 3000);
    };

    const stopPolling = () => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
    };

    const handleRunValidation = async () => {
        if (!selectedDatasetId || !selectedModelId) return showMessage("Select a Dataset and a Trained Model.");
        if (!runName.trim()) return showMessage("Run name is required.");

        updateIsProcessing(true);
        updateResult(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/start-validation/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    dataset_id: selectedDatasetId, 
                    training_run_id: selectedModelId, 
                    run_name: runName 
                })
            });

            if (!response.ok) {
                const data = await response.json();
                showMessage(`Error: ${data.error}`);
                updateIsProcessing(false);
            } else {
                const data = await response.json();
                startPolling(data.val_id);
                setRunName(`Val_Run_${Math.floor(Math.random() * 9000) + 1000}`);
            }
        } catch (e) {
            showMessage("Network Error.");
            updateIsProcessing(false);
        }
    };

    const getMetricDetails = (val, type) => {
        if (val >= 0.85) return { color: '#10B981', bg: '#D1FAE5', shadow: 'rgba(16, 185, 129, 0.2)' };
        if (val >= 0.60) return { color: '#F59E0B', bg: '#FEF3C7', shadow: 'rgba(245, 158, 11, 0.2)' };
        return { color: '#EF4444', bg: '#FEE2E2', shadow: 'rgba(239, 68, 68, 0.2)' };
    };

    const chartData = validationResult ? [
        { name: 'mAP 50-95', value: validationResult.metrics.mAP50_95, color: 'url(#colorMap5095)' },
        { name: 'mAP 50', value: validationResult.metrics.mAP50, color: 'url(#colorMap50)' },
        { name: 'Precision', value: validationResult.metrics.precision, color: 'url(#colorPrecision)' },
        { name: 'Recall', value: validationResult.metrics.recall, color: 'url(#colorRecall)' }
    ] : [];

    // Filter Logic for Custom Dropdowns
    const filteredModels = trainedModels.filter(m => 
        m.run_name.toLowerCase().includes(modelSearchQuery.toLowerCase()) || 
        m.model_architecture.toLowerCase().includes(modelSearchQuery.toLowerCase())
    );
    const selectedModel = trainedModels.find(m => m.id === selectedModelId);

    const filteredDatasets = datasets.filter(d => 
        d.version_name.toLowerCase().includes(datasetSearchQuery.toLowerCase())
    );
    const selectedDataset = datasets.find(d => d.id === selectedDatasetId);

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); } 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); } }
                @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
                @keyframes dropdownSlideDown { from { opacity: 0; transform: scaleY(0.95) translateY(-10px); } to { opacity: 1; transform: scaleY(1) translateY(0); } }

                .val-input { width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; font-size: 14.5px; font-weight: 600; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-sizing: border-box; outline: none; }
                .val-input:focus { border-color: #3B82F6; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); transform: translateY(-2px); }
                
                /* Custom Dropdown Styling */
                .custom-select-wrapper { position: relative; user-select: none; width: 100%; }
                .custom-select-header { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
                .custom-select-header:hover:not(.disabled) { border-color: #CBD5E1; }
                .custom-select-header.open { border-color: #3B82F6; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
                .custom-select-header.disabled { background-color: #F1F5F9; color: #94A3B8; cursor: not-allowed; border-color: #E2E8F0; }

                .custom-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); overflow: hidden; transform-origin: top; animation: dropdownSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
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
                .custom-select-item.selected { background-color: #EFF6FF; color: #3B82F6; font-weight: 700; }

                .val-btn { padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14.5px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.3s ease; border: none; color: white; background: linear-gradient(135deg, #3B82F6, #1D4ED8); box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3); overflow: hidden; position: relative; }
                .val-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(59, 130, 246, 0.4); }
                .val-btn:disabled { background: linear-gradient(135deg, #94A3B8, #64748B); cursor: not-allowed; box-shadow: none; transform: none; }
                
                .metric-card { background: #FFFFFF; padding: 24px; border-radius: 20px; border: 1px solid #E2E8F0; text-align: center; flex: 1; display: flex; flex-direction: column; justify-content: center; position: relative; overflow: hidden; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02); }
                .metric-card:hover { transform: translateY(-8px); box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02); border-color: #CBD5E1; }
                .metric-icon-wrap { position: absolute; top: -15px; right: -15px; opacity: 0.05; transform: rotate(-15deg); transition: all 0.4s ease; }
                .metric-card:hover .metric-icon-wrap { transform: rotate(0deg) scale(1.1); opacity: 0.1; }
                
                .metric-title { font-size: 13px; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 6px; }
                .metric-val { font-size: 36px; font-weight: 900; letter-spacing: -1px; background-clip: text; -webkit-background-clip: text; }

                .matrix-box { padding: 20px; border-radius: 16px; text-align: center; transition: all 0.3s ease; position: relative; overflow: hidden; border: 1px solid transparent; }
                .matrix-box:hover { transform: scale(1.02); z-index: 1; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05); }
                .matrix-label { font-size: 12.5px; font-weight: 800; color: #64748B; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
                .matrix-value { font-size: 32px; font-weight: 900; color: #0F172A; }

                .processing-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, transparent, rgba(59, 130, 246, 0.1), transparent); animation: scanline 2s linear infinite; pointer-events: none; }

                /* Staggered Animations */
                .stagger-1 { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
                .stagger-2 { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
                .stagger-3 { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
                .stagger-4 { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }

                .custom-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out forwards; }
                .custom-modal-box { background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border: 1px solid #334155; border-radius: 20px; padding: 24px 28px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: translateY(20px); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; gap: 16px; }
                .custom-modal-text { color: #E2E8F0; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500; }
                .custom-modal-btn { background: #3B82F6; color: #FFFFFF; border: none; border-radius: 10px; padding: 10px 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; align-self: flex-end; }
                .custom-modal-btn:hover { background: #2563EB; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); }
            `}</style>

            {/* --- CONFIGURATION HEADER --- */}
            <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '36px', border: '1px solid #E2E8F0', boxShadow: '0 10px 40px rgba(15, 23, 42, 0.04)', position: 'relative', zIndex: 10 }}>
                {isValidating && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: '24px', overflow: 'hidden', pointerEvents: 'none' }}>
                        <div className="processing-overlay" />
                    </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px', position: 'relative', zIndex: 1 }}>
                    <div>
                        <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '14px', letterSpacing: '-0.5px' }}>
                            <div style={{ padding: '10px', background: 'linear-gradient(135deg, #EFF6FF, #DBEAFE)', borderRadius: '14px', color: '#3B82F6', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Target size={28} strokeWidth={2.5} />
                            </div>
                            Model Validation
                        </h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Configure and execute validation sequences against ground-truth datasets.</p>
                    </div>
                    
                    <button className="val-btn" onClick={handleRunValidation} disabled={isValidating} style={{ animation: isValidating ? 'pulseGlow 2s infinite' : 'none' }}>
                        {isValidating ? <Activity size={20} className="animate-spin" /> : <Play size={20} fill="currentColor" />}
                        {isValidating ? 'Processing Tensors...' : 'Execute Validation'}
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '28px', position: 'relative', zIndex: 50 }}>
                    
                    {/* TRAINED MODEL CUSTOM DROPDOWN */}
                    <InputWrapper label="Trained Model (Weights)" icon={Layers} isLocked={isValidating}>
                        <div className="custom-select-wrapper" ref={modelDropdownRef} style={{ zIndex: isModelDropdownOpen ? 100 : 1 }}>
                            <div 
                                className={`custom-select-header ${isModelDropdownOpen ? 'open' : ''} ${isValidating ? 'disabled' : ''}`}
                                onClick={() => !isValidating && setIsModelDropdownOpen(!isModelDropdownOpen)}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedModel ? (
                                        <>
                                            {selectedModel.run_name} <span style={{ color: '#94A3B8', fontWeight: '500' }}>({selectedModel.model_architecture})</span>
                                        </>
                                    ) : 'Select a trained model...'}
                                </span>
                                <ChevronDown size={18} color="#64748B" style={{ transform: isModelDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                            </div>
                            
                            {isModelDropdownOpen && (
                                <div className="custom-select-dropdown">
                                    <div className="custom-select-search">
                                        <Search size={16} color="#94A3B8" />
                                        <input 
                                            type="text" 
                                            placeholder="Search models..." 
                                            value={modelSearchQuery}
                                            onChange={(e) => setModelSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="custom-select-list">
                                        {filteredModels.length === 0 ? (
                                            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: '500' }}>
                                                No models found
                                            </div>
                                        ) : (
                                            filteredModels.map(m => (
                                                <div 
                                                    key={m.id} 
                                                    className={`custom-select-item ${m.id === selectedModelId ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedModelId(m.id);
                                                        setIsModelDropdownOpen(false);
                                                        setModelSearchQuery('');
                                                    }}
                                                >
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {m.run_name}
                                                        <span style={{ color: m.id === selectedModelId ? '#3B82F6' : '#94A3B8', fontSize: '12.5px', marginLeft: '6px' }}>
                                                            ({m.model_architecture})
                                                        </span>
                                                    </span>
                                                    {m.id === selectedModelId && <Check size={16} color="#3B82F6" />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </InputWrapper>

                    {/* EVALUATION DATASET CUSTOM DROPDOWN */}
                    <InputWrapper label="Evaluation Dataset" icon={Database} isLocked={isValidating}>
                        <div className="custom-select-wrapper" ref={datasetDropdownRef} style={{ zIndex: isDatasetDropdownOpen ? 100 : 1 }}>
                            <div 
                                className={`custom-select-header ${isDatasetDropdownOpen ? 'open' : ''} ${isValidating ? 'disabled' : ''}`}
                                onClick={() => !isValidating && setIsDatasetDropdownOpen(!isDatasetDropdownOpen)}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedDataset ? `${selectedDataset.version_name} (${selectedDataset.total_images} imgs)` : 'Select a dataset...'}
                                </span>
                                <ChevronDown size={18} color="#64748B" style={{ transform: isDatasetDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                            </div>
                            
                            {isDatasetDropdownOpen && (
                                <div className="custom-select-dropdown">
                                    <div className="custom-select-search">
                                        <Search size={16} color="#94A3B8" />
                                        <input 
                                            type="text" 
                                            placeholder="Search datasets..." 
                                            value={datasetSearchQuery}
                                            onChange={(e) => setDatasetSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="custom-select-list">
                                        {filteredDatasets.length === 0 ? (
                                            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: '500' }}>
                                                No datasets found
                                            </div>
                                        ) : (
                                            filteredDatasets.map(ds => (
                                                <div 
                                                    key={ds.id} 
                                                    className={`custom-select-item ${ds.id === selectedDatasetId ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedDatasetId(ds.id);
                                                        setIsDatasetDropdownOpen(false);
                                                        setDatasetSearchQuery('');
                                                    }}
                                                >
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {ds.version_name} 
                                                        <span style={{ color: ds.id === selectedDatasetId ? '#3B82F6' : '#94A3B8', fontSize: '12.5px', marginLeft: '6px' }}>
                                                            ({ds.total_images} imgs)
                                                        </span>
                                                    </span>
                                                    {ds.id === selectedDatasetId && <Check size={16} color="#3B82F6" />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </InputWrapper>

                    <InputWrapper label="Validation Run Name" icon={Zap} isLocked={isValidating}>
                        <input type="text" className="val-input" value={runName} onChange={e => setRunName(e.target.value)} disabled={isValidating} />
                    </InputWrapper>
                </div>
            </div>

            {/* --- VALIDATION RESULTS --- */}
            {validationResult && validationResult.status === 'Success' && (
                <div style={{ background: '#FFFFFF', borderRadius: '24px', padding: '36px', border: '1px solid #E2E8F0', boxShadow: '0 10px 40px rgba(15, 23, 42, 0.04)', animation: 'scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px', borderBottom: '1px solid #F1F5F9', paddingBottom: '24px' }}>
                        <div style={{ padding: '12px', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', color: '#16A34A', borderRadius: '16px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ShieldCheck size={32} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#0F172A', fontWeight: '900', letterSpacing: '-0.5px' }}>Validation Passed: {validationResult.run_name}</h3>
                            <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Inference completed. Matrix and Core metrics successfully extracted.</p>
                        </div>
                    </div>

                    {/* Top Core Metrics */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '40px' }}>
                        {[
                            { label: 'mAP 50-95', value: validationResult.metrics.mAP50_95, icon: Target, delay: 'stagger-1' },
                            { label: 'mAP 50', value: validationResult.metrics.mAP50, icon: Focus, delay: 'stagger-2' },
                            { label: 'Precision', value: validationResult.metrics.precision, icon: Crosshair, delay: 'stagger-3' },
                            { label: 'Recall', value: validationResult.metrics.recall, icon: Activity, delay: 'stagger-4' }
                        ].map((metric, idx) => {
                            const details = getMetricDetails(metric.value);
                            const Icon = metric.icon;
                            return (
                                <div key={idx} className={`metric-card ${metric.delay}`} style={{ backgroundColor: '#F8FAFC' }}>
                                    <div className="metric-icon-wrap" style={{ color: details.color }}>
                                        <Icon size={120} strokeWidth={1} />
                                    </div>
                                    <div className="metric-title">
                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: details.color, boxShadow: `0 0 10px ${details.color}` }} />
                                        {metric.label}
                                    </div>
                                    <div className="metric-val" style={{ color: details.color, textShadow: `0 4px 10px ${details.shadow}` }}>
                                        {(metric.value * 100).toFixed(1)}%
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '36px' }} className="stagger-4">
                        
                        {/* Bar Chart Visualization */}
                        <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                            <h4 style={{ margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '6px', background: '#EFF6FF', borderRadius: '8px', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart2 size={18} /></div>
                                Performance Breakdown
                            </h4>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={45}>
                                        <defs>
                                            <linearGradient id="colorMap5095" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.9}/><stop offset="95%" stopColor="#059669" stopOpacity={0.9}/></linearGradient>
                                            <linearGradient id="colorMap50" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#34D399" stopOpacity={0.9}/><stop offset="95%" stopColor="#10B981" stopOpacity={0.9}/></linearGradient>
                                            <linearGradient id="colorPrecision" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9}/><stop offset="95%" stopColor="#2563EB" stopOpacity={0.9}/></linearGradient>
                                            <linearGradient id="colorRecall" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.9}/><stop offset="95%" stopColor="#7C3AED" stopOpacity={0.9}/></linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                                        <XAxis dataKey="name" tick={{ fill: '#64748B', fontSize: 13, fontWeight: 700 }} axisLine={{ stroke: '#E2E8F0', strokeWidth: 2 }} tickLine={false} />
                                        <YAxis domain={[0, 1]} tick={{ fill: '#94A3B8', fontSize: 12 }} axisLine={false} tickLine={false} />
                                        <RechartsTooltip itemStyle={{ color: '#ffffff' }} cursor={{fill: '#F8FAFC'}} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: 'none', borderRadius: '12px', color: '#fff', fontWeight: '600', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }} />
                                        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Confusion Matrix Numbers */}
                        <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                            <h4 style={{ margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ padding: '6px', background: '#F5F3FF', borderRadius: '8px', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Layers size={18} /></div>
                                Matrix Classifications
                            </h4>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', borderColor: '#BBF7D0' }}>
                                    <div className="matrix-label" style={{ color: '#16A34A' }}>True Positive (TP)</div>
                                    <div className="matrix-value" style={{ color: '#14532D' }}>{validationResult.matrix.tp}</div>
                                </div>
                                <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FECACA' }}>
                                    <div className="matrix-label" style={{ color: '#DC2626' }}>False Positive (FP)</div>
                                    <div className="matrix-value" style={{ color: '#7F1D1D' }}>{validationResult.matrix.fp}</div>
                                </div>
                                <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FECACA' }}>
                                    <div className="matrix-label" style={{ color: '#DC2626' }}>False Negative (FN)</div>
                                    <div className="matrix-value" style={{ color: '#7F1D1D' }}>{validationResult.matrix.fn}</div>
                                </div>
                                <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', borderColor: '#E2E8F0', opacity: 0.8 }}>
                                    <div className="matrix-label" style={{ color: '#64748B' }}>True Negative (TN)</div>
                                    <div className="matrix-value" style={{ color: '#94A3B8' }}>{validationResult.matrix.tn} <span style={{ fontSize: '14px', fontWeight: '600' }}>(Ignored)</span></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {validationResult && validationResult.status === 'Failed' && (
                <div style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderRadius: '20px', padding: '32px', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'flex-start', gap: '20px', animation: 'scaleIn 0.4s ease-out forwards', boxShadow: '0 10px 25px rgba(239, 68, 68, 0.1)' }}>
                    <div style={{ padding: '12px', background: '#FFFFFF', borderRadius: '50%', boxShadow: '0 4px 10px rgba(239, 68, 68, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertTriangle size={36} color="#EF4444" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h4 style={{ margin: '0 0 8px 0', color: '#991B1B', fontSize: '20px', fontWeight: '900', letterSpacing: '-0.5px' }}>Validation Sequence Failed</h4>
                        <p style={{ margin: 0, color: '#B91C1C', fontSize: '15px', lineHeight: '1.6', fontWeight: '500' }}>The inference engine encountered a critical error while evaluating the tensors. Please verify your backend logs to ensure the chosen model weights are compatible with the dataset's YAML bindings.</p>
                    </div>
                </div>
            )}

            {/* --- CUSTOM ALERT MODAL --- */}
            {customAlert.isOpen && createPortal(
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', color: '#3B82F6' }}>
                                <Bell size={24} strokeWidth={2.5} />
                            </div>
                            <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '19px', fontWeight: '800', letterSpacing: '0.5px' }}>System Alert</h3>
                        </div>
                        <p className="custom-modal-text">{customAlert.message}</p>
                        <button className="custom-modal-btn" onClick={() => setCustomAlert({ isOpen: false, message: '' })}>
                            Acknowledge
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Validation;