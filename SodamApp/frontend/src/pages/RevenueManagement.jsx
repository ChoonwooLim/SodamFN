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
    const [form, setForm] = useState({ vendor_id: '', date: '', amount: '', note: '', payment_method: 'Card' });

    // Grid inline edit
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Grid: hide empty vendors
    const [hideEmpty, setHideEmpty] = useState(false);

    // List: collapse card items per date group
    const [collapsedCards, setCollapsedCards] = useState({});
    const toggleCardCollapse = (dateStr) => {
        setCollapsedCards(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

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
            const res = await api.get(`/profitloss/monthly`, { params: { year: plYear } });
            setPlData(res.data || []);
        } catch (err) {
            console.error('PL fetch error:', err);
        }
    }, [plYear]);

    useEffect(() => {
        if (viewMode === 'revenueDetail') fetchPLData();
    }, [viewMode, fetchPLData]);

    const fetchDeliveryAppData = useCallback(async () => {
        try {
            const res = await api.get(`/revenue/delivery-summary?year=${plYear}`);
            setDeliveryAppData(res.data || {});
        } catch (err) {
            console.error('Delivery fetch error:', err);
        }
    }, [plYear]);

    useEffect(() => {
        if (viewMode === 'deliveryApp') fetchDeliveryAppData();
    }, [viewMode, fetchDeliveryAppData]);

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
    const filteredData = tab === 'all' ? data : data.filter(d => d.ui_category === tab);

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
        setForm({ vendor_id: vendors.length > 0 ? vendors[0].id : '', date: today, amount: '', note: '', payment_method: 'Card' });
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
            payment_method: record.payment_method || 'Card',
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
                    payment_method: form.payment_method || 'Card',
                });
            } else {
                // Check if editing a Revenue table entry (delivery app)
                const isDeliveryApp = typeof editingId === 'string' && editingId.startsWith('rev_');
                if (isDeliveryApp) {
                    const realId = editingId.replace('rev_', '');
                    await api.put(`/profitloss/delivery/${realId}`, {
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
                        payment_method: form.payment_method || 'Card',
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
                await api.delete(`/profitloss/delivery/${realId}`);
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

    // Build vendor grid: vendorId -> { amounts: { day: amount }, ids: { day: expenseId }, channels: { day: channel }, notes: { day: note } }
    const vendorGrid = {};
    const filteredVendors = tab === 'all' ? vendors : vendors.filter(v => v.category === tab);

    filteredVendors.forEach(v => {
        vendorGrid[v.id] = { amounts: {}, ids: {}, channels: {}, notes: {} };
    });

    // Populate from data
    const dataForGrid = tab === 'all' ? data : data.filter(d => d.category === tab);
    dataForGrid.forEach(item => {
        const day = new Date(item.date).getDate();
        if (vendorGrid[item.vendor_id]) {
            vendorGrid[item.vendor_id].amounts[day] = (vendorGrid[item.vendor_id].amounts[day] || 0) + item.amount;
            vendorGrid[item.vendor_id].ids[day] = item.id;
            if (item.note) vendorGrid[item.vendor_id].notes[day] = item.note;
            if (item._channel) {
                vendorGrid[item.vendor_id].channels[day] = item._channel;
            }
        }
    });

    // Helper: parse 매출 amount from note (format: "매출:X / 수수료:Y / 주문:Z건")
    const parseSalesFromNote = (note) => {
        if (!note) return null;
        const m = note.match(/매출[:\s]*([\d,]+)/);
        return m ? parseInt(m[1].replace(/,/g, '')) : null;
    };

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
                    await api.put(`/profitloss/delivery/${realId}`, {
                        amount, date: dateStr, channel, description: null
                    });
                } else {
                    await api.delete(`/profitloss/delivery/${realId}`);
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

        const isDelivery = catId === 'delivery';
        const calcGroupDayTotal = (d) => groupVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
        const calcGroupTotal = () => groupVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);

        // For delivery: calculate 매출 totals from notes
        const calcDeliverySalesTotal = (vendorId) => {
            const notes = vendorGrid[vendorId]?.notes || {};
            return Object.values(notes).reduce((sum, note) => sum + (parseSalesFromNote(note) || 0), 0);
        };
        const calcGroupDaySalesTotal = (d) => groupVendors.reduce((sum, v) => {
            const note = vendorGrid[v.id]?.notes[d];
            return sum + (parseSalesFromNote(note) || 0);
        }, 0);
        const calcGroupSalesTotal = () => groupVendors.reduce((sum, v) => sum + calcDeliverySalesTotal(v.id), 0);

        return (
            <>
                <tr className="grid-category-header">
                    <td colSpan={daysInMonth + 2} className="grid-category-cell">
                        {icon} {label} ({groupVendors.length})
                    </td>
                </tr>
                {groupVendors.map(v => (
                    <React.Fragment key={v.id}>
                        {/* 정산금 row */}
                        <tr>
                            <td className="grid-vendor-cell" rowSpan={isDelivery ? 2 : 1}>
                                {getDisplayName(v.name, v.item)}
                            </td>
                            {days.map(d => (
                                <td key={d} className="grid-amount-cell">
                                    {renderGridCell(v.id, d)}
                                </td>
                            ))}
                            <td className="grid-row-total">{formatNumber(vendorTotals[v.id])}</td>
                        </tr>
                        {/* 매출액 row (delivery only) */}
                        {isDelivery && (
                            <tr className="grid-sales-row">
                                {days.map(d => {
                                    const sales = parseSalesFromNote(vendorGrid[v.id]?.notes[d]);
                                    return (
                                        <td key={d} className="grid-amount-cell grid-sales-cell">
                                            <span className="grid-cell-sales">{sales ? formatNumber(sales) : '-'}</span>
                                        </td>
                                    );
                                })}
                                <td className="grid-row-total grid-sales-cell">
                                    <span className="grid-cell-sales">{formatNumber(calcDeliverySalesTotal(v.id))}</span>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                {/* 정산금 소계 */}
                <tr className="grid-subtotal-row">
                    <td className="grid-subtotal-label">↳ {isDelivery ? '정산금 소계' : `${label} 소계`}</td>
                    {days.map(d => (
                        <td key={d} className="grid-subtotal-cell">
                            {calcGroupDayTotal(d) > 0 ? formatNumber(calcGroupDayTotal(d)) : '-'}
                        </td>
                    ))}
                    <td className="grid-subtotal-total">{formatNumber(calcGroupTotal())}</td>
                </tr>
                {/* 매출 소계 (delivery only) */}
                {isDelivery && (
                    <tr className="grid-subtotal-row grid-sales-subtotal">
                        <td className="grid-subtotal-label">↳ 매출 소계</td>
                        {days.map(d => {
                            const t = calcGroupDaySalesTotal(d);
                            return (
                                <td key={d} className="grid-subtotal-cell grid-sales-cell">
                                    {t > 0 ? formatNumber(t) : '-'}
                                </td>
                            );
                        })}
                        <td className="grid-subtotal-total grid-sales-cell">{formatNumber(calcGroupSalesTotal())}</td>
                    </tr>
                )}
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
                        매출 요약
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
                        <div className="card-label">💵 현금매출</div>
                        <div className="card-value">{formatNumber(summary.by_category?.cash || 0)}원</div>
                    </div>
                    <div className="revenue-summary-card">
                        <div className="card-label">💳 카드매출</div>
                        <div className="card-value">{formatNumber(summary.by_category?.card || 0)}원</div>
                    </div>
                    <div className="revenue-summary-card">
                        <div className="card-label">🛵 배달앱매출</div>
                        <div className="card-value">{formatNumber(summary.by_category?.delivery || 0)}원</div>
                    </div>
                    <div className="revenue-summary-card total">
                        <div className="card-label">💰 총 매출</div>
                        <div className="card-value">{formatNumber(summary.total || 0)}원</div>
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
                            { id: 'cash', label: '💵 현금' },
                            { id: 'card', label: '💳 카드' },
                            { id: 'delivery', label: '🛵 배달앱' },
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
                        💰 매출요약
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

                                    // Split into 3 groups: cash, card, delivery
                                    const cashItems = items.filter(i => i.ui_category === 'cash');
                                    const cardOnlyItems = items.filter(i => i.ui_category === 'card');
                                    const deliveryItems = items.filter(i => i.ui_category === 'delivery');

                                    const cashItemsTotal = cashItems.reduce((s, i) => s + (i.amount || 0), 0);
                                    const cardOnlyTotal = cardOnlyItems.reduce((s, i) => s + (i.amount || 0), 0);
                                    const deliveryTotal = deliveryItems.reduce((s, i) => s + (i.amount || 0), 0);
                                    const isCardCollapsed = collapsedCards[`card-${dateStr}`] !== false; // default collapsed
                                    const isDeliveryCollapsed = collapsedCards[`delivery-${dateStr}`] !== false; // default collapsed

                                    const renderItemRow = (item, icon, badgeLabel, badgeClass, rowClass, showStore = true) => (
                                        <tr key={item.id} className={`revenue-row ${rowClass}`}>
                                            <td className="td-date">{dayNum}</td>
                                            {showStore ? (
                                                <td className="td-vendor" style={{ fontSize: 12, color: '#94a3b8' }}>
                                                    {getStoreName(item.item)}
                                                </td>
                                            ) : (
                                                <td className="td-vendor"></td>
                                            )}
                                            <td className="td-vendor" style={rowClass === 'card-row' ? { paddingLeft: '5em' } : undefined}>
                                                {icon} {getDisplayName(item.vendor_name, item.item)}
                                            </td>
                                            <td className="td-category">
                                                <span className={`cat-badge ${badgeClass}`}>
                                                    {icon} {badgeLabel}
                                                </span>
                                            </td>
                                            <td className={`td-amount ${rowClass === 'cash-row' ? 'cash-amount' : ''}`}>{formatNumber(item.amount)}원</td>
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

                                    /* Toggle row rendered in same column layout as data rows */
                                    const renderToggleRow = (key, icon, label, count, total, isCollapsed, toggleKey, toggleClass = '') => (
                                        <tr key={key} className={`revenue-row toggle-summary-row ${toggleClass}`} onClick={() => toggleCardCollapse(toggleKey)} style={{ cursor: 'pointer' }}>
                                            <td className="td-date"></td>
                                            <td className="td-vendor" style={{ textAlign: 'right', paddingRight: 4, fontSize: 11, color: '#6366f1' }}>{isCollapsed ? '▶' : '▼'}</td>
                                            <td className="td-vendor">
                                                <span style={{ fontWeight: 600 }}>{icon} {label}</span>
                                            </td>
                                            <td className="td-category">
                                                <span className="toggle-count-badge">{count}건</span>
                                            </td>
                                            <td className="td-amount" style={{ fontWeight: 600, color: '#3b82f6' }}>{formatNumber(total)}원</td>
                                            <td className="td-note"></td>
                                            <td className="td-actions"></td>
                                        </tr>
                                    );

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
                                        /* ── Cash items (shown first, green tint) ── */
                                        ...cashItems.map(item => renderItemRow(item, '💵', '현금', 'cash', 'cash-row', true)),
                                        /* ── Card items collapse toggle ── */
                                        cardOnlyItems.length > 0 && renderToggleRow(
                                            `card-toggle-${dateStr}`, '💳', '카드매출',
                                            cardOnlyItems.length, cardOnlyTotal,
                                            isCardCollapsed, `card-${dateStr}`
                                        ),
                                        /* ── Card items (collapsible, blue tint) ── */
                                        ...(!isCardCollapsed ? cardOnlyItems.map(item =>
                                            renderItemRow(item, '💳', '카드', 'store', 'card-row', false)
                                        ) : []),
                                        /* ── Delivery items collapse toggle ── */
                                        deliveryItems.length > 0 && renderToggleRow(
                                            `delivery-toggle-${dateStr}`, '🛵', '배달매출',
                                            deliveryItems.length, deliveryTotal,
                                            isDeliveryCollapsed, `delivery-${dateStr}`, 'delivery-toggle-row'
                                        ),
                                        /* ── Delivery items (collapsible) ── */
                                        ...(!isDeliveryCollapsed ? deliveryItems.map(item =>
                                            renderItemRow(item, '🛵', '배달', 'delivery', 'card-row', false)
                                        ) : [])
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
                        <h3 className="rd-section-title">💰 매출처별 요약 내역</h3>
                        <div className="rd-table-container">
                            <table className="rd-table">
                                <thead>
                                    <tr>
                                        <th className="rd-item-header">매출처</th>
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

            {viewMode === 'deliveryApp' && (() => {
                const monthly = deliveryAppData?.monthly || [];
                const channelTotals = deliveryAppData?.channel_totals || {};
                const CHANNEL_ICONS = { '쿠팡': '🟡', '배민': '🔵', '요기요': '🔴', '땡겨요': '🟢' };
                const CHANNEL_ORDER = ['쿠팡', '배민', '요기요', '땡겨요'];
                const sortedChannels = CHANNEL_ORDER.filter(c => channelTotals[c]);

                // Grand totals
                const grandSales = Object.values(channelTotals).reduce((s, c) => s + c.total_sales, 0);
                const grandFees = Object.values(channelTotals).reduce((s, c) => s + c.total_fees, 0);
                const grandSettle = Object.values(channelTotals).reduce((s, c) => s + c.settlement_amount, 0);
                const grandOrders = Object.values(channelTotals).reduce((s, c) => s + c.order_count, 0);
                const grandFeeRate = grandSales > 0 ? (grandFees / grandSales * 100).toFixed(1) : 0;

                return (
                    <div className="revenue-content delivery-app-mode">
                        <h3 className="del-section-title">🛵 배달앱 정산 분석 — {plYear}년</h3>

                        {/* Grand Total Summary */}
                        <div className="del-summary-bar" style={{ marginBottom: 16 }}>
                            <div className="del-stat highlight">
                                <span className="del-stat-label">총 주문매출</span>
                                <span className="del-stat-value">{formatNumber(grandSales)}원</span>
                            </div>
                            <div className="del-stat" style={{ background: 'rgba(239,68,68,0.15)' }}>
                                <span className="del-stat-label">총 수수료</span>
                                <span className="del-stat-value" style={{ color: '#ef4444' }}>-{formatNumber(grandFees)}원</span>
                            </div>
                            <div className="del-stat" style={{ background: 'rgba(34,197,94,0.15)' }}>
                                <span className="del-stat-label">💰 실 정산금</span>
                                <span className="del-stat-value" style={{ color: '#22c55e', fontWeight: 700 }}>{formatNumber(grandSettle)}원</span>
                            </div>
                            <div className="del-stat">
                                <span className="del-stat-label">총 주문수</span>
                                <span className="del-stat-value">{grandOrders.toLocaleString()}건</span>
                            </div>
                            <div className="del-stat">
                                <span className="del-stat-label">평균 수수료율</span>
                                <span className="del-stat-value">{grandFeeRate}%</span>
                            </div>
                        </div>

                        {/* Channel Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 4)}, 1fr)`, gap: 10, marginBottom: 20 }}>
                            {sortedChannels.map(ch => {
                                const ct = channelTotals[ch];
                                return (
                                    <div key={ch} className="revenue-summary-card" style={{ padding: '14px 16px' }}>
                                        <div className="card-label">{CHANNEL_ICONS[ch]} {ch}</div>
                                        <div className="card-value" style={{ fontSize: 18 }}>{formatNumber(ct.settlement_amount)}원</div>
                                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                                            매출 {formatNumber(ct.total_sales)}원 · 수수료 {ct.fee_rate}%
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b' }}>
                                            {ct.order_count.toLocaleString()}건
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Monthly Breakdown Table */}
                        <div className="del-grid-container" style={{ marginBottom: 20 }}>
                            <table className="del-grid-table" style={{ fontSize: 12 }}>
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 60, textAlign: 'center' }}>월</th>
                                        {sortedChannels.map(ch => (
                                            <th key={ch} colSpan={3} style={{ textAlign: 'center', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                                                {CHANNEL_ICONS[ch]} {ch}
                                            </th>
                                        ))}
                                        <th colSpan={2} style={{ textAlign: 'center', borderLeft: '2px solid rgba(255,255,255,0.15)' }}>합계</th>
                                    </tr>
                                    <tr>
                                        <th></th>
                                        {sortedChannels.map(ch => (
                                            <React.Fragment key={ch}>
                                                <th style={{ fontSize: 10, color: '#94a3b8', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>정산액</th>
                                                <th style={{ fontSize: 10, color: '#94a3b8' }}>수수료</th>
                                                <th style={{ fontSize: 10, color: '#94a3b8' }}>수수료율</th>
                                            </React.Fragment>
                                        ))}
                                        <th style={{ fontSize: 10, color: '#94a3b8', borderLeft: '2px solid rgba(255,255,255,0.15)' }}>정산액</th>
                                        <th style={{ fontSize: 10, color: '#94a3b8' }}>수수료율</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthly.map(m => (
                                        <tr key={`${m.year}-${m.month}`}>
                                            <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.month}월</td>
                                            {sortedChannels.map(ch => {
                                                const chData = m.channels[ch];
                                                if (!chData) return (
                                                    <React.Fragment key={ch}>
                                                        <td style={{ color: '#475569', textAlign: 'right', borderLeft: '2px solid rgba(255,255,255,0.08)' }}>-</td>
                                                        <td style={{ color: '#475569', textAlign: 'right' }}>-</td>
                                                        <td style={{ color: '#475569', textAlign: 'right' }}>-</td>
                                                    </React.Fragment>
                                                );
                                                return (
                                                    <React.Fragment key={ch}>
                                                        <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 500, borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                                                            {formatNumber(chData.settlement_amount)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#ef4444', fontSize: 11 }}>
                                                            -{formatNumber(chData.total_fees)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>
                                                            {chData.fee_rate}%
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                                                {formatNumber(m.total_settlement)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                                                {m.overall_fee_rate}%
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Totals Row */}
                                    <tr className="del-totals-row">
                                        <td style={{ textAlign: 'center' }}><strong>합계</strong></td>
                                        {sortedChannels.map(ch => {
                                            const ct = channelTotals[ch];
                                            return (
                                                <React.Fragment key={ch}>
                                                    <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.08)' }}>
                                                        {formatNumber(ct.settlement_amount)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#ef4444' }}>
                                                        -{formatNumber(ct.total_fees)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                                                        {ct.fee_rate}%
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                        <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                                            {formatNumber(grandSettle)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                                            {grandFeeRate}%
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Channel Fee Breakdown Cards */}
                        <h3 className="del-section-title" style={{ marginTop: 8 }}>📊 채널별 수수료 상세</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 2)}, 1fr)`, gap: 12 }}>
                            {sortedChannels.map(ch => {
                                const ct = channelTotals[ch];
                                // Collect fee breakdowns from latest month
                                const latestMonth = monthly.find(m => m.channels[ch]);
                                const feeBreakdown = latestMonth?.channels[ch]?.fee_breakdown || {};
                                return (
                                    <div key={ch} className="revenue-summary-card" style={{ padding: '14px 16px' }}>
                                        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{CHANNEL_ICONS[ch]} {ch} 수수료 분석</div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                                            총매출 대비 수수료율: <span style={{ color: '#ef4444', fontWeight: 600 }}>{ct.fee_rate}%</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
                                            총 수수료: <span style={{ color: '#ef4444' }}>{formatNumber(ct.total_fees)}원</span> / 총매출: {formatNumber(ct.total_sales)}원
                                        </div>
                                        {Object.keys(feeBreakdown).length > 0 && (
                                            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                                                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>최근 수수료 내역:</div>
                                                {Object.entries(feeBreakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#94a3b8', padding: '2px 0' }}>
                                                        <span>{k}</span>
                                                        <span style={{ color: '#ef4444' }}>{formatNumber(v)}원</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
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

                        {/* Payment Method - Only for store vendors */}
                        {(() => {
                            const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id));
                            if (selectedVendor && selectedVendor.category === 'store') {
                                return (
                                    <div className="form-group">
                                        <label className="form-label">결제수단</label>
                                        <div className="payment-method-toggle" style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="Card"
                                                    checked={form.payment_method === 'Card'}
                                                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                                                    style={{ marginRight: 6 }}
                                                />
                                                💳 카드
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 14 }}>
                                                <input
                                                    type="radio"
                                                    name="paymentMethod"
                                                    value="Cash"
                                                    checked={form.payment_method === 'Cash'}
                                                    onChange={e => setForm({ ...form, payment_method: e.target.value })}
                                                    style={{ marginRight: 6 }}
                                                />
                                                💵 현금
                                            </label>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}

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
