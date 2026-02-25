import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    MapPin, Phone, Clock, Star, Users, Car, CreditCard,
    ChevronDown, UtensilsCrossed, LogIn, Truck, Accessibility,
    ArrowRight, Sparkles, ShoppingBag, LayoutDashboard
} from 'lucide-react';
import './LandingPage.css';

/* ── Menu Data ── */
const MENU = {
    gimbap: {
        emoji: '🍙',
        title: '김밥류',
        items: [
            { name: '소담김밥', price: '5,000원', badge: '대표' },
            { name: '햄초밥김밥', price: '5,500원' },
            { name: '참치김밥', price: '5,500원' },
            { name: '치즈김밥', price: '5,500원' },
            { name: '불고기김밥', price: '6,000원' },
            { name: '멸치김밥', price: '6,000원' },
            { name: '고추김밥', price: '6,000원' },
            { name: '유부초밥', price: '5,500원' },
        ],
    },
    triangle: {
        emoji: '🍘',
        title: '삼각주먹밥',
        items: [
            { name: '순한참치', price: '3,000원' },
            { name: '매콤참치', price: '3,000원' },
            { name: '멸치', price: '3,500원' },
            { name: '불고기', price: '3,500원' },
            { name: '스팸', price: '3,500원' },
        ],
    },
    snacks: {
        emoji: '🍢',
        title: '분식류',
        items: [
            { name: '소담떡볶이', price: '4,500원' },
            { name: '미니컵 떡볶이', price: '2,500원' },
            { name: '소담순대', price: '4,000원' },
            { name: '미니컵 순대', price: '2,000원' },
            { name: '소담어묵 (3개)', price: '3,000원' },
        ],
    },
    drinks: {
        emoji: '🥤',
        title: '음료',
        items: [
            { name: '콜라/사이다/환타', price: '2,000원' },
            { name: '생수', price: '1,000원' },
        ],
    },
};

/* ── Fade-up animation variant ── */
const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' },
    }),
};

