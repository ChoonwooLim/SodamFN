import { useState, useEffect } from 'react';
import { Palette, Layers, Type, Sparkles, Monitor, Smartphone, ChevronRight, Check, Clock, AlertCircle, Star, Zap, Eye, Grid3X3, MousePointer2, Sun, Moon, Paintbrush, Layout, Box, ArrowRight, Trophy, Target, Gem, Crown } from 'lucide-react';

const phases = [
    {
        id: 1,
        title: 'Foundation',
        subtitle: '디자인 시스템 구축',
        icon: Layers,
        color: 'from-violet-600 to-indigo-600',
        accent: 'violet',
        status: 'planned',
        duration: '1주',
        items: [
            {
                title: '디자인 토큰 체계 수립',
                desc: 'Color, Spacing, Typography, Shadow, Border Radius 토큰을 체계적으로 정의하여 일관된 디자인 언어를 구축합니다.',
                tags: ['Colors', 'Spacing', 'Shadows'],
                priority: 'critical',
            },
            {
                title: '타이포그래피 스케일 정비',
                desc: '제목·본문·캡션 간 시각적 위계를 명확히 하고, Pretendard 폰트의 weight 체계를 최적화합니다.',
                tags: ['Font Scale', 'Line Height', 'Letter Spacing'],
                priority: 'critical',
            },
            {
                title: '색상 팔레트 업그레이드',
                desc: '현재 Slate 기반 팔레트를 유지하면서 Brand Color를 정립하고, Semantic Color (Success/Warning/Error/Info) 체계를 강화합니다.',
                tags: ['Brand Color', 'Semantic', 'Dark Mode Ready'],
                priority: 'high',
            },
            {
                title: '아이콘 시스템 통일',
                desc: 'Lucide 아이콘의 사이즈·스트로크 두께를 통일하고, 카테고리별 아이콘 매핑 가이드를 작성합니다.',
                tags: ['Icon Size', 'Stroke Width', 'Consistency'],
                priority: 'medium',
            },
        ],
    },
    {
        id: 2,
        title: 'Components',
        subtitle: '핵심 컴포넌트 리디자인',
        icon: Box,
        color: 'from-blue-600 to-cyan-500',
        accent: 'blue',
        status: 'planned',
        duration: '2주',
        items: [
            {
                title: '카드 컴포넌트 프리미엄화',
                desc: '미묘한 그라디언트 보더, 호버 시 입체감 있는 elevation 변화, 유리모핑(glassmorphism) 효과를 적용합니다.',
                tags: ['Glassmorphism', 'Elevation', 'Hover Effect'],
                priority: 'critical',
            },
            {
                title: '버튼 시스템 재설계',
                desc: 'Primary/Secondary/Ghost/Danger 버튼 변형을 정의하고, 클릭 피드백 애니메이션과 로딩 상태를 추가합니다.',
                tags: ['Variants', 'Animation', 'States'],
                priority: 'high',
            },
            {
                title: '입력 폼 고급화',
                desc: 'Floating Label, 포커스 시 부드러운 트랜지션, 인라인 밸리데이션 애니메이션을 적용합니다.',
                tags: ['Floating Label', 'Validation UX', 'Focus Ring'],
                priority: 'high',
            },
            {
                title: '데이터 테이블 현대화',
                desc: '고정 헤더, 행 호버 하이라이트, 정렬 인터랙션, 스켈레톤 로딩을 적용한 프리미엄 테이블을 구현합니다.',
                tags: ['Sticky Header', 'Sortable', 'Skeleton'],
                priority: 'high',
            },
            {
                title: '모달 & 다이얼로그 업그레이드',
                desc: 'Backdrop blur, 진입/퇴장 애니메이션, 드래그 가능 바텀시트(모바일) 등 고급 인터랙션을 추가합니다.',
                tags: ['Bottom Sheet', 'Backdrop Blur', 'Transition'],
                priority: 'medium',
            },
        ],
    },
    {
        id: 3,
        title: 'Navigation',
        subtitle: '네비게이션 & 레이아웃',
        icon: Layout,
        color: 'from-emerald-500 to-teal-500',
        accent: 'emerald',
        status: 'planned',
        duration: '1주',
        items: [
            {
                title: '사이드바 프리미엄 리디자인',
                desc: '미묘한 그라디언트 배경, 아이콘 활성 시 글로우 효과, 부드러운 토글 애니메이션, 접힌 상태(아이콘 모드) 지원을 추가합니다.',
                tags: ['Glow Effect', 'Collapse Mode', 'Smooth Toggle'],
                priority: 'critical',
            },
            {
                title: '페이지 트랜지션 고도화',
                desc: '페이지 전환 시 부드러운 Fade+Slide 애니메이션, 스켈레톤 로딩 상태를 일관되게 적용합니다.',
                tags: ['Page Transition', 'Skeleton Loading', 'Smooth'],
                priority: 'high',
            },
            {
                title: '브레드크럼 & 페이지 헤더 통합',
                desc: '현재 위치를 알려주는 브레드크럼과 액션 버튼을 포함한 통일된 페이지 헤더 컴포넌트를 만듭니다.',
                tags: ['Breadcrumb', 'Page Header', 'Actions'],
                priority: 'medium',
            },
        ],
    },
    {
        id: 4,
        title: 'Pages',
        subtitle: '핵심 페이지 리디자인',
        icon: Monitor,
        color: 'from-amber-500 to-orange-500',
        accent: 'amber',
        status: 'planned',
        duration: '3주',
        items: [
            {
                title: '대시보드 완전 리디자인',
                desc: '글래스모핑 KPI 카드, 인터랙티브 차트, 실시간 데이터 애니메이션, 그리드 레이아웃 최적화를 적용합니다.',
                tags: ['KPI Cards', 'Charts', 'Real-time', 'Grid'],
                priority: 'critical',
            },
            {
                title: '손익관리 페이지 리디자인',
                desc: '손익계산서·매출·매입 페이지의 데이터 시각화를 강화하고, 차트 인터랙션과 필터 UX를 개선합니다.',
                tags: ['Data Viz', 'Charts', 'Filter UX'],
                priority: 'critical',
            },
            {
                title: '직원관리 페이지 리디자인',
                desc: '직원 카드형 목록, 프로필 상세 페이지 레이아웃, 서류 관리 UX를 프리미엄급으로 개선합니다.',
                tags: ['Profile Card', 'Detail Layout', 'Documents'],
                priority: 'high',
            },
            {
                title: '설정 페이지 모던화',
                desc: '탭 기반 설정을 섹션 기반으로 재구성하고, 토글 스위치·슬라이더 등 인터랙티브 컨트롤을 적용합니다.',
                tags: ['Settings UX', 'Toggle', 'Sections'],
                priority: 'medium',
            },
            {
                title: '로그인/회원가입 리디자인',
                desc: '브랜드 아이덴티티를 강화한 풀페이지 로그인 화면, 부드러운 폼 트랜지션을 구현합니다.',
                tags: ['Brand Identity', 'Full Page', 'Form UX'],
                priority: 'high',
            },
        ],
    },
    {
        id: 5,
        title: 'Motion',
        subtitle: '모션 & 마이크로인터랙션',
        icon: Sparkles,
        color: 'from-pink-500 to-rose-500',
        accent: 'pink',
        status: 'planned',
        duration: '1주',
        items: [
            {
                title: '마이크로인터랙션 라이브러리',
                desc: '버튼 클릭 ripple, 토글 스위치 바운스, 카드 호버 틸트, 숫자 카운트업 등 디테일 인터랙션을 통일합니다.',
                tags: ['Ripple', 'Bounce', 'Tilt', 'Count-up'],
                priority: 'high',
            },
            {
                title: '스크롤 기반 애니메이션',
                desc: 'Intersection Observer를 활용한 스크롤 진입 애니메이션, 패럴랙스 효과를 주요 페이지에 적용합니다.',
                tags: ['Scroll Reveal', 'Parallax', 'Stagger'],
                priority: 'medium',
            },
            {
                title: '로딩 & 상태 전환 애니메이션',
                desc: '스켈레톤 시머, 성공/실패 피드백 애니메이션, 프로그레스 인디케이터를 통일된 모션 언어로 구현합니다.',
                tags: ['Skeleton', 'Success/Error', 'Progress'],
                priority: 'high',
            },
        ],
    },
    {
        id: 6,
        title: 'Polish',
        subtitle: '최종 마감 & QA',
        icon: Gem,
        color: 'from-slate-600 to-slate-800',
        accent: 'slate',
        status: 'planned',
        duration: '1주',
        items: [
            {
                title: '반응형 완벽 검수',
                desc: '모바일·태블릿·데스크톱 전 해상도에서 레이아웃, 터치 영역, 폰트 사이즈를 검증합니다.',
                tags: ['Mobile', 'Tablet', 'Desktop'],
                priority: 'critical',
            },
            {
                title: '접근성(A11y) 강화',
                desc: 'WCAG 2.1 AA 기준 색상 대비, 키보드 네비게이션, 스크린 리더 지원을 점검합니다.',
                tags: ['Contrast', 'Keyboard Nav', 'ARIA'],
                priority: 'high',
            },
            {
                title: '퍼포먼스 최적화',
                desc: '불필요한 리렌더링 제거, 이미지 최적화, 번들 사이즈 분석 및 코드 스플리팅을 강화합니다.',
                tags: ['Re-render', 'Image Opt', 'Bundle Size'],
                priority: 'high',
            },
            {
                title: '다크모드 기반 마련',
                desc: 'CSS 변수 기반 테마 토큰을 정리하여 향후 다크모드 전환이 가능한 구조를 마련합니다.',
                tags: ['CSS Variables', 'Theme Token', 'Future Ready'],
                priority: 'medium',
            },
        ],
    },
];

