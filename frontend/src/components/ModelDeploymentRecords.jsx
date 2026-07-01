import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Server, Layers, Clock, CheckCircle2, AlertTriangle, Trash2, Search, Database, UploadCloud, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

const ModelDeploymentRecords = () => {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, runName: '' });

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
            const res = await fetch(`${API_BASE_URL}/api/deployment-records/`, { 
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

    const triggerDelete = (id, runName) => {
        setConfirmModal({ isOpen: true, id, runName });
    };

    const confirmDelete = async () => {
        const { id } = confirmModal;
        setConfirmModal({ isOpen: false, id: null, runName: '' }); 
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/deployment-records/${id}/delete/`, {
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
                record.model_architecture?.toLowerCase().includes(query) ||
                record.deployed_by?.toLowerCase().includes(query) ||
                record.deployed_at?.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== 'All') {
            const isActiveFilter = statusFilter === 'Live';
            result = result.filter(record => record.is_active === isActiveFilter);
        }

        return result;
    }, [records, searchQuery, statusFilter]);

    const totalItems = filteredAndSortedRecords.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedRecords = filteredAndSortedRecords.slice(startIndex, startIndex + rowsPerPage);

    // Helpers
    const renderAvatar = (name) => {
        const initials = (name && name !== 'System') 
            ? name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase()                  
            : 'SY';
            
        return <div className="dr-avatar">{initials}</div>;
    };

    const SkeletonRow = () => (
        <tr className="dr-skeleton-row">
            <td style={{ padding: '20px 32px' }}><div className="dr-skeleton dr-skel-icon-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-text-double"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-badge"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-avatar-text"></div></td>
            <td style={{ padding: '20px 32px', textAlign: 'right' }}><div className="dr-skeleton dr-skel-actions" style={{ marginLeft: 'auto' }}></div></td>
        </tr>
    );

    return (
        <div className="dr-page-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .dr-page-wrapper {
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

                .dr-top-card {
                    display: flex; justify-content: space-between; align-items: center; background-color: #FFFFFF;
                    padding: 24px 32px; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); position: relative; z-index: 20; flex-wrap: wrap; gap: 16px;
                }

                .dr-controls-group { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }

                .dr-search-box {
                    display: flex; align-items: center; background-color: #F8FAFC; padding: 12px 20px;
                    border-radius: 14px; border: 2px solid #E2E8F0; width: 320px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .dr-search-box:focus-within { border-color: #3B82F6; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(59,130,246,0.1); }
                .dr-search-input { border: none; background: transparent; outline: none; font-size: 14.5px; color: #1E293B; margin-left: 12px; width: 100%; font-weight: 500; }

                .dr-table-container {
                    background: #FFFFFF; border-radius: 16px; border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); display: flex; flex-direction: column; overflow: hidden;
                }
                .dr-table-scroll-area { overflow-x: auto; }
                
                .dr-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; min-width: 900px; }
                .dr-table th { padding: 20px 24px; background: #F8FAFC; border-bottom: 2px solid #E2E8F0; color: #64748B; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
                .dr-table th:first-child { padding-left: 32px; }
                .dr-table th:last-child { padding-right: 32px; }

                .dr-row {
                    opacity: 0; animation: slideUpFade 0.4s ease forwards; background-color: #FFFFFF; border-bottom: 1px solid #E2E8F0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative;
                }
                @keyframes slideUpFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
                
                .dr-row:hover { background-color: #F8FAFC; transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05); z-index: 10; }
                .dr-row td { transition: all 0.3s ease; }
                .dr-row td:first-child { box-shadow: inset 4px 0 0 0 transparent; }
                .dr-row:hover td:first-child { box-shadow: inset 4px 0 0 0 #3B82F6; }

                .dr-author-cell { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: #334155; }
                .dr-avatar {
                    width: 28px; height: 28px; border-radius: 50%; background: #F1F5F9; color: #475569;
                    border: 1px solid #E2E8F0; display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700; line-height: 1; padding-top: 1px;
                }

                .dr-actions { display: inline-flex; align-items: center; gap: 8px; }
                .dr-action-btn {
                    padding: 10px; border: 1px solid #E2E8F0; background: #F8FAFC; border-radius: 10px; color: #64748B;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                
                .dr-btn-del:hover { color: #EF4444; background: #FEF2F2; border-color: #FCA5A5; transform: translateY(-2px); }

                /* Status Pills */
                .status-pill { padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px; }
                .status-live { background-color: #F0FDF4; color: #15803D; border: 1px solid #DCFCE7; }
                .status-archived { background-color: #F8FAFC; color: #64748B; border: 1px solid #E2E8F0; }

                /* Skeletons */
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .dr-skeleton { background: #E2E8F0; border-radius: 6px; animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                .dr-skel-icon-text { width: 180px; height: 32px; }
                .dr-skel-text-double { width: 140px; height: 32px; }
                .dr-skel-badge { width: 90px; height: 28px; border-radius: 999px; }
                .dr-skel-text { width: 60px; height: 20px; }
                .dr-skel-avatar-text { width: 100px; height: 28px; border-radius: 14px; }
                .dr-skel-actions { width: 40px; height: 38px; border-radius: 10px; }
            `}} />

            {/* Top Action Bar */}
            <div className="dr-top-card stagger-1">
                <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '200px', background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.03))', pointerEvents: 'none', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}></div>
                
                <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', backgroundColor: '#EFF6FF', borderRadius: '10px', color: '#3B82F6' }}>
                            <Server size={20} />
                        </div>
                        Model Deployment Records
                        <span style={{ padding: '4px 12px', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', color: '#334155', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.05)', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center' }}>
                            <span style={{ color: '#3B82F6', marginRight: '6px', fontSize: '14px' }}>#</span>
                            {filteredAndSortedRecords.length} DEPLOYMENTS
                        </span>
                    </h2>
                    <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Manage, view, and audit historical deployment changes to the inference engine.</p>
                </div>
                
                <div className="dr-controls-group">
                    {/* Interactive Status Pill Filter */}
                    <div style={{ display: 'flex', backgroundColor: '#F1F5F9', padding: '6px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                        {['All', 'Live', 'Archived'].map(status => (
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
                    <div className="dr-search-box">
                        <Search size={18} color="#94A3B8" />
                        <input 
                            type="text" 
                            placeholder="Search models, users, or dates..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="dr-search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="dr-table-container stagger-2">
                <div className="dr-table-scroll-area">
                    <table className="dr-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '32px' }}>Model Details</th>
                                <th>mAP 50-95 Score</th>
                                <th>Status</th>
                                <th>Date & Time</th>
                                <th>Deployed By</th>
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
                                        <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px', fontWeight: '700' }}>No deployment records found</h3>
                                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>We couldn't find any records matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecords.map((record, index) => (
                                    <tr 
                                        key={record.id} 
                                        className="dr-row"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        {/* RUN DETAILS */}
                                        <td style={{ padding: '20px 32px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '42px', height: '42px', backgroundColor: '#F0F9FF', color: '#0EA5E9', borderRadius: '10px', border: '1px solid #E0F2FE', flexShrink: 0 }}>
                                                    <UploadCloud size={20} />
                                                </div>
                                                <div>
                                                    <p style={{ margin: 0, fontSize: '15px', color: '#0F172A', fontWeight: '700' }}>{record.run_name}</p>
                                                    <p style={{ margin: '4px 0 0 0', fontSize: '12.5px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <Layers size={13}/> {record.model_architecture}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* mAP SCORE */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>
                                                    {(record.map50_95 * 100).toFixed(1)}<span style={{ fontSize: '12px', color: '#94A3B8' }}>%</span>
                                                </span>
                                            </div>
                                        </td>

                                        {/* STATUS */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <span className={`status-pill ${record.is_active ? 'status-live' : 'status-archived'}`}>
                                                {record.is_active ? <CheckCircle2 size={14} /> : <Database size={14} />}
                                                {record.is_active ? 'Live' : 'Archived'}
                                            </span>
                                        </td>

                                        {/* DEPLOYED AT */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <div style={{ fontSize: '13.5px', color: '#64748B', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} /> {record.deployed_at}
                                            </div>
                                        </td>

                                        {/* DEPLOYED BY */}
                                        <td style={{ padding: '20px 24px' }}>
                                            <div className="dr-author-cell">
                                                {renderAvatar(record.deployed_by)}
                                                <span>{record.deployed_by}</span>
                                            </div>
                                        </td>

                                        {/* ACTIONS */}
                                        <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                            <div className="dr-actions" style={{ justifyContent: 'flex-end' }}>
                                                <button 
                                                    onClick={() => triggerDelete(record.id, record.run_name)}
                                                    title="Delete Record"
                                                    className="dr-action-btn dr-btn-del"
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
                                    Permanently delete the deployment record for <strong style={{ color: '#0F172A' }}>'{confirmModal.runName}'</strong>?
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button onClick={() => setConfirmModal({ isOpen: false, id: null, runName: '' })} style={{ flex: 1, padding: '14px', borderRadius: '12px', backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14.5px', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#0F172A'; }} onMouseLeave={e => { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#475569'; }}>Cancel</button>
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

export default ModelDeploymentRecords;