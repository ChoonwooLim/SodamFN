import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit3, Trash2, ShoppingBag, UploadCloud, RotateCcw, X, Search, Filter, Wallet, ArrowRightLeft, CheckSquare, Square, ChevronDown, ChevronUp, FileSpreadsheet } from 'lucide-react';
import api from '../api';
import './PurchaseManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Card company colors
const CARD_COLORS = {
    '롯데카드': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    '삼성카드': { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
    '신한카드': { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    '신한은행': { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
    '국민은행': { bg: '#fef3c7', text: '#b45309', border: '#fcd34d' },
    '수협은행': { bg: '#cffafe', text: '#0e7490', border: '#67e8f9' },
    '현대카드': { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' },
    '기타': { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
};

const EXPENSE_CATEGORIES = [
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
    { id: '기타경비', label: '기타경비', icon: '📋', color: '#64748b' },
    { id: '개인가계부', label: '개인가계부', icon: '👤', color: '#f59e0b' },
];

// 카테고리 선택 도우미 데이터 (한국 개인사업자 회계기준)
const CATEGORY_HELP_DATA = {
    '원재료비': {
        desc: '식자재를 포함한 원재료 구입비',
        items: ['식재료 (야채, 육류, 수산물)', '반가공식품 (얕념류, 튜브식품)', '양념/소스/조미료'],
    },
    '소모품비': {
        desc: '단기 소모성 물품 구입비',
        items: ['포장재 · 비닐봉투 · 박스', '일회용품 (젖가락, 냅킨)', '세제 · 유리세정제 · 라텍스 장갑'],
    },
    '수도광열비': {
        desc: '전기 · 가스 · 수도 요금',
        items: ['전기요금 (한전)', '도시가스/LPG요금', '상하수도 요금'],
    },
    '임차료': {
        desc: '가게 임대료 + 관리비 통합',
        items: ['월세 (임대료)', '공용관리비', '주차장 임대료'],
    },
    '수선비': {
        desc: '시설 · 장비 수리비',
        items: ['주방장비 수리', '냉건/냉동고 수리', '인테리어 보수'],
    },
    '감가상각비': {
        desc: '대형 장비 · 시설 구입액의 기간 안분',
        items: ['업소용 기계장치', '인테리어 공사비', 'POS 단말기 · 카드단말기 구입'],
    },
    '세금과공과': {
        desc: '볕인세 · 소득세 · 등 세금 통합',
        items: ['부가가치세 (세금계산서)', '종합소득세 (사업소득세)', '주민세 · 지방세'],
    },
    '보험료': {
        desc: '각종 보험료',
        items: ['화재보험 · 배상책임보험', '상가임대인 보험', '영업배상책임보험'],
    },
    '인건비': {
        desc: '직원 급여 및 4대보험 사업주 부담분',
        items: ['직원 급여 · 상여금', '4대보험 (국민연금/건강보험/고용보험/산재보험)', '퇴직금 · 퇴직연금'],
    },
    '카드수수료': {
        desc: 'PG · VAN 카드 결제 수수료',
        items: ['신용카드 수수료', 'PG수수료 (배달앱)', 'VAN 및 단말기 이용료'],
    },
    '기타경비': {
        desc: '위 카테고리에 해당하지 않는 기타 경비',
        items: ['이용료 · 수수료 · 배달비', '통신비 (인터넷/전화)', '광고선전비 · 교육비'],
    },
    '개인가계부': {
        desc: '사업외 개인적 지출 (손익계산서 미포함)',
        items: ['생활비 · 카드값', '전자제품 · 마트 장보기', '자녀 교육비 · 의료비'],
    },
};

function formatNumber(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('ko-KR');
}

function getWeekday(dateStr) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const d = new Date(dateStr);
    return days[d.getDay()];
}

function getCardColor(note) {
    if (!note) return CARD_COLORS['기타'];
    for (const [card, colors] of Object.entries(CARD_COLORS)) {
        if (note.includes(card)) return colors;
    }
    return CARD_COLORS['기타'];
}

function getCardCompany(note) {
    if (!note) return '';
    const m = note.match(/카드사:([^,]+)/);
    return m ? m[1] : '';
}

export default function PurchaseManagement() {
    const navigate = useNavigate();
    const now = new Date();
    // 이전 달을 기본으로 표시 (월말이 지나야 정확한 데이터가 완성되므로)
    const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [year, setYear] = useState(defaultDate.getFullYear());
    const [month, setMonth] = useState(defaultDate.getMonth() + 1);
    const [viewMode, setViewMode] = useState('dashboard'); // dashboard | list | household | upload
    const [uploadTab, setUploadTab] = useState('excel'); // excel | history
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({ total: 0, count: 0, by_category: {}, by_card_company: {}, by_bank_transfer: {}, top_vendors: [] });
    const [loading, setLoading] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ vendor_name: '', date: '', amount: '', category: '기타경비', note: '' });

    // Category Helper
    const [showCategoryHelper, setShowCategoryHelper] = useState(false);

    // Upload
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);

    // Vendor Review Modal (2-step upload)
    const [showVendorReview, setShowVendorReview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [vendorDecisions, setVendorDecisions] = useState({});
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [showNewCategoryFor, setShowNewCategoryFor] = useState(null);
    const [excludedVendors, setExcludedVendors] = useState(new Set());

    // Batch selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    // ─── Fetch ───
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [dailyRes, summaryRes] = await Promise.all([
                api.get('/purchase/daily', { params: { year, month } }),
                api.get('/purchase/summary', { params: { year, month } }),
            ]);
            setData(dailyRes.data.records || []);
            setSelectedIds(new Set());
            setSummary(summaryRes.data || { total: 0, count: 0, by_category: {}, by_card_company: {}, by_bank_transfer: {}, top_vendors: [] });
        } catch (err) {
            console.error('Purchase fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    // ─── Collapse State ───
    const [collapsedDates, setCollapsedDates] = useState(new Set());

    const toggleDateCollapse = (dateStr) => {
        setCollapsedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr);
            else next.add(dateStr);
            return next;
        });
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── Month Navigation ───
    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    };

    // ─── Filtered & grouped data ───
    // 'household' view only shows '개인가계부'
    // 'list' view shows everything EXCEPT '개인가계부'
    const isHouseholdMode = viewMode === 'household';

    const filteredData = data.filter(d => {
        const isPersonal = d.category === '개인가계부';

        // Mode filter
        if (isHouseholdMode && !isPersonal) return false;
        if (viewMode === 'list' && isPersonal) return false;

        const matchSearch = !searchTerm || d.vendor_name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchCategory = filterCategory === 'all' || d.category === filterCategory;
        return matchSearch && matchCategory;
    });

    const groupedByDate = {};
    filteredData.forEach(item => {
        if (!groupedByDate[item.date]) groupedByDate[item.date] = [];
        groupedByDate[item.date].push(item);
    });
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    // Separate sums
    const personalTotal = (summary.by_category?.['개인가계부']?.amount || 0);
    const businessTotal = (summary.total || 0) - personalTotal;

    // ─── CRUD ───
    const openAddModal = () => {
        const today = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        // Default category based on view mode
        const defaultCat = isHouseholdMode ? '개인가계부' : '기타경비';
        setForm({ vendor_name: '', date: today, amount: '', category: defaultCat, note: '' });
        setModalMode('add');
        setEditingId(null);
        setShowModal(true);
    };

    const openEditModal = (record) => {
        setForm({
            vendor_name: record.vendor_name,
            date: record.date,
            amount: String(record.amount),
            category: record.category || '기타비용',
            note: record.note || '',
        });
        setModalMode('edit');
        setEditingId(record.id);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!form.vendor_name || !form.date || !form.amount) {
            alert('거래처, 날짜, 금액을 모두 입력해주세요.');
            return;
        }
        try {
            if (modalMode === 'add') {
                await api.post('/purchase', {
                    vendor_name: form.vendor_name,
                    date: form.date,
                    amount: Number(form.amount),
                    category: form.category,
                    note: form.note || null,
                });
            } else {
                await api.put(`/purchase/${editingId}`, {
                    vendor_name: form.vendor_name,
                    date: form.date,
                    amount: Number(form.amount),
                    category: form.category,
                    note: form.note || null,
                });
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('이 내역을 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/purchase/${id}`);
            fetchData();
        } catch (err) {
            console.error('Delete error:', err);
            const msg = err.response?.data?.detail || err.message || '삭제 실패';
            alert(`삭제 실패: ${msg}`);
        }
    };

    // Quick Toggle: Business <-> Personal
    const toggleCategory = async (record) => {
        const isPersonal = record.category === '개인가계부';
        const newCategory = isPersonal ? '기타경비' : '개인가계부';
        const actionName = isPersonal ? '사업비용으로' : '개인비용으로';

        if (!window.confirm(`'${record.vendor_name}' ${formatNumber(record.amount)}원을 ${actionName} 변경하시겠습니까?\n(동일 업체명 항목도 함께 변경됩니다)`)) return;

        try {
            const res = await api.put(`/purchase/${record.id}`, {
                category: newCategory
            });
            const extra = res.data?.same_vendor_updated || 0;
            if (extra > 0) {
                alert(`✅ 변경 완료! 동일 업체 ${extra}건도 함께 변경되었습니다.`);
            }
            fetchData();
        } catch (err) {
            console.error(err);
            alert('변경 실패');
        }
    };

    // ─── Batch Actions ───
    const toggleSelect = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectDay = (items) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            const allSelected = items.every(i => next.has(i.id));
            items.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id));
            return next;
        });
    };

    const handleBatchCategory = async (newCategory) => {
        if (selectedIds.size === 0) return;
        const catInfo = EXPENSE_CATEGORIES.find(c => c.id === newCategory);
        const label = catInfo ? `${catInfo.icon} ${catInfo.label}` : newCategory;
        if (!window.confirm(`선택한 ${selectedIds.size}건을 ${label}(으)로 일괄 변경하시겠습니까?\n(동일 업체명 항목도 함께 변경됩니다)`)) return;

        try {
            const results = await Promise.all(
                [...selectedIds].map(id =>
                    api.put(`/purchase/${id}`, { category: newCategory })
                )
            );
            const totalExtra = results.reduce((sum, r) => sum + (r.data?.same_vendor_updated || 0), 0);
            setSelectedIds(new Set());
            if (totalExtra > 0) {
                alert(`✅ ${selectedIds.size}건 변경 완료! 동일 업체 ${totalExtra}건도 함께 변경되었습니다.`);
            }
            fetchData();
        } catch (err) {
            console.error(err);
            alert('일괄 변경 중 오류가 발생했습니다.');
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`선택한 ${selectedIds.size}건을 삭제하시겠습니까?`)) return;

        try {
            const promises = [...selectedIds].map(id =>
                api.delete(`/purchase/${id}`)
            );
            await Promise.all(promises);
            setSelectedIds(new Set());
            fetchData();
        } catch (err) {
            console.error(err);
            alert('일괄 삭제 중 오류가 발생했습니다.');
        }
    };

    // ─── Upload (2-step: preview → review → confirm) ───
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadLoading(true);
        setUploadResult(null);

        try {
            // For the first file, use preview API
            const file = files[0];
            setUploadProgress(`${file.name} 분석 중...`);
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/purchase/upload/preview', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000, // 60s — PDF parsing can take longer
            });

            if (response.data.status === 'error') {
                setUploadResult([{ file: file.name, status: 'error', message: response.data.message }]);
                return;
            }

            const preview = response.data;
            setPreviewData(preview);

            // If there are vendors to review, show modal
            if (preview.vendor_review && preview.vendor_review.length > 0) {
                // Initialize decisions
                const initialDecisions = {};
                preview.vendor_review.forEach(vr => {
                    if (vr.is_new) {
                        initialDecisions[vr.vendor_name] = {
                            action: 'new',
                            category: null,
                        };
                    } else {
                        initialDecisions[vr.vendor_name] = {
                            action: null,
                            vendor_id: null,
                            category: null,
                        };
                    }
                });
                setVendorDecisions(initialDecisions);
                setExcludedVendors(new Set());
                setShowVendorReview(true);
            } else {
                // No vendors to review — confirm directly
                await confirmUpload(preview.records, {});
            }

            // Handle remaining files with direct upload
            if (files.length > 1) {
                let extraResults = [];
                for (let i = 1; i < files.length; i++) {
                    const extraFile = files[i];
                    setUploadProgress(`(${i + 1}/${files.length}) ${extraFile.name} 처리 중...`);
                    const extraForm = new FormData();
                    extraForm.append('file', extraFile);
                    try {
                        const extraRes = await api.post('/purchase/upload', extraForm, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        extraResults.push({ file: extraFile.name, ...extraRes.data });
                    } catch (error) {
                        extraResults.push({ file: extraFile.name, status: 'error', message: error.response?.data?.detail || '업로드 실패' });
                    }
                }
                if (extraResults.length > 0) {
                    setUploadResult(prev => [...(prev || []), ...extraResults]);
                }
            }
        } catch (error) {
            let msg = '업로드 실패';
            if (error.code === 'ECONNABORTED') {
                msg = 'PDF 파싱 시간 초과 (60초). 파일 크기를 확인하세요.';
            } else if (error.response?.data?.detail) {
                msg = typeof error.response.data.detail === 'string'
                    ? error.response.data.detail
                    : JSON.stringify(error.response.data.detail);
            } else if (error.message) {
                msg = error.message;
            }
            console.error('Upload error:', error);
            setUploadResult([{ file: files[0].name, status: 'error', message: msg }]);
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const confirmUpload = async (records, decisions) => {
        setConfirmLoading(true);
        try {
            const response = await api.post('/purchase/upload/confirm', {
                records,
                vendor_decisions: decisions,
            });
            setUploadResult(prev => [
                ...(prev || []),
                { file: previewData?.card_company || '업로드', ...response.data }
            ]);
            setShowVendorReview(false);
            setPreviewData(null);
            setVendorDecisions({});
            fetchData();
        } catch (error) {
            alert('업로드 확인 중 오류가 발생했습니다: ' + (error.response?.data?.detail || error.message));
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleVendorDecision = (vendorName, action, vendorId = null) => {
        setVendorDecisions(prev => ({
            ...prev,
            [vendorName]: {
                action,
                vendor_id: vendorId,
                category: action === 'merge' ? null : prev[vendorName]?.category,
            }
        }));
        if (action === 'new') {
            setShowNewCategoryFor(vendorName);
        }
    };

    const handleNewVendorCategory = (vendorName, category) => {
        setVendorDecisions(prev => ({
            ...prev,
            [vendorName]: {
                ...prev[vendorName],
                action: 'new',
                category,
            }
        }));
        setShowNewCategoryFor(null);
    };

    const toggleExcludeVendor = (vendorName) => {
        setExcludedVendors(prev => {
            const next = new Set(prev);
            if (next.has(vendorName)) next.delete(vendorName);
            else next.add(vendorName);
            return next;
        });
    };

    const canConfirmUpload = () => {
        if (!previewData?.vendor_review) return true;
        return previewData.vendor_review.every(vr => {
            if (excludedVendors.has(vr.vendor_name)) return true;
            const dec = vendorDecisions[vr.vendor_name];
            if (!dec) return false;
            if (dec.action === 'merge' && dec.vendor_id) return true;
            if (dec.action === 'new' && dec.category) return true;
            return false;
        });
    };

    // ─── Summary values ───
    const totalAmount = summary.total || 0;
    const totalCount = summary.count || 0;
    const categoryData = summary.by_category || {};
    const cardData = summary.by_card_company || {};
    const bankData = summary.by_bank_transfer || {};
    const topVendors = summary.top_vendors || [];

    return (
        <div className="purchase-page">
            {/* ── Header ── */}
            <div className="purchase-header">
                <div className="purchase-header-top">
                    <h1>
                        <button onClick={() => navigate(-1)} className="purchase-back-btn">
                            <ChevronLeft size={18} />
                        </button>
                        <ShoppingBag size={22} />
                        매입 관리
                    </h1>
                    <div className="purchase-month-nav">
                        <button onClick={prevMonth}><ChevronLeft size={16} /></button>
                        <span className="purchase-month-label">{year}년 {month}월</span>
                        <button onClick={nextMonth}><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="purchase-summary-row">
                <div className="purchase-summary-card total">
                    <div className="card-label">💰 사업용 총 매입</div>
                    <div className="card-value">{formatNumber(businessTotal)}원</div>
                    <div className="card-sub">개인가계부 제외</div>
                </div>
                <div className="purchase-summary-card personal" onClick={() => setViewMode('household')}>
                    <div className="card-label">👤 개인가계부</div>
                    <div className="card-value">{formatNumber(personalTotal)}원</div>
                    <div className="card-sub">별도 관리됨</div>
                </div>

                {EXPENSE_CATEGORIES.slice(0, 2).map(cat => {
                    const catInfo = categoryData[cat.id];
                    return (
                        <div className="purchase-summary-card" key={cat.id}>
                            <div className="card-label">{cat.icon} {cat.label}</div>
                            <div className="card-value">{formatNumber(catInfo?.amount || 0)}원</div>
                            <div className="card-sub">{catInfo?.count || 0}건</div>
                        </div>
                    );
                })}
            </div>

            {/* ── Tab Bar ── */}
            <div className="purchase-tab-bar">
                <div className="view-mode-toggle">
                    <button className={`view-mode-btn ${viewMode === 'dashboard' ? 'active' : ''}`} onClick={() => setViewMode('dashboard')}>
                        📊 대시보드
                    </button>
                    <button className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>
                        📋 사업용 내역
                    </button>
                    <button className={`view-mode-btn ${viewMode === 'household' ? 'active' : ''}`} onClick={() => setViewMode('household')}>
                        📒 가계부
                    </button>
                    <button className={`view-mode-btn ${viewMode === 'upload' ? 'active' : ''}`} onClick={() => setViewMode('upload')}>
                        📤 업로드
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* DASHBOARD VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'dashboard' && (
                <div className="purchase-dashboard">
                    {/* Category Breakdown */}
                    <div className="dashboard-section">
                        <h3>📂 카테고리별 매입 현황</h3>
                        <div className="category-bars">
                            {EXPENSE_CATEGORIES.map(cat => {
                                const catInfo = categoryData[cat.id];
                                const amount = catInfo?.amount || 0;
                                const pct = totalAmount > 0 ? (amount / totalAmount * 100) : 0;
                                if (amount === 0) return null;
                                return (
                                    <div className="category-bar-item" key={cat.id}>
                                        <div className="bar-label">
                                            <span>{cat.icon} {cat.label}</span>
                                            <span className="bar-amount">{formatNumber(amount)}원 ({pct.toFixed(1)}%)</span>
                                        </div>
                                        <div className="bar-track">
                                            <div className="bar-fill" style={{ width: `${pct}%`, background: cat.color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card + Bank side by side */}
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {/* Card Company Breakdown */}
                        <div className="dashboard-section" style={{ flex: 1, minWidth: 0 }}>
                            <h3>💳 카드사별 매입 현황</h3>
                            <div className="card-company-grid">
                                {Object.entries(cardData).filter(([k]) => k !== '기타').sort((a, b) => b[1].amount - a[1].amount).map(([card, info]) => {
                                    const colors = CARD_COLORS[card] || CARD_COLORS['기타'];
                                    return (
                                        <div className="card-company-item" key={card} style={{ background: colors.bg, borderColor: colors.border }}>
                                            <div className="cc-name" style={{ color: colors.text }}>{card}</div>
                                            <div className="cc-amount">{formatNumber(info.amount)}원</div>
                                            <div className="cc-count">{info.count}건</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Bank Transfer Breakdown */}
                        <div className="dashboard-section" style={{ flex: 1, minWidth: 0 }}>
                            <h3>🏦 계좌이체 현황</h3>
                            <div className="card-company-grid">
                                {Object.keys(bankData).length > 0 ? (
                                    Object.entries(bankData).sort((a, b) => b[1].amount - a[1].amount).map(([bank, info]) => {
                                        const colors = CARD_COLORS[bank] || { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
                                        return (
                                            <div className="card-company-item" key={bank} style={{ background: colors.bg, borderColor: colors.border }}>
                                                <div className="cc-name" style={{ color: colors.text }}>{bank}</div>
                                                <div className="cc-amount">{formatNumber(info.amount)}원</div>
                                                <div className="cc-count">{info.count}건</div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div style={{ color: '#9ca3af', padding: '20px', textAlign: 'center' }}>계좌이체 내역 없음</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Top Vendors */}
                    <div className="dashboard-section">
                        <h3>🏆 TOP 10 거래처</h3>
                        <div className="top-vendors-list">
                            {topVendors.map((v, i) => (
                                <div className="top-vendor-item" key={v.name}>
                                    <span className="tv-rank">{i + 1}</span>
                                    <span className="tv-name">{v.name}</span>
                                    <span className="tv-count">{v.count}건</span>
                                    <span className="tv-amount">{formatNumber(v.amount)}원</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* LIST / HOUSEHOLD VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {(viewMode === 'list' || viewMode === 'household') && (
                <div className="purchase-content">
                    <div className="purchase-toolbar">
                        <div className="toolbar-left">
                            <div className="search-box">
                                <Search size={16} />
                                <input
                                    type="text"
                                    placeholder="거래처 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {!isHouseholdMode && (
                                <select
                                    className="category-filter"
                                    value={filterCategory}
                                    onChange={e => setFilterCategory(e.target.value)}
                                >
                                    <option value="all">전체 카테고리</option>
                                    {EXPENSE_CATEGORIES.filter(c => c.id !== '개인가계부').map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                            )}

                            {isHouseholdMode && (
                                <div className="household-badge">
                                    📒 가계부 모드 (개인가계부만 표시)
                                </div>
                            )}
                        </div>
                        <div className="toolbar-right">
                            <span className="count-badge">총 {filteredData.length}건</span>
                            <button className="purchase-add-btn" onClick={openAddModal}>
                                <Plus size={16} /> {isHouseholdMode ? '생활비 추가' : '매입 추가'}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="purchase-loading">
                            <div className="spinner" />
                            <p>불러오는 중...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="purchase-empty">
                            <div className="purchase-empty-icon">{isHouseholdMode ? '📒' : '📋'}</div>
                            <h3>{isHouseholdMode ? '개인 생활비 내역이 없습니다' : '사업용 매입 내역이 없습니다'}</h3>
                            <p>{year}년 {month}월</p>
                        </div>
                    ) : (
                        <div className="purchase-list">
                            {sortedDates.map(dateStr => {
                                const items = groupedByDate[dateStr];
                                const dayTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
                                const weekday = getWeekday(dateStr);
                                const dayNum = dateStr.split('-')[2];

                                return (
                                    <div className="day-group" key={dateStr}>
                                        <div className="day-group-header">
                                            <button
                                                className="day-select-btn"
                                                onClick={() => toggleSelectDay(items)}
                                                title="이 날짜 전체 선택/해제"
                                            >
                                                {items.every(i => selectedIds.has(i.id))
                                                    ? <CheckSquare size={16} className="checked" />
                                                    : <Square size={16} />}
                                            </button>
                                            <span className="day-date" onClick={() => toggleDateCollapse(dateStr)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {collapsedDates.has(dateStr) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                📅 {month}/{dayNum} ({weekday})
                                            </span>
                                            <span className="day-count">{items.length}건</span>
                                            <span className="day-total">{formatNumber(dayTotal)}원</span>
                                        </div>
                                        {!collapsedDates.has(dateStr) && (
                                            <div className="day-items">
                                                {items.map(item => {
                                                    const cardCompany = getCardCompany(item.note);
                                                    const cardColor = getCardColor(item.note);
                                                    const catInfo = EXPENSE_CATEGORIES.find(c => c.id === item.category) || EXPENSE_CATEGORIES[5];

                                                    return (
                                                        <div className={`purchase-item ${selectedIds.has(item.id) ? 'selected' : ''}`} key={item.id}>
                                                            <label className="item-checkbox" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedIds.has(item.id)}
                                                                    onChange={() => toggleSelect(item.id)}
                                                                />
                                                            </label>
                                                            <div className="item-left">
                                                                <div className="item-vendor">{item.vendor_name}</div>
                                                                <div className="item-meta">
                                                                    {cardCompany && (
                                                                        <span className="card-badge" style={{ background: cardColor.bg, color: cardColor.text, borderColor: cardColor.border }}>
                                                                            {cardCompany}
                                                                        </span>
                                                                    )}
                                                                    <span className="cat-badge" style={{ color: catInfo.color }}>
                                                                        {catInfo.icon} {catInfo.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="item-right">
                                                                <div className="item-amount">{formatNumber(item.amount)}원</div>
                                                                <div className="item-actions">
                                                                    <button
                                                                        className="action-btn toggle-type"
                                                                        onClick={() => toggleCategory(item)}
                                                                        title={isHouseholdMode ? "사업비용으로 변경" : "개인비용으로 변경"}
                                                                    >
                                                                        <ArrowRightLeft size={14} />
                                                                    </button>
                                                                    <button className="action-btn" onClick={() => openEditModal(item)} title="수정">
                                                                        <Edit3 size={14} />
                                                                    </button>
                                                                    <button className="action-btn delete" onClick={() => handleDelete(item.id)} title="삭제">
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Batch Action Bar ── */}
                    {selectedIds.size > 0 && (
                        <div className="batch-action-bar">
                            <span className="batch-count">✅ {selectedIds.size}건 선택</span>
                            <div className="batch-actions">
                                <select
                                    className="batch-category-select"
                                    defaultValue=""
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            handleBatchCategory(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                >
                                    <option value="" disabled>📂 카테고리 변경</option>
                                    {EXPENSE_CATEGORIES.map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                                {!isHouseholdMode && (
                                    <button className="batch-btn personal" onClick={() => handleBatchCategory('개인가계부')}>
                                        👤 개인비용 전환
                                    </button>
                                )}
                                {isHouseholdMode && (
                                    <button className="batch-btn business" onClick={() => handleBatchCategory('기타비용')}>
                                        💼 사업비용 전환
                                    </button>
                                )}
                                <button className="batch-btn delete" onClick={handleBatchDelete}>
                                    🗑️ 삭제
                                </button>
                                <button className="batch-btn cancel" onClick={() => setSelectedIds(new Set())}>
                                    ✕ 선택해제
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* UPLOAD VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'upload' && (
                <div className="purchase-upload upload-mode">
                    <div className="upload-section">
                        <div className="upload-tabs">
                            <button
                                className={`upload-tab-btn ${uploadTab === 'excel' ? 'active excel' : ''}`}
                                onClick={() => setUploadTab('excel')}
                            >
                                <FileSpreadsheet size={16} /> 엑셀/PDF 업로드
                            </button>
                            <button
                                className={`upload-tab-btn ${uploadTab === 'history' ? 'active history' : ''}`}
                                onClick={() => setUploadTab('history')}
                            >
                                <RotateCcw size={16} /> 취소/기록
                            </button>
                        </div>

                        {uploadTab === 'history' ? (
                            <div className="upload-history-wrapper">
                                <UploadHistorySection onRollback={fetchData} />
                            </div>
                        ) : (
                            <>
                                <div
                                    className="upload-drop-zone"
                                    onClick={() => !uploadLoading && fileInputRef.current?.click()}
                                >
                                    {uploadLoading ? (
                                        <div className="upload-loading">
                                            <div className="spinner" />
                                            <p>{uploadProgress || '처리 중입니다...'}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="upload-icon-box excel">
                                                <UploadCloud size={32} />
                                            </div>
                                            <p className="upload-main-text">
                                                클릭하여 엑셀/PDF 파일 선택
                                            </p>
                                            <p className="upload-sub-text">
                                                카드사 이용내역 .xls, .xlsx, .pdf 파일 — 여러 파일 동시 가능
                                            </p>
                                            <div className="supported-cards" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center', marginTop: 12 }}>
                                                {Object.entries(CARD_COLORS).filter(([k]) => k !== '기타').map(([card, colors]) => (
                                                    <span className="supported-card-badge" key={card} style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                                                        {card}
                                                    </span>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".xls,.xlsx,.pdf"
                                    multiple
                                    onChange={handleUpload}
                                    style={{ display: 'none' }}
                                />

                                {/* Upload Results */}
                                {uploadResult && (
                                    <div className="upload-results" style={{ marginTop: 16 }}>
                                        {uploadResult.map((r, i) => (
                                            <div className={`upload-result-item ${r.status}`} key={i}>
                                                <div className="ur-file">{r.file}</div>
                                                {r.status === 'success' ? (
                                                    <div className="ur-detail">
                                                        <span className="ur-card">{r.card_company}</span>
                                                        <span className="ur-count">✅ {r.count}건 저장</span>
                                                        {r.skipped > 0 && <span className="ur-skipped">⏭️ {r.skipped}건 중복</span>}
                                                        {r.vendors_created > 0 && <span className="ur-vendors">🏪 {r.vendors_created}개 거래처 생성</span>}
                                                        {r.auto_classified > 0 && <span className="ur-auto">🤖 {r.auto_classified}건 자동분류</span>}
                                                    </div>
                                                ) : (
                                                    <div className="ur-error">❌ {r.message}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* ADD/EDIT MODAL */}
            {/* ═══════════════════════════════════════════ */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{modalMode === 'add' ? '매입 추가' : '매입 수정'}</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>거래처명</label>
                                <input
                                    type="text"
                                    value={form.vendor_name}
                                    onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                                    placeholder="예: 다인푸드, (주)가락봉투"
                                />
                            </div>
                            <div className="form-group">
                                <label>날짜</label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>금액</label>
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div className="form-group">
                                <label>
                                    카테고리
                                    <button
                                        type="button"
                                        className="category-helper-btn"
                                        onClick={() => setShowCategoryHelper(true)}
                                        title="카테고리 선택 도우미"
                                    >
                                        ❓ 선택도우미
                                    </button>
                                </label>
                                <div className="category-chips">
                                    {EXPENSE_CATEGORIES.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`category-chip ${form.category === c.id ? 'active' : ''}`}
                                            onClick={() => setForm({ ...form, category: c.id })}
                                            style={form.category === c.id ? { background: c.color, borderColor: c.color } : {}}
                                        >
                                            {c.icon} {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="form-group">
                                <label>비고</label>
                                <input
                                    type="text"
                                    value={form.note}
                                    onChange={e => setForm({ ...form, note: e.target.value })}
                                    placeholder="메모 (선택)"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn-cancel" onClick={() => setShowModal(false)}>취소</button>
                            <button className="btn-save" onClick={handleSubmit}>
                                {modalMode === 'add' ? '추가' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 카테고리 선택 도우미 모달 */}
            {showCategoryHelper && (
                <div className="modal-overlay" onClick={() => setShowCategoryHelper(false)} style={{ zIndex: 1100 }}>
                    <div className="modal-content category-helper-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '80vh', overflow: 'auto' }}>
                        <div className="modal-header">
                            <h3>❓ 카테고리 선택 도우미</h3>
                            <button className="modal-close" onClick={() => setShowCategoryHelper(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ padding: '12px 16px' }}>
                            <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 12 }}>
                                한국 개인사업자 회계기준에 맞춤 카테고리입니다. 카테고리를 클릭하면 선택됩니다.
                            </p>
                            {EXPENSE_CATEGORIES.map(cat => {
                                const help = CATEGORY_HELP_DATA[cat.id];
                                if (!help) return null;
                                return (
                                    <div
                                        key={cat.id}
                                        className="category-helper-item"
                                        onClick={() => { setForm(f => ({ ...f, category: cat.id })); setShowCategoryHelper(false); }}
                                        style={{
                                            padding: '10px 14px', marginBottom: 8, borderRadius: 10,
                                            background: form.category === cat.id ? `${cat.color}18` : '#1e293b',
                                            border: `1px solid ${form.category === cat.id ? cat.color : '#334155'}`,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                        }}
                                    >
                                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                                            {cat.icon} {cat.label}
                                            <span style={{ fontWeight: 400, fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>{help.desc}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                            {help.items.map((item, i) => (
                                                <span key={i} style={{ fontSize: 11, color: '#64748b', background: '#0f172a', padding: '2px 8px', borderRadius: 6 }}>
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* VENDOR REVIEW MODAL (2-step upload) */}
            {/* ═══════════════════════════════════════════ */}
            {showVendorReview && previewData && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>🔍 거래처 확인 ({previewData.card_company})</h3>
                            <button className="modal-close" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {/* Summary */}
                            <div style={{ background: '#0f172a', borderRadius: 12, padding: '14px 18px', marginBottom: 16 }}>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
                                    <span style={{ color: '#94a3b8' }}>📋 총 파싱: <strong style={{ color: '#e2e8f0' }}>{previewData.total_parsed}건</strong></span>
                                    {previewData.auto_classified > 0 && (
                                        <span style={{ color: '#94a3b8' }}>🤖 자동분류: <strong style={{ color: '#38bdf8' }}>{previewData.auto_classified}건</strong></span>
                                    )}
                                    <span style={{ color: '#94a3b8' }}>🔍 확인 필요: <strong style={{ color: '#fb923c' }}>{previewData.vendor_review.length}건</strong></span>
                                    {excludedVendors.size > 0 && (
                                        <span style={{ color: '#ef4444' }}>🚫 제외: <strong>{excludedVendors.size}개 거래처</strong></span>
                                    )}
                                </div>
                            </div>

                            {/* Vendor Review List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {previewData.vendor_review.map((vr, idx) => {
                                    const dec = vendorDecisions[vr.vendor_name] || {};
                                    const isExcluded = excludedVendors.has(vr.vendor_name);
                                    const isDecided = isExcluded || (dec.action === 'merge' && dec.vendor_id) || (dec.action === 'new' && dec.category);

                                    return (
                                        <div key={idx} style={{
                                            background: isDecided ? '#0f291a' : '#1e293b',
                                            border: `1px solid ${isDecided ? '#16a34a' : '#334155'}`,
                                            borderRadius: 12,
                                            padding: '14px 16px',
                                            transition: 'all 0.2s',
                                        }}>
                                            {/* Vendor Name Header */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isExcluded ? 0 : 10 }}>
                                                <div>
                                                    <span style={{ fontWeight: 700, fontSize: 15, color: isExcluded ? '#64748b' : '#f1f5f9', textDecoration: isExcluded ? 'line-through' : 'none' }}>
                                                        {vr.vendor_name}
                                                    </span>
                                                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                                                        {vr.record_count}건 · {formatNumber(vr.total_amount)}원
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    {isExcluded ? (
                                                        <button onClick={() => toggleExcludeVendor(vr.vendor_name)}
                                                            style={{ fontSize: 11, background: '#334155', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #475569', cursor: 'pointer' }}>
                                                            ↩ 복원
                                                        </button>
                                                    ) : (
                                                        <>
                                                            {isDecided && (
                                                                <span style={{ fontSize: 11, background: '#16a34a', color: '#fff', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                                                                    ✓ 결정완료
                                                                </span>
                                                            )}
                                                            <button onClick={() => toggleExcludeVendor(vr.vendor_name)}
                                                                style={{ fontSize: 11, background: '#7f1d1d', color: '#fca5a5', padding: '4px 10px', borderRadius: 6, fontWeight: 600, border: '1px solid #991b1b', cursor: 'pointer' }}>
                                                                🚫 제외
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {!isExcluded && (<>
                                                {/* Similar Vendors */}
                                                {vr.similar_vendors.length > 0 && (
                                                    <div style={{ marginBottom: 10 }}>
                                                        <div style={{ fontSize: 12, color: '#fb923c', fontWeight: 600, marginBottom: 6 }}>
                                                            ⚠️ 유사한 기존 거래처가 있습니다:
                                                        </div>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                            {vr.similar_vendors.map(sv => (
                                                                <button
                                                                    key={sv.id}
                                                                    onClick={() => handleVendorDecision(vr.vendor_name, 'merge', sv.id)}
                                                                    style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        padding: '8px 12px', borderRadius: 8,
                                                                        background: dec.action === 'merge' && dec.vendor_id === sv.id ? '#1e3a5f' : '#0f172a',
                                                                        border: `1px solid ${dec.action === 'merge' && dec.vendor_id === sv.id ? '#3b82f6' : '#1e293b'}`,
                                                                        color: '#e2e8f0', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                                                                        transition: 'all 0.15s', width: '100%',
                                                                    }}
                                                                >
                                                                    <span>
                                                                        🏪 <strong>{sv.name}</strong>
                                                                        <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>({sv.category})</span>
                                                                    </span>
                                                                    <span style={{ fontSize: 12, color: '#3b82f6' }}>→ 동일 거래처로 병합</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* New Vendor Button */}
                                                <button
                                                    onClick={() => handleVendorDecision(vr.vendor_name, 'new')}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        padding: '8px 12px', borderRadius: 8,
                                                        background: dec.action === 'new' ? '#1a2e1a' : '#0f172a',
                                                        border: `1px solid ${dec.action === 'new' ? '#16a34a' : '#1e293b'}`,
                                                        color: dec.action === 'new' ? '#4ade80' : '#94a3b8',
                                                        cursor: 'pointer', fontSize: 13, width: '100%',
                                                        transition: 'all 0.15s',
                                                    }}
                                                >
                                                    ➕ 신규 거래처로 등록
                                                    {dec.action === 'new' && dec.category && (
                                                        <span style={{ marginLeft: 'auto', fontSize: 12, background: '#16a34a20', padding: '2px 8px', borderRadius: 6 }}>
                                                            {EXPENSE_CATEGORIES.find(c => c.id === dec.category)?.icon} {dec.category}
                                                        </span>
                                                    )}
                                                </button>

                                                {/* Category Selection for New Vendor */}
                                                {showNewCategoryFor === vr.vendor_name && (
                                                    <div style={{ marginTop: 10, background: '#0f172a', borderRadius: 10, padding: 12, border: '1px solid #334155' }}>
                                                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8, fontWeight: 600 }}>📂 카테고리를 선택하세요:</div>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                            {EXPENSE_CATEGORIES.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    onClick={() => handleNewVendorCategory(vr.vendor_name, cat.id)}
                                                                    style={{
                                                                        padding: '6px 10px', borderRadius: 8, fontSize: 12,
                                                                        background: dec.category === cat.id ? `${cat.color}30` : '#1e293b',
                                                                        border: `1px solid ${dec.category === cat.id ? cat.color : '#334155'}`,
                                                                        color: dec.category === cat.id ? cat.color : '#94a3b8',
                                                                        cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s',
                                                                    }}
                                                                >
                                                                    {cat.icon} {cat.label}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </>)}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button className="btn-cancel" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>취소</button>
                            <button
                                className="btn-save"
                                disabled={!canConfirmUpload() || confirmLoading}
                                onClick={() => {
                                    const filtered = previewData.records.filter(r => !excludedVendors.has(r.vendor_name));
                                    confirmUpload(filtered, vendorDecisions);
                                }}
                                style={{
                                    opacity: canConfirmUpload() ? 1 : 0.5,
                                    background: canConfirmUpload() ? 'linear-gradient(135deg, #22c55e, #059669)' : '#334155',
                                    color: '#fff',
                                    border: 'none',
                                    padding: '12px 28px',
                                    borderRadius: 12,
                                    fontSize: 15,
                                    fontWeight: 800,
                                    cursor: canConfirmUpload() ? 'pointer' : 'not-allowed',
                                    boxShadow: canConfirmUpload() ? '0 4px 20px rgba(34, 197, 94, 0.4)' : 'none',
                                    transition: 'all 0.3s ease',
                                    letterSpacing: '0.5px',
                                }}
                            >
                                {confirmLoading ? '⏳ 저장 중...' : `🚀 ${previewData.total_parsed - previewData.records.filter(r => excludedVendors.has(r.vendor_name)).length}건 업로드 확인`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─── Upload History Sub-component ───
function UploadHistorySection({ onRollback }) {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/uploads/history', { params: { type: 'purchase' } });
            setHistory(res.data || []);
        } catch (err) {
            console.error('History fetch error:', err);
        }
    };

    const handleRollback = async (id) => {
        if (!window.confirm('이 업로드를 롤백하시겠습니까? 해당 업로드로 추가된 모든 데이터가 삭제됩니다.')) return;
        try {
            await api.delete(`/uploads/${id}`);
            fetchHistory();
            onRollback?.();
        } catch (err) {
            console.error('Rollback error:', err);
            alert('롤백 실패');
        }
    };

    if (history.length === 0) {
        return <p style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center', padding: 20 }}>업로드 이력이 없습니다.</p>;
    }

    return (
        <div className="upload-history-list">
            {history.map(h => (
                <div className={`history-item ${h.status}`} key={h.id}>
                    <div className="hi-info">
                        <span className="hi-filename">{h.filename}</span>
                        <span className="hi-meta">
                            {h.record_count}건 · {new Date(h.created_at).toLocaleString('ko-KR')}
                        </span>
                    </div>
                    <div className="hi-actions">
                        {h.status === 'active' ? (
                            <button className="hi-rollback" onClick={() => handleRollback(h.id)}>
                                <RotateCcw size={14} /> 롤백
                            </button>
                        ) : (
                            <span className="hi-rolled-back">롤백됨</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
