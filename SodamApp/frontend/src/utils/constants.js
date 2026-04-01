export const EXPENSE_CATEGORIES = [
    { id: '원재료비', label: '원재료비', icon: '🥬', color: '#10b981' },
    { id: '소모품비', label: '소모품비', icon: '📦', color: '#059669' },
    { id: '수도광열비', label: '수도광열비', icon: '💡', color: '#8b5cf6' },
    { id: '임차료', label: '임차료', icon: '🏠', color: '#7c3aed' },
    { id: '수선비', label: '수선비', icon: '🔧', color: '#6366f1' },
    { id: '감가상각비', label: '감가상각비', icon: '⚙️', color: '#0ea5e9' },
    { id: '세금과공과', label: '세금과공과', icon: '🏛️', color: '#14b8a6' },
    { id: '보험료', label: '보험료', icon: '🛡️', color: '#f97316' },
    { id: '인건비', label: '인건비', icon: '👷', color: '#0d9488' },
    { id: '카드수수료', label: '카드수수료', icon: '💳', color: '#ef4444' },
    { id: '배달앱수수료', label: '배달앱 수수료', icon: '🛵', color: '#f43f5e' },
    { id: '기타경비', label: '기타경비', icon: '📋', color: '#64748b' },
    { id: '개인가계부', label: '개인가계부', icon: '👤', color: '#f59e0b' },
];

export const REVENUE_CATEGORIES = [
    { id: 'delivery', label: '배달앱매출', icon: '🛵' },
    { id: 'store', label: '매장매출', icon: '🏪' },
];

export const PL_REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출', icon: '🏪' },
    { key: 'revenue_coupang', label: '쿠팡 매출', icon: '🛒' },
    { key: 'revenue_baemin', label: '배민 매출', icon: '🏍️' },
    { key: 'revenue_yogiyo', label: '요기요 매출', icon: '🍜' },
    { key: 'revenue_ddangyo', label: '땡겨요 매출', icon: '📱' },
];

export const DELIVERY_CHANNELS = [
    { id: 'coupang', label: '쿠팡이츠', apiKey: 'Coupang', icon: '🛒' },
    { id: 'baemin', label: '배달의민족', apiKey: 'Baemin', icon: '🏍️' },
    { id: 'yogiyo', label: '요기요', apiKey: 'Yogiyo', icon: '🍜' },
    { id: 'ddangyo', label: '땡겨요', apiKey: 'Ddangyo', icon: '📱' },
];

export const CARD_COMPANIES = ['농협카드', '신한카드', '삼성카드', '국민카드', '롯데카드', '현대카드', '우리카드', '하나카드', 'BC카드'];
export const PAY_SERVICES = ['서울페이', '제로페이', '네이버페이', '카카오페이', '애플페이', '삼성페이'];
export const DELIVERY_APPS = ['배달의민족', '쿠팡이츠', '땡겨요', '요기요'];
