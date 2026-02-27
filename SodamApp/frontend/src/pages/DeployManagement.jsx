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
        gradient: 'from-emerald-400 to-teal-500',
        bgGradient: 'from-emerald-500/10 to-teal-500/10',
        borderColor: 'border-emerald-500/30',
        accentText: 'text-emerald-400',
        icon: Smartphone,
    },
    admin: {
        name: '관리자 앱',
        desc: 'Web · sodamfn',
        url: 'https://sodamfn.twinverse.org',
        gradient: 'from-blue-400 to-indigo-500',
        bgGradient: 'from-blue-500/10 to-indigo-500/10',
        borderColor: 'border-blue-500/30',
        accentText: 'text-blue-400',
        icon: Globe,
    },
};

export default function DeployManagement() {
    const [staffList, setStaffList] = useState([]);
    const [selectedStaff, setSelectedStaff] = useState(new Set());
    const [activeApp, setActiveApp] = useState('staff');
    const [sending, setSending] = useState(false);
    const [showQR, setShowQR] = useState(null);
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
        <div className="p-6 max-w-5xl mx-auto" style={{ fontFamily: "'Pretendard', 'Inter', -apple-system, sans-serif" }}>
            {/* Toast */}
            {toast && (
                <div
                    className="fixed top-4 right-4 z-50 shadow-2xl"
                    style={{ animation: 'fadeSlideIn 0.3s ease-out' }}
                >
                    <div className={`px-5 py-3.5 rounded-2xl text-sm font-bold flex items-center gap-2.5 backdrop-blur-xl ${toast.type === 'error'
                        ? 'bg-red-500/90 text-white shadow-red-500/30'
                        : 'bg-emerald-500/90 text-white shadow-emerald-500/30'
                        }`} style={{ boxShadow: `0 8px 32px ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                        {toast.type === 'error' ? <X size={16} /> : <Check size={16} />}
                        {toast.msg}
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                        background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                        boxShadow: '0 8px 24px rgba(139,92,246,0.35)'
                    }}
                >
                    <Rocket size={24} className="text-white" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">앱 배포</h1>
                    <p className="text-sm text-slate-300 mt-0.5">직원 · 관리자 앱 설치 링크 전송</p>
                </div>
                <button
                    onClick={() => { fetchStaff(); fetchHistory(); }}
                    className="ml-auto p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 hover:border-white/20"
                >
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* App Selector Tabs */}
            <div className="flex gap-3 mb-7 p-1.5 bg-slate-900/60 rounded-2xl border border-white/5">
                {Object.entries(APP_INFO).map(([key, app]) => (
                    <button
                        key={key}
                        onClick={() => { setActiveApp(key); setSelectedStaff(new Set()); setShowQR(null); }}
                        className={`flex-1 flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${activeApp === key
                            ? 'text-white shadow-lg'
                            : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                        style={activeApp === key ? {
                            background: key === 'staff'
                                ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                                : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                            boxShadow: key === 'staff'
                                ? '0 4px 20px rgba(16,185,129,0.35)'
                                : '0 4px 20px rgba(59,130,246,0.35)',
                        } : {}}
                    >
                        <app.icon size={18} />
                        {app.name}
                    </button>
                ))}
            </div>

            {/* App Info Card */}
            <div
                className={`rounded-2xl border overflow-hidden mb-7 ${info.borderColor}`}
                style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))' }}
            >
                <div className="p-6">
                    {/* App header */}
                    <div className="flex items-center gap-4 mb-5">
                        <div
                            className="w-14 h-14 rounded-2xl flex items-center justify-center"
                            style={{
                                background: activeApp === 'staff'
                                    ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                                    : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                boxShadow: activeApp === 'staff'
                                    ? '0 8px 24px rgba(16,185,129,0.3)'
                                    : '0 8px 24px rgba(59,130,246,0.3)',
                            }}
                        >
                            <info.icon size={26} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white">{info.name}</h2>
                            <p className="text-sm text-slate-400 mt-0.5">{info.desc}</p>
                        </div>
                    </div>

                    {/* URL Bar */}
                    <div className="flex items-center gap-2 mb-5 p-3.5 bg-black/30 rounded-xl border border-white/8">
                        <Globe size={15} className={info.accentText} />
                        <a href={info.url} target="_blank" rel="noreferrer" className={`text-sm font-medium ${info.accentText} hover:underline truncate`}>
                            {info.url}
                        </a>
                        <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            <button onClick={() => copyLink(info.url)} className="p-2 hover:bg-white/10 rounded-lg transition-all" title="링크 복사">
                                <Copy size={15} className="text-slate-300" />
                            </button>
                            <a href={info.url} target="_blank" rel="noreferrer" className="p-2 hover:bg-white/10 rounded-lg transition-all" title="새 탭에서 열기">
                                <ExternalLink size={15} className="text-slate-300" />
                            </a>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-3">
                        {[
                            { icon: Link2, label: '링크 복사', onClick: () => copyLink(info.url), active: false },
                            { icon: QrCode, label: 'QR 코드', onClick: () => setShowQR(showQR === activeApp ? null : activeApp), active: showQR === activeApp },
                            { icon: Share2, label: '공유하기', onClick: () => shareLink(info.url, info.name), active: false },
                        ].map((btn, i) => (
                            <button
                                key={i}
                                onClick={btn.onClick}
                                className="group flex flex-col items-center gap-2.5 p-4 rounded-xl transition-all duration-200 border"
                                style={{
                                    background: btn.active
                                        ? 'linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.2))'
                                        : 'rgba(255,255,255,0.03)',
                                    borderColor: btn.active ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)',
                                }}
                            >
                                <btn.icon size={22} className={btn.active ? 'text-violet-400' : 'text-slate-300 group-hover:text-white'} />
                                <span className={`text-xs font-bold ${btn.active ? 'text-violet-300' : 'text-slate-400 group-hover:text-white'}`}>
                                    {btn.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* QR Code */}
                    {showQR === activeApp && (
                        <div
                            className="mt-5 flex flex-col items-center p-8 rounded-2xl"
                            style={{
                                background: 'linear-gradient(180deg, #ffffff, #f8fafc)',
                                animation: 'fadeSlideIn 0.3s ease-out',
                            }}
                        >
                            <div className="p-4 bg-white rounded-2xl shadow-lg">
                                <QRCodeSVG
                                    value={info.url}
                                    size={200}
                                    level="H"
                                    includeMargin={false}
                                    bgColor="#ffffff"
                                    fgColor="#0f172a"
                                />
                            </div>
                            <p className="mt-4 text-base font-black text-slate-800">{info.name} 설치</p>
                            <p className="mt-1 text-sm text-slate-500">📷 카메라로 QR 코드를 스캔하세요</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Staff Selection */}
            <div
                className="rounded-2xl border border-white/8 overflow-hidden mb-7"
                style={{ background: 'linear-gradient(180deg, rgba(30,41,59,0.8), rgba(15,23,42,0.9))' }}
            >
                <div className="p-5 border-b border-white/8">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Users size={20} className="text-white" />
                            <h3 className="text-base font-black text-white">직원 목록</h3>
                            {selectedStaff.size > 0 && (
                                <span
                                    className="px-2.5 py-1 rounded-full text-xs font-bold text-white"
                                    style={{
                                        background: activeApp === 'staff'
                                            ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                                            : 'linear-gradient(135deg, #3b82f6, #6366f1)',
                                    }}
                                >
                                    {selectedStaff.size}명 선택
                                </span>
                            )}
                        </div>
                        {staffList.length > 0 && (
                            <button
                                onClick={toggleAll}
                                className="text-xs font-bold text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10 transition-all border border-white/10"
                            >
                                {selectedStaff.size === staffList.length ? '선택 해제' : '전체 선택'}
                            </button>
                        )}
                    </div>
                </div>

                {loading ? (
                    <div className="p-10 flex flex-col items-center gap-3">
                        <Loader2 size={28} className="animate-spin text-slate-400" />
                        <span className="text-sm text-slate-400">직원 목록을 불러오는 중...</span>
                    </div>
                ) : staffList.length === 0 ? (
                    <div className="p-10 text-center">
                        <Users size={40} className="text-slate-600 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">등록된 직원이 없습니다.</p>
                        <p className="text-xs text-slate-500 mt-1">직원 관리에서 직원을 먼저 등록해주세요.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
                        {staffList.map(staff => (
                            <label
                                key={staff.id}
                                className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-all duration-200 ${selectedStaff.has(staff.id)
                                    ? 'bg-white/8'
                                    : 'hover:bg-white/5'
                                    }`}
                            >
                                <div className="relative">
                                    <input
                                        type="checkbox"
                                        checked={selectedStaff.has(staff.id)}
                                        onChange={() => toggleStaff(staff.id)}
                                        className="sr-only"
                                    />
                                    <div
                                        className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                                        style={{
                                            background: selectedStaff.has(staff.id)
                                                ? (activeApp === 'staff' ? '#10b981' : '#3b82f6')
                                                : 'transparent',
                                            borderColor: selectedStaff.has(staff.id)
                                                ? (activeApp === 'staff' ? '#10b981' : '#3b82f6')
                                                : 'rgba(255,255,255,0.2)',
                                        }}
                                    >
                                        {selectedStaff.has(staff.id) && <Check size={13} className="text-white" strokeWidth={3} />}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{staff.name}</span>
                                        <span className="text-xs font-medium text-slate-400 px-2 py-0.5 bg-white/5 rounded-md">{staff.role}</span>
                                    </div>
                                    <span className="text-xs text-slate-400 mt-0.5 block">
                                        {staff.phone || '📵 전화번호 미등록'}
                                    </span>
                                </div>
                                {staff.last_sent && (
                                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full">
                                        <CheckCircle2 size={13} />
                                        전송됨
                                    </span>
                                )}
                            </label>
                        ))}
                    </div>
                )}

                {/* Send Button */}
                <div className="p-4 border-t border-white/8">
                    <button
                        onClick={handleSendLinks}
                        disabled={selectedStaff.size === 0 || sending}
                        className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl font-bold text-sm transition-all duration-300"
                        style={{
                            background: selectedStaff.size === 0 || sending
                                ? 'rgba(255,255,255,0.05)'
                                : (activeApp === 'staff'
                                    ? 'linear-gradient(135deg, #10b981, #14b8a6)'
                                    : 'linear-gradient(135deg, #3b82f6, #6366f1)'),
                            color: selectedStaff.size === 0 || sending ? 'rgba(255,255,255,0.25)' : '#fff',
                            boxShadow: selectedStaff.size > 0 && !sending
                                ? (activeApp === 'staff'
                                    ? '0 4px 20px rgba(16,185,129,0.35)'
                                    : '0 4px 20px rgba(59,130,246,0.35)')
                                : 'none',
                            cursor: selectedStaff.size === 0 || sending ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {sending ? (
                            <><Loader2 size={17} className="animate-spin" /> 전송 중...</>
                        ) : (
                            <><Send size={17} /> {selectedStaff.size > 0 ? `${selectedStaff.size}명에게 설치 링크 기록` : '직원을 선택하세요'}</>
                        )}
                    </button>
                </div>
            </div>

            {/* History */}
            <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-5 py-3.5 rounded-xl text-sm font-bold text-slate-200 hover:text-white transition-all border border-slate-600 hover:border-slate-500 mb-5"
                style={{ background: '#1e293b' }}
            >
                <div className="flex items-center gap-2.5">
                    <Clock size={17} />
                    <span>전송 이력</span>
                    <span className="text-xs text-slate-400 font-normal">({history.length}건)</span>
                </div>
                {showHistory ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
            </button>

            {showHistory && history.length > 0 && (
                <div
                    className="rounded-xl border border-slate-600 divide-y divide-slate-600 max-h-60 overflow-y-auto mb-5"
                    style={{ background: '#1e293b' }}
                >
                    {history.map(h => (
                        <div key={h.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                            <span className="font-bold text-white">{h.staff_name}</span>
                            <span className="text-xs font-medium text-slate-400 px-2 py-0.5 bg-white/5 rounded-md">
                                {h.app_type === 'staff' ? '직원앱' : '관리자앱'}
                            </span>
                            <span className="ml-auto text-xs text-slate-400">
                                {new Date(h.sent_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Info Footer */}
            <div className="p-5 rounded-xl border border-slate-600" style={{ background: '#1e293b' }}>
                <div className="flex flex-col gap-2 text-sm text-slate-200 leading-relaxed">
                    <div className="flex items-start gap-2">
                        <span>📱</span>
                        <span>직원을 선택하고 설치 링크를 전송하면, 각 직원이 링크를 통해 앱을 설치할 수 있습니다.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span>🔗</span>
                        <span>"링크 복사"로 메신저에 공유하거나, "QR 코드"로 직원들이 스캔하여 설치하세요.</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-slate-400">💬</span>
                        <span className="text-slate-400">SMS 자동 발송 기능은 추후 업데이트 예정입니다.</span>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
