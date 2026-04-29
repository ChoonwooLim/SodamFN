import { useEffect, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import api from '../../api';

/**
 * 사업주 전용 비공개 지급 정보 탭
 *
 * spec: docs/superpowers/specs/2026-04-30-private-payment-info-design.md
 * - admin/superadmin 만 접근 (백엔드 role gate + StaffDetail/index.jsx 탭 노출 조건)
 * - 명세서·인쇄·외부 전송에는 노출되지 않음 (직렬화 필터 + UI 정책)
 * - 단, 직원 본인 명세서의 '급여 수령 계좌' 행에는 본인 수령 정보가 표시됨
 *   (transfer=본인계좌 / cash="현금 지급" / other_account=타인계좌 노출)
 */
export default function PrivateTab({ staffId }) {
    const [form, setForm] = useState({
        private_payment_method: 'transfer',
        private_actual_payee_name: '',
        private_actual_payee_relation: '',
        private_actual_payee_account: '',
        private_tax_unreported: false,
        private_owner_note: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        if (!staffId) return;
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get(`/hr/staff/${staffId}/private`);
                if (!cancelled && res.data?.status === 'success') {
                    setForm(res.data.data);
                }
            } catch (e) {
                console.error('private load error', e);
                if (!cancelled) setMsg({ type: 'error', text: '불러오기 실패: ' + (e?.response?.data?.detail || e.message) });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [staffId]);

    const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
            await api.put(`/hr/staff/${staffId}/private`, form);
            setMsg({ type: 'ok', text: '저장되었습니다.' });
        } catch (e) {
            console.error(e);
            setMsg({ type: 'error', text: '저장 실패: ' + (e?.response?.data?.detail || e.message) });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-400 text-sm">불러오는 중...</div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
                <Lock size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                    <div className="font-bold">사업주 전용 — 외부 노출 금지</div>
                    <div className="text-amber-700 mt-1 leading-relaxed">
                        이 탭의 내용은 사업주(admin / superadmin)만 열람·수정 가능하며,
                        외부 시스템(팝빌·홈택스·이메일·팩스 등)에 자동 전송되지 않습니다.
                        명세서에는 직원 본인이 받는 계좌 정보만 표시됩니다.
                    </div>
                </div>
            </div>

            <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3">지급 방식</h3>
                <div className="space-y-2">
                    {[
                        { v: 'transfer', label: '본인 계좌 이체 (기본)' },
                        { v: 'cash', label: '현금 지급' },
                        { v: 'other_account', label: '타인 명의 계좌 입금' },
                    ].map(opt => (
                        <label key={opt.v} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-slate-50">
                            <input
                                type="radio"
                                name="private_payment_method"
                                value={opt.v}
                                checked={form.private_payment_method === opt.v}
                                onChange={e => setForm(f => ({ ...f, private_payment_method: e.target.value }))}
                            />
                            <span className="text-sm text-slate-700">{opt.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            {form.private_payment_method === 'other_account' && (
                <section className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-600">타인 명의 계좌 정보 (직원 명세서에 노출됨)</h4>
                    <input
                        type="text"
                        placeholder="실제 수령인 명 (예: 홍길동)"
                        value={form.private_actual_payee_name || ''}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_name: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="본인과의 관계 (예: 배우자, 자녀, 지인)"
                        value={form.private_actual_payee_relation || ''}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_relation: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <input
                        type="text"
                        placeholder="계좌 정보 (은행 / 계좌번호 / 예금주)"
                        value={form.private_actual_payee_account || ''}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_account: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </section>
            )}

            <section>
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded-lg border border-slate-200 hover:bg-slate-50">
                    <input
                        type="checkbox"
                        checked={!!form.private_tax_unreported}
                        onChange={e => setForm(f => ({ ...f, private_tax_unreported: e.target.checked }))}
                    />
                    <div className="flex-1">
                        <div className="text-sm font-bold text-slate-700">세금신고 제외</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                            4대보험·원천징수 모두 미적용. 명세서 공제 항목 0원, 실수령액 = 지급총액.
                        </div>
                    </div>
                </label>
            </section>

            <section>
                <h3 className="text-sm font-bold text-slate-700 mb-2">사업주 비공개 메모</h3>
                <textarea
                    value={form.private_owner_note || ''}
                    onChange={e => setForm(f => ({ ...f, private_owner_note: e.target.value }))}
                    placeholder="이 직원에 대한 사업주 비공개 메모..."
                    rows={4}
                    className="w-full p-3 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
            </section>

            {msg && (
                <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {msg.text}
                </div>
            )}

            <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all"
            >
                <Save size={16} /> {saving ? '저장 중...' : '저장'}
            </button>
        </div>
    );
}
