import React, { useState } from 'react';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { formatNumber, getWeekday } from '../../utils/format';

export function ListView({
    year, month, loading, filteredData, sortedDates, groupedByDate,
    openAddModal, openEditModal, handleDelete, getDisplayName, getStoreName,
}) {
    const [collapsedCards, setCollapsedCards] = useState({});
    const toggleCardCollapse = (dateStr) => {
        setCollapsedCards(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
    };

    const renderItemRow = (item, icon, badgeLabel, badgeClass, rowClass, showStore = true) => (
        <tr key={item.id} className={`revenue-row ${rowClass}`}>
            <td className="td-date">{item.date.split('-')[2]}</td>
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

    return (
        <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center justify-between mb-4">
                <span className="inline-flex items-center px-3 py-1.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">총 {filteredData.length}건</span>
                <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-xl border-none cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg transition-shadow" onClick={openAddModal}>
                    <Plus size={16} /> 매출 추가
                </button>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-3" />
                    <p className="text-slate-400 text-sm">불러오는 중...</p>
                </div>
            ) : filteredData.length === 0 ? (
                <div className="text-center py-16">
                    <div className="text-5xl mb-4">📋</div>
                    <h3 className="text-lg font-bold text-slate-700 mb-1">매출 데이터가 없습니다</h3>
                    <p className="text-sm text-slate-400">{year}년 {month}월에 등록된 매출 내역이 없습니다.</p>
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

                            const cashItems = items.filter(i => i.ui_category === 'cash');
                            const cardOnlyItems = items.filter(i => i.ui_category === 'card');
                            const deliveryItems = items.filter(i => i.ui_category === 'delivery');

                            const cashItemsTotal = cashItems.reduce((s, i) => s + (i.amount || 0), 0);
                            const cardOnlyTotal = cardOnlyItems.reduce((s, i) => s + (i.amount || 0), 0);
                            const deliveryTotal = deliveryItems.reduce((s, i) => s + (i.amount || 0), 0);

                            const isCashCollapsed = collapsedCards[`cash-${dateStr}`] !== false;
                            const isCardCollapsed = collapsedCards[`card-${dateStr}`] !== false;
                            const isDeliveryCollapsed = collapsedCards[`delivery-${dateStr}`] !== false;

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
                                cashItems.length > 0 && renderToggleRow(
                                    `cash-toggle-${dateStr}`, '💵', '현금매출',
                                    cashItems.length, cashItemsTotal,
                                    isCashCollapsed, `cash-${dateStr}`, 'cash-toggle-row'
                                ),
                                ...(!isCashCollapsed ? cashItems.map(item =>
                                    renderItemRow(item, '💵', '현금매출', 'cash', 'cash-row', false)
                                ) : []),
                                cardOnlyItems.length > 0 && renderToggleRow(
                                    `card-toggle-${dateStr}`, '💳', '카드매출',
                                    cardOnlyItems.length, cardOnlyTotal,
                                    isCardCollapsed, `card-${dateStr}`
                                ),
                                ...(!isCardCollapsed ? cardOnlyItems.map(item =>
                                    renderItemRow(item, '💳', '카드', 'store', 'card-row', false)
                                ) : []),
                                deliveryItems.length > 0 && renderToggleRow(
                                    `delivery-toggle-${dateStr}`, '🛵', '배달매출',
                                    deliveryItems.length, deliveryTotal,
                                    isDeliveryCollapsed, `delivery-${dateStr}`, 'delivery-toggle-row'
                                ),
                                ...(!isDeliveryCollapsed ? deliveryItems.map(item =>
                                    renderItemRow(item, '🛵', '배달', 'delivery', 'card-row', false)
                                ) : [])
                            ];
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
