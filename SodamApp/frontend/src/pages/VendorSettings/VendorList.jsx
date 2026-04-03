import { ChevronUp, ChevronDown, Edit2, Trash2, Check, Plus, Building2, GitMerge } from 'lucide-react';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES } from '../../utils/constants';
import api from '../../api';

export function VendorList({
    categories,
    getVendorsByCategory,
    activeTab,
    vendors,
    setVendors,
    editingVendor,
    setEditingVendor,
    handleUpdateVendor,
    handleMoveVendor,
    handleDeleteVendor,
    handleCreateVendor,
    setSelectedVendor,
    selectedForMerge,
    handleToggleMergeSelect,
    handleOpenMergeModal,
    collapsedCategories,
    toggleCategory,
    fetchVendors,
    // Inline add states
    addingCardStore,
    setAddingCardStore,
    newCardName,
    setNewCardName,
    addingPayStore,
    setAddingPayStore,
    newPayName,
    setNewPayName,
    addingDeliveryStore,
    setAddingDeliveryStore,
    newDeliveryName,
    setNewDeliveryName,
    handleDeleteStore,
}) {
    const renderVendorItem = (vendor, idx, list, isNested = false) => (
        <div key={vendor.id} className={`vendor-item-compact ${selectedForMerge.includes(vendor.id) ? 'selected-for-merge' : ''}`} style={isNested ? { borderBottom: '1px solid #f1f5f9' } : {}}>
            <input
                type="checkbox"
                checked={selectedForMerge.includes(vendor.id)}
                onChange={() => handleToggleMergeSelect(vendor.id)}
                className="merge-checkbox"
                title="병합할 거래처 선택"
            />
            <div className="vendor-info-group">
                <span className="vendor-order">{idx + 1}</span>
                {editingVendor === vendor.name ? (
                    <div className="vendor-edit-group">
                        <input
                            type="text"
                            defaultValue={vendor.name}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    const newName = e.target.value.trim();
                                    if (newName && newName !== vendor.name) {
                                        await handleUpdateVendor(vendor, { name: newName });
                                    }
                                    setEditingVendor(null);
                                } else if (e.key === 'Escape') {
                                    setEditingVendor(null);
                                }
                            }}
                            autoFocus
                            className="vendor-name-edit-input"
                        />
                        <select
                            value={vendor.category}
                            onChange={async (e) => {
                                const newCategory = e.target.value;
                                if (newCategory === vendor.category) return;
                                const isExpense = EXPENSE_CATEGORIES.some(c => c.id === newCategory);
                                await handleUpdateVendor(vendor, {
                                    category: newCategory,
                                    vendor_type: isExpense ? 'expense' : 'revenue'
                                });
                                setEditingVendor(null);
                            }}
                            className="category-change-select"
                            onClick={(e) => e.stopPropagation()}
                        >
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
                            className="edit-save-btn"
                            onClick={() => setEditingVendor(null)}
                            title="편집 완료"
                        >
                            <Check size={14} />
                        </button>
                    </div>
                ) : (
                    <span
                        className="vendor-name-display"
                        onDoubleClick={() => setEditingVendor(vendor.name)}
                        title="더블클릭하여 수정"
                    >
                        {(() => {
                            if (isNested && vendor.item && vendor.item.includes(':')) {
                                const [storeName] = vendor.item.split(':');
                                if (vendor.name.startsWith(storeName + ' ')) {
                                    return vendor.name.substring(storeName.length + 1);
                                }
                                if (vendor.name.startsWith(storeName)) {
                                    return vendor.name.substring(storeName.length).trim();
                                }
                            }
                            return vendor.name;
                        })()}
                    </span>
                )}
                {Number(vendor.total_transaction_amount) > 0 && (
                    <span className="vendor-monthly-amount">
                        ₩{Math.floor(Number(vendor.total_transaction_amount)).toLocaleString()}
                    </span>
                )}
            </div>
            {activeTab === 'expense' ? (
                <button
                    onClick={() => setSelectedVendor(vendor)}
                    className="product-summary-btn"
                    title="클릭하여 정보관리"
                >
                    <Building2 size={14} />
                    <span>정보관리</span>
                </button>
            ) : (
                <input
                    type="text"
                    value={vendor.item || ''}
                    onChange={(e) => {
                        const updated = vendors.map(v =>
                            v.name === vendor.name ? { ...v, item: e.target.value } : v
                        );
                        setVendors(updated);
                    }}
                    onBlur={() => handleUpdateVendor(vendor, { item: vendor.item })}
                    placeholder="취급품목"
                    className="item-input-compact"
                />
            )}
            <div className="vendor-actions-compact">
                <button
                    onClick={() => setEditingVendor(vendor.name)}
                    className="action-btn-sm edit"
                    title="업체명 수정"
                >
                    <Edit2 size={14} />
                </button>
                <button
                    onClick={() => handleMoveVendor(vendor, 'up')}
                    disabled={idx === 0}
                    className="action-btn-sm"
                    title="위로"
                >
                    <ChevronUp size={14} />
                </button>
                <button
                    onClick={() => handleMoveVendor(vendor, 'down')}
                    disabled={idx === list.length - 1}
                    className="action-btn-sm"
                    title="아래로"
                >
                    <ChevronDown size={14} />
                </button>
                <button
                    onClick={() => handleDeleteVendor(vendor)}
                    className="action-btn-sm delete"
                    title="삭제"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );

    return (
        <>
            {categories.map(category => {
                const categoryVendors = getVendorsByCategory(category.id);

                if (category.id === 'delivery') {
                    const deliveryGroups = {};
                    categoryVendors.forEach(v => {
                        const itemStr = v.item || '';
                        let storeName = '소담김밥';
                        if (itemStr && itemStr.includes(':')) {
                            storeName = itemStr.split(':')[0];
                        }
                        if (!deliveryGroups[storeName]) {
                            deliveryGroups[storeName] = [];
                        }
                        deliveryGroups[storeName].push(v);
                    });
                    return (
                        <div key={category.id} className="vendor-category-section">
                            <div
                                className="category-header"
                                onClick={() => toggleCategory(category.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="category-icon">{category.icon}</span>
                                <span className="category-label">{category.label}</span>
                                <span className="category-count">{categoryVendors.length}개</span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {collapsedCategories.has(category.id) ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                </div>
                            </div>
                            {!collapsedCategories.has(category.id) && (
                                <div className="store-nested-container">
                                    {Object.entries(deliveryGroups).map(([storeName, deliveryVendors]) => (
                                        <div key={storeName} style={{ marginBottom: '24px' }}>
                                            <div className="store-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{storeName}</span>
                                                    <button
                                                        className="action-btn-sm delete"
                                                        onClick={async () => {
                                                            if (!window.confirm(`"${storeName}" 배달 매장 그룹을 삭제하시겠습니까?\n포함된 배달앱 매출 항목이 모두 삭제됩니다.`)) return;
                                                            try {
                                                                for (const v of deliveryVendors) {
                                                                    if (v.id) await api.delete(`/vendors/id/${v.id}`);
                                                                }
                                                                await fetchVendors();
                                                            } catch (error) {
                                                                console.error(error);
                                                                alert('배달 매장 삭제 실패');
                                                            }
                                                        }}
                                                        title={`${storeName} 배달 매장 삭제`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Delivery Apps Sub-section */}
                                            <div className="store-sub-section">
                                                <div
                                                    className="store-sub-header"
                                                    onClick={() => toggleCategory(`delivery-${storeName}`)}
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <span>🛵 배달앱</span>
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>({deliveryVendors.length}개)</span>
                                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                                        {collapsedCategories.has(`delivery-${storeName}`) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                    </span>
                                                </div>
                                                {!collapsedCategories.has(`delivery-${storeName}`) && (
                                                    <div className="store-sub-content">
                                                        {deliveryVendors.map((vendor, idx) => renderVendorItem(vendor, idx, deliveryVendors, true))}
                                                        {/* Add Delivery App Inline */}
                                                        {addingDeliveryStore === storeName ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0' }}>
                                                                <input
                                                                    type="text"
                                                                    value={newDeliveryName}
                                                                    onChange={(e) => setNewDeliveryName(e.target.value)}
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === 'Enter' && newDeliveryName.trim()) {
                                                                            await handleCreateVendor({
                                                                                name: `${storeName} ${newDeliveryName.trim()}`,
                                                                                category: 'delivery',
                                                                                vendor_type: 'revenue',
                                                                                item: `${storeName}:delivery`
                                                                            });
                                                                            setNewDeliveryName('');
                                                                            setAddingDeliveryStore(null);
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setNewDeliveryName('');
                                                                            setAddingDeliveryStore(null);
                                                                        }
                                                                    }}
                                                                    placeholder="배달앱 이름 (예: 위메프오)"
                                                                    autoFocus
                                                                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!newDeliveryName.trim()) return;
                                                                        await handleCreateVendor({
                                                                            name: `${storeName} ${newDeliveryName.trim()}`,
                                                                            category: 'delivery',
                                                                            vendor_type: 'revenue',
                                                                            item: `${storeName}:delivery`
                                                                        });
                                                                        setNewDeliveryName('');
                                                                        setAddingDeliveryStore(null);
                                                                    }}
                                                                    style={{ padding: '6px 12px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    추가
                                                                </button>
                                                                <button
                                                                    onClick={() => { setNewDeliveryName(''); setAddingDeliveryStore(null); }}
                                                                    style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                                                                >
                                                                    취소
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => setAddingDeliveryStore(storeName)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', transition: 'color 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.color = '#f97316'}
                                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                            >
                                                                <Plus size={14} />
                                                                <span>배달앱 추가</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }

                if (category.id === 'store') {
                    const storeGroups = {};
                    categoryVendors.forEach(v => {
                        const itemStr = v.item || '';
                        let storeName = '소담김밥';
                        let type = 'other';
                        if (itemStr && itemStr.includes(':')) {
                            const parts = itemStr.split(':');
                            storeName = parts[0];
                            type = parts[1];
                        } else {
                            if (itemStr === 'cash') type = 'cash';
                            else if (itemStr === 'card') type = 'card';
                        }
                        if (!storeGroups[storeName]) {
                            storeGroups[storeName] = { cash: [], card: [], pay: [], other: [] };
                        }
                        if (type === 'cash') storeGroups[storeName].cash.push(v);
                        else if (type === 'card') storeGroups[storeName].card.push(v);
                        else if (type === 'pay') storeGroups[storeName].pay.push(v);
                        else storeGroups[storeName].other.push(v);
                    });
                    return (
                        <div key={category.id} className="vendor-category-section">
                            <div
                                className="category-header"
                                onClick={() => toggleCategory(category.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <span className="category-icon">{category.icon}</span>
                                <span className="category-label">{category.label}</span>
                                <span className="category-count">{categoryVendors.length}개</span>
                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {collapsedCategories.has(category.id) ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                </div>
                            </div>
                            {!collapsedCategories.has(category.id) && (
                                <div className="store-nested-container">
                                    {Object.entries(storeGroups).map(([storeName, group]) => (
                                        <div key={storeName} style={{ marginBottom: '24px' }}>
                                            <div className="store-group-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span>{storeName}</span>
                                                    <button
                                                        className="action-btn-sm delete"
                                                        onClick={() => handleDeleteStore(storeName)}
                                                        title={`${storeName} 매장 삭제`}
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            {/* Cash Section */}
                                            <div className="store-sub-section">
                                                <div
                                                    className="store-sub-header"
                                                    onClick={() => toggleCategory(`cash-${storeName}`)}
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <span>💵 현금매출</span>
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>({group.cash.length}개)</span>
                                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                                        {collapsedCategories.has(`cash-${storeName}`) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                    </span>
                                                </div>
                                                {!collapsedCategories.has(`cash-${storeName}`) && (
                                                    <div className="store-sub-content">
                                                        {group.cash.length > 0 ? (
                                                            group.cash.map((vendor, idx) => renderVendorItem(vendor, idx, group.cash, true))
                                                        ) : (
                                                            <div className="padding-md text-gray-400 text-sm text-center">등록된 현금매출처 없음</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Card Section */}
                                            <div className="store-sub-section">
                                                <div
                                                    className="store-sub-header"
                                                    onClick={() => toggleCategory(`card-${storeName}`)}
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <span>💳 카드매출</span>
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>({group.card.length}개)</span>
                                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                                        {collapsedCategories.has(`card-${storeName}`) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                    </span>
                                                </div>
                                                {!collapsedCategories.has(`card-${storeName}`) && (
                                                    <div className="store-sub-content">
                                                        {group.card.length > 0 ? (
                                                            group.card.map((vendor, idx) => renderVendorItem(vendor, idx, group.card, true))
                                                        ) : (
                                                            <div className="padding-md text-gray-400 text-sm text-center">등록된 카드사 없음</div>
                                                        )}
                                                        {/* Add Card Company Inline */}
                                                        {addingCardStore === storeName ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0' }}>
                                                                <input
                                                                    type="text"
                                                                    value={newCardName}
                                                                    onChange={(e) => setNewCardName(e.target.value)}
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === 'Enter' && newCardName.trim()) {
                                                                            await handleCreateVendor({
                                                                                name: `${storeName} ${newCardName.trim()}`,
                                                                                category: 'store',
                                                                                vendor_type: 'revenue',
                                                                                item: `${storeName}:card`
                                                                            });
                                                                            setNewCardName('');
                                                                            setAddingCardStore(null);
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setNewCardName('');
                                                                            setAddingCardStore(null);
                                                                        }
                                                                    }}
                                                                    placeholder="카드사 이름 (예: 국민카드)"
                                                                    autoFocus
                                                                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!newCardName.trim()) return;
                                                                        await handleCreateVendor({
                                                                            name: `${storeName} ${newCardName.trim()}`,
                                                                            category: 'store',
                                                                            vendor_type: 'revenue',
                                                                            item: `${storeName}:card`
                                                                        });
                                                                        setNewCardName('');
                                                                        setAddingCardStore(null);
                                                                    }}
                                                                    style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    추가
                                                                </button>
                                                                <button
                                                                    onClick={() => { setNewCardName(''); setAddingCardStore(null); }}
                                                                    style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                                                                >
                                                                    취소
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => setAddingCardStore(storeName)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', transition: 'color 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.color = '#3b82f6'}
                                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                            >
                                                                <Plus size={14} />
                                                                <span>카드사 추가</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Pay Section */}
                                            <div className="store-sub-section">
                                                <div
                                                    className="store-sub-header"
                                                    onClick={() => toggleCategory(`pay-${storeName}`)}
                                                    style={{ cursor: 'pointer', userSelect: 'none' }}
                                                >
                                                    <span>📱 페이매출</span>
                                                    <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'normal' }}>({group.pay.length}개)</span>
                                                    <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                                                        {collapsedCategories.has(`pay-${storeName}`) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                                    </span>
                                                </div>
                                                {!collapsedCategories.has(`pay-${storeName}`) && (
                                                    <div className="store-sub-content">
                                                        {group.pay.length > 0 ? (
                                                            group.pay.map((vendor, idx) => renderVendorItem(vendor, idx, group.pay, true))
                                                        ) : (
                                                            <div className="padding-md text-gray-400 text-sm text-center">등록된 페이 없음</div>
                                                        )}
                                                        {/* Add Pay Service Inline */}
                                                        {addingPayStore === storeName ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0' }}>
                                                                <input
                                                                    type="text"
                                                                    value={newPayName}
                                                                    onChange={(e) => setNewPayName(e.target.value)}
                                                                    onKeyDown={async (e) => {
                                                                        if (e.key === 'Enter' && newPayName.trim()) {
                                                                            await handleCreateVendor({
                                                                                name: `${storeName} ${newPayName.trim()}`,
                                                                                category: 'store',
                                                                                vendor_type: 'revenue',
                                                                                item: `${storeName}:pay`
                                                                            });
                                                                            setNewPayName('');
                                                                            setAddingPayStore(null);
                                                                        }
                                                                        if (e.key === 'Escape') {
                                                                            setNewPayName('');
                                                                            setAddingPayStore(null);
                                                                        }
                                                                    }}
                                                                    placeholder="페이 이름 (예: 토스페이)"
                                                                    autoFocus
                                                                    style={{ flex: 1, padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', outline: 'none' }}
                                                                />
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!newPayName.trim()) return;
                                                                        await handleCreateVendor({
                                                                            name: `${storeName} ${newPayName.trim()}`,
                                                                            category: 'store',
                                                                            vendor_type: 'revenue',
                                                                            item: `${storeName}:pay`
                                                                        });
                                                                        setNewPayName('');
                                                                        setAddingPayStore(null);
                                                                    }}
                                                                    style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                                                                >
                                                                    추가
                                                                </button>
                                                                <button
                                                                    onClick={() => { setNewPayName(''); setAddingPayStore(null); }}
                                                                    style={{ padding: '6px 8px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}
                                                                >
                                                                    취소
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                onClick={() => setAddingPayStore(storeName)}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderTop: '1px dashed #e2e8f0', cursor: 'pointer', color: '#94a3b8', fontSize: '13px', transition: 'color 0.2s' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.color = '#8b5cf6'}
                                                                onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                                                            >
                                                                <Plus size={14} />
                                                                <span>페이 추가</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            {/* Others/Unclassified in Store */}
                                            {group.other.length > 0 && (
                                                <div className="store-sub-section">
                                                    <div className="store-sub-header">기타</div>
                                                    <div className="store-sub-content">
                                                        {group.other.map((vendor, idx) => renderVendorItem(vendor, idx, group.other, true))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }

                return (
                    <div key={category.id} className="vendor-category-section">
                        <div
                            className="category-header"
                            onClick={() => toggleCategory(category.id)}
                            style={{ cursor: 'pointer' }}
                        >
                            <span className="category-icon">{category.icon}</span>
                            <span className="category-label">{category.label}</span>
                            <span className="category-count">{categoryVendors.length}개</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {/* Merge Action for Category */}
                                {selectedForMerge.length >= 2 && categoryVendors.some(v => selectedForMerge.includes(v.id)) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleOpenMergeModal(); }}
                                        className="merge-btn-sm"
                                    >
                                        <GitMerge size={14} />
                                        선택 병합 ({selectedForMerge.length})
                                    </button>
                                )}
                                {collapsedCategories.has(category.id) ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                            </div>
                        </div>
                        {!collapsedCategories.has(category.id) && (
                            categoryVendors.length > 0 ? (
                                <div className="vendor-list-compact">
                                    {categoryVendors.map((vendor, idx) => renderVendorItem(vendor, idx, categoryVendors))}
                                </div>
                            ) : (
                                <div className="no-vendors-message">
                                    등록된 거래처가 없습니다
                                </div>
                            )
                        )}
                    </div>
                );
            })}
        </>
    );
}
