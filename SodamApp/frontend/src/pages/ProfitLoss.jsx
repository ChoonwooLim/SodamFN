import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { useIsMobile } from '../hooks/useMediaQuery';
import './ProfitLoss.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'; // Keep for now if needed, but api client handles base URL

const REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출', group: 'revenue-store' },
    { key: 'revenue_coupang', label: '쿠팡 정산금', group: 'revenue-delivery' },
    { key: 'revenue_baemin', label: '배민 정산금', group: 'revenue-delivery' },
    { key: 'revenue_yogiyo', label: '요기요 정산금', group: 'revenue-delivery' },
    { key: 'revenue_ddangyo', label: '땡겨요 정산금', group: 'revenue-delivery' },
];

const EXPENSE_FIELDS = [
    { key: 'expense_labor', label: '인건비', auto: true, group: 'expense-labor' },
    { key: 'expense_retirement', label: '퇴직금적립', auto: true, group: 'expense-labor' },
    { key: 'expense_insurance', label: '4대보험료(사업주)', group: 'expense-labor' },
    { key: 'expense_insurance_employee', label: '4대보험료(직원)', auto: true, group: 'expense-labor' },
    { key: 'expense_tax_employee', label: '원천세(직원)', auto: true, group: 'expense-labor' },
    { key: 'expense_ingredient', label: '원재료비', group: 'expense-material' },
    { key: 'expense_material', label: '소모품비', group: 'expense-material' },
    { key: 'expense_utility', label: '수도광열비', group: 'expense-utility' },
    { key: 'expense_rent', label: '임차료', group: 'expense-rent' },
    { key: 'expense_repair', label: '수선비', group: 'expense-facility' },
    { key: 'expense_depreciation', label: '감가상각비', group: 'expense-facility' },
    { key: 'expense_tax', label: '세금과공과', group: 'expense-tax' },
    { key: 'expense_card_fee', label: '카드수수료', group: 'expense-etc' },
    { key: 'expense_other', label: '기타경비', group: 'expense-etc' },
];

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// 매입처 카테고리 정의 (VendorSettings.jsx와 동기화)
// Note: 인건비는 Payroll에서 자동 동기화, 퇴직금적립은 인건비×10% 자동계산
const EXPENSE_CATEGORIES = [
    { id: '원재료비', label: '원재료비', icon: '🥬' },
    { id: '소모품비', label: '소모품비', icon: '📦' },
    { id: '수도광열비', label: '수도광열비', icon: '💡' },
    { id: '임차료', label: '임차료', icon: '🏠' },
    { id: '수선비', label: '수선비', icon: '🔧' },
    { id: '감가상각비', label: '감가상각비', icon: '⚙️' },
    { id: '세금과공과', label: '세금과공과', icon: '🏛️' },
    { id: '보험료', label: '보험료', icon: '🛡️' },
    { id: '인건비', label: '인건비', icon: '👷' },
    { id: '카드수수료', label: '카드수수료', icon: '💳' },
    { id: '기타경비', label: '기타경비', icon: '📋' },
];

// Main tabs (always visible) — 수입상세/배달앱은 매출관리로 이동
const MAIN_TABS = [
    { id: 'dashboard', label: '🏠 대시보드' },
    { id: 'summary', label: '📊 손익계산서' },
    { id: 'expenses', label: '💰 세부지출' },
    { id: 'analysis', label: '📈 월별분석' },
];

// Monthly expense group (1-12)
const MONTH_TABS = Array.from({ length: 12 }, (_, i) => ({
    id: `month_${i + 1}`,
    label: `${i + 1}월`
}));

function formatNumber(num) {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString();
}

