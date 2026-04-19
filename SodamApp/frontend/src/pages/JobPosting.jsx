import { useState, useMemo } from 'react';
import {
    Briefcase, ExternalLink, Filter, Search, Star, Sparkles,
    CheckCircle2, AlertCircle, TrendingUp, Users, MapPin, Globe,
    Wallet, Crown, Coffee, Factory, Monitor, Award, Info, Banknote
} from 'lucide-react';

const CATEGORIES = [
    { key: 'all', label: '전체', color: 'bg-slate-600' },
    { key: 'gov', label: '정부·무료', color: 'bg-emerald-600' },
    { key: 'alba', label: '알바·단기', color: 'bg-orange-500' },
    { key: 'general', label: '정규·경력', color: 'bg-blue-600' },
    { key: 'it', label: 'IT·스타트업', color: 'bg-indigo-600' },
    { key: 'foreign', label: '외국인·글로벌', color: 'bg-cyan-600' },
    { key: 'local', label: '지역·동네', color: 'bg-pink-500' },
];

const SCENARIO_RECOMMENDATIONS = [
    {
        icon: Coffee,
        title: '요식업·카페·편의점 알바',
        platforms: ['알바몬', '알바천국', '당근알바', '워크넷'],
        tip: '동네 단골 구직자는 당근알바가 매칭률이 높고, 학생·단기 구직자는 알바몬·알바천국이 노출 규모 큼',
        color: 'from-orange-500 to-amber-500',
    },
    {
        icon: Factory,
        title: '제조업·물류·생산직',
        platforms: ['워크넷', '사람인', '잡코리아', '벼룩시장'],
        tip: '고용장려금 연계가 필요하면 워크넷 필수 등록, 지역 채용은 벼룩시장·벼룩시장 지역판이 효과적',
        color: 'from-slate-600 to-slate-700',
    },
    {
        icon: Briefcase,
        title: '사무·관리직·경력 채용',
        platforms: ['사람인', '잡코리아', '인크루트', '잡플래닛'],
        tip: '경력 이력서 DB가 가장 큰 2곳(사람인·잡코리아)에 우선 공고, 기업리뷰 영향이 크면 잡플래닛 병행',
        color: 'from-blue-600 to-indigo-600',
    },
    {
        icon: Monitor,
        title: 'IT·개발자·디자이너',
        platforms: ['원티드', '잡플래닛', '리멤버 커리어', '링크드인'],
        tip: '원티드는 채용 성공 시 과금이라 초기 비용 부담이 적고, 경력직 스카우트는 리멤버·링크드인이 효과적',
        color: 'from-indigo-600 to-purple-600',
    },
    {
        icon: Globe,
        title: '외국인 근로자 (E-9 비자 등)',
        platforms: ['EPS 고용허가제', 'HI KOREA', '워크넷 외국인채용', '링크드인'],
        tip: 'E-9(비전문)은 반드시 고용허가제(EPS)를 통해야 함. 전문인력(E-7)은 HI KOREA·링크드인 활용',
        color: 'from-cyan-600 to-teal-600',
    },
];

