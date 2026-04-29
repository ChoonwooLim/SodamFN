import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../api';

/**
 * 월 예산 + 임계값 설정 모달.
 *
 * props:
 *   isOpen, onClose, currentSettings, onSaved
 */
export default function BudgetSettingsModal({ isOpen, onClose, currentSettings, onSaved, isDemoEnv }) {
    const [budget, setBudget] = useState(0);
    const [warningPct, setWarningPct] = useState(80);
    const [hardLimitPct, setHardLimitPct] = useState(100);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        if (currentSettings) {
            setBudget(currentSettings.monthly_budget_krw || 0);
            setWarningPct(currentSettings.warning_threshold_pct || 80);
            setHardLimitPct(currentSettings.hard_limit_pct || 100);
        }
    }, [currentSettings, isOpen]);

    if (!isOpen) return null;

    const handleSave = async () => {
        setErr('');
        setSaving(true);
        try {
            await api.put('/codef/budget/settings', {
                monthly_budget_krw: Number(budget) || 0,
                warning_threshold_pct: Number(warningPct) || 80,
                hard_limit_pct: Number(hardLimitPct) || 100,
            });
            onSaved?.();
            onClose();
        } catch (e) {
            setErr(e.response?.data?.detail || '저장 실패');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800">월 예산 설정</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    {isDemoEnv && (
                        <div className="text-sm p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                            DEMO 환경에서는 예산 제한이 적용되지 않습니다.
                            PRODUCT 전환 후 자동 활성화됩니다.
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-slate-700 mb-1.5">
                            월 예산 (원)
                        </label>
                        <input
                            type="number"
                            value={budget}
                            onChange={(e) => setBudget(e.target.value)}
                            min={0}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0 = 무제한"
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            0 으로 두면 무제한. 추천: 월 50,000원~100,000원
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-slate-700 mb-1.5">
                                알림 임계값 (%)
                            </label>
                            <input
                                type="number"
                                value={warningPct}
                                onChange={(e) => setWarningPct(e.target.value)}
                                min={1}
                                max={100}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">예산 N% 도달 시 알림톡</p>
                        </div>
                        <div>
                            <label className="block text-sm text-slate-700 mb-1.5">
                                자동 차단 (%)
                            </label>
                            <input
                                type="number"
                                value={hardLimitPct}
                                onChange={(e) => setHardLimitPct(e.target.value)}
                                min={1}
                                max={200}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">예산 N% 도달 시 자동 중지</p>
                        </div>
                    </div>

                    {err && (
                        <div className="text-sm p-2 rounded bg-red-50 text-red-700 border border-red-200">
                            {err}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saving ? '저장 중...' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}
