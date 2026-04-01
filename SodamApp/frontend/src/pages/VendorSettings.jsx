import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit2, X, Check, Building2, Package, GitMerge } from 'lucide-react';
import api from '../api';
import './VendorSettings.css';
import VendorInfoManagement from '../components/VendorInfoManagement';
// 매입처 카테고리 정의 (백엔드 CATEGORY_TO_PL_FIELD와 동기화)
// Note: 인건비는 Payroll에서 자동 동기화, 퇴직금적립은 인건비×10% 자동계산
const EXPENSE_CATEGORIES = [
    { id: '원재료비', label: '원재료비', icon: '🥬' },
    { id: '소모품비', label: '소모품비', icon: '📦' },
    { id: '수도광열비', label: '수도광열비', icon: '💡' },
    { id: '임차료', label: '임차료', icon: '🏠' },
    { id: '수선비', label: '수선비', icon: '🔧' },
    { id: '감가상각비', label: '감가상각비', icon: '⚙️' },
    { id: '세금과공과', label: '세금과공과', icon: '🏛️' },
    { id: '보험료', label: '보험료', icon: '🛡️' },
    { id: '인건비', label: '인건비', icon: '👷' },
    { id: '카드수수료', label: '카드수수료', icon: '💳' },
    { id: '기타경비', label: '기타경비', icon: '📋' },
    { id: '개인가계부', label: '개인가계부', icon: '👤' },
];
// 매출처 카테고리 정의
const REVENUE_CATEGORIES = [
    { id: 'delivery', label: '배달앱매출', icon: '🛵' },
    { id: 'store', label: '매장매출', icon: '🏪' },
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
    const [collapsedCategories, setCollapsedCategories] = useState(new Set());
    // Sorting State
    const [sortBy, setSortBy] = useState('name'); // 'name', 'recent', 'frequency', 'amount'
    const [showActiveOnly, setShowActiveOnly] = useState(true); // 해당월 거래처만 보기
    // Monthly Stats State
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Add Store Modal State
    const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
    const [newStoreName, setNewStoreName] = useState('');
    // Add Card Company State
    const [addingCardStore, setAddingCardStore] = useState(null);
    const [newCardName, setNewCardName] = useState('');
    // Add Pay Company State
    const [addingPayStore, setAddingPayStore] = useState(null);
    const [newPayName, setNewPayName] = useState('');
    // Add Delivery App State
    const [addingDeliveryStore, setAddingDeliveryStore] = useState(null);
    const [newDeliveryName, setNewDeliveryName] = useState('');

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

    const DELIVERY_APPS = ['배달의민족', '쿠팡이츠', '땡겨요', '요기요'];

    const handleAddStore = async () => {
        if (!newStoreName.trim()) return;
        const name = newStoreName.trim();
        try {
            // Store Revenue
            await handleCreateVendor({
                name: `${name} 현금매출`,
                category: 'store',
                vendor_type: 'revenue',
                item: `${name}:cash`
            });

            // Automated Card Companies
            const CARD_COMPANIES = ['농협카드', '신한카드', '삼성카드', '국민카드', '롯데카드', '현대카드', '우리카드', '하나카드', 'BC카드'];

            for (const company of CARD_COMPANIES) {
                await handleCreateVendor({
                    name: `${name} ${company}`,
                    category: 'store',
                    vendor_type: 'revenue',
                    item: `${name}:card`
                });
            }

            // Automated Pay Services
            const PAY_SERVICES = ['서울페이', '제로페이', '네이버페이', '카카오페이', '애플페이', '삼성페이'];

            for (const pay of PAY_SERVICES) {
                await handleCreateVendor({
                    name: `${name} ${pay}`,
                    category: 'store',
                    vendor_type: 'revenue',
                    item: `${name}:pay`
                });
            }

            // Delivery App Revenue
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
    const handleSortChange = (e) => {
        setSortBy(e.target.value);
    };
    const handleMonthChange = (e) => {
        const [year, month] = e.target.value.split('-');
        setSelectedDate(new Date(year, month - 1));
    };
    const toggleCategory = (categoryId) => {
        setCollapsedCategories(prev => {
            const newSet = new Set(prev);
            if (newSet.has(categoryId)) {
                newSet.delete(categoryId);
            } else {
                newSet.add(categoryId);
            }
            return newSet;
        });
    };
    useEffect(() => {
        fetchVendors();
    }, [selectedDate]);
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
            const year = selectedDate.getFullYear();
            const month = selectedDate.getMonth() + 1;
            const response = await api.get(`/vendors?year=${year}&month=${month}`);
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
        let filtered = vendors.filter(v =>
            v.vendor_type === activeTab && v.category === category
        );
        // 해당월 거래내역이 있는 업체만 필터링
        if (showActiveOnly) {
            filtered = filtered.filter(v => (v.transaction_count || 0) > 0);
        }
        // Apply Sorting
        return filtered.sort((a, b) => {
            if (sortBy === 'name') {
                return (a.order_index || 0) - (b.order_index || 0) || a.name.localeCompare(b.name);
            } else if (sortBy === 'recent') {
                // Latest date first. Handle nulls (never transacted)
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
                // 1. Cash Revenue
                await handleCreateVendor({
                    name: `${storeName} 현금매출`,
                    category: 'store',
                    vendor_type: 'revenue',
                    item: `${storeName}:cash`
                });

                // 2. Automated Card Companies
                const CARD_COMPANIES = ['농협카드', '신한카드', '삼성카드', '국민카드', '롯데카드', '현대카드', '우리카드', '하나카드', 'BC카드'];

                for (const company of CARD_COMPANIES) {
                    await handleCreateVendor({
                        name: `${storeName} ${company}`,
                        category: 'store',
                        vendor_type: 'revenue',
                        item: `${storeName}:card`
                    });
                }

                // 3. Automated Pay Services
                const PAY_SERVICES = ['서울페이', '제로페이', '네이버페이', '카카오페이', '애플페이', '삼성페이'];

                for (const pay of PAY_SERVICES) {
                    await handleCreateVendor({
                        name: `${storeName} ${pay}`,
                        category: 'store',
                        vendor_type: 'revenue',
                        item: `${storeName}:pay`
                    });
                }

                // 4. Delivery App Revenue
                for (const app of DELIVERY_APPS) {
                    await handleCreateVendor({
                        name: `${storeName} ${app}`,
                        category: 'delivery',
                        vendor_type: 'revenue',
                        item: `${storeName}:delivery`
                    });
                }

                setNewVendorName('');
            } catch (error) {
                alert('매장 추가 실패');
            }
            return;
        }

        // Custom Logic for 'Delivery Revenue' - auto-create delivery apps per store
        if (activeTab === 'revenue' && newVendorCategory === 'delivery') {
            const storeName = newVendorName.trim();
            const exists = vendors.some(v => v.category === 'delivery' && v.item && v.item.startsWith(`${storeName}:`));
            if (exists) {
                alert('이미 존재하는 배달 매장입니다.');
                return;
            }
            try {
                for (const app of DELIVERY_APPS) {
                    await handleCreateVendor({
                        name: `${storeName} ${app}`,
                        category: 'delivery',
                        vendor_type: 'revenue',
                        item: `${storeName}:delivery`
                    });
                }
                setNewVendorName('');
            } catch (error) {
                alert('배달 매장 추가 실패');
            }
            return;
        }

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
    const handleDeleteVendor = async (vendor) => {
        if (!window.confirm(`"${vendor.name}" 거래처를 삭제하시겠습니까?`)) return;
        try {
            if (vendor.id) {
                await api.delete(`/vendors/id/${vendor.id}`);
            } else {
                await api.delete(`/vendors/${encodeURIComponent(vendor.name)}`);
            }
            await fetchVendors();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const handleDeleteStore = async (storeName) => {
        if (!window.confirm(`"${storeName}" 매장 그룹을 삭제하시겠습니까?\n포함된 현금/카드/페이/배달앱 매출 항목이 모두 삭제됩니다.`)) return;

        // Find all vendors in this store group (store + delivery categories)
        const groupVendors = vendors.filter(v =>
            (v.category === 'store' || v.category === 'delivery') && v.item && v.item.startsWith(`${storeName}:`)
        );

        try {
            for (const v of groupVendors) {
                if (v.id) {
                    await api.delete(`/vendors/id/${v.id}`);
                }
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
                                        )}
                                    </div>
                                );
                            })()}
                            {getCategories().map(category => {
                                const categoryVendors = getVendorsByCategory(category.id);
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
                                                        // Strip Store Name prefix if nested
                                                        if (isNested && vendor.item && vendor.item.includes(':')) {
                                                            const [storeName] = vendor.item.split(':');
                                                            if (vendor.name.startsWith(storeName + ' ')) {
                                                                return vendor.name.substring(storeName.length + 1);
                                                            }
                                                            // Also handle connected case if spaces differ? 
                                                            if (vendor.name.startsWith(storeName)) { // heuristic
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
                                if (category.id === 'delivery') {
                                    // Group delivery vendors by store name
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
                                    // 1. Group by Store Name (from item "StoreName:Type")
                                    const storeGroups = {};
                                    // Default group just in case
                                    categoryVendors.forEach(v => {
                                        const itemStr = v.item || '';
                                        let storeName = '소담김밥'; // Default
                                        let type = 'other';
                                        if (itemStr && itemStr.includes(':')) {
                                            const parts = itemStr.split(':');
                                            storeName = parts[0];
                                            type = parts[1];
                                        } else {
                                            // Fallback for legacy or unmigrated
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
                        </div>
                    )}
                </div>
            </div>
            {/* Vendor Info Management Modal */}
            {
                selectedVendor && (
                    <VendorInfoManagement
                        vendor={selectedVendor}
                        onClose={() => setSelectedVendor(null)}
                        onVendorUpdate={fetchVendors}
                    />
                )
            }
            {/* Merge Modal */}
            {
                showMergeModal && (
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
                )
            }
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
