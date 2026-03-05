import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ChevronLeft, Store, User, Phone, MapPin, FileText,
    Building2, Users, MessageSquare, Send, Loader2, CheckCircle2,
    CreditCard, Crown, Zap
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const BUSINESS_TYPES = ['음식점', '카페', '소매점', '편의점', '서비스업', '기타'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

const PLANS = {
    free: { name: 'Free', price: '0원/월', icon: Zap, color: 'emerald', desc: '직원 3명까지 · 기본 기능' },
    basic: { name: 'Basic', price: '29,900원/월', icon: Crown, color: 'blue', desc: '직원 10명까지 · 전체 기능' },
    premium: { name: 'Premium', price: '59,900원/월', icon: Crown, color: 'amber', desc: '직원 50명까지 · 프리미엄' },
};

export default function StoreApplicationForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialPlan = searchParams.get('plan') || 'free';

    const [formData, setFormData] = useState({
        business_name: '',
        business_type: '음식점',
        owner_name: '',
        phone: '',
        address: '',
        business_number: '',
        region: '서울',
        plan_type: initialPlan,
        staff_count: 1,
        message: '',
    });
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'staff_count' ? parseInt(value) || 1 : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_URL}/api/store-applications`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSuccess(true);
        } catch (err) {
            setError(err.response?.data?.detail || '신청 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const selectedPlan = PLANS[formData.plan_type] || PLANS.free;
    const PlanIcon = selectedPlan.icon;

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} className="text-emerald-400" />
                    </div>
                    <h1 className="text-2xl font-black mb-3">사용신청이 접수되었습니다!</h1>
                    <p className="text-slate-400 mb-2">관리자가 매장 정보를 검토한 후 승인해 드립니다.</p>
                    <p className="text-sm text-slate-500 mb-8">승인이 완료되면 관리자 아이디와 비밀번호가 발급됩니다.</p>
                    <button
                        onClick={() => navigate('/guest')}
                        className="inline-flex items-center gap-2 bg-amber-500 text-slate-900 px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-all"
                    >
                        <ChevronLeft size={18} /> 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-3xl mx-auto px-4 h-16 flex items-center">
                    <button onClick={() => navigate('/guest')} className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors mr-4">
                        <ChevronLeft size={18} /> 뒤로
                    </button>
                    <div className="font-bold">매장 사용 신청</div>
                </div>
            </header>

            <main className="pt-24 pb-16 px-4 max-w-3xl mx-auto">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Plan Selection */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <CreditCard size={18} className="text-amber-400" /> 요금제 선택
                        </h2>
                        <div className="grid grid-cols-3 gap-3">
                            {Object.entries(PLANS).map(([key, plan]) => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, plan_type: key }))}
                                    className={`p-4 rounded-xl border text-center transition-all ${formData.plan_type === key
                                            ? 'border-amber-500/50 bg-amber-500/10 shadow-lg shadow-amber-500/10'
                                            : 'border-white/10 bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="font-bold text-sm">{plan.name}</div>
                                    <div className={`text-lg font-black ${formData.plan_type === key ? 'text-amber-400' : 'text-white'}`}>
                                        {plan.price}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-1">{plan.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Business Info */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <Store size={18} className="text-amber-400" /> 매장 정보
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">매장명 *</label>
                                <input name="business_name" value={formData.business_name} onChange={handleChange}
                                    required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="예: 소담김밥 강남점" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">업종 *</label>
                                    <select name="business_type" value={formData.business_type} onChange={handleChange}
                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500 [&>option]:bg-slate-800">
                                        {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">지역 *</label>
                                    <select name="region" value={formData.region} onChange={handleChange}
                                        className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500 [&>option]:bg-slate-800">
                                        {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">사업자등록번호</label>
                                <input name="business_number" value={formData.business_number} onChange={handleChange}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="000-00-00000 (선택사항)" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">주소</label>
                                <input name="address" value={formData.address} onChange={handleChange}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                    placeholder="매장 주소를 입력하세요 (선택사항)" />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <User size={18} className="text-amber-400" /> 대표자 정보
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">대표자명 *</label>
                                    <input name="owner_name" value={formData.owner_name} onChange={handleChange}
                                        required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="홍길동" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">연락처 *</label>
                                    <input name="phone" value={formData.phone} onChange={handleChange}
                                        required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500"
                                        placeholder="010-0000-0000" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">예상 직원 수</label>
                                <input name="staff_count" type="number" min="1" max="100" value={formData.staff_count} onChange={handleChange}
                                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500" />
                            </div>
                        </div>
                    </div>

                    {/* Message */}
                    <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                            <MessageSquare size={18} className="text-amber-400" /> 추가 메시지
                        </h2>
                        <textarea name="message" value={formData.message} onChange={handleChange}
                            rows={3} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                            placeholder="기타 요청사항이나 질문이 있으시면 입력해 주세요 (선택사항)" />
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-amber-500 text-slate-900 rounded-2xl font-bold text-lg hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : <><Send size={18} /> 사용신청 제출</>}
                    </button>

                    <p className="text-xs text-center text-slate-500">
                        제출 후 관리자가 매장 정보를 검토합니다. 승인 시 관리자 아이디가 발급됩니다.
                    </p>
                </form>
            </main>
        </div>
    );
}
