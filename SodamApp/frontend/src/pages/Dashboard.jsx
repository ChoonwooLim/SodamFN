import { useEffect, useState } from 'react';
import api from '../api';
import { formatNumber, formatCurrency } from '../utils/format';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Users, BarChart3, ShoppingBag, LayoutDashboard } from 'lucide-react';
import { useIsMobile } from '../hooks/useMediaQuery';

const fmtWon = (v) => formatCurrency(v);
const fmtWonProfit = (v) => [fmtWon(v), '이익'];

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

    // ── Mobile Skeleton ──
    if (loading && isMobile) return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Skeleton Header */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-5 pt-10 pb-14 rounded-b-3xl">
                <div className="skeleton w-[120px] h-5 mb-2 opacity-20" />
                <div className="skeleton w-[180px] h-3 opacity-15" />
                <div className="text-center mt-6">
                    <div className="skeleton w-20 h-2.5 mx-auto mb-2 opacity-15" />
                    <div className="skeleton w-40 h-9 mx-auto opacity-20" />
                </div>
            </div>
            {/* Skeleton KPI Cards */}
            <div className="grid grid-cols-3 gap-2.5 px-4 -mt-6 relative z-10">
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton-card card-animate" style={{ animationDelay: `${i * 0.05}s` }}>
                        <div className="skeleton w-8 h-8 rounded-[10px] mx-auto mb-2.5" />
                        <div className="skeleton skeleton-text sm mx-auto" />
                        <div className="skeleton skeleton-text w-[70%] mx-auto mt-1" />
                    </div>
                ))}
            </div>
            {/* Skeleton Chart */}
            <div className="skeleton-card card-animate mx-4 mt-3" style={{ animationDelay: '0.2s' }}>
                <div className="skeleton skeleton-text w-[40%]" />
                <div className="skeleton h-40 mt-3" />
            </div>
            {/* Skeleton List */}
            <div className="skeleton-card card-animate mx-4 mt-3" style={{ animationDelay: '0.3s' }}>
                <div className="skeleton skeleton-text w-[30%]" />
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2.5 py-2.5">
                        <div className="skeleton w-6 h-6 rounded-lg shrink-0" />
                        <div className="flex-1">
                            <div className="skeleton skeleton-text w-[50%] mb-1" />
                            <div className="skeleton skeleton-text sm" />
                        </div>
                        <div className="skeleton w-[60px] h-3.5" />
                    </div>
                ))}
            </div>
        </div>
    );

    // ── Desktop Skeleton ──
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
        if (Math.abs(v) >= 10000) return `${formatNumber(Math.round(v / 10000))}만`;
        return formatNumber(v);
    };

    const formatDate = (date) => date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    const formatTime = (date) => date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // ── Mobile Layout ──
    if (isMobile) {
        return (
            <div className="min-h-screen bg-slate-50 pb-24">
                {/* Mobile Header */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-700 px-5 pt-10 pb-6 rounded-b-3xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="text-xl font-extrabold text-white tracking-tight">
                                {businessName}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                {formatDate(currentTime)}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                                {formatTime(currentTime)}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="bg-white/10 border border-white/15 text-white text-xs rounded-lg px-1.5 py-1 outline-none"
                            >
                                {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-slate-800">{y}</option>)}
                            </select>
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                className="bg-white/10 border border-white/15 text-white text-xs rounded-lg px-1.5 py-1 outline-none"
                            >
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m} className="text-slate-800">{m}월</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Hero KPI: Revenue */}
                    <div className="mt-5 text-center">
                        <div className="text-[11px] text-slate-400 font-semibold tracking-widest">이번 달 매출</div>
                        <div className="num-animate text-[32px] font-black text-white tracking-tight mt-1">
                            {formatKRW(revenue)}<span className="text-base text-slate-400">원</span>
                        </div>
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full mt-2 text-xs font-bold ${
                            revenueGrowth >= 0
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-red-500/15 text-red-300'
                        }`}>
                            {revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                            전월 대비 {revenueGrowth}%
                        </div>
                    </div>
                </div>

                {/* 3 KPI Cards Row */}
                <div className="grid grid-cols-3 gap-2.5 px-4 -mt-5 relative z-10">
                    {[
                        { label: '순이익', value: profit, icon: Wallet, color: profit >= 0 ? 'text-emerald-500' : 'text-red-500', bg: profit >= 0 ? 'bg-emerald-50' : 'bg-red-50', sub: `마진 ${marginRate}%` },
                        { label: '총지출', value: expense, icon: ShoppingBag, color: 'text-amber-500', bg: 'bg-amber-50', sub: '' },
                        { label: '직원', value: null, icon: Users, color: 'text-violet-500', bg: 'bg-violet-50', sub: `${staffCount}명 재직` },
                    ].map((kpi, i) => (
                        <div key={i} className="card-animate touch-feedback bg-white rounded-2xl p-3.5 text-center shadow-sm border border-slate-100">
                            <div className={`w-8 h-8 rounded-[10px] ${kpi.bg} flex items-center justify-center mx-auto mb-2`}>
                                <kpi.icon size={16} className={kpi.color} />
                            </div>
                            <div className="text-[10px] text-slate-400 font-semibold">{kpi.label}</div>
                            <div className="text-[15px] font-extrabold text-slate-800 mt-0.5">
                                {kpi.value !== null ? formatKRW(kpi.value) : (staffNames[0] || '-')}
                            </div>
                            {kpi.sub && <div className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</div>}
                        </div>
                    ))}
                </div>

                {/* Mini Chart: Monthly Trend */}
                <div className="mx-4 mt-4 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate">
                    <div className="flex justify-between items-center mb-3">
                        <div>
                            <div className="text-sm font-extrabold text-slate-800">월별 수익 추이</div>
                            <div className="text-[11px] text-slate-400">최근 6개월</div>
                        </div>
                    </div>
                    <div className="h-[180px]">
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
                                    <Tooltip formatter={fmtWonProfit} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', padding: 10, fontSize: 12 }} />
                                    <Area type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">데이터가 없습니다</div>
                        )}
                    </div>
                </div>

                {/* Revenue Channels */}
                <div className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate">
                    <div className="text-sm font-extrabold text-slate-800 mb-1">매출 채널</div>
                    <div className="text-[11px] text-slate-400 mb-3">플랫폼별 비중</div>
                    {revenueData && revenueData.length > 0 ? (
                        <div className="flex items-center gap-3">
                            <div className="w-[120px] h-[120px] relative shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={revenueData} cx="50%" cy="50%" innerRadius={35} outerRadius={50} paddingAngle={4} dataKey="value" isAnimationActive={false}>
                                            {revenueData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-[11px] font-extrabold text-slate-500">{formatKRW(revenueData.reduce((a, b) => a + b.value, 0))}</span>
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col gap-2">
                                {revenueData.map((e, i) => (
                                    <div key={i} className="flex justify-between items-center text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                            <span className="text-slate-500 font-medium">{e.name}</span>
                                        </div>
                                        <span className="font-bold text-slate-800">{formatKRW(e.value)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 text-center text-slate-400 text-[13px]">데이터가 없습니다</div>
                    )}
                </div>

                {/* Top Costs */}
                <div className="mx-4 mt-3 bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate">
                    <div className="flex items-center gap-2 mb-3.5">
                        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
                            <BarChart3 size={14} className="text-red-500" />
                        </div>
                        <div>
                            <div className="text-sm font-extrabold text-slate-800">지출 TOP 5</div>
                            <div className="text-[10px] text-slate-400">거래처별 지출 순위</div>
                        </div>
                    </div>
                    {costData.length > 0 ? costData.map((item, idx) => (
                        <div key={idx} className={`flex justify-between items-center py-2.5 ${idx < costData.length - 1 ? 'border-b border-slate-100' : ''}`}>
                            <div className="flex items-center gap-2.5">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-extrabold ${
                                    idx < 3 ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>{idx + 1}</span>
                                <div>
                                    <div className="text-[13px] font-bold text-slate-800">{item.vendor}</div>
                                    <div className="text-[10px] text-slate-400">{item.item || '기타'}</div>
                                </div>
                            </div>
                            <span className="text-[13px] font-bold text-slate-800">{formatCurrency(item.amount)}</span>
                        </div>
                    )) : (
                        <div className="py-6 text-center text-slate-400 text-[13px]">거래 내역이 없습니다</div>
                    )}
                </div>

                {/* P/L Summary Card */}
                <div className="mx-4 mt-3 bg-gradient-to-br from-slate-800 to-slate-700 rounded-2xl p-5 card-animate">
                    <div className="text-[15px] font-extrabold text-white mb-1">손익 현황</div>
                    <div className="text-[11px] text-slate-500 mb-3.5">{selectedYear}년 {selectedMonth}월</div>
                    {[
                        { label: '총 매출', value: revenue, dot: revenue > 0 ? 'bg-blue-500' : 'bg-slate-600' },
                        { label: '총 지출', value: expense, dot: expense > 0 ? 'bg-amber-500' : 'bg-slate-600' },
                        { label: profit >= 0 ? '영업이익' : '영업손실', value: profit, dot: profit >= 0 ? 'bg-emerald-500' : 'bg-red-500', highlight: true },
                    ].map((row, i) => (
                        <div key={i} className={`flex justify-between items-center px-3 py-2.5 mb-1.5 rounded-xl ${
                            row.highlight ? 'bg-white/[0.08] border border-white/15' : 'bg-white/[0.08]'
                        }`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full ${row.dot}`} />
                                <span className="text-[13px] font-semibold text-white">{row.label}</span>
                            </div>
                            <span className={`text-[13px] font-extrabold ${
                                row.highlight ? (profit >= 0 ? 'text-emerald-300' : 'text-red-300') : 'text-white'
                            }`}>{formatCurrency(row.value)}</span>
                        </div>
                    ))}
                    <div className="text-right text-[11px] text-slate-500 mt-1">마진율 {marginRate}%</div>
                </div>
            </div>
        );
    }

    // ── Desktop Layout ──
    const CHART_COLORS = ['#14b8a6', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Page Header */}
            <div className="bg-white border-b border-slate-200 px-8 py-6">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center">
                            <LayoutDashboard size={22} className="text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{businessName}</h1>
                            <p className="text-sm text-slate-400 mt-0.5">{formatDate(currentTime)} <span className="text-slate-300 ml-1">{formatTime(currentTime)}</span></p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}년</option>)}
                        </select>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-3 py-2 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition cursor-pointer"
                        >
                            {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}월</option>)}
                        </select>
                        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-full px-4 py-1.5">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-sm font-bold text-emerald-600">영업중</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-8 py-6">
                {/* KPI Cards Row */}
                <div className="grid grid-cols-4 gap-5">
                    {/* Revenue Card - Accent */}
                    <div className="card-animate bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl p-5 relative overflow-hidden">
                        <div className="absolute -top-5 -right-5 w-24 h-24 rounded-full bg-white/[0.06]" />
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center">
                                <Wallet size={22} className="text-white" />
                            </div>
                            <span className={`flex items-center gap-1 text-sm font-bold ${revenueGrowth >= 0 ? 'text-emerald-200' : 'text-red-200'}`}>
                                {revenueGrowth >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{revenueGrowth >= 0 ? '+' : ''}{revenueGrowth}%
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-white/70">이번 달 매출</p>
                        <h3 className="text-2xl font-black text-white mt-1.5">{formatNumber(revenue)}<span className="text-sm font-medium ml-0.5">원</span></h3>
                    </div>

                    {/* Profit Card */}
                    <div className="card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-premium">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                <ShoppingBag size={22} className={profit >= 0 ? 'text-emerald-500' : 'text-red-500'} />
                            </div>
                            <span className="text-xs font-semibold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg">마진 {marginRate}%</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400">순이익</p>
                        <h3 className={`text-2xl font-black mt-1.5 ${profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{formatNumber(profit)}<span className="text-sm font-medium ml-0.5">원</span></h3>
                    </div>

                    {/* Staff Card */}
                    <div className="card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-premium">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
                                <Users size={22} className="text-violet-500" />
                            </div>
                            <span className="text-xs font-bold text-violet-500 bg-violet-50 px-2.5 py-1 rounded-lg">{staffCount}명 재직</span>
                        </div>
                        <p className="text-xs font-semibold text-slate-400">재직 직원</p>
                        <h3 className="text-xl font-black text-slate-800 mt-1.5">{staffNames.length > 0 ? (staffNames.length === 1 ? staffNames[0] : `${staffNames[0]} 외 ${staffCount - 1}명`) : '직원 없음'}</h3>
                    </div>

                    {/* Expense Card */}
                    <div className="card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-5 card-premium">
                        <div className="mb-4">
                            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center">
                                <BarChart3 size={22} className="text-amber-500" />
                            </div>
                        </div>
                        <p className="text-xs font-semibold text-slate-400">이번 달 총 지출</p>
                        <h3 className="text-2xl font-black text-slate-800 mt-1.5">{formatNumber(expense)}<span className="text-sm font-medium ml-0.5">원</span></h3>
                    </div>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-3 gap-5 mt-5">
                    {/* Monthly Trend Chart */}
                    <div className="col-span-2 card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-6 card-premium">
                        <h3 className="text-lg font-extrabold text-slate-800">월별 수익 추이</h3>
                        <p className="text-sm text-slate-400 mt-1 mb-6">최근 6개월간의 순수익 변화</p>
                        <div className="h-80">
                            {monthlyTrend && monthlyTrend.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorProfitD" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} dy={10} />
                                        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatKRW(v)} />
                                        <Tooltip
                                            formatter={fmtWonProfit}
                                            contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', padding: 14 }}
                                            labelStyle={{ color: '#64748b' }}
                                            itemStyle={{ color: '#3B82F6' }}
                                        />
                                        <Area type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfitD)" isAnimationActive={false} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>}
                        </div>
                    </div>

                    {/* Revenue Channels */}
                    <div className="card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-6 card-premium">
                        <h3 className="text-lg font-extrabold text-slate-800">매출 채널</h3>
                        <p className="text-sm text-slate-400 mt-1 mb-5">플랫폼별 매출 비중</p>
                        <div className="h-[220px] relative">
                            {revenueData && revenueData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={revenueData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" isAnimationActive={false}>
                                            {revenueData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % 5]} />)}
                                        </Pie>
                                        <Tooltip formatter={fmtWon} contentStyle={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>}
                            {revenueData && revenueData.length > 0 && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-sm font-extrabold text-slate-400">{formatKRW(revenueData.reduce((s, e) => s + e.value, 0))}원</span>
                                </div>
                            )}
                        </div>
                        <div className="mt-4 flex flex-col gap-2.5">
                            {revenueData && revenueData.map((entry, i) => (
                                <div key={i} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % 5] }} />
                                        <span className="text-slate-500">{entry.name}</span>
                                    </div>
                                    <span className="font-bold text-slate-800">{formatCurrency(entry.value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Row */}
                <div className="grid grid-cols-2 gap-5 mt-5">
                    {/* Top Costs */}
                    <div className="card-animate bg-white rounded-2xl border border-slate-100 shadow-sm p-6 card-premium">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                                <BarChart3 size={20} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-base font-extrabold text-slate-800">지출 TOP 5 (거래처)</h3>
                                <p className="text-xs text-slate-400 mt-0.5">가장 많은 지출이 발생한 거래처</p>
                            </div>
                        </div>
                        {costData.length > 0 ? costData.map((item, idx) => (
                            <div key={idx} className={`flex justify-between items-center py-3.5 px-3 ${idx < costData.length - 1 ? 'border-b border-slate-100' : ''}`}>
                                <div className="flex items-center gap-3.5">
                                    <span className={`w-8 h-8 rounded-[10px] flex items-center justify-center text-sm font-extrabold ${
                                        idx < 3 ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'
                                    }`}>{idx + 1}</span>
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">{item.vendor}</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">{item.item || '기타'}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-slate-700">{formatCurrency(item.amount)}</span>
                            </div>
                        )) : <div className="py-10 text-center text-slate-400">거래 내역이 없습니다</div>}
                    </div>

                    {/* P/L Summary */}
                    <div className="card-animate bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 relative overflow-hidden">
                        <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-blue-500/[0.06] pointer-events-none" />
                        <div className="relative z-10">
                            <h3 className="text-lg font-extrabold text-white">손익 현황</h3>
                            <p className="text-sm text-slate-500 mt-1 mb-6">{selectedYear}년 {selectedMonth}월 요약</p>
                            <div className="flex flex-col gap-2.5">
                                {[
                                    { label: '총 매출', value: revenue, dotClass: revenue > 0 ? 'bg-blue-500' : 'bg-slate-600', valueClass: 'text-white' },
                                    { label: '총 지출', value: expense, dotClass: expense > 0 ? 'bg-amber-500' : 'bg-slate-600', valueClass: 'text-white' },
                                    { label: profit >= 0 ? '영업이익' : '영업손실', value: profit, dotClass: profit >= 0 ? 'bg-emerald-500' : 'bg-red-500', valueClass: profit >= 0 ? 'text-emerald-300' : 'text-red-300', hl: true },
                                ].map((row, i) => (
                                    <div key={i} className={`flex justify-between items-center py-3.5 px-4 rounded-xl ${
                                        row.hl ? 'bg-white/[0.08] border border-white/[0.12]' : 'bg-white/[0.04] border border-transparent'
                                    }`}>
                                        <div className="flex items-center gap-2.5">
                                            <div className={`w-2 h-2 rounded-full ${row.dotClass}`} />
                                            <span className="text-sm font-semibold text-slate-200">{row.label}</span>
                                        </div>
                                        <span className={`text-base font-extrabold ${row.valueClass}`}>{formatCurrency(row.value)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="text-right text-xs text-slate-500 mt-3 font-semibold">마진율 {marginRate}%</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
