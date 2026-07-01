import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Trash2, Camera, FolderUp, Edit3, ShieldCheck, CheckCircle2, ChevronLeft, ChevronRight, Bell, Square, AlertTriangle, Eye, X, Filter, ChevronDown, Download, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { API_BASE_URL } from '../config';

const InspectionRecords = () => {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Filters
    const [typeFilter, setTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All');

    // Modals State
    const [customAlert, setCustomAlert] = useState({ isOpen: false, message: '', type: 'info' });
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, rawId: null, recordType: '', target: '' });
    const [viewModal, setViewModal] = useState({ isOpen: false, data: null }); 

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);

    const [modalImageSize, setModalImageSize] = useState({ width: 1, height: 1 });

    // --- New States for Fullscreen Preview ---
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewView, setPreviewView] = useState({ scale: 1, panX: 0, panY: 0 });
    const [isDraggingPreview, setIsDraggingPreview] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    // --- Pan & Zoom Handlers ---
    const handlePreviewMouseDown = (e) => {
        setIsDraggingPreview(true);
        setDragStart({ x: e.clientX - previewView.panX, y: e.clientY - previewView.panY });
    };

    const handlePreviewMouseMove = (e) => {
        if (isDraggingPreview) {
            setPreviewView(p => ({ ...p, panX: e.clientX - dragStart.x, panY: e.clientY - dragStart.y }));
        }
    };

    const handlePreviewMouseUp = () => setIsDraggingPreview(false);
    const resetPreview = () => setPreviewView({ scale: 1, panX: 0, panY: 0 });
    
    const dropdownRef = useRef(null);
    const statusDropdownRef = useRef(null);

    useEffect(() => {
        fetchRecords();
    }, []);

    useEffect(() => {
        setCurrentPage(1); 
    }, [searchQuery, typeFilter, statusFilter, itemsPerPage]);

    // Handle outside clicks for dropdowns
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsDropdownOpen(false);
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target)) setIsStatusDropdownOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const showMessage = (message, type = 'info') => setCustomAlert({ isOpen: true, message, type });

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/inspection-records/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (response.ok) {
                setRecords(data);
            } else {
                showMessage(`Backend Error: ${data.error || 'Failed to fetch records'}`, 'error');
            }
        } catch (error) {
            console.error("Failed to fetch inspection records:", error);
            showMessage("Network Error: Could not connect to Django server.", 'error');
        } finally {
            setTimeout(() => setIsLoading(false), 400);
        }
    };

    const triggerDelete = (record) => {
        const typeMap = { 'Live Inspection': 'live', 'Batch Processing': 'batch', 'Manual Correction': 'label' };
        setConfirmModal({ isOpen: true, id: record.id, rawId: record.raw_id, recordType: typeMap[record.record_type], target: record.target });
    };

    const confirmDelete = async () => {
        const { id, rawId, recordType } = confirmModal;
        setConfirmModal({ isOpen: false, id: null, rawId: null, recordType: '', target: '' }); 
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/inspection-records/${recordType}/${rawId}/delete/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                setRecords(prev => prev.filter(r => r.id !== id));
                showMessage("Record permanently deleted.", 'success');
            } else {
                showMessage("Failed to delete record.", 'error');
            }
        } catch (error) {
            showMessage("Network error while trying to delete.", 'error');
        }
    };

    const exportToCSV = () => {
        if (records.length === 0) return;
        const headers = ['Timestamp', 'Personnel', 'Role', 'Record Type', 'Target', 'Result Summary', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredRecords.map(r => 
                `"${r.timestamp}","${r.user}","${r.role}","${r.record_type}","${r.target}","${r.result_summary}","${r.status}"`
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Inspection_Records_${new Date().getTime()}.csv`;
        link.click();
    };

    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const query = (searchQuery || '').toLowerCase();
            
            // FIXED: Expanded search functionality to scan EVERY visible column including Timestamp
            const matchesSearch = 
                (record.user || '').toLowerCase().includes(query) || 
                (record.target || '').toLowerCase().includes(query) ||
                (record.result_summary || '').toLowerCase().includes(query) ||
                (record.timestamp || '').toLowerCase().includes(query) ||
                (record.record_type || '').toLowerCase().includes(query) ||
                (record.status || '').toLowerCase().includes(query);
            
            let matchesType = true;
            if (typeFilter !== 'All') {
                if (typeFilter === 'Live') matchesType = record.record_type === 'Live Inspection';
                if (typeFilter === 'Batch') matchesType = record.record_type === 'Batch Processing';
                if (typeFilter === 'Manual') matchesType = record.record_type === 'Manual Correction';
            }

            const matchesStatus = statusFilter === 'All' || record.status === statusFilter;

            return matchesSearch && matchesType && matchesStatus;
        });
    }, [records, searchQuery, typeFilter, statusFilter]);

    const totalItems = filteredRecords.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

    const getTypeIcon = (type) => {
        switch(type) {
            case 'Live Inspection': return <Camera size={16} color="#3B82F6" />;
            case 'Batch Processing': return <FolderUp size={16} color="#F59E0B" />;
            case 'Manual Correction': return <Edit3 size={16} color="#8B5CF6" />;
            default: return <ShieldCheck size={16} color="#64748B" />;
        }
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 'Detected': return { bg: '#FEF2F2', text: '#EF4444', border: '#FCA5A5' };
            case 'Completed': return { bg: '#F0FDF4', text: '#10B981', border: '#A7F3D0' };
            case 'Compiled': return { bg: '#EFF6FF', text: '#3B82F6', border: '#BFDBFE' };
            case 'Pending': return { bg: '#FFFBEB', text: '#F59E0B', border: '#FDE68A' };
            default: return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' };
        }
    };

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes spin { 100% { transform: rotate(360deg); } }

                
                
                .record-card { background: #FFFFFF; border-radius: 24px; border: 1px solid #E2E8F0; box-shadow: 0 10px 40px -10px rgba(15, 23, 42, 0.05); position: relative; transition: all 0.3s ease; }
                
                .rec-row { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border-bottom: 1px solid #E2E8F0; background: #FFFFFF; opacity: 0; animation: fadeSlideIn 0.4s ease forwards; }
                .rec-row:hover { background: #F8FAFC; transform: translateY(-2px); box-shadow: 0 8px 20px -6px rgba(15, 23, 42, 0.08); z-index: 10; position: relative; }
                
                .search-input-box { display: flex; align-items: center; background-color: #FFFFFF; padding: 10px 16px; border-radius: 12px; border: 1px solid #E2E8F0; width: 320px; transition: all 0.3s ease; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); }
                .search-input-box:focus-within { border-color: #10B981; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }
                
                .action-btn { background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748B; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); display: inline-flex; }
                .btn-view:hover { color: #3B82F6; background-color: #EFF6FF; border-color: #BFDBFE; transform: translateY(-2px); }
                .btn-delete:hover { color: #EF4444; background-color: #FEF2F2; border-color: #FCA5A5; transform: translateY(-2px); }

                /* Custom Select Dropdowns */
                .status-dropdown { position: absolute; top: calc(100% + 8px); left: 0; width: 160px; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.1); z-index: 100; overflow: hidden; transform-origin: top left; animation: fadeSlideIn 0.2s ease forwards; }
                .status-dropdown-item { padding: 10px 16px; font-size: 13px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; }
                .status-dropdown-item:hover { background: #F1F5F9; color: #0F172A; }

                /* Modals */
                .custom-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out forwards; }
                .custom-modal-box { background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); border: 1px solid #334155; border-radius: 20px; padding: 24px 28px; width: 90%; max-width: 400px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: translateY(20px); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; gap: 16px; }
                
                .view-modal-box { background: #FFFFFF; border-radius: 24px; padding: 32px; width: 90%; max-width: 500px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3); transform: translateY(20px); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; display: flex; flex-direction: column; gap: 20px; }
            `}</style>

            {/* --- NEW CREATIVE HEADER --- */}
            {/* FIXED: Added zIndex: 20 here so the header (and its dropdowns) float ABOVE the table card below it! */}
            <div className="record-card" style={{ animation: 'slideUp 0.4s ease forwards', padding: '32px 40px', zIndex: 20 }}>
                {/* Background Orbs */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: '24px', overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', right: '-5%', top: '-50%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                    <div style={{ position: 'absolute', left: '30%', bottom: '-50%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)', borderRadius: '50%' }}></div>
                </div>

                <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                    
                    {/* Top Row: Title & Export Button */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', borderRadius: '16px', color: '#FFFFFF', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.25)' }}>
                                <ShieldCheck size={30} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>
                                    Inspection Records
                                </h2>
                                <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Unified timeline of live scans, batch processes, and manual label corrections.</p>
                            </div>
                        </div>

                        <button 
                            onClick={exportToCSV} 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)' }} 
                            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} 
                            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <Download size={16} /> Export Report
                        </button>
                    </div>

                    <div style={{ height: '1px', backgroundColor: '#E2E8F0', margin: '24px 0' }}></div>

                    {/* Bottom Row: Control Dock (Filters & Search) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '16px', border: '1px solid #E2E8F0' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            {/* Type Filter Pills */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {['All', 'Live', 'Batch', 'Manual'].map(type => (
                                    <button
                                        key={type} onClick={() => setTypeFilter(type)}
                                        style={{
                                            padding: '8px 16px', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease',
                                            backgroundColor: typeFilter === type ? '#FFFFFF' : 'transparent', 
                                            color: typeFilter === type ? '#0F172A' : '#64748B',
                                            boxShadow: typeFilter === type ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <div style={{ width: '1px', height: '24px', backgroundColor: '#CBD5E1', margin: '0 4px' }}></div>

                            {/* Status Dropdown Filter */}
                            {/* FIXED: Ensured local z-index elevates the dropdown container specifically when open */}
                            <div style={{ position: 'relative', zIndex: isStatusDropdownOpen ? 100 : 1 }} ref={statusDropdownRef}>
                                <button 
                                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', color: '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#CBD5E1'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                                >
                                    <Filter size={14} color="#64748B"/>
                                    {statusFilter === 'All' ? 'All Statuses' : statusFilter}
                                    <ChevronDown size={14} style={{ transition: 'transform 0.3s', transform: isStatusDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                </button>
                                {isStatusDropdownOpen && (
                                    <div className="status-dropdown">
                                        {['All', 'Detected', 'Completed', 'Compiled', 'Pending'].map(status => (
                                            <div key={status} className="status-dropdown-item" onClick={() => { setStatusFilter(status); setIsStatusDropdownOpen(false); }}>
                                                {status === 'All' ? 'All Statuses' : status}
                                                {statusFilter === status && <CheckCircle2 size={14} color="#10B981" />}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="search-input-box">
                            <Search size={16} color="#94A3B8" />
                            <input 
                                type="text" placeholder="Search targets, dates, summaries..." 
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} 
                                style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13.5px', color: '#1E293B', marginLeft: '10px', width: '100%', fontWeight: '600' }} 
                            />
                        </div>

                    </div>
                </div>
            </div>

            {/* --- MAIN TABLE --- */}
            {/* The table intentionally has z-index lower than the header card */}
            <div className="record-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.4s ease forwards 0.1s', opacity: 0, overflow: 'hidden', zIndex: 10 }}>
                <div style={{ overflowX: 'auto', minHeight: '400px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                            <tr>
                                <th style={{ padding: '20px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date & Time</th>
                                <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Record Type</th>
                                <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Subject</th>
                                <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Result Summary</th>
                                <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                                <th style={{ padding: '20px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personnel</th>
                                <th style={{ padding: '20px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan="7" style={{ padding: '80px', textAlign: 'center' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}><div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#10B981', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div><span style={{ color: '#94A3B8', fontWeight: '600', fontSize: '14px' }}>Loading Database Records...</span></div></td></tr>
                            ) : paginatedRecords.length === 0 ? (
                                <tr><td colSpan="7" style={{ padding: '80px', textAlign: 'center' }}><ShieldCheck size={48} color="#CBD5E1" style={{ marginBottom: '12px' }}/><h3 style={{ margin: '0 0 4px 0', color: '#334155', fontSize: '18px' }}>No Records Found</h3><p style={{ margin: 0, color: '#94A3B8', fontSize: '14px' }}>Try adjusting your filters or executing an inspection.</p></td></tr>
                            ) : (
                                paginatedRecords.map((record, index) => {
                                    const statStyle = getStatusStyle(record.status);
                                    return (
                                        <tr key={record.id} className="rec-row" style={{ animationDelay: `${index * 0.05}s` }}>
                                            <td style={{ padding: '20px 32px', color: '#64748B', fontSize: '13.5px', fontWeight: '500' }}>{record.timestamp}</td>
                                            
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', backgroundColor: '#F8FAFC', borderRadius: '8px', width: 'fit-content', border: '1px solid #E2E8F0' }}>
                                                    {getTypeIcon(record.record_type)}
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{record.record_type}</span>
                                                </div>
                                            </td>

                                            <td style={{ padding: '20px 24px', fontSize: '14px', color: '#0F172A', fontWeight: '700' }}>{record.target}</td>
                                            <td style={{ padding: '20px 24px', fontSize: '13.5px', color: '#334155', fontWeight: '500' }}>{record.result_summary}</td>
                                            
                                            <td style={{ padding: '20px 24px' }}>
                                                <span style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: statStyle.bg, color: statStyle.text, border: `1px solid ${statStyle.border}`, fontSize: '11.5px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                                    {record.status}
                                                </span>
                                            </td>

                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '11px', lineHeight: 1, paddingTop: '1px', color: '#475569', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', flexShrink: 0 }}>
                                                        {(record.user && record.user !== 'System') ? record.user.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'SY'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#0F172A' }}>{record.user}</div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button onClick={() => setViewModal({ isOpen: true, data: record })} className="action-btn btn-view" title="View Details">
                                                        <Eye size={16} />
                                                    </button>
                                                    <button onClick={() => triggerDelete(record)} className="action-btn btn-delete" title="Delete Record">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- ROWS PER PAGE & PAGINATION --- */}
                {!isLoading && filteredRecords.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>ROWS PER PAGE</span>
                            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#FFFFFF', borderRadius: '10px', border: `2px solid ${isDropdownOpen ? '#10B981' : '#E2E8F0'}`, color: '#0F172A', fontSize: '14px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                                {itemsPerPage < 10 ? `0${itemsPerPage}` : itemsPerPage}
                                <ChevronDown size={14} style={{ transition: 'transform 0.3s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94A3B8' }} />
                            </button>

                            {isDropdownOpen && (
                                <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', right: 0, left: '95px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '6px', boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', zIndex: 50, animation: 'fadeSlideIn 0.2s ease forwards' }}>
                                    {[5, 10, 25, 50].map(num => (
                                        <div key={num} onClick={() => { setItemsPerPage(num); setIsDropdownOpen(false); }} style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600', backgroundColor: itemsPerPage === num ? '#F0FDF4' : 'transparent', color: itemsPerPage === num ? '#10B981' : '#475569', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = '#F8FAFC'; }} onMouseLeave={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = 'transparent'; }}>
                                            {num < 10 ? `0${num}` : num}
                                            {itemsPerPage === num && <CheckCircle2 size={14} color="#10B981" />}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                                <span style={{ backgroundColor: '#F1F5F9', color: '#0F172A', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}>{startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalItems)}</span>
                                of <span style={{ color: '#0F172A', fontWeight: '700' }}>{totalItems}</span>
                            </div>

                            <div style={{ display: 'flex', backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '4px', border: '1px solid #E2E8F0' }}>
                                <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', backgroundColor: currentPage === 1 ? 'transparent' : '#FFFFFF', color: currentPage === 1 ? '#94A3B8' : '#0F172A', fontSize: '13px', fontWeight: '700', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: currentPage === 1 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#10B981'; } }} onMouseLeave={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#0F172A'; } }}>
                                    <ChevronLeft size={16}/> Prev
                                </button>
                                <div style={{ width: '1px', backgroundColor: '#E2E8F0', margin: '4px 4px' }}></div>
                                <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} style={{ padding: '6px 16px', borderRadius: '8px', border: 'none', backgroundColor: currentPage === totalPages || totalPages === 0 ? 'transparent' : '#FFFFFF', color: currentPage === totalPages || totalPages === 0 ? '#94A3B8' : '#0F172A', fontSize: '13px', fontWeight: '700', cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: currentPage === totalPages || totalPages === 0 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }} onMouseEnter={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#10B981'; } }} onMouseLeave={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#0F172A'; } }}>
                                    Next <ChevronRight size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- CUSTOM ALERT MODAL --- */}
            {customAlert.isOpen && createPortal(
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', background: customAlert.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : customAlert.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)', border: `1px solid ${customAlert.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : customAlert.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)'}`, borderRadius: '10px', color: customAlert.type === 'error' ? '#EF4444' : customAlert.type === 'success' ? '#10B981' : '#3B82F6' }}>
                                {customAlert.type === 'error' ? <AlertTriangle size={22} /> : customAlert.type === 'success' ? <CheckCircle2 size={22} /> : <Bell size={22} />}
                            </div>
                            <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: '18px', fontWeight: '700', letterSpacing: '0.5px' }}>
                                {customAlert.type === 'error' ? 'System Error' : customAlert.type === 'success' ? 'Success' : 'System Message'}
                            </h3>
                        </div>
                        <p style={{ color: '#E2E8F0', fontSize: '15px', lineHeight: '1.6', margin: 0, fontWeight: '500' }}>{customAlert.message}</p>
                        <button onClick={() => setCustomAlert({ isOpen: false, message: '', type: 'info' })} style={{ background: customAlert.type === 'error' ? '#EF4444' : customAlert.type === 'success' ? '#10B981' : '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '10px 24px', fontWeight: '700', fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease', alignSelf: 'flex-end' }}>Acknowledge</button>
                    </div>
                </div>,
                document.body
            )}

            {/* --- VIEW DETAILS MODAL --- */}
            {viewModal.isOpen && viewModal.data && createPortal(
                <>
                    {/* 1. STANDARD SMALL MODAL */}
                    <div className="custom-modal-overlay">
                        <div 
                            onClick={() => { setViewModal({ isOpen: false, data: null }); setModalImageSize({ width: 1, height: 1 }); }} 
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }}
                        ></div>

                        <div className="view-modal-box custom-scrollbar" style={{ position: 'relative', zIndex: 1, maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
                            {/* Modal Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: '14px', color: '#475569', border: '1px solid #E2E8F0', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                        {getTypeIcon(viewModal.data.record_type)}
                                    </div>
                                    <div>
                                        <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>Inspection Details</h3>
                                        <p style={{ margin: 0, color: '#64748B', fontSize: '13.5px', fontWeight: '600' }}>ID: {viewModal.data.id}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setViewModal({ isOpen: false, data: null }); setModalImageSize({ width: 1, height: 1 }); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#F1F5F9', border: 'none', borderRadius: '50%', color: '#64748B', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}>
                                    <X size={18} />
                                </button>
                            </div>
                            
                            {/* Annotated Image Viewer (Clickable) */}
                            {viewModal.data.image_url && (
                                <div 
                                    onClick={() => { setIsPreviewOpen(true); resetPreview(); }}
                                    style={{ 
                                        display: 'flex', 
                                        justifyContent: 'center', 
                                        alignItems: 'center', /* <-- ADDED to keep it centered */
                                        backgroundColor: '#0F172A', 
                                        borderRadius: '16px', 
                                        padding: '16px', 
                                        /* overflow: 'hidden', <-- REMOVED THIS LINE so it doesn't crop */
                                        cursor: 'zoom-in', 
                                        transition: 'box-shadow 0.2s' 
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.3)'}
                                    onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                                    title="Click to expand"
                                >
                                    {/* Changed display to inline-flex to perfectly hug the image */}
                                    <div style={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
                                        <img 
                                            src={viewModal.data.image_url} 
                                            alt="Target" 
                                            style={{ 
                                                display: 'block', 
                                                maxWidth: '100%', 
                                                maxHeight: '280px',  /* slightly smaller to ensure no scrolling */
                                                width: 'auto', 
                                                height: 'auto', 
                                                objectFit: 'contain', /* <-- ADDED to safeguard the aspect ratio */
                                                borderRadius: '8px' 
                                            }} 
                                            onLoad={(e) => setModalImageSize({ width: e.target.naturalWidth, height: e.target.naturalHeight })}
                                        />
                                        
                                        {/* Dynamic Bounding Boxes */}
                                        {viewModal.data.details && viewModal.data.details.map((defect, idx) => {
                                            const boxColor = viewModal.data.record_type === 'Live Inspection' ? '#EF4444' : '#3B82F6';
                                            const left = (defect.box[0] / modalImageSize.width) * 100;
                                            const top = (defect.box[1] / modalImageSize.height) * 100;
                                            const width = ((defect.box[2] - defect.box[0]) / modalImageSize.width) * 100;
                                            const height = ((defect.box[3] - defect.box[1]) / modalImageSize.height) * 100;
                                            
                                            return (
                                                <div key={idx} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, border: `2px solid ${boxColor}`, backgroundColor: `${boxColor}25`, pointerEvents: 'none' }}>
                                                    <span style={{ position: 'absolute', top: '-22px', left: '-2px', backgroundColor: boxColor, color: '#FFF', fontSize: '11px', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                                                        {defect.label} {defect.confidence ? `${defect.confidence}%` : ''}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Batch Processing Chart Viewer */}
                            {viewModal.data.record_type === 'Batch Processing' && viewModal.data.details && viewModal.data.details.length > 0 && (
                                <div style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '24px', border: '1px solid #E2E8F0', marginBottom: '20px', boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)' }}>
                                    
                                    {/* CSS Animation specifically for the chart bars */}
                                    <style>{`
                                        @keyframes scaleBarIn {
                                            from { transform: scaleX(0); opacity: 0; }
                                            to { transform: scaleX(1); opacity: 1; }
                                        }
                                    `}</style>

                                    {/* Chart Header */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                        <h4 style={{ margin: 0, fontSize: '13px', color: '#0F172A', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <FolderUp size={16} color="#F59E0B" /> Defect Distribution
                                        </h4>
                                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748B', backgroundColor: '#FFFBEB', padding: '4px 10px', borderRadius: '8px', border: '1px solid #FDE68A' }}>
                                            Total Anomalies: <span style={{ color: '#F59E0B', marginLeft: '2px', fontWeight: '800' }}>{viewModal.data.details.reduce((sum, item) => sum + item.count, 0)}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Chart Bars */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                        {(() => {
                                            // Find the highest count to scale the bars perfectly
                                            const maxCount = Math.max(...viewModal.data.details.map(d => d.count));
                                            
                                            return viewModal.data.details.map((item, idx) => {
                                                const widthPct = maxCount === 0 ? 0 : (item.count / maxCount) * 100;
                                                
                                                return (
                                                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        
                                                        {/* Label */}
                                                        <div style={{ width: '120px', fontSize: '13.5px', fontWeight: '600', color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }} title={item.label}>
                                                            {item.label}
                                                        </div>
                                                        
                                                        {/* Bar Track */}
                                                        <div style={{ flex: 1, height: '14px', backgroundColor: '#F1F5F9', borderRadius: '8px', overflow: 'hidden', display: 'flex', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)' }}>
                                                            {/* Animated Gradient Bar Fill (Matched to Batch Amber Theme) */}
                                                            <div style={{ 
                                                                width: `${widthPct}%`, 
                                                                height: '100%', 
                                                                background: 'linear-gradient(90deg, #FBBF24 0%, #F59E0B 100%)', 
                                                                borderRadius: '8px', 
                                                                transformOrigin: 'left',
                                                                transform: 'scaleX(0)', // Starts invisible
                                                                animation: `scaleBarIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${idx * 0.08}s forwards`, // Cascading delay
                                                                boxShadow: '0 2px 4px rgba(245, 158, 11, 0.25)'
                                                            }}></div>
                                                        </div>
                                                        
                                                        {/* Value Pill Badge */}
                                                        <div style={{ width: '48px', display: 'flex', justifyContent: 'flex-start' }}>
                                                            <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', backgroundColor: '#F8FAFC', padding: '4px 10px', borderRadius: '8px', border: '1px solid #E2E8F0', minWidth: '24px', textAlign: 'center', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                                                {item.count}
                                                            </span>
                                                        </div>

                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Metadata Text Container */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', padding: '20px', border: '1px solid #E2E8F0' }}>
                                <div>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Subject</p>
                                    <p style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>{viewModal.data.target}</p>
                                </div>
                                <div style={{ height: '1px', backgroundColor: '#E2E8F0' }}></div>
                                <div>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Defect Breakdown</p>
                                    <p style={{ margin: 0, fontSize: '15px', color: '#334155', fontWeight: '600', lineHeight: '1.5' }}>{viewModal.data.result_summary}</p>
                                </div>
                                <div style={{ height: '1px', backgroundColor: '#E2E8F0' }}></div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</p>
                                        <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', fontWeight: '600' }}>{viewModal.data.timestamp}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Executed By</p>
                                        <p style={{ margin: 0, fontSize: '13.5px', color: '#475569', fontWeight: '600' }}>{viewModal.data.user}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. FULLSCREEN INTERACTIVE PREVIEW MODAL */}
                    {isPreviewOpen && (
                        <div 
                            className="custom-modal-overlay" 
                            style={{ zIndex: 99999, backgroundColor: 'rgba(15, 23, 42, 0.98)', flexDirection: 'column' }}
                            onWheel={(e) => {
                                // Prevent the browser background from scrolling
                                e.preventDefault();
                                
                                const scaleAdjust = e.deltaY < 0 ? 1.15 : 0.85;
                                
                                setPreviewView(prev => {
                                    // Calculate the new scale, capped between 0.5x and 10x
                                    const newScale = Math.max(0.5, Math.min(prev.scale * scaleAdjust, 10));
                                    
                                    // Get the exact center of the viewport
                                    const centerX = window.innerWidth / 2;
                                    const centerY = window.innerHeight / 2;
                                    
                                    // Calculate mouse coordinates relative to the screen center
                                    const mouseX = e.clientX - centerX;
                                    const mouseY = e.clientY - centerY;
                                    
                                    // The Magic Math: Offset the panning by the exact distance the 
                                    // image visually expanded/shrank under the mouse cursor
                                    const newPanX = mouseX - (mouseX - prev.panX) * (newScale / prev.scale);
                                    const newPanY = mouseY - (mouseY - prev.panY) * (newScale / prev.scale);
                                    
                                    return { 
                                        scale: newScale, 
                                        panX: newPanX, 
                                        panY: newPanY 
                                    };
                                });
                            }}
                            onMouseDown={handlePreviewMouseDown}
                            onMouseMove={handlePreviewMouseMove}
                            onMouseUp={handlePreviewMouseUp}
                            onMouseLeave={handlePreviewMouseUp}
                        >
                            {/* Floating Toolbar */}
                            <div style={{ position: 'absolute', top: '24px', right: '32px', display: 'flex', gap: '16px', zIndex: 100000 }}>
                                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)', borderRadius: '12px', padding: '6px', border: '1px solid rgba(255,255,255,0.2)' }}>
                                    <button onClick={resetPreview} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} title="Reset View">
                                        <Maximize size={20} />
                                    </button>
                                    <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '4px 8px' }}></div>
                                    <button onClick={() => setPreviewView(p => ({...p, scale: Math.max(0.5, p.scale - 0.2)}))} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <ZoomOut size={20} />
                                    </button>
                                    <span style={{ color: '#FFF', display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: '15px', fontWeight: '700', userSelect: 'none' }}>
                                        {Math.round(previewView.scale * 100)}%
                                    </span>
                                    <button onClick={() => setPreviewView(p => ({...p, scale: Math.min(10, p.scale + 0.2)}))} style={{ background: 'transparent', border: 'none', color: '#FFF', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                        <ZoomIn size={20} />
                                    </button>
                                </div>
                                <button onClick={() => setIsPreviewOpen(false)} style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', cursor: 'pointer', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.4)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.2)'} title="Close Preview">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Pannable & Zoomable Canvas */}
                            <div style={{ 
                                transform: `translate(${previewView.panX}px, ${previewView.panY}px) scale(${previewView.scale})`,
                                transition: isDraggingPreview ? 'none' : 'transform 0.1s',
                                cursor: isDraggingPreview ? 'grabbing' : 'grab',
                                position: 'relative',
                                display: 'flex',
                                userSelect: 'none'
                            }}>
                                <img src={viewModal.data.image_url} alt="Fullscreen Preview" style={{ maxHeight: '85vh', maxWidth: '90vw', borderRadius: '8px', pointerEvents: 'none' }} />
                                
                                {/* Exact same bounding boxes, automatically scaled by CSS */}
                                {viewModal.data.details && viewModal.data.details.map((defect, idx) => {
                                    const boxColor = viewModal.data.record_type === 'Live Inspection' ? '#EF4444' : '#3B82F6';
                                    const left = (defect.box[0] / modalImageSize.width) * 100;
                                    const top = (defect.box[1] / modalImageSize.height) * 100;
                                    const width = ((defect.box[2] - defect.box[0]) / modalImageSize.width) * 100;
                                    const height = ((defect.box[3] - defect.box[1]) / modalImageSize.height) * 100;
                                    
                                    return (
                                        <div key={idx} style={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%`, border: `2px solid ${boxColor}`, backgroundColor: `${boxColor}25`, pointerEvents: 'none' }}>
                                            <span style={{ position: 'absolute', top: '-24px', left: '-2px', backgroundColor: boxColor, color: '#FFF', fontSize: '12px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
                                                {defect.label} {defect.confidence ? `${defect.confidence}%` : ''}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </>,
                document.body
            )}

            {/* --- CUSTOM CONFIRM MODAL FOR DELETE --- */}
            {confirmModal.isOpen && createPortal(
                <div className="custom-modal-overlay">
                    <div 
                        onClick={() => setConfirmModal({ isOpen: false, id: null, rawId: null, recordType: '', target: '' })} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' }}
                    ></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
                        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', color: '#EF4444', animation: 'pulse-ring-danger 2s infinite' }}><Square size={28} fill="currentColor" /></div>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Confirm Deletion</h2>
                                <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>Are you sure you want to permanently delete the inspection record for <strong style={{ color: '#0F172A' }}>'{confirmModal.target}'</strong>?</p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button onClick={() => setConfirmModal({ isOpen: false, id: null, rawId: null, recordType: '', target: '' })} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}>Cancel</button>
                                <button onClick={confirmDelete} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}>Delete Record</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default InspectionRecords;