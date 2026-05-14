import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Plus, RefreshCw, Wallet, Trash2, Loader2,
    AlertCircle, CheckCircle2, X as XIcon, ShieldCheck, BarChart3,
} from 'lucide-react';
import api from '../api';

/**
 * 카드 매입(사용내역) 모듈 디테일.
 *
 * /external-integration/card-purchase
 *   - 등록된 카드사(매입용) 리스트 + 수동 동기화 + 삭제
 *   - 새 카드사 등록 폼 (organization_type='card', connection_type='card_purchase')
 *   - 매입 내역 조회 (필터: 기간, 카드사)
 *   - 월별 카드사·업종 합계 요약
 */
export default function CardPurchaseModuleDetail() {
    const today = new Date();
    const curY = today.getFullYear();
    const curM = today.getMonth() + 1;
    const _monthStart = (y, m) => `${y}-${String(m).padStart(2, '0')}-01`;
    const _monthEnd = (y, m) => {
        const lastDay = new Date(y, m, 0).getDate();
        return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    };

    const [conns, setConns] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [syncingId, setSyncingId] = useState(null);
    const [syncingAll, setSyncingAll] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const [filter, setFilter] = useState({
        start_date: _monthStart(curY, curM),
        end_date: _monthEnd(curY, curM),
        card_corp: '',
    });
    const [summaryYM, setSummaryYM] = useState({ year: curY, month: curM });

    async function fetchAll(customFilter) {
        const f = customFilter || filter;
        setLoading(true);
        setErr('');
        try {
            const listParams = { limit: 500 };
            if (f.start_date) listParams.start_date = f.start_date;
            if (f.end_date) listParams.end_date = f.end_date;
            if (f.card_corp) listParams.card_corp = f.card_corp;

            const [connRes, listRes, sumRes] = await Promise.all([
                api.get('/codef/connections', { params: { connection_type: 'card_purchase' } }),
                api.get('/codef/card-purchases', { params: listParams })
                    .catch(() => ({ data: [] })),
                api.get('/codef/card-purchases/summary', {
                    params: { year: summaryYM.year, month: summaryYM.month },
                }).catch(() => ({ data: null })),
            ]);
            setConns(connRes.data.connections || []);
            setPurchases(Array.isArray(listRes.data) ? listRes.data : []);
            setSummary(sumRes.data || null);
        } catch (e) {
            setErr(e.response?.data?.detail || '데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

    // 요약 (년/월) 변경 시 별도 fetch
    useEffect(() => {
        api.get('/codef/card-purchases/summary', {
            params: { year: summaryYM.year, month: summaryYM.month },
        })
            .then((r) => setSummary(r.data || null))
            .catch(() => setSummary(null));
    }, [summaryYM.year, summaryYM.month]);

    async function handleSyncOne(connId) {
        setSyncingId(connId);
        setMsg('');
        setErr('');
        try {
            const res = await api.post(`/codef/card-purchases/sync/${connId}`, null, {
                params: { days_back: 30 },
            });
            const d = res.data;
            if (d.error) {
                setErr(`${d.organization_label} 동기화 실패: ${d.error}`);
            } else {
                setMsg(`${d.organization_label} 동기화 완료 — 신규 매입 ${d.new_purchases}건`);
            }
            fetchAll();
        } catch (e) {
            setErr(e.response?.data?.detail || '동기화 실패');
        } finally {
            setSyncingId(null);
        }
    }

    async function handleSyncAll() {
        setSyncingAll(true);
        setMsg('');
        setErr('');
        try {
            const res = await api.post('/codef/card-purchases/sync-all', null, {
                params: { days_back: 30 },
            });
            const d = res.data;
            setMsg(
                `전체 동기화 완료 — ${d.connection_count}개 연결, 신규 매입 ${d.total_new_purchases}건`,
            );
            fetchAll();
        } catch (e) {
            setErr(e.response?.data?.detail || '전체 동기화 실패');
        } finally {
            setSyncingAll(false);
        }
    }

    async function handleDelete(connId, label) {
        if (!window.confirm(`'${label}' 연결을 삭제할까요? 매입 내역은 그대로 유지됩니다.`)) return;
        setErr('');
        try {
            await api.delete(`/codef/connections/${connId}`);
            setMsg(`${label} 연결 삭제 완료`);
            fetchAll();
        } catch (e) {
            setErr(e.response?.data?.detail || '삭제 실패');
        }
    }

    const totalAmount = useMemo(
        () => purchases.reduce((sum, p) => sum + (p.amount || 0), 0),
        [purchases],
    );

    const fmtWon = (v) => (v || 0).toLocaleString('ko-KR') + '원';

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 pt-8 pb-16">
                <Link
                    to="/external-integration"
                    className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-violet-700 mb-4"
                >
                    <ArrowLeft className="w-4 h-4" />
                    외부 연동
                </Link>

                <header className="mb-6 flex items-start justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Wallet className="w-6 h-6 text-violet-600" />
                            카드 매입 자동수집
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            사장님 사용 카드(개인 명의) 승인내역을 CODEF 마이데이터로 야간 자동수집
                        </p>
                    </div>
                    <button
                        onClick={() => setRegisterOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700"
                    >
                        <Plus className="w-4 h-4" />
                        카드사 등록
                    </button>
                </header>

                {/* 안내 박스 */}
                <div className="mb-6 p-4 rounded-xl bg-violet-50 border border-violet-200">
                    <h3 className="text-sm font-bold text-violet-900 mb-2">
                        💳 매입 자동수집은 어떻게 작동하나요?
                    </h3>
                    <ul className="text-sm text-violet-900 list-disc pl-5 space-y-1 leading-relaxed">
                        <li>사장님이 사업용으로 쓰시는 <strong>개인 명의 카드사</strong>의 홈페이지/앱 ID·PW 를 등록합니다.</li>
                        <li>CODEF 마이데이터 API 로 해당 카드의 <strong>승인내역(가맹점·금액·할부)</strong>을 가져옵니다.</li>
                        <li>매일 새벽 자동수집 + 화면에서 [수동수집] 버튼으로 즉시 갱신 가능합니다.</li>
                        <li>비밀번호는 RSA 공개키로 암호화 후 즉시 폐기 — 셈하나 DB 에 저장되지 않습니다.</li>
                    </ul>
                </div>

                {msg && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" /> {msg}
                    </div>
                )}
                {err && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> {err}
                    </div>
                )}

                {/* 섹션 A: 등록된 카드사 */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700">
                            등록된 카드사 ({conns.filter((c) => c.status === 'active').length}/{conns.length})
                        </h2>
                        <button
                            onClick={handleSyncAll}
                            disabled={syncingAll || conns.length === 0}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs hover:bg-slate-50 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
                            전체 동기화
                        </button>
                    </div>
                    {conns.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
                            등록된 카드사가 없습니다. 우상단 <strong>[카드사 등록]</strong> 버튼으로 시작하세요.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {conns.map((c) => (
                                <ConnectionRow
                                    key={c.id}
                                    conn={c}
                                    syncing={syncingId === c.id}
                                    onSync={() => handleSyncOne(c.id)}
                                    onDelete={() => handleDelete(c.id, c.organization_label)}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* 섹션 D: 월별 요약 */}
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-700 flex items-center gap-1.5">
                            <BarChart3 className="w-4 h-4" />
                            월별 합계
                        </h2>
                        <div className="flex gap-2 items-center text-sm">
                            <select
                                value={summaryYM.year}
                                onChange={(e) => setSummaryYM((p) => ({ ...p, year: Number(e.target.value) }))}
                                className="px-2 py-1 border border-slate-200 rounded text-sm"
                            >
                                {[curY - 1, curY, curY + 1].map((y) => <option key={y} value={y}>{y}년</option>)}
                            </select>
                            <select
                                value={summaryYM.month}
                                onChange={(e) => setSummaryYM((p) => ({ ...p, month: Number(e.target.value) }))}
                                className="px-2 py-1 border border-slate-200 rounded text-sm"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) =>
                                    <option key={m} value={m}>{m}월</option>
                                )}
                            </select>
                        </div>
                    </div>
                    {summary ? (
                        <SummaryCard summary={summary} fmtWon={fmtWon} />
                    ) : (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                            해당 월 매입 데이터가 없습니다.
                        </div>
                    )}
                </section>

                {/* 섹션 C: 매입 내역 조회 */}
                <section>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h2 className="text-base font-semibold text-slate-700">
                            매입 내역 ({purchases.length.toLocaleString()}건 · 합계 {fmtWon(totalAmount)})
                        </h2>
                        <div className="flex gap-2 items-center text-xs">
                            <input
                                type="date"
                                value={filter.start_date}
                                onChange={(e) => setFilter((p) => ({ ...p, start_date: e.target.value }))}
                                className="px-2 py-1 border border-slate-200 rounded"
                            />
                            <span className="text-slate-400">~</span>
                            <input
                                type="date"
                                value={filter.end_date}
                                onChange={(e) => setFilter((p) => ({ ...p, end_date: e.target.value }))}
                                className="px-2 py-1 border border-slate-200 rounded"
                            />
                            <select
                                value={filter.card_corp}
                                onChange={(e) => setFilter((p) => ({ ...p, card_corp: e.target.value }))}
                                className="px-2 py-1 border border-slate-200 rounded"
                            >
                                <option value="">전체 카드사</option>
                                {[...new Set(conns.map((c) => c.organization_label))].map((lbl) =>
                                    <option key={lbl} value={lbl}>{lbl}</option>
                                )}
                            </select>
                            <button
                                onClick={() => fetchAll()}
                                className="px-3 py-1 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200"
                            >
                                조회
                            </button>
                        </div>
                    </div>
                    {loading ? (
                        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
                            불러오는 중...
                        </div>
                    ) : purchases.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center text-sm text-slate-500">
                            해당 조건의 매입 내역이 없습니다.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        <th className="text-left px-3 py-2">날짜</th>
                                        <th className="text-left px-3 py-2">카드사</th>
                                        <th className="text-left px-3 py-2">가맹점</th>
                                        <th className="text-left px-3 py-2">업종</th>
                                        <th className="text-right px-3 py-2">금액</th>
                                        <th className="text-center px-3 py-2">할부</th>
                                        <th className="text-center px-3 py-2">상태</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {purchases.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50">
                                            <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                                                {p.approval_date}
                                                {p.approval_time && (
                                                    <span className="text-xs text-slate-400 ml-1">{String(p.approval_time).slice(0, 5)}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{p.card_corp}</td>
                                            <td className="px-3 py-2 text-slate-700">{p.merchant_name || '-'}</td>
                                            <td className="px-3 py-2 text-xs text-slate-500">{p.business_type || '-'}</td>
                                            <td className="px-3 py-2 text-right font-mono text-slate-800 whitespace-nowrap">
                                                {fmtWon(p.amount)}
                                            </td>
                                            <td className="px-3 py-2 text-center text-xs text-slate-500">
                                                {p.installment ? `${p.installment}개월` : '일시불'}
                                            </td>
                                            <td className="px-3 py-2 text-center">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                                    p.status === '승인'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-rose-50 text-rose-700'
                                                }`}>
                                                    {p.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {registerOpen && (
                    <CardPurchaseRegisterModal
                        onClose={() => setRegisterOpen(false)}
                        onRegistered={() => {
                            setRegisterOpen(false);
                            setMsg('카드사 등록 완료');
                            fetchAll();
                        }}
                    />
                )}
            </div>
        </div>
    );
}


// ============================================================
// ConnectionRow — 등록된 카드사 한 줄
// ============================================================
function ConnectionRow({ conn, syncing, onSync, onDelete }) {
    const isActive = conn.status === 'active';
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800">{conn.organization_label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive
                            ? 'bg-emerald-50 text-emerald-700'
                            : conn.status === 'expired' || conn.status === 'failed_2fa'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-500'
                    }`}>
                        {isActive ? '활성' : conn.status}
                    </span>
                    <span className="text-[10px] text-slate-400">{conn.auth_method}</span>
                </div>
                <div className="text-xs text-slate-500">
                    {conn.last_verified_at ? (
                        <>마지막 동기화 {conn.last_verified_at.slice(0, 16).replace('T', ' ')}</>
                    ) : (
                        <span className="text-slate-400">아직 동기화 안 됨</span>
                    )}
                    {conn.last_error_message && (
                        <span className="ml-2 text-rose-600">
                            ✗ {conn.last_error_message.slice(0, 60)}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex items-center gap-1.5">
                <button
                    onClick={onSync}
                    disabled={syncing || !isActive}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-lg text-xs font-medium hover:bg-violet-200 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                    수동수집
                </button>
                <button
                    onClick={onDelete}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                    title="연결 삭제"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
}


// ============================================================
// SummaryCard — 월별 카드사·업종 합계
// ============================================================
function SummaryCard({ summary, fmtWon }) {
    const corpEntries = Object.entries(summary.by_corp || {}).sort((a, b) => b[1] - a[1]);
    const bizEntries = Object.entries(summary.by_business_type || {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5 pb-5 border-b border-slate-100">
                <div>
                    <div className="text-xs text-slate-500 mb-1">총 매입액</div>
                    <div className="text-xl font-bold text-violet-700">{fmtWon(summary.total)}</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 mb-1">건수</div>
                    <div className="text-xl font-bold text-slate-700">{(summary.count || 0).toLocaleString()}건</div>
                </div>
                <div>
                    <div className="text-xs text-slate-500 mb-1">기간</div>
                    <div className="text-base font-semibold text-slate-700">{summary.year}년 {summary.month}월</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">카드사별</h4>
                    {corpEntries.length === 0 ? (
                        <div className="text-sm text-slate-400">데이터 없음</div>
                    ) : corpEntries.map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1 text-sm">
                            <span className="text-slate-700">{k}</span>
                            <span className="font-mono font-semibold text-slate-800">{fmtWon(v)}</span>
                        </div>
                    ))}
                </div>
                <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">업종별 (Top 8)</h4>
                    {bizEntries.length === 0 ? (
                        <div className="text-sm text-slate-400">데이터 없음</div>
                    ) : bizEntries.map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-1 text-sm">
                            <span className="text-slate-700">{k}</span>
                            <span className="font-mono font-semibold text-slate-800">{fmtWon(v)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}


// ============================================================
// CardPurchaseRegisterModal — 신규 카드사 등록 폼
// ============================================================
function CardPurchaseRegisterModal({ onClose, onRegistered }) {
    const [orgs, setOrgs] = useState([]);
    const [orgCode, setOrgCode] = useState('');
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');
    const [extraJson, setExtraJson] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState('');

    useEffect(() => {
        api.get('/codef/organizations/catalog', { params: { type: 'card' } })
            .then((res) => {
                const all = res.data.organizations || [];
                setOrgs(all);
                // 사장님이 자주 쓰시는 카드사 3개를 우선 노출 (신한=0306, 삼성=0364, 현대=0307)
                if (all.length > 0 && !orgCode) {
                    const priority = ['0306', '0364', '0307'];
                    const found = priority.find((p) => all.some((o) => o.code === p));
                    setOrgCode(found || all[0].code);
                }
            })
            .catch(() => setErr('카드사 목록을 불러오지 못했습니다.'));
        // eslint-disable-next-line
    }, []);

    // 우선 카드사 → 기타 순으로 정렬
    const sortedOrgs = useMemo(() => {
        const priority = ['0306', '0364', '0307']; // 신한·삼성·현대
        const top = priority.map((p) => orgs.find((o) => o.code === p)).filter(Boolean);
        const rest = orgs.filter((o) => !priority.includes(o.code));
        return [...top, ...rest];
    }, [orgs]);

    async function handleSubmit() {
        setErr('');
        if (!orgCode) { setErr('카드사를 선택하세요.'); return; }
        if (!userId || !password) { setErr('ID 와 비밀번호를 입력하세요.'); return; }
        let extra = null;
        if (extraJson.trim()) {
            try {
                extra = JSON.parse(extraJson);
                if (typeof extra !== 'object' || Array.isArray(extra)) {
                    throw new Error('객체 형식이어야 합니다.');
                }
            } catch {
                setErr('추가 정보는 유효한 JSON 객체여야 합니다.');
                return;
            }
        }
        setSubmitting(true);
        try {
            const auth = { id: userId, password, ...(extra || {}) };
            const res = await api.post('/codef/connections/register', {
                organization_type: 'card',
                organization_code: orgCode,
                connection_type: 'card_purchase',
                auth,
            });
            if (res.data.status === 'additional_auth_required') {
                setErr(
                    `추가 본인확인이 필요합니다 (${res.data.method}). ` +
                    `현재 단계에서는 추가 인증 처리가 PoC 대기 중입니다. 별도 연락 부탁드립니다.`
                );
                return;
            }
            onRegistered?.(res.data.connection);
        } catch (e) {
            const detail = e.response?.data?.detail;
            setErr(typeof detail === 'string' ? detail : (detail?.message || '등록 실패'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-t-xl">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">
                            <Wallet className="w-5 h-5" />
                            카드 매입 — 카드사 등록
                        </h3>
                        <p className="text-xs text-violet-100 mt-0.5">
                            CODEF 마이데이터 (사용카드)
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                    <div>
                        <label className="block text-sm text-slate-700 mb-1.5">카드사</label>
                        <select
                            value={orgCode}
                            onChange={(e) => setOrgCode(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                        >
                            {sortedOrgs.map((o) => (
                                <option key={o.code} value={o.code}>{o.label}</option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                            ※ 사장님 카드사 홈페이지/앱 로그인 가능한 카드사를 선택하세요.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-700 mb-1.5">카드사 홈페이지 ID</label>
                        <input
                            type="text"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoComplete="off"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-slate-700 mb-1.5">비밀번호</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                            autoComplete="new-password"
                        />
                    </div>
                    <details className="text-sm">
                        <summary className="cursor-pointer text-slate-600 hover:text-violet-700">
                            추가 정보 (선택) — 카드사별 필요 시
                        </summary>
                        <div className="mt-2">
                            <textarea
                                value={extraJson}
                                onChange={(e) => setExtraJson(e.target.value)}
                                rows={4}
                                placeholder='예: {"birthDate": "19800101"} 또는 {"cardPassword": "12"}'
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono"
                            />
                            <p className="text-[11px] text-slate-500 mt-1">
                                카드사별로 추가 인증 필드 (생년월일, 카드비밀번호 앞 2자리 등) 가 필요한 경우 JSON 객체로 입력.
                            </p>
                        </div>
                    </details>
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                        <ShieldCheck className="w-4 h-4 text-violet-600 flex-shrink-0 mt-0.5" />
                        <span>
                            비밀번호는 RSA 공개키로 즉시 암호화되어 CODEF 로만 전송됩니다.
                            셈하나 서버 DB 에는 저장되지 않습니다.
                        </span>
                    </div>
                    {err && (
                        <div className="text-sm p-2 rounded bg-red-50 text-red-700 border border-red-200">
                            {err}
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-5 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-semibold"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {submitting ? '등록 중...' : '등록'}
                    </button>
                </div>
            </div>
        </div>
    );
}
