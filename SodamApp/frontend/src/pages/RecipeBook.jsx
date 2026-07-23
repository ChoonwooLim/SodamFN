import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X, Flame, ListOrdered, ChefHat, Search, UtensilsCrossed, ShoppingBag, Wheat, Plus, Pencil, Trash2, Save, ImagePlus } from 'lucide-react';
import './RecipeBook.css';
import api from '../api';

// ── 카테고리 설정 (매장 메뉴 = 백엔드 category 키) ──
const PRODUCT_CATS = [
    { key: 'all', label: '전체', emoji: '📋' },
    { key: 'gimbap', label: '김밥류', emoji: '🍱' },
    { key: 'bunsik', label: '분식류', emoji: '🌶️' },
    { key: 'onigiri', label: '주먹밥류', emoji: '🍙' },
    { key: 'ramen', label: '라면류', emoji: '🍜' },
    { key: 'drinks', label: '음료류', emoji: '🥤' },
];
const INGREDIENT_CATS = [
    { key: 'all', label: '전체', emoji: '📖' },
    { key: 'banchan', label: '반찬/조림', emoji: '🥘' },
    { key: 'tuna', label: '참치', emoji: '🐟' },
    { key: 'sauce', label: '소스/양념', emoji: '🍳' },
    { key: 'sushi', label: '초밥', emoji: '🍣' },
    { key: 'meat', label: '고기', emoji: '🥩' },
    { key: 'prep', label: '손질', emoji: '🥒' },
    { key: 'onigiri', label: '주먹밥', emoji: '🍙' },
];
const CAT_COLORS = {
    gimbap: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    bunsik: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    onigiri: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700' },
    ramen: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    drinks: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
    banchan: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
    tuna: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700' },
    sauce: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700' },
    sushi: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    meat: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    prep: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
};
const DEF_COLOR = { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' };
const EMPTY = { item_type: 'product', name: '', category: 'gimbap', price: 0, emoji: '🍱', ingredients: [], steps: [] };

export default function RecipeBook() {
    const navigate = useNavigate();
    const [mainTab, setMainTab] = useState('product');   // 'product' | 'ingredient'
    const [activeCategory, setActiveCategory] = useState('all');
    const [detail, setDetail] = useState(null);          // 보기/편집 대상
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState(EMPTY);
    const [search, setSearch] = useState('');
    const [all, setAll] = useState([]);
    const [loading, setLoading] = useState(true);

    const isProduct = mainTab === 'product';
    const categories = isProduct ? PRODUCT_CATS : INGREDIENT_CATS;
    const categoryLabel = (k) => (categories.find(c => c.key === k) || {}).label || k;

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/menu-items');
            setAll(res.data.items || []);
        } catch (e) { console.error('메뉴 로드 실패', e); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { fetchAll(); }, [fetchAll]);

    const recipes = useMemo(() => all.filter(r => (r.item_type || 'product') === mainTab), [all, mainTab]);

    const filtered = useMemo(() => {
        let list = activeCategory === 'all' ? recipes : recipes.filter(r => r.category === activeCategory);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(q) || (r.ingredients || []).some(ing => ing.toLowerCase().includes(q)));
        }
        return list;
    }, [activeCategory, search, recipes]);

    const categoryCounts = useMemo(() => {
        const counts = { all: recipes.length };
        categories.forEach(c => { if (c.key !== 'all') counts[c.key] = recipes.filter(r => r.category === c.key).length; });
        return counts;
    }, [recipes, categories]);

    const handleMainTabChange = (tab) => { setMainTab(tab); setActiveCategory('all'); setSearch(''); setDetail(null); };
    const productCount = all.filter(r => (r.item_type || 'product') === 'product').length;
    const ingredientCount = all.filter(r => r.item_type === 'ingredient').length;

    // ── 편집 시작 ──
    const openEdit = (r) => { setForm({ ...EMPTY, ...r, ingredients: r.ingredients || [], steps: r.steps || [] }); setEditing(true); setDetail(r); };
    const openNew = () => {
        const cat = isProduct ? (activeCategory !== 'all' ? activeCategory : 'gimbap') : (activeCategory !== 'all' ? activeCategory : 'banchan');
        setForm({ ...EMPTY, item_type: mainTab, category: cat, emoji: isProduct ? '🍱' : '🥘' });
        setEditing(true); setDetail({ _new: true });
    };
    const closePanel = () => { setDetail(null); setEditing(false); };

    const saveForm = async () => {
        const payload = {
            item_type: form.item_type, name: form.name.trim() || '새 메뉴', category: form.category,
            price: Number(form.price) || 0, emoji: form.emoji || '', spec: form.spec || null,
            image_url: form.image_url || null,
            ingredients: (form.ingredients || []).map(s => s.trim()).filter(Boolean),
            steps: (form.steps || []).map(s => s.trim()).filter(Boolean),
        };
        try {
            if (form.id) await api.put(`/menu-items/${form.id}`, payload);
            else await api.post('/menu-items', payload);
            await fetchAll();
            closePanel();
        } catch (e) { alert('저장 실패: ' + (e.response?.data?.detail || e.message)); }
    };
    const deleteItem = async (r) => {
        if (!r?.id || !window.confirm(`'${r.name}'을(를) 삭제할까요?`)) return;
        try { await api.delete(`/menu-items/${r.id}`); await fetchAll(); closePanel(); }
        catch (e) { alert('삭제 실패: ' + (e.response?.data?.detail || e.message)); }
    };
    const [uploading, setUploading] = useState(false);
    const uploadImage = async (fileObj) => {
        if (!fileObj) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', fileObj);
            const res = await api.post('/menu-items/upload-image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (res.data?.url) setForm(f => ({ ...f, image_url: res.data.url }));
        } catch (e) { alert('이미지 업로드 실패: ' + (e.response?.data?.detail || e.message)); }
        finally { setUploading(false); }
    };

    return (
        <div className="min-h-screen bg-slate-50/80 pb-32">
            {/* Hero — 모바일에서는 햄버거 메뉴와 겹치지 않게 아래로 */}
            <div className="max-w-5xl mx-auto px-6 pt-16 md:pt-8 pb-2">
                <div className="flex items-center gap-3 mb-1">
                    <button onClick={() => navigate(-1)} className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border-none cursor-pointer text-white hover:shadow-xl transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0 flex items-center gap-2">
                            <ChefHat size={22} className="text-orange-500" /> 레시피 관리
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5 ml-0.5">우리 매장 메뉴 · 총 {all.length}개</p>
                    </div>
                    <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all">
                        <Plus size={16} /> {isProduct ? '메뉴 추가' : '재료 추가'}
                    </button>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="max-w-5xl mx-auto px-6 pt-3 pb-1">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    <button onClick={() => handleMainTabChange('product')} className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap border-none cursor-pointer transition-all ${isProduct ? 'bg-white text-slate-800 shadow-md' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}>
                        <ShoppingBag size={16} /> 상품 레시피
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${isProduct ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>{productCount}</span>
                    </button>
                    <button onClick={() => handleMainTabChange('ingredient')} className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap border-none cursor-pointer transition-all ${!isProduct ? 'bg-white text-slate-800 shadow-md' : 'bg-transparent text-slate-400 hover:text-slate-600'}`}>
                        <Wheat size={16} /> 재료 레시피
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${!isProduct ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>{ingredientCount}</span>
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="max-w-5xl mx-auto px-6 py-3">
                <div className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                    <Search size={16} className="text-slate-300 flex-shrink-0" />
                    <input type="text" placeholder={isProduct ? '메뉴명 검색...' : '레시피 또는 재료 검색...'} value={search} onChange={e => setSearch(e.target.value)} className="flex-1 border-none outline-none bg-transparent text-sm text-slate-700 placeholder:text-slate-300" />
                    {search && <button onClick={() => setSearch('')} className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400"><X size={10} /></button>}
                </div>
            </div>

            {/* Sub categories */}
            <div className="max-w-5xl mx-auto px-6 pb-2">
                <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                        <button key={cat.key} onClick={() => setActiveCategory(cat.key)} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border-none cursor-pointer transition-all whitespace-nowrap ${activeCategory === cat.key ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 shadow-sm border border-slate-100'}`}>
                            <span className="text-sm">{cat.emoji}</span> {cat.label}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center ${activeCategory === cat.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{categoryCounts[cat.key] || 0}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="max-w-5xl mx-auto px-6 py-20 text-center text-slate-400 text-sm">불러오는 중...</div>
            ) : filtered.length === 0 ? (
                <div className="max-w-5xl mx-auto px-6 py-20 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-100 mb-4"><UtensilsCrossed size={32} className="text-slate-300" /></div>
                    <h3 className="text-base font-bold text-slate-500 mb-1">레시피가 없습니다</h3>
                    <p className="text-sm text-slate-400">{search ? `"${search}" 검색 결과가 없어요` : '＋ 버튼으로 우리 매장 메뉴를 등록하세요'}</p>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto px-6 pt-3 pb-10">
                    <div className="recipe-grid-layout">
                        {filtered.map((r, idx) => {
                            const colors = CAT_COLORS[r.category] || DEF_COLOR;
                            return (
                                <div key={r.id} onClick={() => { setDetail(r); setEditing(false); }} style={{ animationDelay: `${idx * 0.04}s` }}
                                    className="group bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden card-animate cursor-pointer">
                                    <div className={`aspect-[4/3] flex items-center justify-center ${colors.bg} relative overflow-hidden`}>
                                        {r.image_url ? (
                                            <img src={r.image_url} alt={r.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                        ) : (
                                            <span className="recipe-emoji text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">{r.emoji || '🍽️'}</span>
                                        )}
                                        {isProduct && r.price > 0 && (
                                            <span className="recipe-price absolute bottom-2 right-2 text-[12px] font-extrabold text-slate-700 bg-white/85 px-2 py-0.5 rounded-md shadow-sm">{r.price.toLocaleString('ko-KR')}원</span>
                                        )}
                                    </div>
                                    <div className="p-3.5">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h3 className="text-sm font-bold text-slate-800 leading-snug m-0">{r.name}</h3>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${colors.bg} ${colors.text} ${colors.border} border`}>{categoryLabel(r.category)}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1"><Flame size={11} className="text-orange-300" /> 재료 {(r.ingredients || []).length}</span>
                                            <span className="flex items-center gap-1"><ListOrdered size={11} className="text-slate-300" /> {(r.steps || []).length}단계</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Detail / Edit Panel */}
            {detail && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center recipe-overlay-enter" onClick={closePanel}>
                    <div className="bg-white w-full max-w-lg h-full overflow-y-auto recipe-panel-enter" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100">
                            <div className="flex items-center justify-between px-5 py-4">
                                <h2 className="text-lg font-extrabold text-slate-800 m-0 truncate flex items-center gap-2">
                                    <span className="text-2xl">{editing ? form.emoji : detail.emoji}</span>
                                    {editing ? (form.id ? '메뉴 편집' : '새 메뉴 등록') : detail.name}
                                </h2>
                                <div className="flex items-center gap-1.5">
                                    {!editing && (
                                        <>
                                            <button onClick={() => openEdit(detail)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-bold flex items-center gap-1"><Pencil size={14} /> 편집</button>
                                            <button onClick={() => deleteItem(detail)} className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center text-red-500"><Trash2 size={16} /></button>
                                        </>
                                    )}
                                    <button onClick={closePanel} className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400"><X size={16} /></button>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        {editing ? (
                            <div className="px-5 py-6 space-y-4">
                                {isProduct && (
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">상품 사진</label>
                                        <div className="relative rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 aspect-[4/3] flex items-center justify-center">
                                            {form.image_url ? (
                                                <img src={form.image_url} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="text-center text-slate-400">
                                                    <ImagePlus size={28} className="mx-auto mb-1" />
                                                    <div className="text-xs">사진을 업로드하세요</div>
                                                </div>
                                            )}
                                            <label className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-white/90 border border-slate-200 text-xs font-bold text-slate-700 cursor-pointer hover:bg-white shadow-sm flex items-center gap-1">
                                                <ImagePlus size={13} /> {uploading ? '업로드 중…' : (form.image_url ? '변경' : '사진 선택')}
                                                <input type="file" accept="image/*" className="hidden" disabled={uploading}
                                                    onChange={e => { uploadImage(e.target.files?.[0]); e.target.value = ''; }} />
                                            </label>
                                            {form.image_url && (
                                                <button onClick={() => setForm(f => ({ ...f, image_url: null }))} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"><X size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-[64px_1fr] gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">이모지</label>
                                        <input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} className="w-full p-2.5 text-center text-xl bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">메뉴/재료명</label>
                                        <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="예: 참치김밥" className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">카테고리</label>
                                        <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200">
                                            {categories.filter(c => c.key !== 'all').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                                        </select>
                                    </div>
                                    {isProduct && (
                                        <div>
                                            <label className="text-xs text-slate-400 block mb-1">판매가 (원)</label>
                                            <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200" />
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">재료 <span className="text-slate-300">(한 줄에 하나)</span></label>
                                    <textarea rows={5} value={(form.ingredients || []).join('\n')} onChange={e => setForm(f => ({ ...f, ingredients: e.target.value.split('\n') }))} placeholder={'김 1장\n밥\n당근채'} className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 resize-none text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">조리 단계 <span className="text-slate-300">(한 줄에 하나)</span></label>
                                    <textarea rows={5} value={(form.steps || []).join('\n')} onChange={e => setForm(f => ({ ...f, steps: e.target.value.split('\n') }))} placeholder={'김 위에 밥을 편다.\n재료를 올린다.\n말아서 썬다.'} className="w-full p-3 bg-white border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-orange-200 resize-none text-sm" />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={closePanel} className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">취소</button>
                                    <button onClick={saveForm} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 flex items-center justify-center gap-1.5"><Save size={16} /> 저장</button>
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 py-6 space-y-6">
                                {detail.image_url && (
                                    <img src={detail.image_url} alt={detail.name} className="w-full aspect-[4/3] object-cover rounded-2xl border border-slate-100" />
                                )}
                                {isProduct && detail.price > 0 && (
                                    <div className="text-2xl font-extrabold text-slate-800">{detail.price.toLocaleString('ko-KR')}원</div>
                                )}
                                {(detail.ingredients || []).length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center"><Flame size={14} className="text-white" /></div>
                                            <h3 className="text-sm font-bold text-slate-700 m-0">재료 <span className="text-slate-400 font-medium ml-1.5">{detail.ingredients.length}가지</span></h3>
                                        </div>
                                        <div className="space-y-1.5">
                                            {detail.ingredients.map((ing, i) => (
                                                <div key={i} className="flex items-start gap-3 text-sm text-slate-600 py-2.5 px-3.5 rounded-xl bg-orange-50/60 border border-orange-100/80">
                                                    <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                                    <span className="leading-relaxed">{ing}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {(detail.steps || []).length > 0 && (
                                    <section>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center"><ListOrdered size={14} className="text-white" /></div>
                                            <h3 className="text-sm font-bold text-slate-700 m-0">조리 방법 <span className="text-slate-400 font-medium ml-1.5">{detail.steps.length}단계</span></h3>
                                        </div>
                                        <div className="space-y-2">
                                            {detail.steps.map((s, i) => (
                                                <div key={i} className="flex items-start gap-3 py-2">
                                                    <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold bg-slate-700 text-white">{i + 1}</div>
                                                    <div className="flex-1 text-sm leading-relaxed pt-1 text-slate-600">{s}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>
                                )}
                                {(detail.ingredients || []).length === 0 && (detail.steps || []).length === 0 && (
                                    <p className="text-sm text-slate-400 text-center py-8">레시피 내용이 없습니다. 편집을 눌러 재료·조리법을 입력하세요.</p>
                                )}
                            </div>
                        )}
                        <div className="h-10" />
                    </div>
                </div>
            )}
        </div>
    );
}
