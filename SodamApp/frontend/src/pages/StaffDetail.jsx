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
        doc_bank_copy: false
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
    const [currentBudgetMonth, setCurrentBudgetMonth] = useState(new Date().toISOString().slice(0, 7));

    // New Account Form
    const [accountForm, setAccountForm] = useState({ username: '', password: '', grade: 'normal' });
    // New Contract Form
    const [contractForm, setContractForm] = useState({
        title: '표준근로계약서',
        content: `표준근로계약서

임춘우(이하 "사업주"라 함)와 {name}(이하 "근로자"라 함)은(는) 다음과 같이
근로계약을 체결한다.

1. 근로계약기간 : {start_date}부터        년    월      일까지
2. 근 무 장 소 : 소담김밥 건대본점 매장
3. 업무의 내용 : 주방업무( )/ 카운터업무( ) / 마감 청소업무(   )
4. 소정근로시간 :         시   분부터     시   분까지 (휴게시간 : 시 분 ~     시   분)
5. 근무일/휴일 : 매주 일 근무, 주휴일 매주 요일
6. 임 금
- 월(일, 시)급 : {wage} 원
- 상여금 : 있음(     ), 없음(     )
- 기타 급여(제 수당 등) : 있음( 주휴수당),  없음(        )
- 지급일 : 매월(매주 또는 매일) 말일(휴일의 경우는 전일 지급)
- 지급 방법 : 근로자에게 직접 지급(      ), 예금통장에 입금 (       )
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

(근로자) 주 소 :                                                                                연 락 처 : {phone}
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
                    staff_id: id,
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
            fetchStaffDetail();
        } catch (error) {
            console.error("Failed to delete contract", error);
            alert("삭제 실패");
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
        try {
            const res = await api.get('/settings/contract_template');
            if (res.data && res.data.value) {
                setContractForm(prev => ({ ...prev, content: res.data.value }));
            }
        } catch (error) {
            console.error("Failed to fetch contract template", error);
        }
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
                            </div>
                        </div>

                        {/* Login Account Section */}
                        <div className="mt-6 pt-6 border-t border-slate-100">
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

                    {/* 3. Work Schedule */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6 border-b pb-4">
                            <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Calendar size={24} /></div>
                            <h2 className="text-lg font-bold text-slate-800">근무 시간 및 일정</h2>
                        </div>
                        <textarea
                            name="work_schedule"
                            value={formData.work_schedule || ''}
                            onChange={handleChange}
                            placeholder="예: 월-금 09:00 ~ 18:00 (휴게시간 1시간)"
                            className="w-full h-32 p-3 rounded border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        ></textarea>
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
                </div>

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
                    )}
                </div>
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
        </div >
    );
}
