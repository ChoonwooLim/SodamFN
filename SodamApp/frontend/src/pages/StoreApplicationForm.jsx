import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ChevronLeft, Store, User, Phone, MapPin, FileText,
    Building2, Users, MessageSquare, Send, Loader2, CheckCircle2,
    CreditCard, Crown, Zap, Shield, ArrowRight, ArrowLeft,
    Sparkles, Star, Check, Info
} from 'lucide-react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const BUSINESS_TYPES = ['음식점', '카페', '소매점', '편의점', '서비스업', '기타'];
const REGIONS = ['서울', '경기', '인천', '부산', '대구', '대전', '광주', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

const PLANS = [
    {
        key: 'free', name: 'Free', price: '0', unit: '원/월',
        icon: Zap, gradient: 'from-emerald-500 to-teal-600',
        border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20',
        badge: null,
        features: ['직원 3명까지', '급여 자동계산', 'GPS 출퇴근', '기본 매출입력', '직원 전용 앱'],
    },
    {
        key: 'basic', name: 'Basic', price: '29,900', unit: '원/월',
        icon: Crown, gradient: 'from-blue-500 to-indigo-600',
        border: 'border-blue-500/30', glow: 'shadow-blue-500/20',
        badge: '인기',
        features: ['직원 10명까지', 'Free 기능 전체', '매출 통합 분석', '손익계산서', '전자 근로계약', '카드매출 자동분석'],
    },
    {
        key: 'premium', name: 'Premium', price: '59,900', unit: '원/월',
        icon: Sparkles, gradient: 'from-amber-500 to-orange-600',
        border: 'border-amber-500/30', glow: 'shadow-amber-500/20',
        badge: '최고',
        features: ['직원 50명까지', 'Basic 기능 전체', '멀티 매장 관리', 'API 연동', '커스텀 리포트', '전담 매니저 지원'],
    },
];

const STEPS = [
    { label: '요금제 선택', icon: CreditCard },
    { label: '매장 정보', icon: Store },
    { label: '대표자 정보', icon: User },
    { label: '최종 확인', icon: CheckCircle2 },
];

export default function StoreApplicationForm() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const initialPlan = searchParams.get('plan') || 'free';

    const [step, setStep] = useState(0);
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
    const [slideDir, setSlideDir] = useState('right');

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: name === 'staff_count' ? parseInt(value) || 1 : value }));
    };

    const selectPlan = (key) => {
        setFormData(prev => ({ ...prev, plan_type: key }));
    };

    const nextStep = () => {
        setSlideDir('right');
        setStep(s => Math.min(s + 1, STEPS.length - 1));
    };
    const prevStep = () => {
        setSlideDir('left');
        setStep(s => Math.max(s - 1, 0));
    };

    const canProceed = () => {
        if (step === 0) return true;
        if (step === 1) return formData.business_name.trim() !== '';
        if (step === 2) return formData.owner_name.trim() !== '' && formData.phone.trim() !== '';
        return true;
    };

    const handleSubmit = async () => {
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

    const selectedPlan = PLANS.find(p => p.key === formData.plan_type) || PLANS[0];

    /* ═══ SUCCESS SCREEN ═══ */
    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-4">
                <div className="max-w-md w-full text-center">
                    <div className="relative mx-auto mb-8">
                        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                            <CheckCircle2 size={48} className="text-emerald-400" />
                        </div>
                        <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                    </div>
                    <h1 className="text-3xl font-black mb-3">사용신청이 접수되었습니다!</h1>
                    <p className="text-slate-400 mb-2 text-lg">관리자가 매장 정보를 검토한 후 승인해 드립니다.</p>
                    <p className="text-sm text-slate-500 mb-3">승인이 완료되면 <strong className="text-amber-400">관리자 아이디</strong>와 비밀번호가 발급됩니다.</p>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-8 text-left">
                        <div className="text-xs text-slate-500 mb-2">신청 요약</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="text-slate-400">요금제</div>
                            <div className="font-bold text-amber-400">{selectedPlan.name} ({selectedPlan.price}{selectedPlan.unit})</div>
                            <div className="text-slate-400">매장명</div>
                            <div className="font-bold">{formData.business_name}</div>
                            <div className="text-slate-400">대표자</div>
                            <div className="font-bold">{formData.owner_name}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/guest')}
                        className="inline-flex items-center gap-2 bg-amber-500 text-slate-900 px-8 py-3.5 rounded-2xl font-bold hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 hover:scale-105"
                    >
                        <ChevronLeft size={18} /> Guest 대시보드로 돌아가기
                    </button>
                </div>
            </div>
        );
    }

    /* ═══ MAIN FORM ═══ */
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => navigate('/guest')} className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors">
                        <ChevronLeft size={18} /><span className="text-sm">돌아가기</span>
                    </button>
                    <div className="font-black text-lg">셈<span className="text-amber-400">하나</span> <span className="text-slate-500 font-normal text-sm">| 매장 사용신청</span></div>
                    <div className="w-20" />
                </div>
            </header>

            <main className="pt-24 pb-16 px-4 max-w-4xl mx-auto">
                {/* ═══ STEPPER ═══ */}
                <div className="mb-10">
                    <div className="flex items-center justify-between max-w-xl mx-auto relative">
                        {/* Progress Line */}
                        <div className="absolute top-5 left-[10%] right-[10%] h-0.5 bg-white/10 z-0" />
                        <div
                            className="absolute top-5 left-[10%] h-0.5 bg-gradient-to-r from-amber-500 to-amber-400 z-0 transition-all duration-500"
                            style={{ width: `${(step / (STEPS.length - 1)) * 80}%` }}
                        />
                        {STEPS.map((s, i) => {
                            const Icon = s.icon;
                            const isActive = i === step;
                            const isComplete = i < step;
                            return (
                                <div key={i} className="relative z-10 flex flex-col items-center">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete ? 'bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/30' :
                                            isActive ? 'bg-amber-500/20 border-2 border-amber-500 text-amber-400' :
                                                'bg-slate-800 border border-white/10 text-slate-500'
                                        }`}>
                                        {isComplete ? <Check size={18} strokeWidth={3} /> : <Icon size={16} />}
                                    </div>
                                    <span className={`text-[11px] mt-2 font-medium transition-colors ${isActive ? 'text-amber-400' : isComplete ? 'text-white' : 'text-slate-500'
                                        }`}>{s.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ═══ STEP CONTENT ═══ */}
                <div className="max-w-3xl mx-auto">
                    {/* STEP 0: Plan Selection */}
                    {step === 0 && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-black mb-2">요금제를 선택하세요</h2>
                                <p className="text-slate-400">매장 규모에 맞는 요금제를 선택해 주세요. 언제든 변경 가능합니다.</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                {PLANS.map(plan => {
                                    const Icon = plan.icon;
                                    const isSelected = formData.plan_type === plan.key;
                                    return (
                                        <button
                                            key={plan.key}
                                            type="button"
                                            onClick={() => selectPlan(plan.key)}
                                            className={`relative p-6 rounded-2xl text-left transition-all duration-300 hover:scale-[1.02] ${isSelected
                                                    ? `border-2 ${plan.border} bg-gradient-to-br ${plan.gradient}/10 shadow-xl ${plan.glow}`
                                                    : 'border border-white/10 bg-white/[.03] hover:bg-white/[.06]'
                                                }`}
                                        >
                                            {/* Badge */}
                                            {plan.badge && (
                                                <div className={`absolute -top-2.5 right-4 px-3 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r ${plan.gradient} text-white shadow-md`}>
                                                    {plan.badge}
                                                </div>
                                            )}

                                            {/* Selected Indicator */}
                                            <div className={`absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-amber-400 bg-amber-500' : 'border-white/20'
                                                }`}>
                                                {isSelected && <Check size={12} className="text-white" strokeWidth={3} />}
                                            </div>

                                            {/* Icon */}
                                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${plan.gradient}/20`}>
                                                <Icon size={22} className={isSelected ? 'text-white' : 'text-slate-300'} />
                                            </div>

                                            {/* Name & Price */}
                                            <div className="mb-4">
                                                <h3 className="font-bold text-lg mb-1">{plan.name}</h3>
                                                <div className="flex items-baseline gap-1">
                                                    <span className={`text-3xl font-black ${isSelected ? 'text-amber-400' : 'text-white'}`}>{plan.price}</span>
                                                    <span className="text-sm text-slate-400">{plan.unit}</span>
                                                </div>
                                            </div>

                                            {/* Features */}
                                            <ul className="space-y-2">
                                                {plan.features.map((f, i) => (
                                                    <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
                                                        <Check size={14} className={isSelected ? 'text-amber-400' : 'text-emerald-400'} />
                                                        {f}
                                                    </li>
                                                ))}
                                            </ul>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STEP 1: Business Info */}
                    {step === 1 && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-black mb-2">매장 정보를 입력하세요</h2>
                                <p className="text-slate-400">매장의 기본 정보를 입력해 주세요. <span className="text-amber-400">*</span> 표시는 필수 항목입니다.</p>
                            </div>
                            <div className="bg-white/[.03] rounded-3xl p-6 md:p-8 border border-white/10 backdrop-blur-sm space-y-5">
                                {/* Selected Plan Badge */}
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold bg-gradient-to-r ${selectedPlan.gradient}/20 border ${selectedPlan.border}`}>
                                    <selectedPlan.icon size={14} />
                                    {selectedPlan.name} 플랜 선택됨
                                </div>

                                <div>
                                    <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                        <Store size={14} className="inline mr-1.5 text-amber-400" />매장명 <span className="text-amber-400">*</span>
                                    </label>
                                    <input name="business_name" value={formData.business_name} onChange={handleChange}
                                        required
                                        className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 transition-all"
                                        placeholder="예: 소담김밥 강남점" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <Building2 size={14} className="inline mr-1.5 text-amber-400" />업종 <span className="text-amber-400">*</span>
                                        </label>
                                        <select name="business_type" value={formData.business_type} onChange={handleChange}
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500/50 [&>option]:bg-slate-800 transition-all">
                                            {BUSINESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <MapPin size={14} className="inline mr-1.5 text-amber-400" />지역 <span className="text-amber-400">*</span>
                                        </label>
                                        <select name="region" value={formData.region} onChange={handleChange}
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500/50 [&>option]:bg-slate-800 transition-all">
                                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <FileText size={14} className="inline mr-1.5 text-slate-500" />사업자등록번호
                                        </label>
                                        <input name="business_number" value={formData.business_number} onChange={handleChange}
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            placeholder="000-00-00000 (선택)" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <MapPin size={14} className="inline mr-1.5 text-slate-500" />주소
                                        </label>
                                        <input name="address" value={formData.address} onChange={handleChange}
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            placeholder="매장 주소 (선택)" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Owner Info */}
                    {step === 2 && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-black mb-2">대표자 정보를 입력하세요</h2>
                                <p className="text-slate-400">매장 대표자의 정보를 입력해 주세요.</p>
                            </div>
                            <div className="bg-white/[.03] rounded-3xl p-6 md:p-8 border border-white/10 backdrop-blur-sm space-y-5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <User size={14} className="inline mr-1.5 text-amber-400" />대표자명 <span className="text-amber-400">*</span>
                                        </label>
                                        <input name="owner_name" value={formData.owner_name} onChange={handleChange}
                                            required
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            placeholder="홍길동" />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                            <Phone size={14} className="inline mr-1.5 text-amber-400" />연락처 <span className="text-amber-400">*</span>
                                        </label>
                                        <input name="phone" value={formData.phone} onChange={handleChange}
                                            required
                                            className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                                            placeholder="010-0000-0000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                        <Users size={14} className="inline mr-1.5 text-slate-500" />예상 직원 수
                                    </label>
                                    <input name="staff_count" type="number" min="1" max="100" value={formData.staff_count} onChange={handleChange}
                                        className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white outline-none focus:ring-2 focus:ring-amber-500/50 transition-all" />
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-slate-300 block mb-1.5">
                                        <MessageSquare size={14} className="inline mr-1.5 text-slate-500" />추가 메시지
                                    </label>
                                    <textarea name="message" value={formData.message} onChange={handleChange}
                                        rows={3}
                                        className="w-full p-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-amber-500/50 resize-none transition-all"
                                        placeholder="기타 요청사항이나 질문이 있으시면 입력해 주세요 (선택)" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Review & Submit */}
                    {step === 3 && (
                        <div className="animate-fadeIn">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl md:text-3xl font-black mb-2">신청 내용을 확인하세요</h2>
                                <p className="text-slate-400">모든 정보가 올바른지 확인 후 제출해 주세요.</p>
                            </div>
                            <div className="bg-white/[.03] rounded-3xl p-6 md:p-8 border border-white/10 backdrop-blur-sm space-y-6">
                                {/* Plan Summary */}
                                <div className={`p-5 rounded-2xl bg-gradient-to-r ${selectedPlan.gradient}/10 border ${selectedPlan.border}`}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${selectedPlan.gradient}/30 flex items-center justify-center`}>
                                                <selectedPlan.icon size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg">{selectedPlan.name} 플랜</div>
                                                <div className="text-sm text-slate-400">월 {selectedPlan.price}{selectedPlan.unit}</div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={() => setStep(0)} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">변경</button>
                                    </div>
                                </div>

                                {/* Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <ReviewItem icon={Store} label="매장명" value={formData.business_name} onEdit={() => setStep(1)} />
                                    <ReviewItem icon={Building2} label="업종" value={formData.business_type} />
                                    <ReviewItem icon={MapPin} label="지역" value={formData.region} />
                                    <ReviewItem icon={FileText} label="사업자등록번호" value={formData.business_number || '미입력'} muted={!formData.business_number} />
                                    <ReviewItem icon={User} label="대표자명" value={formData.owner_name} onEdit={() => setStep(2)} />
                                    <ReviewItem icon={Phone} label="연락처" value={formData.phone} />
                                    <ReviewItem icon={Users} label="예상 직원 수" value={`${formData.staff_count}명`} />
                                    <ReviewItem icon={MapPin} label="주소" value={formData.address || '미입력'} muted={!formData.address} />
                                </div>

                                {formData.message && (
                                    <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                                        <div className="text-xs text-slate-500 mb-1">추가 메시지</div>
                                        <div className="text-sm text-slate-300">{formData.message}</div>
                                    </div>
                                )}

                                {/* Notice */}
                                <div className="flex items-start gap-3 p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                                    <Info size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                                    <div className="text-sm text-slate-400">
                                        제출 후 관리자가 매장 정보를 검토합니다. <strong className="text-amber-400">승인이 완료되면 관리자 아이디</strong>와 초기 비밀번호가 발급됩니다.
                                        일반적으로 <strong className="text-white">1~2 영업일</strong> 이내에 처리됩니다.
                                    </div>
                                </div>

                                {error && (
                                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
                                        {error}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ NAVIGATION BUTTONS ═══ */}
                    <div className="flex items-center justify-between mt-8 max-w-3xl mx-auto">
                        <button
                            type="button"
                            onClick={prevStep}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${step === 0
                                    ? 'text-slate-600 cursor-not-allowed'
                                    : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10'
                                }`}
                            disabled={step === 0}
                        >
                            <ArrowLeft size={16} /> 이전
                        </button>

                        {step < STEPS.length - 1 ? (
                            <button
                                type="button"
                                onClick={nextStep}
                                disabled={!canProceed()}
                                className="flex items-center gap-2 px-8 py-3 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                다음 <ArrowRight size={16} />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-900 rounded-xl font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                            >
                                {loading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> 사용신청 제출</>}
                            </button>
                        )}
                    </div>

                    {/* Step indicator text */}
                    <p className="text-center text-xs text-slate-600 mt-4">
                        {step + 1} / {STEPS.length} 단계
                    </p>
                </div>
            </main>

            {/* Custom animation */}
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(12px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.35s ease-out;
                }
            `}</style>
        </div>
    );
}

/* ═══ ReviewItem Component ═══ */
function ReviewItem({ icon: Icon, label, value, muted, onEdit }) {
    return (
        <div className="flex items-center gap-3 p-3.5 bg-white/5 rounded-xl border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[11px] text-slate-500">{label}</div>
                <div className={`text-sm font-medium truncate ${muted ? 'text-slate-600' : 'text-white'}`}>{value}</div>
            </div>
            {onEdit && (
                <button type="button" onClick={onEdit} className="text-[11px] text-amber-400 hover:text-amber-300 flex-shrink-0">수정</button>
            )}
        </div>
    );
}
