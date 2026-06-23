import { CreditCard, Building2, Users, FileText, IdCard, Store, Bike, Wallet, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Phase 1~5 외부연동 모듈 그리드.
 * Phase 1: 카드 매출 (활성)
 * Phase 2~5: placeholder (준비중)
 */

const MODULES = [
    {
        id: 'cards',
        title: '카드 매출',
        provider: 'CODEF',
        icon: CreditCard,
        color: 'blue',
        active: true,
        href: '/external-integration/cards',
        description: '14개 카드사 사업자 매출 자동수집',
    },
    {
        id: 'popbill-bank',
        title: '팝빌 계좌연동 (메인)',
        provider: 'POPBILL',
        icon: Landmark,
        color: 'indigo',
        active: true,
        href: '/finance/bank-sync',
        description: '팝빌 이지펀뱅크 정액제 — 등록 계좌 입출금 자동수집 (메인 조회수단)',
    },
    {
        id: 'banks',
        title: 'CODEF 계좌연동 (보조)',
        provider: 'CODEF',
        icon: Building2,
        color: 'blue',
        active: true,
        href: '/external-integration/banks',
        description: 'CODEF 마이데이터 — 보조 수단 (정액제 한도·과거내역 보강용)',
    },
    {
        id: 'card-purchase',
        title: '카드 매입',
        provider: 'CODEF',
        icon: Wallet,
        color: 'violet',
        active: true,
        href: '/external-integration/card-purchase',
        description: '사장님 사용카드 매입내역 자동수집 (신한·삼성·현대 등)',
    },
    {
        id: 'easypos',
        title: 'POS 매출',
        provider: 'KICC 이지포스',
        icon: Store,
        color: 'emerald',
        active: true,
        href: '/external-integration/easypos',
        description: '이지포스 영수증 단위 매출 야간 자동수집',
    },
    {
        id: 'coupang-eats',
        title: '쿠팡이츠 매출',
        provider: '배달앱 자동수집',
        icon: Bike,
        color: 'orange',
        active: true,
        href: '/external-integration/coupang-eats',
        description: 'Playwright + curl_cffi 로 주문/정산 야간 자동수집 (Akamai 우회)',
    },
    {
        id: 'baemin',
        title: '배민 매출',
        provider: '배달앱 자동수집',
        icon: Bike,
        color: 'orange',
        active: true,
        href: '/external-integration/baemin',
        description: '배달의민족 셀프서비스 주문/정산 야간 자동수집',
    },
    {
        id: 'insurance',
        title: '4대보험',
        provider: 'CODEF',
        icon: Users,
        color: 'slate',
        active: false,
        phase: 'Phase 3',
        description: '직원 자격득실 + 두루누리 지원금 자동',
    },
    {
        id: 'taxinvoice',
        title: '전자세금계산서',
        provider: '팝빌 / CODEF',
        icon: FileText,
        color: 'slate',
        active: false,
        phase: 'Phase 4',
        description: '발행 + 수집 (양쪽 출처 비교)',
    },
    {
        id: 'identity',
        title: '신분증 OCR',
        provider: 'CODEF',
        icon: IdCard,
        color: 'slate',
        active: false,
        phase: 'Phase 5',
        description: '직원 입사 시 자동 인식 + 진위확인',
    },
];

function ModuleCard({ module, stats }) {
    const Icon = module.icon;

    if (!module.active) {
        return (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 opacity-70">
                <div className="flex items-center justify-between mb-3">
                    <Icon className="w-7 h-7 text-slate-400" />
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        {module.phase} 준비중
                    </span>
                </div>
                <h3 className="text-base font-semibold text-slate-700 mb-1">{module.title}</h3>
                <p className="text-xs text-slate-500 mb-3">{module.provider}</p>
                <p className="text-sm text-slate-500">{module.description}</p>
            </div>
        );
    }

    const colorMap = {
        emerald: {
            border: 'border-emerald-200 hover:border-emerald-400',
            icon: 'text-emerald-600',
            badge: 'bg-emerald-50 text-emerald-700',
            link: 'text-emerald-600',
        },
        orange: {
            border: 'border-orange-200 hover:border-orange-400',
            icon: 'text-orange-600',
            badge: 'bg-orange-50 text-orange-700',
            link: 'text-orange-600',
        },
        blue: {
            border: 'border-blue-200 hover:border-blue-400',
            icon: 'text-blue-600',
            badge: 'bg-blue-50 text-blue-700',
            link: 'text-blue-600',
        },
        violet: {
            border: 'border-violet-200 hover:border-violet-400',
            icon: 'text-violet-600',
            badge: 'bg-violet-50 text-violet-700',
            link: 'text-violet-600',
        },
        indigo: {
            border: 'border-indigo-200 hover:border-indigo-400',
            icon: 'text-indigo-600',
            badge: 'bg-indigo-50 text-indigo-700',
            link: 'text-indigo-600',
        },
    };
    const c = colorMap[module.color] || colorMap.blue;
    const borderCls = c.border;
    const iconCls = c.icon;
    const badgeCls = c.badge;
    const linkCls = c.link;

    return (
        <Link
            to={module.href}
            className={`block bg-white border ${borderCls} rounded-xl p-5 hover:shadow-sm transition-all`}
        >
            <div className="flex items-center justify-between mb-3">
                <Icon className={`w-7 h-7 ${iconCls}`} />
                <span className={`text-xs px-2 py-0.5 rounded-full ${badgeCls}`}>
                    {module.provider}
                </span>
            </div>
            <h3 className="text-base font-semibold text-slate-800 mb-1">{module.title}</h3>
            <p className="text-sm text-slate-500 mb-3">{module.description}</p>
            {stats && module.id === 'cards' && (
                <div className="text-sm">
                    <div className="flex justify-between text-slate-700">
                        <span>등록 카드사</span>
                        <span className="font-semibold">
                            {stats.activeCount}/{stats.totalCount}
                        </span>
                    </div>
                    {stats.failedCount > 0 && (
                        <div className="mt-1 text-xs text-amber-700">
                            ⚠ {stats.failedCount}개 재인증 필요
                        </div>
                    )}
                </div>
            )}
            {stats && module.id === 'popbill-bank' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>등록 계좌</span>
                        <span className="font-semibold">{stats.accountCount}개</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                        <span>이번 달 거래</span>
                        <span className="font-semibold">{stats.txCount?.toLocaleString() || 0}건</span>
                    </div>
                </div>
            )}
            {stats && module.id === 'banks' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>CODEF 연결</span>
                        <span className="font-semibold">{stats.codefActiveCount || 0}건</span>
                    </div>
                    <div className="text-xs text-slate-400">보조 — 평소엔 팝빌이 자동수집</div>
                </div>
            )}
            {stats && module.id === 'easypos' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>자격증명</span>
                        <span className="font-semibold">
                            {stats.registered ? '✓ 등록됨' : '— 미등록'}
                        </span>
                    </div>
                    {stats.lastVerifiedAt && (
                        <div className="text-xs text-emerald-700">
                            ✓ 마지막 인증 {stats.lastVerifiedAt.slice(0, 10)}
                        </div>
                    )}
                    {stats.status === 'failed' && (
                        <div className="text-xs text-amber-700">
                            ⚠ 인증 실패 — 재로그인 필요
                        </div>
                    )}
                </div>
            )}
            {stats && module.id === 'coupang-eats' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>자격증명</span>
                        <span className="font-semibold">
                            {stats.registered
                                ? (stats.loginMethod === 'auto' ? '🤖 자동' : '✋ 수동')
                                : '— 미등록'}
                        </span>
                    </div>
                    {stats.shopName && (
                        <div className="text-xs text-slate-600 truncate">
                            🏪 {stats.shopName}
                        </div>
                    )}
                    {stats.registered && stats.cookiesPresent && stats.lastVerifiedAt && (
                        <div className="text-xs text-orange-700">
                            ✓ 마지막 인증 {stats.lastVerifiedAt.slice(0, 10)}
                        </div>
                    )}
                    {stats.registered && !stats.cookiesPresent && (
                        <div className="text-xs text-amber-700">
                            ⚠ 쿠키 없음 — 로그인 필요
                        </div>
                    )}
                    {stats.status === 'cookie_invalid' && (
                        <div className="text-xs text-red-700">
                            ✗ 쿠키 만료/차단
                        </div>
                    )}
                </div>
            )}
            {stats && module.id === 'card-purchase' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>등록 카드사</span>
                        <span className="font-semibold">
                            {stats.activeCount}/{stats.totalCount}
                        </span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                        <span>이번 달 매입</span>
                        <span className="font-semibold">
                            {(stats.monthCount || 0).toLocaleString()}건
                        </span>
                    </div>
                    {stats.failedCount > 0 && (
                        <div className="mt-1 text-xs text-amber-700">
                            ⚠ {stats.failedCount}개 재인증 필요
                        </div>
                    )}
                </div>
            )}
            {stats && module.id === 'baemin' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>자격증명</span>
                        <span className="font-semibold">
                            {stats.registered ? '✓ 등록됨' : '— 미등록'}
                        </span>
                    </div>
                    {stats.shopName && (
                        <div className="text-xs text-slate-600 truncate">
                            🏪 {stats.shopName}
                        </div>
                    )}
                    {stats.registered && stats.cookiesPresent && stats.lastVerifiedAt && (
                        <div className="text-xs text-orange-700">
                            ✓ 마지막 인증 {stats.lastVerifiedAt.slice(0, 10)}
                        </div>
                    )}
                    {stats.registered && !stats.cookiesPresent && (
                        <div className="text-xs text-amber-700">
                            ⚠ 쿠키 없음 — 로그인 필요
                        </div>
                    )}
                    {stats.status === 'cookie_invalid' && (
                        <div className="text-xs text-red-700">
                            ✗ 쿠키 만료/차단
                        </div>
                    )}
                </div>
            )}
            <div className={`mt-3 ${linkCls} text-sm font-medium`}>관리 →</div>
        </Link>
    );
}

export default function ModuleGrid({
    cardStats,
    bankStats,
    easyposStats,
    coupangEatsStats,
    baeminStats,
    cardPurchaseStats,
}) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => (
                <ModuleCard
                    key={m.id}
                    module={m}
                    stats={
                        m.id === 'cards' ? cardStats :
                        m.id === 'banks' ? bankStats :
                        m.id === 'popbill-bank' ? bankStats :
                        m.id === 'easypos' ? easyposStats :
                        m.id === 'coupang-eats' ? coupangEatsStats :
                        m.id === 'baemin' ? baeminStats :
                        m.id === 'card-purchase' ? cardPurchaseStats : null
                    }
                />
            ))}
        </div>
    );
}
