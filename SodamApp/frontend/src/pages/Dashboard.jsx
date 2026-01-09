import { useEffect, useState } from 'react';
import api from '../api';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, YAxis } from 'recharts';
import { ArrowUpRight, TrendingUp, Wallet, PieChart as PieIcon, BarChart3 } from 'lucide-react';

export default function Dashboard() {
    const [data, setData] = useState([]);
    const [revenueData, setRevenueData] = useState([]);
    const [costData, setCostData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setError(null);
            setLoading(true);

            const [summaryRes, revenueRes, costRes] = await Promise.all([
                api.get('/dashboard'),
                api.get('/analytics/revenue'),
                api.get('/analytics/cost')
            ]);

            if (summaryRes.data.status === 'success') setData(summaryRes.data.data);
            if (revenueRes.data.status === 'success') setRevenueData(revenueRes.data.data);
            if (costRes.data.status === 'success') setCostData(costRes.data.data);

        } catch (error) {
            console.error("Error fetching dashboard:", error);
            setError("서버 연결에 실패했습니다.");
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

    if (error) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-500 mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">연결 실패</h3>
            <p className="text-slate-500 mb-6">{error}</p>
            <button
                onClick={fetchData}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold active:scale-95 transition-transform"
            >
                다시 시도
            </button>
        </div>
    );

    const current = data[data.length - 1] || {};
    const prevMonth = data[data.length - 2] || {};
    const revenueGrowth = prevMonth.revenue ? ((current.revenue - prevMonth.revenue) / prevMonth.revenue * 100).toFixed(1) : 0;

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-32">
            {/* Header */}
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <p className="text-slate-500 text-sm font-medium mb-1">반갑습니다, 사장님 👋</p>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">소담김밥 <span className="text-blue-600">현황판</span></h1>
                </div>
                <div className="bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-600">영업중</span>
                </div>
            </header>

            {/* Main Stats Card */}
            <div className="bg-white rounded-3xl p-6 shadow-soft mb-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-8 -mt-8 opacity-50 blur-2xl"></div>

                <p className="text-slate-500 text-sm font-medium mb-2">이번 달 순이익</p>
                <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-bold text-slate-900 tracking-tight">
                        {(current.profit || 0).toLocaleString()}
                    </span>
                    <span className="text-lg text-slate-400 font-medium">원</span>
                </div>

                <div className="flex gap-3">
                    <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold flex items-center gap-1">
                        <ArrowUpRight size={14} />
                        마진율 {current.margin}%
                    </div>
                    <div className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold flex items-center gap-1">
                        <TrendingUp size={14} />
                        매출 {revenueGrowth}% 성장
                    </div>
                </div>
            </div>

            {/* Analytics Section: Revenue Mix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-3xl shadow-soft">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <PieIcon size={18} />
                        </div>
                        <h3 className="font-bold text-slate-800">매출 구성 (채널별)</h3>
                    </div>
                    <div className="h-64 flex flex-col items-center justify-center">
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
                                >
                                    {revenueData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value) => value.toLocaleString() + '원'} />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-3 justify-center mt-2">
                            {revenueData.map((entry, index) => (
                                <div key={index} className="flex items-center gap-1 text-xs text-slate-500">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    {entry.name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl shadow-soft">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                            <BarChart3 size={18} />
                        </div>
                        <h3 className="font-bold text-slate-800">지출 TOP 5 (거래처)</h3>
                    </div>
                    <div className="relative">
                        {costData.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${idx < 3 ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {idx + 1}
                                    </span>
                                    <div>
                                        <span className="font-medium text-slate-700">{item.vendor}</span>
                                        {item.item && <span className="ml-2 text-xs text-slate-400">({item.item})</span>}
                                    </div>
                                </div>
                                <span className="font-bold text-slate-900">{item.amount.toLocaleString()}원</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="mb-6">
                <h3 className="font-bold text-slate-800 mb-4 px-1">월별 이익 추이</h3>
                <div className="bg-white p-4 rounded-3xl shadow-soft h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="month"
                                tick={{ fontSize: 12, fill: '#94a3b8' }}
                                axisLine={false}
                                tickLine={false}
                                dy={10}
                            />
                            <Tooltip
                                formatter={(value) => [`${value.toLocaleString()}원`, '이익']}
                                contentStyle={{
                                    borderRadius: '16px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                    padding: '12px'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="profit"
                                stroke="#3B82F6"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorProfit)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}
