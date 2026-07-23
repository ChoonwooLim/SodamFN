import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import {
    ShoppingCart, Phone, MessageCircle, Copy, ChevronDown, Search,
    Check, Minus, Plus, RefreshCw, ArrowLeft, History, Trash2,
    ClipboardList, AlertTriangle, PackageOpen, CheckCircle2,
} from 'lucide-react';

// 상태 칩
const STATUS_LABEL = {
    draft: { text: '작성됨', cls: 'bg-slate-100 text-slate-500' },
    sent: { text: '전송됨', cls: 'bg-blue-50 text-blue-600' },
    completed: { text: '완료', cls: 'bg-emerald-50 text-emerald-600' },
    canceled: { text: '취소', cls: 'bg-red-50 text-red-500' },
};

const SENT_VIA_LABEL = { phone: '전화', kakao: '카톡', copy: '복사' };

export default function MaterialOrderForm() {
    const [catalog, setCatalog] = useState([]);
    const [businessName, setBusinessName] = useState('셈하나');
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('compose');          // compose | history
    const [view, setView] = useState('cart');           // cart | orders (요청서 결과)
    const [cart, setCart] = useState({});               // { productId: qty }
    const [openVendors, setOpenVendors] = useState(new Set());
    const [search, setSearch] = useState('');
    const [createdOrders, setCreatedOrders] = useState([]);
    const [historyOrders, setHistoryOrders] = useState([]);
    const [staffRequests, setStaffRequests] = useState([]);
    const [staffOpen, setStaffOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [toast, setToast] = useState(null);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 2500);
    };

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const res = await api.get('/materials/catalog');
            if (res.data.status === 'success') {
                setCatalog(res.data.data);
                setBusinessName(res.data.business_name || '셈하나');
                // 품목 있는 거래처는 기본 펼침
                setOpenVendors(new Set(res.data.data.filter(g => g.products.length > 0).map(g => g.vendor.id)));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const fetchHistory = async () => {
        try {
            const res = await api.get('/materials/orders?limit=30');
            if (res.data.status === 'success') setHistoryOrders(res.data.data);
        } catch (e) { console.error(e); }
    };

    const fetchStaffRequests = async () => {
        try {
            const res = await api.get('/purchase-requests');
            if (res.data.status === 'success') {
                setStaffRequests(res.data.data.filter(r => r.status === 'pending'));
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchCatalog();
        fetchHistory();
        fetchStaffRequests();
    }, []);

    // 재고관리 화면에서 "부족 품목 담기"로 넘어온 프리필
    useEffect(() => {
        if (loading) return;
        try {
            const raw = sessionStorage.getItem('materialOrderPrefill');
            if (raw) {
                const prefill = JSON.parse(raw);
                sessionStorage.removeItem('materialOrderPrefill');
                setCart(prev => ({ ...prefill, ...prev }));
                showToast('부족 품목이 요청서에 담겼습니다.');
            }
        } catch (e) { /* ignore */ }
    }, [loading]);

    // ─── 장바구니 조작 ───
    const setQty = (pid, qty) => {
        setCart(prev => {
            const next = { ...prev };
            if (qty > 0) next[pid] = qty;
            else delete next[pid];
            return next;
        });
    };
    const toggleItem = (pid) => setQty(pid, cart[pid] ? 0 : 1);

    const productIndex = useMemo(() => {
        const idx = {};
        catalog.forEach(g => g.products.forEach(p => { idx[p.id] = { ...p, vendor: g.vendor }; }));
        return idx;
    }, [catalog]);

    const summary = useMemo(() => {
        const vendorIds = new Set();
        let count = 0, amount = 0;
        Object.entries(cart).forEach(([pid, qty]) => {
            const p = productIndex[pid];
            if (!p) return;
            vendorIds.add(p.vendor.id);
            count += 1;
            amount += Math.round((p.unit_price || 0) * qty);
        });
        return { vendors: vendorIds.size, items: count, amount };
    }, [cart, productIndex]);

    const filteredCatalog = useMemo(() => {
        if (!search.trim()) return catalog;
        const q = search.trim().toLowerCase();
        return catalog
            .map(g => ({
                ...g,
                products: g.products.filter(p =>
                    p.name.toLowerCase().includes(q) || (p.spec || '').toLowerCase().includes(q)),
            }))
            .filter(g => g.products.length > 0 || g.vendor.name.toLowerCase().includes(q));
    }, [catalog, search]);

    // ─── 요청서 생성 ───
    const createOrders = async () => {
        if (summary.items === 0) return;
        setCreating(true);
        try {
            const byVendor = {};
            Object.entries(cart).forEach(([pid, qty]) => {
                const p = productIndex[pid];
                if (!p) return;
                (byVendor[p.vendor.id] = byVendor[p.vendor.id] || []).push({
                    product_id: p.id, name: p.name, spec: p.spec,
                    quantity: qty, unit_price: p.unit_price || 0,
                });
            });
            const orders = Object.entries(byVendor).map(([vid, items]) => ({
                vendor_id: Number(vid), items,
            }));
            const res = await api.post('/materials/orders', { orders });
            if (res.data.status === 'success') {
                setCreatedOrders(res.data.data);
                setView('orders');
                setCart({});
                fetchHistory();
                window.scrollTo({ top: 0 });
            }
        } catch (e) {
            alert('요청서 생성에 실패했습니다.');
            console.error(e);
        }
        setCreating(false);
    };

    // ─── 전송 ───
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
            ...(order.memo ? ['', `※ ${order.memo}`] : []),
        ].join('\n');
    };

    const markSent = async (order, via, listSetter) => {
        try {
            const res = await api.patch(`/materials/orders/${order.id}`, { status: 'sent', sent_via: via });
            if (res.data.status === 'success') {
                const updated = res.data.data;
                listSetter(prev => prev.map(o => (o.id === updated.id ? updated : o)));
                fetchHistory();
            }
        } catch (e) { console.error(e); }
    };

    const handleCall = (order, listSetter) => {
        if (!order.vendor_phone) return;
        markSent(order, 'phone', listSetter);
        window.location.href = `tel:${order.vendor_phone.replace(/[^0-9+]/g, '')}`;
    };

    const handleKakao = async (order, listSetter) => {
        const text = buildMessage(order);
        if (navigator.share) {
            try {
                await navigator.share({ text });
                markSent(order, 'kakao', listSetter);
                showToast('공유 완료 — 전송됨으로 기록했습니다.');
                return;
            } catch (e) {
                if (e.name === 'AbortError') return; // 사용자가 취소
            }
        }
        await handleCopy(order, listSetter, true);
    };

    const handleCopy = async (order, listSetter, fromKakao = false) => {
        const text = buildMessage(order);
        try {
            await navigator.clipboard.writeText(text);
        } catch (e) {
            // 클립보드 권한 실패 폴백
            const ta = document.createElement('textarea');
            ta.value = text; document.body.appendChild(ta);
            ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        markSent(order, 'copy', listSetter);
        showToast(fromKakao
            ? '요청서가 복사되었습니다. 카카오톡 대화방에 붙여넣기 하세요.'
            : '요청서가 복사되었습니다.');
    };

    const updateStatus = async (order, status) => {
        try {
            await api.patch(`/materials/orders/${order.id}`, { status });
            fetchHistory();
        } catch (e) { alert('상태 변경 실패'); }
    };

    const deleteOrder = async (order) => {
        if (!window.confirm(`${order.vendor_name} 요청서를 삭제할까요?`)) return;
        try {
            await api.delete(`/materials/orders/${order.id}`);
            setCreatedOrders(prev => prev.filter(o => o.id !== order.id));
            fetchHistory();
        } catch (e) { alert('삭제 실패'); }
    };

    // ─── 요청서 카드 (결과/이력 공용) ───
    const OrderCard = ({ order, listSetter, compact = false }) => {
        const st = STATUS_LABEL[order.status] || STATUS_LABEL.draft;
        return (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
                    <div className="flex-1 min-w-[140px]">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900">{order.vendor_name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.text}</span>
                            {order.sent_via && (
                                <span className="text-[10px] text-slate-400">{SENT_VIA_LABEL[order.sent_via] || order.sent_via} 전송</span>
                            )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {order.order_date} · {order.item_count}개 품목
                            {order.total_amount > 0 && ` · 예상 ${formatNumber(order.total_amount)}원`}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {order.vendor_phone ? (
                            <button onClick={() => handleCall(order, listSetter)}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm">
                                <Phone size={16} /> 전화
                            </button>
                        ) : (
                            <Link to="/vendor-settings"
                                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium hover:bg-slate-200 transition-all">
                                <Phone size={14} /> 번호 미등록
                            </Link>
                        )}
                        <button onClick={() => handleKakao(order, listSetter)}
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-sm"
                            style={{ background: '#FEE500', color: '#191919' }}>
                            <MessageCircle size={16} /> 카톡 전송
                        </button>
                        <button onClick={() => handleCopy(order, listSetter)}
                            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 active:scale-95 transition-all">
                            <Copy size={15} />
                        </button>
                    </div>
                </div>
                {!compact && (
                    <div className="px-5 py-3">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-[11px] text-slate-400">
                                    <th className="text-left font-medium py-1.5">품목</th>
                                    <th className="text-right font-medium py-1.5 w-16">수량</th>
                                    <th className="text-right font-medium py-1.5 w-24 hidden sm:table-cell">단가</th>
                                    <th className="text-right font-medium py-1.5 w-28">금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((it, i) => (
                                    <tr key={i} className="border-t border-slate-50">
                                        <td className="py-2 text-slate-800 font-medium">
                                            {it.name}
                                            {it.spec && <span className="text-slate-400 font-normal text-xs ml-1.5">{it.spec}</span>}
                                        </td>
                                        <td className="py-2 text-right font-bold text-slate-900">{it.quantity}</td>
                                        <td className="py-2 text-right text-slate-500 hidden sm:table-cell">
                                            {it.unit_price > 0 ? formatNumber(it.unit_price) : '-'}
                                        </td>
                                        <td className="py-2 text-right text-slate-700">
                                            {it.amount > 0 ? `${formatNumber(it.amount)}원` : '-'}
                                        </td>
                                    </tr>
                                ))}
                                {order.total_amount > 0 && (
                                    <tr className="border-t-2 border-slate-100">
                                        <td className="py-2.5 font-bold text-slate-900">합계</td>
                                        <td />
                                        <td className="hidden sm:table-cell" />
                                        <td className="py-2.5 text-right font-black text-slate-900">{formatNumber(order.total_amount)}원</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
                {compact && (
                    <div className="px-5 py-2.5 text-xs text-slate-500 flex items-center justify-between gap-2 flex-wrap">
                        <span className="truncate">
                            {order.items.slice(0, 3).map(it => `${it.name} ×${it.quantity}`).join(', ')}
                            {order.items.length > 3 && ` 외 ${order.items.length - 3}건`}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                            {order.status !== 'completed' && order.status !== 'canceled' && (
                                <button onClick={() => updateStatus(order, 'completed')}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 font-bold hover:bg-emerald-100 transition-all">
                                    입고 완료
                                </button>
                            )}
                            {order.status === 'draft' && (
                                <button onClick={() => deleteOrder(order)}
                                    className="px-2 py-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all">
                                    <Trash2 size={14} />
                                </button>
                            )}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    // ─── 렌더 ───
    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-40">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                            <ShoppingCart size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">구매요청서 작성</h1>
                            <p className="text-xs text-slate-400 mt-0.5">품목 수량을 입력하면 거래처별 요청서가 만들어집니다</p>
                        </div>
                    </div>
                    <div className="flex bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
                        <button onClick={() => { setTab('compose'); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'compose' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                            요청서 작성
                        </button>
                        <button onClick={() => { setTab('history'); fetchHistory(); }}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-1.5 ${tab === 'history' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>
                            <History size={14} /> 요청 이력
                        </button>
                    </div>
                </header>

                {/* 직원 구매요청 대기 배너 */}
                {tab === 'compose' && staffRequests.length > 0 && (
                    <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
                        <button onClick={() => setStaffOpen(!staffOpen)}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-left">
                            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                            <span className="flex-1 text-sm font-bold text-amber-800">
                                직원 구매요청 대기 {staffRequests.length}건 — 요청서 작성 시 참고하세요
                            </span>
                            <ChevronDown size={16} className={`text-amber-400 transition-transform ${staffOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {staffOpen && (
                            <div className="px-4 pb-3 space-y-2">
                                {staffRequests.map(r => (
                                    <div key={r.id} className="bg-white rounded-xl px-4 py-2.5 text-sm">
                                        <span className="font-bold text-slate-800">{r.staff_name}</span>
                                        <span className="text-slate-500 ml-2">
                                            {(r.items || []).map(it => `${it.name} ${it.quantity || ''}`.trim()).join(', ')}
                                        </span>
                                    </div>
                                ))}
                                <Link to="/purchase-requests" className="inline-block text-xs font-bold text-amber-700 hover:underline pl-1">
                                    직원 구매요청 관리로 이동 →
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                {/* ── 작성 탭 ── */}
                {tab === 'compose' && view === 'cart' && (
                    <>
                        {/* 검색 */}
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="품목 이름으로 검색..."
                                className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 shadow-sm"
                            />
                        </div>

                        {loading ? (
                            <div className="text-center py-20 text-slate-400">
                                <RefreshCw size={24} className="animate-spin mx-auto mb-3" />
                                불러오는 중...
                            </div>
                        ) : catalog.every(g => g.products.length === 0) ? (
                            <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <PackageOpen size={32} className="mx-auto mb-3 text-slate-300" />
                                <p className="font-bold text-slate-500 mb-1">등록된 품목이 없습니다</p>
                                <p className="text-xs mb-4">거래처·품목 관리에서 거래처별 품목을 먼저 등록해 주세요.</p>
                                <Link to="/materials/items"
                                    className="inline-block px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-bold hover:bg-teal-600 transition-all">
                                    거래처·품목 관리로 이동
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {filteredCatalog.filter(g => g.products.length > 0).map(({ vendor, products }) => {
                                    const isOpen = search.trim() ? true : openVendors.has(vendor.id);
                                    const selCount = products.filter(p => cart[p.id]).length;
                                    return (
                                        <div key={vendor.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                            <button
                                                onClick={() => setOpenVendors(prev => {
                                                    const next = new Set(prev);
                                                    next.has(vendor.id) ? next.delete(vendor.id) : next.add(vendor.id);
                                                    return next;
                                                })}
                                                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-50/60 transition-colors">
                                                <span className="font-bold text-slate-900">{vendor.name}</span>
                                                {vendor.category && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{vendor.category}</span>}
                                                <span className="text-xs text-slate-400">{products.length}개 품목</span>
                                                {selCount > 0 && (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                                                        <Check size={11} /> {selCount}
                                                    </span>
                                                )}
                                                <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                            {isOpen && (
                                                <div className="border-t border-slate-100 divide-y divide-slate-50">
                                                    {products.map(p => {
                                                        const qty = cart[p.id] || 0;
                                                        const checked = qty > 0;
                                                        return (
                                                            <div key={p.id}
                                                                className={`flex items-center gap-3 px-5 py-3 transition-colors ${checked ? 'bg-teal-50/50' : ''}`}>
                                                                <button onClick={() => toggleItem(p.id)}
                                                                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${checked ? 'bg-teal-500 border-teal-500' : 'border-slate-300 hover:border-teal-400'}`}>
                                                                    {checked && <Check size={14} className="text-white" strokeWidth={3} />}
                                                                </button>
                                                                <button onClick={() => toggleItem(p.id)} className="flex-1 min-w-0 text-left">
                                                                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                                                    <p className="text-[11px] text-slate-400">
                                                                        {p.spec && <span>{p.spec} · </span>}
                                                                        {p.unit_price > 0 ? `${formatNumber(p.unit_price)}원` : '단가 미등록'}
                                                                    </p>
                                                                </button>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    <button onClick={() => setQty(p.id, Math.max(0, qty - 1))}
                                                                        className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all">
                                                                        <Minus size={15} />
                                                                    </button>
                                                                    <input
                                                                        type="number" min="0" inputMode="numeric"
                                                                        value={qty === 0 ? '' : qty}
                                                                        placeholder="0"
                                                                        onChange={e => setQty(p.id, Math.max(0, Number(e.target.value) || 0))}
                                                                        className="w-14 h-9 text-center text-sm font-bold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/30 bg-white"
                                                                    />
                                                                    <button onClick={() => setQty(p.id, qty + 1)}
                                                                        className="w-9 h-9 rounded-xl bg-teal-500 text-white flex items-center justify-center hover:bg-teal-600 active:scale-95 transition-all">
                                                                        <Plus size={15} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* 하단 고정 요약 바 */}
                        {summary.items > 0 && (
                            <div className="sticky bottom-4 mt-6 z-30">
                                <div className="bg-slate-900 text-white rounded-2xl shadow-2xl shadow-slate-900/30 px-5 py-4 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold">
                                            거래처 {summary.vendors}곳 · 품목 {summary.items}개
                                        </p>
                                        {summary.amount > 0 && (
                                            <p className="text-xs text-slate-300 mt-0.5">예상 금액 {formatNumber(summary.amount)}원</p>
                                        )}
                                    </div>
                                    <button onClick={() => setCart({})}
                                        className="px-3 py-2.5 rounded-xl text-slate-300 text-xs font-medium hover:bg-white/10 transition-all">
                                        비우기
                                    </button>
                                    <button onClick={createOrders} disabled={creating}
                                        className="px-5 py-3 rounded-xl bg-teal-400 text-slate-900 text-sm font-black hover:bg-teal-300 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                                        {creating ? <RefreshCw size={16} className="animate-spin" /> : <ClipboardList size={16} />}
                                        요청서 만들기
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* ── 요청서 결과 화면 ── */}
                {tab === 'compose' && view === 'orders' && (
                    <>
                        <div className="flex items-center gap-3 mb-5">
                            <button onClick={() => setView('cart')}
                                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
                                <ArrowLeft size={15} /> 새 요청서
                            </button>
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600">
                                <CheckCircle2 size={17} />
                                거래처별 요청서 {createdOrders.length}건이 만들어졌습니다 — 전화하거나 카톡으로 보내세요
                            </div>
                        </div>
                        <div className="space-y-4">
                            {createdOrders.map(order => (
                                <OrderCard key={order.id} order={order} listSetter={setCreatedOrders} />
                            ))}
                        </div>
                    </>
                )}

                {/* ── 이력 탭 ── */}
                {tab === 'history' && (
                    <div className="space-y-3">
                        {historyOrders.length === 0 ? (
                            <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                                <History size={30} className="mx-auto mb-3 text-slate-300" />
                                아직 작성된 구매요청서가 없습니다.
                            </div>
                        ) : (
                            historyOrders.map(order => (
                                <OrderCard key={order.id} order={order} listSetter={setHistoryOrders} compact />
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* 토스트 */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl">
                    {toast}
                </div>
            )}
        </div>
    );
}
