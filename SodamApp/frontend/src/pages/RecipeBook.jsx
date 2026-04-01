import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, X, Flame, ListOrdered, ChefHat, Search, UtensilsCrossed } from 'lucide-react';
import './RecipeBook.css';

// ── Recipe Data ──
const RECIPES = [
    {
        id: 1, file: null, name: '어묵 조림', category: 'banchan', emoji: '🍢',
        ingredients: ['어묵 한 봉지 반 (75장)', '간장 230~240g', '물엿 230~240g', '다시다 50g', '식용유 170g', '물 930g'],
        steps: ['어묵을 한입 크기로 썰어 준비한다.', '간장, 물엿, 다시다를 섞어 양념장을 만든다.', '냄비에 식용유를 두르고 어묵을 볶는다.', '양념장과 물을 넣고 중불에서 조린다.', '국물이 자작하게 줄어들 때까지 뒤적이며 조린다.'],
    },
    {
        id: 2, file: null, name: '당근 라페', category: 'sauce', emoji: '🥕',
        ingredients: ['당근 2.4kg', '연겨자 소스 80g', '설탕 60g', '다시다 35g'],
        steps: ['당근을 곱게 채 썬다.', '연겨자 소스, 설탕, 다시다를 섞어 양념을 만든다.', '채 썬 당근에 양념을 넣고 골고루 버무린다.'],
    },
    {
        id: 3, file: null, name: '떡볶이 가루', category: 'sauce', emoji: '🌶️',
        ingredients: ['고운 고춧가루 1.5kg', '고운 청양고춧가루 0.5kg', '설탕 7.7kg', '찹쌀가루 1kg', '맛소금 100g', '후추가루 50g', '다시다 1,000g', '마늘가루 250g', '미원 100g', '치킨스톡 250g'],
        steps: ['모든 가루 재료를 큰 볼에 넣는다.', '골고루 섞어준다.', '총 12,450g → 700g 17봉지 + 550g 1봉지로 소분한다.'],
    },
    {
        id: 4, file: null, name: '매콤 참치', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔 1통 (1.8kg)', '고추장 800g', '설탕 120g', '물엿 100g', '후추 8g (밥 수저 1개)', '다시다 14g (밥 수저 2개)'],
        steps: ['참치캔을 열어 기름을 빼준다.', '고추장, 설탕, 물엿, 후추, 다시다를 섞어 양념장을 만든다.', '기름 뺀 참치에 양념장을 넣고 골고루 버무린다.', '참치 덩어리가 있으면 손으로 으깨준다.'],
    },
    {
        id: 5, file: null, name: '순한 참치', category: 'tuna', emoji: '🐟',
        ingredients: ['참치캔 4통 (1.8kg × 4 = 총 7.2kg)', '마요네즈 2,400g', '설탕 450g', '후추 24g (밥 수저 3개)', '다시다 30g'],
        steps: ['참치 기름빼기: 볼에 참치를 담고 넓은 채반에 펴서 무거운 것으로 누른다.', '3~4시간 정도 기름을 빼준다 (오래 둘수록 잘 빠짐).', '기름은 신문지에 흡수시켜 일반 쓰레기로 배출.', '물기 제거한 큰 스테인리스 볼에 마요네즈를 먼저 넣는다.', '기름 뺀 참치를 넣고, 가루 재료는 맨 위에 올린다.', '골고루 버무리며 참치 덩어리를 손으로 으깨준다.', '진득진득해지면 잘 버무려진 상태 → 바트에 담아 보관.'],
    },
    {
        id: 6, file: null, name: '우엉 조림', category: 'banchan', emoji: '🥘',
        ingredients: ['우엉 4kg × 2봉지 (총 8kg)', '간장 1300g', '흑설탕 400g', '백설탕 300g', '미림 200g', '물엿 550g', '다시다 70g', '식용유 170g'],
        steps: ['큰 솥에 우엉이 잠길 정도로 물을 넣고 삶는다.', '물이 끓으면 6분 시간을 재고, 펄펄 끓으면 뒤집어 준다.', '6분 뒤 건져서 찬물에 헹궈 불순물을 제거한다.', '※ 너무 익히면 양념 조릴 때 우엉이 끊어짐!', '양념 재료를 모두 섞고, 물 뺀 우엉을 넣고 조린다.', '어묵보다 자주 뒤집고, 양념이 끓으면 6분 재기.', '색깔을 입히는 게 중요! 양념 국물이 많으면 3~6분 추가.'],
    },
    {
        id: 7, file: null, name: '유부초밥', category: 'sushi', emoji: '🍣',
        ingredients: ['[2kg] 우엉 250g · 당근 125g · 설탕 40g · 식초 155g · 검은 깨 20g', '[1kg] 우엉 125g · 당근 62g · 설탕 20g · 식초 77g · 검은 깨 10g', '[500g] 우엉 63g · 당근 31g · 설탕 10g · 식초 39g · 검은 깨 5g'],
        steps: ['새벽에 2kg 기준으로 준비한다.', '영업 중에는 상황에 맞게 적당량씩 추가로 만든다.', '남으면 다음 날 밥맛이 떨어지므로 주의.', '맛이 일관되게 유지되도록 계량을 반드시 지킨다.'],
    },
    {
        id: 8, file: null, name: '땡초 멸치', category: 'banchan', emoji: '🐟',
        ingredients: ['멸치 1박스', '청양고추 1kg', '백설탕 550g', '간장 100g', '소주 100g', '다시다 60g', '식용유 70g', '물엿 350g', '통깨 130g (1국자)'],
        steps: ['멸치 덖기: 대형 웍에 센 불로 덖는다.', '뒤집개로 쉬지 않고 계속 덖는다 (약간 탄 것 같을 정도까지).', '※ 반드시 목장갑 착용! 매우 뜨거움.', '청양고추: 씻어 물기 빼고, 가위로 반 자른 뒤 믹서기로 간다.', '양념 볶기: 웍에 양념을 넣고 중강불로 녹인 후, 멸치와 깨를 넣는다.', '다진 청양고추를 넣고 센 불에서 볶는다.', '팬 가운데에 물이 끓으면 소주를 한 바퀴 둘러 마무리.'],
    },
    {
        id: 9, file: null, name: '불고기', category: 'meat', emoji: '🥩',
        ingredients: ['설탕 60g (평평하게 1주걱)', '소주 50g (평평하게 1주걱)', '불고기 소스 120g (평평하게 2주걱)'],
        steps: ['※ 설탕은 반드시 정량! 너무 달아지지 않도록 주의.', '냄비에 불고기와 재료를 모두 넣는다.', '안·밖 불을 중간으로 맞추고 볶는다.', '불고기가 익으면 불을 크게 올린다 (안-90도, 밖-45도).', '국물이 거의 없어질 때까지 볶는다.', '불을 끄고 한 김 식히며 덖어준 후 잔열로 국물을 날린다.', '적당한 크기로 잘라 담는다.'],
    },
    {
        id: 10, file: null, name: '스팸', category: 'meat', emoji: '🥓',
        ingredients: ['스팸 10통'],
        steps: ['한 번에 10통씩 잘라 중불에서 굽는다.', '※ 바싹 구우면 김밥 전 데울 때 스팸이 마를 수 있으니 주의!'],
    },
    {
        id: 11, file: null, name: '오이 손질', category: 'prep', emoji: '🥒',
        ingredients: ['오이 (큰 바트 1개 분량)'],
        steps: ['오이를 물에 깨끗이 씻는다.', '꼭지를 떼어낸다.', '길면 3등분, 짧으면 2등분한다.', '물기가 빠지도록 바트에 밑받침을 깔아 둔다.'],
    },
    {
        id: 12, file: null, name: '스팸 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '스팸 반 조각 / 1개당 밥 160g'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 스팸 반 조각으로 삼각틀에 성형한다.'],
    },
    {
        id: 13, file: null, name: '순한참치 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '참치 20g / 1개당 밥 160g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 참치 20g으로 삼각틀에 성형한다.'],
    },
    {
        id: 14, file: null, name: '매콤참치 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,600g', '후리가케 50g', '참기름 16g', '참치 20g / 1개당 밥 160g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 160g + 매콤 참치 20g으로 삼각틀에 성형한다.'],
    },
    {
        id: 15, file: null, name: '불고기 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,710g', '후리가케 54g', '참기름 17g', '불고기 9g / 1개당 밥 171g (총 180g)'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 171g + 불고기 9g으로 삼각틀에 성형한다.'],
    },
    {
        id: 16, file: null, name: '멸치 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,740g', '후리가케 55g', '참기름 17g', '멸치 6g / 1개당 밥 174g'],
        steps: ['밥에 후리가케와 참기름을 넣고 골고루 섞는다.', '1개당 밥 174g + 멸치 6g으로 삼각틀에 성형한다.'],
    },
    {
        id: 17, file: null, name: '햄치즈 주먹밥', category: 'onigiri', emoji: '🍙',
        ingredients: ['밥 1,650g', '후리가케 52g', '참기름 16g', '햄 반 줄 / 치즈 반 개 / 1개당 밥 165g'],
        steps: ['햄을 약 3mm 두께로 썰어 밥에 섞는다.', '밥 165g의 1/3을 삼각틀에 깐다.', '그 위에 치즈 1/4을 올린다.', '나머지 밥 2/3를 올려 삼각틀로 완성한다.', '삼각틀에서 뺀 후 평평한 면에 치즈 1/4을 올린다.', '평평한 쪽에 김가루를 묻힌다.', '비닐 포장지에 넣고 삼각 주먹밥 라벨을 붙인다.'],
    },
];

