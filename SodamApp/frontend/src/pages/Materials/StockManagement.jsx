import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import {
    PackageSearch, RefreshCw, ShoppingCart, AlertTriangle,
    ChevronDown, Package, CheckCircle2, ClipboardList,
} from 'lucide-react';

export default function MaterialStockManagement() {
    const navigate = useNavigate();
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openVendors, setOpenVendors] = useState(new Set());
    const [savingIds, setSavingIds] = useState(new Set());
    const [savedId, setSavedId] = useState(null);
    // 로컬 편집값: { productId: { current_stock, safety_stock } }
    const [edits, setEdits] = useState({});

    const fetchCatalog = async () => {
        setLoading(true);
        try {
            const res = await api.get('/materials/catalog');
            if (res.data.status === 'success') {
                const data = res.data.data.filter(g => g.products.length > 0);
                setCatalog(data);
                setOpenVendors(new Set(data.map(g => g.vendor.id)));
                setEdits({});
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchCatalog(); }, []);

    const getVal = (p, field) => {
        const e = edits[p.id];
        if (e && e[field] !== undefined) return e[field];
        return p[field] ?? 0;
    };

    const setVal = (p, field, value) => {
        setEdits(prev => ({ ...prev, [p.id]: { ...prev[p.id], [field]: value } }));
    };

    const saveStock = async (p) => {
        const e = edits[p.id];
        if (!e) return;
        const payload = {};
        if (e.current_stock !== undefined) payload.current_stock = Number(e.current_stock) || 0;
        if (e.safety_stock !== undefined) payload.safety_stock = Number(e.safety_stock) || 0;
        if (Object.keys(payload).length === 0) return;
        setSavingIds(prev => new Set(prev).add(p.id));
        try {
            await api.put(`/materials/inventory/${p.id}`, payload);
            // 카탈로그 상태 갱신 (재조회 없이)
            setCatalog(prev => prev.map(g => ({
                ...g,
                products: g.products.map(x => x.id === p.id ? { ...x, ...payload } : x),
            })));
            setSavedId(p.id);
            setTimeout(() => setSavedId(null), 1500);
        } catch (err) {
            alert('재고 저장에 실패했습니다.');
        }
        setSavingIds(prev => { const n = new Set(prev); n.delete(p.id); return n; });
    };

    const allItems = useMemo(() => catalog.flatMap(g => g.products), [catalog]);
    const shortages = useMemo(() =>
        allItems.filter(p => {
            const cur = Number(getVal(p, 'current_stock')) || 0;
            const safe = Number(getVal(p, 'safety_stock')) || 0;
            return safe > 0 && cur < safe;
        }), [allItems, edits]);

    const isShort = (p) => {
        const cur = Number(getVal(p, 'current_stock')) || 0;
        const safe = Number(getVal(p, 'safety_stock')) || 0;
        return safe > 0 && cur < safe;
    };

    // 부족 품목을 구매요청서로
    const sendShortagesToOrder = () => {
        if (shortages.length === 0) return;
        const prefill = {};
        shortages.forEach(p => {
            const cur = Number(getVal(p, 'current_stock')) || 0;
            const safe = Number(getVal(p, 'safety_stock')) || 0;
            prefill[p.id] = Math.max(1, Math.ceil(safe - cur));
        });
        sessionStorage.setItem('materialOrderPrefill', JSON.stringify(prefill));
        navigate('/materials/order-form');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <PackageSearch size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">재고관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">품목별 현재고·안전재고를 관리하고 부족분을 바로 주문합니다</p>
                        </div>
                    </div>
                    <button onClick={fetchCatalog}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </header>

                {/* 요약 카드 */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 shadow-sm">
                        <p className="text-[11px] font-bold text-slate-400">전체 품목</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{allItems.length}<span className="text-sm font-bold text-slate-400 ml-1">개</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 px-4 py-4 shadow-sm">
                        <p className="text-[11px] font-bold text-slate-400">거래처</p>
                        <p className="text-2xl font-black text-slate-900 mt-1">{catalog.length}<span className="text-sm font-bold text-slate-400 ml-1">곳</span></p>
                    </div>
                    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${shortages.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                        <p className={`text-[11px] font-bold ${shortages.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>부족 품목</p>
                        <p className={`text-2xl font-black mt-1 ${shortages.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                            {shortages.length}<span className="text-sm font-bold opacity-60 ml-1">개</span>
                        </p>
                    </div>
                </div>

                {/* 부족 품목 주문 배너 */}
                {shortages.length > 0 && (
                    <button onClick={sendShortagesToOrder}
                        className="w-full mb-5 flex items-center gap-3 px-5 py-4 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-slate-800 active:scale-[0.99] transition-all">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                        <span className="flex-1 text-left text-sm font-bold">
                            안전재고 미달 품목 {shortages.length}개 — 구매요청서에 바로 담기
                        </span>
                        <span className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-400 text-slate-900 text-sm font-black">
                            <ShoppingCart size={15} /> 담기
                        </span>
                    </button>
                )}

                {loading ? (
                    <div className="text-center py-20 text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" /> 불러오는 중...
                    </div>
                ) : catalog.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Package size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-slate-500 mb-1">재고를 관리할 품목이 없습니다</p>
                        <p className="text-xs mb-4">거래처·품목 관리에서 품목을 먼저 등록해 주세요.</p>
                        <Link to="/materials/items"
                            className="inline-block px-4 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all">
                            거래처·품목 관리로 이동
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {catalog.map(({ vendor, products }) => {
                            const isOpen = openVendors.has(vendor.id);
                            const shortCount = products.filter(isShort).length;
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
                                        <span className="text-xs text-slate-400">{products.length}개 품목</span>
                                        {shortCount > 0 && (
                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                                                <AlertTriangle size={11} /> 부족 {shortCount}
                                            </span>
                                        )}
                                        <ChevronDown size={16} className={`ml-auto text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isOpen && (
                                        <div className="border-t border-slate-100">
                                            {/* 열 헤더 */}
                                            <div className="flex items-center gap-3 px-5 py-2 bg-slate-50/70 text-[10px] font-bold text-slate-400">
                                                <span className="flex-1">품목</span>
                                                <span className="w-20 text-center">현재고</span>
                                                <span className="w-20 text-center">안전재고</span>
                                                <span className="w-14 text-center">상태</span>
                                            </div>
                                            <div className="divide-y divide-slate-50">
                                                {products.map(p => {
                                                    const short = isShort(p);
                                                    return (
                                                        <div key={p.id} className={`flex items-center gap-3 px-5 py-3 ${short ? 'bg-red-50/40' : ''}`}>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                                                                {p.spec && <p className="text-[11px] text-slate-400">{p.spec}</p>}
                                                            </div>
                                                            <input
                                                                type="number" min="0" inputMode="decimal"
                                                                value={getVal(p, 'current_stock')}
                                                                onChange={e => setVal(p, 'current_stock', e.target.value)}
                                                                onBlur={() => saveStock(p)}
                                                                className={`w-20 h-10 text-center text-sm font-bold border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${short ? 'border-red-300 text-red-600 bg-white' : 'border-slate-200 bg-white'}`}
                                                            />
                                                            <input
                                                                type="number" min="0" inputMode="decimal"
                                                                value={getVal(p, 'safety_stock')}
                                                                onChange={e => setVal(p, 'safety_stock', e.target.value)}
                                                                onBlur={() => saveStock(p)}
                                                                className="w-20 h-10 text-center text-sm font-medium text-slate-500 border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                            />
                                                            <span className="w-14 flex justify-center">
                                                                {savingIds.has(p.id) ? (
                                                                    <RefreshCw size={14} className="animate-spin text-slate-400" />
                                                                ) : savedId === p.id ? (
                                                                    <CheckCircle2 size={16} className="text-emerald-500" />
                                                                ) : short ? (
                                                                    <span className="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-1 rounded-full">부족</span>
                                                                ) : (
                                                                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full">양호</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 하단 안내 */}
                <div className="mt-6 flex items-start gap-2.5 px-4 py-3.5 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700">
                    <ClipboardList size={15} className="shrink-0 mt-0.5" />
                    <p>
                        숫자를 수정하면 자동 저장됩니다. <b>안전재고</b>를 설정해 두면 현재고가 그 아래로 내려갈 때
                        <b> 부족</b>으로 표시되고, 상단 버튼으로 부족 품목을 구매요청서에 한 번에 담을 수 있습니다.
                        매일 아침 직원이 입력하는 <Link to="/inventory-check-admin" className="underline font-bold">오픈 재고 체크</Link>와는 별개의 품목 단위 재고입니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
