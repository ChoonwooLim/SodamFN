import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, History, RefreshCw } from 'lucide-react';
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
    const [loading, setLoading] = useState(false);
    const [registerOpen, setRegisterOpen] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [msg, setMsg] = useState('');
    const [err, setErr] = useState('');

    const fetchConns = async () => {
        setLoading(true);
        setErr('');
        try {
            const res = await api.get('/codef/connections', { params: { type: 'card' } });
            setConns(res.data.connections || []);
        } catch (e) {
            setErr(e.response?.data?.detail || '데이터를 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchConns();
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
            </div>
        </div>
    );
}
