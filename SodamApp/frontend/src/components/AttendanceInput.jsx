import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, Calendar } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const AttendanceInput = ({ isOpen, onClose, staffId, staffName, month, onCalculateSuccess }) => {
    const [dailyData, setDailyData] = useState({}); // { day: { hours, status } }
    const [companyHolidays, setCompanyHolidays] = useState([]); // Array of date strings
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [calculating, setCalculating] = useState(false);

    // Generate days for the selected month
    const year = parseInt(month.split('-')[0]);
    const monthNum = parseInt(month.split('-')[1]);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    useEffect(() => {
        if (isOpen && staffId && month) {
            fetchData();
        }
    }, [isOpen, staffId, month]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [attRes, holRes] = await Promise.all([
                fetch(`${API_URL}/api/payroll/attendance/${staffId}/${month}`),
                fetch(`${API_URL}/api/payroll/holidays/${month}`)
            ]);

            const attResult = await attRes.json();
            const holResult = await holRes.json();

            if (attResult.status === 'success') {
                const dataMap = {};
                attResult.data.forEach(record => {
                    const day = new Date(record.date).getDate();
                    dataMap[day] = {
                        hours: record.total_hours,
                        status: record.status || 'Normal'
                    };
                });
                setDailyData(dataMap);
            }

            if (holResult.status === 'success') {
                setCompanyHolidays(holResult.data.map(h => h.date));
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleCompanyHoliday = async (day) => {
        const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
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
                // Also set local status to Holiday and reset hours to 0
                setDailyData(prev => ({
                    ...prev,
                    [day]: { ...(prev[day] || { hours: 0 }), status: 'Holiday', hours: 0 }
                }));
            }
        } catch (error) {
            alert('공휴일 설정 중 오류가 발생했습니다.');
        }
    };

    const handleHourChange = (day, value) => {
        setDailyData(prev => ({
            ...prev,
            [day]: {
                ...(prev[day] || { status: 'Normal' }),
                hours: value === '' ? 0 : Math.min(13, parseFloat(value)) // Enforce max 13 constraint
            }
        }));
    };

    const toggleStatus = (day) => {
        setDailyData(prev => {
            const current = (prev[day] || { hours: 0, status: 'Normal' }).status;
            let next = 'Normal';
            if (current === 'Normal') next = 'Absence';
            else if (current === 'Absence') next = 'Holiday';

            // Reset hours to 0 if status is not Normal
            const newHours = next === 'Normal' ? (prev[day]?.hours || 0) : 0;

            return {
                ...prev,
                [day]: {
                    ...(prev[day] || { hours: 0 }),
                    status: next,
                    hours: newHours
                }
            };
        });
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const formatted = Object.entries(dailyData).map(([day, data]) => ({
                date: `${month}-${day.toString().padStart(2, '0')}`,
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
            // First Save
            const saveSuccess = await handleSave();
            if (!saveSuccess) {
                console.warn("Save failed, aborting calculation.");
                return;
            }

            const response = await fetch(`${API_URL}/api/payroll/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ staff_id: staffId, month })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server Error (${response.status}): ${errorText}`);
            }

            const result = await response.json();
            if (result.status === 'success') {
                alert('급여 산출이 완료되었습니다.');

                // Notify parent with calculated data BEFORE closing modal
                // so the parent state is updated properly
                if (onCalculateSuccess) {
                    onCalculateSuccess(result.data);
                }

                // Close modal after parent has received the data
                onClose();
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

    if (!isOpen) return null;

    const getStatusStyle = (status, isGlobalHoliday) => {
        if (isGlobalHoliday) return 'bg-amber-50 border-amber-200 text-amber-700 ring-2 ring-amber-100';
        switch (status) {
            case 'Absence': return 'bg-red-50 border-red-200 text-red-600';
            case 'Holiday': return 'bg-blue-50 border-blue-200 text-blue-600';
            default: return 'bg-white border-slate-200 text-slate-400';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'Absence': return '결근';
            case 'Holiday': return '휴무';
            default: return '출근';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b flex justify-between items-start bg-slate-50 gap-2">
                    <div className="min-w-0">
                        <h2 className="text-base sm:text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                            근무 기록 입력 및 급여 산출
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">
                            <span className="font-semibold text-indigo-700">{staffName}</span> 님의 {month} 근무 내역
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] font-bold uppercase tracking-wider">
                            <span className="flex items-center gap-1 text-slate-400 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-slate-200"></span> 정상</span>
                            <span className="flex items-center gap-1 text-red-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-red-400"></span> 결근(주휴X)</span>
                            <span className="flex items-center gap-1 text-blue-500 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-blue-400"></span> 개인휴무</span>
                            <span className="flex items-center gap-1 text-amber-600 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> 임시공휴일</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors flex-shrink-0">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                            {days.map(day => {
                                const dateObj = new Date(year, monthNum - 1, day);
                                const isSun = dateObj.getDay() === 0;
                                const isSat = dateObj.getDay() === 6;
                                const dateStr = `${month}-${day.toString().padStart(2, '0')}`;
                                const isGlobalHoliday = companyHolidays.includes(dateStr);
                                const data = dailyData[day] || { hours: 0, status: isGlobalHoliday ? 'Holiday' : 'Normal' };

                                return (
                                    <div key={day} className={`group p-2 rounded-xl border shadow-sm transition-all hover:shadow-md flex flex-col ${getStatusStyle(data.status, isGlobalHoliday)} ${!isGlobalHoliday && data.status === 'Normal' && (isSun ? 'bg-red-50/30' : isSat ? 'bg-blue-50/30' : 'bg-white')}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <button
                                                onClick={() => toggleCompanyHoliday(day)}
                                                className={`text-[10px] font-black hover:underline decoration-2 ${isGlobalHoliday ? 'text-amber-700' : isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-400'}`}
                                                title="임시공휴일 설정"
                                            >
                                                {day} {['일', '월', '화', '수', '목', '금', '토'][dateObj.getDay()]}
                                            </button>
                                            <button
                                                onClick={() => !isSun && toggleStatus(day)}
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
                                                onChange={(e) => handleHourChange(day, e.target.value)}
                                                placeholder="0"
                                            />
                                            <span className="absolute right-0 bottom-1 text-[9px] font-bold opacity-40">H</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Info Text */}
                <div className="px-6 py-2 bg-indigo-50/50 border-t border-indigo-100">
                    <p className="text-[11px] text-indigo-700 font-medium flex items-center gap-2">
                        <span className="bg-indigo-600 text-white px-1.5 rounded-sm text-[9px]">INFO</span>
                        정산 규칙: 한 주의 일요일이 다음 달 1일인 경우 이번 달에 포함하고, 그 이후(화~토 등)인 경우 다음 달로 이월됩니다.
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-6 border-t bg-white flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-3">
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
            </div>
        </div>
    );
};

export default AttendanceInput;
