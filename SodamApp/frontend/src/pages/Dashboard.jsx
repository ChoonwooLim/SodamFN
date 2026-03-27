import { useEffect, useState } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Users, BarChart3, ShoppingBag } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';

export default function Dashboard() {
    const [dashData, setDashData] = useState(null);
    const [revenueData, setRevenueData] = useState([]);
    const [costData, setCostData] = useState([]);
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => { fetchData(selectedYear, selectedMonth); }, [selectedYear, selectedMonth]);
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async (year, month) => {
        try {
            setLoading(true);
            const [summaryRes, revenueRes, costRes] = await Promise.all([
                api.get(`/dashboard?year=${year}&month=${month}`),
                api.get(`/analytics/revenue?year=${year}&month=${month}`),
                api.get(`/analytics/cost?year=${year}&month=${month}`)
            ]);
            if (summaryRes.data.status === 'success') setDashData(summaryRes.data.data);
            if (revenueRes.data.status === 'success') setRevenueData(revenueRes.data.data);
            if (costRes.data.status === 'success') setCostData(costRes.data.data);
        } catch (e) {
            console.warn("Backend error:", e);
            setDashData(null); setRevenueData([]); setCostData([]);
        } finally { setLoading(false); }
    };

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

    if (loading && isMobile) return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
            {/* Skeleton Header */}
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #334155)', padding: '40px 20px 60px', borderRadius: '0 0 24px 24px' }}>
                <div className="skeleton" style={{ width: 120, height: 20, marginBottom: 8, opacity: 0.2 }} />
                <div className="skeleton" style={{ width: 180, height: 12, opacity: 0.15 }} />
                <div style={{ textAlign: 'center', marginTop: 24 }}>
                    <div className="skeleton" style={{ width: 80, height: 10, margin: '0 auto 8px', opacity: 0.15 }} />
                    <div className="skeleton" style={{ width: 160, height: 36, margin: '0 auto', opacity: 0.2 }} />
                </div>
            </div>
            {/* Skeleton KPI Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '16px', marginTop: -24 }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-card card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 10, margin: '0 auto 10px' }} />
                        <div className="skeleton skeleton-text sm" style={{ margin: '0 auto' }} />
                        <div className="skeleton skeleton-text" style={{ width: '70%', margin: '4px auto 0' }} />
                    </div>
                ))}
            </div>
            {/* Skeleton Chart */}
            <div className="skeleton-card card-animate" style={{ margin: '0 16px', animationDelay: '0.2s' }}>
                <div className="skeleton skeleton-text" style={{ width: '40%' }} />
                <div className="skeleton" style={{ height: 160, marginTop: 12 }} />
            </div>
            {/* Skeleton List */}
            <div className="skeleton-card card-animate" style={{ margin: '12px 16px', animationDelay: '0.3s' }}>
                <div className="skeleton skeleton-text" style={{ width: '30%' }} />
                {[1, 2, 3].map(i => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
                        <div className="skeleton" style={{ width: 24, height: 24, borderRadius: 8, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                            <div className="skeleton skeleton-text" style={{ width: '50%', marginBottom: 4 }} />
                            <div className="skeleton skeleton-text sm" />
                        </div>
                        <div className="skeleton" style={{ width: 60, height: 14 }} />
                    </div>
                ))}
            </div>
        </div>
    );

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-slate-200 rounded"></div>
            </div>
        </div>
    );

    const revenue = dashData?.revenue || 0;
    const expense = dashData?.expense || 0;
    const profit = dashData?.net_profit || 0;
    const marginRate = dashData?.margin_rate || 0;
    const revenueGrowth = dashData?.revenue_growth || 0;
    const monthlyTrend = dashData?.monthly_trend || [];
    const staffCount = dashData?.staff_count || 0;
    const staffNames = dashData?.staff_names || [];
    const businessName = dashData?.business_name || '소담김밥';

    const formatKRW = (v) => {
        if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
        if (Math.abs(v) >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
        return v.toLocaleString();
    };

    const formatDate = (date) => date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const formatTime = (date) => date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ── Mobile Layout ──
    if (isMobile) {
        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
                {/* Mobile Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '40px 20px 24px',
                    borderRadius: '0 0 24px 24px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: 'white', letterSpacing: -0.5 }}>
                                {businessName}
                            </div>
                            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                                {formatDate(currentTime)}
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                {formatTime(currentTime)}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'white', fontSize: 12, borderRadius: 8, padding: '4px 6px',
                                    outline: 'none',
                                }}
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y} style={{color:'#1e293b'}}>{y}</option>)}
                            </select>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                style={{
                                    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                                    color: 'white', fontSize: 12, borderRadius: 8, padding: '4px 6px',
                                    outline: 'none',
                                }}
                            >
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m} style={{color:'#1e293b'}}>{m}월</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Hero KPI: Revenue */}
                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 1 }}>이번 달 매출</div>
                        <div className="num-animate" style={{ fontSize: 32, fontWeight: 900, color: 'white', letterSpacing: -1, marginTop: 4 }}>
                            {formatKRW(revenue)}<span style={{ fontSize: 16, color: '#94a3b8' }}>원</span>
                        </div>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '4px 12px', borderRadius: 20, marginTop: 8,
                            background: revenueGrowth >= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                            color: revenueGrowth >= 0 ? '#34d399' : '#f87171',
                            fontSize: 12, fontWeight: 700,
                        }}>
                            {revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            전월 대비 {revenueGrowth}%
                        </div>
                    </div>
                </div>

                {/* 3 KPI Cards Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, padding: '16px 16px 0', marginTop: -20, position: 'relative', zIndex: 5 }}>
                    {[
                        { label: '순이익', value: profit, icon: Wallet, color: profit >= 0 ? '#10b981' : '#ef4444', bg: profit >= 0 ? '#ecfdf5' : '#fef2f2', sub: `마진 ${marginRate}%` },
                        { label: '총지출', value: expense, icon: ShoppingBag, color: '#f59e0b', bg: '#fffbeb', sub: '' },
                        { label: '직원', value: null, icon: Users, color: '#8b5cf6', bg: '#f5f3ff', sub: `${staffCount}명 재직` },
                    ].map((kpi, i) => (
                        <div key={i} className="card-animate touch-feedback" style={{
                            background: 'white', borderRadius: 16, padding: '14px 12px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                            textAlign: 'center',
                        }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 10, background: kpi.bg,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 8px',
                            }}>
                                <kpi.icon size={16} style={{ color: kpi.color }} />
                            </div>
                            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{kpi.label}</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>
                                {kpi.value !== null ? formatKRW(kpi.value) : (staffNames[0] || '-')}
                            </div>
                            {kpi.sub && <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{kpi.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* Mini Chart: Monthly Trend */}
                <div style={{ margin: '16px 16px 0', background: 'white', borderRadius: 20, padding: '18px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>월별 수익 추이</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>최근 6개월</div>
                        </div>
                    </div>
                    <div style={{ height: 180 }}>
                        {monthlyTrend && monthlyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={8} />
                                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatKRW(v)} />
                                    <Tooltip formatter={v => [`${v.toLocaleString()}원`, '이익']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 10, fontSize: 12 }} />
                                    <Area type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>데이터가 없습니다</div>
                        )}
                    </div>
                </div>

                {/* Revenue Channels */}
                <div style={{ margin: '12px 16px 0', background: 'white', borderRadius: 20, padding: '18px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>매출 채널</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>플랫폼별 비중</div>
                    {revenueData && revenueData.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 120, height: 120, position: 'relative', flexShrink: 0 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={revenueData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={4} dataKey="value" isAnimationActive={false}>
                                            {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b' }}>{formatKRW(revenueData.reduce((a, b) => a + b.value, 0))}</span>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {revenueData.map((e, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: 4, background: COLORS[i % COLORS.length] }} />
                                            <span style={{ color: '#64748b', fontWeight: 500 }}>{e.name}</span>
                                        </div>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatKRW(e.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>데이터가 없습니다</div>
                    )}
                </div>

                {/* Top Costs */}
                <div style={{ margin: '12px 16px 0', background: 'white', borderRadius: 20, padding: '18px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <BarChart3 size={14} style={{ color: '#ef4444' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>지출 TOP 5</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>거래처별 지출 순위</div>
                        </div>
                    </div>
                    {costData.length > 0 ? costData.map((item, idx) => (
                        <div key={idx} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 0',
                            borderBottom: idx < costData.length - 1 ? '1px solid #f1f5f9' : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span style={{
                                    width: 24, height: 24, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 11, fontWeight: 800,
                                    background: idx < 3 ? '#1e293b' : '#f1f5f9',
                                    color: idx < 3 ? 'white' : '#64748b',
                                }}>{idx + 1}</span>
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.vendor}</div>
                                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{item.item || '기타'}</div>
                                </div>
                            </div>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{item.amount.toLocaleString()}원</span>
                        </div>
                    )) : (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>거래 내역이 없습니다</div>
                    )}
                </div>

                {/* P/L Summary Card */}
                <div style={{
                    margin: '12px 16px 0',
                    background: 'linear-gradient(135deg, #1e293b, #334155)',
                    borderRadius: 20, padding: '20px 16px',
                }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'white', marginBottom: 4 }}>손익 현황</div>
                    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 14 }}>{selectedYear}년 {selectedMonth}월</div>
                    {[
                        { label: '총 매출', value: revenue, dot: revenue > 0 ? '#3b82f6' : '#475569' },
                        { label: '총 지출', value: expense, dot: expense > 0 ? '#f59e0b' : '#475569' },
                        { label: profit >= 0 ? '영업이익' : '영업손실', value: profit, dot: profit >= 0 ? '#10b981' : '#ef4444', highlight: true },
                    ].map((row, i) => (
                        <div key={i} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '10px 12px', marginBottom: 6,
                            background: 'rgba(255,255,255,0.08)', borderRadius: 12,
                            border: row.highlight ? '1px solid rgba(255,255,255,0.15)' : 'none',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 6, height: 6, borderRadius: 3, background: row.dot }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: 'white' }}>{row.label}</span>
                            </div>
                            <span style={{
                                fontSize: 13, fontWeight: 800,
                                color: row.highlight ? (profit >= 0 ? '#34d399' : '#f87171') : 'white',
                            }}>{row.value.toLocaleString()}원</span>
                        </div>
                    ))}
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#64748b', marginTop: 4 }}>마진율 {marginRate}%</div>
                </div>
            </div>
        );
    }

    // ── Desktop Layout (Premium Dark Theme) ──
    const CHART_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
    const gCard = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '28px 24px' };

    return (
        <div style={{ background: '#0f172a', minHeight: '100vh', padding: '0 0 40px' }}>
            <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #134e4a 100%)', padding: '40px 48px 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h1 style={{ fontSize: 28, fontWeight: 900, color: 'white', letterSpacing: -0.5, margin: 0 }}>{businessName}</h1>
                        <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>{formatDate(currentTime)}<span style={{ marginLeft: 8, color: '#64748b' }}>{formatTime(currentTime)}</span></p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: 13, borderRadius: 10, padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
                            {[2024, 2025, 2026].map(y => <option key={y} value={y} style={{ color: '#1e293b' }}>{y}년</option>)}
                        </select>
                        <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'white', fontSize: 13, borderRadius: 10, padding: '8px 12px', outline: 'none', cursor: 'pointer' }}>
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m} style={{ color: '#1e293b' }}>{m}월</option>)}
                        </select>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 20, padding: '6px 16px' }}>
                            <div style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', animation: 'pulse 2s infinite' }} />
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>영업중</span>
                        </div>
                    </div>
                </div>
            </div>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, paddingTop: 24 }}>
                    <div style={{ background: 'linear-gradient(135deg, #134e4a, #0d9488)', borderRadius: 20, padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Wallet size={22} color="white" /></div>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: revenueGrowth >= 0 ? '#a7f3d0' : '#fca5a5' }}>
                                {revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
                            </span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', margin: 0 }}>이번 달 매출</p>
                        <h3 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: '6px 0 0' }}>{revenue.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2 }}>원</span></h3>
                    </div>
                    <div style={gCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: profit >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ShoppingBag size={22} color={profit >= 0 ? '#10b981' : '#ef4444'} /></div>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: 8 }}>마진 {marginRate}%</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: 0 }}>순이익</p>
                        <h3 style={{ fontSize: 26, fontWeight: 900, color: profit >= 0 ? '#34d399' : '#f87171', margin: '6px 0 0' }}>{profit.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2 }}>원</span></h3>
                    </div>
                    <div style={gCard}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(139,92,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={22} color="#8b5cf6" /></div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#a78bfa', background: 'rgba(139,92,246,0.12)', padding: '4px 10px', borderRadius: 8 }}>{staffCount}명 재직</span>
                        </div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: 0 }}>재직 직원</p>
                        <h3 style={{ fontSize: 22, fontWeight: 900, color: 'white', margin: '6px 0 0' }}>{staffNames.length > 0 ? (staffNames.length === 1 ? staffNames[0] : `${staffNames[0]} 외 ${staffCount - 1}명`) : '직원 없음'}</h3>
                    </div>
                    <div style={gCard}>
                        <div style={{ marginBottom: 16 }}><div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={22} color="#f59e0b" /></div></div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', margin: 0 }}>이번 달 총 지출</p>
                        <h3 style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: '6px 0 0' }}>{expense.toLocaleString()}<span style={{ fontSize: 14, fontWeight: 500, marginLeft: 2 }}>원</span></h3>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginTop: 20 }}>
                    <div style={gCard}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>월별 수익 추이</h3>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 24 }}>최근 6개월간의 순수익 변화</p>
                        <div style={{ height: 320 }}>
                            {monthlyTrend && monthlyTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs><linearGradient id="colorProfitD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0d9488" stopOpacity={0.25} /><stop offset="95%" stopColor="#0d9488" stopOpacity={0} /></linearGradient></defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => formatKRW(v)} />
                                        <Tooltip formatter={v => [`${v.toLocaleString()}원`, '이익']} contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: 14, color: 'white' }} labelStyle={{ color: '#94a3b8' }} itemStyle={{ color: '#5eead4' }} />
                                        <Area type="monotone" dataKey="profit" stroke="#14b8a6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitD)" isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>데이터가 없습니다</div>}
                        </div>
                    </div>
                    <div style={gCard}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>매출 채널</h3>
                        <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 20 }}>플랫폼별 매출 비중</p>
                        <div style={{ height: 220, position: 'relative' }}>
                            {revenueData && revenueData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart><Pie data={revenueData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" isAnimationActive={false}>{revenueData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 5]} />)}</Pie>
                                        <Tooltip formatter={v => `${v.toLocaleString()}원`} contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: 'white' }} /></PieChart>
                                </ResponsiveContainer>
                            ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>데이터가 없습니다</div>}
                            {revenueData && revenueData.length > 0 && (<div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}><span style={{ fontSize: 14, fontWeight: 800, color: '#94a3b8' }}>{formatKRW(revenueData.reduce((s, e) => s + e.value, 0))}원</span></div>)}
                        </div>
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {revenueData && revenueData.map((entry, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 5, background: CHART_COLORS[i % 5] }} /><span style={{ color: '#94a3b8' }}>{entry.name}</span></div>
                                    <span style={{ fontWeight: 700, color: 'white' }}>{entry.value.toLocaleString()}원</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
                    <div style={gCard}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><BarChart3 size={20} color="#ef4444" /></div>
                            <div><h3 style={{ fontSize: 16, fontWeight: 800, color: 'white', margin: 0 }}>지출 TOP 5 (거래처)</h3><p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>가장 많은 지출이 발생한 거래처</p></div>
                        </div>
                        {costData.length > 0 ? costData.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 12px', borderBottom: idx < costData.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                    <span style={{ width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: idx < 3 ? 'linear-gradient(135deg, #14b8a6, #0d9488)' : 'rgba(255,255,255,0.08)', color: idx < 3 ? 'white' : '#64748b' }}>{idx + 1}</span>
                                    <div><p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>{item.vendor}</p><p style={{ fontSize: 11, color: '#64748b', margin: '2px 0 0' }}>{item.item || '기타'}</p></div>
                                </div>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{item.amount.toLocaleString()}원</span>
                            </div>
                        )) : <div style={{ padding: '40px 0', textAlign: 'center', color: '#475569' }}>거래 내역이 없습니다</div>}
                    </div>
                    <div style={{ ...gCard, background: 'linear-gradient(145deg, #1e293b, #0f172a)', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: -60, right: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.08), transparent)', pointerEvents: 'none' }} />
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <h3 style={{ fontSize: 18, fontWeight: 800, color: 'white', margin: 0 }}>손익 현황</h3>
                            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 24 }}>{selectedYear}년 {selectedMonth}월 요약</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {[
                                    { label: '총 매출', value: revenue, dc: revenue > 0 ? '#3b82f6' : '#475569', vc: 'white' },
                                    { label: '총 지출', value: expense, dc: expense > 0 ? '#f59e0b' : '#475569', vc: 'white' },
                                    { label: profit >= 0 ? '영업이익' : '영업손실', value: profit, dc: profit >= 0 ? '#10b981' : '#ef4444', vc: profit >= 0 ? '#34d399' : '#f87171', hl: true },
                                ].map((row, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: row.hl ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', borderRadius: 14, border: row.hl ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 8, height: 8, borderRadius: 4, background: row.dc }} /><span style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0' }}>{row.label}</span></div>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: row.vc }}>{row.value.toLocaleString()}원</span>
                                    </div>
                                ))}
                            </div>
                            <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', marginTop: 12, fontWeight: 600 }}>마진율 {marginRate}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
