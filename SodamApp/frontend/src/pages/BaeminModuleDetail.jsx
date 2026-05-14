import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowLeft, Bike, KeyRound, RefreshCw, Loader2, CheckCircle2,
    AlertCircle, Calendar as CalIcon, History, X as XIcon, Trash2,
    Cookie, ShieldCheck, ExternalLink, TrendingUp, FileJson,
} from 'lucide-react';
import api from '../api';
import { fmtWon } from './BankSync';

/**
 * 배민(배달의민족 / ceo.baemin.com · self.baemin.com) 매출 자동수집 페이지.
 *
 * /external-integration/baemin
 *   - 자격증명 등록 (login_id + store_id) — Playwright 자동 로그인 없음 (수동 쿠키 only)
 *   - 수동 쿠키 입력 — 사장님이 F12 → Application → Cookies 에서 직접 복사
 *   - 실시간 대시보드 — 최근 7일 주문 합계 (cancelled 제외)
 *   - 수동 동기화 — 기간 + 주문/정산 선택
 *   - 자동수집: Orbitron cron 매일 04:30 KST → 전일 주문/정산
 *   - 동기화 이력 테이블
 */
export default function BaeminModuleDetail() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const ymd = (d) => d.toISOString().slice(0, 10);

    const [cred, setCred] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [dashLoading, setDashLoading] = useState(false);
    const [credModalOpen, setCredModalOpen] = useState(false);
    const [cookieModalOpen, setCookieModalOpen] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    // 수동 동기화 폼
    const [startDate, setStartDate] = useState(ymd(yesterday));
    const [endDate, setEndDate] = useState(ymd(yesterday));
    const [syncOrders, setSyncOrders] = useState(true);
    const [syncSettlements, setSyncSettlements] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setErr('');
        try {
            const [credRes, logRes] = await Promise.all([
                api.get('/baemin/credential'),
                api.get('/baemin/sync/logs', { params: { limit: 30 } }).catch(() => ({ data: [] })),
            ]);
            setCred(credRes.data || { registered: false });
            setLogs(logRes.data || []);
        } catch (e) {
            setErr(e.response?.data?.detail || e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDashboard = useCallback(async () => {
        setDashLoading(true);
        try {
            const res = await api.get('/baemin/dashboard');
            setDashboard(res.data);
        } catch (e) {
            // dashboard 실패는 조용히 무시 (쿠키 없으면 422)
            setDashboard(null);
        } finally {
            setDashLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        if (cred?.registered && cred?.cookies_present && cred?.store_id) {
            fetchDashboard();
        }
    }, [cred?.registered, cred?.cookies_present, cred?.store_id, fetchDashboard]);

    const showMsg = (text) => { setMsg(text); setErr(''); setTimeout(() => setMsg(''), 4000); };
    const showErr = (text) => { setErr(text); setMsg(''); };

    // ─── 자격증명 등록 (login_id + store_id) ───
    async function handleSaveCredential(loginId, storeId) {
        try {
            const res = await api.post('/baemin/credential', {
                login_id: loginId,
                store_id: storeId || undefined,
            });
            setCred({ registered: true, ...res.data });
            setCredModalOpen(false);
            showMsg('자격증명을 저장했습니다.');
        } catch (e) {
            showErr('저장 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    async function handleDeleteCredential() {
        if (!window.confirm('배민 자격증명을 삭제하시겠습니까?\n자동수집이 중단되고, 다시 등록해야 수집이 재개됩니다.')) return;
        try {
            await api.delete('/baemin/credential');
            setCred({ registered: false });
            setDashboard(null);
            showMsg('자격증명을 삭제했습니다.');
        } catch (e) {
            showErr('삭제 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    // ─── 수동 쿠키 입력 (메인 인증 흐름) ───
    async function handleSubmitCookies(cookies, storeId, shopName) {
        try {
            const res = await api.post('/baemin/manual-cookies', {
                cookies,
                store_id: storeId || undefined,
                shop_name: shopName || undefined,
            });
            setCred({ registered: true, ...res.data });
            setCookieModalOpen(false);
            showMsg(`쿠키 ${cookies.length}개를 등록했습니다.`);
        } catch (e) {
            showErr('쿠키 등록 실패: ' + (e.response?.data?.detail || e.message));
        }
    }

    // ─── 수동 동기화 ───
    async function handleManualSync() {
        if (!syncOrders && !syncSettlements) {
            showErr('주문 또는 정산 중 최소 하나는 선택해야 합니다.');
            return;
        }
        setSyncing(true);
        setErr('');
        try {
            const res = await api.post('/baemin/sync/manual', {
                start_date: startDate,
                end_date: endDate,
                sync_orders: syncOrders,
                sync_settlements: syncSettlements,
            });
            const r = res.data;
            const lines = [];
            if (syncOrders) {
                lines.push(`주문 ${r.orders.fetched}건 (+${r.orders.inserted}/${r.orders.updated})`);
            }
            if (syncSettlements) {
                lines.push(`정산 ${r.settlements.fetched}건 (+${r.settlements.inserted}/${r.settlements.updated})`);
            }
            lines.push(`매출 합계 ${fmtWon(r.total_sales)}원`);
            showMsg('동기화 완료 — ' + lines.join(', '));
            await fetchAll();
            await fetchDashboard();
        } catch (e) {
            showErr('동기화 실패: ' + (e.response?.data?.detail || e.message));
        } finally {
            setSyncing(false);
        }
    }

    // ─── 대시보드 새로고침 ───
    async function handleRefreshDashboard() {
        await fetchDashboard();
        showMsg('최근 7일 데이터를 새로 가져왔습니다.');
    }

    const cookieAgeDays = cred?.cookies_obtained_at
        ? Math.floor((Date.now() - new Date(cred.cookies_obtained_at).getTime()) / (1000 * 60 * 60 * 24))
        : null;
    const cookieExpiresIn = cred?.cookies_expires_at
        ? Math.floor((new Date(cred.cookies_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        : null;

    // 쿠키 만료 임박 (3일 이내) 또는 만료됨 → 배너 노출
    const cookieExpiringSoon = cred?.registered && cred?.cookies_present &&
        cookieExpiresIn !== null && cookieExpiresIn <= 3;

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
                <Bike className="w-7 h-7 text-orange-600" />
                <div>
                    <h1 className="text-xl font-bold text-slate-800">배민 매출 자동수집</h1>
                    <p className="text-xs text-slate-500">
                        ceo.baemin.com / self.baemin.com — 주문/정산 데이터 야간 자동수집
                    </p>
                </div>
            </div>

            {/* 안내 박스 */}
            <div className="mb-5 p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="flex items-start gap-2">
                    <ShieldCheck className="w-5 h-5 text-orange-700 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-orange-900">
                        <p className="font-semibold mb-1">배민은 어떻게 안전하게 연결되나요?</p>
                        <p className="text-orange-800">
                            ① 배민은 봇 탐지가 강해 <strong>수동 쿠키 입력만</strong> 지원합니다 (자동 로그인 없음).
                            ② 입력된 쿠키는 <strong>Fernet 대칭 암호화</strong>로 즉시 변환되어 DB에 저장됩니다.
                            ③ 매출 데이터는 저장된 세션 쿠키로 직접 API 호출 — 효율적입니다.
                            ④ 매일 새벽 04:30 자동 수집 (전일 주문/정산). 쿠키 만료 시 다시 입력하면 됩니다.
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

            {/* 쿠키 만료 임박 배너 */}
            {cookieExpiringSoon && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>쿠키 만료 임박</strong> — {cookieExpiresIn !== null && cookieExpiresIn < 0
                            ? `이미 만료된 지 ${Math.abs(cookieExpiresIn)}일 지났습니다.`
                            : `${cookieExpiresIn}일 후 만료됩니다.`}{' '}
                        지금 <button
                            onClick={() => setCookieModalOpen(true)}
                            className="underline font-semibold hover:text-amber-700"
                        >쿠키 재입력</button> 하시면 자동수집이 끊기지 않습니다.
                    </div>
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
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCredModalOpen(true)}
                                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium"
                            >
                                자격증명 등록
                            </button>
                        </div>
                    )}
                </div>

                {loading && !cred ? (
                    <div className="text-sm text-slate-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> 불러오는 중…
                    </div>
                ) : cred?.registered ? (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <div className="text-slate-500 text-xs">배민 ID (식별용)</div>
                            <div className="font-mono text-slate-800">{cred.login_id || '-'}</div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">매장</div>
                            <div className="text-slate-800">
                                {cred.shop_name || '-'}
                                {cred.store_id && (
                                    <span className="text-slate-500 ml-1">#{cred.store_id}</span>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">세션 상태</div>
                            <div className={
                                cred.status === 'active' ? 'text-emerald-700' :
                                cred.status === 'cookie_invalid' ? 'text-red-700' : 'text-amber-700'
                            }>
                                {cred.status === 'active' && '✓ 정상'}
                                {cred.status === 'failed' && '⚠ 인증 실패'}
                                {cred.status === 'cookie_invalid' && '✗ 쿠키 만료/차단'}
                                {cred.status === 'expired' && '⏰ 쿠키 만료'}
                                {!cred.status && '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">쿠키 입력</div>
                            <div className="text-slate-800">
                                {cred.cookies_present
                                    ? (cred.cookies_obtained_at
                                        ? `${new Date(cred.cookies_obtained_at).toLocaleString('ko-KR')}` + (cookieAgeDays !== null ? ` (${cookieAgeDays}일 전)` : '')
                                        : '쿠키 있음')
                                    : '아직 없음'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">쿠키 만료</div>
                            <div className={cookieExpiresIn !== null && cookieExpiresIn < 3 ? 'text-amber-700' : 'text-slate-800'}>
                                {cred.cookies_expires_at
                                    ? `${new Date(cred.cookies_expires_at).toLocaleString('ko-KR')}` + (cookieExpiresIn !== null ? ` (${cookieExpiresIn}일 남음)` : '')
                                    : '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">마지막 검증 성공</div>
                            <div className="text-slate-800">
                                {cred.last_verified_at ? new Date(cred.last_verified_at).toLocaleString('ko-KR') : '-'}
                            </div>
                        </div>
                        <div>
                            <div className="text-slate-500 text-xs">연속 실패</div>
                            <div className={cred.consecutive_failures > 0 ? 'text-amber-700' : 'text-slate-800'}>
                                {cred.consecutive_failures || 0}회
                            </div>
                        </div>
                        {cred.last_error_message && (
                            <div className="col-span-2 text-xs text-amber-700 bg-amber-50 rounded p-2">
                                ⚠ 마지막 오류: {cred.last_error_message}
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-sm text-slate-500">
                        아직 자격증명이 등록되지 않았습니다.<br/>
                        <strong>① 자격증명 등록</strong> — 배민 사장님 ID + store_id (점주번호) 입력<br/>
                        <strong>② 쿠키 입력</strong> — 사장님이 ceo.baemin.com / self.baemin.com 에 로그인한 브라우저 쿠키 붙여넣기
                    </p>
                )}

                {cred?.registered && (
                    <div className="mt-4 flex gap-2 flex-wrap">
                        <button
                            onClick={() => setCookieModalOpen(true)}
                            className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium flex items-center gap-1"
                        >
                            <Cookie className="w-4 h-4" />
                            {cred.cookies_present ? '쿠키 갱신' : '쿠키 입력'}
                        </button>
                    </div>
                )}
            </section>

            {/* 실시간 대시보드 — 주간 합계 */}
            {cred?.registered && cred?.cookies_present && cred?.store_id && (
                <section className="mb-6 bg-white border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-slate-600" />
                            최근 7일 매출 (DB)
                        </h2>
                        <button
                            onClick={handleRefreshDashboard}
                            disabled={dashLoading}
                            className="p-1.5 rounded-md hover:bg-slate-100"
                            title="새로고침"
                        >
                            <RefreshCw className={`w-4 h-4 text-slate-500 ${dashLoading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                    {dashLoading && !dashboard ? (
                        <div className="text-sm text-slate-500 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> 가져오는 중…
                        </div>
                    ) : dashboard?.weekly_summary ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="bg-emerald-50 rounded-lg p-3">
                                <div className="text-xs text-emerald-700 mb-1">매출 합계</div>
                                <div className="text-lg font-bold text-emerald-800">
                                    {fmtWon(dashboard.weekly_summary.total_sales || 0)}원
                                </div>
                                <div className="text-xs text-emerald-700">
                                    주문 {dashboard.weekly_summary.order_count || 0}건 (취소 제외)
                                </div>
                            </div>
                            <div className="bg-slate-50 rounded-lg p-3">
                                <div className="text-xs text-slate-500 mb-1">기간</div>
                                <div className="text-sm font-mono text-slate-800">
                                    {dashboard.weekly_summary.from} ~ {dashboard.weekly_summary.to}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-500">최근 7일 데이터가 아직 없습니다. "지금 동기화" 로 가져와 보세요.</p>
                    )}
                </section>
            )}

            {/* 수동 동기화 카드 */}
            {cred?.registered && cred?.cookies_present && (
                <section className="mb-6 bg-white border border-slate-200 rounded-xl p-5">
                    <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2 mb-3">
                        <CalIcon className="w-5 h-5 text-slate-600" />
                        수동 동기화
                    </h2>
                    <p className="text-xs text-slate-500 mb-3">
                        자동수집은 매일 새벽 04:30 자동 실행. 즉시 가져오거나 과거 매출을 백필할 때 사용. (최대 91일)
                    </p>

                    <div className="flex items-center gap-2 flex-wrap mb-3">
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
                        <label className="flex items-center gap-1.5 text-sm ml-3">
                            <input
                                type="checkbox"
                                checked={syncOrders}
                                onChange={(e) => setSyncOrders(e.target.checked)}
                                className="rounded"
                            />
                            주문
                        </label>
                        <label className="flex items-center gap-1.5 text-sm">
                            <input
                                type="checkbox"
                                checked={syncSettlements}
                                onChange={(e) => setSyncSettlements(e.target.checked)}
                                className="rounded"
                            />
                            정산
                        </label>
                        <button
                            onClick={handleManualSync}
                            disabled={syncing}
                            className="ml-auto px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                        >
                            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            지금 동기화
                        </button>
                    </div>
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
                                    <th className="text-left py-2 px-2">기간</th>
                                    <th className="text-left py-2 px-2">모드</th>
                                    <th className="text-left py-2 px-2">상태</th>
                                    <th className="text-right py-2 px-2">주문</th>
                                    <th className="text-right py-2 px-2">정산</th>
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
                                        <td className="py-2 px-2 text-slate-700 text-xs whitespace-nowrap">
                                            {l.target_start && l.target_end
                                                ? (l.target_start === l.target_end
                                                    ? l.target_start
                                                    : `${l.target_start} ~ ${l.target_end}`)
                                                : '-'}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700 text-xs">
                                            {l.sync_mode}
                                        </td>
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
                                            {l.status === 'partial' && (
                                                <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700">부분</span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700 text-right">
                                            {l.orders_fetched ?? 0}
                                            {(l.orders_inserted > 0 || l.orders_updated > 0) && (
                                                <span className="text-xs text-slate-500 ml-1">
                                                    (+{l.orders_inserted}/{l.orders_updated})
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2 px-2 text-slate-700 text-right">
                                            {l.settlements_fetched ?? 0}
                                            {(l.settlements_inserted > 0 || l.settlements_updated > 0) && (
                                                <span className="text-xs text-slate-500 ml-1">
                                                    (+{l.settlements_inserted}/{l.settlements_updated})
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
                    initial={cred?.login_id || ''}
                    initialStoreId={cred?.store_id || ''}
                    onSave={handleSaveCredential}
                    onClose={() => setCredModalOpen(false)}
                />
            )}

            {cookieModalOpen && (
                <CookieInputModal
                    initialStoreId={cred?.store_id || ''}
                    initialShopName={cred?.shop_name || ''}
                    onSave={handleSubmitCookies}
                    onClose={() => setCookieModalOpen(false)}
                />
            )}
        </div>
    );
}


// ─── 자격증명 입력 모달 (login_id + store_id only) ─────────────

function CredentialModal({ initial, initialStoreId, onSave, onClose }) {
    const [loginId, setLoginId] = useState(initial || '');
    const [storeId, setStoreId] = useState(initialStoreId ? String(initialStoreId) : '');
    const [saving, setSaving] = useState(false);

    const canSave = loginId.trim().length >= 3;

    async function submit(e) {
        e?.preventDefault();
        if (!canSave) return;
        setSaving(true);
        try {
            await onSave(loginId.trim(), storeId.trim() || null);
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
                    <h3 className="text-lg font-semibold text-slate-800">배민 자격증명</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-md"
                    >
                        <XIcon className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                    배민 사장님 ID와 점주번호(store_id). 인증은 별도로 <strong>쿠키 입력</strong> 으로 진행합니다 (자동 로그인 없음).
                </p>

                <label className="block mb-3">
                    <span className="text-sm text-slate-700">배민 ID (식별용)</span>
                    <input
                        type="text"
                        autoComplete="off"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="예: sodam2025@example.com"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                    />
                    <span className="text-xs text-slate-500">
                        로그인 정보 저장 X — 사장님이 어느 배민 계정과 연결됐는지 식별용으로만 사용됩니다.
                    </span>
                </label>

                <label className="block mb-4">
                    <span className="text-sm text-slate-700">점주번호 (store_id)</span>
                    <input
                        type="text"
                        value={storeId}
                        onChange={(e) => setStoreId(e.target.value)}
                        placeholder="예: 11111111"
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                    />
                    <span className="text-xs text-slate-500">
                        배민 사장님 사이트의 점주번호(shopOwnerNumber). 동기화에 필수 — 모르시면 사장님께 문의.
                    </span>
                </label>

                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={!canSave || saving}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        저장
                    </button>
                </div>
            </form>
        </div>
    );
}


// ─── 수동 쿠키 입력 모달 ─────────────────────────────────

function CookieInputModal({ initialStoreId, initialShopName, onSave, onClose }) {
    const [raw, setRaw] = useState('');
    const [storeId, setStoreId] = useState(initialStoreId ? String(initialStoreId) : '');
    const [shopName, setShopName] = useState(initialShopName || '');
    const [parsed, setParsed] = useState(null);
    const [parseErr, setParseErr] = useState('');
    const [saving, setSaving] = useState(false);

    function tryParse(text) {
        setParseErr('');
        setParsed(null);
        const trimmed = (text || '').trim();
        if (!trimmed) return;
        // 1) JSON array
        try {
            const arr = JSON.parse(trimmed);
            if (Array.isArray(arr) && arr.length > 0 && arr[0].name && arr[0].value !== undefined) {
                setParsed(arr);
                return;
            }
        } catch {
            // continue to header parser
        }
        // 2) Cookie header format "name1=value1; name2=value2"
        //    Application 탭 테이블에서 탭/줄바꿈으로 복사된 경우도 best-effort 처리
        try {
            const cookies = trimmed
                .replace(/\r?\n/g, ';')
                .replace(/\t+/g, '=')
                .split(';')
                .map(p => {
                    const eq = p.indexOf('=');
                    if (eq < 0) return null;
                    const name = p.slice(0, eq).trim();
                    const value = p.slice(eq + 1).trim();
                    if (!name || /\s/.test(name)) return null;
                    return { name, value, domain: '.baemin.com', path: '/' };
                })
                .filter(Boolean);
            const names = cookies.map(c => c.name);
            if (cookies.length > 0) {
                setParsed(cookies);
                // 배민 인증 쿠키 후보 (정확한 이름은 HAR 캡처 후 확정):
                //   - 세션류: BMSESSIONID / SESSION / JSESSIONID / baemin-session
                //   - 인증류: access_token / token / authorization / cmsToken
                const hasAuth = names.some(n =>
                    /SESSION/i.test(n)
                    || /^cmsToken$/i.test(n)
                    || /TOKEN/i.test(n)
                    || /AUTH/i.test(n)
                    || /^bm_/i.test(n) === false && /^_b[a-z]+/i.test(n)   // baemin 내부 쿠키 (best-effort)
                );
                if (!hasAuth) {
                    setParseErr(`⚠ ${cookies.length}개 쿠키 인식했지만 SESSION / TOKEN 류 인증 쿠키가 보이지 않습니다. Network 탭의 cookie 헤더 전체를 복사했는지 확인하세요.`);
                }
                return;
            }
        } catch (e) {
            setParseErr('파싱 실패: ' + (e?.message || e));
            return;
        }
        setParseErr('인식되는 쿠키 형식이 없습니다. JSON 배열 또는 "name=value; name=value" 형식 필요.');
    }

    async function submit(e) {
        e?.preventDefault();
        if (!parsed || parsed.length === 0) return;
        setSaving(true);
        try {
            await onSave(parsed,
                         storeId ? storeId.trim() : null,
                         shopName || null);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <form
                onSubmit={submit}
                className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5"
            >
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                        <Cookie className="w-5 h-5 text-orange-600" />
                        배민 쿠키 입력 (인증)
                    </h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 hover:bg-slate-100 rounded-md"
                    >
                        <XIcon className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                    <p className="font-semibold mb-1">📋 쿠키 추출 방법 (반드시 Network 탭 사용)</p>
                    <ol className="list-decimal ml-4 space-y-0.5">
                        <li>크롬에서 <a href="https://self.baemin.com" target="_blank" rel="noopener" className="text-blue-700 underline inline-flex items-center gap-0.5">self.baemin.com<ExternalLink className="w-3 h-3" /></a> 에 로그인 (또는 ceo.baemin.com — self-api.baemin.com 쿠키도 동일 동작)</li>
                        <li>F12 → <strong>Network</strong> 탭 → <strong>Preserve log</strong> ✅ 체크 → F5 새로고침</li>
                        <li>요청 list 에서 아무 <code>baemin.com</code> 요청 1개 클릭</li>
                        <li>우측 <strong>Headers</strong> 탭 → 아래로 스크롤 → <strong>Request Headers</strong> 섹션</li>
                        <li><code>cookie:</code> 로 시작하는 줄의 값 전체 마우스 드래그 → <strong>Ctrl+C</strong></li>
                        <li>아래 텍스트박스에 그대로 붙여넣기 → "쿠키 N개 인식" 표시</li>
                    </ol>
                    <p className="mt-2 text-amber-800 font-semibold">
                        ⚠️ Application 탭의 Cookies 테이블을 직접 복사하지 마세요 — 탭으로 깨진 형식이라 인식 실패합니다.
                    </p>
                </div>

                <label className="block mb-3">
                    <span className="text-sm text-slate-700 flex items-center gap-1">
                        <FileJson className="w-4 h-4" /> 쿠키 (JSON 배열 또는 cookie 헤더 형식)
                    </span>
                    <textarea
                        value={raw}
                        onChange={(e) => { setRaw(e.target.value); tryParse(e.target.value); }}
                        placeholder='[{"name":"SESSION","value":"...","domain":".baemin.com",...}]   또는   SESSION=...; cmsToken=...; ...'
                        rows={6}
                        className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono"
                    />
                    {parsed && (
                        <span className="text-xs text-emerald-700">✓ 쿠키 {parsed.length}개 인식</span>
                    )}
                    {parseErr && (
                        <span className="text-xs text-red-700">⚠ {parseErr}</span>
                    )}
                </label>

                <div className="grid grid-cols-2 gap-3 mb-4">
                    <label className="block">
                        <span className="text-sm text-slate-700">점주번호 (store_id)</span>
                        <input
                            type="text"
                            value={storeId}
                            onChange={(e) => setStoreId(e.target.value)}
                            placeholder="예: 11111111"
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                        />
                    </label>
                    <label className="block">
                        <span className="text-sm text-slate-700">매장명 (선택)</span>
                        <input
                            type="text"
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="예: 소담김밥 건대본점"
                            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg"
                        />
                    </label>
                </div>

                <div className="flex gap-2 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg text-sm"
                    >
                        취소
                    </button>
                    <button
                        type="submit"
                        disabled={!parsed || parsed.length === 0 || saving}
                        className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 text-sm font-medium flex items-center gap-2"
                    >
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        쿠키 등록
                    </button>
                </div>
            </form>
        </div>
    );
}
