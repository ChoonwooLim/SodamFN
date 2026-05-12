import { CreditCard, Building2, Users, FileText, IdCard } from 'lucide-react';
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
        id: 'banks',
        title: '계좌 거래내역',
        provider: 'CODEF',
        icon: Building2,
        color: 'blue',
        active: true,
        href: '/external-integration/banks',
        description: '20+ 은행 입출금 자동수집 (CODEF 마이데이터)',
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

    return (
        <Link
            to={module.href}
            className="block bg-white border border-blue-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-sm transition-all"
        >
            <div className="flex items-center justify-between mb-3">
                <Icon className="w-7 h-7 text-blue-600" />
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
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
            {stats && module.id === 'banks' && (
                <div className="text-sm space-y-1">
                    <div className="flex justify-between text-slate-700">
                        <span>등록 계좌</span>
                        <span className="font-semibold">{stats.accountCount}개</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                        <span>이번 달 거래</span>
                        <span className="font-semibold">{stats.txCount?.toLocaleString() || 0}건</span>
                    </div>
                    {stats.codefActiveCount > 0 && (
                        <div className="text-xs text-emerald-700">
                            ✓ CODEF 연결 {stats.codefActiveCount}건 활성
                        </div>
                    )}
                </div>
            )}
            <div className="mt-3 text-blue-600 text-sm font-medium">관리 →</div>
        </Link>
    );
}

export default function ModuleGrid({ cardStats, bankStats }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {MODULES.map((m) => (
                <ModuleCard
                    key={m.id}
                    module={m}
                    stats={m.id === 'cards' ? cardStats : m.id === 'banks' ? bankStats : null}
                />
            ))}
        </div>
    );
}
