import { useState, useEffect } from 'react';
import {
    Database, ShieldCheck, Loader2, RefreshCw, AlertCircle, CheckCircle2,
    Trash2, Download, FileText, Wallet, ListChecks,
} from 'lucide-react';
import api from '../api';

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

const SIMPLE_AUTH_OPTIONS = [
    { value: 'kakao', label: '카카오톡' },
    { value: 'naver', label: '네이버' },
    { value: 'pass', label: 'PASS' },
    { value: 'toss', label: '토스' },
    { value: 'payco', label: '페이코' },
    { value: 'samsung', label: '삼성패스' },
];

const TELECOM_OPTIONS = [
    { value: '0', label: 'SKT' },
    { value: '1', label: 'KT' },
    { value: '2', label: 'LG U+' },
    { value: '3', label: '알뜰폰' },
];

const RECORD_TYPES = [
    {
        key: 'cash_sales',
        label: '현금영수증 매출',
        sub: '소득공제용·지출증빙용 매출',
        icon: Wallet,
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    {
        key: 'cash_purchase',
        label: '현금영수증 매입',
        sub: '본인 가게의 현금 지출',
        icon: Wallet,
        color: 'bg-amber-50 text-amber-700 border-amber-200',
    },
    {
        key: 'tax_invoice_integrated',
        label: '세금계산서 통합',
        sub: '매출 + 매입 한 번에',
        icon: FileText,
        color: 'bg-blue-50 text-blue-700 border-blue-200',
    },
];

const RECORD_TYPE_LABEL = {
    cash_sales: '현금영수증 매출',
    cash_purchase: '현금영수증 매입',
    tax_invoice_sales: '세금계산서 매출',
    tax_invoice_purchase: '세금계산서 매입',
};

export default function HomeTaxCollect() {
    const [connectionInfo, setConnectionInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(null);
    const [summary, setSummary] = useState(null);
    const [cursors, setCursors] = useState([]);
    const [records, setRecords] = useState([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [filterType, setFilterType] = useState('');

    const [showRegistModal, setShowRegistModal] = useState(false);
    const [authMethod, setAuthMethod] = useState('simple');
    const [registing, setRegisting] = useState(false);
    const [pendingAuth, setPendingAuth] = useState(null);

    const [simpleForm, setSimpleForm] = useState({
        loginType: 'kakao', userName: '', phoneNo: '', birthDate: '', telecom: '0',
    });
    const [idPwForm, setIdPwForm] = useState({ id: '', password: '', identity: '' });

    useEffect(() => {
        loadConnection();
        loadSummary();
        loadCursors();
        loadRecords();
    }, []);

    useEffect(() => { loadRecords(); }, [filterType]);

    const loadConnection = async () => {
        setLoading(true);
        try {
            const res = await api.get('/codef/hometax/connection');
            setConnectionInfo(res.data);
        } catch (e) {
            setConnectionInfo({ connected: false, error: e?.response?.data?.detail || '연결 조회 실패' });
        } finally {
            setLoading(false);
        }
    };

    const loadSummary = async () => {
        try { setSummary((await api.get('/codef/hometax/summary')).data); }
        catch { /* noop */ }
    };

    const loadCursors = async () => {
        try { setCursors((await api.get('/codef/hometax/cursors')).data?.cursors || []); }
        catch { /* noop */ }
    };

    const loadRecords = async () => {
        setRecordsLoading(true);
        try {
            const params = { per_page: 100 };
            if (filterType) params.record_type = filterType;
            const res = await api.get('/codef/hometax/records', { params });
            setRecords(res.data?.rows || []);
        } catch {
            setRecords([]);
        } finally {
            setRecordsLoading(false);
        }
    };

    const doSync = async (recordType) => {
        setSyncing(recordType);
        try {
            const res = await api.post('/codef/hometax/sync', { record_type: recordType });
            if (res.data.ok) {
                alert(`${RECORD_TYPE_LABEL[recordType] || recordType} 수집 완료\n신규 ${res.data.rows_inserted}건 · 업데이트 ${res.data.rows_updated || 0}건 · 총 ${res.data.rows_total}건`);
                await Promise.all([loadSummary(), loadCursors(), loadRecords()]);
            } else {
                alert(`수집 실패: ${res.data.error}`);
            }
        } catch (e) {
            alert(`수집 오류: ${e?.response?.data?.detail || e.message}`);
        } finally {
            setSyncing(null);
        }
    };

    const buildAuthPayload = () => {
        if (authMethod === 'simple') return { ...simpleForm, client_type: 'B' };
        if (authMethod === 'idpw') return { ...idPwForm, client_type: 'B' };
        return {};
    };

    const submitConnect = async () => {
        setRegisting(true);
        setPendingAuth(null);
        try {
            const res = await api.post('/codef/hometax/connect', { auth: buildAuthPayload() });
            if (res.data?.status === 'additional_auth_required') {
                setPendingAuth(res.data);
                alert(`모바일로 본인인증 요청을 보냈습니다.\n${res.data.extra_info?.message || '카톡/네이버 앱에서 인증 후 [인증 완료] 버튼을 눌러주세요.'}`);
            } else if (res.data?.status === 'active') {
                alert('홈택스 연결 완료!');
                setShowRegistModal(false);
                await loadConnection();
            }
        } catch (e) {
            const detail = e?.response?.data?.detail;
            const msg = typeof detail === 'string' ? detail
                : (detail?.message || e.message);
            const code = detail?.code || '';
            const raw = detail?.raw ? `\n\n[raw]\n${JSON.stringify(detail.raw).slice(0, 500)}` : '';
            alert(`연결 실패${code ? ` [${code}]` : ''}: ${msg}${raw}`);
        } finally {
            setRegisting(false);
        }
    };

    const completeSimpleAuth = async () => {
        if (!pendingAuth?.auth_pending_id) return;
        setRegisting(true);
        try {
            const res = await api.post('/codef/hometax/simple-auth/complete', {
                auth_pending_id: pendingAuth.auth_pending_id,
            });
            if (res.data?.status === 'active') {
                alert('홈택스 연결 완료!');
                setShowRegistModal(false);
                setPendingAuth(null);
                await loadConnection();
            } else {
                alert(`인증 미완료: ${res.data?.method || '재시도'}`);
            }
        } catch (e) {
            alert(`완료 실패: ${e?.response?.data?.detail?.message || e?.response?.data?.detail || e.message}`);
        } finally {
            setRegisting(false);
        }
    };

    const doDisconnect = async () => {
        if (!confirm('홈택스 연결을 해제하시겠어요? CODEF 측 등록도 삭제됩니다.')) return;
        try {
            await api.delete('/codef/hometax/connection');
            await loadConnection();
        } catch (e) {
            alert(`해제 실패: ${e?.response?.data?.detail || e.message}`);
        }
    };

    const isConnected = connectionInfo?.connected;
    const conn = connectionInfo?.connection;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">홈택스 수집</h1>
                        <p className="text-sm text-slate-500">CODEF 통한 현금영수증 + 세금계산서 자동수집</p>
                    </div>
                </div>

                <div className={`mb-6 p-5 rounded-2xl border-2 ${
                    isConnected ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                }`}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-3">
                            {isConnected
                                ? <CheckCircle2 className="text-emerald-600 mt-1" size={20} />
                                : <AlertCircle className="text-amber-600 mt-1" size={20} />}
                            <div>
                                <div className="font-bold text-slate-900">
                                    {loading ? '연결 정보 확인 중…' : (isConnected ? '홈택스 연결됨' : '홈택스 연결 필요')}
                                </div>
                                {isConnected && conn && (
                                    <div className="text-xs text-slate-600 mt-1">
                                        인증 방식: {conn.auth_method} · 최근 확인: {conn.last_verified_at ? new Date(conn.last_verified_at).toLocaleString('ko-KR') : '—'}
                                    </div>
                                )}
                                {!isConnected && !loading && (
                                    <div className="text-xs text-slate-600 mt-1">
                                        카카오·네이버 등 간편인증 또는 홈택스 ID/PW 중 선택해 1회 연결하면 그 후 자동 수집됩니다.
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            {!isConnected && (
                                <button onClick={() => setShowRegistModal(true)}
                                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium flex items-center gap-1.5">
                                    <ShieldCheck size={14} /> 홈택스 연결
                                </button>
                            )}
                            {isConnected && (
                                <>
                                    <button onClick={loadConnection}
                                        className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-sm flex items-center gap-1.5 border border-slate-200">
                                        <RefreshCw size={14} /> 새로고침
                                    </button>
                                    <button onClick={doDisconnect}
                                        className="px-3 py-2 bg-white hover:bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-1.5 border border-red-200">
                                        <Trash2 size={14} /> 연결 해제
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {isConnected && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                        {RECORD_TYPES.map((rt) => {
                            const Icon = rt.icon;
                            const cursor = cursors.find((c) => c.record_type === rt.key
                                || (rt.key === 'tax_invoice_integrated' && c.record_type === 'tax_invoice_sales'));
                            return (
                                <div key={rt.key} className={`p-4 rounded-2xl border-2 ${rt.color}`}>
                                    <div className="flex items-start gap-2 mb-3">
                                        <Icon size={20} />
                                        <div className="flex-1">
                                            <div className="font-bold text-sm">{rt.label}</div>
                                            <div className="text-xs opacity-70 mt-0.5">{rt.sub}</div>
                                        </div>
                                    </div>
                                    {cursor && (
                                        <div className="text-[11px] mb-3 leading-snug">
                                            <div>마지막 수집: {cursor.last_synced_at ? new Date(cursor.last_synced_at).toLocaleString('ko-KR') : '—'}</div>
                                            <div>마지막 거래일: {cursor.last_tx_date || '—'} · 누적 {cursor.rows_total || 0}건</div>
                                            {cursor.last_status === 'failed' && cursor.last_error && (
                                                <div className="text-red-600 mt-1">⚠ {cursor.last_error.slice(0, 80)}</div>
                                            )}
                                        </div>
                                    )}
                                    <button onClick={() => doSync(rt.key)} disabled={syncing === rt.key}
                                        className="w-full px-3 py-2 bg-white hover:bg-slate-50 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 border disabled:opacity-50">
                                        {syncing === rt.key ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                        지금 수집
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

                {summary?.by_type && summary.by_type.length > 0 && (
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center gap-2 mb-3">
                            <ListChecks size={16} className="text-slate-500" />
                            <h2 className="font-semibold text-slate-700 text-sm">최근 90일 적재 요약</h2>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {summary.by_type.map((s) => (
                                <div key={s.record_type} className="p-3 bg-slate-50 rounded-xl">
                                    <div className="text-xs text-slate-500">{RECORD_TYPE_LABEL[s.record_type] || s.record_type}</div>
                                    <div className="text-lg font-bold text-slate-900 tabular-nums">{fmt(s.count)}건</div>
                                    <div className="text-xs text-slate-600">{fmt(s.total)}원</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <FileText size={16} className="text-slate-500" />
                            <h2 className="font-semibold text-slate-700 text-sm">적재 자료 ({records.length})</h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                                className="text-xs px-2 py-1.5 border border-slate-200 rounded-lg">
                                <option value="">전체</option>
                                <option value="cash_sales">현금영수증 매출</option>
                                <option value="cash_purchase">현금영수증 매입</option>
                                <option value="tax_invoice_sales">세금계산서 매출</option>
                                <option value="tax_invoice_purchase">세금계산서 매입</option>
                            </select>
                            <button onClick={loadRecords} disabled={recordsLoading}
                                className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                {recordsLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 새로고침
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="text-slate-500 border-b">
                                    <th className="text-left py-2 px-2">거래일</th>
                                    <th className="text-left py-2 px-2">유형</th>
                                    <th className="text-left py-2 px-2">거래처</th>
                                    <th className="text-left py-2 px-2">품목</th>
                                    <th className="text-right py-2 px-2">공급가액</th>
                                    <th className="text-right py-2 px-2">세액</th>
                                    <th className="text-right py-2 px-2">합계</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.length === 0 && (
                                    <tr><td colSpan={7} className="text-center py-8 text-slate-400">
                                        {isConnected ? '수집된 자료가 없습니다. 상단 [지금 수집] 버튼으로 시작하세요.' : '먼저 홈택스 연결을 진행해주세요.'}
                                    </td></tr>
                                )}
                                {records.map((r) => (
                                    <tr key={r.id} className="border-b hover:bg-slate-50">
                                        <td className="py-2 px-2 tabular-nums">{r.tx_date}</td>
                                        <td className="py-2 px-2">{RECORD_TYPE_LABEL[r.record_type] || r.record_type}</td>
                                        <td className="py-2 px-2">
                                            {r.counterparty_name || '—'}
                                            {r.counterparty_corp_num && <span className="text-slate-400 ml-1">{r.counterparty_corp_num}</span>}
                                        </td>
                                        <td className="py-2 px-2 max-w-xs truncate">{r.item_name || '—'}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{fmt(r.supply_cost)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums">{fmt(r.tax)}</td>
                                        <td className="py-2 px-2 text-right tabular-nums font-semibold">{fmt(r.total_amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {showRegistModal && (
                    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-5 border-b sticky top-0 bg-white">
                                <h3 className="font-bold text-lg text-slate-900">홈택스 연결</h3>
                                <p className="text-xs text-slate-500 mt-1">간편인증 또는 ID/PW 중 편한 방법을 선택하세요.</p>
                            </div>
                            <div className="p-5">
                                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl mb-4">
                                    {[
                                        { v: 'simple', label: '간편인증' },
                                        { v: 'idpw', label: 'ID/PW' },
                                        { v: 'cert', label: '공동인증서' },
                                    ].map((t) => (
                                        <button key={t.v} onClick={() => setAuthMethod(t.v)}
                                            className={`px-3 py-2 rounded-lg text-xs font-medium ${
                                                authMethod === t.v ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                            }`}>
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {authMethod === 'simple' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">인증 종류</label>
                                            <select value={simpleForm.loginType} onChange={(e) => setSimpleForm({ ...simpleForm, loginType: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                                {SIMPLE_AUTH_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">이름 <span className="text-red-500">*</span></label>
                                            <input value={simpleForm.userName} onChange={(e) => setSimpleForm({ ...simpleForm, userName: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                placeholder="홍지연 (카카오톡 가입자 이름과 동일)" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">휴대폰</label>
                                            <input value={simpleForm.phoneNo} onChange={(e) => setSimpleForm({ ...simpleForm, phoneNo: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                placeholder="01012345678 (하이픈 없이)" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">생년월일</label>
                                            <input value={simpleForm.birthDate} onChange={(e) => setSimpleForm({ ...simpleForm, birthDate: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                placeholder="19800101 (YYYYMMDD)" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">통신사</label>
                                            <select value={simpleForm.telecom} onChange={(e) => setSimpleForm({ ...simpleForm, telecom: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm">
                                                {TELECOM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {authMethod === 'idpw' && (
                                    <div className="space-y-3">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">홈택스 아이디 <span className="text-red-500">*</span></label>
                                            <input value={idPwForm.id} onChange={(e) => setIdPwForm({ ...idPwForm, id: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
                                                placeholder="예: limp2004" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">비밀번호 <span className="text-red-500">*</span></label>
                                            <input type="password" value={idPwForm.password} onChange={(e) => setIdPwForm({ ...idPwForm, password: e.target.value })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-600 block mb-1">대표자 주민번호 <span className="text-red-500">*</span></label>
                                            <input value={idPwForm.identity} onChange={(e) => setIdPwForm({ ...idPwForm, identity: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono tabular-nums"
                                                placeholder="앞 7자리 (생년월일 6자리 + 성별 1자리)"
                                                maxLength={13} />
                                            <div className="text-[11px] text-slate-500 mt-1">홈택스 ID 로그인 2차 인증용. 13자리 전체 입력해도 됩니다.</div>
                                        </div>
                                    </div>
                                )}

                                {authMethod === 'cert' && (
                                    <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                                        공동인증서 (.cer/.key) 파일 업로드는 다음 업데이트에서 지원 예정. 현재는 간편인증 또는 ID/PW 를 권장합니다.
                                    </div>
                                )}

                                {pendingAuth && (
                                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                                        <div className="font-semibold text-blue-900 mb-1">📱 모바일에서 본인인증을 완료해주세요</div>
                                        <div className="text-xs text-blue-700">
                                            {pendingAuth.extra_info?.message || '카카오톡/네이버 앱에서 인증 후 아래 [인증 완료] 버튼을 눌러주세요.'}
                                        </div>
                                        <button onClick={completeSimpleAuth} disabled={registing}
                                            className="mt-3 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                            {registing ? '확인 중…' : '인증 완료'}
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-t flex gap-2 sticky bottom-0 bg-white">
                                <button onClick={() => { setShowRegistModal(false); setPendingAuth(null); }}
                                    className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm">
                                    취소
                                </button>
                                {!pendingAuth && (
                                    <button onClick={submitConnect} disabled={registing || authMethod === 'cert'}
                                        className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-sm font-medium disabled:opacity-50">
                                        {registing ? '연결 중…' : '연결하기'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
