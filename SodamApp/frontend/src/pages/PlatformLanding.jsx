import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Shield, BarChart3, Users, CreditCard, Store, ArrowRight, ArrowDown,
    Calculator, PieChart, Clock, FileText, Receipt, Smartphone,
    UserPlus, CheckCircle2, Star, ChevronDown, Menu, X, Lock, Globe,
    Zap, HeartHandshake, Award, LogIn, Building2, Send, Mail, Phone,
    FileCheck, MessageSquare
} from 'lucide-react';

/* ═══════════════════════════════════════
   Animation variants
═══════════════════════════════════════ */
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' },
    }),
};

/* ═══════════════════════════════════════
   Static data
═══════════════════════════════════════ */
const FEATURES = [
    { icon: Calculator, title: '급여 자동계산', desc: '4대보험, 소득세, 주휴수당까지 2026년 기준 자동 계산. 세무사 수준의 정확도로 급여명세서를 생성합니다.', color: 'text-blue-400', bg: 'from-blue-500/20 to-blue-600/5' },
    { icon: BarChart3, title: '매출 통합 분석', desc: '현금·카드·배달앱 매출을 하나로. 일별·월별·카테고리별 매출 추이를 실시간으로 파악합니다.', color: 'text-emerald-400', bg: 'from-emerald-500/20 to-emerald-600/5' },
    { icon: PieChart, title: '손익계산서', desc: '매출에서 인건비·재료비·임대료까지 자동 집계하여 월별 손익을 한눈에 보여줍니다.', color: 'text-purple-400', bg: 'from-purple-500/20 to-purple-600/5' },
    { icon: Clock, title: 'GPS 출퇴근', desc: 'GPS 기반 출퇴근 체크와 QR 스캔 방식을 동시 지원. 근무 시간이 자동 기록됩니다.', color: 'text-amber-400', bg: 'from-amber-500/20 to-amber-600/5' },
    { icon: FileText, title: '전자 근로계약', desc: '모바일에서 전자서명으로 근로계약서를 체결. 법적 효력이 있는 PDF를 자동 생성합니다.', color: 'text-rose-400', bg: 'from-rose-500/20 to-rose-600/5' },
    { icon: Receipt, title: '지출 관리', desc: '영수증 촬영만으로 자동 분류. 거래처별·카테고리별 지출을 체계적으로 관리합니다.', color: 'text-cyan-400', bg: 'from-cyan-500/20 to-cyan-600/5' },
    { icon: CreditCard, title: '급여 이체', desc: '계산된 급여를 원클릭으로 일괄 이체. 이체 내역이 자동으로 기록됩니다.', color: 'text-indigo-400', bg: 'from-indigo-500/20 to-indigo-600/5' },
    { icon: Store, title: '멀티 매장', desc: '여러 매장을 하나의 대시보드에서 통합 관리. 매장별 성과를 비교 분석합니다.', color: 'text-teal-400', bg: 'from-teal-500/20 to-teal-600/5' },
    { icon: Smartphone, title: '직원 전용 앱', desc: '직원이 스마트폰에서 출퇴근, 급여확인, 계약서 열람, 건의사항 제출이 가능합니다.', color: 'text-orange-400', bg: 'from-orange-500/20 to-orange-600/5' },
    { icon: Shield, title: '역할별 권한 관리', desc: 'SuperAdmin, Admin, Staff, Guest 4단계 역할 체계. 역할에 따라 메뉴와 기능 접근이 자동으로 제어됩니다.', color: 'text-violet-400', bg: 'from-violet-500/20 to-violet-600/5' },
    { icon: FileCheck, title: '매장 사용신청', desc: '간편 신청 폼으로 무료/유료 사용을 신청하면 관리자가 검토 후 매장을 개설하고 관리자 계정을 발급합니다.', color: 'text-lime-400', bg: 'from-lime-500/20 to-lime-600/5' },
];

