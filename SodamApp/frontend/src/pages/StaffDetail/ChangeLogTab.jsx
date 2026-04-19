import { useState, useEffect, useCallback } from 'react';
import { History, Plus, ArrowRight, User, Briefcase, CreditCard, Shield, Clock, FileText, AlertTriangle } from 'lucide-react';
import api from '../../api';

const CHANGE_ICONS = {
    '입사': { icon: User, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    '시급변경': { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    '월급변경': { icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
    '직급변경': { icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50' },
    '직책변경': { icon: Briefcase, color: 'text-violet-600', bg: 'bg-violet-50' },
    '부서변경': { icon: Briefcase, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    '계약변경': { icon: FileText, color: 'text-amber-600', bg: 'bg-amber-50' },
    '상태변경': { icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' },
    '4대보험변경': { icon: Shield, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    '퇴사': { icon: User, color: 'text-slate-600', bg: 'bg-slate-100' },
};

const DEFAULT_ICON = { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-50' };

export default function ChangeLogTab({ id, formData: staffData }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showNoteForm, setShowNoteForm] = useState(false);
    const [note, setNote] = useState('');

    const fetchLogs = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await api.get(`/hr/changelog/${id}`);
            if (res.data.status === 'success') {
                setLogs(res.data.data || []);
            }
        } catch (err) {
            console.error('Changelog fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleAddNote = async () => {
        if (!note.trim()) return;
        try {
            await api.post(`/hr/changelog/${id}`, {
                change_type: '메모',
                note: note.trim(),
            });
            setNote('');
            setShowNoteForm(false);
            fetchLogs();
        } catch (err) {
            console.error(err);
            alert('메모 등록 실패');
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
            </div>
        );
    }

    // Group logs by date
    const groupedByDate = {};
    logs.forEach(log => {
        const dateStr = log.created_at?.slice(0, 10) || 'unknown';
        if (!groupedByDate[dateStr]) groupedByDate[dateStr] = [];
        groupedByDate[dateStr].push(log);
    });

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History size={18} className="text-indigo-600" />
                    <h2 className="text-base font-bold text-slate-800">인사변경 이력</h2>
                    <span className="text-xs text-slate-400">총 {logs.length}건</span>
                </div>
                <button
                    onClick={() => setShowNoteForm(!showNoteForm)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors"
                >
                    <Plus size={15} />
                    메모 추가
                </button>
            </div>

            {/* Note Form */}
            {showNoteForm && (
                <div className="bg-white rounded-2xl border-2 border-indigo-200 p-5 space-y-3">
                    <input
                        type="text"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="인사 관련 메모를 입력하세요 (예: 구두 경고, 면담 기록 등)"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    />
                    <div className="flex gap-2">
                        <button onClick={() => setShowNoteForm(false)} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold">취소</button>
                        <button onClick={handleAddNote} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">등록</button>
                    </div>
                </div>
            )}

            {/* Timeline */}
            {logs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
                    <History size={40} className="text-slate-200 mx-auto mb-3" />
                    <p className="text-sm text-slate-400">아직 기록된 변경 이력이 없습니다.</p>
                    <p className="text-xs text-slate-300 mt-1">인사정보 변경 시 자동으로 기록됩니다.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.entries(groupedByDate).map(([dateStr, dayLogs]) => (
                        <div key={dateStr}>
                            {/* Date header */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-2 h-2 rounded-full bg-indigo-400" />
                                <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{dateStr}</span>
                                <div className="flex-1 h-px bg-slate-100" />
                            </div>

                            <div className="ml-4 border-l-2 border-slate-100 pl-5 space-y-3">
                                {dayLogs.map((log) => {
                                    const config = CHANGE_ICONS[log.change_type] || DEFAULT_ICON;
                                    const Icon = config.icon;
                                    const timeStr = log.created_at?.slice(11, 16) || '';

                                    return (
                                        <div key={log.id} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-sm transition-all relative">
                                            {/* Connector dot */}
                                            <div className="absolute -left-[29px] top-4 w-3 h-3 rounded-full bg-white border-2 border-slate-200" />

                                            <div className="flex items-start gap-3">
                                                <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                                                    <Icon size={14} className={config.color} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-xs font-bold ${config.color}`}>{log.change_type}</span>
                                                        {log.field_name && (
                                                            <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{log.field_name}</span>
                                                        )}
                                                        <span className="text-[10px] text-slate-300 ml-auto">{timeStr}</span>
                                                    </div>

                                                    {(log.old_value || log.new_value) && (
                                                        <div className="flex items-center gap-2 text-sm">
                                                            {log.old_value && (
                                                                <span className="text-slate-400 line-through">{log.old_value}</span>
                                                            )}
                                                            {log.old_value && log.new_value && (
                                                                <ArrowRight size={12} className="text-slate-300" />
                                                            )}
                                                            {log.new_value && (
                                                                <span className="text-slate-800 font-bold">{log.new_value}</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {log.note && (
                                                        <p className="text-xs text-slate-500 mt-1 italic">{log.note}</p>
                                                    )}

                                                    <p className="text-[10px] text-slate-300 mt-1">{log.changed_by}</p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
