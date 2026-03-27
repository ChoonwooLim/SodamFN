import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit3, Trash2, TrendingUp, Camera, FileSpreadsheet, RotateCcw, UploadCloud } from 'lucide-react';
import axios from 'axios';
import api from '../api';
import UploadHistoryList from '../components/UploadHistoryList';
import { useIsMobile } from '../hooks/useMediaQuery';
import './RevenueManagement.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── PL Revenue (수입상세) ──
const PL_REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출', icon: '🏪' },
    { key: 'revenue_coupang', label: '쿠팡 매출', icon: '🛒' },
    { key: 'revenue_baemin', label: '배민 매출', icon: '🏍️' },
    { key: 'revenue_yogiyo', label: '요기요 매출', icon: '🍜' },
    { key: 'revenue_ddangyo', label: '땡겨요 매출', icon: '📱' },
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
    const [searchParams] = useSearchParams();
    const isMobile = useIsMobile();
    const now = new Date();
    const defaultMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [year, setYear] = useState(defaultMonth.getFullYear());
    const [month, setMonth] = useState(defaultMonth.getMonth() + 1);
    const [tab, setTab] = useState('all'); // all | store | delivery
    const initialView = searchParams.get('view') === 'delivery' ? 'deliveryApp' : 'dashboard';
    const [viewMode, setViewMode] = useState(initialView); // dashboard | list | grid | revenueDetail | deliveryApp | upload
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
    const [classifyData, setClassifyData] = useState(null);

    // ── 수입상세 (Annual PL Revenue) ──
    const [plYear, setPlYear] = useState(now.getFullYear());
    const [plData, setPlData] = useState([]);

    // ── 배달앱 (Delivery App) ──
    const [deliveryChannel, setDeliveryChannel] = useState('coupang');
    const [deliveryAppData, setDeliveryAppData] = useState({});
    const [deliveryRatios, setDeliveryRatios] = useState({}); // channel -> {ratio, settlement, sales, fees}

    // ─── Fetch ───
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [dailyRes, summaryRes, deliverySummaryRes] = await Promise.all([
                api.get('/revenue/daily', { params: { year, month } }),
                api.get('/revenue/summary', { params: { year, month } }),
                api.get(`/revenue/delivery-summary?year=${year}`),
            ]);
            setData(dailyRes.data.data || []);
            setVendors(dailyRes.data.vendors || []);
            setSummary(summaryRes.data || { total: 0, by_category: {} });
            // Build delivery settlement ratio map from delivery-summary
            const dsData = deliverySummaryRes.data || {};
            const ratios = {}; // vendor_name -> { ratio: settlement/sales }
            const monthKey = `${year}-${String(month).padStart(2, '0')}`;
            const monthEntry = (dsData.monthly || []).find(m => `${m.year}-${String(m.month).padStart(2, '0')}` === monthKey);
            if (monthEntry?.channels) {
                Object.entries(monthEntry.channels).forEach(([ch, info]) => {
                    const s = info.total_sales || 0;
                    const st = info.settlement_amount || 0;
                    if (s > 0) {
                        ratios[ch] = { ratio: st / s, settlement: st, sales: s, fees: info.total_fees || 0 };
                    }
                });
            }
            setDeliveryRatios(ratios);
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

                    // Handle password-protected files
                    if (response.data.status === 'password_required') {
                        const pwd = prompt(`🔒 ${file.name}\n\n${response.data.message}`);
                        if (pwd) {
                            const retryFormData = new FormData();
                            retryFormData.append('file', file);
                            retryFormData.append('password', pwd);
                            const retryResponse = await api.post('/upload/excel/revenue', retryFormData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            });
                            if (retryResponse.data.status === 'password_required') {
                                errorFiles.push(`🔒 ${file.name}: 비밀번호가 맞지 않습니다.`);
                            } else if (retryResponse.data.status === 'success') {
                                totalCount += retryResponse.data.count || 0;
                                successCount++;
                                const d = retryResponse.data;
                                let fileMsg = `✅ ${file.name}`;
                                if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                                fileMsg += `: ${d.count || 0}건 저장`;
                                errorFiles.push(fileMsg);
                            } else {
                                errorFiles.push(`❌ ${file.name}: ${retryResponse.data.message}`);
                            }
                        } else {
                            errorFiles.push(`⏭️ ${file.name}: 비밀번호 입력 취소`);
                        }
                    } else if (response.data.status === 'requires_classification') {
                        setClassifyData({
                            file: file,
                            items: response.data.items,
                            message: response.data.message
                        });
                        setUploadLoading(false);
                        if (excelInputRef.current) excelInputRef.current.value = '';
                        return; // Stop processing further files until classified
                    } else if (response.data.status === 'success') {
                        totalCount += response.data.count || 0;
                        successCount++;
                        // Show dedup info if applicable
                        const d = response.data;
                        let fileMsg = `✅ ${file.name}`;
                        if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                        fileMsg += `: ${d.count || 0}건 저장`;
                        if (d.skipped) fileMsg += `, ${d.skipped}건 중복 스킵`;
                        if (d.dedup_skipped) fileMsg += `, ${d.dedup_skipped}건 카드중복 자동제외`;
                        if (d.dedup_replaced) fileMsg += `, ${d.dedup_replaced}건 통합→상세 대체`;
                        errorFiles.push(fileMsg); // reuse array for all file results
                    } else {
                        errorFiles.push(`❌ ${file.name}: ${response.data.message}`);
                    }
                } catch (error) {
                    console.error(`Upload error for ${file.name}:`, error);
                    errorFiles.push(`❌ ${file.name}: 업로드 실패`);
                }
            }
            let message = `📊 ${successCount}개 파일 처리 완료, 총 ${totalCount}건 저장됨\n\n${errorFiles.join('\n')}`;
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

    // Populate from data first to know which vendors have matching data
    const dataForGrid = tab === 'all' ? data
        : (tab === 'cash' || tab === 'card') ? data.filter(d => d.ui_category === tab)
            : data.filter(d => d.ui_category === tab || d.category === tab);

    // For cash/card tabs, only show vendors that actually have matching data
    const relevantVendorIds = (tab === 'cash' || tab === 'card')
        ? new Set(dataForGrid.map(d => d.vendor_id))
        : null;
    const filteredVendors = tab === 'all' ? vendors
        : (tab === 'cash' || tab === 'card') ? vendors.filter(v => v.category === 'store' && relevantVendorIds.has(v.id))
            : vendors.filter(v => v.category === tab);

    filteredVendors.forEach(v => {
        vendorGrid[v.id] = { amounts: {}, ids: {}, channels: {}, notes: {} };
    });
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
    const handleClassifySubmit = async (mappings) => {
        if (!classifyData) return;
        setUploadLoading(true);
        const { file } = classifyData;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classifications', JSON.stringify(mappings));
        
        try {
            const response = await api.post('/upload/excel/revenue', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.status === 'success') {
                const d = response.data;
                let fileMsg = `✅ ${file.name}`;
                if (d.file_type_label) fileMsg += ` (${d.file_type_label})`;
                fileMsg += `: ${d.message || (d.count + '건 저장')}`;
                alert(fileMsg);
            } else {
                alert(`❌ ${file.name}: ${response.data.message}`);
            }
            fetchData();
        } catch (error) {
            console.error('Classification upload error:', error);
            alert('업로드 중 오류가 발생했습니다.');
        } finally {
            setUploadLoading(false);
            setClassifyData(null);
            if (excelInputRef.current) excelInputRef.current.value = '';
        }
    };

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

        // For delivery: calculate 정산금 from amount * settlement ratio
        const VENDOR_CHANNEL_MAP = {'쿠팡': '쿠팡', '쿠팡이츠': '쿠팡', '배달의민족': '배민', '배민': '배민', '요기요': '요기요', '땡겨요': '땡겨요'};
        const getSettlementAmount = (vendorName, amount) => {
            const ch = VENDOR_CHANNEL_MAP[vendorName];
            if (!ch || !deliveryRatios[ch]) return 0;
            return Math.round(amount * deliveryRatios[ch].ratio);
        };
        const calcDeliverySettlementTotal = (vendorId) => {
            const amounts = vendorGrid[vendorId]?.amounts || {};
            const vName = groupVendors.find(v => v.id === vendorId)?.name || '';
            return Object.values(amounts).reduce((sum, a) => sum + getSettlementAmount(vName, a), 0);
        };
        const calcGroupDaySettlementTotal = (d) => groupVendors.reduce((sum, v) => {
            const a = vendorGrid[v.id]?.amounts[d] || 0;
            return sum + getSettlementAmount(v.name, a);
        }, 0);
        const calcGroupSettlementTotal = () => groupVendors.reduce((sum, v) => sum + calcDeliverySettlementTotal(v.id), 0);

        return (
            <>
                <tr className="grid-category-header">
                    <td colSpan={daysInMonth + 2} className="grid-category-cell">
                        {icon} {label} ({groupVendors.length})
                    </td>
                </tr>
                {/* 매출 row (정산금 row 위에) */}
                {groupVendors.map(v => (
                    <React.Fragment key={v.id}>
                        {/* 매출 row */}
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
                        {/* 정산금 row (delivery only) */}
                        {isDelivery && (
                            <tr className="grid-sales-row">
                                {days.map(d => {
                                    const amount = vendorGrid[v.id]?.amounts[d] || 0;
                                    const settlement = getSettlementAmount(v.name, amount);
                                    return (
                                        <td key={d} className="grid-amount-cell grid-sales-cell">
                                            <span className="grid-cell-sales">{settlement ? formatNumber(settlement) : '-'}</span>
                                        </td>
                                    );
                                })}
                                <td className="grid-row-total grid-sales-cell">
                                    <span className="grid-cell-sales">{formatNumber(calcDeliverySettlementTotal(v.id))}</span>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                ))}
                {/* 매출 합계 */}
                <tr className="grid-subtotal-row">
                    <td className="grid-subtotal-label">↳ {isDelivery ? '매출 합계' : tab === 'cash' ? '현금매출 소계' : tab === 'card' ? '카드매출 소계' : `${label} 소계`}</td>
                    {days.map(d => (
                        <td key={d} className="grid-subtotal-cell">
                            {calcGroupDayTotal(d) > 0 ? formatNumber(calcGroupDayTotal(d)) : '-'}
                        </td>
                    ))}
                    <td className="grid-subtotal-total">{formatNumber(calcGroupTotal())}</td>
                </tr>
                {/* 정산금 합계 (delivery only) */}
                {isDelivery && (
                    <tr className="grid-subtotal-row grid-sales-subtotal">
                        <td className="grid-subtotal-label">↳ 정산금 합계</td>
                        {days.map(d => {
                            const t = calcGroupDaySettlementTotal(d);
                            return (
                                <td key={d} className="grid-subtotal-cell grid-sales-cell">
                                    {t > 0 ? formatNumber(t) : '-'}
                                </td>
                            );
                        })}
                        <td className="grid-subtotal-total grid-sales-cell">{formatNumber(calcGroupSettlementTotal())}</td>
                    </tr>
                )}
                {/* 수수료 합계 (delivery only) */}
                {isDelivery && (
                    <tr className="grid-subtotal-row" style={{ background: '#fef2f2' }}>
                        <td className="grid-subtotal-label" style={{ color: '#ef4444', fontWeight: 800 }}>↳ 수수료 합계</td>
                        {days.map(d => {
                            const sales = calcGroupDayTotal(d);
                            const settlement = calcGroupDaySettlementTotal(d);
                            const fee = sales - settlement;
                            return (
                                <td key={d} className="grid-subtotal-cell" style={{ color: '#ef4444', fontWeight: 700 }}>
                                    {fee > 0 ? formatNumber(fee) : '-'}
                                </td>
                            );
                        })}
                        <td className="grid-subtotal-total" style={{ color: '#ef4444', fontWeight: 800 }}>
                            {formatNumber(calcGroupTotal() - calcGroupSettlementTotal())}
                        </td>
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
                        매출관리
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

            {/* ── Summary Cards ── */}
            {!isMobile && (
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
                {!(viewMode === 'list' || viewMode === 'grid') && <div style={{ flex: 1 }} />}
                <div className="view-mode-toggle">
                    {isMobile ? (
                        <>
                            <button
                                className={`view-mode-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setViewMode('dashboard')}
                            >
                                📊 대시보드
                            </button>
                            <button
                                className={`view-mode-btn ${viewMode === 'upload' ? 'active' : ''}`}
                                onClick={() => setViewMode('upload')}
                            >
                                📤 업로드
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className={`view-mode-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setViewMode('dashboard')}
                            >
                                📊 대시보드
                            </button>
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
                                📅 월별 상세 내역
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
                        </>
                    )}
                </div>
            </div>


            {/* ═══════════════════════════════════════════ */}
            {/* MOBILE DASHBOARD - Premium design */}
            {/* ═══════════════════════════════════════════ */}
            {isMobile && viewMode === 'dashboard' && (() => {
                const totalAmt = summary.total || 0;
                const cashAmt = summary.by_category?.cash || 0;
                const cardAmt = summary.by_category?.card || 0;
                const deliveryAmt = summary.by_category?.delivery || 0;
                const byDay = summary.by_day || [];
                const byVendor = (summary.by_vendor || []).slice(0, 10);
                const maxDayTotal = Math.max(...byDay.map(d => d.total || 0), 1);
                const fmtShort = (v) => {
                    if (v >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
                    if (v >= 10000) return `${Math.round(v / 10000).toLocaleString('ko-KR')}만`;
                    return formatNumber(v);
                };

                const CHANNELS = [
                    { key: 'cash', label: '현금매출', icon: '💵', amount: cashAmt },
                    { key: 'card', label: '카드매출', icon: '💳', amount: cardAmt },
                    { key: 'delivery', label: '배달앱매출', icon: '🛵', amount: deliveryAmt },
                ];

                return (
                    <div style={{ padding: '0 16px 80px', marginTop: 16 }}>
                        {/* ── Hero: 총 매출 ── */}
                        <div className="card-animate" style={{
                            background: 'linear-gradient(135deg, #134e4a, #1e3a3a)',
                            borderRadius: 20, padding: '24px 20px', textAlign: 'center',
                            marginBottom: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                        }}>
                            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>총 매출</div>
                            <div style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: -1 }}>
                                {fmtShort(totalAmt)}<span style={{ fontSize: 16, fontWeight: 600, color: '#94a3b8' }}>원</span>
                            </div>
                        </div>

                        {/* ── 3-col: 현금/카드/배달앱 ── */}
                        <div className="card-animate" style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8,
                            marginBottom: 14, animationDelay: '0.05s',
                        }}>
                            {CHANNELS.map((ch) => {
                                const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100).toFixed(1) : '0';
                                return (
                                    <div key={ch.key} style={{
                                        background: 'white', borderRadius: 14, padding: '14px 8px',
                                        textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                    }}>
                                        <div style={{ fontSize: 16, marginBottom: 4 }}>{ch.icon}</div>
                                        <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{ch.label}</div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{fmtShort(ch.amount)}</div>
                                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{pct}%</div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── 채널별 비중 프로그레스 ── */}
                        <div className="card-animate" style={{
                            background: 'white', borderRadius: 16, padding: 16,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 14,
                            animationDelay: '0.1s',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                                background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>📊 채널별 매출 비중</span>
                            </div>
                            {CHANNELS.map(ch => {
                                const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100) : 0;
                                return (
                                    <div key={ch.key} style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>{ch.icon} {ch.label}</span>
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                                {formatNumber(ch.amount)} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                        <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%', borderRadius: 3,
                                                background: ch.key === 'cash' ? '#1e3a3a' : ch.key === 'card' ? '#3d7b7b' : '#7fb5b5',
                                                width: `${pct}%`, transition: 'width 0.5s',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── 일별 매출 추이 ── */}
                        <div className="card-animate" style={{
                            background: 'white', borderRadius: 16, padding: 16,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 14,
                            animationDelay: '0.15s',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                                background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>📈 일별 매출 추이</span>
                            </div>
                            {byDay.length > 0 ? (
                                <div className="rev-daily-chart">
                                    {byDay.map(d => {
                                        const dayNum = d.date.split('-')[2];
                                        return (
                                            <div className="rev-daily-bar" key={d.date}>
                                                <div className="daily-bar-stack">
                                                    {d.delivery > 0 && (
                                                        <div className="daily-bar-seg delivery" style={{ height: `${(d.delivery / maxDayTotal) * 100}%` }} />
                                                    )}
                                                    {d.card > 0 && (
                                                        <div className="daily-bar-seg card" style={{ height: `${(d.card / maxDayTotal) * 100}%` }} />
                                                    )}
                                                    {d.cash > 0 && (
                                                        <div className="daily-bar-seg cash" style={{ height: `${(d.cash / maxDayTotal) * 100}%` }} />
                                                    )}
                                                </div>
                                                <span className="daily-bar-label">{dayNum}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center', fontSize: 12 }}>데이터가 없습니다</div>
                            )}
                            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 10, fontSize: 11, color: '#64748b' }}>
                                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#1e3a3a', marginRight: 4 }} />현금</span>
                                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#3d7b7b', marginRight: 4 }} />카드</span>
                                <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#7fb5b5', marginRight: 4 }} />배달앱</span>
                            </div>
                        </div>

                        {/* ── TOP 거래처 ── */}
                        <div className="card-animate" style={{
                            background: 'white', borderRadius: 16, padding: 16,
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            animationDelay: '0.2s',
                        }}>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                                background: 'linear-gradient(135deg, #1e293b, #334155)',
                            }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9' }}>🏆 TOP {byVendor.length} 거래처</span>
                            </div>
                            {byVendor.length > 0 ? byVendor.map((v, i) => (
                                <div key={v.name} style={{
                                    display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 0',
                                    borderBottom: i < byVendor.length - 1 ? '1px solid #f1f5f9' : 'none',
                                }}>
                                    <span style={{
                                        width: 22, height: 22, borderRadius: 6, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                                        background: i < 3 ? 'linear-gradient(135deg, #1e293b, #334155)' : '#f1f5f9',
                                        color: i < 3 ? '#f1f5f9' : '#64748b',
                                    }}>{i + 1}</span>
                                    <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#334155' }}>{v.name}</span>
                                    <span style={{ fontSize: 10 }}>
                                        {v.category === 'cash' ? '💵' : v.category === 'card' ? '💳' : '🛵'}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{formatNumber(v.total)}원</span>
                                </div>
                            )) : (
                                <div style={{ color: '#94a3b8', padding: 24, textAlign: 'center', fontSize: 12 }}>거래처 데이터가 없습니다</div>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* ═══════════════════════════════════════════ */}
            {/* DESKTOP DASHBOARD VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {!isMobile && viewMode === 'dashboard' && (() => {
                const totalAmt = summary.total || 0;
                const cashAmt = summary.by_category?.cash || 0;
                const cardAmt = summary.by_category?.card || 0;
                const deliveryAmt = summary.by_category?.delivery || 0;
                const byDay = summary.by_day || [];
                const byVendor = (summary.by_vendor || []).slice(0, 10);
                const maxDayTotal = Math.max(...byDay.map(d => d.total || 0), 1);

                const CHANNELS = [
                    { key: 'cash', label: '현금매출', icon: '💵', color: '#1e3a3a', amount: cashAmt },
                    { key: 'card', label: '카드매출', icon: '💳', color: '#3d7b7b', amount: cardAmt },
                    { key: 'delivery', label: '배달앱매출', icon: '🛵', color: '#7fb5b5', amount: deliveryAmt },
                ];

                return (
                    <div className="revenue-dashboard">
                        {/* Channel Breakdown */}
                        <div className="rev-dash-section">
                            <h3>📊 채널별 매출 비중</h3>
                            <div className="rev-channel-bars">
                                {CHANNELS.map(ch => {
                                    const pct = totalAmt > 0 ? (ch.amount / totalAmt * 100) : 0;
                                    return (
                                        <div className="rev-channel-bar-item" key={ch.key}>
                                            <div className="bar-label">
                                                <span>{ch.icon} {ch.label}</span>
                                                <span className="bar-amount">{formatNumber(ch.amount)}원 ({pct.toFixed(1)}%)</span>
                                            </div>
                                            <div className="bar-track">
                                                <div className="bar-fill" style={{ width: `${pct}%`, background: ch.color }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Daily Revenue Chart */}
                        <div className="rev-dash-section">
                            <h3>📈 일별 매출 추이</h3>
                            {byDay.length > 0 ? (
                                <div className="rev-daily-chart">
                                    {byDay.map(d => {
                                        const dayNum = d.date.split('-')[2];
                                        return (
                                            <div className="rev-daily-bar" key={d.date}>
                                                <div className="daily-bar-stack">
                                                    {d.delivery > 0 && (
                                                        <div className="daily-bar-seg delivery" style={{ height: `${(d.delivery / maxDayTotal) * 100}%` }} title={`배달 ${formatNumber(d.delivery)}`} />
                                                    )}
                                                    {d.card > 0 && (
                                                        <div className="daily-bar-seg card" style={{ height: `${(d.card / maxDayTotal) * 100}%` }} title={`카드 ${formatNumber(d.card)}`} />
                                                    )}
                                                    {d.cash > 0 && (
                                                        <div className="daily-bar-seg cash" style={{ height: `${(d.cash / maxDayTotal) * 100}%` }} title={`현금 ${formatNumber(d.cash)}`} />
                                                    )}
                                                </div>
                                                <span className="daily-bar-label">{dayNum}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div style={{ color: '#9ca3af', padding: 24, textAlign: 'center' }}>데이터가 없습니다</div>
                            )}
                            <div className="rev-daily-legend">
                                <span><span className="legend-dot" style={{ background: '#1e3a3a' }} />현금</span>
                                <span><span className="legend-dot" style={{ background: '#3d7b7b' }} />카드</span>
                                <span><span className="legend-dot" style={{ background: '#7fb5b5' }} />배달앱</span>
                            </div>
                        </div>

                        {/* Top Vendors */}
                        <div className="rev-dash-section">
                            <h3>🏆 TOP {byVendor.length} 거래처</h3>
                            <div className="rev-top-vendors">
                                {byVendor.length > 0 ? byVendor.map((v, i) => (
                                    <div className="rev-vendor-item" key={v.name}>
                                        <span className={`tv-rank ${i < 3 ? 'top3' : ''}`}>{i + 1}</span>
                                        <span className="tv-name">{v.name}</span>
                                        <span className={`tv-cat-badge ${v.category}`}>
                                            {v.category === 'cash' ? '💵' : v.category === 'card' ? '💳' : '🛵'}
                                        </span>
                                        <span className="tv-amount">{formatNumber(v.total)}원</span>
                                    </div>
                                )) : (
                                    <div style={{ color: '#9ca3af', padding: 24, textAlign: 'center' }}>거래처 데이터가 없습니다</div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}


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
                                    
                                    const isCashCollapsed = collapsedCards[`cash-${dateStr}`] !== false; // default collapsed
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
                                        /* ── Cash items collapse toggle ── */
                                        cashItems.length > 0 && renderToggleRow(
                                            `cash-toggle-${dateStr}`, '💵', '현금매출',
                                            cashItems.length, cashItemsTotal,
                                            isCashCollapsed, `cash-${dateStr}`, 'cash-toggle-row'
                                        ),
                                        /* ── Cash items (collapsible, green tint) ── */
                                        ...(!isCashCollapsed ? cashItems.map(item =>
                                            renderItemRow(item, '💵', '현금매출', 'cash', 'cash-row', false)
                                        ) : []),
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
            {viewMode === 'grid' && isMobile ? (
                <div className="revenue-content">
                    <div className="desktop-only-notice">
                        <div className="notice-icon">🖥️</div>
                        <h3>월별 상세 내역은 PC에서 확인해주세요</h3>
                        <p>31일 × 거래처 그리드는 넓은 화면에서 최적화되어 있습니다.<br />📋 리스트 탭에서 데이터를 확인하실 수 있습니다.</p>
                    </div>
                </div>
            ) : viewMode === 'grid' && (
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

                                    {tab === 'delivery' ? (
                                        <tr className="grid-grand-total-row">
                                            <td className="grid-vendor-cell"><strong>수수료율(%)</strong></td>
                                            {days.map(d => {
                                                const DELIVERY_CATS = REVENUE_CATEGORIES.filter(c => c.id === 'delivery');
                                                const deliveryVendors = DELIVERY_CATS.flatMap(c => groupedVendorsGrid[c.id] || []);
                                                const daySales = deliveryVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
                                                const VENDOR_CHANNEL_MAP = {'쿠팡': '쿠팡', '쿠팡이츠': '쿠팡', '배달의민족': '배민', '배민': '배민', '요기요': '요기요', '땡겨요': '땡겨요'};
                                                const daySettlement = deliveryVendors.reduce((sum, v) => {
                                                    const a = vendorGrid[v.id]?.amounts[d] || 0;
                                                    const ch = VENDOR_CHANNEL_MAP[v.name];
                                                    if (!ch || !deliveryRatios[ch]) return sum;
                                                    return sum + Math.round(a * deliveryRatios[ch].ratio);
                                                }, 0);
                                                const feeRate = daySales > 0 ? ((daySales - daySettlement) / daySales * 100) : 0;
                                                return (
                                                    <td key={d} className="grid-day-total" style={{ color: '#0f172a' }}>
                                                        {daySales > 0 ? `${feeRate.toFixed(1)}%` : '-'}
                                                    </td>
                                                );
                                            })}
                                            <td className="grid-grand-total" style={{ color: '#0f172a' }}>
                                                {(() => {
                                                    const DELIVERY_CATS = REVENUE_CATEGORIES.filter(c => c.id === 'delivery');
                                                    const deliveryVendors = DELIVERY_CATS.flatMap(c => groupedVendorsGrid[c.id] || []);
                                                    const totalSales = deliveryVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);
                                                    const VENDOR_CHANNEL_MAP = {'쿠팡': '쿠팡', '쿠팡이츠': '쿠팡', '배달의민족': '배민', '배민': '배민', '요기요': '요기요', '땡겨요': '땡겨요'};
                                                    const totalSettlement = deliveryVendors.reduce((sum, v) => {
                                                        const amounts = vendorGrid[v.id]?.amounts || {};
                                                        const ch = VENDOR_CHANNEL_MAP[v.name];
                                                        if (!ch || !deliveryRatios[ch]) return sum;
                                                        return sum + Object.values(amounts).reduce((s, a) => s + Math.round(a * deliveryRatios[ch].ratio), 0);
                                                    }, 0);
                                                    const rate = totalSales > 0 ? ((totalSales - totalSettlement) / totalSales * 100) : 0;
                                                    return `${rate.toFixed(1)}%`;
                                                })()}
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr className="grid-grand-total-row">
                                            <td className="grid-vendor-cell"><strong>총 합계</strong></td>
                                            {days.map(d => (
                                                <td key={d} className="grid-day-total">
                                                    {dayTotals[d] > 0 ? formatNumber(dayTotals[d]) : '-'}
                                                </td>
                                            ))}
                                            <td className="grid-grand-total">{formatNumber(gridGrandTotal)}</td>
                                        </tr>
                                    )}
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
            {viewMode === 'revenueDetail' && isMobile ? (
                <div className="revenue-content">
                    <div className="desktop-only-notice">
                        <div className="notice-icon">🖥️</div>
                        <h3>매출요약은 PC에서 확인해주세요</h3>
                        <p>12개월 매트릭스 테이블은 넓은 화면에서 최적화되어 있습니다.</p>
                    </div>
                </div>
            ) : viewMode === 'revenueDetail' && (() => {
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

            {viewMode === 'deliveryApp' && isMobile ? (
                <div className="revenue-content">
                    <div className="desktop-only-notice">
                        <div className="notice-icon">🖥️</div>
                        <h3>배달앱 상세 내역은 PC에서 확인해주세요</h3>
                        <p>배달앱 비교 분석 테이블은 넓은 화면에서 최적화되어 있습니다.</p>
                    </div>
                </div>
            ) : viewMode === 'deliveryApp' && (() => {
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
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
                            <div className="revenue-summary-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>📊 총 주문매출</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{formatNumber(grandSales)}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '2px' }}>원</span></div>
                            </div>
                            
                            <div className="revenue-summary-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>🧾 총 수수료</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#ef4444' }}>-{formatNumber(grandFees)}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '2px' }}>원</span></div>
                            </div>

                            <div className="revenue-summary-card" style={{ padding: '20px', background: '#f0fdf4', borderRadius: '16px', border: '1px solid #bbf7d0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '14px', color: '#047857', fontWeight: 700, marginBottom: '8px' }}>💰 실 정산금</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#16a34a' }}>{formatNumber(grandSettle)}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '2px' }}>원</span></div>
                            </div>

                            <div className="revenue-summary-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>📦 총 주문수</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{grandOrders.toLocaleString()}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '2px' }}>건</span></div>
                            </div>

                            <div className="revenue-summary-card" style={{ padding: '20px', background: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, marginBottom: '8px' }}>📈 평균 수수료율</div>
                                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>{grandFeeRate}<span style={{ fontSize: '16px', fontWeight: 600, marginLeft: '2px' }}>%</span></div>
                            </div>
                        </div>

                        {/* Channel Summary Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 4)}, 1fr)`, gap: 10, marginBottom: 20 }}>
                            {sortedChannels.map(ch => {
                                const ct = channelTotals[ch];
                                return (
                                    <div key={ch} className="revenue-summary-card" style={{ padding: '20px 24px', flex: 1 }}>
                                        <div className="card-label" style={{ fontSize: '15px', color: '#64748b' }}>{CHANNEL_ICONS[ch]} {ch}</div>
                                        <div className="card-value" style={{ fontSize: 26, fontWeight: 800, margin: '8px 0', color: '#0f172a' }}>{formatNumber(ct.settlement_amount)}원</div>
                                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                                            매출 {formatNumber(ct.total_sales)}원 · 수수료 {ct.fee_rate}%
                                        </div>
                                        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                                            {ct.order_count.toLocaleString()}건
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Monthly Breakdown Table */}
                        <div className="del-grid-container" style={{ marginBottom: 20 }}>
                            <table className="del-grid-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: 80, padding: '16px 8px', textAlign: 'center' }}>월</th>
                                        {sortedChannels.map((ch, idx) => (
                                            <th key={ch} colSpan={4} style={{ 
                                                padding: '16px 8px', textAlign: 'center', 
                                                borderLeft: '1px solid rgba(255,255,255,0.2)',
                                                background: idx % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'transparent'
                                            }}>
                                                {CHANNEL_ICONS[ch]} {ch}
                                            </th>
                                        ))}
                                        <th colSpan={3} style={{ padding: '16px 8px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.3)' }}>합계</th>
                                    </tr>
                                    <tr>
                                        <th></th>
                                        {sortedChannels.map((ch, idx) => {
                                            const darkBg = idx % 2 === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)';
                                            return (
                                            <React.Fragment key={ch}>
                                                <th style={{ padding: '12px 6px', color: '#bfdbfe', borderLeft: '1px solid rgba(255,255,255,0.15)', background: darkBg }}>매출</th>
                                                <th style={{ padding: '12px 6px', color: '#bbf7d0', background: darkBg }}>정산</th>
                                                <th style={{ padding: '12px 6px', color: '#fecaca', background: darkBg }}>수수료</th>
                                                <th style={{ padding: '12px 6px', color: '#e2e8f0', background: darkBg }}>수수료율</th>
                                            </React.Fragment>
                                        )})}
                                        <th style={{ padding: '12px 6px', color: '#bfdbfe', borderLeft: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.06)' }}>매출</th>
                                        <th style={{ padding: '12px 6px', color: '#bbf7d0', background: 'rgba(255,255,255,0.06)' }}>정산</th>
                                        <th style={{ padding: '12px 6px', color: '#e2e8f0', background: 'rgba(255,255,255,0.06)' }}>수수료율</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthly.map(m => {
                                        const rowSales = sortedChannels.reduce((s, ch) => s + (m.channels[ch]?.total_sales || 0), 0);
                                        const rowSettle = m.total_settlement || 0;
                                        const rowFeeRate = rowSales > 0 ? ((rowSales - rowSettle) / rowSales * 100).toFixed(1) : 0;
                                        return (
                                        <tr key={`${m.year}-${m.month}`}>
                                            <td style={{ textAlign: 'center', fontWeight: 600, padding: '12px 8px' }}>{m.month}월</td>
                                            {sortedChannels.map((ch, idx) => {
                                                const chData = m.channels[ch];
                                                const groupBg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
                                                if (!chData) return (
                                                    <React.Fragment key={ch}>
                                                        <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', borderLeft: '1px solid #e2e8f0', background: groupBg }}>-</td>
                                                        <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                                        <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                                        <td style={{ color: '#94a3b8', textAlign: 'right', padding: '14px 8px', background: groupBg }}>-</td>
                                                    </React.Fragment>
                                                );
                                                return (
                                                    <React.Fragment key={ch}>
                                                        <td style={{ textAlign: 'right', color: '#3b82f6', fontWeight: 600, padding: '14px 8px', borderLeft: '1px solid #e2e8f0', background: groupBg }}>
                                                            {formatNumber(chData.total_sales)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 600, padding: '14px 8px', background: groupBg }}>
                                                            {formatNumber(chData.settlement_amount)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#dc2626', padding: '14px 8px', background: groupBg }}>
                                                            -{formatNumber(chData.total_fees)}
                                                        </td>
                                                        <td style={{ textAlign: 'right', color: '#64748b', padding: '14px 8px', background: groupBg }}>
                                                            {chData.fee_rate}%
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                            <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 800, padding: '14px 8px', borderLeft: '2px solid #cbd5e1', background: '#f1f5f9' }}>
                                                {formatNumber(rowSales)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, padding: '14px 8px', background: '#f1f5f9' }}>
                                                {formatNumber(rowSettle)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#475569', fontWeight: 600, padding: '14px 8px', background: '#f1f5f9' }}>
                                                {rowFeeRate}%
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {/* Totals Row */}
                                    <tr className="del-totals-row">
                                        <td style={{ textAlign: 'center' }}><strong>합계</strong></td>
                                        {sortedChannels.map((ch, idx) => {
                                            const ct = channelTotals[ch];
                                            const groupBg = idx % 2 === 0 ? '#f0fdf4' : '#f8fafc'; // 조금 더 푸른/초록빛으로 합계 강조
                                            return (
                                                <React.Fragment key={ch}>
                                                    <td style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 700, borderLeft: '1px solid #059669', background: groupBg }}>
                                                        {formatNumber(ct.total_sales)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700, background: groupBg }}>
                                                        {formatNumber(ct.settlement_amount)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#ef4444', background: groupBg }}>
                                                        -{formatNumber(ct.total_fees)}
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: '#94a3b8', background: groupBg }}>
                                                        {ct.fee_rate}%
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                        <td style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 700, borderLeft: '2px solid rgba(255,255,255,0.15)' }}>
                                            {formatNumber(grandSales)}
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#22c55e', fontWeight: 700 }}>
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
                        <h3 className="del-section-title" style={{ marginTop: 24, fontSize: '1.25rem' }}>📊 채널별 수수료 상세</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(sortedChannels.length, 4)}, 1fr)`, gap: 16 }}>
                            {sortedChannels.map(ch => {
                                const ct = channelTotals[ch];
                                // Collect fee breakdowns from latest month
                                const latestMonth = monthly.find(m => m.channels[ch]);
                                const feeBreakdown = latestMonth?.channels[ch]?.fee_breakdown || {};
                                return (
                                    <div key={ch} className="revenue-summary-card" style={{ padding: '24px' }}>
                                        <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 12 }}>{CHANNEL_ICONS[ch]} {ch} 수수료 분석</div>
                                        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 6 }}>
                                            총매출 대비 수수료율: <span style={{ color: '#ef4444', fontWeight: 700 }}>{ct.fee_rate}%</span>
                                        </div>
                                        <div style={{ fontSize: 14, color: '#64748b', marginBottom: 12 }}>
                                            총 수수료: <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatNumber(ct.total_fees)}원</span> / 총매출: {formatNumber(ct.total_sales)}원
                                        </div>
                                        {Object.keys(feeBreakdown).length > 0 && (
                                            <div style={{ borderTop: '2px dashed #e2e8f0', paddingTop: 12, marginTop: 12 }}>
                                                <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 8 }}>최근 세부 수수료 내역:</div>
                                                {Object.entries(feeBreakdown).filter(([, v]) => v > 0).map(([k, v]) => (
                                                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b', padding: '4px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                        <span>{k}</span>
                                                        <span style={{ color: '#ef4444', fontWeight: 500 }}>{formatNumber(v)}원</span>
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

            {/* Classification Modal */}
            {classifyData && (
                <div className="revenue-modal-overlay" onClick={() => setClassifyData(null)}>
                    <div className="revenue-modal" style={{maxWidth: '620px', width: '95%', maxHeight: '80vh', display: 'flex', flexDirection: 'column'}} onClick={e => e.stopPropagation()}>
                        <h2>🔍 은행 입금내역 자동 분류</h2>
                        <p style={{fontSize: 13, color: '#94a3b8', marginBottom: 16, marginTop: 0}}>{classifyData.message}</p>
                        
                        <div style={{flex: 1, overflowY:'auto', background:'#f8fafc', padding: 12, borderRadius: 12, marginBottom: 16, border: '1px solid #e2e8f0'}}>
                            {classifyData.items.map((item, idx) => {
                                const handleSelect = (val) => {
                                    const newItems = [...classifyData.items];
                                    newItems[idx].selected_category = val;
                                    setClassifyData({...classifyData, items: newItems});
                                };
                                return (
                                    <div key={idx} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderBottom:'1px solid #e2e8f0', gap: 12}}>
                                        <div style={{display:'flex', flexDirection:'column', flex: 1, minWidth: 0}}>
                                            <span style={{fontSize: 14, fontWeight: 700, color: '#1e293b'}}>{item.memo}</span>
                                            <span style={{fontSize: 12, color: '#94a3b8'}}>{item.date} | {formatNumber(item.amount)}원</span>
                                        </div>
                                        <select 
                                            value={item.selected_category || item.default_category || ''} 
                                            onChange={e => handleSelect(e.target.value)}
                                            style={{padding: '8px 12px', borderRadius: 8, background: 'white', border: '2px solid #e2e8f0', color: '#1e293b', fontSize: 13, fontWeight: 600, minWidth: 170, cursor: 'pointer'}}
                                        >
                                            <option value="">카테고리 선택...</option>
                                            <option value="카드수수료">💳 카드수수료 정산</option>
                                            <option value="현금매출">💵 현금매출</option>
                                            <option value="개인가계부">🏠 개인가계부(개인송금)</option>
                                            <option value="무시">🚫 등록 안 함 (무시)</option>
                                        </select>
                                    </div>
                                )
                            })}
                        </div>
                        
                        <div className="revenue-modal-actions">
                            <button className="modal-btn secondary" onClick={() => setClassifyData(null)}>취소</button>
                            <button className="modal-btn primary" onClick={() => {
                                const mappings = classifyData.items.map(i => ({
                                    memo: i.memo,
                                    category: i.selected_category || i.default_category
                                })).filter(i => i.category && i.category !== '');
                                if (mappings.length === 0) {
                                    alert('최소 1개 이상의 항목에 카테고리를 선택해주세요.');
                                    return;
                                }
                                handleClassifySubmit(mappings);
                            }}>
                                ✅ 분류 저장 및 업로드 계속
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* UPLOAD VIEW — Image / Excel Upload */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'upload' && (
                isMobile ? (
                    <div style={{ padding: '0 16px 80px', marginTop: 16 }}>
                        {/* Upload sub-tabs */}
                        <div className="card-animate" style={{
                            display: 'flex', gap: 6, marginBottom: 14,
                        }}>
                            {[
                                { id: 'camera', label: '📷 촬영/이미지', bg: 'linear-gradient(135deg, #1e2d3b, #2d4a5e)' },
                                { id: 'excel', label: '📄 문서 업로드', bg: 'linear-gradient(135deg, #1e3a2d, #2d5e4a)' },
                                { id: 'history', label: '🔄 취소/기록', bg: 'linear-gradient(135deg, #1e293b, #334155)' },
                            ].map(t => (
                                <button key={t.id} onClick={() => setUploadTab(t.id)} style={{
                                    flex: 1, padding: '10px 6px', borderRadius: 10, border: 'none',
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    background: uploadTab === t.id ? t.bg : '#f1f5f9',
                                    color: uploadTab === t.id ? '#f1f5f9' : '#64748b',
                                    transition: 'all 0.2s',
                                }}>
                                    {t.label}
                                </button>
                            ))}
                        </div>

                        {uploadTab === 'history' ? (
                            <div className="card-animate" style={{
                                background: 'white', borderRadius: 16, padding: 16,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)', animationDelay: '0.05s',
                            }}>
                                <div style={{
                                    padding: '8px 12px', borderRadius: 10, marginBottom: 12,
                                    background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                                }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>🔄 업로드 기록</span>
                                </div>
                                <UploadHistoryList type="revenue" onRollback={fetchData} />
                            </div>
                        ) : (
                            <div className="card-animate" style={{
                                background: 'white', borderRadius: 16,
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                overflow: 'hidden', animationDelay: '0.05s',
                            }}>
                                <div style={{
                                    padding: '8px 12px', margin: 16, marginBottom: 0,
                                    borderRadius: 10, background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                                }}>
                                    <span style={{ fontSize: 13, fontWeight: 800, color: '#334155' }}>
                                        {uploadTab === 'camera' ? '📷 이미지 업로드' : '📄 문서 업로드'}
                                    </span>
                                </div>
                                <div
                                    onClick={() => uploadTab === 'camera' ? fileInputRef.current?.click() : excelInputRef.current?.click()}
                                    style={{
                                        margin: 16, padding: '40px 20px', borderRadius: 14,
                                        border: '2px dashed #cbd5e1', textAlign: 'center', cursor: 'pointer',
                                        background: '#f8fafc', transition: 'border-color 0.2s',
                                    }}
                                >
                                    {uploadLoading ? (
                                        <div>
                                            <div className="spinner" />
                                            <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>{uploadProgress || '처리 중입니다...'}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{
                                                width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                                                background: uploadTab === 'camera'
                                                    ? 'linear-gradient(135deg, #1e2d3b, #2d4a5e)'
                                                    : 'linear-gradient(135deg, #1e3a2d, #2d5e4a)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                {uploadTab === 'camera' ? <Camera size={24} color="#f1f5f9" /> : <UploadCloud size={24} color="#f1f5f9" />}
                                            </div>
                                            <p style={{ fontSize: 14, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                                                {uploadTab === 'camera' ? '클릭하여 이미지 선택' : '클릭하여 문서 파일 선택'}
                                            </p>
                                            <p style={{ fontSize: 11, color: '#94a3b8' }}>
                                                {uploadTab === 'camera'
                                                    ? '영수증 또는 매출 내역 이미지를 업로드하세요'
                                                    : '엑셀, PDF, CSV 파일 지원 — 여러 파일 선택 가능'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Hidden file inputs */}
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={fileInputRef} onChange={handleUploadFileChange} />
                        <input type="file" accept=".xlsx,.xls,.pdf,.csv" multiple style={{ display: 'none' }} ref={excelInputRef} onChange={handleUploadFileChange} />
                    </div>
                ) : (
                    <div className="revenue-content upload-mode">
                        <div className="upload-section">
                            <div className="upload-tabs">
                                <button className={`upload-tab-btn ${uploadTab === 'camera' ? 'active camera' : ''}`} onClick={() => setUploadTab('camera')}>
                                    <Camera size={16} /> 촬영/이미지
                                </button>
                                <button className={`upload-tab-btn ${uploadTab === 'excel' ? 'active excel' : ''}`} onClick={() => setUploadTab('excel')}>
                                    <FileSpreadsheet size={16} /> 문서 업로드
                                </button>
                                <button className={`upload-tab-btn ${uploadTab === 'history' ? 'active history' : ''}`} onClick={() => setUploadTab('history')}>
                                    <RotateCcw size={16} /> 취소/기록
                                </button>
                            </div>

                            {uploadTab === 'history' ? (
                                <div className="upload-history-wrapper">
                                    <UploadHistoryList type="revenue" onRollback={fetchData} />
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
                                                {uploadTab === 'camera' ? '클릭하여 이미지 선택' : '클릭하여 문서 파일 선택'}
                                            </p>
                                            <p className="upload-sub-text">
                                                {uploadTab === 'camera'
                                                    ? '영수증 또는 매출 내역 이미지를 업로드하세요'
                                                    : '엑셀, PDF, CSV 파일 지원 — 여러 파일 선택 가능'}
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Hidden file inputs */}
                        <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} ref={fileInputRef} onChange={handleUploadFileChange} />
                        <input type="file" accept=".xlsx,.xls,.pdf,.csv" multiple style={{ display: 'none' }} ref={excelInputRef} onChange={handleUploadFileChange} />
                    </div>
                )
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

            {/* ═══ Bank Deposit Classification Modal ═══ */}
            {classifyData && (
                <div className="revenue-modal-overlay" onClick={() => setClassifyData(null)}>
                    <div className="revenue-modal" style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: 4 }}>🏦 은행 입금내역 분류</h3>
                        <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                            {classifyData.message || '각 송금자를 카테고리별로 분류해주세요.'}
                        </p>
                        
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                            {['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'].map(cat => {
                                const catColors = {
                                    '카드입금': '#3b82f6', '페이입금': '#8b5cf6', '배달앱입금': '#f59e0b',
                                    '현금매출': '#10b981', '개인거래': '#6b7280', '무시': '#d1d5db'
                                };
                                return (
                                    <button key={cat} style={{
                                        fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                        border: `1px solid ${catColors[cat]}40`, background: `${catColors[cat]}10`,
                                        color: catColors[cat], fontWeight: 700, cursor: 'default'
                                    }}>{cat}</button>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(classifyData.items || []).map((item, idx) => {
                                const catColors = {
                                    '카드입금': '#3b82f6', '페이입금': '#8b5cf6', '배달앱입금': '#f59e0b',
                                    '현금매출': '#10b981', '개인거래': '#6b7280', '무시': '#d1d5db',
                                    '카드수수료': '#3b82f6', '?': '#ef4444'
                                };
                                const validCats = ['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'];
                                const defaultCat = validCats.includes(item.default_category) ? item.default_category : '개인거래';
                                const selected = item._category || defaultCat;
                                const color = catColors[selected] || '#6b7280';

                                return (
                                    <div key={idx} style={{
                                        display: 'flex', alignItems: 'center', gap: 10,
                                        padding: '8px 12px', borderRadius: 10,
                                        background: `${color}08`, border: `1px solid ${color}20`,
                                    }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {item.memo}
                                                {item.card_company && (
                                                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#3b82f615', color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>
                                                        {item.card_company}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: 11, color: '#64748b' }}>
                                                {item.count}건 · {Number(item.total_amount).toLocaleString()}원
                                            </div>
                                        </div>
                                        <select
                                            value={selected}
                                            onChange={e => {
                                                const newItems = [...classifyData.items];
                                                newItems[idx] = { ...newItems[idx], _category: e.target.value };
                                                setClassifyData({ ...classifyData, items: newItems });
                                            }}
                                            style={{
                                                fontSize: 12, padding: '6px 10px', borderRadius: 8,
                                                border: `1.5px solid ${color}`, background: `${color}15`,
                                                color, fontWeight: 700, cursor: 'pointer', minWidth: 110,
                                            }}
                                        >
                                            <option value="카드입금">💳 카드입금</option>
                                            <option value="페이입금">📱 페이입금</option>
                                            <option value="배달앱입금">🛵 배달앱입금</option>
                                            <option value="현금매출">💵 현금매출</option>
                                            <option value="개인거래">👤 개인거래</option>
                                            <option value="무시">⛔ 무시</option>
                                        </select>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="revenue-modal-actions" style={{ marginTop: 16 }}>
                            <button className="modal-btn secondary" onClick={() => setClassifyData(null)}>취소</button>
                            <button className="modal-btn primary" onClick={async () => {
                                // Build classifications
                                const classifications = (classifyData.items || []).map(item => {
                                    const validCats = ['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'];
                                    const defaultCat = validCats.includes(item.default_category) ? item.default_category : '개인거래';
                                    return {
                                        memo: item.memo,
                                        category: item._category || defaultCat
                                    };
                                });

                                // Re-upload with classifications
                                const savedFile = classifyData.file;
                                try {
                                    setClassifyData(null);
                                    setUploadLoading(true);
                                    setUploadProgress('분류 적용 중...');
                                    
                                    const formData = new FormData();
                                    formData.append('file', savedFile);
                                    formData.append('classifications', JSON.stringify(classifications));
                                    
                                    const response = await api.post('/upload/excel/revenue', formData, {
                                        headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    
                                    if (response.data.status === 'success') {
                                        const d = response.data;
                                        if (d.bank_summary) {
                                            const bs = d.bank_summary;
                                            let msg = `🏦 은행 입금내역 분석 완료 (${bs.period})\n\n`;
                                            msg += `💳 카드매출: ${Number(bs.card_sales).toLocaleString()}원\n`;
                                            msg += `💰 카드입금: ${Number(bs.card_deposit).toLocaleString()}원\n`;
                                            msg += `📊 카드수수료: ${Number(bs.card_fee).toLocaleString()}원 (${bs.card_fee_rate}%)\n\n`;
                                            if (bs.card_companies && bs.card_companies.length > 0) {
                                                msg += `\n💳 카드사별 수수료:\n`;
                                                msg += `${'카드사'.padEnd(8)} ${'매출'.padStart(12)} ${'입금'.padStart(12)} ${'수수료'.padStart(10)} ${'%'.padStart(6)}\n`;
                                                bs.card_companies.forEach(cc => {
                                                    msg += `${cc.company.padEnd(8)} ${Number(cc.sales).toLocaleString().padStart(12)} ${Number(cc.deposit).toLocaleString().padStart(12)} ${Number(cc.fee).toLocaleString().padStart(10)} ${cc.rate}%\n`;
                                                });
                                            }
                                            if (bs.cash_sales_count > 0) {
                                                msg += `\n💵 현금매출: ${bs.cash_sales_count}건 / ${Number(bs.cash_sales_total).toLocaleString()}원 → 매출 저장 ✅\n`;
                                            }
                                            if (bs.categories) {
                                                msg += `\n📋 전체 분류:\n`;
                                                Object.entries(bs.categories).forEach(([k, v]) => {
                                                    const saved = k === '현금매출' ? ' ✅저장' : '';
                                                    msg += `  ${k}: ${v.count}건 / ${Number(v.amount).toLocaleString()}원${saved}\n`;
                                                });
                                            }
                                            alert(msg);
                                        } else {
                                            alert(`✅ 처리 완료!\n${d.count || 0}건 저장${d.skipped ? `, ${d.skipped}건 중복 스킵` : ''}`);
                                        }
                                        fetchData();
                                    } else {
                                        alert('처리 실패: ' + (response.data.message || ''));
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('분류 저장 중 오류가 발생했습니다.');
                                } finally {
                                    setUploadLoading(false);
                                    setUploadProgress('');
                                }
                            }}>
                                ✅ 분류 완료 · 저장
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
