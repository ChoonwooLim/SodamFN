/**
 * StoreManager — 사업장 산하 매장 목록 관리.
 *
 * 사용처: CompanyInfoSettings 페이지 내 임베드.
 * - 목록 표시 (활성/비활성, 기본매장 표시)
 * - 신규 추가 (이름 + 주소 + 전화)
 * - 인라인 수정 + 기본매장 설정
 * - 삭제 (default 매장 삭제 시 백엔드가 다른 매장 자동 승격)
 */
import { useState, useEffect } from 'react';
import { Building2, Plus, Star, Edit2, Trash2, Save, X, Check } from 'lucide-react';
import api from '../api';

export default function StoreManager() {
    const [stores, setStores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [editDraft, setEditDraft] = useState({ name: '', address: '', phone: '' });
    const [newDraft, setNewDraft] = useState({ name: '', address: '', phone: '' });
    const [showAdd, setShowAdd] = useState(false);
    const [msg, setMsg] = useState(null);

    const showMsg = (text, type = 'success') => {
        setMsg({ text, type });
        setTimeout(() => setMsg(null), 3000);
    };

    const load = async () => {
        try {
            setLoading(true);
            const res = await api.get('/stores');
            setStores(res.data?.data || []);
        } catch (e) {
            console.error('stores load error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleAdd = async () => {
        const name = newDraft.name.trim();
        if (!name) return alert('매장명을 입력해 주세요.');
        try {
            await api.post('/stores', {
                name,
                address: newDraft.address.trim(),
                phone: newDraft.phone.trim(),
                is_default: stores.length === 0,  // 첫 매장은 자동 default
            });
            setNewDraft({ name: '', address: '', phone: '' });
            setShowAdd(false);
            showMsg('매장이 추가되었습니다.');
            load();
        } catch (e) {
            alert(e.response?.data?.detail || '매장 추가 실패');
        }
    };

    const startEdit = (store) => {
        setEditingId(store.id);
        setEditDraft({
            name: store.name || '',
            address: store.address || '',
            phone: store.phone || '',
        });
    };

    const saveEdit = async (id) => {
        try {
            await api.put(`/stores/${id}`, editDraft);
            setEditingId(null);
            showMsg('매장 정보가 수정되었습니다.');
            load();
        } catch (e) {
            alert(e.response?.data?.detail || '수정 실패');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            await api.put(`/stores/${id}/set-default`);
            showMsg('기본 매장이 변경되었습니다.');
            load();
        } catch (e) {
            alert(e.response?.data?.detail || '기본 매장 설정 실패');
        }
    };

    const handleDelete = async (store) => {
        if (!window.confirm(`'${store.name}' 매장을 삭제하시겠습니까?\n계약서 작성 시 이 매장을 더 이상 선택할 수 없습니다.`)) return;
        try {
            await api.delete(`/stores/${store.id}`);
            showMsg('매장이 삭제되었습니다.');
            load();
        } catch (e) {
            alert(e.response?.data?.detail || '삭제 실패');
        }
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-200">
                        <Building2 size={18} className="text-white" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">매장 관리</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            전자계약서의 <code className="bg-slate-100 px-1 rounded">{'{work_location}'}</code> 변수가 선택된 매장명으로 치환됩니다.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAdd(s => !s)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={14} /> 매장 추가
                </button>
            </div>

            {msg && (
                <div className={`mb-4 px-4 py-2.5 rounded-xl text-sm font-medium ${
                    msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
                }`}>
                    {msg.text}
                </div>
            )}

            {/* 신규 추가 폼 */}
            {showAdd && (
                <div className="mb-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                        <input
                            type="text"
                            value={newDraft.name}
                            onChange={(e) => setNewDraft({ ...newDraft, name: e.target.value })}
                            placeholder="매장명 (예: 소담김밥 강남점 매장)"
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                        <input
                            type="text"
                            value={newDraft.address}
                            onChange={(e) => setNewDraft({ ...newDraft, address: e.target.value })}
                            placeholder="주소 (선택)"
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                        <input
                            type="text"
                            value={newDraft.phone}
                            onChange={(e) => setNewDraft({ ...newDraft, phone: e.target.value })}
                            placeholder="전화 (선택)"
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleAdd} className="flex-1 p-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700">
                            저장
                        </button>
                        <button onClick={() => { setShowAdd(false); setNewDraft({ name: '', address: '', phone: '' }); }} className="px-4 p-2.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50">
                            취소
                        </button>
                    </div>
                </div>
            )}

            {/* 목록 */}
            {loading ? (
                <div className="text-center py-6 text-sm text-slate-400">로딩 중...</div>
            ) : stores.length === 0 ? (
                <div className="text-center py-8 text-sm text-slate-400 bg-slate-50 rounded-xl">
                    등록된 매장이 없습니다. 위 "매장 추가" 버튼으로 첫 매장을 등록해 주세요.
                </div>
            ) : (
                <div className="space-y-2">
                    {stores.map((store) => (
                        <div
                            key={store.id}
                            className={`p-3.5 rounded-xl border transition-colors ${
                                store.is_default ? 'bg-amber-50/60 border-amber-200' : 'bg-slate-50 border-slate-100'
                            } ${!store.is_active ? 'opacity-60' : ''}`}
                        >
                            {editingId === store.id ? (
                                /* 인라인 수정 모드 */
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                                    <input
                                        type="text"
                                        value={editDraft.name}
                                        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                                        className="p-2 bg-white border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none font-bold"
                                    />
                                    <input
                                        type="text"
                                        value={editDraft.address}
                                        onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })}
                                        placeholder="주소"
                                        className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                    />
                                    <input
                                        type="text"
                                        value={editDraft.phone}
                                        onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })}
                                        placeholder="전화"
                                        className="p-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                                    />
                                    <div className="flex gap-1">
                                        <button onClick={() => saveEdit(store.id)} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" title="저장">
                                            <Save size={14} />
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50" title="취소">
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                /* 표시 모드 */
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-800 text-sm">{store.name}</span>
                                            {store.is_default && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                                                    <Star size={10} className="fill-amber-500 text-amber-500" /> 기본 매장
                                                </span>
                                            )}
                                            {!store.is_active && (
                                                <span className="text-[10px] font-bold bg-slate-200 text-slate-600 px-2 py-0.5 rounded">비활성</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 truncate">
                                            {store.address || <span className="text-slate-300">주소 미입력</span>}
                                            {store.phone && <span className="ml-2">· {store.phone}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        {!store.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(store.id)}
                                                className="px-2 py-1.5 bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-500 hover:text-amber-700 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                                                title="기본 매장으로 설정"
                                            >
                                                <Check size={12} /> 기본
                                            </button>
                                        )}
                                        <button onClick={() => startEdit(store)} className="p-1.5 bg-white border border-slate-200 hover:border-indigo-300 text-slate-500 hover:text-indigo-600 rounded-lg" title="수정">
                                            <Edit2 size={12} />
                                        </button>
                                        <button onClick={() => handleDelete(store)} className="p-1.5 bg-white border border-slate-200 hover:border-red-300 text-slate-400 hover:text-red-600 rounded-lg" title="삭제">
                                            <Trash2 size={12} />
                                        </button>
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
