import { useState, useEffect, useMemo, useRef } from 'react';
import { Landmark, RefreshCw, Download, ExternalLink, CheckCircle2, AlertCircle, Loader2, Filter, Search, Tag, Trash2, Stethoscope, X as XIcon, Plus, Power, Clock, Sparkles, Send, MessageSquare, HelpCircle } from 'lucide-react';
import api from '../api';
import HelpModal from '../components/HelpModal';
import { MOBILE_PG_GUIDE_MD, MOBILE_PG_GUIDE_TITLE } from '../data/help/mobilePgGuide';
import { DEPOSIT_GUIDE_MD, DEPOSIT_GUIDE_TITLE } from '../data/help/depositClassificationGuide';

const AUTO_REFRESH_KEY = 'bankSyncAutoRefresh_v1';
const AI_MODEL_KEY = 'bankSyncAiModel_v1';

function loadAiModelSetting() {
    try {
        const v = JSON.parse(localStorage.getItem(AI_MODEL_KEY) || 'null');
        if (v && typeof v === 'object' && v.provider) return v;
    } catch (e) { /* ignore */ }
    return { provider: 'ollama', model: 'qwen2.5:7b' };
}

function saveAiModelSetting(v) {
    try { localStorage.setItem(AI_MODEL_KEY, JSON.stringify(v)); } catch (e) { /* ignore */ }
}

export const CLASSIFIED_LABELS = {
    unclassified: { label: '미분류', color: 'bg-slate-100 text-slate-600' },
    revenue: { label: '매출', color: 'bg-emerald-100 text-emerald-700' },
    expense: { label: '지출', color: 'bg-orange-100 text-orange-700' },
    purchase: { label: '매입', color: 'bg-amber-100 text-amber-700' },
    transfer: { label: '이체', color: 'bg-blue-100 text-blue-700' },
    excluded: { label: '제외', color: 'bg-slate-200 text-slate-500' },
    // 2026-05-12: 카드/페이/배달앱 정산 입금 — 매출과 분리 (중복 방지)
    card_settlement:     { label: '카드입금', color: 'bg-violet-100 text-violet-700' },
    pay_settlement:      { label: '페이입금', color: 'bg-fuchsia-100 text-fuchsia-700' },
    delivery_settlement: { label: '배달입금', color: 'bg-rose-100 text-rose-700' },
    // 2026-05-12: 이동식 단말기 카드매출 (코페이 등) — 매출에 포함, 수수료 역산
    mobile_settlement:   { label: '이동식카드', color: 'bg-sky-100 text-sky-700' },
    // 2026-05-12: 개인 송금 / 사장님 자금 / 차입금 / 영업외수익 분류
    cash_revenue:        { label: '현금매출', color: 'bg-emerald-200 text-emerald-800' },  // 매출 인식 (emerald 진하게)
    owner_deposit:       { label: '현금입금', color: 'bg-teal-100 text-teal-700' },         // 사장님 자금, 매출 X
    loan_in:             { label: '차입금',   color: 'bg-indigo-100 text-indigo-700' },     // 대출, 매출 X
    other_income:        { label: '기타입금', color: 'bg-stone-100 text-stone-700' },       // 영업외수익, 매출 X
};

export function fmtWon(n) {
    if (n == null || n === 0) return '-';
    return n.toLocaleString('ko-KR') + '원';
}

export function fmtDate(s) {
    if (!s) return '';
    return s.length >= 10 ? s.slice(0, 10) : s;
}

