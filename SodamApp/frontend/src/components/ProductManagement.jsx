import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit2, Check, Package } from 'lucide-react';
import api from '../api';
import './ProductManagement.css';

const TAX_TYPES = [
    { id: 'taxable', label: '과세' },
    { id: 'tax_free', label: '면세' },
    { id: 'zero_rated', label: '영세' },
];

export default function ProductManagement({ vendor, onClose }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    const [newProduct, setNewProduct] = useState({
        name: '',
        spec: '',
        unit_price: 0,
        tax_type: 'taxable',
        note: ''
    });

    const [editProduct, setEditProduct] = useState({});

    useEffect(() => {
        if (vendor?.id) {
            fetchProducts();
        }
    }, [vendor]);

    const fetchProducts = async () => {
        try {
            const response = await api.get(`/api/products?vendor_id=${vendor.id}`);
            if (response.data.status === 'success') {
                setProducts(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching products:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async () => {
        if (!newProduct.name.trim()) {
            alert('제품명을 입력해주세요.');
            return;
        }

        if (!vendor.id) {
            alert('업체 정보가 없습니다. 페이지를 새로고침해주세요.');
            return;
        }

        try {
            console.log('Adding product:', { ...newProduct, vendor_id: vendor.id });
            const response = await api.post('/api/products', {
                ...newProduct,
                vendor_id: vendor.id,
                unit_price: parseInt(newProduct.unit_price) || 0
            });
            console.log('Response:', response.data);
            await fetchProducts();
            setNewProduct({ name: '', spec: '', unit_price: 0, tax_type: 'taxable', note: '' });
            setShowAddForm(false);
        } catch (error) {
            console.error('Add product error:', error.response?.data || error.message);
            alert('제품 추가 실패: ' + (error.response?.data?.detail || error.message));
        }
    };

    const handleUpdate = async (productId) => {
        try {
            await api.put(`/api/products/${productId}`, {
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
        if (!window.confirm('이 제품을 삭제하시겠습니까?')) return;

        try {
            await api.delete(`/api/products/${productId}`);
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
            note: product.note || ''
        });
    };

    const formatPrice = (price) => {
        return new Intl.NumberFormat('ko-KR').format(price);
    };

    return (
        <div className="product-modal-overlay" onClick={onClose}>
            <div className="product-modal" onClick={(e) => e.stopPropagation()}>
                <header className="product-modal-header">
                    <div className="header-title">
                        <Package size={20} />
                        <h2>{vendor.name} 취급상품</h2>
                    </div>
                    <button onClick={onClose} className="close-btn">
                        <X size={20} />
                    </button>
                </header>

                <div className="product-modal-content">
                    {/* Add Product Button */}
                    {!showAddForm && (
                        <button
                            onClick={() => setShowAddForm(true)}
                            className="add-product-btn"
                        >
                            <Plus size={16} />
                            새 제품 추가
                        </button>
                    )}

                    {/* Add Form */}
                    {showAddForm && (
                        <div className="product-add-form">
                            <h4>새 제품 추가</h4>
                            <div className="form-grid">
                                <input
                                    type="text"
                                    placeholder="제품명 *"
                                    value={newProduct.name}
                                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                />
                                <input
                                    type="text"
                                    placeholder="규격"
                                    value={newProduct.spec}
                                    onChange={(e) => setNewProduct({ ...newProduct, spec: e.target.value })}
                                />
                                <input
                                    type="number"
                                    placeholder="단가"
                                    value={newProduct.unit_price}
                                    onChange={(e) => setNewProduct({ ...newProduct, unit_price: e.target.value })}
                                />
                                <select
                                    value={newProduct.tax_type}
                                    onChange={(e) => setNewProduct({ ...newProduct, tax_type: e.target.value })}
                                >
                                    {TAX_TYPES.map(t => (
                                        <option key={t.id} value={t.id}>{t.label}</option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    placeholder="비고"
                                    value={newProduct.note}
                                    onChange={(e) => setNewProduct({ ...newProduct, note: e.target.value })}
                                    className="note-input"
                                />
                            </div>
                            <div className="form-actions">
                                <button onClick={() => setShowAddForm(false)} className="cancel-btn">취소</button>
                                <button onClick={handleAdd} className="save-btn">추가</button>
                            </div>
                        </div>
                    )}

                    {/* Products Table */}
                    {loading ? (
                        <div className="loading">로딩 중...</div>
                    ) : products.length === 0 ? (
                        <div className="empty-message">
                            <Package size={48} strokeWidth={1} />
                            <p>등록된 제품이 없습니다</p>
                        </div>
                    ) : (
                        <table className="products-table">
                            <thead>
                                <tr>
                                    <th>제품명</th>
                                    <th>규격</th>
                                    <th>단가</th>
                                    <th>과세</th>
                                    <th>비고</th>
                                    <th>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.map(product => (
                                    <tr key={product.id}>
                                        {editingId === product.id ? (
                                            <>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={editProduct.name}
                                                        onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={editProduct.spec}
                                                        onChange={(e) => setEditProduct({ ...editProduct, spec: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        value={editProduct.unit_price}
                                                        onChange={(e) => setEditProduct({ ...editProduct, unit_price: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <select
                                                        value={editProduct.tax_type}
                                                        onChange={(e) => setEditProduct({ ...editProduct, tax_type: e.target.value })}
                                                    >
                                                        {TAX_TYPES.map(t => (
                                                            <option key={t.id} value={t.id}>{t.label}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td>
                                                    <input
                                                        type="text"
                                                        value={editProduct.note}
                                                        onChange={(e) => setEditProduct({ ...editProduct, note: e.target.value })}
                                                    />
                                                </td>
                                                <td>
                                                    <button onClick={() => handleUpdate(product.id)} className="icon-btn save">
                                                        <Check size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="icon-btn cancel">
                                                        <X size={14} />
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{product.name}</td>
                                                <td>{product.spec || '-'}</td>
                                                <td className="price">{formatPrice(product.unit_price)}원</td>
                                                <td>
                                                    <span className={`tax-badge ${product.tax_type}`}>
                                                        {TAX_TYPES.find(t => t.id === product.tax_type)?.label || product.tax_type}
                                                    </span>
                                                </td>
                                                <td>{product.note || '-'}</td>
                                                <td>
                                                    <button onClick={() => startEdit(product)} className="icon-btn edit">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => handleDelete(product.id)} className="icon-btn delete">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
