import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import {
    ClipboardList, Phone, MessageCircle, RefreshCw, Trash2,
    ShoppingCart, CheckCircle2, UserCircle, Receipt as ReceiptIcon,
} from 'lucide-react';

const STATUS_LABEL = {
    draft: { text: '작성됨', cls: 'bg-slate-100 text-slate-500' },
    sent: { text: '전송됨', cls: 'bg-blue-50 text-blue-600' },
    completed: { text: '구매완료', cls: 'bg-emerald-50 text-emerald-600' },
    canceled: { text: '취소', cls: 'bg-red-50 text-red-500' },
};
const SENT_VIA_LABEL = { phone: '전화', kakao: '카톡', copy: '복사' };
const FILTERS = [['', '전체'], ['draft', '작성됨'], ['sent', '전송됨'], ['completed', '구매완료']];

export default function OrderManage() {
    const [orders, setOrders] = useState([]);
    const [businessName, setBusinessName] = useState('셈하나');
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

    const fetchOrders = async (status = statusFilter) => {
        setLoading(true);
        try {
            const q = status ? `&status=${status}` : '';
            const res = await api.get(`/materials/orders?limit=50${q}`);
            if (res.data.status === 'success') {
                setOrders(res.data.data);
                setBusinessName(res.data.business_name || '셈하나');
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchOrders(); }, []);

    // ─── 전송/상태 ───
    const buildMessage = (order) => {
        const lines = order.items.map((it, i) =>
            `${i + 1}. ${it.name}${it.spec ? ` (${it.spec})` : ''} × ${it.quantity}`);
        return [
            `[${businessName}] 물품 구매 요청서 (${order.order_date})`,
            '',
            `${order.vendor_name} 담당자님, 안녕하세요.`,
            '아래와 같이 주문 요청드립니다.',
            '',
            ...lines,
            '',
            `총 ${order.item_count}개 품목` + (order.total_amount > 0 ? ` / 예상금액 ${formatNumber(order.total_amount)}원` : ''),
            '',
            '확인 부탁드립니다. 감사합니다.',
        ].join('\n');
    };

    const patchOrder = async (order, payload) => {
        try {
            const res = await api.patch(`/materials/orders/${order.id}`, payload);
            if (res.data.status === 'success') {
                setOrders(prev => prev.map(o => (o.id === order.id ? res.data.data : o)));
            }
        } catch (e) { alert('처리에 실패했습니다.'); }
    };

    const resendKakao = async (order) => {
        const text = buildMessage(order);
        if (navigator.share) {
            try {
                await navigator.share({ text });
                patchOrder(order, { status: 'sent', sent_via: 'kakao' });
                return;
            } catch (e) { if (e.name === 'AbortError') return; }
        }
        try { await navigator.clipboard.writeText(text); } catch (e) { /* ignore */ }
        patchOrder(order, { status: 'sent', sent_via: 'copy' });
        showToast('요청서가 복사되었습니다. 카톡에 붙여넣기 하세요.');
    };

    const deleteOrder = async (order) => {
        if (!window.confirm(`${order.vendor_name} 요청서를 삭제할까요?`)) return;
        try {
            await api.delete(`/materials/orders/${order.id}`);
            setOrders(prev => prev.filter(o => o.id !== order.id));
        } catch (e) { alert('삭제 실패'); }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center shadow-lg shadow-slate-500/20">
                            <ClipboardList size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">구매요청서 관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">사장님·직원이 작성한 요청서의 전송과 구매완료를 관리합니다</p>
                        </div>
                    </div>
                    <Link to="/materials/order-form"
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-black hover:bg-teal-600 active:scale-95 transition-all shadow-sm">
                        <ShoppingCart size={15} /> 구매요청서 작성
                    </Link>
                </header>

                {/* ── 요청서 이력 ── */}
                {(
                    <>
                        <div className="flex gap-1.5 mb-4">
                            {FILTERS.map(([v, label]) => (
                                <button key={v}
                                    onClick={() => { setStatusFilter(v); fetchOrders(v); }}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === v ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="text-center py-20 text-slate-400">
                                <RefreshCw size={24} className="animate-spin mx-auto mb-3" /> 불러오는 중...
                            </div>
                        ) : orders.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <ClipboardList size={30} className="mx-auto mb-3 text-slate-300" />
                                <p className="font-bold text-slate-500 mb-1">작성된 구매요청서가 없습니다</p>
                                <Link to="/materials/order-form" className="text-xs font-bold text-teal-600 hover:underline">
                                    구매요청서 작성하러 가기 →
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {orders.map(order => {
                                    const st = STATUS_LABEL[order.status] || STATUS_LABEL.draft;
                                    return (
                                        <div key={order.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4">
                                            <div className="flex items-center gap-2.5 flex-wrap">
                                                <h3 className="text-sm font-bold text-slate-900">{order.vendor_name}</h3>
                                                {order.requested_by && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600">
                                                        <UserCircle size={11} /> {order.requested_by}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                                                {order.sent_via && (
                                                    <span className="text-[10px] text-slate-400">{SENT_VIA_LABEL[order.sent_via] || order.sent_via} 전송</span>
                                                )}
                                                <span className="ml-auto text-xs text-slate-400">
                                                    요청 {order.order_date}
                                                    {order.completed_at && <b className="text-emerald-500"> · 완료 {order.completed_at.slice(0, 10)}</b>}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1.5 truncate">
                                                {order.items.slice(0, 4).map(it => `${it.name} ×${it.quantity}`).join(', ')}
                                                {order.items.length > 4 && ` 외 ${order.items.length - 4}건`}
                                                {order.total_amount > 0 && <b className="text-slate-700"> · {formatNumber(order.total_amount)}원</b>}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                                {order.vendor_phone && (
                                                    <a href={`tel:${order.vendor_phone.replace(/[^0-9+]/g, '')}`}
                                                        onClick={() => patchOrder(order, { status: order.status === 'draft' ? 'sent' : order.status, sent_via: 'phone' })}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-xs font-bold hover:bg-emerald-100 transition-all">
                                                        <Phone size={13} /> 전화
                                                    </a>
                                                )}
                                                <button onClick={() => resendKakao(order)}
                                                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                                                    style={{ background: '#FEF9C3', color: '#854D0E' }}>
                                                    <MessageCircle size={13} /> 카톡 재전송
                                                </button>
                                                <Link to={`/materials/receipts?order_id=${order.id}`}
                                                    className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-50 text-rose-500 text-xs font-bold hover:bg-rose-100 transition-all">
                                                    <ReceiptIcon size={13} /> 영수증 첨부
                                                </Link>
                                                {order.status !== 'completed' && order.status !== 'canceled' && (
                                                    <button onClick={() => patchOrder(order, { status: 'completed' })}
                                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-all">
                                                        <CheckCircle2 size={13} /> 구매 완료
                                                    </button>
                                                )}
                                                <button onClick={() => deleteOrder(order)}
                                                    className="ml-auto px-2.5 py-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}

            </div>

            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl">
                    {toast}
                </div>
            )}
        </div>
    );
}
