import { Calendar, MessageSquare } from 'lucide-react';
import AttendanceInput from '../../components/AttendanceInput';

export default function AttendanceTab({
    id,
    formData,
    currentBudgetMonth,
    setCurrentBudgetMonth,
    isAttendanceModalOpen,
    setIsAttendanceModalOpen,
    handleSendAttendanceRequest,
    fetchStaffDetail,
}) {
    return (
        <>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-4">
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
                            onClick={() => setIsAttendanceModalOpen(true)}
                            className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm transition-all whitespace-nowrap"
                        >
                            <Calendar size={14} /> 출퇴근/정산
                        </button>
                        <button
                            onClick={handleSendAttendanceRequest}
                            className="flex items-center gap-1 bg-emerald-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-600 shadow-sm transition-all whitespace-nowrap"
                            title="직원에게 근무시간 입력 요청 카톡 발송"
                        >
                            <MessageSquare size={14} /> 시급입력 요청
                        </button>
                    </div>
                </div>
                <div className="text-center py-10 text-slate-400 text-sm">
                    위 <span className="font-bold text-indigo-600">'출퇴근/정산'</span> 버튼을 눌러 달력 기반으로 근태를 입력하세요.
                </div>
            </div>

            <AttendanceInput
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                staffId={id}
                staffName={formData.name}
                month={currentBudgetMonth}
                onCalculateSuccess={() => fetchStaffDetail(currentBudgetMonth)}
            />
        </>
    );
}
