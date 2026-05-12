import { useState, useEffect } from 'react';
import { Link2 } from 'lucide-react';
import api from '../api';
import BudgetSummaryCard from '../components/codef/BudgetSummaryCard';
import ModuleGrid from '../components/codef/ModuleGrid';
import BudgetSettingsModal from '../components/codef/BudgetSettingsModal';

/**
 * 외부 데이터 연동 hub 페이지.
 *
 * /external-integration
 *   - 이달 호출량/비용 요약
 *   - 5개 모듈 그리드 (Phase 1: 카드 활성, Phase 2~5 placeholder)
 */
export default function ExternalIntegration() {
    const [budget, setBudget] = useState(null);
    const [cardStats, setCardStats] = useState({ activeCount: 0, totalCount: 0, failedCount: 0 });
    const [bankStats, setBankStats] = useState({ accountCount: 0, txCount: 0, codefActiveCount: 0 });
    const [budgetModalOpen, setBudgetModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const fetchAll = async () => {
        setLoading(true);
        setErr('');
        try {
            // 이번 달 시작일 (거래 통계용)
            const today = new Date();
            const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

            const [budgetRes, cardConnRes, bankAccountsRes, bankTxRes, bankConnRes] = await Promise.all([
                api.get('/codef/budget/current'),
                api.get('/codef/connections', { params: { type: 'card' } }),
                api.get('/bank-sync/accounts').catch(() => ({ data: [] })),
                api.get('/bank-sync/transactions', {
                    params: { start_date: monthStart, limit: 1 },
                }).catch(() => ({ data: { total: 0 } })),
                api.get('/codef/connections', { params: { type: 'bank' } }).catch(() => ({ data: { connections: [] } })),
            ]);
            setBudget(budgetRes.data);
            const cardConns = cardConnRes.data.connections || [];
            setCardStats({
                activeCount: cardConns.filter((c) => c.status === 'active').length,
                totalCount: cardConns.length,
                failedCount: cardConns.filter((c) => c.status !== 'active' && c.status !== 'deactivated').length,
            });
            const bankConns = bankConnRes.data.connections || [];
            setBankStats({
                accountCount: Array.isArray(bankAccountsRes.data) ? bankAccountsRes.data.length : 0,
                txCount: bankTxRes.data?.total || 0,
                codefActiveCount: bankConns.filter((c) => c.status === 'active').length,
            });
        } catch (e) {
            setErr(e.response?.data?.detail || '데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
    }, []);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <Link2 className="w-7 h-7 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">외부 데이터 연동</h1>
                            <p className="text-sm text-slate-500 mt-0.5">
                                팝빌 + CODEF 마이데이터 통합 — 카드 매출, 계좌, 4대보험 등 자동 수집
                            </p>
                        </div>
                    </div>
                </header>

                {err && (
                    <div className="mb-6 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        {err}
                    </div>
                )}

                <div className="mb-8">
                    <BudgetSummaryCard
                        summary={budget}
                        onOpenSettings={() => setBudgetModalOpen(true)}
                    />
                </div>

                <h2 className="text-lg font-semibold text-slate-800 mb-4">통합 모듈</h2>
                <ModuleGrid cardStats={cardStats} bankStats={bankStats} />

                <BudgetSettingsModal
                    isOpen={budgetModalOpen}
                    onClose={() => setBudgetModalOpen(false)}
                    currentSettings={budget?.settings}
                    isDemoEnv={budget?.env === 'demo'}
                    onSaved={fetchAll}
                />
            </div>
        </div>
    );
}
