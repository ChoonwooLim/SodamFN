import { useState, useEffect, useCallback } from 'react';
import { CalendarDays, Plus, Check, X, Clock, AlertTriangle, Palmtree, Baby, Heart, Award, Briefcase, ChevronDown, Trash2, Edit3, Info } from 'lucide-react';
import api from '../../api';

const LEAVE_TYPES = [
    { value: '연차', label: '연차', icon: Palmtree, color: 'text-emerald-600', bg: 'bg-emerald-50', half: false },
    { value: '반차(오전)', label: '반차(오전)', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', half: true },
    { value: '반차(오후)', label: '반차(오후)', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', half: true },
    { value: '병가', label: '병가', icon: Heart, color: 'text-rose-600', bg: 'bg-rose-50', half: false },
    { value: '경조사', label: '경조사', icon: Award, color: 'text-violet-600', bg: 'bg-violet-50', half: false },
    { value: '출산휴가', label: '출산휴가', icon: Baby, color: 'text-pink-600', bg: 'bg-pink-50', half: false },
    { value: '육아휴직', label: '육아휴직', icon: Baby, color: 'text-pink-600', bg: 'bg-pink-50', half: false },
    { value: '공가', label: '공가', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50', half: false },
    { value: '특별휴가', label: '특별휴가', icon: Award, color: 'text-indigo-600', bg: 'bg-indigo-50', half: false },
    { value: '무급휴가', label: '무급휴가', icon: AlertTriangle, color: 'text-slate-600', bg: 'bg-slate-50', half: false },
];

const STATUS_CONFIG = {
    '대기': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    '승인': { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
    '반려': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    '취소': { color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-200' },
};

export default function LeaveTab({ id, formData: staffData }) {
    const [year, setYear] = useState(new Date().getFullYear());
    const [balance, setBalance] = useState(null);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editBalanceMode, setEditBalanceMode] = useState(false);

    // New request form
    const [form, setForm] = useState({
        leave_type: '연차',
        start_date: '',
        end_date: '',
        days: 1,
        reason: '',
    });

    // Balance edit form
    const [balanceEdit, setBalanceEdit] = useState({
        total_annual: 0,
        total_sick: 0,
        total_special: 0,
    });

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await api.get(`/hr/leave/balance/${id}?year=${year}`);
            if (res.data.status === 'success') {
                setBalance(res.data.balance);
                setRequests(res.data.requests || []);
                setBalanceEdit({
                    total_annual: res.data.balance.total_annual,
                    total_sick: res.data.balance.total_sick,
                    total_special: res.data.balance.total_special,
                });
            }
        } catch (err) {
            console.error('Leave data fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, [id, year]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Auto-calculate days when dates change
    useEffect(() => {
        if (form.start_date && form.end_date) {
            const start = new Date(form.start_date);
            const end = new Date(form.end_date);
            if (end >= start) {
                const diffTime = end - start;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                const isHalf = form.leave_type.includes('반차');
                setForm(prev => ({ ...prev, days: isHalf ? 0.5 : diffDays }));
            }
        }
    }, [form.start_date, form.end_date, form.leave_type]);

    // When leave type is half-day, auto-set end_date = start_date
    useEffect(() => {
        if (form.leave_type.includes('반차') && form.start_date) {
            setForm(prev => ({ ...prev, end_date: prev.start_date, days: 0.5 }));
        }
    }, [form.leave_type, form.start_date]);

    const handleSubmit = async () => {
        if (!form.start_date || !form.end_date) {
            alert('시작일과 종료일을 입력해주세요.');
            return;
        }
        try {
            await api.post('/hr/leave/request', {
                staff_id: parseInt(id),
                ...form,
            });
            setShowForm(false);
            setForm({ leave_type: '연차', start_date: '', end_date: '', days: 1, reason: '' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.detail || '휴가 등록 실패');
        }
    };

    const handleDelete = async (reqId) => {
        if (!window.confirm('이 휴가 기록을 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/hr/leave/request/${reqId}`);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('삭제 실패');
        }
    };

    const handleCancel = async (reqId) => {
        try {
            await api.put(`/hr/leave/request/${reqId}`, { status: '취소' });
            fetchData();
        } catch (err) {
            console.error(err);
            alert('취소 실패');
        }
    };

    const handleBalanceSave = async () => {
        try {
            await api.put(`/hr/leave/balance/${id}?year=${year}`, balanceEdit);
            setEditBalanceMode(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        }
    };

    const inputClass = "w-full p-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 outline-none transition-all";
    const labelClass = "block text-xs font-semibold text-slate-500 mb-1.5 tracking-wide";

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
            </div>
        );
    }

    const remaining_annual = (balance?.total_annual || 0) - (balance?.used_annual || 0);
    const remaining_sick = (balance?.total_sick || 0) - (balance?.used_sick || 0);
    const remaining_special = (balance?.total_special || 0) - (balance?.used_special || 0);

    // Approved requests for calendar display
    const approvedRequests = requests.filter(r => r.status === '승인');

    // Monthly summary
    const monthlySummary = {};
    approvedRequests.forEach(r => {
        const month = r.start_date.slice(0, 7);
        monthlySummary[month] = (monthlySummary[month] || 0) + r.days;
    });

    return (
        <div className="space-y-5">
            {/* ═══ Header: Year Selector + New Request ═══ */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => setYear(y => y - 1)} className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-sm font-bold">{'<'}</button>
                        <span className="px-3 py-2 text-sm font-bold text-slate-800">{year}년</span>
                        <button onClick={() => setYear(y => y + 1)} className="px-3 py-2 text-slate-500 hover:bg-slate-50 text-sm font-bold">{'>'}</button>
                    </div>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                >
                    <Plus size={16} />
                    휴가 등록
                </button>
            </div>

            {/* ═══ Balance Summary Cards ═══ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* 연차 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600">
                        <div className="flex items-center gap-2">
                            <Palmtree size={16} className="text-white" />
                            <span className="text-sm font-bold text-white">연차휴가</span>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="flex items-end gap-1 mb-3">
                            <span className="text-3xl font-black text-emerald-700">{remaining_annual}</span>
                            <span className="text-sm text-slate-400 mb-1">/ {balance?.total_annual || 0}일</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                            <div
                                className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${balance?.total_annual ? ((balance.used_annual / balance.total_annual) * 100) : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>사용 {balance?.used_annual || 0}일</span>
                            <span>잔여 {remaining_annual}일</span>
                        </div>
                    </div>
                </div>

                {/* 병가 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-rose-500 to-pink-600">
                        <div className="flex items-center gap-2">
                            <Heart size={16} className="text-white" />
                            <span className="text-sm font-bold text-white">병가</span>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="flex items-end gap-1 mb-3">
                            <span className="text-3xl font-black text-rose-700">{remaining_sick}</span>
                            <span className="text-sm text-slate-400 mb-1">/ {balance?.total_sick || 0}일</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                            <div
                                className="bg-gradient-to-r from-rose-400 to-pink-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${balance?.total_sick ? ((balance.used_sick / balance.total_sick) * 100) : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>사용 {balance?.used_sick || 0}일</span>
                            <span>잔여 {remaining_sick}일</span>
                        </div>
                    </div>
                </div>

                {/* 특별휴가 */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-gradient-to-r from-violet-600 to-indigo-600">
                        <div className="flex items-center gap-2">
                            <Award size={16} className="text-white" />
                            <span className="text-sm font-bold text-white">경조사/특별휴가</span>
                        </div>
                    </div>
                    <div className="p-5">
                        <div className="flex items-end gap-1 mb-3">
                            <span className="text-3xl font-black text-violet-700">{remaining_special}</span>
                            <span className="text-sm text-slate-400 mb-1">/ {balance?.total_special || 0}일</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 mb-2">
                            <div
                                className="bg-gradient-to-r from-violet-500 to-indigo-500 h-2.5 rounded-full transition-all"
                                style={{ width: `${balance?.total_special ? ((balance.used_special / balance.total_special) * 100) : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-slate-400">
                            <span>사용 {balance?.used_special || 0}일</span>
                            <span>잔여 {remaining_special}일</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ Balance Edit (Admin) ═══ */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Info size={16} className="text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-700">연차 자동계산 정보</h3>
                    </div>
                    <button
                        onClick={() => setEditBalanceMode(!editBalanceMode)}
                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                        {editBalanceMode ? '취소' : '수동 조정'}
                    </button>
                </div>

                {!editBalanceMode ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">입사일</p>
                            <p className="text-sm font-bold text-slate-800">{staffData?.start_date || '-'}</p>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-slate-400 mb-1">근속기간</p>
                            <p className="text-sm font-bold text-slate-800">
                                {staffData?.start_date ? (() => {
                                    const start = new Date(staffData.start_date);
                                    const now = new Date();
                                    const years = now.getFullYear() - start.getFullYear();
                                    const months = now.getMonth() - start.getMonth();
                                    const totalMonths = years * 12 + months;
                                    return `${Math.floor(totalMonths / 12)}년 ${totalMonths % 12}개월`;
                                })() : '-'}
                            </p>
                        </div>
                        <div className="bg-emerald-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-emerald-500 mb-1">법정 연차</p>
                            <p className="text-sm font-bold text-emerald-700">{balance?.total_annual || 0}일</p>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3">
                            <p className="text-[10px] font-bold text-amber-500 mb-1">미사용 연차</p>
                            <p className="text-sm font-bold text-amber-700">{remaining_annual}일</p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <p className="text-xs text-slate-400">법정 연차 외 추가 부여 또는 수동 조정이 필요한 경우 사용합니다.</p>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>총 연차 (일)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceEdit.total_annual}
                                    onChange={(e) => setBalanceEdit(prev => ({ ...prev, total_annual: parseFloat(e.target.value) || 0 }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>총 병가 (일)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceEdit.total_sick}
                                    onChange={(e) => setBalanceEdit(prev => ({ ...prev, total_sick: parseFloat(e.target.value) || 0 }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>총 특별휴가 (일)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={balanceEdit.total_special}
                                    onChange={(e) => setBalanceEdit(prev => ({ ...prev, total_special: parseFloat(e.target.value) || 0 }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button onClick={handleBalanceSave} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors">
                                저장
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ New Leave Request Form ═══ */}
            {showForm && (
                <div className="bg-white rounded-2xl border-2 border-emerald-200 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Plus size={16} className="text-white" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-800">휴가 등록</h3>
                    </div>

                    <div className="space-y-4">
                        {/* Leave Type Selection */}
                        <div>
                            <label className={labelClass}>휴가 유형</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {LEAVE_TYPES.map(lt => {
                                    const Icon = lt.icon;
                                    const isSelected = form.leave_type === lt.value;
                                    return (
                                        <button
                                            key={lt.value}
                                            onClick={() => setForm(prev => ({ ...prev, leave_type: lt.value }))}
                                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                isSelected
                                                    ? `${lt.bg} ${lt.color} border-current shadow-sm`
                                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <Icon size={13} />
                                            {lt.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>시작일</label>
                                <input
                                    type="date"
                                    value={form.start_date}
                                    onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>종료일</label>
                                <input
                                    type="date"
                                    value={form.end_date}
                                    onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                                    className={inputClass}
                                    disabled={form.leave_type.includes('반차')}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>사용일수</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    value={form.days}
                                    onChange={(e) => setForm(prev => ({ ...prev, days: parseFloat(e.target.value) || 0 }))}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        {/* Reason */}
                        <div>
                            <label className={labelClass}>사유 (선택)</label>
                            <input
                                type="text"
                                value={form.reason}
                                onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="휴가 사유를 입력하세요"
                                className={inputClass}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowForm(false)}
                                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSubmit}
                                className="flex-1 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold hover:from-emerald-700 hover:to-teal-700 shadow-md transition-all"
                            >
                                등록
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Monthly Usage Chart ═══ */}
            {Object.keys(monthlySummary).length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <CalendarDays size={16} className="text-emerald-600" />
                        월별 사용 현황
                    </h3>
                    <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                        {Array.from({ length: 12 }, (_, i) => {
                            const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
                            const used = monthlySummary[monthKey] || 0;
                            return (
                                <div key={i} className="text-center">
                                    <div
                                        className={`w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold ${
                                            used > 0
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-50 text-slate-300'
                                        }`}
                                    >
                                        {used > 0 ? used : '-'}
                                    </div>
                                    <p className="text-[9px] text-slate-400 mt-1">{i + 1}월</p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ═══ Leave Request History ═══ */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                    <CalendarDays size={16} className="text-slate-400" />
                    <h3 className="text-sm font-bold text-slate-700">휴가 사용 내역</h3>
                    <span className="text-xs text-slate-400 ml-auto">{requests.length}건</span>
                </div>

                {requests.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">
                        등록된 휴가가 없습니다.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {requests.map((req) => {
                            const typeConfig = LEAVE_TYPES.find(lt => lt.value === req.leave_type) || LEAVE_TYPES[0];
                            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG['대기'];
                            const TypeIcon = typeConfig.icon;

                            return (
                                <div key={req.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                                    {/* Type Icon */}
                                    <div className={`w-9 h-9 rounded-lg ${typeConfig.bg} flex items-center justify-center flex-shrink-0`}>
                                        <TypeIcon size={16} className={typeConfig.color} />
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className={`text-xs font-bold ${typeConfig.color}`}>{req.leave_type}</span>
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${statusConf.bg} ${statusConf.color} border ${statusConf.border}`}>
                                                {req.status}
                                            </span>
                                        </div>
                                        <p className="text-sm text-slate-700">
                                            {req.start_date === req.end_date
                                                ? req.start_date
                                                : `${req.start_date} ~ ${req.end_date}`
                                            }
                                            <span className="text-slate-400 ml-1.5">({req.days}일)</span>
                                        </p>
                                        {req.reason && (
                                            <p className="text-xs text-slate-400 mt-0.5 truncate">{req.reason}</p>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        {req.status === '승인' && (
                                            <button
                                                onClick={() => handleCancel(req.id)}
                                                className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                title="취소"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDelete(req.id)}
                                            className="p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-lg transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ═══ Legal Reference ═══ */}
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                <p className="text-xs text-blue-700 leading-relaxed flex items-start gap-2">
                    <Info size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                        <span className="font-bold">근로기준법 연차 기준:</span> 1년 미만 근속 시 매월 1일 (최대 11일),
                        1년 이상 15일, 3년 이상 매 2년마다 +1일 (최대 25일).
                        미사용 연차는 연차수당으로 정산하거나, 연차촉진제도를 통해 소멸할 수 있습니다.
                    </span>
                </p>
            </div>
        </div>
    );
}
