import { Calendar, MessageSquare } from 'lucide-react';
import AttendanceInput from '../../components/AttendanceInput';

export default function AttendanceTab({
    id,
    formData,
    currentBudgetMonth,
    setCurrentBudgetMonth,
    handleSendAttendanceRequest,
    fetchStaffDetail,
}) {
    return (
        <div className="space-y-4">
            {/* Header bar */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Calendar size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">출퇴근 / 근태 관리</h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="month"
                            value={currentBudgetMonth}
                            onChange={(e) => setCurrentBudgetMonth(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            onClick={handleSendAttendanceRequest}
                            className="flex items-center gap-1 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm transition-all whitespace-nowrap"
                            title="직원에게 근무시간 입력 요청 카톡 발송"
                        >
                            <MessageSquare size={14} /> 시급입력 요청
                        </button>
                    </div>
                </div>
            </div>

            {/* Inline attendance calendar */}
            <AttendanceInput
                inline
                staffId={id}
                staffName={formData.name}
                month={currentBudgetMonth}
                onCalculateSuccess={() => fetchStaffDetail(currentBudgetMonth)}
            />
        </div>
    );
}
