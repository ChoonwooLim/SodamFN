import React, { useState } from 'react';
import OpenChecklist from '../components/OpenChecklist';

export default function OpenChecklistPage() {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div className="p-4 md:p-8" style={{ minHeight: '100vh' }}>
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
                <h1 className="text-2xl font-bold text-slate-800 mb-4">📋 오픈 체크리스트</h1>
                <p className="text-sm text-slate-500 mb-6">매일 오픈 준비 절차를 확인하세요.</p>
                <button
                    onClick={() => setIsOpen(true)}
                    className="px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all hover:shadow-xl"
                    style={{ background: 'linear-gradient(135deg, #059669, #0d9488)' }}
                >
                    📋 체크리스트 열기
                </button>
            </div>
            <OpenChecklist isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </div>
    );
}
