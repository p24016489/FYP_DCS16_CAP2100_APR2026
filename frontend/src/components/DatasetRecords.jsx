import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Filter, Trash2, Download, Eye, AlertCircle, Database, Layers, ChevronLeft, ChevronRight, CheckCircle2, X, FileText } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { createPortal } from 'react-dom';

const DatasetRecords = () => {
    const [datasets, setDatasets] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // View Modal State
    const [viewModalData, setViewModalData] = useState(null);
    
    // Custom Confirm Modal State for Deletion
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null, versionName: '' });

    // Filtering & Sorting
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest'); 

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Filter Dropdown
    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };

        if (isDropdownOpen || isFilterDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen, isFilterDropdownOpen]);

    useEffect(() => {
        fetchDatasets();
    }, []);

    // Reset to page 1 when search or sort changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, sortBy, rowsPerPage]);

    const fetchDatasets = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/datasets-list/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDatasets(data);
            }
        } catch (error) {
            console.error("Failed to fetch datasets", error);
        } finally {
            setTimeout(() => setIsLoading(false), 800);
        }
    };

    // --- REAL ACTION FUNCTIONS ---

    const handleViewDetails = async (id, versionName) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/datasets/${id}/view/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                // Opens the modal with the fetched YAML text
                setViewModalData({ title: versionName, content: data.yaml_content });
            } else {
                alert("Configuration file not found on the server.");
            }
        } catch (error) {
            console.error("Error fetching details:", error);
            alert("Network error while trying to view details.");
        }
    };

    const handleDownload = async (id, versionName) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/datasets/${id}/download/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                // Convert response to a blob and trigger browser download
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${versionName}.yaml`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } else {
                alert("File not found on the server.");
            }
        } catch (error) {
            console.error("Error downloading file:", error);
            alert("Network error while trying to download.");
        }
    };

    const triggerDelete = (id, versionName) => {
        setConfirmModal({ isOpen: true, id, versionName });
    };

    const confirmDelete = async () => {
        const { id } = confirmModal;
        setConfirmModal({ isOpen: false, id: null, versionName: '' }); 
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/datasets/${id}/delete/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (response.ok) {
                // Instantly remove it from the UI without needing to refresh the page
                setDatasets(prev => prev.filter(ds => ds.id !== id));
            } else {
                alert("Failed to delete dataset. You may not have permission.");
            }
        } catch (error) {
            console.error("Error deleting dataset:", error);
            alert("Network error while trying to delete.");
        }
    };

    // --- END ACTION FUNCTIONS ---

    const filteredAndSortedDatasets = useMemo(() => {
        let result = [...datasets];

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(ds => 
                ds.version_name.toLowerCase().includes(lowerQuery) || 
                ds.created_by.toLowerCase().includes(lowerQuery) ||
                ds.created_at.toLowerCase().includes(lowerQuery)
            );
        }

        result.sort((a, b) => {
            if (sortBy === 'most_images') return b.total_images - a.total_images;
            const dateA = new Date(a.created_at).getTime();
            const dateB = new Date(b.created_at).getTime();
            return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
        });

        return result;
    }, [datasets, searchQuery, sortBy]);

    const totalItems = filteredAndSortedDatasets.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const paginatedDatasets = filteredAndSortedDatasets.slice(startIndex, startIndex + rowsPerPage);

    const renderAvatar = (name) => {
        const initials = name && name !== 'System' 
            ? name.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_]+/).map(n => n[0]).join('').substring(0, 2).toUpperCase()
            : 'SY';
        return (
            <div className="dr-avatar">
                {initials}
            </div>
        );
    };

    const renderSplitBar = (splitStr) => {
        const trainPercentage = parseInt(splitStr.split('%')[0]) || 80; 
        return (
            <div className="dr-split-container">
                <div className="dr-split-labels">
                    <span style={{ color: '#059669' }}>Train {trainPercentage}%</span>
                    <span style={{ color: '#2563EB' }}>Val {100 - trainPercentage}%</span>
                </div>
                <div className="dr-split-track">
                    <div className="dr-split-train" style={{ width: `${trainPercentage}%` }}></div>
                    <div className="dr-split-val" style={{ width: `${100 - trainPercentage}%` }}></div>
                    <div className="dr-split-reveal-mask"></div>
                </div>
            </div>
        );
    };

    const SkeletonRow = () => (
        <tr className="dr-skeleton-row">
            <td style={{ padding: '20px 32px' }}><div className="dr-skeleton dr-skel-icon-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-badge"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-bar"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-text"></div></td>
            <td style={{ padding: '20px 24px' }}><div className="dr-skeleton dr-skel-avatar-text"></div></td>
            <td style={{ padding: '20px 32px', textAlign: 'right' }}><div className="dr-skeleton dr-skel-actions" style={{ marginLeft: 'auto' }}></div></td>
        </tr>
    );

    return (
        <div className="dr-page-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .dr-page-wrapper {
                    width: 100%;
                    box-sizing: border-box;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    animation: fadeIn 0.4s ease-out;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                @keyframes pulse-ring-danger { 
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); } 
                    70% { box-shadow: 0 0 0 14px rgba(239, 68, 68, 0); } 
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } 
                }

                .stagger-1 { animation: slideUp 0.4s ease forwards 0.1s; opacity: 0; }
                .stagger-2 { animation: slideUp 0.4s ease forwards 0.2s; opacity: 0; }

                /* Header & Controls Card */
                .dr-top-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background-color: #FFFFFF;
                    padding: 24px 32px;
                    border-radius: 16px;
                    border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03);
                    position: relative;
                    z-index: 20;
                    flex-wrap: wrap;
                    gap: 16px;
                }

                .dr-controls-group {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .dr-search-box {
                    display: flex;
                    align-items: center;
                    background-color: #F8FAFC;
                    padding: 12px 20px;
                    border-radius: 14px;
                    border: 2px solid #E2E8F0;
                    width: 320px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .dr-search-box:focus-within {
                    border-color: #10B981;
                    background-color: #FFFFFF;
                    box-shadow: 0 0 0 4px rgba(16,185,129,0.1);
                }
                .dr-search-input {
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 14.5px;
                    color: #1E293B;
                    margin-left: 12px;
                    width: 100%;
                    font-weight: 500;
                }

                .dr-table-container {
                    background: #FFFFFF;
                    border-radius: 16px;
                    border: 1px solid #E2E8F0;
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }

                .dr-table-scroll-area {
                    overflow-x: auto;
                }

                .dr-table {
                    width: 100%;
                    border-collapse: separate; 
                    border-spacing: 0;
                    text-align: left;
                    min-width: 900px;
                }
                .dr-table th {
                    padding: 20px 24px;
                    background: #F8FAFC;
                    border-bottom: 2px solid #E2E8F0;
                    color: #64748B;
                    font-size: 12px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .dr-table th:first-child { padding-left: 32px; }
                .dr-table th:last-child { padding-right: 32px; }

                .dr-row {
                    opacity: 0;
                    animation: slideUpFade 0.4s ease forwards;
                    background-color: #FFFFFF;
                    border-bottom: 1px solid #E2E8F0;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    position: relative;
                }
                @keyframes slideUpFade {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                
                .dr-row:hover { 
                    background-color: #F8FAFC; 
                    transform: translateY(-2px); 
                    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05); 
                    z-index: 10;
                }
                .dr-row td { transition: all 0.3s ease; }
                .dr-row td:first-child { box-shadow: inset 4px 0 0 0 transparent; }
                .dr-row:hover td:first-child { box-shadow: inset 4px 0 0 0 #10B981; }

                .dr-version-cell {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    font-weight: 700;
                    color: #0F172A;
                    font-size: 15px;
                }
                .dr-icon-wrapper {
                    width: 44px;
                    height: 44px;
                    background: linear-gradient(135deg, #10B981, #059669);
                    border-radius: 12px;
                    color: #FFFFFF;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2);
                    transition: all 0.3s ease;
                }
                .dr-row:hover .dr-icon-wrapper { transform: scale(1.05); }

                .dr-size-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: #F0FDF4;
                    border: 1px solid #DCFCE7;
                    border-radius: 8px;
                    font-size: 12.5px;
                    font-weight: 700;
                    color: #15803D;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .dr-size-label { color: #16A34A; font-weight: 700; font-size: 12px; }

                .dr-split-container { display: flex; flex-direction: column; gap: 6px; width: 100%; max-width: 140px; }
                .dr-split-labels { display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; }
                .dr-split-track { 
                    position: relative; height: 6px; width: 100%; 
                    background: #E2E8F0; border-radius: 999px; 
                    display: flex; overflow: hidden; 
                }
                .dr-split-train { background: #10B981; height: 100%; transition: width 1s ease-out; }
                .dr-split-val { background: #3B82F6; height: 100%; transition: width 1s ease-out; }
                
                @keyframes revealMask {
                    from { transform: translateX(0); }
                    to { transform: translateX(100%); }
                }
                .dr-split-reveal-mask {
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    background: #F1F5F9;
                    animation: revealMask 1s cubic-bezier(0.65, 0, 0.35, 1) forwards;
                }

                .dr-author-cell { display: flex; align-items: center; gap: 10px; font-size: 13.5px; font-weight: 600; color: #334155; }
                .dr-avatar {
                    width: 28px; height: 28px; border-radius: 50%;
                    background: #F1F5F9; color: #475569;
                    border: 1px solid #E2E8F0;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 700;
                    line-height: 1; padding-top: 1px;
                }

                .dr-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                }
                .dr-action-btn {
                    padding: 10px;
                    border: 1px solid #E2E8F0;
                    background: #F8FAFC;
                    border-radius: 10px;
                    color: #64748B;
                    cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .dr-btn-view:hover { color: #2563EB; background: #EFF6FF; border-color: #BFDBFE; transform: translateY(-2px); }
                .dr-btn-down:hover { color: #059669; background: #ECFDF5; border-color: #A7F3D0; transform: translateY(-2px); }
                .dr-btn-del:hover { color: #EF4444; background: #FEF2F2; border-color: #FCA5A5; transform: translateY(-2px); }
                
                /* Skeletons */
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .dr-skeleton { background: #E2E8F0; border-radius: 6px; animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
                .dr-skel-icon-text { width: 140px; height: 32px; }
                .dr-skel-badge { width: 70px; height: 28px; border-radius: 999px; }
                .dr-skel-bar { width: 120px; height: 16px; }
                .dr-skel-text { width: 160px; height: 16px; }
                .dr-skel-avatar-text { width: 100px; height: 28px; border-radius: 14px; }
                .dr-skel-actions { width: 120px; height: 38px; border-radius: 10px; }

                /* Modal Animations */
                @keyframes fade-in-fast { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(8px); } }
                @keyframes scale-up-fast { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}} />

            {/* Header & Search Bar Card */}
            <div className="dr-top-card stagger-1">
                <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '200px', background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.03))', pointerEvents: 'none', borderTopRightRadius: '16px', borderBottomRightRadius: '16px' }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div>
                        <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px', backgroundColor: '#F0FDF4', borderRadius: '10px', color: '#10B981' }}>
                                <Database size={20} />
                            </div>
                            Dataset Records
                            <span style={{ padding: '4px 12px', background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)', color: '#334155', borderRadius: '20px', fontSize: '12px', fontWeight: '700', border: '1px solid #E2E8F0', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8), 0 1px 2px rgba(0,0,0,0.05)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center' }}>
                                <span style={{ color: '#10B981', marginRight: '6px', fontSize: '14px' }}>#</span>
                                {filteredAndSortedDatasets.length} Records
                            </span>
                        </h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>Manage, view, and export your compiled training datasets.</p>
                    </div>
                </div>

                <div className="dr-controls-group">
                    {/* Custom Animated Filter Dropdown */}
                    <div style={{ position: 'relative', zIndex: 40 }} ref={filterDropdownRef}>
                        <button 
                            onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                            style={{ 
                                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', 
                                backgroundColor: isFilterDropdownOpen ? '#FFFFFF' : '#F8FAFC', 
                                borderRadius: '14px', 
                                border: `2px solid ${isFilterDropdownOpen ? '#10B981' : '#E2E8F0'}`, 
                                color: '#475569', fontSize: '14.5px', fontWeight: '600', cursor: 'pointer', 
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: isFilterDropdownOpen ? '0 0 0 4px rgba(16,185,129,0.1)' : 'none'
                            }}
                            onMouseEnter={(e) => { if(!isFilterDropdownOpen) { e.currentTarget.style.backgroundColor = '#FFFFFF'; e.currentTarget.style.borderColor = '#CBD5E1'; } }}
                            onMouseLeave={(e) => { if(!isFilterDropdownOpen) { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.borderColor = '#E2E8F0'; } }}
                        >
                            <Filter size={18} color={isFilterDropdownOpen ? '#10B981' : '#94A3B8'} style={{ transition: 'color 0.3s' }} />
                            {sortBy === 'newest' ? 'Latest Updates' : sortBy === 'oldest' ? 'Oldest First' : 'Largest Datasets'}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '4px', transition: 'transform 0.3s ease', transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: '#94A3B8' }}>
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </button>

                        <div style={{ 
                            position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: '220px', 
                            backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '6px',
                            boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)',
                            opacity: isFilterDropdownOpen ? 1 : 0, 
                            transform: isFilterDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)', 
                            pointerEvents: isFilterDropdownOpen ? 'auto' : 'none',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}>
                            {[
                                { id: 'newest', label: 'Latest Updates' },
                                { id: 'oldest', label: 'Oldest First' },
                                { id: 'most_images', label: 'Largest Datasets' }
                            ].map(option => (
                                <div 
                                    key={option.id}
                                    onClick={() => { setSortBy(option.id); setIsFilterDropdownOpen(false); }}
                                    style={{ 
                                        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                                        backgroundColor: sortBy === option.id ? '#F0FDF4' : 'transparent',
                                        color: sortBy === option.id ? '#10B981' : '#475569',
                                        transition: 'all 0.2s ease',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}
                                    onMouseEnter={(e) => { if(sortBy !== option.id) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                    onMouseLeave={(e) => { if(sortBy !== option.id) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    {option.label}
                                    {sortBy === option.id && <CheckCircle2 size={16} color="#10B981" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="dr-search-box">
                        <Search size={18} color="#94A3B8" />
                        <input 
                            type="text" 
                            placeholder="Search version, creator, or date..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="dr-search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Table Container */}
            <div className="dr-table-container stagger-2">
                <div className="dr-table-scroll-area">
                    <table className="dr-table">
                        <thead>
                            <tr>
                                <th style={{ paddingLeft: '32px' }}>Version Name</th>
                                <th>Size</th>
                                <th>Data Split</th>
                                <th>Created</th>
                                <th>Author</th>
                                <th style={{ textAlign: 'right', paddingRight: '32px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, idx) => <SkeletonRow key={`skel-${idx}`} />)
                            ) : paginatedDatasets.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '80px', textAlign: 'center' }}>
                                        <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', border: '1px dashed #CBD5E1' }}>
                                            <AlertCircle size={32} color="#94A3B8" />
                                        </div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#0F172A', fontSize: '18px', fontWeight: '700' }}>No datasets found</h3>
                                        <p style={{ margin: 0, color: '#64748B', fontSize: '14.5px' }}>We couldn't find any records matching your criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedDatasets.map((ds, index) => (
                                    <tr 
                                        key={ds.id} 
                                        className="dr-row"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <td style={{ padding: '20px 32px' }}>
                                            <div className="dr-version-cell">
                                                <div className="dr-icon-wrapper">
                                                    <Layers size={20} strokeWidth={2.5} />
                                                </div>
                                                {ds.version_name}
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px 24px' }}>
                                            <div className="dr-size-badge">
                                                {ds.total_images} <span className="dr-size-label">imgs</span>
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px 24px' }}>
                                            {renderSplitBar(ds.split)}
                                        </td>
                                        
                                        <td style={{ padding: '20px 24px', color: '#64748B', fontSize: '13.5px', fontWeight: '500' }}>
                                            {ds.created_at}
                                        </td>
                                        
                                        <td style={{ padding: '20px 24px' }}>
                                            <div className="dr-author-cell">
                                                {renderAvatar(ds.created_by)}
                                                {ds.created_by}
                                            </div>
                                        </td>
                                        
                                        <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                                            <div className="dr-actions">
                                                <button onClick={() => handleViewDetails(ds.id, ds.version_name)} className="dr-action-btn dr-btn-view" title="View Configuration">
                                                    <Eye size={18} />
                                                </button>
                                                <button onClick={() => handleDownload(ds.id, ds.version_name)} className="dr-action-btn dr-btn-down" title="Download YAML">
                                                    <Download size={18} />
                                                </button>
                                                <button onClick={() => triggerDelete(ds.id, ds.version_name)} className="dr-action-btn dr-btn-del" title="Delete Record">
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
                {!isLoading && filteredAndSortedDatasets.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
                        
                        {/* Custom Animated Dropdown Menu */}
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

            {/* --- CREATIVE VIEW MODAL --- */}
            {viewModalData && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div 
                        onClick={() => setViewModalData(null)} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(8px)', animation: 'fade-in-fast 0.3s ease-out forwards' }}
                    ></div>
                    
                    <div style={{ position: 'relative', width: '100%', maxWidth: '600px', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)', animation: 'scale-up-fast 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards', zIndex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        
                        {/* Modal Header */}
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to right, #F8FAFC, #FFFFFF)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: '#EFF6FF', borderRadius: '12px', color: '#3B82F6' }}>
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#0F172A', fontWeight: '800' }}>YAML Configuration</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748B', fontWeight: '600' }}>{viewModalData.title}.yaml</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setViewModalData(null)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', padding: 0, margin: 0, lineHeight: 0,
                                    background: '#F1F5F9', border: 'none', borderRadius: '50%', color: '#64748B', cursor: 'pointer', transition: 'all 0.2s' 
                                }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
                            >
                                <X size={20} style={{ display: 'block' }} />
                            </button>
                        </div>

                        {/* Modal Body (Code Block) */}
                        <div style={{ padding: '32px', backgroundColor: '#0F172A', maxHeight: '400px', overflowY: 'auto' }}>
                            <pre style={{ margin: 0, fontFamily: 'monospace', fontSize: '14px', color: '#38BDF8', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                <code>{viewModalData.content}</code>
                            </pre>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ padding: '20px 32px', backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={() => {
                                    handleDownload(datasets.find(d => d.version_name === viewModalData.title).id, viewModalData.title);
                                }}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '10px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: '#FFFFFF', border: 'none', fontWeight: '700', fontSize: '14px', cursor: 'pointer', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                            >
                                <Download size={16} /> Download File
                            </button>
                        </div>
                    </div>
                </div>,
                document.body 
            )}

            {/* --- CUSTOM CONFIRM MODAL FOR DELETE (PORTAL) --- */}
            {confirmModal.isOpen && createPortal(
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    
                    <div 
                        onClick={() => setConfirmModal({ isOpen: false, id: null, versionName: '' })} 
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
                                    Are you sure you want to permanently delete the dataset <strong style={{ color: '#0F172A' }}>'{confirmModal.versionName}'</strong>?
                                </p>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                                <button 
                                    onClick={() => setConfirmModal({ isOpen: false, id: null, versionName: '' })}
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
                                    Delete Dataset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default DatasetRecords;