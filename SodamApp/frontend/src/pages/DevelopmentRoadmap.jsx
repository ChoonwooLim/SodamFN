import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Rocket, CheckCircle, Clock, Lock, ArrowRight, Zap, Shield, TrendingUp, Users, FileText, CreditCard, Building2, Calculator, BarChart3, Globe } from 'lucide-react';

const phases = [
    {
        id: 1,
        title: 'Phase 1 — 내부 경영관리 고도화',
        subtitle: '현재 → 6개월',
        status: 'active',
        color: 'from-blue-500 to-cyan-500',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        icon: Zap,
        description: '현재 시스템의 급여·매출·매입 관리 기능을 더욱 정확하고 자동화된 수준으로 업그레이드합니다.',
        modules: [
            {
                name: '급여 계산 엔진 정밀화',
                status: 'done',
                items: [
                    { text: '간이세액표 기반 소득세 자동 계산', done: true },
                    { text: '4대보험료 보수월액 자동 산출', done: true },
                    { text: '국민연금 60세 이상 자동 면제', done: true },
                    { text: '두루누리 사회보험 80% 감면 지원', done: true },
                    { text: '세금 대납 (사업주 부담) 기능', done: true },
                    { text: '부양가족/자녀 수 기반 소득세 산정', done: true },
                ],
            },
            {
                name: '손익계산서 자동화',
                status: 'done',
                items: [
                    { text: '인건비·보험료·원천세 자동 분리', done: true },
                    { text: '카드 매출 자동 매칭 (VAN 데이터 연동)', done: true },
                    { text: '매입 PDF 자동 파싱 (은행 거래내역)', done: true },
                    { text: '월별 손익 자동 집계', done: true },
                ],
            },
            {
                name: '연말정산 지원',
                status: 'planned',
                items: [
                    { text: '직원별 연간 소득·세금 현황 조회', done: false },
                    { text: '근로소득원천징수영수증 생성', done: false },
                    { text: '연말정산 간소화 데이터 연동 (PDF 업로드)', done: false },
                    { text: '연말정산 환급/추가납부 자동 계산', done: false },
                ],
            },
        ],
    },
    {
        id: 2,
        title: 'Phase 2 — SaaS 플랫폼 상용화',
        subtitle: '6개월 → 12개월',
        status: 'planned',
        color: 'from-rose-500 to-pink-500',
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
        icon: Globe,
        description: '셈하나를 다른 소규모 사업자들도 사용할 수 있는 SaaS 플랫폼으로 확장합니다.',
        modules: [
            {
                name: '멀티테넌트 아키텍처',
                status: 'done',
                items: [
                    { text: '사업자별 독립 데이터 스토어', done: true },
                    { text: '업종별 맞춤 설정 (음식점, 소매, 서비스업)', done: true },
                    { text: '요금제 및 결제 시스템', done: true },
                    { text: '온보딩 자동화 (가입 → 설정 → 사용)', done: true },
                ],
            },
            {
                name: 'SuperAdmin 대시보드',
                status: 'done',
                items: [
                    { text: '멀티테넌트 매장 등록/해지 관리', done: true },
                    { text: '전체 매장 매출·인건비 실시간 모니터링', done: true },
                    { text: '매장별 요금제 관리 및 이용료 정산', done: true },
                    { text: '3단계 권한 체계 (SuperAdmin → Admin → Staff)', done: true },
                    { text: '매장별 이슈 관리 및 공지사항 일괄 배포', done: true },
                    { text: '업종별·지역별 통계 및 벤치마크 리포트', done: true },
                ],
            },
            {
                name: '외부 서비스 연동',
                status: 'planned',
                items: [
                    { text: '배달앱 (배민, 쿠팡이츠, 요기요) 매출 연동', done: false },
                    { text: 'POS 시스템 실시간 연동', done: false },
                    { text: '온라인 뱅킹 Open API (계좌 조회/이체)', done: false },
                    { text: '세무사/노무사 협업 포털', done: false },
                ],
            },
            {
                name: '모바일 앱 고도화',
                status: 'planned',
                items: [
                    { text: 'React Native 네이티브 앱 (iOS/Android)', done: false },
                    { text: '사장님 전용 앱 (실시간 매출/출퇴근 알림)', done: false },
                    { text: '직원 앱 (급여명세서, 연차신청, 근무일정)', done: false },
                    { text: '오프라인 모드 지원', done: false },
                ],
            },
            {
                name: '모듈형 커스터마이징 엔진',
                status: 'planned',
                items: [
                    { text: '드래그 앤 드롭 모듈 선택기 (매장별 기능 ON/OFF)', done: false },
                    { text: '매출관리·급여·재고·예약 등 독립 모듈 분리', done: false },
                    { text: '매장별 대시보드 레이아웃 커스텀 (위젯 구성)', done: false },
                    { text: '업종별 기본 모듈 프리셋 (음식점/카페/소매/서비스)', done: false },
                    { text: '모듈별 독립 권한 설정 (직원별 접근 제어)', done: false },
                    { text: '커스텀 데이터 필드 추가 (매장별 고유 항목)', done: false },
                ],
            },
            {
                name: '업종별 템플릿 & 마켓플레이스',
                status: 'planned',
                items: [
                    { text: '업종별 스타터 템플릿 (메뉴/상품/서비스 구조)', done: false },
                    { text: '맞춤 보고서 템플릿 (업종별 KPI 대시보드)', done: false },
                    { text: '모듈 마켓플레이스 (서드파티 확장 모듈)', done: false },
                    { text: '매장 간 모듈 설정 복제/공유 기능', done: false },
                    { text: 'API 웹훅 지원 (외부 시스템 연동 자동화)', done: false },
                    { text: '화이트라벨 지원 (브랜드별 로고/테마 변경)', done: false },
                ],
            },
        ],
    },
    {
        id: 3,
        title: 'Phase 3 — 세무 신고 자동화',
        subtitle: '12개월 → 18개월',
        status: 'planned',
        color: 'from-violet-500 to-purple-500',
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
        icon: Calculator,
        description: '홈택스·공단 EDI 연동을 통해 세무사 없이도 기본적인 세무 신고가 가능한 수준으로 업그레이드합니다.',
        modules: [
            {
                name: '원천세 신고 자동화',
                status: 'planned',
                items: [
                    { text: '홈택스 API 연동 (전자신고)', done: false },
                    { text: '원천징수이행상황신고서 자동 생성', done: false },
                    { text: '지급명세서 자동 제출 (근로/사업소득)', done: false },
                    { text: '간이지급명세서 반기별 자동 제출', done: false },
                ],
            },
            {
                name: '4대보험 EDI 연동',
                status: 'planned',
                items: [
                    { text: '직원 4대보험 취득/상실 자동 신고', done: false },
                    { text: '보수월액 변경 신고 (정기결정)', done: false },
                    { text: '두루누리 지원금 자동 신청', done: false },
                    { text: '보험료 고지서 조회 및 자동납부 연동', done: false },
                ],
            },
            {
                name: '부가가치세 신고',
                status: 'planned',
                items: [
                    { text: '전자세금계산서 발행/수취 연동', done: false },
                    { text: '카드 매출/매입 자동 집계', done: false },
                    { text: '부가세 신고서 자동 작성', done: false },
                    { text: '예정/확정 신고 일정 알림', done: false },
                ],
            },
        ],
    },
    {
        id: 4,
        title: 'Phase 4 — 노무 관리 자동화',
        subtitle: '18개월 → 24개월',
        status: 'planned',
        color: 'from-emerald-500 to-teal-500',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        icon: Users,
        description: '근로기준법 준수를 자동으로 체크하고, 노무 분쟁을 예방하는 종합 노무관리 시스템을 구축합니다.',
        modules: [
            {
                name: '근로계약 자동 관리',
                status: 'planned',
                items: [
                    { text: '법정 근로계약서 템플릿 (최신 노동법 반영)', done: false },
                    { text: '계약 만료 자동 알림 및 갱신', done: false },
                    { text: '수습 기간 관리 및 전환 프로세스', done: false },
                    { text: '취업규칙 자동 생성 및 신고', done: false },
                ],
            },
            {
                name: '근태 및 휴가 관리',
                status: 'planned',
                items: [
                    { text: '연차 유급휴가 자동 산정 (입사일 기준)', done: false },
                    { text: '연차 사용 촉진 (법정 절차 자동화)', done: false },
                    { text: '초과근무(OT) 자동 계산 및 수당 산정', done: false },
                    { text: '야간/휴일 근무 가산수당 자동 적용', done: false },
                ],
            },
            {
                name: '퇴직 관리',
                status: 'planned',
                items: [
                    { text: '퇴직금 자동 산정 (3개월 평균임금 기준)', done: false },
                    { text: '퇴직소득세 자동 계산', done: false },
                    { text: '퇴직연금 DC/DB 관리', done: false },
                    { text: '고용보험 피보험자격 상실 자동 신고', done: false },
                ],
            },
            {
                name: '법정 의무 준수 체크',
                status: 'planned',
                items: [
                    { text: '최저임금 위반 자동 경고', done: false },
                    { text: '주 52시간 초과 알림', done: false },
                    { text: '산업안전보건 교육 이수 관리', done: false },
                    { text: '직장 내 괴롭힘 예방교육 일정 관리', done: false },
                ],
            },
        ],
    },
    {
        id: 5,
        title: 'Phase 5 — 재무관리 및 경영분석',
        subtitle: '24개월 → 36개월',
        status: 'planned',
        color: 'from-amber-500 to-orange-500',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        icon: TrendingUp,
        description: '회계 장부 자동 작성, 재무제표 생성, 경영 분석 리포트까지 — 소규모 사업자를 위한 올인원 재무관리 시스템입니다.',
        modules: [
            {
                name: '복식부기 회계 시스템',
                status: 'planned',
                items: [
                    { text: '계정과목 체계 (중소기업 표준)', done: false },
                    { text: '매출/매입 자동 분개 (전표 생성)', done: false },
                    { text: '급여/보험료 자동 분개', done: false },
                    { text: '감가상각 자동 계산', done: false },
                ],
            },
            {
                name: '재무제표 자동 생성',
                status: 'planned',
                items: [
                    { text: '재무상태표 (대차대조표)', done: false },
                    { text: '손익계산서 (법정 서식)', done: false },
                    { text: '현금흐름표', done: false },
                    { text: '세무조정계산서', done: false },
                ],
            },
            {
                name: '경영 분석 대시보드',
                status: 'planned',
                items: [
                    { text: 'AI 기반 매출 예측 (시계열 분석)', done: false },
                    { text: '원가율 분석 및 메뉴별 수익성 분석', done: false },
                    { text: '인건비 비율 최적화 제안', done: false },
                    { text: '동종업계 벤치마크 비교', done: false },
                ],
            },
        ],
    },
];

