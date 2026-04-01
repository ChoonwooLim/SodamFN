import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X, Flame, ListOrdered, ChefHat, Search, UtensilsCrossed, ShoppingBag, Wheat, Package } from 'lucide-react';
import './RecipeBook.css';
import {
    PRODUCT_RECIPES, PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABEL, PRODUCT_CATEGORY_COLORS,
    INGREDIENT_RECIPES, INGREDIENT_CATEGORIES, INGREDIENT_CATEGORY_LABEL, INGREDIENT_CATEGORY_COLORS,
} from '../data/recipes';

// ══════════════════════════════════════════
//  Main Component
// ══════════════════════════════════════════
export default function RecipeBook() {
    const navigate = useNavigate();
    const [mainTab, setMainTab] = useState('product');       // 'product' | 'ingredient'
    const [activeCategory, setActiveCategory] = useState('all');
    const [detail, setDetail] = useState(null);
    const [search, setSearch] = useState('');

    // 현재 탭에 맞는 데이터/설정
    const isProduct = mainTab === 'product';
    const recipes = isProduct ? PRODUCT_RECIPES : INGREDIENT_RECIPES;
    const categories = isProduct ? PRODUCT_CATEGORIES : INGREDIENT_CATEGORIES;
    const categoryLabel = isProduct ? PRODUCT_CATEGORY_LABEL : INGREDIENT_CATEGORY_LABEL;
    const categoryColors = isProduct ? PRODUCT_CATEGORY_COLORS : INGREDIENT_CATEGORY_COLORS;

    const filtered = useMemo(() => {
        let list = activeCategory === 'all'
            ? recipes
            : recipes.filter(r => r.category === activeCategory);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.ingredients.some(ing => ing.toLowerCase().includes(q))
            );
        }
        return list;
    }, [activeCategory, search, recipes]);

    const categoryCounts = useMemo(() => {
        const counts = { all: recipes.length };
        categories.forEach(c => {
            if (c.key !== 'all') counts[c.key] = recipes.filter(r => r.category === c.key).length;
        });
        return counts;
    }, [recipes, categories]);

    const handleMainTabChange = (tab) => {
        setMainTab(tab);
        setActiveCategory('all');
        setSearch('');
        setDetail(null);
    };

    const totalCount = PRODUCT_RECIPES.length + INGREDIENT_RECIPES.length;

    return (
        <div className="min-h-screen bg-slate-50/80 pb-32">
            {/* ── Hero Header ── */}
            <div className="max-w-5xl mx-auto px-6 pt-8 pb-2">
                <div className="flex items-center gap-3 mb-1">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20 border-none cursor-pointer text-white hover:shadow-xl hover:shadow-orange-500/30 transition-all"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0 flex items-center gap-2">
                            <ChefHat size={22} className="text-orange-500" />
                            레시피 관리
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5 ml-0.5">
                            총 {totalCount}개의 레시피
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Main Tab Switcher (상품 / 재료) ── */}
            <div className="max-w-5xl mx-auto px-6 pt-3 pb-1">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => handleMainTabChange('product')}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold
                            border-none cursor-pointer transition-all
                            ${isProduct
                                ? 'bg-white text-slate-800 shadow-md'
                                : 'bg-transparent text-slate-400 hover:text-slate-600'
                            }
                        `}
                    >
                        <ShoppingBag size={16} />
                        상품 레시피
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${isProduct ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                            {PRODUCT_RECIPES.length}
                        </span>
                    </button>
                    <button
                        onClick={() => handleMainTabChange('ingredient')}
                        className={`
                            flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold
                            border-none cursor-pointer transition-all
                            ${!isProduct
                                ? 'bg-white text-slate-800 shadow-md'
                                : 'bg-transparent text-slate-400 hover:text-slate-600'
                            }
                        `}
                    >
                        <Wheat size={16} />
                        재료 레시피
                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md ${!isProduct ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-400'}`}>
                            {INGREDIENT_RECIPES.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* ── Search Bar ── */}
            <div className="max-w-5xl mx-auto px-6 py-3">
                <div className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                    <Search size={16} className="text-slate-300 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder={isProduct ? '상품명 검색...' : '레시피 또는 재료 검색...'}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 border-none outline-none bg-transparent text-sm text-slate-700 placeholder:text-slate-300"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors"
                        >
                            <X size={10} />
                        </button>
                    )}
                </div>
            </div>

            {/* ── Sub-Category Tabs ── */}
            <div className="max-w-5xl mx-auto px-6 pb-2">
                <div className="flex flex-wrap gap-1.5">
                    {categories.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => setActiveCategory(cat.key)}
                            className={`
                                inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold
                                border-none cursor-pointer transition-all whitespace-nowrap
                                ${activeCategory === cat.key
                                    ? 'bg-slate-800 text-white shadow-md shadow-slate-800/15'
                                    : 'bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 shadow-sm border border-slate-100'
                                }
                            `}
                        >
                            <span className="text-sm">{cat.emoji}</span>
                            {cat.label}
                            <span className={`
                                text-[10px] font-bold px-1.5 py-0.5 rounded-md min-w-[18px] text-center
                                ${activeCategory === cat.key
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-100 text-slate-400'
                                }
                            `}>
                                {categoryCounts[cat.key]}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Recipe Grid ── */}
            {filtered.length === 0 ? (
                <div className="max-w-5xl mx-auto px-6 py-20 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-slate-100 mb-4">
                        <UtensilsCrossed size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-base font-bold text-slate-500 mb-1">레시피가 없습니다</h3>
                    <p className="text-sm text-slate-400">
                        {search ? `"${search}" 검색 결과가 없어요` : '이 카테고리에 등록된 레시피가 없어요'}
                    </p>
                </div>
            ) : (
                <div className="max-w-5xl mx-auto px-6 pt-3 pb-10">
                    <div className="recipe-grid-layout">
                        {filtered.map((r, idx) => {
                            const colors = categoryColors[r.category] || { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' };
                            const hasDetail = r.ingredients.length > 0 || r.steps.length > 0;
                            return (
                                <div
                                    key={r.id}
                                    onClick={() => hasDetail ? setDetail(r) : null}
                                    className={`group bg-white rounded-2xl shadow-sm border border-slate-100
                                               hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5
                                               transition-all duration-200 overflow-hidden card-animate
                                               ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                                    style={{ animationDelay: `${idx * 0.04}s` }}
                                >
                                    {/* Card Top */}
                                    {r.file ? (
                                        <img
                                            src={`/recipes/${r.file}`}
                                            alt={r.name}
                                            loading="lazy"
                                            className="w-full aspect-[4/3] object-cover"
                                        />
                                    ) : (
                                        <div className={`aspect-[4/3] flex flex-col items-center justify-center gap-1 ${colors.bg} relative overflow-hidden`}>
                                            <div className="absolute inset-0 opacity-[0.03]"
                                                 style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '20px 20px' }} />
                                            <span className="text-5xl relative z-10 group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">
                                                {r.emoji}
                                            </span>
                                        </div>
                                    )}

                                    {/* Card Body */}
                                    <div className="p-3.5">
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <h3 className="text-sm font-bold text-slate-800 leading-snug m-0">
                                                {r.name}
                                            </h3>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${colors.bg} ${colors.text} ${colors.border} border`}>
                                                {categoryLabel[r.category]}
                                            </span>
                                        </div>
                                        {hasDetail ? (
                                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Flame size={11} className="text-orange-300" />
                                                    재료 {r.ingredients.length}
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <ListOrdered size={11} className="text-slate-300" />
                                                    {r.steps.length}단계
                                                </span>
                                                {r.yield && (
                                                    <span className="flex items-center gap-1 ml-auto text-[11px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md">
                                                        <Package size={11} />
                                                        {r.yield}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-[11px] text-slate-300 m-0">레시피 준비 중</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Detail Panel (Slide-up) ── */}
            {detail && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex justify-center recipe-overlay-enter"
                    onClick={() => setDetail(null)}
                >
                    <div
                        className="bg-white w-full max-w-lg h-full overflow-y-auto recipe-panel-enter"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Panel Header */}
                        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-100">
                            <div className="flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="text-2xl flex-shrink-0">{detail.emoji}</span>
                                    <div className="min-w-0">
                                        <h2 className="text-lg font-extrabold text-slate-800 m-0 truncate">
                                            {detail.name}
                                        </h2>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md ${(categoryColors[detail.category] || {}).bg || 'bg-slate-50'} ${(categoryColors[detail.category] || {}).text || 'text-slate-600'}`}>
                                                {categoryLabel[detail.category]}
                                            </span>
                                            {detail.yield && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                                                    <Package size={11} />
                                                    제조수량 {detail.yield}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setDetail(null)}
                                    className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors flex-shrink-0"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Panel Image */}
                        {detail.file && (
                            <img src={`/recipes/${detail.file}`} alt={detail.name} className="w-full block" />
                        )}

                        {/* Panel Body */}
                        <div className="px-5 py-6 space-y-6">
                            {/* Ingredients */}
                            {detail.ingredients.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-sm shadow-orange-400/20">
                                            <Flame size={14} className="text-white" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0">
                                            재료
                                            <span className="text-slate-400 font-medium ml-1.5">{detail.ingredients.length}가지</span>
                                        </h3>
                                    </div>
                                    <div className="space-y-1.5">
                                        {detail.ingredients.map((ing, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-3 text-sm text-slate-600 py-2.5 px-3.5 rounded-xl bg-orange-50/60 border border-orange-100/80"
                                            >
                                                <span className="w-5 h-5 rounded-full bg-orange-200 text-orange-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    {i + 1}
                                                </span>
                                                <span className="leading-relaxed">{ing}</span>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Steps */}
                            {detail.steps.length > 0 && (
                                <section>
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-sm shadow-slate-600/20">
                                            <ListOrdered size={14} className="text-white" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-700 m-0">
                                            조리 방법
                                            <span className="text-slate-400 font-medium ml-1.5">{detail.steps.length}단계</span>
                                        </h3>
                                    </div>
                                    <div className="relative">
                                        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200" />
                                        <div className="space-y-0">
                                            {detail.steps.map((s, i) => {
                                                const isWarning = s.startsWith('※');
                                                return (
                                                    <div key={i} className="relative flex items-start gap-3 py-3 pl-0 pr-1">
                                                        <div className={`
                                                            relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                                                            ${isWarning
                                                                ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                                                                : 'bg-slate-700 text-white shadow-sm shadow-slate-700/20'
                                                            }
                                                        `}>
                                                            {isWarning ? '!' : i + 1}
                                                        </div>
                                                        <div className={`
                                                            flex-1 text-sm leading-relaxed pt-1
                                                            ${isWarning
                                                                ? 'text-red-600 font-semibold bg-red-50 rounded-xl px-3 py-2.5 border border-red-100 -mt-0.5'
                                                                : 'text-slate-600'
                                                            }
                                                        `}>
                                                            {s}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>

                        <div className="h-10" />
                    </div>
                </div>
            )}
        </div>
    );
}
