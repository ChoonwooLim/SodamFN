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

    if (loading) return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: 24, background: '#e2e8f0', margin: '0 auto 16px', animation: 'pulse 2s infinite' }} />
                <div style={{ width: 120, height: 16, borderRadius: 8, background: '#e2e8f0' }} />
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
                        <div style={{ fontSize: 32, fontWeight: 900, color: 'white', letterSpacing: -1, marginTop: 4 }}>
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
                        <div key={i} style={{
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

    // ── Desktop Layout (existing) ──
    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 pb-32 md:pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">대시보드</h1>
                    <div className="flex flex-col mt-1 space-y-1">
                        <p className="text-slate-500">{businessName} 매장의 실시간 현황입니다.</p>
                        <p className="text-indigo-600 font-medium text-sm">
                            {formatDate(currentTime)} <span className="ml-1 font-bold">{formatTime(currentTime)}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5">
                        <option value="2024">2024년</option>
                        <option value="2025">2025년</option>
                        <option value="2026">2026년</option>
                    </select>
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5">
                        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
                    </select>
                    <div className="bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-semibold text-slate-700">영업중</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Wallet size={24} /></div>
                        <span className={`flex items-center gap-1 text-sm font-bold ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {revenueGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                            {revenueGrowth}%
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">이번 달 매출</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{revenue.toLocaleString()}원</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><ShoppingBag size={24} /></div>
                        <span className="text-sm font-bold text-slate-400">마진율 {marginRate}%</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">순이익</p>
                    <h3 className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{profit.toLocaleString()}원</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl"><Users size={24} /></div>
                        <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg">{staffCount}명 재직</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">재직 직원</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                        {staffNames.length > 0 ? (staffNames.length === 1 ? staffNames[0] : `${staffNames[0]} 외 ${staffCount - 1}명`) : '직원 없음'}
                    </h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><BarChart3 size={24} /></div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">이번 달 총 지출</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{expense.toLocaleString()}원</h3>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="font-bold text-lg text-slate-800">월별 수익 추이</h3>
                            <p className="text-sm text-slate-500">최근 6개월간의 순수익 변화</p>
                        </div>
                    </div>
                    <div className="h-[350px]">
                        {monthlyTrend && monthlyTrend.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorProfitD" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
                                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => formatKRW(v)} />
                                    <Tooltip formatter={v => [`${v.toLocaleString()}원`, '이익']} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: 12 }} />
                                    <Area type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitD)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>}
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 mb-2">매출 채널</h3>
                    <p className="text-sm text-slate-500 mb-6">플랫폼별 매출 비중</p>
                    <div className="h-[250px] relative">
                        {revenueData && revenueData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={revenueData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" isAnimationActive={false}>
                                        {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip formatter={v => `${v.toLocaleString()}원`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>}
                        {revenueData && revenueData.length > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-sm font-bold text-slate-400">{formatKRW(revenueData.reduce((s, e) => s + e.value, 0))}원</span>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 space-y-3">
                        {revenueData && revenueData.map((entry, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                                    <span className="text-slate-600">{entry.name}</span>
                                </div>
                                <span className="font-bold text-slate-900">{entry.value.toLocaleString()}원</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><BarChart3 size={18} /></div>
                        <div>
                            <h3 className="font-bold text-slate-800">지출 TOP 5 (거래처)</h3>
                            <p className="text-xs text-slate-500">가장 많은 지출이 발생한 거래처</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {costData.length > 0 ? costData.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>{idx + 1}</span>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{item.vendor}</p>
                                        <p className="text-xs text-slate-400">{item.item || '기타'}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-slate-900">{item.amount.toLocaleString()}원</span>
                            </div>
                        )) : <div className="text-center text-slate-400 py-8">거래 내역이 없습니다</div>}
                    </div>
                </div>

                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-2">손익 현황</h3>
                        <p className="text-slate-400 text-sm mb-6">{selectedYear}년 {selectedMonth}월 요약</p>
                        <div className="space-y-4">
                            {[
                                { label: '총 매출', value: revenue, dot: revenue > 0 ? 'bg-blue-500' : 'bg-slate-500' },
                                { label: '총 지출', value: expense, dot: expense > 0 ? 'bg-orange-500' : 'bg-slate-500' },
                                { label: profit >= 0 ? '영업이익' : '영업손실', value: profit, dot: profit >= 0 ? 'bg-emerald-500' : 'bg-red-500', highlight: true },
                            ].map((row, i) => (
                                <div key={i} className={`flex gap-3 items-start p-3 bg-white/10 rounded-xl ${row.highlight ? 'border border-white/20' : ''}`}>
                                    <div className={`w-2 h-2 rounded-full mt-2 ${row.dot}`}></div>
                                    <div className="flex-1">
                                        <div className="flex justify-between">
                                            <p className="text-sm font-bold">{row.label}</p>
                                            <p className={`text-sm font-bold ${row.highlight ? (profit >= 0 ? 'text-emerald-400' : 'text-red-400') : ''}`}>{row.value.toLocaleString()}원</p>
                                        </div>
                                        {row.highlight && <p className="text-xs text-slate-400 mt-1">마진율 {marginRate}%</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
