import { useState, useEffect } from 'react';
import axios from 'axios';
import './ProfitLoss.css';

const API_URL = 'http://localhost:8000';

const REVENUE_FIELDS = [
    { key: 'revenue_store', label: '매장매출' },
    { key: 'revenue_coupang', label: '쿠팡 정산금' },
    { key: 'revenue_baemin', label: '배민 정산금' },
    { key: 'revenue_yogiyo', label: '요기요 정산금' },
    { key: 'revenue_ddangyo', label: '땡겨요 정산금' },
];

const EXPENSE_FIELDS = [
    { key: 'expense_labor', label: '인건비' },
    { key: 'expense_rent', label: '임대관리비' },
    { key: 'expense_utility', label: '제세공과금' },
    { key: 'expense_vat', label: '부가가치세' },
    { key: 'expense_biz_tax', label: '사업소득세' },
    { key: 'expense_income_tax', label: '근로소득세' },
    { key: 'expense_card_fee', label: '카드수수료' },
    { key: 'expense_material', label: '재료비' },
    { key: 'expense_retirement', label: '퇴직금적립' },
];

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

// Main tabs (always visible)
const MAIN_TABS = [
    { id: 'summary', label: '📊 손익계산서' },
    { id: 'expenses', label: '💰 세부지출' },
    { id: 'revenue', label: '💵 수입상세' },
    { id: 'analysis', label: '📈 월별분석' },
];