const PLATFORMS = [
    // 정부 / 무료
    {
        name: '워크넷',
        operator: '고용노동부 · 한국고용정보원',
        category: 'gov',
        url: 'https://www.work.go.kr/',
        summary: '정부 공식 구인·구직 포털. 모든 고용장려금(청년·고령자·장애인 등)과 연계 필수.',
        strengths: ['완전 무료', '고용장려금 연계 필수', '전 업종 커버', '지역·업종별 검색 체계적'],
        weaknesses: ['노출·UX가 민간 대비 약함', '알바 지원자는 상대적으로 적음'],
        priceBasic: '무료',
        priceAd: '무료 (전 상품)',
        bestFor: '고용장려금 수혜 예정, 장기 정규직, 제조·생산·기술직',
        badge: '정부 공식',
        badgeColor: 'bg-emerald-500',
        logoText: 'W',
        logoColor: 'from-emerald-500 to-teal-600',
        rating: 5,
    },
    {
        name: 'EPS 고용허가제',
        operator: '고용노동부 · 한국산업인력공단',
        category: 'foreign',
        url: 'https://www.eps.go.kr/',
        summary: 'E-9 비자(비전문 외국인) 고용의 유일한 합법 채널. 내국인 구인 노력 후 신청 가능.',
        strengths: ['E-9 비자 합법 고용 유일 경로', '정부 지원 완전 무료', '언어별 지원자 풀'],
        weaknesses: ['내국인 구인 노력(7~14일) 선행 필수', '신청 → 배정까지 2~3개월'],
        priceBasic: '무료',
        priceAd: '무료',
        bestFor: '제조·농축산·어업·건설·서비스업 (E-9 허용 업종)',
        badge: '외국인 전용',
        badgeColor: 'bg-cyan-500',
        logoText: 'E',
        logoColor: 'from-cyan-500 to-blue-600',
        rating: 5,
    },
    {
        name: 'HI KOREA',
        operator: '법무부 출입국·외국인정책본부',
        category: 'foreign',
        url: 'https://www.hikorea.go.kr/',
        summary: '외국인 체류·비자 통합 포털. E-7(전문직)·유학생 취업 등 고급 외국인력 채용 시 참고.',
        strengths: ['비자별 취업 가이드 제공', '정부 공식', '체류자격 확인 원스톱'],
        weaknesses: ['직접 공고는 없음 (가이드/신고 중심)'],
        priceBasic: '무료',
        priceAd: '무료',
        bestFor: 'E-7 전문인력, 유학생(D-2/D-10) 채용',
        badge: '정부 공식',
        badgeColor: 'bg-cyan-600',
        logoText: 'H',
        logoColor: 'from-cyan-600 to-sky-700',
        rating: 4,
    },

    // 알바·단기
    {
        name: '알바몬',
        operator: '(주)사람인 그룹',
        category: 'alba',
        url: 'https://www.albamon.com/',
        summary: '국내 최대 알바 전문 플랫폼. 브랜드별(프랜차이즈) 검색 강점.',
        strengths: ['알바 지원자 규모 1위권', '프랜차이즈 단위 공고 관리', '앱 UX 우수'],
        weaknesses: ['상단 노출은 유료 필수', '경쟁 업체 노출 과밀'],
        priceBasic: '일반 공고 무료',
        priceAd: '파워업 3만원~ / 브랜드관 월 단위',
        bestFor: '요식업·카페·편의점·서비스업 단기/장기 알바',
        badge: '알바 1위',
        badgeColor: 'bg-orange-500',
        logoText: 'A',
        logoColor: 'from-orange-500 to-red-500',
        rating: 5,
    },
    {
        name: '알바천국',
        operator: '알바천국',
        category: 'alba',
        url: 'https://www.alba.co.kr/',
        summary: '알바몬과 양강 체제. 동네 알바·아르바이트 지역 기반 탐색 강점.',
        strengths: ['알바몬과 양대 산맥', '지역 기반 매칭 우수', '무료 기본 공고 충분'],
        weaknesses: ['프리미엄 상품 가격 편차 큼'],
        priceBasic: '일반 공고 무료',
        priceAd: '프리미엄 3~15만원 / 주목공고',
        bestFor: '서비스·유통·음식점 알바, 지역 밀착 채용',
        badge: '알바 양강',
        badgeColor: 'bg-orange-500',
        logoText: 'A',
        logoColor: 'from-amber-500 to-orange-600',
        rating: 5,
    },
    {
        name: '당근알바',
        operator: '(주)당근마켓',
        category: 'local',
        url: 'https://www.daangn.com/kr/jobs/',
        summary: '동네 생활권 기반 알바. 소상공인과 지역 주민의 매칭률이 높음.',
        strengths: ['완전 무료', '당근마켓 트래픽 활용', '지역 주민 신뢰도 높음'],
        weaknesses: ['지역 외 노출 제한', '대규모 모집은 부적합'],
        priceBasic: '무료',
        priceAd: '무료 (지역광고 별도)',
        bestFor: '동네 식당·카페·미용실·편의점 소규모 채용',
        badge: '지역 특화',
        badgeColor: 'bg-pink-500',
        logoText: '당',
        logoColor: 'from-orange-400 to-pink-500',
        rating: 5,
    },
    {
        name: '벼룩시장 구인구직',
        operator: '(주)미디어윌',
        category: 'local',
        url: 'https://www.findall.co.kr/',
        summary: '오프라인 생활정보지 기반. 중장년층·지역 공고 접근성 높음.',
        strengths: ['오프라인·온라인 병행', '중장년 구직자 접근성', '지역 단위 공고'],
        weaknesses: ['젊은 층 유입 적음', '플랫폼 현대화 아쉬움'],
        priceBasic: '온라인 무료',
        priceAd: '지면광고 별도 (지역별 상이)',
        bestFor: '중장년 채용, 지방·읍면 지역 소상공인',
        badge: '전통 지역',
        badgeColor: 'bg-pink-600',
        logoText: '벼',
        logoColor: 'from-red-400 to-pink-600',
        rating: 3,
    },

    // 정규 / 경력
    {
        name: '사람인',
        operator: '(주)사람인',
        category: 'general',
        url: 'https://www.saramin.co.kr/',
        summary: '국내 최대 종합 채용 플랫폼. 이력서 DB와 AI 추천 매칭 강점.',
        strengths: ['이력서 DB 업계 1위급', 'AI 매칭·분석 도구', '전 업종·직무 커버'],
        weaknesses: ['프리미엄 공고 가격대 높음', '알바 영역은 알바몬 이관'],
        priceBasic: '일반 공고 무료',
        priceAd: 'SS급 30만원대~ / 브랜드관 월 100만원~',
        bestFor: '정규직·경력직·사무/관리/전문직 채용',
        badge: '종합 1위',
        badgeColor: 'bg-blue-600',
        logoText: 'S',
        logoColor: 'from-blue-500 to-cyan-600',
        rating: 5,
    },
    {
        name: '잡코리아',
        operator: '(주)잡코리아',
        category: 'general',
        url: 'https://www.jobkorea.co.kr/',
        summary: '사람인과 함께 종합 채용 양강. 경력직·대기업 선호 DB 강세.',
        strengths: ['경력직 DB 우수', '연봉 정보·기업분석 자료', '앱·웹 안정'],
        weaknesses: ['프리미엄 상품 가격대 높음'],
        priceBasic: '일반 공고 무료',
        priceAd: 'HOT 공고 20만원대~ / 브랜드관 월 단위',
        bestFor: '정규직·경력직·중견 이상 제조/IT/금융',
        badge: '종합 양강',
        badgeColor: 'bg-blue-600',
        logoText: 'J',
        logoColor: 'from-sky-500 to-blue-600',
        rating: 5,
    },
    {
        name: '인크루트',
        operator: '(주)인크루트',
        category: 'general',
        url: 'https://www.incruit.com/',
        summary: '종합 채용 3위권. 공기업·대기업·인턴 채용 정보 풍부.',
        strengths: ['공기업·인턴 채용 강세', '채용 뉴스·컨설팅', '중견기업 DB'],
        weaknesses: ['알바/소상공인 영역은 약함'],
        priceBasic: '일반 공고 무료',
        priceAd: '프리미엄 10만원대~',
        bestFor: '사무직·공기업 연계·인턴·신입 채용',
        badge: '종합',
        badgeColor: 'bg-blue-500',
        logoText: 'I',
        logoColor: 'from-indigo-500 to-blue-600',
        rating: 4,
    },

    // IT / 경력 스카우트
    {
        name: '원티드',
        operator: '(주)원티드랩',
        category: 'it',
        url: 'https://www.wanted.co.kr/',
        summary: 'IT·스타트업 중심 AI 매칭. 채용 성공 시 과금(CPS) 구조로 초기 비용 부담 낮음.',
        strengths: ['IT·디자인·마케팅 인재풀', '성공 시 과금(합격자 연봉의 7% 내외)', '지인 추천 보상'],
        weaknesses: ['요식업·단순업무 지원자 적음', '경력직 위주'],
        priceBasic: '공고 등록 무료',
        priceAd: '합격 시 채용보상금 (연봉의 7% 전후)',
        bestFor: 'IT·디자인·마케팅 경력직, 스타트업',
        badge: 'IT 특화',
        badgeColor: 'bg-indigo-600',
        logoText: 'W',
        logoColor: 'from-violet-500 to-indigo-600',
        rating: 5,
    },
    {
        name: '잡플래닛',
        operator: '(주)브레인커머스',
        category: 'it',
        url: 'https://www.jobplanet.co.kr/',
        summary: '기업 리뷰·연봉 정보 1위. 채용 공고 연동으로 지원 품질 상승.',
        strengths: ['기업리뷰·연봉 노출로 신뢰도↑', '인재 유치에 브랜딩 효과'],
        weaknesses: ['리뷰가 좋지 않으면 오히려 역효과', '소상공인 노출 제한적'],
        priceBasic: '기본 공고 무료',
        priceAd: '프리미엄 브랜드 월 단위',
        bestFor: '기업 브랜딩 중요한 중견기업·IT',
        badge: '리뷰 기반',
        badgeColor: 'bg-indigo-500',
        logoText: 'J',
        logoColor: 'from-purple-500 to-indigo-600',
        rating: 4,
    },
    {
        name: '리멤버 커리어',
        operator: '(주)드라마앤컴퍼니',
        category: 'it',
        url: 'https://career.rememberapp.co.kr/',
        summary: '명함 기반 경력직 스카우트. 리멤버 회원 DB에 직접 제안 발송.',
        strengths: ['경력직 프로필 DB 우수', '즉시 스카우트 제안', '대기업·중견 재직자 다수'],
        weaknesses: ['신입·알바 부적합', '스카우트 상품 단가 높음'],
        priceBasic: '공고 기본 무료',
        priceAd: '스카우트 상품 월 50~200만원대',
        bestFor: '경력직 헤드헌팅·IT·재무·영업 스카우트',
        badge: '스카우트',
        badgeColor: 'bg-indigo-700',
        logoText: 'R',
        logoColor: 'from-blue-600 to-indigo-700',
        rating: 4,
    },
    {
        name: '링크드인 (LinkedIn)',
        operator: 'LinkedIn Corp.',
        category: 'foreign',
        url: 'https://www.linkedin.com/jobs/',
        summary: '글로벌 전문직 네트워크. 외국인·해외 경력·IT 전문가 채용에 강점.',
        strengths: ['글로벌 인재풀', '영어권·외국인 접근성', '기업 페이지 브랜딩'],
        weaknesses: ['국내 알바·블루컬러 거의 없음', '유료 상품 달러 과금'],
        priceBasic: '공고 등록 무료 (노출 제한)',
        priceAd: 'Job Slot 월 $200~ / 인재검색 Recruiter $900~',
        bestFor: '외국인·해외파·IT·글로벌 포지션',
        badge: '글로벌',
        badgeColor: 'bg-sky-700',
        logoText: 'in',
        logoColor: 'from-sky-600 to-blue-700',
        rating: 4,
    },
    {
        name: '커리어',
        operator: '(주)커리어',
        category: 'general',
        url: 'https://www.career.co.kr/',
        summary: '오랜 역사의 중견 종합 채용. 이공계·제조·연구직 DB가 장점.',
        strengths: ['이공계·연구직 인재풀', '중견·제조업 고객사 보유'],
        weaknesses: ['플랫폼 트래픽은 상대적으로 적음'],
        priceBasic: '공고 기본 무료',
        priceAd: '프리미엄 5~20만원대',
        bestFor: '이공계·제조·연구직 채용',
        badge: '이공계',
        badgeColor: 'bg-blue-500',
        logoText: 'C',
        logoColor: 'from-blue-500 to-indigo-500',
        rating: 3,
    },
];

