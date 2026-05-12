import { useState, useEffect, useMemo, useRef } from 'react';
import { Landmark, RefreshCw, Download, ExternalLink, CheckCircle2, AlertCircle, Loader2, Filter, Search, Tag, Trash2, Stethoscope, X as XIcon, Plus, Power, Clock } from 'lucide-react';
import api from '../api';

const AUTO_REFRESH_KEY = 'bankSyncAutoRefresh_v1';

const CLASSIFIED_LABELS = {
    unclassified: { label: '미분류', color: 'bg-slate-100 text-slate-600' },
    revenue: { label: '매출', color: 'bg-emerald-100 text-emerald-700' },
    expense: { label: '지출', color: 'bg-orange-100 text-orange-700' },
    purchase: { label: '매입', color: 'bg-amber-100 text-amber-700' },
    transfer: { label: '이체', color: 'bg-blue-100 text-blue-700' },
    excluded: { label: '제외', color: 'bg-slate-200 text-slate-500' },
    // 2026-05-12: 카드/페이/배달앱 정산 입금 — 매출과 분리 (중복 방지)
    card_settlement:     { label: '카드입금',   color: 'bg-violet-100 text-violet-700' },
    pay_settlement:      { label: '페이입금',   color: 'bg-fuchsia-100 text-fuchsia-700' },
    delivery_settlement: { label: '배달앱입금', color: 'bg-rose-100 text-rose-700' },
};

function fmtWon(n) {
    if (n == null || n === 0) return '-';
    return n.toLocaleString('ko-KR') + '원';
}

