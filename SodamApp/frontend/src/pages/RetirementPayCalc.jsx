import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowLeft } from 'lucide-react';
import api from '../api';

export default function RetirementPayCalc() {
    const { staffId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCalcDetail = async () => {
            try {
                const res = await api.get(`/hr/retirement/calc/${staffId}`);
                setData(res.data.data);
            } catch (error) {
                console.error(error);
                alert('퇴직금 산정 내역을 불러오지 못했습니다.');
                navigate('/retirement');
            } finally {
                setLoading(false);
            }
        };

        fetchCalcDetail();
    }, [staffId, navigate]);

    if (loading) return <div className="text-center py-20 text-slate-500">데이터를 불러오는 중...</div>;
    if (!data) return <div className="text-center py-20 text-slate-500">데이터가 없습니다.</div>;

    const { staff, breakdown, history, legal_retirement } = data;

    // Helper functions for formatting
    const n = (num) => (num || 0).toLocaleString();

    // Date calculations to mimic accountant form
    const st = new Date(staff.start_date);
    const ed = new Date(staff.end_date);
    const mDiff = (ed.getFullYear() - st.getFullYear()) * 12 + (ed.getMonth() - st.getMonth());
    const yDiff = Math.floor(mDiff / 12);
    
    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-slate-50 min-h-screen pb-20">
            {/* Header / Actions - Hidden on print */}
            <div className="print:hidden max-w-4xl mx-auto p-4 flex justify-between items-center mb-6">
                <button onClick={() => navigate('/retirement')} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow">
                    <ArrowLeft size={16} /> 돌아가기
                </button>
                <div className="flex gap-2">
                    <button onClick={handlePrint} className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all">
                        <Printer size={16} /> PDF 인쇄 / 다운로드
                    </button>
                </div>
            </div>

            {/* A4 Print Paper Area */}
            <div className="max-w-4xl mx-auto bg-white shadow-xl min-h-[1100px] p-10 md:p-14 print:shadow-none print:p-0 text-black">
                
                {/* Document Title */}
                <h1 className="text-2xl font-black text-center mb-8 tracking-[0.3em] underline underline-offset-8">퇴 직 금 산 정</h1>

                {/* Section 1: Insa Info */}
                <div className="mb-8">
                    <div className="flex gap-2 items-center mb-2">
                        <div className="w-1 h-4 bg-black"></div>
                        <h2 className="text-[14px] font-black">1.퇴사자인적사항</h2>
                    </div>
                    <table className="w-full border-collapse border-t-2 border-b-2 border-black text-[12px] text-center" style={{ tableLayout: 'fixed' }}>
                        <tbody>
                            <tr className="border-b border-gray-300 bg-gray-50">
                                <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">사 번</th>
                                <td className="border-r border-gray-300 py-1.5 font-bold text-left pl-3 w-[13%]">{staff.emp_no || '-'}</td>
                                <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">성 명</th>
                                <td className="border-r border-gray-300 py-1.5 font-black text-left pl-3 w-[13%]">{staff.name || '-'}</td>
                                <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">부 서</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal text-left pl-3 w-[13%]">{staff.dept || ' '}</td>
                                <th className="border-r border-gray-300 py-1.5 font-bold text-gray-700 w-[12%]">직 급</th>
                                <td className="py-1.5 font-normal text-left pl-3">{staff.level || '직급없음'}</td>
                            </tr>
                            <tr className="border-b border-gray-300">
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">정산입사</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal">{staff.start_date || '-'}</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">정산퇴사</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal">{staff.end_date || '-'}</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속년수</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal">{yDiff}년</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속월수</th>
                                <td className="py-1.5 font-normal">{mDiff}개월</td>
                            </tr>
                            <tr>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">입사일</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal">{staff.start_date || '-'}</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속일수</th>
                                <td className="border-r border-gray-300 py-1.5 font-bold text-red-600">{staff.work_days}일</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">근속기간</th>
                                <td className="border-r border-gray-300 py-1.5 font-normal">{yDiff}년{mDiff % 12 > 0 ? `${mDiff % 12}월` : ''}</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">제외월수</th>
                                <td className="py-1.5 font-normal"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Section 2: Severance Details */}
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
                                <td className="border-r border-gray-300 py-1.5 font-bold text-right pr-4">{n(legal_retirement)}</td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">소득세</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th>
                                <td className="py-1.5"> </td>
                            </tr>
                            <tr className="border-b border-gray-200">
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">퇴직보험금</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"></td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">지방소득세</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th>
                                <td className="py-1.5"> </td>
                            </tr>
                            <tr className="border-b border-gray-200">
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">명예퇴직금</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"></td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"> </td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th>
                                <td className="py-1.5"> </td>
                            </tr>
                            <tr className="border-b border-gray-400">
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50">비과세소득</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4"></td>
                                <th className="border-r border-gray-300 py-1.5 font-bold bg-gray-50">공제액</th>
                                <td className="border-r border-gray-300 py-1.5 text-right pr-4 font-bold"> </td>
                                <th className="border-r border-gray-300 py-1.5 font-normal bg-gray-50"> </th>
                                <td className="py-1.5"> </td>
                            </tr>
                            <tr className="bg-blue-50/30">
                                <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800">지급액</th>
                                <td className="border-r border-gray-300 py-2.5 font-black text-right pr-4 text-[14px] text-blue-700">{n(legal_retirement)}</td>
                                <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800" colSpan={3}>차인지급액</th>
                                <td className="py-2.5 font-black text-right pr-4 text-[14px] text-blue-700">{n(legal_retirement)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Section 3: Average Wage Calculation */}
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
                            {history.length > 0 ? (
                                history.map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-200">
                                        <th className="border-r border-gray-300 py-2.5 font-bold text-gray-800 text-[11px]">{item.period}</th>
                                        <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.base_pay || 0)}</td>
                                        <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.meal_pay || 0)}</td>
                                        <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]">{n(item.holiday_pay || 0)}</td>
                                        <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]"></td>
                                        <td className="border-r border-gray-300 py-2.5 text-right pr-2 text-[11px]"></td>
                                        <td className="py-2.5 font-bold text-right pr-3 bg-gray-50 text-[11px]">
                                            {n(item.subtotal || 0)}
                                            <div className="text-[10px] text-gray-500 font-normal mt-0.5">({item.days}일)</div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="py-10 text-gray-400 text-center">3개월 급여 내역이 조회되지 않습니다 (설정된 기본급/시급으로 예상 산정됨)</td>
                                </tr>
                            )}
                            {/* Summary Line 1 */}
                            <tr className="border-t-2 border-b-2 border-black bg-gray-100">
                                <th className="border-r border-gray-300 py-2 font-black text-center tracking-widest text-[13px]">합 계</th>
                                <td colSpan={5} className="border-r border-gray-300 py-2 font-black text-right pr-4 text-[13px]">{n(breakdown.total_gross_3m)}</td>
                                <td className="py-2 font-black text-right pr-3 text-[13px] text-blue-700">
                                    {n(breakdown.total_gross_3m)}
                                    <div className="text-[10px] text-gray-600 font-bold mt-0.5">({breakdown.exact_days_3m}일)</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Final 5 block layout mimicking PDF footer */}
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
                                <td className="border-r border-gray-300 py-4 font-bold">{n(breakdown.total_gross_3m)}</td>
                                <td className="border-r border-gray-300 py-4 font-bold">0</td>
                                <td className="border-r border-gray-300 py-4 font-bold">{n(breakdown.total_gross_3m)}</td>
                                <td className="border-r border-gray-300 py-4 font-black">{n(breakdown.daily_wage)}</td>
                                <td className="py-4 font-black text-[15px] text-blue-700">{n(legal_retirement)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Print Styling Global Defaults */}
            <style jsx="true" global="true">{`
                @media print {
                    @page { margin: 10mm; size: A4 portrait; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
        </div>
    );
}
