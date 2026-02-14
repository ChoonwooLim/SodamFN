import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, FileText, User, CreditCard, Calendar, CheckSquare, Upload, Eye, Printer, Edit2, Trash2, MessageSquare, Wallet, CheckCircle, AlertCircle, ShieldCheck, UserPlus, X } from 'lucide-react';
import api from '../api';
import PayrollStatement from '../components/PayrollStatement';
import AttendanceInput from '../components/AttendanceInput';

export default function StaffDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        role: 'Staff',
        status: '재직',
        contract_type: '아르바이트',
        start_date: '',
        insurance_4major: false,
        hourly_wage: 0,
        monthly_salary: 0,
        bank_account: '',
        bank_name: '',
        account_number: '',
        account_holder: '',
        work_schedule: '',
        doc_contract: false,
        doc_health_cert: false,
        doc_id_copy: false,

        doc_bank_copy: false,

        // Detailed Contract Fields
        contract_start_date: '',
        contract_end_date: '',
        work_start_time: '',
        work_end_time: '',
        rest_start_time: '',
        rest_end_time: '',
        working_days: '',
        weekly_holiday: '',
        job_description: '',
        bonus_enabled: false,
        bonus_amount: '',
        salary_payment_date: '매월 말일',
        salary_payment_method: '근로자 계좌 입금',
        dependents_count: 1,
        children_count: 0,
        insurance_base_salary: 0
    });

    const [documents, setDocuments] = useState([]); // List of uploaded documents
    const [payrolls, setPayrolls] = useState([]); // List of payroll history
    const [contracts, setContracts] = useState([]); // List of electronic contracts
    const [user, setUser] = useState(null); // Linked user account
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [selectedPayroll, setSelectedPayroll] = useState(null); // Selected payroll for statement modal
    const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
    const [isContractModalOpen, setIsContractModalOpen] = useState(false);
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [isVisaGuideOpen, setIsVisaGuideOpen] = useState(false);
    const [currentBudgetMonth, setCurrentBudgetMonth] = useState(new Date().toISOString().slice(0, 7));

    // New Account Form
    const [accountForm, setAccountForm] = useState({ username: '', password: '', grade: 'normal' });
    // New Contract Form
    const [contractForm, setContractForm] = useState({
        title: '표준근로계약서',
        content: `표준근로계약서

임춘우(이하 "사업주"라 함)와 {name}(이하 "근로자"라 함)은(는) 다음과 같이
근로계약을 체결한다.

1. 근로계약기간 : {contract_start_date} 부터 {contract_end_date} 까지
2. 근 무 장 소 : 소담김밥 건대본점 매장
3. 업무의 내용 : {job_description}
4. 소정근로시간 : {work_start_time} 부터 {work_end_time} 까지 (휴게시간 : {rest_start_time} ~ {rest_end_time})
5. 근무일/휴일 : {working_days} 근무, 주휴일 {weekly_holiday}
6. 임 금
- 월(일, 시)급 : {wage} 원
- 상여금 : {bonus_info}
- 기타 급여(제 수당 등) : 있음( 주휴수당),  없음(        )
- 지급일 : {salary_payment_date} (휴일의 경우는 전일 지급)
- 지급 방법 : {salary_payment_method}
7. 연차유급휴가
- 연차유급휴가는 근로기준법에서 정하는 바에 따라 부여함
8. 근로계약서 교뷰
- 사업주는 근로계약을 체결함과 동시에 본 계약서를 사본하여 근로자의
교부요구와 관계없이 근로자에게 교부함(근로기준법 제17조 이행)
9. 수습 기간
- 입사 개시 후 3개월은 당사의 업무 수습 근로자의 자격으로 근무한다.
10. 기타
- 이 계약에 정함이 없는 사항은 근로기준법령에 의함.

2026년       월    일
(사업주) 사업체명 : 소담김밥       전 화 : 02- 452-6570
주 소 : 서울시 광진구 능동로 110 스타시티 영존빌딩 B208호
                                  대 표 자 :   임  춘 우  (서명)

(근로자) 주 소 : {address}                                                                                연 락 처 : {phone}
                                       성  명 : {name}                    (서명)`
    });

    useEffect(() => {
        if (id) fetchStaffDetail();
    }, [id]);

    const formatPhoneNumber = (value) => {
        if (!value) return '';
        const raw = value.toString().replace(/\D/g, '');

        // 02 (Seoul) special case
        if (raw.startsWith('02')) {
            if (raw.length <= 2) return raw;
            if (raw.length <= 5) return `${raw.slice(0, 2)}-${raw.slice(2)}`;
            if (raw.length <= 9) return `${raw.slice(0, 2)}-${raw.slice(2, 5)}-${raw.slice(5)}`;
            return `${raw.slice(0, 2)}-${raw.slice(2, 6)}-${raw.slice(6, 10)}`;
        }

        // Mobile / Other
        if (raw.length <= 3) return raw;
        if (raw.length <= 7) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
        return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    };

    const fetchStaffDetail = async (newPayroll = null) => {
        try {
            const res = await api.get(`/hr/staff/${id}`);
            if (res.data.status === 'success') {
                const data = res.data.data;
                // Format phone on load
                if (data.phone) data.phone = formatPhoneNumber(data.phone);

                // Merge with existing formData to preserve fields not in the staff object
                setFormData(prev => ({ ...prev, ...data }));

                setDocuments(res.data.documents || []);
                setPayrolls(res.data.payrolls || []);
                setContracts(res.data.contracts || []);
                setUser(res.data.user || null);

                // If a new payroll was generated, open its statement automatically
                if (newPayroll) {
                    // Try to find the actual updated record in the list or use the passed one
                    setSelectedPayroll(newPayroll);
                }
            }
        } catch (error) {
            console.error(error);
            alert("직원 정보를 불러오는데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        if (name === 'phone') {
            newValue = formatPhoneNumber(newValue);
        }

        // Handle number inputs with commas
        if (name === 'hourly_wage' || name === 'monthly_salary' || name === 'insurance_base_salary') {
            newValue = value.replace(/,/g, '');
            if (isNaN(newValue) && newValue !== '-') return; // Allow empty or negative temporarily? strict for now
            if (newValue === '') {
                newValue = 0;
            } else {
                if (isNaN(newValue)) return;
                newValue = Number(newValue);
            }
        }

        setFormData(prev => ({
            ...prev,
            [name]: newValue
        }));
    };

    const handleSave = async () => {
        try {
            await api.put(`/hr/staff/${id}`, formData);
            setMsg("저장되었습니다.");
            setTimeout(() => setMsg(""), 3000);
        } catch (error) {
            console.error(error);
            alert("저장 실패");
        }
    };

    const handleFileUpload = async (e, docType) => {
        const file = e.target.files[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('doc_type', docType);
        uploadData.append('file', file);

        try {
            await api.post(`/hr/staff/${id}/document`, uploadData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // Refresh data to show new file
            fetchStaffDetail();
            setMsg("파일이 업로드되었습니다.");
            setTimeout(() => setMsg(""), 3000);
        } catch (error) {
            console.error("Upload failed", error);
            alert("파일 업로드 실패");
        }
    };

    const handleCreateAccount = async () => {
        try {
            await api.post(`/hr/staff/${id}/account`, accountForm);
            alert("계정이 생성되었습니다.");
            setIsAccountModalOpen(false);
            fetchStaffDetail();
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.detail || "계정 생성 실패");
        }
    };

    const handleGradeUpdate = async (newGrade) => {
        if (!user) return;
        try {
            await api.put(`/hr/staff/${id}/account/grade`, { grade: newGrade });
            setMsg("등급이 수정되었습니다.");
            setTimeout(() => setMsg(""), 3000);
            fetchStaffDetail();
        } catch (error) {
            console.error(error);
            alert("등급 수정 실패");
        }
    };

    const [editingContractId, setEditingContractId] = useState(null);

    const handleCreateContract = async () => {
        if (!typeof contractForm.content === 'string' || contractForm.content.trim().length === 0) {
            alert("계약서 내용이 비어있습니다.");
            return;
        }

        if (!contractForm.title || !contractForm.content) return alert("제목과 내용을 입력해주세요.");
        try {
            const resp = await api.post('/contracts/', { // Changed from /contract/ to /contracts/ to match existing API calls
                staff_id: parseInt(id), // Ensure staff_id is an integer
                title: contractForm.title,
                content: contractForm.content
            });
            if (resp.data.status === 'success') {
                setIsContractModalOpen(false);
                fetchStaffDetail();
                alert("계약서가 생성되었습니다.");
            }
        } catch (error) {
            console.error(error);
            alert("계약서 생성 실패");
        }
    };

    const handleSendContractAlimTalk = async (contractId) => {
        try {
            const resp = await api.post(`/contracts/${contractId}/send`); // Changed from /contract/ to /contracts/
            if (resp.data.status === 'success') {
                alert("카카오톡으로 계약서 링크를 전송했습니다.");
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.detail || "카카오톡 전송 실패");
        }
    };

    const handleSendAttendanceRequest = async () => {
        try {
            const resp = await api.post('/payroll/send-attendance-request', {
                staff_id: id,
                month: currentBudgetMonth
            });
            if (resp.data.status === 'success') {
                alert(`${currentBudgetMonth} 근무시간 확인 요청을 카카오톡으로 보냈습니다.`);
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.detail || "카카오톡 전송 실패");
        }
    };

    const handleSendPayrollStatement = async (payroll) => {
        try {
            const resp = await api.post('/payroll/send-statement', {
                staff_id: id,
                month: payroll.month
            });
            if (resp.data.status === 'success') {
                alert(`${payroll.month} 급여명세서 링크를 카카오톡으로 보냈습니다.`);
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.detail || "카카오톡 전송 실패");
        }
    };

    const [isBizAccountModalOpen, setIsBizAccountModalOpen] = useState(false);
    const [bizAccountForm, setBizAccountForm] = useState({ bank: '', number: '', holder: '' });

    const fetchBizAccount = async () => {
        try {
            const resp = await api.get('/payroll/transfer/biz-account');
            if (resp.data.status === 'success') {
                setBizAccountForm(resp.data.data);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleUpdateBizAccount = async () => {
        try {
            await api.put('/payroll/transfer/biz-account', bizAccountForm);
            alert("출금 계좌 정보가 저장되었습니다.");
            setIsBizAccountModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("계좌 정보 저장 실패");
        }
    };

    const handleExecuteTransfer = async (payrollId) => {
        if (!window.confirm("급여 이체를 실행하시겠습니까?")) return;
        try {
            const resp = await api.post(`/payroll/transfer/${payrollId}`);
            if (resp.data.status === 'success') {
                alert(resp.data.message);
                fetchStaffDetail();
            } else {
                // 정상 응답이지만 에러 상태 (validation 실패, API 미연동 등)
                alert(resp.data.message || "이체를 완료할 수 없습니다.");
            }
        } catch (error) {
            console.error(error);
            // HTTP 에러 (400, 401, 500 등)
            alert(error.response?.data?.message || error.response?.data?.detail || "이체 실행 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteContract = async (contractId) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/contracts/${contractId}`);
            setContracts(prev => prev.filter(c => c.id !== contractId)); // Optimistic update
            alert("삭제되었습니다.");
        } catch (error) {
            console.error("Failed to delete contract", error);
            const errMsg = error.response?.data?.detail || "삭제 실패";
            alert(`삭제 중 오류가 발생했습니다: ${errMsg}`);
        }
    };

    const handleEditContract = (contract) => {
        setContractForm({
            title: contract.title,
            content: contract.content
        });
        setEditingContractId(contract.id);
        setIsContractModalOpen(true);
    };

    const handleOpenContractModal = async () => {
        setEditingContractId(null); // Reset editing state
        let template = contractForm.content; // Default

        try {
            const res = await api.get('/settings/contract_template');
            if (res.data && res.data.value) {
                template = res.data.value;
            }
        } catch (error) {
            console.error("Failed to fetch contract template", error);
        }

        // --- Auto-Fill Logic ---
        // Replace placeholders with formData values
        const wage = formData.contract_type === '정규직'
            ? formData.monthly_salary
            : formData.hourly_wage;
        const formattedWage = wage ? Number(wage).toLocaleString() : '';

        const bonusInfo = formData.bonus_enabled
            ? `있음 (${formData.bonus_amount || ''})`
            : '없음';

        const replacements = {
            '{name}': formData.name || '',
            '{phone}': formData.phone || '',
            '{address}': formData.address || '____________________', // No address in Staff model yet? Wait, user asked to input it in ContractSign. But we should add it to Staff too if we can. 
            // Actually checking models.py -> Staff has address/resident_number fields.
            '{contract_start_date}': formData.contract_start_date || '____년 __월 __일',
            '{contract_end_date}': formData.contract_end_date || '____년 __월 __일',
            '{work_start_time}': formData.work_start_time || '__:__',
            '{work_end_time}': formData.work_end_time || '__:__',
            '{rest_start_time}': formData.rest_start_time || '__:__',
            '{rest_end_time}': formData.rest_end_time || '__:__',
            '{working_days}': formData.working_days || '______',
            '{weekly_holiday}': formData.weekly_holiday || '______',
            '{job_description}': formData.job_description || '______',
            '{wage}': formattedWage,
            '{bonus_info}': bonusInfo,
            '{salary_payment_date}': formData.salary_payment_date || '매월 말일',
            '{salary_payment_method}': formData.salary_payment_method || '근로자 계좌 입금'
        };

        let filledContent = template;
        for (const [key, value] of Object.entries(replacements)) {
            filledContent = filledContent.replace(new RegExp(key, 'g'), value);
        }

        setContractForm(prev => ({ ...prev, content: filledContent }));
        setIsContractModalOpen(true);
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;


    const docTypes = [
        { key: 'contract', label: '근로계약서' },
        { key: 'health_cert', label: '보건증' },
        { key: 'id_copy', label: '신분증 사본' },
        { key: 'bank_copy', label: '통장 사본' }
    ];

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/staff')} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:bg-slate-100 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-2xl font-bold text-slate-900">인사기록카드: {formData.name}</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-all active:scale-95"
                    >
                        <Save size={20} /> 저장하기
                    </button>
                </header>

                {msg && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 text-center font-bold animate-pulse">
                        {msg}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Left Column */}
                    <div className="space-y-6">
                        {/* 1. Basic Info */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><User size={24} /></div>
                                <h2 className="text-lg font-bold text-slate-800">기본 인적사항</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">성명</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">휴대폰</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">이메일</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">주소</label>
                                    <input
                                        type="text"
                                        name="address"
                                        value={formData.address || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="서울시 강남구..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">주민등록번호 (계약용)</label>
                                    <input
                                        type="text"
                                        name="resident_number"
                                        value={formData.resident_number || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="000000-0000000"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Working Conditions & Visa */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={24} /></div>
                                <h2 className="text-lg font-bold text-slate-800">재직 현황 및 체류자격</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">입사일</label>
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">상태</label>
                                        <select
                                            name="status"
                                            value={formData.status || '재직'}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="재직">재직</option>
                                            <option value="휴직">휴직</option>
                                            <option value="퇴사">퇴사</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-bold text-amber-900">외국인 체류자격 (Visa)</label>
                                        <button
                                            onClick={() => setIsVisaGuideOpen(true)}
                                            className="text-[10px] bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold hover:bg-amber-300"
                                        >
                                            자격별 안내 보기
                                        </button>
                                    </div>
                                    <select
                                        name="visa_type"
                                        value={formData.visa_type || ''}
                                        onChange={handleChange}
                                        className="w-full p-2.5 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                                    >
                                        <option value="">선택 안함 (내국인 등)</option>
                                        <option value="H-2">H-2 (방문취업)</option>
                                        <option value="E-9">E-9 (비전문취업)</option>
                                        <option value="F-2">F-2 (거주)</option>
                                        <option value="F-4">F-4 (재외동포)</option>
                                        <option value="F-5">F-5 (영주)</option>
                                        <option value="F-6">F-6 (결혼이민)</option>
                                        <option value="D-2">D-2 (유학 - 시간제 취업)</option>
                                        <option value="D-4">D-4 (어학연수)</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Login Account */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-800 text-sm">로그인 계정</h3>
                                {!user ? (
                                    <button
                                        onClick={() => setIsAccountModalOpen(true)}
                                        className="text-xs font-bold text-blue-600 hover:underline"
                                    >
                                        계정 생성
                                    </button>
                                ) : (
                                    <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                                        <CheckCircle size={12} /> 연동됨
                                    </span>
                                )}
                            </div>
                            {user ? (
                                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex flex-col gap-2">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">아이디</span>
                                        <span className="font-medium text-slate-800">{user.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-2">
                                        <span className="text-slate-500">등급</span>
                                        <select
                                            value={user.grade || 'normal'}
                                            onChange={(e) => handleGradeUpdate(e.target.value)}
                                            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none"
                                        >
                                            <option value="normal">일반 (Normal)</option>
                                            <option value="vip">VIP</option>
                                            <option value="admin">관리자 (Admin)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">연동된 계정이 없습니다.</div>
                            )}
                        </div>

                        {/* Employment & Payment */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-3 mb-6 border-b pb-4">
                                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><CreditCard size={24} /></div>
                                <h2 className="text-lg font-bold text-slate-800">계약 및 급여</h2>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">계약 형태</label>
                                        <select
                                            name="contract_type"
                                            value={formData.contract_type || '아르바이트'}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="정규직">정규직</option>
                                            <option value="아르바이트">아르바이트</option>
                                            <option value="일용직">일용직</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-1.5">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="insurance_4major"
                                                checked={formData.insurance_4major || false}
                                                onChange={handleChange}
                                                className="w-5 h-5 text-blue-600 rounded"
                                            />
                                            <span className="font-medium text-slate-700 text-sm">4대보험 가입</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">시급</label>
                                        <input
                                            type="text"
                                            name="hourly_wage"
                                            value={formData.hourly_wage ? Number(formData.hourly_wage).toLocaleString() : ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                        />
                                        <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                                    </div>
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">월급</label>
                                        <input
                                            type="text"
                                            name="monthly_salary"
                                            value={formData.monthly_salary ? Number(formData.monthly_salary).toLocaleString() : ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                        />
                                        <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                                    </div>
                                </div>

                                {/* 보수월액 - visible when 4대보험 or 정규직 */}
                                {(formData.insurance_4major || formData.contract_type === '정규직') && (
                                    <div className="relative">
                                        <label className="block text-sm font-medium text-slate-500 mb-1">보수월액 <span className="text-xs text-slate-400">(4대보험 산정기준)</span></label>
                                        <input
                                            type="text"
                                            name="insurance_base_salary"
                                            value={formData.insurance_base_salary ? Number(formData.insurance_base_salary).toLocaleString() : ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-right pr-9 focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                                            placeholder="0 (미입력시 총급여 기준)"
                                        />
                                        <span className="absolute right-3 top-[34px] text-slate-400 text-sm">원</span>
                                    </div>
                                )}

                                <div className="space-y-3">
                                    <label className="block text-sm font-medium text-slate-500">급여 계좌</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input
                                            type="text"
                                            name="bank_name"
                                            value={formData.bank_name || ''}
                                            onChange={handleChange}
                                            placeholder="은행명"
                                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                        <input
                                            type="text"
                                            name="account_number"
                                            value={formData.account_number || ''}
                                            onChange={handleChange}
                                            placeholder="계좌번호"
                                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                        <input
                                            type="text"
                                            name="account_holder"
                                            value={formData.account_holder || ''}
                                            onChange={handleChange}
                                            placeholder="예금주"
                                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Contract Info (Full Width) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <div className="flex items-center gap-3 mb-6 border-b pb-4">
                        <div className="p-2 bg-pink-100 text-pink-600 rounded-lg"><FileText size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800">상세 근로계약 정보</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 시작일</label>
                                        <input
                                            type="date"
                                            name="contract_start_date"
                                            value={formData.contract_start_date || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 종료일</label>
                                        <input
                                            type="date"
                                            name="contract_end_date"
                                            value={formData.contract_end_date || ''}
                                            onChange={handleChange}
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">근무 시간 (시작 - 종료)</label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            name="work_start_time"
                                            value={formData.work_start_time || ''}
                                            onChange={handleChange}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">시작</option>
                                            {Array.from({ length: 48 }).map((_, i) => {
                                                const h = Math.floor(i / 2).toString().padStart(2, '0');
                                                const m = (i % 2) * 30 === 0 ? '00' : '30';
                                                const time = `${h}:${m}`;
                                                return <option key={time} value={time}>{time}</option>;
                                            })}
                                        </select>
                                        <span className="text-slate-400">~</span>
                                        <select
                                            name="work_end_time"
                                            value={formData.work_end_time || ''}
                                            onChange={handleChange}
                                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">종료</option>
                                            {Array.from({ length: 48 }).map((_, i) => {
                                                const h = Math.floor(i / 2).toString().padStart(2, '0');
                                                const m = (i % 2) * 30 === 0 ? '00' : '30';
                                                const time = `${h}:${m}`;
                                                return <option key={time} value={time}>{time}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">근무 요일 및 휴일</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input
                                            type="text"
                                            name="working_days"
                                            value={formData.working_days || ''}
                                            onChange={handleChange}
                                            placeholder="예: 월~금"
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                        />
                                        <input
                                            type="text"
                                            name="weekly_holiday"
                                            value={formData.weekly_holiday || ''}
                                            onChange={handleChange}
                                            placeholder="주휴일: 일요일"
                                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">업무 내용</label>
                                    <input
                                        type="text"
                                        name="job_description"
                                        value={formData.job_description || ''}
                                        onChange={handleChange}
                                        placeholder="주방 보조, 홀 서빙 등"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* 4. Documents Upload */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Upload size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800">서류 제출 관리</h2>
                        </div>
                        <div className="space-y-3">
                            {docTypes.map((doc) => {
                                const uploadedDoc = documents.find(d => d.doc_type === doc.key);
                                const fileUrl = uploadedDoc ? `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/${uploadedDoc.file_path.replace(/\\/g, '/')}` : '#';
                                return (
                                    <div key={doc.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`p-2 rounded-lg ${uploadedDoc ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                                <CheckSquare size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-sm font-bold text-slate-800">{doc.label}</span>
                                                {uploadedDoc ? (
                                                    <span className="text-[10px] text-blue-500 truncate max-w-[120px]">{uploadedDoc.original_filename}</span>
                                                ) : (
                                                    <span className="text-[10px] text-red-400">미제출</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <label className="p-1.5 bg-white border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50">
                                                <Upload size={14} className="text-slate-600" />
                                                <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, doc.key)} />
                                            </label>
                                            {uploadedDoc && (
                                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                                                    <Eye size={14} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Electronic Contract Management */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6 border-b pb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><FileText size={24} /></div>
                                <h3 className="text-lg font-bold text-slate-800">전자계약 관리</h3>
                            </div>
                            <button
                                onClick={handleOpenContractModal}
                                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm"
                            >
                                새 계약서
                            </button>
                        </div>
                        <div className="space-y-3">
                            {contracts.length === 0 ? (
                                <div className="text-center py-8 text-slate-400 text-xs italic">진행 중인 계약이 없습니다.</div>
                            ) : (
                                contracts.map(contract => (
                                    <div key={contract.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${contract.status === 'signed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                                <FileText size={16} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-slate-800 truncate">{contract.title}</div>
                                                <div className="text-[10px] text-slate-400">
                                                    {contract.status === 'signed' ? '서명완료' : '대기중'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {contract.status !== 'signed' && (
                                                <button onClick={() => handleSendContractAlimTalk(contract.id)} className="p-1.5 hover:bg-emerald-50 text-slate-400 hover:text-emerald-600 rounded-lg">
                                                    <MessageSquare size={14} />
                                                </button>
                                            )}
                                            <button onClick={() => handleDeleteContract(contract.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg">
                                                <Trash2 size={14} />
                                            </button>
                                            {contract.status === 'signed' && (
                                                <button onClick={() => window.open(`/contracts/${contract.id}/sign`, '_blank')} className="text-xs font-bold text-blue-600 px-2 py-1">
                                                    보기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                {/* 5. Payroll History (Full Width) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6 border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><CreditCard size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800 whitespace-nowrap">월별 급여 지급 내역</h2>
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

                    {payrolls.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-sm italic">급여 지급 내역이 없습니다.</div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden sm:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600 text-sm">
                                            <th className="p-4 font-bold border-b border-slate-100">귀속월</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-right">기본급</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-right">{formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-right text-red-500">공제액</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-right text-blue-600">실수령액</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-center">상태</th>
                                            <th className="p-4 font-bold border-b border-slate-100 text-center">관리</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payrolls.map((pay) => (
                                            <tr key={pay.id} className="hover:bg-slate-50 border-b border-slate-50 transition-colors">
                                                <td className="p-4 text-sm font-bold text-slate-800">{pay.month}</td>
                                                <td className="p-4 text-sm text-right text-slate-600 font-mono">{(pay.base_pay || 0).toLocaleString()}</td>
                                                <td className="p-4 text-sm text-right text-slate-600 font-mono">{(pay.bonus || 0).toLocaleString()}</td>
                                                <td className="p-4 text-sm text-right text-red-400 font-mono">-{(pay.deductions || 0).toLocaleString()}</td>
                                                <td className="p-4 text-sm text-right text-indigo-600 font-bold font-mono">{(pay.total_pay || 0).toLocaleString()}</td>
                                                <td className="p-4 text-center">
                                                    {pay.transfer_status === '완료' ? (
                                                        <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">이체완료</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">이체대기</span>
                                                    )}
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button onClick={() => setSelectedPayroll(pay)} className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-colors" title="명세서 출력"><Printer size={16} /></button>
                                                        <button onClick={() => handleSendPayrollStatement(pay)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-colors" title="명세서 카톡전송"><MessageSquare size={16} /></button>
                                                        {pay.transfer_status !== '완료' && (
                                                            <button onClick={() => handleExecuteTransfer(pay.id)} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">이체</button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card List */}
                            <div className="sm:hidden space-y-3">
                                {payrolls.map((pay) => (
                                    <div key={pay.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="font-bold text-slate-800 text-sm">{pay.month}</span>
                                            {pay.transfer_status === '완료' ? (
                                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">이체완료</span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">이체대기</span>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                                            <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                                <span className="text-slate-500">기본급</span>
                                                <span className="font-bold font-mono text-slate-700">{(pay.base_pay || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                                <span className="text-slate-500">{formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}</span>
                                                <span className="font-bold font-mono text-slate-700">{(pay.bonus || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                                <span className="text-red-400">공제액</span>
                                                <span className="font-bold font-mono text-red-400">-{(pay.deductions || 0).toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between bg-white rounded-lg px-3 py-2">
                                                <span className="text-indigo-500">실수령</span>
                                                <span className="font-bold font-mono text-indigo-600">{(pay.total_pay || 0).toLocaleString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
                                            <button onClick={() => setSelectedPayroll(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-indigo-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-indigo-50">
                                                <Printer size={14} /> 명세서
                                            </button>
                                            <button onClick={() => handleSendPayrollStatement(pay)} className="flex-1 flex items-center justify-center gap-1 p-2 bg-white text-emerald-600 rounded-lg text-xs font-bold border border-slate-200 hover:bg-emerald-50">
                                                <MessageSquare size={14} /> 카톡전송
                                            </button>
                                            {pay.transfer_status !== '완료' && (
                                                <button onClick={() => handleExecuteTransfer(pay.id)} className="flex-1 p-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">
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

                {/* Modals */}
                {selectedPayroll && (
                    <PayrollStatement staff={formData} payroll={selectedPayroll} onClose={() => setSelectedPayroll(null)} />
                )}

                <AttendanceInput
                    isOpen={isAttendanceModalOpen}
                    onClose={() => setIsAttendanceModalOpen(false)}
                    staffId={id}
                    staffName={formData.name}
                    month={currentBudgetMonth}
                    onCalculateSuccess={fetchStaffDetail}
                />

                {isAccountModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-6">직원 계정 생성</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">아이디</label>
                                        <input
                                            type="text"
                                            value={accountForm.username}
                                            onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="아이디"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">비밀번호</label>
                                        <input
                                            type="password"
                                            value={accountForm.password}
                                            onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="비밀번호"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 flex gap-2">
                                <button onClick={() => setIsAccountModalOpen(false)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100">취소</button>
                                <button onClick={handleCreateAccount} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700">생성</button>
                            </div>
                        </div>
                    </div>
                )}

                {isContractModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
                            <div className="p-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900">전자계약서 작성</h3>
                                    <button
                                        onClick={() => {
                                            let newContent = contractForm.content || "";
                                            newContent = newContent.replace(/{name}/g, formData.name || "");
                                            newContent = newContent.replace(/{start_date}/g, formData.start_date || "");
                                            newContent = newContent.replace(/{phone}/g, formData.phone || "");
                                            const wage = formData.contract_type === '정규직' ? formData.monthly_salary : formData.hourly_wage;
                                            newContent = newContent.replace(/{wage}/g, wage ? wage.toLocaleString() : "");
                                            setContractForm(prev => ({ ...prev, content: newContent }));
                                        }}
                                        className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100"
                                    >
                                        변수 치환
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={contractForm.title}
                                        onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                                        placeholder="계약서 제목 (예: [소담] 근로계약서_홍길동)"
                                    />
                                    <textarea
                                        value={contractForm.content}
                                        onChange={(e) => setContractForm({ ...contractForm, content: e.target.value })}
                                        className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-700"
                                        placeholder="계약서 내용을 입력하세요. {name}, {start_date}, {wage} 등을 사용할 수 있습니다."
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 flex gap-3">
                                <button onClick={() => setIsContractModalOpen(false)} className="px-6 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">취소</button>
                                <button onClick={handleCreateContract} className="flex-1 p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg">발송하기</button>
                            </div>
                        </div>
                    </div>
                )}

                {isVisaGuideOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-slate-800">체류자격별 외국인 고용 안내</h3>
                                <button onClick={() => setIsVisaGuideOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                            </div>
                            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                                <div className="space-y-2">
                                    <h4 className="font-bold text-blue-600">H-2 (방문취업)</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-blue-50 p-3 rounded-xl">특례고용가능확인서 필요. 근로개시일 14일 이내 신고 필수.</p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-bold text-purple-600">D-2 (유학) / D-4 (연수)</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-purple-50 p-3 rounded-xl">학교 유학생 담당자 승인 및 출입국 '시간제 취업 허가' 필수. 주당 시간 제한 확인.</p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-bold text-emerald-600">F-2, F-4, F-5, F-6</h4>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-emerald-50 p-3 rounded-xl">내국인과 동일하게 자유로운 취업 가능 (단, F-4는 단순노무 일부 제한).</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50">
                                <button onClick={() => setIsVisaGuideOpen(false)} className="w-full p-3 bg-slate-200 text-slate-700 rounded-xl font-bold">확인</button>
                            </div>
                        </div>
                    </div>
                )}

                {isBizAccountModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2"><Wallet className="text-blue-600" /> 출금 계좌 설정</h3>
                                <div className="space-y-4">
                                    <input
                                        type="text"
                                        value={bizAccountForm.bank}
                                        onChange={(e) => setBizAccountForm({ ...bizAccountForm, bank: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                        placeholder="은행명"
                                    />
                                    <input
                                        type="text"
                                        value={bizAccountForm.number}
                                        onChange={(e) => setBizAccountForm({ ...bizAccountForm, number: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                        placeholder="계좌번호"
                                    />
                                    <input
                                        type="text"
                                        value={bizAccountForm.holder}
                                        onChange={(e) => setBizAccountForm({ ...bizAccountForm, holder: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none"
                                        placeholder="예금주"
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 flex gap-2">
                                <button onClick={() => setIsBizAccountModalOpen(false)} className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600">취소</button>
                                <button onClick={handleUpdateBizAccount} className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold">저장</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
