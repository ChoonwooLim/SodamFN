import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Plus, Download, RefreshCw, Building2,
    X as XIcon, Loader2, AlertCircle, CheckCircle2, Sparkles,
    Power, Clock,
} from 'lucide-react';
import api from '../api';
import { CLASSIFIED_LABELS, fmtWon, fmtDate } from './BankSync';
import { formatUtcDate } from '../utils/format';

const AUTO_REFRESH_KEY = 'codef-bank-auto-refresh';
const DEFAULT_INTERVAL_MIN = 21;

/**
 * 계좌 거래내역 자동수집 (CODEF 전용 — popbill 미사용)
 *
 * /external-integration/banks
 *   - CODEF connection (type=bank) 리스트
 *   - 새 은행 연결 등록 모달 (CODEF /v1/account/create)
 *   - 거래 가져오기 모달 (CODEF /v1/kr/bank/.../transaction-list)
 *   - 거래내역 테이블 (분류 라벨 동일)
 */
export default function BankModuleDetail({ embedded = false } = {}) {
    // embedded=true: BankSync 의 source='codef' 시 등록 계좌 탭 안에서 inline 렌더.
    //   - 헤더 / 자동갱신 / 거래내역 테이블 제외 (BankSync 가 처리)
    //   - 등록 카드 + 등록 모달 + 거래 가져오기 모달만 표시
    const today = new Date();
    const curY = today.getFullYear();
    const curM = today.getMonth() + 1;
    const _monthStart = (m) => `${curY}-${String(m).padStart(2, '0')}-01`;
    const _monthEnd = (m) => {
        const lastDay = new Date(curY, m, 0).getDate();
        return `${curY}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    };

    const [conns, setConns] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [txs, setTxs] = useState([]);
    const [txTotal, setTxTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [pullModal, setPullModal] = useState(null);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    // 자동 갱신 상태 — Popbill BankSync.jsx 와 동일 패턴
    // 페이지 열려있는 동안 N분마다 /bank-sync/refresh-all 호출
    // backend 에 BANK_SYNC_PROVIDER=codef 설정되어야 CODEF 계좌가 자동 갱신됨
    const [autoRefresh, setAutoRefresh] = useState(() => {
        try {
            const saved = localStorage.getItem(AUTO_REFRESH_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return { enabled: false, intervalMinutes: DEFAULT_INTERVAL_MIN };
    });
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState(null);
    const [nextRefreshAt, setNextRefreshAt] = useState(null);
    const [countdown, setCountdown] = useState(0);
    const refreshIdRef = useRef(0);
    // 월별 필터: 이번 달 기본
    const [filter, setFilter] = useState({
        start_date: _monthStart(curM),
        end_date: _monthEnd(curM),
    });

    async function fetchAll(customFilter) {
        const f = customFilter || filter;
        setLoading(true);
        setErr('');
        try {
            const txParams = { source: 'codef', limit: 500 };
            if (f.start_date) txParams.start_date = f.start_date;
            if (f.end_date) txParams.end_date = f.end_date;
            const [connRes, accRes, txRes] = await Promise.all([
                api.get('/codef/connections', { params: { type: 'bank' } }),
                api.get('/bank-sync/accounts').catch(() => ({ data: [] })),
                api.get('/bank-sync/transactions', { params: txParams })
                    .catch(() => ({ data: { items: [], total: 0 } })),
            ]);
            setConns(connRes.data.connections || []);
            setAccounts(accRes.data || []);
            setTxs(txRes.data.items || []);
            setTxTotal(txRes.data.total || 0);
        } catch (e) {
            setErr(e.response?.data?.detail || '데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

    // localStorage 저장
    useEffect(() => {
        try {
            localStorage.setItem(AUTO_REFRESH_KEY, JSON.stringify(autoRefresh));
        } catch { /* ignore */ }
    }, [autoRefresh]);

    // 자동 갱신 setInterval (페이지 열려있는 동안 N분마다 /bank-sync/refresh-all 호출)
    useEffect(() => {
        if (!autoRefresh.enabled) {
            setNextRefreshAt(null);
            return;
        }
        const intervalMs = Math.max(1, autoRefresh.intervalMinutes) * 60 * 1000;
        const myId = ++refreshIdRef.current;

        const tick = async () => {
            if (refreshIdRef.current !== myId) return;
            setRefreshing(true);
            try {
                const res = await api.post('/bank-sync/refresh-all', null, {
                    params: { days: 7, skip_recent_minutes: Math.max(0, autoRefresh.intervalMinutes - 1) }
                });
                if (refreshIdRef.current !== myId) return;
                setLastRefresh({ at: new Date(), data: res.data });
                fetchAll();
            } catch (e) {
                if (refreshIdRef.current !== myId) return;
                setLastRefresh({ at: new Date(), error: e.response?.data?.detail || e.message });
            } finally {
                if (refreshIdRef.current === myId) {
                    setRefreshing(false);
                    setNextRefreshAt(Date.now() + intervalMs);
                }
            }
        };

        // 토글 ON 직후 한 번 즉시 실행
        tick();
        const id = setInterval(tick, intervalMs);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoRefresh.enabled, autoRefresh.intervalMinutes]);

    // 카운트다운 타이머
    useEffect(() => {
        if (!nextRefreshAt) { setCountdown(0); return; }
        const id = setInterval(() => {
            const left = Math.max(0, Math.round((nextRefreshAt - Date.now()) / 1000));
            setCountdown(left);
        }, 1000);
        return () => clearInterval(id);
    }, [nextRefreshAt]);

    function fmtCountdown(secs) {
        if (!secs) return '-';
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    function applyMonth(m) {
        const newF = { start_date: _monthStart(m), end_date: _monthEnd(m) };
        setFilter(newF);
        fetchAll(newF);
    }

    function clearMonth() {
        const newF = { start_date: '', end_date: '' };
        setFilter(newF);
        fetchAll(newF);
    }

    const isActiveMonth = (m) => filter.start_date === _monthStart(m);

    async function updateTxClass(tx, newClass) {
        try {
            await api.patch(`/bank-sync/transactions/${tx.id}`, { classified_as: newClass });
            setTxs(prev => prev.map(t => t.id === tx.id ? { ...t, classified_as: newClass, classified_by: 'manual' } : t));
        } catch (e) {
            alert('분류 변경 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    const activeCount = conns.filter(c => c.status === 'active').length;
    const accountsForConn = (orgCode) => accounts.filter(a => a.bank_code === orgCode);

    if (embedded) {
        return (
            <>
                {msg && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        {msg}
                    </div>
                )}
                {err && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        {err}
                    </div>
                )}

                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-slate-700">
                        등록된 CODEF 은행 연결 <span className="text-slate-400 font-normal">({activeCount}/{conns.length} 활성)</span>
                    </h2>
                    <button
                        onClick={() => setRegisterOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                    >
                        <Plus className="w-4 h-4" /> 은행 연결 추가
                    </button>
                </div>

                {conns.length === 0 ? (
                    <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
                        <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-500 mb-3">등록된 은행 연결이 없습니다.</p>
                        <button
                            onClick={() => setRegisterOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4" /> 첫 은행 연결 등록
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {conns.map(c => (
                            <ConnectionCard
                                key={c.id}
                                conn={c}
                                accounts={accountsForConn(c.organization_code)}
                                onPull={(acc) => setPullModal({ conn: c, account: acc })}
                            />
                        ))}
                    </div>
                )}

                {registerOpen && (
                    <BankConnectionRegisterModal
                        onClose={() => setRegisterOpen(false)}
                        onRegistered={() => {
                            setRegisterOpen(false);
                            setMsg('은행 연결 등록 완료');
                            fetchAll();
                        }}
                    />
                )}
                {pullModal && (
                    <BankPullModal
                        conn={pullModal.conn}
                        account={pullModal.account}
                        onClose={() => setPullModal(null)}
                        onPulled={(summary) => {
                            setPullModal(null);
                            setMsg(`거래 가져오기 완료 — 신규 ${summary.inserted}건, 중복 ${summary.duplicated}건`);
                            fetchAll();
                        }}
                    />
                )}
            </>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 pt-8 pb-16">
                <Link to="/external-integration" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700 mb-4">
                    <ArrowLeft className="w-4 h-4" /> 외부 연동
                </Link>

                <header className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            <Building2 className="w-6 h-6 text-blue-600" />
                            계좌 거래내역 자동수집
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            CODEF 마이데이터 — 20+ 은행 입출금 내역 자동수집 + 분류
                        </p>
                    </div>
                    <div className="flex gap-2 items-start">
                        <button
                            onClick={() => setRegisterOpen(true)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold"
                        >
                            <Plus className="w-4 h-4" /> 은행 연결 추가
                        </button>
                        <button
                            onClick={fetchAll}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            새로고침
                        </button>
                    </div>
                </header>

                {/* 자동 갱신 컨트롤 — Popbill BankSync.jsx 와 동일 패턴 */}
                <section className="mb-6 bg-white border border-slate-200 rounded-xl p-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                autoRefresh.enabled
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}>
                                <button
                                    onClick={() => setAutoRefresh(s => ({ ...s, enabled: !s.enabled }))}
                                    className={`flex items-center gap-1.5 ${autoRefresh.enabled ? 'text-emerald-700' : 'text-slate-500'}`}
                                    title={autoRefresh.enabled ? '자동 갱신 끄기' : '자동 갱신 켜기'}
                                >
                                    <Power size={13} className={autoRefresh.enabled ? 'text-emerald-600' : 'text-slate-400'} />
                                    자동 갱신
                                </button>
                                <span className="text-slate-300">·</span>
                                <label className="flex items-center gap-1">
                                    <input
                                        type="number"
                                        min={1}
                                        max={60}
                                        value={autoRefresh.intervalMinutes}
                                        onChange={e => setAutoRefresh(s => ({ ...s, intervalMinutes: Math.max(1, Math.min(60, parseInt(e.target.value) || DEFAULT_INTERVAL_MIN)) }))}
                                        className="w-12 px-1.5 py-0.5 bg-white/60 border border-slate-200 rounded text-center text-xs"
                                    />
                                    분 마다
                                </label>
                                {autoRefresh.enabled && nextRefreshAt && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-slate-500 flex items-center gap-1">
                                            <Clock size={11} />
                                            다음 {fmtCountdown(countdown)}
                                        </span>
                                    </>
                                )}
                                {refreshing && (
                                    <>
                                        <span className="text-slate-300">·</span>
                                        <span className="text-emerald-600 flex items-center gap-1">
                                            <Loader2 size={11} className="animate-spin" />
                                            갱신 중
                                        </span>
                                    </>
                                )}
                            </div>
                            {lastRefresh && (
                                <div className="text-xs text-slate-500">
                                    {lastRefresh.error ? (
                                        <span className="text-red-600">
                                            마지막 시도 실패: {lastRefresh.error}
                                        </span>
                                    ) : (
                                        <>
                                            마지막 갱신: {fmtDate(lastRefresh.at.toISOString())} {String(lastRefresh.at.getHours()).padStart(2,'0')}:{String(lastRefresh.at.getMinutes()).padStart(2,'0')}
                                            {lastRefresh.data?.total_inserted !== undefined && (
                                                <> · 신규 {lastRefresh.data.total_inserted}건</>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="text-xs text-slate-500">
                            <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 mr-2">primary</span>
                            CODEF 마이데이터 (Popbill 백업)
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        ⓘ 자동 갱신은 본 페이지가 열려있는 동안만 작동합니다. 백엔드 환경변수 <code className="bg-slate-100 px-1 rounded">BANK_SYNC_PROVIDER=codef</code> 가 설정되어야 CODEF 계좌 자동 호출됩니다.
                    </p>
                </section>

                {msg && (
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                        <CheckCircle2 className="w-4 h-4 inline mr-1" />
                        {msg}
                    </div>
                )}
                {err && (
                    <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                        <AlertCircle className="w-4 h-4 inline mr-1" />
                        {err}
                    </div>
                )}

                {/* CODEF 연결 카드 리스트 */}
                <section className="mb-6">
                    <h2 className="text-base font-semibold text-slate-700 mb-3">
                        등록된 CODEF 은행 연결 <span className="text-slate-400 font-normal">({activeCount}/{conns.length} 활성)</span>
                    </h2>
                    {conns.length === 0 ? (
                        <div className="bg-white border border-dashed border-slate-300 rounded-xl p-8 text-center">
                            <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                            <p className="text-sm text-slate-500 mb-3">등록된 은행 연결이 없습니다.</p>
                            <button
                                onClick={() => setRegisterOpen(true)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                            >
                                <Plus className="w-4 h-4" /> 첫 은행 연결 등록
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {conns.map(c => (
                                <ConnectionCard
                                    key={c.id}
                                    conn={c}
                                    accounts={accountsForConn(c.organization_code)}
                                    onPull={(acc) => setPullModal({ conn: c, account: acc })}
                                />
                            ))}
                        </div>
                    )}
                </section>

                {/* 거래내역 테이블 (CODEF source만) */}
                <section>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <h2 className="text-base font-semibold text-slate-700">
                            거래내역 <span className="text-slate-400 font-normal">({curY}년 · {txTotal.toLocaleString()}건)</span>
                        </h2>
                    </div>

                    {/* 월별 빠른 필터 */}
                    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">월별:</span>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                            const past = m > curM;
                            const active = isActiveMonth(m);
                            return (
                                <button
                                    key={m}
                                    onClick={() => applyMonth(m)}
                                    disabled={past}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                        active
                                            ? 'bg-slate-800 text-white'
                                            : past
                                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {m}월
                                </button>
                            );
                        })}
                        <button
                            onClick={clearMonth}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                                !filter.start_date && !filter.end_date
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            전체
                        </button>
                        {filter.start_date && (
                            <span className="text-xs text-slate-400 ml-2">
                                {filter.start_date} ~ {filter.end_date}
                            </span>
                        )}
                    </div>
                    {txs.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400 text-sm">
                            아직 CODEF 로 가져온 거래내역이 없습니다.<br />
                            은행 연결 등록 후 [거래 가져오기] 를 실행하세요.
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                                    <tr>
                                        <th className="text-left px-4 py-3">날짜</th>
                                        <th className="text-left px-4 py-3">내용</th>
                                        <th className="text-right px-4 py-3">입금</th>
                                        <th className="text-right px-4 py-3">출금</th>
                                        <th className="text-right px-4 py-3">잔액</th>
                                        <th className="text-left px-4 py-3">분류</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {txs.map(tx => (
                                        <tr key={tx.id} className="hover:bg-slate-50/50">
                                            <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                                                {fmtDate(tx.trans_date)}
                                                {tx.trans_time && (
                                                    <div className="text-xs text-slate-400">
                                                        {tx.trans_time.slice(0, 2)}:{tx.trans_time.slice(2, 4)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-700">{tx.remark1 || '-'}</div>
                                                {tx.remark2 && <div className="text-xs text-slate-400">{tx.remark2}</div>}
                                                <div className="text-[10px] text-slate-300 mt-0.5">
                                                    {tx.account_bank} {tx.account_alias && `· ${tx.account_alias}`}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-emerald-600">
                                                {tx.in_amount > 0 ? fmtWon(tx.in_amount) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-rose-600">
                                                {tx.out_amount > 0 ? fmtWon(tx.out_amount) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500 text-xs">
                                                {tx.balance != null ? tx.balance.toLocaleString('ko-KR') : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <select
                                                    value={tx.classified_as}
                                                    onChange={e => updateTxClass(tx, e.target.value)}
                                                    className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${CLASSIFIED_LABELS[tx.classified_as]?.color || ''}`}
                                                >
                                                    {Object.entries(CLASSIFIED_LABELS).map(([k, v]) => (
                                                        <option key={k} value={k}>{v.label}</option>
                                                    ))}
                                                </select>
                                                {tx.classified_by && (
                                                    <div className="text-[10px] text-slate-400 mt-1">
                                                        {tx.classified_by === 'manual' ? '수동' : tx.classified_by === 'auto' ? '자동' : tx.classified_by}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {registerOpen && (
                    <BankConnectionRegisterModal
                        onClose={() => setRegisterOpen(false)}
                        onRegistered={() => {
                            setRegisterOpen(false);
                            setMsg('은행 연결 등록 완료');
                            fetchAll();
                        }}
                    />
                )}
                {pullModal && (
                    <BankPullModal
                        conn={pullModal.conn}
                        account={pullModal.account}
                        onClose={() => setPullModal(null)}
                        onPulled={(summary) => {
                            setPullModal(null);
                            setMsg(`거래 가져오기 완료 — 신규 ${summary.inserted}건, 중복 ${summary.duplicated}건`);
                            fetchAll();
                        }}
                    />
                )}
            </div>
        </div>
    );
}


// ============================================================
// 연결 카드
// ============================================================
function ConnectionCard({ conn, accounts, onPull }) {
    const statusColor =
        conn.status === 'active' ? 'bg-emerald-100 text-emerald-700' :
        conn.status === 'expired' ? 'bg-amber-100 text-amber-700' :
        'bg-rose-100 text-rose-700';

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <div className="font-semibold text-slate-800">{conn.organization_label}</div>
                    <div className="text-xs text-slate-400">{conn.organization_code}</div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${statusColor}`}>
                    {conn.status}
                </span>
            </div>
            {conn.last_verified_at && (
                <div className="text-xs text-slate-400 mb-2">
                    인증: {formatUtcDate(conn.last_verified_at)}
                </div>
            )}
            {accounts.length === 0 ? (
                <div className="text-xs text-amber-600 bg-amber-50 rounded p-2">
                    ⚠ 매칭되는 계좌 메타가 없습니다. 은행 연결 등록 시 계좌번호도 함께 입력하세요.
                </div>
            ) : (
                <div className="space-y-1.5">
                    {accounts.map(a => (
                        <div key={a.id} className="flex items-center justify-between text-sm">
                            <div>
                                <span className="font-mono text-slate-700">{a.account_number_masked}</span>
                                {a.alias && <span className="text-xs text-slate-400 ml-1">({a.alias})</span>}
                            </div>
                            <button
                                onClick={() => onPull(a)}
                                className="flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs hover:bg-blue-100"
                            >
                                <Download size={12} /> 거래 가져오기
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}


// ============================================================
// 은행 연결 등록 모달 (CODEF register_bank)
// ============================================================
function BankConnectionRegisterModal({ onClose, onRegistered }) {
    const [form, setForm] = useState({
        bank_code: '0088',
        account_number: '',
        alias: '',
        fast_id: '',
        fast_pwd: '',
        client_type: 'B',
    });
    const [banks, setBanks] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPwd, setShowPwd] = useState(false);

    useEffect(() => {
        // 은행 코드 후보 — 백엔드에서 동적 조회 안 하고 정적 리스트 (orgCatalog 와 동일)
        setBanks([
            { code: '0088', label: '신한은행' },
            { code: '0004', label: 'KB국민은행' },
            { code: '0011', label: 'NH농협은행' },
            { code: '0020', label: '우리은행' },
            { code: '0081', label: '하나은행' },
            { code: '0003', label: 'IBK기업은행' },
            { code: '0089', label: '케이뱅크' },
            { code: '0090', label: '카카오뱅크' },
            { code: '0092', label: '토스뱅크' },
            { code: '0027', label: '한국씨티은행' },
            { code: '0023', label: 'SC제일은행' },
            { code: '0031', label: '대구은행' },
            { code: '0032', label: '부산은행' },
            { code: '0034', label: '광주은행' },
            { code: '0037', label: '전북은행' },
            { code: '0039', label: '경남은행' },
            { code: '0045', label: '새마을금고' },
            { code: '0048', label: '신협중앙회' },
            { code: '0071', label: '우체국' },
        ]);
    }, []);

    async function submit(e) {
        e?.preventDefault();
        setError(null);
        if (!form.account_number || !form.fast_id || !form.fast_pwd) {
            setError('계좌번호·조회전용 ID·비밀번호는 필수입니다.');
            return;
        }
        setSubmitting(true);
        try {
            // 1) BankAccount 메타 추가 (popbill 호출 없이 DB만)
            const cleanAccNum = form.account_number.replace(/\D/g, '');
            try {
                await api.post('/bank-sync/accounts/manual', {
                    bank_code: form.bank_code,
                    account_number: cleanAccNum,
                    account_type: form.client_type === 'B' ? 'C' : 'P',
                    alias: form.alias || null,
                    skip_verify: true,
                });
            } catch (e) {
                // 409 중복은 무시 (이미 등록된 계좌)
                if (e.response?.status !== 409) {
                    throw new Error('계좌 메타 등록 실패: ' + (e.response?.data?.detail || e.message));
                }
            }
            // 2) BankAccount.id 조회
            const accsRes = await api.get('/bank-sync/accounts');
            const matchedAcc = (accsRes.data || []).find(
                a => a.bank_code === form.bank_code && (a.account_number_masked || '').replace(/\D/g, '').endsWith(cleanAccNum.slice(-4))
            );
            // 3) CODEF connection 등록 + 가져오기는 별도 시점
            // 여기선 connection 만 발급. 사용자가 카드에서 [거래 가져오기] 누르면 codef-pull-historical 호출.
            // → register endpoint 만 별도로 따로 호출하는 게 좋겠으나 현재 codef-pull-historical 이 connect+pull 통합.
            // 임시로: pull 호출 시 zero-range 로 호출해 connection 만 발급. 또는 별도 endpoint 추가 (Phase 2).
            // 현재는 사용자가 사후 [거래 가져오기] 누르도록 안내.
            if (!matchedAcc) {
                throw new Error('계좌 등록은 됐지만 매칭 실패. 새로고침 후 [거래 가져오기] 로 connectedId 발급하세요.');
            }
            // 일단 connectedId 발급은 codef-pull-historical 에 위임 — 등록 직후 [거래 가져오기] 안내
            onRegistered();
        } catch (e) {
            setError(e.message || (e.response?.data?.detail || '등록 실패'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">🏦 은행 연결 추가</h3>
                        <p className="text-xs text-blue-100 mt-0.5">
                            CODEF 마이데이터 기반 — 계좌번호 + 조회전용 ID/PW 만 입력
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>
                <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" /> {error}
                        </div>
                    )}
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">은행 *</label>
                        <select
                            value={form.bank_code}
                            onChange={e => setForm({ ...form, bank_code: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            {banks.map(b => (
                                <option key={b.code} value={b.code}>{b.label} ({b.code})</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌번호 * (하이픈 자동 제거)</label>
                            <input type="text" value={form.account_number}
                                onChange={e => setForm({ ...form, account_number: e.target.value })}
                                placeholder="110-357-745538"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌 별칭 (선택)</label>
                            <input type="text" value={form.alias}
                                onChange={e => setForm({ ...form, alias: e.target.value })}
                                placeholder="예: 본점 매출 통장"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                    </div>
                    <div className="border-l-4 border-amber-300 bg-amber-50 rounded-r p-3">
                        <div className="text-xs font-bold text-amber-800 mb-2">🔐 조회전용 계정</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">조회전용 ID *</label>
                                <input type="text" value={form.fast_id}
                                    onChange={e => setForm({ ...form, fast_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">조회전용 비밀번호 *</label>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={form.fast_pwd}
                                    onChange={e => setForm({ ...form, fast_pwd: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                        <label className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                            <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} />
                            비밀번호 표시
                        </label>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">계좌 구분</label>
                        <select
                            value={form.client_type}
                            onChange={e => setForm({ ...form, client_type: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="B">법인</option>
                            <option value="P">개인</option>
                        </select>
                    </div>
                    <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-2">
                        🔒 자격증명은 CODEF API 로 즉시 암호화 전송됩니다. 셈하나 서버에 저장되지 않으며,
                        CODEF connectedId 만 DB 에 저장됩니다. 등록 후 [거래 가져오기] 를 누르면 connectedId 가 발급됩니다.
                    </div>
                </form>
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-white">
                        취소
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-semibold hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        등록
                    </button>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// 거래 가져오기 모달 (codef-pull-historical) — 3가지 인증 방식 지원
// ============================================================
function BankPullModal({ conn, account, onClose, onPulled }) {
    const [authMethod, setAuthMethod] = useState('id_pw'); // id_pw | cert | simple
    const [form, setForm] = useState({
        // 공통
        start_date: '2026-01-01',
        end_date: new Date().toISOString().slice(0, 10),
        client_type: 'B',
        // ID/PW
        fast_id: '',
        fast_pwd: '',
        // 공동인증서 (base64)
        cert_file: '',
        cert_file_name: '',
        key_file: '',
        key_file_name: '',
        cert_pwd: '',
        // 간편인증
        simple_provider: 'kakao',
        user_name: '',
        phone_no: '',
        birth_date: '',
        telecom: '0',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null);
    const [showPwd, setShowPwd] = useState(false);

    async function readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result || '';
                const b64 = String(result).split(',')[1] || result;
                resolve(b64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleFile(field, e) {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const b64 = await readFileAsBase64(file);
            setForm({ ...form, [field]: b64, [`${field}_name`]: file.name });
        } catch (err) {
            setError('파일 읽기 실패: ' + err.message);
        }
    }

    function buildPayload() {
        const base = {
            account_id: account.id,
            start_date: form.start_date,
            end_date: form.end_date,
            client_type: form.client_type,
        };
        if (authMethod === 'id_pw') {
            return { ...base, fast_id: form.fast_id, fast_pwd: form.fast_pwd };
        }
        if (authMethod === 'cert') {
            return {
                ...base,
                cert_file: form.cert_file,
                key_file: form.key_file,
                cert_pwd: form.cert_pwd,
            };
        }
        // simple
        return {
            ...base,
            simple_provider: form.simple_provider,
            user_name: form.user_name,
            phone_no: form.phone_no.replace(/-/g, ''),
            birth_date: form.birth_date.replace(/-/g, ''),
            telecom: form.telecom,
        };
    }

    function validate() {
        if (authMethod === 'id_pw' && (!form.fast_id || !form.fast_pwd)) {
            return 'ID/PW 둘 다 필수입니다.';
        }
        if (authMethod === 'cert' && (!form.cert_file || !form.key_file)) {
            return '공동인증서 파일 2개 (signCert.der + signPri.key) 필수입니다.';
        }
        if (authMethod === 'simple') {
            if (!form.user_name || !form.phone_no || !form.birth_date) {
                return '간편인증은 이름·휴대폰·생년월일(또는 사업자번호) 모두 필수입니다.';
            }
        }
        return null;
    }

    async function submit(e) {
        e?.preventDefault();
        setError(null);
        setInfo(null);
        const v = validate();
        if (v) { setError(v); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/bank-sync/codef-pull-historical', buildPayload());
            onPulled({
                inserted: res.data.inserted,
                duplicated: res.data.duplicated,
                total_fetched: res.data.total_fetched,
            });
        } catch (e) {
            const status = e.response?.status;
            const detail = e.response?.data?.detail;
            if (status === 428) {
                const msg = typeof detail === 'object' ? detail.message : detail;
                setInfo(msg || '간편인증 진행 중 — 휴대폰에서 인증 완료 후 [가져오기] 다시 누르세요.');
            } else if (status === 401) {
                setError('인증 실패: 입력 정보를 재확인하세요.');
            } else {
                setError(typeof detail === 'string' ? detail : (detail?.message || e.message));
            }
        } finally {
            setSubmitting(false);
        }
    }

    const methodTabs = [
        { id: 'id_pw', label: 'ID/PW', desc: '조회전용 ID + 비밀번호' },
        { id: 'cert', label: '공동인증서', desc: '인증서 파일 + 비밀번호' },
        { id: 'simple', label: '간편인증', desc: '카카오·네이버·PASS 등' },
    ];

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">📥 CODEF 거래 가져오기</h3>
                        <p className="text-xs text-teal-100 mt-0.5">
                            {conn?.organization_label} · {account?.account_number_masked}
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>

                {/* 인증 방식 탭 */}
                <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50">
                    <div className="text-xs text-slate-500 mb-2 font-semibold">인증 방식 선택</div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {methodTabs.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setAuthMethod(m.id)}
                                className={`text-xs px-2 py-2 rounded-lg font-semibold transition-colors ${
                                    authMethod === m.id
                                        ? 'bg-teal-600 text-white'
                                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                            >
                                {m.label}
                                <div className="text-[10px] font-normal mt-0.5 opacity-70">{m.desc}</div>
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" /> {error}
                        </div>
                    )}
                    {info && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                            ⏳ {info}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">시작일 *</label>
                            <input type="date" value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">종료일 *</label>
                            <input type="date" value={form.end_date}
                                onChange={e => setForm({ ...form, end_date: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                    </div>

                    {/* ID/PW 폼 */}
                    {authMethod === 'id_pw' && (
                        <div className="border-l-4 border-amber-300 bg-amber-50 rounded-r p-3">
                            <div className="text-xs font-bold text-amber-800 mb-2">🔐 조회전용 계정</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">ID *</label>
                                    <input type="text" value={form.fast_id}
                                        onChange={e => setForm({ ...form, fast_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">비밀번호 *</label>
                                    <input
                                        type={showPwd ? 'text' : 'password'}
                                        value={form.fast_pwd}
                                        onChange={e => setForm({ ...form, fast_pwd: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 공동인증서 폼 */}
                    {authMethod === 'cert' && (
                        <div className="border-l-4 border-blue-300 bg-blue-50 rounded-r p-3 space-y-2">
                            <div className="text-xs font-bold text-blue-800">📜 공동인증서</div>
                            <p className="text-[11px] text-blue-700">
                                NPKI 폴더에서 signCert.der 와 signPri.key 두 파일을 업로드.
                                Windows: <code className="bg-white px-1 rounded">C:\Users\xxx\AppData\LocalLow\NPKI\...</code>
                            </p>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">signCert.der *</label>
                                <input
                                    type="file"
                                    accept=".der,.cer"
                                    onChange={e => handleFile('cert_file', e)}
                                    className="w-full text-xs"
                                />
                                {form.cert_file_name && (
                                    <div className="text-[10px] text-emerald-600 mt-1">✓ {form.cert_file_name}</div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">signPri.key *</label>
                                <input
                                    type="file"
                                    accept=".key"
                                    onChange={e => handleFile('key_file', e)}
                                    className="w-full text-xs"
                                />
                                {form.key_file_name && (
                                    <div className="text-[10px] text-emerald-600 mt-1">✓ {form.key_file_name}</div>
                                )}
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">인증서 비밀번호 *</label>
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={form.cert_pwd}
                                    onChange={e => setForm({ ...form, cert_pwd: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* 간편인증 폼 */}
                    {authMethod === 'simple' && (
                        <div className="border-l-4 border-fuchsia-300 bg-fuchsia-50 rounded-r p-3 space-y-2">
                            <div className="text-xs font-bold text-fuchsia-800">📱 간편인증</div>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">인증사 *</label>
                                    <select
                                        value={form.simple_provider}
                                        onChange={e => setForm({ ...form, simple_provider: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="kakao">카카오톡</option>
                                        <option value="naver">네이버</option>
                                        <option value="pass">PASS (통신사)</option>
                                        <option value="toss">토스</option>
                                        <option value="payco">페이코</option>
                                        <option value="samsung">삼성패스</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">통신사 *</label>
                                    <select
                                        value={form.telecom}
                                        onChange={e => setForm({ ...form, telecom: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    >
                                        <option value="0">SKT</option>
                                        <option value="1">KT</option>
                                        <option value="2">LG U+</option>
                                        <option value="3">SKT 알뜰</option>
                                        <option value="4">KT 알뜰</option>
                                        <option value="5">LG 알뜰</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">본인 이름 *</label>
                                <input type="text" value={form.user_name}
                                    onChange={e => setForm({ ...form, user_name: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">휴대폰 번호 * (하이픈 자동 제거)</label>
                                <input type="text" value={form.phone_no}
                                    onChange={e => setForm({ ...form, phone_no: e.target.value })}
                                    placeholder="010-1234-5678"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">
                                    {form.client_type === 'B' ? '사업자번호 *' : '생년월일 (yyMMdd) *'}
                                </label>
                                <input type="text" value={form.birth_date}
                                    onChange={e => setForm({ ...form, birth_date: e.target.value })}
                                    placeholder={form.client_type === 'B' ? '6391201514' : '900101'}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                            </div>
                            <p className="text-[11px] text-fuchsia-700 mt-1">
                                💡 [가져오기] 클릭 → 휴대폰으로 인증 요청 → 카카오톡/앱에서 인증 완료 →
                                다시 [가져오기] 한 번 더 누르면 거래내역 수집됩니다.
                            </p>
                        </div>
                    )}

                    {/* 비밀번호 표시 토글 */}
                    {(authMethod === 'id_pw' || authMethod === 'cert') && (
                        <label className="flex items-center gap-2 text-xs text-slate-500">
                            <input type="checkbox" checked={showPwd} onChange={e => setShowPwd(e.target.checked)} />
                            비밀번호 표시
                        </label>
                    )}

                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">계좌 구분</label>
                        <select
                            value={form.client_type}
                            onChange={e => setForm({ ...form, client_type: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="B">법인</option>
                            <option value="P">개인</option>
                        </select>
                    </div>

                    <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-2">
                        🔒 자격증명·인증서·간편인증 정보는 CODEF API 로 즉시 전송 후 셈하나 서버에 저장되지 않습니다.
                    </div>
                </form>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-white">
                        취소
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        가져오기
                    </button>
                </div>
            </div>
        </div>
    );
}