const techStack = [
    { category: '백엔드', items: ['FastAPI (Python)', 'SQLite → PostgreSQL', 'Redis (캐싱)', 'Celery (비동기 작업)'] },
    { category: '프론트엔드', items: ['React 19 + Vite', 'Tailwind CSS', 'Chart.js / Recharts', 'PWA + React Native'] },
    { category: '인프라', items: ['Docker + Kubernetes', 'AWS / GCP', 'CI/CD (GitHub Actions)', 'SSL + 보안 감사'] },
    { category: '연동 API', items: ['홈택스 (원천세/부가세)', '4대보험 EDI', '금융결제원 (오픈뱅킹)', '카카오 알림톡'] },
];

export default function DevelopmentRoadmap() {
    const navigate = useNavigate();
    const [expandedPhase, setExpandedPhase] = useState(1);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 pb-24">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <header className="mb-8">
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:bg-slate-100">
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900">
                                셈<span className="text-blue-600">하나</span> 개발 로드맵
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">하나로 셈을 끝내다 — 세무·노무·재무 통합 플랫폼</p>
                        </div>
                    </div>

                    {/* Vision Banner */}
                    <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 md:p-8 shadow-xl">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/20 rounded-xl">
                                <Rocket size={28} className="text-blue-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold mb-2">비전: 소규모 사업자를 위한 올인원 경영관리 플랫폼</h2>
                                <p className="text-slate-300 text-sm leading-relaxed">
                                    세무사·노무사 없이도 급여 정산, 세금 신고, 노무 관리, 재무 분석까지 —
                                    <strong>셈하나</strong>가 소규모 사업자의 <strong>경영 파트너</strong>가 되겠습니다.
                                </p>
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {['세무 자동화', '노무 관리', '재무 분석', 'SaaS 플랫폼'].map(tag => (
                                        <span key={tag} className="px-3 py-1 bg-white/10 rounded-full text-xs font-medium">{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Phase Cards */}
                <div className="space-y-4 mb-8">
                    {phases.map((phase) => {
                        const PhaseIcon = phase.icon;
                        const isExpanded = expandedPhase === phase.id;
                        const totalItems = phase.modules.reduce((sum, m) => sum + m.items.length, 0);
                        const doneItems = phase.modules.reduce((sum, m) => sum + m.items.filter(i => i.done).length, 0);
                        const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

                        return (
                            <div key={phase.id} className={`bg-white rounded-2xl shadow-sm border ${phase.borderColor} overflow-hidden transition-all`}>
                                {/* Phase Header */}
                                <button
                                    className="w-full text-left p-5 md:p-6"
                                    onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`p-3 rounded-xl bg-gradient-to-br ${phase.color} text-white shadow-lg`}>
                                            <PhaseIcon size={24} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-slate-900">{phase.title}</h3>
                                                {phase.status === 'active' && (
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold animate-pulse">진행중</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 mt-0.5">{phase.subtitle}</p>
                                        </div>
                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm font-bold text-slate-700">{progress}%</div>
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                                <div className={`h-full rounded-full bg-gradient-to-r ${phase.color}`} style={{ width: `${progress}%` }} />
                                            </div>
                                        </div>
                                        <ArrowRight size={18} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                    </div>
                                </button>

                                {/* Phase Content */}
                                {isExpanded && (
                                    <div className={`px-5 md:px-6 pb-6 ${phase.bgColor} border-t ${phase.borderColor}`}>
                                        <p className="text-sm text-slate-600 py-4">{phase.description}</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {phase.modules.map((mod, mi) => (
                                                <div key={mi} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        {mod.status === 'done' ? (
                                                            <CheckCircle size={16} className="text-emerald-500" />
                                                        ) : mod.status === 'in-progress' ? (
                                                            <Clock size={16} className="text-amber-500" />
                                                        ) : (
                                                            <Lock size={16} className="text-slate-300" />
                                                        )}
                                                        <h4 className="font-bold text-sm text-slate-800">{mod.name}</h4>
                                                    </div>
                                                    <ul className="space-y-1.5">
                                                        {mod.items.map((item, ii) => (
                                                            <li key={ii} className="flex items-start gap-2 text-xs">
                                                                {item.done ? (
                                                                    <CheckCircle size={14} className="text-emerald-500 shrink-0 mt-0.5" />
                                                                ) : (
                                                                    <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 shrink-0 mt-0.5" />
                                                                )}
                                                                <span className={item.done ? 'text-slate-500 line-through' : 'text-slate-700'}>{item.text}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Tech Stack */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Shield size={20} className="text-indigo-500" /> 기술 스택 계획
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {techStack.map((stack) => (
                            <div key={stack.category} className="bg-slate-50 rounded-xl p-4">
                                <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">{stack.category}</h4>
                                <ul className="space-y-1">
                                    {stack.items.map((item, i) => (
                                        <li key={i} className="text-xs text-slate-700 flex items-center gap-1.5">
                                            <div className="w-1 h-1 rounded-full bg-indigo-400" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Timeline Summary */}
                <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl p-6 shadow-xl">
                    <h3 className="text-lg font-bold mb-4">📅 전체 타임라인</h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                        {phases.map((p, i) => (
                            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-center">
                                <div className="text-[10px] font-medium text-white/60 mb-1">{p.subtitle}</div>
                                <div className="text-xs font-bold">{p.title.split('—')[1]?.trim() || p.title}</div>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-white/60 mt-4 text-center">
                        * 각 Phase는 독립적으로 운영 가능하며, 우선순위에 따라 순서 조정 가능
                    </p>
                </div>
            </div>
        </div>
    );
}
