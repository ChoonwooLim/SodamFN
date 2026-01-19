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

const MONTHS = [7, 8, 9, 10, 11, 12];

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

    useEffect(() => {
        fetchData();
    }, [year]);

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

            <div className="table-container">
                <table className="pl-table">
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
                            <td rowSpan={REVENUE_FIELDS.length + 2}>수입</td>
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
                        <tr className="section-header">
                            <td rowSpan={EXPENSE_FIELDS.length + 2}>지출</td>
                            <td>{EXPENSE_FIELDS[0].label}</td>
                            {MONTHS.map(m => (
                                <td key={m}>{renderCell(m, EXPENSE_FIELDS[0].key, getMonthData(m)[EXPENSE_FIELDS[0].key])}</td>
                            ))}
                            <td className="total">{formatNumber(calcYearTotal(EXPENSE_FIELDS[0].key))}</td>
                            <td className="average">{formatNumber(calcYearAverage(EXPENSE_FIELDS[0].key))}</td>
                        </tr>
                        {EXPENSE_FIELDS.slice(1).map(field => (
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
        </div>
    );
}
