import React, { useState, useEffect } from 'react';
import { Activity, ShieldAlert, Target, TrendingUp, Filter, BarChart2, PieChart, Layers } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { API_BASE_URL } from '../config';

const GlobalAnalytics = () => {
    const [data, setData] = useState({ kpis: {}, trends: [], distribution: [] });
    const [isLoading, setIsLoading] = useState(true);
    const [timeFilter, setTimeFilter] = useState('30days');

    useEffect(() => {
        fetchAnalytics();
    }, [timeFilter]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/global-analytics/?filter=${timeFilter}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const result = await response.json();
                setData(result);
            }
        } catch (error) {
            console.error("Failed to fetch analytics:", error);
        } finally {
            setTimeout(() => setIsLoading(false), 400); // Slight delay to show off animations
        }
    };

    // Modern vibrant color palette for the Anomaly Distribution
    const COLORS = ['#FF3B30', '#F59E0B', '#3B82F6', '#8B5CF6', '#10B981', '#EC4899', '#06B6D4'];

    return (
        <div className="ga-wrapper">
            <style dangerouslySetInnerHTML={{__html: `
                .ga-wrapper { width: 100%; display: flex; flex-direction: column; gap: 24px; box-sizing: border-box; }
                
                /* Layout Grids */
                .kpi-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    width: 100%;
                }
                .chart-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 24px;
                    width: 100%;
                }

                /* Responsive fallback for very small screens */
                @media (max-width: 1100px) {
                    .chart-grid { grid-template-columns: 1fr; }
                    .kpi-grid { grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
                }

                /* Animations */
                @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
                @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes pulse-soft { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }

                .anim-stagger-1 { animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                .anim-stagger-2 { animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.1s; opacity: 0; }
                .anim-stagger-3 { animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.2s; opacity: 0; }
                .anim-stagger-4 { animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards 0.3s; opacity: 0; }

                /* Main Cards */
                .ga-card { 
                    background: #FFFFFF; border-radius: 24px; border: 1px solid #E2E8F0; 
                    box-shadow: 0 10px 40px -10px rgba(15, 23, 42, 0.05); padding: 32px; 
                    position: relative; overflow: hidden; transition: all 0.3s ease; 
                    box-sizing: border-box;
                }
                .ga-card:hover { box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.08); border-color: #CBD5E1; }

                /* KPI Cards */
                .ga-kpi-card { 
                    background: linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%); 
                    border-radius: 20px; border: 1px solid #E2E8F0; padding: 24px 28px; 
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02); display: flex; align-items: center; gap: 24px; 
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); position: relative; overflow: hidden;
                }
                .ga-kpi-card:hover { transform: translateY(-6px); box-shadow: 0 15px 30px -10px rgba(0,0,0,0.1); border-color: #CBD5E1; }
                
                /* Dynamic KPI Icons */
                .kpi-icon-box { 
                    width: 64px; height: 64px; border-radius: 18px; display: flex; align-items: center; justify-content: center; 
                    box-shadow: inset 0 2px 4px rgba(255,255,255,0.5), 0 8px 16px rgba(0,0,0,0.08); transition: transform 0.4s ease;
                }
                .ga-kpi-card:hover .kpi-icon-box { transform: scale(1.1) rotate(-5deg); }
                
                .kpi-green { background: linear-gradient(135deg, #34D399 0%, #059669 100%); color: white; }
                .kpi-red { background: linear-gradient(135deg, #F87171 0%, #DC2626 100%); color: white; }
                .kpi-blue { background: linear-gradient(135deg, #60A5FA 0%, #2563EB 100%); color: white; }

                /* Filter Controls */
                .ga-filter-container {
                    display: flex; align-items: center; background-color: #F1F5F9; padding: 6px; 
                    border-radius: 16px; border: 1px solid #E2E8F0; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .ga-filter-btn {
                    padding: 10px 20px; border: none; border-radius: 12px; font-size: 13.5px; font-weight: 700; 
                    cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .ga-filter-btn.active { background-color: #FFFFFF; color: #0F172A; box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: scale(1.02); }
                .ga-filter-btn.inactive { background-color: transparent; color: #64748B; }
                .ga-filter-btn.inactive:hover { color: #0F172A; }

                /* Custom Recharts Tooltip */
                .custom-recharts-tooltip { 
                    background: rgba(15,23,42,0.9) !important; border: 1px solid #334155 !important; border-radius: 12px !important; 
                    color: #fff !important; font-size: 13px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.3) !important; padding: 14px 18px !important; backdrop-filter: blur(4px);
                }
            `}} />

            {/* --- HEADER & CONTROLS --- */}
            <div className="ga-card anim-stagger-1" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 36px' }}>
                <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '300px', background: 'linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.04))', pointerEvents: 'none' }}></div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', zIndex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '14px', background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)', borderRadius: '16px', color: '#2563EB', boxShadow: '0 4px 14px rgba(59, 130, 246, 0.15)' }}>
                        <Activity size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h2 style={{ margin: '0 0 6px 0', fontSize: '26px', color: '#0F172A', fontWeight: '800', letterSpacing: '-0.5px' }}>Global Analytics</h2>
                        <p style={{ margin: 0, color: '#64748B', fontSize: '15px', fontWeight: '500' }}>Monitor defect telemetry, severity distribution, and operational KPIs.</p>
                    </div>
                </div>

                <div className="ga-filter-container" style={{ zIndex: 1 }}>
                    {[ {id: '7days', label: '7 Days'}, {id: '30days', label: '30 Days'}, {id: '1year', label: '1 Year'} ].map(filter => (
                        <button
                            key={filter.id}
                            onClick={() => setTimeFilter(filter.id)}
                            className={`ga-filter-btn ${timeFilter === filter.id ? 'active' : 'inactive'}`}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- KPI CARDS --- */}
            <div className="kpi-grid">
                <div className="ga-kpi-card anim-stagger-2">
                    <div className="kpi-icon-box kpi-green"><Layers size={32} /></div>
                    <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Boards Inspected</p>
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '1' }}>
                            {isLoading ? <span style={{ opacity: 0.5, animation: 'pulse-soft 1.5s infinite' }}>Loading...</span> : (data?.kpis?.total_inspections || 0).toLocaleString()}
                        </h3>
                    </div>
                </div>
                
                <div className="ga-kpi-card anim-stagger-3">
                    <div className="kpi-icon-box kpi-red"><ShieldAlert size={32} /></div>
                    <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Anomalies Detected</p>
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '1' }}>
                            {isLoading ? <span style={{ opacity: 0.5, animation: 'pulse-soft 1.5s infinite' }}>Loading...</span> : (data?.kpis?.total_defects || 0).toLocaleString()}
                        </h3>
                    </div>
                </div>
                
                <div className="ga-kpi-card anim-stagger-4">
                    <div className="kpi-icon-box kpi-blue"><Target size={32} /></div>
                    <div>
                        <p style={{ margin: '0 0 6px 0', fontSize: '12.5px', fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Confidence Score</p>
                        <h3 style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#0F172A', lineHeight: '1' }}>
                            {isLoading ? <span style={{ opacity: 0.5, animation: 'pulse-soft 1.5s infinite' }}>Loading...</span> : `${data?.kpis?.avg_confidence || 0}%`}
                        </h3>
                    </div>
                </div>
            </div>

            {/* --- CHARTS ROW --- */}
            <div className="chart-grid">
                
                {/* Defect Trends (Area Chart) */}
                <div className="ga-card anim-stagger-3" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 style={{ margin: 0, fontSize: '19px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '6px', backgroundColor: '#FEF2F2', borderRadius: '8px', color: '#EF4444' }}><TrendingUp size={18}/></div>
                            Defect Detection Trends
                        </h3>
                        {/* Fake mini-badge for aesthetic */}
                        <span style={{ padding: '4px 10px', background: '#F8FAFC', borderRadius: '20px', fontSize: '12px', fontWeight: '700', color: '#64748B', border: '1px solid #E2E8F0' }}>Live Stream</span>
                    </div>

                    <div style={{ height: '380px', width: '100%' }}>
                        {!isLoading && data.trends?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                {/* THE FIX IS HERE: margin left increased from -20 to 20 */}
                                <AreaChart data={data.trends} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorDefects" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4}/>
                                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="date" tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0', strokeWidth: 2 }} tickLine={false} tickMargin={12} />
                                    <YAxis tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#E2E8F0', strokeWidth: 0 }} tickLine={false} tickMargin={12} />
                                    <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: 'none', borderRadius: '12px', color: '#fff', padding: '12px 16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }} itemStyle={{ color: '#FCA5A5', fontWeight: '800', fontSize: '15px' }} labelStyle={{ color: '#94A3B8', marginBottom: '4px', fontSize: '13px', fontWeight: '600' }} />
                                    <Area type="monotone" dataKey="defects" name="Anomalies Found" stroke="#EF4444" strokeWidth={4} fillOpacity={1} fill="url(#colorDefects)" activeDot={{ r: 8, strokeWidth: 2, stroke: '#FFFFFF', fill: '#EF4444' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: '12px' }}>
                                {isLoading ? (
                                    <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                ) : (
                                    <>
                                        <TrendingUp size={48} opacity={0.3} />
                                        <span style={{ fontWeight: '600' }}>No trend data recorded for this period.</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Defect Severity/Classification (Bar Chart) */}
                <div className="ga-card anim-stagger-4" style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                        <h3 style={{ margin: 0, fontSize: '19px', color: '#0F172A', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ padding: '6px', backgroundColor: '#FFFBEB', borderRadius: '8px', color: '#F59E0B' }}><PieChart size={18}/></div>
                            Anomaly Distribution
                        </h3>
                    </div>

                    <div style={{ height: '380px', width: '100%' }}>
                        {!isLoading && data.distribution?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.distribution} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="4 4" horizontal={false} stroke="#E2E8F0" />
                                    <XAxis type="number" tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} tickMargin={12} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: '#1E293B', fontSize: 13, fontWeight: 700 }} axisLine={{ stroke: '#E2E8F0', strokeWidth: 2 }} tickLine={false} width={110} />
                                    <RechartsTooltip cursor={{fill: 'rgba(241, 245, 249, 0.6)'}} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: 'none', borderRadius: '12px', color: '#fff', padding: '12px 16px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)' }} itemStyle={{ fontWeight: '800', fontSize: '15px', color: '#FFFFFF' }} labelStyle={{ display: 'none' }} />
                                    <Bar dataKey="value" name="Total Count" radius={[0, 8, 8, 0]} barSize={28}>
                                        {data.distribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', gap: '12px' }}>
                                {isLoading ? (
                                    <div style={{ width: '40px', height: '40px', border: '3px solid #E2E8F0', borderTopColor: '#F59E0B', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                ) : (
                                    <>
                                        <PieChart size={48} opacity={0.3} />
                                        <span style={{ fontWeight: '600' }}>No classifications to display.</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default GlobalAnalytics;