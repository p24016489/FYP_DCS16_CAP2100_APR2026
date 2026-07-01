import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Server, Activity, Layers, Database, ShieldCheck, Zap, Bell, ChevronDown, Search, Check, UploadCloud, RotateCcw, AlertTriangle, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const InputWrapper = ({ label, icon: Icon, children, isLocked }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: isLocked ? 0.6 : 1, transition: 'all 0.3s ease-in-out' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: '700', color: '#64748B', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {Icon && <Icon size={14} color="#94A3B8" />} {label}
        </label>
        <div style={{ position: 'relative' }}>{children}</div>
    </div>
);

const ModelDeployment = () => {
    const [activeModel, setActiveModel] = useState(null);
    const [availableModels, setAvailableModels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeploying, setIsDeploying] = useState(false);
    
    // Custom Dropdown State
    const [selectedModelId, setSelectedModelId] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef(null);

    // Modals
    const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDelete: false });

    const showMessage = (message) => setCustomAlert({ isOpen: true, message });

    useEffect(() => {
        fetchDeploymentData();
        
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchDeploymentData = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/deployment-status/`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) {
                const data = await res.json();
                setActiveModel(data.active_model);
                setAvailableModels(data.available_models);
            }
        } catch (e) { 
            console.error("Error fetching deployment data:", e); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeploy = async () => {
        if (!selectedModelId) return showMessage("Please select a trained model from the dropdown first.");
        
        setIsDeploying(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/deploy-model/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ training_run_id: selectedModelId })
            });

            const data = await response.json();
            if (response.ok) {
                showMessage(data.message);
                setSelectedModelId('');
                fetchDeploymentData(); 
            } else {
                showMessage(`Deployment Failed: ${data.error}`);
            }
        } catch (e) {
            showMessage("Network Error: Could not deploy model.");
        } finally {
            setIsDeploying(false);
        }
    };

    const handleRevert = async () => {
        setIsDeploying(true);
        setConfirmModal({ ...confirmModal, isOpen: false });
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/revert-model/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const data = await response.json();
            if (response.ok) {
                showMessage(data.message);
                fetchDeploymentData(); 
            } else {
                showMessage(`Revert Failed: ${data.error}`);
            }
        } catch (e) {
            showMessage("Network Error: Could not revert model.");
        } finally {
            setIsDeploying(false);
        }
    };

    const triggerRevert = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Revert to Default Model?',
            message: 'Are you sure you want to deactivate the current custom model? The system will fall back to the default best.pt weights located in the root directory.',
            isDelete: false,
            onConfirm: handleRevert
        });
    };

    const filteredModels = availableModels.filter(m => 
        m.run_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        m.model_architecture.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const selectedModelObj = availableModels.find(m => m.id === selectedModelId);

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulseGlow { 0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); } 70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); } 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); } }
                @keyframes pulseRed { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
                @keyframes dropdownSlideDown { from { opacity: 0; transform: scaleY(0.95) translateY(-10px); } to { opacity: 1; transform: scaleY(1) translateY(0); } }
                
                .stagger-1 { animation: slideUp 0.4s ease forwards 0.1s; opacity: 0; }
                .stagger-2 { animation: slideUp 0.4s ease forwards 0.2s; opacity: 0; }

                /* Custom Dropdown Styling */
                .custom-select-wrapper { position: relative; user-select: none; width: 100%; }
                .custom-select-header { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 14px 16px; border-radius: 12px; border: 2px solid #E2E8F0; background-color: #F8FAFC; color: #0F172A; font-size: 14.5px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
                .custom-select-header:hover:not(.disabled) { border-color: #CBD5E1; }
                .custom-select-header.open { border-color: #3B82F6; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); }
                .custom-select-header.disabled { background-color: #F1F5F9; color: #94A3B8; cursor: not-allowed; border-color: #E2E8F0; }

                .custom-select-dropdown { position: absolute; top: 100%; left: 0; right: 0; margin-top: 8px; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1); z-index: 50; overflow: hidden; transform-origin: top; animation: dropdownSlideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .custom-select-search { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #F1F5F9; background: #F8FAFC; }
                .custom-select-search input { width: 100%; border: none; background: transparent; outline: none; font-size: 14px; margin-left: 10px; color: #0F172A; font-weight: 500; }
                
                .custom-select-list { max-height: 250px; overflow-y: auto; padding: 8px; }
                .custom-select-list::-webkit-scrollbar { width: 6px; }
                .custom-select-list::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
                
                .custom-select-item { padding: 12px 14px; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 500; color: #334155; transition: all 0.15s ease; }
                .custom-select-item:hover { background-color: #F1F5F9; color: #0F172A; }
                .custom-select-item.selected { background-color: #EFF6FF; color: #3B82F6; font-weight: 700; }

                .deploy-btn { padding: 14px 28px; border-radius: 12px; font-weight: 700; font-size: 14.5px; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; transition: all 0.3s ease; border: none; color: white; background: linear-gradient(135deg, #10B981, #059669); box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); overflow: hidden; position: relative; width: 100%; height: 50px; margin-top: 26px; }
                .deploy-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
                .deploy-btn:disabled { background: linear-gradient(135deg, #94A3B8, #64748B); cursor: not-allowed; box-shadow: none; transform: none; }

                .revert-btn { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #F87171; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; }
                .revert-btn:hover { background: rgba(239, 68, 68, 0.2); color: #EF4444; }

                .custom-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out forwards; }
                .custom-modal-box { background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border: 1px solid #334155; border-radius: 20px; padding: 24px 28px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: translateY(20px); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; gap: 16px; }
                .custom-modal-text { color: #E2E8F0; font-size: 15px; line-height: 1.6; margin: 0; font-weight: 500; }
                .custom-modal-btn { background: #3B82F6; color: #FFFFFF; border: none; border-radius: 10px; padding: 10px 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: all 0.2s ease; align-self: flex-end; }
            `}</style>

            {/* --- HEADER --- */}
            <div className="stagger-1" style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', border: '1px solid #E2E8F0', padding: '36px', boxShadow: '0 10px 40px rgba(15, 23, 42, 0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 10px 0', fontSize: '28px', color: '#0F172A', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '14px', letterSpacing: '-0.5px' }}>
                        {/* FIXED ICON CENTERING HERE */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', borderRadius: '14px', color: '#16A34A', border: '1px solid #BBF7D0', flexShrink: 0 }}>
                            <UploadCloud size={26} strokeWidth={2.5} />
                        </div>
                        Model Deployment
                    </h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Select and deploy tested neural network weights to the live inference engine.</p>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'stretch' }}>
                
                {/* --- LIVE MODEL STATUS CARD --- */}
                <div className="stagger-2" style={{ flex: '1.5 1 500px', backgroundColor: '#0F172A', borderRadius: '24px', padding: '40px', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.2)' }}>
                    <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ padding: '12px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '16px', color: '#10B981', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <Server size={28} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '14px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Live Production Model</h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10B981', animation: 'pulseGlow 2s infinite' }}></div>
                                        <span style={{ color: '#10B981', fontSize: '13px', fontWeight: '700', letterSpacing: '0.5px' }}>SYSTEM ACTIVE</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* REVERT BUTTON */}
                            {activeModel && (
                                <button className="revert-btn" onClick={triggerRevert} disabled={isDeploying}>
                                    <RotateCcw size={14} /> Revert to Default
                                </button>
                            )}
                        </div>

                        {isLoading ? (
                            <div style={{ padding: '40px 0', color: '#64748B', fontWeight: '500' }}>Checking deployment status...</div>
                        ) : activeModel ? (
                            <div style={{ marginTop: '32px' }}>
                                <h1 style={{ margin: '0 0 16px 0', fontSize: '36px', color: '#FFFFFF', fontWeight: '900', letterSpacing: '-1px' }}>{activeModel.run_name}</h1>
                                
                                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', backgroundColor: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <p style={{ margin: '0 0 6px 0', color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Architecture</p>
                                        <p style={{ margin: 0, color: '#F8FAFC', fontSize: '15px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}><Layers size={14} color="#8B5CF6"/> {activeModel.model_architecture}</p>
                                    </div>
                                    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                                    <div>
                                        <p style={{ margin: '0 0 6px 0', color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Confidence Score (mAP)</p>
                                        <p style={{ margin: 0, color: '#10B981', fontSize: '18px', fontWeight: '800' }}>{(activeModel.map50_95 * 100).toFixed(1)}%</p>
                                    </div>
                                    <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                                    <div>
                                        <p style={{ margin: '0 0 6px 0', color: '#64748B', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deployed By</p>
                                        <p style={{ margin: 0, color: '#F8FAFC', fontSize: '14px', fontWeight: '600', textTransform: 'capitalize' }}>{activeModel.deployed_by}</p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ marginTop: '32px', backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '24px', borderRadius: '16px', border: '1px dashed rgba(255, 255, 255, 0.2)' }}>
                                <h3 style={{ margin: '0 0 8px 0', color: '#F8FAFC', fontSize: '18px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <ShieldCheck size={20} color="#94A3B8" /> best.pt <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748B' }}>(System Default)</span>
                                </h3>
                                <p style={{ margin: 0, color: '#94A3B8', fontSize: '14px', lineHeight: '1.6' }}>
                                    No custom database deployment found. The inference engine is currently falling back to the physical <strong>best.pt</strong> file in the root directory. Deploy a model below to overwrite this behavior.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* --- DEPLOY NEW MODEL --- */}
                <div className="stagger-2" style={{ flex: '1 1 350px', backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '36px', border: '1px solid #E2E8F0', boxShadow: '0 10px 40px rgba(15, 23, 42, 0.04)' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: '800' }}>
                        <div style={{ padding: '6px', background: '#F1F5F9', borderRadius: '8px', color: '#475569' }}><Zap size={18} /></div>
                        Deploy New Version
                    </h3>
                    <p style={{ margin: '0 0 32px 0', color: '#64748B', fontSize: '14px' }}>Select a successfully trained and validated model to push to the live inference engine. This will overwrite the current live model.</p>
                    
                    <InputWrapper label="Select Trained Weights" icon={Database} isLocked={isDeploying}>
                        <div className="custom-select-wrapper" ref={dropdownRef} style={{ zIndex: isDropdownOpen ? 100 : 1 }}>
                            <div 
                                className={`custom-select-header ${isDropdownOpen ? 'open' : ''} ${isDeploying ? 'disabled' : ''}`}
                                onClick={() => !isDeploying && setIsDropdownOpen(!isDropdownOpen)}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {selectedModelObj ? (
                                        <>
                                            {selectedModelObj.run_name} <span style={{ color: '#94A3B8', fontWeight: '500' }}>({(selectedModelObj.map50_95 * 100).toFixed(1)}% mAP)</span>
                                        </>
                                    ) : 'Choose a model...'}
                                </span>
                                <ChevronDown size={18} color="#64748B" style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }} />
                            </div>
                            
                            {isDropdownOpen && (
                                <div className="custom-select-dropdown">
                                    <div className="custom-select-search">
                                        <Search size={16} color="#94A3B8" />
                                        <input 
                                            type="text" 
                                            placeholder="Search models..." 
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <div className="custom-select-list">
                                        {filteredModels.length === 0 ? (
                                            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '13px', fontWeight: '500' }}>
                                                No eligible models found.
                                            </div>
                                        ) : (
                                            filteredModels.map(m => (
                                                <div 
                                                    key={m.id} 
                                                    className={`custom-select-item ${m.id === selectedModelId ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        setSelectedModelId(m.id);
                                                        setIsDropdownOpen(false);
                                                        setSearchQuery('');
                                                    }}
                                                >
                                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', flexDirection: 'column' }}>
                                                        <span style={{ fontWeight: '600' }}>{m.run_name}</span>
                                                        <span style={{ color: m.id === selectedModelId ? '#3B82F6' : '#94A3B8', fontSize: '12px', marginTop: '2px' }}>
                                                            {m.model_architecture} • {(m.map50_95 * 100).toFixed(1)}% mAP
                                                        </span>
                                                    </span>
                                                    {m.id === selectedModelId && <Check size={18} color="#3B82F6" />}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </InputWrapper>

                    <button 
                        className="deploy-btn"
                        onClick={handleDeploy}
                        disabled={isDeploying || !selectedModelId}
                    >
                        {isDeploying ? <Activity size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                        {isDeploying ? 'Deploying to System...' : 'Deploy to Production'}
                    </button>
                </div>
            </div>

            {/* --- CUSTOM CONFIRM MODAL (PORTAL) --- */}
            {confirmModal.isOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out forwards' }}></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
                        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', color: '#EF4444', animation: 'pulseRed 2s infinite' }}>
                                    {confirmModal.isDelete ? <Trash2 size={28} /> : <AlertTriangle size={28} />}
                                </div>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>{confirmModal.title}</h2>
                                <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>{confirmModal.message}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}>Cancel</button>
                                <button onClick={confirmModal.onConfirm} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}>{confirmModal.isDelete ? "Delete Record" : "Revert System"}</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* --- CUSTOM ALERT MODAL --- */}
            {customAlert.isOpen && createPortal(
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '12px', color: '#3B82F6' }}>
                                <Bell size={24} strokeWidth={2.5} />
                            </div>
                            <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '19px', fontWeight: '800', letterSpacing: '-0.5px' }}>System Alert</h3>
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

export default ModelDeployment;