import React, { useState } from 'react';
import { formatNumber } from '../../utils/format';
import { REVENUE_CATEGORIES } from '../../utils/constants';

export function GridView({
    year, month, loading, isMobile,
    data, vendors, tab, deliveryRatios,
    fetchData, getDisplayName,
    // Grid cell editing via parent
    editingCell, setEditingCell, editValue, setEditValue, handleGridSave,
}) {
    const [hideEmpty, setHideEmpty] = useState(false);

    const daysInMonth = new Date(year, month, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    // Build vendor grid
    const vendorGrid = {};
    const dataForGrid = tab === 'all' ? data
        : (tab === 'cash' || tab === 'card') ? data.filter(d => d.ui_category === tab)
            : data.filter(d => d.ui_category === tab || d.category === tab);

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

    const filteredData = tab === 'all' ? data : data.filter(d => d.ui_category === tab);

    // Grid cell click
    const handleGridCellClick = (vendorId, day, amount, expenseId) => {
        setEditingCell({ vendorId, day, id: expenseId });
        setEditValue(amount?.toString() || '0');
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

    // Render category group in grid
    const renderGridCategoryGroup = (catId, label, icon) => {
        const groupVendors = groupedVendorsGrid[catId] || [];
        if (groupVendors.length === 0) return null;

        const isDelivery = catId === 'delivery';
        const calcGroupDayTotal = (d) => groupVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
        const calcGroupTotal = () => groupVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);

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
                {groupVendors.map(v => (
                    <React.Fragment key={v.id}>
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
                <tr className="grid-subtotal-row">
                    <td className="grid-subtotal-label">↳ {isDelivery ? '매출 합계' : tab === 'cash' ? '현금매출 소계' : tab === 'card' ? '카드매출 소계' : `${label} 소계`}</td>
                    {days.map(d => (
                        <td key={d} className="grid-subtotal-cell">
                            {calcGroupDayTotal(d) > 0 ? formatNumber(calcGroupDayTotal(d)) : '-'}
                        </td>
                    ))}
                    <td className="grid-subtotal-total">{formatNumber(calcGroupTotal())}</td>
                </tr>
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

    if (isMobile) {
        return (
            <div className="max-w-6xl mx-auto px-6">
                <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
                    <div className="text-5xl mb-4">🖥️</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">월별 상세 내역은 PC에서 확인해주세요</h3>
                    <p className="text-sm text-slate-400">31일 × 거래처 그리드는 넓은 화면에서 최적화되어 있습니다.<br />📋 리스트 탭에서 데이터를 확인하실 수 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto px-6">
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-4 card-animate">
                <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                    <div className="grid grid-cols-3 gap-3 flex-1">
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">거래처 수</div>
                            <div className="text-lg font-extrabold text-slate-800">{displayVendors.length}개
                                {hideEmpty && emptyVendorCount > 0 && <span className="text-xs text-slate-400 font-medium"> (+{emptyVendorCount} 숨김)</span>}
                            </div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[11px] text-slate-400 font-semibold">거래 건수</div>
                            <div className="text-lg font-extrabold text-slate-800">{filteredData.length}건</div>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                            <div className="text-[11px] text-blue-400 font-semibold">총 매출</div>
                            <div className="text-lg font-extrabold text-blue-600">{formatNumber(gridGrandTotal)}원</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 font-medium">
                            <input type="checkbox" checked={hideEmpty} onChange={e => setHideEmpty(e.target.checked)} className="w-4 h-4 accent-blue-600 cursor-pointer" />
                            <span>빈 거래처 숨기기 ({emptyVendorCount}개)</span>
                        </label>
                        <a href="/vendor-settings" className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded-lg text-xs font-semibold hover:bg-blue-600 transition-colors no-underline">⚙️ 거래처 관리</a>
                    </div>
                </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
                    <p className="text-slate-400 text-sm">불러오는 중...</p>
                </div>
            ) : displayVendors.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1">매출 거래처가 없습니다</h3>
                    <p className="text-sm text-slate-400"><a href="/vendor-settings" className="text-blue-500 hover:underline">거래처 관리</a>에서 매출처를 추가하세요.</p>
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
                                        const delVendors = DELIVERY_CATS.flatMap(c => groupedVendorsGrid[c.id] || []);
                                        const daySales = delVendors.reduce((sum, v) => sum + (vendorGrid[v.id]?.amounts[d] || 0), 0);
                                        const VENDOR_CHANNEL_MAP = {'쿠팡': '쿠팡', '쿠팡이츠': '쿠팡', '배달의민족': '배민', '배민': '배민', '요기요': '요기요', '땡겨요': '땡겨요'};
                                        const daySettlement = delVendors.reduce((sum, v) => {
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
                                            const delVendors = DELIVERY_CATS.flatMap(c => groupedVendorsGrid[c.id] || []);
                                            const totalSales = delVendors.reduce((sum, v) => sum + (vendorTotals[v.id] || 0), 0);
                                            const VENDOR_CHANNEL_MAP = {'쿠팡': '쿠팡', '쿠팡이츠': '쿠팡', '배달의민족': '배민', '배민': '배민', '요기요': '요기요', '땡겨요': '땡겨요'};
                                            const totalSettlement = delVendors.reduce((sum, v) => {
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

            <div className="mt-4 px-4 py-3 bg-blue-50 rounded-xl border-l-4 border-blue-500">
                <p className="text-sm text-blue-700 m-0">💡 셀을 클릭하면 금액을 직접 입력/수정할 수 있습니다. Enter로 저장, Esc로 취소</p>
            </div>
            </div>
        </div>
    );
}