export default function ProfitLoss() {
    const isMobile = useIsMobile();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('dashboard');
    const businessName = localStorage.getItem('business_name') || '소담김밥';

    // Dropdown group state
    const [openDropdown, setOpenDropdown] = useState(null); // 'monthly'

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

    const calcTotalExpense = (monthData) => {
        return EXPENSE_FIELDS.reduce((sum, f) => sum + (monthData[f.key] || 0), 0);
    };

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
            const hasExpense = EXPENSE_FIELDS.some(f => (md[f.key] || 0) !== 0);
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

    if (loading) return <div className="loading">로딩 중...</div>;

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

        // Expense breakdown by category
        const expenseBreakdown = EXPENSE_FIELDS.map(f => {
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
            'expense_other': '#94a3b8',
        };

        return (
            <div className="pl-dashboard">
                {/* Key Metric Cards */}
                <div className="pl-dash-cards">
                    <div className="pl-dash-card revenue">
                        <div className="pl-dash-card-icon">💰</div>
                        <div className="pl-dash-card-content">
                            <span className="pl-dash-card-label">전월 매출</span>
                            <span className="pl-dash-card-value">{formatNumber(prevRevenue)}원</span>
                        </div>
                    </div>
                    <div className="pl-dash-card expense">
                        <div className="pl-dash-card-icon">📤</div>
                        <div className="pl-dash-card-content">
                            <span className="pl-dash-card-label">전월 지출</span>
                            <span className="pl-dash-card-value">{formatNumber(prevExpense)}원</span>
                        </div>
                    </div>
                    <div className="pl-dash-card profit">
                        <div className="pl-dash-card-icon">{prevProfit >= 0 ? '📈' : '📉'}</div>
                        <div className="pl-dash-card-content">
                            <span className="pl-dash-card-label">전월 순이익</span>
                            <span className={`pl-dash-card-value ${prevProfit >= 0 ? 'positive' : 'negative'}`}>
                                {formatNumber(prevProfit)}원
                            </span>
                        </div>
                    </div>
                    <div className="pl-dash-card margin">
                        <div className="pl-dash-card-icon">🎯</div>
                        <div className="pl-dash-card-content">
                            <span className="pl-dash-card-label">전월 마진율</span>
                            <span className={`pl-dash-card-value ${Number(prevMargin) >= 0 ? 'positive' : 'negative'}`}>
                                {prevMargin}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* Annual Summary */}
                <div className="pl-dash-section">
                    <h3>📅 {year}년 연간 요약</h3>
                    <div className="pl-annual-summary">
                        <div className="pl-annual-item">
                            <span className="label">총 매출</span>
                            <span className="value">{formatNumber(yearRevenue)}원</span>
                        </div>
                        <div className="pl-annual-item">
                            <span className="label">총 지출</span>
                            <span className="value expense">{formatNumber(yearExpense)}원</span>
                        </div>
                        <div className="pl-annual-item highlight">
                            <span className="label">총 순이익</span>
                            <span className={`value ${yearProfit >= 0 ? 'positive' : 'negative'}`}>{formatNumber(yearProfit)}원</span>
                        </div>
                        <div className="pl-annual-item">
                            <span className="label">연간 마진율</span>
                            <span className={`value ${Number(yearMargin) >= 0 ? 'positive' : 'negative'}`}>{yearMargin}%</span>
                        </div>
                    </div>
                </div>

                {/* Monthly Trend */}
                <div className="pl-dash-section">
                    <h3>📊 월별 매출/지출 추이</h3>
                    {activeMonths.length > 0 ? (
                        <div className="pl-monthly-chart">
                            {monthSummaries.map(m => (
                                <div className="pl-month-col" key={m.month}>
                                    <div className="pl-month-bars">
                                        <div
                                            className="pl-bar revenue"
                                            style={{ height: `${(m.revenue / maxMonthValue) * 100}%` }}
                                            title={`매출 ${formatNumber(m.revenue)}`}
                                        />
                                        <div
                                            className="pl-bar expense"
                                            style={{ height: `${(m.expense / maxMonthValue) * 100}%` }}
                                            title={`지출 ${formatNumber(m.expense)}`}
                                        />
                                    </div>
                                    <span className="pl-month-label">{m.month}월</span>
                                    {m.profit !== 0 && (
                                        <span className={`pl-month-profit ${m.profit >= 0 ? 'positive' : 'negative'}`}>
                                            {m.profit >= 0 ? '+' : ''}{(m.profit / 10000).toFixed(0)}만
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: '#9ca3af', padding: 24, textAlign: 'center' }}>데이터가 없습니다</div>
                    )}
                    <div className="pl-chart-legend">
                        <span><span className="legend-dot" style={{ background: '#3b82f6' }} />매출</span>
                        <span><span className="legend-dot" style={{ background: '#ef4444' }} />지출</span>
                    </div>
                </div>

                {/* Expense Breakdown */}
                <div className="pl-dash-section">
                    <h3>💸 지출 항목별 비중 (연간)</h3>
                    <div className="pl-expense-breakdown">
                        {expenseBreakdown.map(e => {
                            const pct = yearExpense > 0 ? ((e.total / yearExpense) * 100).toFixed(1) : '0.0';
                            const cat = EXPENSE_CATEGORIES.find(c => e.label === c.label);
                            const color = EXPENSE_COLORS[e.key] || '#94a3b8';
                            return (
                                <div className="pl-expense-bar-item" key={e.key}>
                                    <div className="bar-label">
                                        <span>{cat?.icon || '📋'} {e.label}</span>
                                        <span className="bar-amount">{formatNumber(e.total)}원 ({pct}%)</span>
                                    </div>
                                    <div className="bar-track">
                                        <div className="bar-fill" style={{ width: `${(e.total / maxExpense) * 100}%`, background: color }} />
                                    </div>
                                </div>
                            );
                        })}
                        {expenseBreakdown.length === 0 && (
                            <div style={{ color: '#9ca3af', padding: 24, textAlign: 'center' }}>지출 데이터가 없습니다</div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Render expense detail table
    const renderExpenseDetail = () => (
        <div className="expense-detail-section">
            <h3 className="section-title">📊 세부지출 내역서</h3>
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
                        {EXPENSE_FIELDS.map(field => {
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
            <div className="instructions">
                <p>💡 셀을 클릭하면 직접 수정할 수 있습니다. 비율은 전체 지출 대비 비율입니다.</p>
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

        return (
            <div className="analysis-section">
                <h3 className="section-title">📈 월별 분석</h3>

                <div className="summary-cards">
                    <div className="summary-card revenue-card">
                        <div className="card-label">총 수입</div>
                        <div className="card-value">{formatNumber(totalRevenue)}원</div>
                        <div className="card-avg">월평균 {formatNumber(Math.round(totalRevenue / activeMonthCount))}원</div>
                    </div>
                    <div className="summary-card expense-card">
                        <div className="card-label">총 지출</div>
                        <div className="card-value">{formatNumber(totalExpense)}원</div>
                        <div className="card-avg">월평균 {formatNumber(Math.round(totalExpense / activeMonthCount))}원</div>
                    </div>
                    <div className="summary-card profit-card">
                        <div className="card-label">순수익</div>
                        <div className="card-value">{formatNumber(totalProfit)}원</div>
                        <div className="card-avg">수익률 {profitMargin}%</div>
                    </div>
                </div>

                <div className="monthly-chart">
                    <h4>월별 손익 추이</h4>
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
                                <td>손익</td>
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
            <div className="monthly-expense-section">
                <div className="sticky-summary-header">
                    <h3 className="section-title">📅 {month}월 비용 상세</h3>
                    <div className="expense-summary">
                        <div className="expense-stat">
                            <span className="stat-label">거래처 수</span>
                            <span className="stat-value">{displayVendors.length}개 {hideEmptyVendors && emptyVendorCount > 0 && <small>(+{emptyVendorCount} 숨김)</small>}</span>
                        </div>
                        <div className="expense-stat">
                            <span className="stat-label">거래 건수</span>
                            <span className="stat-value">{expenses.length}건</span>
                        </div>
                        <div className="expense-stat">
                            <span className="stat-label">총 지출</span>
                            <span className="stat-value highlight">{formatNumber(grandTotal)}원</span>
                        </div>
                    </div>

                    <div className="vendor-controls-banner">
                        <div className="hide-empty-toggle">
                            <label className="toggle-label">
                                <input
                                    type="checkbox"
                                    checked={hideEmptyVendors}
                                    onChange={(e) => setHideEmptyVendors(e.target.checked)}
                                />
                                <span>빈 거래처 숨기기 ({emptyVendorCount}개)</span>
                            </label>
                        </div>
                        <div className="vendor-settings-link-container">
                            <span>💡 거래처 추가/삭제/순서변경은</span>
                            <a href="/vendor-settings" className="vendor-settings-link">⚙️ 거래처 관리</a>
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

                <div className="instructions">
                    <p>💡 셀을 클릭하면 금액을 직접 입력/수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
                </div>
            </div>
        );
    };

    // Render the summary table (existing)
    const renderSummaryTable = () => (
        <>
            <div className="table-container">
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
                            <th colSpan="2">{businessName} 월별손익계산서_{year} 하반기</th>
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

                        {/* Expense Section */}
                        <tr className={`section-header expense-section-header ${EXPENSE_FIELDS[0].group}`}>
                            <td className="pl-section-label" rowSpan={EXPENSE_FIELDS.length + 1}>지출</td>
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
                                <td key={m} className="pl-data">{formatNumber(calcTotalExpense(getMonthData(m)))}</td>
                            ))}
                            <td className="pl-data total">{formatNumber(data.reduce((s, d) => s + calcTotalExpense(d), 0))}</td>
                            <td className="pl-data average">{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalExpense(d), 0) / activeMonthCount))}</td>
                        </tr>

                        {/* Profit Row */}
                        <tr className="profit-row">
                            <td className="pl-section-label" colSpan="2">영업이익</td>
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
            <div className="instructions">
                <p>💡 셀을 클릭하면 직접 수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
            </div>
        </>
    );

    return (
        <div className="profitloss-page">
            <div className="page-header">
                <h1>손익계산서</h1>
                <div className="year-selector">
                    <button onClick={() => setYear(y => y - 1)}>◀</button>
                    <span>{year}년</span>
                    <button onClick={() => setYear(y => y + 1)}>▶</button>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="tab-navigation">
                {/* Main Tabs */}
                {MAIN_TABS.map(tab => (
                    <button
                        key={tab.id}
                        className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => { setActiveTab(tab.id); setOpenDropdown(null); }}
                    >
                        {tab.label}
                    </button>
                ))}


            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'dashboard' && renderDashboard()}
                {isMobile && activeTab !== 'dashboard' ? (
                    <div className="desktop-only-notice" style={{ textAlign: 'center', padding: '48px 24px', color: '#64748b' }}>
                        <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#475569', margin: '0 0 8px' }}>이 뷰는 PC에서 확인해주세요</h3>
                        <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0 }}>
                            12개월 매트릭스 테이블은 넓은 화면에서 최적화되어 있습니다.
                        </p>
                    </div>
                ) : (
                    <>
                        {activeTab === 'summary' && renderSummaryTable()}
                        {activeTab === 'expenses' && renderExpenseDetail()}
                        {activeTab === 'analysis' && renderAnalysis()}
                        {activeTab.startsWith('month_') && renderMonthlyExpense(parseInt(activeTab.split('_')[1]))}
                    </>
                )}
            </div>
        </div>
    );
}
