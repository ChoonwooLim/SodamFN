import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, Save } from 'lucide-react';
import api from '../api';

export default function VendorSettings() {
    const navigate = useNavigate();
    const [vendors, setVendors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null); // 'name' of vendor being saved

    useEffect(() => {
        fetchVendors();
    }, []);

    const fetchVendors = async () => {
        try {
            const response = await api.get('/vendors');
            if (response.data.status === 'success') {
                setVendors(response.data.data);
            }
        } catch (error) {
            console.error("Error fetching vendors:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdate = async (name, newItem) => {
        // 1. Optimistic Update
        setVendors(prev => prev.map(v =>
            v.name === name ? { ...v, item: newItem } : v
        ));
    };

    const handleSave = async (vendor) => {
        setSaving(vendor.name);
        try {
            await api.post('/vendors', { name: vendor.name, item: vendor.item });
            // Show success indicator briefly?
        } catch (error) {
            alert("저장 실패");
        } finally {
            setSaving(null);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 pb-24">
            <header className="flex items-center gap-4 mb-8">
                <button onClick={() => navigate('/')} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                    <ChevronLeft size={20} />
                </button>
                <h1 className="text-xl font-bold text-slate-900">거래처 및 품목 관리</h1>
            </header>

            {loading ? (
                <div className="flex justify-center p-8">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-2xl text-sm text-blue-700 mb-6">
                        💡 엑셀에서 자동으로 불러온 거래처 목록입니다.<br />
                        자주 쓰는 품목(예: 야채, 공산품)을 입력해주세요.
                    </div>

                    {vendors.map((vendor, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                            <div className="font-bold text-slate-800">{vendor.name}</div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={vendor.item || ''}
                                    onChange={(e) => handleUpdate(vendor.name, e.target.value)}
                                    placeholder="취급품목 입력 (예: 야채)"
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                                />
                                <button
                                    onClick={() => handleSave(vendor)}
                                    disabled={saving === vendor.name}
                                    className={`px-4 rounded-xl flex items-center justify-center transition-colors ${saving === vendor.name
                                            ? 'bg-slate-100 text-slate-400'
                                            : 'bg-slate-900 text-white active:scale-95'
                                        }`}
                                >
                                    {saving === vendor.name ? (
                                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        <Save size={18} />
                                    )}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
