import React from 'react';
import axios from 'axios';
import { formatNumber } from '../../utils/format';
import { PL_REVENUE_FIELDS } from '../../utils/constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export function RevenueDetailView({
    isMobile, plYear, plData, fetchPLData,
    editingCell, setEditingCell, editValue, setEditValue,
}) {
    if (isMobile) {
        return (
            <div className="max-w-6xl mx-auto px-6">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <div className="text-5xl mb-4">🖥️</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">매출요약은 PC에서 확인해주세요</h3>
                    <p className="text-sm text-slate-400">12개월 매트릭스 테이블은 넓은 화면에서 최적화되어 있습니다.</p>
                </div>
            </div>
        );
    }

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
        <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 card-animate">
            <h3 className="text-[15px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-xs text-white">💰</span>
                매출처별 요약 내역
            </h3>
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
            <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                <p className="text-sm text-blue-700 m-0">💡 셀을 클릭하면 직접 수정할 수 있습니다. 비율은 전체 수입 대비 비율입니다.</p>
            </div>
            </div>
        </div>
    );
}
