import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ShoppingBag, X } from 'lucide-react';
import api from '../../api';
import { formatNumber } from '../../utils/format';
import { EXPENSE_CATEGORIES } from '../../utils/constants';
import { PurchaseSummary } from './PurchaseSummary';
import { PurchaseTable } from './PurchaseTable';
import { UploadPanel } from './UploadPanel';
import './PurchaseManagement.css';

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
    '카드대금': {
        desc: '카드사 대금 결제 (실제 매입은 카드 사용 시점에 잡힘)',
        items: ['신용카드 대금 결제', '체크카드 정산'],
    },
    '개인가계부': {
        desc: '사업외 개인적 지출 (손익계산서 미포함)',
        items: ['생활비 · 카드값', '전자제품 · 마트 장보기', '자녀 교육비 · 의료비'],
    },
};

export default function PurchaseManagement() {
    const now = new Date();
    const defaultDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [year, setYear] = useState(defaultDate.getFullYear());
    const [month, setMonth] = useState(defaultDate.getMonth() + 1);
    const [viewMode, setViewMode] = useState('dashboard'); // dashboard | list | household | upload
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

    // Batch selection
    const [selectedIds, setSelectedIds] = useState(new Set());

    // Collapse State
    const [collapsedDates, setCollapsedDates] = useState(new Set());

    const toggleDateCollapse = (dateStr) => {
        setCollapsedDates(prev => {
            const next = new Set(prev);
            if (next.has(dateStr)) next.delete(dateStr);
            else next.add(dateStr);
            return next;
        });
    };

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
    const isHouseholdMode = viewMode === 'household';

    const filteredData = data.filter(d => {
        const isPersonal = d.category === '개인가계부';
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

    // ─── Summary values ───
    const totalAmount = summary.total || 0;
    const totalCount = summary.count || 0;
    const categoryData = { ...(summary.by_category || {}) };
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
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <ShoppingBag size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0">비용관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Expense Management</p>
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
                <div className="grid grid-cols-5 gap-3 mb-6">
                    <div className="rounded-2xl p-4 shadow-sm card-animate" style={{ background: 'linear-gradient(135deg, #134e4a 0%, #1e3a3a 100%)' }}>
                        <div className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.8)' }}>💰 사업용 총 비용</div>
                        <div className="text-lg font-extrabold mt-1 text-white">{formatNumber(businessTotal)}원</div>
                        <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>개인가계부 제외</div>
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
                                viewMode === v.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'bg-transparent text-slate-500 hover:bg-white/60'
                            }`}
                            onClick={() => setViewMode(v.id)}
                        >{v.label}</button>
                    ))}
                </div>
            </div>

            {/* ═══ DASHBOARD VIEW ═══ */}
            {viewMode === 'dashboard' && (
                <div className="max-w-6xl mx-auto px-6">
                    <PurchaseSummary
                        categoryData={categoryData}
                        cardData={cardData}
                        bankData={bankData}
                        topVendors={topVendors}
                        summary={summary}
                    />
                </div>
            )}

            {/* ═══ LIST / HOUSEHOLD VIEW ═══ */}
            {(viewMode === 'list' || viewMode === 'household') && (
                <div className="max-w-6xl mx-auto px-6">
                    <PurchaseTable
                        viewMode={viewMode}
                        year={year}
                        month={month}
                        loading={loading}
                        filteredData={filteredData}
                        sortedDates={sortedDates}
                        groupedByDate={groupedByDate}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        filterCategory={filterCategory}
                        setFilterCategory={setFilterCategory}
                        selectedIds={selectedIds}
                        toggleSelect={toggleSelect}
                        toggleSelectDay={toggleSelectDay}
                        collapsedDates={collapsedDates}
                        toggleDateCollapse={toggleDateCollapse}
                        openAddModal={openAddModal}
                        openEditModal={openEditModal}
                        handleDelete={handleDelete}
                        toggleCategory={toggleCategory}
                        handleBatchCategory={handleBatchCategory}
                        handleBatchDelete={handleBatchDelete}
                        setSelectedIds={setSelectedIds}
                    />
                </div>
            )}

            {/* ═══ UPLOAD VIEW ═══ */}
            {viewMode === 'upload' && (
                <div className="max-w-6xl mx-auto px-6">
                    <UploadPanel fetchData={fetchData} />
                </div>
            )}

            {/* ═══ ADD/EDIT MODAL ═══ */}
            {showModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                            <h3 className="text-base font-bold text-slate-800">{modalMode === 'add' ? '비용 추가' : '비용 수정'}</h3>
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
                            <button className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-white text-sm font-bold border-none cursor-pointer shadow-md shadow-amber-500/30 hover:shadow-lg transition-all" onClick={handleSubmit}>
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
        </div>
    );
}
