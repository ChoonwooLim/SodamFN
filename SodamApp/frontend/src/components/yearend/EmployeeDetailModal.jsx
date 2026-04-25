import { useEffect, useState } from 'react';
import api from '../../api';
import ReconciliationBanner from './ReconciliationBanner';
import SimplifiedTable from './SimplifiedTable';
import DocumentUploader from './DocumentUploader';
import AuditLogList from './AuditLogList';

export default function EmployeeDetailModal({ year, staff, onClose, onChange }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const r = await api.get(`/yearend/${year}/employees/${staff.staff_id}`);
      setDetail(r.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (staff) reload(); }, [staff?.staff_id, year]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (!staff) return null;

  const refresh = async () => {
    await api.post(`/yearend/${year}/employees/${staff.staff_id}/aggregate`);
    await reload(); onChange?.();
  };
  const reconcile = async () => {
    try {
      await api.post(`/yearend/${year}/employees/${staff.staff_id}/reconcile`);
      await reload(); onChange?.();
    } catch (e) {
      alert(e?.response?.data?.detail || '대조 실패');
    }
  };
  const toggleDistribute = async () => {
    const action = detail.report.distributed_to_staff ? 'revoke' : 'distribute';
    try {
      await api.post(`/yearend/${year}/employees/${staff.staff_id}/${action}`);
      await reload(); onChange?.();
    } catch (e) {
      alert(e?.response?.data?.detail || '배포 토글 실패');
    }
  };
  const downloadPdf = async () => {
    try {
      const res = await api.get(
        `/yearend/${year}/employees/${staff.staff_id}/draft-receipt.pdf`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      const label = staff.income_type === 'earned' ? '근로소득' : '사업소득';
      a.download = `${label}원천징수영수증_${year}_${staff.name}_초안.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('PDF 다운로드 실패: ' + (e?.response?.data?.detail || e.message));
    }
  };
  const previewHtml = async () => {
    try {
      const res = await api.get(
        `/yearend/${year}/employees/${staff.staff_id}/draft-receipt.preview`
      );
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(res.data);
        w.document.close();
      }
    } catch (e) {
      alert('미리보기 실패: ' + (e?.response?.data?.detail || e.message));
    }
  };
  const deleteDoc = async (id) => {
    if (!confirm('문서를 삭제할까요?')) return;
    await api.delete(`/yearend/documents/${id}`);
    await reload();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-slate-800 to-slate-700 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">{staff.name} · {year}년</h2>
            <div className="text-sm opacity-80">{staff.income_type === 'earned' ? '근로소득' : '사업소득'}</div>
          </div>
          <button onClick={onClose} className="text-2xl">×</button>
        </div>

        {loading || !detail ? (
          <div className="p-12 text-center text-slate-500">불러오는 중...</div>
        ) : (
          <div className="p-6 space-y-6">
            {/* 자체 집계 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">자체 집계 (Payroll 12개월)</h3>
                <button onClick={refresh} className="text-sm text-blue-600">새로고침</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                <Cell label="총급여" value={detail.report.total_pay_year} />
                <Cell label="비과세" value={detail.report.nontaxable_pay} />
                <Cell label="과세대상" value={detail.report.taxable_pay} />
                <Cell label="기납부세액(자체)" value={detail.report.taxes_withheld_total} />
                <Cell label="4대보험" value={detail.report.insurance_4major_total} />
                {detail.report.aggregated_at && (
                  <div className="bg-slate-50 px-3 py-2 rounded text-xs text-slate-500">
                    최근 집계: {new Date(detail.report.aggregated_at).toLocaleString('ko-KR')}
                  </div>
                )}
              </div>
            </section>

            {/* 문서 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">업로드 문서</h3>
                <div className="flex gap-2">
                  <DocumentUploader year={year} staffId={staff.staff_id}
                                    kind="withholding_receipt" label="원천징수영수증"
                                    onUploaded={reload} />
                  <DocumentUploader year={year} staffId={staff.staff_id}
                                    kind="simplified" label="간소화 자료"
                                    onUploaded={reload} />
                </div>
              </div>
              {detail.documents.length === 0 ?
                <div className="text-sm text-slate-400">업로드된 문서 없음</div> :
                <ul className="space-y-1 text-sm">
                  {detail.documents.map(d => (
                    <li key={d.id} className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded">
                      <div>
                        <span className={`text-xs px-2 py-0.5 rounded mr-2 ${
                          d.kind === 'withholding_receipt' ? 'bg-blue-100 text-blue-700' :
                          d.kind === 'simplified' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200'
                        }`}>{d.kind === 'withholding_receipt' ? '영수증' :
                              d.kind === 'simplified' ? '간소화' : '기타'}</span>
                        <span className="font-medium">{d.filename}</span>
                        <span className={`ml-2 text-xs ${
                          d.parse_status === 'parsed' ? 'text-emerald-600' :
                          d.parse_status === 'error' ? 'text-rose-600' : 'text-slate-400'
                        }`}>
                          {d.parse_status === 'parsed' ? '✅ 파싱완료' :
                           d.parse_status === 'error' ? `❌ ${d.parse_error}` : '⏳ 처리중'}
                        </span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <a href={d.file_url} target="_blank" rel="noreferrer" className="text-blue-600">열기</a>
                        <button onClick={() => deleteDoc(d.id)} className="text-rose-600">삭제</button>
                      </div>
                    </li>
                  ))}
                </ul>}
            </section>

            {/* 업로드본 정본 */}
            {detail.report.confirmed_total_pay !== null && detail.report.confirmed_total_pay !== undefined && (
              <section>
                <h3 className="font-semibold text-slate-800 mb-2">업로드본 정본 (원천징수영수증 파싱)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                  <Cell label="확정 총급여" value={detail.report.confirmed_total_pay} />
                  <Cell label="결정세액" value={detail.report.decided_tax} />
                  <Cell label="확정 기납부" value={detail.report.confirmed_taxes_paid} />
                  <Cell label="차감징수액" value={detail.report.refund_amount}
                        positive={detail.report.refund_amount < 0 ? 'env' : 'add'} />
                </div>
              </section>
            )}

            {/* 대조 */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800">대조 검증</h3>
                <button onClick={reconcile}
                        className="text-sm text-blue-600 hover:text-blue-800">대조 실행</button>
              </div>
              <ReconciliationBanner
                status={detail.report.reconciliation_status}
                diff={detail.report.reconciliation_diff}
              />
            </section>

            {/* 간소화 13개 */}
            <section>
              <h3 className="font-semibold text-slate-800 mb-2">간소화 자료</h3>
              <SimplifiedTable data={detail.simplified} />
            </section>

            {/* PDF */}
            <section className="flex gap-2">
              <button onClick={previewHtml}
                      className="px-4 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded">
                초안 미리보기 (HTML)
              </button>
              <button onClick={downloadPdf}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded">
                초안 PDF 다운로드
              </button>
            </section>

            {/* 직원앱 노출 */}
            <section className="flex items-center justify-between bg-slate-50 px-4 py-3 rounded">
              <div>
                <div className="font-semibold text-slate-800">직원앱 노출</div>
                <div className="text-xs text-slate-500">
                  현재: {detail.report.distributed_to_staff ?
                    <span className="text-emerald-600 font-medium">활성 (직원이 자기 자료를 볼 수 있음)</span> :
                    <span>비활성</span>}
                </div>
              </div>
              <button onClick={toggleDistribute}
                      className={`px-4 py-2 text-sm rounded text-white ${
                        detail.report.distributed_to_staff ? 'bg-rose-600 hover:bg-rose-700' :
                        'bg-emerald-600 hover:bg-emerald-700'}`}>
                {detail.report.distributed_to_staff ? '배포 해제' : '배포 활성화'}
              </button>
            </section>

            {/* 감사 로그 */}
            <section>
              <h3 className="font-semibold text-slate-800 mb-2">최근 감사 로그</h3>
              <AuditLogList logs={detail.recent_audit_logs} />
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function Cell({ label, value, positive }) {
  const cls = positive === 'env' ? 'text-emerald-600' :
              positive === 'add' ? 'text-rose-600' : 'text-slate-800';
  return (
    <div className="bg-slate-50 px-3 py-2 rounded">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`font-mono font-semibold ${cls}`}>
        {value === null || value === undefined ? '-' : `${value.toLocaleString('ko-KR')}원`}
      </div>
    </div>
  );
}
