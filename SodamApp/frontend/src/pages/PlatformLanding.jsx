import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Shield, BarChart3, Users, CreditCard, Store, ArrowRight,
    LogIn, ChevronDown, Zap, LineChart, Clock, CheckCircle2
} from 'lucide-react';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1, y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' },
    }),
};

const PLANS = [
    { name: 'Free', price: '0', period: '원/월', features: ['직원 3명', '급여계산', '출퇴근 관리'], color: 'slate' },
    { name: 'Basic', price: '29,900', period: '원/월', features: ['직원 10명', '매출/지출 관리', '손익분석', '카드매출 분석'], color: 'blue', popular: true },
    { name: 'Premium', price: '59,900', period: '원/월', features: ['직원 50명', '전자계약', '재고관리', '전체 기능', 'API 연동'], color: 'amber' },
];

const FEATURES = [
    { icon: Users, title: '직원 관리', desc: '급여 자동계산, 4대보험, 전자계약', color: 'text-blue-400' },
    { icon: BarChart3, title: '매출 분석', desc: '실시간 매출·배달앱·카드 통합 분석', color: 'text-emerald-400' },
    { icon: LineChart, title: '손익 관리', desc: '월별 손익계산서 자동 생성', color: 'text-purple-400' },
    { icon: Clock, title: '출퇴근 GPS', desc: 'GPS 기반 출퇴근 · QR 체크인', color: 'text-amber-400' },
    { icon: CreditCard, title: '급여 이체', desc: '원클릭 급여 일괄이체', color: 'text-rose-400' },
    { icon: Store, title: '멀티 매장', desc: '여러 매장을 하나의 대시보드에서', color: 'text-cyan-400' },
];

export default function PlatformLandingPage() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white overflow-hidden">
            {/* ═══ HERO ═══ */}
            <section className="relative min-h-screen flex items-center justify-center px-4">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 30% 40%, rgba(99,102,241,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(245,158,11,0.1) 0%, transparent 50%)',
                }} />
                <motion.div className="relative z-10 text-center max-w-4xl mx-auto"
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
                        <span className="text-white/30 mx-3">|</span>
                        <span className="text-white/80">SEM</span><span className="bg-gradient-to-r from-amber-400 to-amber-500 bg-clip-text text-transparent">HANA</span>
                    </motion.h1>

                    <motion.p variants={fadeUp} className="text-xl md:text-2xl text-slate-300 mb-10 leading-relaxed">
                        급여, 매출, 손익, 출퇴근을<br className="md:hidden" /> <span className="text-white font-bold">하나로</span> 관리하세요
                    </motion.p>

                    <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/login" className="inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105">
                            <LogIn size={20} /> 시작하기
                        </Link>
                        <a href="#features" className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-sm px-8 py-4 rounded-2xl text-lg font-medium border border-white/10 transition-all">
                            자세히 보기 <ArrowRight size={18} />
                        </a>
                    </motion.div>
                </motion.div>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-slate-500">
                    <ChevronDown size={24} />
                </div>
            </section>

            {/* ═══ FEATURES ═══ */}
            <section id="features" className="py-24 px-4">
                <div className="max-w-6xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">매장 운영에 필요한 <span className="text-amber-400">모든 것</span></h2>
                        <p className="text-slate-400 text-lg">하나의 플랫폼으로 모든 업무를 관리하세요</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {FEATURES.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <motion.div key={f.title} className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 hover:border-amber-500/30 transition-all hover:bg-white/[.08]"
                                    initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                                >
                                    <Icon size={28} className={`${f.color} mb-4`} />
                                    <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                                    <p className="text-slate-400 text-sm">{f.desc}</p>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ═══ PRICING ═══ */}
            <section className="py-24 px-4">
                <div className="max-w-5xl mx-auto">
                    <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">합리적인 <span className="text-amber-400">요금제</span></h2>
                        <p className="text-slate-400 text-lg">매장 규모에 맞게 선택하세요</p>
                    </motion.div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {PLANS.map((plan, i) => (
                            <motion.div key={plan.name}
                                className={`relative bg-white/5 backdrop-blur-sm rounded-2xl p-6 border transition-all hover:scale-105 ${plan.popular ? 'border-amber-500/50 shadow-lg shadow-amber-500/10' : 'border-white/10'}`}
                                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-900 text-xs font-bold px-4 py-1 rounded-full">인기</div>
                                )}
                                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                                <div className="flex items-end gap-1 mb-6">
                                    <span className="text-3xl font-black">{plan.price}</span>
                                    <span className="text-slate-400 text-sm pb-1">{plan.period}</span>
                                </div>
                                <ul className="space-y-3 mb-6">
                                    {plan.features.map(f => (
                                        <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                                            <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link to="/login" className={`block text-center py-3 rounded-xl font-bold text-sm transition-all ${plan.popular ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' : 'bg-white/10 hover:bg-white/20'}`}>
                                    시작하기
                                </Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══ CTA ═══ */}
            <section className="py-24 px-4">
                <motion.div className="max-w-3xl mx-auto text-center bg-gradient-to-r from-amber-500/20 to-amber-600/10 rounded-3xl p-12 border border-amber-500/20"
                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                >
                    <Shield size={40} className="text-amber-400 mx-auto mb-6" />
                    <h2 className="text-2xl md:text-3xl font-black mb-4">지금 바로 시작하세요</h2>
                    <p className="text-slate-300 mb-8">무료 체험으로 셈하나의 모든 기능을 경험해 보세요</p>
                    <Link to="/login" className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-900 px-8 py-4 rounded-2xl text-lg font-bold shadow-lg shadow-amber-500/30 transition-all hover:scale-105">
                        <LogIn size={20} /> 무료로 시작하기
                    </Link>
                </motion.div>
            </section>

            {/* ═══ FOOTER ═══ */}
            <footer className="py-8 px-4 border-t border-white/5">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-500">
                    <div className="font-bold text-slate-400">셈하나 SEMHANA</div>
                    <div>© {new Date().getFullYear()} SEMHANA. All rights reserved.</div>
                    <Link to="/login" className="text-amber-400 hover:text-amber-300 flex items-center gap-1">
                        <LogIn size={14} /> 로그인
                    </Link>
                </div>
            </footer>
        </div>
    );
}
