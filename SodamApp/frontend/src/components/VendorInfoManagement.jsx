import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Edit2, Check, Package, Building2, Save, Phone, MapPin, FileText, ImagePlus, ShieldCheck, AlertCircle, Loader2, Sparkles } from 'lucide-react';
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

    // 사업자등록상태 조회 (Popbill ClosedownService)
    const [bizChecking, setBizChecking] = useState(false);
    const [bizResult, setBizResult] = useState(null); // { ok, state_label, tax_type_label, state_date, error }

    // 기업정보 조회 (Popbill BizInfoCheckService) — 자동채움용
    const [bizInfoFetching, setBizInfoFetching] = useState(false);
    const [bizInfo, setBizInfo] = useState(null);

    const handleBizCheck = async () => {
        const raw = (vendorInfo.business_reg_number || '').replace(/\D/g, '');
        if (raw.length !== 10) {
            setBizResult({ ok: false, error: '사업자번호 10자리를 입력하세요.' });
            return;
        }
        setBizChecking(true);
        setBizResult(null);
        try {
            const res = await api.post('/biz-check', { corp_num: raw });
            setBizResult(res.data);
        } catch (e) {
            setBizResult({
                ok: false,
                error: e?.response?.data?.detail || '조회 중 오류가 발생했습니다.',
            });
        } finally {
            setBizChecking(false);
        }
    };

    const handleBizInfoFetch = async () => {
        const raw = (vendorInfo.business_reg_number || '').replace(/\D/g, '');
        if (raw.length !== 10) {
            setBizInfo({ ok: false, error: '사업자번호 10자리를 입력하세요.' });
            return;
        }
        if (!window.confirm('기업정보 조회는 건당 약 88원이 발생합니다. 진행할까요?')) return;
        setBizInfoFetching(true);
        setBizInfo(null);
        try {
            const res = await api.post('/bizinfo-check', { corp_num: raw });
            setBizInfo(res.data);
            // 비어있는 필드만 자동 채움 (기존 값 덮어쓰지 않음)
            if (res.data?.ok) {
                const patch = {};
                if (!vendorInfo.phone && res.data.phone) patch.phone = res.data.phone;
                if (!vendorInfo.address && res.data.address) patch.address = res.data.address;
                if (Object.keys(patch).length > 0) {
                    setVendorInfo({ ...vendorInfo, ...patch });
                }
            }
        } catch (e) {
            setBizInfo({
                ok: false,
                error: e?.response?.data?.detail || '조회 중 오류가 발생했습니다.',
            });
        } finally {
            setBizInfoFetching(false);
        }
    };


    // Products State
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [imageUploading, setImageUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const addImageInputRef = useRef(null);
    const editImageInputRef = useRef(null);

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

    const handleImageUpload = async (file, target) => {
        if (!file) return;
        setImageUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await api.post('/products/upload-image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (response.data.status === 'success') {
                const url = response.data.url;
                if (target === 'new') {
                    setNewProduct(prev => ({ ...prev, image_url: url }));
                } else {
                    setEditProduct(prev => ({ ...prev, image_url: url }));
                }
            }
        } catch (error) {
            alert('이미지 업로드 실패: ' + (error.response?.data?.detail || error.message));
        } finally {
            setImageUploading(false);
        }
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
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                        type="text"
                                        value={vendorInfo.business_reg_number}
                                        onChange={(e) => {
                                            setVendorInfo({
                                                ...vendorInfo,
                                                business_reg_number: formatBizNumber(e.target.value)
                                            });
                                            setBizResult(null);
                                        }}
                                        placeholder="예: 123-45-67890"
                                        className="field-input"
                                        maxLength={12}
                                        style={{ flex: 1 }}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleBizCheck}
                                        disabled={bizChecking || (vendorInfo.business_reg_number || '').replace(/\D/g, '').length !== 10}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '0 14px',
                                            borderRadius: 8,
                                            border: '1px solid #cbd5e1',
                                            background: '#f8fafc',
                                            color: '#0f172a',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: bizChecking ? 'wait' : 'pointer',
                                            opacity: bizChecking ? 0.6 : 1,
                                            whiteSpace: 'nowrap',
                                        }}
                                        title="팝빌 사업자등록상태 조회 (건당 ~30원)"
                                    >
                                        {bizChecking ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                                        {bizChecking ? '조회 중...' : '상태확인'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleBizInfoFetch}
                                        disabled={bizInfoFetching || (vendorInfo.business_reg_number || '').replace(/\D/g, '').length !== 10}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            padding: '0 14px',
                                            borderRadius: 8,
                                            border: '1px solid #6366f1',
                                            background: '#eef2ff',
                                            color: '#4338ca',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            cursor: bizInfoFetching ? 'wait' : 'pointer',
                                            opacity: bizInfoFetching ? 0.6 : 1,
                                            whiteSpace: 'nowrap',
                                        }}
                                        title="팝빌 기업정보 조회 - 상호/주소/전화/업태/종목 자동채움 (건당 ~88원)"
                                    >
                                        {bizInfoFetching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        {bizInfoFetching ? '조회 중...' : '자동채움'}
                                    </button>
                                </div>
                                {bizResult && (
                                    <div style={{
                                        marginTop: 8,
                                        padding: '8px 12px',
                                        borderRadius: 8,
                                        fontSize: 12,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        ...(bizResult.ok
                                            ? {
                                                background: bizResult.state === '01' ? '#ecfdf5' : '#fef2f2',
                                                color: bizResult.state === '01' ? '#047857' : '#b91c1c',
                                                border: `1px solid ${bizResult.state === '01' ? '#86efac' : '#fecaca'}`,
                                            }
                                            : {
                                                background: '#fefce8',
                                                color: '#a16207',
                                                border: '1px solid #fde68a',
                                            }
                                        ),
                                    }}>
                                        {bizResult.ok ? (
                                            bizResult.state === '01'
                                                ? <><Check size={14} /> {bizResult.state_label || '정상(등록)'} · {bizResult.tax_type_label || '과세유형 미지정'}</>
                                                : <><AlertCircle size={14} /> {bizResult.state_label || '확인됨'} — 거래 주의 {bizResult.state_date ? `(변경일 ${bizResult.state_date})` : ''}</>
                                        ) : (
                                            <><AlertCircle size={14} /> {bizResult.error || '조회 실패'}</>
                                        )}
                                    </div>
                                )}
                                {bizInfo && (
                                    <div style={{
                                        marginTop: 8,
                                        padding: 12,
                                        borderRadius: 8,
                                        fontSize: 12,
                                        border: bizInfo.ok ? '1px solid #c7d2fe' : '1px solid #fecaca',
                                        background: bizInfo.ok ? '#eef2ff' : '#fef2f2',
                                        color: bizInfo.ok ? '#3730a3' : '#b91c1c',
                                    }}>
                                        {bizInfo.ok ? (
                                            <>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 6 }}>
                                                    <Sparkles size={14} /> 기업정보 조회 성공
                                                    <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6366f1' }}>
                                                        빈 필드는 자동채움, 기존 값은 유지
                                                    </span>
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, color: '#312e81' }}>
                                                    {bizInfo.company_name && <div><b>상호</b>: {bizInfo.company_name}</div>}
                                                    {bizInfo.ceo_name && <div><b>대표자</b>: {bizInfo.ceo_name}</div>}
                                                    {bizInfo.biz_class && <div><b>업태</b>: {bizInfo.biz_class}</div>}
                                                    {bizInfo.biz_type && <div><b>종목</b>: {bizInfo.biz_type}</div>}
                                                    {bizInfo.phone && <div><b>전화</b>: {bizInfo.phone}</div>}
                                                    {bizInfo.company_size && <div><b>규모</b>: {bizInfo.company_size}</div>}
                                                    {bizInfo.address && <div style={{ gridColumn: '1 / -1' }}><b>주소</b>: {bizInfo.address}</div>}
                                                    {bizInfo.establish_date && <div><b>설립일</b>: {bizInfo.establish_date}</div>}
                                                    {bizInfo.listed_market && <div><b>상장시장</b>: {bizInfo.listed_market}</div>}
                                                </div>
                                            </>
                                        ) : (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertCircle size={14} /> {bizInfo.error || '기업정보 조회 실패'}
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                            <label>이미지</label>
                                            <div className="image-upload-group">
                                                <input
                                                    type="url"
                                                    placeholder="https://..."
                                                    value={newProduct.image_url}
                                                    onChange={(e) => setNewProduct({ ...newProduct, image_url: e.target.value })}
                                                />
                                                <input
                                                    type="file"
                                                    ref={addImageInputRef}
                                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => handleImageUpload(e.target.files[0], 'new')}
                                                />
                                                <button
                                                    type="button"
                                                    className="image-upload-btn"
                                                    onClick={() => addImageInputRef.current?.click()}
                                                    disabled={imageUploading}
                                                    title="이미지 업로드"
                                                >
                                                    <ImagePlus size={16} />
                                                </button>
                                            </div>
                                            {newProduct.image_url && (
                                                <div className="image-preview-small">
                                                    <img src={newProduct.image_url} alt="미리보기" onError={(e) => { e.target.style.display = 'none'; }} />
                                                </div>
                                            )}
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
                                                        <div className="image-upload-group">
                                                            <input
                                                                type="url"
                                                                value={editProduct.image_url}
                                                                onChange={(e) => setEditProduct({ ...editProduct, image_url: e.target.value })}
                                                                placeholder="이미지 URL"
                                                            />
                                                            <input
                                                                type="file"
                                                                ref={editImageInputRef}
                                                                accept="image/jpeg,image/png,image/gif,image/webp"
                                                                style={{ display: 'none' }}
                                                                onChange={(e) => handleImageUpload(e.target.files[0], 'edit')}
                                                            />
                                                            <button
                                                                type="button"
                                                                className="image-upload-btn"
                                                                onClick={() => editImageInputRef.current?.click()}
                                                                disabled={imageUploading}
                                                                title="이미지 업로드"
                                                            >
                                                                <ImagePlus size={16} />
                                                            </button>
                                                        </div>
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
                                                            <div className="product-image" onClick={() => setPreviewImage({ url: product.image_url, name: product.name })} style={{ cursor: 'pointer' }}>
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
            {/* Image Preview Lightbox */}
            {previewImage && (
                <div className="image-lightbox-overlay" onClick={() => setPreviewImage(null)}>
                    <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
                        <button className="image-lightbox-close" onClick={() => setPreviewImage(null)}>
                            <X size={24} />
                        </button>
                        <img src={previewImage.url} alt={previewImage.name} />
                        <p className="image-lightbox-caption">{previewImage.name}</p>
                    </div>
                </div>
            )}
        </div>
    );
}
