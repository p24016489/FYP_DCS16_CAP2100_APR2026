import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Layers, Clock, CheckCircle2, AlertTriangle, Eye, Trash2, Search, Database, BarChart2, ShieldCheck, Activity, Focus, Crosshair, X, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { API_BASE_URL } from '../config';

const ValidationRecords = () => {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, runName: '' });
    const [metricsModal, setMetricsModal] = useState({ isOpen: false, data: null });

    // Filtering and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    useEffect(() => {
        fetchRecords();
    }, []);

    // Reset to page 1 when search or filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, statusFilter, rowsPerPage]);

    const fetchRecords = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE_URL}/api/validation-runs/`, { 
                headers: { 'Authorization': `Bearer ${token}` } 
            });
            if (res.ok) {
                const data = await res.json();
                setRecords(data);
            }
        } catch (e) { 
            console.error("Error fetching records:", e); 
        } finally {
            setTimeout(() => setIsLoading(false), 600); // Slight delay for smooth animation
        }
    };

    const handleViewMetrics = async (id) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/validation-runs/${id}/details/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                const chartData = [
                    { name: 'mAP 50-95', value: data.metrics.mAP50_95, color: 'url(#colorMap5095)' },
                    { name: 'mAP 50', value: data.metrics.mAP50, color: 'url(#colorMap50)' },
                    { name: 'Precision', value: data.metrics.precision, color: 'url(#colorPrecision)' },
                    { name: 'Recall', value: data.metrics.recall, color: 'url(#colorRecall)' }
                ];

                setMetricsModal({ isOpen: true, data: { ...data, chartData } });
            } else {
                alert("Failed to fetch detailed metrics for this run.");
            }
        } catch (error) {
            alert("Network error while trying to fetch metrics.");
        }
    };

    const triggerDelete = (id, runName) => {
        setConfirmModal({ isOpen: true, id, runName });
    };

    const confirmDelete = async () => {
        const { id } = confirmModal;
        setConfirmModal({ isOpen: false, id: null, runName: '' }); 
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/validation-runs/${id}/delete/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                setRecords(prev => prev.filter(record => record.id !== id));
            } else {
                alert("Failed to delete record.");
            }
        } catch (error) {
            alert("Network error while trying to delete.");
        }
    };

    // --- FILTER, SEARCH, & PAGINATION LOGIC ---
    const filteredAndSortedRecords = useMemo(() => {
        let result = [...records];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(record => 
                record.run_name?.toLowerCase().includes(query) || 
                record.dataset_name?.toLowerCase().includes(query) ||
                record.model_name?.toLowerCase().includes(query) ||
                record.executed_by?.toLowerCase().includes(query) ||
                record.start_time?.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== 'All') {
            result = result.filter(record => record.status === statusFilter);
        }

        return result;
    }, [records, searchQuery, statusFilter]);

    const totalItems = filteredAndSortedRecords.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedRecords = filteredAndSortedRecords.slice(startIndex, startIndex + rowsPerPage);

    // Helpers
    const getMetricDetails = (val) => {
        if (val >= 0.85) return { color: '#10B981', shadow: 'rgba(16, 185, 129, 0.2)' };
        if (val >= 0.60) return { color: '#F59E0B', shadow: 'rgba(245, 158, 11, 0.2)' };
        return { color: '#EF4444', shadow: 'rgba(239, 68, 68, 0.2)' };
    };

    const renderAvatar = (name) => {
        const initials = (name && name !== 'System') 
            ? name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase()                  
            : 'SY';
            
        return <div className="vr-avatar">{initials}</div>;
    };

    const SkeletonRow = () => (
        <tr className="vr-skeleton-row">
            <td style={{ padding: '20px 32px' }}><div className="vr-skeleton vr-skel-icon-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="vr-skeleton vr-skel-text-double"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="vr-skeleton vr-skel-badge"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="vr-skeleton vr-skel-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="vr-skeleton vr-skel-avatar-text"></div></td>
            <td style={{ padding: '20px 32px', textAlign: 'right' }}><div className="vr-skeleton vr-skel-actions" style={{ marginLeft: 'auto' }}></div></td>
        </tr>
    );

    return (
        <div className="vr-page-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .vr-page-wrapper {
                    width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px;
                    animation: fadeIn 0.4s ease-out;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                
                @keyframes pulse-ring-danger { 
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 
                    70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); } 
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } 
                }

                .stagger-1 { animation: slideUp 0.4s ease forwards 0.1s; opacity: 0; }
                .stagger-2 { animation: slideUp 0.4s ease forwards 0.2s; opacity: 0; }

                .vr-top-card {
                    display: flex; justify-content: space-between; align-items: center; background-color: #FFFFFF;
                    padding: 24px 32px; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); position: relative; z-index: 20; flex-wrap: wrap; gap: 16px;
                }

                .vr-controls-group { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

                .vr-search-box {
                    display: flex; align-items: center; background-color: #F8FAFC; padding: 12px 20px;
                    border-radius: 14px; border: 2px solid #E2E8F0; width: 320px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .vr-search-box:focus-within { border-color: #3B82F6; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
                .vr-search-input { border: none; background: transparent; outline: none; font-size: 14.5px; color: #1E293B; margin-left: 12px; width: 100%; font-weight: 500; }

                .vr-table-container {
                    background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); display: flex; flex-direction: column; overflow: hidden;
                }
                .vr-table-scroll-area { overflow-x: auto; }
                
                .vr-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; min-width: 900px; }
                .vr-table th { padding: 20px 24px; background: #F8FAFC; border-bottom: 2px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .vr-table th:first-child { padding-left: 32px; }
                .vr-table th:last-child { padding-right: 32px; }

                .vr-row {
                    opacity: 0; animation: slideUpFade 0.4s ease forwards; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
                }
                @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                
                .vr-row:hover { background-color: #F8FAFC; transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05); z-index: 10; }
                .vr-row td { transition: all 0.3s ease; }
                .vr-row td:first-child { box-shadow: inset 4px 0 0 0 transparent; }
                .vr-row:hover td:first-child { box-shadow: inset 4px 0 0 0 #3B82F6; }

                .vr-author-cell { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: #334155; }
                .vr-avatar {
                    width: 28px; height: 28px; border-radius: 50%; background: #F1F5F9; color: #475569;
                    border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; line-height: 1; padding-top: 1px;
                }

                .vr-actions { display: inline-flex; align-items: center; gap: 8px; }
                .vr-action-btn {
                    padding: 10px; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 10px; color: #64748B;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .vr-btn-view:hover:not(:disabled) { color: #3B82F6; background: #EFF6FF; border-color: #BFDBFE; transform: translateY(-2px); }
                .vr-btn-del:hover { color: #EF4444; background: #FEF2F2; border-color: #FCA5A5; transform: translateY(-2px); }
                .vr-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Status Pills */
                .status-pill { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px; }
                .status-success { background-color: #F0FDF4; color: #15803D; border: 1px solid #DCFCE7; }
                .status-failed { background-color: #FEF2F2; color: #DC2626; border: 1px solid #FCA5A5; }
                .status-validating { background-color: #EFF6FF; color: #2563EB; border: 1px solid #BFDBFE; }

                /* Modal Specific Styles */
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

                /* Skeletons */
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .vr-skeleton { background: #E2E8F0; border-radius: 6px; animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                .vr-skel-icon-text { width: 180px; height: 32px; }
                .vr-skel-text-double { width: 140px; height: 32px; }
                .vr-skel-badge { width: 90px; height: 28px; border-radius: 999px; }
                .vr-skel-text { width: 60px; height: 20px; }
                .vr-skel-avatar-text { width: 100px; height: 28px; border-radius: 14px; }
                .vr-skel-actions { width: 90px; height: 38px; border-radius: 10px; }
            `}} />

            {/* Top Action Bar */}
            <div className="vr-top-card stagger-1">
                <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '200px', background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.03))', pointerEvents: 'none', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}></div>
                
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '10px', color: '#3B82F6' }}>
                            <Target size={20} />
                        </div>
                        Validation Records
                        <span style={{ padding: '4px 12px', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', color: '#334155', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.05)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ color: '#3B82F6', marginRight: '6px', fontSize: '14px' }}>#</span>
                            {filteredAndSortedRecords.length} RUNS
                        </span>
                    </h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Manage, view, and audit historical model validation performances.</p>
                </div>
                
                <div className="vr-controls-group">
                    {/* Interactive Status Pill Filter */}
                    <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        {['All', 'Success', 'Validating', 'Failed'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                style={{
                                    padding: '8px 16px', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s ease',
                                    backgroundColor: statusFilter === status ? '#FFFFFF' : 'transparent',
                                    color: statusFilter === status ? '#0F172A' : '#64748B',
                                    boxShadow: statusFilter === status ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                {status}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="vr-search-box">
                        <Search size={18} color="#94A3B8" />
                        <input 
                            type="text" 
                            placeholder="Search runs, models, datasets..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="vr-search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="vr-table-container stagger-2">
                <div className="vr-table-scroll-area">
                    <table className="vr-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '32px' }}>Run Details</th>
                                <th>Model / Config</th>
                                <th>Status</th>
                                <th>mAP 50-95</th>
                                <th>Executed By</th>
                                <th style={{ textAlign: 'right', paddingRight: '32px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, idx) => <SkeletonRow key={`skel-${idx}`} />)
                            ) : paginatedRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '80px', textAlign: 'center' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px dashed #CBD5E1' }}>
                                            <AlertCircle size={32} color="#94A3B8" />
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px', fontWeight: '700' }}>No validation records found</h3>
                                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>We couldn't find any records matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecords.map((record, index) => (
                                    <tr 
                                        key={record.id} 
                                        className="vr-row"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        
                                        {/* RUN DETAILS */}
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                {/* FIXED: Icon is now perfectly centered inside a square box */}
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', backgroundColor: '#F0F9FF', color: '#0EA5E9', borderRadius: '10px', border: '1px solid #E0F2FE', flexShrink: 0 }}>
                                                    <Target size={20} />
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>{record.run_name}</p>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B', display: 'flex', gap: '6px' }}>
                                                        <Clock size={14} /> {record.start_time}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* MODEL / CONFIG */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <p style={{ margin: 0, fontSize: '14px', color: '#1E293B', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Layers size={14} color="#8B5CF6"/> {record.model_name}
                                            </p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Database size={13} /> {record.dataset_name}
                                            </p>
                                        </td>

                                        {/* STATUS */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <span className={`status-pill ${record.status === 'Success' ? 'status-success' : record.status === 'Failed' ? 'status-failed' : 'status-validating'}`}>
                                                {record.status === 'Success' ? <CheckCircle2 size={14} /> : record.status === 'Failed' ? <AlertTriangle size={14} /> : <Activity size={14} />}
                                                {record.status}
                                            </span>
                                        </td>

                                        {/* mAP SCORE */}
                                        <td style={{ padding: '20px 24px' }}>
                                            {record.map50_95 !== null ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                                                        {(record.map50_95 * 100).toFixed(1)}<span style={{ fontSize: '12px', color: '#94A3B8' }}>%</span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic', fontWeight: '500' }}>
                                                    {record.status === 'Validating' || record.status === 'Pending' ? 'Calculating...' : 'N/A'}
                                                </span>
                                            )}
                                        </td>

                                        {/* EXECUTED BY */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <div className="vr-author-cell">
                                                {renderAvatar(record.executed_by)}
                                                {/* FIXED: Removed the toLowerCase() so the username displays exactly as registered */}
                                                <span>{record.executed_by}</span>
                                            </div>
                                        </td>

                                        {/* ACTIONS */}
                                        <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                            <div className="vr-actions" style={{ justifyContent: 'flex-end' }}>
                                                
                                                <button 
                                                    onClick={() => handleViewMetrics(record.id)}
                                                    disabled={record.status !== 'Success'}
                                                    title="View Detailed Metrics"
                                                    className="vr-action-btn vr-btn-view"
                                                >
                                                    <Eye size={18} />
                                                </button>

                                                <button 
                                                    onClick={() => triggerDelete(record.id, record.run_name)}
                                                    title="Delete Record"
                                                    className="vr-action-btn vr-btn-del"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>

                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* FIXED: Pagination Footer moved INSIDE the main table container */}
                {!isLoading && filteredAndSortedRecords.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>ROWS PER PAGE</span>
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#FFFFFF', borderRadius: '10px', 
                                    border: `2px solid ${isDropdownOpen ? '#3B82F6' : '#E2E8F0'}`, 
                                    color: '#0F172A', fontSize: '14px', fontWeight: '700', cursor: 'pointer', 
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isDropdownOpen ? '0 0 0 4px rgba(59,130,246,0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                                }}
                            >
                                {rowsPerPage < 10 ? `0${rowsPerPage}` : rowsPerPage}
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.3s ease', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94A3B8' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
                            </button>

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
                                        onClick={() => { setRowsPerPage(num); setIsDropdownOpen(false); }}
                                        style={{ 
                                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600',
                                            backgroundColor: rowsPerPage === num ? '#EFF6FF' : 'transparent',
                                            color: rowsPerPage === num ? '#3B82F6' : '#475569',
                                            transition: 'all 0.2s ease',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => { if(rowsPerPage !== num) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                        onMouseLeave={(e) => { if(rowsPerPage !== num) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        {num < 10 ? `0${num}` : num}
                                        {rowsPerPage === num && <CheckCircle2 size={14} color="#3B82F6" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tracker & Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                                <span style={{ backgroundColor: '#F1F5F9', color: '#0F172A', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid #E2E8F0' }}>
                                    {startIndex + 1} - {Math.min(startIndex + rowsPerPage, totalItems)}
                                </span>
                                of <span style={{ color: '#0F172A', fontWeight: '700' }}>{totalItems}</span>
                            </div>

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
                                    onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                                    onMouseLeave={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                >
                                    Prev
                                </button>
                                
                                <div style={{ width: '1px', backgroundColor: '#E2E8F0', margin: '4px 4px' }}></div>
                                
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages || totalPages === 0}
                                    style={{ 
                                        padding: '6px 16px', borderRadius: '8px', border: 'none', 
                                        backgroundColor: currentPage === totalPages || totalPages === 0 ? 'transparent' : '#FFFFFF', 
                                        color: currentPage === totalPages || totalPages === 0 ? '#94A3B8' : '#0F172A', 
                                        fontSize: '13px', fontWeight: '700', 
                                        cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer', 
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)', 
                                        boxShadow: currentPage === totalPages || totalPages === 0 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' 
                                    }}
                                    onMouseEnter={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                                    onMouseLeave={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- CUSTOM CONFIRM MODAL FOR DELETE --- */}
            {confirmModal.isOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={() => setConfirmModal({ isOpen: false, id: null, runName: '' })} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out forwards' }}></div>
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
                        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)', width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', color: '#EF4444', animation: 'pulse-ring-danger 2s infinite' }}>
                                    <Trash2 size={28} />
                                </div>
                            </div>
                            <div style={{ marginTop: '12px' }}>
                                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Delete Record</h2>
                                <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>
                                    Permanently delete the validation record for <strong style={{ color: '#0F172A' }}>'{confirmModal.runName}'</strong>?
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button onClick={() => setConfirmModal({ isOpen: false, id: null, runName: '' })} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}>Cancel</button>
                                <button onClick={confirmDelete} style={{ flex: 1, padding: '14px', borderRadius: '12px', background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}>Delete Record</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* --- METRICS VIEWER MODAL --- */}
            {metricsModal.isOpen && metricsModal.data && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div onClick={() => setMetricsModal({ isOpen: false, data: null })} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out forwards' }}></div>
                    <div style={{ position: 'relative', width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: '#F8FAFC', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', animation: 'scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, border: '1px solid #E2E8F0', padding: '32px' }}>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ padding: '12px', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', color: '#16A34A', borderRadius: '16px', boxShadow: '0 4px 10px rgba(22, 163, 74, 0.1)' }}>
                                    <ShieldCheck size={32} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 6px 0', fontSize: '22px', color: '#0F172A', fontWeight: '900', letterSpacing: '-0.5px' }}>Validation Passed: {metricsModal.data.run_name}</h3>
                                    <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Historical inference metrics extracted successfully.</p>
                                </div>
                            </div>
                            <button onClick={() => setMetricsModal({ isOpen: false, data: null })} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '50%', color: '#64748B', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.color = '#64748B'; }}>
                                <X size={20} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* Top Core Metrics */}
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '32px' }}>
                            {[
                                { label: 'mAP 50-95', value: metricsModal.data.metrics.mAP50_95, icon: Target },
                                { label: 'mAP 50', value: metricsModal.data.metrics.mAP50, icon: Focus },
                                { label: 'Precision', value: metricsModal.data.metrics.precision, icon: Crosshair },
                                { label: 'Recall', value: metricsModal.data.metrics.recall, icon: Activity }
                            ].map((metric, idx) => {
                                const details = getMetricDetails(metric.value);
                                const Icon = metric.icon;
                                return (
                                    <div key={idx} className="metric-card">
                                        <div className="metric-icon-wrap" style={{ color: details.color }}><Icon size={120} strokeWidth={1} /></div>
                                        <div className="metric-title"><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: details.color, boxShadow: `0 0 10px ${details.color}` }} />{metric.label}</div>
                                        <div className="metric-val" style={{ color: details.color, textShadow: `0 4px 10px ${details.shadow}` }}>{(metric.value * 100).toFixed(1)}%</div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
                            {/* Bar Chart Visualization */}
                            <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)' }}>
                                <h4 style={{ margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ padding: '6px', background: '#EFF6FF', borderRadius: '8px', color: '#3B82F6', display: 'flex' }}><BarChart2 size={18} /></div>Performance Breakdown</h4>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={metricsModal.data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barSize={45}>
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
                                                {metricsModal.data.chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Confusion Matrix Numbers */}
                            <div style={{ background: '#FFFFFF', padding: '28px', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
                                <h4 style={{ margin: '0 0 24px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}><div style={{ padding: '6px', background: '#F5F3FF', borderRadius: '8px', color: '#8B5CF6', display: 'flex' }}><Layers size={18} /></div>Matrix Classifications</h4>
                                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                    <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', borderColor: '#BBF7D0' }}><div className="matrix-label" style={{ color: '#16A34A' }}>True Positive (TP)</div><div className="matrix-value" style={{ color: '#14532D' }}>{metricsModal.data.matrix.tp}</div></div>
                                    <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FECACA' }}><div className="matrix-label" style={{ color: '#DC2626' }}>False Positive (FP)</div><div className="matrix-value" style={{ color: '#7F1D1D' }}>{metricsModal.data.matrix.fp}</div></div>
                                    <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #FEF2F2, #FEE2E2)', borderColor: '#FECACA' }}><div className="matrix-label" style={{ color: '#DC2626' }}>False Negative (FN)</div><div className="matrix-value" style={{ color: '#7F1D1D' }}>{metricsModal.data.matrix.fn}</div></div>
                                    <div className="matrix-box" style={{ background: 'linear-gradient(135deg, #F8FAFC, #F1F5F9)', borderColor: '#E2E8F0', opacity: 0.8 }}><div className="matrix-label" style={{ color: '#64748B' }}>True Negative (TN)</div><div className="matrix-value" style={{ color: '#94A3B8' }}>{metricsModal.data.matrix.tn} <span style={{ fontSize: '14px', fontWeight: '600' }}>(Ignored)</span></div></div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default ValidationRecords;