import { useState, useEffect } from 'react';
import { X, Save, RefreshCw } from 'lucide-react';
import api from '../api';

export default function StaffAddModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        name: '',
        role: 'Staff',
        hourly_wage: 9860,
        start_date: new Date().toISOString().slice(0, 10),
        bank_account: '',
        email: ''
    });
    const [createAccount, setCreateAccount] = useState(true);
    const [accountForm, setAccountForm] = useState({
        username: '',
        password: '',
        grade: '정직원',
    });
    const [usernameLoading, setUsernameLoading] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchSuggestedUsername = async () => {
        try {
            setUsernameLoading(true);
            const res = await api.get('/hr/staff/next-username');
            if (res.data.status === 'success') {
                setAccountForm(prev => ({ ...prev, username: res.data.data.username }));
            }
        } catch (e) {
            console.error('next-username 추천 실패:', e);
        } finally {
            setUsernameLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSuggestedUsername();
            setFormData({
                name: '',
                role: 'Staff',
                hourly_wage: 9860,
                start_date: new Date().toISOString().slice(0, 10),
                bank_account: '',
                email: ''
            });
            setAccountForm({ username: '', password: '', grade: '정직원' });
            setCreateAccount(true);
        }
    }, [isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'hourly_wage' ? Number(value.replace(/,/g, '')) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.role) return alert("필수 항목을 입력해주세요.");
        if (createAccount && !accountForm.password) return alert("로그인 계정 비밀번호를 입력해주세요.");

        try {
            setLoading(true);
            const payload = {
                ...formData,
                auto_create_account: createAccount,
                account_username: createAccount ? accountForm.username : null,
                account_password: createAccount ? accountForm.password : null,
                account_grade: accountForm.grade,
            };
            const response = await api.post('/hr/staff', payload);
            if (response.data.status === 'success') {
                if (response.data.account) {
                    alert(`직원 등록 완료\n로그인 ID: ${response.data.account.username}`);
                }
                onSuccess();
                onClose();
            }
        } catch (error) {
            console.error("Error creating staff:", error);
            const detail = error?.response?.data?.detail || "직원 등록에 실패했습니다.";
            alert(detail);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-slate-900">신규 직원 등록</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">성명 *</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            placeholder="이름 입력"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">직책 / 역할 *</label>
                            <input
                                type="text"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                required
                                placeholder="예: 매니저, 알바"
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">시급 *</label>
                            <input
                                type="text"
                                name="hourly_wage"
                                value={formData.hourly_wage.toLocaleString()}
                                onChange={handleChange}
                                required
                                className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-right"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">입사일</label>
                        <input
                            type="date"
                            name="start_date"
                            value={formData.start_date}
                            onChange={handleChange}
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">이메일 주소 (선택)</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="example@email.com"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">급여 계좌 (선택)</label>
                        <input
                            type="text"
                            name="bank_account"
                            value={formData.bank_account}
                            onChange={handleChange}
                            placeholder="은행명 계좌번호 예금주"
                            className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                    </div>

                    {/* ── 로그인 계정 동시 생성 섹션 ── */}
                    <div className="border-t pt-4">
                        <label className="flex items-center gap-2 cursor-pointer mb-3">
                            <input
                                type="checkbox"
                                checked={createAccount}
                                onChange={(e) => setCreateAccount(e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-sm font-bold text-slate-800">로그인 계정 함께 생성</span>
                        </label>
                        {createAccount && (
                            <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">아이디 (자동 추천)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={accountForm.username}
                                            onChange={(e) => setAccountForm(prev => ({ ...prev, username: e.target.value }))}
                                            placeholder={usernameLoading ? "추천 중..." : "sodam001"}
                                            className="flex-1 p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-mono text-sm"
                                        />
                                        <button
                                            type="button"
                                            onClick={fetchSuggestedUsername}
                                            disabled={usernameLoading}
                                            className="px-3 rounded-xl border border-slate-200 hover:bg-white text-slate-500 transition-all"
                                            title="다음 추천 ID 새로고침"
                                        >
                                            <RefreshCw size={16} className={usernameLoading ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1">현재 사업장 패턴에 맞춰 자동 추천됩니다. 직접 수정 가능.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">비밀번호 *</label>
                                    <input
                                        type="text"
                                        value={accountForm.password}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder="직원에게 알려줄 초기 비밀번호"
                                        required={createAccount}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">등급</label>
                                    <select
                                        value={accountForm.grade}
                                        onChange={(e) => setAccountForm(prev => ({ ...prev, grade: e.target.value }))}
                                        className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                                    >
                                        <option value="정직원">정직원</option>
                                        <option value="아르바이트">아르바이트</option>
                                        <option value="admin">매니저(admin)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 p-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 p-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? "등록 중..." : <><Save size={18} /> 저장하기</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
