import { useState } from 'react';
import VendorSettings from './VendorSettings';
import ContractSettings from './ContractSettings';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('vendor');

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
            </div>

            {/* Content Area */}
            {activeTab === 'vendor' ? (
                <div className="-mt-6 -mx-6">
                    <VendorSettings />
                </div>
            ) : (
                <ContractSettings />
            )}
        </div>
    );
}
