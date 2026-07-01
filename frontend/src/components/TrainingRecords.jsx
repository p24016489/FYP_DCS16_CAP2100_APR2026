import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Download, Trash2, Activity, CheckCircle2, XCircle, Clock, Server, Layers, AlertCircle, Eye, BarChart2, Table as TableIcon, X } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { API_BASE_URL } from '../config';

const TrainingRecords = () => {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, runName: '' });
    const [metricsModal, setMetricsModal] = useState({ isOpen: false, runName: '', data: [], activeTab: 'graph' });

    // Filtering & Searching
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
            const response = await fetch(`${API_BASE_URL}/api/training-runs/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setRecords(data);
            }
        } catch (error) {
            console.error("Failed to fetch training records:", error);
        } finally {
            setTimeout(() => setIsLoading(false), 600);
        }
    };

    // --- VIEW METRICS GRAPH FUNCTION ---
    const handleViewMetrics = async (id, runName) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/training-runs/${id}/results/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const rawData = await response.json();
                
                // Parse CSV strings into specific numbers for the Graph
                const formattedData = rawData.map(row => ({
                    epoch: parseInt(row['epoch']),
                    mAP50_95: parseFloat(row['metrics/mAP50-95(B)']) || 0,
                    mAP50: parseFloat(row['metrics/mAP50(B)']) || 0,
                    train_box_loss: parseFloat(row['train/box_loss']) || 0,
                    train_cls_loss: parseFloat(row['train/cls_loss']) || 0,
                    train_dfl_loss: parseFloat(row['train/dfl_loss']) || 0,
                    val_box_loss: parseFloat(row['val/box_loss']) || 0,
                    val_cls_loss: parseFloat(row['val/cls_loss']) || 0,
                    val_dfl_loss: parseFloat(row['val/dfl_loss']) || 0,
                    lr: parseFloat(row['lr/pg0']) || 0,
                    raw: row // Keep original data for the dynamic table
                }));

                setMetricsModal({ isOpen: true, runName, data: formattedData, activeTab: 'graph' });
            } else {
                alert("Results file (results.csv) not found for this run. Training might have failed early.");
            }
        } catch (error) {
            alert("Network error while trying to fetch metrics.");
        }
    };

    const handleDownload = async (id, runName) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/training-runs/${id}/download/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${runName}_best.pt`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert("Weights file not found. The run may have failed or files were deleted.");
            }
        } catch (error) {
            alert("Network error while trying to download.");
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
            const response = await fetch(`${API_BASE_URL}/api/training-runs/${id}/delete/`, {
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
                record.model_architecture?.toLowerCase().includes(query) ||
                record.started_by?.toLowerCase().includes(query) ||
                record.start_time?.toLowerCase().includes(query) ||
                record.end_time?.toLowerCase().includes(query)
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

    const renderAvatar = (name) => {
        const initials = (name && name !== 'System') 
            ? name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase()                   
            : 'SY';
            
        return <div className="tr-avatar">{initials}</div>;
    };

    const SkeletonRow = () => (
        <tr className="tr-skeleton-row">
            <td style={{ padding: '20px 32px' }}><div className="tr-skeleton tr-skel-icon-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="tr-skeleton tr-skel-text-double"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="tr-skeleton tr-skel-badge"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="tr-skeleton tr-skel-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="tr-skeleton tr-skel-avatar-text"></div></td>
            <td style={{ padding: '20px 32px', textAlign: 'right' }}><div className="tr-skeleton tr-skel-actions" style={{ marginLeft: 'auto' }}></div></td>
        </tr>
    );

    return (
        <div className="tr-page-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .tr-page-wrapper {
                    width: 100%; box-sizing: border-box; display: flex; flex-direction: column; gap: 24px;
                    animation: fadeIn 0.4s ease-out;
                }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                
                @keyframes pulse-ring-danger { 
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 
                    70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); } 
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } 
                }

                .stagger-1 { animation: slideUp 0.4s ease forwards 0.1s; opacity: 0; }
                .stagger-2 { animation: slideUp 0.4s ease forwards 0.2s; opacity: 0; }

                .tr-top-card {
                    display: flex; justify-content: space-between; align-items: center; background-color: #FFFFFF;
                    padding: 24px 32px; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); position: relative; z-index: 20; flex-wrap: wrap; gap: 16px;
                }

                .tr-controls-group { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

                .tr-search-box {
                    display: flex; align-items: center; background-color: #F8FAFC; padding: 12px 20px;
                    border-radius: 14px; border: 2px solid #E2E8F0; width: 320px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .tr-search-box:focus-within { border-color: #10B981; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(16,185,129,0.1); }
                .tr-search-input { border: none; background: transparent; outline: none; font-size: 14.5px; color: #1E293B; margin-left: 12px; width: 100%; font-weight: 500; }

                .tr-table-container {
                    background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); display: flex; flex-direction: column; overflow: hidden;
                }
                .tr-table-scroll-area { overflow-x: auto; }
                
                .tr-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; min-width: 900px; }
                .tr-table th { padding: 20px 24px; background: #F8FAFC; border-bottom: 2px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .tr-table th:first-child { padding-left: 32px; }
                .tr-table th:last-child { padding-right: 32px; }

                .tr-row {
                    opacity: 0; animation: slideUpFade 0.4s ease forwards; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
                }
                @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                
                .tr-row:hover { background-color: #F8FAFC; transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05); z-index: 10; }
                .tr-row td { transition: all 0.3s ease; }
                .tr-row td:first-child { box-shadow: inset 4px 0 0 0 transparent; }
                .tr-row:hover td:first-child { box-shadow: inset 4px 0 0 0 #3B82F6; }

                .tr-author-cell { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: #334155; }
                .tr-avatar {
                    width: 28px; height: 28px; border-radius: 50%; background: #F1F5F9; color: #475569;
                    border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; line-height: 1; padding-top: 1px;
                }

                .tr-actions { display: inline-flex; align-items: center; gap: 8px; }
                .tr-action-btn {
                    padding: 10px; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 10px; color: #64748B;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .tr-btn-view:hover:not(:disabled) { color: #3B82F6; background: #EFF6FF; border-color: #BFDBFE; transform: translateY(-2px); }
                .tr-btn-down:hover:not(:disabled) { color: #059669; background: #ECFDF5; border-color: #A7F3D0; transform: translateY(-2px); }
                .tr-btn-del:hover { color: #EF4444; background: #FEF2F2; border-color: #FCA5A5; transform: translateY(-2px); }
                .tr-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* Custom Table Hover for Metrics Modal */
                .metrics-hover-row:hover { background-color: #F8FAFC; }

                /* Custom Recharts Tooltip styling */
                .custom-recharts-tooltip { background: rgba(15,23,42,0.95) !important; border: 1px solid #334155 !important; border-radius: 8px !important; color: #fff !important; font-size: 13px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3) !important; padding: 12px !important; }

                /* Skeletons */
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .tr-skeleton { background: #E2E8F0; border-radius: 6px; animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                .tr-skel-icon-text { width: 180px; height: 32px; }
                .tr-skel-text-double { width: 140px; height: 32px; }
                .tr-skel-badge { width: 90px; height: 28px; border-radius: 999px; }
                .tr-skel-text { width: 60px; height: 20px; }
                .tr-skel-avatar-text { width: 100px; height: 28px; border-radius: 14px; }
                .tr-skel-actions { width: 128px; height: 38px; border-radius: 10px; }
            `}} />

            {/* Top Action Bar */}
            <div className="tr-top-card stagger-1">
                <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '200px', background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.03))', pointerEvents: 'none', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}></div>
                
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '10px', color: '#3B82F6' }}>
                            <Activity size={20} />
                        </div>
                        Training Records
                        <span style={{ padding: '4px 12px', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', color: '#334155', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.05)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ color: '#3B82F6', marginRight: '6px', fontSize: '14px' }}>#</span>
                            {filteredAndSortedRecords.length} RUNS
                        </span>
                    </h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Manage, view, and export trained model weights.</p>
                </div>
                
                <div className="tr-controls-group">
                    {/* Interactive Status Pill Filter */}
                    <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        {['All', 'Completed', 'Training', 'Failed'].map(status => (
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
                    <div className="tr-search-box">
                        <Search size={18} color="#94A3B8" />
                        <input 
                            type="text" 
                            placeholder="Search runs, datasets, users or dates..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="tr-search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="tr-table-container stagger-2">
                <div className="tr-table-scroll-area">
                    <table className="tr-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '32px' }}>Run Details</th>
                                <th>Model / Config</th>
                                <th>Status</th>
                                <th>mAP Score</th>
                                <th>Started By</th>
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
                                        <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px', fontWeight: '700' }}>No training records found</h3>
                                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>We couldn't find any runs matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecords.map((record, index) => (
                                    <tr 
                                        key={record.id} 
                                        className="tr-row"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        
                                        {/* RUN DETAILS */}
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ padding: '10px', backgroundColor: '#F0F9FF', color: '#0EA5E9', borderRadius: '10px' }}>
                                                    <Server size={20} />
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
                                                <Layers size={14} color="#8B5CF6"/> {record.model_architecture}
                                            </p>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                                                {record.dataset_name} • {record.epochs} Epochs • Batch {record.batch_size}
                                            </p>
                                        </td>

                                        {/* STATUS */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <span style={{ 
                                                padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px',
                                                backgroundColor: record.status === 'Completed' || record.status === 'Success' ? '#F0FDF4' : record.status === 'Failed' ? '#FEF2F2' : '#EFF6FF',
                                                color: record.status === 'Completed' || record.status === 'Success' ? '#15803D' : record.status === 'Failed' ? '#DC2626' : '#2563EB',
                                                border: `1px solid ${record.status === 'Completed' || record.status === 'Success' ? '#DCFCE7' : record.status === 'Failed' ? '#FCA5A5' : '#BFDBFE'}`
                                            }}>
                                                {record.status === 'Completed' || record.status === 'Success' ? <CheckCircle2 size={14} /> : record.status === 'Failed' ? <XCircle size={14} /> : <Activity size={14} />}
                                                {record.status}
                                            </span>
                                        </td>

                                        {/* mAP SCORE */}
                                        <td style={{ padding: '20px 24px' }}>
                                            {record.final_map_score !== null ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                                                        {(record.final_map_score * 100).toFixed(1)}<span style={{ fontSize: '12px', color: '#94A3B8' }}>%</span>
                                                    </span>
                                                </div>
                                            ) : (
                                                <span style={{ color: '#94A3B8', fontSize: '13px', fontStyle: 'italic', fontWeight: '500' }}>
                                                    {record.status === 'Training' || record.status === 'Pending' ? 'Calculating...' : 'N/A'}
                                                </span>
                                            )}
                                        </td>

                                        {/* USER AVATAR */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <div className="tr-author-cell">
                                                {renderAvatar(record.started_by)}
                                                <span>{record.started_by}</span>
                                            </div>
                                        </td>

                                        {/* ACTIONS */}
                                        <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                            <div className="tr-actions" style={{ justifyContent: 'flex-end' }}>
                                                
                                                <button 
                                                    onClick={() => handleViewMetrics(record.id, record.run_name)}
                                                    disabled={!(record.status === 'Completed' || record.status === 'Success')}
                                                    title="View Training Metrics"
                                                    className="tr-action-btn tr-btn-view"
                                                >
                                                    <Eye size={18} />
                                                </button>

                                                <button 
                                                    onClick={() => handleDownload(record.id, record.run_name)}
                                                    disabled={!(record.status === 'Completed' || record.status === 'Success')}
                                                    title="Download Weights (.pt)"
                                                    className="tr-action-btn tr-btn-down"
                                                >
                                                    <Download size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => triggerDelete(record.id, record.run_name)}
                                                    title="Delete Record"
                                                    className="tr-action-btn tr-btn-del"
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
                
                {/* Pagination Footer */}
                {!isLoading && filteredAndSortedRecords.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>ROWS PER PAGE</span>
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
                                            backgroundColor: rowsPerPage === num ? '#F0FDF4' : 'transparent',
                                            color: rowsPerPage === num ? '#10B981' : '#475569',
                                            transition: 'all 0.2s ease',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => { if(rowsPerPage !== num) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                        onMouseLeave={(e) => { if(rowsPerPage !== num) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        {num < 10 ? `0${num}` : num}
                                        {rowsPerPage === num && <CheckCircle2 size={14} color="#10B981" />}
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
                                    onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
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
                                    onMouseEnter={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#10B981'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                                    onMouseLeave={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* --- CUSTOM CONFIRM MODAL (PORTAL) --- */}
            {confirmModal.isOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    
                    <div 
                        onClick={() => setConfirmModal({ isOpen: false, id: null, runName: '' })} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fadeIn 0.3s ease-out forwards' }}
                    ></div>
                    
                    <div style={{ position: 'relative', width: '100%', maxWidth: '400px', animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, marginTop: '36px' }}>
                        
                        <div style={{ backgroundColor: '#FFFFFF', borderRadius: '24px', padding: '40px 32px 32px 32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <div style={{ 
                                position: 'absolute', top: '-36px', left: '50%', transform: 'translateX(-50%)',
                                width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#FFFFFF',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.1)', padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <div style={{
                                    width: '100%', height: '100%', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: '#FEF2F2', color: '#EF4444', animation: 'pulse-ring-danger 2s infinite'
                                }}>
                                    <Trash2 size={28} />
                                </div>
                            </div>
                            
                            <div style={{ marginTop: '12px' }}>
                                <h2 style={{ margin: '0 0 12px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Confirm Deletion</h2>
                                <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748B', lineHeight: '1.6' }}>
                                    Are you sure you want to permanently delete the training record for <strong style={{ color: '#0F172A' }}>'{confirmModal.runName}'</strong>? This will delete the weights file as well.
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button 
                                    onClick={() => setConfirmModal({ isOpen: false, id: null, runName: '' })}
                                    style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }}
                                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={confirmDelete}
                                    style={{ 
                                        flex: 1, padding: '14px', borderRadius: '12px', 
                                        background: 'linear-gradient(135deg, #EF4444, #DC2626)', 
                                        color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s', 
                                        boxShadow: '0 4px 14px rgba(239, 68, 68, 0.3)' 
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.3)'; }}
                                >
                                    Delete Record
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* --- CUSTOM METRICS CHART MODAL (PORTAL) --- */}
            {metricsModal.isOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div 
                        onClick={() => setMetricsModal({ isOpen: false, runName: '', data: [], activeTab: 'graph' })} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(10px)', animation: 'fadeIn 0.3s ease-out forwards' }}
                    ></div>
                    
                    {/* WIDENED TO 95vw to fit all columns without scrolling */}
                    <div style={{ position: 'relative', width: '95vw', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)', animation: 'slideUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, overflow: 'hidden' }}>
                        
                        {/* Header */}
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px', backgroundColor: '#EFF6FF', borderRadius: '12px', color: '#3B82F6' }}>
                                    <BarChart2 size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '20px', color: '#0F172A', fontWeight: '800' }}>Training Metrics</h3>
                                    <p style={{ margin: 0, fontSize: '13.5px', color: '#64748B', fontWeight: '600' }}>{metricsModal.runName}</p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                {/* Tabs */}
                                <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '12px' }}>
                                    <button 
                                        onClick={() => setMetricsModal(prev => ({...prev, activeTab: 'graph'}))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s', backgroundColor: metricsModal.activeTab === 'graph' ? '#FFFFFF' : 'transparent', color: metricsModal.activeTab === 'graph' ? '#0F172A' : '#64748B', boxShadow: metricsModal.activeTab === 'graph' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
                                    >
                                        <BarChart2 size={16}/> Graph
                                    </button>
                                    <button 
                                        onClick={() => setMetricsModal(prev => ({...prev, activeTab: 'table'}))}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s', backgroundColor: metricsModal.activeTab === 'table' ? '#FFFFFF' : 'transparent', color: metricsModal.activeTab === 'table' ? '#0F172A' : '#64748B', boxShadow: metricsModal.activeTab === 'table' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
                                    >
                                        <TableIcon size={16}/> Raw Data
                                    </button>
                                </div>

                                {/* Close Button */}
                                <button 
                                    onClick={() => setMetricsModal({ isOpen: false, runName: '', data: [], activeTab: 'graph' })}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#F1F5F9', border: 'none', borderRadius: '50%', color: '#64748B', cursor: 'pointer', transition: 'all 0.2s' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Body Container */}
                        <div style={{ height: '600px', backgroundColor: '#FFFFFF', padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                            {metricsModal.activeTab === 'graph' ? (
                                <ResponsiveContainer width="95%" height="95%">
                                    <LineChart data={metricsModal.data} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="epoch" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                                        
                                        {/* Left Y Axis: Precision/mAP/LR (0 to 1) */}
                                        <YAxis yAxisId="left" domain={[0, 1]} tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                                        
                                        {/* Right Y Axis: Loss */}
                                        <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748B', fontSize: 12 }} axisLine={{ stroke: '#CBD5E1' }} tickLine={false} />
                                        
                                        <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '13px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3)' }} itemStyle={{ color: '#E2E8F0' }} />
                                        <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '600' }} />
                                        
                                        {/* NEW: Learning Rate */}
                                        <Line yAxisId="left" type="monotone" name="Learning Rate (lr/pg0)" dataKey="lr" stroke="#0EA5E9" strokeWidth={2} dot={false} />
                                        
                                        <Line yAxisId="left" type="monotone" name="mAP50-95" dataKey="mAP50_95" stroke="#10B981" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                                        <Line yAxisId="left" type="monotone" name="mAP50" dataKey="mAP50" stroke="#34D399" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                                        
                                        <Line yAxisId="right" type="monotone" name="Train Box Loss" dataKey="train_box_loss" stroke="#EF4444" strokeWidth={2} dot={false} />
                                        <Line yAxisId="right" type="monotone" name="Train Cls Loss" dataKey="train_cls_loss" stroke="#F87171" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                                        {/* NEW: Train DFL Loss */}
                                        <Line yAxisId="right" type="monotone" name="Train DFL Loss" dataKey="train_dfl_loss" stroke="#8B5CF6" strokeWidth={2} dot={false} strokeDasharray="3 3" />

                                        <Line yAxisId="right" type="monotone" name="Val Box Loss" dataKey="val_box_loss" stroke="#F59E0B" strokeWidth={2} dot={false} />
                                        <Line yAxisId="right" type="monotone" name="Val Cls Loss" dataKey="val_cls_loss" stroke="#FCD34D" strokeWidth={2} dot={false} strokeDasharray="3 3" />
                                        {/* NEW: Val DFL Loss */}
                                        <Line yAxisId="right" type="monotone" name="Val DFL Loss" dataKey="val_dfl_loss" stroke="#A855F7" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div style={{ height: '100%', width: '100%', overflowY: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    {metricsModal.data.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '13px' }}>
                                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F8FAFC', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                                <tr>
                                                    {Object.keys(metricsModal.data[0].raw)
                                                        .filter(key => key !== 'time')
                                                        .map(key => (
                                                            <th key={key} style={{ padding: '12px 6px', color: '#64748B', fontWeight: '700', borderBottom: '2px solid #E2E8F0', whiteSpace: 'nowrap', fontSize: '11px', textAlign: 'center' }}>
                                                                {key}
                                                            </th>
                                                        ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {metricsModal.data.map((row, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }} className="metrics-hover-row">
                                                        {Object.entries(row.raw)
                                                            .filter(([key]) => key !== 'time')
                                                            .map(([key, val], j) => {
                                                                const numVal = parseFloat(val);
                                                                const isEpoch = key === 'epoch';
                                                                // Convert to 5 decimal places if it's a number and not the epoch column
                                                                const displayVal = (!isNaN(numVal) && !isEpoch) ? numVal.toFixed(5) : val;
                                                                return (
                                                                    <td key={j} style={{ padding: '10px 6px', fontWeight: isEpoch ? '700' : '500', color: isEpoch ? '#0F172A' : '#475569', whiteSpace: 'nowrap', fontSize: '12px', textAlign: 'center' }}>
                                                                        {displayVal}
                                                                    </td>
                                                                );
                                                            })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>No data available.</div>
                                    )}
                                </div>
                            )}
                        </div>

                    </div>
                </div>,
                document.body
            )}

        </div>
    );
};

export default TrainingRecords;