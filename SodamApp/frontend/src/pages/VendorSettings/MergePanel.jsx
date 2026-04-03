import { GitMerge, X } from 'lucide-react';

export function MergeActionBar({ selectedForMerge, handleOpenMergeModal, setSelectedForMerge }) {
    if (selectedForMerge.length < 2) return null;

    return (
        <div className="merge-action-bar">
            <span>{selectedForMerge.length}개 선택됨</span>
            <button onClick={handleOpenMergeModal} className="merge-btn">
                <GitMerge size={18} />
                선택 거래처 병합
            </button>
            <button onClick={() => setSelectedForMerge([])} className="cancel-selection-btn">
                선택 취소
            </button>
        </div>
    );
}

export function MergeModal({
    showMergeModal,
    setShowMergeModal,
    selectedForMerge,
    mergeTarget,
    setMergeTarget,
    customMergeName,
    setCustomMergeName,
    getVendorById,
    getCategoryLabel,
    handleMerge,
}) {
    if (!showMergeModal) return null;

    return (
        <div className="modal-overlay" onClick={() => setShowMergeModal(false)}>
            <div className="merge-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>거래처 병합</h2>
                    <button onClick={() => setShowMergeModal(false)} className="close-btn">
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">
                    <p className="merge-info">
                        선택된 {selectedForMerge.length}개의 거래처를 하나로 병합합니다.<br />
                        <strong>유지할 거래처</strong>를 선택하세요. 나머지는 삭제되고 비용 데이터가 이전됩니다.
                    </p>
                    <div className="merge-target-list">
                        {selectedForMerge.map(id => {
                            const v = getVendorById(id);
                            if (!v) return null;
                            return (
                                <label key={id} className={`merge-target-option ${mergeTarget === id ? 'active' : ''}`}>
                                    <input
                                        type="radio"
                                        name="mergeTarget"
                                        value={id}
                                        checked={mergeTarget === id}
                                        onChange={() => setMergeTarget(id)}
                                    />
                                    <span className="vendor-info">
                                        <span className="vendor-name">{v.name}</span>
                                        <span className="vendor-category">{getCategoryLabel(v.category)}</span>
                                    </span>
                                    {mergeTarget === id && <span className="keep-badge">유지</span>}
                                </label>
                            );
                        })}
                        {/* Custom Merge Name Option */}
                        <label className={`merge-target-option custom ${mergeTarget === '__CUSTOM__' ? 'active' : ''}`}>
                            <input
                                type="radio"
                                name="mergeTarget"
                                value="__CUSTOM__"
                                checked={mergeTarget === '__CUSTOM__'}
                                onChange={() => setMergeTarget('__CUSTOM__')}
                            />
                            <span className="vendor-info custom-input-wrapper">
                                <span className="vendor-name-label">새로운 이름으로 병합: </span>
                                <input
                                    type="text"
                                    value={customMergeName}
                                    onChange={e => setCustomMergeName(e.target.value)}
                                    placeholder="예: 통합거래처(본점)"
                                    className="custom-merge-name-input"
                                    disabled={mergeTarget !== '__CUSTOM__'}
                                    onClick={(e) => {
                                        if (mergeTarget !== '__CUSTOM__') setMergeTarget('__CUSTOM__');
                                        e.stopPropagation();
                                    }}
                                />
                            </span>
                        </label>
                    </div>
                </div>
                <div className="modal-footer">
                    <button onClick={() => setShowMergeModal(false)} className="cancel-btn">
                        취소
                    </button>
                    <button onClick={handleMerge} className="confirm-merge-btn">
                        <GitMerge size={18} />
                        병합 실행
                    </button>
                </div>
            </div>
        </div>
    );
}
