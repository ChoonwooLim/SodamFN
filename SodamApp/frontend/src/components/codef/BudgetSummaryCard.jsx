import { useState } from 'react';
import { Settings, AlertCircle } from 'lucide-react';

/**
 * 이달 호출량 + 비용 요약 카드.
 *
 * props:
 *   summary: GET /api/codef/budget/current 응답 (total_calls, total_cost_krw,
 *            settings, env, demo_daily_limit, by_organization)
 *   onOpenSettings: () => void  (BudgetSettingsModal 트리거)
 */
export default function BudgetSummaryCard({ summary, onOpenSettings }) {
    if (!summary) {
        return (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500">
                예산 정보를 불러오는 중...
            </div>
        );
    }

    const isDemo = summary.env === 'demo';
    const budget = summary.settings?.monthly_budget_krw || 0;
    const cost = summary.total_cost_krw || 0;
    const calls = summary.total_calls || 0;
    const dailyLimit = summary.demo_daily_limit;

    const budgetPct = budget > 0 ? Math.min(100, (cost / budget) * 100) : 0;
    const dailyPct = isDemo && dailyLimit ? Math.min(100, (calls / dailyLimit) * 100) : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-start justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">이달 사용량</h2>
                <button
                    onClick={onOpenSettings}
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700"
                >
                    <Settings className="w-4 h-4" />
                    예산 설정
                </button>
            </div>

            {isDemo && (
                <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>
                        <strong>DEMO 환경</strong> — 비용은 0원이며 일별 {dailyLimit}회 한도가 적용됩니다.
                        PRODUCT 전환 후 월 예산이 활성화됩니다.
                    </span>
                </div>
            )}

            {/* 호출 수 */}
            <div className="mb-4">
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-slate-600">호출 수</span>
                    <span className="text-sm tabular-nums text-slate-700">
                        {calls.toLocaleString()}
                        {isDemo && dailyLimit && (
                            <span className="text-slate-400"> / {dailyLimit}/일</span>
                        )}
                    </span>
                </div>
                {isDemo && dailyLimit && (
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full transition-all ${dailyPct > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${dailyPct}%` }}
                        />
                    </div>
                )}
            </div>

            {/* 비용 */}
            <div>
                <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-sm text-slate-600">비용</span>
                    <span className="text-sm tabular-nums text-slate-700">
                        {cost.toLocaleString()}원
                        {budget > 0 && (
                            <span className="text-slate-400"> / {budget.toLocaleString()}원</span>
                        )}
                    </span>
                </div>
                {budget > 0 && (
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                            className={`h-full transition-all ${budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-500' : 'bg-blue-500'}`}
                            style={{ width: `${budgetPct}%` }}
                        />
                    </div>
                )}
                {budget === 0 && !isDemo && (
                    <p className="text-xs text-slate-400">월 예산 미설정 — 무제한</p>
                )}
            </div>
        </div>
    );
}
