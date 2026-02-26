import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Package, Building2, Save, Phone, MapPin, FileText } from 'lucide-react';
import api from '../api';
import './VendorInfoManagement.css';

const TAX_TYPES = [
    { id: 'taxable', label: '과세' },
    { id: 'tax_free', label: '면세' },
    { id: 'zero_rated', label: '영세' },
];

export default function VendorInfoManagement({ vendor, onClose, onVendorUpdate }) {
    const [activeTab, setActiveTab] = useState('info'); // 'info' or 'products'

    // Vendor Info State
    const [vendorInfo, setVendorInfo] = useState({
        phone: vendor.phone || '',
        address: vendor.address || '',
        business_reg_number: vendor.business_reg_number || '',
    });
    const [infoSaving, setInfoSaving] = useState(false);
    const [infoSaved, setInfoSaved] = useState(false);

    // Products State
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: '',
        spec: '',
        unit_price: 0,
        tax_type: 'taxable',
        manufacturer: '',
        note: '',
        image_url: ''
    });

    const [editProduct, setEditProduct] = useState({});

    useEffect(() => {
        if (vendor?.id) {
            fetchProducts();
        }
    }, [vendor]);

    const fetchProducts = async () => {
        try {
            const response = await api.get(`/products?vendor_id=${vendor.id}`);
            if (response.data.status === 'success') {
                setProducts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- Vendor Info Handlers ---
    const handleSaveInfo = async () => {
        setInfoSaving(true);
        try {
            await api.patch(`/vendors/${vendor.id}`, {
                phone: vendorInfo.phone,
                address: vendorInfo.address,
                business_reg_number: vendorInfo.business_reg_number,
            });
            setInfoSaved(true);
            setTimeout(() => setInfoSaved(false), 2000);
            if (onVendorUpdate) onVendorUpdate();
        } catch (error) {
            console.error('Save vendor info error:', error);
            alert('저장 실패: ' + (error.response?.data?.detail || error.message));
        } finally {
            setInfoSaving(false);
        }
    };

    const formatBizNumber = (value) => {
        // Format as XXX-XX-XXXXX
        const digits = value.replace(/\D/g, '').slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
    };

    // --- Product Handlers ---
    const handleAdd = async () => {
        if (!newProduct.name.trim()) {
            alert('품목명을 입력해주세요.');
            return;
        }
        try {
            await api.post('/products', {
                ...newProduct,
                vendor_id: vendor.id,
                unit_price: parseInt(newProduct.unit_price) || 0
            });
            await fetchProducts();
            setNewProduct({ name: '', spec: '', unit_price: 0, tax_type: 'taxable', manufacturer: '', note: '', image_url: '' });
            setShowAddForm(false);
        } catch (error) {
            alert('품목 추가 실패: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleUpdate = async (productId) => {
        try {
            await api.put(`/products/${productId}`, {
                ...editProduct,
                unit_price: parseInt(editProduct.unit_price) || 0
            });
            await fetchProducts();
            setEditingId(null);
        } catch (error) {
            alert('수정 실패');
        }
    };

    const handleDelete = async (productId) => {
        if (!window.confirm('이 품목을 삭제하시겠습니까?')) return;
        try {
            await api.delete(`/products/${productId}`);
            await fetchProducts();
        } catch (error) {
            alert('삭제 실패');
        }
    };

    const startEdit = (product) => {
        setEditingId(product.id);
        setEditProduct({
            name: product.name,
            spec: product.spec || '',
            unit_price: product.unit_price,
            tax_type: product.tax_type,
            manufacturer: product.manufacturer || '',
            note: product.note || '',
            image_url: product.image_url || ''
        });
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ko-KR').format(price);
    };

    return (
        <div className="vendor-info-modal-overlay" onClick={onClose}>
            <div className="vendor-info-modal" onClick={(e) => e.stopPropagation()}>
                <header className="vendor-info-modal-header">
                    <div className="header-title">
                        <Building2 size={20} />
                        <h2>{vendor.name}</h2>
                    </div>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </header>

                {/* Tab Bar */}
                <div className="vendor-info-tabs">
                    <button
                        className={`vendor-info-tab ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        <Building2 size={16} />
                        업체 정보
                    </button>
                    <button
                        className={`vendor-info-tab ${activeTab === 'products' ? 'active' : ''}`}
                        onClick={() => setActiveTab('products')}
                    >
                        <Package size={16} />
                        주요 품목
                        {products.length > 0 && (
                            <span className="tab-badge">{products.length}</span>
                        )}
                    </button>
                </div>

                <div className="vendor-info-modal-content">
                    {/* Tab 1: Vendor Info */}
                    {activeTab === 'info' && (
                        <div className="vendor-info-form">
                            <div className="info-field">
                                <label>
                                    <Building2 size={14} />
                                    업체명
                                </label>
                                <input
                                    type="text"
                                    value={vendor.name}
                                    disabled
                                    className="field-input disabled"
                                />
                            </div>
                            <div className="info-field">
                                <label>
                                    <Phone size={14} />
                                    전화번호
                                </label>
                                <input
                                    type="tel"
                                    value={vendorInfo.phone}
                                    onChange={(e) => setVendorInfo({ ...vendorInfo, phone: e.target.value })}
                                    placeholder="예: 02-1234-5678"
                                    className="field-input"
                                />
                            </div>
                            <div className="info-field">
                                <label>
                                    <MapPin size={14} />
                                    주소
                                </label>
                                <input
                                    type="text"
                                    value={vendorInfo.address}
                                    onChange={(e) => setVendorInfo({ ...vendorInfo, address: e.target.value })}
                                    placeholder="예: 서울시 강남구 테헤란로 123"
                                    className="field-input"
                                />
                            </div>
                            <div className="info-field">
                                <label>
                                    <FileText size={14} />
                                    사업자등록번호
                                </label>
                                <input
                                    type="text"
                                    value={vendorInfo.business_reg_number}
                                    onChange={(e) => setVendorInfo({
                                        ...vendorInfo,
                                        business_reg_number: formatBizNumber(e.target.value)
                                    })}
                                    placeholder="예: 123-45-67890"
                                    className="field-input"
                                    maxLength={12}
                                />
                            </div>
                            <div className="info-actions">
                                <button
                                    onClick={handleSaveInfo}
                                    disabled={infoSaving}
                                    className={`save-info-btn ${infoSaved ? 'saved' : ''}`}
                                >
                                    {infoSaving ? (
                                        <span>저장 중...</span>
                                    ) : infoSaved ? (
                                        <>
                                            <Check size={16} />
                                            <span>저장됨</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save size={16} />
                                            <span>저장</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Products */}
                    {activeTab === 'products' && (
                        <div className="vendor-products-section">
                            {/* Add Product Button */}
                            {!showAddForm && (
                                <button
                                    onClick={() => setShowAddForm(true)}
                                    className="add-product-btn"
                                >
                                    <Plus size={16} />
                                    새 품목 추가
                                </button>
                            )}

                            {/* Add Form */}
                            {showAddForm && (
                                <div className="product-add-form">
                                    <h4>새 품목 추가</h4>
                                    <div className="form-grid">
                                        <div className="form-field">
                                            <label>품목명 *</label>
                                            <input
                                                type="text"
                                                placeholder="품목명"
                                                value={newProduct.name}
                                                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>규격/용량</label>
                                            <input
                                                type="text"
                                                placeholder="예: 500g, 1L"
                                                value={newProduct.spec}
                                                onChange={(e) => setNewProduct({ ...newProduct, spec: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>단가(원)</label>
                                            <input
                                                type="number"
                                                placeholder="단가"
                                                value={newProduct.unit_price}
                                                onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>과세구분</label>
                                            <select
                                                value={newProduct.tax_type}
                                                onChange={(e) => setNewProduct({ ...newProduct, tax_type: e.target.value })}
                                            >
                                                {TAX_TYPES.map(t => (
                                                    <option key={t.id} value={t.id}>{t.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-field">
                                            <label>제조사</label>
                                            <input
                                                type="text"
                                                placeholder="제조사"
                                                value={newProduct.manufacturer}
                                                onChange={(e) => setNewProduct({ ...newProduct, manufacturer: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-field">
                                            <label>이미지 URL</label>
                                            <input
                                                type="url"
                                                placeholder="https://..."
                                                value={newProduct.image_url}
                                                onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-field full-width">
                                            <label>비고</label>
                                            <input
                                                type="text"
                                                placeholder="비고"
                                                value={newProduct.note}
                                                onChange={(e) => setNewProduct({ ...newProduct, note: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-actions">
                                        <button onClick={() => setShowAddForm(false)} className="cancel-btn">취소</button>
                                        <button onClick={handleAdd} className="save-btn">추가</button>
                                    </div>
                                </div>
                            )}

                            {/* Products List */}
                            {loading ? (
                                <div className="loading">로딩 중...</div>
                            ) : products.length === 0 ? (
                                <div className="empty-message">
                                    <Package size={48} strokeWidth={1} />
                                    <p>등록된 품목이 없습니다</p>
                                    <p className="hint">위 버튼을 클릭하여 품목을 추가하세요</p>
                                </div>
                            ) : (
                                <div className="products-card-list">
                                    {products.map(product => (
                                        <div key={product.id} className="product-card">
                                            {editingId === product.id ? (
                                                <div className="product-edit-form">
                                                    <div className="edit-grid">
                                                        <input
                                                            type="text"
                                                            value={editProduct.name}
                                                            onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                                                            placeholder="품목명"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editProduct.spec}
                                                            onChange={(e) => setEditProduct({ ...editProduct, spec: e.target.value })}
                                                            placeholder="규격/용량"
                                                        />
                                                        <input
                                                            type="number"
                                                            value={editProduct.unit_price}
                                                            onChange={(e) => setEditProduct({ ...editProduct, unit_price: e.target.value })}
                                                            placeholder="단가"
                                                        />
                                                        <select
                                                            value={editProduct.tax_type}
                                                            onChange={(e) => setEditProduct({ ...editProduct, tax_type: e.target.value })}
                                                        >
                                                            {TAX_TYPES.map(t => (
                                                                <option key={t.id} value={t.id}>{t.label}</option>
                                                            ))}
                                                        </select>
                                                        <input
                                                            type="text"
                                                            value={editProduct.manufacturer}
                                                            onChange={(e) => setEditProduct({ ...editProduct, manufacturer: e.target.value })}
                                                            placeholder="제조사"
                                                        />
                                                        <input
                                                            type="url"
                                                            value={editProduct.image_url}
                                                            onChange={(e) => setEditProduct({ ...editProduct, image_url: e.target.value })}
                                                            placeholder="이미지 URL"
                                                        />
                                                        <input
                                                            type="text"
                                                            value={editProduct.note}
                                                            onChange={(e) => setEditProduct({ ...editProduct, note: e.target.value })}
                                                            placeholder="비고"
                                                            className="full-width"
                                                        />
                                                    </div>
                                                    <div className="edit-actions">
                                                        <button onClick={() => handleUpdate(product.id)} className="icon-btn save">
                                                            <Check size={14} />
                                                            저장
                                                        </button>
                                                        <button onClick={() => setEditingId(null)} className="icon-btn cancel">
                                                            <X size={14} />
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="product-card-main">
                                                        {product.image_url && (
                                                            <div className="product-image">
                                                                <img src={product.image_url} alt={product.name} onError={(e) => { e.target.style.display = 'none'; }} />
                                                            </div>
                                                        )}
                                                        <div className="product-details">
                                                            <div className="product-name-row">
                                                                <span className="product-code">{product.product_code || `#${product.id}`}</span>
                                                                <span className="product-name">{product.name}</span>
                                                                <span className={`tax-badge ${product.tax_type}`}>
                                                                    {TAX_TYPES.find(t => t.id === product.tax_type)?.label || product.tax_type}
                                                                </span>
                                                            </div>
                                                            <div className="product-meta">
                                                                {product.spec && <span className="meta-item">📏 {product.spec}</span>}
                                                                <span className="meta-item price">₩{formatPrice(product.unit_price)}</span>
                                                                {product.manufacturer && <span className="meta-item">🏭 {product.manufacturer}</span>}
                                                            </div>
                                                            {product.note && <div className="product-note">📝 {product.note}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="product-card-actions">
                                                        <button onClick={() => startEdit(product)} className="icon-btn edit" title="수정">
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button onClick={() => handleDelete(product.id)} className="icon-btn delete" title="삭제">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
