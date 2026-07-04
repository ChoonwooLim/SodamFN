import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import api from '../../api';
import { useIsMobile } from '../../hooks/useMediaQuery';
import './ProfitLoss.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; // Keep for now if needed, but api client handles base URL

const REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출', group: 'revenue-store' },
    { key: 'revenue_coupang', label: '쿠팡 매출', group: 'revenue-delivery' },
    { key: 'revenue_baemin', label: '배민 매출', group: 'revenue-delivery' },
    { key: 'revenue_yogiyo', label: '요기요 매출', group: 'revenue-delivery' },
    { key: 'revenue_ddangyo', label: '땡겨요 매출', group: 'revenue-delivery' },
];

const EXPENSE_FIELDS = [
    { key: 'expense_labor', label: '인건비', auto: true, group: 'expense-labor' },
    { key: 'expense_retirement', label: '퇴직금적립', auto: true, group: 'expense-labor' },
    { key: 'expense_insurance', label: '4대보험료(사업주)', auto: true, group: 'expense-labor' },
    { key: 'expense_insurance_employee', label: '4대보험료(직원)', auto: true, group: 'expense-labor' },
    { key: 'expense_tax_employee', label: '원천세(직원)', auto: true, group: 'expense-labor' },
    { key: 'expense_ingredient', label: '원재료비', group: 'expense-material' },
    { key: 'expense_material', label: '소모품비', group: 'expense-material' },
    { key: 'expense_utility', label: '수도광열비', group: 'expense-utility' },
    { key: 'expense_rent', label: '임차료', group: 'expense-rent' },
    { key: 'expense_repair', label: '수선비', group: 'expense-facility' },
    { key: 'expense_depreciation', label: '감가상각비', group: 'expense-facility' },
    { key: 'expense_card_fee', label: '카드수수료', auto: true, group: 'expense-etc' },
    { key: 'expense_delivery_fee', label: '배달앱수수료', auto: true, group: 'expense-etc' },
    { key: 'expense_other', label: '기타경비', group: 'expense-etc' },
];

// 정식 손익계산서 양식 (2026-07-04): 세금 납부(부가세·소득세·재산세 등)는
// 영업비용이 아니라 영업이익 아래 별도 표시 — 순이익 = 영업이익 − 세금
const TAX_FIELDS = [
    { key: 'expense_tax', label: '세금과공과', group: 'expense-tax' },
];

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

import { EXPENSE_CATEGORIES } from '../../utils/constants';

// Main tabs (always visible) — 수입상세/배달앱은 매출관리로 이동
const MAIN_TABS = [
    { id: 'dashboard', label: '🏠 대시보드' },
    { id: 'summary', label: '📊 손익계산서' },
    { id: 'statements', label: '📑 재무제표' },
    { id: 'expenses', label: '💰 세부지출' },
];

// Monthly expense group (1-12)
const MONTH_TABS = Array.from({ length: 12 }, (_, i) => ({
    id: `month_${i + 1}`,
    label: `${i + 1}월`
}));

import { formatNumber } from '../../utils/format';

