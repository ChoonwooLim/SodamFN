import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../utils/constants';
import {
    Receipt as ReceiptIcon, Camera, Search, RefreshCw, X, Trash2,
    CheckCircle2, AlertTriangle, Save, Calendar, ExternalLink,
} from 'lucide-react';

const STATUS_CHIP = {
    classified: { text: '매입 반영됨', cls: 'bg-emerald-50 text-emerald-600' },
    pending: { text: '확인 필요', cls: 'bg-amber-50 text-amber-600' },
    duplicate: { text: '중복·미반영', cls: 'bg-slate-200 text-slate-500' },
};

export default function MaterialReceipts() {
    const [searchParams] = useSearchParams();
    const orderId = searchParams.get('order_id');

    const [receipts, setReceipts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(0);      // 업로드 진행 중 파일 수
    const [q, setQ] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selected, setSelected] = useState(null);      // 상세 모달 대상
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(null);
    const fileRef = useRef(null);

    const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

    const fetchReceipts = async (params = {}) => {
        setLoading(true);
        try {
            const query = new URLSearchParams();
            const qq = params.q ?? q;
            const df = params.dateFrom ?? dateFrom;
            const dt = params.dateTo ?? dateTo;
            const st = params.status ?? statusFilter;
            if (qq.trim()) query.set('q', qq.trim());
            if (df) query.set('date_from', df);
            if (dt) query.set('date_to', dt);
            if (st) query.set('status', st);
            const res = await api.get(`/materials/receipts?${query.toString()}`);
            if (res.data.status === 'success') setReceipts(res.data.data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { fetchReceipts(); }, [statusFilter]);

    // ─── 업로드 ───
    const handleFiles = async (files) => {
        const list = Array.from(files || []).filter(f => f.type.startsWith('image/'));
        if (list.length === 0) return;
        setUploading(list.length);
        let ok = 0, extracted = 0;
        for (const f of list) {
            try {
                const fd = new FormData();
                fd.append('file', f);
                if (orderId) fd.append('purchase_order_id', orderId);
                const res = await api.post('/materials/receipts', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                if (res.data.status === 'success') {
                    ok += 1;
                    if (res.data.extracted) extracted += 1;
                }
            } catch (e) { console.error(e); }
            setUploading(prev => prev - 1);
        }
        await fetchReceipts();
        if (ok === 0) showToast('업로드에 실패했습니다. 다시 시도해 주세요.');
        else showToast(`영수증 ${ok}장 업로드 완료 — AI 자동분류 ${extracted}장${ok > extracted ? `, 확인 필요 ${ok - extracted}장` : ''}`);
    };

    // ─── 상세/편집 ───
    const openDetail = (r) => {
        setSelected(r);
        setEditForm({
            vendor_name: r.vendor_name || '',
            receipt_date: r.receipt_date || '',
            amount: r.amount || 0,
            category: r.category || '',
            payment_method: r.payment_method || 'Card',
            memo: r.memo || '',
            force_attach: false,
        });
    };

    const saveDetail = async () => {
        if (!selected) return;
        setSaving(true);
        try {
            const res = await api.patch(`/materials/receipts/${selected.id}`, {
                vendor_name: editForm.vendor_name,
                receipt_date: editForm.receipt_date || '',
                amount: Number(editForm.amount) || 0,
                category: editForm.category,
                payment_method: editForm.payment_method,
                memo: editForm.memo,
                force_attach: editForm.force_attach || false,
            });
            if (res.data.status === 'success') {
                const updated = res.data.data;
                setReceipts(prev => prev.map(r => (r.id === updated.id ? updated : r)));
                setSelected(updated);
                showToast(updated.status === 'classified'
                    ? '저장 완료 — 매입·비용관리에 반영되었습니다.'
                    : updated.status === 'duplicate'
                        ? '저장 완료 — 중복 상태라 매입에는 반영하지 않았습니다.'
                        : '저장 완료 — 거래처명과 금액을 입력하면 매입에 반영됩니다.');
            }
        } catch (e) { alert('저장에 실패했습니다.'); }
        setSaving(false);
    };

    const deleteReceipt = async () => {
        if (!selected) return;
        const withExpense = selected.status === 'classified'
            ? window.confirm('이 영수증으로 등록된 매입(비용) 내역도 함께 차감할까요?\n확인=매입도 차감, 취소=이미지만 삭제')
            : false;
        if (!window.confirm('영수증을 삭제할까요? 원본 이미지도 삭제됩니다.')) return;
        try {
            await api.delete(`/materials/receipts/${selected.id}?remove_expense=${withExpense}`);
            setReceipts(prev => prev.filter(r => r.id !== selected.id));
            setSelected(null);
            showToast('영수증이 삭제되었습니다.');
        } catch (e) { alert('삭제에 실패했습니다.'); }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                            <ReceiptIcon size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">영수증 보관함</h1>
                            <p className="text-xs text-slate-400 mt-0.5">영수증을 촬영해 올리면 AI가 자동 분류해 매입·비용관리에 반영합니다</p>
                        </div>
                    </div>
                    <button onClick={() => fileRef.current?.click()} disabled={uploading > 0}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-rose-500 text-white text-sm font-black hover:bg-rose-600 active:scale-95 transition-all shadow-lg shadow-rose-500/25 disabled:opacity-60">
                        {uploading > 0 ? <RefreshCw size={17} className="animate-spin" /> : <Camera size={17} />}
                        {uploading > 0 ? `업로드 중 (${uploading})` : '영수증 촬영/업로드'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden
                        onChange={e => { handleFiles(e.target.files); e.target.value = ''; }} />
                </header>

                {orderId && (
                    <div className="mb-4 px-4 py-3 bg-teal-50 border border-teal-200 rounded-2xl text-sm text-teal-700 font-medium">
                        구매요청서 #{orderId}에 연결된 영수증으로 업로드됩니다.
                    </div>
                )}

                {/* 검색 바 */}
                <div className="bg-white border border-slate-200 rounded-2xl p-3 mb-4 shadow-sm flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={q} onChange={e => setQ(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && fetchReceipts()}
                            placeholder="거래처명·메모 검색"
                            className="w-full pl-10 pr-3 py-2.5 bg-slate-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                        />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={14} />
                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                            className="px-2 py-2 bg-slate-50 rounded-lg text-xs focus:outline-none" />
                        ~
                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                            className="px-2 py-2 bg-slate-50 rounded-lg text-xs focus:outline-none" />
                    </div>
                    <button onClick={() => fetchReceipts()}
                        className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all">
                        검색
                    </button>
                    <div className="flex gap-1">
                        {[['', '전체'], ['classified', '반영됨'], ['pending', '확인 필요'], ['duplicate', '중복']].map(([v, label]) => (
                            <button key={v} onClick={() => setStatusFilter(v)}
                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === v ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 목록 */}
                {loading ? (
                    <div className="text-center py-20 text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-3" /> 불러오는 중...
                    </div>
                ) : receipts.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
                        <ReceiptIcon size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-slate-500 mb-1">보관된 영수증이 없습니다</p>
                        <p className="text-xs">물품 구매 후 [영수증 촬영/업로드] 버튼으로 올려주세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {receipts.map(r => {
                            const chip = STATUS_CHIP[r.status] || STATUS_CHIP.pending;
                            return (
                                <button key={r.id} onClick={() => openDetail(r)}
                                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-left hover:shadow-md hover:-translate-y-0.5 transition-all">
                                    <div className="h-36 bg-slate-100 overflow-hidden">
                                        <img src={r.image_url} alt="영수증" loading="lazy"
                                            className="w-full h-full object-cover" />
                                    </div>
                                    <div className="p-3">
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className="text-sm font-bold text-slate-800 truncate">
                                                {r.vendor_name || '거래처 미확인'}
                                            </span>
                                            <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${chip.cls}`}>{chip.text}</span>
                                        </div>
                                        <p className="text-base font-black text-slate-900">
                                            {r.amount > 0 ? `${formatNumber(r.amount)}원` : <span className="text-slate-300 text-xs font-normal">금액 미확인</span>}
                                        </p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            {r.receipt_date || '날짜 미확인'}{r.category ? ` · ${r.category}` : ''}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── 상세/편집 모달 ── */}
            {selected && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                    style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setSelected(null)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-slate-900">영수증 상세</h3>
                                {(() => { const c = STATUS_CHIP[selected.status] || STATUS_CHIP.pending;
                                    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.cls}`}>{c.text}</span>; })()}
                            </div>
                            <button onClick={() => setSelected(null)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid md:grid-cols-2 gap-5 p-5">
                            {/* 원본 이미지 */}
                            <div>
                                <a href={selected.image_url} target="_blank" rel="noopener noreferrer"
                                    className="block rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                                    <img src={selected.image_url} alt="영수증 원본" className="w-full object-contain max-h-[420px]" />
                                </a>
                                <a href={selected.image_url} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                                    <ExternalLink size={12} /> 원본 크게 보기
                                </a>
                            </div>

                            {/* 편집 폼 */}
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400">거래처명</label>
                                    <input value={editForm.vendor_name}
                                        onChange={e => setEditForm({ ...editForm, vendor_name: e.target.value })}
                                        placeholder="예: 하나로마트"
                                        className="mt-1 w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400">구매일</label>
                                        <input type="date" value={editForm.receipt_date}
                                            onChange={e => setEditForm({ ...editForm, receipt_date: e.target.value })}
                                            className="mt-1 w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400">금액(원)</label>
                                        <input type="number" inputMode="numeric" value={editForm.amount}
                                            onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                            className="mt-1 w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400">비용 분류</label>
                                        <select value={editForm.category}
                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                            className="mt-1 w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none">
                                            <option value="">분류 선택</option>
                                            {EXPENSE_CATEGORIES.map(c => (
                                                <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-slate-400">결제수단</label>
                                        <div className="mt-1 flex bg-slate-50 border border-slate-200 rounded-xl p-1">
                                            {[['Card', '카드'], ['Cash', '현금']].map(([v, label]) => (
                                                <button key={v} onClick={() => setEditForm({ ...editForm, payment_method: v })}
                                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${editForm.payment_method === v ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-slate-400">메모</label>
                                    <input value={editForm.memo}
                                        onChange={e => setEditForm({ ...editForm, memo: e.target.value })}
                                        placeholder="검색에 활용됩니다 (예: 김장 재료)"
                                        className="mt-1 w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                </div>

                                <div className={`flex items-start gap-2 px-3.5 py-3 rounded-xl text-xs ${selected.status === 'classified' ? 'bg-emerald-50 text-emerald-700' : selected.status === 'duplicate' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>
                                    {selected.status === 'classified'
                                        ? <><CheckCircle2 size={14} className="shrink-0 mt-0.5" /><span>매입·비용관리에 반영되어 있습니다. 수정 후 저장하면 지출 내역도 함께 갱신됩니다.</span></>
                                        : selected.status === 'duplicate'
                                            ? <><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>카드/계좌이체 내역과 <b>중복으로 감지되어 매입에 반영하지 않았습니다</b> (영수증만 보관). {selected.memo}</span></>
                                            : <><AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>아직 매입에 반영되지 않았습니다. 거래처명과 금액을 입력하고 저장하면 자동 반영됩니다.</span></>}
                                </div>

                                {selected.status === 'duplicate' && (
                                    <label className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-red-200 bg-red-50/50 text-xs text-red-600 font-bold cursor-pointer">
                                        <input type="checkbox" checked={editForm.force_attach || false}
                                            onChange={e => setEditForm({ ...editForm, force_attach: e.target.checked })}
                                            className="w-4 h-4 accent-red-500" />
                                        중복이 아님을 확인했습니다 — 저장 시 매입에 반영 (이중 계산 주의!)
                                    </label>
                                )}

                                <div className="flex gap-2 pt-1">
                                    <button onClick={saveDetail} disabled={saving}
                                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-50">
                                        {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                                        저장
                                    </button>
                                    <button onClick={deleteReceipt}
                                        className="px-4 py-3.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-all">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 토스트 */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[95] bg-slate-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl max-w-[90vw]">
                    {toast}
                </div>
            )}
        </div>
    );
}