function fmtDate(s) {
    if (!s) return '';
    return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function BankSync() {
    const [tab, setTab] = useState('accounts');
    const [status, setStatus] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncMsg, setSyncMsg] = useState(null);

    // Transactions
    const [txs, setTxs] = useState([]);
    const [txTotal, setTxTotal] = useState(0);
    const [txLoading, setTxLoading] = useState(false);
    const [filter, setFilter] = useState({
        account_id: '',
        start_date: '',
        end_date: '',
        classified_as: '',
        direction: '',
        q: '',
    });

    // Pull form
    const [pullAcc, setPullAcc] = useState(null);
    const [pullForm, setPullForm] = useState({ start_date: '', end_date: '' });
    const [pulling, setPulling] = useState(false);
    const [pullResult, setPullResult] = useState(null);

    // Diagnostic
    const [diagOpen, setDiagOpen] = useState(false);
    const [diag, setDiag] = useState(null);
    const [diagLoading, setDiagLoading] = useState(false);

    // Manual account add
    const [manualOpen, setManualOpen] = useState(false);
    const [manualForm, setManualForm] = useState({
        bank_code: '0088',
        account_number: '',
        account_type: 'P',
        alias: '',
        skip_verify: false,
    });
    const [manualLoading, setManualLoading] = useState(false);
    const [manualResult, setManualResult] = useState(null);

    // Auto-refresh (페이지 열려있는 동안 N분 단위 일괄 갱신)
    const [autoRefresh, setAutoRefresh] = useState(() => {
        try {
            const saved = localStorage.getItem(AUTO_REFRESH_KEY);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return { enabled: false, intervalMinutes: 21 };
    });
    const [lastRefresh, setLastRefresh] = useState(null);  // { at: Date, data }
    const [refreshing, setRefreshing] = useState(false);
    const [nextRefreshAt, setNextRefreshAt] = useState(null);  // unix ms
    const [countdown, setCountdown] = useState(0);
    const refreshIdRef = useRef(0);

    async function handleManualAdd() {
        setManualLoading(true);
        setManualResult(null);
        try {
            const res = await api.post('/bank-sync/accounts/manual', manualForm);
            setManualResult({ type: 'success', data: res.data });
            fetchAccounts();
        } catch (e) {
            setManualResult({
                type: 'error',
                text: typeof e.response?.data?.detail === 'string'
                    ? e.response.data.detail
                    : JSON.stringify(e.response?.data?.detail || e.message, null, 2),
            });
        } finally {
            setManualLoading(false);
        }
    }

    const [diagEnv, setDiagEnv] = useState('live'); // 'live' | 'test' | 'both'

    async function runDiagnose(envOverride) {
        const env = envOverride || diagEnv;
        setDiagEnv(env);
        setDiagOpen(true);
        setDiagLoading(true);
        setDiag(null);
        try {
            const firstAccId = accounts[0]?.id;
            const params = new URLSearchParams();
            if (firstAccId) params.append('account_id', firstAccId);
            params.append('env', env);
            const res = await api.get(`/bank-sync/diagnose?${params.toString()}`);
            setDiag(res.data);
        } catch (e) {
            setDiag({ _fetch_error: e.response?.data?.detail || e.message });
        } finally {
            setDiagLoading(false);
        }
    }

    useEffect(() => {
        fetchStatus();
        fetchAccounts();
    }, []);

    useEffect(() => {
        if (tab === 'transactions') fetchTxs();
    }, [tab]);

    async function fetchStatus() {
        try {
            const res = await api.get('/bank-sync/status');
            setStatus(res.data);
        } catch (e) {
            console.error(e);
        }
    }

    async function fetchAccounts() {
        setLoading(true);
        try {
            const res = await api.get('/bank-sync/accounts');
            setAccounts(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    async function handleSyncAccounts() {
        setLoading(true);
        setSyncMsg(null);
        try {
            const res = await api.post('/bank-sync/accounts/sync');
            setAccounts(res.data.accounts || []);
            setSyncMsg({
                type: 'success',
                text: `팝빌에서 ${res.data.total_synced}개 계좌 확인 — 신규 ${res.data.created}건, 업데이트 ${res.data.updated}건`,
            });
        } catch (e) {
            setSyncMsg({
                type: 'error',
                text: e.response?.data?.detail || '계좌 동기화 실패',
            });
        } finally {
            setLoading(false);
        }
    }

    async function handleOpenMgtUrl() {
        try {
            const res = await api.get('/bank-sync/mgt-url');
            if (res.data.url) window.open(res.data.url, '_blank');
            else alert('관리 URL을 가져올 수 없습니다.');
        } catch (e) {
            alert('관리 URL 조회 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    function openPullModal(acc) {
        const today = new Date().toISOString().slice(0, 10);
        const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
        setPullAcc(acc);
        setPullForm({ start_date: monthAgo, end_date: today });
        setPullResult(null);
    }

    async function executePull() {
        if (!pullAcc) return;
        setPulling(true);
        setPullResult(null);
        try {
            const res = await api.post(`/bank-sync/accounts/${pullAcc.id}/pull`, pullForm);
            setPullResult({ type: 'success', data: res.data });
            fetchAccounts();
        } catch (e) {
            setPullResult({
                type: 'error',
                text: e.response?.data?.detail || '거래내역 수집 실패',
            });
        } finally {
            setPulling(false);
        }
    }

    async function handleDeleteAccount(acc) {
        if (!confirm(`${acc.bank_name} ${acc.account_number_masked} 계좌를 DB에서 삭제하시겠어요?\n(관련 거래내역 ${acc.last_sync_status ? '포함' : ''}도 함께 삭제됩니다)\n※ 팝빌 측 등록은 유지됩니다.`)) return;
        try {
            await api.delete(`/bank-sync/accounts/${acc.id}`);
            fetchAccounts();
        } catch (e) {
            alert('삭제 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function fetchTxs() {
        setTxLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filter).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });
            params.append('limit', '200');
            const res = await api.get(`/bank-sync/transactions?${params.toString()}`);
            setTxs(res.data.items || []);
            setTxTotal(res.data.total || 0);
        } catch (e) {
            console.error(e);
        } finally {
            setTxLoading(false);
        }
    }

    async function updateTx(tx, patch) {
        try {
            const res = await api.patch(`/bank-sync/transactions/${tx.id}`, patch);
            setTxs(txs.map(t => t.id === tx.id ? { ...t, ...res.data } : t));
        } catch (e) {
            alert('업데이트 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function handleAutoClassify() {
        if (!confirm('현재 필터 조건에 해당하는 미분류 거래를 규칙 기반으로 자동 분류합니다.\n계속할까요?')) return;
        try {
            const body = {
                account_id: filter.account_id ? parseInt(filter.account_id) : null,
                start_date: filter.start_date || null,
                end_date: filter.end_date || null,
                only_unclassified: true,
            };
            const res = await api.post('/bank-sync/transactions/auto-classify', body);
            const c = res.data.counts;
            alert(
                `자동 분류 완료\n총 ${res.data.processed}건 처리\n`
                + `매출 ${c.revenue || 0} · 지출 ${c.expense || 0} · 매입 ${c.purchase || 0} · 이체 ${c.transfer || 0}\n`
                + `카드입금 ${c.card_settlement || 0} · 페이입금 ${c.pay_settlement || 0} · 배달앱입금 ${c.delivery_settlement || 0}\n`
                + `학습 ${c.learned || 0} · 미분류 ${c.skip || 0}`
            );
            fetchTxs();
        } catch (e) {
            alert('자동 분류 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    const txSummary = useMemo(() => {
        const s = { total: txs.length, in: 0, out: 0, inSum: 0, outSum: 0 };
        txs.forEach(t => {
            if (t.in_amount > 0) { s.in++; s.inSum += t.in_amount; }
            if (t.out_amount > 0) { s.out++; s.outSum += t.out_amount; }
        });
        return s;
    }, [txs]);

    // 거래내역 탭 타이틀 — 필터된 계좌가 있으면 "{은행명} 거래내역", 단일 계좌면 그 계좌, 아니면 "거래내역"
    const txTabLabel = useMemo(() => {
        if (filter.account_id) {
            const acc = accounts.find(a => a.id === parseInt(filter.account_id));
            if (acc) return `${acc.bank_name} 거래내역`;
        }
        if (accounts.length === 1) {
            return `${accounts[0].bank_name} 거래내역`;
        }
        return '거래내역';
    }, [filter.account_id, accounts]);

    const tabs = useMemo(() => ([
        { key: 'accounts', label: '등록 계좌' },
        { key: 'transactions', label: txTabLabel },
        { key: 'settlement', label: '정산·수수료' },
    ]), [txTabLabel]);

    // localStorage 저장
    useEffect(() => {
        try {
            localStorage.setItem(AUTO_REFRESH_KEY, JSON.stringify(autoRefresh));
        } catch (e) { /* ignore */ }
    }, [autoRefresh]);

    // 자동 갱신 setInterval (페이지 열려있는 동안)
    useEffect(() => {
        if (!autoRefresh.enabled) {
            setNextRefreshAt(null);
            return;
        }
        const intervalMs = Math.max(1, autoRefresh.intervalMinutes) * 60 * 1000;
        const myId = ++refreshIdRef.current;

        const tick = async () => {
            if (refreshIdRef.current !== myId) return;  // 새 effect 가 떴으면 중단
            setRefreshing(true);
            try {
                const res = await api.post('/bank-sync/refresh-all', null, {
                    params: { days: 7, skip_recent_minutes: Math.max(0, autoRefresh.intervalMinutes - 1) }
                });
                if (refreshIdRef.current !== myId) return;
                setLastRefresh({ at: new Date(), data: res.data });
                fetchAccounts();
                if (tab === 'transactions') fetchTxs();
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

        // 토글 ON 직후 한 번 즉시 실행 (단, 최근 갱신 보호 로직은 백엔드가 처리)
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

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-6 py-8 pb-32">
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Landmark size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">은행계좌 연동</h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                팝빌 이지펀뱅크(정액제)로 등록 계좌의 거래내역을 자동 수집하고 매출/지출로 분류합니다.
                            </p>
                        </div>
                    </div>
                    {status && (
                        <div className={`px-3 py-2 rounded-xl text-xs font-semibold ${
                            status.is_stub ? 'bg-amber-100 text-amber-700'
                            : status.is_test ? 'bg-sky-100 text-sky-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                            {status.is_stub ? 'STUB 모드'
                                : status.is_test ? '🧪 TEST 모드'
                                : '✅ LIVE 연결됨'}
                            {status.balance_point != null && ` · ${status.balance_point.toLocaleString('ko-KR')}P`}
                        </div>
                    )}
                </header>

                {status && (
                    <div className={`mb-6 p-3 rounded-xl text-xs flex items-start gap-2 ${
                        status.is_stub ? 'bg-amber-50 border border-amber-200 text-amber-800'
                        : status.is_test ? 'bg-sky-50 border border-sky-200 text-sky-800'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    }`}>
                        <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                        <span>{status.note}</span>
                    </div>
                )}

                <div className="flex flex-wrap items-center gap-2 mb-6">
                    {tabs.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                tab === t.key
                                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                    <AutoRefreshControl
                        autoRefresh={autoRefresh}
                        setAutoRefresh={setAutoRefresh}
                        refreshing={refreshing}
                        lastRefresh={lastRefresh}
                        countdown={countdown}
                        fmtCountdown={fmtCountdown}
                    />
                </div>

                {tab === 'accounts' && (
                    <AccountsTab
                        accounts={accounts}
                        loading={loading}
                        syncMsg={syncMsg}
                        onSync={handleSyncAccounts}
                        onOpenMgtUrl={handleOpenMgtUrl}
                        onPull={openPullModal}
                        onDelete={handleDeleteAccount}
                        onDiagnose={runDiagnose}
                        onManualAdd={() => { setManualOpen(true); setManualResult(null); }}
                    />
                )}
                {tab === 'transactions' && (
                    <TransactionsTab
                        txs={txs}
                        accounts={accounts}
                        total={txTotal}
                        loading={txLoading}
                        summary={txSummary}
                        filter={filter}
                        setFilter={setFilter}
                        onApply={fetchTxs}
                        onUpdate={updateTx}
                        onAutoClassify={handleAutoClassify}
                    />
                )}
                {tab === 'settlement' && (
                    <SettlementTab />
                )}
            </div>

            {pullAcc && (
                <PullModal
                    acc={pullAcc}
                    form={pullForm}
                    setForm={setPullForm}
                    pulling={pulling}
                    result={pullResult}
                    onClose={() => setPullAcc(null)}
                    onExecute={executePull}
                />
            )}

            {diagOpen && (
                <DiagnoseModal
                    data={diag}
                    loading={diagLoading}
                    env={diagEnv}
                    onClose={() => setDiagOpen(false)}
                    onRerun={runDiagnose}
                />
            )}

            {manualOpen && (
                <ManualAddModal
                    form={manualForm}
                    setForm={setManualForm}
                    loading={manualLoading}
                    result={manualResult}
                    bankNames={status?.bank_names}
                    onClose={() => setManualOpen(false)}
                    onSubmit={handleManualAdd}
                />
            )}
        </div>
    );
}

function AutoRefreshControl({ autoRefresh, setAutoRefresh, refreshing, lastRefresh, countdown, fmtCountdown }) {
    const enabled = autoRefresh.enabled;
    const minutes = autoRefresh.intervalMinutes;
    return (
        <div className={`ml-auto flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            enabled
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : 'bg-white border-slate-200 text-slate-500'
        }`}>
            <button
                onClick={() => setAutoRefresh(s => ({ ...s, enabled: !s.enabled }))}
                className={`flex items-center gap-1.5 ${enabled ? 'text-emerald-700' : 'text-slate-500'}`}
                title={enabled ? '자동 갱신 끄기' : '자동 갱신 켜기'}
            >
                <Power size={13} className={enabled ? 'text-emerald-600' : 'text-slate-400'} />
                자동 갱신
            </button>
            <span className="text-slate-300">·</span>
            <label className="flex items-center gap-1">
                <input
                    type="number"
                    min={1}
                    max={60}
                    value={minutes}
                    onChange={e => setAutoRefresh(s => ({ ...s, intervalMinutes: Math.max(1, Math.min(60, parseInt(e.target.value) || 21)) }))}
                    className="w-12 px-1.5 py-0.5 bg-white/60 border border-slate-200 rounded text-center text-xs"
                />
                분
            </label>
            {enabled && (
                <>
                    <span className="text-slate-300">·</span>
                    <span className="flex items-center gap-1">
                        {refreshing ? (
                            <>
                                <Loader2 size={12} className="animate-spin" /> 갱신 중
                            </>
                        ) : (
                            <>
                                <Clock size={12} /> 다음 {fmtCountdown(countdown)}
                            </>
                        )}
                    </span>
                </>
            )}
            {lastRefresh && (
                <span className="text-slate-400 text-[10px] ml-1" title={lastRefresh.error || JSON.stringify(lastRefresh.data)}>
                    {lastRefresh.error
                        ? `❌ ${lastRefresh.at.toLocaleTimeString('ko-KR')}`
                        : `✓ ${lastRefresh.at.toLocaleTimeString('ko-KR')} · 신규 ${lastRefresh.data?.total_inserted ?? 0}`}
                </span>
            )}
        </div>
    );
}

function ManualAddModal({ form, setForm, loading, result, bankNames, onClose, onSubmit }) {
    const banks = bankNames || {
        '0088': '신한은행', '0004': '국민은행', '0020': '우리은행', '0081': '하나은행',
        '0011': '농협은행', '0003': '기업은행', '0090': '카카오뱅크', '0089': '케이뱅크', '0092': '토스뱅크',
    };

    return (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">계좌 수동 추가</h3>
                        <p className="text-xs text-slate-500 mt-1">
                            listBankAccount 권한 이슈 우회용. 팝빌 관리 페이지에서 확인한 계좌 정보를 직접 입력합니다.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                        <XIcon size={18} />
                    </button>
                </div>

                <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">은행</label>
                            <select
                                value={form.bank_code}
                                onChange={e => setForm({ ...form, bank_code: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            >
                                {Object.entries(banks).map(([code, name]) => (
                                    <option key={code} value={code}>{name} ({code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">유형</label>
                            <select
                                value={form.account_type}
                                onChange={e => setForm({ ...form, account_type: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                            >
                                <option value="P">개인</option>
                                <option value="C">법인</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">계좌번호 (하이픈 허용)</label>
                        <input
                            type="text"
                            value={form.account_number}
                            onChange={e => setForm({ ...form, account_number: e.target.value })}
                            placeholder="110-357-XXXXXXX"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">별칭 (선택)</label>
                        <input
                            type="text"
                            value={form.alias || ''}
                            onChange={e => setForm({ ...form, alias: e.target.value })}
                            placeholder="예: 소단신한은행"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                    <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.skip_verify}
                            onChange={e => setForm({ ...form, skip_verify: e.target.checked })}
                            className="mt-0.5"
                        />
                        <span>
                            <b>getBankAccountInfo 검증 스킵</b>
                            <span className="text-slate-400 block mt-0.5">
                                기본은 팝빌에 계좌 정보를 조회해 검증합니다. 이것도 같은 권한 에러가 나면 체크해서 강제 저장하세요 (거래내역 수집은 별도 API 라 작동할 수 있음).
                            </span>
                        </span>
                    </label>
                </div>

                {result?.type === 'success' && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs mb-4">
                        <div className="font-semibold">✅ 등록 완료</div>
                        <pre className="mt-1 text-[10px] overflow-x-auto">{JSON.stringify(result.data, null, 2)}</pre>
                    </div>
                )}
                {result?.type === 'error' && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs mb-4">
                        <div className="font-semibold">❌ 실패</div>
                        <pre className="mt-1 whitespace-pre-wrap font-mono">{result.text}</pre>
                    </div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200"
                    >
                        닫기
                    </button>
                    <button
                        onClick={onSubmit}
                        disabled={loading || !form.account_number}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        등록
                    </button>
                </div>
            </div>
        </div>
    );
}

function DiagnoseModal({ data, loading, env, onClose, onRerun }) {
    const ENV_OPTIONS = [
        { key: 'live', label: 'Live (실서비스)', color: 'bg-emerald-100 text-emerald-700' },
        { key: 'test', label: 'Test (테스트)', color: 'bg-amber-100 text-amber-700' },
        { key: 'both', label: '양쪽 비교', color: 'bg-indigo-100 text-indigo-700' },
    ];
    const checksByEnv = (data?.checks || []).reduce((acc, c) => {
        const k = c.env_label || 'default';
        if (!acc[k]) acc[k] = [];
        acc[k].push(c);
        return acc;
    }, {});

    return (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center px-4 pt-12 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 mb-12">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <Stethoscope size={18} className="text-amber-600" />
                            팝빌 연결 진단
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            Cloudflare에 가려진 502 에러의 실제 원인을 확인합니다.
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
                    >
                        <XIcon size={18} />
                    </button>
                </div>

                <div className="flex gap-2 mb-4 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider self-center mr-1">환경</span>
                    {ENV_OPTIONS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => onRerun(opt.key)}
                            disabled={loading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                env === opt.key
                                    ? opt.color + ' ring-2 ring-offset-1 ring-slate-300'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            } disabled:opacity-50`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 size={24} className="animate-spin mx-auto text-slate-400" />
                        <p className="text-xs text-slate-400 mt-2">팝빌 API 호출 중...</p>
                    </div>
                ) : !data ? (
                    <div className="p-8 text-center text-sm text-slate-400">진단 데이터가 없습니다.</div>
                ) : data._fetch_error ? (
                    <div className="p-4 bg-rose-50 text-rose-700 rounded-xl text-sm">
                        <div className="font-semibold">진단 엔드포인트 자체가 실패했습니다</div>
                        <div className="mt-1 font-mono text-xs">{data._fetch_error}</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <section>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">환경변수</h4>
                            <div className="bg-slate-50 rounded-lg p-3 font-mono text-xs space-y-1">
                                {Object.entries(data.env || {}).map(([k, v]) => (
                                    <div key={k} className="flex justify-between">
                                        <span className="text-slate-500">{k}</span>
                                        <span className={`font-semibold ${v === true ? 'text-emerald-600' : v === false ? 'text-rose-600' : 'text-slate-700'}`}>
                                            {typeof v === 'boolean' ? (v ? 'SET ✓' : 'MISSING ✗') : (v || '(empty)')}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">프로바이더</h4>
                            <div className="bg-slate-50 rounded-lg p-3 text-sm flex justify-between">
                                <span>활성: <b className="font-mono">{data.provider || '-'}</b></span>
                                <span>
                                    is_test_mode:{' '}
                                    <b className={`font-mono ${data.is_test_mode === false ? 'text-emerald-600' : 'text-amber-600'}`}>
                                        {String(data.is_test_mode)}
                                    </b>
                                </span>
                            </div>
                            {data.is_test_mode === true && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs">
                                    ⚠️ is_test_mode=true. 팝빌 테스트 API 로 연결됨. 실계좌 조회 불가.
                                    Orbitron env 에서 <code className="bg-white px-1 rounded">POPBILL_BANK_IS_TEST=false</code> 설정 필요.
                                </div>
                            )}
                        </section>

                        {data.provider_init_error && (
                            <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs font-mono">
                                <div className="font-sans font-semibold mb-1">Provider 초기화 실패</div>
                                {data.provider_init_error}
                            </div>
                        )}

                        <section>
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">팝빌 API 호출 결과</h4>
                            {Object.keys(checksByEnv).length > 1 && (
                                <div className="grid grid-cols-2 gap-4 mb-3">
                                    {['live', 'test'].filter(k => checksByEnv[k]).map(k => {
                                        const pass = checksByEnv[k].filter(c => c.ok).length;
                                        const total = checksByEnv[k].length;
                                        return (
                                            <div key={k} className={`p-3 rounded-lg ${k === 'live' ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                                                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                                                    {k === 'live' ? 'Live 실서비스' : 'Test 테스트환경'}
                                                </div>
                                                <div className="text-lg font-bold text-slate-800">
                                                    {pass}/{total} 통과
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="space-y-2">
                                {(data.checks || []).map((c, i) => (
                                    <details
                                        key={i}
                                        open={!c.ok}
                                        className={`rounded-lg border ${c.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}
                                    >
                                        <summary className="px-3 py-2 cursor-pointer text-sm flex items-center gap-2 flex-wrap">
                                            {c.ok ? (
                                                <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
                                            ) : (
                                                <AlertCircle size={14} className="text-rose-600 flex-shrink-0" />
                                            )}
                                            <span className="font-mono font-semibold">{c.name}</span>
                                            <span className={`text-xs ml-auto ${c.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                {c.ok ? 'OK' : (c.error_type || 'FAIL')}
                                            </span>
                                        </summary>
                                        <div className="px-3 pb-3 border-t border-slate-200">
                                            {c.ok ? (
                                                <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                                                    {JSON.stringify(c.result, null, 2)}
                                                </pre>
                                            ) : (
                                                <div className="mt-2 space-y-2">
                                                    <div className="text-xs font-mono text-rose-900 bg-white p-3 rounded border border-rose-200 whitespace-pre-wrap break-all">
                                                        <b className="font-sans text-rose-700">에러 메시지:</b>
                                                        <br />
                                                        {c.error || '(no message)'}
                                                    </div>
                                                    {c.traceback && (
                                                        <details className="text-xs" open>
                                                            <summary className="text-slate-500 cursor-pointer">traceback (최근 5줄)</summary>
                                                            <pre className="mt-1 p-2 bg-slate-900 text-slate-100 rounded overflow-x-auto text-[10px] whitespace-pre-wrap">
                                                                {c.traceback.join('\n')}
                                                            </pre>
                                                        </details>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                <div className="flex gap-2 mt-5">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200"
                    >
                        닫기
                    </button>
                    <button
                        onClick={onRerun}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        재진단
                    </button>
                </div>
            </div>
        </div>
    );
}

function AccountsTab({ accounts, loading, syncMsg, onSync, onOpenMgtUrl, onPull, onDelete, onDiagnose, onManualAdd }) {
    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                    onClick={onSync}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    팝빌에서 계좌 동기화
                </button>
                <button
                    onClick={onManualAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all"
                    title="listBankAccount 권한 이슈 우회: 계좌 정보 수동 입력"
                >
                    <Plus size={14} />
                    계좌 수동 추가
                </button>
                <button
                    onClick={onOpenMgtUrl}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-all"
                >
                    <ExternalLink size={14} />
                    팝빌 관리 페이지 열기
                </button>
                <button
                    onClick={onDiagnose}
                    className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-sm font-semibold hover:bg-amber-100 transition-all ml-auto"
                    title="팝빌 연결 상태를 상세히 진단합니다"
                >
                    <Stethoscope size={14} />
                    연결 진단
                </button>
            </div>

            {syncMsg && (
                <div className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${syncMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                    {syncMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{syncMsg.text}</span>
                </div>
            )}

            {accounts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                    <Landmark size={40} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm text-slate-500">등록된 계좌가 없습니다.</p>
                    <p className="text-xs text-slate-400 mt-1">팝빌 관리 페이지에서 계좌를 등록한 뒤 "팝빌에서 계좌 동기화"를 눌러주세요.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {accounts.map(acc => (
                        <div key={acc.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                                            {acc.account_type === 'C' ? '법인' : '개인'}
                                        </span>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${acc.popbill_state === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {acc.popbill_state || '미확인'}
                                        </span>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mt-1">{acc.bank_name}</h3>
                                    <p className="text-sm text-slate-500 font-mono">{acc.account_number_masked}</p>
                                    {acc.alias && <p className="text-xs text-slate-400 mt-0.5">{acc.alias}</p>}
                                </div>
                                <button
                                    onClick={() => onDelete(acc)}
                                    className="p-2 text-slate-400 hover:text-rose-500 rounded-lg"
                                    title="DB에서 계좌 삭제"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs mb-4">
                                <div className="bg-slate-50 rounded-lg px-3 py-2">
                                    <div className="text-slate-400">사용 기간</div>
                                    <div className="font-semibold text-slate-700">
                                        {acc.popbill_use_start || '-'} ~ {acc.popbill_use_end || '-'}
                                    </div>
                                </div>
                                <div className="bg-slate-50 rounded-lg px-3 py-2">
                                    <div className="text-slate-400">다음 결제</div>
                                    <div className="font-semibold text-slate-700">{acc.next_billing_date || '-'}</div>
                                </div>
                                <div className="bg-slate-50 rounded-lg px-3 py-2 col-span-2">
                                    <div className="text-slate-400">최근 수집</div>
                                    <div className="font-semibold text-slate-700">
                                        {acc.last_sync_at ? new Date(acc.last_sync_at).toLocaleString('ko-KR') : '없음'}
                                        {acc.last_sync_status === 'failed' && (
                                            <span className="text-rose-500 ml-2">· 실패: {acc.last_sync_error}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => onPull(acc)}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-blue-800 transition-all"
                            >
                                <Download size={14} />
                                거래내역 수집
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PullModal({ acc, form, setForm, pulling, result, onClose, onExecute }) {
    return (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-1">거래내역 수집</h3>
                <p className="text-xs text-slate-500 mb-4">
                    {acc.bank_name} {acc.account_number_masked}
                </p>

                <div className="space-y-3 mb-5">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">시작일</label>
                        <input
                            type="date"
                            value={form.start_date}
                            onChange={e => setForm({ ...form, start_date: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">종료일</label>
                        <input
                            type="date"
                            value={form.end_date}
                            onChange={e => setForm({ ...form, end_date: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                    </div>
                    <p className="text-xs text-slate-400">※ 한 번에 최대 90일. 중복 거래는 자동 스킵됩니다.</p>
                </div>

                {result?.type === 'success' && (
                    <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl text-xs mb-4">
                        <div className="font-semibold">✅ 수집 완료</div>
                        <div className="mt-1">
                            가져온 건수: {result.data.total_fetched} · 신규 {result.data.inserted} · 중복스킵 {result.data.duplicated}
                        </div>
                    </div>
                )}
                {result?.type === 'error' && (
                    <div className="p-3 bg-rose-50 text-rose-700 rounded-xl text-xs mb-4">❌ {result.text}</div>
                )}

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-200"
                    >
                        닫기
                    </button>
                    <button
                        onClick={onExecute}
                        disabled={pulling || !form.start_date || !form.end_date}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {pulling ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        수집 실행
                    </button>
                </div>
            </div>
        </div>
    );
}

function TransactionsTab({ txs, accounts, total, loading, summary, filter, setFilter, onApply, onUpdate, onAutoClassify }) {
    return (
        <div>
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-3">
                    <select
                        value={filter.account_id}
                        onChange={e => setFilter({ ...filter, account_id: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                        <option value="">전체 계좌</option>
                        {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.bank_name} {a.account_number_masked}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={filter.start_date}
                        onChange={e => setFilter({ ...filter, start_date: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                    <input
                        type="date"
                        value={filter.end_date}
                        onChange={e => setFilter({ ...filter, end_date: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    />
                    <select
                        value={filter.classified_as}
                        onChange={e => setFilter({ ...filter, classified_as: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                        <option value="">전체 분류</option>
                        {Object.entries(CLASSIFIED_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                        ))}
                    </select>
                    <select
                        value={filter.direction}
                        onChange={e => setFilter({ ...filter, direction: e.target.value })}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                        <option value="">입/출 전체</option>
                        <option value="in">입금만</option>
                        <option value="out">출금만</option>
                    </select>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="내용 검색"
                            value={filter.q}
                            onChange={e => setFilter({ ...filter, q: e.target.value })}
                            onKeyDown={e => e.key === 'Enter' && onApply()}
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                        />
                        <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        총 <span className="font-bold text-slate-700">{summary.total}</span>건 ·
                        입금 {summary.in}건 ({fmtWon(summary.inSum)}) ·
                        출금 {summary.out}건 ({fmtWon(summary.outSum)})
                        {total > summary.total && <span className="ml-1 text-amber-600">/ 전체 {total}건</span>}
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={onApply}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900"
                        >
                            <Filter size={12} /> 필터 적용
                        </button>
                        <button
                            onClick={onAutoClassify}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
                        >
                            <Tag size={12} /> 자동 분류
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center">
                        <Loader2 size={24} className="animate-spin mx-auto text-slate-400" />
                    </div>
                ) : txs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-sm">거래내역이 없습니다.</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                            <tr>
                                <th className="text-left px-4 py-3 font-semibold">날짜</th>
                                <th className="text-left px-4 py-3 font-semibold">내용</th>
                                <th className="text-right px-4 py-3 font-semibold">입금</th>
                                <th className="text-right px-4 py-3 font-semibold">출금</th>
                                <th className="text-right px-4 py-3 font-semibold">잔액</th>
                                <th className="text-left px-4 py-3 font-semibold">분류</th>
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
                                            onChange={e => onUpdate(tx, { classified_as: e.target.value })}
                                            className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${CLASSIFIED_LABELS[tx.classified_as]?.color || ''}`}
                                        >
                                            {Object.entries(CLASSIFIED_LABELS).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                        {tx.classified_by && (
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {tx.classified_by === 'auto' ? '자동' : tx.classified_by === 'manual' ? '수동' : tx.classified_by}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}


// ============================================================
// 정산·수수료 탭 (2026-05-12) — 카드/페이/배달앱 정산 통계 + 수수료율 역산
// ============================================================

function SettlementTab() {
    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);

    async function fetchStats() {
        setLoading(true);
        setErr(null);
        try {
            const res = await api.get('/bank-sync/settlement-stats', { params: { year, month } });
            setData(res.data);
        } catch (e) {
            setErr(e?.response?.data?.detail || e.message);
            setData(null);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { fetchStats(); /* eslint-disable-next-line */ }, [year, month]);

    const yearOptions = [];
    for (let y = today.getFullYear(); y >= today.getFullYear() - 3; y--) yearOptions.push(y);

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-lg font-bold text-slate-800">정산·수수료 통계</h2>
                <div className="flex gap-2">
                    <select
                        value={year}
                        onChange={e => setYear(parseInt(e.target.value))}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                        {yearOptions.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <select
                        value={month}
                        onChange={e => setMonth(parseInt(e.target.value))}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>{m}월</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchStats}
                        className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700"
                    >
                        <RefreshCw size={14} className="inline mr-1" /> 새로고침
                    </button>
                </div>
            </div>

            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800 mb-6">
                <strong>수수료율 역산 방식:</strong>{' '}
                카드는 같은 (카드사·월) 의 <span className="font-mono">CardSalesApproval</span> 승인합과{' '}
                <span className="font-mono">CardPayment</span> 입금합 차이로 산출. 페이/배달앱은 정산 명세서에
                기록된 수수료가 있으면 그 값을, 없으면 매출 대비 입금 차이로 추정.
            </div>

            {loading && <div className="text-center py-10 text-slate-400"><Loader2 className="animate-spin inline mr-2" /> 로딩 중...</div>}
            {err && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{err}</div>}

            {data && !loading && (
                <div className="space-y-6">
                    <SettlementSection
                        title="🟪 카드사 정산"
                        rows={data.card}
                        corpLabel="카드사"
                        emptyMsg="이번 달 카드 정산 데이터가 없습니다."
                    />
                    <SettlementSection
                        title="🟪 페이 정산"
                        rows={data.pay}
                        corpLabel="페이"
                        emptyMsg="이번 달 페이 정산 데이터가 없습니다. 페이 매출 원본 데이터가 없으면 수수료율이 산출되지 않습니다."
                    />
                    <SettlementSection
                        title="🛵 배달앱 정산"
                        rows={data.delivery}
                        corpLabel="배달앱"
                        keyCol="channel"
                        emptyMsg="이번 달 배달앱 정산 데이터가 없습니다."
                    />
                </div>
            )}
        </div>
    );
}

function SettlementSection({ title, rows, corpLabel, keyCol = 'corp', emptyMsg }) {
    if (!rows || rows.length === 0) {
        return (
            <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">{title}</h3>
                <div className="text-xs text-slate-400 bg-slate-50 rounded-xl p-4 text-center">{emptyMsg}</div>
            </div>
        );
    }
    const totalSales = rows.reduce((s, r) => s + (r.sales_amount || r.total_sales || 0), 0);
    const totalDeposit = rows.reduce((s, r) => s + (r.net_deposit || r.settlement_amount || 0), 0);
    const totalFees = rows.reduce((s, r) => s + (r.fees || r.total_fees || 0), 0);
    const avgRate = totalSales > 0 ? (totalFees / totalSales * 100).toFixed(2) : null;

    return (
        <div>
            <h3 className="text-sm font-bold text-slate-700 mb-2">
                {title}{' '}
                <span className="text-xs font-normal text-slate-500">
                    ({rows.length}개 · 평균 수수료율 {avgRate != null ? `${avgRate}%` : '—'})
                </span>
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                        <tr className="text-xs text-slate-500">
                            <th className="px-3 py-2 text-left font-semibold">{corpLabel}</th>
                            <th className="px-3 py-2 text-right font-semibold">매출원본</th>
                            <th className="px-3 py-2 text-right font-semibold">실입금</th>
                            <th className="px-3 py-2 text-right font-semibold">수수료</th>
                            <th className="px-3 py-2 text-right font-semibold">수수료율</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => {
                            const sales = r.sales_amount ?? r.total_sales ?? 0;
                            const deposit = r.net_deposit ?? r.settlement_amount ?? 0;
                            const fees = r.fees ?? r.total_fees ?? 0;
                            const rate = r.fee_rate_pct;
                            return (
                                <tr key={r[keyCol]} className="border-t border-slate-100">
                                    <td className="px-3 py-2 font-medium text-slate-800">{r[keyCol]}</td>
                                    <td className="px-3 py-2 text-right font-mono">{sales > 0 ? sales.toLocaleString('ko-KR') : '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono">{deposit > 0 ? deposit.toLocaleString('ko-KR') : '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono text-orange-600">{fees > 0 ? fees.toLocaleString('ko-KR') : '—'}</td>
                                    <td className="px-3 py-2 text-right font-mono font-semibold">
                                        {rate != null ? `${rate}%` : <span className="text-slate-300">—</span>}
                                    </td>
                                </tr>
                            );
                        })}
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                            <td className="px-3 py-2 text-slate-800">합계</td>
                            <td className="px-3 py-2 text-right font-mono">{totalSales > 0 ? totalSales.toLocaleString('ko-KR') : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{totalDeposit > 0 ? totalDeposit.toLocaleString('ko-KR') : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono text-orange-600">{totalFees > 0 ? totalFees.toLocaleString('ko-KR') : '—'}</td>
                            <td className="px-3 py-2 text-right font-mono">{avgRate != null ? `${avgRate}%` : '—'}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
