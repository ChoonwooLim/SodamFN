import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Edit3, Trash2, ShoppingBag, UploadCloud, RotateCcw, X, Search, Filter, Wallet, ArrowRightLeft, CheckSquare, Square, ChevronDown, ChevronUp, FileSpreadsheet, Camera } from 'lucide-react';
import api from '../../api';
import UploadHistoryList from '../../components/UploadHistoryList';
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

import { formatNumber, getWeekday } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../utils/constants';


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
    const [uploadTab, setUploadTab] = useState('camera'); // camera | excel | history
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
    const imageInputRef = useRef(null);
    const [ocrResult, setOcrResult] = useState(null);

    // Vendor Review Modal (2-step upload)
    const [showVendorReview, setShowVendorReview] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [vendorDecisions, setVendorDecisions] = useState({});
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [showNewCategoryFor, setShowNewCategoryFor] = useState(null);
    const [excludedVendors, setExcludedVendors] = useState(new Set());
    const [dismissedSimilars, setDismissedSimilars] = useState(new Set()); // per-similar-vendor dismiss

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
        console.log('[DELETE] Attempting to delete expense id:', id);
        if (!window.confirm('이 내역을 삭제하시겠습니까?')) {
            console.log('[DELETE] User cancelled');
            return;
        }
        try {
            console.log('[DELETE] Sending DELETE request to /purchase/' + id);
            const res = await api.delete(`/purchase/${id}`);
            console.log('[DELETE] Response:', res.data);
            fetchData();
        } catch (err) {
            console.error('[DELETE] Error:', err);
            console.error('[DELETE] Response:', err.response?.status, err.response?.data);
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
                await confirmUpload(preview.records, {}, preview.original_filename);
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

    const confirmUpload = async (records, decisions, originalFilename = null) => {
        setConfirmLoading(true);
        try {
            const response = await api.post('/purchase/upload/confirm', {
                records,
                vendor_decisions: decisions,
                original_filename: originalFilename || previewData?.original_filename,
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
    const categoryData = { ...(summary.by_category || {}) };
    // Inject delivery app fee as virtual category for chart display
    if (summary.total_delivery_fee > 0) {
        categoryData['배달앱수수료'] = { amount: summary.total_delivery_fee, count: summary.delivery_fees?.length || 0 };
    }
    const cardData = summary.by_card_company || {};
    const bankData = summary.by_bank_transfer || {};
    const topVendors = summary.top_vendors || [];

    return (
        <div className="purchase-page min-h-screen bg-slate-50 pb-16 overflow-x-hidden">
            {/* ── Header ── */}
            <div className="max-w-6xl mx-auto px-6 pt-8">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <ShoppingBag size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0">매입관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Purchase Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl">
                        <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronLeft size={16} /></button>
                        <span className="text-base font-bold text-slate-700 min-w-[100px] text-center">{year}년 {month}월</span>
                        <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronRight size={16} /></button>
                    </div>
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div className="max-w-6xl mx-auto px-6">
                <div className="grid grid-cols-5 gap-3 mb-5">
                    <div className="bg-gradient-to-br from-slate-50 to-white rounded-2xl p-4 shadow-sm border border-slate-200 card-animate">
                        <div className="text-[11px] text-slate-400 font-semibold">💰 사업용 총 매입</div>
                        <div className="text-lg font-extrabold text-slate-800 mt-1">{formatNumber(businessTotal)}원</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">개인가계부 제외</div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-amber-200 card-animate cursor-pointer hover:shadow-md transition-shadow" style={{ animationDelay: '0.05s' }} onClick={() => setViewMode('household')}>
                        <div className="text-[11px] text-amber-500 font-semibold">👤 개인가계부</div>
                        <div className="text-lg font-extrabold text-amber-600 mt-1">{formatNumber(personalTotal)}원</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">별도 관리됨</div>
                    </div>

                    {EXPENSE_CATEGORIES.slice(0, 2).map((cat, i) => {
                        const catInfo = categoryData[cat.id];
                        return (
                            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate" key={cat.id} style={{ animationDelay: `${(i + 2) * 0.05}s` }}>
                                <div className="text-[11px] text-slate-400 font-semibold">{cat.icon} {cat.label}</div>
                                <div className="text-lg font-extrabold text-slate-700 mt-1">{formatNumber(catInfo?.amount || 0)}원</div>
                                <div className="text-[10px] text-slate-400 mt-0.5">{catInfo?.count || 0}건</div>
                            </div>
                        );
                    })}
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-rose-200 card-animate" style={{ animationDelay: '0.2s' }}>
                        <div className="text-[11px] text-rose-400 font-semibold">🛵 배달앱 수수료</div>
                        <div className="text-lg font-extrabold text-rose-500 mt-1">{formatNumber(summary.total_delivery_fee || 0)}원</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{summary.delivery_fees?.length || 0}개 앱</div>
                    </div>
                </div>
            </div>

            {/* ── Tab Bar ── */}
            <div className="max-w-6xl mx-auto px-6 mb-5">
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    {[
                        { id: 'dashboard', label: '📊 대시보드' },
                        { id: 'list', label: '📋 사업용 내역' },
                        { id: 'household', label: '📒 가계부' },
                        { id: 'upload', label: '📤 업로드' },
                    ].map(v => (
                        <button key={v.id}
                            className={`px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all whitespace-nowrap ${
                                viewMode === v.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'
                            }`}
                            onClick={() => setViewMode(v.id)}
                        >{v.label}</button>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════ */}
            {/* DASHBOARD VIEW */}
            {/* ═══════════════════════════════════════════ */}
            {viewMode === 'dashboard' && (
                <div className="space-y-4">
                    {/* Category Breakdown */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">📂 카테고리별 매입 현황</h3>
                        <div className="space-y-3">
                            {EXPENSE_CATEGORIES.filter(cat => cat.id !== '개인가계부').map(cat => {
                                const catInfo = categoryData[cat.id];
                                const amount = catInfo?.amount || 0;
                                const bizTotal = EXPENSE_CATEGORIES.filter(c => c.id !== '개인가계부').reduce((s, c) => s + (categoryData[c.id]?.amount || 0), 0);
                                const pct = bizTotal > 0 ? (amount / bizTotal * 100) : 0;
                                const ALWAYS_SHOW = ['배달앱수수료', '카드수수료'];
                                if (amount === 0 && !ALWAYS_SHOW.includes(cat.id)) return null;
                                return (
                                    <div key={cat.id}>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-xs font-semibold text-slate-600">{cat.icon} {cat.label}</span>
                                            <span className="text-xs font-bold text-slate-800">{formatNumber(amount)}원 ({pct.toFixed(1)}%)</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cat.color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Card + Bank (left) + Delivery Fee (right) — 2 columns */}
                    <div className="grid grid-cols-[3.5fr_6.5fr] gap-4">
                        {/* LEFT: Card Company + Bank Transfer */}
                        <div className="flex flex-col gap-4">
                            {/* Card Company Breakdown */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">💳 카드사별 매입 현황</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.entries(cardData).filter(([k]) => k !== '기타').sort((a, b) => b[1].amount - a[1].amount).map(([card, info]) => {
                                        const colors = CARD_COLORS[card] || CARD_COLORS['기타'];
                                        return (
                                            <div key={card} className="rounded-xl p-3 border text-center" style={{ background: colors.bg, borderColor: colors.border }}>
                                                <div className="text-xs font-bold mb-1" style={{ color: colors.text }}>{card}</div>
                                                <div className="text-sm font-extrabold text-slate-800">{formatNumber(info.amount)}원</div>
                                                <div className="text-[11px] text-slate-400">{info.count}건</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Bank Transfer Breakdown */}
                            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🏦 계좌이체 현황</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(bankData).length > 0 ? (
                                        Object.entries(bankData).sort((a, b) => b[1].amount - a[1].amount).map(([bank, info]) => {
                                            const colors = CARD_COLORS[bank] || { bg: '#ede9fe', text: '#7c3aed', border: '#c4b5fd' };
                                            return (
                                                <div key={bank} className="rounded-xl p-3 border text-center" style={{ background: colors.bg, borderColor: colors.border }}>
                                                    <div className="text-xs font-bold mb-1" style={{ color: colors.text }}>{bank}</div>
                                                    <div className="text-sm font-extrabold text-slate-800">{formatNumber(info.amount)}원</div>
                                                    <div className="text-[11px] text-slate-400">{info.count}건</div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-2 text-slate-400 py-5 text-center text-sm">계좌이체 내역 없음</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT: Delivery App Fee Breakdown */}
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate min-w-0">
                            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🛵 배달앱 수수료 상세</h3>
                            {summary.delivery_fees && summary.delivery_fees.length > 0 ? (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        {(() => {
                                            const ORDER = ['쿠팡이츠', '배달의민족', '요기요', '땡겨요'];
                                            const sorted = [...summary.delivery_fees].sort((a, b) => {
                                                const ai = ORDER.indexOf(a.label);
                                                const bi = ORDER.indexOf(b.label);
                                                return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
                                            });
                                            return sorted.map(df => {
                                            const CHANNEL_COLORS = { '배달의민족': '#2AC1BC', '쿠팡이츠': '#FF6B2C', '요기요': '#FA0050', '땡겨요': '#4A90D9' };
                                            const color = CHANNEL_COLORS[df.label] || '#6366f1';
                                            return (
                                                <div key={df.channel} style={{
                                                    background: `linear-gradient(135deg, ${color}10, ${color}05)`,
                                                    border: `1px solid ${color}30`,
                                                    borderRadius: 12, padding: '14px 16px',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                        <span style={{ fontSize: 15, fontWeight: 800, color }}>{df.label}</span>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, padding: '3px 10px', borderRadius: 20 }}>
                                                            {df.fee_rate}%
                                                        </span>
                                                    </div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 14px', fontSize: 13 }}>
                                                        <div>
                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>매출</div>
                                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{formatNumber(df.total_sales)}원</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>수수료</div>
                                                            <div style={{ fontWeight: 800, color: '#ef4444' }}>-{formatNumber(df.total_fees)}원</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>정산금</div>
                                                            <div style={{ fontWeight: 700, color: '#059669' }}>{formatNumber(df.settlement)}원</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ color: '#94a3b8', fontSize: 11 }}>주문수</div>
                                                            <div style={{ fontWeight: 700, color: '#1e293b' }}>{df.order_count}건</div>
                                                        </div>
                                                    </div>
                                                    {/* Fee Breakdown Detail */}
                                                    {df.fee_breakdown && Object.keys(df.fee_breakdown).length > 0 && (
                                                        <div style={{ marginTop: 8, borderTop: `1px solid ${color}20`, paddingTop: 8 }}>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>📋 수수료 항목별 상세</div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                                {Object.entries(df.fee_breakdown).map(([key, val]) => {
                                                                    const isCredit = val < 0;
                                                                    const absVal = Math.abs(val);
                                                                    const pct = df.total_sales > 0 ? (absVal / df.total_sales * 100).toFixed(1) : '0.0';
                                                                    return (
                                                                        <div key={key} style={{
                                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                                            fontSize: 12, padding: '3px 0',
                                                                            borderBottom: '1px solid #f1f5f9',
                                                                        }}>
                                                                            <span style={{ color: '#475569', flex: 1 }}>{key}</span>
                                                                            <span style={{
                                                                                fontWeight: 700,
                                                                                color: isCredit ? '#0f172a' : '#ef4444',
                                                                                fontVariantNumeric: 'tabular-nums',
                                                                                minWidth: 100, textAlign: 'right',
                                                                            }}>
                                                                                {isCredit ? '+' : '-'}{formatNumber(absVal)}원
                                                                            </span>
                                                                            <span style={{
                                                                                fontSize: 11, color: '#94a3b8', fontWeight: 600,
                                                                                minWidth: 40, textAlign: 'right', marginLeft: 4,
                                                                            }}>
                                                                                {isCredit ? '' : `${pct}%`}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                            });
                                        })()}
                                    </div>
                                    <div style={{
                                        background: 'linear-gradient(135deg, #1e293b, #0f172a)', borderRadius: 10,
                                        padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    }}>
                                        <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 700 }}>수수료 합계</span>
                                        <span style={{ color: '#ef4444', fontSize: 16, fontWeight: 800 }}>
                                            {formatNumber(summary.total_delivery_fee)}원
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <div className="text-slate-400 py-5 text-center text-sm">배달앱 정산 파일 업로드 후 자동 표시</div>
                            )}
                        </div>
                    </div>

                    {/* Top Vendors */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">🏆 TOP 10 거래처</h3>
                        <div className="space-y-1">
                            {topVendors.map((v, i) => (
                                <div key={v.name} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-slate-50 transition-colors">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0 ${
                                        i < 3 ? 'bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-500'
                                    }`}>{i + 1}</span>
                                    <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{v.name}</span>
                                    <span className="text-[11px] text-slate-400 font-medium">{v.count}건</span>
                                    <span className="text-sm font-bold text-slate-800 tabular-nums">{formatNumber(v.amount)}원</span>
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
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                <Search size={16} className="text-slate-400" />
                                <input
                                    type="text"
                                    className="bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400 w-40"
                                    placeholder="거래처 검색..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {!isHouseholdMode && (
                                <select
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer"
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
                                <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                                    📒 가계부 모드 (개인가계부만 표시)
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">총 {filteredData.length}건</span>
                            <button className="flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold px-4 py-2 rounded-xl border-none cursor-pointer shadow-md shadow-orange-500/20 hover:shadow-lg hover:shadow-orange-500/30 transition-all" onClick={openAddModal}>
                                <Plus size={16} /> {isHouseholdMode ? '생활비 추가' : '매입 추가'}
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                            <p className="text-sm text-slate-400">불러오는 중...</p>
                        </div>
                    ) : filteredData.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 shadow-sm border border-slate-100 text-center card-animate">
                            <div className="text-4xl mb-3">{isHouseholdMode ? '📒' : '📋'}</div>
                            <h3 className="text-base font-bold text-slate-700 mb-1">{isHouseholdMode ? '개인 생활비 내역이 없습니다' : '사업용 매입 내역이 없습니다'}</h3>
                            <p className="text-sm text-slate-400 mb-2">{year}년 {month}월</p>
                            <p className="text-xs text-slate-400">
                                우측 상단 <strong className="text-slate-600">+ 매입 추가</strong> 또는 <strong className="text-slate-600">업로드</strong> 탭에서 데이터를 등록하세요
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {sortedDates.map(dateStr => {
                                const items = groupedByDate[dateStr];
                                const dayTotal = items.reduce((sum, i) => sum + (i.amount || 0), 0);
                                const weekday = getWeekday(dateStr);
                                const dayNum = dateStr.split('-')[2];

                                return (
                                    <div key={dateStr} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden card-animate">
                                        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100/80 border-b border-slate-100">
                                            <button
                                                className="text-slate-400 hover:text-orange-500 transition-colors bg-transparent border-none cursor-pointer p-0"
                                                onClick={() => toggleSelectDay(items)}
                                                title="이 날짜 전체 선택/해제"
                                            >
                                                {items.every(i => selectedIds.has(i.id))
                                                    ? <CheckSquare size={16} className="text-orange-500" />
                                                    : <Square size={16} />}
                                            </button>
                                            <span className="flex items-center gap-1 text-sm font-bold text-slate-700 cursor-pointer select-none" onClick={() => toggleDateCollapse(dateStr)}>
                                                {collapsedDates.has(dateStr) ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                                📅 {month}/{dayNum} ({weekday})
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-medium ml-1">{items.length}건</span>
                                            <span className="text-sm font-extrabold text-slate-800 ml-auto tabular-nums">{formatNumber(dayTotal)}원</span>
                                        </div>
                                        {!collapsedDates.has(dateStr) && (
                                            <div className="divide-y divide-slate-50">
                                                {items.map(item => {
                                                    const cardCompany = getCardCompany(item.note);
                                                    const cardColor = getCardColor(item.note);
                                                    const catInfo = EXPENSE_CATEGORIES.find(c => c.id === item.category) || EXPENSE_CATEGORIES[5];

                                                    return (
                                                        <div key={item.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectedIds.has(item.id) ? 'bg-orange-50/50' : 'hover:bg-slate-50/50'}`}>
                                                            <label className="cursor-pointer shrink-0" onClick={e => e.stopPropagation()}>
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 accent-orange-500"
                                                                    checked={selectedIds.has(item.id)}
                                                                    onChange={() => toggleSelect(item.id)}
                                                                />
                                                            </label>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-sm font-semibold text-slate-700 truncate">{item.vendor_name}</div>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    {cardCompany && (
                                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ background: cardColor.bg, color: cardColor.text, borderColor: cardColor.border }}>
                                                                            {cardCompany}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[11px] font-medium" style={{ color: catInfo.color }}>
                                                                        {catInfo.icon} {catInfo.label}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right shrink-0">
                                                                <div className="text-sm font-bold text-slate-800 tabular-nums">{formatNumber(item.amount)}원</div>
                                                                <div className="flex items-center gap-1 mt-1 justify-end">
                                                                    <button
                                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-500 border-none cursor-pointer flex items-center justify-center transition-colors"
                                                                        onClick={() => toggleCategory(item)}
                                                                        title={isHouseholdMode ? "사업비용으로 변경" : "개인비용으로 변경"}
                                                                    >
                                                                        <ArrowRightLeft size={13} />
                                                                    </button>
                                                                    <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-blue-100 text-slate-400 hover:text-blue-500 border-none cursor-pointer flex items-center justify-center transition-colors" onClick={() => openEditModal(item)} title="수정">
                                                                        <Edit3 size={13} />
                                                                    </button>
                                                                    <button className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-500 border-none cursor-pointer flex items-center justify-center transition-colors" onClick={() => handleDelete(item.id)} title="삭제">
                                                                        <Trash2 size={13} />
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
                        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-700 px-5 py-3 flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-bold text-white">✅ {selectedIds.size}건 선택</span>
                            <div className="flex items-center gap-2 flex-wrap">
                                <select
                                    className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer"
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
                                    <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white border-none cursor-pointer hover:bg-violet-500 transition-colors" onClick={() => handleBatchCategory('개인가계부')}>
                                        👤 개인비용 전환
                                    </button>
                                )}
                                {isHouseholdMode && (
                                    <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white border-none cursor-pointer hover:bg-blue-500 transition-colors" onClick={() => handleBatchCategory('기타비용')}>
                                        💼 사업비용 전환
                                    </button>
                                )}
                                <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white border-none cursor-pointer hover:bg-red-500 transition-colors" onClick={handleBatchDelete}>
                                    🗑️ 삭제
                                </button>
                                <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 border-none cursor-pointer hover:bg-slate-600 transition-colors" onClick={() => setSelectedIds(new Set())}>
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
                <div className="space-y-4">
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit mb-4">
                            <button
                                className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'camera' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                                onClick={() => { setUploadTab('camera'); setOcrResult(null); }}
                            >
                                <Camera size={16} /> 촬영/이미지
                            </button>
                            <button
                                className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'excel' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                                onClick={() => setUploadTab('excel')}
                            >
                                <FileSpreadsheet size={16} /> 문서 업로드
                            </button>
                            <button
                                className={`flex items-center gap-1.5 px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${uploadTab === 'history' ? 'bg-slate-700 text-white shadow-md shadow-slate-700/20' : 'bg-transparent text-slate-500 hover:bg-slate-200'}`}
                                onClick={() => setUploadTab('history')}
                            >
                                <RotateCcw size={16} /> 취소/기록
                            </button>
                        </div>

                        {uploadTab === 'history' ? (
                            <div className="mt-2">
                                <UploadHistoryList type="purchase" onRollback={fetchData} />
                            </div>
                        ) : uploadTab === 'camera' ? (
                            <>
                                {!ocrResult ? (
                                    <div
                                        className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/30 transition-all"
                                        onClick={() => !uploadLoading && imageInputRef.current?.click()}
                                    >
                                        {uploadLoading ? (
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-3 border-slate-200 border-t-orange-500 rounded-full animate-spin" />
                                                <p className="text-sm text-slate-500">🔍 영수증 분석 중...</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-500/20 text-white">
                                                    <Camera size={32} />
                                                </div>
                                                <p className="text-base font-bold text-slate-700 mb-1">
                                                    영수증 촬영 또는 이미지 선택
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    매입 영수증을 촬영하면 자동으로 거래처, 금액, 날짜를 분석합니다
                                                </p>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                                        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600">
                                            <span className="text-xs font-bold text-white">📸 분석 완료</span>
                                            <span className="text-[11px] font-semibold text-emerald-100">정확도 {Math.round((ocrResult.confidence || 0.9) * 100)}%</span>
                                        </div>
                                        <div className="p-4 space-y-3">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-semibold">🏪 거래처</span>
                                                <span className="text-sm font-bold text-slate-800">{ocrResult.vendor_name}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-semibold">💰 금액</span>
                                                <span className="text-sm font-extrabold text-blue-600">{(ocrResult.total_amount || 0).toLocaleString()}원</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-semibold">📅 날짜</span>
                                                <span className="text-sm font-bold text-slate-800">{ocrResult.date}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-slate-400 font-semibold">📂 카테고리</span>
                                                <span className="text-sm font-bold text-slate-800">{ocrResult.category}</span>
                                            </div>
                                            {ocrResult.items && ocrResult.items.length > 0 && (
                                                <div className="pt-2 border-t border-slate-200">
                                                    <span className="text-xs text-slate-400 font-semibold block mb-2">🛒 품목</span>
                                                    <div className="space-y-1">
                                                        {ocrResult.items.map((item, i) => (
                                                            <div key={i} className="flex justify-between text-xs">
                                                                <span className="text-slate-600">{item.name}</span>
                                                                <span className="font-bold text-slate-700 tabular-nums">{item.amount?.toLocaleString()}원</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 px-4 pb-3">
                                            <button className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-600 text-xs font-bold border-none cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => setOcrResult(null)}>🔄 다시 촬영</button>
                                            <button className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs font-bold border-none cursor-pointer shadow-md shadow-emerald-500/20 hover:shadow-lg transition-all" onClick={() => { setOcrResult(null); fetchData(); }}>
                                                ✅ 저장 완료
                                            </button>
                                        </div>
                                        <p className="text-center text-[11px] text-emerald-500 font-medium pb-3">✅ 데이터가 이미 자동 저장되었습니다</p>
                                    </div>
                                )}
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    style={{ display: 'none' }}
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        setUploadLoading(true);
                                        setOcrResult(null);
                                        try {
                                            const formData = new FormData();
                                            formData.append('file', file);
                                            const response = await api.post('/upload/image/purchase', formData, {
                                                headers: { 'Content-Type': 'multipart/form-data' },
                                                timeout: 30000,
                                            });
                                            if (response.data.status === 'success') {
                                                setOcrResult(response.data.data);
                                            } else {
                                                alert('분석 실패: ' + (response.data.message || '알 수 없는 오류'));
                                            }
                                        } catch (err) {
                                            console.error('Image upload error:', err);
                                            alert('업로드 중 오류: ' + (err.response?.data?.detail || err.message));
                                        } finally {
                                            setUploadLoading(false);
                                            if (imageInputRef.current) imageInputRef.current.value = '';
                                        }
                                    }}
                                />
                            </>
                        ) : (
                            <>
                                <div
                                    className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all"
                                    onClick={() => !uploadLoading && fileInputRef.current?.click()}
                                >
                                    {uploadLoading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-3 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
                                            <p className="text-sm text-slate-500">{uploadProgress || '처리 중입니다...'}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20 text-white">
                                                <UploadCloud size={32} />
                                            </div>
                                            <p className="text-base font-bold text-slate-700 mb-1">
                                                클릭하여 문서 파일 선택
                                            </p>
                                            <p className="text-xs text-slate-400 mb-3">
                                                .xls, .xlsx, .pdf, .csv 파일 — 여러 파일 동시 가능
                                            </p>
                                            <div className="flex flex-wrap gap-1.5 justify-center">
                                                {Object.entries(CARD_COLORS).filter(([k]) => k !== '기타').map(([card, colors]) => (
                                                    <span key={card} className="text-[10px] font-bold px-2 py-1 rounded-md border" style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
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
                                    accept=".xls,.xlsx,.pdf,.csv"
                                    multiple
                                    onChange={handleUpload}
                                    style={{ display: 'none' }}
                                />

                                {/* Upload Results */}
                                {uploadResult && (
                                    <div className="mt-4 space-y-2">
                                        {uploadResult.map((r, i) => (
                                            <div key={i} className={`rounded-xl p-3 border ${r.status === 'success' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                                <div className="text-xs font-bold text-slate-700 mb-1">{r.file}</div>
                                                {r.status === 'success' ? (
                                                    <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
                                                        <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{r.card_company}</span>
                                                        <span className="text-emerald-600">✅ {r.count}건 저장</span>
                                                        {r.skipped > 0 && <span className="text-amber-600">⏭️ {r.skipped}건 중복</span>}
                                                        {r.vendors_created > 0 && <span className="text-violet-600">🏪 {r.vendors_created}개 거래처 생성</span>}
                                                        {r.auto_classified > 0 && <span className="text-sky-600">🤖 {r.auto_classified}건 자동분류</span>}
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-red-600 font-medium">❌ {r.message}</div>
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{modalMode === 'add' ? '매입 추가' : '매입 수정'}</h3>
                            <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors" onClick={() => setShowModal(false)}><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">거래처명</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={form.vendor_name}
                                    onChange={e => setForm({ ...form, vendor_name: e.target.value })}
                                    placeholder="예: 다인푸드, (주)가락봉투"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">날짜</label>
                                <input
                                    type="date"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">금액</label>
                                <input
                                    type="number"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-2">
                                    카테고리
                                    <button
                                        type="button"
                                        className="text-[11px] text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors font-semibold"
                                        onClick={() => setShowCategoryHelper(true)}
                                        title="카테고리 선택 도우미"
                                    >
                                        ❓ 선택도우미
                                    </button>
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {EXPENSE_CATEGORIES.map(c => (
                                        <button
                                            key={c.id}
                                            type="button"
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-all ${
                                                form.category === c.id
                                                    ? 'text-white border-transparent shadow-sm'
                                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                            }`}
                                            onClick={() => setForm({ ...form, category: c.id })}
                                            style={form.category === c.id ? { background: c.color, borderColor: c.color } : {}}
                                        >
                                            {c.icon} {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1.5">비고</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                    value={form.note}
                                    onChange={e => setForm({ ...form, note: e.target.value })}
                                    placeholder="메모 (선택)"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/50">
                            <button className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold border-none cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => setShowModal(false)}>취소</button>
                            <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-orange-500/20 hover:shadow-lg transition-all" onClick={handleSubmit}>
                                {modalMode === 'add' ? '추가' : '저장'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* 카테고리 선택 도우미 모달 */}
            {showCategoryHelper && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowCategoryHelper(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <h3 className="text-base font-bold text-slate-800">❓ 카테고리 선택 도우미</h3>
                            <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors" onClick={() => setShowCategoryHelper(false)}>×</button>
                        </div>
                        <div className="p-4">
                            <p className="text-xs text-slate-400 mb-3">
                                한국 개인사업자 회계기준에 맞춤 카테고리입니다. 카테고리를 클릭하면 선택됩니다.
                            </p>
                            <div className="space-y-2">
                            {EXPENSE_CATEGORIES.map(cat => {
                                const help = CATEGORY_HELP_DATA[cat.id];
                                if (!help) return null;
                                return (
                                    <div
                                        key={cat.id}
                                        className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.01] border"
                                        onClick={() => { setForm(f => ({ ...f, category: cat.id })); setShowCategoryHelper(false); }}
                                        style={{
                                            background: form.category === cat.id ? `${cat.color}10` : '#f8fafc',
                                            borderColor: form.category === cat.id ? cat.color : '#e2e8f0',
                                        }}
                                    >
                                        <div className="text-sm font-semibold text-slate-700 mb-1">
                                            {cat.icon} {cat.label}
                                            <span className="text-xs font-normal text-slate-400 ml-2">{help.desc}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {help.items.map((item, i) => (
                                                <span key={i} className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
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
                </div>
            )}

            {/* ═══════════════════════════════════════════ */}
            {/* VENDOR REVIEW MODAL (2-step upload) */}
            {/* ═══════════════════════════════════════════ */}
            {showVendorReview && previewData && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <h3 className="text-base font-bold text-slate-800">🔍 거래처 확인 ({previewData.card_company})</h3>
                            <button className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center border-none cursor-pointer text-slate-400 transition-colors" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5">
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
                                                            {vr.similar_vendors.map(sv => {
                                                                const dismissKey = `${vr.vendor_name}::${sv.id}`;
                                                                const isDismissed = dismissedSimilars.has(dismissKey);
                                                                const isMerged = dec.action === 'merge' && dec.vendor_id === sv.id;

                                                                if (isDismissed) {
                                                                    return (
                                                                        <div key={sv.id} style={{
                                                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                            padding: '6px 12px', borderRadius: 8,
                                                                            background: '#0f172a', border: '1px solid #1e293b',
                                                                            opacity: 0.4,
                                                                        }}>
                                                                            <span style={{ textDecoration: 'line-through', color: '#64748b', fontSize: 13 }}>
                                                                                🏪 {sv.name} <span style={{ fontSize: 11 }}>({sv.category})</span>
                                                                            </span>
                                                                            <button
                                                                                onClick={() => setDismissedSimilars(prev => { const n = new Set(prev); n.delete(dismissKey); return n; })}
                                                                                style={{ fontSize: 10, background: '#334155', color: '#94a3b8', padding: '3px 8px', borderRadius: 5, border: '1px solid #475569', cursor: 'pointer', fontWeight: 600 }}
                                                                            >↩ 복원</button>
                                                                        </div>
                                                                    );
                                                                }

                                                                return (
                                                                    <div key={sv.id} style={{
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        padding: '8px 12px', borderRadius: 8,
                                                                        background: isMerged ? '#1e3a5f' : '#0f172a',
                                                                        border: `1px solid ${isMerged ? '#3b82f6' : '#1e293b'}`,
                                                                        transition: 'all 0.15s',
                                                                    }}>
                                                                        <span style={{ color: '#e2e8f0', fontSize: 13 }}>
                                                                            🏪 <strong>{sv.name}</strong>
                                                                            <span style={{ color: '#64748b', marginLeft: 6, fontSize: 12 }}>({sv.category})</span>
                                                                        </span>
                                                                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                                            <button
                                                                                onClick={() => handleVendorDecision(vr.vendor_name, 'merge', sv.id)}
                                                                                style={{
                                                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '4px 10px',
                                                                                    background: isMerged ? '#2563eb' : '#1e293b',
                                                                                    color: isMerged ? '#fff' : '#3b82f6',
                                                                                    border: `1px solid ${isMerged ? '#3b82f6' : '#334155'}`,
                                                                                    transition: 'all 0.15s',
                                                                                }}
                                                                            >{isMerged ? '✓ 병합' : '→ 병합'}</button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    // If this was the merge target, clear the decision
                                                                                    if (isMerged) {
                                                                                        setVendorDecisions(prev => { const n = { ...prev }; delete n[vr.vendor_name]; return n; });
                                                                                    }
                                                                                    setDismissedSimilars(prev => { const n = new Set(prev); n.add(dismissKey); return n; });
                                                                                }}
                                                                                style={{
                                                                                    fontSize: 11, fontWeight: 700, cursor: 'pointer', borderRadius: 6, padding: '4px 8px',
                                                                                    background: '#1e293b', color: '#ef4444', border: '1px solid #334155',
                                                                                    transition: 'all 0.15s',
                                                                                }}
                                                                                title="이 거래처 제외 (관련없음)"
                                                                            >✕</button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
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
                        <div className="flex justify-between items-center px-5 py-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0">
                            <button className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-600 text-sm font-bold border-none cursor-pointer hover:bg-slate-300 transition-colors" onClick={() => { setShowVendorReview(false); setPreviewData(null); }}>취소</button>
                            <button
                                className="btn-save"
                                disabled={!canConfirmUpload() || confirmLoading}
                                onClick={() => {
                                    const filtered = previewData.records.filter(r => !excludedVendors.has(r.vendor_name));
                                    confirmUpload(filtered, vendorDecisions, previewData?.original_filename);
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
