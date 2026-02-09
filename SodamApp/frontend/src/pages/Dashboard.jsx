import { useEffect, useState } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
// Note: lucide-react icons are imported separately from recharts components
import { ArrowUpRight, TrendingUp, Wallet, PieChart as PieIcon, BarChart3, AlertCircle, ShoppingBag, Users, Clock } from 'lucide-react';

export default function Dashboard() {
    const [dashData, setDashData] = useState(null);
    const [revenueData, setRevenueData] = useState([]);
    const [costData, setCostData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Initialize with current date
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(today.getFullYear());

    // Live Clock State
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchData(selectedYear, selectedMonth);
    }, [selectedYear, selectedMonth]);

    // Clock Effect
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async (year, month) => {
        try {
            setError(null);
            setLoading(true);

            const [summaryRes, revenueRes, costRes] = await Promise.all([
                api.get(`/dashboard?year=${year}&month=${month}`),
                api.get(`/analytics/revenue?year=${year}&month=${month}`),
                api.get(`/analytics/cost?year=${year}&month=${month}`)
            ]);

            if (summaryRes.data.status === 'success') {
                setDashData(summaryRes.data.data);
            }
            if (revenueRes.data.status === 'success') setRevenueData(revenueRes.data.data);
            if (costRes.data.status === 'success') setCostData(costRes.data.data);
        } catch (e) {
            console.warn("Backend error:", e);
            setDashData(null);
            setRevenueData([]);
            setCostData([]);
        } finally {
            setLoading(false);
        }
    };

    // Colors for Pie Chart
    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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

    // Formatting date helper
    const formatDate = (date) => {
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    const formatKRW = (v) => {
        if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
        if (Math.abs(v) >= 10000) return `${Math.round(v / 10000).toLocaleString()}만`;
        return v.toLocaleString();
    };

    return (
        <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 pb-32 md:pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">대시보드</h1>
                    <div className="flex flex-col mt-1 space-y-1">
                        <p className="text-slate-500">소담김밥 매장의 실시간 현황입니다.</p>
                        <p className="text-indigo-600 font-medium text-sm">
                            {formatDate(currentTime)} <span className="ml-1 font-bold">{formatTime(currentTime)}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                        <option value="2024">2024년</option>
                        <option value="2025">2025년</option>
                        <option value="2026">2026년</option>
                    </select>
                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5"
                    >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <div className="bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-sm font-semibold text-slate-700">영업중</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Revenue Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Wallet size={24} />
                        </div>
                        <span className={`flex items-center gap-1 text-sm font-bold ${revenueGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {revenueGrowth >= 0 ? <TrendingUp size={16} /> : <TrendingUp size={16} className="rotate-180" />}
                            {revenueGrowth}%
                        </span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">이번 달 매출</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{revenue.toLocaleString()}원</h3>
                </div>

                {/* Profit Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            <ShoppingBag size={24} />
                        </div>
                        <span className="text-sm font-bold text-slate-400">마진율 {marginRate}%</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">순이익</p>
                    <h3 className={`text-2xl font-bold mt-1 ${profit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{profit.toLocaleString()}원</h3>
                </div>

                {/* Staff Card (Real Data) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-bold rounded-lg">{staffCount}명 재직</span>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">재직 직원</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">
                        {staffNames.length > 0 ? (
                            staffNames.length === 1 ? staffNames[0] :
                                `${staffNames[0]} 외 ${staffCount - 1}명`
                        ) : '직원 없음'}
                    </h3>
                </div>

                {/* Total Expense Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <BarChart3 size={24} />
                        </div>
                    </div>
                    <p className="text-slate-500 text-sm font-medium">이번 달 총 지출</p>
                    <h3 className="text-2xl font-bold text-slate-900 mt-1">{expense.toLocaleString()}원</h3>
                </div>
            </div>

            {/* Charts Section - Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Revenue Chart (Span 2) */}
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
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="month"
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 12, fill: '#64748b' }}
                                        axisLine={false}
                                        tickLine={false}
                                        tickFormatter={(value) => formatKRW(value)}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`${value.toLocaleString()}원`, '이익']}
                                        contentStyle={{
                                            borderRadius: '12px',
                                            border: 'none',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            padding: '12px'
                                        }}
                                    />
                                    <Area type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>
                        )}
                    </div>
                </div>

                {/* Revenue Source Pie Chart (Span 1) */}
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <h3 className="font-bold text-lg text-slate-800 mb-2">매출 채널</h3>
                    <p className="text-sm text-slate-500 mb-6">플랫폼별 매출 비중</p>

                    <div className="h-[250px] relative">
                        {revenueData && revenueData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={revenueData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        isAnimationActive={false}
                                    >
                                        {revenueData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value) => `${value.toLocaleString()}원`} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다</div>
                        )}
                        {/* Center Text */}
                        {revenueData && revenueData.length > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <span className="text-sm font-bold text-slate-400">
                                    {formatKRW(revenueData.reduce((s, e) => s + e.value, 0))}원
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 space-y-3">
                        {revenueData && revenueData.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="text-slate-600">{entry.name}</span>
                                </div>
                                <span className="font-bold text-slate-900">{entry.value.toLocaleString()}원</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Row: Top Costs + P/L Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-10">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <BarChart3 size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800">지출 TOP 5 (거래처)</h3>
                            <p className="text-xs text-slate-500">가장 많은 지출이 발생한 거래처</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {costData.length > 0 ? costData.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${idx < 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <p className="font-bold text-slate-800 text-sm">{item.vendor}</p>
                                        <p className="text-xs text-slate-400">{item.item || '기타'}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-slate-900">{item.amount.toLocaleString()}원</span>
                            </div>
                        )) : (
                            <div className="text-center text-slate-400 py-8">거래 내역이 없습니다</div>
                        )}
                    </div>
                </div>

                {/* P/L Summary Card */}
                <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-sm relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="font-bold text-lg mb-2">손익 현황</h3>
                        <p className="text-slate-400 text-sm mb-6">{selectedYear}년 {selectedMonth}월 요약</p>

                        <div className="space-y-4">
                            <div className="flex gap-3 items-start p-3 bg-white/10 rounded-xl">
                                <div className={`w-2 h-2 rounded-full mt-2 ${revenue > 0 ? 'bg-blue-500' : 'bg-slate-500'}`}></div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <p className="text-sm font-bold">총 매출</p>
                                        <p className="text-sm font-bold">{revenue.toLocaleString()}원</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start p-3 bg-white/10 rounded-xl">
                                <div className={`w-2 h-2 rounded-full mt-2 ${expense > 0 ? 'bg-orange-500' : 'bg-slate-500'}`}></div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <p className="text-sm font-bold">총 지출</p>
                                        <p className="text-sm font-bold">{expense.toLocaleString()}원</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3 items-start p-3 bg-white/10 rounded-xl border border-white/20">
                                <div className={`w-2 h-2 rounded-full mt-2 ${profit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                <div className="flex-1">
                                    <div className="flex justify-between">
                                        <p className="text-sm font-bold">{profit >= 0 ? '영업이익' : '영업손실'}</p>
                                        <p className={`text-sm font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{profit.toLocaleString()}원</p>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1">마진율 {marginRate}%</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
