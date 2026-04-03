import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Building2, X } from 'lucide-react';
import api from '../../api';
import './VendorSettings.css';
import VendorInfoManagement from '../../components/VendorInfoManagement';
import { EXPENSE_CATEGORIES, REVENUE_CATEGORIES, DELIVERY_APPS, CARD_COMPANIES, PAY_SERVICES } from '../../utils/constants';
import { VendorList } from './VendorList';
import { MergeActionBar, MergeModal } from './MergePanel';
import { CategoryManager } from './CategoryManager';

export default function VendorSettings() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [activeTab, setActiveTab] = useState('expense');
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorCategory, setNewVendorCategory] = useState('food');
    const [editingVendor, setEditingVendor] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [selectedForMerge, setSelectedForMerge] = useState([]);
    const [showMergeModal, setShowMergeModal] = useState(false);
    const [mergeTarget, setMergeTarget] = useState(null);
    const [customMergeName, setCustomMergeName] = useState('');
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());
    const [sortBy, setSortBy] = useState('name');
    const [showActiveOnly, setShowActiveOnly] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Add Store Modal State
    const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    // Add Card/Pay/Delivery Inline States
    const [addingCardStore, setAddingCardStore] = useState(null);
    const [newCardName, setNewCardName] = useState('');
    const [addingPayStore, setAddingPayStore] = useState(null);
    const [newPayName, setNewPayName] = useState('');
    const [addingDeliveryStore, setAddingDeliveryStore] = useState(null);
    const [newDeliveryName, setNewDeliveryName] = useState('');

    // ─── Handlers ───
    const handleCreateVendor = async (vendorData) => {
        try {
            await api.post('/vendors', {
                ...vendorData,
                order_index: vendorData.order_index || 100
            });
            await fetchVendors();
        } catch (error) {
            console.error("Failed to create vendor:", error);
            throw error;
        }
    };

    const handleAddStore = async () => {
        if (!newStoreName.trim()) return;
        const name = newStoreName.trim();
        try {
            await handleCreateVendor({
                name: `${name} 현금매출`,
                category: 'store',
                vendor_type: 'revenue',
                item: `${name}:cash`
            });
            for (const company of CARD_COMPANIES) {
                await handleCreateVendor({
                    name: `${name} ${company}`,
                    category: 'store',
                    vendor_type: 'revenue',
                    item: `${name}:card`
                });
            }
            for (const pay of PAY_SERVICES) {
                await handleCreateVendor({
                    name: `${name} ${pay}`,
                    category: 'store',
                    vendor_type: 'revenue',
                    item: `${name}:pay`
                });
            }
            for (const app of DELIVERY_APPS) {
                await handleCreateVendor({
                    name: `${name} ${app}`,
                    category: 'delivery',
                    vendor_type: 'revenue',
                    item: `${name}:delivery`
                });
            }
            setNewStoreName('');
            setIsAddStoreModalOpen(false);
        } catch (error) {
            alert("매장 추가에 실패했습니다.");
        }
    };

    const handleSortChange = (e) => setSortBy(e.target.value);

    const handleMonthChange = (e) => {
        const [year, month] = e.target.value.split('-');
        setSelectedDate(new Date(year, month - 1));
    };

    const toggleCategory = (categoryId) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) newSet.delete(categoryId);
            else newSet.add(categoryId);
            return newSet;
        });
    };

    useEffect(() => { fetchVendors(); }, [selectedDate]);
    useEffect(() => {
        if (activeTab === 'expense') setNewVendorCategory('식자재');
        else setNewVendorCategory('delivery');
    }, [activeTab]);

    const fetchVendors = async () => {
        try {
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1;
            const response = await api.get(`/vendors?year=${year}&month=${month}`);
            if (response.data.status === 'success') {
                const apiVendors = response.data.data;
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
        let filtered = vendors.filter(v =>
            v.vendor_type === activeTab && v.category === category
        );
        if (showActiveOnly) {
            filtered = filtered.filter(v => (v.transaction_count || 0) > 0);
        }
        return filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return (a.order_index || 0) - (b.order_index || 0) || a.name.localeCompare(b.name);
            } else if (sortBy === 'recent') {
                const dateA = a.last_transaction_date ? new Date(a.last_transaction_date) : new Date(0);
                const dateB = b.last_transaction_date ? new Date(b.last_transaction_date) : new Date(0);
                return dateB - dateA;
            } else if (sortBy === 'frequency') {
                return (b.transaction_count || 0) - (a.transaction_count || 0);
            } else if (sortBy === 'amount') {
                return (b.total_transaction_amount || 0) - (a.total_transaction_amount || 0);
            }
            return 0;
        });
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

        // Custom Logic for 'Store Revenue'
        if (activeTab === 'revenue' && newVendorCategory === 'store') {
            const storeName = newVendorName.trim();
            const exists = vendors.some(v => v.category === 'store' && v.item && v.item.startsWith(`${storeName}:`));
            if (exists) {
                alert('이미 존재하는 매장입니다.');
                return;
            }
            try {
                await handleCreateVendor({ name: `${storeName} 현금매출`, category: 'store', vendor_type: 'revenue', item: `${storeName}:cash` });
                for (const company of CARD_COMPANIES) {
                    await handleCreateVendor({ name: `${storeName} ${company}`, category: 'store', vendor_type: 'revenue', item: `${storeName}:card` });
                }
                for (const pay of PAY_SERVICES) {
                    await handleCreateVendor({ name: `${storeName} ${pay}`, category: 'store', vendor_type: 'revenue', item: `${storeName}:pay` });
                }
                for (const app of DELIVERY_APPS) {
                    await handleCreateVendor({ name: `${storeName} ${app}`, category: 'delivery', vendor_type: 'revenue', item: `${storeName}:delivery` });
                }
                setNewVendorName('');
            } catch (error) {
                alert('매장 추가 실패');
            }
            return;
        }

        // Custom Logic for 'Delivery Revenue'
        if (activeTab === 'revenue' && newVendorCategory === 'delivery') {
            const storeName = newVendorName.trim();
            const exists = vendors.some(v => v.category === 'delivery' && v.item && v.item.startsWith(`${storeName}:`));
            if (exists) {
                alert('이미 존재하는 배달 매장입니다.');
                return;
            }
            try {
                for (const app of DELIVERY_APPS) {
                    await handleCreateVendor({ name: `${storeName} ${app}`, category: 'delivery', vendor_type: 'revenue', item: `${storeName}:delivery` });
                }
                setNewVendorName('');
            } catch (error) {
                alert('배달 매장 추가 실패');
            }
            return;
        }

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

    const handleDeleteVendor = async (vendor) => {
        if (!window.confirm(`"${vendor.name || vendor}" 거래처를 삭제하시겠습니까?`)) return;
        try {
            if (vendor.id) {
                await api.delete(`/vendors/id/${vendor.id}`);
            } else {
                await api.delete(`/vendors/${encodeURIComponent(typeof vendor === 'string' ? vendor : vendor.name)}`);
            }
            await fetchVendors();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleDeleteStore = async (storeName) => {
        if (!window.confirm(`"${storeName}" 매장 그룹을 삭제하시겠습니까?\n포함된 현금/카드/페이/배달앱 매출 항목이 모두 삭제됩니다.`)) return;
        const groupVendors = vendors.filter(v =>
            (v.category === 'store' || v.category === 'delivery') && v.item && v.item.startsWith(`${storeName}:`)
        );
        try {
            for (const v of groupVendors) {
                if (v.id) await api.delete(`/vendors/id/${v.id}`);
            }
            await fetchVendors();
        } catch (error) {
            console.error(error);
            alert('매장 삭제 실패');
        }
    };

    const handleMoveVendor = async (vendor, direction) => {
        const sameCategory = vendors.filter(v => v.vendor_type === vendor.vendor_type && v.category === vendor.category);
        const currentIndex = sameCategory.findIndex(v => v.name === vendor.name);
        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= sameCategory.length) return;
        const otherVendor = sameCategory[newIndex];
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
            if (vendor.id) {
                await api.patch(`/vendors/${vendor.id}`, updates);
            } else {
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
        setMergeTarget(selectedForMerge[0]);
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
        const isIdMerge = (typeof mergeTarget === 'number');
        try {
            let response;
            if (isIdMerge) {
                const sourceIds = selectedForMerge.filter(id => id !== mergeTarget);
                response = await api.post(`/vendors/${mergeTarget}/merge`, { source_ids: sourceIds });
            } else {
                const sourceNames = selectedForMerge.map(id => {
                    const v = getVendorById(id);
                    return v ? v.name : id;
                });
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
                        <div className="header-icon">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <h1>거래처 관리</h1>
                            <p className="header-subtitle">Vendor Settings</p>
                        </div>
                    </header>
                    <div className="vendor-settings-content">
                        <div className="settings-top-bar">
                            <div className="tabs">
                                <button
                                    className={`tab ${activeTab === 'expense' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('expense')}
                                >
                                    지출 관리 (매입)
                                </button>
                                <button
                                    className={`tab ${activeTab === 'revenue' ? 'active' : ''}`}
                                    onClick={() => setActiveTab('revenue')}
                                >
                                    수입 관리 (매출)
                                </button>
                            </div>
                            {/* Sorting Control */}
                            <div className="controls-right">
                                <div className="month-control">
                                    <span className="control-label">기간: </span>
                                    <button
                                        onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', color: '#374151' }}
                                    >◀</button>
                                    <input
                                        type="month"
                                        value={`${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}`}
                                        onChange={handleMonthChange}
                                        className="month-input"
                                    />
                                    <button
                                        onClick={() => setSelectedDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                                        style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', padding: '4px 8px', fontSize: '14px', color: '#374151' }}
                                    >▶</button>
                                </div>
                                <div className="sorting-control">
                                    <span className="control-label">정렬: </span>
                                    <select value={sortBy} onChange={handleSortChange} className="sort-select">
                                        <option value="name">가나다순 (기본)</option>
                                        <option value="recent">최근 거래일자순</option>
                                        <option value="frequency">거래 빈도순 (많이)</option>
                                        <option value="amount">거래 총액순 (높은금액)</option>
                                    </select>
                                </div>
                                <label className="active-filter-toggle" style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', color: '#d1d5db' }}>
                                    <input
                                        type="checkbox"
                                        checked={showActiveOnly}
                                        onChange={(e) => setShowActiveOnly(e.target.checked)}
                                        style={{ accentColor: '#3b82f6' }}
                                    />
                                    해당월 거래처만
                                </label>
                            </div>
                        </div>
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
                    </div>

                    {/* Merge Action Bar */}
                    <MergeActionBar
                        selectedForMerge={selectedForMerge}
                        handleOpenMergeModal={handleOpenMergeModal}
                        setSelectedForMerge={setSelectedForMerge}
                    />

                    {loading ? (
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                        </div>
                    ) : (
                        <div className="vendor-categories">
                            {/* Uncategorized Vendors Section */}
                            <CategoryManager
                                vendors={vendors}
                                editingVendor={editingVendor}
                                setEditingVendor={setEditingVendor}
                                editingName={editingName}
                                setEditingName={setEditingName}
                                handleVendorNameClick={handleVendorNameClick}
                                handleVendorNameSave={handleVendorNameSave}
                                handleUpdateVendor={handleUpdateVendor}
                                handleDeleteVendor={handleDeleteVendor}
                                selectedForMerge={selectedForMerge}
                                setSelectedForMerge={setSelectedForMerge}
                                handleToggleMergeSelect={handleToggleMergeSelect}
                                handleOpenMergeModal={handleOpenMergeModal}
                                collapsedCategories={collapsedCategories}
                                toggleCategory={toggleCategory}
                            />

                            {/* Categorized Vendor List */}
                            <VendorList
                                categories={getCategories()}
                                getVendorsByCategory={getVendorsByCategory}
                                activeTab={activeTab}
                                vendors={vendors}
                                setVendors={setVendors}
                                editingVendor={editingVendor}
                                setEditingVendor={setEditingVendor}
                                handleUpdateVendor={handleUpdateVendor}
                                handleMoveVendor={handleMoveVendor}
                                handleDeleteVendor={handleDeleteVendor}
                                handleCreateVendor={handleCreateVendor}
                                setSelectedVendor={setSelectedVendor}
                                selectedForMerge={selectedForMerge}
                                handleToggleMergeSelect={handleToggleMergeSelect}
                                handleOpenMergeModal={handleOpenMergeModal}
                                collapsedCategories={collapsedCategories}
                                toggleCategory={toggleCategory}
                                fetchVendors={fetchVendors}
                                addingCardStore={addingCardStore}
                                setAddingCardStore={setAddingCardStore}
                                newCardName={newCardName}
                                setNewCardName={setNewCardName}
                                addingPayStore={addingPayStore}
                                setAddingPayStore={setAddingPayStore}
                                newPayName={newPayName}
                                setNewPayName={setNewPayName}
                                addingDeliveryStore={addingDeliveryStore}
                                setAddingDeliveryStore={setAddingDeliveryStore}
                                newDeliveryName={newDeliveryName}
                                setNewDeliveryName={setNewDeliveryName}
                                handleDeleteStore={handleDeleteStore}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Vendor Info Management Modal */}
            {selectedVendor && (
                <VendorInfoManagement
                    vendor={selectedVendor}
                    onClose={() => setSelectedVendor(null)}
                    onVendorUpdate={fetchVendors}
                />
            )}

            {/* Merge Modal */}
            <MergeModal
                showMergeModal={showMergeModal}
                setShowMergeModal={setShowMergeModal}
                selectedForMerge={selectedForMerge}
                mergeTarget={mergeTarget}
                setMergeTarget={setMergeTarget}
                customMergeName={customMergeName}
                setCustomMergeName={setCustomMergeName}
                getVendorById={getVendorById}
                getCategoryLabel={getCategoryLabel}
                handleMerge={handleMerge}
            />

            {/* Add Store Modal */}
            {isAddStoreModalOpen && (
                <div className="modal-overlay" onClick={() => setIsAddStoreModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>매장 추가</h3>
                            <button className="close-btn" onClick={() => setIsAddStoreModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>매장 이름</label>
                                <input
                                    type="text"
                                    value={newStoreName}
                                    onChange={(e) => setNewStoreName(e.target.value)}
                                    placeholder="예: 강남점, 부산점"
                                    className="modal-input"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddStore();
                                        if (e.key === 'Escape') setIsAddStoreModalOpen(false);
                                    }}
                                />
                            </div>
                            <p className="modal-help-text">
                                매장을 추가하면 해당 매장의 '현금매출'과 '카드매출' 항목이 자동으로 생성됩니다.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="cancel-btn" onClick={() => setIsAddStoreModalOpen(false)}>취소</button>
                            <button className="confirm-btn" onClick={handleAddStore}>추가</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
