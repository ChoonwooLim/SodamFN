import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Store, KeyRound, RefreshCw, Loader2, CheckCircle2,
    AlertCircle, Calendar as CalIcon, History, X as XIcon, Trash2,
    PlayCircle, Info,
} from 'lucide-react';
import api from '../api';
import { fmtWon, fmtDate } from './BankSync';

/**
 * 이지포스(KICC smart.easypos.net) POS 매출 자동수집 페이지.
 *
 * /external-integration/easypos
 *   - 자격증명 등록 (ID/PW) — Fernet 암호화 후 DB 보관
 *   - 로그인 테스트 — 매장명/POS 목록 확인
 *   - 수동 동기화 — 단일 일자 / 범위(최대 31일)
 *   - 자동수집: Orbitron cron 매일 03:00 KST → 전일 매출
 *   - 동기화 이력 테이블
 */
export default function EasyPosModuleDetail() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const ymd = (d) => d.toISOString().slice(0, 10);

    const [cred, setCred] = useState(null);          // {registered, ...}
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [credModalOpen, setCredModalOpen] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    // 수동 동기화 폼
    const [syncMode, setSyncMode] = useState('single'); // 'single' | 'range'
    const [singleDate, setSingleDate] = useState(ymd(yesterday));
    const [startDate, setStartDate] = useState(ymd(yesterday));
    const [endDate, setEndDate] = useState(ymd(yesterday));

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [credRes, logRes] = await Promise.all([
                api.get('/easypos/credential'),
                api.get('/easypos/sync/logs', { params: { limit: 30 } }).catch(() => ({ data: [] })),
            ]);
            setCred(credRes.data || { registered: false });
            setLogs(logRes.data || []);
        } catch (e) {
            setErr(e.response?.data?.detail || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const showMsg = (text) => {
        setMsg(text);
        setErr('');
        setTimeout(() => setMsg(''), 4000);
    };
    const showErr = (text) => {
        setErr(text);
        setMsg('');
    };

    // ─── 자격증명 등록 ───
    async function handleSaveCredential(easyposId, password) {
        try {
            const res = await api.post('/easypos/credential', {
                easypos_id: easyposId,
                password,
            });
            setCred({ registered: true, ...res.data });
            setCredModalOpen(false);
            showMsg('자격증명이 안전하게 저장되었습니다.');
        } catch (e) {
            showErr('저장 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function handleDeleteCredential() {
        if (!window.confirm('이지포스 자격증명을 삭제하시겠습니까?\n자동수집이 중단되고, 다시 등록해야 수집이 재개됩니다.')) return;
        try {
            await api.delete('/easypos/credential');
            setCred({ registered: false });
            setTestResult(null);
            showMsg('자격증명을 삭제했습니다.');
        } catch (e) {
            showErr('삭제 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    // ─── 로그인 테스트 ───
    async function handleTestLogin() {
        setTesting(true);
        setTestResult(null);
        setErr('');
        try {
            const res = await api.post('/easypos/test-login');
            setTestResult(res.data);
            if (res.data.warning_message) {
                showMsg(`로그인 성공! (경고: ${res.data.warning_message})`);
            } else {
                showMsg('로그인 성공!');
            }
            // 자격증명 상태도 새로 가져옴 (verified_at 갱신)
            const credRes = await api.get('/easypos/credential');
            setCred(credRes.data);
        } catch (e) {
            showErr('로그인 실패: ' + (e.response?.data?.detail || e.message));
            setTestResult({ ok: false });
        } finally {
            setTesting(false);
        }
    }

    // ─── 수동 동기화 ───
    async function handleManualSync() {
        const body = syncMode === 'single'
            ? { sale_date: singleDate }
            : { start_date: startDate, end_date: endDate };
        setSyncing(true);
        setErr('');
        try {
            const res = await api.post('/easypos/sync/manual', body);
            const r = res.data;
            showMsg(
                `동기화 완료 — ${r.success_dates}/${r.total_dates}일 성공, ` +
                `영수증 ${r.total_inserted}건 신규, ${r.total_updated}건 갱신, ` +
                `매출 합계 ${fmtWon(r.total_sales_amount)}원`
            );
            await fetchAll();
        } catch (e) {
            showErr('동기화 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setSyncing(false);
        }
    }

    return (
        <div className="px-4 py-5 sm:px-6 lg:px-8 max-w-6xl mx-auto pb-24">
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-5">
                <Link
                    to="/external-integration"
                    className="p-2 rounded-lg hover:bg-slate-100"
                    title="외부 연동 메인으로"
                >
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </Link>
                <Store className="w-7 h-7 text-emerald-600" />
                <div>
                    <h1 className="text-xl font-bold text-slate-800">POS 매출 자동수집</h1>
                    <p className="text-xs text-slate-500">
                        KICC 이지포스 (smart.easypos.net) — 영수증 단위 매출 야간 자동수집
                    </p>
                </div>
            </div>

            {/* 안내 박스 */}
            <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <div className="flex items-start gap-2">
                    <Info className="w-5 h-5 text-emerald-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-emerald-900">
                        <p className="font-semibold mb-1">이지포스 비밀번호는 어떻게 보관되나요?</p>
                        <p className="text-emerald-800">
                            사장님이 입력한 비밀번호는 <strong>Fernet 대칭 암호화</strong>로 즉시 변환되어 DB에 저장됩니다.
                            평문 비밀번호는 어디에도 남지 않으며, 매일 새벽 03:00 자동수집 시점에만 잠시 복호화됩니다.
                            이지포스에서 비밀번호를 바꾸시면 셈하나에서도 다시 입력해주세요.
                        </p>
                    </div>
                </div>
            </div>

            {msg && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>{msg}</div>
                </div>
            )}
            {err && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>{err}</div>
                </div>
            )}

            {/* 자격증명 상태 카드 */}
            <section className="mb-6 bg-white border border-slate-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                        <KeyRound className="w-5 h-5 text-slate-600" />
                        가맹점 자격증명
                    </h2>
                    {cred?.registered ? (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCredModalOpen(true)}
                                className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                                재입력
                            </button>
                            <button
                                onClick={handleDeleteCredential}
                                className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 flex items-center gap-1"
                            >
                                <Trash2 className="w-4 h-4" /> 삭제
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => setCredModalOpen(true)}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium"
                        >
                            자격증명 등록
                        </button>
                    )}
                </div>

                {loading && !cred ? (
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…
                    </div>
                ) : cred?.registered ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-slate-500 text-xs">이지포스 ID</div>
                            <div className="font-mono text-slate-800">{cred.easypos_id}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">매장명</div>
                            <div className="text-slate-800">{cred.shop_name || '-'}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">상태</div>
                            <div className={cred.status === 'active' ? 'text-emerald-700' : 'text-amber-700'}>
                                {cred.status === 'active' ? '✓ 정상' : '⚠ 인증 실패'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">마지막 인증 성공</div>
                            <div className="text-slate-800">
                                {cred.last_verified_at ? new Date(cred.last_verified_at).toLocaleString('ko-KR') : '-'}
                            </div>
                        </div>
                        {cred.last_error_message && (
                            <div className="col-span-2 text-xs text-amber-700">
                                ⚠ 마지막 오류: {cred.last_error_message}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">
                        아직 자격증명이 등록되지 않았습니다. <strong>자격증명 등록</strong> 버튼을 누르고 이지포스 ID와 비밀번호를 입력하세요.
                    </p>
                )}

                {cred?.registered && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                            onClick={handleTestLogin}
                            disabled={testing}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            로그인 테스트
                        </button>
                    </div>
                )}

                {testResult?.ok && (
                    <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-sm">
                        <div className="font-semibold text-emerald-800 mb-1">✓ 로그인 성공</div>
                        <div className="text-emerald-900">
                            매장: {testResult.shop_name || '-'} / 사용자: {testResult.user_name || '-'} /
                            POS {testResult.pos_list?.length || 0}대
                        </div>
                    </div>
                )}
            </section>

            {/* 수동 동기화 카드 */}
            {cred?.registered && (
                <section className="mb-6 bg-white border border-slate-200 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
                        <CalIcon className="w-5 h-5 text-slate-600" />
                        수동 동기화
                    </h2>
                    <p className="text-xs text-slate-500 mb-3">
                        자동수집은 매일 새벽 03:00 자동 실행. 즉시 가져오거나 과거 매출을 백필할 때 사용.
                    </p>

                    <div className="flex gap-2 mb-3 text-sm">
                        <button
                            onClick={() => setSyncMode('single')}
                            className={`px-3 py-1.5 rounded-lg ${syncMode === 'single' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                            단일 일자
                        </button>
                        <button
                            onClick={() => setSyncMode('range')}
                            className={`px-3 py-1.5 rounded-lg ${syncMode === 'range' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                            범위 (최대 31일)
                        </button>
                    </div>

                    {syncMode === 'single' ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={singleDate}
                                onChange={(e) => setSingleDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <button
                                onClick={handleManualSync}
                                disabled={syncing}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                동기화
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <span className="text-slate-400">~</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                            />
                            <button
                                onClick={handleManualSync}
                                disabled={syncing}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                            >
                                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                범위 동기화
                            </button>
                        </div>
                    )}
                </section>
            )}

            {/* 동기화 이력 */}
            <section className="bg-white border border-slate-200 rounded-xl p-5">
                <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
                    <History className="w-5 h-5 text-slate-600" />
                    동기화 이력
                    <button
                        onClick={fetchAll}
                        className="ml-auto p-1.5 rounded-md hover:bg-slate-100"
                        title="새로고침"
                    >
                        <RefreshCw className={`w-4 h-4 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </h2>

                {logs.length === 0 ? (
                    <p className="text-sm text-slate-500 py-8 text-center">아직 동기화 이력이 없습니다.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="text-xs text-slate-500 border-b border-slate-200">
                                <tr>
                                    <th className="text-left py-2 px-2">시작 시각</th>
                                    <th className="text-left py-2 px-2">대상일</th>
                                    <th className="text-left py-2 px-2">모드</th>
                                    <th className="text-left py-2 px-2">상태</th>
                                    <th className="text-right py-2 px-2">영수증</th>
                                    <th className="text-right py-2 px-2">매출 합계</th>
                                    <th className="text-left py-2 px-2">트리거</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((l) => (
                                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap">
                                            {new Date(l.started_at).toLocaleString('ko-KR')}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700">{l.target_date || '-'}</td>
                                        <td className="py-2 px-2 text-slate-700">{l.sync_mode}</td>
                                        <td className="py-2 px-2">
                                            {l.status === 'success' && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700">성공</span>
                                            )}
                                            {l.status === 'failed' && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-700" title={l.error_message}>
                                                    실패
                                                </span>
                                            )}
                                            {l.status === 'running' && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-50 text-slate-700">실행중</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700 text-right">
                                            {l.receipts_fetched ?? 0}
                                            {(l.receipts_inserted > 0 || l.receipts_updated > 0) && (
                                                <span className="text-xs text-slate-500 ml-1">
                                                    (+{l.receipts_inserted}/{l.receipts_updated})
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-slate-800 text-right whitespace-nowrap">
                                            {l.total_sales ? fmtWon(l.total_sales) + '원' : '-'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-500 text-xs">{l.triggered_by}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {credModalOpen && (
                <CredentialModal
                    initial={cred?.easypos_id || ''}
                    onSave={handleSaveCredential}
                    onClose={() => setCredModalOpen(false)}
                />
            )}
        </div>
    );
}

// ─── 자격증명 입력 모달 ──────────────────────────────────

function CredentialModal({ initial, onSave, onClose }) {
    const [easyposId, setEasyposId] = useState(initial || '');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [saving, setSaving] = useState(false);

    const canSave = easyposId.trim().length >= 4 && password.length >= 4;

    async function submit(e) {
        e?.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave(easyposId.trim(), password);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <form
                onSubmit={submit}
                className="bg-white rounded-xl shadow-xl w-full max-w-md p-5"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">이지포스 자격증명</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-md"
                    >
                        <XIcon className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                    smart.easypos.net 로그인에 사용하는 ID와 비밀번호를 입력하세요.
                    입력 즉시 암호화되어 저장됩니다.
                </p>

                <label className="block mb-3">
                    <span className="text-sm text-slate-700">이지포스 ID</span>
                    <input
                        type="text"
                        autoComplete="off"
                        value={easyposId}
                        onChange={(e) => setEasyposId(e.target.value)}
                        placeholder="보통 사업자등록번호 10자리"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                </label>

                <label className="block mb-4">
                    <span className="text-sm text-slate-700">비밀번호</span>
                    <div className="mt-1 relative">
                        <input
                            type={showPw ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 pr-16 border border-slate-300 rounded-lg"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 px-2 py-1 hover:bg-slate-100 rounded"
                        >
                            {showPw ? '숨김' : '보기'}
                        </button>
                    </div>
                </label>

                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={!canSave || saving}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        저장
                    </button>
                </div>
            </form>
        </div>
    );
}
