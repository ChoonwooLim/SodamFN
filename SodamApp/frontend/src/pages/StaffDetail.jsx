import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, FileText, User, CreditCard, Calendar, CheckSquare, Upload, Eye, Printer } from 'lucide-react';
import api from '../api';
import PayrollStatement from '../components/PayrollStatement';

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
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState("");
    const [selectedPayroll, setSelectedPayroll] = useState(null); // Selected payroll for statement modal

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

    const fetchStaffDetail = async () => {
        try {
            const res = await api.get(`/hr/staff/${id}`);
            if (res.data.status === 'success') {
                const data = res.data.data;
                // Format phone on load
                if (data.phone) data.phone = formatPhoneNumber(data.phone);
                setFormData(data);
                setDocuments(res.data.documents || []);
                setPayrolls(res.data.payrolls || []);
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
                                        value={formData.hourly_wage ? formData.hourly_wage.toLocaleString() : ''}
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
                                        value={formData.monthly_salary ? formData.monthly_salary.toLocaleString() : ''}
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
                </div>

                {/* 5. Payroll History (Full Width) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3 mb-6 border-b pb-4">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><CreditCard size={24} /></div>
                        <h2 className="text-lg font-bold text-slate-800">월별 급여 지급 내역</h2>
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
                                            <td className="p-3 text-right text-slate-600">{pay.base_pay.toLocaleString()}원</td>
                                            <td className="p-3 text-right text-slate-600">{pay.bonus.toLocaleString()}원</td>
                                            <td className="p-3 text-right text-red-400">-{pay.deductions.toLocaleString()}원</td>
                                            <td className="p-3 text-right font-bold text-blue-600">{pay.total_pay.toLocaleString()}원</td>
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
            </div>

            {/* Payroll Statement Modal */}
            {selectedPayroll && (
                <PayrollStatement
                    staff={formData}
                    payroll={selectedPayroll}
                    onClose={() => setSelectedPayroll(null)}
                />
            )}
        </div>
    );
}
