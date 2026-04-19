import { useState, useEffect } from 'react';
import { Printer, ArrowLeft, RefreshCw, Calculator } from 'lucide-react';
import api from '../../api';

export default function RetirementTab({ id, formData: staffData }) {
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('edit'); // 'edit' or 'print'

    const [formData, setFormData] = useState({
        emp_no: '',
        name: '',
        dept: '',
        level: '',
        start_date: '',
        end_date: '',
        work_days: 0,
        history: [],
    });

    const [results, setResults] = useState({
        total_gross_3m: 0,
        exact_days_3m: 0,
        daily_wage: 0,
        legal_retirement: 0,
    });

    // Fetch calculation data
    useEffect(() => {
        if (!id) return;
        const fetchCalcDetail = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/hr/retirement/calc/${id}`);
                const data = res.data.data;

                setFormData({
                    emp_no: data.staff.emp_no,
                    name: data.staff.name,
                    dept: data.staff.dept,
                    level: data.staff.level,
                    start_date: data.staff.start_date,
                    end_date: data.staff.end_date,
                    work_days: data.staff.work_days,
                    history: data.history.map((h) => ({
                        period: h.period,
                        days: h.days,
                        base_pay: h.base_pay || 0,
                        meal_pay: h.meal_pay || 0,
                        holiday_pay: h.holiday_pay || 0,
                        other_pay: 0,
                    })),
                });

                setResults({
                    total_gross_3m: data.breakdown.total_gross_3m,
                    exact_days_3m: data.breakdown.exact_days_3m,
                    daily_wage: data.breakdown.daily_wage,
                    legal_retirement: data.legal_retirement,
                });
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };
        fetchCalcDetail();
    }, [id]);

    // Client-side recalculation
    const recalculate = () => {
        if (!formData.start_date || !formData.end_date) return;

        const st = new Date(formData.start_date);
        const ed = new Date(formData.end_date);
        const wDays = Math.max(0, Math.floor((ed - st) / (1000 * 60 * 60 * 24)));
        setFormData((prev) => ({ ...prev, work_days: wDays }));

        let total_gross = 0;
        let total_days = 0;

        const updatedHistory = formData.history.map((h) => {
            const sub = Number(h.base_pay) + Number(h.meal_pay) + Number(h.holiday_pay) + Number(h.other_pay);
            total_gross += sub;
            total_days += Number(h.days);
            return { ...h, subtotal: sub };
        });

        setFormData((prev) => ({ ...prev, history: updatedHistory }));

        const finalDays = total_days > 0 ? total_days : 90;
        const daily = total_gross / finalDays;

        let legal = 0;
        if (wDays >= 365) {
            legal = Math.floor(daily * 30 * (wDays / 365));
        }

        setResults({
            total_gross_3m: total_gross,
            exact_days_3m: finalDays,
            daily_wage: Math.max(0, Math.floor(daily)),
            legal_retirement: Math.max(0, legal),
        });
    };

    const handleHistoryChange = (index, field, value) => {
        const num = value.replace(/[^0-9]/g, '');
        const newHistory = [...formData.history];
        newHistory[index][field] = num ? parseInt(num, 10) : 0;
        setFormData({ ...formData, history: newHistory });
    };

    const n = (num) => (num || 0).toLocaleString();

    // Year/Month differences
    let yDiff = 0, mDiff = 0;
    if (formData.start_date && formData.end_date) {
        const sd = new Date(formData.start_date);
        const ed = new Date(formData.end_date);
        mDiff = (ed.getFullYear() - sd.getFullYear()) * 12 + (ed.getMonth() - sd.getMonth());
        yDiff = Math.floor(mDiff / 12);
    }

    // ===================== PRINT MODE =====================
    if (mode === 'print') {
        return (
            <div>
                {/* Action bar (hidden on print) */}
                <div className="print:hidden flex justify-between items-center mb-6">
                    <button onClick={() => setMode('edit')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow">
                        <ArrowLeft size={16} /> 수정화면으로
                    </button>
                    <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all">
                        <Printer size={16} /> 인쇄 / PDF 저장
                    </button>
                </div>

                <div className="bg-white shadow-xl min-h-[1100px] p-10 md:p-14 print:shadow-none print:p-0 text-black rounded-2xl">
                    <h1 className="text-2xl font-black text-center mb-8 tracking-[0.3em] underline underline-offset-8">퇴 직 금 산 정</h1>

                    {/* Section 1: 퇴사자인적사항 */}
                    <div className="mb-8">
                        <div className="flex gap-2 items-center mb-2">
                            <div className="w-1 h-4 bg-black"></div>
                            <h2 className="text-[14px] font-black">1.퇴사자인적사항</h2>
                        </div>
                        <table className="w-full border-collapse border-t-2 border-b-2 border-black text-[12px] text-center" style={{ tableLayout: 'fixed' }}>
                            <tbody>
                                <tr className="border-b border-gray-300 bg-gray-50">
                                    <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">사 번</th>
                                    <td className="border-r border-gray-300 py-1.5 font-bold text-left pl-3 w-[13%]">{formData.emp_no || '-'}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">성 명</th>
                                    <td className="border-r border-gray-300 py-1.5 font-black text-left pl-3 w-[13%]">{formData.name || '-'}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">부 서</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal text-left pl-3 w-[13%]">{formData.dept || ' '}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">직 급</th>
                                    <td className="py-1.5 font-normal text-left pl-3">{formData.level || '직급없음'}</td>
                                </tr>
                                <tr className="border-b border-gray-300">
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">정산입사</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal">{formData.start_date || '-'}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">정산퇴사</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal">{formData.end_date || '-'}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속년수</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal">{yDiff}년</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속월수</th>
                                    <td className="py-1.5 font-normal">{mDiff}개월</td>
                                </tr>
                                <tr>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">입사일</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal">{formData.start_date || '-'}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속일수</th>
                                    <td className="border-r border-gray-300 py-1.5 font-bold text-red-600">{formData.work_days}일</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속기간</th>
                                    <td className="border-r border-gray-300 py-1.5 font-normal">{yDiff}년{mDiff % 12 > 0 ? `${mDiff % 12}월` : ''}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">제외월수</th>
                                    <td className="py-1.5 font-normal"></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 2: 퇴직금산정내역 */}
                    <div className="mb-8">
                        <div className="flex gap-2 items-center mb-2">
                            <div className="w-1 h-4 bg-black"></div>
                            <h2 className="text-[14px] font-black">2.퇴직금산정내역</h2>
                        </div>
                        <table className="w-full border-collapse border-t-2 border-b-2 border-black text-[12px] text-center" style={{ tableLayout: 'fixed' }}>
                            <thead>
                                <tr className="border-b border-gray-400 bg-gray-50 text-gray-800">
                                    <th className="border-r border-gray-300 py-1.5 w-[20%]">지급내역</th>
                                    <th className="border-r border-gray-300 py-1.5 w-[15%]">금 액</th>
                                    <th className="border-r border-gray-300 py-1.5 w-[15%]">공제내역</th>
                                    <th className="border-r border-gray-300 py-1.5 w-[15%]">금 액</th>
                                    <th className="border-r border-gray-300 py-1.5 w-[15%]">공제내역</th>
                                    <th className="py-1.5 w-[20%]">금 액</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-gray-200">
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">퇴직금</th>
                                    <td className="border-r border-gray-300 py-1.5 font-bold text-right pr-4">{n(results.legal_retirement)}</td>
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">소득세</th><td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th><td className="py-1.5"> </td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">퇴직보험금</th><td className="border-r border-gray-300 py-1.5 text-right pr-4"></td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">지방소득세</th><td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th><td className="py-1.5"> </td>
                                </tr>
                                <tr className="border-b border-gray-200">
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">명예퇴직금</th><td className="border-r border-gray-300 py-1.5 text-right pr-4"></td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th><td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th><td className="py-1.5"> </td>
                                </tr>
                                <tr className="border-b border-gray-400">
                                    <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">비과세소득</th><td className="border-r border-gray-300 py-1.5 text-right pr-4"></td><th className="border-r border-gray-300 py-1.5 font-bold bg-gray-50">공제액</th><td className="border-r border-gray-300 py-1.5 text-right pr-4 font-bold"> </td><th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th><td className="py-1.5"> </td>
                                </tr>
                                <tr className="bg-blue-50/30">
                                    <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800">지급액</th>
                                    <td className="border-r border-gray-300 py-2.5 font-black text-right pr-4 text-[14px] text-blue-700">{n(results.legal_retirement)}</td>
                                    <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800" colSpan={3}>차인지급액</th>
                                    <td className="py-2.5 font-black text-right pr-4 text-[14px] text-blue-700">{n(results.legal_retirement)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 3: 퇴직급여산정내역 */}
                    <div>
                        <div className="flex gap-2 items-center mb-2">
                            <div className="w-1 h-4 bg-black"></div>
                            <h2 className="text-[14px] font-black">3.퇴직급여산정내역</h2>
                        </div>
                        <table className="w-full border-collapse border-top-2 border-black text-[12px] text-center">
                            <thead>
                                <tr className="border-b border-t-2 border-black bg-gray-50 text-gray-700">
                                    <th className="border-r border-gray-300 py-1.5 font-bold w-[25%]" rowSpan={2}>기간</th>
                                    <th className="border-r border-gray-300 py-1 font-normal w-[12%] text-[11px]">기본급</th>
                                    <th className="border-r border-gray-300 py-1 font-normal w-[12%] text-[11px]">식대</th>
                                    <th className="border-r border-gray-300 py-1 font-normal w-[12%] text-[11px]">주휴수당</th>
                                    <th className="border-r border-gray-300 py-1 font-normal w-[12%] text-[11px]">초과근무수당</th>
                                    <th className="border-r border-gray-300 py-1 font-normal w-[12%] text-[11px]">자가운전</th>
                                    <th className="py-1 font-bold w-[15%]" rowSpan={2}>합 계</th>
                                </tr>
                                <tr className="border-b border-gray-400 bg-gray-50 text-gray-700">
                                    <th className="border-r border-gray-300 py-1 font-normal text-[11px]">주말근무수당</th>
                                    <th className="border-r border-gray-300 py-1 font-normal text-[11px]">주차지원</th>
                                    <th className="border-r border-gray-300 py-1 font-normal text-[11px]">기타미지급분</th>
                                    <th className="border-r border-gray-300 py-1 font-normal text-[11px]">출장여비</th>
                                    <th className="border-r border-gray-300 py-1 font-normal text-[11px]">기타</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.history.length > 0 ? (
                                    formData.history.map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-200">
                                            <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800 text-[11px]">{item.period}</th>
                                            <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.base_pay || 0)}</td>
                                            <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.meal_pay || 0)}</td>
                                            <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.holiday_pay || 0)}</td>
                                            <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]"></td>
                                            <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.other_pay > 0 ? item.other_pay : '')}</td>
                                            <td className="py-2.5 font-bold text-right pr-3 bg-gray-50 text-[11px]">
                                                {n(item.subtotal || 0)}
                                                <div className="text-[10px] text-gray-500 font-normal mt-0.5">({item.days}일)</div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr><td colSpan={7} className="py-10 text-gray-400 text-center">3개월 급여 내역이 조회되지 않습니다</td></tr>
                                )}
                                <tr className="border-t-2 border-b-2 border-black bg-gray-100">
                                    <th className="border-r border-gray-300 py-2 font-black text-center tracking-widest text-[13px]">합 계</th>
                                    <td colSpan={5} className="border-r border-gray-300 py-2 font-black text-right pr-4 text-[13px]">{n(results.total_gross_3m)}</td>
                                    <td className="py-2 font-black text-right pr-3 text-[13px] text-blue-700">
                                        {n(results.total_gross_3m)}
                                        <div className="text-[10px] text-gray-600 font-bold mt-0.5">({results.exact_days_3m}일)</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <table className="w-full border-collapse border-b-2 border-black text-[12px] text-center mt-[1px]">
                            <thead>
                                <tr className="border-b bg-gray-50 border-gray-300">
                                    <th className="border-r border-gray-300 py-2 font-bold w-[20%]">산정급여</th>
                                    <th className="border-r border-gray-300 py-2 font-bold w-[20%]">산정상여금</th>
                                    <th className="border-r border-gray-300 py-2 font-bold w-[20%]">합 계</th>
                                    <th className="border-r border-gray-300 py-2 font-bold w-[20%]">평균임금</th>
                                    <th className="py-2 font-black w-[20%] text-blue-800">퇴 직 금</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border-r border-gray-300 py-4 font-bold">{n(results.total_gross_3m)}</td>
                                    <td className="border-r border-gray-300 py-4 font-bold">0</td>
                                    <td className="border-r border-gray-300 py-4 font-bold">{n(results.total_gross_3m)}</td>
                                    <td className="border-r border-gray-300 py-4 font-black">{n(results.daily_wage)}</td>
                                    <td className="py-4 font-black text-[15px] text-blue-700">{n(results.legal_retirement)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <style>{`@media print { @page { margin: 10mm; size: A4 portrait; } body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>
            </div>
        );
    }

    // ===================== EDIT MODE =====================
    if (loading) {
        return (
            <div className="text-center py-20 text-slate-500">
                <RefreshCw className="animate-spin mx-auto mb-2" />
                퇴직금 산정 데이터를 불러오고 있습니다...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 1. Date Adjustments */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2 flex items-center gap-2">
                    <Calculator size={18} className="text-violet-600" />
                    산정 기준일 조정
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500">입사일</label>
                        <input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} className="mt-1 w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-slate-500">퇴사일 (기준일)</label>
                        <input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} className="mt-1 w-full p-2 border border-blue-400 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-blue-50" />
                        <p className="text-[11px] text-blue-600 mt-1">※ 퇴사일을 변경하면 전체 근속일수가 다시 계산됩니다.</p>
                    </div>
                    <div className="flex items-end">
                        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 w-full text-center">
                            <p className="text-[10px] text-slate-400 font-bold">근속기간</p>
                            <p className="text-lg font-black text-slate-800">{yDiff}년 {mDiff % 12}개월 <span className="text-sm font-bold text-slate-500">({n(formData.work_days)}일)</span></p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 3-Month Details Edit */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">직전 3개월 급여 내역 수정</h2>
                {formData.history.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-center border-collapse">
                            <thead>
                                <tr className="bg-slate-100 text-slate-600">
                                    <th className="p-2 border">적용 기간 ({results.exact_days_3m}일)</th>
                                    <th className="p-2 border">기본급</th>
                                    <th className="p-2 border">식대</th>
                                    <th className="p-2 border pl-2 text-blue-600">연차수당(+) / 잔여</th>
                                    <th className="p-2 border">기타소득</th>
                                </tr>
                            </thead>
                            <tbody>
                                {formData.history.map((h, i) => (
                                    <tr key={i}>
                                        <td className="p-2 border font-medium text-xs text-slate-700 bg-slate-50">
                                            {h.period}<br />({h.days}일)
                                        </td>
                                        <td className="p-2 border">
                                            <input type="text" value={n(h.base_pay)} onChange={(e) => handleHistoryChange(i, 'base_pay', e.target.value)} className="w-full text-right p-1.5 border border-slate-300 rounded" />
                                        </td>
                                        <td className="p-2 border">
                                            <input type="text" value={n(h.meal_pay)} onChange={(e) => handleHistoryChange(i, 'meal_pay', e.target.value)} className="w-full text-right p-1.5 border border-slate-300 rounded" />
                                        </td>
                                        <td className="p-2 border">
                                            <input type="text" value={n(h.holiday_pay)} onChange={(e) => handleHistoryChange(i, 'holiday_pay', e.target.value)} className="w-full text-right p-1.5 border border-blue-300 bg-blue-50 rounded text-blue-800" placeholder="연차/주휴" />
                                        </td>
                                        <td className="p-2 border">
                                            <input type="text" value={n(h.other_pay)} onChange={(e) => handleHistoryChange(i, 'other_pay', e.target.value)} className="w-full text-right p-1.5 border border-slate-300 rounded" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        급여 내역이 없습니다. 급여대장 탭에서 급여를 먼저 등록해주세요.
                    </div>
                )}
            </div>

            {/* 3. Summary & Actions */}
            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                    <div className="text-left">
                        <h3 className="text-indigo-900 font-bold text-lg">최종 퇴직금 시뮬레이션</h3>
                        <p className="text-indigo-700/80 text-sm">입력하신 데이터를 바탕으로 다시 계산합니다.</p>
                    </div>
                    <button onClick={recalculate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all">
                        <RefreshCw size={18} /> 재계산 적용하기
                    </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-indigo-200/50 pt-6">
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 text-left">
                        <p className="text-[11px] text-slate-500 font-bold">1일 평균임금</p>
                        <p className="text-lg font-black text-slate-800">{n(results.daily_wage)}<span className="text-xs font-normal">원</span></p>
                    </div>
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-indigo-50 text-left">
                        <p className="text-[11px] text-slate-500 font-bold">총 근속일수</p>
                        <p className="text-lg font-black text-slate-800">{n(formData.work_days)}<span className="text-xs font-normal">일</span></p>
                    </div>
                    <div className="col-span-2 bg-gradient-to-r from-indigo-500 to-blue-600 p-4 rounded-xl shadow-md text-white flex justify-between items-center">
                        <p className="text-sm font-bold opacity-90">최종 산정 퇴직금</p>
                        <p className="text-2xl font-black">{n(results.legal_retirement)}원</p>
                    </div>
                </div>
            </div>

            {/* Print Button */}
            <div className="flex justify-end pt-2">
                <button onClick={() => setMode('print')} className="bg-slate-900 hover:bg-black text-white px-8 py-4 rounded-xl font-black text-lg flex items-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all">
                    <Printer size={22} /> 확정 및 명세서(PDF) 출력
                </button>
            </div>
        </div>
    );
}