const PLANS = [
    {
        name: 'Free', price: '0', period: '원/월', color: 'slate',
        desc: '소규모 매장의 첫 시작',
        features: ['직원 3명까지', '급여 자동계산', 'GPS 출퇴근 관리', '기본 매출 입력', '직원 앱 제공'],
        limits: ['매출분석 미포함', '손익계산서 미포함'],
    },
    {
        name: 'Basic', price: '29,900', period: '원/월', color: 'blue', popular: true,
        desc: '성장하는 매장을 위한 추천 플랜',
        features: ['직원 10명까지', '급여 자동계산 + 이체', 'GPS 출퇴근 + QR체크인', '매출/지출 통합 관리', '카드매출 자동 분석', '월별 손익계산서', '전자 근로계약', '거래처 관리'],
        limits: [],
    },
    {
        name: 'Premium', price: '59,900', period: '원/월', color: 'amber',
        desc: '다점포 사장님을 위한 프리미엄',
        features: ['직원 50명까지', 'Basic 전체 기능 포함', '멀티 매장 통합 관리', '재고/레시피 관리', 'API 연동 (POS/배달앱)', '전담 고객지원', '커스텀 리포트', '데이터 백업/복원'],
        limits: [],
    },
];

const FAQS = [
    { q: '셈하나는 어떤 업종에서 사용할 수 있나요?', a: '음식점, 카페, 소매점, 서비스업 등 직원을 고용하는 모든 소상공인 업종에서 사용할 수 있습니다. 업종별 맞춤 설정을 제공합니다.' },
    { q: '기존 데이터를 옮길 수 있나요?', a: '네, 엑셀 파일이나 기존 급여 데이터를 업로드하면 자동으로 변환하여 가져올 수 있습니다. 마이그레이션 지원도 제공합니다.' },
    { q: '급여 계산이 정확한가요?', a: '2026년 최신 세법과 4대보험 요율을 반영하여 세무사 수준의 정확도로 계산합니다. 소득세 간이세액표, 고용보험, 국민연금, 건강보험, 장기요양보험을 모두 포함합니다.' },
    { q: '직원도 사용할 수 있나요?', a: '네, 직원 전용 앱을 통해 출퇴근 체크, 급여명세서 확인, 근로계약서 열람, 건의사항 제출이 가능합니다. 별도 앱 설치 없이 웹 브라우저에서 사용합니다.' },
    { q: '데이터 보안은 안전한가요?', a: 'SSL 암호화 통신, JWT 인증, 비밀번호 해싱 등 엔터프라이즈급 보안을 적용하고 있습니다. 모든 데이터는 안전한 클라우드 서버에 저장됩니다.' },
    { q: '무료 플랜에서 유료로 업그레이드하면 데이터가 유지되나요?', a: '네, 플랜 업그레이드 시 모든 기존 데이터가 그대로 유지됩니다. 언제든지 플랜을 변경할 수 있습니다.' },
    { q: '해지하면 위약금이 있나요?', a: '아니요, 월 단위 구독이므로 언제든지 해지할 수 있으며 위약금은 없습니다.' },
    { q: '전화 상담이 가능한가요?', a: '평일 09:00~18:00 전화 상담을 운영합니다. Premium 플랜은 전담 매니저가 배정됩니다.' },
    { q: '회원가입 후 바로 사용할 수 있나요?', a: '가입 후 Guest 계정으로 기능을 미리 확인한 뒤, 매장 사용신청을 제출합니다. 관리자가 승인하면 매장 관리자 아이디가 발급되어 모든 기능을 사용할 수 있습니다.' },
    { q: '역할(권한)은 어떻게 나뉘나요?', a: 'SuperAdmin(플랫폼 총괄), Admin(매장 관리자), Staff(매장 직원), Guest(미등록 가입자) 4단계로 나뉩니다. 각 역할에 따라 접근 가능한 메뉴와 기능이 자동 제어됩니다.' },
    { q: '매장 사용신청은 어떻게 하나요?', a: '회원가입 후 Guest 대시보드에서 "무료 사용 신청" 또는 "유료 사용 신청" 버튼을 눌러 매장명, 업종, 대표자 정보를 입력하면 됩니다. 관리자가 매장 상황을 검토한 후 승인해 드립니다.' },
    { q: 'Staff(직원)은 어떻게 접근하나요?', a: '매장 관리자(Admin)가 직원을 등록하면 Staff 전용 모바일 앱을 통해 출퇴근 체크, 급여확인, 계약서 열람이 가능합니다. Staff는 관리 페이지에는 접근할 수 없습니다.' },
];

