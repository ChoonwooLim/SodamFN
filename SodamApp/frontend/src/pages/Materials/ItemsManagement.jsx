import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import {
    Package, Phone, Plus, Trash2, Pencil, Check, X, RefreshCw,
    Building2, Search, ChevronRight, Star, Camera,
} from 'lucide-react';

const TAX_TYPES = [
    { id: 'taxable', label: '과세' },
    { id: 'tax_free', label: '면세' },
    { id: 'zero_rated', label: '영세' },
];

const FORM_TAX_TYPES = [{ id: 'auto', label: '자동분류' }, ...TAX_TYPES];

// 규격 단위 (개, 봉, kg, g, L, ml 등)
const UNITS = ['kg', 'g', 'L', 'ml', '개', '봉', '팩', 'box', 'EA', '포', '병', '통', '묶음', '판', '단'];

const EMPTY_FORM = { name: '', weight: '', unit: 'kg', pack_qty: 1, unit_price: '', tax_type: 'auto', note: '' };

// 중량+규격+수량 표시 (예: 20kg, 2kg ×3) — 구버전은 spec 텍스트 폴백
export const specOf = (p) => {
    if (p.weight && p.unit) {
        return `${p.weight}${p.unit}${p.pack_qty > 1 ? ` ×${p.pack_qty}` : ''}`;
    }
    if (p.unit && !p.weight) return `${p.pack_qty > 1 ? p.pack_qty : 1}${p.unit}`;
    return p.spec || '';
};

