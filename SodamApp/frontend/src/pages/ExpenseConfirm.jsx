import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api';
import { Check, ChevronLeft, Calendar, ShoppingBag, DollarSign, Tag } from 'lucide-react';

export default function ExpenseConfirm() {
    const { state } = useLocation();
    const navigate = useNavigate();

    const [form, setForm] = useState(state || {
        date: new Date().toISOString().split('T')[0],
        item: '',
        amount: 0,
        category: '재료비'
    });
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...form,
                amount: parseInt(form.amount)
            };
            const response = await api.post('/expense', payload);
            if (response.data.status === 'success') {
                // Need a success toast or clearer feedback
                alert('저장되었습니다.');
                navigate('/');
            } else {
                alert('Error: ' + response.data.message);
            }
        } catch (error) {
            console.error(error);
            alert('저장 실패');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 flex flex-col">
            <div className="max-w-3xl mx-auto w-full flex-1 flex flex-col">
                <header className="flex items-center gap-4 mb-8">
                    <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm text-slate-600">
                        <ChevronLeft size={20} />
                    </button>
                    <h1 className="text-xl font-bold text-slate-900">내역 확인</h1>
                </header>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                    <div className="bg-white rounded-3xl p-6 shadow-soft space-y-6 mb-6">

                        {/* Amount Input (Hero) */}
                        <div className="relative">
                            <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">금액</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                                <input
                                    type="number"
                                    value={form.amount}
                                    onChange={e => setForm({ ...form, amount: e.target.value })}
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-blue-500 rounded-2xl text-2xl font-bold text-slate-900 outline-none transition-all text-right placeholder-slate-300"
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        {/* Other Inputs */}
                        <div className="space-y-4">
                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                                    <Calendar size={16} /> 날짜
                                </label>
                                <input
                                    type="date"
                                    value={form.date}
                                    onChange={e => setForm({ ...form, date: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                />
                            </div>

                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                                    <ShoppingBag size={16} /> 사용처
                                </label>
                                <input
                                    type="text"
                                    value={form.item}
                                    onChange={e => setForm({ ...form, item: e.target.value })}
                                    className="w-full p-4 bg-slate-50 rounded-2xl font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                    placeholder="예: 쿠팡, 다이소"
                                />
                            </div>

                            <div className="group">
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-2">
                                    <Tag size={16} /> 분류
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['재료비', '비품', '기타'].map(cat => (
                                        <button
                                            type="button"
                                            key={cat}
                                            onClick={() => setForm({ ...form, category: cat })}
                                            className={`p-3 rounded-xl text-sm font-bold transition-all ${form.category === cat
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pb-6">
                        <button
                            type="submit"
                            disabled={submitting}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <Check size={20} />
                                    저장하기
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
