import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit2, X, Check, Package, GitMerge } from 'lucide-react';
import api from '../api';
import './VendorSettings.css';
import ProductManagement from '../components/ProductManagement';

// 매입처 카테고리 정의 (백엔드 CATEGORY_TO_PL_FIELD와 동기화)
const EXPENSE_CATEGORIES = [
    { id: '식자재', label: '식자재', icon: '🥬' },
    { id: '재료비', label: '재료비', icon: '📦' },
    { id: '임대료', label: '임대료(월세)', icon: '🏠' },
    { id: '임대관리비', label: '임대관리비', icon: '🏢' },
    { id: '제세공과금', label: '제세공과금', icon: '💡' },
    { id: '인건비', label: '인건비', icon: '👷' },
    { id: '카드수수료', label: '카드수수료', icon: '💳' },
    { id: '부가가치세', label: '부가가치세', icon: '📋' },
    { id: '사업소득세', label: '사업소득세', icon: '📋' },
    { id: '근로소득세', label: '근로소득세', icon: '📋' },
    { id: '퇴직금적립', label: '퇴직금적립', icon: '💰' },
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
    const [selectedVendor, setSelectedVendor] = useState(null); // For product management modal
    const [selectedForMerge, setSelectedForMerge] = useState([]); // Checkbox selection for merge
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeTarget, setMergeTarget] = useState(null);

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

    const handleMerge = async () => {
        if (!mergeTarget) return;

        const sourceIds = selectedForMerge.filter(id => id !== mergeTarget);
        if (sourceIds.length === 0) {
            alert('병합할 대상 거래처를 선택해주세요.');
            return;
        }

        try {
            const response = await api.post(`/vendors/${mergeTarget}/merge`, {
                source_ids: sourceIds
            });

            if (response.data.status === 'success') {
                alert(`${response.data.merged_expenses}건의 비용 데이터가 병합되었습니다.\n삭제된 거래처: ${response.data.deleted_vendors.join(', ')}`);
                setShowMergeModal(false);
                setSelectedForMerge([]);
                setMergeTarget(null);
                await fetchVendors();
            }
        } catch (error) {
            console.error('Merge error:', error);
            alert('병합 실패: ' + (error.response?.data?.detail || error.message));
        }
    };

    const getVendorById = (id) => vendors.find(v => v.id === id);

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
                            {/* Uncategorized Vendors Section - only show vendors with no valid category at all */}
                            {(() => {
                                const allExpenseCategories = EXPENSE_CATEGORIES.map(c => c.id);
                                const allRevenueCategories = REVENUE_CATEGORIES.map(c => c.id);
                                const allValidCategories = [...allExpenseCategories, ...allRevenueCategories];

                                // Only show vendors that have NO valid category at all (not in expense OR revenue)
                                const uncategorizedVendors = vendors.filter(v =>
                                    !v.category || !allValidCategories.includes(v.category)
                                );

                                if (uncategorizedVendors.length === 0) return null;

                                return (
                                    <div className="vendor-category-section uncategorized">
                                        <div className="category-header uncategorized-header">
                                            <span className="category-icon">⚠️</span>
                                            <span className="category-label">미분류 업체</span>
                                            <span className="category-count">{uncategorizedVendors.length}개</span>
                                        </div>
                                        <div className="uncategorized-notice">
                                            아래 업체들의 카테고리를 선택해주세요
                                        </div>
                                        <div className="vendor-list-compact">
                                            {uncategorizedVendors.map((vendor, idx) => (
                                                <div key={vendor.name} className="vendor-item-compact uncategorized-item">
                                                    <span className="vendor-order">{idx + 1}</span>
                                                    <span className="vendor-name-display">{vendor.name}</span>
                                                    <select
                                                        value=""
                                                        onChange={async (e) => {
                                                            if (!e.target.value) return;
                                                            // Determine vendor_type based on category
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
                                                        title="삭제"
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
                                                            <input
                                                                type="text"
                                                                defaultValue={vendor.name}
                                                                onKeyDown={async (e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const newName = e.target.value.trim();
                                                                        if (newName && newName !== vendor.name) {
                                                                            // Note: Changing vendor name requires backend support
                                                                            // For now just update display
                                                                            await handleUpdateVendor(vendor, { name: newName });
                                                                        }
                                                                        setEditingVendor(null);
                                                                    } else if (e.key === 'Escape') {
                                                                        setEditingVendor(null);
                                                                    }
                                                                }}
                                                                onBlur={() => setEditingVendor(null)}
                                                                autoFocus
                                                                className="vendor-name-edit-input"
                                                            />
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
