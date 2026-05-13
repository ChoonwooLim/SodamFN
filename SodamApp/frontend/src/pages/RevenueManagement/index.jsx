import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react';
import api from '../../api';
import { useIsMobile } from '../../hooks/useMediaQuery';
import './RevenueManagement.css';

import { formatNumber } from '../../utils/format';

import { MobileDashboard, DesktopDashboard } from './DashboardView';
import { ListView } from './ListView';
import { GridView } from './GridView';
import { RevenueDetailView } from './RevenueDetailView';
import { DeliveryAppView } from './DeliveryAppView';
import { UploadView } from './UploadView';
import { AddEditModal, ClassificationModal } from './RevenueModals';
import { useUploadHandler } from './useUploadHandler';

export default function RevenueManagement() {
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

    // ── 자동수집 백업 토글 (마이그레이션 B 정책) ──
    // manual_overwritten 행 표시 여부. 기본 OFF — 일반 사용자에겐 깔끔한 화면 유지
    const [showBackup, setShowBackup] = useState(false);

    // ── 수입상세 (Annual PL Revenue) ──
    const [plYear, setPlYear] = useState(now.getFullYear());
    const [plData, setPlData] = useState([]);

    // ── 배달앱 (Delivery App) ──
    const [deliveryAppData, setDeliveryAppData] = useState({});
    const [deliveryRatios, setDeliveryRatios] = useState({});

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
            const dsData = deliverySummaryRes.data || {};
            const ratios = {};
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

    // ─── PL Annual Data Fetch ───
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

    // ─── Upload ───
    const {
        uploadTab, setUploadTab,
        uploadLoading, setUploadLoading,
        uploadProgress, setUploadProgress,
        classifyData, setClassifyData,
        fileInputRef, excelInputRef,
        handleUploadFileChange,
    } = useUploadHandler({ fetchData });

    // ─── Month Navigation ───
    const prevMonth = () => {
        if (month === 1) { setYear(y => y - 1); setMonth(12); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 12) { setYear(y => y + 1); setMonth(1); }
        else setMonth(m => m + 1);
    };

    // ─── Filter by Tab + 백업 토글 ───
    // 백업 토글 OFF (기본) → manual_overwritten 행 숨김. 자동수집된 새 행만 표시.
    // 백업 토글 ON → 모든 행 표시 + 백업 행에 [복구] 버튼 노출.
    const tabFiltered = tab === 'all' ? data : data.filter(d => d.ui_category === tab);
    const filteredData = tabFiltered.filter(d => d.source !== 'manual_overwritten' || showBackup);

    // ─── 백업 행 복구 핸들러 ───
    const handleRestore = async (id) => {
        if (!window.confirm('이 백업 행을 수동 데이터로 복구하시겠습니까?\n(자동수집 행과 중복될 수 있으니 확인 후 진행)')) return;
        try {
            await api.post(`/auto-collection/dailyexpense/${id}/restore`);
            fetchData();
        } catch (err) {
            console.error('Restore error:', err);
            alert('복구 실패: ' + (err.response?.data?.detail || err.message));
        }
    };

    // ─── Group by Date ───
    const groupedByDate = {};
    filteredData.forEach(item => {
        if (!groupedByDate[item.date]) groupedByDate[item.date] = [];
        groupedByDate[item.date].push(item);
    });
    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    // ─── Vendor display name helpers ───
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

    // ─── Grouped vendor options for modal select ───
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

    // ─── Grid cell save handler ───
    const handleGridSave = async () => {
        if (!editingCell) return;
        const { vendorId, day, id } = editingCell;
        const amount = parseInt(editValue) || 0;
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isDeliveryApp = typeof id === 'string' && id.startsWith('rev_');

        try {
            if (isDeliveryApp) {
                const realId = id.replace('rev_', '');
                if (amount > 0) {
                    await api.put(`/profitloss/delivery/${realId}`, {
                        amount, date: dateStr, channel: 'Coupang', description: null
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

    return (
        <div className="revenue-page min-h-screen bg-slate-50 pb-16 overflow-x-hidden">
            {/* ── Header ── */}
            <div className="max-w-6xl mx-auto px-6 pt-8">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <TrendingUp size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0">매출관리</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Revenue Management</p>
                        </div>
                    </div>
                    {(viewMode === 'revenueDetail' || viewMode === 'deliveryApp') ? (
                        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl">
                            <button onClick={() => setPlYear(y => y - 1)} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronLeft size={16} /></button>
                            <span className="text-base font-bold text-slate-700 min-w-[80px] text-center">{plYear}년</span>
                            <button onClick={() => setPlYear(y => y + 1)} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl">
                            <button onClick={prevMonth} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronLeft size={16} /></button>
                            <span className="text-base font-bold text-slate-700 min-w-[100px] text-center">{year}년 {month}월</span>
                            <button onClick={nextMonth} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer flex items-center justify-center transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Summary Cards (desktop only) ── */}
            {!isMobile && (
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        {[
                            { label: '💵 현금매출', value: formatNumber(summary.by_category?.cash || 0) + '원', gradient: 'from-emerald-500 to-emerald-600', shadow: 'shadow-emerald-500/30' },
                            { label: '💳 카드매출', value: formatNumber(summary.by_category?.card || 0) + '원', gradient: 'from-blue-500 to-blue-600', shadow: 'shadow-blue-500/30' },
                            { label: '🛵 배달앱매출', value: formatNumber(summary.by_category?.delivery || 0) + '원', gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-500/30' },
                            { label: '💰 총 매출', value: formatNumber(summary.total || 0) + '원', gradient: 'from-teal-700 to-teal-900', shadow: 'shadow-teal-700/30', highlight: true },
                        ].map((card, i) => (
                            <div key={i} className={`bg-white rounded-2xl p-4 shadow-sm border card-animate hover:shadow-md transition-shadow ${card.highlight ? 'border-slate-300 bg-gradient-to-br from-slate-50 to-white' : 'border-slate-100'}`} style={{ animationDelay: `${i * 0.05}s` }}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-md ${card.shadow} shrink-0`}>
                                        <span className="text-white text-xs">{card.label.split(' ')[0]}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-[11px] text-slate-400 font-semibold">{card.label.split(' ').slice(1).join(' ')}</div>
                                        <div className={`text-base font-extrabold truncate ${card.highlight ? 'text-slate-800' : 'text-slate-700'}`}>{card.value}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Tab & View Mode Selectors ── */}
            <div className="max-w-6xl mx-auto px-6 flex items-center justify-between gap-3 mb-5 flex-wrap">
                {(viewMode === 'list' || viewMode === 'grid') && (
                    <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                        {[
                            { id: 'all', label: '📊 전체' },
                            { id: 'cash', label: '💵 현금' },
                            { id: 'card', label: '💳 카드' },
                            { id: 'delivery', label: '🛵 배달앱' },
                        ].map(t => (
                            <button
                                key={t.id}
                                className={`px-3 py-1.5 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all ${
                                    tab === t.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'bg-transparent text-slate-500 hover:bg-white/60'
                                }`}
                                onClick={() => setTab(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
                {!(viewMode === 'list' || viewMode === 'grid') && <div className="flex-1" />}
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
                    {isMobile ? (
                        <>
                            {[
                                { id: 'dashboard', label: '📊 대시보드' },
                                { id: 'upload', label: '📤 업로드' },
                            ].map(v => (
                                <button key={v.id}
                                    className={`px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all whitespace-nowrap ${
                                        viewMode === v.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'bg-transparent text-slate-500 hover:bg-white/60'
                                    }`}
                                    onClick={() => setViewMode(v.id)}
                                >{v.label}</button>
                            ))}
                        </>
                    ) : (
                        <>
                            {[
                                { id: 'dashboard', label: '📊 대시보드' },
                                { id: 'list', label: '📋 리스트' },
                                { id: 'grid', label: '📅 월별 상세 내역' },
                                { id: 'revenueDetail', label: '💰 매출요약' },
                                { id: 'deliveryApp', label: '🛵 배달앱' },
                                { id: 'upload', label: '📤 업로드' },
                            ].map(v => (
                                <button key={v.id}
                                    className={`px-4 py-2 border-none text-xs font-semibold cursor-pointer rounded-lg transition-all whitespace-nowrap ${
                                        viewMode === v.id ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' : 'bg-transparent text-slate-500 hover:bg-white/60'
                                    }`}
                                    onClick={() => setViewMode(v.id)}
                                >{v.label}</button>
                            ))}
                        </>
                    )}
                </div>
            </div>

            {/* ── View Rendering ── */}
            {isMobile && viewMode === 'dashboard' && <MobileDashboard summary={summary} />}
            {!isMobile && viewMode === 'dashboard' && <DesktopDashboard summary={summary} />}

            {viewMode === 'list' && (
                <ListView
                    year={year} month={month} loading={loading}
                    filteredData={filteredData} sortedDates={sortedDates} groupedByDate={groupedByDate}
                    openAddModal={openAddModal} openEditModal={openEditModal} handleDelete={handleDelete}
                    getDisplayName={getDisplayName} getStoreName={getStoreName}
                    showBackup={showBackup} setShowBackup={setShowBackup} handleRestore={handleRestore}
                />
            )}

            {viewMode === 'grid' && (
                <GridView
                    year={year} month={month} loading={loading} isMobile={isMobile}
                    data={data} vendors={vendors} tab={tab} deliveryRatios={deliveryRatios}
                    fetchData={fetchData} getDisplayName={getDisplayName}
                    editingCell={editingCell} setEditingCell={setEditingCell}
                    editValue={editValue} setEditValue={setEditValue}
                    handleGridSave={handleGridSave}
                />
            )}

            {viewMode === 'revenueDetail' && (
                <RevenueDetailView
                    isMobile={isMobile} plYear={plYear} plData={plData} fetchPLData={fetchPLData}
                    editingCell={editingCell} setEditingCell={setEditingCell}
                    editValue={editValue} setEditValue={setEditValue}
                />
            )}

            {viewMode === 'deliveryApp' && (
                <DeliveryAppView
                    isMobile={isMobile} plYear={plYear} deliveryAppData={deliveryAppData}
                />
            )}

            {viewMode === 'upload' && (
                <UploadView
                    isMobile={isMobile} uploadTab={uploadTab} setUploadTab={setUploadTab}
                    uploadLoading={uploadLoading} uploadProgress={uploadProgress}
                    fileInputRef={fileInputRef} excelInputRef={excelInputRef}
                    handleUploadFileChange={handleUploadFileChange} fetchData={fetchData}
                />
            )}

            {/* ── Modals ── */}
            <AddEditModal
                showModal={showModal} setShowModal={setShowModal}
                modalMode={modalMode} form={form} setForm={setForm}
                vendors={vendors} storeGroups={storeGroups}
                deliveryGroups={deliveryGroups} otherVendors={otherVendors}
                getDisplayName={getDisplayName} handleSubmit={handleSubmit}
            />

            <ClassificationModal
                classifyData={classifyData} setClassifyData={setClassifyData}
                uploadLoading={uploadLoading} setUploadLoading={setUploadLoading}
                setUploadProgress={setUploadProgress}
                excelInputRef={excelInputRef} fetchData={fetchData}
            />
        </div>
    );
}
