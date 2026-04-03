import { useState, useEffect, useRef } from 'react';
import { Upload, FileUp, CreditCard, DollarSign, Calendar, TrendingUp, PieChart as PieIcon, List, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api';

const fmtWon = (v) => `${Number(v).toLocaleString('ko-KR')}원`;

export default function CardSales() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ daily_trend: [], by_corp: [] });
    const [payments, setPayments] = useState([]);
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth(); // current month (0-indexed)
        const prevY = m === 0 ? y - 1 : y;
        const prevM = m === 0 ? 12 : m;
        const lastDay = new Date(y, m, 0).getDate(); // last day of prev month
        return {
            start: `${prevY}-${String(prevM).padStart(2,'0')}-01`,
            end: `${prevY}-${String(prevM).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`
        };
    });
    const [msg, setMsg] = useState("");

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.get('/finance/stats/sales', { params: { start_date: dateRange.start, end_date: dateRange.end } });
            setStats(res.data);

            const resPay = await api.get('/finance/stats/payment', { params: { start_date: dateRange.start, end_date: dateRange.end } });
            setPayments(resPay.data.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, [dateRange]);

    const handleFileUpload = async (e, type) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const endpoint = type === 'sales' ? '/finance/upload/sales' : '/finance/upload/payment';
            const res = await api.post(endpoint, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setMsg(res.data.message);
            setTimeout(() => setMsg(""), 3000);
            fetchStats();
        } catch (error) {
            console.error(error);
            alert("업로드 실패: " + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Colors for Charts
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-8 pb-32 space-y-6">
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                        <CreditCard size={20} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 tracking-tight">카드매출 관리</h1>
                        <p className="text-xs text-slate-400 mt-0.5">여신금융협회 데이터 기반 매출/입금 분석</p>
                    </div>
                </div>

                {/* Date Filter */}
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <Calendar size={16} className="text-slate-400 ml-2" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="text-sm font-bold text-slate-600 outline-none"
                    />
                    <span className="text-slate-300">~</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="text-sm font-bold text-slate-600 outline-none"
                    />
                    <button onClick={fetchStats} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">
                        조회
                    </button>
                </div>
            </header>

            {msg && (
                <div className="bg-green-100 text-green-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-bold animate-pulse">
                    <AlertCircle size={16} /> {msg}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {['dashboard', 'upload'].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === tab
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        {tab === 'dashboard' ? '대시보드' : '데이터 업로드'}
                    </button>
                ))}
            </div>

            {activeTab === 'dashboard' ? (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-500 font-bold text-sm">기간 내 총 매출</span>
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                            </div>
                            <div className="text-2xl font-black text-slate-800">
                                {stats.daily_trend.reduce((acc, cur) => acc + cur.total, 0).toLocaleString()}원
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">승인 건수 {stats.daily_trend.reduce((acc, cur) => acc + cur.count, 0)}건</div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-500 font-bold text-sm">입금 예정/완료</span>
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><DollarSign size={20} /></div>
                            </div>
                            <div className="text-2xl font-black text-slate-800">
                                {payments.reduce((acc, cur) => acc + cur.net_deposit, 0).toLocaleString()}원
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">수수료 {payments.reduce((acc, cur) => acc + cur.fees, 0).toLocaleString()}원 차감</div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-slate-500 font-bold text-sm">평균 수수료율</span>
                                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><PieIcon size={20} /></div>
                            </div>
                            <div className="text-2xl font-black text-slate-800">
                                {(payments.length > 0 ? (payments.reduce((acc, cur) => acc + cur.fees, 0) / payments.reduce((acc, cur) => acc + cur.sales_amount, 0) * 100).toFixed(2) : 0)}%
                            </div>
                            <div className="text-xs text-slate-400 mt-1 font-medium">실질 차감 비율</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <TrendingUp size={18} className="text-blue-500" /> 일별 매출 추이
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.daily_trend}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fill: '#94a3b8', fontSize: 12 }}
                                            tickFormatter={(val) => new Date(val).getDate() + '일'}
                                        />
                                        <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            formatter={fmtWon}
                                        />
                                        <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <PieIcon size={18} className="text-indigo-500" /> 카드사별 점유율
                            </h3>
                            <div className="h-80 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={stats.by_corp}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {stats.by_corp.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={fmtWon} />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {/* Card Company Fee Breakdown Table */}
                    {payments.length > 0 && (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                                <List size={18} className="text-purple-500" /> 카드사별 수수료 상세
                            </h3>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 700 }}>카드사</th>
                                            <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 700 }}>매출액</th>
                                            <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 700 }}>수수료</th>
                                            <th style={{ textAlign: 'right', padding: '10px 12px', color: '#64748b', fontWeight: 700 }}>실입금</th>
                                            <th style={{ textAlign: 'center', padding: '10px 12px', color: '#64748b', fontWeight: 700 }}>수수료율</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payments
                                            .sort((a, b) => (b.sales_amount || 0) - (a.sales_amount || 0))
                                            .map((p, idx) => {
                                                const rate = p.sales_amount > 0 ? (p.fees / p.sales_amount * 100).toFixed(2) : '0.00';
                                                const rateColor = parseFloat(rate) > 3 ? '#ef4444' : parseFloat(rate) > 2 ? '#f59e0b' : '#10b981';
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                                                        onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                        <td style={{ padding: '10px 12px', fontWeight: 700, color: '#1e293b' }}>
                                                            {p.card_corp}
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                                                            {(p.sales_amount || 0).toLocaleString()}원
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>
                                                            {(p.fees || 0).toLocaleString()}원
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#334155' }}>
                                                            {(p.net_deposit || 0).toLocaleString()}원
                                                        </td>
                                                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                                                                background: `${rateColor}15`, color: rateColor,
                                                                fontWeight: 800, fontSize: 12,
                                                            }}>
                                                                {rate}%
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: 800, color: '#1e293b' }}>합계</td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                                                {payments.reduce((a, c) => a + (c.sales_amount || 0), 0).toLocaleString()}원
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#ef4444' }}>
                                                {payments.reduce((a, c) => a + (c.fees || 0), 0).toLocaleString()}원
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#1e293b' }}>
                                                {payments.reduce((a, c) => a + (c.net_deposit || 0), 0).toLocaleString()}원
                                            </td>
                                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                    display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                                                    background: '#3b82f615', color: '#3b82f6',
                                                    fontWeight: 800, fontSize: 12,
                                                }}>
                                                    {payments.reduce((a, c) => a + (c.sales_amount || 0), 0) > 0
                                                        ? (payments.reduce((a, c) => a + (c.fees || 0), 0) / payments.reduce((a, c) => a + (c.sales_amount || 0), 0) * 100).toFixed(2)
                                                        : '0.00'}%
                                                </span>
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Sales Upload */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center space-y-4">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Upload size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">매출 승인 내역 업로드</h3>
                        <p className="text-slate-500 text-sm">여신금융협회 '승인내역조회' 엑셀 파일</p>

                        <label className="block w-full cursor-pointer group">
                            <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-blue-500 group-hover:bg-blue-50/50 transition-all">
                                <span className="text-sm font-bold text-slate-600 group-hover:text-blue-600">파일 선택 또는 드래그</span>
                                <span className="text-xs text-slate-400">.xlsx / .xls</span>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'sales')} />
                        </label>
                    </div>

                    {/* Payment Upload */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <FileUp size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800">매입(입금) 내역 업로드</h3>
                        <p className="text-slate-500 text-sm">여신금융협회 '매입내역조회' 엑셀 파일</p>

                        <label className="block w-full cursor-pointer group">
                            <div className="w-full h-32 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center gap-2 group-hover:border-emerald-500 group-hover:bg-emerald-50/50 transition-all">
                                <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-600">파일 선택 또는 드래그</span>
                                <span className="text-xs text-slate-400">.xlsx / .xls</span>
                            </div>
                            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e, 'payment')} />
                        </label>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}