export default function MaterialItemsManagement() {
    const [catalog, setCatalog] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedVendorId, setSelectedVendorId] = useState(null);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [addForm, setAddForm] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    const fetchCatalog = async () => {
        try {
            const res = await api.get('/materials/catalog');
            if (res.data.status === 'success') setCatalog(res.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchCatalog(); }, []);

    // 이 화면은 주거래처만 표시 (주거래처 메뉴에서 별표 등록)
    const primaries = useMemo(() => catalog.filter(g => g.vendor.is_primary), [catalog]);

    // 선택된 거래처가 주거래처 목록에 없으면 첫 항목으로 보정
    useEffect(() => {
        if (primaries.length === 0) return;
        if (!primaries.some(g => g.vendor.id === selectedVendorId)) {
            const first = primaries.find(g => g.products.length > 0) || primaries[0];
            setSelectedVendorId(first.vendor.id);
        }
    }, [primaries, selectedVendorId]);

    const filteredVendors = useMemo(() => {
        const q = vendorSearch.trim().toLowerCase();
        const list = q ? primaries.filter(g => g.vendor.name.toLowerCase().includes(q)) : primaries;
        return [...list].sort((a, b) =>
            (b.products.length > 0) - (a.products.length > 0) ||
            a.vendor.name.localeCompare(b.vendor.name, 'ko'));
    }, [primaries, vendorSearch]);

    const selected = primaries.find(g => g.vendor.id === selectedVendorId);

    // ─── CRUD ───
    const addProduct = async () => {
        if (!addForm.name.trim() || !selected) return;
        setSaving(true);
        try {
            await api.post('/products', {
                vendor_id: selected.vendor.id,
                name: addForm.name.trim(),
                weight: String(addForm.weight).trim() || null,
                unit: addForm.unit || null,
                pack_qty: Number(addForm.pack_qty) || 1,
                unit_price: Number(addForm.unit_price) || 0,
                tax_type: addForm.tax_type,
                note: addForm.note.trim() || null,
            });
            setAddForm(EMPTY_FORM);
            setShowAdd(false);
            await fetchCatalog();
        } catch (e) { alert('품목 추가에 실패했습니다.'); }
        setSaving(false);
    };

    const startEdit = (p) => {
        setEditingId(p.id);
        setEditForm({
            name: p.name,
            weight: p.weight || '',
            unit: p.unit || (p.weight ? 'kg' : ''),
            pack_qty: p.pack_qty || 1,
            unit_price: p.unit_price || '',
            tax_type: p.tax_type || 'auto',
            note: p.note || (p.spec && !p.weight ? `규격: ${p.spec}` : ''),
        });
    };

    const saveEdit = async () => {
        if (!editForm.name.trim()) return;
        setSaving(true);
        try {
            await api.put(`/products/${editingId}`, {
                name: editForm.name.trim(),
                weight: String(editForm.weight).trim(),
                unit: editForm.unit || '',
                pack_qty: Number(editForm.pack_qty) || 1,
                unit_price: Number(editForm.unit_price) || 0,
                tax_type: editForm.tax_type,
                note: editForm.note.trim(),
            });
            setEditingId(null);
            await fetchCatalog();
        } catch (e) { alert('수정에 실패했습니다.'); }
        setSaving(false);
    };

    const deleteProduct = async (p) => {
        if (!window.confirm(`'${p.name}' 품목을 삭제할까요?`)) return;
        try {
            await api.delete(`/products/${p.id}`);
            await fetchCatalog();
        } catch (e) { alert('삭제에 실패했습니다.'); }
    };

    // 제품 사진 촬영/업로드 → 품목에 연결
    const uploadPhoto = async (p, file) => {
        if (!file) return;
        setSaving(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post('/products/upload-image', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.url) {
                await api.put(`/products/${p.id}`, { image_url: res.data.url });
                await fetchCatalog();
            }
        } catch (e) { alert('사진 업로드에 실패했습니다.'); }
        setSaving(false);
    };

    const taxLabel = (t) => (TAX_TYPES.find(x => x.id === t)?.label || '과세');

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                            <Package size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">주거래처·품목 관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">주거래처별 취급 품목의 규격·단가를 관리합니다</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/materials/primary-vendors"
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
                            <Star size={15} className="text-amber-400" fill="#fbbf24" /> 주거래처 등록 <ChevronRight size={14} />
                        </Link>
                        <Link to="/vendor-settings"
                            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all">
                            <Building2 size={15} /> 거래처 정보 수정 <ChevronRight size={14} />
                        </Link>
                    </div>
                </header>

                {loading ? (
                    <div className="text-center py-20 text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" /> 불러오는 중...
                    </div>
                ) : primaries.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <Star size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-slate-500 mb-1">등록된 주거래처가 없습니다</p>
                        <p className="text-xs mb-4">주거래처 메뉴에서 자주 거래하는 곳에 별표를 등록하면 여기에 표시됩니다.</p>
                        <Link to="/materials/primary-vendors"
                            className="inline-block px-4 py-2.5 bg-amber-400 text-slate-900 rounded-xl text-sm font-bold hover:bg-amber-300 transition-all">
                            주거래처 등록하러 가기
                        </Link>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-[280px_1fr] gap-5 items-start">
                        {/* ── 거래처 목록 (데스크톱 사이드 / 모바일 셀렉트) ── */}
                        <div className="md:hidden">
                            <select
                                value={selectedVendorId || ''}
                                onChange={e => setSelectedVendorId(Number(e.target.value))}
                                className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 shadow-sm">
                                {filteredVendors.map(g => (
                                    <option key={g.vendor.id} value={g.vendor.id}>
                                        ★ {g.vendor.name} ({g.products.length})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="relative p-3 border-b border-slate-100">
                                <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    value={vendorSearch}
                                    onChange={e => setVendorSearch(e.target.value)}
                                    placeholder="거래처 검색"
                                    className="w-full pl-8 pr-3 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                                />
                            </div>
                            <div className="max-h-[65vh] overflow-y-auto">
                                {filteredVendors.map(g => (
                                    <button key={g.vendor.id}
                                        onClick={() => { setSelectedVendorId(g.vendor.id); setShowAdd(false); setEditingId(null); }}
                                        className={`w-full flex items-center gap-2.5 px-4 py-3 text-left border-b border-slate-50 transition-colors ${selectedVendorId === g.vendor.id ? 'bg-cyan-50 border-l-4 border-l-cyan-500' : 'hover:bg-slate-50 border-l-4 border-l-transparent'}`}>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm truncate flex items-center gap-1 ${selectedVendorId === g.vendor.id ? 'font-bold text-cyan-700' : 'font-semibold text-slate-700'}`}>
                                                {g.vendor.is_primary && <Star size={11} className="text-amber-400 shrink-0" fill="#fbbf24" />}
                                                {g.vendor.name}
                                            </p>
                                            {g.vendor.category && <p className="text-[10px] text-slate-400">{g.vendor.category}</p>}
                                        </div>
                                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${g.products.length > 0 ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 text-slate-300'}`}>
                                            {g.products.length}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* ── 품목 패널 ── */}
                        {selected && (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                {/* 거래처 헤더 */}
                                <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 flex-wrap">
                                    <div className="flex-1 min-w-[140px]">
                                        <h2 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                                            <button
                                                onClick={async () => {
                                                    try {
                                                        await api.patch(`/vendors/${selected.vendor.id}`, { is_primary: !selected.vendor.is_primary });
                                                        await fetchCatalog();
                                                    } catch (e) { alert('주거래처 변경 실패'); }
                                                }}
                                                title={selected.vendor.is_primary ? '주거래처 해제' : '주거래처 등록'}
                                                className="active:scale-90 transition-transform">
                                                <Star size={17}
                                                    className={selected.vendor.is_primary ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}
                                                    fill={selected.vendor.is_primary ? '#fbbf24' : 'none'} />
                                            </button>
                                            {selected.vendor.name}
                                        </h2>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {selected.vendor.category || '분류 미지정'}
                                            {selected.vendor.item && ` · ${selected.vendor.item}`}
                                        </p>
                                    </div>
                                    {selected.vendor.phone ? (
                                        <a href={`tel:${selected.vendor.phone.replace(/[^0-9+]/g, '')}`}
                                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-600 text-sm font-bold hover:bg-emerald-100 transition-all">
                                            <Phone size={14} /> {selected.vendor.phone}
                                        </a>
                                    ) : (
                                        <Link to="/vendor-settings" className="text-xs text-slate-400 hover:text-slate-600 underline">
                                            전화번호 미등록 — 등록하기
                                        </Link>
                                    )}
                                    <button onClick={() => { setShowAdd(!showAdd); setEditingId(null); }}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 active:scale-95 transition-all shadow-sm">
                                        <Plus size={16} /> 품목 추가
                                    </button>
                                </div>

                                {/* 추가 폼 */}
                                {showAdd && (
                                    <div className="px-5 py-4 bg-cyan-50/50 border-b border-cyan-100">
                                        <div className="grid grid-cols-2 sm:grid-cols-[1fr_90px_100px_80px] gap-2 mb-2">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">품명 *</label>
                                                <input autoFocus placeholder="예: 쌀" value={addForm.name}
                                                    onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                                                    className="mt-0.5 w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">중량</label>
                                                <input placeholder="예: 20" inputMode="decimal" value={addForm.weight}
                                                    onChange={e => setAddForm({ ...addForm, weight: e.target.value })}
                                                    className="mt-0.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">규격(단위)</label>
                                                <select value={addForm.unit}
                                                    onChange={e => setAddForm({ ...addForm, unit: e.target.value })}
                                                    className="mt-0.5 w-full px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none">
                                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">수량</label>
                                                <input type="number" min="1" inputMode="numeric" value={addForm.pack_qty}
                                                    onChange={e => setAddForm({ ...addForm, pack_qty: e.target.value })}
                                                    className="mt-0.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-[120px_110px_1fr_auto] gap-2 items-end">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">단가(원)</label>
                                                <input placeholder="영수증 자동반영" type="number" inputMode="numeric" value={addForm.unit_price}
                                                    onChange={e => setAddForm({ ...addForm, unit_price: e.target.value })}
                                                    className="mt-0.5 w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">과세</label>
                                                <select value={addForm.tax_type}
                                                    onChange={e => setAddForm({ ...addForm, tax_type: e.target.value })}
                                                    className="mt-0.5 w-full px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none">
                                                    {FORM_TAX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400">비고</label>
                                                <input placeholder="선택 입력" value={addForm.note}
                                                    onChange={e => setAddForm({ ...addForm, note: e.target.value })}
                                                    onKeyDown={e => e.key === 'Enter' && addProduct()}
                                                    className="mt-0.5 w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={addProduct} disabled={saving || !addForm.name.trim()}
                                                    className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white text-sm font-bold hover:bg-cyan-700 disabled:opacity-40 transition-all">
                                                    등록
                                                </button>
                                                <button onClick={() => { setShowAdd(false); setAddForm(EMPTY_FORM); }}
                                                    className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-2 hidden sm:block text-[10px] text-slate-400">
                                            과세를 <b>자동분류</b>로 두면 품명 기준으로 면세(미가공 농축수산물)/과세를 자동 판정합니다.
                                            단가는 영수증 업로드 시 자동 반영되며 구매일자별로 갱신됩니다.
                                        </p>
                                    </div>
                                )}

                                {/* 품목 목록 */}
                                {selected.products.length === 0 ? (
                                    <div className="text-center py-14 text-slate-400 text-sm">
                                        <Package size={26} className="mx-auto mb-2 text-slate-300" />
                                        등록된 품목이 없습니다. [품목 추가]로 등록하세요.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {selected.products.map(p => (
                                            editingId === p.id ? (
                                                <div key={p.id} className="px-5 py-3.5 bg-amber-50/50">
                                                    <div className="grid grid-cols-2 sm:grid-cols-[1fr_90px_100px_80px] gap-2 mb-2">
                                                        <input value={editForm.name} placeholder="품명"
                                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                                                        <input value={editForm.weight} placeholder="중량" inputMode="decimal"
                                                            onChange={e => setEditForm({ ...editForm, weight: e.target.value })}
                                                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                                                        <select value={editForm.unit}
                                                            onChange={e => setEditForm({ ...editForm, unit: e.target.value })}
                                                            className="px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none">
                                                            <option value="">단위</option>
                                                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                                        </select>
                                                        <input type="number" min="1" value={editForm.pack_qty} placeholder="수량"
                                                            onChange={e => setEditForm({ ...editForm, pack_qty: e.target.value })}
                                                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                                                    </div>
                                                    <div className="grid grid-cols-2 sm:grid-cols-[120px_110px_1fr_auto] gap-2">
                                                        <input type="number" value={editForm.unit_price} placeholder="단가(원)"
                                                            onChange={e => setEditForm({ ...editForm, unit_price: e.target.value })}
                                                            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-right focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                                                        <select value={editForm.tax_type}
                                                            onChange={e => setEditForm({ ...editForm, tax_type: e.target.value })}
                                                            className="px-2 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none">
                                                            {FORM_TAX_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                                        </select>
                                                        <input value={editForm.note} placeholder="비고"
                                                            onChange={e => setEditForm({ ...editForm, note: e.target.value })}
                                                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                                            className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
                                                        <div className="flex gap-2">
                                                            <button onClick={saveEdit} disabled={saving}
                                                                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-all flex items-center gap-1">
                                                                <Check size={15} /> 저장
                                                            </button>
                                                            <button onClick={() => setEditingId(null)}
                                                                className="px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 transition-all">
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={p.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5 hover:bg-slate-50/60 transition-colors group">
                                                    {/* 제품 사진 (탭하면 촬영/업로드) */}
                                                    <label className="relative w-11 h-11 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 cursor-pointer flex items-center justify-center"
                                                        title={p.image_url ? '사진 변경' : '제품 사진 촬영/업로드'}>
                                                        {p.image_url ? (
                                                            <img src={p.image_url} alt={p.name} loading="lazy" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Camera size={16} className="text-slate-300" />
                                                        )}
                                                        <input type="file" accept="image/*" capture="environment" hidden
                                                            onChange={e => { uploadPhoto(p, e.target.files?.[0]); e.target.value = ''; }} />
                                                    </label>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-semibold text-slate-800">
                                                            {p.name}
                                                            {p.product_code && <span className="ml-2 text-[10px] font-mono text-slate-300">{p.product_code}</span>}
                                                        </p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {specOf(p) && <span className="font-medium text-slate-500">{specOf(p)} · </span>}
                                                            <span className={p.tax_type === 'tax_free' ? 'text-amber-500 font-bold' : ''}>{taxLabel(p.tax_type)}</span>
                                                            {p.note && <span> · {p.note}</span>}
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-col items-end shrink-0">
                                                        <span className="text-sm font-bold text-slate-700">
                                                            {p.unit_price > 0 ? `${formatNumber(p.unit_price)}원` : <span className="text-slate-300 font-normal text-xs">단가 미등록</span>}
                                                        </span>
                                                        {p.price_updated && (
                                                            <span className="text-[9px] text-slate-300">{p.price_updated.slice(5).replace('-', '/')} 기준</span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { startEdit(p); setShowAdd(false); }}
                                                            className="w-10 h-10 rounded-xl text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 flex items-center justify-center transition-all">
                                                            <Pencil size={15} />
                                                        </button>
                                                        <button onClick={() => deleteProduct(p)}
                                                            className="w-10 h-10 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-all">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
