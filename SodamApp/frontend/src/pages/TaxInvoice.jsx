import { useState, useEffect, useMemo } from 'react';
import {
    Receipt, ExternalLink, ShieldCheck, Loader2, Plus, Trash2,
    RefreshCw, AlertCircle, CheckCircle2, Info, FileCheck,
} from 'lucide-react';
import api from '../api';

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const emptyDetail = () => ({
    itemName: '',
    qty: '1',
    unitCost: '',
    supplyCost: '',
    tax: '',
    spec: '',
    remark: '',
});

const formatNumber = (n) => {
    const v = Number(String(n || '').replace(/,/g, ''));
    if (!isFinite(v) || v === 0) return '';
    return v.toLocaleString('ko-KR');
};

const toInt = (s) => parseInt(String(s || '').replace(/[^\d-]/g, ''), 10) || 0;

export default function TaxInvoice() {
    const [status, setStatus] = useState(null);
    const [issuer, setIssuer] = useState(null);
    const [issuing, setIssuing] = useState(false);
    const [result, setResult] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState({ total: 0, list: [] });
    const [openingUrl, setOpeningUrl] = useState(null);

    // 폼 상태
    const [form, setForm] = useState({
        invoicee_corp_num: '',
        invoicee_corp_name: '',
        invoicee_ceo_name: '',
        invoicee_addr: '',
        invoicee_email1: '',
        invoicee_tel: '',
        invoicee_type: '사업자',
        write_date: today(),
        tax_type: '과세',
        purpose_type: '청구',
        remark1: '',
    });
    const [details, setDetails] = useState([emptyDetail()]);

    useEffect(() => {
        loadStatus();
        loadIssuer();
        loadHistory();
    }, []);

    const loadStatus = async () => {
        try {
            const res = await api.get('/taxinvoice/status');
            setStatus(res.data);
        } catch { /* noop */ }
    };

    const loadIssuer = async () => {
        try {
            const res = await api.get('/taxinvoice/issuer');
            setIssuer(res.data);
        } catch (e) {
            setIssuer({ error: e?.response?.data?.detail || '공급자 정보를 불러올 수 없습니다.' });
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/taxinvoice/search', { params: { per_page: 50 } });
            if (res.data.ok) {
                setHistory({ total: res.data.total || 0, list: res.data.list || [] });
            } else {
                setHistory({ total: 0, list: [], error: res.data.error });
            }
        } catch (e) {
            setHistory({ total: 0, list: [], error: e?.response?.data?.detail || '이력 조회 실패' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const openPopbillURL = async (togo) => {
        setOpeningUrl(togo);
        try {
            const res = await api.get('/taxinvoice/popbill-url', { params: { togo } });
            if (res.data.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            } else {
                alert('URL을 가져오지 못했습니다.');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '팝빌 URL 생성 실패');
        } finally {
            setOpeningUrl(null);
        }
    };

    const updateDetail = (idx, key, value) => {
        const next = [...details];
        next[idx] = { ...next[idx], [key]: value };
        // 공급가액/세액 자동 계산 (과세일 때)
        const qty = toInt(next[idx].qty);
        const unit = toInt(next[idx].unitCost);
        if (key === 'qty' || key === 'unitCost') {
            const supply = qty * unit;
            next[idx].supplyCost = supply ? String(supply) : '';
            next[idx].tax = form.tax_type === '과세' && supply ? String(Math.round(supply * 0.1)) : '0';
        } else if (key === 'supplyCost') {
            const supply = toInt(value);
            next[idx].tax = form.tax_type === '과세' && supply ? String(Math.round(supply * 0.1)) : '0';
        }
        setDetails(next);
    };

    const addDetail = () => setDetails([...details, emptyDetail()]);
    const removeDetail = (idx) => setDetails(details.length > 1 ? details.filter((_, i) => i !== idx) : details);

    const totals = useMemo(() => {
        const supply = details.reduce((s, d) => s + toInt(d.supplyCost), 0);
        const tax = details.reduce((s, d) => s + toInt(d.tax), 0);
        return { supply, tax, total: supply + tax };
    }, [details]);

    const canIssue = useMemo(() => {
        const corpOk = (form.invoicee_corp_num || '').replace(/\D/g, '').length === 10;
        const nameOk = !!form.invoicee_corp_name;
        const detailOk = details.some((d) => d.itemName && toInt(d.supplyCost) > 0);
        return corpOk && nameOk && detailOk && !issuing;
    }, [form, details, issuing]);

    const handleIssue = async () => {
        if (!canIssue) return;
        const confirmMsg = `${form.invoicee_corp_name}에 ${totals.total.toLocaleString('ko-KR')}원 세금계산서를 발행합니다.\n※ 팝빌 건당 과금(~88원)이 발생합니다.`;
        if (!window.confirm(confirmMsg)) return;

        setIssuing(true);
        setResult(null);
        try {
            const res = await api.post('/taxinvoice/issue', {
                ...form,
                supply_cost_total: String(totals.supply),
                tax_total: String(totals.tax),
                total_amount: String(totals.total),
                details: details.filter((d) => d.itemName && toInt(d.supplyCost) > 0),
            });
            setResult({ ok: true, ...res.data });
            loadHistory();
        } catch (e) {
            setResult({ ok: false, error: e?.response?.data?.detail || '발행 실패' });
        } finally {
            setIssuing(false);
        }
    };

    const resetForm = () => {
        setForm({
            invoicee_corp_num: '', invoicee_corp_name: '', invoicee_ceo_name: '',
            invoicee_addr: '', invoicee_email1: '', invoicee_tel: '', invoicee_type: '사업자',
            write_date: today(), tax_type: '과세', purpose_type: '청구', remark1: '',
        });
        setDetails([emptyDetail()]);
        setResult(null);
    };

    const inputCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none";

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-xl">
                            <Receipt size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">전자세금계산서</h1>
                            <p className="text-sm text-slate-500">매출 세금계산서 자동 발행 · 팝빌 연동</p>
                        </div>
                    </div>
                </div>

                {/* 상태 배너 */}
                {status && (
                    <div className={`mb-4 p-3 rounded-xl border text-sm flex items-start gap-2 ${
                        status.is_stub
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}>
                        {status.is_stub ? <AlertCircle size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
                        <span>{status.note}</span>
                    </div>
                )}

                {/* 팝빌 바로가기 */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ExternalLink size={16} className="text-slate-500" />
                        <h2 className="font-semibold text-slate-700 text-sm">팝빌 공식 페이지 바로가기</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { togo: 'TBOX', label: '매출 발행함', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                            { togo: 'SBOX', label: '매출 임시저장함', color: 'bg-slate-50 text-slate-700 hover:bg-slate-100' },
                            { togo: 'WRITE', label: '직접 작성', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                            { togo: 'CERT', label: '인증서 등록', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                        ].map((b) => (
                            <button
                                key={b.togo}
                                onClick={() => openPopbillURL(b.togo)}
                                disabled={openingUrl === b.togo}
                                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${b.color} disabled:opacity-50`}
                            >
                                {openingUrl === b.togo ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                {b.label}
                            </button>
                        ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                        ※ 복잡한 세금계산서는 팝빌 공식 UI(공인인증서 로그인)에서 작성하세요. 아래 빠른 발행은 간단 매출 건용입니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* 빠른 발행 폼 */}
                    <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileCheck size={18} className="text-indigo-600" /> 빠른 발행
                            </h2>
                            <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                <RefreshCw size={12} /> 초기화
                            </button>
                        </div>

                        {/* 공급자 (읽기 전용) */}
                        {issuer && !issuer.error && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                                <div className="text-xs text-slate-500 mb-1">공급자 (자동)</div>
                                <div className="font-semibold text-slate-800">{issuer.corp_name} · {issuer.corp_num}</div>
                                {issuer.ceo_name && <div className="text-xs text-slate-600">{issuer.ceo_name} / {issuer.addr}</div>}
                            </div>
                        )}
                        {issuer?.error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5" />
                                <span>{issuer.error} (환경설정 → 회사정보 관리에서 사업자번호를 입력하세요)</span>
                            </div>
                        )}

                        {/* 공급받는자 */}
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-slate-500">공급받는자</div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    className={inputCls}
                                    placeholder="사업자번호 (10자리)"
                                    value={form.invoicee_corp_num}
                                    onChange={(e) => setForm({ ...form, invoicee_corp_num: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="상호명 *"
                                    value={form.invoicee_corp_name}
                                    onChange={(e) => setForm({ ...form, invoicee_corp_name: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="대표자"
                                    value={form.invoicee_ceo_name}
                                    onChange={(e) => setForm({ ...form, invoicee_ceo_name: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="연락처"
                                    value={form.invoicee_tel}
                                    onChange={(e) => setForm({ ...form, invoicee_tel: e.target.value })}
                                />
                                <input
                                    className={`${inputCls} col-span-2`}
                                    placeholder="주소"
                                    value={form.invoicee_addr}
                                    onChange={(e) => setForm({ ...form, invoicee_addr: e.target.value })}
                                />
                                <input
                                    className={`${inputCls} col-span-2`}
                                    placeholder="이메일 (발행 알림 수신)"
                                    value={form.invoicee_email1}
                                    onChange={(e) => setForm({ ...form, invoicee_email1: e.target.value })}
                                />
                            </div>

                            <div className="text-xs font-semibold text-slate-500 pt-2">세금계산서 정보</div>
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    className={inputCls}
                                    placeholder="작성일자 YYYYMMDD"
                                    value={form.write_date}
                                    onChange={(e) => setForm({ ...form, write_date: e.target.value.replace(/\D/g, '').slice(0, 8) })}
                                />
                                <select
                                    className={inputCls}
                                    value={form.tax_type}
                                    onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                                >
                                    <option value="과세">과세 (10%)</option>
                                    <option value="영세">영세 (0%)</option>
                                    <option value="면세">면세</option>
                                </select>
                                <select
                                    className={inputCls}
                                    value={form.purpose_type}
                                    onChange={(e) => setForm({ ...form, purpose_type: e.target.value })}
                                >
                                    <option value="청구">청구</option>
                                    <option value="영수">영수</option>
                                </select>
                            </div>

                            {/* 품목 */}
                            <div className="text-xs font-semibold text-slate-500 pt-2">품목</div>
                            {details.map((d, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-xl space-y-2">
                                    <div className="flex gap-2">
                                        <input
                                            className={inputCls}
                                            placeholder={`품목명 #${idx + 1}`}
                                            value={d.itemName}
                                            onChange={(e) => updateDetail(idx, 'itemName', e.target.value)}
                                        />
                                        {details.length > 1 && (
                                            <button onClick={() => removeDetail(idx)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="삭제">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        <input
                                            className={inputCls}
                                            placeholder="수량"
                                            value={d.qty}
                                            onChange={(e) => updateDetail(idx, 'qty', e.target.value.replace(/\D/g, ''))}
                                        />
                                        <input
                                            className={inputCls}
                                            placeholder="단가"
                                            value={formatNumber(d.unitCost)}
                                            onChange={(e) => updateDetail(idx, 'unitCost', e.target.value.replace(/\D/g, ''))}
                                        />
                                        <input
                                            className={inputCls}
                                            placeholder="공급가액"
                                            value={formatNumber(d.supplyCost)}
                                            onChange={(e) => updateDetail(idx, 'supplyCost', e.target.value.replace(/\D/g, ''))}
                                        />
                                        <input
                                            className={`${inputCls} bg-slate-100`}
                                            placeholder="세액"
                                            value={formatNumber(d.tax)}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            ))}
                            <button
                                onClick={addDetail}
                                className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-300 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                            >
                                <Plus size={14} /> 품목 추가
                            </button>

                            {/* 비고 */}
                            <input
                                className={inputCls}
                                placeholder="비고 (선택)"
                                value={form.remark1}
                                onChange={(e) => setForm({ ...form, remark1: e.target.value })}
                            />

                            {/* 합계 */}
                            <div className="mt-4 p-4 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <div className="text-xs text-slate-500">공급가액</div>
                                        <div className="font-bold text-slate-800">{totals.supply.toLocaleString('ko-KR')}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">세액</div>
                                        <div className="font-bold text-slate-800">{totals.tax.toLocaleString('ko-KR')}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs text-slate-500">합계</div>
                                        <div className="font-bold text-indigo-700 text-lg">{totals.total.toLocaleString('ko-KR')}</div>
                                    </div>
                                </div>
                            </div>

                            {/* 발행 버튼 */}
                            <button
                                onClick={handleIssue}
                                disabled={!canIssue}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {issuing ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                                {issuing ? '발행 중...' : '세금계산서 발행'}
                            </button>

                            {/* 결과 */}
                            {result && (
                                <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                                    result.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {result.ok ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                                    <div className="flex-1">
                                        {result.ok ? (
                                            <>
                                                <div className="font-bold">발행 완료</div>
                                                {result.invoice_num && <div className="text-xs">국세청 승인번호: {result.invoice_num}</div>}
                                                {result.issue_dt && <div className="text-xs">발행일시: {result.issue_dt}</div>}
                                                {result.mgt_key && <div className="text-xs">관리번호: {result.mgt_key}</div>}
                                            </>
                                        ) : (
                                            <div className="font-medium">{result.error}</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 발행 이력 */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Receipt size={18} className="text-indigo-600" /> 발행 이력
                                <span className="text-xs text-slate-400 font-normal">({history.total})</span>
                            </h2>
                            <button onClick={loadHistory} disabled={historyLoading} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                {historyLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 새로고침
                            </button>
                        </div>

                        {history.error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs">
                                {history.error}
                            </div>
                        )}
                        {!history.error && history.list.length === 0 && !historyLoading && (
                            <div className="text-center py-8 text-slate-400 text-sm flex flex-col items-center gap-2">
                                <Info size={20} />
                                최근 90일 발행 내역이 없습니다.
                            </div>
                        )}

                        <div className="space-y-2 max-h-[700px] overflow-y-auto">
                            {history.list.map((it, idx) => (
                                <div key={idx} className="p-3 bg-slate-50 rounded-xl text-sm">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-semibold text-slate-800 truncate">
                                            {it.invoiceeCorpName || it.invoicerCorpName || '-'}
                                        </span>
                                        <span className="text-xs text-slate-500">{it.writeDate}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500">{it.stateMemo || it.purposeType || ''}</span>
                                        <span className="font-bold text-indigo-700">
                                            {Number(it.totalAmount || 0).toLocaleString('ko-KR')}원
                                        </span>
                                    </div>
                                    {it.ntsconfirmNum && (
                                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                                            승인: {it.ntsconfirmNum}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
