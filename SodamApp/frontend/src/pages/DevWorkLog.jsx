import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Plus, Edit2, Trash2, Search, Filter, RefreshCw,
    FileText, Bug, Wrench, Server, Palette, MoreHorizontal, Calendar,
    CheckCircle2, Clock3, ChevronDown, X, Save, FileCode, Pin
} from 'lucide-react';
import api from '../api';

const CATEGORIES = [
    { key: 'feature', label: '기능추가', icon: Plus, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
    { key: 'bugfix', label: '버그수정', icon: Bug, color: 'text-red-400', bg: 'bg-red-500/20' },
    { key: 'refactor', label: '리팩토링', icon: Wrench, color: 'text-blue-400', bg: 'bg-blue-500/20' },
    { key: 'infra', label: '인프라', icon: Server, color: 'text-violet-400', bg: 'bg-violet-500/20' },
    { key: 'design', label: '디자인', icon: Palette, color: 'text-pink-400', bg: 'bg-pink-500/20' },
    { key: 'other', label: '기타', icon: MoreHorizontal, color: 'text-slate-400', bg: 'bg-slate-500/20' },
];

const getCat = (key) => CATEGORIES.find(c => c.key === key) || CATEGORIES[5];

export default function DevWorkLog() {
    const navigate = useNavigate();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filterCat, setFilterCat] = useState('');
    const [searchText, setSearchText] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingLog, setEditingLog] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [collapsedDates, setCollapsedDates] = useState(new Set());

    const today = new Date().toISOString().split('T')[0];
    const [form, setForm] = useState({
        date: today,
        title: '',
        content: '',
        category: 'feature',
        files_changed: '',
        ai_summary: '',
        status: 'completed',
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterCat) params.append('category', filterCat);
            if (searchText) params.append('search', searchText);
            const res = await api.get(`/superadmin/worklog?${params.toString()}`);
            setLogs(res.data.data || []);
        } catch (err) {
            console.error('WorkLog fetch error:', err);
        }
        setLoading(false);
    }, [filterCat, searchText]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const openCreate = () => {
        setEditingLog(null);
        setForm({
            date: today,
            title: '',
            content: '',
            category: 'feature',
            files_changed: '',
            ai_summary: '',
            status: 'completed',
        });
        setShowModal(true);
    };

    const openEdit = (log) => {
        setEditingLog(log);
        setForm({
            date: log.date,
            title: log.title,
            content: log.content || '',
            category: log.category,
            files_changed: log.files_changed || '',
            ai_summary: log.ai_summary || '',
            status: log.status,
        });
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!form.title.trim()) {
            alert('제목을 입력해 주세요.');
            return;
        }
        try {
            if (editingLog) {
                await api.put(`/superadmin/worklog/${editingLog.id}`, form);
            } else {
                await api.post('/superadmin/worklog', form);
            }
            setShowModal(false);
            fetchLogs();
        } catch (err) {
            alert(err.response?.data?.detail || '저장 오류');
        }
    };

    const handleDelete = async (log) => {
        if (!window.confirm(`'${log.title}' 작업일지를 삭제하시겠습니까?`)) return;
        try {
            await api.delete(`/superadmin/worklog/${log.id}`);
            fetchLogs();
        } catch {
            alert('삭제 오류');
        }
    };

    // 고정(HEAD) 항목과 일반 항목 분리 후 날짜별 그룹핑
    const pinned = logs.filter(l => l.is_pinned);
    const regular = logs.filter(l => !l.is_pinned);
    const grouped = {};
    regular.forEach(log => {
        if (!grouped[log.date]) grouped[log.date] = [];
        grouped[log.date].push(log);
    });

    const fmt = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4 md:p-6 pb-24">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full hover:bg-white/20">
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black flex items-center gap-3">
                                <FileText className="text-amber-400" size={28} />
                                작업일지
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">개발 작업 이력 관리 · AI 참고용</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => fetchLogs()} className="p-2 bg-white/10 rounded-xl hover:bg-white/20" title="새로고침">
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                        <button
                            onClick={openCreate}
                            className="flex items-center gap-2 bg-amber-500 text-slate-900 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20"
                        >
                            <Plus size={16} /> 작업 추가
                        </button>
                    </div>
                </header>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    {/* Search */}
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder="제목, 내용, 파일명 검색..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                        />
                    </div>
                    {/* Category Filter */}
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        <button
                            onClick={() => setFilterCat('')}
                            className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${!filterCat ? 'bg-amber-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            전체
                        </button>
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setFilterCat(filterCat === cat.key ? '' : cat.key)}
                                className={`px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${filterCat === cat.key ? 'bg-amber-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                            >
                                {cat.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-3 mb-6 text-xs">
                    <span className="bg-white/5 px-3 py-1.5 rounded-lg text-slate-400">
                        전체 <strong className="text-white">{logs.length}</strong>건
                    </span>
                    {pinned.length > 0 && (
                        <span className="bg-amber-500/10 px-3 py-1.5 rounded-lg text-amber-400">
                            📌 고정 <strong>{pinned.length}</strong>건
                        </span>
                    )}
                    {Object.keys(grouped).length > 0 && (
                        <span className="bg-white/5 px-3 py-1.5 rounded-lg text-slate-400">
                            <strong className="text-amber-400">{Object.keys(grouped).length}</strong>일
                        </span>
                    )}
                </div>

                {/* Pinned HEAD Entries */}
                {!loading && pinned.length > 0 && (
                    <div className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Pin size={16} className="text-amber-400" />
                            <h2 className="text-sm font-bold text-amber-400">고정 콘텐츠</h2>
                            <div className="flex-1 border-t border-amber-500/20" />
                        </div>
                        <div className="space-y-2">
                            {pinned.map(log => {
                                const cat = getCat(log.category);
                                const isExpanded = expandedId === log.id;
                                return (
                                    <div
                                        key={log.id}
                                        className="bg-amber-500/5 backdrop-blur-sm rounded-xl border border-amber-500/30 hover:border-amber-400/50 transition-all overflow-hidden"
                                    >
                                        <div
                                            className="flex items-center gap-3 p-4 cursor-pointer"
                                            onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        >
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-500/20">
                                                <Pin size={16} className="text-amber-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-sm text-amber-100">{log.title}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cat.bg} ${cat.color}`}>
                                                        {cat.label}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-amber-400/60 mt-0.5">날짜 무관 · 항상 최상단 고정</div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={e => { e.stopPropagation(); openEdit(log); }}
                                                    className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                                                    title="수정"
                                                >
                                                    <Edit2 size={13} />
                                                </button>
                                                <ChevronDown size={16} className={`text-amber-400/50 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>
                                        </div>
                                        {isExpanded && (
                                            <div className="border-t border-amber-500/15 p-4 space-y-3">
                                                {log.content && (
                                                    <div>
                                                        <div className="text-[10px] text-amber-400/50 font-bold uppercase mb-1">내용</div>
                                                        <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3">
                                                            {log.content}
                                                        </div>
                                                    </div>
                                                )}
                                                {log.ai_summary && (
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">🤖 AI 참고사항</div>
                                                        <div className="text-sm text-amber-300/80 whitespace-pre-wrap bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                                                            {log.ai_summary}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Logs by Date */}
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw size={32} className="animate-spin text-amber-400" />
                    </div>
                ) : Object.keys(grouped).length === 0 && pinned.length === 0 ? (
                    <div className="text-center py-20 text-slate-400">
                        <FileText size={48} className="mx-auto mb-4 opacity-30" />
                        <p className="text-lg font-bold mb-1">작업일지가 없습니다</p>
                        <p className="text-sm">"작업 추가" 버튼으로 첫 작업을 기록하세요</p>
                    </div>
                ) : Object.keys(grouped).length > 0 && (
                    <div className="space-y-6">
                        {Object.entries(grouped).map(([dateStr, dateLogs]) => {
                            const isDateCollapsed = collapsedDates.has(dateStr);
                            return (
                            <div key={dateStr}>
                                {/* Date Header - clickable to collapse */}
                                <button
                                    className="flex items-center gap-3 mb-3 w-full text-left group"
                                    onClick={() => {
                                        setCollapsedDates(prev => {
                                            const next = new Set(prev);
                                            if (next.has(dateStr)) next.delete(dateStr);
                                            else next.add(dateStr);
                                            return next;
                                        });
                                    }}
                                >
                                    <Calendar size={16} className="text-amber-400" />
                                    <h2 className="text-sm font-bold text-amber-400">{fmt(dateStr)}</h2>
                                    <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{dateLogs.length}건</span>
                                    <div className="flex-1 border-t border-white/5" />
                                    <ChevronDown size={14} className={`text-slate-500 transition-transform ${isDateCollapsed ? '-rotate-90' : ''}`} />
                                </button>

                                {/* Log Cards - collapsible */}
                                {!isDateCollapsed && (
                                <div className="space-y-2">
                                    {dateLogs.map(log => {
                                        const cat = getCat(log.category);
                                        const CatIcon = cat.icon;
                                        const isExpanded = expandedId === log.id;
                                        const filesArr = log.files_changed ? log.files_changed.split('\n').filter(Boolean) : [];

                                        return (
                                            <div
                                                key={log.id}
                                                className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 hover:border-amber-500/20 transition-all overflow-hidden"
                                            >
                                                {/* Card Header */}
                                                <div
                                                    className="flex items-center gap-3 p-4 cursor-pointer"
                                                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                >
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.bg}`}>
                                                        <CatIcon size={16} className={cat.color} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-bold text-sm">{log.title}</span>
                                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${cat.bg} ${cat.color}`}>
                                                                {cat.label}
                                                            </span>
                                                            {log.status === 'draft' && (
                                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 font-bold">
                                                                    임시저장
                                                                </span>
                                                            )}
                                                        </div>
                                                        {filesArr.length > 0 && (
                                                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                                                                <FileCode size={11} />
                                                                {filesArr.length}개 파일 수정
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <button
                                                            onClick={e => { e.stopPropagation(); openEdit(log); }}
                                                            className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30"
                                                            title="수정"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={e => { e.stopPropagation(); handleDelete(log); }}
                                                            className="p-1.5 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30"
                                                            title="삭제"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                        <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>

                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="border-t border-white/5 p-4 space-y-3">
                                                        {log.content && (
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">작업 내용</div>
                                                                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed bg-white/5 rounded-lg p-3">
                                                                    {log.content}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {filesArr.length > 0 && (
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">수정 파일</div>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {filesArr.map((f, i) => (
                                                                        <span key={i} className="text-[11px] bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md font-mono">
                                                                            {f}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {log.ai_summary && (
                                                            <div>
                                                                <div className="text-[10px] text-slate-500 font-bold uppercase mb-1">🤖 AI 참고사항</div>
                                                                <div className="text-sm text-amber-300/80 whitespace-pre-wrap bg-amber-500/5 border border-amber-500/10 rounded-lg p-3">
                                                                    {log.ai_summary}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                )}
                            </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 pt-[10vh] overflow-y-auto">
                    <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-2xl border border-white/10 shadow-2xl">
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <FileText size={20} className="text-amber-400" />
                                {editingLog ? '작업일지 수정' : '새 작업일지'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-1.5 bg-white/10 rounded-lg hover:bg-white/20">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Date & Category */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">작업일</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">카테고리</label>
                                    <select
                                        value={form.category}
                                        onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.key} value={c.key}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Title */}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                    제목 <span className="text-red-400">*</span>
                                </label>
                                <input
                                    value={form.title}
                                    onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                    placeholder="예: SuperAdmin 사이드바 메뉴 재구성"
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                />
                            </div>

                            {/* Content */}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">작업 상세 내용</label>
                                <textarea
                                    value={form.content}
                                    onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                                    placeholder="작업한 내용을 상세히 기록하세요..."
                                    rows={6}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                                />
                            </div>

                            {/* Files Changed */}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                    수정된 파일 <span className="text-slate-600">(줄바꿈으로 구분)</span>
                                </label>
                                <textarea
                                    value={form.files_changed}
                                    onChange={e => setForm(p => ({ ...p, files_changed: e.target.value }))}
                                    placeholder={"Sidebar.jsx\nSuperAdminDashboard.jsx\nsuperadmin.py"}
                                    rows={3}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500 resize-none font-mono text-xs"
                                />
                            </div>

                            {/* AI Summary */}
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">
                                    🤖 AI 참고사항 <span className="text-slate-600">(다음 작업 시 AI가 참고)</span>
                                </label>
                                <textarea
                                    value={form.ai_summary}
                                    onChange={e => setForm(p => ({ ...p, ai_summary: e.target.value }))}
                                    placeholder="다음 작업 시 AI가 알아야 할 중요한 정보, 주의사항, 진행 상태 등..."
                                    rows={3}
                                    className="w-full p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-100 placeholder:text-amber-900/50 outline-none focus:ring-2 focus:ring-amber-500 resize-none text-sm"
                                />
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-4">
                                <label className="text-xs text-slate-400">상태:</label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                    <input
                                        type="radio" name="status" value="completed"
                                        checked={form.status === 'completed'}
                                        onChange={() => setForm(p => ({ ...p, status: 'completed' }))}
                                        className="accent-amber-500"
                                    />
                                    <CheckCircle2 size={14} className="text-emerald-400" /> 완료
                                </label>
                                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                                    <input
                                        type="radio" name="status" value="draft"
                                        checked={form.status === 'draft'}
                                        onChange={() => setForm(p => ({ ...p, status: 'draft' }))}
                                        className="accent-amber-500"
                                    />
                                    <Clock3 size={14} className="text-yellow-400" /> 진행중
                                </label>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-white/10 rounded-xl font-bold hover:bg-white/20">취소</button>
                            <button onClick={handleSave} className="flex-1 py-2.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 shadow-lg flex items-center justify-center gap-2">
                                <Save size={16} /> {editingLog ? '수정' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
