import { ChevronUp, ChevronDown, Trash2, GitMerge } from 'lucide-react';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from '../../utils/constants';

export function CategoryManager({
    vendors,
    editingVendor,
    setEditingVendor,
    editingName,
    setEditingName,
    handleVendorNameClick,
    handleVendorNameSave,
    handleUpdateVendor,
    handleDeleteVendor,
    selectedForMerge,
    setSelectedForMerge,
    handleToggleMergeSelect,
    handleOpenMergeModal,
    collapsedCategories,
    toggleCategory,
}) {
    const allExpenseCategories = EXPENSE_CATEGORIES.map(c => c.id);
    const allRevenueCategories = REVENUE_CATEGORIES.map(c => c.id);
    const allValidCategories = [...allExpenseCategories, ...allRevenueCategories];
    const rawUncategorized = vendors.filter(v =>
        !v.category || !allValidCategories.includes(v.category)
    );

    // Group by name
    const uniqueUncategorized = rawUncategorized.reduce((acc, current) => {
        const existing = acc.find(v => v.name === current.name);
        if (existing) {
            existing.count = (existing.count || 1) + 1;
        } else {
            acc.push({ ...current, count: 1 });
        }
        return acc;
    }, []);

    if (uniqueUncategorized.length === 0) return null;

    return (
        <div className="vendor-category-section uncategorized">
            <div
                className="category-header uncategorized-header"
                onClick={() => toggleCategory('uncategorized')}
                style={{ cursor: 'pointer' }}
            >
                <span className="category-icon">⚠️</span>
                <span className="category-label">미분류 업체</span>
                <div className="category-badges">
                    <span className="badge-count-total">{rawUncategorized.length}건</span>
                    <span className="badge-count-unique">{uniqueUncategorized.length}개 업체</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Merge Action for Unknown */}
                    {selectedForMerge.length >= 2 && selectedForMerge.every(id => typeof id === 'string') && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleOpenMergeModal(); }}
                            className="merge-btn-sm"
                        >
                            <GitMerge size={14} />
                            선택 병합 ({selectedForMerge.length})
                        </button>
                    )}
                    {collapsedCategories.has('uncategorized') ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                </div>
            </div>
            <div className="uncategorized-notice">
                이름이 같은 업체는 자동으로 묶여서 표시됩니다. 체크박스를 선택하여 서로 다른 이름을 하나로 병합할 수 있습니다.
            </div>
            {!collapsedCategories.has('uncategorized') && (
                <div className="vendor-list-compact">
                    {uniqueUncategorized.map((vendor, idx) => (
                        <div key={vendor.name} className={`vendor-item-compact uncategorized-item ${selectedForMerge.includes(vendor.name) ? 'selected' : ''}`}>
                            <input
                                type="checkbox"
                                checked={selectedForMerge.includes(vendor.name)}
                                onChange={() => handleToggleMergeSelect(vendor.name)}
                                className="merge-checkbox"
                            />
                            <span className="vendor-order">{idx + 1}</span>
                            <div className="vendor-info-group">
                                {editingVendor === vendor.name ? (
                                    <input
                                        type="text"
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={() => handleVendorNameSave(vendor)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleVendorNameSave(vendor);
                                            if (e.key === 'Escape') setEditingVendor(null);
                                        }}
                                        autoFocus
                                        className="vendor-name-edit-input"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span
                                        className="vendor-name-display editable"
                                        onClick={() => handleVendorNameClick(vendor)}
                                        title="클릭하여 이름 수정"
                                    >
                                        {vendor.name}
                                        {vendor.count > 1 && <span className="vendor-count-badge">{vendor.count}</span>}
                                    </span>
                                )}
                            </div>
                            <select
                                value=""
                                onChange={async (e) => {
                                    if (!e.target.value) return;
                                    const isExpense = EXPENSE_CATEGORIES.some(c => c.id === e.target.value);
                                    await handleUpdateVendor(vendor, {
                                        category: e.target.value,
                                        vendor_type: isExpense ? 'expense' : 'revenue'
                                    });
                                }}
                                className="category-assign-select"
                            >
                                <option value="">카테고리 선택...</option>
                                <optgroup label="💰 매입처 (비용)">
                                    {EXPENSE_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.label}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="💵 매출처 (수입)">
                                    {REVENUE_CATEGORIES.map(cat => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.icon} {cat.label}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                            <button
                                onClick={() => handleDeleteVendor(vendor.name)}
                                className="action-btn-sm delete"
                                title="일괄 삭제"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
