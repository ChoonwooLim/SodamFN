import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Calendar } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AttendanceInput = ({ isOpen, onClose, staffId, staffName, month, onCalculateSuccess, inline = false }) => {
    const [dailyData, setDailyData] = useState({}); // { "YYYY-MM-DD": { hours, status, isCarryover } }
    const [companyHolidays, setCompanyHolidays] = useState([]); // Array of date strings
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);
    const [overrides, setOverrides] = useState({ np: '', hi: '', lti: '', ei: '', it: '', lit: '' });
    const [specialBonus, setSpecialBonus] = useState('');

    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Build calendar grid: starts on Sunday, rows are Sun-Sat
    const buildCalendarGrid = () => {
        const grid = [];
        
        // Find the Sunday that starts the first week
        const firstDay = new Date(year, monthNum - 1, 1);
        const firstDow = firstDay.getDay(); // 0=Sun, 1=Mon, ...
        
        // Start from the Sunday before (or on) the 1st
        const startDate = new Date(year, monthNum - 1, 1 - firstDow);
        
        // Find the last day of the month
        const lastDay = new Date(year, monthNum - 1, daysInMonth);
        const lastDow = lastDay.getDay();
        // End on the Saturday after (or on) the last day
        const endDate = new Date(year, monthNum - 1, daysInMonth + (6 - lastDow));
        
        let current = new Date(startDate);
        while (current <= endDate) {
            const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
            const isCurrentMonth = current.getMonth() + 1 === monthNum && current.getFullYear() === year;
            const isPrevMonth = current < firstDay;
            
            grid.push({
                dateStr,
                day: current.getDate(),
                dow: current.getDay(), // 0=Sun
                isCurrentMonth,
                isPrevMonth,
                isNextMonth: !isCurrentMonth && !isPrevMonth,
            });
            
            current = new Date(current.getTime() + 86400000);
        }
        
        return grid;
    };

    const calendarGrid = buildCalendarGrid();

    useEffect(() => {
        if ((isOpen || inline) && staffId && month) {
            fetchData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, inline, staffId, month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attRes, holRes, payrollRes] = await Promise.all([
                fetch(`${API_URL}/api/payroll/attendance/${staffId}/${month}`),
                fetch(`${API_URL}/api/payroll/holidays/${month}`),
                fetch(`${API_URL}/api/payroll/staff/${staffId}/${month}`)
            ]);

            const attResult = await attRes.json();
            const holResult = await holRes.json();
            const payrollResult = payrollRes.ok ? await payrollRes.json() : null;

            const dataMap = {};

            // Load current month attendance data
            if (attResult.status === 'success') {
                attResult.data.forEach(record => {
                    const dateStr = record.date;
                    dataMap[dateStr] = {
                        hours: record.total_hours,
                        status: record.status || 'Normal',
                        isCarryover: false
                    };
                });

                // Load carryover data from previous month (read-only, auto-populated)
                if (attResult.carryover && attResult.carryover.length > 0) {
                    attResult.carryover.forEach(record => {
                        dataMap[record.date] = {
                            hours: record.total_hours,
                            status: record.status || 'Normal',
                            isCarryover: true
                        };
                    });
                }
            }

            setDailyData(dataMap);

            if (holResult.status === 'success') {
                setCompanyHolidays(holResult.data.map(h => h.date));
            }

            if (payrollResult && payrollResult.status === 'success') {
                // Load existing special bonus
                if (payrollResult.data.bonus_special) {
                    setSpecialBonus(payrollResult.data.bonus_special);
                }
                if (payrollResult.data.overrides) {
                    // Merge loaded overrides with existing empty state defaults
                    const loaded = payrollResult.data.overrides;
                    setOverrides(prev => ({
                        np: loaded.np !== undefined ? loaded.np : prev.np,
                        hi: loaded.hi !== undefined ? loaded.hi : prev.hi,
                        lti: loaded.lti !== undefined ? loaded.lti : prev.lti,
                        ei: loaded.ei !== undefined ? loaded.ei : prev.ei,
                        it: loaded.it !== undefined ? loaded.it : prev.it,
                        lit: loaded.lit !== undefined ? loaded.lit : prev.lit,
                    }));
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCompanyHoliday = async (dateStr) => {
        const isCurrentlyHoliday = companyHolidays.includes(dateStr);

        try {
            if (isCurrentlyHoliday) {
                await fetch(`${API_URL}/api/payroll/holidays/${dateStr}`, { method: 'DELETE' });
                setCompanyHolidays(prev => prev.filter(d => d !== dateStr));
            } else {
                await fetch(`${API_URL}/api/payroll/holidays`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: dateStr, description: '임시공휴일' })
                });
                setCompanyHolidays(prev => [...prev, dateStr]);
                setDailyData(prev => ({
                    ...prev,
                    [dateStr]: { ...(prev[dateStr] || { hours: 0 }), status: 'Holiday', hours: 0 }
                }));
            }
        } catch {
            alert('공휴일 설정 중 오류가 발생했습니다.');
        }
    };

    const handleHourChange = (dateStr, value) => {
        setDailyData(prev => ({
            ...prev,
            [dateStr]: {
                ...(prev[dateStr] || { status: 'Normal' }),
                hours: value === '' ? 0 : Math.min(13, parseFloat(value)),
                isCarryover: false
            }
        }));
    };

    const toggleStatus = (dateStr) => {
        setDailyData(prev => {
            const current = (prev[dateStr] || { hours: 0, status: 'Normal' }).status;
            let next = 'Normal';
            if (current === 'Normal') next = 'Absence';
            else if (current === 'Absence') next = 'Holiday';

            const newHours = next === 'Normal' ? (prev[dateStr]?.hours || 0) : 0;

            return {
                ...prev,
                [dateStr]: {
                    ...(prev[dateStr] || { hours: 0 }),
                    status: next,
                    hours: newHours,
                    isCarryover: false
                }
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Only save current month data (not carryover)
            const formatted = Object.entries(dailyData)
                .filter(([dateStr, data]) => {
                    if (data.isCarryover) return false;
                    const d = new Date(dateStr);
                    return d.getMonth() + 1 === monthNum && d.getFullYear() === year;
                })
                .map(([dateStr, data]) => ({
                    date: dateStr,
                    hours: data.hours || 0,
                    status: data.status || 'Normal'
                }));

            const response = await fetch(`${API_URL}/api/payroll/attendance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: staffId,
                    month,
                    daily_hours: formatted
                })
            });
            const result = await response.json();
            if (result.status === 'success') {
                return true;
            } else {
                throw new Error(result.message || '저장 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error("Save Error:", error);
            alert(error.message || '저장 중 오류가 발생했습니다.');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleCalculate = async () => {
        console.log("handleCalculate invoked for month:", month);
        if (!window.confirm('입력된 기록을 바탕으로 급여를 산출하시겠습니까? (기존 자료가 덮어씌워집니다)')) return;

        setCalculating(true);
        try {
            const saveSuccess = await handleSave();
            if (!saveSuccess) {
                console.warn("Save failed, aborting calculation.");
                return;
            }

            const reqOverrides = {};
            // Only send overrides if they have a numeric value
            ['np', 'hi', 'lti', 'ei', 'it', 'lit'].forEach(k => {
                if (overrides[k] !== '' && !isNaN(overrides[k])) reqOverrides[k] = parseInt(overrides[k]);
            });

            const response = await fetch(`${API_URL}/api/payroll/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    staff_id: staffId,
                    month,
                    special_bonus: specialBonus !== '' && !isNaN(specialBonus) ? parseInt(specialBonus) : 0,
                    overrides: Object.keys(reqOverrides).length > 0 ? reqOverrides : null
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                alert('급여 산출이 완료되었습니다.');
                if (onCalculateSuccess) {
                    onCalculateSuccess(result.data);
                }
                if (!inline && onClose) onClose();
            } else {
                alert(result.message || '산출 중 오류가 발생했습니다.');
            }
        } catch (error) {
            console.error("Calculation Error:", error);
            alert(`산출 중 오류가 발생했습니다: ${error.message}`);
        } finally {
            setCalculating(false);
        }
    };

    if (!isOpen && !inline) return null;

    const getStatusStyle = (status, isGlobalHoliday, isCarryover) => {
        if (isCarryover) return 'bg-violet-50 border-violet-200 text-violet-700 ring-1 ring-violet-200';
        if (isGlobalHoliday) return 'bg-amber-50 border-amber-200 text-amber-700 ring-2 ring-amber-100';
        switch (status) {
            case 'Absence': return 'bg-red-50 border-red-200 text-red-600';
            case 'Holiday': return 'bg-blue-50 border-blue-200 text-blue-600';
            default: return 'bg-white border-slate-200 text-slate-400';
        }
    };

    const DOW_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

    // --- Shared UI sections ---

    const legendRow = (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-bold uppercase tracking-wider">
            <span className="flex items-center gap-1 text-slate-400 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-slate-200"></span> 정상</span>
            <span className="flex items-center gap-1 text-red-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-red-400"></span> 결근(주휴X)</span>
            <span className="flex items-center gap-1 text-blue-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-blue-400"></span> 개인휴무</span>
            <span className="flex items-center gap-1 text-amber-600 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> 임시공휴일</span>
            <span className="flex items-center gap-1 text-violet-600 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-violet-400"></span> 전월이월</span>
        </div>
    );

    const calendarBody = loading ? (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
        </div>
    ) : (
        <div>
            {/* Day-of-week header row */}
            <div className="grid grid-cols-7 gap-1 mb-1">
                {DOW_LABELS.map((label, idx) => (
                    <div key={idx} className={`text-center text-[10px] font-bold py-1 rounded-md ${idx === 0 ? 'text-red-500 bg-red-50' : idx === 6 ? 'text-blue-500 bg-blue-50' : 'text-slate-500 bg-slate-100'}`}>
                        {label}
                    </div>
                ))}
            </div>

            {/* Calendar grid: 7 columns, Sun-Sat */}
            <div className="grid grid-cols-7 gap-1.5">
                {calendarGrid.map((cell) => {
                    const { dateStr, day, dow, isPrevMonth, isNextMonth } = cell;
                    const isSun = dow === 0;
                    const isSat = dow === 6;
                    const isGlobalHoliday = companyHolidays.includes(dateStr);
                    const data = dailyData[dateStr] || { hours: 0, status: isGlobalHoliday ? 'Holiday' : 'Normal', isCarryover: false };
                    const isCarryover = data.isCarryover || false;

                    // Next month cells: show as empty/disabled
                    if (isNextMonth) {
                        return (
                            <div key={dateStr} className="p-2 rounded-xl border border-dashed border-slate-100 bg-slate-50/30 opacity-30 min-h-[72px] sm:min-h-[80px]">
                                <div className="text-[10px] font-bold text-slate-300">{day}</div>
                            </div>
                        );
                    }

                    // Previous month carryover cells
                    if (isPrevMonth) {
                        const hasData = data.hours > 0;
                        return (
                            <div key={dateStr} className={`group p-2 rounded-xl border shadow-sm transition-all flex flex-col min-h-[72px] sm:min-h-[80px] ${hasData ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-100' : 'bg-slate-50/50 border-dashed border-slate-200 opacity-40'}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <span className={`text-[10px] font-black ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-violet-400'}`}>
                                        {day} {DOW_LABELS[dow]}
                                    </span>
                                    {hasData && (
                                        <span className="text-[8px] px-1 py-0.5 rounded bg-violet-500 text-white font-bold">이월</span>
                                    )}
                                </div>
                                <div className="relative mt-auto">
                                    <span className={`w-full text-center font-black text-lg block ${hasData ? 'text-violet-700' : 'text-slate-300'}`}>
                                        {hasData ? data.hours : ''}
                                    </span>
                                    {hasData && <span className="absolute right-0 bottom-0 text-[8px] font-bold text-violet-400">H</span>}
                                </div>
                            </div>
                        );
                    }

                    // Current month cells (editable)
                    return (
                        <div key={dateStr} className={`group p-2 rounded-xl border shadow-sm transition-all hover:shadow-md flex flex-col min-h-[72px] sm:min-h-[80px] ${getStatusStyle(data.status, isGlobalHoliday, isCarryover)} ${!isGlobalHoliday && !isCarryover && data.status === 'Normal' && (isSun ? 'bg-red-50/30' : isSat ? 'bg-blue-50/30' : 'bg-white')}`}>
                            <div className="flex justify-between items-start mb-1">
                                <button
                                    onClick={() => toggleCompanyHoliday(dateStr)}
                                    className={`text-[10px] font-black hover:underline decoration-2 ${isGlobalHoliday ? 'text-amber-700' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-400'}`}
                                    title="임시공휴일 설정"
                                >
                                    {day} {DOW_LABELS[dow]}
                                </button>
                                <button
                                    onClick={() => !isSun && toggleStatus(dateStr)}
                                    disabled={isGlobalHoliday || isSun}
                                    className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold transition-colors ${isGlobalHoliday ? 'bg-amber-200 text-amber-800' :
                                        isSun ? 'bg-red-100 text-red-600' :
                                            data.status === 'Absence' ? 'bg-red-500 text-white' :
                                                data.status === 'Holiday' ? 'bg-blue-500 text-white' :
                                                    'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                        }`}
                                >
                                    {isGlobalHoliday ? '공휴일' : isSun ? '휴일' : data.status === 'Absence' ? '결근' : data.status === 'Holiday' ? '휴무' : '출근'}
                                </button>
                            </div>
                            <div className="relative mt-auto">
                                <input
                                    type="number"
                                    step="0.5"
                                    min="0"
                                    max="13"
                                    disabled={isGlobalHoliday || isSun || data.status !== 'Normal'}
                                    className={`w-full text-center font-black text-xl p-0 bg-transparent outline-none ${(isGlobalHoliday || isSun || data.status !== 'Normal') ? 'opacity-30 cursor-not-allowed' : ''}`}
                                    value={data.hours || ''}
                                    onChange={(e) => handleHourChange(dateStr, e.target.value)}
                                    placeholder="0"
                                />
                                <span className="absolute right-0 bottom-1 text-[9px] font-bold opacity-40">H</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const infoSection = (
        <div className="px-6 py-2 bg-indigo-50/50 border-t border-indigo-100">
            <p className="text-[11px] text-indigo-700 font-medium flex items-center gap-2">
                <span className="bg-indigo-600 text-white px-1.5 rounded-sm text-[9px]">INFO</span>
                전월 마지막 주의 이월 근무일은 보라색으로 표시되며, 1주차 주휴수당 계산에 자동 합산됩니다. 월말 미완성 주는 익월정산 처리됩니다.
            </p>
        </div>
    );

    const specialBonusSection = (
        <div className="px-6 py-3 bg-violet-50/50 border-t border-violet-100">
            <div className="flex items-center gap-3">
                <label className="text-xs font-bold text-violet-700 whitespace-nowrap">특별수당</label>
                <div className="relative flex-1 max-w-[200px]">
                    <input
                        type="number"
                        className="w-full border border-violet-200 rounded-lg px-3 py-1.5 text-sm text-right text-violet-800 font-bold bg-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                        placeholder="0"
                        value={specialBonus}
                        onChange={(e) => setSpecialBonus(e.target.value)}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-violet-400 font-bold pointer-events-none">원</span>
                </div>
                <span className="text-[10px] text-violet-400 font-medium">* 이번 달 특별수당이 있을 경우 입력</span>
            </div>
        </div>
    );

    const overridesSection = (
        <div className="px-6 py-3 bg-white border-t border-slate-200">
            <p className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                <span>세무사 산출(연말정산 등) 수동 덮어쓰기 (선택입력)</span>
                <span className="text-[10px] text-slate-400 font-normal italic">* 입력한 항목만 덮어씌워지며 빈칸은 자동 계산됩니다.</span>
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                    { key: 'np', label: '국민연금' },
                    { key: 'hi', label: '건강보험' },
                    { key: 'lti', label: '요양보험' },
                    { key: 'ei', label: '고용보험' },
                    { key: 'it', label: '소득세' },
                    { key: 'lit', label: '지방소득세' },
                ].map((item) => (
                    <div key={item.key} className="flex flex-col">
                        <label className="text-[10px] text-slate-500 font-semibold mb-1">{item.label}</label>
                        <input
                            type="number"
                            className="border border-slate-300 rounded p-1 text-xs text-right text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="자동식"
                            value={overrides[item.key]}
                            onChange={(e) => setOverrides(prev => ({ ...prev, [item.key]: e.target.value }))}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    const footerButtons = (
        <div className="p-4 sm:p-6 border-t bg-slate-50 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3 rounded-b-2xl">
            <button
                onClick={handleSave}
                disabled={saving || calculating}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-all disabled:opacity-50 whitespace-nowrap text-sm"
            >
                {saving ? '저장 중...' : <><Save className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> 기록 저장</>}
            </button>
            <button
                onClick={handleCalculate}
                disabled={saving || calculating}
                className="flex items-center justify-center gap-2 px-4 sm:px-8 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 whitespace-nowrap text-sm"
            >
                {calculating ? '산출 중...' : <><Calculator className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" /> 급여 산출 및 명세서 생성</>}
            </button>
        </div>
    );

    // --- Inline mode: embedded directly in the tab ---
    if (inline) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="px-4 sm:px-6 pt-4 pb-2">
                    {legendRow}
                </div>
                <div className="px-4 sm:px-6 pb-4">
                    {calendarBody}
                </div>
                {infoSection}
                {specialBonusSection}
                {overridesSection}
                {footerButtons}
            </div>
        );
    }

    // --- Modal mode ---
    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="sticky top-0 bg-white/80 backdrop-blur-md z-10 p-4 sm:p-6 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6 text-indigo-600" />
                        <h2 className="text-xl font-black text-slate-800">{staffName} — {month} 근태입력</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Legend */}
                <div className="px-4 sm:px-6 pt-4 pb-2">
                    {legendRow}
                </div>

                {/* Calendar */}
                <div className="px-4 sm:px-6 pb-4">
                    {calendarBody}
                </div>

                {infoSection}
                {specialBonusSection}
                {overridesSection}
                {footerButtons}
            </div>
        </div>
    );
};

export default AttendanceInput;
