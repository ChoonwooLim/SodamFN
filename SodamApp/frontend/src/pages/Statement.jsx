import { useState, useEffect, useMemo } from 'react';
import {
    FileText, ExternalLink, ShieldCheck, Loader2, Plus, Trash2,
    RefreshCw, AlertCircle, CheckCircle2, Send, X, Mail, FileCheck,
    Sparkles, Layers, Eye, Printer, CreditCard, Ban, Wallet,
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

const inputCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none";
const labelCls = "text-xs font-semibold text-slate-500 mb-1 block";

export default function Statement() {
    const [status, setStatus] = useState(null);
    const [issuer, setIssuer] = useState(null);
    const [formCodes, setFormCodes] = useState([]);
    const [issuing, setIssuing] = useState(false);
    const [result, setResult] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState({ db: [], popbill: { list: [] } });
    const [historyFilter, setHistoryFilter] = useState('121');
    const [openingUrl, setOpeningUrl] = useState(null);

    const [form, setForm] = useState({
        item_code: '121',
        receiver_corp_num: '',
        receiver_corp_name: '',
        receiver_ceo_name: '',
        receiver_addr: '',
        receiver_email: '',
        receiver_tel: '',
        write_date: today(),
        tax_type: '과세',
        purpose_type: '영수',
        remark1: '',
        email_subject: '',
    });
    const [propertyBag, setPropertyBag] = useState({});
    const [details, setDetails] = useState([emptyDetail()]);
    const [batchRunning, setBatchRunning] = useState(false);
    const [batchResult, setBatchResult] = useState(null);
    const [balance, setBalance] = useState(null);
    const [selected, setSelected] = useState(null); // 상세 모달 대상

    useEffect(() => {
        loadStatus();
        loadIssuer();
        loadFormCodes();
        loadBalance();
    }, []);

    const loadBalance = async () => {
        try {
            const res = await api.get('/statement/balance');
            setBalance(res.data);
        } catch { /* noop */ }
    };

    const openChargeURL = async () => {
        try {
            const res = await api.get('/statement/charge-url');
            if (res.data?.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            } else {
                alert('충전 URL 발급 실패');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '충전 URL 발급 실패');
        }
    };

    useEffect(() => {
        loadHistory(historyFilter);
    }, [historyFilter]);

    useEffect(() => {
        if (!formCodes.length) return;
        const meta = formCodes.find((f) => f.code === form.item_code);
        if (!meta) return;
        setForm((prev) => ({
            ...prev,
            tax_type: meta.default_tax_type || prev.tax_type,
            purpose_type: meta.default_purpose_type || prev.purpose_type,
        }));
        const next = {};
        for (const ef of (meta.extra_fields || [])) {
            next[ef.key] = '';
        }
        setPropertyBag(next);
    }, [form.item_code, formCodes]);

    const loadStatus = async () => {
        try {
            const res = await api.get('/statement/status');
            setStatus(res.data);
        } catch { /* noop */ }
    };

    const loadIssuer = async () => {
        try {
            const res = await api.get('/statement/issuer');
            setIssuer(res.data);
        } catch (e) {
            setIssuer({ error: e?.response?.data?.detail || '공급자 정보를 불러올 수 없습니다.' });
        }
    };

    const loadFormCodes = async () => {
        try {
            const res = await api.get('/statement/form-codes');
            setFormCodes(res.data || []);
        } catch { /* noop */ }
    };

    const loadHistory = async (itemCode) => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/statement/search', {
                params: { item_code: itemCode, per_page: 50 },
            });
            if (res.data?.ok) {
                setHistory({
                    db: res.data.db || [],
                    popbill: res.data.popbill || { list: [] },
                });
            } else {
                setHistory({ db: [], popbill: { list: [] }, error: res.data?.error });
            }
        } catch (e) {
            setHistory({ db: [], popbill: { list: [] }, error: e?.response?.data?.detail || '이력 조회 실패' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const openPopbillURL = async (togo) => {
        setOpeningUrl(togo);
        try {
            const res = await api.get('/statement/popbill-url', { params: { togo } });
            if (res.data.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            } else {
                alert('팝빌 URL 발급 실패');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || '팝빌 URL 발급 실패');
        } finally {
            setOpeningUrl(null);
        }
    };

    const updateDetail = (i, key, value) => {
        const next = [...details];
        next[i] = { ...next[i], [key]: value };
        if (key === 'qty' || key === 'unitCost') {
            const qty = toInt(next[i].qty);
            const unit = toInt(next[i].unitCost);
            const supply = qty * unit;
            next[i].supplyCost = supply ? String(supply) : '';
            if (form.tax_type === '과세' && supply) {
                next[i].tax = String(Math.round(supply / 10));
            } else {
                next[i].tax = '0';
            }
        }
        setDetails(next);
    };

    const addDetail = () => setDetails([...details, emptyDetail()]);
    const removeDetail = (i) => {
        if (details.length === 1) return;
        setDetails(details.filter((_, idx) => idx !== i));
    };

    const totals = useMemo(() => {
        const supply = details.reduce((sum, d) => sum + toInt(d.supplyCost), 0);
        const tax = details.reduce((sum, d) => sum + toInt(d.tax), 0);
        return { supply, tax, total: supply + tax };
    }, [details]);

    const currentFormMeta = useMemo(
        () => formCodes.find((f) => f.code === form.item_code),
        [formCodes, form.item_code],
    );

    const fillSample = () => {
        const meta = currentFormMeta;
        if (!meta?.sample_data) {
            alert('이 양식의 샘플 데이터가 없습니다.');
            return;
        }
        const s = meta.sample_data;
        const filledBag = { ...(s.property_bag || {}) };
        for (const k of Object.keys(filledBag)) {
            if (filledBag[k] === '' && k.endsWith('_date')) {
                const offset = k.includes('validity') ? 14 : 7;
                const d = new Date();
                d.setDate(d.getDate() + offset);
                filledBag[k] = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
            }
        }
        setForm((prev) => ({
            ...prev,
            receiver_corp_num: s.receiver_corp_num || '',
            receiver_corp_name: s.receiver_corp_name || '',
            receiver_ceo_name: s.receiver_ceo_name || '',
            receiver_addr: s.receiver_addr || '',
            receiver_email: s.receiver_email || '',
            receiver_tel: s.receiver_tel || '',
            tax_type: meta.default_tax_type || prev.tax_type,
            purpose_type: meta.default_purpose_type || prev.purpose_type,
            remark1: s.remark1 || '',
            email_subject: s.email_subject || '',
        }));
        setPropertyBag(filledBag);
        setDetails((s.details || [emptyDetail()]).map((d) => ({
            itemName: d.itemName || '',
            qty: d.qty || '1',
            unitCost: d.unitCost || '',
            supplyCost: d.supplyCost || '',
            tax: d.tax || '0',
            spec: d.spec || '',
            remark: d.remark || '',
        })));
    };

    const runBatch = async () => {
        const isLive = status && status.is_stub === false && status.note?.includes('IsTest=false');
        const confirmMsg = isLive
            ? '⚠️ LIVE 환경입니다.\n6종 양식 × 50원/건 = 약 300원 비용이 발생합니다.\n계속할까요?'
            : 'TEST 환경에서 6종 양식 일괄 샘플 발행을 진행합니다.\n각 양식의 샘플 데이터로 1건씩 발행됩니다.\n계속할까요?';
        if (!window.confirm(confirmMsg)) return;

        setBatchRunning(true);
        setBatchResult(null);
        try {
            const res = await api.post('/statement/issue-samples');
            setBatchResult(res.data);
            loadHistory(historyFilter);
        } catch (e) {
            setBatchResult({ ok: false, error: e?.response?.data?.detail || '일괄 발행 실패' });
        } finally {
            setBatchRunning(false);
        }
    };

    const submit = async () => {
        if (!form.receiver_corp_name) {
            alert('공급받는자 상호를 입력하세요.');
            return;
        }
        if (form.receiver_corp_num && form.receiver_corp_num.replace(/\D/g, '').length !== 10) {
            alert('공급받는자 사업자번호는 10자리여야 합니다.');
            return;
        }
        if (totals.total === 0) {
            alert('품목 금액을 입력하세요.');
            return;
        }
        const detailsClean = details
            .filter((d) => d.itemName?.trim())
            .map((d) => ({
                itemName: d.itemName,
                qty: d.qty || '1',
                unitCost: String(toInt(d.unitCost)),
                supplyCost: String(toInt(d.supplyCost)),
                tax: String(toInt(d.tax)),
                spec: d.spec || '',
                remark: d.remark || '',
            }));
        if (!detailsClean.length) {
            alert('품목을 최소 1건 입력하세요.');
            return;
        }

        setIssuing(true);
        try {
            const res = await api.post('/statement/issue', {
                item_code: form.item_code,
                write_date: form.write_date,
                tax_type: form.tax_type,
                purpose_type: form.purpose_type,
                receiver_corp_num: form.receiver_corp_num,
                receiver_corp_name: form.receiver_corp_name,
                receiver_ceo_name: form.receiver_ceo_name,
                receiver_addr: form.receiver_addr,
                receiver_email: form.receiver_email,
                receiver_tel: form.receiver_tel,
                supply_cost_total: String(totals.supply),
                tax_total: String(totals.tax),
                total_amount: String(totals.total),
                remark1: form.remark1,
                details: detailsClean,
                property_bag: propertyBag,
                email_subject: form.email_subject,
            });
            setResult(res.data);
            if (res.data?.ok) {
                loadHistory(historyFilter);
            }
        } catch (e) {
            setResult({ ok: false, error: e?.response?.data?.detail || '발행 실패' });
        } finally {
            setIssuing(false);
        }
    };

    const formName = currentFormMeta?.name || '명세서';

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 bg-amber-100 text-amber-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">전자명세서</h1>
                            <p className="text-sm text-slate-500">거래명세서·청구서·견적서·발주서·입금표·영수증 6종 + 자동 메일 + 팩스/SMS 추가 발송</p>
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
                        {status.is_stub
                            ? <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            : <CheckCircle2 size={16} className="mt-0.5 shrink-0" />}
                        <span>{status.note}</span>
                    </div>
                )}

                {/* 잔액 + 모니터링 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/* 잔액 카드 */}
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-start gap-2 mb-2">
                            <div className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg">
                                <Wallet size={16} />
                            </div>
                            <div className="flex-1">
                                <div className="text-xs font-semibold text-slate-500">팝빌 잔액 ({balance?.is_test ? 'TEST' : 'LIVE'})</div>
                                <div className="text-xl font-bold text-slate-900 tabular-nums">
                                    {balance?.balance != null
                                        ? `${Number(balance.balance).toLocaleString()}P`
                                        : '—'}
                                </div>
                                <div className="text-xs text-slate-500 mt-0.5">
                                    발행 {balance?.unit_cost || 50}원/건
                                    {balance?.balance != null && (
                                        <span className="ml-1 text-emerald-700">
                                            (≈ {Math.floor((balance.balance || 0) / (balance.unit_cost || 50))}건)
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={openChargeURL}
                            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                        >
                            <CreditCard size={12} /> 잔액 충전
                        </button>
                    </div>

                    {/* 6종 일괄 샘플 발행 카드 */}
                    <div className="md:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-2xl shadow-sm border border-amber-200">
                        <div className="flex items-start justify-between gap-3 flex-wrap h-full">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-amber-200 text-amber-700 rounded-xl shrink-0">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 text-sm">6종 일괄 샘플 발행</div>
                                    <div className="text-xs text-slate-600 mt-0.5">
                                        각 양식 샘플 데이터 1건씩 → 결과 표 + 이력 자동 등록.
                                        {status && !status.is_stub && (
                                            <span className="ml-1 font-medium">
                                                {balance?.is_test ? 'TEST 환경' : 'LIVE 환경 (300원 차감)'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={runBatch}
                                disabled={batchRunning}
                                className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shrink-0"
                            >
                                {batchRunning ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                {batchRunning ? '발행 중...' : '6종 일괄 발행'}
                            </button>
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
                            { togo: 'TBOX', label: '발행함', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                            { togo: 'SBOX', label: '임시저장함', color: 'bg-slate-50 text-slate-700 hover:bg-slate-100' },
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* 발행 폼 */}
                    <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileCheck size={18} className="text-amber-600" /> {formName} 발행
                            </h2>
                            <button
                                type="button"
                                onClick={fillSample}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-colors"
                            >
                                <Sparkles size={12} /> 샘플 채우기
                            </button>
                        </div>

                        {/* 공급자 */}
                        {issuer && !issuer.error && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                    <ShieldCheck size={12} /> 공급자 (자동)
                                </div>
                                <div className="font-semibold text-slate-800">{issuer.corp_name} · {issuer.corp_num}</div>
                                {issuer.ceo_name && <div className="text-xs text-slate-600 mt-0.5">{issuer.ceo_name} {issuer.addr && `/ ${issuer.addr}`}</div>}
                            </div>
                        )}
                        {issuer?.error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                                <span>{issuer.error} (환경설정 → 회사정보 관리에서 사업자번호를 입력하세요)</span>
                            </div>
                        )}

                        {/* 양식 + 작성일자 + 과세형태 + 영수/청구 */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div>
                                <label className={labelCls}>양식</label>
                                <select
                                    className={inputCls}
                                    value={form.item_code}
                                    onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                                >
                                    {formCodes.map((f) => (
                                        <option key={f.code} value={f.code}>{f.code} {f.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>작성일자 (YYYYMMDD)</label>
                                <input
                                    className={inputCls}
                                    value={form.write_date}
                                    onChange={(e) => setForm({ ...form, write_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>과세형태</label>
                                <select
                                    className={inputCls}
                                    value={form.tax_type}
                                    onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                                >
                                    <option value="과세">과세</option>
                                    <option value="영세">영세</option>
                                    <option value="면세">면세</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>영수/청구</label>
                                <select
                                    className={inputCls}
                                    value={form.purpose_type}
                                    onChange={(e) => setForm({ ...form, purpose_type: e.target.value })}
                                >
                                    <option value="영수">영수</option>
                                    <option value="청구">청구</option>
                                </select>
                            </div>
                        </div>

                        {/* 양식별 conditional */}
                        {currentFormMeta?.extra_fields?.length > 0 && (
                            <div className="mb-3 p-3 bg-amber-50 rounded-xl">
                                <div className="text-xs font-semibold text-amber-800 mb-2 flex items-center gap-1">
                                    <FileText size={12} /> {formName} 추가 정보
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    {currentFormMeta.extra_fields.map((ef) => (
                                        <div key={ef.key}>
                                            <label className="text-xs text-amber-700 mb-1 block">{ef.label}</label>
                                            <input
                                                type={ef.type === 'date' ? 'text' : ef.type}
                                                placeholder={ef.type === 'date' ? 'YYYYMMDD' : ''}
                                                value={propertyBag[ef.key] || ''}
                                                onChange={(e) => setPropertyBag({ ...propertyBag, [ef.key]: e.target.value })}
                                                className="w-full p-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 공급받는자 */}
                        <div className="mb-3">
                            <label className={labelCls}>공급받는자</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    className={inputCls}
                                    placeholder="사업자번호 (10자리)"
                                    value={form.receiver_corp_num}
                                    onChange={(e) => setForm({ ...form, receiver_corp_num: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="상호명 *"
                                    value={form.receiver_corp_name}
                                    onChange={(e) => setForm({ ...form, receiver_corp_name: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="대표자"
                                    value={form.receiver_ceo_name}
                                    onChange={(e) => setForm({ ...form, receiver_ceo_name: e.target.value })}
                                />
                                <input
                                    className={inputCls}
                                    placeholder="전화"
                                    value={form.receiver_tel}
                                    onChange={(e) => setForm({ ...form, receiver_tel: e.target.value })}
                                />
                                <input
                                    className={`${inputCls} col-span-2`}
                                    placeholder="주소"
                                    value={form.receiver_addr}
                                    onChange={(e) => setForm({ ...form, receiver_addr: e.target.value })}
                                />
                                <input
                                    className={`${inputCls} col-span-2`}
                                    type="email"
                                    placeholder="이메일 (자동 메일 발송 시)"
                                    value={form.receiver_email}
                                    onChange={(e) => setForm({ ...form, receiver_email: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* 품목 */}
                        <div className="mb-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <label className={labelCls}>품목</label>
                                <button
                                    type="button"
                                    onClick={addDetail}
                                    className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg"
                                >
                                    <Plus size={12} /> 품목 추가
                                </button>
                            </div>
                            <div className="space-y-2">
                                {details.map((d, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                                        <input
                                            className={`${inputCls} col-span-4`}
                                            placeholder="품목명"
                                            value={d.itemName}
                                            onChange={(e) => updateDetail(i, 'itemName', e.target.value)}
                                        />
                                        <input
                                            className={`${inputCls} col-span-1 text-right`}
                                            placeholder="수량"
                                            value={d.qty}
                                            onChange={(e) => updateDetail(i, 'qty', e.target.value)}
                                        />
                                        <input
                                            className={`${inputCls} col-span-2 text-right`}
                                            placeholder="단가"
                                            value={formatNumber(d.unitCost)}
                                            onChange={(e) => updateDetail(i, 'unitCost', e.target.value)}
                                        />
                                        <input
                                            className={`${inputCls} col-span-2 text-right`}
                                            placeholder="공급가액"
                                            value={formatNumber(d.supplyCost)}
                                            onChange={(e) => updateDetail(i, 'supplyCost', e.target.value)}
                                        />
                                        <input
                                            className={`${inputCls} col-span-2 text-right`}
                                            placeholder="세액"
                                            value={formatNumber(d.tax)}
                                            onChange={(e) => updateDetail(i, 'tax', e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeDetail(i)}
                                            disabled={details.length === 1}
                                            className="col-span-1 p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-30 flex items-center justify-center"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-2 flex justify-end gap-4 text-sm">
                                <span className="text-slate-500">공급가액 <span className="font-bold text-slate-800 ml-1 tabular-nums">{totals.supply.toLocaleString()}</span></span>
                                <span className="text-slate-500">세액 <span className="font-bold text-slate-800 ml-1 tabular-nums">{totals.tax.toLocaleString()}</span></span>
                                <span className="text-slate-500">총액 <span className="font-bold text-amber-600 ml-1 tabular-nums">{totals.total.toLocaleString()}</span></span>
                            </div>
                        </div>

                        {/* 비고 + 자동 이메일 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                            <div>
                                <label className={labelCls}>비고</label>
                                <input
                                    className={inputCls}
                                    value={form.remark1}
                                    onChange={(e) => setForm({ ...form, remark1: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={labelCls}>
                                    <span className="inline-flex items-center gap-1"><Mail size={12} /> 자동 이메일 제목 (비우면 미발송)</span>
                                </label>
                                <input
                                    className={inputCls}
                                    placeholder={`예: ${formName} 발송 안내`}
                                    value={form.email_subject}
                                    onChange={(e) => setForm({ ...form, email_subject: e.target.value })}
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={submit}
                            disabled={issuing}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
                        >
                            {issuing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
                            {formName} 발행
                        </button>
                    </div>

                    {/* 이력 (우측 컬럼) */}
                    <div className="lg:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={16} className="text-slate-600" /> 발행 이력
                            </h2>
                            <button
                                type="button"
                                onClick={() => loadHistory(historyFilter)}
                                disabled={historyLoading}
                                className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg disabled:opacity-50"
                            >
                                {historyLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                                새로고침
                            </button>
                        </div>

                        <select
                            className={`${inputCls} mb-3`}
                            value={historyFilter}
                            onChange={(e) => setHistoryFilter(e.target.value)}
                        >
                            {formCodes.map((f) => (
                                <option key={f.code} value={f.code}>{f.code} {f.name}</option>
                            ))}
                        </select>

                        <div className="text-xs text-slate-500 mb-2">
                            DB {history.db?.length || 0}건 / 팝빌 {history.popbill?.list?.length || 0}건
                        </div>

                        {history.error && (
                            <div className="mb-2 p-2 bg-red-50 text-red-700 rounded-lg text-xs flex items-start gap-1.5">
                                <AlertCircle size={12} className="mt-0.5 shrink-0" />
                                {history.error}
                            </div>
                        )}

                        {!history.error && history.db?.length === 0 && (history.popbill?.list?.length || 0) === 0 && !historyLoading && (
                            <div className="text-sm text-slate-400 text-center py-8">발행 이력이 없습니다.</div>
                        )}

                        {history.db?.length > 0 && (
                            <div className="space-y-2">
                                {history.db.map((r) => (
                                    <button
                                        key={r.id}
                                        type="button"
                                        onClick={() => setSelected(r)}
                                        className="w-full text-left p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-amber-50 hover:border-amber-200 transition-colors text-sm cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-semibold text-slate-800">{r.receiver_corp_name || '-'}</span>
                                            <StatusBadge status={r.status} />
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500">
                                            <span>{r.write_date} · {r.receiver_corp_num || '사업자번호 없음'}</span>
                                            <span className="font-bold text-slate-700 tabular-nums">{Number(r.total_amount).toLocaleString()}원</span>
                                        </div>
                                        {r.email_sent_at && (
                                            <div className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                                                <Mail size={11} /> 이메일 발송됨
                                            </div>
                                        )}
                                        {r.error_message && (
                                            <div className="mt-1 text-xs text-red-600 line-clamp-2">{r.error_message}</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 발행 상세 모달 */}
            {selected && (
                <DetailModal
                    row={selected}
                    onClose={() => setSelected(null)}
                    onChanged={() => {
                        loadHistory(historyFilter);
                        loadBalance();
                    }}
                />
            )}

            {/* 6종 일괄 샘플 발행 결과 모달 */}
            {batchResult && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                                    <Layers size={20} />
                                </div>
                                <div>
                                    <div className="text-lg font-bold text-slate-900">일괄 발행 결과</div>
                                    {batchResult.ok && (
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            성공 <span className="text-emerald-600 font-bold">{batchResult.success}</span> / 실패 <span className="text-red-600 font-bold">{batchResult.failed}</span> / 총 {batchResult.total}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setBatchResult(null)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {batchResult.error ? (
                            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm whitespace-pre-wrap">
                                {batchResult.error}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {(batchResult.results || []).map((r) => (
                                    <div
                                        key={r.item_code}
                                        className={`p-3 rounded-xl border text-sm ${
                                            r.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                                {r.ok
                                                    ? <CheckCircle2 size={14} className="text-emerald-600" />
                                                    : <AlertCircle size={14} className="text-red-600" />}
                                                {r.item_code} {r.name}
                                            </div>
                                            <span className="text-xs text-slate-700 tabular-nums font-medium">{Number(r.total_amount).toLocaleString()}원</span>
                                        </div>
                                        <div className="text-xs text-slate-600 ml-6 space-y-0.5">
                                            <div>관리번호: <span className="font-mono">{r.mgt_key}</span></div>
                                            {r.ok && r.receipt_num && <div>접수번호: {r.receipt_num}</div>}
                                            {r.ok && r.email_sent && <div className="text-emerald-700"><Mail size={10} className="inline mr-1" />이메일 발송</div>}
                                            {!r.ok && <div className="text-red-700">{r.error}</div>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 발행 결과 모달 */}
            {result && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-xl">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {result.ok ? (
                                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                                        <CheckCircle2 size={20} />
                                    </div>
                                ) : (
                                    <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                                        <AlertCircle size={20} />
                                    </div>
                                )}
                                <div>
                                    <div className="text-lg font-bold text-slate-900">
                                        {result.ok ? '발행 성공' : '발행 실패'}
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {result.ok ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between"><span className="text-slate-500">양식</span><span className="text-slate-800 font-medium">{result.item_code}</span></div>
                                <div className="flex justify-between"><span className="text-slate-500">관리번호</span><span className="text-slate-800 font-mono text-xs">{result.mgt_key}</span></div>
                                {result.receipt_num && (
                                    <div className="flex justify-between"><span className="text-slate-500">접수번호</span><span className="text-slate-800">{result.receipt_num}</span></div>
                                )}
                                {result.email_sent && (
                                    <div className="p-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs flex items-center gap-1.5">
                                        <Mail size={12} /> 자동 이메일 발송됨
                                    </div>
                                )}
                                <div className="pt-3 border-t border-slate-100 mt-3 grid grid-cols-2 gap-2">
                                    <SendButton
                                        kind="fax"
                                        item_code={result.item_code}
                                        mgt_key={result.mgt_key}
                                        sender_default={issuer?.tel || ''}
                                    />
                                    <SendButton
                                        kind="sms"
                                        item_code={result.item_code}
                                        mgt_key={result.mgt_key}
                                        sender_default={issuer?.tel || ''}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm whitespace-pre-wrap">
                                {result.error || '알 수 없는 오류'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
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
            const res = await api.get(`/statement/info/${row.mgt_key}`, {
                params: { item_code: row.item_code },
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
            const res = await api.get(`/statement/${row.mgt_key}/${kind}`, {
                params: { item_code: row.item_code },
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
        if (!emailValue) {
            alert('받는 이메일을 입력하세요.');
            return;
        }
        setEmailSending(true);
        try {
            const res = await api.post(`/statement/${row.mgt_key}/send-email`, {
                item_code: row.item_code,
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

    const cancelStatement = async () => {
        if (!window.confirm('이 명세서를 취소하시겠습니까? 이 동작은 되돌릴 수 없습니다.')) return;
        setCancelling(true);
        try {
            const res = await api.post(`/statement/${row.mgt_key}/cancel`, {
                item_code: row.item_code,
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

    const isCancelled = row.status === 'cancelled' || info?.popbill?.info?.stateCode === '7';
    const isFailed = row.status === 'failed';

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                            <FileText size={20} />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-slate-900">발행 상세</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                                {row.item_code} · {row.write_date} · {row.receiver_corp_name || '-'}
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* 메타 정보 */}
                <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1 mb-4">
                    <div className="flex justify-between"><span className="text-slate-500">관리번호</span><span className="font-mono text-xs text-slate-800">{row.mgt_key}</span></div>
                    {row.receipt_num && (
                        <div className="flex justify-between"><span className="text-slate-500">접수번호</span><span className="text-slate-800">{row.receipt_num}</span></div>
                    )}
                    <div className="flex justify-between"><span className="text-slate-500">총액</span><span className="font-bold text-slate-900 tabular-nums">{Number(row.total_amount).toLocaleString()}원</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">상태</span><StatusBadge status={row.status} /></div>
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

                {/* 팝빌 상세 정보 */}
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
                        {info.popbill.info.stateDT && (
                            <div className="flex justify-between"><span className="text-slate-500">상태 변경</span><span className="text-slate-700 tabular-nums">{info.popbill.info.stateDT}</span></div>
                        )}
                    </div>
                )}
                {info?.popbill?.error && !isFailed && (
                    <div className="bg-amber-50 text-amber-800 text-xs rounded p-2 mb-3">{info.popbill.error}</div>
                )}

                {/* 액션 버튼들 (실패/취소 아닐 때만) */}
                {!isFailed && !isCancelled && (
                    <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <button
                                type="button"
                                onClick={() => openUrl('view-url')}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Eye size={14} /> 미리보기
                            </button>
                            <button
                                type="button"
                                onClick={() => openUrl('print-url')}
                                className="flex items-center justify-center gap-1.5 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-medium transition-colors"
                            >
                                <Printer size={14} /> 인쇄
                            </button>
                        </div>

                        {/* 이메일 재전송 */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-3">
                            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1">
                                <Mail size={12} /> 이메일 재전송
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    placeholder="받는 이메일 주소"
                                    value={emailValue}
                                    onChange={(e) => setEmailValue(e.target.value)}
                                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={sendEmail}
                                    disabled={emailSending}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-1"
                                >
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

                        {/* 취소 */}
                        {!showCancel ? (
                            <button
                                type="button"
                                onClick={() => setShowCancel(true)}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-slate-500 hover:text-red-600 transition-colors"
                            >
                                <Ban size={12} /> 명세서 취소
                            </button>
                        ) : (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                                <div className="text-xs font-semibold text-red-800 mb-2 flex items-center gap-1">
                                    <Ban size={12} /> 명세서 취소
                                </div>
                                <input
                                    type="text"
                                    placeholder="취소 사유 (선택)"
                                    value={cancelMemo}
                                    onChange={(e) => setCancelMemo(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-red-200 rounded-lg text-sm mb-2 focus:ring-2 focus:ring-red-400 outline-none"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowCancel(false)}
                                        className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm"
                                    >
                                        뒤로
                                    </button>
                                    <button
                                        type="button"
                                        onClick={cancelStatement}
                                        disabled={cancelling}
                                        className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                                    >
                                        {cancelling ? '취소 중...' : '취소 확정'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {isCancelled && (
                    <div className="bg-slate-100 text-slate-600 text-sm rounded-xl p-3 text-center">
                        취소된 명세서입니다.
                    </div>
                )}
            </div>
        </div>
    );
}

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

function SendButton({ kind, item_code, mgt_key, sender_default }) {
    const [open, setOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [sender, setSender] = useState(sender_default);
    const [receiver, setReceiver] = useState('');
    const [content, setContent] = useState('');
    const [resp, setResp] = useState(null);

    const submit = async () => {
        if (!receiver) {
            alert('받는 번호를 입력하세요.');
            return;
        }
        if (kind === 'sms' && !content) {
            alert('내용을 입력하세요.');
            return;
        }
        setSending(true);
        try {
            const url = `/statement/${mgt_key}/send-${kind}`;
            const body = kind === 'fax'
                ? { item_code, sender_fax: sender, receiver_fax: receiver }
                : { item_code, sender_phone: sender, receiver_phone: receiver, content };
            const res = await api.post(url, body);
            setResp(res.data);
        } catch (e) {
            setResp({ ok: false, error: e?.response?.data?.detail || '발송 실패' });
        } finally {
            setSending(false);
        }
    };

    const palette = kind === 'fax'
        ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100';

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium transition-colors ${palette}`}
            >
                <Send size={14} /> {kind === 'fax' ? '팩스' : 'SMS'} 발송
            </button>
            {open && (
                <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-md w-full shadow-xl">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <Send size={16} /> {kind === 'fax' ? '팩스' : 'SMS'} 추가 발송
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">발신 번호</label>
                                <input
                                    className={inputCls}
                                    value={sender}
                                    onChange={(e) => setSender(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 mb-1 block">
                                    수신 {kind === 'fax' ? '팩스' : '핸드폰'} 번호
                                </label>
                                <input
                                    className={inputCls}
                                    value={receiver}
                                    onChange={(e) => setReceiver(e.target.value)}
                                />
                            </div>
                            {kind === 'sms' && (
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 mb-1 block">내용</label>
                                    <textarea
                                        rows={3}
                                        className={inputCls}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={submit}
                                disabled={sending}
                                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-xl mt-2 transition-colors"
                            >
                                {sending ? '발송 중...' : '발송'}
                            </button>
                            {resp && (
                                <div className={`text-xs p-2 rounded-lg ${resp.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                                    {resp.ok ? `발송 완료 (접수번호: ${resp.receipt_num || '-'})` : resp.error}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
