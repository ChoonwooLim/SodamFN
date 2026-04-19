import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Clock, AlertTriangle, CalendarDays, TrendingUp, Palmtree, Bell, ChevronRight, ChevronDown, BarChart3, Shield, FileText, UserCheck, UserMinus, Briefcase, Settings, ArrowRightLeft, Scale, BookOpen, Banknote, GraduationCap, CheckCircle2, XCircle, Info } from 'lucide-react';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import api from '../api';

const LABOR_LAWS = {
    under5: {
        apply: [
            {
                icon: Banknote,
                title: '최저임금법',
                summary: '시간당 최저임금 준수 의무',
                detail: '2026년 최저시급(고용노동부 고시) 이상을 지급해야 합니다. 주급·월급도 시급 환산 기준을 준수해야 하며, 위반 시 3년 이하 징역 또는 2천만원 이하 벌금이 부과됩니다.',
            },
            {
                icon: CalendarDays,
                title: '주휴수당 (근로기준법 §55)',
                summary: '주 15시간 이상 근무 시 유급 주휴일 1일',
                detail: '1주 소정근로시간이 15시간 이상이고 결근 없이 개근한 근로자에게 1일분의 유급휴일(주휴일)을 부여해야 합니다. 5인 미만 사업장도 동일하게 적용됩니다.',
            },
            {
                icon: Briefcase,
                title: '퇴직금 (근로자퇴직급여보장법)',
                summary: '1년 이상 + 주 15시간 이상 시 지급',
                detail: '계속근로기간 1년 이상, 4주 평균 1주 소정근로시간 15시간 이상인 근로자에게 30일분 평균임금 이상의 퇴직금을 지급해야 합니다. 5인 미만도 동일 적용.',
            },
            {
                icon: Shield,
                title: '4대보험 가입 의무',
                summary: '국민연금 · 건강보험 · 고용보험 · 산재보험',
                detail: '근로자를 1명이라도 고용하면 4대보험 가입이 의무입니다. 산재보험과 고용보험은 1개월 미만 일용직에도 적용되며, 미가입 시 과태료 및 보험료 소급 징수가 발생합니다.',
            },
            {
                icon: FileText,
                title: '근로계약서 서면 작성·교부',
                summary: '채용 즉시 서면 계약서 발급',
                detail: '임금·근로시간·휴일·연차·취업장소·업무 등을 명시한 근로계약서를 서면으로 작성·교부해야 합니다. 위반 시 500만원 이하 벌금 (기간제·단시간은 과태료).',
            },
            {
                icon: AlertTriangle,
                title: '해고 예고 (근로기준법 §26)',
                summary: '30일 전 예고 또는 해고예고수당',
                detail: '근로자를 해고할 경우 최소 30일 전 서면 예고하거나, 예고하지 않을 때는 30일분 이상의 통상임금을 해고예고수당으로 지급해야 합니다. 5인 미만도 적용.',
            },
        ],
        notApply: [
            {
                icon: Palmtree,
                title: '연차유급휴가 미적용',
                summary: '근로기준법 §60은 5인 이상부터 적용',
                detail: '법정 유급 연차휴가 의무가 없습니다. 단, 근로계약서·취업규칙에 연차를 부여하기로 명시했다면 그 내용을 이행해야 합니다. 무급휴가·병가·경조사는 업무 공백 관리를 위해 사내 규정을 권장합니다.',
            },
            {
                icon: Clock,
                title: '연장·야간·휴일 가산수당 미적용',
                summary: '통상임금의 50% 가산 규정 미적용',
                detail: '5인 미만은 연장근로(일 8시간/주 40시간 초과), 야간근로(22:00~06:00), 휴일근로에 대한 1.5배 가산 지급 의무가 없습니다. 다만 실제 근무한 시간에 대한 통상임금은 반드시 지급해야 합니다.',
            },
            {
                icon: TrendingUp,
                title: '주 52시간제 미적용',
                summary: '연장근로 주 12시간 한도 규제 미적용',
                detail: '주 40시간 + 연장 12시간 한도가 적용되지 않습니다. 다만 과로·산재 위험 관리 차원에서 합리적인 근무시간 운영이 권장됩니다.',
            },
            {
                icon: Scale,
                title: '부당해고 구제신청 제한',
                summary: '노동위원회 구제신청 대상 아님',
                detail: '근로기준법 §23의 "정당한 이유 없는 해고 금지"가 적용되지 않아, 근로자가 노동위원회에 부당해고 구제신청을 할 수 없습니다. 단, 해고예고(§26) 의무는 적용됩니다.',
            },
            {
                icon: GraduationCap,
                title: '법정 의무교육 미적용',
                summary: '성희롱 예방·장애인 인식개선 등',
                detail: '직장 내 성희롱 예방교육(남녀고용평등법), 장애인 인식개선 교육, 개인정보보호 교육 등의 법정 의무교육은 5인 이상 사업장부터 적용됩니다. 미적용이지만 권장 사항.',
            },
            {
                icon: BookOpen,
                title: '취업규칙 작성 의무 없음',
                summary: '10인 이상부터 작성·신고 의무',
                detail: '상시 10인 이상 사업장이 취업규칙 작성 및 고용노동부 신고 의무가 있습니다. 5인 미만은 임의 작성으로, 작성 시 근로자에게 주지시키면 효력을 가집니다.',
            },
        ],
    },
    over5: {
        apply: [
            {
                icon: Palmtree,
                title: '연차유급휴가 (근로기준법 §60)',
                summary: '1년 미만 월 1일 / 1년 이상 15일부터',
                detail: '1년 미만 근무자는 1개월 개근 시 1일씩 최대 11일 부여. 1년 이상 + 출근율 80% 이상이면 15일 부여. 3년째부터 2년마다 1일씩 가산(최대 25일). 미사용 연차는 연차수당으로 지급해야 합니다.',
            },
            {
                icon: Clock,
                title: '주 52시간제',
                summary: '주 40시간 + 연장 12시간 한도',
                detail: '1주 법정 근로시간은 40시간. 연장근로는 당사자 합의 시 1주 12시간까지만 허용됩니다. 위반 시 2년 이하 징역 또는 2천만원 이하 벌금.',
            },
            {
                icon: TrendingUp,
                title: '연장·야간·휴일 가산수당 1.5배',
                summary: '통상임금의 50% 가산 지급',
                detail: '연장근로(일 8시간/주 40시간 초과), 야간근로(22:00~06:00), 휴일근로에 대해 통상임금의 50% 이상을 가산 지급해야 합니다. 두 가지가 겹치면 중복 가산.',
            },
            {
                icon: Scale,
                title: '부당해고 구제신청 대상',
                summary: '정당한 이유 없는 해고 금지 (§23)',
                detail: '정당한 이유 없이 해고·휴직·정직·전직·감봉 등을 할 수 없습니다. 근로자는 해고일로부터 3개월 이내 노동위원회에 부당해고 구제신청 가능.',
            },
            {
                icon: GraduationCap,
                title: '법정 의무교육',
                summary: '성희롱 예방 · 장애인 인식 · 개인정보',
                detail: '직장 내 성희롱 예방교육(연 1회 이상), 장애인 인식개선 교육(연 1회), 개인정보보호 교육 등을 전 직원 대상 실시하고 증빙(교육일지·참석자 명부)을 보관해야 합니다. 미실시 시 최대 500만원 과태료.',
            },
            {
                icon: BookOpen,
                title: '취업규칙 작성·신고 (10인 이상)',
                summary: '상시 10인 이상 시 고용노동부 신고',
                detail: '상시 10인 이상 사업장은 취업규칙을 작성해 고용노동부에 신고해야 합니다. 불리하게 변경할 경우 근로자 과반수 동의 필수. 사업장 게시·주지 의무 있음.',
            },
            {
                icon: Banknote,
                title: '최저임금법 · 주휴수당',
                summary: '시급 준수 + 주 15시간 이상 주휴일',
                detail: '최저시급 이상 지급, 주 15시간 이상 근무자에게 유급 주휴일 1일을 부여해야 합니다. 기본 공통 사항.',
            },
            {
                icon: Briefcase,
                title: '퇴직금 지급',
                summary: '1년 이상 + 주 15시간 이상 근속 시',
                detail: '계속근로기간 1년 이상, 4주 평균 주 15시간 이상 근로자에게 30일분 평균임금 이상 퇴직금 지급 의무. 퇴직일로부터 14일 이내 지급.',
            },
            {
                icon: Shield,
                title: '4대보험 가입',
                summary: '국민연금·건강·고용·산재',
                detail: '근로자 고용 시 의무 가입. 사업주·근로자 분담 납부. 산재는 사업주 전액 부담. 미가입 시 과태료 및 보험료 소급 징수.',
            },
            {
                icon: FileText,
                title: '근로계약서 서면 교부',
                summary: '채용 즉시 서면 계약서 발급',
                detail: '임금·근로시간·휴일·연차 등 주요 근로조건을 서면 명시하고 근로자에게 교부. 위반 시 500만원 이하 벌금.',
            },
            {
                icon: AlertTriangle,
                title: '해고 예고 (§26)',
                summary: '30일 전 예고 또는 해고예고수당',
                detail: '해고 최소 30일 전 서면 예고, 미예고 시 30일분 이상 통상임금을 해고예고수당으로 지급.',
            },
            {
                icon: CalendarDays,
                title: '근로시간 기록·보존',
                summary: '출퇴근 기록 3년 보존 의무',
                detail: '근로자 명부, 임금대장, 출퇴근 기록 등 근로관계 중요 서류를 3년간 보존해야 합니다. 근로감독 시 제출 요구 대응 필수.',
            },
        ],
    },
};