const designPrinciples = [
    { icon: Eye, title: '명확한 위계', desc: '시각적 중요도가 한눈에 파악되는 정보 구조', color: 'from-blue-500 to-indigo-500' },
    { icon: MousePointer2, title: '직관적 인터랙션', desc: '터치 한 번에 원하는 결과에 도달하는 UX', color: 'from-emerald-500 to-teal-500' },
    { icon: Sparkles, title: '의미 있는 모션', desc: '장식이 아닌 맥락을 전달하는 애니메이션', color: 'from-amber-500 to-orange-500' },
    { icon: Grid3X3, title: '일관된 시스템', desc: '모든 페이지에서 동일한 디자인 언어 사용', color: 'from-violet-500 to-purple-500' },
];

const beforeAfter = [
    { area: '카드 디자인', before: '단순 흰색 배경 + 얇은 보더', after: '미묘한 그라디언트 + 글래스모핑 + 호버 elevation' },
    { area: '컬러 시스템', before: '제한된 Slate 팔레트', after: '브랜드 컬러 + Semantic 컬러 + 그라디언트 액센트' },
    { area: '타이포그래피', before: '불규칙한 사이즈/웨이트', after: '체계적 Type Scale + 최적화된 줄간격' },
    { area: '인터랙션', before: '기본 hover 색상 변경', after: 'Ripple, Tilt, Glow, Bounce 마이크로인터랙션' },
    { area: '데이터 시각화', before: '기본 Recharts 스타일', after: '커스텀 그라디언트 차트 + 인터랙티브 툴팁' },
    { area: '로딩 상태', before: '단순 스피너', after: '스켈레톤 시머 + 프로그레시브 콘텐츠 로드' },
];