const QUICK_STATS = [
    { label: '등록된 플랫폼', value: PLATFORMS.length, icon: Briefcase, color: 'bg-indigo-100 text-indigo-600' },
    { label: '무료 플랫폼', value: PLATFORMS.filter(p => p.priceBasic === '무료').length, icon: Sparkles, color: 'bg-emerald-100 text-emerald-600' },
    { label: '정부 공식', value: PLATFORMS.filter(p => p.category === 'gov' || p.operator.includes('고용노동부') || p.operator.includes('법무부')).length, icon: Award, color: 'bg-blue-100 text-blue-600' },
    { label: '외국인 채용', value: PLATFORMS.filter(p => p.category === 'foreign').length, icon: Globe, color: 'bg-cyan-100 text-cyan-600' },
];

export default function JobPosting() {
    const [category, setCategory] = useState('all');
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState('rating');

    const filtered = useMemo(() => {
        let list = PLATFORMS.filter(p =>
            (category === 'all' || p.category === category) &&
            (search.trim() === '' ||
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.operator.toLowerCase().includes(search.toLowerCase()) ||
                p.summary.toLowerCase().includes(search.toLowerCase()))
        );
        if (sortBy === 'rating') list = [...list].sort((a, b) => b.rating - a.rating);
        if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        if (sortBy === 'price') list = [...list].sort((a, b) => (a.priceBasic === '무료' ? -1 : 1) - (b.priceBasic === '무료' ? -1 : 1));
        return list;
    }, [category, search, sortBy]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-blue-50/10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Briefcase size={22} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900">구인등록 플랫폼 가이드</h1>
                        <p className="text-xs text-slate-500 mt-0.5">국내 주요 구인 플랫폼을 한 눈에 비교하고, 업종·규모에 맞게 선택하세요.</p>
                    </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {QUICK_STATS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.color}`}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <div className="text-[11px] font-bold text-slate-400">{s.label}</div>
                                    <div className="text-xl font-black text-slate-900">{s.value}<span className="text-xs text-slate-400 ml-0.5">개</span></div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Scenario recommendations */}
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900">업종·시나리오별 추천 조합</h3>
                            <p className="text-[11px] text-slate-400">사업 형태에 맞는 플랫폼 2~4곳을 동시에 활용하세요.</p>
                        </div>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {SCENARIO_RECOMMENDATIONS.map((s, i) => {
                            const Icon = s.icon;
                            return (
                                <div key={i} className="rounded-xl border border-slate-100 overflow-hidden hover:shadow-md transition-all">
                                    <div className={`px-4 py-3 bg-gradient-to-r ${s.color} flex items-center gap-2`}>
                                        <Icon size={18} className="text-white" />
                                        <h4 className="text-sm font-bold text-white">{s.title}</h4>
                                    </div>
                                    <div className="p-4 bg-white">
                                        <div className="flex flex-wrap gap-1.5 mb-2.5">
                                            {s.platforms.map((p, j) => (
                                                <span key={j} className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                    {p}
                                                </span>
                                            ))}
                                        </div>
                                        <p className="text-[12px] text-slate-600 leading-relaxed">{s.tip}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Filters */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Filter size={14} className="text-slate-400" />
                        <span className="text-xs font-bold text-slate-500 mr-1">카테고리</span>
                        {CATEGORIES.map(c => (
                            <button
                                key={c.key}
                                onClick={() => setCategory(c.key)}
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${
                                    category === c.key
                                        ? `${c.color} border-transparent text-white shadow-sm`
                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px] relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="플랫폼명·운영사·설명 검색"
                                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                            />
                        </div>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200"
                        >
                            <option value="rating">추천순</option>
                            <option value="name">이름순</option>
                            <option value="price">무료 우선</option>
                        </select>
                    </div>
                </div>

                {/* Comparison Table */}
                <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                        <TrendingUp size={16} className="text-indigo-500" />
                        <h3 className="text-sm font-black text-slate-900">비용·특징 비교표</h3>
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md ml-auto">{filtered.length}개</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px]">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="text-left px-4 py-2.5 text-[11px] font-bold text-slate-500">플랫폼</th>
                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">카테고리</th>
                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">기본 비용</th>
                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">유료 상품</th>
                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">추천 대상</th>
                                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500">추천도</th>
                                    <th className="text-center px-4 py-2.5 text-[11px] font-bold text-slate-500">바로가기</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map((p, i) => {
                                    const catLabel = CATEGORIES.find(c => c.key === p.category)?.label || '-';
                                    return (
                                        <tr key={i} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${p.logoColor} flex items-center justify-center flex-shrink-0`}>
                                                        <span className="text-white text-[11px] font-black">{p.logoText}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-900">{p.name}</div>
                                                        <div className="text-[10px] text-slate-400 truncate">{p.operator}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-md ${p.badgeColor}`}>{p.badge}</span>
                                                <div className="text-[10px] text-slate-400 mt-0.5">{catLabel}</div>
                                            </td>
                                            <td className="px-3 py-3">
                                                <span className={`text-xs font-bold ${p.priceBasic === '무료' ? 'text-emerald-600' : 'text-slate-700'}`}>
                                                    {p.priceBasic}
                                                </span>
                                            </td>
                                            <td className="px-3 py-3 text-[11px] text-slate-600">{p.priceAd}</td>
                                            <td className="px-3 py-3 text-[11px] text-slate-600 max-w-[220px]">{p.bestFor}</td>
                                            <td className="px-3 py-3 text-center">
                                                <div className="inline-flex items-center gap-0.5">
                                                    {[...Array(5)].map((_, k) => (
                                                        <Star key={k} size={11} className={k < p.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <a
                                                    href={p.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                                                >
                                                    방문 <ExternalLink size={10} />
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-10 text-center text-xs text-slate-400">
                                            조건에 맞는 플랫폼이 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Detail Cards */}
                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={14} className="text-slate-500" />
                        <h3 className="text-sm font-black text-slate-900">플랫폼 상세 정보</h3>
                        <span className="text-[11px] text-slate-400">각 플랫폼의 강점·약점을 확인하고 2~3곳을 조합해 활용하세요.</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((p, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-indigo-200 transition-all">
                                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.logoColor} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                        <span className="text-white text-base font-black">{p.logoText}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <h4 className="text-base font-black text-slate-900 truncate">{p.name}</h4>
                                            <span className={`text-[10px] font-bold text-white px-1.5 py-0.5 rounded ${p.badgeColor}`}>{p.badge}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate">{p.operator}</p>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0">
                                        {[...Array(5)].map((_, k) => (
                                            <Star key={k} size={12} className={k < p.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                                        ))}
                                    </div>
                                </div>
                                <div className="p-5 space-y-3">
                                    <p className="text-[12px] text-slate-600 leading-relaxed">{p.summary}</p>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5">
                                            <div className="flex items-center gap-1 mb-1">
                                                <Wallet size={11} className="text-emerald-600" />
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">기본</span>
                                            </div>
                                            <div className="text-[12px] font-bold text-emerald-800">{p.priceBasic}</div>
                                        </div>
                                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-lg p-2.5">
                                            <div className="flex items-center gap-1 mb-1">
                                                <Crown size={11} className="text-indigo-600" />
                                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide">유료</span>
                                            </div>
                                            <div className="text-[11px] font-bold text-indigo-800 leading-tight">{p.priceAd}</div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                            <CheckCircle2 size={11} className="text-emerald-500" /> 강점
                                        </div>
                                        <ul className="space-y-1">
                                            {p.strengths.map((s, j) => (
                                                <li key={j} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                                    <span className="text-emerald-500 mt-0.5">•</span>
                                                    <span>{s}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                                            <AlertCircle size={11} className="text-amber-500" /> 약점·유의
                                        </div>
                                        <ul className="space-y-1">
                                            {p.weaknesses.map((w, j) => (
                                                <li key={j} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                                                    <span className="text-amber-500 mt-0.5">•</span>
                                                    <span>{w}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                                            <Users size={11} /> 추천 대상
                                        </div>
                                        <div className="text-[11px] text-slate-700 leading-relaxed">{p.bestFor}</div>
                                    </div>

                                    <a
                                        href={p.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-sm font-bold py-2.5 rounded-xl transition-all shadow-sm"
                                    >
                                        공식 사이트에서 등록하기 <ExternalLink size={13} />
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Footer note */}
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <Banknote size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-[12px] text-amber-900 leading-relaxed">
                        <div className="font-bold mb-1">비용은 시점·상품에 따라 변동될 수 있습니다</div>
                        <p className="text-amber-800">
                            위 가격은 최근 공개된 상품 기준 참고용이며, 업종·지역·상품 조합에 따라 차이가 있습니다.
                            정확한 금액은 각 플랫폼의 "기업회원 광고상품" 페이지에서 확인하고,
                            <strong> 워크넷 + 알바몬/알바천국 + 당근알바</strong> 조합(모두 무료)만으로도 많은 소상공인은 충분히 채용이 가능합니다.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
