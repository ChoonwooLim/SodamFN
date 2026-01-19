import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, FileText, User, CreditCard, Calendar, CheckSquare, Upload, Eye, Printer, Edit2, Trash2 } from 'lucide-react';
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
        role: 'Staff',
        status: '재직',
        contract_type: '아르바이트',
        start_date: '',
        insurance_4major: false,
        hourly_wage: 0,
        monthly_salary: 0,
        bank_account: '',
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
        salary_payment_method: '근로자 계좌 입금'
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
                setFormData(data);
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
        if (name === 'hourly_wage' || name === 'monthly_salary') {
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

        try {
            if (editingContractId) {
                // Update existing
                await api.put(`/contracts/${editingContractId}`, {
                    title: contractForm.title,
                    content: contractForm.content
                });
                alert("계약서가 수정되었습니다.");
            } else {
                // Create new
                await api.post(`/contracts/`, {
                    staff_id: parseInt(id),
                    ...contractForm
                });
                alert("계약서가 생성되었습니다.");
            }
            setIsContractModalOpen(false);
            setEditingContractId(null);
            fetchStaffDetail();
        } catch (error) {
            console.error(error);
            alert("계약서 저장 실패");
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
                        <button onClick={() => navigate('/staff')} className="p-2 bg-white rounded-full shadow-sm text-slate-600 hover:bg-slate-100">
                            <ChevronLeft size={24} />
                        </button>
                        <h1 className="text-2xl font-bold text-slate-900">인사기록카드: {formData.name}</h1>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-700 shadow-md transition-colors"
                    >
                        <Save size={20} /> 저장하기
                    </button>
                </header>

                {msg && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 text-center font-bold">
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
                                        name="name"
                                        value={formData.name || ''}
                                        readOnly
                                        className="w-full p-2 bg-slate-50 rounded border border-slate-200 text-slate-600"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">연락처 (휴대폰)</label>
                                    <input
                                        name="phone"
                                        value={formData.phone || ''}
                                        onChange={handleChange}
                                        placeholder="010-0000-0000"
                                        className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">주소</label>
                                    <input
                                        name="address"
                                        value={formData.address || ''}
                                        onChange={handleChange}
                                        placeholder="주소 입력"
                                        className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">주민등록번호</label>
                                    <input
                                        name="resident_number"
                                        value={formData.resident_number || ''}
                                        onChange={handleChange}
                                        placeholder="000000-0000000"
                                        className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">직책 / 역할</label>
                                    <input
                                        name="role"
                                        value={formData.role || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">재직 상태</label>
                                        <select
                                            name="status"
                                            value={formData.status || '재직'}
                                            onChange={handleChange}
                                            className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="재직">재직</option>
                                            <option value="퇴사">퇴사</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">입사일</label>
                                        <input
                                            type="date"
                                            name="start_date"
                                            value={formData.start_date || ''}
                                            onChange={handleChange}
                                            className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1">국적 (Nationality)</label>
                                            <select
                                                name="nationality"
                                                value={formData.nationality || 'South Korea'}
                                                onChange={handleChange}
                                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="South Korea">대한민국 (South Korea)</option>
                                                <option value="China">중국 (China)</option>
                                                <option value="Vietnam">베트남 (Vietnam)</option>
                                                <option value="Philippines">필리핀 (Philippines)</option>
                                                <option value="Uzbekistan">우즈베키스탄 (Uzbekistan)</option>
                                                <option value="Other">기타 (Other)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-500 mb-1 flex justify-between items-center">
                                                비자 종류
                                                <button
                                                    onClick={() => setIsVisaGuideOpen(true)}
                                                    className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 hover:bg-slate-200 flex items-center gap-1"
                                                >
                                                    <span className="w-3 h-3 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">?</span>
                                                    고용주 가이드
                                                </button>
                                            </label>
                                            <select
                                                name="visa_type"
                                                value={formData.visa_type || ''}
                                                onChange={handleChange}
                                                className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            >
                                                <option value="">선택 안함</option>
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
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-6">
                        {/* Login Account Section */}
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
                                        <CheckSquare size={12} /> 연동됨
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
                                            className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-blue-500"
                                        >
                                            <option value="normal">일반 (Normal)</option>
                                            <option value="vip">VIP</option>
                                            <option value="vvip">VVIP</option>
                                            <option value="admin">관리자 (Admin)</option>
                                        </select>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-xs text-slate-400 italic">연동된 계정이 없습니다.</div>
                            )}
                        </div>

                        {/* 2. Employment & Payment */}
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
                                            className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="정규직">정규직</option>
                                            <option value="아르바이트">아르바이트</option>
                                            <option value="일용직">일용직</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                name="insurance_4major"
                                                checked={formData.insurance_4major || false}
                                                onChange={handleChange}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="font-medium text-slate-700">4대보험 가입</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">시급</label>
                                        <input
                                            type="text"
                                            name="hourly_wage"
                                            value={formData.hourly_wage ? Number(formData.hourly_wage).toLocaleString() : ''}
                                            onChange={handleChange}
                                            className="w-full p-2 rounded border border-slate-200 text-right pr-8 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        <span className="absolute mt-[-30px] ml-[130px] text-slate-400 text-sm">원</span>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-500 mb-1">월급 (정규직)</label>
                                        <input
                                            type="text"
                                            name="monthly_salary"
                                            value={formData.monthly_salary ? Number(formData.monthly_salary).toLocaleString() : ''}
                                            onChange={handleChange}
                                            className="w-full p-2 rounded border border-slate-200 text-right pr-8 focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-500 mb-1">급여 계좌</label>
                                    <input
                                        name="bank_account"
                                        value={formData.bank_account || ''}
                                        onChange={handleChange}
                                        placeholder="은행명 계좌번호 예금주"
                                        className="w-full p-2 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Detailed Contract Info (New Section) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <div className="flex items-center gap-3 mb-6 border-b pb-4">
                        <div className="p-2 bg-pink-100 text-pink-600 rounded-lg"><FileText size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800">상세 근로계약 정보</h2>
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 시작일</label>
                                <input
                                    type="date"
                                    name="contract_start_date"
                                    value={formData.contract_start_date || ''}
                                    onChange={handleChange}
                                    className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근로계약 종료일</label>
                                <input
                                    type="date"
                                    name="contract_end_date"
                                    value={formData.contract_end_date || ''}
                                    onChange={handleChange}
                                    className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근무 시간 (시작 - 종료)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        name="work_start_time"
                                        value={formData.work_start_time || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                    <span>~</span>
                                    <select
                                        name="work_end_time"
                                        value={formData.work_end_time || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">휴게 시간 (시작 - 종료)</label>
                                <div className="flex items-center gap-2">
                                    <select
                                        name="rest_start_time"
                                        value={formData.rest_start_time || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택</option>
                                        {Array.from({ length: 48 }).map((_, i) => {
                                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                                            const m = (i % 2) * 30 === 0 ? '00' : '30';
                                            const time = `${h}:${m}`;
                                            return <option key={time} value={time}>{time}</option>;
                                        })}
                                    </select>
                                    <span>~</span>
                                    <select
                                        name="rest_end_time"
                                        value={formData.rest_end_time || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">선택</option>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">근무일 (요일)</label>
                                <input
                                    name="working_days"
                                    value={formData.working_days || ''}
                                    onChange={handleChange}
                                    placeholder="예: 매주 월~금"
                                    className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">주휴일</label>
                                <input
                                    name="weekly_holiday"
                                    value={formData.weekly_holiday || ''}
                                    onChange={handleChange}
                                    placeholder="예: 매주 일요일"
                                    className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">업무의 내용</label>
                            <input
                                name="job_description"
                                value={formData.job_description || ''}
                                onChange={handleChange}
                                placeholder="예: 주방 보조 및 설거지"
                                className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">상여금</label>
                                <div className="flex items-center gap-2 mb-2">
                                    <input
                                        type="checkbox"
                                        name="bonus_enabled"
                                        checked={formData.bonus_enabled || false}
                                        onChange={handleChange}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-slate-600">상여금 지급 (체크시 내용 입력)</span>
                                </div>
                                {formData.bonus_enabled && (
                                    <input
                                        name="bonus_amount"
                                        value={formData.bonus_amount || ''}
                                        onChange={handleChange}
                                        placeholder="상여금 지급 기준 및 금액"
                                        className="w-full p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-500 mb-1">임금 지급</label>
                                <div className="flex gap-2">
                                    <input
                                        name="salary_payment_date"
                                        value={formData.salary_payment_date || ''}
                                        onChange={handleChange}
                                        placeholder="지급일 (매월 말일)"
                                        className="w-1/2 p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                        name="salary_payment_method"
                                        value={formData.salary_payment_method || ''}
                                        onChange={handleChange}
                                        placeholder="방법 (계좌 입금)"
                                        className="w-1/2 p-2 rounded border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. Documents Upload */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 border-b pb-4">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><FileText size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800">서류 제출 및 관리</h2>
                    </div>

                    <div className="space-y-4">
                        {docTypes.map((doc) => {
                            // Find uploaded doc
                            const uploadedDoc = documents.find(d => d.doc_type === doc.key);
                            const fileUrl = uploadedDoc ? `http://localhost:8000/${uploadedDoc.file_path.replace(/\\/g, '/')}` : '#';

                            return (
                                <div key={doc.key} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`p-2 rounded-full ${uploadedDoc ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'}`}>
                                            <CheckSquare size={18} />
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-medium text-slate-800">{doc.label}</span>
                                            {uploadedDoc ? (
                                                <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline truncate block max-w-[150px]">
                                                    {uploadedDoc.original_filename}
                                                </a>
                                            ) : (
                                                <span className="text-xs text-red-400">미제출</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <label className="flex items-center gap-1 bg-white border border-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-50 shadow-sm">
                                            <Upload size={14} />
                                            업로드
                                            <input
                                                type="file"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, doc.key)}
                                            />
                                        </label>
                                        {uploadedDoc && (
                                            <a
                                                href={fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200"
                                            >
                                                <Eye size={14} /> 보기
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
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><FileText size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800">전자계약 관리</h2>
                        </div>
                        <button
                            onClick={handleOpenContractModal}
                            className="flex items-center gap-1.5 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 border border-blue-200"
                        >
                            <FileText size={14} /> 계약서 작성
                        </button>
                    </div>

                    <div className="space-y-3">
                        {contracts.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 text-sm italic">
                                발송된 전자계약서가 없습니다.
                            </div>
                        ) : (
                            contracts.map(contract => (
                                <div key={contract.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${contract.status === 'signed' ? 'bg-emerald-50 text-emerald-500' : 'bg-blue-50 text-blue-500'}`}>
                                            <FileText size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-800 truncate">{contract.title}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {contract.status === 'signed' && contract.signed_at ? `서명됨 (${new Date(contract.signed_at).toLocaleDateString()})` : '서명 대기 중'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {contract.status !== 'signed' && (
                                            <button
                                                onClick={() => handleEditContract(contract)}
                                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                title="수정"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteContract(contract.id)}
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        {contract.status === 'signed' && (
                                            <button
                                                onClick={() => window.open(`/contracts/${contract.id}/sign`, '_blank')}
                                                className="text-xs font-bold text-blue-600 hover:underline shrink-0 ml-1"
                                            >
                                                확인
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div >
            {/* 5. Payroll History (Full Width) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between mb-6 border-b pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><CreditCard size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800">월별 급여 지급 내역</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="month"
                            value={currentBudgetMonth}
                            onChange={(e) => setCurrentBudgetMonth(e.target.value)}
                            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <button
                            onClick={() => setIsAttendanceModalOpen(true)}
                            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm transition-all"
                        >
                            <Calendar size={16} /> 근무 기록/급여 산출
                        </button>
                    </div>
                </div>

                {/* Payroll List Content */}
                {payrolls.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        지급된 급여 내역이 없습니다.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-600 text-sm">
                                    <th className="p-3 font-semibold rounded-l-lg">귀속월</th>
                                    <th className="p-3 font-semibold text-right">기본급</th>
                                    <th className="p-3 font-semibold text-right">{formData.contract_type === '정규직' ? '추가수당' : '주휴수당'}</th>
                                    <th className="p-3 font-semibold text-right text-red-500">공제액</th>
                                    <th className="p-3 font-semibold text-right text-blue-600">실수령액</th>
                                    <th className="p-3 font-semibold text-center rounded-r-lg">작업</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {payrolls.map((pay) => (
                                    <tr key={pay.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                        <td className="p-3 font-medium text-slate-800">{pay.month}</td>
                                        <td className="p-3 text-right text-slate-600">{(pay.base_pay || 0).toLocaleString()}원</td>
                                        <td className="p-3 text-right text-slate-600">{(pay.bonus || 0).toLocaleString()}원</td>
                                        <td className="p-3 text-right text-red-400">-{(pay.deductions || 0).toLocaleString()}원</td>
                                        <td className="p-3 text-right font-bold text-blue-600">{(pay.total_pay || 0).toLocaleString()}원</td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={() => setSelectedPayroll(pay)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors mx-auto text-xs font-semibold"
                                            >
                                                <Printer size={14} /> 명세서
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )
                }
            </div >

            {/* Payroll Statement Modal */}
            {
                selectedPayroll && (
                    <PayrollStatement
                        staff={formData}
                        payroll={selectedPayroll}
                        onClose={() => setSelectedPayroll(null)}
                    />
                )
            }

            {/* Attendance & Calculation Modal */}
            <AttendanceInput
                isOpen={isAttendanceModalOpen}
                onClose={() => setIsAttendanceModalOpen(false)}
                staffId={id}
                staffName={formData.name}
                month={currentBudgetMonth}
                onCalculateSuccess={fetchStaffDetail}
            />

            {/* Account Creation Modal */}
            {
                isAccountModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-slate-900 mb-6 font-primary">직원 로그인 계정 생성</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">아이디</label>
                                        <input
                                            type="text"
                                            value={accountForm.username}
                                            onChange={(e) => setAccountForm({ ...accountForm, username: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="아이디 입력"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">비밀번호</label>
                                        <input
                                            type="password"
                                            value={accountForm.password}
                                            onChange={(e) => setAccountForm({ ...accountForm, password: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="비밀번호 입력"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 flex gap-2">
                                <button
                                    onClick={() => setIsAccountModalOpen(false)}
                                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleCreateAccount}
                                    className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                                >
                                    생성하기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Contract Creation Modal */}
            {
                isContractModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6">
                                <h2 className="text-xl font-bold text-slate-900 mb-6 font-primary">전자계약서 작성</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">계약서 제목</label>
                                        <input
                                            type="text"
                                            value={contractForm.title}
                                            onChange={(e) => setContractForm({ ...contractForm, title: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="제목 입력"
                                        />
                                        <button
                                            onClick={() => {
                                                let newContent = contractForm.content;
                                                newContent = newContent.replace(/{name}/g, formData.name || "");
                                                newContent = newContent.replace(/{start_date}/g, formData.start_date || "");
                                                newContent = newContent.replace(/{phone}/g, formData.phone || "");
                                                const wage = formData.contract_type === '정규직' ? formData.monthly_salary : formData.hourly_wage;
                                                newContent = newContent.replace(/{wage}/g, wage ? wage.toLocaleString() : "");
                                                setContractForm(prev => ({ ...prev, content: newContent }));
                                            }}
                                            className="mt-2 text-xs bg-slate-100 px-2 py-1 rounded text-slate-600 hover:bg-slate-200"
                                        >
                                            정보 자동 입력 (이름, 입사일, 급여 등)
                                        </button>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1.5">계약 내용</label>
                                        <textarea
                                            value={contractForm.content}
                                            onChange={(e) => setContractForm({ ...contractForm, content: e.target.value })}
                                            className="w-full h-80 bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium text-slate-700"
                                            placeholder="계약서 전문 또는 주요 내용을 입력하세요."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-4 flex gap-3">
                                <button
                                    onClick={() => setIsContractModalOpen(false)}
                                    className="w-1/3 p-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-100"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleCreateContract}
                                    className="flex-1 p-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200"
                                >
                                    계약서 발송하기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Visa Guide Modal */}
            {
                isVisaGuideOpen && (
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <span className="bg-blue-100 text-blue-600 p-2 rounded-lg font-bold">ℹ️</span>
                                    <h2 className="text-lg font-bold text-slate-800">외국인 고용주 체류자격별 안내</h2>
                                </div>
                                <button onClick={() => setIsVisaGuideOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500">
                                    ✖
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto max-h-[70vh] space-y-6">

                                {/* H-2 */}
                                <div className="space-y-2">
                                    <h3 className="font-bold text-blue-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        H-2 (방문취업)
                                    </h3>
                                    <div className="bg-blue-50 p-3 rounded-xl text-sm text-slate-700 leading-relaxed border border-blue-100">
                                        <p><strong>✅ 고용 가능 요건:</strong> 특례고용가능확인서 필요.</p>
                                        <p className="mt-1"><strong>⚠️ 의무사항:</strong> 근로개시일로부터 14일 이내 고용노동부 및 법무부(하이코리아)에 <strong>근로개시 신고</strong> 필수.</p>
                                        <p className="text-xs text-slate-500 mt-2">* 위반 시 과태료 부과 대상.</p>
                                    </div>
                                </div>

                                {/* D-2 */}
                                <div className="space-y-2">
                                    <h3 className="font-bold text-purple-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        D-2 (유학) / D-4 (어학연수)
                                    </h3>
                                    <div className="bg-purple-50 p-3 rounded-xl text-sm text-slate-700 leading-relaxed border border-purple-100">
                                        <p><strong>✅ 시간제 취업 허가:</strong> 학교 유학생 담당자 확인 및 출입국사무소 <strong>'시간제 취업 확인서'</strong> 발급 필수.</p>
                                        <p className="mt-1"><strong>⏳ 시간 제한:</strong></p>
                                        <ul className="list-disc pl-4 mt-1 space-y-1 text-xs">
                                            <li>어학연수생/학부 1~2학년: 주 20시간 이내</li>
                                            <li>학부 3~4학년/석박사: 주 30시간 이내 (인증대학 기준 상이할 수 있음)</li>
                                            <li>방학 중: 시간 제한 없음 (단, 허가 자체는 필수)</li>
                                        </ul>
                                    </div>
                                </div>

                                {/* E-9 */}
                                <div className="space-y-2">
                                    <h3 className="font-bold text-emerald-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                        E-9 (비전문취업)
                                    </h3>
                                    <div className="bg-emerald-50 p-3 rounded-xl text-sm text-slate-700 leading-relaxed border border-emerald-100">
                                        <p><strong>✅ 절차:</strong> EPS(고용허가제) 시스템을 통해서만 알선 및 채용 가능.</p>
                                        <p className="mt-1"><strong>⚠️ 제한:</strong> 임의로 채용하거나 근무처 변경 시 불법 고용.</p>
                                    </div>
                                </div>

                                {/* F-4 */}
                                <div className="space-y-2">
                                    <h3 className="font-bold text-orange-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                        F-4 (재외동포)
                                    </h3>
                                    <div className="bg-orange-50 p-3 rounded-xl text-sm text-slate-700 leading-relaxed border border-orange-100">
                                        <p><strong>✅ 허용 범위:</strong> 대부분의 취업 활동 허용.</p>
                                        <p className="mt-1"><strong>🚫 제한:</strong> 단순노무행위(건설현장 단순노무 등 일부 업종)는 원칙적 제한. 단, 요식업 서빙/주방보조 등은 통상 허용되는 추세이나 지역/직종별 확인 권장.</p>
                                    </div>
                                </div>

                                {/* F-2, F-5, F-6 */}
                                <div className="space-y-2">
                                    <h3 className="font-bold text-slate-600 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-slate-500"></span>
                                        F-2, F-5, F-6 (거주/영주/결혼)
                                    </h3>
                                    <div className="bg-slate-50 p-3 rounded-xl text-sm text-slate-700 leading-relaxed border border-slate-200">
                                        <p><strong>✅ 제한 없음:</strong> 내국인과 동일하게 자유로운 취업 활동 가능.</p>
                                    </div>
                                </div>

                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                                <button
                                    onClick={() => setIsVisaGuideOpen(false)}
                                    className="w-full bg-slate-200 text-slate-700 py-3 rounded-xl font-bold hover:bg-slate-300"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
