import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShieldAlert, Search, Download, Terminal, Activity, Database, Cpu, AlertTriangle, ShieldCheck, Info, Settings, Lock, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const AuditLogs = () => {
    const [logs, setLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    // Reset to page 1 whenever filters or search change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, typeFilter, itemsPerPage]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            // 👇 ADDED THIS CHECK 👇
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setIsFilterDropdownOpen(false);
            }
        };
        
        if (isDropdownOpen || isFilterDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen, isFilterDropdownOpen]); 

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/audit-logs/`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setLogs(data);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs:", error);
        } finally {
            setTimeout(() => setIsLoading(false), 400); // Slight delay for animation effect
        }
    };

    // Export Logs to CSV
    const exportToCSV = () => {
        if (logs.length === 0) return;
        const headers = ['Timestamp', 'User', 'Role', 'Event Type', 'Severity', 'Description'];
        const csvContent = [
            headers.join(','),
            ...filteredLogs.map(log => 
                `"${log.timestamp}","${log.user}","${log.role}","${log.event_type}","${log.severity}","${log.description.replace(/"/g, '""')}"`
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `PCB_Audit_Logs_${new Date().getTime()}.csv`;
        link.click();
    };

    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const query = searchQuery.toLowerCase();
            const matchesSearch = 
                log.user.toLowerCase().includes(query) || 
                log.description.toLowerCase().includes(query) ||
                log.event_type.toLowerCase().includes(query) ||
                log.timestamp.toLowerCase().includes(query);
            
            const matchesType = typeFilter === 'All' || log.event_type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [logs, searchQuery, typeFilter]);

    // Pagination Math
    const totalItems = filteredLogs.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

    // UI Helpers
    const getEventIcon = (type) => {
        switch(type) {
            case 'DATA_MUTATION': return <Database size={16} color="#3B82F6" />;
            case 'COMPUTE_EXECUTION': return <Cpu size={16} color="#F59E0B" />;
            case 'OPTICAL_INSPECTION': return <Activity size={16} color="#10B981" />;
            case 'SYSTEM_CHANGE': return <Settings size={16} color="#8B5CF6" />;
            case 'ACCESS_CONTROL': return <Lock size={16} color="#EC4899" />;
            default: return <Terminal size={16} color="#64748B" />;
        }
    };

    const getSeverityStyle = (severity) => {
        switch(severity) {
            case 'critical': return { bg: '#FEF2F2', text: '#EF4444', border: '#FCA5A5', icon: <AlertTriangle size={14}/> };
            case 'warning': return { bg: '#FFFBEB', text: '#F59E0B', border: '#FDE68A', icon: <Info size={14}/> };
            case 'success': return { bg: '#F0FDF4', text: '#10B981', border: '#A7F3D0', icon: <ShieldCheck size={14}/> };
            default: return { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0', icon: <Info size={14}/> };
        }
    };

    return (
        <div style={{ width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.4s ease-out' }}>
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
                
                .terminal-card { 
                    background: #FFFFFF; border-radius: 20px; border: 1px solid #E2E8F0; 
                    box-shadow: 0 8px 30px rgba(15, 23, 42, 0.03); position: relative; overflow: hidden; 
                }
                
                .log-row { 
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
                    border-bottom: 1px solid #E2E8F0; 
                    background: #FFFFFF;
                    opacity: 0;
                    animation: fadeSlideIn 0.4s ease forwards;
                }
                .log-row:hover { 
                    background: #F8FAFC; 
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px -6px rgba(15, 23, 42, 0.08);
                    z-index: 10;
                    position: relative;
                }
                
                /* Fancy Search Bar */
                .search-box {
                    display: flex; align-items: center; background-color: #F8FAFC; 
                    padding: 12px 20px; border-radius: 14px; border: 2px solid #E2E8F0; 
                    width: 100%; max-width: 350px; transition: all 0.3s ease;
                }
                .search-box:focus-within {
                    border-color: #EF4444; background-color: #FFFFFF; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1);
                }
            `}</style>

           {/* --- HEADER --- */}
<div className="terminal-card" style={{ animation: 'slideUp 0.4s ease forwards', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', gap: '16px', flexWrap: 'nowrap', overflow: 'visible', zIndex: 20 }}>
    
    {/* Decorative Background Orbs - Now wrapped to prevent bleeding! */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', borderRadius: '20px', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', right: '-5%', top: '-50%', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.06) 0%, transparent 70%)', borderRadius: '50%' }}></div>
        <div style={{ position: 'absolute', left: '40%', bottom: '-50%', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.04) 0%, transparent 70%)', borderRadius: '50%' }}></div>
    </div>

    <div style={{ zIndex: 1, minWidth: 0, flex: '1 1 auto' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '22px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap' }}>
            <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '12px', color: '#EF4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)', flexShrink: 0 }}>
                <ShieldAlert size={24} strokeWidth={2.5} />
            </div>
            Security Events & Audit Logs
        </h2>
        <p style={{ margin: 0, color: '#64748B', fontSize: '13.5px', paddingLeft: '52px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Immutable timeline of all user actions, data mutations, and AI pipeline executions.</p>
    </div>

    <div style={{ display: 'flex', gap: '12px', zIndex: 1, alignItems: 'center', flexShrink: 0 }}>
        
        {/* PREMIUM ANIMATED DROPDOWN FILTER */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={filterDropdownRef}>
            <button
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: '#FFFFFF',
                    border: `2px solid ${isFilterDropdownOpen ? '#10B981' : '#E2E8F0'}`,
                    borderRadius: '12px',
                    padding: '10px 16px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    color: '#0F172A',
                    cursor: 'pointer',
                    boxShadow: isFilterDropdownOpen ? '0 0 0 4px rgba(16, 185, 129, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    width: '190px'
                }}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {typeFilter === 'All' ? <Activity size={16} color="#10B981" /> : getEventIcon(typeFilter)}
                    {typeFilter === 'All' ? 'All Events' : typeFilter.split('_')[0]}
                </span>
                
                {/* Animated Chevron */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isFilterDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </button>

            {/* Custom Animated Floating Menu */}
            <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '100%',
                backgroundColor: '#FFFFFF', borderRadius: '14px', border: '1px solid #E2E8F0', padding: '8px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1)', zIndex: 50,
                opacity: isFilterDropdownOpen ? 1 : 0,
                transform: isFilterDropdownOpen ? 'translateY(0) scale(1)' : 'translateY(-10px) scale(0.95)',
                pointerEvents: isFilterDropdownOpen ? 'auto' : 'none',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex', flexDirection: 'column', gap: '4px'
            }}>
                {[
                    { val: 'All', label: 'All Events', icon: <Activity size={14} /> },
                    { val: 'DATA_MUTATION', label: 'Data Mutation', icon: <Database size={14} /> },
                    { val: 'COMPUTE_EXECUTION', label: 'Compute Execution', icon: <Cpu size={14} /> },
                    { val: 'OPTICAL_INSPECTION', label: 'Optical Inspection', icon: <ShieldCheck size={14} /> },
                    { val: 'SYSTEM_CHANGE', label: 'System Change', icon: <Settings size={14} /> },
                    { val: 'ACCESS_CONTROL', label: 'Access Control', icon: <Lock size={14} /> }
                ].map((opt) => {
                    const isSelected = typeFilter === opt.val;
                    return (
                        <div
                            key={opt.val}
                            onClick={() => { setTypeFilter(opt.val); setIsFilterDropdownOpen(false); }}
                            style={{
                                padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                                backgroundColor: isSelected ? '#F0FDF4' : 'transparent',
                                color: isSelected ? '#10B981' : '#475569',
                                transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '10px'
                            }}
                            onMouseEnter={(e) => { if (!isSelected) { e.currentTarget.style.backgroundColor = '#F8FAFC'; e.currentTarget.style.color = '#0F172A'; } }}
                            onMouseLeave={(e) => { if (!isSelected) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; } }}
                        >
                            <div style={{ color: isSelected ? '#10B981' : '#94A3B8', display: 'flex', alignItems: 'center' }}>
                                {opt.icon}
                            </div>
                            <span style={{ flex: 1 }}>{opt.label}</span>
                            {isSelected && <CheckCircle2 size={16} strokeWidth={2.5} color="#10B981" />}
                        </div>
                    );
                })}
            </div>
        </div>

        <button 
            onClick={exportToCSV}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)', whiteSpace: 'nowrap' }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
            <Download size={16} /> Export CSV
        </button>
    </div>
</div>

            {/* --- SEARCH & TABLE --- */}
            <div className="terminal-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', animation: 'slideUp 0.4s ease forwards 0.1s', opacity: 0 }}>
                
                {/* Search Bar Row */}
                <div style={{ padding: '24px 32px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center' }}>
                    <div className="search-box">
                        <Search size={18} color="#94A3B8" />
                        <input 
                            type="text" placeholder="Search events, users, or dates..." 
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '14.5px', color: '#1E293B', marginLeft: '12px', width: '100%', fontWeight: '500' }} 
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div style={{ overflowX: 'auto', minHeight: '400px' }}>
                    <table style={{ width: '100%', minWidth: '1000px', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#F8FAFC' }}>
                            <tr>
                                <th style={{ padding: '18px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Timestamp</th>
                                <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Personnel</th>
                                <th style={{ padding: '18px 24px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Event Classification</th>
                                <th style={{ padding: '18px 32px', fontSize: '12px', color: '#64748B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>System Log Description</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '80px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#EF4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                            <span style={{ color: '#94A3B8', fontWeight: '600', fontSize: '14px' }}>Scanning Secure Database...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : paginatedLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '80px', textAlign: 'center' }}>
                                        <ShieldAlert size={48} color="#CBD5E1" style={{ marginBottom: '12px' }}/>
                                        <h3 style={{ margin: '0 0 4px 0', color: '#334155', fontSize: '18px' }}>No Security Events Found</h3>
                                        <p style={{ margin: 0, color: '#94A3B8', fontSize: '14px' }}>Try adjusting your search or filter criteria.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedLogs.map((log, index) => {
                                    const sev = getSeverityStyle(log.severity);
                                    return (
                                        <tr key={log.id} className="log-row" style={{ animationDelay: `${index * 0.05}s` }}>
                                            <td style={{ padding: '20px 32px', color: '#475569', fontSize: '13.5px', fontWeight: '600', fontFamily: 'monospace' }}>
                                                {log.timestamp}
                                            </td>
                                            
                                            {/* THE FIX: Updated Personnel Column */}
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{ 
                                                        width: '28px', height: '28px', 
                                                        borderRadius: '50%', 
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                        fontWeight: '700', fontSize: '11px', 
                                                        lineHeight: 1, 
                                                        paddingTop: '1px', 
                                                        color: '#475569', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', flexShrink: 0 
                                                    }}>
                                                        {(log.user && log.user !== 'System') 
                                                            ? log.user
                                                                .replace(/([a-z])([A-Z])/g, '$1 $2')
                                                                .split(/[\s_]+/)                     
                                                                .map(n => n[0])                      
                                                                .join('')                          
                                                                .substring(0, 2)                     
                                                                .toUpperCase()                   
                                                            : 'SY'
                                                        }
                                                    </div>
                                                    <span style={{ fontSize: '13.5px', color: '#334155', fontWeight: '600' }}>
                                                        {log.user || 'System'}
                                                    </span>
                                                </div>
                                            </td>
                                            
                                            <td style={{ padding: '20px 24px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#F8FAFC', borderRadius: '10px', width: 'fit-content', border: '1px solid #E2E8F0' }}>
                                                    {getEventIcon(log.event_type)}
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>{log.event_type}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '20px 32px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                    <span style={{ 
                                                        padding: '6px 10px', borderRadius: '8px', backgroundColor: sev.bg, color: sev.text, border: `1px solid ${sev.border}`, 
                                                        display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', whiteSpace: 'nowrap',
                                                        animation: log.severity === 'critical' ? 'pulse-red 2s infinite' : 'none'
                                                    }}>
                                                        {sev.icon} {log.severity}
                                                    </span>
                                                    <span style={{ fontSize: '14.5px', color: '#334155', fontWeight: '500', lineHeight: '1.5' }}>{log.description}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* --- MODERN PAGINATION FOOTER --- */}
                {!isLoading && filteredLogs.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 32px', backgroundColor: '#FFFFFF', borderTop: '1px solid #E2E8F0' }}>
                        
                        {/* THE FIX: Rows Per Page Dropdown */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }} ref={dropdownRef}>
                            <span style={{ fontSize: '13px', color: '#64748B', fontWeight: '600' }}>ROWS PER PAGE</span>
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                style={{ 
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 16px', backgroundColor: '#FFFFFF', borderRadius: '10px', 
                                    border: `2px solid ${isDropdownOpen ? '#EF4444' : '#E2E8F0'}`, 
                                    color: '#0F172A', fontSize: '14px', fontWeight: '700', cursor: 'pointer', 
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    boxShadow: isDropdownOpen ? '0 0 0 4px rgba(239, 68, 68, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)'
                                }}
                            >
                                {itemsPerPage < 10 ? `0${itemsPerPage}` : itemsPerPage}
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
                                        onClick={() => { setItemsPerPage(num); setIsDropdownOpen(false); }}
                                        style={{ 
                                            padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13.5px', fontWeight: '600',
                                            backgroundColor: itemsPerPage === num ? '#FEF2F2' : 'transparent',
                                            color: itemsPerPage === num ? '#EF4444' : '#475569',
                                            transition: 'all 0.2s ease',
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                        }}
                                        onMouseEnter={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = '#F8FAFC'; }}
                                        onMouseLeave={(e) => { if(itemsPerPage !== num) e.currentTarget.style.backgroundColor = 'transparent'; }}
                                    >
                                        {num < 10 ? `0${num}` : num}
                                        {itemsPerPage === num && <CheckCircle2 size={14} color="#EF4444" />}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tracker & Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748B', fontWeight: '500' }}>
                                <span style={{ backgroundColor: '#F1F5F9', color: '#0F172A', padding: '4px 10px', borderRadius: '8px', fontWeight: '700', border: '1px solid #E2E8F0' }}>
                                    {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalItems)}
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
                                        boxShadow: currentPage === 1 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    onMouseEnter={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                                    onMouseLeave={(e) => { if (currentPage !== 1) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                >
                                    <ChevronLeft size={16}/> Prev
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
                                        boxShadow: currentPage === totalPages || totalPages === 0 ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
                                        display: 'flex', alignItems: 'center', gap: '6px'
                                    }}
                                    onMouseEnter={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.transform = 'scale(1.05)'; } }}
                                    onMouseLeave={(e) => { if (currentPage !== totalPages && totalPages !== 0) { e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.transform = 'scale(1)'; } }}
                                >
                                    Next <ChevronRight size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditLogs;