import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, CreditCard, Calendar, Users, Wallet, FileText,
  Printer, MessageSquare, Calculator, Search, ChevronDown,
  CheckCircle, Clock, Building2, AlertCircle,
  BarChart3, TrendingUp, RefreshCw
} from 'lucide-react';
import api from '../api';
import PayrollStatement from '../components/PayrollStatement';
import AttendanceInput from '../components/AttendanceInput';

const fmt = (v) => (v || 0).toLocaleString();

export default function PayrollLedger() {
  const navigate = useNavigate();

  // Staff list & selection
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('재직');
  const [staffListLoading, setStaffListLoading] = useState(true);

  // Selected staff detail
  const [staffData, setStaffData] = useState(null);
  const [payrolls, setPayrolls] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [selectedPayroll, setSelectedPayroll] = useState(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  // Expanded payroll row
  const [expandedPayrollId, setExpandedPayrollId] = useState(null);

  // Summary stats
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());

  // ─── Fetch Staff List ───
  useEffect(() => {
    fetchStaffList();
  // eslint-disable-next-line
  }, [statusFilter]);

  const fetchStaffList = async () => {
    setStaffListLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const res = await api.get(`/hr/staff?${params.toString()}`);
      if (res.data.status === 'success') {
        setStaffList(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    } finally {
      setStaffListLoading(false);
    }
  };

  // ─── Fetch Staff Detail + Payrolls ───
  useEffect(() => {
    if (selectedStaffId) fetchStaffDetail();
  // eslint-disable-next-line
  }, [selectedStaffId]);

  const fetchStaffDetail = async (autoSelectMonth = null) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/hr/staff/${selectedStaffId}`);
      if (res.data.status === 'success') {
        setStaffData(res.data.data);
        const payrollList = res.data.payrolls || [];
        setPayrolls(payrollList);
        if (autoSelectMonth) {
          const match = payrollList.find(p => p.month === autoSelectMonth);
          if (match) setSelectedPayroll(match);
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // ─── Filtered Staff ───
  const filteredStaff = useMemo(() => {
    if (!searchTerm) return staffList;
    return staffList.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [staffList, searchTerm]);

  // ─── Payroll Summary ───
  const payrollSummary = useMemo(() => {
    const filtered = payrolls.filter(p => p.month?.startsWith(yearFilter));
    const totalBase = filtered.reduce((s, p) => s + (p.base_pay || 0), 0);
    const totalBonus = filtered.reduce((s, p) => s + (p.bonus || 0), 0);
    const totalDeductions = filtered.reduce((s, p) => s + (p.deductions || 0), 0);
    const totalNet = filtered.reduce((s, p) => s + (p.total_pay || 0), 0);
    const count = filtered.length;
    const transferred = filtered.filter(p => p.transfer_status === '완료').length;
    return { totalBase, totalBonus, totalDeductions, totalNet, count, transferred };
  }, [payrolls, yearFilter]);

  // ─── Handlers ───
  const handleSendPayrollStatement = async (pay) => {
    try {
      const resp = await api.post('/payroll/send-statement', {
        staff_id: selectedStaffId,
        month: pay.month
      });
      if (resp.data.status === 'success') {
        alert(`${pay.month} 급여명세서 링크를 카카오톡으로 보냈습니다.`);
      }
    } catch (err) {
      alert(err.response?.data?.detail || '카카오톡 전송 실패');
    }
  };

  const handleExecuteTransfer = async (payrollId) => {
    if (!window.confirm('급여 이체를 실행하시겠습니까?')) return;
    try {
      const resp = await api.post(`/payroll/transfer/${payrollId}`);
      if (resp.data.status === 'success') {
        alert(resp.data.message);
        fetchStaffDetail();
      } else {
        alert(resp.data.message || '이체를 완료할 수 없습니다.');
      }
    } catch (err) {
      alert(err.response?.data?.message || err.response?.data?.detail || '이체 실행 중 오류가 발생했습니다.');
    }
  };

  const handleSendAttendanceRequest = async () => {
    try {
      const resp = await api.post('/payroll/send-attendance-request', {
        staff_id: selectedStaffId,
        month: currentMonth
      });
      if (resp.data.status === 'success') {
        alert(`${currentMonth} 근무시간 확인 요청을 카카오톡으로 보냈습니다.`);
      }
    } catch (err) {
      alert(err.response?.data?.detail || '카카오톡 전송 실패');
    }
  };

  // Parse details_json for expanded view
  const getPayrollDetails = (pay) => {
    try {
      if (pay.details_json) {
        return typeof pay.details_json === 'string' ? JSON.parse(pay.details_json) : pay.details_json;
      }
    } catch { /* ignore parse errors */ }
    return { work_breakdown: [], holiday_details: {} };
  };

  // ─── Available years for year filter ───
  const availableYears = useMemo(() => {
    const years = new Set();
    payrolls.forEach(p => {
      if (p.month) years.add(p.month.split('-')[0]);
    });
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return [...years].sort().reverse();
  }, [payrolls]);

  // =============================================================================
  // RENDER
  // =============================================================================
  return (
    <div className="min-h-screen pb-24" style={{ background: '#475569' }}>
      {/* ═══ HEADER ═══ */}
      <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button onClick={() => navigate('/staff')} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all">
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                  <Wallet className="text-blue-400" size={24} />
                  급여대장
                </h1>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Payroll Ledger — 직원별 급여 관리</p>
              </div>
            </div>

            {/* Month Picker + Actions */}
            {selectedStaffId && (
              <div className="hidden sm:flex items-center gap-2">
                <input
                  type="month"
                  value={currentMonth}
                  onChange={(e) => setCurrentMonth(e.target.value)}
                  className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-400 outline-none [color-scheme:dark]"
                />
                <button
                  onClick={() => setIsAttendanceOpen(true)}
                  className="flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg transition-all" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' }}
                >
                  <Calculator size={14} /> 출퇴근/정산
                </button>
                <button
                  onClick={handleSendAttendanceRequest}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-emerald-500/30 transition-all"
                  title="직원에게 근무시간 입력 요청 카톡 발송"
                >
                  <MessageSquare size={14} /> 시급입력 요청
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6" style={{ marginTop: 16 }}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* ═══ LEFT PANEL: Staff List ═══ */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-2xl overflow-hidden sticky top-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
              <div className="p-4" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Users size={16} className="text-blue-500" />
                  <span className="text-sm font-bold text-slate-700">직원 선택</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold">{staffList.length}명</span>
                </div>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="이름 검색..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex gap-1 mt-2">
                  {['재직', '퇴사', 'all'].map(s => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold transition-all ${statusFilter === s ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      style={statusFilter === s ? { background: 'linear-gradient(135deg, #3b82f6, #2563eb)' } : {}}
                    >
                      {s === 'all' ? '전체' : s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50">
                {staffListLoading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">로딩 중...</div>
                ) : filteredStaff.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">직원이 없습니다.</div>
                ) : filteredStaff.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStaffId(s.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50/50 transition-all group ${selectedStaffId === s.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${selectedStaffId === s.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'}`}>
                        {s.name?.[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-800 truncate">{s.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                          <span>{s.contract_type || '아르바이트'}</span>
                          <span className="text-slate-300">·</span>
                          <span>{fmt(s.hourly_wage)}원</span>
                        </div>
                      </div>
                      <div className="ml-auto shrink-0">
                        {s.status === '재직' ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300 inline-block"></span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ RIGHT PANEL: Content ═══ */}
          <div className="lg:col-span-9 space-y-5">
            {!selectedStaffId ? (
              /* ─── Empty State ─── */
              <div className="bg-white rounded-2xl p-12 sm:p-16 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                <div className="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #dbeafe, #e0e7ff)' }}>
                  <Wallet size={36} className="text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-700 mb-2">직원을 선택하세요</h2>
                <p className="text-sm text-slate-400 max-w-sm mx-auto">좌측 목록에서 직원을 선택하면 계약 정보와 급여 대장이 표시됩니다.</p>
              </div>
            ) : detailLoading ? (
              <div className="bg-white rounded-2xl shadow-lg p-16 text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="text-slate-400 text-sm mt-4">로딩 중...</p>
              </div>
            ) : staffData && (
              <>
                {/* ═══ CONTRACT & SALARY INFO CARD ═══ */}
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                  <div style={{ background: 'linear-gradient(135deg, #134e4a, #1e3a3a)' }} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <CreditCard size={18} />
                      <span className="font-bold text-sm">계약 및 급여 — {staffData.name}</span>
                    </div>
                    <button
                      onClick={() => navigate(`/staff/${selectedStaffId}`)}
                      className="text-[10px] px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white font-bold transition-all"
                    >
                      인사기록 →
                    </button>
                  </div>

                  <div className="p-5">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                      {/* Contract Type */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">계약형태</div>
                        <div className="text-sm font-black text-slate-800">{staffData.contract_type || '아르바이트'}</div>
                      </div>
                      {/* Hourly Wage */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">시급</div>
                        <div className="text-sm font-black text-blue-700">{fmt(staffData.hourly_wage)}<span className="text-[10px] text-slate-400 ml-0.5">원</span></div>
                      </div>
                      {/* Monthly Salary */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">월급</div>
                        <div className="text-sm font-black text-blue-700">{fmt(staffData.monthly_salary)}<span className="text-[10px] text-slate-400 ml-0.5">원</span></div>
                      </div>
                      {/* Insurance */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">4대보험</div>
                        <div className="text-sm font-black">
                          {staffData.insurance_4major ? <span className="text-emerald-600">가입</span> : <span className="text-slate-400">미가입</span>}
                        </div>
                      </div>
                      {/* Insurance Base */}
                      {(staffData.insurance_4major || staffData.contract_type === '정규직') && (
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                          <div className="text-[10px] text-amber-600 font-bold mb-1">보수월액</div>
                          <div className="text-sm font-black text-amber-700">{fmt(staffData.insurance_base_salary)}<span className="text-[10px] text-amber-500 ml-0.5">원</span></div>
                        </div>
                      )}
                      {/* Bank Account */}
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                        <div className="text-[10px] text-slate-400 font-bold mb-1">급여계좌</div>
                        <div className="text-xs font-bold text-slate-700 truncate">
                          {staffData.bank_name || staffData.account_number
                            ? `${staffData.bank_name || ''} ${staffData.account_number || ''}`
                            : '미등록'}
                        </div>
                      </div>
                    </div>

                    {/* Options Tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {staffData.dependents_count > 0 && (
                        <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold border border-blue-100">
                          부양가족 {staffData.dependents_count}명
                        </span>
                      )}
                      {staffData.children_count > 0 && (
                        <span className="text-[10px] px-2 py-1 bg-blue-50 text-blue-600 rounded-lg font-bold border border-blue-100">
                          20세 이하 자녀 {staffData.children_count}명
                        </span>
                      )}
                      {staffData.np_exempt && (
                        <span className="text-[10px] px-2 py-1 bg-orange-50 text-orange-600 rounded-lg font-bold border border-orange-100">
                          국민연금 면제 (60세+)
                        </span>
                      )}
                      {staffData.durunnuri_support && (
                        <span className="text-[10px] px-2 py-1 bg-green-50 text-green-600 rounded-lg font-bold border border-green-100">
                          두루누리 지원 (80%감면)
                        </span>
                      )}
                      {staffData.tax_support_enabled && (
                        <span className="text-[10px] px-2 py-1 bg-purple-50 text-purple-600 rounded-lg font-bold border border-purple-100">
                          세금 대납 (사업주 부담)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ═══ ANNUAL SUMMARY ═══ */}
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div className="flex items-center gap-2">
                      <BarChart3 size={16} className="text-blue-500" />
                      <span className="text-sm font-bold text-slate-700">연간 급여 요약</span>
                    </div>
                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="text-xs font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-600"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}>
                      <div className="text-[10px] font-bold text-white/70 mb-1">총 기본급</div>
                      <div className="text-lg font-black">{fmt(payrollSummary.totalBase)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #059669, #047857)' }}>
                      <div className="text-[10px] font-bold text-white/70 mb-1">총 수당</div>
                      <div className="text-lg font-black">{fmt(payrollSummary.totalBonus)}</div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}>
                      <div className="text-[10px] font-bold text-slate-400 mb-1">총 공제</div>
                      <div className="text-lg font-black text-red-500">-{fmt(payrollSummary.totalDeductions)}</div>
                    </div>
                    <div className="rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #134e4a, #1e3a3a)' }}>
                      <div className="text-[10px] font-bold text-white/70 mb-1">총 실수령</div>
                      <div className="text-lg font-black">{fmt(payrollSummary.totalNet)}</div>
                      <div className="text-[10px] mt-1 text-white/50">{payrollSummary.count}건 / 이체완료 {payrollSummary.transferred}건</div>
                    </div>
                  </div>
                </div>

                {/* ═══ MOBILE: Month Picker + Actions ═══ */}
                <div className="sm:hidden flex flex-wrap items-center gap-2 bg-white rounded-xl p-3 shadow border border-slate-100">
                  <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none min-w-[140px]"
                  />
                  <button
                    onClick={() => setIsAttendanceOpen(true)}
                    className="flex items-center gap-1 text-white px-3 py-2 rounded-lg text-xs font-bold" style={{ background: '#2563eb' }}
                  >
                    <Calculator size={14} /> 정산
                  </button>
                  <button
                    onClick={handleSendAttendanceRequest}
                    className="flex items-center gap-1 bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold"
                  >
                    <MessageSquare size={14} /> 요청
                  </button>
                </div>

                {/* ═══ PAYROLL HISTORY TABLE ═══ */}
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #e2e8f0' }}>
                  <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                    <div className="flex items-center gap-2">
                      <FileText size={16} className="text-blue-500" />
                      <span className="text-sm font-bold text-slate-700">월별 급여 지급 내역</span>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full font-bold">{payrolls.length}건</span>
                    </div>
                    <button
                      onClick={() => fetchStaffDetail()}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                      title="새로고침"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  {payrolls.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <Calendar size={36} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">급여 지급 내역이 없습니다.</p>
                      <p className="text-xs text-slate-300 mt-1">출퇴근/정산 버튼으로 급여를 산출하세요.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                              <th className="px-4 py-3 font-bold border-b border-slate-100">귀속월</th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-right">기본급</th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-right">
                                {staffData.contract_type === '정규직' ? '추가수당' : '주휴수당'}
                              </th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-red-400">공제액</th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-right text-blue-600">실수령액</th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">상태</th>
                              <th className="px-4 py-3 font-bold border-b border-slate-100 text-center">관리</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payrolls.map((pay) => {
                              const isExpanded = expandedPayrollId === pay.id;
                              return (
                                <tr key={pay.id} className="group">
                                  {/* Main Row */}
                                  <td className="px-4 py-3 text-sm font-bold text-slate-800 border-b border-slate-50">
                                    <button
                                      onClick={() => setExpandedPayrollId(isExpanded ? null : pay.id)}
                                      className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                                    >
                                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      {pay.month}
                                    </button>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-right text-slate-600 font-mono border-b border-slate-50">{fmt(pay.base_pay)}</td>
                                  <td className="px-4 py-3 text-sm text-right text-slate-600 font-mono border-b border-slate-50">{fmt(pay.bonus)}</td>
                                  <td className="px-4 py-3 text-sm text-right text-red-400 font-mono border-b border-slate-50">-{fmt(pay.deductions)}</td>
                                  <td className="px-4 py-3 text-sm text-right text-blue-600 font-bold font-mono border-b border-slate-50">{fmt(pay.total_pay)}</td>
                                  <td className="px-4 py-3 text-center border-b border-slate-50">
                                    {pay.transfer_status === '완료' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                                        <CheckCircle size={10} /> 이체완료
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                                        <Clock size={10} /> 이체대기
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 border-b border-slate-50">
                                    <div className="flex items-center justify-center gap-1.5">
                                      <button
                                        onClick={() => setSelectedPayroll(pay)}
                                        className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
                                        title="명세서 출력"
                                      >
                                        <Printer size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleSendPayrollStatement(pay)}
                                        className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg transition-colors"
                                        title="명세서 카톡전송"
                                      >
                                        <MessageSquare size={14} />
                                      </button>
                                      {pay.transfer_status !== '완료' && (
                                        <button
                                          onClick={() => handleExecuteTransfer(pay.id)}
                                          className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 shadow-sm transition-all"
                                        >
                                          이체
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Expanded Detail Rows (rendered separately for clean DOM) */}
                        {payrolls.map(pay => {
                          if (expandedPayrollId !== pay.id) return null;
                          const expandedDetails = getPayrollDetails(pay);
                          return (
                            <div key={`detail-${pay.id}`} className="border-t border-blue-100 bg-blue-50/30 px-6 py-4 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Earnings Breakdown */}
                                <div>
                                  <h4 className="text-[11px] font-black text-blue-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <TrendingUp size={12} /> 지급 항목 상세
                                  </h4>
                                  <div className="space-y-1.5">
                                    {expandedDetails.work_breakdown?.map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                        <div>
                                          <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                          {item.dates && <span className="text-[9px] text-slate-400 ml-2">({item.dates})</span>}
                                        </div>
                                        <span className="text-xs font-bold text-slate-800 font-mono">{fmt(item.amount)}</span>
                                      </div>
                                    ))}
                                    {/* Holiday Pay Breakdown */}
                                    {(pay.bonus_holiday || 0) > 0 && (
                                      <div className="mt-2 pt-2 border-t border-blue-100">
                                        <div className="text-[10px] font-bold text-blue-700 mb-1">주휴수당 주차별</div>
                                        {[1, 2, 3, 4, 5, 6].map(w => {
                                          const amt = pay[`holiday_w${w}`];
                                          const desc = expandedDetails.holiday_details?.[w.toString()];
                                          if (!amt && !desc) return null;
                                          const isDeferred = desc?.includes('익월정산');
                                          const isDisq = desc?.includes('자격미달');
                                          return (
                                            <div key={w} className={`flex justify-between items-center px-3 py-1.5 rounded-lg text-xs ${isDeferred ? 'bg-amber-50 text-amber-700' : isDisq ? 'bg-red-50 text-red-600' : 'bg-white text-slate-700'} border border-slate-100 mb-1`}>
                                              <div>
                                                <span className="font-bold">{w}주차</span>
                                                {desc && <span className="text-[9px] ml-1.5 text-slate-400">{desc}</span>}
                                              </div>
                                              <span className="font-bold font-mono">{isDeferred ? '익월' : isDisq ? '-' : fmt(amt)}</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Deductions Breakdown */}
                                <div>
                                  <h4 className="text-[11px] font-black text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    <AlertCircle size={12} /> 공제 항목 상세
                                  </h4>
                                  <div className="space-y-1.5">
                                    {[
                                      { label: '국민연금', val: pay.deduction_np },
                                      { label: '건강보험', val: pay.deduction_hi },
                                      { label: '장기요양보험', val: pay.deduction_lti },
                                      { label: '고용보험', val: pay.deduction_ei },
                                      { label: '소득세', val: pay.deduction_it },
                                      { label: '지방소득세', val: pay.deduction_lit },
                                    ].map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                                        <span className="text-xs font-bold text-slate-700">{item.label}</span>
                                        <span className={`text-xs font-bold font-mono ${(item.val || 0) > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                                          {(item.val || 0) > 0 ? `-${fmt(item.val)}` : '-'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Tax Support */}
                                  {(pay.bonus_tax_support || 0) > 0 && (
                                    <div className="mt-3 bg-purple-50 rounded-lg px-3 py-2 border border-purple-100 flex justify-between items-center">
                                      <span className="text-xs font-bold text-purple-700">세금대납 (사업주)</span>
                                      <span className="text-xs font-black text-purple-600 font-mono">+{fmt(pay.bonus_tax_support)}</span>
                                    </div>
                                  )}

                                  {/* Summary */}
                                  <div className="mt-3 bg-slate-800 rounded-lg px-3 py-3 text-white">
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-400">지급총액</span>
                                      <span className="font-bold font-mono">{fmt((pay.base_pay || 0) + (pay.bonus || 0))}</span>
                                    </div>
                                    <div className="flex justify-between text-xs mb-1">
                                      <span className="text-slate-400">공제총액</span>
                                      <span className="font-bold font-mono text-red-300">-{fmt(pay.deductions)}</span>
                                    </div>
                                    <div className="border-t border-slate-700 mt-2 pt-2 flex justify-between">
                                      <span className="text-xs font-bold">실수령액</span>
                                      <span className="text-base font-black text-yellow-300 font-mono">{fmt(pay.total_pay)}</span>
                                    </div>
                                  </div>

                                  {/* Bank Info */}
                                  <div className="mt-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100 flex items-center gap-2">
                                    <Building2 size={12} className="text-slate-400" />
                                    <span className="text-[10px] text-slate-500 font-bold">
                                      {staffData.bank_name || ''} {staffData.account_number || ''} {staffData.account_holder || ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Mobile Card List */}
                      <div className="sm:hidden divide-y divide-slate-50">
                        {payrolls.map((pay) => (
                          <div key={pay.id} className="p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="font-bold text-slate-800 text-sm">{pay.month}</span>
                              {pay.transfer_status === '완료' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
                                  <CheckCircle size={10} /> 완료
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                                  <Clock size={10} /> 대기
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                <span className="text-slate-500">기본급</span>
                                <span className="font-bold font-mono text-slate-700">{fmt(pay.base_pay)}</span>
                              </div>
                              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                <span className="text-slate-500">{staffData.contract_type === '정규직' ? '수당' : '주휴'}</span>
                                <span className="font-bold font-mono text-slate-700">{fmt(pay.bonus)}</span>
                              </div>
                              <div className="flex justify-between bg-slate-50 rounded-lg px-3 py-2">
                                <span className="text-red-400">공제</span>
                                <span className="font-bold font-mono text-red-400">-{fmt(pay.deductions)}</span>
                              </div>
                              <div className="flex justify-between bg-blue-50 rounded-lg px-3 py-2">
                                <span className="text-blue-500">실수령</span>
                                <span className="font-bold font-mono text-blue-600">{fmt(pay.total_pay)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => setSelectedPayroll(pay)}
                                className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-blue-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-blue-50"
                              >
                                <Printer size={13} /> 명세서
                              </button>
                              <button
                                onClick={() => handleSendPayrollStatement(pay)}
                                className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-emerald-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-emerald-50"
                              >
                                <MessageSquare size={13} /> 카톡
                              </button>
                              {pay.transfer_status !== '완료' && (
                                <button
                                  onClick={() => handleExecuteTransfer(pay.id)}
                                  className="flex-1 p-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm"
                                >
                                  이체
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}
      {selectedPayroll && staffData && (
        <PayrollStatement staff={staffData} payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
      )}

      {isAttendanceOpen && selectedStaffId && (
        <AttendanceInput
          isOpen={isAttendanceOpen}
          onClose={() => setIsAttendanceOpen(false)}
          staffId={selectedStaffId}
          staffName={staffData?.name || ''}
          month={currentMonth}
          onCalculateSuccess={() => fetchStaffDetail(currentMonth)}
        />
      )}
    </div>
  );
}