export default function ProfitLoss() {
    const isMobile = useIsMobile();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('dashboard');
    // 현재 매장(View-As 포함)명 — API에서 가져옴 (localStorage 폴백)
    const [businessName, setBusinessName] = useState(localStorage.getItem('business_name') || '');
    useEffect(() => {
        api.get('/auth/business-info')
            .then(res => { if (res.data?.business_name) setBusinessName(res.data.business_name); })
            .catch(() => {});
    }, []);

    // Mobile collapse states
    const [revOpen, setRevOpen] = useState(false);
    const [expOpen, setExpOpen] = useState(false);
    const [openMonths, setOpenMonths] = useState({});
    const toggleMonth = (m) => setOpenMonths(prev => ({ ...prev, [m]: !prev[m] }));

    // Dropdown group state
    const [openDropdown, setOpenDropdown] = useState(null); // 'monthly'

    // 정식 재무제표 (손익·현금흐름·재무상태표)
    const [statements, setStatements] = useState(null);
    useEffect(() => {
        if (activeTab !== 'statements') return;
        api.get(`/api/profitloss/statements?year=${year}`)
            .then(res => setStatements(res.data))
            .catch(() => setStatements(null));
    }, [activeTab, year]);

    // Monthly expense data
    const [monthlyExpenses, setMonthlyExpenses] = useState({});

    // Global vendor list (from API + localStorage order) - now stores full vendor objects
    const [globalVendors, setGlobalVendors] = useState([]);
    // Vendor category map (vendorName -> category) from Vendor API
    const [vendorCategoryFromAPI, setVendorCategoryFromAPI] = useState({});

    // Hide empty vendors toggle (for monthly expense view)
    const [hideEmptyVendors, setHideEmptyVendors] = useState(false);

    // Fetch global vendor list from API and merge with localStorage order
    const fetchGlobalVendors = async () => {
        try {
            const res = await api.get(`/vendors`);
            if (res.data.status === 'success') {
                const apiVendors = res.data.data;

                // Build category map from Vendor API (source of truth)
                const categoryMap = {};
                apiVendors.forEach(v => {
                    if (v.name && v.category) {
                        categoryMap[v.name] = v.category;
                    }
                });
                setVendorCategoryFromAPI(categoryMap);

                // Sort by order_index then by name
                apiVendors.sort((a, b) => (a.order_index || 999) - (b.order_index || 999));

                // Extract vendor names in order
                const orderedVendors = apiVendors
                    .filter(v => v.vendor_type === 'expense')
                    .map(v => v.name);
                setGlobalVendors(orderedVendors);
            }
        } catch (err) {
            console.error('Error fetching global vendors:', err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchGlobalVendors();
    }, [year]);

    useEffect(() => {
        // Fetch monthly expense data
        if (activeTab.startsWith('month_')) {
            const month = parseInt(activeTab.split('_')[1]);
            fetchMonthlyExpenses(month);
        }
    }, [activeTab, year]);

    const fetchData = async () => {
        try {
            const res = await api.get(`/profitloss/monthly?year=${year}`);
            setData(res.data);
        } catch (err) {
            console.error('Error fetching P/L data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthlyExpenses = async (month) => {
        try {
            const res = await api.get(`/profitloss/expenses/${year}/${month}`);
            setMonthlyExpenses(prev => ({ ...prev, [month]: res.data }));
        } catch (err) {
            console.error('Error fetching monthly expenses:', err);
        }
    };

    const getMonthData = (month) => {
        return data.find(d => d.month === month) || {};
    };

    const handleCellClick = (month, field, currentValue) => {
        setEditingCell({ month, field });
        setEditValue(currentValue?.toString() || '0');
    };

    const handleSave = async () => {
        if (!editingCell) return;

        const { month, field } = editingCell;
        const monthData = getMonthData(month);

        try {
            if (monthData.id) {
                // Update existing
                await api.put(`/profitloss/monthly/${monthData.id}`, {
                    [field]: parseInt(editValue) || 0
                });
            } else {
                // Create new
                await api.post(`/profitloss/monthly`, {
                    year,
                    month,
                    [field]: parseInt(editValue) || 0
                });
            }
            fetchData();
        } catch (err) {
            console.error('Error saving:', err);
            alert('저장 실패');
        }
        setEditingCell(null);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') setEditingCell(null);
    };

    const calcTotalRevenue = (monthData) => {
        return REVENUE_FIELDS.reduce((sum, f) => sum + (monthData[f.key] || 0), 0);
    };

    // 영업비용 (세금 제외)
    const calcOperatingExpense = (monthData) => {
        return EXPENSE_FIELDS.reduce((sum, f) => sum + (monthData[f.key] || 0), 0);
    };

    const calcTax = (monthData) => {
        return TAX_FIELDS.reduce((sum, f) => sum + (monthData[f.key] || 0), 0);
    };

    // 총 지출 = 영업비용 + 세금 (기존 의미 유지 — 대시보드/모바일 지출 합계)
    const calcTotalExpense = (monthData) => {
        return calcOperatingExpense(monthData) + calcTax(monthData);
    };

    // 영업이익 = 수입 − 영업비용
    const calcOperatingProfit = (monthData) => {
        return calcTotalRevenue(monthData) - calcOperatingExpense(monthData);
    };

    // 순이익 = 영업이익 − 세금
    const calcProfit = (monthData) => {
        return calcTotalRevenue(monthData) - calcTotalExpense(monthData);
    };

    const calcYearTotal = (field) => {
        return data.reduce((sum, d) => sum + (d[field] || 0), 0);
    };

    // Count months that have any data (revenue or expense > 0)
    const activeMonthCount = useMemo(() => {
        const count = MONTHS.filter(m => {
            const md = data.find(d => d.month === m) || {};
            const hasRevenue = REVENUE_FIELDS.some(f => (md[f.key] || 0) !== 0);
            const hasExpense = [...EXPENSE_FIELDS, ...TAX_FIELDS].some(f => (md[f.key] || 0) !== 0);
            return hasRevenue || hasExpense;
        }).length;
        return count || 1; // avoid division by zero
    }, [data]);

    const calcYearAverage = (field) => {
        const total = calcYearTotal(field);
        return Math.round(total / activeMonthCount);
    };

    const renderCell = (month, field, value) => {
        const isEditing = editingCell?.month === month && editingCell?.field === field;

        if (isEditing) {
            return (
                <input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    className="edit-input"
                />
            );
        }

        return (
            <span
                className="cell-value editable"
                onClick={() => handleCellClick(month, field, value)}
            >
                {formatNumber(value)}
            </span>
        );
    };

    if (loading) return (
        <div className="flex items-center justify-center h-[300px]">
            <div className="text-center">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
                <span className="text-sm text-slate-400 font-medium">데이터를 불러오는 중...</span>
            </div>
        </div>
    );

    // ═══════════════════════════════════════════
    // DASHBOARD VIEW
    // ═══════════════════════════════════════════
    const renderDashboard = () => {
        // Current month and previous month data
        const currentMonth = new Date().getMonth(); // 0-indexed (0=Jan)
        const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
        const curData = data.find(d => d.month === (currentMonth + 1)) || {};
        const prevData = data.find(d => d.month === (prevMonthIdx + 1)) || {};

        // Calculate monthly summaries
        const monthSummaries = MONTHS.map(m => {
            const md = data.find(d => d.month === m) || {};
            const revenue = calcTotalRevenue(md);
            const expense = calcTotalExpense(md);
            const profit = revenue - expense;
            return { month: m, revenue, expense, profit };
        });

        // Year totals
        const yearRevenue = monthSummaries.reduce((s, m) => s + m.revenue, 0);
        const yearExpense = monthSummaries.reduce((s, m) => s + m.expense, 0);
        const yearProfit = yearRevenue - yearExpense;
        const yearMargin = yearRevenue > 0 ? ((yearProfit / yearRevenue) * 100).toFixed(1) : '0.0';

        // Previous month summary
        const prevRevenue = calcTotalRevenue(prevData);
        const prevExpense = calcTotalExpense(prevData);
        const prevProfit = prevRevenue - prevExpense;
        const prevMargin = prevRevenue > 0 ? ((prevProfit / prevRevenue) * 100).toFixed(1) : '0.0';

        // Expense breakdown by category (세금 포함)
        const expenseBreakdown = [...EXPENSE_FIELDS, ...TAX_FIELDS].map(f => {
            const total = data.reduce((sum, d) => sum + (d[f.key] || 0), 0);
            return { key: f.key, label: f.label, total };
        }).filter(e => e.total > 0).sort((a, b) => b.total - a.total);
        const maxExpense = expenseBreakdown.length > 0 ? expenseBreakdown[0].total : 1;

        // Monthly trend — max for chart scale
        const maxMonthValue = Math.max(...monthSummaries.map(m => Math.max(m.revenue, m.expense)), 1);

        // Months with data
        const activeMonths = monthSummaries.filter(m => m.revenue > 0 || m.expense > 0);

        const EXPENSE_COLORS = {
            'expense_labor': '#ef4444',
            'expense_retirement': '#f97316',
            'expense_ingredient': '#22c55e',
            'expense_material': '#10b981',
            'expense_utility': '#3b82f6',
            'expense_rent': '#8b5cf6',
            'expense_repair': '#ec4899',
            'expense_depreciation': '#6366f1',
            'expense_tax': '#14b8a6',
            'expense_insurance': '#f59e0b',
            'expense_card_fee': '#06b6d4',
            'expense_delivery_fee': '#a855f7',
            'expense_other': '#94a3b8',
        };

        const kpiCards = [
            { label: '전월 매출', value: formatNumber(prevRevenue) + '원', icon: '💰', color: 'amber', gradient: 'from-amber-500 to-amber-600', shadow: 'shadow-amber-500/30' },
            { label: '전월 지출', value: formatNumber(prevExpense) + '원', icon: '📤', color: 'rose', gradient: 'from-rose-500 to-rose-600', shadow: 'shadow-rose-500/30' },
            { label: '전월 순이익', value: formatNumber(prevProfit) + '원', icon: prevProfit >= 0 ? '📈' : '📉', color: 'teal', gradient: 'from-teal-700 to-teal-900', shadow: 'shadow-teal-700/30', valueColor: prevProfit >= 0 ? 'text-emerald-600' : 'text-rose-500' },
            { label: '전월 마진율', value: prevMargin + '%', icon: '🎯', color: 'slate', gradient: 'from-slate-700 to-slate-800', shadow: 'shadow-slate-700/30', valueColor: Number(prevMargin) >= 0 ? 'text-emerald-600' : 'text-rose-500' },
        ];

        return (
            <div>
                {/* Key Metric Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {kpiCards.map((card, i) => (
                        <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 card-animate hover:shadow-md transition-shadow" style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-lg ${card.shadow} text-lg shrink-0`}>
                                    {card.icon}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{card.label}</div>
                                    <div className={`text-base md:text-lg font-extrabold truncate ${card.valueColor || 'text-slate-800'}`}>{card.value}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Annual Summary */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5 card-animate" style={{ animationDelay: '0.2s' }}>
                    <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs text-white">📅</span>
                        {year}년 연간 요약
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                            { label: '총 매출', value: formatNumber(yearRevenue) + '원', bg: 'bg-slate-50', textColor: 'text-slate-800' },
                            { label: '총 지출', value: formatNumber(yearExpense) + '원', bg: 'bg-slate-50', textColor: 'text-rose-500' },
                            { label: '총 순이익', value: formatNumber(yearProfit) + '원', bg: yearProfit >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200', textColor: yearProfit >= 0 ? 'text-emerald-600' : 'text-rose-500' },
                            { label: '연간 마진율', value: yearMargin + '%', bg: 'bg-slate-50', textColor: Number(yearMargin) >= 0 ? 'text-emerald-600' : 'text-rose-500' },
                        ].map((item, i) => (
                            <div key={i} className={`${item.bg} rounded-xl p-3`}>
                                <div className="text-[11px] text-slate-400 font-semibold mb-1">{item.label}</div>
                                <div className={`text-[15px] font-bold ${item.textColor}`}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Monthly Trend — SVG Line Chart (data-zoomed Y-axis) */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-5 card-animate" style={{ animationDelay: '0.25s' }}>
                    <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-xs text-white">📊</span>
                        월별 매출/지출 추이
                    </h3>
                    {activeMonths.length > 0 ? (() => {
                        // Data-zoomed scale: use min/max of actual values so month-to-month variation is visible
                        const allVals = activeMonths.flatMap(m => [m.revenue, m.expense]);
                        const dataMin = Math.min(...allVals);
                        const dataMax = Math.max(...allVals);
                        const pad = (dataMax - dataMin) * 0.15 || dataMax * 0.1 || 1;
                        const yMin = Math.max(0, dataMin - pad);
                        const yMax = dataMax + pad;

                        // SVG viewBox dimensions
                        const W = 800, H = 260;
                        const P = { t: 20, r: 24, b: 36, l: 64 };
                        const iw = W - P.l - P.r;
                        const ih = H - P.t - P.b;
                        const n = activeMonths.length;
                        const xStep = n > 1 ? iw / (n - 1) : 0;
                        const xAt = (i) => P.l + (n > 1 ? i * xStep : iw / 2);
                        const yAt = (v) => P.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
                        const fmtAxis = (v) => v >= 100000000 ? `${(v / 100000000).toFixed(1)}억` : v >= 10000 ? `${Math.round(v / 10000).toLocaleString()}만` : v.toLocaleString();

                        // Y-axis ticks (5 levels)
                        const ticks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

                        // Build path strings
                        const revPath = activeMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(m.revenue)}`).join(' ');
                        const expPath = activeMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(m.expense)}`).join(' ');

                        // Area fill for profit band between revenue and expense
                        const areaPath = n > 1
                            ? `${activeMonths.map((m, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(m.revenue)}`).join(' ')} ${[...activeMonths].reverse().map((m, i) => `L${xAt(n - 1 - i)},${yAt(m.expense)}`).join(' ')} Z`
                            : '';

                        return (
                            <div className="w-full overflow-x-auto">
                                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ minWidth: 560 }}>
                                    <defs>
                                        <linearGradient id="profitBand" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#134e4a" stopOpacity="0.22" />
                                            <stop offset="100%" stopColor="#134e4a" stopOpacity="0.03" />
                                        </linearGradient>
                                    </defs>

                                    {/* Grid lines + Y-axis labels */}
                                    {ticks.map((t, i) => (
                                        <g key={i}>
                                            <line x1={P.l} y1={yAt(t)} x2={W - P.r} y2={yAt(t)} stroke="#f1f5f9" strokeWidth="1" strokeDasharray={i === 0 ? '' : '3,3'} />
                                            <text x={P.l - 8} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="600">
                                                {fmtAxis(t)}
                                            </text>
                                        </g>
                                    ))}

                                    {/* Profit band (area between revenue & expense) */}
                                    {n > 1 && <path d={areaPath} fill="url(#profitBand)" />}

                                    {/* Expense line */}
                                    <path d={expPath} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                                    {/* Revenue line */}
                                    <path d={revPath} fill="none" stroke="#1e3a3a" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

                                    {/* Data points + month labels + profit labels */}
                                    {activeMonths.map((m, i) => {
                                        const cx = xAt(i);
                                        const ryY = yAt(m.revenue);
                                        const exY = yAt(m.expense);
                                        const profitPos = m.profit >= 0;
                                        return (
                                            <g key={m.month}>
                                                {/* Expense dot */}
                                                <circle cx={cx} cy={exY} r="4" fill="#fff" stroke="#ef4444" strokeWidth="2">
                                                    <title>{`${m.month}월 지출: ${formatNumber(m.expense)}원`}</title>
                                                </circle>
                                                {/* Revenue dot */}
                                                <circle cx={cx} cy={ryY} r="4" fill="#fff" stroke="#1e3a3a" strokeWidth="2">
                                                    <title>{`${m.month}월 매출: ${formatNumber(m.revenue)}원`}</title>
                                                </circle>
                                                {/* Month label */}
                                                <text x={cx} y={H - P.b + 18} textAnchor="middle" fontSize="11" fill="#64748b" fontWeight="700">
                                                    {m.month}월
                                                </text>
                                                {/* Profit label */}
                                                {m.profit !== 0 && (
                                                    <text x={cx} y={H - P.b + 32} textAnchor="middle" fontSize="10" fill={profitPos ? '#10b981' : '#f43f5e'} fontWeight="700">
                                                        {profitPos ? '+' : ''}{(m.profit / 10000).toFixed(0)}만
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    })}
                                </svg>
                            </div>
                        );
                    })() : (
                        <div className="text-slate-400 text-center py-6 text-sm">데이터가 없습니다</div>
                    )}
                    <div className="flex justify-center gap-4 mt-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#1e3a3a' }} />매출</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} />지출</span>
                        <span className="text-slate-400">· Y축: 실제 데이터 범위 확대</span>
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate" style={{ animationDelay: '0.3s' }}>
                    <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-xs text-white">💸</span>
                        지출 항목별 비중 (연간)
                    </h3>
                    <div className="flex flex-col gap-2.5">
                        {expenseBreakdown.map(e => {
                            const pct = yearExpense > 0 ? ((e.total / yearExpense) * 100).toFixed(1) : '0.0';
                            const cat = EXPENSE_CATEGORIES.find(c => e.label === c.label);
                            const color = EXPENSE_COLORS[e.key] || '#94a3b8';
                            return (
                                <div key={e.key}>
                                    <div className="flex justify-between text-[13px] text-slate-600 mb-1">
                                        <span className="font-medium">{cat?.icon || '📋'} {e.label}</span>
                                        <span className="text-xs text-slate-400 font-semibold">{formatNumber(e.total)}원 ({pct}%)</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(e.total / maxExpense) * 100}%`, background: color }} />
                                    </div>
                                </div>
                            );
                        })}
                        {expenseBreakdown.length === 0 && (
                            <div className="text-slate-400 text-center py-6 text-sm">지출 데이터가 없습니다</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render expense detail table
    const renderExpenseDetail = () => (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center text-xs text-white">📊</span>
                세부지출 내역서
            </h3>
            <div className="table-container">
                <table className="pl-table expense-table">
                    <thead>
                        <tr>
                            <th>지출 항목</th>
                            {MONTHS.map(m => <th key={m}>{m}월</th>)}
                            <th>합계</th>
                            <th>월평균</th>
                            <th>비율</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...EXPENSE_FIELDS, ...TAX_FIELDS].map(field => {
                            const yearTotal = calcYearTotal(field.key);
                            const totalExpense = data.reduce((s, d) => s + calcTotalExpense(d), 0);
                            const percentage = totalExpense > 0 ? ((yearTotal / totalExpense) * 100).toFixed(1) : 0;
                            return (
                                <tr key={field.key}>
                                    <td className="item-name">{field.label}</td>
                                    {MONTHS.map(m => (
                                        <td key={m}>{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                    ))}
                                    <td className="total">{formatNumber(yearTotal)}</td>
                                    <td className="average">{formatNumber(calcYearAverage(field.key))}</td>
                                    <td className="percentage">{percentage}%</td>
                                </tr>
                            );
                        })}
                        <tr className="subtotal-row">
                            <td className="item-name"><strong>총합</strong></td>
                            {MONTHS.map(m => (
                                <td key={m} className="subtotal">{formatNumber(calcTotalExpense(getMonthData(m)))}</td>
                            ))}
                            <td className="total"><strong>{formatNumber(data.reduce((s, d) => s + calcTotalExpense(d), 0))}</strong></td>
                            <td className="average"><strong>{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalExpense(d), 0) / activeMonthCount))}</strong></td>
                            <td className="percentage">100%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                <p className="text-sm text-blue-700 m-0">💡 셀을 클릭하면 직접 수정할 수 있습니다. 비율은 전체 지출 대비 비율입니다.</p>
            </div>
        </div>
    );

    // Note: renderRevenueDetail() has been moved to RevenueManagement page

    // Render monthly analysis
    const renderAnalysis = () => {
        const totalRevenue = data.reduce((s, d) => s + calcTotalRevenue(d), 0);
        const totalExpense = data.reduce((s, d) => s + calcTotalExpense(d), 0);
        const totalProfit = totalRevenue - totalExpense;
        const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

        const analysisCards = [
            { label: '총 수입', value: formatNumber(totalRevenue) + '원', avg: `월평균 ${formatNumber(Math.round(totalRevenue / activeMonthCount))}원`, gradient: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-50', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
            { label: '총 지출', value: formatNumber(totalExpense) + '원', avg: `월평균 ${formatNumber(Math.round(totalExpense / activeMonthCount))}원`, gradient: 'from-rose-500 to-rose-600', bg: 'bg-rose-50', textColor: 'text-rose-700', borderColor: 'border-rose-200' },
            { label: '순수익', value: formatNumber(totalProfit) + '원', avg: `수익률 ${profitMargin}%`, gradient: 'from-blue-500 to-blue-600', bg: 'bg-blue-50', textColor: 'text-blue-700', borderColor: 'border-blue-200' },
        ];

        return (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
                <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-xs text-white">📈</span>
                    월별 분석
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {analysisCards.map((card, i) => (
                        <div key={i} className={`${card.bg} border ${card.borderColor} rounded-2xl p-5 card-animate`} style={{ animationDelay: `${i * 0.05}s` }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center shadow-sm`}>
                                    <span className="text-white text-xs font-bold">{i === 0 ? '📈' : i === 1 ? '📤' : '💎'}</span>
                                </div>
                                <span className={`text-sm font-semibold ${card.textColor} opacity-80`}>{card.label}</span>
                            </div>
                            <div className={`text-xl font-extrabold ${card.textColor} mb-1`}>{card.value}</div>
                            <div className={`text-xs ${card.textColor} opacity-60`}>{card.avg}</div>
                        </div>
                    ))}
                </div>

                <div className="mt-4">
                    <h4 className="text-sm font-bold text-slate-700 mb-3">월별 손익 추이</h4>
                    <div className="table-container">
                        <table className="pl-table">
                            <thead>
                                <tr>
                                    <th>구분</th>
                                    {MONTHS.map(m => <th key={m}>{m}월</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="revenue-row">
                                    <td>수입</td>
                                    {MONTHS.map(m => (
                                        <td key={m} className="revenue-positive">{formatNumber(calcTotalRevenue(getMonthData(m)))}</td>
                                    ))}
                                </tr>
                                <tr className="expense-row">
                                    <td>지출</td>
                                    {MONTHS.map(m => (
                                        <td key={m} className="expense-negative">{formatNumber(calcTotalExpense(getMonthData(m)))}</td>
                                    ))}
                                </tr>
                                <tr className="profit-row">
                                    <td>순이익</td>
                                    {MONTHS.map(m => {
                                        const profit = calcProfit(getMonthData(m));
                                        return (
                                            <td key={m} className={profit >= 0 ? 'profit-positive' : 'profit-negative'}>
                                                {formatNumber(profit)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    };

    // Note: renderDeliveryRevenue() has been moved to RevenueManagement page

    // Helper to map Korean category to PL field key
    const getPlFieldByCategory = (category) => {
        if (!category) return 'other';
        const map = {
            // 신규 카테고리
            '원재료비': 'expense_ingredient',
            '소모품비': 'expense_material',
            '수도광열비': 'expense_utility',
            '임차료': 'expense_rent',
            '수선비': 'expense_repair',
            '감가상각비': 'expense_depreciation',
            '세금과공과': 'expense_tax',
            '보험료': 'expense_insurance',
            '카드수수료': 'expense_card_fee',
            '배달앱수수료': 'expense_delivery_fee',
            '기타경비': 'expense_other',
            '퇴직금적립': 'expense_retirement',
            '인건비': 'expense_labor',
            // 레거시 호환
            '식자재': 'expense_ingredient',
            '재료비': 'expense_ingredient',
            '임대료': 'expense_rent',
            '임대료(월세)': 'expense_rent',
            '임대관리비': 'expense_rent',
            '제세공과금': 'expense_utility',
            '부가가치세': 'expense_tax',
            '사업소득세': 'expense_tax',
            '근로소득세': 'expense_tax',
            '기타비용': 'expense_other',
        };
        return map[category] || 'expense_other';
    };

    // Render monthly expense detail (7~12월 비용) - Excel-like grid
    const renderMonthlyExpense = (month) => {
        const expenses = monthlyExpenses[month] || [];

        // Get days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Create grid data structure & Capture Vendor Categories
        const vendorGrid = {};
        const vendorCategoryMap = {}; // vendorName -> category

        expenses.forEach(item => {
            const day = new Date(item.date).getDate();
            if (!vendorGrid[item.vendor_name]) {
                vendorGrid[item.vendor_name] = { amounts: {}, ids: {} };
            }
            // Capture category (prefer latest)
            if (item.category) {
                vendorCategoryMap[item.vendor_name] = item.category;
            }

            vendorGrid[item.vendor_name].amounts[day] = (vendorGrid[item.vendor_name].amounts[day] || 0) + item.amount;
            vendorGrid[item.vendor_name].ids[day] = item.id;
        });

        // Use global vendor list to maintain consistency
        const dataVendors = Object.keys(vendorGrid);

        // Merge global vendors with data vendors
        const allVendorNames = [...globalVendors];
        dataVendors.forEach(v => {
            if (!allVendorNames.includes(v)) allVendorNames.push(v);
        });

        // Initialize grid for all vendors
        allVendorNames.forEach(v => {
            if (!vendorGrid[v]) {
                vendorGrid[v] = { amounts: {}, ids: {} };
            }
        });

        // Calculate row totals & Filter empty if needed
        const vendorTotals = {};
        allVendorNames.forEach(v => {
            vendorTotals[v] = Object.values(vendorGrid[v].amounts).reduce((sum, amt) => sum + amt, 0);
        });

        const emptyVendorCount = allVendorNames.filter(v => vendorTotals[v] === 0).length;

        // Actual list of vendors to display
        const displayVendors = hideEmptyVendors
            ? allVendorNames.filter(v => vendorTotals[v] > 0)
            : allVendorNames;

        // Group vendors by VendorSettings category (not P/L fields)
        const groupedVendors = {};
        // Initialize groups based on EXPENSE_CATEGORIES (matching VendorSettings)
        EXPENSE_CATEGORIES.forEach(cat => groupedVendors[cat.id] = []);

        displayVendors.forEach(v => {
            // Use Vendor API category as source of truth, fallback to expense data category
            const cat = vendorCategoryFromAPI[v] || vendorCategoryMap[v] || 'other';
            if (groupedVendors[cat]) {
                groupedVendors[cat].push(v);
            } else {
                groupedVendors['other'].push(v);
            }
        });

        // Sort each category: globalVendors order first, then orphan vendors at end
        Object.keys(groupedVendors).forEach(catId => {
            groupedVendors[catId].sort((a, b) => {
                const aIdx = globalVendors.indexOf(a);
                const bIdx = globalVendors.indexOf(b);
                // If not in globalVendors (orphan), put at end
                if (aIdx === -1 && bIdx === -1) return 0;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        });

        // Calculations for totals
        const dayTotals = {};
        days.forEach(d => {
            dayTotals[d] = displayVendors.reduce((sum, v) => sum + (vendorGrid[v].amounts[d] || 0), 0);
        });
        const grandTotal = Object.values(vendorTotals).reduce((sum, t) => sum + t, 0);

        // Helper to calc subtotal for a group
        const calcGroupDayTotal = (groupVendors, day) => groupVendors.reduce((sum, v) => sum + (vendorGrid[v].amounts[day] || 0), 0);
        const calcGroupRowTotal = (groupVendors) => groupVendors.reduce((sum, v) => sum + (vendorTotals[v] || 0), 0);


        // Handle expense cell editing (existing logic)
        const handleExpenseCellClick = (vendor, day, amount, expenseId) => {
            setEditingCell({ type: 'expense', month, vendor, day, id: expenseId });
            setEditValue(amount?.toString() || '0');
        };

        const handleExpenseSave = async () => {
            if (!editingCell || editingCell.type !== 'expense') return;

            const { month: m, vendor, day, id } = editingCell;
            const amount = parseInt(editValue) || 0;
            const date = `${year}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

            try {
                if (id && amount > 0) {
                    await api.put(`/profitloss/expenses/${id}`, { date, vendor_name: vendor, amount });
                } else if (!id && amount > 0) {
                    await api.post(`/profitloss/expenses`, { date, vendor_name: vendor, amount });
                } else if (id && amount === 0) {
                    await api.delete(`/profitloss/expenses/${id}`);
                }
                fetchMonthlyExpenses(m);
            } catch (err) {
                console.error('Error saving expense:', err);
            }
            setEditingCell(null);
        };

        const renderExpenseCell = (vendor, day) => {
            const amount = vendorGrid[vendor]?.amounts[day] || 0;
            const expenseId = vendorGrid[vendor]?.ids[day];
            const isEditing = editingCell?.type === 'expense' &&
                editingCell?.vendor === vendor &&
                editingCell?.day === day &&
                editingCell?.month === month;

            if (isEditing) {
                return (
                    <input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleExpenseSave}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleExpenseSave();
                            if (e.key === 'Escape') setEditingCell(null);
                        }}
                        autoFocus
                        className="edit-input grid-input"
                    />
                );
            }
            return (
                <span
                    className={`cell-value editable ${amount > 0 ? 'has-value' : ''}`}
                    onClick={() => handleExpenseCellClick(vendor, day, amount, expenseId)}
                >
                    {amount > 0 ? formatNumber(amount) : '-'}
                </span>
            );
        };

        // Render Groups
        const renderCategoryGroup = (plKey, label) => {
            const groupVendors = groupedVendors[plKey] || [];
            if (groupVendors.length === 0) return null;

            return (
                <>
                    <tr className="category-header-row">
                        <td colSpan={daysInMonth + 2} className="category-header-cell">
                            📂 {label} ({groupVendors.length})
                        </td>
                    </tr>
                    {groupVendors.map(vendor => (
                        <tr key={vendor}>
                            <td className="vendor-cell indented">{vendor}</td>
                            {days.map(d => (
                                <td key={d} className="amount-cell">
                                    {renderExpenseCell(vendor, d)}
                                </td>
                            ))}
                            <td className="row-total">{formatNumber(vendorTotals[vendor])}</td>
                        </tr>
                    ))}
                    <tr className="category-subtotal-row">
                        <td className="subtotal-label">↳ {label} 소계</td>
                        {days.map(d => (
                            <td key={d} className="subtotal-cell">
                                {formatNumber(calcGroupDayTotal(groupVendors, d)) || '-'}
                            </td>
                        ))}
                        <td className="subtotal-total">{formatNumber(calcGroupRowTotal(groupVendors))}</td>
                    </tr>
                </>
            );
        };

        return (
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate relative">
                <div className="sticky top-0 z-[200] bg-white/95 backdrop-blur-sm pb-4 mb-4 border-b border-slate-200">
                    <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center text-xs text-white">📅</span>
                        {month}월 비용 상세
                    </h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">거래처 수</div>
                            <div className="text-lg font-extrabold text-slate-800">{displayVendors.length}개 {hideEmptyVendors && emptyVendorCount > 0 && <span className="text-xs text-slate-400 font-medium">(+{emptyVendorCount} 숨김)</span>}</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">거래 건수</div>
                            <div className="text-lg font-extrabold text-slate-800">{expenses.length}건</div>
                        </div>
                        <div className="bg-rose-50 rounded-xl p-3 border border-rose-100">
                            <div className="text-[11px] text-rose-400 font-semibold">총 지출</div>
                            <div className="text-lg font-extrabold text-rose-600">{formatNumber(grandTotal)}원</div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-xl border border-sky-200">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-sky-700 font-medium">
                            <input
                                type="checkbox"
                                checked={hideEmptyVendors}
                                onChange={(e) => setHideEmptyVendors(e.target.checked)}
                                className="w-4 h-4 accent-sky-600 cursor-pointer"
                            />
                            <span>빈 거래처 숨기기 ({emptyVendorCount}개)</span>
                        </label>
                        <div className="flex items-center gap-2 text-sm text-blue-700">
                            <span>💡 거래처 추가/삭제/순서변경은</span>
                            <a href="/vendor-settings" className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors no-underline">⚙️ 거래처 관리</a>
                            <span>에서 설정하세요.</span>
                        </div>
                    </div>
                </div>

                <div className="grid-table-container">
                    <table className="expense-grid-table">
                        <thead>
                            <tr>
                                <th className="vendor-header">카테고리 / 거래처</th>
                                {days.map(d => (
                                    <th key={d} className="day-header">{d}</th>
                                ))}
                                <th className="total-header">합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayVendors.length > 0 ? (
                                <>
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <React.Fragment key={cat.id}>
                                            {renderCategoryGroup(cat.id, `${cat.icon} ${cat.label}`)}
                                        </React.Fragment>
                                    ))}

                                    <tr className="day-totals-row grand-total-row">
                                        <td className="vendor-cell"><strong>총 합계</strong></td>
                                        {days.map(d => (
                                            <td key={d} className="day-total">
                                                {dayTotals[d] > 0 ? formatNumber(dayTotals[d]) : '-'}
                                            </td>
                                        ))}
                                        <td className="grand-total">{formatNumber(grandTotal)}</td>
                                    </tr>
                                </>
                            ) : (
                                <tr>
                                    <td colSpan={daysInMonth + 2} className="no-data-row">
                                        {month}월 비용 데이터가 없습니다.
                                        <a href="/vendor-settings" className="vendor-settings-link">거래처 관리</a>에서 거래처를 추가하세요.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                    <p className="text-sm text-blue-700 m-0">💡 셀을 클릭하면 금액을 직접 입력/수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
                </div>
            </div>
        );
    };

    // Render the summary table (existing)

    // ═══════════════════════════════════════════
    // 정식 재무제표 — 손익계산서 · 현금흐름표 · 재무상태표
    // ═══════════════════════════════════════════
    const renderStatements = () => {
        if (!statements) return <div className="pl-table-card"><div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>재무제표 산출 중…</div></div>;
        const IS = statements.income_statement || [];
        const CF = statements.cash_flow || [];
        const BS = statements.balance_sheet || [];
        const activeIS = IS.filter(r => r.active);
        const lastBS = [...BS].reverse().find(r => r.active) || {};
        const sumIS = (k) => activeIS.reduce((s, r) => s + (r[k] || 0), 0);

        const IS_ROWS = [
            { k: 'revenue', label: '매출액' },
            { k: 'cogs', label: '매출원가 (원재료비)' },
            { k: 'gross_profit', label: '매출총이익', bold: true },
            { k: 'sga', label: '판매비와관리비' },
            { k: 'operating_profit', label: '영업이익', bold: true },
            { k: 'non_operating', label: '영업외수익' },
            { k: 'ordinary_profit', label: '경상이익', bold: true },
            { k: 'tax', label: '세금 (부가세·소득세 등)' },
            { k: 'net_profit', label: '당기순이익', bold: true },
        ];

        const FsTable = ({ title, note, children }) => (
            <div className="pl-table-card" style={{ marginBottom: 24 }}>
                <div className="pl-table-header">
                    <div className="pl-table-title-group">
                        <span className="pl-table-badge">FS</span>
                        <span className="pl-table-title">{title} <span className="pl-table-year">{year}년</span></span>
                    </div>
                    {note && <span className="pl-table-meta">{note}</span>}
                </div>
                <div className="pl-table-scroll">
                    <table className="pl-table">
                        <thead>
                            <tr>
                                <th style={{ minWidth: 150 }}>구분</th>
                                {MONTHS.map(m => <th key={m}>{m}월</th>)}
                                <th>합계</th>
                            </tr>
                        </thead>
                        <tbody>{children}</tbody>
                    </table>
                </div>
            </div>
        );

        const FsRow = ({ label, values, total, bold, signed }) => (
            <tr className={bold ? 'subtotal-row' : 'expense-row'}>
                <td className="pl-item-label" style={bold ? { fontWeight: 800 } : {}}>{label}</td>
                {values.map((v, i) => (
                    <td key={i} className={'pl-data' + (signed && v !== null && v < 0 ? ' profit-negative' : '')}>
                        {v === null || v === undefined ? '' : formatNumber(v)}
                    </td>
                ))}
                <td className="pl-data total">{total === null || total === undefined ? '' : formatNumber(total)}</td>
            </tr>
        );

        const cfFirst = CF.find(r => r.active) || {};
        const cfLast = [...CF].reverse().find(r => r.active) || {};

        return (
            <>
                <FsTable title="손익계산서" note="발생주의 · 주문 기준 매출 · 임차료 귀속조정">
                    {IS_ROWS.map(row => (
                        <FsRow key={row.k} label={row.label} bold={row.bold} signed
                            values={IS.map(r => r.active ? r[row.k] : null)}
                            total={sumIS(row.k)} />
                    ))}
                </FsTable>

                <FsTable title="현금흐름표" note="신한은행 원장 전량 매핑 — 월말 실제 잔액과 자동 대조">
                    <FsRow label="기초 현금" bold
                        values={CF.map(r => r.active ? r.beginning_cash : null)}
                        total={cfFirst.beginning_cash} />
                    {(statements.inflow_lines || []).map(([k, label]) => (
                        <FsRow key={k} label={'(+) ' + label}
                            values={CF.map(r => r.active ? (r.inflows[k] || 0) : null)}
                            total={CF.reduce((s, r) => s + (r.active ? (r.inflows[k] || 0) : 0), 0)} />
                    ))}
                    <FsRow label="현금 유입 합계" bold
                        values={CF.map(r => r.active ? r.total_inflow : null)}
                        total={CF.reduce((s, r) => s + (r.active ? r.total_inflow : 0), 0)} />
                    {(statements.outflow_lines || []).map(([k, label]) => (
                        <FsRow key={k} label={'(−) ' + label}
                            values={CF.map(r => r.active ? (r.outflows[k] || 0) : null)}
                            total={CF.reduce((s, r) => s + (r.active ? (r.outflows[k] || 0) : 0), 0)} />
                    ))}
                    <FsRow label="현금 유출 합계" bold
                        values={CF.map(r => r.active ? r.total_outflow : null)}
                        total={CF.reduce((s, r) => s + (r.active ? r.total_outflow : 0), 0)} />
                    <FsRow label="기말 현금" bold signed
                        values={CF.map(r => r.active ? r.ending_cash : null)}
                        total={cfLast.ending_cash} />
                    <tr className="expense-row">
                        <td className="pl-item-label">통장 잔액 대조</td>
                        {CF.map((r, i) => (
                            <td key={i} className="pl-data" style={{ textAlign: 'center' }}>
                                {r.active ? (r.verified ? '✅' : '⚠️') : ''}
                            </td>
                        ))}
                        <td className="pl-data total" style={{ textAlign: 'center' }}>
                            {CF.filter(r => r.active).every(r => r.verified) ? '✅ 전체 일치' : '⚠️ 확인 필요'}
                        </td>
                    </tr>
                </FsTable>

                <FsTable title="재무상태표 (대차대조표)" note="월말 기준 · 합계 열 = 최근 월말">
                    <FsRow label="현금및현금성자산"
                        values={BS.map(r => r.active ? r.cash : null)} total={lastBS.cash} />
                    <FsRow label="매출채권 (카드 미정산)"
                        values={BS.map(r => r.active ? r.card_receivable : null)} total={lastBS.card_receivable} />
                    <FsRow label="임대보증금"
                        values={BS.map(r => r.active ? r.deposit : null)} total={lastBS.deposit} />
                    <FsRow label="유형자산 취득원가 (집기·인테리어)"
                        values={BS.map(r => r.active ? r.fixed_cost : null)} total={lastBS.fixed_cost} />
                    <FsRow label="감가상각누계액" signed
                        values={BS.map(r => r.active ? r.accum_depreciation : null)} total={lastBS.accum_depreciation} />
                    <FsRow label="유형자산 장부가액"
                        values={BS.map(r => r.active ? r.fixed_book : null)} total={lastBS.fixed_book} />
                    <FsRow label="자산총계" bold
                        values={BS.map(r => r.active ? r.total_assets : null)} total={lastBS.total_assets} />
                    <FsRow label="퇴직급여충당부채"
                        values={BS.map(r => r.active ? r.retirement_liability : null)} total={lastBS.retirement_liability} />
                    <FsRow label="부채총계" bold
                        values={BS.map(r => r.active ? r.total_liabilities : null)} total={lastBS.total_liabilities} />
                    <FsRow label="자본총계 (자산−부채)" bold signed
                        values={BS.map(r => r.active ? r.total_equity : null)} total={lastBS.total_equity} />
                    <FsRow label="· 기초자본 (연초 현금)"
                        values={BS.map(r => r.active ? r.equity_detail.opening_capital : null)}
                        total={lastBS.equity_detail ? lastBS.equity_detail.opening_capital : null} />
                    <FsRow label="· 누적 당기순이익" signed
                        values={BS.map(r => r.active ? r.equity_detail.cumulative_net_profit : null)}
                        total={lastBS.equity_detail ? lastBS.equity_detail.cumulative_net_profit : null} />
                    <FsRow label="· 사장님 순불입" signed
                        values={BS.map(r => r.active ? r.equity_detail.owner_net_contribution : null)}
                        total={lastBS.equity_detail ? lastBS.equity_detail.owner_net_contribution : null} />
                    <FsRow label="· 가계 지출 (개인가계부)" signed
                        values={BS.map(r => r.active ? r.equity_detail.personal_spending : null)}
                        total={lastBS.equity_detail ? lastBS.equity_detail.personal_spending : null} />
                    <FsRow label="· 조정 (현금매출 미예치·시차 등)" signed
                        values={BS.map(r => r.active ? r.equity_detail.adjustment : null)}
                        total={lastBS.equity_detail ? lastBS.equity_detail.adjustment : null} />
                </FsTable>

                <div className="pl-table-tip">
                    {(statements.notes || []).map((n, i) => <div key={i}>💡 {n}</div>)}
                </div>
            </>
        );
    };

    const renderSummaryTable = () => {
        const yearRev = data.reduce((s, d) => s + calcTotalRevenue(d), 0);
        const yearExp = data.reduce((s, d) => s + calcTotalExpense(d), 0);
        const yearProfit = yearRev - yearExp;
        const yearMargin = yearRev > 0 ? ((yearProfit / yearRev) * 100) : 0;
        const fmtShort = (v) => {
            if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
            if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(0)}만`;
            return formatNumber(v);
        };
        return (
        <>
            {/* KPI Hero — 4 cards */}
            <div className="pl-kpi-grid">
                <div className="pl-kpi-card pl-kpi-rev card-animate">
                    <div className="pl-kpi-label">연간 매출</div>
                    <div className="pl-kpi-value">{fmtShort(yearRev)}<span className="pl-kpi-unit">원</span></div>
                    <div className="pl-kpi-sub">{formatNumber(yearRev)}원</div>
                </div>
                <div className="pl-kpi-card pl-kpi-exp card-animate" style={{ animationDelay: '0.05s' }}>
                    <div className="pl-kpi-label">연간 비용</div>
                    <div className="pl-kpi-value">{fmtShort(yearExp)}<span className="pl-kpi-unit">원</span></div>
                    <div className="pl-kpi-sub">{formatNumber(yearExp)}원</div>
                </div>
                <div className={`pl-kpi-card ${yearProfit >= 0 ? 'pl-kpi-profit' : 'pl-kpi-loss'} card-animate`} style={{ animationDelay: '0.1s' }}>
                    <div className="pl-kpi-label">순이익</div>
                    <div className="pl-kpi-value">{fmtShort(yearProfit)}<span className="pl-kpi-unit">원</span></div>
                    <div className="pl-kpi-sub">{formatNumber(yearProfit)}원</div>
                </div>
                <div className="pl-kpi-card pl-kpi-margin card-animate" style={{ animationDelay: '0.15s' }}>
                    <div className="pl-kpi-label">순이익률</div>
                    <div className="pl-kpi-value">{yearMargin.toFixed(1)}<span className="pl-kpi-unit">%</span></div>
                    <div className="pl-kpi-bar">
                        <div className="pl-kpi-bar-fill" style={{ width: `${Math.max(0, Math.min(100, yearMargin))}%` }} />
                    </div>
                </div>
            </div>

            <div className="pl-table-wrapper card-animate" style={{ animationDelay: '0.2s' }}>
                <div className="pl-table-header">
                    <div className="pl-table-title-group">
                        <span className="pl-table-badge">P/L</span>
                        <span className="pl-table-title">{businessName} <span className="pl-table-year">{year}년</span> 월별 손익계산서</span>
                    </div>
                    <span className="pl-table-meta">활성 {activeMonthCount}개월 · 자동 업데이트</span>
                </div>
                <div className="pl-table-scroll">
                <table className="pl-table">
                    <colgroup>
                        <col style={{ width: '52px' }} />
                        <col style={{ width: '120px' }} />
                        {MONTHS.map(m => <col key={m} style={{ width: 'calc((100% - 172px) / 14)' }} />)}
                        <col style={{ width: 'calc((100% - 172px) / 14)' }} />
                        <col style={{ width: 'calc((100% - 172px) / 14)' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th colSpan="2">{businessName} 월별손익계산서</th>
                            {MONTHS.map(m => <th key={m}>{m}월</th>)}
                            <th>합계</th>
                            <th>월평균</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Revenue Section */}
                        <tr className={`section-header ${REVENUE_FIELDS[0].group}`}>
                            <td className="pl-section-label" rowSpan={REVENUE_FIELDS.length + 1}>수입</td>
                            <td className="pl-item-label">{REVENUE_FIELDS[0].label}</td>
                            {MONTHS.map(m => (
                                <td key={m} className="pl-data">{renderCell(m, REVENUE_FIELDS[0].key, getMonthData(m)[REVENUE_FIELDS[0].key])}</td>
                            ))}
                            <td className="pl-data total">{formatNumber(calcYearTotal(REVENUE_FIELDS[0].key))}</td>
                            <td className="pl-data average">{formatNumber(calcYearAverage(REVENUE_FIELDS[0].key))}</td>
                        </tr>
                        {REVENUE_FIELDS.slice(1).map(field => (
                            <tr key={field.key} className={`revenue-row ${field.group}`}>
                                <td className="pl-item-label">{field.label}</td>
                                {MONTHS.map(m => (
                                    <td key={m} className="pl-data">{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                ))}
                                <td className="pl-data total">{formatNumber(calcYearTotal(field.key))}</td>
                                <td className="pl-data average">{formatNumber(calcYearAverage(field.key))}</td>
                            </tr>
                        ))}
                        <tr className="subtotal-row">
                            <td className="pl-item-label">합계</td>
                            {MONTHS.map(m => (
                                <td key={m} className="pl-data">{formatNumber(calcTotalRevenue(getMonthData(m)))}</td>
                            ))}
                            <td className="pl-data total">{formatNumber(data.reduce((s, d) => s + calcTotalRevenue(d), 0))}</td>
                            <td className="pl-data average">{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalRevenue(d), 0) / activeMonthCount))}</td>
                        </tr>

                        {/* Operating Expense Section (세금 제외) */}
                        <tr className={`section-header expense-section-header ${EXPENSE_FIELDS[0].group}`}>
                            <td className="pl-section-label" rowSpan={EXPENSE_FIELDS.length + 1}>영업비용</td>
                            <td className="pl-item-label">{EXPENSE_FIELDS[0].label}</td>
                            {MONTHS.map(m => (
                                <td key={m} className="pl-data">{renderCell(m, EXPENSE_FIELDS[0].key, getMonthData(m)[EXPENSE_FIELDS[0].key])}</td>
                            ))}
                            <td className="pl-data total">{formatNumber(calcYearTotal(EXPENSE_FIELDS[0].key))}</td>
                            <td className="pl-data average">{formatNumber(calcYearAverage(EXPENSE_FIELDS[0].key))}</td>
                        </tr>
                        {EXPENSE_FIELDS.slice(1).map(field => (
                            <tr key={field.key} className={`expense-row ${field.group}`}>
                                <td className="pl-item-label">{field.label}</td>
                                {MONTHS.map(m => (
                                    <td key={m} className="pl-data">{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                ))}
                                <td className="pl-data total">{formatNumber(calcYearTotal(field.key))}</td>
                                <td className="pl-data average">{formatNumber(calcYearAverage(field.key))}</td>
                            </tr>
                        ))}
                        <tr className="subtotal-row">
                            <td className="pl-item-label">합계</td>
                            {MONTHS.map(m => (
                                <td key={m} className="pl-data">{formatNumber(calcOperatingExpense(getMonthData(m)))}</td>
                            ))}
                            <td className="pl-data total">{formatNumber(data.reduce((s, d) => s + calcOperatingExpense(d), 0))}</td>
                            <td className="pl-data average">{formatNumber(Math.round(data.reduce((s, d) => s + calcOperatingExpense(d), 0) / activeMonthCount))}</td>
                        </tr>

                        {/* Operating Profit Row — 수입 − 영업비용 */}
                        <tr className="profit-row">
                            <td className="pl-section-label" colSpan="2">영업이익</td>
                            {MONTHS.map(m => (
                                <td key={m} className={`pl-data ${calcOperatingProfit(getMonthData(m)) >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                    {formatNumber(calcOperatingProfit(getMonthData(m)))}
                                </td>
                            ))}
                            <td className="pl-data total profit-positive">
                                {formatNumber(data.reduce((s, d) => s + calcOperatingProfit(d), 0))}
                            </td>
                            <td className="pl-data average profit-positive">
                                {formatNumber(Math.round(data.reduce((s, d) => s + calcOperatingProfit(d), 0) / activeMonthCount))}
                            </td>
                        </tr>

                        {/* Tax Section — 부가세·소득세·재산세 등 납부 (영업외) */}
                        {TAX_FIELDS.map((field, i) => (
                            <tr key={field.key} className={`expense-row ${field.group}`}>
                                {i === 0 && <td className="pl-section-label" rowSpan={TAX_FIELDS.length}>세금</td>}
                                <td className="pl-item-label">{field.label}</td>
                                {MONTHS.map(m => (
                                    <td key={m} className="pl-data">{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                ))}
                                <td className="pl-data total">{formatNumber(calcYearTotal(field.key))}</td>
                                <td className="pl-data average">{formatNumber(calcYearAverage(field.key))}</td>
                            </tr>
                        ))}

                        {/* Net Profit Row — 영업이익 − 세금 */}
                        <tr className="profit-row">
                            <td className="pl-section-label" colSpan="2">순이익</td>
                            {MONTHS.map(m => (
                                <td key={m} className={`pl-data ${calcProfit(getMonthData(m)) >= 0 ? 'profit-positive' : 'profit-negative'}`}>
                                    {formatNumber(calcProfit(getMonthData(m)))}
                                </td>
                            ))}
                            <td className="pl-data total profit-positive">
                                {formatNumber(data.reduce((s, d) => s + calcProfit(d), 0))}
                            </td>
                            <td className="pl-data average profit-positive">
                                {formatNumber(Math.round(data.reduce((s, d) => s + calcProfit(d), 0) / activeMonthCount))}
                            </td>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>
            <div className="pl-table-tip">
                💡 셀을 클릭하면 직접 수정할 수 있습니다. Enter로 저장, Esc로 취소
            </div>
        </>
        );
    };

    // ═══════════════════════════════════════════
    // MOBILE: Single-scroll P/L (no tabs)
    // ═══════════════════════════════════════════
    if (isMobile) {
        const monthSummaries = MONTHS.map(m => {
            const md = data.find(d => d.month === m) || {};
            const rev = calcTotalRevenue(md);
            const exp = calcTotalExpense(md);
            return { month: m, revenue: rev, expense: exp, profit: rev - exp, data: md };
        });
        const yearRev = monthSummaries.reduce((s, m) => s + m.revenue, 0);
        const yearExp = monthSummaries.reduce((s, m) => s + m.expense, 0);
        const yearProfit = yearRev - yearExp;
        const yearMargin = yearRev > 0 ? ((yearProfit / yearRev) * 100).toFixed(1) : '0.0';

        // Revenue breakdown (annual)
        const revBreakdown = REVENUE_FIELDS.map(f => ({
            key: f.key, label: f.label,
            total: data.reduce((s, d) => s + (d[f.key] || 0), 0),
        })).filter(e => e.total > 0);

        // Expense breakdown (annual)
        const expBreakdown = [...EXPENSE_FIELDS, ...TAX_FIELDS].map(f => ({
            key: f.key, label: f.label,
            total: data.reduce((s, d) => s + (d[f.key] || 0), 0),
        })).filter(e => e.total > 0).sort((a, b) => b.total - a.total);
        const maxExpVal = expBreakdown[0]?.total || 1;

        const REV_ICONS = {
            'revenue_store': '🏪', 'revenue_coupang': '🟡',
            'revenue_baemin': '🟢', 'revenue_yogiyo': '🔴', 'revenue_ddangyo': '🟠',
        };
        const EXP_ICONS = {
            'expense_labor': '👷', 'expense_retirement': '🏦',
            'expense_ingredient': '🥬', 'expense_material': '📦',
            'expense_utility': '💡', 'expense_rent': '🏠',
            'expense_repair': '🔧', 'expense_depreciation': '⚙️',
            'expense_tax': '🏛️', 'expense_insurance': '🛡️',
            'expense_card_fee': '💳', 'expense_delivery_fee': '🛵',
            'expense_other': '📋', 'expense_insurance_employee': '🛡️',
            'expense_tax_employee': '🏛️',
        };
        const EXP_COLORS = {
            'expense_labor': '#ef4444', 'expense_retirement': '#f97316',
            'expense_ingredient': '#22c55e', 'expense_material': '#10b981',
            'expense_utility': '#3b82f6', 'expense_rent': '#8b5cf6',
            'expense_repair': '#ec4899', 'expense_depreciation': '#6366f1',
            'expense_tax': '#14b8a6', 'expense_insurance': '#f59e0b',
            'expense_card_fee': '#06b6d4', 'expense_delivery_fee': '#a855f7',
            'expense_other': '#94a3b8', 'expense_insurance_employee': '#d97706',
            'expense_tax_employee': '#0d9488',
        };

        const fmtShort = (v) => {
            if (Math.abs(v) >= 100000000) return `${(v / 100000000).toFixed(1)}억`;
            if (Math.abs(v) >= 10000) return `${(v / 10000).toFixed(0)}만`;
            return formatNumber(v);
        };

        return (
            <div style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: 100 }}>
                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
                    padding: '44px 20px 24px', borderRadius: '0 0 24px 24px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'white' }}>손익계산서</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => setYear(y => y - 1)} style={{
                                background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white',
                                width: 28, height: 28, borderRadius: 8, fontSize: 14, cursor: 'pointer',
                            }}>◀</button>
                            <span style={{ fontSize: 16, fontWeight: 700, color: 'white', minWidth: 50, textAlign: 'center' }}>{year}년</span>
                            <button onClick={() => setYear(y => y + 1)} style={{
                                background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white',
                                width: 28, height: 28, borderRadius: 8, fontSize: 14, cursor: 'pointer',
                            }}>▶</button>
                        </div>
                    </div>

                    {/* Hero: 순이익 */}
                    <div style={{ textAlign: 'center', marginTop: 20 }}>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, letterSpacing: 1 }}>순이익</div>
                        <div className="num-animate" style={{
                            fontSize: 30, fontWeight: 900, marginTop: 4, letterSpacing: -1,
                            color: yearProfit >= 0 ? '#34d399' : '#f87171',
                        }}>
                            {fmtShort(yearProfit)}<span style={{ fontSize: 14, color: '#94a3b8' }}>원</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>마진율 {yearMargin}%</div>
                    </div>
                </div>

                {/* ──── 연간 매출 상세 ──── */}
                <div style={{ padding: '16px 16px 0' }}>
                    <div className="card-animate" style={{
                        background: 'white', borderRadius: 16, padding: '16px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12,
                    }}>
                        <div onClick={() => setRevOpen(!revOpen)} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer', padding: '10px 14px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>📈 매출 내역</span>
                                <span style={{ fontSize: 12, color: '#94a3b8', transition: 'transform 0.2s', display: 'inline-block', transform: revOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>{formatNumber(yearRev)}원</span>
                        </div>
                        {revOpen && (
                            <div style={{ marginTop: 10 }}>
                                {revBreakdown.map((r, i) => {
                                    const pct = yearRev > 0 ? ((r.total / yearRev) * 100).toFixed(1) : '0';
                                    return (
                                        <div key={r.key} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '8px 0', borderBottom: i < revBreakdown.length - 1 ? '1px solid #f1f5f9' : 'none',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 16 }}>{REV_ICONS[r.key] || '💰'}</span>
                                                <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{r.label}</span>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{formatNumber(r.total)}원</div>
                                                <div style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {revBreakdown.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>매출 데이터 없음</div>}
                            </div>
                        )}
                    </div>

                    {/* ──── 연간 지출 상세 ──── */}
                    <div className="card-animate" style={{
                        background: 'white', borderRadius: 16, padding: '16px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 12,
                        animationDelay: '0.1s',
                    }}>
                        <div onClick={() => setExpOpen(!expOpen)} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            cursor: 'pointer', padding: '10px 14px', borderRadius: 12,
                            background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>📤 지출 내역</span>
                                <span style={{ fontSize: 12, color: '#94a3b8', transition: 'transform 0.2s', display: 'inline-block', transform: expOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                            </div>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#334155' }}>{formatNumber(yearExp)}원</span>
                        </div>
                        {expOpen && (
                            <div style={{ marginTop: 10 }}>
                                {expBreakdown.map((e) => {
                                    const pct = yearExp > 0 ? ((e.total / yearExp) * 100).toFixed(1) : '0';
                                    const color = EXP_COLORS[e.key] || '#94a3b8';
                                    return (
                                        <div key={e.key} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                                                    {EXP_ICONS[e.key] || '📋'} {e.label}
                                                </span>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                                                    {formatNumber(e.total)} <span style={{ color: '#94a3b8', fontWeight: 500 }}>({pct}%)</span>
                                                </span>
                                            </div>
                                            <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{
                                                    height: '100%', borderRadius: 3, background: color,
                                                    width: `${(e.total / maxExpVal) * 100}%`, transition: 'width 0.5s',
                                                }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                {expBreakdown.length === 0 && <div style={{ textAlign: 'center', padding: 16, color: '#94a3b8', fontSize: 12 }}>지출 데이터 없음</div>}
                            </div>
                        )}
                    </div>

                    {/* ──── 연간 손익 요약 ──── */}
                    <div className="card-animate" style={{
                        background: 'linear-gradient(135deg, #1e293b, #334155)',
                        borderRadius: 16, padding: '16px', marginBottom: 20,
                        animationDelay: '0.15s',
                    }}>
                        {[
                            { label: '총 매출', value: yearRev, color: '#60a5fa' },
                            { label: '총 지출', value: yearExp, color: '#f97316' },
                            { label: yearProfit >= 0 ? '순이익' : '순손실', value: yearProfit, color: yearProfit >= 0 ? '#34d399' : '#f87171', bold: true },
                        ].map((row, i) => (
                            <div key={i} style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                padding: '8px 12px', marginBottom: 4,
                                background: 'rgba(255,255,255,0.06)', borderRadius: 10,
                                border: row.bold ? '1px solid rgba(255,255,255,0.15)' : 'none',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: 3, background: row.color }} />
                                    <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{row.label}</span>
                                </div>
                                <span style={{ fontSize: 13, fontWeight: row.bold ? 800 : 600, color: row.bold ? row.color : '#f1f5f9' }}>
                                    {formatNumber(row.value)}원
                                </span>
                            </div>
                        ))}
                        <div style={{ textAlign: 'right', fontSize: 10, color: '#64748b', marginTop: 4 }}>마진율 {yearMargin}%</div>
                    </div>

                    {/* ──── 월별 상세 ──── */}
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#1e293b', marginBottom: 12 }}>📅 월별 손익 분석</div>
                    {monthSummaries.filter(m => m.revenue > 0 || m.expense > 0).map((m, idx) => {
                        const md = m.data;
                        const margin = m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) : '0.0';
                        // Revenue items for this month
                        const mRevItems = REVENUE_FIELDS.map(f => ({ label: f.label, value: md[f.key] || 0, icon: REV_ICONS[f.key] || '💰' })).filter(r => r.value > 0);
                        // Top expense items
                        const mExpItems = [...EXPENSE_FIELDS, ...TAX_FIELDS].map(f => ({ label: f.label, value: md[f.key] || 0, icon: EXP_ICONS[f.key] || '📋' })).filter(e => e.value > 0).sort((a, b) => b.value - a.value);

                        return (
                            <div key={m.month} className="card-animate" style={{
                                background: 'white', borderRadius: 16, padding: '16px',
                                marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                animationDelay: `${idx * 0.04}s`,
                            }}>
                                {/* Month Header - clickable */}
                                <div onClick={() => toggleMonth(m.month)} style={{ cursor: 'pointer' }}>
                                    {/* Month title bar */}
                                    <div style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '8px 12px', borderRadius: 10, marginBottom: 10,
                                        background: 'linear-gradient(135deg, #1e293b, #334155)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>{m.month}월</span>
                                            <span style={{ fontSize: 11, color: '#64748b', transition: 'transform 0.2s', display: 'inline-block', transform: openMonths[m.month] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                                        </div>
                                        <span style={{
                                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                                            background: m.profit >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                                            color: m.profit >= 0 ? '#34d399' : '#f87171',
                                        }}>
                                            {m.profit >= 0 ? '흑자' : '적자'} {margin}%
                                        </span>
                                    </div>

                                    {/* 3-col summary - always visible */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                        {[
                                            { label: '매출', value: m.revenue, color: '#475569' },
                                            { label: '지출', value: m.expense, color: '#475569' },
                                            { label: '손익', value: m.profit, color: m.profit >= 0 ? '#059669' : '#dc2626' },
                                        ].map((col, ci) => (
                                            <div key={ci} style={{
                                                textAlign: 'center', padding: '8px 4px',
                                                background: ci === 2 ? (m.profit >= 0 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)') : '#f8fafc',
                                                borderRadius: 10,
                                            }}>
                                                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{col.label}</div>
                                                <div style={{ fontSize: 14, fontWeight: 800, color: col.color, marginTop: 2 }}>{fmtShort(col.value)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Collapsible Detail */}
                                {openMonths[m.month] && (
                                    <div style={{ marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                                        {/* Revenue items */}
                                        {mRevItems.length > 0 && (
                                            <div style={{ marginBottom: 8 }}>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: 0.5, background: '#334155', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>매출 상세</div>
                                                {mRevItems.map((r, ri) => (
                                                    <div key={ri} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '4px 0', fontSize: 12,
                                                    }}>
                                                        <span style={{ color: '#64748b' }}>{r.icon} {r.label}</span>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatNumber(r.value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Expense items */}
                                        {mExpItems.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', marginBottom: 6, letterSpacing: 0.5, background: '#334155', padding: '4px 10px', borderRadius: 6, display: 'inline-block' }}>지출 상세</div>
                                                {mExpItems.map((e, ei) => (
                                                    <div key={ei} style={{
                                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                        padding: '4px 0', fontSize: 12,
                                                    }}>
                                                        <span style={{ color: '#64748b' }}>{e.icon} {e.label}</span>
                                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>{formatNumber(e.value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Mini bar */}
                                <div style={{ display: 'flex', gap: 2, height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
                                    <div style={{ flex: m.revenue, background: '#3b82f6', borderRadius: 2 }} />
                                    <div style={{ flex: m.expense, background: '#f59e0b', borderRadius: 2 }} />
                                </div>
                            </div>
                        );
                    })}
                    {monthSummaries.filter(m => m.revenue > 0 || m.expense > 0).length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>데이터가 없습니다</div>
                    )}
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════════
    // DESKTOP LAYOUT
    // ═══════════════════════════════════════════
    const wideTab = activeTab === 'summary' || activeTab === 'statements';
    return (
        <div className="min-h-screen bg-slate-50">
            <div className={`${wideTab ? 'max-w-screen-2xl' : 'max-w-6xl'} mx-auto px-6 pt-8 pb-32`}>
                {/* Page Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                            <BarChart3 size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold text-slate-800 tracking-tight m-0">손익계산서</h1>
                            <p className="text-xs text-slate-400 mt-0.5">Profit & Loss Statement</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-100 px-4 py-2 rounded-xl">
                        <button onClick={() => setYear(y => y - 1)} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer text-sm transition-colors flex items-center justify-center">◀</button>
                        <span className="text-base font-bold text-slate-700 min-w-[60px] text-center">{year}년</span>
                        <button onClick={() => setYear(y => y + 1)} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 border-none cursor-pointer text-sm transition-colors flex items-center justify-center">▶</button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl flex-wrap">
                    {MAIN_TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`px-5 py-2.5 border-none text-sm font-semibold cursor-pointer rounded-xl transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                                    : 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-700'
                            }`}
                            onClick={() => { setActiveTab(tab.id); setOpenDropdown(null); }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="animate-fadeIn">
                    {activeTab === 'dashboard' && renderDashboard()}
                    {activeTab === 'summary' && renderSummaryTable()}
                    {activeTab === 'statements' && renderStatements()}
                    {activeTab === 'expenses' && renderExpenseDetail()}
                    {activeTab === 'analysis' && renderAnalysis()}
                    {activeTab.startsWith('month_') && renderMonthlyExpense(parseInt(activeTab.split('_')[1]))}
                </div>
            </div>
        </div>
    );
}
