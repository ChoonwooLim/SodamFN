import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit3, Trash2, TrendingUp, Camera, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react';
import axios from 'axios';
import api from '../api';
import UploadHistoryList from '../components/UploadHistoryList';
import './RevenueManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── PL Revenue (수입상세) ──
const PL_REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출', icon: '🏪' },
    { key: 'revenue_coupang', label: '쿠팡 정산금', icon: '🛒' },
    { key: 'revenue_baemin', label: '배민 정산금', icon: '🏍️' },
    { key: 'revenue_yogiyo', label: '요기요 정산금', icon: '🍜' },
    { key: 'revenue_ddangyo', label: '땡겨요 정산금', icon: '📱' },
];
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// ── Delivery Channels (배달앱) ──
const DELIVERY_CHANNELS = [
    { id: 'coupang', label: '쿠팡이츠', apiKey: 'Coupang', icon: '🛒' },
    { id: 'baemin', label: '배달의민족', apiKey: 'Baemin', icon: '🏍️' },
    { id: 'yogiyo', label: '요기요', apiKey: 'Yogiyo', icon: '🍜' },
    { id: 'ddangyo', label: '땡겨요', apiKey: 'Ddangyo', icon: '📱' },
];

const CATEGORY_LABELS = {
    store: { label: '매장매출', icon: '🏪', badge: 'store' },
    delivery: { label: '배달앱매출', icon: '🛵', badge: 'delivery' },
};

