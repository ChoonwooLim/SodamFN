import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Clock, AlertTriangle, CalendarDays, TrendingUp, Palmtree, Bell, ChevronRight, BarChart3, Shield, FileText, UserCheck, UserMinus, Briefcase, Settings, ArrowRightLeft } from 'lucide-react';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import api from '../api';

export default function HRDashboard() {
    const navigate = useNavigate();
    const { isSimpleMode, employeeScale, updateScale } = useBusinessConfig();
    const [scaleToggling, setScaleToggling] = useState(false);
    const [staffSummary, setStaffSummary] = useState({ total: 0, active: 0, leave: 0, resigned: 0 });
    const [leaveData, setLeaveData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const year = new Date().getFullYear();

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [staffRes, leaveRes] = await Promise.allSettled([
                api.get('/hr/staff?status=all'),
                api.get(`/hr/leave/summary?year=${year}`),
            ]);

            // Staff Summary
            if (staffRes.status === 'fulfilled' && staffRes.value.data) {
                const rawData = staffRes.value.data;
                const list = Array.isArray(rawData) ? rawData : (rawData?.data || []);
                const active = list.filter(s => s.status === '재직').length;
                const onLeave = list.filter(s => s.status === '휴직').length;
                const resigned = list.filter(s => s.status === '퇴사').length;
                setStaffSummary({ total: list.length, active, leave: onLeave, resigned });

                // Generate alerts from staff data
                const newAlerts = [];
                list.forEach(s => {
                    if (s.status !== '재직') return;
                    // Contract expiry alert
                    if (s.contract_end_date) {
                        const end = new Date(s.contract_end_date);
                        const now = new Date();
                        const daysLeft = Math.floor((end - now) / (1000 * 60 * 60 * 24));
                        if (daysLeft >= 0 && daysLeft <= 30) {
                            newAlerts.push({
                                type: 'contract',
                                icon: FileText,
                                color: daysLeft <= 7 ? 'text-red-600' : 'text-amber-600',
                                bg: daysLeft <= 7 ? 'bg-red-50' : 'bg-amber-50',
                                message: `${s.name} 근로계약 만료 ${daysLeft}일 전`,
                                staffId: s.id,
                            });
                        }
                    }
                    // Visa expiry (if we had expiry date - for now show visa type)
                    if (s.visa_type && ['E-9', 'D-2', 'D-4', 'H-2'].includes(s.visa_type)) {
                        // These visa types need periodic renewal attention
                    }
                    // Missing documents
                    if (!s.doc_contract || !s.doc_health_cert) {
                        const missing = [];
                        if (!s.doc_contract) missing.push('근로계약서');
                        if (!s.doc_health_cert) missing.push('건강진단서');
                        newAlerts.push({
                            type: 'document',
                            icon: AlertTriangle,
                            color: 'text-amber-600',
                            bg: 'bg-amber-50',
                            message: `${s.name} 미제출 서류: ${missing.join(', ')}`,
                            staffId: s.id,
                        });
                    }
                });
                setAlerts(newAlerts);
            }

            // Leave Summary
            if (leaveRes.status === 'fulfilled' && leaveRes.value.data?.data) {
                setLeaveData(leaveRes.value.data.data);
            }
        } catch (err) {
            console.error('HR Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/20 to-blue-50/10">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 flex items-center justify-center shadow-lg shadow-indigo-200">
                            <BarChart3 size={20} className="text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-black text-slate-900">HR 대시보드</h1>
                            </div>
                            <p className="text-xs text-slate-400">인력 현황 · {isSimpleMode ? '간편관리' : '연차 현황 · 알림'}</p>
                        </div>
                    </div>

                    {/* 사업장 규모 토글 */}
                    <button
                        onClick={async () => {
                            setScaleToggling(true);
                            const newScale = isSimpleMode ? 'over5' : 'under5';
                            await updateScale(newScale);
                            setScaleToggling(false);
                            window.location.reload();
                        }}
                        disabled={scaleToggling}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                            isSimpleMode
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                        } disabled:opacity-50`}
                        title="클릭하여 사업장 규모 모드를 전환합니다"
                    >
                        <ArrowRightLeft size={14} />
                        <span>{isSimpleMode ? '🏪 5인 미만' : '🏢 5인 이상'}</span>
                        <span className="text-[10px] font-normal text-slate-400">전환</span>
                    </button>
                </div>

                {/* Staff Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                                <Users size={16} className="text-indigo-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">전체 인원</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">{staffSummary.total}<span className="text-sm text-slate-400 ml-1">명</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <UserCheck size={16} className="text-emerald-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">재직 중</span>
                        </div>
                        <p className="text-2xl font-black text-emerald-700">{staffSummary.active}<span className="text-sm text-slate-400 ml-1">명</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                                <Clock size={16} className="text-amber-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">휴직</span>
                        </div>
                        <p className="text-2xl font-black text-amber-700">{staffSummary.leave}<span className="text-sm text-slate-400 ml-1">명</span></p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                                <UserMinus size={16} className="text-slate-500" />
                            </div>
                            <span className="text-xs font-bold text-slate-400">퇴사</span>
                        </div>
                        <p className="text-2xl font-black text-slate-500">{staffSummary.resigned}<span className="text-sm text-slate-400 ml-1">명</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Alerts */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Bell size={16} className="text-amber-500" />
                                <h3 className="text-sm font-bold text-slate-800">알림 / 주의사항</h3>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md ml-auto">{alerts.length}</span>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto">
                                {alerts.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400">특이사항 없음</div>
                                ) : (
                                    alerts.map((alert, i) => {
                                        const Icon = alert.icon;
                                        return (
                                            <Link
                                                key={i}
                                                to={`/employees/${alert.staffId}`}
                                                className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                                            >
                                                <div className={`w-7 h-7 rounded-lg ${alert.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                                    <Icon size={13} className={alert.color} />
                                                </div>
                                                <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                                                <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
                                            </Link>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Leave Summary — 5인 이상만 */}
                    {!isSimpleMode && <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                                <Palmtree size={16} className="text-emerald-600" />
                                <h3 className="text-sm font-bold text-slate-800">{year}년 연차 현황</h3>
                            </div>
                            {leaveData.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400">연차 데이터가 없습니다.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="bg-slate-50/80">
                                                <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500">이름</th>
                                                <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">직책</th>
                                                <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500">총 연차</th>
                                                <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500">사용</th>
                                                <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500">잔여</th>
                                                <th className="px-5 py-2.5 text-[11px] font-bold text-slate-500">사용률</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50">
                                            {leaveData.map((item) => {
                                                const pct = item.total_annual > 0 ? (item.used_annual / item.total_annual * 100) : 0;
                                                return (
                                                    <tr key={item.staff_id} className="hover:bg-slate-50/50">
                                                        <td className="px-5 py-3">
                                                            <Link to={`/employees/${item.staff_id}`} className="text-sm font-bold text-slate-800 hover:text-indigo-600">
                                                                {item.staff_name}
                                                            </Link>
                                                        </td>
                                                        <td className="px-3 py-3 text-xs text-slate-500">{item.role}</td>
                                                        <td className="px-3 py-3 text-center text-sm font-bold text-slate-700">{item.total_annual}</td>
                                                        <td className="px-3 py-3 text-center text-sm text-slate-500">{item.used_annual}</td>
                                                        <td className="px-3 py-3 text-center">
                                                            <span className={`text-sm font-bold ${item.remaining_annual <= 3 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                {item.remaining_annual}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                                                                    <div
                                                                        className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-red-400' : pct > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                                                        style={{ width: `${Math.min(pct, 100)}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 w-8">{Math.round(pct)}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>}
                </div>
            </div>
        </div>
    );
}
