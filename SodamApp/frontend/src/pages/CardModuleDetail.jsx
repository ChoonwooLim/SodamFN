import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, History, RefreshCw, Store, CheckCircle2, AlertCircle, X as XIcon, Trash2, Loader2 } from 'lucide-react';
import api from '../api';
import CardConnectionList from '../components/codef/CardConnectionList';
import CardConnectionRegisterModal from '../components/codef/CardConnectionRegisterModal';
import SyncHistoryDrawer from '../components/codef/SyncHistoryDrawer';

/**
 * 카드 매출 모듈 디테일.
 *
 * /external-integration/cards
 *   - 등록된 카드사 리스트
 *   - 카드사 등록 모달
 *   - 동기화 이력 drawer
 *   - 즉시 동기화 트리거
 */
export default function CardModuleDetail() {
    const [conns, setConns] = useState([]);
    const [merchants, setMerchants] = useState([]);
    const [loading, setLoading] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [merchantModalOpen, setMerchantModalOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const fetchAll = async () => {
        setLoading(true);
        setErr('');
        try {
            const [connRes, merchRes] = await Promise.all([
                api.get('/codef/connections', { params: { type: 'card' } }),
                api.get('/codef/card-merchants').catch(() => ({ data: [] })),
            ]);
            setConns(connRes.data.connections || []);
            setMerchants(merchRes.data || []);
        } catch (e) {
            setErr(e.response?.data?.detail || '데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };
    const fetchConns = fetchAll;

    useEffect(() => {
        fetchAll();
    }, []);

    const handleSync = async () => {
        setSyncing(true);
        setMsg('');
        setErr('');
        try {
            const res = await api.post('/codef/sync-cards/manual');
            const r = res.data.report;
            setMsg(
                `동기화 완료 — ${r.connections}개 연결, 신규 승인 ${r.total_new_approvals || r.new_approvals || 0}건, ` +
                `청구 ${r.total_new_payments || r.new_payments || 0}건` +
                (r.failed_count > 0 ? ` (실패 ${r.failed_count}건)` : '')
            );
            fetchConns();
        } catch (e) {
            setErr(e.response?.data?.detail || '동기화 실패');
        } finally {
            setSyncing(false);
        }
    };

    const activeCount = conns.filter((c) => c.status === 'active').length;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-4xl mx-auto px-6 pt-8 pb-16">
                <Link
                    to="/external-integration"
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    외부 연동
                </Link>

                <header className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">카드 매출 자동수집</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        CODEF 마이데이터 — 14개 카드사 사업자 매출(승인 + 청구 + 가맹점) 자동 적재
                    </p>
                </header>

                <div className="flex items-center gap-2 mb-6">
                    <button
                        onClick={() => setRegisterOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                    >
                        <Plus className="w-4 h-4" />
                        카드사 등록
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={syncing || activeCount === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
                        title={activeCount === 0 ? '먼저 카드사를 등록하세요' : '지금 동기화'}
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        지금 동기화
                    </button>
                    <button
                        onClick={() => setHistoryOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
                    >
                        <History className="w-4 h-4" />
                        이력
                    </button>
                </div>

                {msg && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        {msg}
                    </div>
                )}
                {err && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        {err}
                    </div>
                )}

                {/* 가맹점번호 섹션 (사장님 카드사 가맹점번호 표 매핑) */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700 flex items-center gap-1.5">
                            <Store className="w-4 h-4" />
                            카드사 가맹점번호 ({merchants.length}건)
                        </h2>
                        <button
                            onClick={() => setMerchantModalOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold hover:bg-emerald-200"
                        >
                            <Plus className="w-3.5 h-3.5" /> 가맹점 일괄 등록
                        </button>
                    </div>
                    {merchants.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-6 text-center text-sm text-slate-500">
                            등록된 가맹점이 없습니다. [가맹점 일괄 등록] 으로 카드사 가맹점번호 표를 입력하세요.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        <th className="text-left px-3 py-2">카드사 / PG</th>
                                        <th className="text-left px-3 py-2">가맹점번호</th>
                                        <th className="text-left px-3 py-2">등록일</th>
                                        <th className="text-left px-3 py-2">CODEF</th>
                                        <th className="text-left px-3 py-2">매출 수집</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {merchants.map(m => (
                                        <tr key={m.id} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 font-medium text-slate-800">{m.card_corp}</td>
                                            <td className="px-3 py-2 font-mono text-slate-700">{m.merchant_id}</td>
                                            <td className="px-3 py-2 text-xs text-slate-500">{m.registered_at || '-'}</td>
                                            <td className="px-3 py-2">
                                                {m.codef_supported ? (
                                                    m.codef_connected ? (
                                                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                                            <CheckCircle2 size={12} /> 연결됨
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-500">
                                                            지원 (미연결)
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-slate-400">PG · 별도</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                {m.codef_supported ? (
                                                    m.codef_connected ? (
                                                        <button
                                                            onClick={handleSync}
                                                            className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                                        >
                                                            🔄 매출 동기화
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setRegisterOpen(true)}
                                                            className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100"
                                                        >
                                                            + CODEF 연결
                                                        </button>
                                                    )
                                                ) : (
                                                    <span className="text-xs text-slate-400">
                                                        Excel/정산서 업로드
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="bg-slate-50 px-4 py-2 text-[11px] text-slate-500 border-t border-slate-100">
                                💡 CODEF 지원 카드사 9종 (KB/NH/롯데/하나/신한/현대/우리/BC/삼성) 은 자동 매출 수집 가능.
                                네이버페이·카카오페이·제로페이 등 PG 는 정산서 별도 처리.
                            </div>
                        </div>
                    )}
                </section>

                <h2 className="text-base font-semibold text-slate-700 mb-3">
                    등록된 카드사 ({activeCount}/{conns.length})
                </h2>

                {loading ? (
                    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                        불러오는 중...
                    </div>
                ) : (
                    <CardConnectionList
                        connections={conns}
                        onChanged={fetchConns}
                        onReverify={() => setRegisterOpen(true)}
                    />
                )}

                <CardConnectionRegisterModal
                    isOpen={registerOpen}
                    onClose={() => setRegisterOpen(false)}
                    onRegistered={fetchConns}
                />
                <SyncHistoryDrawer
                    isOpen={historyOpen}
                    onClose={() => setHistoryOpen(false)}
                />
                {merchantModalOpen && (
                    <MerchantBulkModal
                        onClose={() => setMerchantModalOpen(false)}
                        onSaved={() => {
                            setMerchantModalOpen(false);
                            setMsg('가맹점번호 등록 완료');
                            fetchAll();
                        }}
                    />
                )}
            </div>
        </div>
    );
}


// ============================================================
// 가맹점번호 일괄 등록 모달
// ============================================================
const PRESET_TEMPLATE = `KB국민카드\t00101755986\t2025-12-05
NH카드\t178318669\t2025-09-10
롯데카드\t9924419309\t2025-09-08
하나구외환\t00925104979\t2025-09-08
신한카드\t0140990276\t2025-09-08
현대카드\t850570073\t2021-04-20
우리카드\t602406580\t2025-09-09
비씨카드\t743149798\t2025-09-08
삼성카드\t201786256\t2025-09-09
Npay\tFID074167RCIRYC\t2026-01-16
카카오페이\tCQRB4B4LLGOUO8M\t2021-05-08
제로페이\t202105887659\t2026-04-03`;

function MerchantBulkModal({ onClose, onSaved }) {
    const [text, setText] = useState(PRESET_TEMPLATE);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    function parseRows() {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        const out = [];
        for (const line of lines) {
            // 탭/콤마/공백 다중 split
            const parts = line.split(/[\t,]+/).map(p => p.trim()).filter(Boolean);
            if (parts.length < 2) continue;
            const [card_corp, merchant_id, registered_at] = parts;
            out.push({
                card_corp,
                merchant_id,
                registered_at: registered_at || null,
            });
        }
        return out;
    }

    async function submit() {
        setError(null);
        const merchants = parseRows();
        if (merchants.length === 0) {
            setError('입력된 가맹점이 없습니다.');
            return;
        }
        setSubmitting(true);
        try {
            const res = await api.post('/codef/card-merchants/bulk', { merchants });
            alert(`등록 완료 — 신규 ${res.data.created}건, 갱신 ${res.data.updated}건`);
            onSaved();
        } catch (e) {
            setError(e.response?.data?.detail || e.message);
        } finally {
            setSubmitting(false);
        }
    }

    const preview = parseRows();

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">🏪 가맹점번호 일괄 등록</h3>
                        <p className="text-xs text-emerald-100 mt-0.5">
                            카드사·PG 가맹점번호 표를 한 번에 입력 (탭 또는 콤마 구분)
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">
                            가맹점번호 표 (한 줄에 한 가맹점, 형식: <code className="bg-slate-100 px-1">카드사명 [탭/쉼표] 가맹점번호 [탭/쉼표] 등록일(YYYY-MM-DD)</code>)
                        </label>
                        <textarea
                            value={text}
                            onChange={e => setText(e.target.value)}
                            rows={14}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                            placeholder="신한카드  0140990276  2025-09-08"
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                            💡 사장님 표를 복사해서 그대로 붙여넣으면 됩니다. 같은 (카드사·가맹점번호) 조합은 upsert (이미 있으면 갱신).
                        </p>
                    </div>
                    {preview.length > 0 && (
                        <div className="bg-slate-50 rounded-lg p-3 text-xs">
                            <div className="font-semibold text-slate-700 mb-2">파싱 미리보기 ({preview.length}건)</div>
                            <div className="max-h-40 overflow-y-auto">
                                {preview.slice(0, 20).map((p, i) => (
                                    <div key={i} className="flex gap-3 py-0.5">
                                        <span className="w-24 text-slate-700">{p.card_corp}</span>
                                        <span className="font-mono text-slate-600">{p.merchant_id}</span>
                                        <span className="text-slate-400">{p.registered_at || '-'}</span>
                                    </div>
                                ))}
                                {preview.length > 20 && <div className="text-slate-400 mt-1">... 외 {preview.length - 20}건</div>}
                            </div>
                        </div>
                    )}
                </div>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-white">
                        취소
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting || preview.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        {preview.length}건 등록
                    </button>
                </div>
            </div>
        </div>
    );
}