export default function BankSync() {
    const [tab, setTab] = useState('accounts');
    const [status, setStatus] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncMsg, setSyncMsg] = useState(null);

    // Transactions — 기본 필터는 이번 달 (사장님 요구: 월별 기본 뷰)
    const _today = new Date();
    const _curY = _today.getFullYear();
    const _curM = _today.getMonth() + 1;
    const _monthStart = `${_curY}-${String(_curM).padStart(2, '0')}-01`;
    const _lastDay = new Date(_curY, _curM, 0).getDate();
    const _monthEnd = `${_curY}-${String(_curM).padStart(2, '0')}-${String(_lastDay).padStart(2, '0')}`;

    const [txs, setTxs] = useState([]);
    const [txTotal, setTxTotal] = useState(0);
    const [txLoading, setTxLoading] = useState(false);
    const [filter, setFilter] = useState({
        account_id: '',
        start_date: _monthStart,
        end_date: _monthEnd,
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

    // 계좌 직접 등록 (RegistBankAccount API)
    const [registOpen, setRegistOpen] = useState(false);

    // CODEF 과거 거래 가져오기 (popbill 3개월 한도 우회)
    const [codefHistOpen, setCodefHistOpen] = useState(false);

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

    async function fetchTxs(customFilter) {
        // customFilter 가 제공되면 그것을 사용 (state setFilter 후 race condition 방지)
        // 없으면 현재 filter state 사용 (기존 호출 호환)
        const f = customFilter || filter;
        setTxLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(f).forEach(([k, v]) => {
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
                + `카드입금 ${c.card_settlement || 0} · 페이입금 ${c.pay_settlement || 0} · 배달입금 ${c.delivery_settlement || 0} · 이동식카드 ${c.mobile_settlement || 0}\n`
                + `학습 ${c.learned || 0} · 미분류 ${c.skip || 0}`
            );
            fetchTxs();
        } catch (e) {
            alert('자동 분류 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    // AI 모델 설정 (localStorage 영속화)
    const [aiModel, setAiModel] = useState(loadAiModelSetting);
    const [aiModelsCatalog, setAiModelsCatalog] = useState(null); // {default_provider, providers: {ollama: {...}, openclaw: {...}}}

    useEffect(() => { saveAiModelSetting(aiModel); }, [aiModel]);
    useEffect(() => {
        // 가용 모델 목록 1회 조회
        api.get('/bank-sync/ai-classify/models')
            .then(r => setAiModelsCatalog(r.data))
            .catch(() => { /* AI 미설정 시 조용히 실패 */ });
    }, []);

    // AI 분류 제안 모달 state
    const [aiModal, setAiModal] = useState(null); // { tx, suggestion, loading, error }

    async function handleAiSuggest(tx) {
        setAiModal({ tx, suggestion: null, loading: true, error: null });
        try {
            const res = await api.post(`/bank-sync/transactions/${tx.id}/ai-classify-suggest`, {
                provider: aiModel.provider, model: aiModel.model,
            });
            setAiModal({ tx, suggestion: res.data, loading: false, error: null });
        } catch (e) {
            setAiModal({ tx, suggestion: null, loading: false, error: e.response?.data?.detail || e.message });
        }
    }

    async function applyAiSuggestion() {
        if (!aiModal?.suggestion) return;
        const { tx, suggestion } = aiModal;
        try {
            await api.patch(`/bank-sync/transactions/${tx.id}`, {
                classified_as: suggestion.classified_as,
            });
            setAiModal(null);
            fetchTxs();
        } catch (e) {
            alert('적용 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function handleAiBatch() {
        if (!confirm(
            '필터에 해당하는 미분류 거래(최대 50건)에 대해 AI(Ollama qwen2.5:7b) 분류를 일괄 제안합니다.\n'
            + '신뢰도 70% 이상 항목만 자동 적용. 미만은 제안 리스트로 반환.\n'
            + '수동 분류는 보호됩니다.\n\n계속할까요?'
        )) return;
        try {
            const body = {
                account_id: filter.account_id ? parseInt(filter.account_id) : null,
                start_date: filter.start_date || null,
                end_date: filter.end_date || null,
                only_unclassified: true,
                max_items: 50,
                min_confidence: 0.7,
                apply: true,
                provider: aiModel.provider,
                model: aiModel.model,
            };
            const res = await api.post('/bank-sync/transactions/ai-classify-batch', body);
            alert(
                `AI 일괄 분류 완료\n`
                + `검사 ${res.data.processed}건 · 자동 적용 ${res.data.applied}건 · 오류 ${res.data.errors}건\n`
                + `(신뢰도 70% 미만은 적용되지 않음 — 개별 ✨ 버튼으로 검토)`
            );
            fetchTxs();
        } catch (e) {
            alert('AI 일괄 분류 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function handleReclassifySettlements() {
        if (!confirm(
            '입금 거래 중 카드사·페이사·배달앱 키워드가 매칭되는 항목을 '
            + '카드입금·페이입금·배달입금으로 강제 재분류합니다.\n'
            + '기존 분류(제외/매출/매입 등)와 학습 패턴을 무시합니다.\n'
            + '(수동 분류는 보호됩니다)\n\n계속할까요?'
        )) return;
        try {
            const body = {
                account_id: filter.account_id ? parseInt(filter.account_id) : null,
                start_date: filter.start_date || null,
                end_date: filter.end_date || null,
                override_manual: false,
            };
            const res = await api.post('/bank-sync/transactions/reclassify-settlements', body);
            const c = res.data.counts;
            alert(
                `정산 재분류 완료\n총 ${c.scanned}건 검사\n`
                + `카드입금 ${c.card_settlement} · 페이입금 ${c.pay_settlement} · 배달입금 ${c.delivery_settlement} · 이동식카드 ${c.mobile_settlement || 0}\n`
                + `이미 정확 ${c.already_correct} · 키워드 미매칭 ${c.skipped_no_match} · 수동분류 보호 ${c.skipped_manual}`
            );
            fetchTxs();
        } catch (e) {
            alert('정산 재분류 실패: ' + (e.response?.data?.detail || e.message));
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
        { key: 'audit', label: 'AI 감사' },
        { key: 'chat', label: 'AI 분석' },
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
                    <AIModelSelector value={aiModel} onChange={setAiModel} catalog={aiModelsCatalog} />
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
                        onRegistAccount={() => setRegistOpen(true)}
                        isSuperAdmin={localStorage.getItem('user_role') === 'superadmin'}
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
                        onReclassifySettlements={handleReclassifySettlements}
                        onAiSuggest={handleAiSuggest}
                        onAiBatch={handleAiBatch}
                        onCodefHistorical={() => setCodefHistOpen(true)}
                    />
                )}
                {tab === 'settlement' && (
                    <SettlementTab />
                )}
                {tab === 'audit' && (
                    <AuditTab accounts={accounts} onRefreshTxs={fetchTxs} aiModel={aiModel} />
                )}
                {tab === 'chat' && (
                    <ChatTab aiModel={aiModel} />
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

            {aiModal && (
                <AISuggestModal
                    state={aiModal}
                    onClose={() => setAiModal(null)}
                    onApply={applyAiSuggestion}
                />
            )}

            {registOpen && (
                <RegistAccountModal
                    bankNames={status?.bank_names}
                    onClose={() => setRegistOpen(false)}
                    onSuccess={() => {
                        setRegistOpen(false);
                        fetchAccounts();
                    }}
                />
            )}

            {codefHistOpen && (
                <CodefHistoricalModal
                    accounts={accounts}
                    onClose={() => setCodefHistOpen(false)}
                    onSuccess={() => {
                        setCodefHistOpen(false);
                        fetchTxs();
                    }}
                />
            )}
        </div>
    );
}

function AISuggestModal({ state, onClose, onApply }) {
    const { tx, suggestion, loading, error } = state;
    const suggestedLabel = suggestion ? CLASSIFIED_LABELS[suggestion.classified_as]?.label || suggestion.classified_as : '';
    const suggestedColor = suggestion ? CLASSIFIED_LABELS[suggestion.classified_as]?.color || 'bg-slate-100 text-slate-600' : '';
    const confidencePct = suggestion ? Math.round(suggestion.confidence * 100) : 0;
    const confidenceColor = confidencePct >= 80 ? 'text-emerald-600'
        : confidencePct >= 60 ? 'text-amber-600'
        : 'text-rose-600';

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                <div className="px-5 py-4 bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Sparkles size={18} />
                        <h3 className="font-bold">AI 분류 제안</h3>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3">
                    <div className="bg-slate-50 rounded-xl p-3 text-sm">
                        <div className="text-xs text-slate-400 mb-1">대상 거래</div>
                        <div className="font-medium text-slate-700">{tx.remark1 || '-'}</div>
                        {tx.remark2 && <div className="text-xs text-slate-500">{tx.remark2}</div>}
                        <div className="flex gap-3 mt-2 text-xs">
                            {tx.in_amount > 0 && <span className="text-emerald-600 font-mono">입금 {fmtWon(tx.in_amount)}</span>}
                            {tx.out_amount > 0 && <span className="text-rose-600 font-mono">출금 {fmtWon(tx.out_amount)}</span>}
                            <span className="text-slate-400">{fmtDate(tx.trans_date)}</span>
                        </div>
                    </div>

                    {loading && (
                        <div className="text-center py-8">
                            <Loader2 className="animate-spin inline mr-2 text-fuchsia-500" size={20} />
                            <span className="text-sm text-slate-500">AI가 분석 중입니다... (1~3초)</span>
                        </div>
                    )}

                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" />
                            {error}
                        </div>
                    )}

                    {suggestion && !loading && (
                        <>
                            <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">제안 분류</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${suggestedColor}`}>
                                        {suggestedLabel}
                                    </span>
                                </div>
                                {suggestion.standard_name && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-400">표준명</span>
                                        <span className="text-sm font-mono text-slate-700">{suggestion.standard_name}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-400">신뢰도</span>
                                    <span className={`text-sm font-bold ${confidenceColor}`}>{confidencePct}%</span>
                                </div>
                                <div className="pt-2 border-t border-slate-100">
                                    <div className="text-xs text-slate-400 mb-1">근거</div>
                                    <div className="text-sm text-slate-700">{suggestion.reason}</div>
                                </div>
                                <div className="text-[10px] text-slate-300 pt-1">{suggestion.provider}</div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50"
                                >
                                    닫기
                                </button>
                                <button
                                    onClick={onApply}
                                    className="flex-1 px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white rounded-xl text-sm font-semibold hover:from-fuchsia-700 hover:to-rose-700"
                                >
                                    <CheckCircle2 size={14} className="inline mr-1" /> 수락 적용
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function AIModelSelector({ value, onChange, catalog }) {
    // catalog: {default_provider, providers: {ollama: {configured, models}, openclaw: {configured, models}}}
    const providers = catalog?.providers || {};
    const ollamaModels = providers.ollama?.models || [];
    const ollamaConfigured = providers.ollama?.configured;
    const openclawConfigured = providers.openclaw?.configured;
    const openclawModel = catalog?.default_openclaw_model || 'openclaw/codex-pro';

    // 옵션: ollama 모델 N개 + openclaw 1개 (있으면)
    const options = [];
    if (ollamaConfigured) {
        for (const m of ollamaModels) {
            options.push({ provider: 'ollama', model: m, label: `Ollama · ${m}` });
        }
    }
    if (openclawConfigured) {
        options.push({ provider: 'openclaw', model: openclawModel, label: `OpenClaw · ${openclawModel} (GPT-5.5)` });
    }
    // 미설정/카탈로그 없음일 때 fallback
    if (options.length === 0) {
        options.push({ provider: value.provider, model: value.model, label: `${value.provider} · ${value.model}` });
    }

    const currentKey = `${value.provider}:${value.model}`;
    return (
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs">
            <Sparkles size={12} className="text-fuchsia-500" />
            <span className="text-slate-500 font-semibold">AI:</span>
            <select
                value={currentKey}
                onChange={e => {
                    const [provider, ...rest] = e.target.value.split(':');
                    onChange({ provider, model: rest.join(':') });
                }}
                className="bg-transparent border-0 text-xs font-mono focus:outline-none cursor-pointer text-slate-700"
                title="AI 모델 선택 — 모든 AI 호출(분류 제안, 일괄, 감사, 분석)에 자동 적용"
            >
                {options.map(o => {
                    const k = `${o.provider}:${o.model}`;
                    return <option key={k} value={k}>{o.label}</option>;
                })}
            </select>
            {!ollamaConfigured && !openclawConfigured && (
                <span className="text-rose-500 text-[10px]" title="AI 미설정">⚠️</span>
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

function AccountsTab({ accounts, loading, syncMsg, onSync, onOpenMgtUrl, onPull, onDelete, onDiagnose, onManualAdd, onRegistAccount, isSuperAdmin }) {
    // 일반 admin 에게는 [계좌 직접 등록] 만 노출. 다른 진출 경로는 혼란 방지로 숨김.
    // superadmin (디버그 권한) 에게는 보조 도구 함께 표시.
    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <button
                    onClick={onRegistAccount}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 transition-all shadow-sm"
                    title="셈하나에서 신한·국민 등 은행 계좌를 직접 등록합니다."
                >
                    <Plus size={14} />
                    계좌 직접 등록
                </button>

                {isSuperAdmin && (
                    <>
                        <span className="text-slate-300 text-xs px-1">|</span>
                        <span className="text-[10px] text-slate-400 self-center">SuperAdmin 도구:</span>
                        <button
                            onClick={onSync}
                            disabled={loading}
                            title="팝빌에 등록된 계좌 리스트 조회 → DB 동기화"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                            팝빌 동기화
                        </button>
                        <button
                            onClick={onManualAdd}
                            title="listBankAccount 권한 이슈 우회: 계좌 정보 수동 입력 (DB만, 팝빌 등록 X)"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-all"
                        >
                            <Plus size={12} />
                            DB 메타 추가
                        </button>
                        <button
                            onClick={onOpenMgtUrl}
                            title="팝빌 관리 페이지를 새 탭으로 열기"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs hover:bg-slate-200 transition-all"
                        >
                            <ExternalLink size={12} />
                            팝빌 관리
                        </button>
                        <button
                            onClick={onDiagnose}
                            title="팝빌 연결 상태를 상세히 진단합니다"
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-lg text-xs hover:bg-amber-100 transition-all ml-auto"
                        >
                            <Stethoscope size={12} />
                            진단
                        </button>
                    </>
                )}
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
                    <p className="text-xs text-slate-400 mt-1">
                        위 <span className="text-emerald-600 font-semibold">[계좌 직접 등록]</span> 버튼으로 신한·국민 등 은행 계좌를 등록해주세요.
                    </p>
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

function TransactionsTab({ txs, accounts, total, loading, summary, filter, setFilter, onApply, onUpdate, onAutoClassify, onReclassifySettlements, onAiSuggest, onAiBatch, onCodefHistorical }) {
    const [helpOpen, setHelpOpen] = useState(false);
    const [bulkSyncing, setBulkSyncing] = useState(false);

    // 월별 빠른 필터: filter.start_date/end_date 를 해당 월로 설정 + 즉시 fetch
    // setFilter 는 비동기라 onApply 가 이전 closure 를 잡는 race condition 회피 위해
    // 새 filter 를 onApply 에 직접 전달
    function applyMonthFilter(year, month) {
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const newFilter = { ...filter, start_date: start, end_date: end };
        setFilter(newFilter);
        onApply?.(newFilter);
    }

    function clearDateFilter() {
        const newFilter = { ...filter, start_date: '', end_date: '' };
        setFilter(newFilter);
        onApply?.(newFilter);
    }

    async function handleBulkSync() {
        const year = new Date().getFullYear();
        if (!confirm(
            `${year}년 1월부터 오늘까지 모든 계좌의 거래내역을 일괄 동기화합니다.\n`
            + `(팝빌에서 pull → 자동 분류 → 정산 재분류까지 한 번에)\n\n`
            + `이미 가져온 거래는 중복 제외됩니다. 계속할까요?`
        )) return;
        setBulkSyncing(true);
        try {
            const res = await api.post('/bank-sync/pull-monthly-bulk', {
                year,
                start_month: 1,
                auto_reclassify_settlements: true,
            });
            const t = res.data.totals;
            const sr = res.data.settlement_reclassify;
            const skipped = res.data.skipped_months || [];
            alert(
                `일괄 동기화 완료 (${year}년)\n\n`
                + `총 조회 ${t.fetched}건 · 신규 ${t.inserted}건 · 중복 ${t.duplicated}건\n`
                + (sr
                    ? `정산 재분류: 카드 ${sr.card_settlement} · 페이 ${sr.pay_settlement} · 배달 ${sr.delivery_settlement} · 이동식 ${sr.mobile_settlement}\n`
                    + `(이미 정확 ${sr.already_correct} · 수동분류 보호 ${sr.skipped_manual} · 미매칭 ${sr.skipped_no_match})\n`
                    : '')
                + (skipped.length > 0
                    ? `\n⚠️ ${skipped.join(', ')} 은 popbill 3개월 한도 초과로 자동 동기화 불가.\n신한 인터넷뱅킹에서 거래내역 Excel 다운로드 후 별도 업로드 필요.`
                    : '')
            );
            onApply?.();
        } catch (e) {
            alert('일괄 동기화 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setBulkSyncing(false);
        }
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const isMonthActive = (m) => filter.start_date === `${currentYear}-${String(m).padStart(2, '0')}-01`;
    return (
        <div>
            {/* 월별 빠른 필터 + 일괄 동기화 */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500 font-semibold">월별:</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                    const past = m > currentMonth;
                    const active = isMonthActive(m);
                    return (
                        <button
                            key={m}
                            onClick={() => applyMonthFilter(currentYear, m)}
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
                    onClick={clearDateFilter}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        !filter.start_date && !filter.end_date
                            ? 'bg-slate-800 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    전체
                </button>
                <span className="text-slate-300 mx-2">|</span>
                <button
                    onClick={handleBulkSync}
                    disabled={bulkSyncing}
                    title={`${currentYear}년 1월~오늘 모든 계좌 거래내역 popbill 에서 일괄 가져오기 + 자동 분류 + 정산 재분류`}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg text-xs font-semibold hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50"
                >
                    {bulkSyncing ? <Loader2 className="animate-spin" size={12} /> : <Download size={12} />}
                    {bulkSyncing ? '동기화 중...' : `${currentYear}년 전체 동기화`}
                </button>
            </div>

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
                        <button
                            onClick={onReclassifySettlements}
                            title="입금 거래 중 카드사/페이/배달앱 키워드 매칭 건을 강제로 재분류 (기존 분류 무시)"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700"
                        >
                            <RefreshCw size={12} /> 정산 재분류
                        </button>
                        <button
                            onClick={onAiBatch}
                            title="미분류 거래에 AI(Ollama qwen2.5:7b) 분류 제안 일괄 실행. 신뢰도 70%↑만 자동 적용"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white rounded-lg text-xs font-semibold hover:from-fuchsia-700 hover:to-rose-700"
                        >
                            <Sparkles size={12} /> AI 분류
                        </button>
                        <button
                            onClick={() => setHelpOpen(true)}
                            title="입금 분류 가이드 — 현금매출·현금입금·차입금·기타입금 사용법"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-50"
                        >
                            <HelpCircle size={12} /> 분류 가이드
                        </button>
                        {onCodefHistorical && (
                            <button
                                onClick={onCodefHistorical}
                                title="popbill 3개월 한도 이전 거래 (예: 2026-01, 2026-02) 를 CODEF 마이데이터로 가져옴"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-xs font-semibold hover:from-teal-700 hover:to-cyan-700"
                            >
                                <Download size={12} /> 과거 거래 (CODEF)
                            </button>
                        )}
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
                                        <div className="flex items-center gap-1">
                                            <select
                                                value={tx.classified_as}
                                                onChange={e => onUpdate(tx, { classified_as: e.target.value })}
                                                className={`px-2 py-1 rounded-full text-xs font-semibold border-0 cursor-pointer ${CLASSIFIED_LABELS[tx.classified_as]?.color || ''}`}
                                            >
                                                {Object.entries(CLASSIFIED_LABELS).map(([k, v]) => (
                                                    <option key={k} value={k}>{v.label}</option>
                                                ))}
                                            </select>
                                            {onAiSuggest && (
                                                <button
                                                    onClick={() => onAiSuggest(tx)}
                                                    title="AI(qwen2.5:7b) 분류 제안 받기"
                                                    className="p-1 text-fuchsia-500 hover:text-fuchsia-700 hover:bg-fuchsia-50 rounded transition-colors"
                                                >
                                                    <Sparkles size={14} />
                                                </button>
                                            )}
                                        </div>
                                        {tx.classified_by && (
                                            <div className="text-[10px] text-slate-400 mt-1">
                                                {tx.classified_by === 'auto' ? '자동'
                                                    : tx.classified_by === 'manual' ? '수동'
                                                    : tx.classified_by === 'ai_qwen' ? 'AI'
                                                    : tx.classified_by}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {helpOpen && (
                <HelpModal
                    title={DEPOSIT_GUIDE_TITLE}
                    markdown={DEPOSIT_GUIDE_MD}
                    onClose={() => setHelpOpen(false)}
                />
            )}
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
    const [pgModalOpen, setPgModalOpen] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

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
                    <button
                        onClick={() => setHelpOpen(true)}
                        title="이동식 카드매출 설정 가이드"
                        className="px-2 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
                    >
                        <HelpCircle size={14} className="inline mr-1" /> 도움말
                    </button>
                    <button
                        onClick={() => setPgModalOpen(true)}
                        title="코페이/KSnet 등 이동식 단말기 PG 등록·수수료율 조정"
                        className="px-3 py-2 bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-sm font-semibold hover:bg-sky-200"
                    >
                        📱 이동식 PG 설정
                    </button>
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

            {pgModalOpen && <MobilePgManagerModal onClose={() => setPgModalOpen(false)} />}
            {helpOpen && (
                <HelpModal
                    title={MOBILE_PG_GUIDE_TITLE}
                    markdown={MOBILE_PG_GUIDE_MD}
                    onClose={() => setHelpOpen(false)}
                />
            )}

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
                        title="📱 이동식 카드매출 (코페이 등)"
                        rows={data.mobile}
                        corpLabel="이동식PG"
                        emptyMsg="이번 달 이동식 단말기 카드매출이 없습니다. 매출은 수수료 역산 자동 적용 (KOPAY_COMMISSION_RATE 환경변수 조정 가능)."
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

// 이동식 단말기 PG 설정 관리자 모달 — 사장님이 직접 CRUD
// 코페이/KSnet/키움페이 등 사업장별로 등록·수수료율 조정 가능
function MobilePgManagerModal({ onClose }) {
    const [pgs, setPgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(null); // {id?, name, keyword, commission_pct, note, is_active}
    const [saving, setSaving] = useState(false);
    const [helpOpen, setHelpOpen] = useState(false);

    async function load() {
        setLoading(true);
        try {
            const res = await api.get('/bank-sync/mobile-pgs');
            setPgs(res.data);
        } catch (e) {
            alert('로드 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function startNew() {
        setEditing({ name: '', keyword: '', commission_pct: 2.75, note: '', is_active: true });
    }

    function startEdit(pg) {
        setEditing({
            id: pg.id,
            name: pg.name,
            keyword: pg.keyword,
            commission_pct: (pg.commission_rate * 100).toFixed(3).replace(/\.?0+$/, ''),
            note: pg.note || '',
            is_active: pg.is_active,
        });
    }

    async function save() {
        if (!editing.name?.trim() || !editing.keyword?.trim()) {
            alert('표시명·키워드는 필수입니다.');
            return;
        }
        const rate = parseFloat(editing.commission_pct) / 100;
        if (!(rate >= 0 && rate <= 0.2)) {
            alert('수수료율은 0~20% 사이로 입력하세요.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                name: editing.name.trim(),
                keyword: editing.keyword.trim(),
                commission_rate: rate,
                note: editing.note?.trim() || null,
                is_active: editing.is_active,
            };
            if (editing.id) {
                await api.patch(`/bank-sync/mobile-pgs/${editing.id}`, payload);
            } else {
                await api.post('/bank-sync/mobile-pgs', payload);
            }
            setEditing(null);
            await load();
        } catch (e) {
            alert('저장 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setSaving(false);
        }
    }

    async function removePg(pg) {
        if (!confirm(`'${pg.name}' PG 설정을 삭제할까요?\n(이미 분류된 과거 거래는 그대로 유지됩니다)`)) return;
        try {
            await api.delete(`/bank-sync/mobile-pgs/${pg.id}`);
            await load();
        } catch (e) {
            alert('삭제 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function toggleActive(pg) {
        try {
            await api.patch(`/bank-sync/mobile-pgs/${pg.id}`, { is_active: !pg.is_active });
            await load();
        } catch (e) {
            alert('토글 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-sky-500 to-cyan-500 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">📱 이동식 단말기 PG 설정</h3>
                        <p className="text-xs text-sky-100 mt-0.5">
                            코페이·KSnet·키움페이 등. 적요 키워드로 자동 매칭 + 수수료율로 매출 역산.
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setHelpOpen(true)}
                            title="설정 가이드"
                            className="hover:bg-white/10 p-1.5 rounded transition-colors"
                        >
                            <HelpCircle size={18} />
                        </button>
                        <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded">
                            <XIcon size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {editing ? (
                        <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-3 border border-slate-200">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-slate-800">{editing.id ? 'PG 수정' : '새 PG 등록'}</h4>
                                <button
                                    onClick={() => setEditing(null)}
                                    className="text-slate-400 hover:text-slate-600 text-xs"
                                >취소</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">표시명 *</label>
                                    <input
                                        type="text"
                                        value={editing.name}
                                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                                        placeholder="코페이"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">적요 매칭 키워드 *</label>
                                    <input
                                        type="text"
                                        value={editing.keyword}
                                        onChange={e => setEditing({ ...editing, keyword: e.target.value })}
                                        placeholder="코페이"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 mb-1 block">수수료율 (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max="20"
                                        value={editing.commission_pct}
                                        onChange={e => setEditing({ ...editing, commission_pct: e.target.value })}
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">예: 2.75 = 2.75%</p>
                                </div>
                                <div className="flex items-end">
                                    <label className="flex items-center gap-2 text-sm text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={editing.is_active}
                                            onChange={e => setEditing({ ...editing, is_active: e.target.checked })}
                                        />
                                        활성 (분류에 사용)
                                    </label>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                                    <input
                                        type="text"
                                        value={editing.note}
                                        onChange={e => setEditing({ ...editing, note: e.target.value })}
                                        placeholder="2026-05 명세서 기준 등"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={save}
                                disabled={saving}
                                className="w-full mt-2 px-4 py-2 bg-sky-600 text-white rounded-lg text-sm font-semibold hover:bg-sky-700 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="animate-spin inline mr-1" size={14} /> : <CheckCircle2 className="inline mr-1" size={14} />}
                                저장
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={startNew}
                            className="w-full mb-3 px-4 py-2.5 border-2 border-dashed border-sky-300 text-sky-600 rounded-xl text-sm font-semibold hover:bg-sky-50"
                        >
                            <Plus size={16} className="inline mr-1" /> 새 PG 추가 (예: KSnet, 키움페이)
                        </button>
                    )}

                    {loading ? (
                        <div className="text-center py-8 text-slate-400">
                            <Loader2 className="animate-spin inline mr-2" size={16} /> 로딩 중...
                        </div>
                    ) : pgs.length === 0 && !editing ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                            등록된 PG가 없습니다. 시스템은 코페이만 기본 인식하므로 다른 이동식 단말기(KSnet, 키움페이, 한국정보통신 등)를
                            쓰시면 위 "새 PG 추가" 버튼으로 등록해주세요.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pgs.map(pg => (
                                <div
                                    key={pg.id}
                                    className={`flex items-center gap-3 p-3 rounded-xl border ${pg.is_active ? 'bg-white border-sky-200' : 'bg-slate-50 border-slate-200 opacity-60'}`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-slate-800">{pg.name}</span>
                                            <span className="text-xs text-slate-500">키워드: <code className="bg-slate-100 px-1.5 py-0.5 rounded">{pg.keyword}</code></span>
                                        </div>
                                        <div className="text-xs text-slate-600 mt-1">
                                            수수료율 <span className="font-mono font-bold">{pg.commission_pct}%</span>
                                            {pg.note && <span className="text-slate-400 ml-3">— {pg.note}</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => toggleActive(pg)}
                                        title={pg.is_active ? '비활성화' : '활성화'}
                                        className={`px-2 py-1 rounded text-xs ${pg.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                                    >
                                        {pg.is_active ? '활성' : '비활성'}
                                    </button>
                                    <button
                                        onClick={() => startEdit(pg)}
                                        className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded"
                                    >
                                        수정
                                    </button>
                                    <button
                                        onClick={() => removePg(pg)}
                                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                    <span>💡 등록 후 거래내역 탭의 [정산 재분류] 를 실행하면 과거 거래도 자동 재분류됩니다.</span>
                    <button
                        onClick={() => setHelpOpen(true)}
                        className="text-sky-600 hover:text-sky-700 hover:underline font-semibold"
                    >
                        자세한 가이드 →
                    </button>
                </div>
            </div>

            {helpOpen && (
                <HelpModal
                    title={MOBILE_PG_GUIDE_TITLE}
                    markdown={MOBILE_PG_GUIDE_MD}
                    onClose={() => setHelpOpen(false)}
                />
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


// ============================================================
// AI 감사 탭 (2026-05-12 Phase 2)
// 이미 분류된 거래에 대해 AI가 다른 분류를 고신뢰도로 제안하면 의심으로 플래그
// ============================================================

function AuditTab({ accounts, onRefreshTxs, aiModel }) {
    const today = new Date().toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const [filter, setFilter] = useState({
        account_id: '',
        start_date: monthAgo,
        end_date: today,
        max_items: 100,
        min_disagreement_confidence: 0.75,
        skip_manual: true,
    });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [selected, setSelected] = useState({});
    const [applying, setApplying] = useState(false);

    async function runAudit() {
        setLoading(true);
        setResult(null);
        setSelected({});
        try {
            const body = {
                account_id: filter.account_id ? parseInt(filter.account_id) : null,
                start_date: filter.start_date || null,
                end_date: filter.end_date || null,
                max_items: parseInt(filter.max_items) || 100,
                min_disagreement_confidence: parseFloat(filter.min_disagreement_confidence) || 0.75,
                skip_manual: filter.skip_manual,
                provider: aiModel?.provider,
                model: aiModel?.model,
            };
            const res = await api.post('/bank-sync/audit/run', body);
            setResult(res.data);
            const sel = {};
            res.data.suspicious.forEach(s => { sel[s.tx_id] = true; });
            setSelected(sel);
        } catch (e) {
            alert('감사 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setLoading(false);
        }
    }

    async function applySelected() {
        const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => parseInt(k));
        if (ids.length === 0) {
            alert('적용할 항목을 선택하세요.');
            return;
        }
        if (!confirm(`선택된 ${ids.length}건의 AI 제안 분류를 적용합니다. 계속할까요?\n(수동 분류 거래는 보호됩니다)`)) return;
        setApplying(true);
        try {
            const res = await api.post('/bank-sync/audit/apply', {
                tx_ids: ids,
                provider: aiModel?.provider,
                model: aiModel?.model,
            });
            alert(`적용 완료: ${res.data.applied}건 / 스킵 ${res.data.skipped} / 오류 ${res.data.errors}`);
            onRefreshTxs?.();
            runAudit();
        } catch (e) {
            alert('적용 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setApplying(false);
        }
    }

    const allSelected = result && result.suspicious.length > 0 && result.suspicious.every(s => selected[s.tx_id]);

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-fuchsia-50 to-rose-50 border border-fuchsia-200 rounded-xl p-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Sparkles size={18} className="text-fuchsia-600" />
                    AI 분류 감사
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                    이미 분류된 거래에 대해 AI(qwen2.5:7b)가 다른 분류를 <strong>고신뢰도</strong>로 제안하는 케이스만 표시합니다.
                    자동 변경은 없으며, 체크박스로 선택하여 수동 승인합니다. 수동 분류된 거래는 검사에서 제외됩니다.
                </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">계좌</label>
                        <select
                            value={filter.account_id}
                            onChange={e => setFilter({ ...filter, account_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            <option value="">전체</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.bank_name} {a.account_number_masked}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">시작일</label>
                        <input type="date" value={filter.start_date}
                            onChange={e => setFilter({ ...filter, start_date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">종료일</label>
                        <input type="date" value={filter.end_date}
                            onChange={e => setFilter({ ...filter, end_date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">최대 검사 건수</label>
                        <input type="number" min={10} max={300} step={10} value={filter.max_items}
                            onChange={e => setFilter({ ...filter, max_items: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                    </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                    <label className="flex items-center gap-1">
                        <span className="text-xs text-slate-500">의심 신뢰도 임계</span>
                        <input type="number" min={0.5} max={0.99} step={0.05}
                            value={filter.min_disagreement_confidence}
                            onChange={e => setFilter({ ...filter, min_disagreement_confidence: e.target.value })}
                            className="w-20 px-2 py-1 border border-slate-200 rounded text-xs ml-1" />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-600">
                        <input type="checkbox" checked={filter.skip_manual}
                            onChange={e => setFilter({ ...filter, skip_manual: e.target.checked })} />
                        수동 분류 거래 검사 제외 (권장)
                    </label>
                    <button
                        onClick={runAudit}
                        disabled={loading}
                        className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-rose-600 text-white rounded-lg text-sm font-semibold hover:from-fuchsia-700 hover:to-rose-700 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        {loading ? '감사 중...' : '감사 실행'}
                    </button>
                </div>
            </div>

            {result && !loading && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="text-sm">
                            <span className="font-semibold">검사 {result.processed}건</span>
                            <span className="text-slate-400 mx-2">·</span>
                            <span className="text-rose-600 font-semibold">의심 {result.suspicious_count}건</span>
                            {result.errors > 0 && (
                                <>
                                    <span className="text-slate-400 mx-2">·</span>
                                    <span className="text-amber-600">오류 {result.errors}건</span>
                                </>
                            )}
                        </div>
                        {result.suspicious_count > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => {
                                        const sel = {};
                                        if (!allSelected) {
                                            result.suspicious.forEach(s => { sel[s.tx_id] = true; });
                                        }
                                        setSelected(sel);
                                    }}
                                    className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
                                >
                                    {allSelected ? '전체 해제' : '전체 선택'}
                                </button>
                                <button
                                    onClick={applySelected}
                                    disabled={applying}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                                >
                                    {applying ? <Loader2 className="animate-spin" size={12} /> : <CheckCircle2 size={12} />}
                                    선택 적용 ({Object.values(selected).filter(Boolean).length})
                                </button>
                            </div>
                        )}
                    </div>

                    {result.suspicious_count === 0 ? (
                        <div className="p-10 text-center text-slate-400">
                            <CheckCircle2 className="inline mr-2" size={18} />
                            의심 케이스가 없습니다. 분류가 일관성 있게 잘 되어 있습니다.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                                    <tr>
                                        <th className="px-3 py-2 w-8"></th>
                                        <th className="text-left px-3 py-2">날짜</th>
                                        <th className="text-left px-3 py-2">적요</th>
                                        <th className="text-right px-3 py-2">금액</th>
                                        <th className="text-left px-3 py-2">현재</th>
                                        <th className="text-left px-3 py-2">AI 제안</th>
                                        <th className="text-right px-3 py-2">신뢰도</th>
                                        <th className="text-left px-3 py-2">근거</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {result.suspicious.map(s => {
                                        const curLabel = CLASSIFIED_LABELS[s.current_class]?.label || s.current_class;
                                        const curColor = CLASSIFIED_LABELS[s.current_class]?.color || '';
                                        const aiLabel = CLASSIFIED_LABELS[s.ai_class]?.label || s.ai_class;
                                        const aiColor = CLASSIFIED_LABELS[s.ai_class]?.color || '';
                                        const confidence = Math.round(s.ai_confidence * 100);
                                        return (
                                            <tr key={s.tx_id} className="hover:bg-slate-50/50">
                                                <td className="px-3 py-2 text-center">
                                                    <input type="checkbox"
                                                        checked={!!selected[s.tx_id]}
                                                        onChange={e => setSelected({ ...selected, [s.tx_id]: e.target.checked })} />
                                                </td>
                                                <td className="px-3 py-2 text-xs text-slate-600">{fmtDate(s.trans_date)}</td>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{s.remark1}</div>
                                                    {s.remark2 && <div className="text-xs text-slate-400">{s.remark2}</div>}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-xs">
                                                    {s.in_amount > 0 && <span className="text-emerald-600">+{s.in_amount.toLocaleString()}</span>}
                                                    {s.out_amount > 0 && <span className="text-rose-600">-{s.out_amount.toLocaleString()}</span>}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${curColor}`}>{curLabel}</span>
                                                    <div className="text-[10px] text-slate-400 mt-0.5">{s.current_classified_by}</div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${aiColor}`}>{aiLabel}</span>
                                                    {s.ai_standard_name && <div className="text-[10px] text-slate-500 mt-0.5">{s.ai_standard_name}</div>}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    <span className={`font-bold text-sm ${confidence >= 80 ? 'text-emerald-600' : confidence >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{confidence}%</span>
                                                </td>
                                                <td className="px-3 py-2 text-xs text-slate-600 max-w-xs">{s.ai_reason}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


// ============================================================
// AI 분석 탭 (2026-05-12 Phase 3)
// 자연어 질의 → 사업장 재무 컨텍스트 자동 수집 → LLM 분석
// ============================================================

const CHAT_SUGGESTIONS = [
    "이번 달 카드 수수료율이 지난 달 대비 어떻게 됐어?",
    "최근 3개월 배달앱 매출 추이 알려줘",
    "페이 결제 비중이 늘었는지 줄었는지 분석해줘",
    "분류가 가장 많은 카테고리 3개와 비중은?",
    "수수료를 가장 많이 떼는 채널은 어디야?",
];

function ChatTab({ aiModel }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [contextSummary, setContextSummary] = useState(null);
    const [modelUsed, setModelUsed] = useState(null);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, sending]);

    async function send(text) {
        const q = (text ?? input).trim();
        if (!q || sending) return;
        const next = [...messages, { role: 'user', content: q }];
        setMessages(next);
        setInput('');
        setSending(true);
        try {
            const res = await api.post('/bank-sync/chat', {
                messages: next,
                provider: aiModel?.provider,
                model: aiModel?.model,
            });
            setMessages([...next, { role: 'assistant', content: res.data.answer }]);
            setContextSummary(res.data.context_summary);
            setModelUsed(res.data.model_used);
        } catch (e) {
            setMessages([...next, {
                role: 'assistant',
                content: `❌ 분석 실패: ${e.response?.data?.detail || e.message}`,
                error: true,
            }]);
        } finally {
            setSending(false);
        }
    }

    function reset() {
        setMessages([]);
        setContextSummary(null);
    }

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-indigo-50 to-fuchsia-50 border border-indigo-200 rounded-xl p-4">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-600" />
                    AI 재무 분석
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                    사업장의 카드/페이/배달 정산, 수수료율, 분류 분포 등 데이터를 기반으로
                    자연어 질문에 답합니다. (qwen2.5:7b — 로컬, 무료)
                </p>
                {contextSummary && (
                    <div className="mt-2 text-[11px] text-slate-500 font-mono">
                        분석 컨텍스트: {contextSummary.months.join(', ')} · 계좌 {contextSummary.accounts}개 · 거래 {contextSummary.total_transactions}건
                        {modelUsed && <span className="ml-2 text-indigo-500">[{modelUsed}]</span>}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col" style={{ height: '60vh', minHeight: 400 }}>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <MessageSquare size={32} className="mb-2 opacity-40" />
                            <p className="text-sm mb-4">아래 추천 질문을 클릭하거나 직접 질문해보세요.</p>
                            <div className="flex flex-wrap gap-2 max-w-2xl justify-center">
                                {CHAT_SUGGESTIONS.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => send(s)}
                                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 rounded-full transition-colors"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((m, i) => (
                            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-2xl px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                                    m.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-sm'
                                        : m.error
                                            ? 'bg-rose-50 border border-rose-200 text-rose-700'
                                            : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                                }`}>
                                    {m.content}
                                </div>
                            </div>
                        ))
                    )}
                    {sending && (
                        <div className="flex justify-start">
                            <div className="bg-slate-100 px-4 py-2.5 rounded-2xl">
                                <Loader2 className="animate-spin inline mr-2 text-slate-400" size={14} />
                                <span className="text-xs text-slate-500">분석 중...</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t border-slate-100 p-3">
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                            disabled={sending}
                            placeholder="질문을 입력하세요... (예: 이번 달 카드 수수료율이 왜 올랐어?)"
                            className="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400 disabled:bg-slate-50"
                        />
                        {messages.length > 0 && (
                            <button
                                onClick={reset}
                                title="대화 초기화"
                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                            >
                                <RefreshCw size={14} />
                            </button>
                        )}
                        <button
                            onClick={() => send()}
                            disabled={sending || !input.trim()}
                            className="flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 text-white rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-fuchsia-700 disabled:opacity-50"
                        >
                            <Send size={14} />
                            전송
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// 계좌 직접 등록 모달 (2026-05-13) — RegistBankAccount API
// 팝빌 사이트 안 들어가고 셈하나에서 직접 등록
// ============================================================

function RegistAccountModal({ bankNames, onClose, onSuccess }) {
    const [form, setForm] = useState({
        bank_code: '0088',          // 기본 신한
        account_number: '',
        account_pwd: '',
        account_type: '법인',
        identity_number: '',
        fast_id: '',
        fast_pwd: '',
        bank_id: '',
        account_name: '',
        use_period: 11,
        memo: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPwd, setShowPwd] = useState(false);

    const bankList = bankNames ? Object.entries(bankNames) : [['0088', '신한은행']];
    const fastRequiredBanks = ['0088', '0031', '0048'];
    const bankIdRequiredBanks = ['0004'];
    const fastRequired = fastRequiredBanks.includes(form.bank_code);
    const bankIdRequired = bankIdRequiredBanks.includes(form.bank_code);

    async function submit(e) {
        e?.preventDefault();
        setError(null);
        if (!form.account_number || !form.account_pwd || !form.identity_number) {
            setError('계좌번호·계좌비밀번호·실명번호는 필수입니다.');
            return;
        }
        if (form.account_pwd.length !== 4) {
            setError('계좌 비밀번호는 4자리여야 합니다.');
            return;
        }
        if (fastRequired && (!form.fast_id || !form.fast_pwd)) {
            setError(`${bankNames?.[form.bank_code] || form.bank_code} 은 조회전용 ID/비밀번호 필수입니다.`);
            return;
        }
        if (bankIdRequired && !form.bank_id) {
            setError('국민은행은 인터넷뱅킹 ID 필수입니다.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                bank_code: form.bank_code,
                account_number: form.account_number.replace(/\D/g, ''),
                account_pwd: form.account_pwd,
                account_type: form.account_type,
                identity_number: form.identity_number.replace(/\D/g, ''),
                fast_id: form.fast_id || null,
                fast_pwd: form.fast_pwd || null,
                bank_id: form.bank_id || null,
                account_name: form.account_name || null,
                use_period: parseInt(form.use_period) || 11,
                memo: form.memo || null,
            };
            const res = await api.post('/bank-sync/accounts/regist', payload);
            alert(
                `계좌 등록 성공 ${res.data.created ? '(신규)' : '(이미 등록됨)'}\n`
                + `${res.data.account.bank_name} ${res.data.account.account_number_masked}\n`
                + (res.data.popbill_message ? `\n팝빌 응답: ${res.data.popbill_message}` : '')
            );
            onSuccess?.();
        } catch (e) {
            setError(e.response?.data?.detail || e.message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">🏦 계좌 직접 등록</h3>
                        <p className="text-xs text-emerald-100 mt-0.5">
                            팝빌 사이트 안 들어가고 셈하나에서 바로 등록 (RegistBankAccount API)
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">은행 *</label>
                            <select
                                value={form.bank_code}
                                onChange={e => setForm({ ...form, bank_code: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            >
                                {bankList.map(([code, name]) => (
                                    <option key={code} value={code}>{name} ({code})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌 구분 *</label>
                            <select
                                value={form.account_type}
                                onChange={e => setForm({ ...form, account_type: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                            >
                                <option value="법인">법인</option>
                                <option value="개인">개인</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌번호 * (하이픈 자동 제거)</label>
                            <input type="text" value={form.account_number}
                                onChange={e => setForm({ ...form, account_number: e.target.value })}
                                placeholder="110-357-745538"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌 비밀번호 * (4자리)</label>
                            <input
                                type={showPwd ? 'text' : 'password'}
                                value={form.account_pwd}
                                maxLength={4}
                                onChange={e => setForm({ ...form, account_pwd: e.target.value.replace(/\D/g, '') })}
                                placeholder="••••"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-slate-500 mb-1 block">
                                실명번호 * (법인: 사업자번호 / 개인: 생년월일 yyMMdd)
                            </label>
                            <input type="text" value={form.identity_number}
                                onChange={e => setForm({ ...form, identity_number: e.target.value })}
                                placeholder="639-12-01514"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono" />
                        </div>
                    </div>

                    {fastRequired && (
                        <div className="border-l-4 border-amber-300 bg-amber-50 rounded-r p-3">
                            <div className="text-xs font-bold text-amber-800 mb-2">
                                🔐 {bankNames?.[form.bank_code] || form.bank_code} 은 조회전용 계정 필수
                            </div>
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
                        </div>
                    )}

                    {bankIdRequired && (
                        <div className="border-l-4 border-amber-300 bg-amber-50 rounded-r p-3">
                            <div className="text-xs font-bold text-amber-800 mb-2">
                                🔐 국민은행은 인터넷뱅킹 ID 필수
                            </div>
                            <div>
                                <label className="text-xs text-slate-500 mb-1 block">인터넷뱅킹 ID *</label>
                                <input type="text" value={form.bank_id}
                                    onChange={e => setForm({ ...form, bank_id: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                            </div>
                        </div>
                    )}

                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        <input type="checkbox" checked={showPwd}
                            onChange={e => setShowPwd(e.target.checked)} />
                        비밀번호 표시
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">계좌 별칭 (선택)</label>
                            <input type="text" value={form.account_name}
                                onChange={e => setForm({ ...form, account_name: e.target.value })}
                                placeholder="예: 소담신한본점"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 mb-1 block">정액제 개월수 (1~12, 기본 11)</label>
                            <input type="number" min={1} max={12} value={form.use_period}
                                onChange={e => setForm({ ...form, use_period: e.target.value })}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div className="md:col-span-2">
                            <label className="text-xs text-slate-500 mb-1 block">메모 (선택)</label>
                            <input type="text" value={form.memo}
                                onChange={e => setForm({ ...form, memo: e.target.value })}
                                placeholder="예: 본점 매출 정산 계좌"
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                        </div>
                    </div>

                    <div className="text-[11px] text-slate-500 bg-slate-50 rounded p-2">
                        🔒 자격증명(비밀번호·조회전용 ID/PW)은 팝빌 API 로 즉시 전송 후 셈하나 서버에 절대 저장되지 않습니다.
                    </div>
                </form>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-white"
                    >
                        취소
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                        팝빌에 등록
                    </button>
                </div>
            </div>
        </div>
    );
}


// ============================================================
// CODEF 과거 거래 가져오기 모달 (2026-05-13)
// popbill 3개월 한도 우회 — 마이데이터 기반 더 긴 기간 조회
// ============================================================

function CodefHistoricalModal({ accounts, onClose, onSuccess }) {
    const [form, setForm] = useState({
        account_id: accounts[0]?.id || '',
        fast_id: '',
        fast_pwd: '',
        start_date: '2026-01-01',
        end_date: '2026-02-11',
        client_type: 'B',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [showPwd, setShowPwd] = useState(false);

    const selectedAcc = accounts.find(a => a.id == form.account_id);

    async function submit(e) {
        e?.preventDefault();
        setError(null);
        if (!form.account_id) { setError('계좌를 선택하세요.'); return; }
        if (!form.fast_id || !form.fast_pwd) {
            setError('조회전용 ID/비밀번호는 필수입니다.');
            return;
        }
        if (!form.start_date || !form.end_date) {
            setError('시작일/종료일은 필수입니다.');
            return;
        }
        setSubmitting(true);
        try {
            const payload = {
                account_id: parseInt(form.account_id),
                fast_id: form.fast_id,
                fast_pwd: form.fast_pwd,
                start_date: form.start_date,
                end_date: form.end_date,
                client_type: form.client_type,
            };
            const res = await api.post('/bank-sync/codef-pull-historical', payload);
            alert(
                `CODEF 과거 거래 가져오기 완료\n`
                + `기간: ${res.data.start_date} ~ ${res.data.end_date}\n`
                + `총 조회 ${res.data.total_fetched}건 · 신규 ${res.data.inserted}건 · 중복 ${res.data.duplicated}건`
            );
            onSuccess?.();
        } catch (e) {
            const status = e.response?.status;
            const detail = e.response?.data?.detail || e.message;
            if (status === 428) {
                setError('CODEF 추가본인확인 (SMS/캡차) 필요 — 신한은행 보안 설정 검토 필요.');
            } else if (status === 401) {
                setError('인증 실패: 조회전용 ID/PW 가 잘못되었거나 신한은행 측 차단.');
            } else {
                setError(detail);
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                <div className="px-5 py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white flex items-center justify-between">
                    <div>
                        <h3 className="font-bold flex items-center gap-2">📥 CODEF 과거 거래 가져오기</h3>
                        <p className="text-xs text-teal-100 mt-0.5">
                            popbill 3개월 한도 이전 거래 (예: 2026-01·02월) 를 마이데이터로 일괄 pull
                        </p>
                    </div>
                    <button onClick={onClose} className="hover:bg-white/10 p-1 rounded">
                        <XIcon size={18} />
                    </button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-3">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700">
                            <AlertCircle size={14} className="inline mr-1" />
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="text-xs text-slate-500 mb-1 block">대상 계좌 *</label>
                        <select
                            value={form.account_id}
                            onChange={e => setForm({ ...form, account_id: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                        >
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.bank_name} {a.account_number_masked} {a.alias && `(${a.alias})`}
                                </option>
                            ))}
                        </select>
                    </div>

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

                    <div className="border-l-4 border-amber-300 bg-amber-50 rounded-r p-3">
                        <div className="text-xs font-bold text-amber-800 mb-2">
                            🔐 신한은행 조회전용 계정 (popbill 등록 시 사용한 정보와 동일)
                        </div>
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
                            <input type="checkbox" checked={showPwd}
                                onChange={e => setShowPwd(e.target.checked)} />
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
                        🔒 자격증명은 CODEF API 로 즉시 암호화 전송 후 셈하나 서버에 저장되지 않습니다.
                        connectedId 만 DB 에 저장되어 다음부터는 자동 사용됩니다.
                    </div>
                </form>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex gap-2 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-semibold hover:bg-white"
                    >
                        취소
                    </button>
                    <button
                        onClick={submit}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg text-sm font-semibold hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        CODEF 로 가져오기
                    </button>
                </div>
            </div>
        </div>
    );
}

