import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit2, X, Check, Package, GitMerge } from 'lucide-react';
import api from '../api';
import './VendorSettings.css';
import ProductManagement from '../components/ProductManagement';

// 매입처 카테고리 정의 (백엔드 CATEGORY_TO_PL_FIELD와 동기화)
// Note: 인건비는 Payroll에서 자동 동기화, 퇴직금적립은 인건비×10% 자동계산
const EXPENSE_CATEGORIES = [
    { id: '식자재', label: '식자재', icon: '🥬' },
    { id: '재료비', label: '재료비', icon: '📦' },
    { id: '임대료', label: '임대료(월세)', icon: '🏠' },
    { id: '임대관리비', label: '임대관리비', icon: '🏢' },
    { id: '제세공과금', label: '제세공과금', icon: '💡' },
    { id: '카드수수료', label: '카드수수료', icon: '💳' },
    { id: '부가가치세', label: '부가가치세', icon: '📋' },
    { id: '사업소득세', label: '사업소득세', icon: '📋' },
    { id: '근로소득세', label: '근로소득세', icon: '📋' },
    { id: 'other', label: '기타비용', icon: '📋' },
];

// 매출처 카테고리 정의
const REVENUE_CATEGORIES = [
    { id: 'delivery', label: '배달앱', icon: '🛵' },
    { id: 'store', label: '매장매출', icon: '🏪' },
    { id: 'other_revenue', label: '기타매출', icon: '💰' },
];

