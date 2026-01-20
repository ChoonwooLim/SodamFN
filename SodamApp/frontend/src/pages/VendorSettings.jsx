import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Save, Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import api from '../api';
import './VendorSettings.css';

export default function VendorSettings() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);
    const [newVendorName, setNewVendorName] = useState('');

    useEffect(() => {
        fetchVendors();
    }, []);

    // Load vendor order from localStorage
    const getVendorOrder = () => {
        const saved = localStorage.getItem('profitloss_vendor_order');
        return saved ? JSON.parse(saved) : [];
    };

    const saveVendorOrder = (order) => {
        localStorage.setItem('profitloss_vendor_order', JSON.stringify(order));
    };

    const fetchVendors = async () => {
        try {
            const response = await api.get('/vendors');
            if (response.data.status === 'success') {
                const apiVendors = response.data.data;
                const savedOrder = getVendorOrder();

                // Merge API vendors with saved order
                const orderedVendors = [];

                // First add vendors in saved order
                savedOrder.forEach(name => {
                    const v = apiVendors.find(vendor => vendor.name === name);
                    if (v) orderedVendors.push(v);
                });

                // Then add any new vendors not in saved order
                apiVendors.forEach(v => {
                    if (!savedOrder.includes(v.name)) {
                        orderedVendors.push(v);
                    }
                });

                setVendors(orderedVendors);
            }
        } catch (error) {
            console.error("Error fetching vendors:", error);
            // Load from localStorage if API fails
            const savedOrder = getVendorOrder();
            if (savedOrder.length > 0) {
                setVendors(savedOrder.map(name => ({ name, item: '' })));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = (name, newItem) => {
        setVendors(prev => prev.map(v =>
            v.name === name ? { ...v, item: newItem } : v
        ));
    };

    const handleSave = async (vendor) => {
        setSaving(vendor.name);
        try {
            await api.post('/vendors', { name: vendor.name, item: vendor.item });
        } catch (error) {
            alert("저장 실패");
        } finally {
            setSaving(null);
        }
    };

    // Add new vendor
    const handleAddVendor = () => {
        if (!newVendorName.trim()) return;
        if (vendors.some(v => v.name === newVendorName.trim())) {
            alert('이미 존재하는 거래처입니다.');
            return;
        }

        const newVendor = { name: newVendorName.trim(), item: '' };
        const newVendors = [...vendors, newVendor];
        setVendors(newVendors);
        saveVendorOrder(newVendors.map(v => v.name));
        setNewVendorName('');

        // Save to API
        api.post('/vendors', { name: newVendorName.trim(), item: '' }).catch(console.error);
    };

    // Delete vendor
    const handleDeleteVendor = async (vendorName) => {
        if (!window.confirm(`"${vendorName}" 거래처를 삭제하시겠습니까?`)) return;

        const newVendors = vendors.filter(v => v.name !== vendorName);
        setVendors(newVendors);
        saveVendorOrder(newVendors.map(v => v.name));
    };

    // Move vendor up/down
    const handleMoveVendor = (index, direction) => {
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= vendors.length) return;

        const newVendors = [...vendors];
        [newVendors[index], newVendors[newIndex]] = [newVendors[newIndex], newVendors[index]];
        setVendors(newVendors);
        saveVendorOrder(newVendors.map(v => v.name));
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

                <div className="info-box">
                    💡 여기서 설정한 거래처 순서가 월별비용 테이블에 동일하게 적용됩니다.<br />
                    거래처를 추가, 삭제하거나 순서를 변경할 수 있습니다.
                </div>

                {/* Add New Vendor Form */}
                <div className="vendor-add-section">
                    <h3>새 거래처 추가</h3>
                    <div className="vendor-add-form-settings">
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
                    <div className="vendor-list">
                        <div className="vendor-list-header">
                            <span className="col-order">#</span>
                            <span className="col-name">거래처명</span>
                            <span className="col-item">취급품목</span>
                            <span className="col-actions">관리</span>
                        </div>

                        {vendors.map((vendor, idx) => (
                            <div key={vendor.name} className="vendor-item">
                                <span className="col-order">
                                    <GripVertical size={16} className="grip-icon" />
                                    {idx + 1}
                                </span>
                                <span className="col-name">{vendor.name}</span>
                                <div className="col-item">
                                    <input
                                        type="text"
                                        value={vendor.item || ''}
                                        onChange={(e) => handleUpdate(vendor.name, e.target.value)}
                                        placeholder="취급품목"
                                        className="item-input"
                                    />
                                    <button
                                        onClick={() => handleSave(vendor)}
                                        disabled={saving === vendor.name}
                                        className="save-btn"
                                    >
                                        {saving === vendor.name ? (
                                            <div className="mini-spinner"></div>
                                        ) : (
                                            <Save size={16} />
                                        )}
                                    </button>
                                </div>
                                <div className="col-actions">
                                    <button
                                        onClick={() => handleMoveVendor(idx, 'up')}
                                        disabled={idx === 0}
                                        className="action-btn move-btn"
                                        title="위로 이동"
                                    >
                                        <ChevronUp size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleMoveVendor(idx, 'down')}
                                        disabled={idx === vendors.length - 1}
                                        className="action-btn move-btn"
                                        title="아래로 이동"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteVendor(vendor.name)}
                                        className="action-btn delete-btn"
                                        title="삭제"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {vendors.length === 0 && (
                            <div className="no-vendors">
                                등록된 거래처가 없습니다. 위에서 거래처를 추가하세요.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