const STEPS = [
    { num: '01', title: '회원가입', desc: '이메일과 비밀번호로 간편하게 가입하세요. 자동으로 Guest 계정이 생성됩니다.', icon: UserPlus },
    { num: '02', title: 'Guest 입장', desc: 'Guest 대시보드에서 셈하나의 모든 기능을 미리 확인하고 요금제를 비교하세요.', icon: Globe },
    { num: '03', title: '매장 사용신청', desc: '무료 또는 유료 사용을 선택하고 매장 정보를 간단히 입력하여 신청합니다.', icon: FileCheck },
    { num: '04', title: '관리자 승인', desc: '관리자가 매장 정보를 검토한 후 승인하면 매장 관리자 아이디가 발급됩니다.', icon: Shield },
    { num: '05', title: '바로 사용', desc: '발급된 아이디로 로그인하면 급여계산, 출퇴근, 매출분석 등 모든 기능을 사용합니다.', icon: Zap },
];

const TESTIMONIALS = [
    { name: '김사장님', biz: '한식당 운영', text: '매달 세무사에게 맡기던 급여 계산을 이제 직접 합니다. 정확도도 완벽하고 시간도 절약됩니다.', rating: 5 },
    { name: '이대표님', biz: '카페 3개 운영', text: '3개 매장 직원 관리가 한 화면에서 됩니다. 매장별 손익까지 파악되니 경영 판단이 쉬워졌어요.', rating: 5 },
    { name: '박점장님', biz: '편의점 운영', text: '직원들이 앱으로 출퇴근하고 급여를 확인할 수 있어서 전화 문의가 거의 없어졌어요.', rating: 5 },
];

