import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit3, Trash2, ShoppingBag, UploadCloud, RotateCcw, X, Search, Filter, Wallet, ArrowRightLeft, CheckSquare, Square } from 'lucide-react';
import api from '../api';
import './PurchaseManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Card company colors
const CARD_COLORS = {
    '롯데카드': { bg: '#fee2e2', text: '#dc2626', border: '#fca5a5' },
    '삼성카드': { bg: '#dbeafe', text: '#2563eb', border: '#93c5fd' },
    '신한카드': { bg: '#d1fae5', text: '#059669', border: '#6ee7b7' },
    '신한은행': { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' },
    '현대카드': { bg: '#f3f4f6', text: '#1f2937', border: '#d1d5db' },
    '기타': { bg: '#fef3c7', text: '#d97706', border: '#fcd34d' },
};

const EXPENSE_CATEGORIES = [
    { id: '재료비', label: '재료비', icon: '🥬', color: '#10b981' },
    { id: '제세공과금', label: '제세공과금', icon: '🏛️', color: '#6366f1' },
    { id: '임대관리비', label: '임대관리비', icon: '🏠', color: '#8b5cf6' },
    { id: '개인생활비', label: '개인생활비', icon: '👤', color: '#f59e0b' },
    { id: '카드수수료', label: '카드수수료', icon: '💳', color: '#ef4444' },
    { id: '기타비용', label: '기타비용', icon: '📦', color: '#64748b' },
];

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
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [viewMode, setViewMode] = useState('dashboard'); // dashboard | list | household | upload
    const [data, setData] = useState([]);
    const [summary, setSummary] = useState({ total: 0, count: 0, by_category: {}, by_card_company: {}, top_vendors: [] });
    const [loading, setLoading] = useState(false);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ vendor_name: '', date: '', amount: '', category: '기타비용', note: '' });

    // Upload
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [uploadResult, setUploadResult] = useState(null);
    const fileInputRef = useRef(null);

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
            setSummary(summaryRes.data || { total: 0, count: 0, by_category: {}, by_card_company: {}, top_vendors: [] });
        } catch (err) {
            console.error('Purchase fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [year, month]);

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
    // 'household' view only shows '개인생활비'
    // 'list' view shows everything EXCEPT '개인생활비'
    const isHouseholdMode = viewMode === 'household';

    const filteredData = data.filter(d => {
        const isPersonal = d.category === '개인생활비';

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
    const personalTotal = (summary.by_category?.['개인생활비']?.amount || 0);
    const businessTotal = (summary.total || 0) - personalTotal;

    // ─── CRUD ───
    const openAddModal = () => {
        const today = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        // Default category based on view mode
        const defaultCat = isHouseholdMode ? '개인생활비' : '기타비용';
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
            console.error(err);
            alert('삭제 실패');
        }
    };

    // Quick Toggle: Business <-> Personal
    const toggleCategory = async (record) => {
        const isPersonal = record.category === '개인생활비';
        const newCategory = isPersonal ? '기타비용' : '개인생활비';
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

    // ─── Upload ───
    const handleUpload = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadLoading(true);
        setUploadResult(null);

        let results = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(`(${i + 1}/${files.length}) ${file.name} 처리 중...`);
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const response = await api.post('/purchase/upload', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    results.push({ file: file.name, ...response.data });
                } catch (error) {
                    results.push({ file: file.name, status: 'error', message: error.response?.data?.detail || '업로드 실패' });
                }
            }
            setUploadResult(results);
            fetchData();
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ─── Summary values ───
    const totalAmount = summary.total || 0;
    const totalCount = summary.count || 0;
    const categoryData = summary.by_category || {};
    const cardData = summary.by_card_company || {};
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
                    <div className="card-sub">개인생활비 제외</div>
                </div>
                <div className="purchase-summary-card personal" onClick={() => setViewMode('household')}>
                    <div className="card-label">👤 개인생활비 (가계부)</div>
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

                    {/* Card Company Breakdown */}
                    <div className="dashboard-section">
                        <h3>💳 카드사별 매입 현황</h3>
                        <div className="card-company-grid">
                            {Object.entries(cardData).sort((a, b) => b[1].amount - a[1].amount).map(([card, info]) => {
                                const colors = CARD_COLORS[card] || CARD_COLORS['기타'];
                                return (
                                    <div className="card-company-item" key={card} style={{ background: colors.bg, borderColor: colors.border }}>
                                        <div className="cc-name" style={{ color: colors.text }}>{card || '기타'}</div>
                                        <div className="cc-amount">{formatNumber(info.amount)}원</div>
                                        <div className="cc-count">{info.count}건</div>
                                    </div>
                                );
                            })}
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
                                    {EXPENSE_CATEGORIES.filter(c => c.id !== '개인생활비').map(c => (
                                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                    ))}
                                </select>
                            )}

                            {isHouseholdMode && (
                                <div className="household-badge">
                                    📒 가계부 모드 (개인생활비만 표시)
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
                                            <span className="day-date">📅 {month}/{dayNum} ({weekday})</span>
                                            <span className="day-count">{items.length}건</span>
                                            <span className="day-total">{formatNumber(dayTotal)}원</span>
                                        </div>
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
                                    <button className="batch-btn personal" onClick={() => handleBatchCategory('개인생활비')}>
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
                <div className="purchase-upload">
                    <div className="upload-section">
                        <h3>📤 카드사/은행 엑셀 업로드</h3>
                        <p className="upload-desc">
                            카드사에서 다운받은 이용내역 엑셀 파일을 업로드하세요.<br />
                            롯데카드, 삼성카드, 신한카드, 신한은행, 현대카드를 자동 인식합니다.
                        </p>

                        <div className="supported-cards">
                            {Object.entries(CARD_COLORS).filter(([k]) => k !== '기타').map(([card, colors]) => (
                                <span className="supported-card-badge" key={card} style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
                                    {card}
                                </span>
                            ))}
                        </div>

                        <div
                            className={`upload-dropzone ${uploadLoading ? 'uploading' : ''}`}
                            onClick={() => !uploadLoading && fileInputRef.current?.click()}
                        >
                            {uploadLoading ? (
                                <>
                                    <div className="spinner" />
                                    <p>{uploadProgress}</p>
                                </>
                            ) : (
                                <>
                                    <UploadCloud size={40} />
                                    <p><strong>클릭</strong> 또는 <strong>드래그</strong>하여 파일 업로드</p>
                                    <span className="upload-hint">.xls, .xlsx 파일 (여러 파일 동시 가능)</span>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xls,.xlsx"
                            multiple
                            onChange={handleUpload}
                            style={{ display: 'none' }}
                        />

                        {/* Upload Results */}
                        {uploadResult && (
                            <div className="upload-results">
                                <h4>📋 업로드 결과</h4>
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
                    </div>

                    {/* Upload History */}
                    <div className="upload-section">
                        <h3>📜 업로드 이력</h3>
                        <UploadHistorySection onRollback={fetchData} />
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
                                <label>카테고리</label>
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
