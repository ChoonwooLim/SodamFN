import React from 'react';
import { Plus, Edit3 } from 'lucide-react';
import { formatNumber } from '../../utils/format';
import api from '../../api';

export function AddEditModal({
    showModal, setShowModal, modalMode, form, setForm,
    vendors, storeGroups, deliveryGroups, otherVendors,
    getDisplayName, handleSubmit,
}) {
    if (!showModal) return null;

    const selectedVendor = vendors.find(v => v.id === Number(form.vendor_id));

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-extrabold text-slate-800 mb-5 flex items-center gap-2">
                    {modalMode === 'add' ? <><Plus size={18} className="text-blue-500" /> 매출 추가</> : <><Edit3 size={18} className="text-blue-500" /> 매출 수정</>}
                </h2>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">날짜</label>
                    <input
                        type="date"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        value={form.date}
                        onChange={e => setForm({ ...form, date: e.target.value })}
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">거래처</label>
                    <select
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        value={form.vendor_id}
                        onChange={e => setForm({ ...form, vendor_id: e.target.value })}
                    >
                        <option value="">-- 거래처 선택 --</option>
                        {Object.entries(storeGroups).map(([storeName, vList]) => (
                            <optgroup key={`store-${storeName}`} label={`🏪 ${storeName}`}>
                                {vList.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {getDisplayName(v.name, v.item)}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                        {Object.entries(deliveryGroups).map(([storeName, vList]) => (
                            <optgroup key={`delivery-${storeName}`} label={`🛵 ${storeName} 배달앱`}>
                                {vList.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {getDisplayName(v.name, v.item)}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                        {otherVendors.length > 0 && (
                            <optgroup label="📦 기타">
                                {otherVendors.map(v => (
                                    <option key={v.id} value={v.id}>{v.name}</option>
                                ))}
                            </optgroup>
                        )}
                    </select>
                </div>

                {/* Payment Method - Only for store vendors */}
                {selectedVendor && selectedVendor.category === 'store' && (
                    <div className="mb-4">
                        <label className="block text-sm font-semibold text-slate-600 mb-1.5">결제수단</label>
                        <div className="flex gap-4 mt-1">
                            <label className="flex items-center cursor-pointer text-sm gap-1.5">
                                <input type="radio" name="paymentMethod" value="Card" checked={form.payment_method === 'Card'} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="accent-blue-500" />
                                💳 카드
                            </label>
                            <label className="flex items-center cursor-pointer text-sm gap-1.5">
                                <input type="radio" name="paymentMethod" value="Cash" checked={form.payment_method === 'Cash'} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="accent-blue-500" />
                                💵 현금
                            </label>
                        </div>
                    </div>
                )}

                <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">금액 (원)</label>
                    <input
                        type="number"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-right font-bold focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="0"
                        value={form.amount}
                        onChange={e => setForm({ ...form, amount: e.target.value })}
                    />
                </div>

                <div className="mb-5">
                    <label className="block text-sm font-semibold text-slate-600 mb-1.5">비고</label>
                    <input
                        type="text"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                        placeholder="메모 (선택)"
                        value={form.note}
                        onChange={e => setForm({ ...form, note: e.target.value })}
                    />
                </div>

                <div className="flex gap-3 justify-end">
                    <button className="px-5 py-2.5 bg-slate-100 text-slate-600 text-sm font-semibold rounded-xl border-none cursor-pointer hover:bg-slate-200 transition-colors" onClick={() => setShowModal(false)}>취소</button>
                    <button className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-xl border-none cursor-pointer shadow-md shadow-blue-500/20 hover:shadow-lg transition-shadow" onClick={handleSubmit}>
                        {modalMode === 'add' ? '추가' : '저장'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ClassificationModal({
    classifyData, setClassifyData,
    uploadLoading, setUploadLoading, setUploadProgress,
    excelInputRef, fetchData,
}) {
    if (!classifyData) return null;

    const handleClassifySubmitInline = async (classifications) => {
        const savedFile = classifyData.file;
        try {
            setClassifyData(null);
            setUploadLoading(true);
            setUploadProgress('분류 적용 중...');

            const formData = new FormData();
            formData.append('file', savedFile);
            formData.append('classifications', JSON.stringify(classifications));

            const response = await api.post('/upload/excel/revenue', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.status === 'success') {
                const d = response.data;
                if (d.bank_summary) {
                    const bs = d.bank_summary;
                    let msg = `🏦 은행 입금내역 분석 완료 (${bs.period})\n\n`;
                    msg += `💳 카드매출: ${formatNumber(bs.card_sales)}원\n`;
                    msg += `💰 카드입금: ${formatNumber(bs.card_deposit)}원\n`;
                    msg += `📊 카드수수료: ${formatNumber(bs.card_fee)}원 (${bs.card_fee_rate}%)\n\n`;
                    if (bs.card_companies && bs.card_companies.length > 0) {
                        msg += `\n💳 카드사별 수수료:\n`;
                        msg += `${'카드사'.padEnd(8)} ${'매출'.padStart(12)} ${'입금'.padStart(12)} ${'수수료'.padStart(10)} ${'%'.padStart(6)}\n`;
                        bs.card_companies.forEach(cc => {
                            msg += `${cc.company.padEnd(8)} ${formatNumber(cc.sales).padStart(12)} ${formatNumber(cc.deposit).padStart(12)} ${formatNumber(cc.fee).padStart(10)} ${cc.rate}%\n`;
                        });
                    }
                    if (bs.cash_sales_count > 0) {
                        msg += `\n💵 현금매출: ${bs.cash_sales_count}건 / ${formatNumber(bs.cash_sales_total)}원 → 매출 저장 ✅\n`;
                    }
                    if (bs.categories) {
                        msg += `\n📋 전체 분류:\n`;
                        Object.entries(bs.categories).forEach(([k, v]) => {
                            const saved = k === '현금매출' ? ' ✅저장' : '';
                            msg += `  ${k}: ${v.count}건 / ${formatNumber(v.amount)}원${saved}\n`;
                        });
                    }
                    alert(msg);
                } else {
                    alert(`✅ 처리 완료!\n${d.count || 0}건 저장${d.skipped ? `, ${d.skipped}건 중복 스킵` : ''}`);
                }
                fetchData();
            } else {
                alert('처리 실패: ' + (response.data.message || ''));
            }
        } catch (err) {
            console.error(err);
            alert('분류 저장 중 오류가 발생했습니다.');
        } finally {
            setUploadLoading(false);
            setUploadProgress('');
        }
    };

    return (
        <div className="revenue-modal-overlay" onClick={() => setClassifyData(null)}>
            <div className="revenue-modal" style={{ maxWidth: 720, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
                <h3 style={{ marginBottom: 4 }}>🏦 은행 입금내역 분류</h3>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                    {classifyData.message || '각 송금자를 카테고리별로 분류해주세요.'}
                </p>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'].map(cat => {
                        const catColors = {
                            '카드입금': '#3b82f6', '페이입금': '#8b5cf6', '배달앱입금': '#f59e0b',
                            '현금매출': '#10b981', '개인거래': '#6b7280', '무시': '#d1d5db'
                        };
                        return (
                            <button key={cat} style={{
                                fontSize: 11, padding: '4px 10px', borderRadius: 12,
                                border: `1px solid ${catColors[cat]}40`, background: `${catColors[cat]}10`,
                                color: catColors[cat], fontWeight: 700, cursor: 'default'
                            }}>{cat}</button>
                        );
                    })}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {(classifyData.items || []).map((item, idx) => {
                        const catColors = {
                            '카드입금': '#3b82f6', '페이입금': '#8b5cf6', '배달앱입금': '#f59e0b',
                            '현금매출': '#10b981', '개인거래': '#6b7280', '무시': '#d1d5db',
                            '카드수수료': '#3b82f6', '?': '#ef4444'
                        };
                        const validCats = ['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'];
                        const defaultCat = validCats.includes(item.default_category) ? item.default_category : '개인거래';
                        const selected = item._category || defaultCat;
                        const color = catColors[selected] || '#6b7280';

                        return (
                            <div key={idx} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', borderRadius: 10,
                                background: `${color}08`, border: `1px solid ${color}20`,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        {item.memo}
                                        {item.card_company && (
                                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#3b82f615', color: '#3b82f6', fontWeight: 700, flexShrink: 0 }}>
                                                {item.card_company}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 11, color: '#64748b' }}>
                                        {item.count}건 · {formatNumber(item.total_amount)}원
                                    </div>
                                </div>
                                <select
                                    value={selected}
                                    onChange={e => {
                                        const newItems = [...classifyData.items];
                                        newItems[idx] = { ...newItems[idx], _category: e.target.value };
                                        setClassifyData({ ...classifyData, items: newItems });
                                    }}
                                    style={{
                                        fontSize: 12, padding: '6px 10px', borderRadius: 8,
                                        border: `1.5px solid ${color}`, background: `${color}15`,
                                        color, fontWeight: 700, cursor: 'pointer', minWidth: 110,
                                    }}
                                >
                                    <option value="카드입금">💳 카드입금</option>
                                    <option value="페이입금">📱 페이입금</option>
                                    <option value="배달앱입금">🛵 배달앱입금</option>
                                    <option value="현금매출">💵 현금매출</option>
                                    <option value="개인거래">👤 개인거래</option>
                                    <option value="무시">⛔ 무시</option>
                                </select>
                            </div>
                        );
                    })}
                </div>

                <div className="revenue-modal-actions" style={{ marginTop: 16 }}>
                    <button className="modal-btn secondary" onClick={() => setClassifyData(null)}>취소</button>
                    <button className="modal-btn primary" onClick={() => {
                        const classifications = (classifyData.items || []).map(item => {
                            const validCats = ['카드입금', '페이입금', '배달앱입금', '현금매출', '개인거래', '무시'];
                            const defaultCat = validCats.includes(item.default_category) ? item.default_category : '개인거래';
                            return {
                                memo: item.memo,
                                category: item._category || defaultCat
                            };
                        });
                        handleClassifySubmitInline(classifications);
                    }}>
                        ✅ 분류 완료 · 저장
                    </button>
                </div>
            </div>
        </div>
    );
}