export default function LandingPage() {
    const [scrollY, setScrollY] = useState(0);
    const isLoggedIn = !!localStorage.getItem('token');

    useEffect(() => {
        const onScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <div className="landing-page">
            {/* ═══════ HERO ═══════ */}
            <section className="landing-hero">
                <div
                    className="hero-bg-pattern"
                    style={{
                        position: 'absolute', inset: 0, opacity: 0.06,
                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                />
                <motion.div
                    className="hero-content"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.15 } },
                    }}
                >
                    <motion.div className="hero-badge" variants={fadeUp}>
                        <Sparkles size={14} />
                        건대입구역 4번 출구 · 스타시티 영존 A동 B2
                    </motion.div>

                    <motion.div className="hero-logo" variants={fadeUp}>
                        <img src="/sodam-logo-white.png" alt="소담김밥 로고" className="hero-logo-img" />
                    </motion.div>

                    <motion.h1 className="hero-title" variants={fadeUp}>
                        <span className="hero-title-accent">소담</span>김밥
                    </motion.h1>

                    <motion.p className="hero-subtitle" variants={fadeUp}>
                        좋은 재료만 사용하고, 깨끗한 주방에서<br />
                        가족처럼 정성을 담아 만듭니다
                    </motion.p>

                    <motion.div className="hero-actions" variants={fadeUp}>
                        <a href="tel:0507-1384-6570" className="hero-btn-primary">
                            <Phone size={18} />
                            전화 주문
                        </a>
                        {isLoggedIn ? (
                            <Link to="/dashboard" className="hero-btn-secondary">
                                <LayoutDashboard size={18} />
                                대시보드
                            </Link>
                        ) : (
                            <Link to="/login" className="hero-btn-secondary">
                                <LogIn size={18} />
                                관리자 로그인
                            </Link>
                        )}
                    </motion.div>
                </motion.div>

                <div className="hero-scroll-indicator">
                    <span>아래로 스크롤</span>
                    <ChevronDown size={20} />
                </div>
            </section>

            {/* ═══════ INFO ═══════ */}
            <section className="landing-section info-section-bg">
                <motion.div
                    className="section-header"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={fadeUp}
                >
                    <div className="section-icon-wrapper">
                        <MapPin size={22} />
                    </div>
                    <h2 className="section-title">매장 정보</h2>
                    <p className="section-subtitle">소담김밥을 찾아주세요</p>
                </motion.div>

                <div className="info-grid">
                    <motion.div
                        className="info-card"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={0}
                        variants={fadeUp}
                    >
                        <div className="info-card-icon">
                            <MapPin size={20} />
                        </div>
                        <div className="info-card-title">위치</div>
                        <div className="info-card-text">
                            서울 광진구 능동로 110<br />
                            스타시티 영존 A동 <span className="highlight">지하 2층</span><br />
                            <span style={{ fontSize: '0.8rem', color: 'var(--sodam-warm-400)' }}>
                                (건대입구역 4번 출구)
                            </span>
                        </div>
                    </motion.div>

                    <motion.div
                        className="info-card"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={1}
                        variants={fadeUp}
                    >
                        <div className="info-card-icon">
                            <Clock size={20} />
                        </div>
                        <div className="info-card-title">영업 시간</div>
                        <div className="info-card-text">
                            <table className="hours-table">
                                <tbody>
                                    <tr><td>월~금</td><td>06:00 – 20:00</td></tr>
                                    <tr><td>토요일</td><td>06:00 – 15:30</td></tr>
                                    <tr><td>일/공휴일</td><td className="hours-closed">휴무</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </motion.div>

                    <motion.div
                        className="info-card"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true }}
                        custom={2}
                        variants={fadeUp}
                    >
                        <div className="info-card-icon">
                            <Phone size={20} />
                        </div>
                        <div className="info-card-title">연락처</div>
                        <div className="info-card-text">
                            <a
                                href="tel:0507-1384-6570"
                                style={{ color: 'var(--sodam-accent)', fontWeight: 700, textDecoration: 'none' }}
                            >
                                📞 0507-1384-6570
                            </a>
                            <br />
                            <span style={{ fontSize: '0.8rem', color: 'var(--sodam-warm-400)', marginTop: '0.5rem', display: 'block' }}>
                                전화 주문 및 문의 가능
                            </span>
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* ═══════ MENU ═══════ */}
            <section className="landing-section menu-section-bg">
                <motion.div
                    className="section-header"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={fadeUp}
                >
                    <div className="section-icon-wrapper">
                        <UtensilsCrossed size={22} />
                    </div>
                    <h2 className="section-title">메뉴</h2>
                    <p className="section-subtitle">정성으로 만든 소담의 메뉴를 소개합니다</p>
                </motion.div>

                <div className="menu-categories">
                    {Object.entries(MENU).map(([key, category], catIdx) => (
                        <motion.div
                            key={key}
                            className="menu-category-card"
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            custom={catIdx}
                            variants={fadeUp}
                        >
                            <div className="menu-category-header">
                                <span className="menu-category-emoji">{category.emoji}</span>
                                <span className="menu-category-title">{category.title}</span>
                            </div>
                            <div className="menu-items-list">
                                {category.items.map((item) => (
                                    <div key={item.name} className="menu-item">
                                        <span className="menu-item-name">
                                            {item.name}
                                            {item.badge && (
                                                <span className="menu-item-badge">{item.badge}</span>
                                            )}
                                        </span>
                                        <span className="menu-item-price">{item.price}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ═══════ HIGHLIGHTS ═══════ */}
            <section className="highlights-section-bg">
                <div className="landing-section">
                    <motion.div
                        className="section-header"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.3 }}
                        variants={fadeUp}
                    >
                        <div className="section-icon-wrapper">
                            <Star size={22} />
                        </div>
                        <h2 className="section-title">소담김밥이 사랑받는 이유</h2>
                        <p className="section-subtitle">고객님들의 소중한 평가</p>
                    </motion.div>

                    <div className="highlights-grid">
                        {[
                            { icon: '⭐', value: '4.28', label: '네이버 평점', sub: '/ 5.0' },
                            { icon: '💬', value: '671', label: '방문자 리뷰', sub: '건' },
                            { icon: '📝', value: '8', label: '블로그 리뷰', sub: '건' },
                            { icon: '🕐', value: '14년', label: '영업 경력', sub: '2012~' },
                        ].map((item, i) => (
                            <motion.div
                                key={item.label}
                                className="highlight-card"
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true }}
                                custom={i}
                                variants={fadeUp}
                            >
                                <div className="highlight-icon">{item.icon}</div>
                                <div className="highlight-value">{item.value}</div>
                                <div className="highlight-label">{item.label}</div>
                                <div className="highlight-sublabel">{item.sub}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════ SERVICES ═══════ */}
            <section className="landing-section">
                <motion.div
                    className="section-header"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.3 }}
                    variants={fadeUp}
                >
                    <div className="section-icon-wrapper">
                        <ShoppingBag size={22} />
                    </div>
                    <h2 className="section-title">편의 시설 & 서비스</h2>
                    <p className="section-subtitle">고객님의 편의를 위해 준비했습니다</p>
                </motion.div>

                <motion.div
                    className="services-grid"
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true }}
                    variants={{
                        hidden: {},
                        visible: { transition: { staggerChildren: 0.08 } },
                    }}
                >
                    {[
                        { icon: <ShoppingBag size={18} />, text: '포장 가능', color: 'green' },
                        { icon: <Truck size={18} />, text: '배달 가능', color: 'blue' },
                        { icon: <CreditCard size={18} />, text: '간편 결제', color: 'orange' },
                        { icon: <Car size={18} />, text: '주차 가능', color: 'purple' },
                        { icon: <Users size={18} />, text: '1인석 보유', color: 'green' },
                        { icon: <Accessibility size={18} />, text: '휠체어 이용', color: 'blue' },
                    ].map((svc) => (
                        <motion.div key={svc.text} className="service-chip" variants={fadeUp}>
                            <div className={`service-chip-icon ${svc.color}`}>{svc.icon}</div>
                            <span className="service-chip-text">{svc.text}</span>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* ═══════ FOOTER ═══════ */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <img src="/sodam-logo.png" alt="소담김밥" className="footer-logo" />
                        <span>소담김밥</span>
                    </div>
                    <div className="footer-address">
                        서울 광진구 능동로 110 스타시티 영존 A동 지하 2층<br />
                        Tel. 0507-1384-6570
                    </div>
                    <div className="footer-divider" />
                    <div className="footer-copyright">
                        © {new Date().getFullYear()} 소담김밥. All rights reserved.
                    </div>
                    {isLoggedIn ? (
                        <Link to="/dashboard" className="footer-login-link">
                            <LayoutDashboard size={14} />
                            대시보드로 돌아가기
                        </Link>
                    ) : (
                        <Link to="/login" className="footer-login-link">
                            <LogIn size={14} />
                            관리자 로그인
                        </Link>
                    )}
                </div>
            </footer>
        </div>
    );
}
