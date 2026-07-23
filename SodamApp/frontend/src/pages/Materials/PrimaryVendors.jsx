import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import {
    Star, Phone, Package, RefreshCw, Search, Plus, X,
    ShoppingCart, UserCircle, TrendingUp,
} from 'lucide-react';

export default function PrimaryVendors() {
    const [primaries, setPrimaries] = useState([]);
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [addSearch, setAddSearch] = useState('');
    const [busyId, setBusyId] = useState(null);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pv, cat] = await Promise.all([
                api.get('/materials/primary-vendors'),
                api.get('/materials/catalog'),
            ]);
            if (pv.data.status === 'success') setPrimaries(pv.data.data);
            if (cat.data.status === 'success') setCatalog(cat.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchAll(); }, []);

    const togglePrimary = async (vendorId, value) => {
        setBusyId(vendorId);
        try {
            await api.patch(`/vendors/${vendorId}`, { is_primary: value });
            await fetchAll();
        } catch (e) { alert('변경에 실패했습니다.'); }
        setBusyId(null);
    };

    // 주거래처 추가 후보 (미등록 거래처 검색)
    const candidates = useMemo(() => {
        const q = addSearch.trim().toLowerCase();
        return catalog
            .filter(g => !g.vendor.is_primary)
            .filter(g => !q || g.vendor.name.toLowerCase().includes(q))
            .slice(0, q ? 30 : 10);
    }, [catalog, addSearch]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-lg shadow-amber-400/25">
                            <Star size={20} className="text-white" fill="white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">주거래처</h1>
                            <p className="text-xs text-slate-400 mt-0.5">자주 거래하는 곳만 모아 한눈에 — 전화·품목·매입 현황</p>
                        </div>
                    </div>
                    <button onClick={() => setShowAdd(!showAdd)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-slate-900 text-sm font-black hover:bg-amber-300 active:scale-95 transition-all shadow-sm">
                        {showAdd ? <X size={16} /> : <Plus size={16} />}
                        {showAdd ? '닫기' : '주거래처 추가'}
                    </button>
                </header>

                {/* 추가 패널 */}
                {showAdd && (
                    <div className="mb-5 bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
                        <div className="relative p-3 border-b border-slate-100 bg-amber-50/50">
                            <Search size={15} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input autoFocus value={addSearch} onChange={e => setAddSearch(e.target.value)}
                                placeholder="거래처 이름 검색 후 별표를 눌러 등록"
                                className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                        </div>
                        <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
                            {candidates.map(({ vendor, products }) => (
                                <div key={vendor.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{vendor.name}</p>
                                        <p className="text-[10px] text-slate-400">
                                            {vendor.category || '분류 없음'} · 품목 {products.length}개{vendor.phone ? ` · ${vendor.phone}` : ''}
                                        </p>
                                    </div>
                                    <button onClick={() => togglePrimary(vendor.id, true)} disabled={busyId === vendor.id}
                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-50 text-amber-600 text-xs font-bold hover:bg-amber-100 transition-all disabled:opacity-50">
                                        <Star size={13} /> 등록
                                    </button>
                                </div>
                            ))}
                            {candidates.length === 0 && (
                                <p className="px-4 py-6 text-center text-xs text-slate-400">검색 결과가 없습니다.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 목록 */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" /> 불러오는 중...
                    </div>
                ) : primaries.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Star size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-slate-500 mb-1">등록된 주거래처가 없습니다</p>
                        <p className="text-xs">[주거래처 추가]에서 자주 거래하는 곳에 별표를 등록하세요.</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-4">
                        {primaries.map(v => (
                            <div key={v.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-4 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Star size={16} className="text-amber-400 shrink-0" fill="#fbbf24" />
                                        <h3 className="text-base font-bold text-slate-900 truncate flex-1">{v.name}</h3>
                                        <button onClick={() => window.confirm(`${v.name}을(를) 주거래처에서 해제할까요?`) && togglePrimary(v.id, false)}
                                            disabled={busyId === v.id}
                                            className="text-[10px] text-slate-300 hover:text-slate-500 transition-colors">
                                            해제
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                        {v.category && <span className="px-1.5 py-0.5 bg-slate-100 rounded-full font-medium">{v.category}</span>}
                                        {v.contact_info && <span className="inline-flex items-center gap-0.5"><UserCircle size={11} />{v.contact_info}</span>}
                                        {v.item && <span>{v.item}</span>}
                                    </p>
                                </div>

                                {/* 거래 요약 */}
                                <div className="grid grid-cols-3 divide-x divide-slate-50 text-center py-3">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400">이번달 매입</p>
                                        <p className="text-sm font-black text-slate-900 mt-0.5">
                                            {v.month_total > 0 ? `${formatNumber(v.month_total)}원` : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400">최근 3개월</p>
                                        <p className="text-sm font-black text-slate-900 mt-0.5">
                                            {v.recent3m_total > 0 ? `${formatNumber(v.recent3m_total)}원` : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400">최근 거래</p>
                                        <p className="text-sm font-bold text-slate-700 mt-0.5">
                                            {v.last_purchase ? v.last_purchase.slice(5).replace('-', '/') : '-'}
                                        </p>
                                    </div>
                                </div>

                                {/* 액션 */}
                                <div className="flex gap-2 px-4 pb-4">
                                    {v.phone ? (
                                        <a href={`tel:${v.phone.replace(/[^0-9+]/g, '')}`}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 transition-all">
                                            <Phone size={15} /> 전화
                                        </a>
                                    ) : (
                                        <Link to="/vendor-settings"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-slate-100 text-slate-400 text-xs font-medium">
                                            <Phone size={13} /> 번호 등록
                                        </Link>
                                    )}
                                    <Link to="/materials/items"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-all">
                                        <Package size={15} /> 품목 {v.product_count}
                                    </Link>
                                    <Link to="/materials/order-form"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-teal-500 text-white text-sm font-bold hover:bg-teal-600 active:scale-95 transition-all">
                                        <ShoppingCart size={15} /> 주문
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex items-start gap-2.5 px-4 py-3.5 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700">
                    <TrendingUp size={15} className="shrink-0 mt-0.5" />
                    <p>
                        주거래처는 <b>구매요청서 작성·품목 관리에서도 ★ 표시와 함께 맨 위에</b> 정렬됩니다.
                        거래처·품목 관리 화면에서도 거래처 이름 옆 별표로 등록/해제할 수 있습니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
