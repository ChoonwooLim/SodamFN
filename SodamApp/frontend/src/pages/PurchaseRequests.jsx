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
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-4xl mx-auto">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 text-green-600 rounded-lg"><ShoppingCart size={24} /></div>
                        <h1 className="text-2xl font-black text-slate-900">구매 요청 관리</h1>
                    </div>
                    <button onClick={fetchRequests} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </header>

                {requests.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                        <ShoppingCart size={48} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-slate-400 text-sm">구매 요청이 없습니다.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {requests.map((req) => (
                            <div key={req.id} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
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
                                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full flex-shrink-0"></span>
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
                                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700"
                                        >
                                            <CheckCircle size={14} /> 구매 완료
                                        </button>
                                        <button
                                            onClick={() => updateStatus(req.id, 'rejected')}
                                            className="flex-1 flex items-center justify-center gap-1 py-2 bg-red-50 text-red-500 border border-red-200 rounded-xl text-xs font-bold hover:bg-red-100"
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