const REVENUE_CATEGORIES = [
    { id: 'store', label: '매장매출', icon: '🏪' },
    { id: 'delivery', label: '배달앱매출', icon: '🛵' },
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

export default function RevenueManagement() {
    const navigate = useNavigate();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [tab, setTab] = useState('all'); // all | store | delivery
    const [viewMode, setViewMode] = useState('list'); // list | grid | revenueDetail | deliveryApp | upload
    const [data, setData] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [summary, setSummary] = useState({ total: 0, by_category: {} });
    const [loading, setLoading] = useState(false);

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add');
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ vendor_id: '', date: '', amount: '', note: '' });

    // Grid inline edit
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Grid: hide empty vendors
    const [hideEmpty, setHideEmpty] = useState(false);

    // Upload mode
    const [uploadTab, setUploadTab] = useState('excel');
    const [uploadLoading, setUploadLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // ── 수입상세 (Annual PL Revenue) ──
    const [plYear, setPlYear] = useState(now.getFullYear());
    const [plData, setPlData] = useState([]);

    // ── 배달앱 (Delivery App) ──
    const [deliveryChannel, setDeliveryChannel] = useState('coupang');
    const [deliveryAppData, setDeliveryAppData] = useState({});

    // ─── Fetch ───
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [dailyRes, summaryRes] = await Promise.all([
                api.get('/revenue/daily', { params: { year, month } }),
                api.get('/revenue/summary', { params: { year, month } }),
            ]);
            setData(dailyRes.data.data || []);
            setVendors(dailyRes.data.vendors || []);
            setSummary(summaryRes.data || { total: 0, by_category: {} });
        } catch (err) {
            console.error('Revenue fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [year, month]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // ─── PL Annual Data Fetch (수입상세) ───
    const fetchPLData = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/api/profitloss/monthly?year=${plYear}`);
            setPlData(res.data || []);
        } catch (err) {
            console.error('PL fetch error:', err);
        }
    }, [plYear]);

    useEffect(() => {
        if (viewMode === 'revenueDetail') fetchPLData();
    }, [viewMode, fetchPLData]);

    // ─── Delivery App Data Fetch (배달앱) ───
    const fetchDeliveryAppData = useCallback(async (channel) => {
        const ch = DELIVERY_CHANNELS.find(c => c.id === channel);
        if (!ch) return;
        try {
            const res = await axios.get(`${API_URL}/api/profitloss/delivery/${ch.apiKey}/${plYear}`);
            setDeliveryAppData(prev => ({ ...prev, [channel]: res.data || [] }));
        } catch (err) {
            console.error('Delivery fetch error:', err);
        }
    }, [plYear]);

    useEffect(() => {
        if (viewMode === 'deliveryApp') fetchDeliveryAppData(deliveryChannel);
    }, [viewMode, deliveryChannel, fetchDeliveryAppData]);

    // ─── Month Navigation ───
    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    };

    // ─── Filter by Tab ───
    const filteredData = tab === 'all' ? data : data.filter(d => d.category === tab);

    // ─── Group by Date ───
    const groupedByDate = {};
    filteredData.forEach(item => {
        if (!groupedByDate[item.date]) groupedByDate[item.date] = [];
        groupedByDate[item.date].push(item);
    });
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    // ─── Vendor display name (strip store prefix) ───
    const getDisplayName = (vendor_name, item) => {
        if (!item) return vendor_name;
        const parts = item.split(':');
        if (parts.length === 2 && vendor_name.startsWith(parts[0] + ' ')) {
            return vendor_name.substring(parts[0].length + 1);
        }
        return vendor_name;
    };

    const getStoreName = (item) => {
        if (!item) return '';
        const parts = item.split(':');
        return parts[0] || '';
    };

    // ─── Add / Edit Modal ───
    const openAddModal = () => {
        const today = `${year}-${String(month).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        setForm({ vendor_id: vendors.length > 0 ? vendors[0].id : '', date: today, amount: '', note: '' });
        setModalMode('add');
        setEditingId(null);
        setShowModal(true);
    };

    const openEditModal = (record) => {
        const isDeliveryApp = typeof record.id === 'string' && record.id.startsWith('rev_');
        setForm({
            vendor_id: record.vendor_id,
            date: record.date,
            amount: String(record.amount),
            note: record.note || '',
            _isDeliveryApp: isDeliveryApp,
            _channel: record._channel || null,
        });
        setModalMode('edit');
        setEditingId(record.id);
        setShowModal(true);
    };

    const handleSubmit = async () => {
        if (!form.vendor_id || !form.date || !form.amount) {
            alert('거래처, 날짜, 금액을 모두 입력해주세요.');
            return;
        }
        try {
            if (modalMode === 'add') {
                await api.post('/revenue/daily', {
                    vendor_id: Number(form.vendor_id),
                    date: form.date,
                    amount: Number(form.amount),
                    note: form.note || null,
                });
            } else {
                // Check if editing a Revenue table entry (delivery app)
                const isDeliveryApp = typeof editingId === 'string' && editingId.startsWith('rev_');
                if (isDeliveryApp) {
                    const realId = editingId.replace('rev_', '');
                    await axios.put(`${API_URL}/api/profitloss/delivery/${realId}`, {
                        date: form.date,
                        amount: Number(form.amount),
                        description: form.note || null,
                        channel: form._channel || 'Coupang',
                    });
                } else {
                    await api.put(`/revenue/daily/${editingId}`, {
                        vendor_id: Number(form.vendor_id),
                        date: form.date,
                        amount: Number(form.amount),
                        note: form.note || null,
                    });
                }
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            console.error(err);
            alert('저장 실패');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('이 매출 내역을 삭제하시겠습니까?')) return;
        try {
            // Check if deleting a Revenue table entry (delivery app)
            const isDeliveryApp = typeof id === 'string' && id.startsWith('rev_');
            if (isDeliveryApp) {
                const realId = id.replace('rev_', '');
                await axios.delete(`${API_URL}/api/profitloss/delivery/${realId}`);
            } else {
                await api.delete(`/revenue/daily/${id}`);
            }
            fetchData();
        } catch (err) {
            console.error(err);
            alert('삭제 실패');
        }
    };

    // ─── Grouped vendor options for select ───
    const storeVendors = vendors.filter(v => v.category === 'store');
    const deliveryVendors = vendors.filter(v => v.category === 'delivery');
    const otherVendors = vendors.filter(v => v.category !== 'store' && v.category !== 'delivery');

    const storeGroups = {};
    storeVendors.forEach(v => {
        const storeName = getStoreName(v.item);
        if (!storeGroups[storeName]) storeGroups[storeName] = [];
        storeGroups[storeName].push(v);
    });

    const deliveryGroups = {};
    deliveryVendors.forEach(v => {
        const storeName = getStoreName(v.item);
        if (!deliveryGroups[storeName]) deliveryGroups[storeName] = [];
        deliveryGroups[storeName].push(v);
    });

    // Summary values
    const storeTotal = summary.by_category?.store || 0;
    const deliveryTotal = summary.by_category?.delivery || 0;
    const grandTotal = summary.total || 0;

    // ─── Upload handlers ───
    const handleUploadFileChange = async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        setUploadLoading(true);

        if (uploadTab === 'camera') {
            const file = files[0];
            const formData = new FormData();
            formData.append('file', file);
            try {
                await new Promise(r => setTimeout(r, 800));
                const response = await api.post('/upload/image/revenue', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                if (response.data.status === 'success') {
                    alert('이미지가 성공적으로 분석되었습니다.');
                    fetchData();
                } else {
                    alert('처리 실패: ' + response.data.message);
                }
            } catch (error) {
                console.error('Upload error:', error);
                alert('업로드 중 오류가 발생했습니다.');
            } finally {
                setUploadLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
            return;
        }

        // Excel upload — multiple files
        let totalCount = 0;
        let successCount = 0;
        let errorFiles = [];
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                setUploadProgress(`(${i + 1}/${files.length}) ${file.name} 처리 중...`);
                const formData = new FormData();
                formData.append('file', file);
                try {
                    const response = await api.post('/upload/excel/revenue', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    if (response.data.status === 'success') {
                        totalCount += response.data.count || 0;
                        successCount++;
                    } else {
                        errorFiles.push(`${file.name}: ${response.data.message}`);
                    }
                } catch (error) {
                    console.error(`Upload error for ${file.name}:`, error);
                    errorFiles.push(`${file.name}: 업로드 실패`);
                }
            }
            let message = `${successCount}개 파일 처리 완료, 총 ${totalCount}건 저장됨`;
            if (errorFiles.length > 0) {
                message += `\n\n실패한 파일:\n${errorFiles.join('\n')}`;
            }
            alert(message);
            fetchData();
        } catch (error) {
            console.error('Upload error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

    // ═══════════════════════════════════════════════
    //  GRID VIEW — vendor × day matrix
    // ═══════════════════════════════════════════════

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Build vendor grid: vendorId -> { amounts: { day: amount }, ids: { day: expenseId }, channels: { day: channel } }
    const vendorGrid = {};
    const filteredVendors = tab === 'all' ? vendors : vendors.filter(v => v.category === tab);

    filteredVendors.forEach(v => {
        vendorGrid[v.id] = { amounts: {}, ids: {}, channels: {} };
    });

    // Populate from data
    const dataForGrid = tab === 'all' ? data : data.filter(d => d.category === tab);
    dataForGrid.forEach(item => {
        const day = new Date(item.date).getDate();
        if (vendorGrid[item.vendor_id]) {
            vendorGrid[item.vendor_id].amounts[day] = (vendorGrid[item.vendor_id].amounts[day] || 0) + item.amount;
            vendorGrid[item.vendor_id].ids[day] = item.id;
            if (item._channel) {
                vendorGrid[item.vendor_id].channels[day] = item._channel;
            }
        }
    });

    // Vendor totals
    const vendorTotals = {};
    filteredVendors.forEach(v => {
        vendorTotals[v.id] = Object.values(vendorGrid[v.id]?.amounts || {}).reduce((s, a) => s + a, 0);
    });

    const emptyVendorCount = filteredVendors.filter(v => vendorTotals[v.id] === 0).length;
    const displayVendors = hideEmpty ? filteredVendors.filter(v => vendorTotals[v.id] > 0) : filteredVendors;

    // Group by category
    const groupedVendorsGrid = {};
    REVENUE_CATEGORIES.forEach(cat => { groupedVendorsGrid[cat.id] = []; });
    displayVendors.forEach(v => {
        if (groupedVendorsGrid[v.category]) {
            groupedVendorsGrid[v.category].push(v);
        }
    });

    // Day totals
    const dayTotals = {};
    days.forEach(d => {
        dayTotals[d] = displayVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
    });
    const gridGrandTotal = displayVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);

    // ─── Grid cell editing ───
    const handleGridCellClick = (vendorId, day, amount, expenseId) => {
        setEditingCell({ vendorId, day, id: expenseId });
        setEditValue(amount?.toString() || '0');
    };

    const handleGridSave = async () => {
        if (!editingCell) return;
        const { vendorId, day, id } = editingCell;
        const amount = parseInt(editValue) || 0;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isDeliveryApp = typeof id === 'string' && id.startsWith('rev_');

        try {
            if (isDeliveryApp) {
                const realId = id.replace('rev_', '');
                const channel = vendorGrid[vendorId]?.channels[day] || 'Coupang';
                if (amount > 0) {
                    await axios.put(`${API_URL}/api/profitloss/delivery/${realId}`, {
                        amount, date: dateStr, channel, description: null
                    });
                } else {
                    await axios.delete(`${API_URL}/api/profitloss/delivery/${realId}`);
                }
            } else if (id && amount > 0) {
                await api.put(`/revenue/daily/${id}`, { amount, date: dateStr, vendor_id: vendorId });
            } else if (!id && amount > 0) {
                await api.post('/revenue/daily', { vendor_id: vendorId, date: dateStr, amount, note: null });
            } else if (id && amount === 0) {
                await api.delete(`/revenue/daily/${id}`);
            }
            fetchData();
        } catch (err) {
            console.error('Grid save error:', err);
        }
        setEditingCell(null);
    };

    const renderGridCell = (vendorId, day) => {
        const amount = vendorGrid[vendorId]?.amounts[day] || 0;
        const expenseId = vendorGrid[vendorId]?.ids[day];
        const isEditing = editingCell?.vendorId === vendorId && editingCell?.day === day;

        if (isEditing) {
            return (
                <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={handleGridSave}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleGridSave();
                        if (e.key === 'Escape') setEditingCell(null);
                    }}
                    autoFocus
                    className="grid-edit-input"
                />
            );
        }
        return (
            <span
                className={`grid-cell-value ${amount > 0 ? 'has-value' : ''}`}
                onClick={() => handleGridCellClick(vendorId, day, amount, expenseId)}
            >
                {amount > 0 ? formatNumber(amount) : '-'}
            </span>
        );
    };

    // ─── Render category group in grid ───
    const renderGridCategoryGroup = (catId, label, icon) => {
        const groupVendors = groupedVendorsGrid[catId] || [];
        if (groupVendors.length === 0) return null;

        const calcGroupDayTotal = (d) => groupVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
        const calcGroupTotal = () => groupVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);

        return (
            <>
                <tr className="grid-category-header">
                    <td colSpan={daysInMonth + 2} className="grid-category-cell">
                        {icon} {label} ({groupVendors.length})
                    </td>
                </tr>
                {groupVendors.map(v => (
                    <tr key={v.id}>
                        <td className="grid-vendor-cell">{getDisplayName(v.name, v.item)}</td>
                        {days.map(d => (
                            <td key={d} className="grid-amount-cell">
                                {renderGridCell(v.id, d)}
                            </td>
                        ))}
                        <td className="grid-row-total">{formatNumber(vendorTotals[v.id])}</td>
                    </tr>
                ))}
                <tr className="grid-subtotal-row">
                    <td className="grid-subtotal-label">↳ {label} 소계</td>
                    {days.map(d => (
                        <td key={d} className="grid-subtotal-cell">
                            {calcGroupDayTotal(d) > 0 ? formatNumber(calcGroupDayTotal(d)) : '-'}
                        </td>
                    ))}
                    <td className="grid-subtotal-total">{formatNumber(calcGroupTotal())}</td>
                </tr>
            </>
        );
    };

    return (
        <div className="revenue-page">
            {/* ── Header ── */}
            <div className="revenue-header">
                <div className="revenue-header-top">
                    <h1>
                        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ChevronLeft size={18} />
                        </button>
                        <TrendingUp size={22} />
                        매출 관리
                    </h1>
                    {/* Year-only nav for annual views, month nav for monthly views */}
                    {(viewMode === 'revenueDetail' || viewMode === 'deliveryApp') ? (
                        <div className="revenue-month-nav">
                            <button onClick={() => setPlYear(y => y - 1)}><ChevronLeft size={16} /></button>
                            <span className="revenue-month-label">{plYear}년</span>
                            <button onClick={() => setPlYear(y => y + 1)}><ChevronRight size={16} /></button>
                        </div>
                    ) : (
                        <div className="revenue-month-nav">
                            <button onClick={prevMonth}><ChevronLeft size={16} /></button>
                            <span className="revenue-month-label">{year}년 {month}월</span>
                            <button onClick={nextMonth}><ChevronRight size={16} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Summary Cards (monthly views only) ── */}
            {(viewMode === 'list' || viewMode === 'grid' || viewMode === 'upload') && (
                <div className="revenue-summary-row" style={{ marginTop: 20 }}>
                    <div className="revenue-summary-card">
                        <div className="card-label">🏪 매장매출</div>
                        <div className="card-value">{formatNumber(storeTotal)}원</div>
                    </div>
                    <div className="revenue-summary-card">
                        <div className="card-label">🛵 배달앱매출</div>
                        <div className="card-value">{formatNumber(deliveryTotal)}원</div>
                    </div>
                    <div className="revenue-summary-card total">
                        <div className="card-label">💰 총 매출</div>
                        <div className="card-value">{formatNumber(grandTotal)}원</div>
                    </div>
                </div>
            )}

            {/* ── View Mode Tabs ── */}
            <div className="revenue-tab-bar">
                {/* Category filter tabs (only for list/grid views) */}
                {(viewMode === 'list' || viewMode === 'grid') && (
                    <div style={{ display: 'flex', gap: 4 }}>
                        {[
                            { id: 'all', label: '📊 전체' },
                            { id: 'store', label: '🏪 매장매출' },
                            { id: 'delivery', label: '🛵 배달앱매출' },
                        ].map(t => (
                            <button
                                key={t.id}
                                className={`revenue-tab ${tab === t.id ? 'active' : ''}`}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
                {/* Spacer for non-filter views */}
                {!(viewMode === 'list' || viewMode === 'grid') && <div />}
                <div className="view-mode-toggle">
                    <button
                        className={`view-mode-btn ${viewMode === 'list' ? 'active' : ''}`}
                        onClick={() => setViewMode('list')}
                    >
                        📋 리스트
                    </button>
                    <button
                        className={`view-mode-btn ${viewMode === 'grid' ? 'active' : ''}`}
                        onClick={() => setViewMode('grid')}
                    >
                        📅 월별전체
                    </button>
                    <button
                        className={`view-mode-btn ${viewMode === 'revenueDetail' ? 'active' : ''}`}
                        onClick={() => setViewMode('revenueDetail')}
                    >
                        💰 수입상세
                    </button>
                    <button
                        className={`view-mode-btn ${viewMode === 'deliveryApp' ? 'active' : ''}`}
                        onClick={() => setViewMode('deliveryApp')}
                    >
                        🛵 배달앱
                    </button>
                    <button
                        className={`view-mode-btn ${viewMode === 'upload' ? 'active' : ''}`}
                        onClick={() => setViewMode('upload')}
                    >
                        📤 업로드
                    </button>
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* LIST VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'list' && (
                <div className="revenue-content">
                    <div className="revenue-toolbar">
                        <span className="count-badge">총 {filteredData.length}건</span>
                        <button className="revenue-add-btn" onClick={openAddModal}>
                            <Plus size={16} /> 매출 추가
                        </button>
                    </div>

                    {loading ? (
                        <div className="revenue-loading">
                            <div className="spinner" />
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>불러오는 중...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="revenue-empty">
                            <div className="revenue-empty-icon">📋</div>
                            <h3>매출 데이터가 없습니다</h3>
                            <p>{year}년 {month}월에 등록된 매출 내역이 없습니다.</p>
                        </div>
                    ) : (
                        <table className="revenue-table">
                            <thead>
                                <tr>
                                    <th>날짜</th>
                                    <th>매장</th>
                                    <th>거래처</th>
                                    <th>분류</th>
                                    <th style={{ textAlign: 'right' }}>금액</th>
                                    <th>비고</th>
                                    <th>관리</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedDates.map(dateStr => {
                                    const items = groupedByDate[dateStr];
                                    const dayTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
                                    const weekday = getWeekday(dateStr);
                                    const dayNum = dateStr.split('-')[2];

                                    return [
                                        <tr key={`header-${dateStr}`} className="day-group-header">
                                            <td colSpan={4}>
                                                📅 {month}/{dayNum} ({weekday})
                                            </td>
                                            <td className="day-total">{formatNumber(dayTotal)}원</td>
                                            <td colSpan={2} style={{ textAlign: 'right', fontSize: 12, color: '#94a3b8' }}>
                                                {items.length}건
                                            </td>
                                        </tr>,
                                        ...items.map(item => {
                                            const catInfo = CATEGORY_LABELS[item.category] || { label: item.category, icon: '📦', badge: 'other' };
                                            return (
                                                <tr key={item.id}>
                                                    <td className="td-date">{dayNum}</td>
                                                    <td className="td-vendor" style={{ fontSize: 12, color: '#94a3b8' }}>
                                                        {getStoreName(item.item)}
                                                    </td>
                                                    <td className="td-vendor">
                                                        {getDisplayName(item.vendor_name, item.item)}
                                                    </td>
                                                    <td className="td-category">
                                                        <span className={`cat-badge ${catInfo.badge}`}>
                                                            {catInfo.icon} {catInfo.label}
                                                        </span>
                                                    </td>
                                                    <td className="td-amount">{formatNumber(item.amount)}원</td>
                                                    <td className="td-note">{item.note || '-'}</td>
                                                    <td className="td-actions">
                                                        <button className="rev-action-btn" onClick={() => openEditModal(item)} title="수정">
                                                            <Edit3 size={14} />
                                                        </button>
                                                        <button className="rev-action-btn delete" onClick={() => handleDelete(item.id)} title="삭제">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ];
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* GRID VIEW — Monthly Full View */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'grid' && (
                <div className="revenue-content grid-mode">
                    <div className="grid-header-bar">
                        <div className="grid-stats">
                            <div className="grid-stat">
                                <span className="grid-stat-label">거래처 수</span>
                                <span className="grid-stat-value">{displayVendors.length}개
                                    {hideEmpty && emptyVendorCount > 0 && <small> (+{emptyVendorCount} 숨김)</small>}
                                </span>
                            </div>
                            <div className="grid-stat">
                                <span className="grid-stat-label">거래 건수</span>
                                <span className="grid-stat-value">{filteredData.length}건</span>
                            </div>
                            <div className="grid-stat">
                                <span className="grid-stat-label">총 매출</span>
                                <span className="grid-stat-value highlight">{formatNumber(gridGrandTotal)}원</span>
                            </div>
                        </div>
                        <div className="grid-controls">
                            <label className="hide-empty-toggle">
                                <input
                                    type="checkbox"
                                    checked={hideEmpty}
                                    onChange={e => setHideEmpty(e.target.checked)}
                                />
                                <span>빈 거래처 숨기기 ({emptyVendorCount}개)</span>
                            </label>
                            <a href="/vendor-settings" className="vendor-settings-link">⚙️ 거래처 관리</a>
                        </div>
                    </div>

                    {loading ? (
                        <div className="revenue-loading">
                            <div className="spinner" />
                            <p style={{ color: '#94a3b8', fontSize: 13 }}>불러오는 중...</p>
                        </div>
                    ) : displayVendors.length === 0 ? (
                        <div className="revenue-empty">
                            <div className="revenue-empty-icon">📋</div>
                            <h3>매출 거래처가 없습니다</h3>
                            <p><a href="/vendor-settings">거래처 관리</a>에서 매출처를 추가하세요.</p>
                        </div>
                    ) : (
                        <div className="grid-table-wrapper">
                            <table className="revenue-grid-table">
                                <thead>
                                    <tr>
                                        <th className="grid-vendor-header">카테고리 / 거래처</th>
                                        {days.map(d => (
                                            <th key={d} className="grid-day-header">{d}</th>
                                        ))}
                                        <th className="grid-total-header">합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {REVENUE_CATEGORIES.map(cat => (
                                        <React.Fragment key={cat.id}>
                                            {renderGridCategoryGroup(cat.id, cat.label, cat.icon)}
                                        </React.Fragment>
                                    ))}

                                    <tr className="grid-grand-total-row">
                                        <td className="grid-vendor-cell"><strong>총 합계</strong></td>
                                        {days.map(d => (
                                            <td key={d} className="grid-day-total">
                                                {dayTotals[d] > 0 ? formatNumber(dayTotals[d]) : '-'}
                                            </td>
                                        ))}
                                        <td className="grid-grand-total">{formatNumber(gridGrandTotal)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="grid-instructions">
                        <p>💡 셀을 클릭하면 금액을 직접 입력/수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* REVENUE DETAIL VIEW — 수입상세 (Annual 12-month matrix) */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'revenueDetail' && (() => {
                const getPlMonth = (m) => plData.find(d => d.month === m) || {};
                const calcPlTotal = (field) => plData.reduce((s, d) => s + (d[field] || 0), 0);
                const calcPlAvg = (field) => { const t = calcPlTotal(field); const months = plData.filter(d => PL_REVENUE_FIELDS.some(f => d[f.key] > 0)).length || 1; return Math.round(t / months); };
                const totalAllRevenue = plData.reduce((s, d) => PL_REVENUE_FIELDS.reduce((ss, f) => ss + (d[f.key] || 0), s), 0);

                const handlePLSave = async () => {
                    if (!editingCell || editingCell.type !== 'plRevenue') return;
                    const { month: m, field } = editingCell;
                    const monthData = getPlMonth(m);
                    try {
                        if (monthData.id) {
                            await axios.put(`${API_URL}/api/profitloss/monthly/${monthData.id}`, { [field]: parseInt(editValue) || 0 });
                        } else {
                            await axios.post(`${API_URL}/api/profitloss/monthly`, { year: plYear, month: m, [field]: parseInt(editValue) || 0 });
                        }
                        fetchPLData();
                    } catch (err) { console.error('PL save error:', err); alert('저장 실패'); }
                    setEditingCell(null);
                };

                const renderPLCell = (m, field, value) => {
                    const isEditing = editingCell?.type === 'plRevenue' && editingCell?.month === m && editingCell?.field === field;
                    if (isEditing) {
                        return (
                            <input type="number" value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={handlePLSave}
                                onKeyDown={e => { if (e.key === 'Enter') handlePLSave(); if (e.key === 'Escape') setEditingCell(null); }}
                                autoFocus className="rd-edit-input" />
                        );
                    }
                    return (
                        <span className={`rd-cell-value ${value > 0 ? 'has-value' : ''}`}
                            onClick={() => { setEditingCell({ type: 'plRevenue', month: m, field }); setEditValue(value?.toString() || '0'); }}>
                            {value > 0 ? formatNumber(value) : '0'}
                        </span>
                    );
                };

                return (
                    <div className="revenue-content revenue-detail-mode">
                        <h3 className="rd-section-title">💰 수입 상세 내역</h3>
                        <div className="rd-table-container">
                            <table className="rd-table">
                                <thead>
                                    <tr>
                                        <th className="rd-item-header">수입 항목</th>
                                        {MONTHS.map(m => <th key={m} className="rd-month-header">{m}월</th>)}
                                        <th className="rd-total-header">합계</th>
                                        <th className="rd-avg-header">월평균</th>
                                        <th className="rd-pct-header">비율</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PL_REVENUE_FIELDS.map(field => {
                                        const yearTotal = calcPlTotal(field.key);
                                        const pct = totalAllRevenue > 0 ? ((yearTotal / totalAllRevenue) * 100).toFixed(1) : '0.0';
                                        return (
                                            <tr key={field.key}>
                                                <td className="rd-item-name">{field.icon} {field.label}</td>
                                                {MONTHS.map(m => (
                                                    <td key={m} className="rd-amount-cell">{renderPLCell(m, field.key, getPlMonth(m)[field.key])}</td>
                                                ))}
                                                <td className="rd-row-total">{formatNumber(yearTotal)}</td>
                                                <td className="rd-row-avg">{formatNumber(calcPlAvg(field.key))}</td>
                                                <td className="rd-row-pct">{pct}%</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="rd-grand-total-row">
                                        <td className="rd-item-name"><strong>총합</strong></td>
                                        {MONTHS.map(m => {
                                            const monthTotal = PL_REVENUE_FIELDS.reduce((s, f) => s + (getPlMonth(m)[f.key] || 0), 0);
                                            return <td key={m} className="rd-grand-cell"><strong>{formatNumber(monthTotal)}</strong></td>;
                                        })}
                                        <td className="rd-grand-total"><strong>{formatNumber(totalAllRevenue)}</strong></td>
                                        <td className="rd-grand-avg"><strong>{formatNumber(Math.round(totalAllRevenue / (plData.filter(d => PL_REVENUE_FIELDS.some(f => d[f.key] > 0)).length || 1)))}</strong></td>
                                        <td className="rd-grand-pct">100%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="grid-instructions">
                            <p>💡 셀을 클릭하면 직접 수정할 수 있습니다. 비율은 전체 수입 대비 비율입니다.</p>
                        </div>
                    </div>
                );
            })()}

            {/* ═══════════════════════════════════════════ */}
            {/* DELIVERY APP VIEW — 배달앱 정산금 (Day × 12-month grid) */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'deliveryApp' && (() => {
                const ch = DELIVERY_CHANNELS.find(c => c.id === deliveryChannel);
                const revenueItems = deliveryAppData[deliveryChannel] || [];

                // Build grid: month -> { day -> { amount, id } }
                const monthGrid = {};
                MONTHS.forEach(m => { monthGrid[m] = {}; });
                revenueItems.forEach(item => {
                    const d = new Date(item.date);
                    const m = d.getMonth() + 1, day = d.getDate();
                    if (monthGrid[m]) monthGrid[m][day] = { amount: item.amount, id: item.id };
                });

                const monthlyTotals = {};
                MONTHS.forEach(m => { monthlyTotals[m] = Object.values(monthGrid[m]).reduce((s, d) => s + (d.amount || 0), 0); });
                const deliveryGrandTotal = Object.values(monthlyTotals).reduce((s, t) => s + t, 0);

                const handleDeliverySave = async () => {
                    if (!editingCell || editingCell.type !== 'deliveryApp') return;
                    const { channel: chId, month: m, day, id } = editingCell;
                    const amount = parseInt(editValue) || 0;
                    const date = `${plYear}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                    const apiChannel = DELIVERY_CHANNELS.find(c => c.id === chId)?.apiKey;
                    try {
                        if (id && amount > 0) {
                            await axios.put(`${API_URL}/api/profitloss/delivery/${id}`, { date, channel: apiChannel, amount });
                        } else if (!id && amount > 0) {
                            await axios.post(`${API_URL}/api/profitloss/delivery`, { date, channel: apiChannel, amount });
                        } else if (id && amount === 0) {
                            await axios.delete(`${API_URL}/api/profitloss/delivery/${id}`);
                        }
                        fetchDeliveryAppData(chId);
                    } catch (err) { console.error('Delivery save:', err); }
                    setEditingCell(null);
                };

                const renderDelCell = (m, day) => {
                    const cellData = monthGrid[m]?.[day];
                    const amount = cellData?.amount || 0;
                    const itemId = cellData?.id;
                    const isEditing = editingCell?.type === 'deliveryApp' && editingCell?.channel === deliveryChannel && editingCell?.month === m && editingCell?.day === day;
                    if (isEditing) {
                        return (
                            <input type="number" value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onBlur={handleDeliverySave}
                                onKeyDown={e => { if (e.key === 'Enter') handleDeliverySave(); if (e.key === 'Escape') setEditingCell(null); }}
                                autoFocus className="del-edit-input" />
                        );
                    }
                    return (
                        <span className={`del-cell-value ${amount > 0 ? 'has-value' : ''}`}
                            onClick={() => { setEditingCell({ type: 'deliveryApp', channel: deliveryChannel, month: m, day, id: itemId }); setEditValue(amount?.toString() || '0'); }}>
                            {amount > 0 ? formatNumber(amount) : '-'}
                        </span>
                    );
                };

                return (
                    <div className="revenue-content delivery-app-mode">
                        {/* Channel Tabs */}
                        <div className="delivery-channel-tabs">
                            {DELIVERY_CHANNELS.map(c => (
                                <button key={c.id}
                                    className={`delivery-channel-btn ${deliveryChannel === c.id ? 'active' : ''}`}
                                    onClick={() => setDeliveryChannel(c.id)}>
                                    {c.icon} {c.label}
                                </button>
                            ))}
                        </div>

                        <h3 className="del-section-title">🛵 {ch?.label} 정산금 입금내역_{plYear}년</h3>

                        {/* Monthly Summary Bar */}
                        <div className="del-summary-bar">
                            <div className="del-stat highlight">
                                <span className="del-stat-label">총 정산금</span>
                                <span className="del-stat-value">{formatNumber(deliveryGrandTotal)}원</span>
                            </div>
                            {MONTHS.map(m => (
                                <div key={m} className="del-stat">
                                    <span className="del-stat-label">{m}월</span>
                                    <span className="del-stat-value">{formatNumber(monthlyTotals[m])}원</span>
                                </div>
                            ))}
                        </div>

                        {/* Day × 12-Month Grid */}
                        <div className="del-grid-container">
                            <table className="del-grid-table">
                                <thead>
                                    <tr>
                                        <th className="del-day-header"></th>
                                        {MONTHS.map(m => <th key={m} className="del-month-header">{m}월</th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                        <tr key={day}>
                                            <td className="del-day-label">{day}</td>
                                            {MONTHS.map(m => {
                                                const daysInM = new Date(plYear, m, 0).getDate();
                                                if (day > daysInM) return <td key={m} className="del-invalid">-</td>;
                                                return <td key={m} className="del-amount-cell">{renderDelCell(m, day)}</td>;
                                            })}
                                        </tr>
                                    ))}
                                    <tr className="del-totals-row">
                                        <td className="del-day-label"><strong>합 계</strong></td>
                                        {MONTHS.map(m => (
                                            <td key={m} className="del-month-total"><strong>{formatNumber(monthlyTotals[m])}</strong></td>
                                        ))}
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="grid-instructions">
                            <p>💡 셀을 클릭하면 정산금을 직접 입력/수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
                        </div>
                    </div>
                );
            })()}

            {/* ═══════════════════════════════════════════ */}
            {/* UPLOAD VIEW — Image / Excel Upload */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'upload' && (
                <div className="revenue-content upload-mode">
                    <div className="upload-section">
                        <div className="upload-tabs">
                            <button
                                className={`upload-tab-btn ${uploadTab === 'camera' ? 'active camera' : ''}`}
                                onClick={() => setUploadTab('camera')}
                            >
                                <Camera size={16} /> 촬영/이미지
                            </button>
                            <button
                                className={`upload-tab-btn ${uploadTab === 'excel' ? 'active excel' : ''}`}
                                onClick={() => setUploadTab('excel')}
                            >
                                <FileSpreadsheet size={16} /> 엑셀 업로드
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
                                <UploadHistoryList type="revenue" />
                            </div>
                        ) : (
                            <div
                                className="upload-drop-zone"
                                onClick={() => uploadTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                            >
                                {uploadLoading ? (
                                    <div className="upload-loading">
                                        <div className="spinner" />
                                        <p>{uploadProgress || '처리 중입니다...'}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className={`upload-icon-box ${uploadTab}`}>
                                            {uploadTab === 'camera' ? <Camera size={32} /> : <UploadCloud size={32} />}
                                        </div>
                                        <p className="upload-main-text">
                                            {uploadTab === 'camera' ? '클릭하여 이미지 선택' : '클릭하여 엑셀 파일 선택'}
                                        </p>
                                        <p className="upload-sub-text">
                                            {uploadTab === 'camera'
                                                ? '영수증 또는 매출 내역 이미지를 업로드하세요'
                                                : '필수 컬럼: 날짜, 금액, 채널(옵션) — 여러 파일 선택 가능'}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Hidden file inputs */}
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleUploadFileChange}
                    />
                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        multiple
                        style={{ display: 'none' }}
                        ref={excelInputRef}
                        onChange={handleUploadFileChange}
                    />
                </div>
            )}

            {/* ── Add / Edit Modal ── */}
            {showModal && (
                <div className="revenue-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="revenue-modal" onClick={e => e.stopPropagation()}>
                        <h2>
                            {modalMode === 'add' ? <><Plus size={18} /> 매출 추가</> : <><Edit3 size={18} /> 매출 수정</>}
                        </h2>

                        <div className="form-group">
                            <label className="form-label">날짜</label>
                            <input
                                type="date"
                                className="form-input"
                                value={form.date}
                                onChange={e => setForm({ ...form, date: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">거래처</label>
                            <select
                                className="form-select"
                                value={form.vendor_id}
                                onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                            >
                                <option value="">-- 거래처 선택 --</option>
                                {Object.entries(storeGroups).map(([storeName, vList]) => (
                                    <optgroup key={`store-${storeName}`} label={`🏪 ${storeName}`}>
                                        {vList.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {getDisplayName(v.name, v.item)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                                {Object.entries(deliveryGroups).map(([storeName, vList]) => (
                                    <optgroup key={`delivery-${storeName}`} label={`🛵 ${storeName} 배달앱`}>
                                        {vList.map(v => (
                                            <option key={v.id} value={v.id}>
                                                {getDisplayName(v.name, v.item)}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                                {otherVendors.length > 0 && (
                                    <optgroup label="📦 기타">
                                        {otherVendors.map(v => (
                                            <option key={v.id} value={v.id}>{v.name}</option>
                                        ))}
                                    </optgroup>
                                )}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">금액 (원)</label>
                            <input
                                type="number"
                                className="form-input amount"
                                placeholder="0"
                                value={form.amount}
                                onChange={e => setForm({ ...form, amount: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">비고</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="메모 (선택)"
                                value={form.note}
                                onChange={e => setForm({ ...form, note: e.target.value })}
                            />
                        </div>

                        <div className="revenue-modal-actions">
                            <button className="modal-btn secondary" onClick={() => setShowModal(false)}>취소</button>
                            <button className="modal-btn primary" onClick={handleSubmit}>
                                {modalMode === 'add' ? '추가' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