// Delivery app group
const DELIVERY_TABS = [
    { id: 'coupang', label: '쿠팡이츠' },
    { id: 'baemin', label: '배달의민족' },
    { id: 'yogiyo', label: '요기요' },
    { id: 'ddangyo', label: '땡겨요' },
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
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [year, setYear] = useState(2025);
    const [activeTab, setActiveTab] = useState('summary');

    // Dropdown group state
    const [openDropdown, setOpenDropdown] = useState(null); // 'delivery' or 'monthly'

    // Delivery app data
    const [deliveryData, setDeliveryData] = useState({});
    // Monthly expense data
    const [monthlyExpenses, setMonthlyExpenses] = useState({});

    useEffect(() => {
        fetchData();
    }, [year]);

    useEffect(() => {
        // Fetch delivery data when switching to delivery tabs
        if (['coupang', 'baemin', 'yogiyo', 'ddangyo'].includes(activeTab)) {
            fetchDeliveryData(activeTab);
        }
        // Fetch monthly expense data
        if (activeTab.startsWith('month_')) {
            const month = parseInt(activeTab.split('_')[1]);
            fetchMonthlyExpenses(month);
        }
    }, [activeTab, year]);

    const fetchData = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/profitloss/monthly?year=${year}`);
            setData(res.data);
        } catch (err) {
            console.error('Error fetching P/L data:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDeliveryData = async (channel) => {
        try {
            const channelMap = { coupang: 'Coupang', baemin: 'Baemin', yogiyo: 'Yogiyo', ddangyo: 'Ddangyo' };
            const res = await axios.get(`${API_URL}/api/profitloss/delivery/${channelMap[channel]}/${year}`);
            setDeliveryData(prev => ({ ...prev, [channel]: res.data }));
        } catch (err) {
            console.error('Error fetching delivery data:', err);
        }
    };

    const fetchMonthlyExpenses = async (month) => {
        try {
            const res = await axios.get(`${API_URL}/api/profitloss/expenses/${year}/${month}`);
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
                await axios.put(`${API_URL}/api/profitloss/monthly/${monthData.id}`, {
                    [field]: parseInt(editValue) || 0
                });
            } else {
                // Create new
                await axios.post(`${API_URL}/api/profitloss/monthly`, {
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

    const calcYearAverage = (field) => {
        const total = calcYearTotal(field);
        return Math.round(total / 6);
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
                            <td className="average"><strong>{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalExpense(d), 0) / 6))}</strong></td>
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

    // Render revenue detail table
    const renderRevenueDetail = () => (
        <div className="revenue-detail-section">
            <h3 className="section-title">💰 수입 상세 내역</h3>
            <div className="table-container">
                <table className="pl-table revenue-table">
                    <thead>
                        <tr>
                            <th>수입 항목</th>
                            {MONTHS.map(m => <th key={m}>{m}월</th>)}
                            <th>합계</th>
                            <th>월평균</th>
                            <th>비율</th>
                        </tr>
                    </thead>
                    <tbody>
                        {REVENUE_FIELDS.map(field => {
                            const yearTotal = calcYearTotal(field.key);
                            const totalRevenue = data.reduce((s, d) => s + calcTotalRevenue(d), 0);
                            const percentage = totalRevenue > 0 ? ((yearTotal / totalRevenue) * 100).toFixed(1) : 0;
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
                                <td key={m} className="subtotal">{formatNumber(calcTotalRevenue(getMonthData(m)))}</td>
                            ))}
                            <td className="total"><strong>{formatNumber(data.reduce((s, d) => s + calcTotalRevenue(d), 0))}</strong></td>
                            <td className="average"><strong>{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalRevenue(d), 0) / 6))}</strong></td>
                            <td className="percentage">100%</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="instructions">
                <p>💡 셀을 클릭하면 직접 수정할 수 있습니다. 비율은 전체 수입 대비 비율입니다.</p>
            </div>
        </div>
    );

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
                        <div className="card-avg">월평균 {formatNumber(Math.round(totalRevenue / 6))}원</div>
                    </div>
                    <div className="summary-card expense-card">
                        <div className="card-label">총 지출</div>
                        <div className="card-value">{formatNumber(totalExpense)}원</div>
                        <div className="card-avg">월평균 {formatNumber(Math.round(totalExpense / 6))}원</div>
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

    // Render delivery app revenue (쿠팡, 배민, 요기요, 땡겨요)
    const renderDeliveryRevenue = (channel) => {
        const channelNames = {
            coupang: '쿠팡이츠',
            baemin: '배달의민족',
            yogiyo: '요기요',
            ddangyo: '땡겨요'
        };
        const revenueData = deliveryData[channel] || [];

        // Group by month
        const monthlyData = {};
        MONTHS.forEach(m => { monthlyData[m] = []; });
        revenueData.forEach(item => {
            const month = new Date(item.date).getMonth() + 1;
            if (monthlyData[month]) {
                monthlyData[month].push(item);
            }
        });

        // Calculate monthly totals
        const monthlyTotals = {};
        MONTHS.forEach(m => {
            monthlyTotals[m] = monthlyData[m].reduce((sum, item) => sum + item.amount, 0);
        });
        const grandTotal = Object.values(monthlyTotals).reduce((sum, t) => sum + t, 0);

        return (
            <div className="delivery-section">
                <h3 className="section-title">🛵 {channelNames[channel]} 정산 내역</h3>
                <div className="table-container">
                    <table className="pl-table">
                        <thead>
                            <tr>
                                <th>월</th>
                                <th>입금 내역</th>
                                <th>월 합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MONTHS.map(m => (
                                <tr key={m}>
                                    <td className="month-cell">{m}월</td>
                                    <td className="detail-cell">
                                        {monthlyData[m].length > 0 ? (
                                            <div className="deposit-list">
                                                {monthlyData[m].map((item, idx) => (
                                                    <div key={item.id || idx} className="deposit-item">
                                                        <span className="deposit-date">{new Date(item.date).getDate()}일</span>
                                                        <span className="deposit-amount">{formatNumber(item.amount)}원</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="no-data">-</span>
                                        )}
                                    </td>
                                    <td className="total">{formatNumber(monthlyTotals[m])}</td>
                                </tr>
                            ))}
                            <tr className="subtotal-row">
                                <td colSpan="2"><strong>총 합계</strong></td>
                                <td className="total"><strong>{formatNumber(grandTotal)}원</strong></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div className="instructions">
                    <p>💡 정산금 데이터는 손익계산서의 "{channelNames[channel]} 정산금" 항목과 연동됩니다.</p>
                </div>
            </div>
        );
    };

    // Render monthly expense detail (7~12월 비용) - Excel-like grid
    const renderMonthlyExpense = (month) => {
        const expenses = monthlyExpenses[month] || [];

        // Get days in month
        const daysInMonth = new Date(year, month, 0).getDate();
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        // Create grid data structure: vendorName -> { day: amount, items: {day: id} }
        const vendorGrid = {};
        expenses.forEach(item => {
            const day = new Date(item.date).getDate();
            if (!vendorGrid[item.vendor_name]) {
                vendorGrid[item.vendor_name] = { amounts: {}, ids: {} };
            }
            // Accumulate if multiple entries on same day (shouldn't happen normally)
            vendorGrid[item.vendor_name].amounts[day] = (vendorGrid[item.vendor_name].amounts[day] || 0) + item.amount;
            vendorGrid[item.vendor_name].ids[day] = item.id;
        });

        const vendors = Object.keys(vendorGrid).sort();

        // Calculate row totals (per vendor)
        const vendorTotals = {};
        vendors.forEach(v => {
            vendorTotals[v] = Object.values(vendorGrid[v].amounts).reduce((sum, amt) => sum + amt, 0);
        });

        // Calculate column totals (per day)
        const dayTotals = {};
        days.forEach(d => {
            dayTotals[d] = vendors.reduce((sum, v) => sum + (vendorGrid[v].amounts[d] || 0), 0);
        });

        const grandTotal = Object.values(vendorTotals).reduce((sum, t) => sum + t, 0);

        // Handle expense cell editing
        const handleExpenseCellClick = (vendor, day, amount, expenseId) => {
            setEditingCell({ type: 'expense', month, vendor, day, id: expenseId });
            setEditValue(amount?.toString() || '0');
        };

        const handleExpenseSave = async () => {
            if (!editingCell || editingCell.type !== 'expense') return;

            const { month: m, vendor, day, id } = editingCell;
            const amount = parseInt(editValue) || 0;
            const date = new Date(year, m - 1, day).toISOString().split('T')[0];

            try {
                if (id && amount > 0) {
                    // Update existing
                    await axios.put(`${API_URL}/api/profitloss/expenses/${id}`, {
                        date, vendor_name: vendor, amount
                    });
                } else if (!id && amount > 0) {
                    // Create new
                    await axios.post(`${API_URL}/api/profitloss/expenses`, {
                        date, vendor_name: vendor, amount
                    });
                } else if (id && amount === 0) {
                    // Delete if amount is 0
                    await axios.delete(`${API_URL}/api/profitloss/expenses/${id}`);
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

        return (
            <div className="monthly-expense-section">
                <h3 className="section-title">📅 {month}월 비용 상세</h3>
                <div className="expense-summary">
                    <div className="expense-stat">
                        <span className="stat-label">거래처 수</span>
                        <span className="stat-value">{vendors.length}개</span>
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

                <div className="grid-table-container">
                    <table className="expense-grid-table">
                        <thead>
                            <tr>
                                <th className="vendor-header">거래처</th>
                                {days.map(d => (
                                    <th key={d} className="day-header">{d}</th>
                                ))}
                                <th className="total-header">합계</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vendors.length > 0 ? vendors.map(vendor => (
                                <tr key={vendor}>
                                    <td className="vendor-cell">{vendor}</td>
                                    {days.map(d => (
                                        <td key={d} className="amount-cell">
                                            {renderExpenseCell(vendor, d)}
                                        </td>
                                    ))}
                                    <td className="row-total">{formatNumber(vendorTotals[vendor])}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={daysInMonth + 2} className="no-data-row">
                                        {month}월 비용 데이터가 없습니다. 위에 거래처를 추가하세요.
                                    </td>
                                </tr>
                            )}
                            {vendors.length > 0 && (
                                <tr className="day-totals-row">
                                    <td className="vendor-cell"><strong>일별 합계</strong></td>
                                    {days.map(d => (
                                        <td key={d} className="day-total">
                                            {dayTotals[d] > 0 ? formatNumber(dayTotals[d]) : '-'}
                                        </td>
                                    ))}
                                    <td className="grand-total">{formatNumber(grandTotal)}</td>
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
                        <col style={{ width: '40px' }} />
                        <col style={{ width: '160px' }} />
                        {MONTHS.map(m => <col key={m} style={{ width: 'calc((100% - 200px) / 14)' }} />)}
                        <col style={{ width: 'calc((100% - 200px) / 14)' }} />
                        <col style={{ width: 'calc((100% - 200px) / 14)' }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th colSpan="2">소담김밥 월별손익계산서_{year} 하반기</th>
                            {MONTHS.map(m => <th key={m}>{m}월</th>)}
                            <th>합계</th>
                            <th>월평균</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Revenue Section */}
                        <tr className="section-header">
                            <td rowSpan={REVENUE_FIELDS.length + 1}>수입</td>
                            <td>{REVENUE_FIELDS[0].label}</td>
                            {MONTHS.map(m => (
                                <td key={m}>{renderCell(m, REVENUE_FIELDS[0].key, getMonthData(m)[REVENUE_FIELDS[0].key])}</td>
                            ))}
                            <td className="total">{formatNumber(calcYearTotal(REVENUE_FIELDS[0].key))}</td>
                            <td className="average">{formatNumber(calcYearAverage(REVENUE_FIELDS[0].key))}</td>
                        </tr>
                        {REVENUE_FIELDS.slice(1).map(field => (
                            <tr key={field.key}>
                                <td>{field.label}</td>
                                {MONTHS.map(m => (
                                    <td key={m}>{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                ))}
                                <td className="total">{formatNumber(calcYearTotal(field.key))}</td>
                                <td className="average">{formatNumber(calcYearAverage(field.key))}</td>
                            </tr>
                        ))}
                        <tr className="subtotal-row">
                            <td>합계</td>
                            {MONTHS.map(m => (
                                <td key={m} className="subtotal">{formatNumber(calcTotalRevenue(getMonthData(m)))}</td>
                            ))}
                            <td className="total">{formatNumber(data.reduce((s, d) => s + calcTotalRevenue(d), 0))}</td>
                            <td className="average">{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalRevenue(d), 0) / 6))}</td>
                        </tr>

                        {/* Expense Section */}
                        <tr className="section-header expense-section-header">
                            <td rowSpan={EXPENSE_FIELDS.length + 1}>지출</td>
                            <td>{EXPENSE_FIELDS[0].label}</td>
                            {MONTHS.map(m => (
                                <td key={m}>{renderCell(m, EXPENSE_FIELDS[0].key, getMonthData(m)[EXPENSE_FIELDS[0].key])}</td>
                            ))}
                            <td className="total">{formatNumber(calcYearTotal(EXPENSE_FIELDS[0].key))}</td>
                            <td className="average">{formatNumber(calcYearAverage(EXPENSE_FIELDS[0].key))}</td>
                        </tr>
                        {EXPENSE_FIELDS.slice(1).map(field => (
                            <tr key={field.key} className="expense-row">
                                <td>{field.label}</td>
                                {MONTHS.map(m => (
                                    <td key={m}>{renderCell(m, field.key, getMonthData(m)[field.key])}</td>
                                ))}
                                <td className="total">{formatNumber(calcYearTotal(field.key))}</td>
                                <td className="average">{formatNumber(calcYearAverage(field.key))}</td>
                            </tr>
                        ))}
                        <tr className="subtotal-row">
                            <td>합계</td>
                            {MONTHS.map(m => (
                                <td key={m} className="subtotal">{formatNumber(calcTotalExpense(getMonthData(m)))}</td>
                            ))}
                            <td className="total">{formatNumber(data.reduce((s, d) => s + calcTotalExpense(d), 0))}</td>
                            <td className="average">{formatNumber(Math.round(data.reduce((s, d) => s + calcTotalExpense(d), 0) / 6))}</td>
                        </tr>

                        {/* Profit Row */}
                        <tr className="profit-row">
                            <td colSpan="2">영업이익</td>
                            {MONTHS.map(m => (
                                <td key={m} className={calcProfit(getMonthData(m)) >= 0 ? 'profit-positive' : 'profit-negative'}>
                                    {formatNumber(calcProfit(getMonthData(m)))}
                                </td>
                            ))}
                            <td className="total profit-positive">
                                {formatNumber(data.reduce((s, d) => s + calcProfit(d), 0))}
                            </td>
                            <td className="average profit-positive">
                                {formatNumber(Math.round(data.reduce((s, d) => s + calcProfit(d), 0) / 6))}
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

                {/* Delivery Apps Dropdown */}
                <div className="tab-dropdown">
                    <button
                        className={`tab-button dropdown-trigger ${DELIVERY_TABS.some(t => t.id === activeTab) ? 'active' : ''}`}
                        onClick={() => setOpenDropdown(openDropdown === 'delivery' ? null : 'delivery')}
                    >
                        🛵 배달앱 ▾
                    </button>
                    {openDropdown === 'delivery' && (
                        <div className="dropdown-menu">
                            {DELIVERY_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`dropdown-item ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => { setActiveTab(tab.id); setOpenDropdown(null); }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Monthly Expenses Dropdown */}
                <div className="tab-dropdown">
                    <button
                        className={`tab-button dropdown-trigger ${activeTab.startsWith('month_') ? 'active' : ''}`}
                        onClick={() => setOpenDropdown(openDropdown === 'monthly' ? null : 'monthly')}
                    >
                        📅 월별비용 ▾
                    </button>
                    {openDropdown === 'monthly' && (
                        <div className="dropdown-menu month-dropdown">
                            {MONTH_TABS.map(tab => (
                                <button
                                    key={tab.id}
                                    className={`dropdown-item ${activeTab === tab.id ? 'active' : ''}`}
                                    onClick={() => { setActiveTab(tab.id); setOpenDropdown(null); }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content">
                {activeTab === 'summary' && renderSummaryTable()}
                {activeTab === 'expenses' && renderExpenseDetail()}
                {activeTab === 'revenue' && renderRevenueDetail()}
                {activeTab === 'analysis' && renderAnalysis()}
                {activeTab === 'coupang' && renderDeliveryRevenue('coupang')}
                {activeTab === 'baemin' && renderDeliveryRevenue('baemin')}
                {activeTab === 'yogiyo' && renderDeliveryRevenue('yogiyo')}
                {activeTab === 'ddangyo' && renderDeliveryRevenue('ddangyo')}
                {activeTab.startsWith('month_') && renderMonthlyExpense(parseInt(activeTab.split('_')[1]))}
            </div>
        </div>
    );
}
