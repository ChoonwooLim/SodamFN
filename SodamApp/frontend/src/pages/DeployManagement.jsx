import { useState, useEffect, useCallback } from 'react';
import api from '../api';
import { QRCodeSVG } from 'qrcode.react';
import {
    Rocket, RefreshCw, CheckCircle2, Loader2, ExternalLink, Copy,
    Globe, Smartphone, Users, Send, QrCode, Check, X,
    ChevronDown, ChevronUp, Clock, Link2, Share2
} from 'lucide-react';

const APP_INFO = {
    staff: {
        name: '직원용 앱',
        desc: 'PWA · sodam-staff',
        url: 'https://sodam-staff.pages.dev',
        gradient: 'from-emerald-500 to-teal-600',
        color: 'emerald',
        icon: Smartphone,
    },
    admin: {
        name: '관리자 앱',
        desc: 'Web · sodamfn',
        url: 'https://sodamfn.twinverse.org',
        gradient: 'from-blue-500 to-indigo-600',
        color: 'blue',
        icon: Globe,
    },
};

export default function DeployManagement() {
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(new Set());
    const [activeApp, setActiveApp] = useState('staff');
    const [sending, setSending] = useState(false);
    const [showQR, setShowQR] = useState(null); // 'staff' | 'admin' | null
    const [history, setHistory] = useState([]);
    const [showHistory, setShowHistory] = useState(false);
    const [toast, setToast] = useState(null);
    const [loading, setLoading] = useState(true);

    const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchStaff = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/distribute/staff-list');
            setStaffList(res.data.data || []);
        } catch {
            setStaffList([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        try {
            const res = await api.get('/distribute/history');
            setHistory(res.data.data || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => { fetchStaff(); fetchHistory(); }, [fetchStaff, fetchHistory]);

    const toggleAll = () => {
        if (selectedStaff.size === staffList.length) {
            setSelectedStaff(new Set());
        } else {
            setSelectedStaff(new Set(staffList.map(s => s.id)));
        }
    };

    const toggleStaff = (id) => {
        const next = new Set(selectedStaff);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStaff(next);
    };

    const copyLink = (url) => {
        navigator.clipboard?.writeText(url);
        showToast('설치 링크가 복사되었습니다! 📋');
    };

    const shareLink = async (url, appName) => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${appName} 설치`,
                    text: `소담 ${appName}을 설치해주세요!`,
                    url: url,
                });
                showToast('공유 완료! ✅');
            } catch { /* cancelled */ }
        } else {
            copyLink(url);
        }
    };

    const handleSendLinks = async () => {
        if (selectedStaff.size === 0) {
            showToast('전송할 직원을 선택해주세요.', 'error');
            return;
        }
        setSending(true);
        try {
            const res = await api.post('/distribute/send-links', {
                staff_ids: [...selectedStaff],
                app_type: activeApp,
                method: 'link',
            });
            showToast(res.data.message);
            setSelectedStaff(new Set());
            fetchHistory();
            fetchStaff();
        } catch (err) {
            showToast(err.response?.data?.detail || '전송 실패', 'error');
        } finally {
            setSending(false);
        }
    };

    const info = APP_INFO[activeApp];

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Toast */}
            {toast && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 animate-fade-in ${toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                    {toast.type === 'error' ? <X size={16} /> : <Check size={16} />}
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                    <Rocket size={22} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white">앱 배포</h1>
                    <p className="text-sm text-slate-400">직원 · 관리자 앱 설치 링크 전송</p>
                </div>
                <button onClick={() => { fetchStaff(); fetchHistory(); }} className="ml-auto p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* App Selector Tabs */}
            <div className="flex gap-2 mb-6">
                {Object.entries(APP_INFO).map(([key, app]) => (
                    <button
                        key={key}
                        onClick={() => { setActiveApp(key); setSelectedStaff(new Set()); }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeApp === key
                                ? `bg-gradient-to-r ${app.gradient} text-white shadow-lg`
                                : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50 hover:text-white'
                            }`}
                    >
                        <app.icon size={18} />
                        {app.name}
                    </button>
                ))}
            </div>

            {/* App Info + Quick Actions */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-5 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${info.gradient} flex items-center justify-center shadow-lg`}>
                        <info.icon size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-white">{info.name}</h2>
                        <p className="text-xs text-slate-400">{info.desc}</p>
                    </div>
                </div>

                {/* URL */}
                <div className="flex items-center gap-2 mb-4 p-3 bg-slate-900/50 rounded-xl">
                    <Globe size={14} className={`text-${info.color}-400 flex-shrink-0`} />
                    <a href={info.url} target="_blank" rel="noreferrer" className={`text-sm text-${info.color}-400 hover:underline truncate`}>
                        {info.url}
                    </a>
                    <button onClick={() => copyLink(info.url)} className="p-1.5 hover:bg-slate-700 rounded-lg flex-shrink-0" title="링크 복사">
                        <Copy size={14} className="text-slate-400" />
                    </button>
                    <a href={info.url} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-slate-700 rounded-lg flex-shrink-0" title="열기">
                        <ExternalLink size={14} className="text-slate-400" />
                    </a>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => copyLink(info.url)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-all group"
                    >
                        <Link2 size={20} className="text-slate-300 group-hover:text-white" />
                        <span className="text-xs font-bold text-slate-400 group-hover:text-white">링크 복사</span>
                    </button>
                    <button
                        onClick={() => setShowQR(showQR === activeApp ? null : activeApp)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all group ${showQR === activeApp ? 'bg-violet-600 text-white' : 'bg-slate-700/50 hover:bg-slate-700'
                            }`}
                    >
                        <QrCode size={20} className={showQR === activeApp ? 'text-white' : 'text-slate-300 group-hover:text-white'} />
                        <span className={`text-xs font-bold ${showQR === activeApp ? 'text-white' : 'text-slate-400 group-hover:text-white'}`}>QR 코드</span>
                    </button>
                    <button
                        onClick={() => shareLink(info.url, info.name)}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-slate-700/50 hover:bg-slate-700 transition-all group"
                    >
                        <Share2 size={20} className="text-slate-300 group-hover:text-white" />
                        <span className="text-xs font-bold text-slate-400 group-hover:text-white">공유하기</span>
                    </button>
                </div>

                {/* QR Code Display */}
                {showQR === activeApp && (
                    <div className="mt-4 flex flex-col items-center p-6 bg-white rounded-xl animate-fade-in">
                        <QRCodeSVG
                            value={info.url}
                            size={200}
                            level="H"
                            includeMargin={true}
                            bgColor="#ffffff"
                            fgColor="#0f172a"
                        />
                        <p className="mt-3 text-sm font-bold text-slate-800">{info.name} 설치</p>
                        <p className="text-xs text-slate-500">카메라로 QR 코드를 스캔하세요</p>
                    </div>
                )}
            </div>

            {/* Staff Selection for Bulk Send */}
            <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden mb-6">
                <div className="p-5 border-b border-slate-700/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users size={18} className="text-slate-300" />
                            <h3 className="text-base font-bold text-white">직원 목록</h3>
                            <span className="text-xs text-slate-400 ml-1">
                                {selectedStaff.size > 0 && `${selectedStaff.size}명 선택`}
                            </span>
                        </div>
                        <button
                            onClick={toggleAll}
                            className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-all"
                        >
                            {selectedStaff.size === staffList.length ? '선택 해제' : '전체 선택'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="p-8 flex justify-center">
                        <Loader2 size={24} className="animate-spin text-slate-400" />
                    </div>
                ) : staffList.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                        등록된 직원이 없습니다.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-700/30 max-h-80 overflow-y-auto">
                        {staffList.map(staff => (
                            <label
                                key={staff.id}
                                className={`flex items-center gap-3 px-5 py-3 cursor-pointer transition-all hover:bg-slate-700/30 ${selectedStaff.has(staff.id) ? 'bg-slate-700/20' : ''
                                    }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={selectedStaff.has(staff.id)}
                                    onChange={() => toggleStaff(staff.id)}
                                    className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500/20"
                                />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{staff.name}</span>
                                        <span className="text-xs text-slate-400">{staff.role}</span>
                                    </div>
                                    <span className="text-xs text-slate-500">
                                        {staff.phone || '전화번호 미등록'}
                                    </span>
                                </div>
                                {staff.last_sent && (
                                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                                        <CheckCircle2 size={12} />
                                        전송됨
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                )}

                {/* Send Button */}
                <div className="p-4 border-t border-slate-700/50">
                    <button
                        onClick={handleSendLinks}
                        disabled={selectedStaff.size === 0 || sending}
                        className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm transition-all ${selectedStaff.size === 0 || sending
                                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                                : `bg-gradient-to-r ${info.gradient} text-white hover:shadow-lg active:scale-[0.98]`
                            }`}
                    >
                        {sending ? (
                            <><Loader2 size={16} className="animate-spin" /> 전송 중...</>
                        ) : (
                            <><Send size={16} /> {selectedStaff.size > 0 ? `${selectedStaff.size}명에게 설치 링크 기록` : '직원을 선택하세요'}</>
                        )}
                    </button>
                </div>
            </div>

            {/* History Toggle */}
            <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-5 py-3 rounded-xl bg-slate-800/30 border border-slate-700/30 text-sm font-bold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all mb-4"
            >
                <div className="flex items-center gap-2">
                    <Clock size={16} />
                    전송 이력 ({history.length}건)
                </div>
                {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showHistory && history.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/30 divide-y divide-slate-700/20 max-h-60 overflow-y-auto">
                    {history.map(h => (
                        <div key={h.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                            <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                            <span className="font-bold text-white">{h.staff_name}</span>
                            <span className="text-xs text-slate-500">{h.app_type === 'staff' ? '직원앱' : '관리자앱'}</span>
                            <span className="ml-auto text-xs text-slate-500">
                                {new Date(h.sent_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Info */}
            <div className="mt-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                <p className="text-xs text-slate-500 leading-relaxed">
                    📱 직원을 선택하고 설치 링크를 전송하면, 각 직원이 링크를 통해 앱을 설치할 수 있습니다.
                    <br />🔗 "링크 복사"로 메신저에 공유하거나, "QR 코드"로 직원들이 스캔하여 설치하세요.
                    <br />💬 SMS 자동 발송 기능은 추후 업데이트 예정입니다.
                </p>
            </div>
        </div>
    );
}
