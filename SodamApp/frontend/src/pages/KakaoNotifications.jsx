import { useState, useEffect } from 'react';
import {
    MessageCircle, ExternalLink, Loader2, RefreshCw, CheckCircle2, AlertCircle,
    Coins, Send, Copy, X, Info, FileCheck, Phone, UserCircle,
} from 'lucide-react';
import api from '../api';

const TEMPLATE_STATE_LABELS = {
    'A': { label: '심사대기', color: 'bg-amber-100 text-amber-700' },
    'R': { label: '검수반려', color: 'bg-red-100 text-red-700' },
    'S': { label: '심사중', color: 'bg-blue-100 text-blue-700' },
    'P': { label: '사용중', color: 'bg-emerald-100 text-emerald-700' },
    'X': { label: '사용중지', color: 'bg-slate-100 text-slate-500' },
};

const STATUS_BADGE = {
    success: { label: '성공', color: 'bg-emerald-100 text-emerald-700' },
    failed: { label: '실패', color: 'bg-red-100 text-red-700' },
    sending: { label: '전송중', color: 'bg-blue-100 text-blue-700' },
    pending: { label: '대기', color: 'bg-slate-100 text-slate-500' },
};

export default function KakaoNotifications() {
    const [provider, setProvider] = useState(null);
    const [balance, setBalance] = useState(null);
    const [templates, setTemplates] = useState([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [openingUrl, setOpeningUrl] = useState(null);

    // 빠른 테스트 발송 모달
    const [showTestModal, setShowTestModal] = useState(false);
    const [testForm, setTestForm] = useState({
        target_number: '',
        target_name: '',
        template_code: '',
        content: '',
    });
    const [testSending, setTestSending] = useState(false);

    useEffect(() => { loadAll(); }, []);

    const loadAll = async () => {
        await Promise.all([loadProvider(), loadBalance(), loadTemplates(), loadHistory()]);
    };

    const loadProvider = async () => {
        try {
            const res = await api.get('/notifications/providers');
            setProvider(res.data);
        } catch { /* noop */ }
    };

    const loadBalance = async () => {
        try {
            const res = await api.get('/notifications/balance');
            setBalance(res.data);
        } catch { /* noop */ }
    };

    const loadTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await api.get('/notifications/templates');
            setTemplates(res.data.templates || []);
        } catch (e) {
            console.error('Templates load failed:', e);
            setTemplates([]);
        } finally {
            setTemplatesLoading(false);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/notifications', { params: { channel: 'alimtalk', limit: 100 } });
            setHistory(res.data || []);
        } catch (e) {
            console.error('History load failed:', e);
        } finally {
            setHistoryLoading(false);
        }
    };

    const openMgtURL = async (path, label) => {
        setOpeningUrl(label);
        try {
            const res = await api.get(`/notifications/urls/${path}`);
            if (res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '관리 URL 생성 실패');
        } finally {
            setOpeningUrl(null);
        }
    };

    const copyTemplateCode = (code) => {
        navigator.clipboard.writeText(code).then(() => alert('템플릿 코드가 복사되었습니다.'));
    };

    const applyTemplate = (t) => {
        setTestForm({
            ...testForm,
            template_code: t.templateCode || '',
            content: t.template || '',
        });
        setShowTestModal(true);
    };

    const handleTestSend = async () => {
        const { target_number, template_code, content } = testForm;
        if (!target_number || !template_code || !content) {
            alert('수신번호, 템플릿코드, 내용을 모두 입력하세요.');
            return;
        }
        setTestSending(true);
        try {
            await api.post('/notifications/send/alimtalk', {
                trigger: 'manual_test',
                target_number,
                target_name: testForm.target_name,
                template_code,
                content,
            });
            alert('알림톡 발송 요청 완료');
            setShowTestModal(false);
            loadHistory();
        } catch (e) {
            alert(e?.response?.data?.detail || '발송 실패');
        } finally {
            setTestSending(false);
        }
    };

    const inputCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-yellow-500 outline-none";

    // 템플릿 검수상태별 카운트
    const stateCounts = templates.reduce((acc, t) => {
        const s = t.state || '?';
        acc[s] = (acc[s] || 0) + 1;
        return acc;
    }, {});

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-yellow-100 text-yellow-600 rounded-xl">
                        <MessageCircle size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">알림톡 관리</h1>
                        <p className="text-sm text-slate-500">카카오 비즈센터 + 팝빌 연동 · SMS 대비 절반 가격</p>
                    </div>
                </div>

                {/* 상태 배너 */}
                {provider?.is_stub && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{provider.note}</span>
                    </div>
                )}
                {provider && !provider.is_stub && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-start gap-2">
                        <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{provider.note}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                    {/* 잔액 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                            <Coins size={16} /> 팝빌 포인트 잔액
                        </div>
                        <div className="text-3xl font-bold text-slate-800">
                            {balance?.balance != null ? Number(balance.balance).toLocaleString('ko-KR') : '-'}
                            <span className="text-sm font-normal text-slate-500 ml-1">원</span>
                        </div>
                        <div className="mt-2 text-xs text-slate-400">
                            알림톡 1건당 8~10원 · SMS 1건당 17원
                        </div>
                    </div>

                    {/* 템플릿 검수 현황 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                            <FileCheck size={16} /> 템플릿 검수 현황
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs">
                            <div className="text-center">
                                <div className="font-bold text-emerald-700 text-2xl">{stateCounts.P || 0}</div>
                                <div className="text-slate-500">사용중</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-blue-700 text-2xl">{(stateCounts.A || 0) + (stateCounts.S || 0)}</div>
                                <div className="text-slate-500">심사중</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-red-700 text-2xl">{stateCounts.R || 0}</div>
                                <div className="text-slate-500">반려</div>
                            </div>
                        </div>
                    </div>

                    {/* 발송 통계 (이력 기준) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
                            <Send size={16} /> 최근 발송 (최대 100건)
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-xs">
                            <div className="text-center">
                                <div className="font-bold text-emerald-700 text-2xl">{history.filter(h => h.status === 'success').length}</div>
                                <div className="text-slate-500">성공</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-red-700 text-2xl">{history.filter(h => h.status === 'failed').length}</div>
                                <div className="text-slate-500">실패</div>
                            </div>
                            <div className="text-center">
                                <div className="font-bold text-slate-500 text-2xl">{history.length}</div>
                                <div className="text-slate-500">합계</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 팝빌 관리 페이지 바로가기 */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <h2 className="font-semibold text-slate-700 text-sm mb-3 flex items-center gap-2">
                        <ExternalLink size={14} /> 팝빌 관리 페이지
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        <button
                            onClick={() => openMgtURL('plus-friend', 'plus-friend')}
                            disabled={openingUrl === 'plus-friend' || !provider || provider.is_stub}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-yellow-50 text-yellow-700 hover:bg-yellow-100 disabled:opacity-50"
                        >
                            {openingUrl === 'plus-friend' ? <Loader2 size={14} className="animate-spin" /> : <UserCircle size={14} />}
                            플러스친구 관리
                        </button>
                        <button
                            onClick={() => openMgtURL('template-mgt', 'template-mgt')}
                            disabled={openingUrl === 'template-mgt' || !provider || provider.is_stub}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                        >
                            {openingUrl === 'template-mgt' ? <Loader2 size={14} className="animate-spin" /> : <FileCheck size={14} />}
                            템플릿 관리
                        </button>
                        <button
                            onClick={() => openMgtURL('sender-number', 'sender-number')}
                            disabled={openingUrl === 'sender-number' || !provider || provider.is_stub}
                            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                        >
                            {openingUrl === 'sender-number' ? <Loader2 size={14} className="animate-spin" /> : <Phone size={14} />}
                            발신번호 관리
                        </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        ※ 처음이라면 플러스친구 → 발신번호 → 템플릿 순서로 진행하세요. 카카오 검수는 영업일 1~3일 소요됩니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* 템플릿 목록 */}
                    <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileCheck size={18} className="text-yellow-600" />
                                알림톡 템플릿
                                <span className="text-xs text-slate-400 font-normal">({templates.length})</span>
                            </h2>
                            <button onClick={loadTemplates} disabled={templatesLoading} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                {templatesLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 새로고침
                            </button>
                        </div>

                        {templates.length === 0 && !templatesLoading && (
                            <div className="text-center py-12 text-slate-400 text-sm flex flex-col items-center gap-2">
                                <Info size={24} />
                                등록된 템플릿이 없습니다.
                                <button
                                    onClick={() => openMgtURL('template-mgt', 'template-mgt')}
                                    disabled={!provider || provider.is_stub}
                                    className="mt-2 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-medium disabled:opacity-50"
                                >
                                    팝빌 템플릿 관리 페이지 열기
                                </button>
                            </div>
                        )}

                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {templates.map((t) => {
                                const state = TEMPLATE_STATE_LABELS[t.state] || { label: t.state || '?', color: 'bg-slate-100 text-slate-500' };
                                return (
                                    <div key={t.templateCode} className="p-3 bg-slate-50 rounded-xl">
                                        <div className="flex items-start justify-between gap-2 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800 text-sm truncate">{t.templateName || '제목없음'}</div>
                                                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                                    <span className="font-mono">{t.templateCode}</span>
                                                    <button onClick={() => copyTemplateCode(t.templateCode)} title="코드 복사">
                                                        <Copy size={12} className="text-slate-400 hover:text-slate-600" />
                                                    </button>
                                                </div>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${state.color} flex-shrink-0`}>
                                                {state.label}
                                            </span>
                                        </div>
                                        {t.template && (
                                            <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans bg-white p-2 rounded-lg border border-slate-100 max-h-32 overflow-y-auto">
                                                {t.template}
                                            </pre>
                                        )}
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="text-[10px] text-slate-400">
                                                {t.senderNum && <>발신: {t.senderNum} · </>}
                                                {t.plusFriendID && <>채널: {t.plusFriendID}</>}
                                            </div>
                                            {t.state === 'P' && (
                                                <button
                                                    onClick={() => applyTemplate(t)}
                                                    className="text-xs px-2 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-1"
                                                >
                                                    <Send size={10} /> 테스트 발송
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 발송 이력 */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Send size={18} className="text-yellow-600" />
                                최근 발송
                                <span className="text-xs text-slate-400 font-normal">({history.length})</span>
                            </h2>
                            <button onClick={loadHistory} disabled={historyLoading} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                {historyLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 새로고침
                            </button>
                        </div>

                        {history.length === 0 && !historyLoading && (
                            <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                                <Info size={20} />
                                발송 이력이 없습니다.
                            </div>
                        )}

                        <div className="space-y-2 max-h-[600px] overflow-y-auto">
                            {history.map((h) => {
                                const badge = STATUS_BADGE[h.status] || { label: h.status, color: 'bg-slate-100 text-slate-500' };
                                return (
                                    <div key={h.id} className="p-3 bg-slate-50 rounded-xl text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-800 truncate">
                                                {h.target_name || h.target_number}
                                            </span>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.color}`}>
                                                {badge.label}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mb-1">
                                            {h.target_number} · {h.trigger}
                                        </div>
                                        {h.template_code && (
                                            <div className="text-[10px] text-slate-400 font-mono truncate mb-1">
                                                {h.template_code}
                                            </div>
                                        )}
                                        {h.error_message && (
                                            <div className="text-xs text-red-600 mt-1">{h.error_message}</div>
                                        )}
                                        <div className="text-[10px] text-slate-400 mt-1">
                                            {h.created_at && new Date(h.created_at).toLocaleString('ko-KR')}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* 테스트 발송 모달 */}
            {showTestModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowTestModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-slate-800">알림톡 테스트 발송</h3>
                            <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">수신번호 *</label>
                                <input
                                    className={inputCls}
                                    placeholder="01012345678"
                                    value={testForm.target_number}
                                    onChange={(e) => setTestForm({ ...testForm, target_number: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">수신자 이름</label>
                                <input
                                    className={inputCls}
                                    placeholder="(선택)"
                                    value={testForm.target_name}
                                    onChange={(e) => setTestForm({ ...testForm, target_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">템플릿 코드 *</label>
                                <input
                                    className={`${inputCls} font-mono text-xs`}
                                    value={testForm.template_code}
                                    onChange={(e) => setTestForm({ ...testForm, template_code: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">발송 내용 *</label>
                                <textarea
                                    className={inputCls}
                                    rows={6}
                                    placeholder="템플릿 변수가 모두 치환된 최종 텍스트"
                                    value={testForm.content}
                                    onChange={(e) => setTestForm({ ...testForm, content: e.target.value })}
                                />
                                <div className="text-[10px] text-slate-400 mt-1">
                                    ※ 템플릿 본문과 1자 이상 다르면 발송 실패합니다.
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-5">
                            <button
                                onClick={() => setShowTestModal(false)}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleTestSend}
                                disabled={testSending}
                                className="flex-1 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 disabled:bg-slate-300 flex items-center justify-center gap-1"
                            >
                                {testSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                {testSending ? '발송 중...' : '발송'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