/* ═══════════════════════════════════════
   Component
═══════════════════════════════════════ */
export default function PlatformLandingPage() {
    const [openFaq, setOpenFaq] = useState(null);
    const [contactForm, setContactForm] = useState({ name: '', email: '', phone: '', message: '' });
    const [contactSent, setContactSent] = useState(false);
    const [mobileMenu, setMobileMenu] = useState(false);

    const featuresRef = useRef(null);
    const pricingRef = useRef(null);
    const faqRef = useRef(null);
    const contactRef = useRef(null);
    const guideRef = useRef(null);

    const scrollTo = (ref) => {
        setMobileMenu(false);
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleContactSubmit = (e) => {
        e.preventDefault();
        // In production, this would send to an API
        setContactSent(true);
        setTimeout(() => setContactSent(false), 5000);
        setContactForm({ name: '', email: '', phone: '', message: '' });
    };

    const NAV_ITEMS = [
        { label: '기능소개', ref: featuresRef },
        { label: '요금제', ref: pricingRef },
        { label: '가입안내', ref: guideRef },
        { label: 'FAQ', ref: faqRef },
        { label: '문의하기', ref: contactRef },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">

            {/* ═══════════════════════════════════
                STICKY NAV
            ═══════════════════════════════════ */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="font-black text-lg">
                        셈<span className="text-amber-400">하나</span>
                    </div>
                    {/* Desktop */}
                    <div className="hidden md:flex items-center gap-6">
                        {NAV_ITEMS.map(item => (
                            <button key={item.label} onClick={() => scrollTo(item.ref)} className="text-sm text-slate-400 hover:text-white transition-colors">{item.label}</button>
                        ))}
                        <Link to="/login" className="text-sm text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1"><LogIn size={14} /> 로그인</Link>
                        <Link to="/signup" className="bg-amber-500 text-slate-900 px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-400 transition-all">무료 시작</Link>
                    </div>
                    {/* Mobile */}
                    <button onClick={() => setMobileMenu(!mobileMenu)} className="md:hidden p-2">
                        {mobileMenu ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
                {/* Mobile Menu */}
                {mobileMenu && (
                    <div className="md:hidden bg-slate-800/95 backdrop-blur-xl border-t border-white/5 px-4 py-4 space-y-3">
                        {NAV_ITEMS.map(item => (
                            <button key={item.label} onClick={() => scrollTo(item.ref)} className="block w-full text-left text-sm text-slate-300 py-2">{item.label}</button>
                        ))}
                        <div className="flex gap-2 pt-2 border-t border-white/10">
                            <Link to="/login" className="flex-1 text-center py-2.5 bg-white/10 rounded-xl text-sm font-bold">로그인</Link>
                            <Link to="/signup" className="flex-1 text-center py-2.5 bg-amber-500 text-slate-900 rounded-xl text-sm font-bold">무료 시작</Link>
                        </div>
                    </div>
                )}
            </nav>

            {/* ═══════════════════════════════════
                1. HERO
            ═══════════════════════════════════ */}
            <section className="relative min-h-screen flex items-center justify-center px-4 pt-16">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(245,158,11,0.12) 0%, transparent 50%), radial-gradient(circle at 80% 60%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 50% 80%, rgba(16,185,129,0.06) 0%, transparent 40%)',
                }} />
                <motion.div className="relative z-10 text-center max-w-5xl mx-auto"
                    initial="hidden" animate="visible"
                    variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.15 } } }}
                >
                    <motion.div variants={fadeUp}
                        className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-8 border border-white/10"
                    >
                        <Zap size={14} className="text-amber-400" />
                        소상공인을 위한 올인원 매장 관리 플랫폼
                    </motion.div>

                    <motion.h1 variants={fadeUp} className="text-5xl md:text-7xl font-black mb-6 leading-tight">
                        셈<span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">하나</span>
                        <span className="text-white/20 mx-3">|</span>
                        <span className="text-white/80">SEM</span><span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">HANA</span>
                    </motion.h1>

                    <motion.p variants={fadeUp} className="text-lg md:text-2xl text-slate-300 mb-4 leading-relaxed">
                        급여, 매출, 손익, 출퇴근을 <span className="text-white font-bold">하나</span>로 관리하세요
                    </motion.p>
                    <motion.p variants={fadeUp} className="text-sm md:text-base text-slate-500 mb-10 max-w-2xl mx-auto">
                        세무사 수준의 급여계산, 실시간 매출분석, GPS 출퇴근, 전자계약까지.<br className="hidden md:block" />
                        매달 22만원 세무사 비용을 절약하고, 매장 운영에만 집중하세요.
                    </motion.p>

                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105">
                            <UserPlus size={20} /> 무료로 시작하기
                        </Link>
                        <button onClick={() => scrollTo(featuresRef)} className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 transition-all">
                            자세히 알아보기 <ArrowDown size={18} />
                        </button>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div variants={fadeUp} className="mt-16 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5"><Lock size={14} className="text-emerald-500" /> SSL 암호화</div>
                        <div className="flex items-center gap-1.5"><Shield size={14} className="text-blue-500" /> 기업급 보안</div>
                        <div className="flex items-center gap-1.5"><Award size={14} className="text-amber-500" /> 2026 세법 반영</div>
                        <div className="flex items-center gap-1.5"><Globe size={14} className="text-purple-500" /> 클라우드 기반</div>
                    </motion.div>
                </motion.div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-slate-500">
                    <ChevronDown size={24} />
                </div>
            </section>

            {/* ═══════════════════════════════════
                2. STATS BAR
            ═══════════════════════════════════ */}
            <section className="py-12 border-y border-white/5 bg-white/[.02]">
                <div className="max-w-6xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                    {[
                        { value: '9+', label: '핵심 기능', icon: Zap },
                        { value: '100%', label: '세법 정확도', icon: Calculator },
                        { value: '24/7', label: '클라우드 접속', icon: Globe },
                        { value: '0원', label: '초기 비용', icon: HeartHandshake },
                    ].map((stat, i) => {
                        const Icon = stat.icon;
                        return (
                            <motion.div key={i} initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}>
                                <Icon size={20} className="text-amber-400 mx-auto mb-2" />
                                <div className="text-2xl md:text-3xl font-black">{stat.value}</div>
                                <div className="text-xs text-slate-400 mt-1">{stat.label}</div>
                            </motion.div>
                        );
                    })}
                </div>
            </section>

            {/* ═══════════════════════════════════
                3. FEATURES
            ═══════════════════════════════════ */}
            <section ref={featuresRef} className="py-24 px-4 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">FEATURES</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">매장 운영에 필요한 <span className="text-amber-400">모든 것</span></h2>
                        <p className="text-slate-400 text-lg max-w-2xl mx-auto">엑셀과 수기 관리는 이제 그만. 하나의 플랫폼으로 모든 업무를 디지털화하세요.</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {FEATURES.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <motion.div key={f.title}
                                    className={`bg-gradient-to-br ${f.bg} backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-amber-500/30 transition-all hover:scale-[1.02] group`}
                                    initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                                >
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="p-2.5 bg-white/10 rounded-xl group-hover:bg-white/20 transition-colors">
                                            <Icon size={22} className={f.color} />
                                        </div>
                                        <h3 className="text-lg font-bold">{f.title}</h3>
                                    </div>
                                    <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════
                4. HOW IT WORKS (가입안내)
            ═══════════════════════════════════ */}
            <section ref={guideRef} className="py-24 px-4 bg-white/[.02] border-y border-white/5 scroll-mt-20">
                <div className="max-w-5xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">HOW TO START</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">가입부터 사용까지 <span className="text-amber-400">5단계</span></h2>
                        <p className="text-slate-400 text-lg">복잡한 설정 없이 5분이면 시작할 수 있습니다</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
                        {/* Connection line */}
                        <div className="hidden md:block absolute top-16 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-amber-500/50 via-amber-400/30 to-amber-500/50" />
                        {STEPS.map((step, i) => {
                            const Icon = step.icon;
                            return (
                                <motion.div key={step.num} className="text-center relative"
                                    initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                                >
                                    <div className="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30 relative z-10">
                                        <Icon size={24} className="text-slate-900" />
                                    </div>
                                    <div className="text-amber-400 text-xs font-bold mb-1">STEP {step.num}</div>
                                    <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                                    <p className="text-slate-400 text-sm">{step.desc}</p>
                                </motion.div>
                            );
                        })}
                    </div>

                    <motion.div className="mt-12 text-center" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <Link to="/signup" className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105">
                            <UserPlus size={20} /> 지금 무료로 가입하기
                        </Link>
                        <p className="text-xs text-slate-500 mt-3">신용카드 없이 바로 시작 • 언제든 해지 가능</p>
                    </motion.div>
                </div>
            </section>

            {/* ═══════════════════════════════════
                5. PRICING
            ═══════════════════════════════════ */}
            <section ref={pricingRef} className="py-24 px-4 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">PRICING</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">합리적인 <span className="text-amber-400">요금제</span></h2>
                        <p className="text-slate-400 text-lg">매장 규모에 맞게 선택하세요. 모든 플랜 30일 무료 체험 가능!</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map((plan, i) => (
                            <motion.div key={plan.name}
                                className={`relative bg-white/5 backdrop-blur-sm rounded-3xl p-7 border transition-all hover:scale-[1.02] ${plan.popular ? 'border-amber-500/50 shadow-xl shadow-amber-500/10 md:scale-105' : 'border-white/10'}`}
                                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-900 text-xs font-bold px-5 py-1.5 rounded-full shadow-lg">⭐ 가장 인기</div>
                                )}
                                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                                <p className="text-xs text-slate-400 mb-4">{plan.desc}</p>
                                <div className="flex items-end gap-1 mb-6">
                                    <span className="text-4xl font-black">{plan.price}</span>
                                    <span className="text-slate-400 text-sm pb-1">{plan.period}</span>
                                </div>
                                <ul className="space-y-2.5 mb-6">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-slate-300">
                                            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0 mt-0.5" /> {f}
                                        </li>
                                    ))}
                                    {plan.limits.map(f => (
                                        <li key={f} className="flex items-start gap-2 text-sm text-slate-500">
                                            <X size={16} className="text-slate-600 flex-shrink-0 mt-0.5" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link to="/signup" className={`block text-center py-3.5 rounded-xl font-bold text-sm transition-all ${plan.popular ? 'bg-amber-500 text-slate-900 hover:bg-amber-400 shadow-lg shadow-amber-500/20' : 'bg-white/10 hover:bg-white/20'}`}>
                                    {plan.price === '0' ? '무료로 시작' : '30일 무료 체험'}
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                    <motion.p className="text-center text-xs text-slate-500 mt-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        모든 요금제는 VAT 포함 가격입니다 • 연간 결제 시 20% 할인 • 언제든지 플랜 변경 가능
                    </motion.p>
                </div>
            </section>

            {/* ═══════════════════════════════════
                6. TESTIMONIALS
            ═══════════════════════════════════ */}
            <section className="py-24 px-4 bg-white/[.02] border-y border-white/5">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">REVIEWS</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">사장님들의 <span className="text-amber-400">생생한 후기</span></h2>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {TESTIMONIALS.map((t, i) => (
                            <motion.div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10"
                                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                            >
                                <div className="flex gap-0.5 mb-3">
                                    {[...Array(t.rating)].map((_, j) => <Star key={j} size={14} className="text-amber-400 fill-amber-400" />)}
                                </div>
                                <p className="text-slate-300 text-sm mb-4 leading-relaxed">"{t.text}"</p>
                                <div className="flex items-center gap-3 pt-3 border-t border-white/10">
                                    <div className="w-9 h-9 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 font-bold text-sm">{t.name[0]}</div>
                                    <div>
                                        <div className="font-bold text-sm">{t.name}</div>
                                        <div className="text-xs text-slate-500">{t.biz}</div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════
                7. FAQ
            ═══════════════════════════════════ */}
            <section ref={faqRef} className="py-24 px-4 scroll-mt-20">
                <div className="max-w-3xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">FAQ</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">자주 묻는 <span className="text-amber-400">질문</span></h2>
                    </motion.div>
                    <div className="space-y-3">
                        {FAQS.map((faq, i) => (
                            <motion.div key={i} className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden"
                                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i * 0.5} variants={fadeUp}
                            >
                                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                    className="w-full flex items-center justify-between p-5 text-left hover:bg-white/5 transition-colors"
                                >
                                    <span className="font-bold text-sm flex items-center gap-2">
                                        <HelpCircle size={16} className="text-amber-400 flex-shrink-0" /> {faq.q}
                                    </span>
                                    <ChevronDown size={18} className={`text-slate-500 transition-transform flex-shrink-0 ml-2 ${openFaq === i ? 'rotate-180' : ''}`} />
                                </button>
                                {openFaq === i && (
                                    <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed border-t border-white/5 pt-4">
                                        {faq.a}
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════
                8. CONTACT / INQUIRY
            ═══════════════════════════════════ */}
            <section ref={contactRef} className="py-24 px-4 bg-white/[.02] border-y border-white/5 scroll-mt-20">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <div className="text-amber-400 text-sm font-bold mb-2">CONTACT</div>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">문의 및 <span className="text-amber-400">상담</span></h2>
                        <p className="text-slate-400 text-lg">무엇이든 편하게 물어보세요. 친절하게 안내해 드립니다.</p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Contact Info */}
                        <motion.div className="space-y-6" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
                                {[
                                    { icon: Phone, label: '전화 상담', value: '1588-0000', sub: '평일 09:00~18:00' },
                                    { icon: Mail, label: '이메일', value: 'support@semhana.com', sub: '24시간 접수' },
                                    { icon: MessageSquare, label: '카카오톡', value: '@셈하나', sub: '실시간 채팅 상담' },
                                ].map((item, i) => {
                                    const Icon = item.icon;
                                    return (
                                        <div key={i} className="flex items-start gap-4 p-3 bg-white/5 rounded-xl">
                                            <div className="p-2.5 bg-amber-500/20 rounded-xl">
                                                <Icon size={18} className="text-amber-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-400">{item.label}</div>
                                                <div className="font-bold">{item.value}</div>
                                                <div className="text-xs text-slate-500">{item.sub}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-2xl p-6 border border-amber-500/20">
                                <Briefcase size={24} className="text-amber-400 mb-3" />
                                <h3 className="font-bold text-lg mb-2">기업 맞춤 상담</h3>
                                <p className="text-sm text-slate-300 mb-4">5개 이상 매장을 운영하시나요? 기업 맞춤 요금과 전담 지원을 제공합니다.</p>
                                <a href="mailto:enterprise@semhana.com" className="inline-flex items-center gap-1 text-amber-400 text-sm font-bold hover:text-amber-300">
                                    기업 문의 <ExternalLink size={14} />
                                </a>
                            </div>
                        </motion.div>

                        {/* Contact Form */}
                        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} custom={1} variants={fadeUp}>
                            <form onSubmit={handleContactSubmit} className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-4">
                                <h3 className="font-bold text-lg mb-2 flex items-center gap-2"><Send size={16} className="text-amber-400" /> 문의하기</h3>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">이름 *</label>
                                    <input value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))}
                                        required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" placeholder="홍길동" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">이메일 *</label>
                                        <input type="email" value={contactForm.email} onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                                            required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" placeholder="email@example.com" />
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-400 block mb-1">전화번호</label>
                                        <input value={contactForm.phone} onChange={e => setContactForm(p => ({ ...p, phone: e.target.value }))}
                                            className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500" placeholder="010-0000-0000" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">문의 내용 *</label>
                                    <textarea value={contactForm.message} onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                                        required rows={4} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-amber-500 resize-none" placeholder="궁금한 점이나 문의사항을 입력해 주세요" />
                                </div>
                                {contactSent ? (
                                    <div className="py-3 text-center text-emerald-400 font-bold text-sm bg-emerald-500/10 rounded-xl">✅ 문의가 접수되었습니다. 빠르게 답변 드리겠습니다!</div>
                                ) : (
                                    <button type="submit" className="w-full py-3.5 bg-amber-500 text-slate-900 rounded-xl font-bold hover:bg-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2">
                                        <Send size={16} /> 문의 보내기
                                    </button>
                                )}
                            </form>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* ═══════════════════════════════════
                9. FINAL CTA
            ═══════════════════════════════════ */}
            <section className="py-24 px-4">
                <motion.div className="max-w-4xl mx-auto text-center bg-gradient-to-br from-amber-500/20 via-amber-600/10 to-transparent rounded-3xl p-12 md:p-16 border border-amber-500/20 relative overflow-hidden"
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                >
                    <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
                    <div className="relative z-10">
                        <Shield size={44} className="text-amber-400 mx-auto mb-6" />
                        <h2 className="text-3xl md:text-4xl font-black mb-4">지금 바로 시작하세요</h2>
                        <p className="text-slate-300 mb-8 max-w-lg mx-auto">무료 플랜으로 셈하나의 핵심 기능을 체험하세요.<br />신용카드 없이 바로 시작할 수 있습니다.</p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/signup" className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105">
                                <UserPlus size={20} /> 무료 회원가입
                            </Link>
                            <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 transition-all">
                                <LogIn size={20} /> 기존 회원 로그인
                            </Link>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ═══════════════════════════════════
                FOOTER
            ═══════════════════════════════════ */}
            <footer className="py-12 px-4 border-t border-white/5">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="font-black text-xl mb-3">셈<span className="text-amber-400">하나</span></div>
                            <p className="text-sm text-slate-500 leading-relaxed">소상공인을 위한 올인원 매장 관리 플랫폼. 급여, 매출, 손익, 출퇴근을 하나로.</p>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-slate-300">서비스</h4>
                            <div className="space-y-2 text-sm text-slate-500">
                                <button onClick={() => scrollTo(featuresRef)} className="block hover:text-white transition-colors">기능 소개</button>
                                <button onClick={() => scrollTo(pricingRef)} className="block hover:text-white transition-colors">요금제</button>
                                <button onClick={() => scrollTo(guideRef)} className="block hover:text-white transition-colors">가입 안내</button>
                                <button onClick={() => scrollTo(faqRef)} className="block hover:text-white transition-colors">FAQ</button>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-slate-300">고객지원</h4>
                            <div className="space-y-2 text-sm text-slate-500">
                                <button onClick={() => scrollTo(contactRef)} className="block hover:text-white transition-colors">문의하기</button>
                                <p>전화: 1588-0000</p>
                                <p>이메일: support@semhana.com</p>
                            </div>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm mb-3 text-slate-300">법적 정보</h4>
                            <div className="space-y-2 text-sm text-slate-500">
                                <p>사업자등록번호: 000-00-00000</p>
                                <p>이용약관</p>
                                <p>개인정보처리방침</p>
                            </div>
                        </div>
                    </div>
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
                        <div>© {new Date().getFullYear()} SEMHANA. All rights reserved.</div>
                        <div className="flex items-center gap-4">
                            <Link to="/login" className="text-amber-400 hover:text-amber-300 flex items-center gap-1"><LogIn size={14} /> 로그인</Link>
                            <Link to="/signup" className="text-amber-400 hover:text-amber-300 flex items-center gap-1"><UserPlus size={14} /> 회원가입</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
