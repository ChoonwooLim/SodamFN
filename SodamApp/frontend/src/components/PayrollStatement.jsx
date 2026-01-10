import React, { useState, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';

const PayrollPaper = ({ staff, payroll, scale = 1, isPrint = false }) => {
    const formatDate = (monthStr) => {
        if (!monthStr || typeof monthStr !== 'string') return '';
        const parts = monthStr.split('-');
        if (parts.length < 2) return monthStr;
        const [year, month] = parts;
        return `${year}년 ${parseInt(month)}월`;
    };

    const safeLocaleString = (val) => {
        if (val === null || val === undefined) return '0';
        try {
            return val.toLocaleString();
        } catch (e) {
            return String(val);
        }
    };

    let details = { work_breakdown: [], holiday_details: {} };
    try {
        if (payroll?.details_json) {
            details = typeof payroll.details_json === 'string'
                ? JSON.parse(payroll.details_json)
                : payroll.details_json;
        }
    } catch (e) {
        console.error("Failed to parse payroll details", e);
    }

    if (!details || typeof details !== 'object') {
        details = { work_breakdown: [], holiday_details: {} };
    }

    const style = isPrint ? {
        width: '210mm',
        height: '297mm',
        margin: 0,
        padding: '12mm',
        backgroundColor: 'white',
        transform: 'none',
        boxShadow: 'none',
        position: 'relative'
    } : {
        width: '210mm',
        height: '297mm',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        backgroundColor: 'white',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: '12mm',
        position: 'relative'
    };

    return (
        <div style={style} className={`text-slate-900 font-sans border-none ring-0 ${isPrint ? 'print-content' : ''}`}>
            {/* Title Section */}
            <div className="text-center mb-4 pt-1">
                <h1 className="text-2xl font-black tracking-tighter border-b-[3px] border-double border-slate-800 pb-0.5 inline-block px-8">
                    {formatDate(payroll.month)} 급여 지급 명세서
                </h1>
            </div>

            {/* Staff Info Table */}
            <table className="w-full border-2 border-slate-800 border-collapse mb-4 text-xs">
                <tbody>
                    <tr className="h-10">
                        <td className="w-28 bg-slate-100 font-bold text-center border border-slate-800 text-[12px]">성 명</td>
                        <td className="px-5 border border-slate-800 text-lg font-black tracking-widest">{staff?.name || ''}</td>
                        <td className="w-28 bg-slate-100 font-bold text-center border border-slate-800 text-[12px]">직 위</td>
                        <td className="px-5 border border-slate-800 text-lg font-bold">{staff?.role || ''}</td>
                    </tr>
                </tbody>
            </table>

            {/* Main Content: Earnings and Deductions Side by Side */}
            <div className="flex flex-1 border-x-2 border-b-2 border-slate-800 border-t-0 mb-6 min-h-0">
                {/* Earnings Table (60%) */}
                <div className="w-[60%] border-r-2 border-slate-800 flex flex-col">
                    <div className="bg-slate-800 text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-widest">지급 항목 (Earnings)</div>
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-collapse text-[11px] table-fixed">
                            <thead>
                                <tr className="bg-slate-100 h-8 border-b border-slate-800">
                                    <th className="border-r border-slate-800 px-3 font-bold w-[70%] text-center">항 목</th>
                                    <th className="px-3 font-bold text-center">금 액 (원)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details.work_breakdown && details.work_breakdown.length > 0 ? (
                                    details.work_breakdown.map((item, idx) => (
                                        <React.Fragment key={idx}>
                                            <tr className="border-b border-dotted border-slate-300 h-9">
                                                <td className="px-3 border-r border-slate-800">
                                                    <div className="flex items-baseline gap-2">
                                                        <div className="font-bold text-[11px] leading-tight whitespace-nowrap">
                                                            {(item.label || '').replace('시급(', '근무시간 : ').replace(')', '')}
                                                        </div>
                                                        <div className="text-[9px] text-slate-500 leading-tight whitespace-nowrap">
                                                            ({safeLocaleString(item.rate)}원 × {item.hours || 0}H × {item.days || 0}D)
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 text-right font-bold text-[13px]">
                                                    {safeLocaleString(item.amount)}
                                                </td>
                                            </tr>
                                            {item.dates && (
                                                <tr className="border-b border-slate-800">
                                                    <td colSpan="2" className="px-3 py-1 text-[9px] text-slate-400 bg-slate-50/50 italic leading-none truncate">
                                                        {item.dates}
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    <tr className="border-b border-slate-800 h-9">
                                        <td className="px-3 border-r border-slate-800 font-bold">기본급</td>
                                        <td className="px-3 text-right font-bold">{safeLocaleString(payroll.base_pay)}</td>
                                    </tr>
                                )}

                                {payroll.bonus_meal > 0 && (
                                    <tr className="border-b border-slate-800 h-9">
                                        <td className="px-3 border-r border-slate-800 font-bold">식비지원</td>
                                        <td className="px-3 text-right font-bold">{safeLocaleString(payroll.bonus_meal)}</td>
                                    </tr>
                                )}

                                {/* Weekly Holiday Detail */}
                                {payroll.bonus_holiday > 0 && (
                                    <>
                                        <tr className="bg-indigo-50/30 border-b border-slate-800 h-7">
                                            <td colSpan="2" className="px-3 font-black text-[10px] text-indigo-900 border-b border-slate-800 bg-indigo-50/50">주휴수당 (Holiday Pay)</td>
                                        </tr>
                                        {[1, 2, 3, 4, 5].map(w => {
                                            const amt = payroll[`holiday_w${w}`];
                                            const calc = details.holiday_details ? details.holiday_details[w.toString()] : null;
                                            if (amt > 0) {
                                                return (
                                                    <tr key={w} className="border-b border-slate-300 h-8">
                                                        <td className="px-3 border-r border-slate-800">
                                                            <div className="font-bold text-slate-600 text-[11px]">{w}주차</div>
                                                            {calc && <div className="text-[9px] text-slate-400 font-normal leading-tight">{calc}</div>}
                                                        </td>
                                                        <td className="px-3 text-right font-bold text-[12px]">
                                                            {safeLocaleString(amt)}
                                                        </td>
                                                    </tr>
                                                );
                                            }
                                            return null;
                                        })}
                                        <tr className="bg-slate-100 border-b border-slate-800 h-8">
                                            <td className="px-3 border-r border-slate-800 font-black text-right pr-4 italic text-[11px]">주휴수당 합계</td>
                                            <td className="px-3 text-right font-black text-[12px]">{safeLocaleString(payroll.bonus_holiday)}</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Deductions Table (40%) */}
                <div className="w-[40%] flex flex-col">
                    <div className="bg-slate-800 text-white font-bold text-center py-1.5 text-[11px] uppercase tracking-widest">공제 항목 (Deductions)</div>
                    <div className="flex-1 flex flex-col">
                        <table className="w-full border-collapse text-[11px] table-fixed">
                            <thead>
                                <tr className="bg-slate-100 h-8 border-b border-slate-800">
                                    <th className="border-r border-slate-800 px-3 font-bold w-[60%] text-center">항 목</th>
                                    <th className="px-3 font-bold text-center">금 액 (원)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: '국민연금', val: payroll.deduction_np },
                                    { label: '건강보험', val: payroll.deduction_hi },
                                    { label: '고용보험', val: payroll.deduction_ei },
                                    { label: '장기요양보험', val: payroll.deduction_lti },
                                    { label: '소득세', val: payroll.deduction_it },
                                    { label: '지방소득세', val: payroll.deduction_lit },
                                ].map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-800 h-9">
                                        <td className="px-3 border-r border-slate-800 font-bold text-[11px]">{item.label}</td>
                                        <td className="px-3 text-right font-bold text-slate-700">{item.val > 0 ? safeLocaleString(item.val) : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Summary Footer Section */}
            <table className="w-full border-4 border-slate-800 border-collapse mb-4">
                <tbody>
                    <tr className="h-9 text-[12px]">
                        <td className="w-1/4 bg-slate-100 font-black border-2 border-slate-800 text-center">지급총액 (A)</td>
                        <td className="w-1/4 border-2 border-slate-800 text-center font-black text-base">{safeLocaleString((payroll.base_pay || 0) + (payroll.bonus || 0))}</td>
                        <td className="w-1/4 bg-slate-100 font-black border-2 border-slate-800 text-center">공제총액 (B)</td>
                        <td className="w-1/4 border-2 border-slate-800 text-center font-black text-base text-red-600">{safeLocaleString(payroll.deductions)}</td>
                    </tr>
                    <tr className="h-14 bg-slate-900 text-white">
                        <td className="w-1/4 font-black border-2 border-slate-800 text-center text-[11px] uppercase leading-tight">실 수령액<br />(NET PAY)</td>
                        <td colSpan="3" className="border-2 border-slate-800 text-center">
                            <div className="text-xl font-black tracking-widest leading-none mb-0.5">₩ {safeLocaleString(payroll.total_pay)}</div>
                            <div className="text-[9px] font-medium opacity-60 uppercase tracking-widest">(A - B = 차감 지급액)</div>
                        </td>
                    </tr>
                    <tr className="h-9 text-[12px]">
                        <td className="w-1/4 bg-slate-100 font-bold border-2 border-slate-800 text-center">급여 수령 계좌</td>
                        <td colSpan="3" className="px-8 border-2 border-slate-800 text-base font-black text-slate-800 tracking-wider">
                            {staff.bank_account || '기록 없음'}
                        </td>
                    </tr>
                </tbody>
            </table>

            {/* Signature Section */}
            <div className="text-center mt-auto border-t-2 border-slate-200 pt-4 pb-2">
                <p className="text-xl font-bold text-slate-800 mb-2 tracking-tight">위와 같이 급여를 지급합니다.</p>
                <p className="text-sm text-slate-500 mb-4 font-medium italic">{(new Date()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

                <div className="flex justify-center items-center gap-10">
                    <span className="text-[18px] font-black tracking-[0.4em] text-slate-800">소담김밥 대표</span>
                    <div className="relative">
                        <span className="text-[22px] font-black text-slate-900 tracking-widest">HONG JI YEON</span>
                        <div className="absolute -top-4 -right-12 w-10 h-10 border-[3px] border-red-500 rounded-full flex items-center justify-center text-red-600 font-black text-[12px] rotate-12 bg-white/10 backdrop-blur-[1px] shadow-sm">
                            (인)
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default function PayrollStatement({ staff, payroll, onClose }) {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(0.5);

    useLayoutEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return;

            const container = containerRef.current;
            const availableHeight = container.clientHeight - 4;
            const availableWidth = container.clientWidth - 4;
            const contentHeight = 297 * 3.78; // A4 height in px at 96dpi
            const contentWidth = 210 * 3.78;  // A4 width in px at 96dpi

            const scaleH = availableHeight / contentHeight;
            const scaleW = availableWidth / contentWidth;
            const finalScale = Math.min(scaleH, scaleW);

            setScale(finalScale);
        };

        const observer = new ResizeObserver(updateScale);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        updateScale();
        return () => observer.disconnect();
    }, []);

    if (!staff || !payroll) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 no-print">
                <div
                    className="bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col h-[98vh] my-auto"
                    style={{ width: 'min(98vh * 210/297, 98vw)' }}
                >
                    {/* Header */}
                    <div className="p-3 border-b flex justify-between items-center bg-white">
                        <h3 className="font-bold text-slate-800 text-sm">급여명세서 미리보기</h3>
                        <div className="flex gap-4 items-center">
                            <button
                                onClick={handlePrint}
                                className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold shadow-md active:scale-95"
                            >
                                <Printer size={18} /> 인쇄하기
                            </button>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>

                    {/* Preview Content Container - Scaled */}
                    <div
                        ref={containerRef}
                        className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden"
                    >
                        <PayrollPaper staff={staff} payroll={payroll} scale={scale} isPrint={false} />
                    </div>
                </div>
            </div>

            {/* Hidden Print Container - Rendered via Portal for Print Only */}
            {createPortal(
                <div className="print-portal-container">
                    <PayrollPaper staff={staff} payroll={payroll} scale={1} isPrint={true} />
                </div>,
                document.body
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                @page { 
                    size: A4; 
                    margin: 0; 
                }
                
                /* Hide everything by default for print */
                @media print {
                    /* Force background colors to print */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    body > * {
                        display: none !important;
                    }
                    
                    /* But show our portal container */
                    body > .print-portal-container {
                        display: block !important;
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        overflow: visible !important;
                    }
                    
                    /* Ensure global background is white */
                    html, body {
                        background: white !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                }
                
                /* Hide portal content in screen view */
                @media screen {
                    .print-portal-container {
                        display: none;
                    }
                }
            `}} />
        </>
    );
}
