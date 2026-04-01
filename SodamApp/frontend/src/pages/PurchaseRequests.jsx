import { useEffect, useState } from 'react';
import api from '../api';
import { ShoppingCart, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function PurchaseRequests() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const res = await api.get('/purchase-requests');
            if (res.data.status === 'success') setRequests(res.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchRequests(); }, []);

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/purchase-requests/${id}/status`, { status });
            fetchRequests();
        } catch (e) { alert('상태 변경 실패'); }
    };

    const statusBadge = (status) => {
        if (status === 'completed') return <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">완료</span>;
        if (status === 'rejected') return <span className="px-2 py-1 bg-red-50 text-red-500 rounded-full text-[10px] font-bold">반려</span>;
        return <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold animate-pulse">대기</span>;
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-8 pb-32">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <ShoppingCart size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">구매 요청 관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">직원들의 구매 요청을 확인하고 처리합니다</p>
                        </div>
                    </div>
                    <button onClick={fetchRequests} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </header>

                {requests.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center card-animate">
                        <ShoppingCart size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-500">구매 요청이 없습니다.</p>
                        <p className="text-xs text-slate-400 mt-1">직원이 구매 요청을 등록하면 여기에 표시됩니다</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((req, idx) => (
                            <div key={req.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-5 card-animate" style={{ animationDelay: `${idx * 0.05}s` }}>
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-800">{req.staff_name}</span>
                                        {statusBadge(req.status)}
                                    </div>
                                    <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <Clock size={12} />
                                        {new Date(req.created_at).toLocaleString('ko-KR')}
                                    </span>
                                </div>

                                <div className="bg-slate-50 rounded-xl p-3 mb-3">
                                    {req.items.map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 py-1 text-sm">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full flex-shrink-0"></span>
                                            <span className="font-bold text-slate-700">{item.name}</span>
                                            {item.quantity && <span className="text-slate-500">({item.quantity})</span>}
                                            {item.note && <span className="text-slate-400 text-xs">— {item.note}</span>}
                                        </div>
                                    ))}
                                </div>

                                {req.status === 'pending' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => updateStatus(req.id, 'completed')}
                                            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl text-xs font-bold hover:from-emerald-500 hover:to-emerald-600 transition-all shadow-sm"
                                        >
                                            <CheckCircle size={14} /> 구매 완료
                                        </button>
                                        <button
                                            onClick={() => updateStatus(req.id, 'rejected')}
                                            className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-white border border-red-200 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-all"
                                        >
                                            <XCircle size={14} /> 반려
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