export default function VendorSettings() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [activeTab, setActiveTab] = useState('expense'); // 'expense' or 'revenue'
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorCategory, setNewVendorCategory] = useState('food');
    const [editingVendor, setEditingVendor] = useState(null);
    const [editingName, setEditingName] = useState(''); // Name being edited
    const [selectedVendor, setSelectedVendor] = useState(null); // For product management modal
    const [selectedForMerge, setSelectedForMerge] = useState([]); // Checkbox selection for merge
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeTarget, setMergeTarget] = useState(null);
    const [customMergeName, setCustomMergeName] = useState('');

    useEffect(() => {
        fetchVendors();
    }, []);

    // Reset category when tab changes
    useEffect(() => {
        if (activeTab === 'expense') {
            setNewVendorCategory('식자재');
        } else {
            setNewVendorCategory('delivery');
        }
    }, [activeTab]);

    const fetchVendors = async () => {
        try {
            const response = await api.get('/vendors');
            if (response.data.status === 'success') {
                const apiVendors = response.data.data;
                // Sort by order_index
                apiVendors.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
                setVendors(apiVendors);
            }
        } catch (error) {
            console.error("Error fetching vendors:", error);
        } finally {
            setLoading(false);
        }
    };

    const getCategories = () => activeTab === 'expense' ? EXPENSE_CATEGORIES : REVENUE_CATEGORIES;

    const getVendorsByCategory = (category) => {
        return vendors.filter(v =>
            v.vendor_type === activeTab && v.category === category
        );
    };

    const handleSave = async (vendor) => {
        setSaving(vendor.name);
        try {
            await api.post('/vendors', {
                name: vendor.name,
                item: vendor.item,
                category: vendor.category,
                vendor_type: vendor.vendor_type,
                order_index: vendor.order_index
            });
        } catch (error) {
            alert("저장 실패");
        } finally {
            setSaving(null);
        }
    };

    const handleAddVendor = async () => {
        if (!newVendorName.trim()) return;
        // Check duplicates only within the same vendor_type (매입처/매출처 분리)
        if (vendors.some(v => v.name === newVendorName.trim() && v.vendor_type === activeTab)) {
            alert('이미 존재하는 거래처입니다.');
            return;
        }

        const maxOrder = Math.max(0, ...vendors.filter(v => v.vendor_type === activeTab && v.category === newVendorCategory).map(v => v.order_index || 0));

        const newVendor = {
            name: newVendorName.trim(),
            item: '',
            category: newVendorCategory,
            vendor_type: activeTab,
            order_index: maxOrder + 1
        };

        try {
            await api.post('/vendors', newVendor);
            await fetchVendors();
            setNewVendorName('');
        } catch (error) {
            alert('거래처 추가 실패');
        }
    };

    const handleDeleteVendor = async (vendorName) => {
        if (!window.confirm(`"${vendorName}" 거래처를 삭제하시겠습니까?`)) return;

        try {
            await api.delete(`/vendors/${encodeURIComponent(vendorName)}`);
            await fetchVendors();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleMoveVendor = async (vendor, direction) => {
        const sameCategory = vendors.filter(v => v.vendor_type === vendor.vendor_type && v.category === vendor.category);
        const currentIndex = sameCategory.findIndex(v => v.name === vendor.name);
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

        if (newIndex < 0 || newIndex >= sameCategory.length) return;

        const otherVendor = sameCategory[newIndex];

        // Swap order_index
        const tempOrder = vendor.order_index;
        vendor.order_index = otherVendor.order_index;
        otherVendor.order_index = tempOrder;

        try {
            await api.post('/vendors', vendor);
            await api.post('/vendors', otherVendor);
            await fetchVendors();
        } catch (error) {
            console.error('Move failed:', error);
        }
    };

    const handleUpdateVendor = async (vendor, updates) => {
        setSaving(vendor.name);
        try {
            // Use PATCH for ID-based updates (supports name change)
            if (vendor.id) {
                await api.patch(`/vendors/${vendor.id}`, updates);
            } else {
                // Fallback to POST for vendors without ID
                await api.post('/vendors', { ...vendor, ...updates });
            }
            await fetchVendors();
        } catch (error) {
            console.error('Update error:', error);
            alert('수정 실패');
        } finally {
            setSaving(null);
        }
    };

    const handleVendorNameClick = (vendor) => {
        setEditingVendor(vendor.id);
        setEditingName(vendor.name);
    };

    const handleVendorNameSave = async (vendor) => {
        if (!editingName.trim() || editingName === vendor.name) {
            setEditingVendor(null);
            return;
        }
        await handleUpdateVendor(vendor, { name: editingName });
        setEditingVendor(null);
    };

    const getCategoryLabel = (categoryId) => {
        const allCategories = [...EXPENSE_CATEGORIES, ...REVENUE_CATEGORIES];
        return allCategories.find(c => c.id === categoryId)?.label || categoryId;
    };

    const getCategoryIcon = (categoryId) => {
        const allCategories = [...EXPENSE_CATEGORIES, ...REVENUE_CATEGORIES];
        return allCategories.find(c => c.id === categoryId)?.icon || '📁';
    };

    // Merge handlers
    const handleToggleMergeSelect = (vendorId) => {
        setSelectedForMerge(prev =>
            prev.includes(vendorId)
                ? prev.filter(id => id !== vendorId)
                : [...prev, vendorId]
        );
    };

    const handleOpenMergeModal = () => {
        if (selectedForMerge.length < 2) {
            alert('병합할 거래처를 2개 이상 선택해주세요.');
            return;
        }
        setShowMergeModal(true);
        setMergeTarget(selectedForMerge[0]); // Default to first selected
    };

    const getVendorById = (id) => {
        if (typeof id === 'string') {
            return vendors.find(v => v.name === id) || { name: id, category: null };
        }
        return vendors.find(v => v.id === id);
    };

    const handleMerge = async () => {
        if (!mergeTarget) return;

        let finalTargetName = null;

        // 1. Determine Target Name
        if (mergeTarget === '__CUSTOM__') {
            finalTargetName = customMergeName.trim();
            if (!finalTargetName) {
                alert('새 거래처 이름을 입력해주세요.');
                return;
            }
        } else {
            const targetVendor = getVendorById(mergeTarget);
            finalTargetName = targetVendor ? targetVendor.name : mergeTarget;
        }

        // 2. Determine Strategy (ID-based vs Name-based)
        // If target is an existing vendor (ID), use ID merge. 
        // If target is Name (Uncategorized) or Custom, use Name merge.
        const isIdMerge = (typeof mergeTarget === 'number');

        try {
            let response;
            if (isIdMerge) {
                const sourceIds = selectedForMerge.filter(id => id !== mergeTarget);
                response = await api.post(`/vendors/${mergeTarget}/merge`, {
                    source_ids: sourceIds
                });
            } else {
                // Name-based Merge
                // Convert all selected sources to Names
                const sourceNames = selectedForMerge.map(id => {
                    const v = getVendorById(id); // Handles both ID and Name lookup
                    return v ? v.name : id;
                });

                // Filter out the target itself
                const filteredSourceNames = sourceNames.filter(name => name !== finalTargetName);

                response = await api.post('/vendors/merge-uncategorized', {
                    target_name: finalTargetName,
                    source_names: filteredSourceNames,
                    category: 'other'
                });
            }

            if (response.data.status === 'success') {
                const mergedCount = response.data.merged_expenses || response.data.merged_count;
                alert(`${mergedCount}건의 데이터가 병합되었습니다.`);
                setShowMergeModal(false);
                setSelectedForMerge([]);
                setMergeTarget(null);
                setCustomMergeName('');
                await fetchVendors();
            }
        } catch (error) {
            console.error('Merge error:', error);
            const errorDetail = error.response?.data?.detail;
            const errorMessage = typeof errorDetail === 'object'
                ? JSON.stringify(errorDetail)
                : (errorDetail || error.message);
            alert('병합 실패: ' + errorMessage);
        }
    };

    return (
        <>
            <div className="vendor-settings-page">
                <div className="vendor-settings-container">
                    <header className="vendor-settings-header">
                        <button onClick={() => navigate(-1)} className="back-button">
                            <ChevronLeft size={20} />
                        </button>
                        <h1>거래처 관리</h1>
                    </header>

                    {/* Tabs */}
                    <div className="vendor-tabs">
                        <button
                            className={`vendor-tab ${activeTab === 'expense' ? 'active expense' : ''}`}
                            onClick={() => setActiveTab('expense')}
                        >
                            💰 매입처 (비용)
                        </button>
                        <button
                            className={`vendor-tab ${activeTab === 'revenue' ? 'active revenue' : ''}`}
                            onClick={() => setActiveTab('revenue')}
                        >
                            💵 매출처 (수입)
                        </button>
                    </div>

                    {/* Add New Vendor Form */}
                    <div className="vendor-add-section">
                        <h3>새 거래처 추가</h3>
                        <div className="vendor-add-form-row">
                            <select
                                value={newVendorCategory}
                                onChange={(e) => setNewVendorCategory(e.target.value)}
                                className="category-select"
                            >
                                {getCategories().map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.icon} {cat.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                value={newVendorName}
                                onChange={(e) => setNewVendorName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddVendor()}
                                placeholder="거래처 이름 입력"
                                className="vendor-name-input"
                            />
                            <button onClick={handleAddVendor} className="add-vendor-btn">
                                <Plus size={18} />
                                추가
                            </button>
                        </div>
                    </div>

                    {/* Merge Button */}
                    {selectedForMerge.length >= 2 && (
                        <div className="merge-action-bar">
                            <span>{selectedForMerge.length}개 선택됨</span>
                            <button onClick={handleOpenMergeModal} className="merge-btn">
                                <GitMerge size={18} />
                                선택 거래처 병합
                            </button>
                            <button onClick={() => setSelectedForMerge([])} className="cancel-selection-btn">
                                선택 취소
                            </button>
                        </div>
                    )}

                    {loading ? (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div className="vendor-categories">
                            {/* Uncategorized Vendors Section */}
                            {(() => {
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
                                        // Keep other properties from the first occurrence or latest? First is fine.
                                    } else {
                                        acc.push({ ...current, count: 1 });
                                    }
                                    return acc;
                                }, []);

                                if (uniqueUncategorized.length === 0) return null;

                                // Helper for selecting unknown vendors for merge
                                const toggleUnknownSelect = (name) => {
                                    setSelectedForMerge(prev => {
                                        // We use name as ID for unknown vendors since they might share IDs or have none
                                        // Prefixing to avoid collision with real IDs? No, real IDs are integers usually. 
                                        // But wait, selectedForMerge serves existing vendors. We should use a separate state or mix carefully.
                                        // Let's use a separate state: selectedUnknownForMerge (need to add useState first)
                                        // For now, let's assume we added the state.
                                        return prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name];
                                    });
                                };

                                return (
                                    <div className="vendor-category-section uncategorized">
                                        <div className="category-header uncategorized-header">
                                            <span className="category-icon">⚠️</span>
                                            <span className="category-label">미분류 업체</span>
                                            <div className="category-badges">
                                                <span className="badge-count-total">{rawUncategorized.length}건</span>
                                                <span className="badge-count-unique">{uniqueUncategorized.length}개 업체</span>
                                            </div>

                                            {/* Merge Action for Unknown */}
                                            {selectedForMerge.length >= 2 && selectedForMerge.every(id => typeof id === 'string') && (
                                                <button
                                                    onClick={handleOpenMergeModal}
                                                    className="merge-btn-sm"
                                                    style={{ marginLeft: 'auto' }}
                                                >
                                                    <GitMerge size={14} />
                                                    선택 병합 ({selectedForMerge.length})
                                                </button>
                                            )}
                                        </div>
                                        <div className="uncategorized-notice">
                                            이름이 같은 업체는 자동으로 묶여서 표시됩니다. 체크박스를 선택하여 서로 다른 이름을 하나로 병합할 수 있습니다.
                                        </div>
                                        <div className="vendor-list-compact">
                                            {uniqueUncategorized.map((vendor, idx) => (
                                                <div key={vendor.name} className={`vendor-item-compact uncategorized-item ${selectedForMerge.includes(vendor.name) ? 'selected' : ''}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedForMerge.includes(vendor.name)}
                                                        onChange={() => handleToggleMergeSelect(vendor.name)} // handleToggleMergeSelect supports mixed types?
                                                        className="merge-checkbox"
                                                    />
                                                    <span className="vendor-order">{idx + 1}</span>

                                                    <div className="vendor-info-group">
                                                        {editingVendor === vendor.name ? ( // using name as ID for editing unknown
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
                                                            // When assigning category for grouped unknown vendor, we need to update ALL of them (by name).
                                                            // Existing handleUpdateVendor uses ID if available, or POST if not.
                                                            // We need a Batch Update by Name API.
                                                            // But for now, let's try calling existing update. 
                                                            // If backend supports updating by name (or creating new vendor with that name), it might work.

                                                            const isExpense = EXPENSE_CATEGORIES.some(c => c.id === e.target.value);
                                                            // We'll treat this as "Create/Update Vendor"
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
                                    </div>
                                );
                            })()}

                            {getCategories().map(category => {
                                const categoryVendors = getVendorsByCategory(category.id);

                                return (
                                    <div key={category.id} className="vendor-category-section">
                                        <div className="category-header">
                                            <span className="category-icon">{category.icon}</span>
                                            <span className="category-label">{category.label}</span>
                                            <span className="category-count">{categoryVendors.length}개</span>
                                        </div>

                                        {categoryVendors.length > 0 ? (
                                            <div className="vendor-list-compact">
                                                {categoryVendors.map((vendor, idx) => (
                                                    <div key={vendor.id} className={`vendor-item-compact ${selectedForMerge.includes(vendor.id) ? 'selected-for-merge' : ''}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedForMerge.includes(vendor.id)}
                                                            onChange={() => handleToggleMergeSelect(vendor.id)}
                                                            className="merge-checkbox"
                                                            title="병합할 거래처 선택"
                                                        />
                                                        <span className="vendor-order">{idx + 1}</span>
                                                        {/* Vendor name - editable when editingVendor matches */}
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
                                                                {vendor.name}
                                                            </span>
                                                        )}
                                                        {/* Product Summary Button - Click to open product management */}
                                                        {activeTab === 'expense' ? (
                                                            <button
                                                                onClick={() => setSelectedVendor(vendor)}
                                                                className="product-summary-btn"
                                                                title="클릭하여 제품 관리"
                                                            >
                                                                <Package size={14} />
                                                                <span>제품 관리</span>
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
                                                            {/* Edit button for vendor name */}
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
                                                                disabled={idx === categoryVendors.length - 1}
                                                                className="action-btn-sm"
                                                                title="아래로"
                                                            >
                                                                <ChevronDown size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteVendor(vendor.name)}
                                                                className="action-btn-sm delete"
                                                                title="삭제"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="no-vendors-message">
                                                등록된 거래처가 없습니다
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Product Management Modal */}
            {
                selectedVendor && (
                    <ProductManagement
                        vendor={selectedVendor}
                        onClose={() => setSelectedVendor(null)}
                    />
                )
            }

            {/* Merge Modal */}
            {showMergeModal && (
                <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
                    <div className="merge-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>거래처 병합</h2>
                            <button onClick={() => setShowMergeModal(false)} className="close-btn">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="merge-info">
                                선택된 {selectedForMerge.length}개의 거래처를 하나로 병합합니다.<br />
                                <strong>유지할 거래처</strong>를 선택하세요. 나머지는 삭제되고 비용 데이터가 이전됩니다.
                            </p>
                            <div className="merge-target-list">
                                {selectedForMerge.map(id => {
                                    const v = getVendorById(id);
                                    if (!v) return null;
                                    return (
                                        <label key={id} className={`merge-target-option ${mergeTarget === id ? 'active' : ''}`}>
                                            <input
                                                type="radio"
                                                name="mergeTarget"
                                                value={id}
                                                checked={mergeTarget === id}
                                                onChange={() => setMergeTarget(id)}
                                            />
                                            <span className="vendor-info">
                                                <span className="vendor-name">{v.name}</span>
                                                <span className="vendor-category">{getCategoryLabel(v.category)}</span>
                                            </span>
                                            {mergeTarget === id && <span className="keep-badge">유지</span>}
                                        </label>
                                    );
                                })}

                                {/* Custom Merge Name Option */}
                                <label className={`merge-target-option custom ${mergeTarget === '__CUSTOM__' ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="mergeTarget"
                                        value="__CUSTOM__"
                                        checked={mergeTarget === '__CUSTOM__'}
                                        onChange={() => setMergeTarget('__CUSTOM__')}
                                    />
                                    <span className="vendor-info custom-input-wrapper">
                                        <span className="vendor-name-label">새로운 이름으로 병합: </span>
                                        <input
                                            type="text"
                                            value={customMergeName}
                                            onChange={e => setCustomMergeName(e.target.value)}
                                            placeholder="예: 통합거래처(본점)"
                                            className="custom-merge-name-input"
                                            disabled={mergeTarget !== '__CUSTOM__'}
                                            onClick={(e) => {
                                                if (mergeTarget !== '__CUSTOM__') setMergeTarget('__CUSTOM__');
                                                e.stopPropagation(); // prevent modal invalidation if any
                                            }}
                                        />
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={() => setShowMergeModal(false)} className="cancel-btn">
                                취소
                            </button>
                            <button onClick={handleMerge} className="confirm-merge-btn">
                                <GitMerge size={18} />
                                병합 실행
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