const priorityConfig = {
    critical: { label: 'P0', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
    high: { label: 'P1', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    medium: { label: 'P2', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

const statusConfig = {
    planned: { label: '예정', icon: Clock, color: 'text-slate-400' },
    in_progress: { label: '진행중', icon: Zap, color: 'text-amber-400' },
    completed: { label: '완료', icon: Check, color: 'text-emerald-400' },
};

export default function DesignPlan() {
    const [activePhase, setActivePhase] = useState(null);
    const [hoveredPrinciple, setHoveredPrinciple] = useState(null);
    const [visibleSections, setVisibleSections] = useState(new Set());

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setVisibleSections(prev => new Set([...prev, entry.target.id]));
                    }
                });
            },
            { threshold: 0.1 }
        );

        document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
        return () => observer.disconnect();
    }, []);

    const totalItems = phases.reduce((sum, p) => sum + p.items.length, 0);
    const criticalCount = phases.reduce((sum, p) => sum + p.items.filter(i => i.priority === 'critical').length, 0);

    return (
        <div className="min-h-screen bg-slate-50">
            {/* ═══ HERO SECTION ═══ */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900" />
                <div className="absolute inset-0 opacity-30" style={{
                    backgroundImage: `radial-gradient(circle at 20% 50%, rgba(99,102,241,0.3) 0%, transparent 50%),
                                      radial-gradient(circle at 80% 20%, rgba(168,85,247,0.2) 0%, transparent 50%),
                                      radial-gradient(circle at 50% 80%, rgba(59,130,246,0.2) 0%, transparent 50%)`,
                }} />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-5" style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }} />

                <div className="relative max-w-5xl mx-auto px-6 pt-12 pb-16">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                            <Crown size={14} className="text-amber-400" />
                            <span className="text-xs font-semibold text-amber-300 tracking-wider uppercase">Design Overhaul</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                            <span className="text-xs font-medium text-slate-300">v2.0</span>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight">
                        셈하나 디자인
                        <br />
                        <span className="bg-gradient-to-r from-blue-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
                            대폭 개선 계획서
                        </span>
                    </h1>
                    <p className="text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
                        세계 최고 수준의 하이엔드 SaaS 디자인으로 셈하나를 혁신합니다.
                        <br />
                        체계적인 디자인 시스템부터 마이크로인터랙션까지, 6단계 로드맵.
                    </p>

                    {/* KPI Summary */}
                    <div className="flex flex-wrap gap-4">
                        {[
                            { label: '총 작업 항목', value: `${totalItems}건`, icon: Target },
                            { label: '핵심(P0) 항목', value: `${criticalCount}건`, icon: AlertCircle },
                            { label: '총 소요 기간', value: '9주', icon: Clock },
                            { label: '목표 수준', value: 'World-Class', icon: Trophy },
                        ].map((kpi, i) => (
                            <div
                                key={i}
                                className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 transition-all duration-300"
                            >
                                <kpi.icon size={18} className="text-slate-400" />
                                <div>
                                    <div className="text-xs text-slate-400 font-medium">{kpi.label}</div>
                                    <div className="text-lg font-bold text-white">{kpi.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-10 space-y-16 pb-32">

                {/* ═══ DESIGN PRINCIPLES ═══ */}
                <section id="principles" data-animate>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-indigo-500 to-violet-500" />
                        <h2 className="text-2xl font-black text-slate-900">디자인 원칙</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {designPrinciples.map((p, i) => {
                            const Icon = p.icon;
                            return (
                                <div
                                    key={i}
                                    className="group relative overflow-hidden rounded-2xl bg-white border border-slate-100 p-6 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 hover:-translate-y-1 card-animate"
                                    style={{ animationDelay: `${i * 0.08}s` }}
                                    onMouseEnter={() => setHoveredPrinciple(i)}
                                    onMouseLeave={() => setHoveredPrinciple(null)}
                                >
                                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${p.color} transform transition-transform duration-500 ${hoveredPrinciple === i ? 'scale-x-100' : 'scale-x-0'} origin-left`} />
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center shadow-lg`}>
                                            <Icon size={22} className="text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-bold text-slate-900 mb-1">{p.title}</h3>
                                            <p className="text-sm text-slate-500 leading-relaxed">{p.desc}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ BEFORE / AFTER ═══ */}
                <section id="comparison" data-animate>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-rose-500 to-pink-500" />
                        <h2 className="text-2xl font-black text-slate-900">Before → After</h2>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="grid grid-cols-[1fr_1fr_1fr] gap-0 text-xs font-bold text-slate-400 uppercase tracking-wider px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                            <span>영역</span>
                            <span>현재 (Before)</span>
                            <span>개선 후 (After)</span>
                        </div>
                        {beforeAfter.map((item, i) => (
                            <div
                                key={i}
                                className={`grid grid-cols-[1fr_1fr_1fr] gap-0 px-6 py-4 items-center transition-colors hover:bg-slate-50/80 ${i !== beforeAfter.length - 1 ? 'border-b border-slate-50' : ''}`}
                            >
                                <span className="font-bold text-sm text-slate-800">{item.area}</span>
                                <span className="text-sm text-slate-400">{item.before}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-emerald-600 font-medium">{item.after}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ═══ PHASE TIMELINE ═══ */}
                <section id="roadmap" data-animate>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                        <h2 className="text-2xl font-black text-slate-900">6단계 로드맵</h2>
                    </div>

                    {/* Timeline Track */}
                    <div className="flex items-center gap-0 mb-10 overflow-x-auto pb-2 hide-scrollbar">
                        {phases.map((phase, i) => {
                            const Icon = phase.icon;
                            const isActive = activePhase === phase.id;
                            return (
                                <div key={phase.id} className="flex items-center">
                                    <button
                                        onClick={() => setActivePhase(isActive ? null : phase.id)}
                                        className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                                            isActive
                                                ? `bg-gradient-to-r ${phase.color} text-white shadow-lg`
                                                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-md'
                                        }`}
                                    >
                                        <Icon size={16} />
                                        <span className="text-sm font-bold whitespace-nowrap">{phase.title}</span>
                                        <span className={`text-xs px-1.5 py-0.5 rounded-md ${isActive ? 'bg-white/20' : 'bg-slate-100'}`}>
                                            {phase.duration}
                                        </span>
                                    </button>
                                    {i < phases.length - 1 && (
                                        <ChevronRight size={16} className="text-slate-300 mx-1 flex-shrink-0" />
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Phase Cards */}
                    <div className="space-y-6">
                        {phases.map((phase, phaseIdx) => {
                            const PhaseIcon = phase.icon;
                            const StatusIcon = statusConfig[phase.status].icon;
                            const isExpanded = activePhase === phase.id || activePhase === null;

                            return (
                                <div
                                    key={phase.id}
                                    className={`card-animate transition-all duration-500 ${isExpanded ? 'opacity-100' : 'opacity-40 scale-[0.98]'}`}
                                    style={{ animationDelay: `${phaseIdx * 0.06}s` }}
                                >
                                    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden hover:shadow-lg hover:shadow-slate-100 transition-all duration-500">
                                        {/* Phase Header */}
                                        <div
                                            className="flex items-center gap-4 px-6 py-5 cursor-pointer"
                                            onClick={() => setActivePhase(activePhase === phase.id ? null : phase.id)}
                                        >
                                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${phase.color} flex items-center justify-center shadow-lg`}>
                                                <PhaseIcon size={22} className="text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-0.5">
                                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phase {phase.id}</span>
                                                    <span className="text-xs text-slate-300">·</span>
                                                    <span className="text-xs text-slate-400">{phase.duration}</span>
                                                </div>
                                                <h3 className="text-lg font-bold text-slate-900">{phase.title} — {phase.subtitle}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <StatusIcon size={16} className={statusConfig[phase.status].color} />
                                                <span className={`text-xs font-medium ${statusConfig[phase.status].color}`}>
                                                    {statusConfig[phase.status].label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Phase Items */}
                                        {isExpanded && (
                                            <div className="px-6 pb-6">
                                                <div className="space-y-3">
                                                    {phase.items.map((item, j) => (
                                                        <div
                                                            key={j}
                                                            className="group relative rounded-xl border border-slate-100 p-4 hover:border-slate-200 hover:bg-slate-50/50 transition-all duration-300"
                                                        >
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-0.5 w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 group-hover:bg-slate-200 transition-colors">
                                                                    {j + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 mb-1.5">
                                                                        <h4 className="font-bold text-sm text-slate-800">{item.title}</h4>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityConfig[item.priority].color}`}>
                                                                            {priorityConfig[item.priority].label}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 leading-relaxed mb-2.5">{item.desc}</p>
                                                                    <div className="flex flex-wrap gap-1.5">
                                                                        {item.tags.map((tag, k) => (
                                                                            <span
                                                                                key={k}
                                                                                className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-500"
                                                                            >
                                                                                {tag}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* ═══ DESIGN VISION ═══ */}
                <section id="vision" data-animate>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-amber-500 to-orange-500" />
                        <h2 className="text-2xl font-black text-slate-900">디자인 비전</h2>
                    </div>
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 md:p-12">
                        <div className="absolute inset-0 opacity-20" style={{
                            backgroundImage: `radial-gradient(circle at 30% 40%, rgba(168,85,247,0.4) 0%, transparent 50%),
                                              radial-gradient(circle at 70% 60%, rgba(59,130,246,0.3) 0%, transparent 50%)`,
                        }} />
                        <div className="relative">
                            <div className="flex items-center gap-2 mb-6">
                                <Star size={20} className="text-amber-400" />
                                <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">Our Vision</span>
                            </div>
                            <blockquote className="text-2xl md:text-3xl font-black text-white leading-snug mb-6">
                                "40~50대 자영업자도 한 번에 이해하고,
                                <br />
                                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                                    20대 디자이너도 감탄하는
                                </span>
                                <br />
                                세계 최고 수준의 비즈니스 앱"
                            </blockquote>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {[
                                    { icon: Eye, title: '직관성', desc: 'IT 비숙련자도 5초 안에 사용법을 파악', gradient: 'from-blue-500/20 to-cyan-500/20' },
                                    { icon: Gem, title: '프리미엄감', desc: 'Apple·Linear·Vercel 수준의 디테일', gradient: 'from-violet-500/20 to-purple-500/20' },
                                    { icon: Zap, title: '퍼포먼스', desc: '60fps 인터랙션, 즉각적 피드백', gradient: 'from-amber-500/20 to-orange-500/20' },
                                ].map((v, i) => (
                                    <div
                                        key={i}
                                        className={`rounded-xl bg-gradient-to-br ${v.gradient} backdrop-blur-sm border border-white/10 p-5 hover:border-white/20 transition-all duration-300`}
                                    >
                                        <v.icon size={20} className="text-white mb-3" />
                                        <h4 className="font-bold text-white mb-1">{v.title}</h4>
                                        <p className="text-sm text-slate-300">{v.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ═══ TECH STACK ═══ */}
                <section id="stack" data-animate>
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-1 h-8 rounded-full bg-gradient-to-b from-cyan-500 to-blue-500" />
                        <h2 className="text-2xl font-black text-slate-900">기술 스택 & 도구</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { title: '스타일링', items: ['Tailwind CSS 4.x', 'CSS Variables (테마 토큰)', 'Framer Motion (선택적)'], icon: Paintbrush, color: 'from-pink-500 to-rose-500' },
                            { title: '컴포넌트', items: ['Headless UI (접근성)', 'Recharts (차트 커스텀)', 'Lucide Icons (통일)'], icon: Box, color: 'from-blue-500 to-indigo-500' },
                            { title: '타이포그래피', items: ['Pretendard Variable', '8pt Grid System', 'Fluid Type Scale'], icon: Type, color: 'from-violet-500 to-purple-500' },
                            { title: '퍼포먼스', items: ['React.lazy + Suspense', 'Intersection Observer', 'Image Optimization'], icon: Zap, color: 'from-amber-500 to-orange-500' },
                        ].map((stack, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 hover:shadow-lg hover:shadow-slate-100 transition-all duration-500 card-animate" style={{ animationDelay: `${i * 0.08}s` }}>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stack.color} flex items-center justify-center`}>
                                        <stack.icon size={18} className="text-white" />
                                    </div>
                                    <h3 className="font-bold text-slate-900">{stack.title}</h3>
                                </div>
                                <ul className="space-y-2">
                                    {stack.items.map((item, j) => (
                                        <li key={j} className="flex items-center gap-2 text-sm text-slate-600">
                                            <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
