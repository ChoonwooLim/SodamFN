import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Save, FileText, CreditCard, Calendar, Upload } from 'lucide-react';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import BasicInfoTab from './BasicInfoTab';
import AttendanceTab from './AttendanceTab';
import PayrollTab from './PayrollTab';
import ContractTab from './ContractTab';
import DocumentTab from './DocumentTab';

const TABS = [
    { key: 'basic', label: '기본정보', icon: User },
    { key: 'attendance', label: '근태관리', icon: Calendar },
    { key: 'payroll', label: '급여내역', icon: CreditCard },
    { key: 'contract', label: '전자계약', icon: FileText },
    { key: 'document', label: '서류관리', icon: Upload },
];

export default function StaffDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('basic');

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
        insurance_base_salary: 0,
        np_exempt: false,
        durunnuri_support: false,
        tax_support_enabled: false,
        birth_date: ''
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

    const [editingContractId, setEditingContractId] = useState(null);

    const [isBizAccountModalOpen, setIsBizAccountModalOpen] = useState(false);
    const [bizAccountForm, setBizAccountForm] = useState({ bank: '', number: '', holder: '' });

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

    const fetchStaffDetail = async (autoSelectMonth = null) => {
        try {
            const res = await api.get(`/hr/staff/${id}`);
            if (res.data.status === 'success') {
                const data = res.data.data;
                // Format phone on load
                if (data.phone) data.phone = formatPhoneNumber(data.phone);

                // Merge with existing formData to preserve fields not in the staff object
                setFormData(prev => ({ ...prev, ...data }));

                const payrollList = res.data.payrolls || [];
                setDocuments(res.data.documents || []);
                setPayrolls(payrollList);
                setContracts(res.data.contracts || []);
                setUser(res.data.user || null);

                // If a month was specified, auto-select matching payroll from DB list
                if (autoSelectMonth) {
                    const match = payrollList.find(p => p.month === autoSelectMonth);
                    if (match) setSelectedPayroll(match);
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
        if (name === 'hourly_wage' || name === 'monthly_salary' || name === 'insurance_base_salary' || name === 'dependents_count' || name === 'children_count') {
            newValue = value.replace(/,/g, '');
            if (isNaN(newValue) && newValue !== '-') return;
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
                timeout: 60000, // 60s timeout for large files
            });
            // Refresh data to show new file
            await fetchStaffDetail();
            setMsg("파일이 업로드되었습니다.");
            setTimeout(() => setMsg(""), 3000);
        } catch (error) {
            console.error("Upload failed", error);
            const detail = error.response?.data?.detail || error.message || '알 수 없는 오류';
            alert(`파일 업로드 실패: ${detail}`);
        } finally {
            e.target.value = null; // Reset file input so the same file can be uploaded again
        }
    };

    const handleDeleteDocument = async (docId, docType) => {
        if (!window.confirm('이 서류를 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/hr/staff/${id}/document/${docId}`);
            fetchStaffDetail();
            setMsg('서류가 삭제되었습니다.');
            setTimeout(() => setMsg(''), 3000);
        } catch (error) {
            console.error('Delete failed', error);
            alert('서류 삭제 실패');
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

    const handleCreateContract = async () => {
        if (!typeof contractForm.content === 'string' || contractForm.content.trim().length === 0) {
            alert("계약서 내용이 비어있습니다.");
            return;
        }

        if (!contractForm.title || !contractForm.content) return alert("제목과 내용을 입력해주세요.");
        try {
            const resp = await api.post('/contracts/', {
                staff_id: parseInt(id),
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
            const resp = await api.post(`/contracts/${contractId}/send`);
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
                alert(resp.data.message || "이체를 완료할 수 없습니다.");
            }
        } catch (error) {
            console.error(error);
            alert(error.response?.data?.message || error.response?.data?.detail || "이체 실행 중 오류가 발생했습니다.");
        }
    };

    const handleDeleteContract = async (contractId) => {
        if (!window.confirm("정말 삭제하시겠습니까?")) return;
        try {
            await api.delete(`/contracts/${contractId}`);
            setContracts(prev => prev.filter(c => c.id !== contractId));
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
        setEditingContractId(null);
        let template = contractForm.content;

        try {
            const res = await api.get('/settings/contract_template');
            if (res.data && res.data.value) {
                template = res.data.value;
            }
        } catch (error) {
            console.error("Failed to fetch contract template", error);
        }

        // --- Auto-Fill Logic ---
        const wage = formData.contract_type === '정규직'
            ? formData.monthly_salary
            : formData.hourly_wage;
        const formattedWage = wage ? formatNumber(wage) : '';

        const bonusInfo = formData.bonus_enabled
            ? `있음 (${formData.bonus_amount || ''})`
            : '없음';

        const replacements = {
            '{name}': formData.name || '',
            '{phone}': formData.phone || '',
            '{address}': formData.address || '____________________',
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

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-8 pb-32">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <User size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">직원 상세</h1>
                            <p className="text-xs text-slate-400 mt-0.5">{formData.name} 인사기록카드</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSave}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-slate-800 shadow-md transition-all active:scale-95"
                    >
                        <Save size={20} /> 저장하기
                    </button>
                </header>

                {msg && (
                    <div className="bg-green-100 text-green-700 p-4 rounded-xl mb-6 text-center font-bold animate-pulse">
                        {msg}
                    </div>
                )}

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-6 bg-white p-1.5 rounded-2xl shadow-sm border border-slate-100 overflow-x-auto">
                    {TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                    isActive
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                {activeTab === 'basic' && (
                    <BasicInfoTab
                        formData={formData}
                        handleChange={handleChange}
                        setFormData={setFormData}
                        user={user}
                        id={id}
                        isAccountModalOpen={isAccountModalOpen}
                        setIsAccountModalOpen={setIsAccountModalOpen}
                        accountForm={accountForm}
                        setAccountForm={setAccountForm}
                        handleCreateAccount={handleCreateAccount}
                        handleGradeUpdate={handleGradeUpdate}
                        isVisaGuideOpen={isVisaGuideOpen}
                        setIsVisaGuideOpen={setIsVisaGuideOpen}
                    />
                )}

                {activeTab === 'attendance' && (
                    <AttendanceTab
                        id={id}
                        formData={formData}
                        currentBudgetMonth={currentBudgetMonth}
                        setCurrentBudgetMonth={setCurrentBudgetMonth}
                        isAttendanceModalOpen={isAttendanceModalOpen}
                        setIsAttendanceModalOpen={setIsAttendanceModalOpen}
                        handleSendAttendanceRequest={handleSendAttendanceRequest}
                        fetchStaffDetail={fetchStaffDetail}
                    />
                )}

                {activeTab === 'payroll' && (
                    <PayrollTab
                        formData={formData}
                        payrolls={payrolls}
                        selectedPayroll={selectedPayroll}
                        setSelectedPayroll={setSelectedPayroll}
                        handleSendPayrollStatement={handleSendPayrollStatement}
                        handleExecuteTransfer={handleExecuteTransfer}
                        isBizAccountModalOpen={isBizAccountModalOpen}
                        setIsBizAccountModalOpen={setIsBizAccountModalOpen}
                        bizAccountForm={bizAccountForm}
                        setBizAccountForm={setBizAccountForm}
                        fetchBizAccount={fetchBizAccount}
                        handleUpdateBizAccount={handleUpdateBizAccount}
                    />
                )}

                {activeTab === 'contract' && (
                    <ContractTab
                        formData={formData}
                        handleChange={handleChange}
                        contracts={contracts}
                        contractForm={contractForm}
                        setContractForm={setContractForm}
                        isContractModalOpen={isContractModalOpen}
                        setIsContractModalOpen={setIsContractModalOpen}
                        handleOpenContractModal={handleOpenContractModal}
                        handleCreateContract={handleCreateContract}
                        handleSendContractAlimTalk={handleSendContractAlimTalk}
                        handleDeleteContract={handleDeleteContract}
                        handleEditContract={handleEditContract}
                        editingContractId={editingContractId}
                    />
                )}

                {activeTab === 'document' && (
                    <DocumentTab
                        documents={documents}
                        handleFileUpload={handleFileUpload}
                        handleDeleteDocument={handleDeleteDocument}
                    />
                )}
            </div>
        </div>
    );
}
