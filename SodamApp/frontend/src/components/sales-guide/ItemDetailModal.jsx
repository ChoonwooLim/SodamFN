import { useState, useEffect } from 'react';
import { X, FileText, ListChecks, Lightbulb, Building2, Calendar, Upload } from 'lucide-react';
import api from '../../api';
import DateInputDrawer from './DateInputDrawer';
import DeepLinkButton from './DeepLinkButton';

/**
 * 항목 상세 모달 (gaongn.net ApplyGuideModal 풍).
 *
 * Props:
 * - item: 카탈로그 항목 (null 이면 닫힘)
 * - progress: SalesGuideProgress row (또는 null)
 * - syncCount: { completed, total, label } (또는 null)
 * - onClose: () => void
 * - onPatch: (itemKey, updates) => Promise
 */
export default function ItemDetailModal({ item, progress, syncCount, onClose, onPatch }) {
  const [isCompleted, setIsCompleted] = useState(false);
  const [dates, setDates] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  useEffect(() => {
    if (item) {
      setIsCompleted(progress?.is_completed || false);
      setDates({
        completed_at: progress?.completed_at || '',
        expires_at: progress?.expires_at || '',
      });
      setNotes(progress?.notes || '');
    }
  }, [item, progress]);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      // renewalCycle 항목은 expires_at 필수
      if (isCompleted && item.renewalCycle && !dates.expires_at) {
        alert('갱신주기가 있는 항목은 만료일을 입력해야 완료로 처리됩니다.');
        setSaving(false);
        return;
      }
      await onPatch(item.key, {
        is_completed: isCompleted,
        completed_at: dates.completed_at || null,
        expires_at: dates.expires_at || null,
        notes: notes || null,
      });
      onClose();
    } catch (e) {
      alert('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (docType, file) => {
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('doc_type', docType);
      // 백엔드 라우터: POST /business-docs (multipart/form-data, doc_type Form 필수)
      await api.post('/business-docs', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // 업로드 후 명시적 의사결정 유도
      if (window.confirm('업로드 완료. 이 항목을 완료로 표시하시겠습니까?')) {
        setIsCompleted(true);
      }
    } catch (e) {
      alert('업로드 실패: ' + (e.message || ''));
    } finally {
      setUploadingDoc(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[95vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between z-10">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {item.required && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">필수</span>
              )}
              {item.renewalCycle && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  매 {item.renewalCycle.months}개월 갱신
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">{item.title}</h2>
            <p className="text-sm text-slate-500">
              {item.authority} · {item.processingDays}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 space-y-6">
          {/* 1. 개요 */}
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
              <FileText className="w-4 h-4" /> 개요
            </h3>
            <p className="text-base text-slate-800 leading-relaxed">{item.description}</p>
            {item.legalBasis && (
              <p className="mt-2 text-xs text-slate-500">법적 근거: {item.legalBasis}</p>
            )}
          </section>

          {/* 2. 신청 절차 */}
          {item.steps && item.steps.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <ListChecks className="w-4 h-4" /> 신청 절차
              </h3>
              <ol className="list-decimal list-inside space-y-1.5 text-base text-slate-800 pl-1">
                {item.steps.map((step, i) => (
                  <li key={i} className="leading-relaxed">{step}</li>
                ))}
              </ol>
            </section>
          )}

          {/* 3. 필요 서류 */}
          {item.documents && item.documents.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <Building2 className="w-4 h-4" /> 필요 서류
              </h3>
              <ul className="space-y-1.5">
                {item.documents.map((doc, i) => (
                  <li key={i} className="flex items-start gap-2 text-base text-slate-800">
                    <span className="text-slate-400 mt-1">•</span>
                    <span>{doc}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 4. 팁 */}
          {item.tips && item.tips.length > 0 && (
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                <Lightbulb className="w-4 h-4" /> 팁·주의사항
              </h3>
              <ul className="space-y-1.5 bg-amber-50 border border-amber-100 rounded-lg p-4">
                {item.tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-800">
                    <span className="text-amber-600 mt-1">💡</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 5. 내 진행 상황 */}
          <section className="bg-slate-50 rounded-xl p-5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
              <Calendar className="w-4 h-4" /> 내 진행 상황
            </h3>

            {/* sync 카운트 표시 */}
            {syncCount && (
              <div className="mb-4 p-3 bg-white rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">{syncCount.label || '자동 카운트'}</span>
                  <span
                    className={`text-sm font-semibold ${
                      syncCount.total > 0 && syncCount.completed >= syncCount.total
                        ? 'text-green-600'
                        : 'text-orange-600'
                    }`}
                  >
                    {syncCount.completed} / {syncCount.total}
                  </span>
                </div>
              </div>
            )}

            {/* 완료 토글 */}
            <label className="flex items-center gap-3 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={isCompleted}
                onChange={(e) => setIsCompleted(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600"
              />
              <span className="text-base text-slate-800">완료로 표시</span>
            </label>

            {/* 날짜 입력 */}
            {item.dateFields && item.dateFields.length > 0 && (
              <div className="mb-4">
                <DateInputDrawer dateFields={item.dateFields} values={dates} onChange={setDates} />
              </div>
            )}

            {/* 메모 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">메모 (선택)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="사장님 메모 (예: 매년 5월 갱신, 김 부장 담당 등)"
              />
            </div>

            {/* 문서 업로드 (mergedDocs 정의된 항목만) */}
            {item.mergedDocs && item.mergedDocs.length > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  관련 문서 업로드
                </label>
                {item.mergedDocs.map((docType) => (
                  <label
                    key={docType}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg cursor-pointer text-sm transition mr-2 mb-2"
                  >
                    <Upload className="w-4 h-4" />
                    {docType} {uploadingDoc && '업로드 중...'}
                    <input
                      type="file"
                      hidden
                      onChange={(e) => handleUpload(docType, e.target.files[0])}
                      disabled={uploadingDoc}
                    />
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-3 rounded-lg transition"
            >
              {saving ? '저장 중...' : '저장'}
            </button>
          </section>
        </div>

        {/* 푸터 — deep-links */}
        {(item.deepLinks?.length > 0 || item.internalLinks?.length > 0) && (
          <div className="border-t border-slate-200 p-5 bg-slate-50">
            <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
              바로가기
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.deepLinks?.map((link, i) => (
                <DeepLinkButton key={`ext-${i}`} link={{ ...link, external: true }} />
              ))}
              {item.internalLinks?.map((link, i) => (
                <DeepLinkButton
                  key={`int-${i}`}
                  link={{ ...link, external: false }}
                  variant="secondary"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