const CATEGORIES = [
    { key: 'all', label: '전체', emoji: '📖' },
    { key: 'banchan', label: '반찬/조림', emoji: '🥘' },
    { key: 'tuna', label: '참치', emoji: '🐟' },
    { key: 'sauce', label: '소스/양념', emoji: '🍳' },
    { key: 'sushi', label: '초밥', emoji: '🍣' },
    { key: 'meat', label: '고기', emoji: '🥩' },
    { key: 'prep', label: '손질', emoji: '🥒' },
    { key: 'onigiri', label: '주먹밥', emoji: '🍙' },
];

const CATEGORY_LABEL = {
    banchan: '반찬/조림', tuna: '참치', sauce: '소스/양념',
    sushi: '초밥', meat: '고기', prep: '손질', onigiri: '주먹밥',
};

const CATEGORY_COLORS = {
    banchan: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
    tuna: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-400' },
    sauce: { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-400' },
    sushi: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
    meat: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-400' },
    prep: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
    onigiri: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-400' },
};

export default function RecipeBook() {
    const navigate = useNavigate();
    const [activeCategory, setActiveCategory] = useState('all');
    const [detail, setDetail] = useState(null);
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let list = activeCategory === 'all'
            ? RECIPES
            : RECIPES.filter(r => r.category === activeCategory);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.ingredients.some(ing => ing.toLowerCase().includes(q))
            );
        }
        return list;
    }, [activeCategory, search]);

    const categoryCounts = useMemo(() => {
        const counts = { all: RECIPES.length };
        CATEGORIES.forEach(c => {
            if (c.key !== 'all') counts[c.key] = RECIPES.filter(r => r.category === c.key).length;
        });
        return counts;
    }, []);

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
                            레시피 북
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5 ml-0.5">
                            총 {RECIPES.length}개의 레시피
                        </p>
                    </div>
                </div>
            </div>

            {/* ── Search Bar ── */}
            <div className="max-w-5xl mx-auto px-6 py-3">
                <div className="flex items-center gap-2.5 bg-white rounded-xl px-4 py-2.5 border border-slate-200 focus-within:border-orange-300 focus-within:ring-2 focus-within:ring-orange-100 transition-all shadow-sm">
                    <Search size={16} className="text-slate-300 flex-shrink-0" />
                    <input
                        type="text"
                        placeholder="레시피 또는 재료 검색..."
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

            {/* ── Category Tabs ── */}
            <div className="max-w-5xl mx-auto px-6 pb-2">
                <div className="flex flex-wrap gap-1.5">
                    {CATEGORIES.map(cat => (
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
                            const colors = CATEGORY_COLORS[r.category];
                            return (
                                <div
                                    key={r.id}
                                    onClick={() => setDetail(r)}
                                    className="group bg-white rounded-2xl shadow-sm border border-slate-100
                                               hover:shadow-lg hover:border-slate-200 hover:-translate-y-0.5
                                               cursor-pointer transition-all duration-200 overflow-hidden card-animate"
                                    style={{ animationDelay: `${idx * 0.04}s` }}
                                >
                                    {/* Card Top — Emoji Hero */}
                                    {r.file ? (
                                        <img
                                            src={`/recipes/${r.file}`}
                                            alt={r.name}
                                            loading="lazy"
                                            className="w-full aspect-square object-cover"
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
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <h3 className="text-sm font-bold text-slate-800 leading-snug m-0">
                                                {r.name}
                                            </h3>
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap flex-shrink-0 ${colors.bg} ${colors.text} ${colors.border} border`}>
                                                {CATEGORY_LABEL[r.category]}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <Flame size={11} className="text-orange-300" />
                                                재료 {r.ingredients.length}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <ListOrdered size={11} className="text-slate-300" />
                                                {r.steps.length}단계
                                            </span>
                                        </div>
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
                                        <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-md mt-0.5 ${CATEGORY_COLORS[detail.category].bg} ${CATEGORY_COLORS[detail.category].text}`}>
                                            {CATEGORY_LABEL[detail.category]}
                                        </span>
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

                            {/* Steps */}
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
                                    {/* Timeline line */}
                                    <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200" />

                                    <div className="space-y-0">
                                        {detail.steps.map((s, i) => {
                                            const isWarning = s.startsWith('※');
                                            return (
                                                <div
                                                    key={i}
                                                    className={`relative flex items-start gap-3 py-3 pl-0 pr-1 ${isWarning ? '' : ''}`}
                                                >
                                                    {/* Step number / warning dot */}
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
                        </div>

                        {/* Bottom safe area */}
                        <div className="h-10" />
                    </div>
                </div>
            )}
        </div>
    );
}
