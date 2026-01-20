import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, Edit2, X, Check } from 'lucide-react';
import api from '../api';
import './VendorSettings.css';

// 매입처 카테고리 정의
const EXPENSE_CATEGORIES = [
    { id: 'food', label: '식자재', icon: '🥬' },
    { id: 'supplies', label: '소모품', icon: '📦' },
    { id: 'equipment', label: '비품', icon: '🔧' },
    { id: 'rent', label: '임대관리', icon: '🏢' },
    { id: 'utility', label: '제세공과금', icon: '💡' },
    { id: 'labor', label: '인건비', icon: '👷' },
    { id: 'card_fee', label: '카드수수료', icon: '💳' },
    { id: 'marketing', label: '광고마케팅', icon: '📢' },
    { id: 'insurance', label: '보험', icon: '🛡️' },
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

    useEffect(() => {
        fetchVendors();
    }, []);

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
        if (vendors.some(v => v.name === newVendorName.trim())) {
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
            await api.post('/vendors', { ...vendor, ...updates });
            await fetchVendors();
        } catch (error) {
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

    return (
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

                {loading ? (
                    <div className="loading-spinner">
                        <div className="spinner"></div>
                    </div>
                ) : (
                    <div className="vendor-categories">
                        {/* Uncategorized Vendors Section */}
                        {(() => {
                            const allCategoryIds = getCategories().map(c => c.id);
                            const uncategorizedVendors = vendors.filter(v =>
                                !v.category || !allCategoryIds.includes(v.category)
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
                                                <div key={vendor.name} className="vendor-item-compact">
                                                    <span className="vendor-order">{idx + 1}</span>
                                                    <span className="vendor-name-display">{vendor.name}</span>
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
                                                    <div className="vendor-actions-compact">
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
    );
}
