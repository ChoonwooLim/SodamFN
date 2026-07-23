import { useState, useEffect } from 'react';
import api from '../api';
import EmployeeDetailModal from '../components/yearend/EmployeeDetailModal';

export default function YearEnd() {
  const [year, setYear] = useState(new Date().getFullYear() - 1); // 전년도 기본
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, eRes] = await Promise.all([
        api.get(`/yearend/${year}/summary`),
        api.get(`/yearend/${year}/employees`),
      ]);
      setSummary(sRes.data);
      setEmployees(eRes.data || []);
    } catch (err) {
      console.error('YearEnd load failed', err);
      setSummary(null);
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [year]);

  const aggregateAll = async () => {
    if (!window.confirm(`${year}년 전 직원 자체 집계를 새로 실행할까요?`)) return;
    try {
      await api.post(`/yearend/${year}/aggregate-all`);
      setTimeout(load, 1500);
    } catch (err) {
      console.error('aggregate-all failed', err);
      alert('일괄 집계 요청에 실패했습니다.');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-900">연말정산 지원</h1>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="border border-slate-300 rounded px-3 py-2 text-sm"
          >
            {[...Array(5)].map((_, i) => {
              const y = new Date().getFullYear() - i;
              return <option key={y} value={y}>{y}년</option>;
            })}
          </select>
          <button
            onClick={load}
            className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded"
          >
            새로고침
          </button>
          <button
            onClick={aggregateAll}
            className="px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            전체 일괄 집계
          </button>
        </div>
      </div>

      {summary && (
        <div className="bg-gradient-to-br from-slate-800 to-slate-700 text-white rounded-lg p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm opacity-80">대상 직원</div>
              <div className="text-2xl font-bold">{summary.total_employees}명</div>
            </div>
            <div>
              <div className="text-sm opacity-80">검증 완료</div>
              <div className="text-2xl font-bold">
                {(summary.counts_by_status?.reconciled || 0) + (summary.counts_by_status?.distributed || 0)}명
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">환급 합계</div>
              <div className="text-2xl font-bold text-emerald-300">
                {(summary.refund_total || 0).toLocaleString('ko-KR')}원
              </div>
            </div>
            <div>
              <div className="text-sm opacity-80">추가납부 합계</div>
              <div className="text-2xl font-bold text-rose-300">
                {(summary.additional_payment_total || 0).toLocaleString('ko-KR')}원
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="text-left px-4 py-3">직원</th>
              <th className="text-left px-4 py-3">소득유형</th>
              <th className="text-left px-4 py-3">단계</th>
              <th className="text-right px-4 py-3">총급여</th>
              <th className="text-right px-4 py-3">환급/추가</th>
              <th className="text-center px-4 py-3">대조</th>
              <th className="text-center px-4 py-3">배포</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.staff_id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{emp.name}</td>
                <td className="px-4 py-3">{emp.income_type === 'earned' ? '근로' : '사업'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={emp.status} />
                </td>
                <td className="px-4 py-3 text-right">{(emp.total_pay_year || 0).toLocaleString('ko-KR')}</td>
                <td className="px-4 py-3 text-right">
                  {emp.refund_amount === null || emp.refund_amount === undefined ? '-' :
                    emp.refund_amount < 0 ?
                      <span className="text-emerald-600">{emp.refund_amount.toLocaleString('ko-KR')} (환급)</span> :
                      <span className="text-rose-600">+{emp.refund_amount.toLocaleString('ko-KR')}</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <ReconBadge status={emp.reconciliation_status} />
                </td>
                <td className="px-4 py-3 text-center">
                  {emp.distributed_to_staff ?
                    <span className="text-emerald-600 text-xs font-semibold">ON</span> :
                    <span className="text-slate-400 text-xs">OFF</span>}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setSelected(emp)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    상세
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && !loading && (
          <div className="text-center text-slate-500 py-12">대상 직원이 없습니다.</div>
        )}
        {loading && (
          <div className="text-center text-slate-500 py-12">불러오는 중...</div>
        )}
      </div>

      {selected && (
        <EmployeeDetailModal
          year={year}
          staff={selected}
          onClose={() => setSelected(null)}
          onChange={load}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    draft: ['bg-slate-100 text-slate-600', '준비'],
    aggregated: ['bg-blue-100 text-blue-700', '집계'],
    uploaded: ['bg-purple-100 text-purple-700', '업로드'],
    reconciled: ['bg-emerald-100 text-emerald-700', '검증'],
    distributed: ['bg-teal-100 text-teal-700', '배포'],
  };
  const [cls, label] = map[status] || ['bg-slate-100', status || '-'];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${cls}`}>{label}</span>;
}

function ReconBadge({ status }) {
  const map = {
    pending: ['text-slate-400', '-'],
    ok: ['text-emerald-600', 'OK'],
    warning: ['text-amber-600', '주의'],
    mismatch: ['text-rose-600', '불일치'],
  };
  const [cls, label] = map[status] || ['text-slate-400', '-'];
  return <span className={`text-xs font-medium ${cls}`}>{label}</span>;
}