export default function HRDashboard() {
    const navigate = useNavigate();
    const { isSimpleMode, employeeScale, updateScale } = useBusinessConfig();
    const [scaleToggling, setScaleToggling] = useState(false);
    const [staffSummary, setStaffSummary] = useState({ total: 0, active: 0, leave: 0, resigned: 0 });
    const [leaveData, setLeaveData] = useState([]);
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedLaw, setExpandedLaw] = useState(null);
    const year = new Date().getFullYear();

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [staffRes, leaveRes, pendingRes] = await Promise.allSettled([
                api.get('/hr/staff?status=all'),
                api.get(`/hr/leave/summary?year=${year}`),
                api.get('/hr/leave/requests?limit=50'),
            ]);

            // 모든 휴가 신청 보관 (under5 카드용)
            if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.data) {
                setLeaveRequests(pendingRes.value.data.data);
            }

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

                // Pending leave requests — 최상단 (status=대기만)
                if (pendingRes.status === 'fulfilled' && pendingRes.value.data?.data?.length) {
                    pendingRes.value.data.data
                        .filter(r => r.status === '대기')
                        .forEach(r => {
                            newAlerts.push({
                                type: 'leave',
                                icon: Palmtree,
                                color: 'text-emerald-600',
                                bg: 'bg-emerald-50',
                                message: `${r.staff_name} ${r.leave_type} 신청 대기 (${r.start_date}~${r.end_date}, ${r.days}일)`,
                                staffId: r.staff_id,
                            });
                        });
                }

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
                        className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                            isSimpleMode
                                ? 'bg-emerald-50 border-emerald-400 text-emerald-800 hover:bg-emerald-100 ring-2 ring-emerald-100'
                                : 'bg-blue-50 border-blue-400 text-blue-800 hover:bg-blue-100 ring-2 ring-blue-100'
                        } disabled:opacity-50`}
                        title={`현재 ${isSimpleMode ? '5인 미만' : '5인 이상'} 모드 — 클릭하여 ${isSimpleMode ? '5인 이상' : '5인 미만'}으로 전환`}
                    >
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isSimpleMode ? 'bg-emerald-500 text-white' : 'bg-blue-500 text-white'}`}>
                            현재
                        </span>
                        <span className="text-sm">{isSimpleMode ? '🏪 5인 미만' : '🏢 5인 이상'}</span>
                        <span className="h-3 w-px bg-slate-300" />
                        <ArrowRightLeft size={12} className="text-slate-400" />
                        <span className="text-[10px] font-medium text-slate-500">
                            {isSimpleMode ? '5인 이상' : '5인 미만'}으로 전환
                        </span>
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
                    {/* Alerts — 공통 h-[440px] */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[440px] flex flex-col">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                                <Bell size={16} className="text-amber-500" />
                                <h3 className="text-sm font-bold text-slate-800">알림 / 주의사항</h3>
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md ml-auto">{alerts.length}</span>
                            </div>
                            <div className="divide-y divide-slate-50 overflow-y-auto flex-1">
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

                    {/* Leave Card — 5인 이상: 연차 현황 / 5인 미만: 휴가 신청 현황 */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden h-[440px] flex flex-col">
                            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                                <Palmtree size={16} className="text-emerald-600" />
                                <h3 className="text-sm font-bold text-slate-800">
                                    {isSimpleMode ? '휴가 신청 현황' : `${year}년 연차 현황`}
                                </h3>
                                {isSimpleMode && (
                                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md ml-auto">
                                        {leaveRequests.length}건
                                    </span>
                                )}
                            </div>

                            {isSimpleMode ? (
                                // 5인 미만: 휴가 신청 목록 (무급/병가/경조사 등)
                                <div className="overflow-y-auto flex-1">
                                    {leaveRequests.length === 0 ? (
                                        <div className="py-8 px-5 text-center">
                                            <Palmtree size={28} className="mx-auto text-slate-300 mb-2" />
                                            <p className="text-xs text-slate-400">신청된 휴가가 없습니다.</p>
                                            <p className="text-[10px] text-slate-400 mt-1">직원이 신청하면 여기에 표시됩니다.</p>
                                        </div>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur">
                                                <tr>
                                                    <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500">직원</th>
                                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">유형</th>
                                                    <th className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-500">기간</th>
                                                    <th className="text-center px-3 py-2.5 text-[11px] font-bold text-slate-500">일수</th>
                                                    <th className="text-center px-5 py-2.5 text-[11px] font-bold text-slate-500">상태</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {leaveRequests.map((r) => {
                                                    const statusStyle = r.status === '대기'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                        : r.status === '승인'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : r.status === '반려'
                                                                ? 'bg-red-50 text-red-700 border-red-200'
                                                                : 'bg-slate-50 text-slate-600 border-slate-200';
                                                    return (
                                                        <tr key={r.id} className="hover:bg-slate-50/50">
                                                            <td className="px-5 py-3">
                                                                <Link to={`/employees/${r.staff_id}`} className="text-sm font-bold text-slate-800 hover:text-indigo-600">
                                                                    {r.staff_name}
                                                                </Link>
                                                            </td>
                                                            <td className="px-3 py-3 text-xs text-slate-600">{r.leave_type}</td>
                                                            <td className="px-3 py-3 text-[11px] text-slate-500">
                                                                {r.start_date}
                                                                {r.end_date && r.end_date !== r.start_date ? ` ~ ${r.end_date}` : ''}
                                                            </td>
                                                            <td className="px-3 py-3 text-center text-sm font-bold text-slate-700">{r.days}</td>
                                                            <td className="px-5 py-3 text-center">
                                                                <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>
                                                                    {r.status}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ) : (
                                // 5인 이상: 연차 현황 테이블
                                <div className="overflow-y-auto flex-1">
                                    {leaveData.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-slate-400">연차 데이터가 없습니다.</div>
                                    ) : (
                                        <table className="w-full">
                                            <thead className="sticky top-0 bg-slate-50/90 backdrop-blur">
                                                <tr>
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
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 노동법 핵심 안내 — 사업장 규모별 */}
                <LaborLawPanel scale={employeeScale} isSimpleMode={isSimpleMode} expandedLaw={expandedLaw} setExpandedLaw={setExpandedLaw} />
            </div>
        </div>
    );
}

function LaborLawPanel({ scale, isSimpleMode, expandedLaw, setExpandedLaw }) {
    const data = LABOR_LAWS[scale] || LABOR_LAWS.over5;
    const toggleKey = (key) => setExpandedLaw(expandedLaw === key ? null : key);

    const renderGroup = (items, prefix, tone) => {
        const toneMap = {
            green: { icon: 'text-emerald-600', iconBg: 'bg-emerald-50', border: 'border-emerald-100', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
            slate: { icon: 'text-slate-500', iconBg: 'bg-slate-100', border: 'border-slate-200', chip: 'bg-slate-50 text-slate-600 border-slate-200' },
            blue: { icon: 'text-blue-600', iconBg: 'bg-blue-50', border: 'border-blue-100', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
        };
        const t = toneMap[tone] || toneMap.blue;
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((item, i) => {
                    const Icon = item.icon;
                    const key = `${prefix}-${i}`;
                    const open = expandedLaw === key;
                    return (
                        <button
                            key={key}
                            onClick={() => toggleKey(key)}
                            className={`text-left bg-white border ${t.border} rounded-xl p-4 hover:shadow-md hover:border-indigo-200 transition-all`}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`w-9 h-9 rounded-lg ${t.iconBg} flex items-center justify-center flex-shrink-0`}>
                                    <Icon size={16} className={t.icon} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-bold text-slate-900 truncate">{item.title}</h4>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed">{item.summary}</p>
                                    {open && (
                                        <div className="mt-3 pt-3 border-t border-slate-100">
                                            <p className="text-[12px] text-slate-700 leading-relaxed whitespace-pre-line">{item.detail}</p>
                                        </div>
                                    )}
                                </div>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-300 flex-shrink-0 mt-2 transition-transform ${open ? 'rotate-180' : ''}`}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-gradient-to-r from-slate-50 to-white">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-sm">
                    <Scale size={16} className="text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-black text-slate-900">노동법 핵심 안내</h3>
                    <p className="text-[11px] text-slate-400">
                        {isSimpleMode ? '5인 미만 사업장' : '5인 이상 사업장'} 기준 · 카드를 클릭하면 상세 내용이 펼쳐집니다
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-6">
                {isSimpleMode ? (
                    <>
                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 size={16} className="text-emerald-600" />
                                <h4 className="text-sm font-bold text-slate-800">반드시 준수해야 할 법령</h4>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">{data.apply.length}건</span>
                            </div>
                            {renderGroup(data.apply, 'u5-apply', 'green')}
                        </section>

                        <section>
                            <div className="flex items-center gap-2 mb-3">
                                <XCircle size={16} className="text-slate-400" />
                                <h4 className="text-sm font-bold text-slate-600">5인 미만에는 미적용 (참고)</h4>
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">{data.notApply.length}건</span>
                            </div>
                            <div className="flex items-start gap-2 bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                                <Info size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    아래 항목은 법적 의무가 아니지만, 근로계약서·취업규칙에 명시했다면 그 내용을 이행해야 합니다.
                                </p>
                            </div>
                            {renderGroup(data.notApply, 'u5-not', 'slate')}
                        </section>
                    </>
                ) : (
                    <section>
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={16} className="text-blue-600" />
                            <h4 className="text-sm font-bold text-slate-800">준수 의무 법령</h4>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md">{data.apply.length}건</span>
                        </div>
                        {renderGroup(data.apply, 'o5-apply', 'blue')}
                    </section>
                )}

                <div className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2.5">
                    <Info size={13} className="text-slate-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                        본 안내는 주요 법령을 요약한 참고 자료입니다. 구체적인 사안은 고용노동부(국번없이 1350) 또는 공인노무사 상담을 권장합니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
