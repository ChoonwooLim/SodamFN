import { useState, useEffect, useMemo } from 'react';
import {
    Receipt, ExternalLink, ShieldCheck, Loader2, Plus, Trash2,
    RefreshCw, AlertCircle, CheckCircle2, Info, FileCheck,
    Wallet, CreditCard, Sparkles, Eye, Printer, FileDown,
    Mail, Ban, Send, X, FileText,
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
    const [balance, setBalance] = useState(null);
    const [selected, setSelected] = useState(null);
    const [sampleLoading, setSampleLoading] = useState(false);

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
        loadBalance();
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
            if (res.data?.ok) {
                // db + 팝빌 search 병합 (db 우선)
                const dbList = (res.data.db || []).map((r) => ({
                    source: 'db',
                    id: r.id,
                    key_type: r.key_type,
                    mgt_key: r.mgt_key,
                    name: r.invoicee_corp_name || '-',
                    corp_num: r.invoicee_corp_num,
                    date: r.write_date,
                    amount: r.total_amount,
                    status: r.status,
                    receipt_num: r.receipt_num,
                    invoice_num: r.invoice_num,
                    error_message: r.error_message,
                    email_sent_at: r.email_sent_at,
                }));
                const popbillList = (res.data?.popbill?.list || []).map((it) => ({
                    source: 'popbill',
                    key_type: 'SELL',
                    mgt_key: it.invoicerMgtKey || it.mgtKey,
                    name: it.invoiceeCorpName || '-',
                    corp_num: it.invoiceeCorpNum,
                    date: it.writeDate,
                    amount: it.totalAmount,
                    status: it.stateMemo,
                    receipt_num: it.ntsconfirmNum,
                    invoice_num: it.ntsconfirmNum,
                }));
                setHistory({
                    total: dbList.length + popbillList.length,
                    list: [...dbList, ...popbillList],
                    db_count: dbList.length,
                });
            } else {
                setHistory({ total: 0, list: [], error: res.data?.error });
            }
        } catch (e) {
            setHistory({ total: 0, list: [], error: e?.response?.data?.detail || '이력 조회 실패' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const loadBalance = async () => {
        try {
            const res = await api.get('/taxinvoice/balance');
            setBalance(res.data);
        } catch { /* noop */ }
    };

    const openChargeURL = async () => {
        try {
            const res = await api.get('/taxinvoice/charge-url');
            if (res.data?.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            } else {
                alert('충전 URL 발급 실패');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '충전 URL 발급 실패');
        }
    };

    const fillSample = async () => {
        try {
            const res = await api.get('/taxinvoice/sample');
            const s = res.data || {};
            setForm((prev) => ({
                ...prev,
                invoicee_corp_num: s.invoicee_corp_num || '',
                invoicee_corp_name: s.invoicee_corp_name || '',
                invoicee_ceo_name: s.invoicee_ceo_name || '',
                invoicee_addr: s.invoicee_addr || '',
                invoicee_email1: s.invoicee_email1 || '',
                invoicee_tel: s.invoicee_tel || '',
                invoicee_type: s.invoicee_type || '사업자',
                tax_type: s.tax_type || '과세',
                purpose_type: s.purpose_type || '영수',
                remark1: s.remark1 || '',
            }));
            setDetails((s.details || [emptyDetail()]).map((d) => ({
                itemName: d.itemName || '',
                qty: d.qty || '1',
                unitCost: d.unitCost || '',
                supplyCost: d.supplyCost || '',
                tax: d.tax || '',
                spec: d.spec || '',
                remark: d.remark || '',
            })));
        } catch (e) {
            alert(e?.response?.data?.detail || '샘플 데이터 로드 실패');
        }
    };

    const runIssueSample = async () => {
        const isLive = balance && balance.is_test === false;
        const msg = isLive
            ? '⚠️ LIVE 환경입니다. 100원 + 인증서 보유 필요.\n샘플 1건 발행을 진행할까요?'
            : 'TEST 환경에서 샘플 데이터로 1건 발행합니다 (인증서 등록 필요).\n계속할까요?';
        if (!window.confirm(msg)) return;
        setSampleLoading(true);
        try {
            const res = await api.post('/taxinvoice/issue-sample');
            setResult(res.data);
            loadHistory();
            loadBalance();
        } catch (e) {
            setResult({ ok: false, error: e?.response?.data?.detail || '샘플 발행 실패' });
        } finally {
            setSampleLoading(false);
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

                {/* 잔액 + 샘플 일괄 발행 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-start gap-2 mb-2">
                            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                <Wallet size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-slate-500">팝빌 잔액 ({balance?.is_test ? 'TEST' : 'LIVE'})</div>
                                <div className="text-xl font-bold text-slate-900 tabular-nums">
                                    {balance?.balance != null ? `${Number(balance.balance).toLocaleString()}P` : '—'}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    발행 {balance?.unit_cost || 100}원/건
                                    {balance?.balance != null && (
                                        <span className="ml-1 text-emerald-700">
                                            (≈ {Math.floor((balance.balance || 0) / (balance.unit_cost || 100))}건)
                                        </span>
                                    )}
                                </div>
                                {(balance?.partner_balance != null || balance?.member_balance != null) && (
                                    <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                                        {balance?.partner_balance != null && (
                                            <span>파트너 {Number(balance.partner_balance).toLocaleString()}P</span>
                                        )}
                                        {balance?.partner_balance != null && balance?.member_balance != null && (
                                            <span className="mx-1">·</span>
                                        )}
                                        {balance?.member_balance != null && (
                                            <span>회원 {Number(balance.member_balance).toLocaleString()}P</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <button type="button" onClick={openChargeURL}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors">
                            <CreditCard size={12} /> 잔액 충전
                        </button>
                    </div>

                    <div className="md:col-span-2 bg-gradient-to-r from-indigo-50 to-blue-50 p-4 rounded-2xl shadow-sm border border-indigo-200">
                        <div className="flex items-start justify-between gap-3 flex-wrap h-full">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-indigo-200 text-indigo-700 rounded-xl shrink-0">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 text-sm">샘플 발행 (테스트·모니터링)</div>
                                    <div className="text-xs text-slate-600 mt-0.5">
                                        샘플 데이터로 즉시 1건 발행 → 결과 + 이력 자동 등록.
                                        <span className="ml-1 text-amber-700 font-medium">※ 발행 전 인증서 등록 필수 (재무·회계 → 팝빌 인증서 등록)</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button type="button" onClick={fillSample}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 text-sm font-medium rounded-xl transition-colors">
                                    <Sparkles size={14} /> 폼 채우기
                                </button>
                                <button type="button" onClick={runIssueSample} disabled={sampleLoading}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                                    {sampleLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                    {sampleLoading ? '발행 중...' : '즉시 발행'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

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
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => it.source === 'db' && setSelected(it)}
                                    disabled={it.source !== 'db'}
                                    className={`w-full text-left p-3 bg-slate-50 rounded-xl text-sm border border-transparent transition-colors ${
                                        it.source === 'db'
                                            ? 'hover:bg-indigo-50 hover:border-indigo-200 cursor-pointer'
                                            : 'opacity-90 cursor-default'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1 gap-2">
                                        <span className="font-semibold text-slate-800 truncate">{it.name}</span>
                                        <span className="text-xs text-slate-500 shrink-0">{it.date}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs gap-2">
                                        <span className="text-slate-500 truncate">
                                            {it.source === 'db' ? <StatusBadge status={it.status} /> : (it.status || '')}
                                        </span>
                                        <span className="font-bold text-indigo-700 tabular-nums shrink-0">
                                            {Number(it.amount || 0).toLocaleString('ko-KR')}원
                                        </span>
                                    </div>
                                    {it.email_sent_at && (
                                        <div className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                                            <Mail size={10} /> 이메일 발송됨
                                        </div>
                                    )}
                                    {it.invoice_num && (
                                        <div className="text-[10px] text-slate-400 mt-1 truncate">
                                            승인: {it.invoice_num}
                                        </div>
                                    )}
                                    {it.error_message && (
                                        <div className="text-[10px] text-red-600 mt-1 line-clamp-2">{it.error_message}</div>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 발행 상세 모달 */}
            {selected && (
                <DetailModal
                    row={selected}
                    onClose={() => setSelected(null)}
                    onChanged={() => { loadHistory(); loadBalance(); }}
                />
            )}
        </div>
    );
}

const inputClsModal = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none";

function StatusBadge({ status }) {
    const styles = {
        issued: 'bg-emerald-100 text-emerald-700',
        failed: 'bg-red-100 text-red-700',
        pending: 'bg-amber-100 text-amber-700',
        cancelled: 'bg-slate-200 text-slate-600',
    };
    const cls = styles[status] || 'bg-slate-100 text-slate-600';
    return <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${cls}`}>{status}</span>;
}

function DetailModal({ row, onClose, onChanged }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [emailValue, setEmailValue] = useState('');
    const [emailSending, setEmailSending] = useState(false);
    const [emailResp, setEmailResp] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelMemo, setCancelMemo] = useState('');
    const [showCancel, setShowCancel] = useState(false);

    useEffect(() => {
        loadInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [row?.id]);

    const loadInfo = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/taxinvoice/info/${row.mgt_key}`, {
                params: { key_type: row.key_type || 'SELL' },
            });
            setInfo(res.data);
        } catch (e) {
            setInfo({ error: e?.response?.data?.detail || '상세 조회 실패' });
        } finally {
            setLoading(false);
        }
    };

    const openUrl = async (kind) => {
        try {
            const res = await api.get(`/taxinvoice/${row.mgt_key}/${kind}`, {
                params: { key_type: row.key_type || 'SELL' },
            });
            if (res.data?.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            } else {
                alert('URL 발급 실패');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || 'URL 발급 실패');
        }
    };

    const sendEmail = async () => {
        if (!emailValue) { alert('받는 이메일을 입력하세요.'); return; }
        setEmailSending(true);
        try {
            const res = await api.post(`/taxinvoice/${row.mgt_key}/send-email`, {
                key_type: row.key_type || 'SELL',
                receiver_email: emailValue,
            });
            setEmailResp(res.data);
            if (res.data?.ok) onChanged?.();
        } catch (e) {
            setEmailResp({ ok: false, error: e?.response?.data?.detail || '이메일 발송 실패' });
        } finally {
            setEmailSending(false);
        }
    };

    const cancelInvoice = async () => {
        if (!window.confirm('이 세금계산서를 취소하시겠습니까? (국세청 신고 전에만 취소 가능)')) return;
        setCancelling(true);
        try {
            const res = await api.post(`/taxinvoice/${row.mgt_key}/cancel`, {
                key_type: row.key_type || 'SELL',
                memo: cancelMemo,
            });
            if (res.data?.ok) {
                alert('취소 완료');
                onChanged?.();
                onClose();
            } else {
                alert(res.data?.error || '취소 실패');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '취소 실패');
        } finally {
            setCancelling(false);
        }
    };

    const isCancelled = row.status === 'cancelled';
    const isFailed = row.status === 'failed';

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-900">발행 상세</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {row.key_type || 'SELL'} · {row.date} · {row.name}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                        <X size={20} />
                    </button>
                </div>

                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1 mb-4">
                    <div className="flex justify-between"><span className="text-slate-500">관리번호</span><span className="font-mono text-xs text-slate-800">{row.mgt_key}</span></div>
                    {row.invoice_num && (
                        <div className="flex justify-between"><span className="text-slate-500">국세청 승인번호</span><span className="text-slate-800 font-mono text-xs">{row.invoice_num}</span></div>
                    )}
                    {row.receipt_num && (
                        <div className="flex justify-between"><span className="text-slate-500">접수번호</span><span className="text-slate-800">{row.receipt_num}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-slate-500">총액</span><span className="font-bold text-slate-900 tabular-nums">{Number(row.amount).toLocaleString()}원</span></div>
                    <div className="flex justify-between items-center"><span className="text-slate-500">상태</span><StatusBadge status={row.status} /></div>
                    {row.email_sent_at && (
                        <div className="flex justify-between text-emerald-700">
                            <span>이메일 발송</span>
                            <span className="text-xs">{new Date(row.email_sent_at).toLocaleString('ko-KR')}</span>
                        </div>
                    )}
                    {row.error_message && (
                        <div className="mt-2 p-2 bg-red-50 text-red-700 text-xs rounded">{row.error_message}</div>
                    )}
                </div>

                {loading && (
                    <div className="text-sm text-slate-500 flex items-center gap-2 mb-3">
                        <Loader2 size={14} className="animate-spin" /> 팝빌 상세 조회 중...
                    </div>
                )}
                {info?.popbill?.ok && info.popbill.info && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm space-y-1 mb-4">
                        <div className="text-xs font-semibold text-blue-800 mb-1">팝빌 시스템 정보</div>
                        {info.popbill.info.issueDT && (
                            <div className="flex justify-between"><span className="text-slate-500">발행 시각</span><span className="text-slate-700 tabular-nums">{info.popbill.info.issueDT}</span></div>
                        )}
                        {info.popbill.info.stateMemo && (
                            <div className="flex justify-between"><span className="text-slate-500">상태 메모</span><span className="text-slate-700">{info.popbill.info.stateMemo}</span></div>
                        )}
                        {info.popbill.info.ntsResult && (
                            <div className="flex justify-between"><span className="text-slate-500">국세청 결과</span><span className="text-slate-700">{info.popbill.info.ntsResult}</span></div>
                        )}
                    </div>
                )}
                {info?.popbill?.error && !isFailed && (
                    <div className="bg-amber-50 text-amber-800 text-xs rounded p-2 mb-3">{info.popbill.error}</div>
                )}

                {!isFailed && !isCancelled && (
                    <>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <button type="button" onClick={() => openUrl('view-url')}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors">
                                <Eye size={14} /> 미리보기
                            </button>
                            <button type="button" onClick={() => openUrl('print-url')}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition-colors">
                                <Printer size={14} /> 인쇄
                            </button>
                            <button type="button" onClick={() => openUrl('pdf-url')}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-sm font-medium transition-colors">
                                <FileDown size={14} /> PDF
                            </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 mb-3">
                            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                                <Mail size={12} /> 이메일 재전송
                            </div>
                            <div className="flex gap-2">
                                <input type="email" placeholder="받는 이메일 주소"
                                    value={emailValue}
                                    onChange={(e) => setEmailValue(e.target.value)}
                                    className={`${inputClsModal} flex-1`}
                                />
                                <button type="button" onClick={sendEmail} disabled={emailSending}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1">
                                    {emailSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    발송
                                </button>
                            </div>
                            {emailResp && (
                                <div className={`text-xs p-2 rounded mt-2 ${emailResp.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {emailResp.ok ? '이메일 발송 완료' : emailResp.error}
                                </div>
                            )}
                        </div>

                        {!showCancel ? (
                            <button type="button" onClick={() => setShowCancel(true)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-red-600 transition-colors">
                                <Ban size={12} /> 발행 취소 (국세청 신고 전)
                            </button>
                        ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <div className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1">
                                    <Ban size={12} /> 발행 취소
                                </div>
                                <input type="text" placeholder="취소 사유 (선택)"
                                    value={cancelMemo}
                                    onChange={(e) => setCancelMemo(e.target.value)}
                                    className={`${inputClsModal} mb-2`}
                                />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowCancel(false)}
                                        className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm">
                                        뒤로
                                    </button>
                                    <button type="button" onClick={cancelInvoice} disabled={cancelling}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium">
                                        {cancelling ? '취소 중...' : '취소 확정'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {isCancelled && (
                    <div className="bg-slate-100 text-slate-600 text-sm rounded-xl p-3 text-center">취소된 세금계산서입니다.</div>
                )}
            </div>
        </div>
    );
}
