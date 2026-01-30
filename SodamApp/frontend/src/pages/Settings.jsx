import { useState, useEffect } from 'react';
import { Wallet, Save, Building2 } from 'lucide-react';
import VendorSettings from './VendorSettings';
import ContractSettings from './ContractSettings';
import api from '../api';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('vendor');
    const [bizAccount, setBizAccount] = useState({ bank: '', number: '', holder: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (activeTab === 'payment') {
            fetchBizAccount();
        }
    }, [activeTab]);

    const fetchBizAccount = async () => {
        try {
            const res = await api.get('/payroll/transfer/biz-account');
            if (res.data?.data) {
                setBizAccount(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching biz account:', error);
        }
    };

    const handleSaveBizAccount = async () => {
        setSaving(true);
        setMessage('');
        try {
            await api.put('/payroll/transfer/biz-account', bizAccount);
            setMessage('출금계좌 정보가 저장되었습니다.');
        } catch (error) {
            console.error('Save biz account error:', error.response?.status, error.response?.data);
            if (error.response?.status === 401) {
                setMessage('인증이 필요합니다. 다시 로그인해주세요.');
            } else if (error.response?.status === 403) {
                setMessage('권한이 없습니다. 관리자만 접근 가능합니다.');
            } else if (error.response?.status === 422) {
                setMessage(`입력값 오류: ${JSON.stringify(error.response?.data?.detail || '알 수 없는 오류')}`);
            } else {
                setMessage('저장 중 오류가 발생했습니다.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 bg-slate-50 min-h-screen pb-24">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">환경 설정</h1>
                <p className="text-slate-500">시스템의 전반적인 설정을 관리합니다.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('vendor')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'vendor'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    거래처 및 품목 관리
                </button>
                <button
                    onClick={() => setActiveTab('contract')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'contract'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    전자계약서 양식
                </button>
                <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'payment'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    급여 출금계좌
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'vendor' ? (
                <div className="-mt-6 -mx-6">
                    <VendorSettings />
                </div>
            ) : activeTab === 'contract' ? (
                <ContractSettings />
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">급여 출금계좌 설정</h2>
                            <p className="text-sm text-slate-500">직원 급여 이체에 사용할 사업자 계좌 정보를 입력합니다.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">은행명</label>
                            <input
                                type="text"
                                value={bizAccount.bank}
                                onChange={(e) => setBizAccount({ ...bizAccount, bank: e.target.value })}
                                placeholder="예: 국민은행"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">계좌번호</label>
                            <input
                                type="text"
                                value={bizAccount.number}
                                onChange={(e) => setBizAccount({ ...bizAccount, number: e.target.value })}
                                placeholder="예: 123-456-789012"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">예금주</label>
                            <input
                                type="text"
                                value={bizAccount.holder}
                                onChange={(e) => setBizAccount({ ...bizAccount, holder: e.target.value })}
                                placeholder="예: 소담김밥"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        {message && (
                            <div className={`text-sm font-medium p-3 rounded-lg ${message.includes('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleSaveBizAccount}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
