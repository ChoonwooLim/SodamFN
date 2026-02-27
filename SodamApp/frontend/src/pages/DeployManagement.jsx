import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { Rocket, RefreshCw, CheckCircle2, XCircle, Loader2, ExternalLink, Copy, Globe, Smartphone } from 'lucide-react';

export default function DeployManagement() {
    const [status, setStatus] = useState({
        staff: { status: 'idle', message: '', url: 'https://sodam-staff.pages.dev' },
        admin: { status: 'idle', message: '', url: 'https://sodamfn.twinverse.org' },
    });
    const [polling, setPolling] = useState(false);

    const fetchStatus = useCallback(async () => {
        try {
            const res = await api.get('/deploy/status');
            setStatus(res.data.data);
            const s = res.data.data;
            if (s.staff.status === 'building' || s.staff.status === 'deploying' ||
                s.admin.status === 'building' || s.admin.status === 'deploying') {
                setPolling(true);
            } else {
                setPolling(false);
            }
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchStatus(); }, [fetchStatus]);
    useEffect(() => {
        if (!polling) return;
        const iv = setInterval(fetchStatus, 2000);
        return () => clearInterval(iv);
    }, [polling, fetchStatus]);

    const handleDeploy = async (type) => {
        try {
            await api.post(`/deploy/${type}`);
            setPolling(true);
            fetchStatus();
        } catch (err) {
            alert(err.response?.data?.detail || '배포 실패');
        }
    };

    const copyUrl = (url) => {
        navigator.clipboard?.writeText(url);
        alert('URL이 복사되었습니다!');
    };

    const getStatusBadge = (s) => {
        switch (s.status) {
            case 'building':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-yellow-500/15 text-yellow-400"><Loader2 size={12} className="animate-spin" /> 빌드 중</span>;
            case 'deploying':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/15 text-blue-400"><Loader2 size={12} className="animate-spin" /> 배포 중</span>;
            case 'success':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-500/15 text-green-400"><CheckCircle2 size={12} /> 완료</span>;
            case 'error':
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/15 text-red-400"><XCircle size={12} /> 오류</span>;
            default:
                return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-500/15 text-slate-400">대기</span>;
        }
    };

    const isDeploying = (type) => ['building', 'deploying'].includes(status[type]?.status);

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Rocket size={22} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">배포 관리</h1>
                    <p className="text-sm text-slate-400">Cloudflare Pages 배포</p>
                </div>
                <button onClick={fetchStatus} className="ml-auto p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                    <RefreshCw size={18} />
                </button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Staff App */}
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <Smartphone size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">직원용 앱</h2>
                                <p className="text-xs text-slate-400">PWA · sodam-staff</p>
                            </div>
                            {getStatusBadge(status.staff)}
                        </div>

                        <div className="flex items-center gap-2 mb-3 p-3 bg-slate-900/50 rounded-xl">
                            <Globe size={14} className="text-emerald-400 flex-shrink-0" />
                            <a href={status.staff.url} target="_blank" rel="noreferrer" className="text-sm text-emerald-400 hover:underline truncate">{status.staff.url}</a>
                            <button onClick={() => copyUrl(status.staff.url)} className="p-1 hover:bg-slate-700 rounded flex-shrink-0"><Copy size={14} className="text-slate-400" /></button>
                            <a href={status.staff.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-700 rounded flex-shrink-0"><ExternalLink size={14} className="text-slate-400" /></a>
                        </div>

                        {status.staff.message && (
                            <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${status.staff.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-slate-900/50 text-slate-300'}`}>
                                {status.staff.message}
                            </p>
                        )}

                        <button
                            onClick={() => handleDeploy('staff')}
                            disabled={isDeploying('staff')}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isDeploying('staff')
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:shadow-lg hover:shadow-emerald-500/20 active:scale-98'
                                }`}
                        >
                            {isDeploying('staff') ? <><Loader2 size={16} className="animate-spin" /> 배포 진행 중...</> : <><Rocket size={16} /> 직원앱 배포</>}
                        </button>

                        <a
                            href={`${status.staff.url}/install`}
                            target="_blank" rel="noreferrer"
                            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-all"
                        >
                            📱 설치 안내 페이지 열기
                        </a>
                    </div>
                </div>

                {/* Admin App */}
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                                <Globe size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-white">관리자 앱</h2>
                                <p className="text-xs text-slate-400">Web · sodamfn</p>
                            </div>
                            {getStatusBadge(status.admin)}
                        </div>

                        <div className="flex items-center gap-2 mb-3 p-3 bg-slate-900/50 rounded-xl">
                            <Globe size={14} className="text-blue-400 flex-shrink-0" />
                            <a href={status.admin.url} target="_blank" rel="noreferrer" className="text-sm text-blue-400 hover:underline truncate">{status.admin.url}</a>
                            <button onClick={() => copyUrl(status.admin.url)} className="p-1 hover:bg-slate-700 rounded flex-shrink-0"><Copy size={14} className="text-slate-400" /></button>
                            <a href={status.admin.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-700 rounded flex-shrink-0"><ExternalLink size={14} className="text-slate-400" /></a>
                        </div>

                        {status.admin.message && (
                            <p className={`text-xs mb-3 px-3 py-2 rounded-lg ${status.admin.status === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-slate-900/50 text-slate-300'}`}>
                                {status.admin.message}
                            </p>
                        )}

                        <button
                            onClick={() => handleDeploy('admin')}
                            disabled={isDeploying('admin')}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${isDeploying('admin')
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/20 active:scale-98'
                                }`}
                        >
                            {isDeploying('admin') ? <><Loader2 size={16} className="animate-spin" /> 배포 진행 중...</> : <><Rocket size={16} /> 관리자앱 배포</>}
                        </button>
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="mt-6 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <p className="text-xs text-slate-500 leading-relaxed">
                    💡 배포 버튼을 누르면 최신 코드를 빌드하여 Cloudflare Pages에 자동 배포합니다.
                    배포 중에는 2초마다 상태가 자동 업데이트됩니다.
                    <br />⚠️ 로컬 개발 서버에서만 배포 기능이 작동합니다.
                </p>
            </div>
        </div>
    );
}
