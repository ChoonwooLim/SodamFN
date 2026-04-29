import { useState, useEffect, useMemo } from 'react';
import {
    FileText, ExternalLink, ShieldCheck, Loader2, Plus, Trash2,
    RefreshCw, AlertCircle, CheckCircle2, Info, Send, X, Mail,
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

export default function Statement() {
    const [status, setStatus] = useState(null);
    const [issuer, setIssuer] = useState(null);
    const [formCodes, setFormCodes] = useState([]);
    const [issuing, setIssuing] = useState(false);
    const [result, setResult] = useState(null); // 발행 결과 모달
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState({ db: [], popbill: { list: [] } });
    const [historyFilter, setHistoryFilter] = useState('121');
    const [openingUrl, setOpeningUrl] = useState(null);

    // 폼 상태
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

    useEffect(() => {
        loadStatus();
        loadIssuer();
        loadFormCodes();
    }, []);

    useEffect(() => {
        loadHistory(historyFilter);
    }, [historyFilter]);

    // 양식 변경 시 기본 tax_type/purpose_type + property_bag 초기화
    useEffect(() => {
        if (!formCodes.length) return;
        const meta = formCodes.find((f) => f.code === form.item_code);
        if (!meta) return;
        setForm((prev) => ({
            ...prev,
            tax_type: meta.default_tax_type || prev.tax_type,
            purpose_type: meta.default_purpose_type || prev.purpose_type,
        }));
        // property_bag 초기화 — 새 양식의 extra_fields 로 채움
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

    // 자동 계산: 공급가액 / 세액
    const updateDetail = (i, key, value) => {
        const next = [...details];
        next[i] = { ...next[i], [key]: value };
        // 단가 또는 수량 변경 시 공급가액 자동 계산
        if (key === 'qty' || key === 'unitCost') {
            const qty = toInt(next[i].qty);
            const unit = toInt(next[i].unitCost);
            const supply = qty * unit;
            next[i].supplyCost = supply ? String(supply) : '';
            // 과세면 10% 세액 자동
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

    // 합계 계산
    const totals = useMemo(() => {
        const supply = details.reduce((sum, d) => sum + toInt(d.supplyCost), 0);
        const tax = details.reduce((sum, d) => sum + toInt(d.tax), 0);
        return { supply, tax, total: supply + tax };
    }, [details]);

    const currentFormMeta = useMemo(
        () => formCodes.find((f) => f.code === form.item_code),
        [formCodes, form.item_code],
    );

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

    const isPopbill = status?.active === 'popbill';
    const formName = currentFormMeta?.name || '명세서';

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* 헤더 */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                        <FileText className="text-amber-400" /> 전자명세서
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        거래명세서·청구서·견적서·발주서·입금표·영수증 6종 발행 + 팝빌 자동 메일 발송 + 팩스/SMS 추가 발송
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {status && (
                        <span
                            className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                                isPopbill
                                    ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50'
                                    : 'bg-amber-900/40 text-amber-300 border border-amber-700/50'
                            }`}
                        >
                            {isPopbill ? '✅ 팝빌 활성' : '⚠️ STUB 모드'}
                        </span>
                    )}
                    <button
                        onClick={() => openPopbillURL('BOX')}
                        disabled={openingUrl === 'BOX'}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg disabled:opacity-50"
                    >
                        {openingUrl === 'BOX' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                        팝빌 발행함
                    </button>
                </div>
            </div>

            {/* 상태 안내 */}
            {status && !isPopbill && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 text-sm text-amber-200 flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>{status.note}</div>
                </div>
            )}

            {/* 공급자 카드 */}
            {issuer && !issuer.error && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                    <div className="text-xs text-slate-400 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                        <ShieldCheck className="w-3.5 h-3.5" /> 공급자 (자동)
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><div className="text-slate-500 text-xs">상호</div><div className="text-slate-100">{issuer.corp_name}</div></div>
                        <div><div className="text-slate-500 text-xs">사업자번호</div><div className="text-slate-100">{issuer.corp_num}</div></div>
                        <div><div className="text-slate-500 text-xs">대표자</div><div className="text-slate-100">{issuer.ceo_name}</div></div>
                        <div><div className="text-slate-500 text-xs">전화</div><div className="text-slate-100">{issuer.tel}</div></div>
                    </div>
                </div>
            )}
            {issuer?.error && (
                <div className="bg-rose-900/20 border border-rose-700/50 rounded-lg p-4 text-sm text-rose-200">
                    {issuer.error}
                </div>
            )}

            {/* 발행 폼 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-5">
                <div className="text-base font-semibold text-slate-100">{formName} 발행</div>

                {/* 양식 셀렉트 + 작성일자 + 과세형태 + 영수/청구 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">양식</label>
                        <select
                            value={form.item_code}
                            onChange={(e) => setForm({ ...form, item_code: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        >
                            {formCodes.map((f) => (
                                <option key={f.code} value={f.code}>
                                    {f.code} {f.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">작성일자</label>
                        <input
                            type="text"
                            value={form.write_date}
                            onChange={(e) => setForm({ ...form, write_date: e.target.value })}
                            placeholder="YYYYMMDD"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">과세형태</label>
                        <select
                            value={form.tax_type}
                            onChange={(e) => setForm({ ...form, tax_type: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        >
                            <option value="과세">과세</option>
                            <option value="영세">영세</option>
                            <option value="면세">면세</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">영수/청구</label>
                        <select
                            value={form.purpose_type}
                            onChange={(e) => setForm({ ...form, purpose_type: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        >
                            <option value="영수">영수</option>
                            <option value="청구">청구</option>
                        </select>
                    </div>
                </div>

                {/* 양식별 conditional 필드 */}
                {currentFormMeta?.extra_fields?.length > 0 && (
                    <div>
                        <div className="text-xs text-slate-400 mb-2">{formName} 추가 정보</div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {currentFormMeta.extra_fields.map((ef) => (
                                <div key={ef.key}>
                                    <label className="text-xs text-slate-400 block mb-1">{ef.label}</label>
                                    <input
                                        type={ef.type === 'date' ? 'text' : ef.type}
                                        placeholder={ef.type === 'date' ? 'YYYYMMDD' : ''}
                                        value={propertyBag[ef.key] || ''}
                                        onChange={(e) => setPropertyBag({ ...propertyBag, [ef.key]: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 공급받는자 */}
                <div>
                    <div className="text-xs text-slate-400 mb-2">공급받는자</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input
                            type="text" placeholder="사업자번호 (10자리)"
                            value={form.receiver_corp_num}
                            onChange={(e) => setForm({ ...form, receiver_corp_num: e.target.value })}
                            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                        <input
                            type="text" placeholder="상호"
                            value={form.receiver_corp_name}
                            onChange={(e) => setForm({ ...form, receiver_corp_name: e.target.value })}
                            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                        <input
                            type="text" placeholder="대표자"
                            value={form.receiver_ceo_name}
                            onChange={(e) => setForm({ ...form, receiver_ceo_name: e.target.value })}
                            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                        <input
                            type="text" placeholder="주소"
                            value={form.receiver_addr}
                            onChange={(e) => setForm({ ...form, receiver_addr: e.target.value })}
                            className="md:col-span-2 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                        <input
                            type="text" placeholder="전화"
                            value={form.receiver_tel}
                            onChange={(e) => setForm({ ...form, receiver_tel: e.target.value })}
                            className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                        <input
                            type="email" placeholder="이메일 (자동 메일 발송 시)"
                            value={form.receiver_email}
                            onChange={(e) => setForm({ ...form, receiver_email: e.target.value })}
                            className="md:col-span-3 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                    </div>
                </div>

                {/* 품목 */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-slate-400">품목</div>
                        <button
                            onClick={addDetail}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-100 rounded"
                        >
                            <Plus className="w-3.5 h-3.5" /> 품목 추가
                        </button>
                    </div>
                    <div className="space-y-2">
                        {details.map((d, i) => (
                            <div key={i} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                    type="text" placeholder="품목명"
                                    value={d.itemName}
                                    onChange={(e) => updateDetail(i, 'itemName', e.target.value)}
                                    className="col-span-4 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100"
                                />
                                <input
                                    type="text" placeholder="수량"
                                    value={d.qty}
                                    onChange={(e) => updateDetail(i, 'qty', e.target.value)}
                                    className="col-span-1 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 text-right"
                                />
                                <input
                                    type="text" placeholder="단가"
                                    value={formatNumber(d.unitCost)}
                                    onChange={(e) => updateDetail(i, 'unitCost', e.target.value)}
                                    className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 text-right"
                                />
                                <input
                                    type="text" placeholder="공급가액"
                                    value={formatNumber(d.supplyCost)}
                                    onChange={(e) => updateDetail(i, 'supplyCost', e.target.value)}
                                    className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 text-right"
                                />
                                <input
                                    type="text" placeholder="세액"
                                    value={formatNumber(d.tax)}
                                    onChange={(e) => updateDetail(i, 'tax', e.target.value)}
                                    className="col-span-2 px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-sm text-slate-100 text-right"
                                />
                                <button
                                    onClick={() => removeDetail(i)}
                                    disabled={details.length === 1}
                                    className="col-span-1 p-1.5 text-rose-400 hover:bg-rose-900/30 rounded disabled:opacity-30"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end gap-6 text-sm">
                        <div className="text-slate-400">공급가액 합계 <span className="text-slate-100 font-semibold ml-2">{totals.supply.toLocaleString()}</span></div>
                        <div className="text-slate-400">세액 합계 <span className="text-slate-100 font-semibold ml-2">{totals.tax.toLocaleString()}</span></div>
                        <div className="text-slate-400">총액 <span className="text-emerald-300 font-bold ml-2">{totals.total.toLocaleString()}</span></div>
                    </div>
                </div>

                {/* 비고 + 자동 이메일 제목 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs text-slate-400 block mb-1">비고</label>
                        <input
                            type="text"
                            value={form.remark1}
                            onChange={(e) => setForm({ ...form, remark1: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 block mb-1 flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5" /> 자동 이메일 제목 (비우면 자동 발송 안 함)
                        </label>
                        <input
                            type="text" placeholder={`예: ${formName} 발송 안내`}
                            value={form.email_subject}
                            onChange={(e) => setForm({ ...form, email_subject: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        />
                    </div>
                </div>

                {/* 발행 버튼 */}
                <button
                    onClick={submit}
                    disabled={issuing}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-semibold rounded-lg flex items-center justify-center gap-2"
                >
                    {issuing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                    {formName} 발행
                </button>
            </div>

            {/* 이력 */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="text-base font-semibold text-slate-100 flex items-center gap-2">
                        발행 이력
                        <span className="text-xs text-slate-500">DB {history.db?.length || 0}건 / 팝빌 {history.popbill?.list?.length || 0}건</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <select
                            value={historyFilter}
                            onChange={(e) => setHistoryFilter(e.target.value)}
                            className="px-3 py-1.5 text-sm bg-slate-900 border border-slate-600 rounded-lg text-slate-100"
                        >
                            {formCodes.map((f) => (
                                <option key={f.code} value={f.code}>{f.code} {f.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => loadHistory(historyFilter)}
                            disabled={historyLoading}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg disabled:opacity-50"
                        >
                            {historyLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            새로고침
                        </button>
                    </div>
                </div>

                {history.error && (
                    <div className="text-sm text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {history.error}
                    </div>
                )}

                {!history.error && history.db?.length === 0 && (history.popbill?.list?.length || 0) === 0 && !historyLoading && (
                    <div className="text-sm text-slate-500 text-center py-8 flex flex-col items-center gap-2">
                        <Info className="w-6 h-6" />
                        발행 이력이 없습니다.
                    </div>
                )}

                {history.db?.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs text-slate-400 border-b border-slate-700">
                                    <th className="text-left py-2 px-2">작성일</th>
                                    <th className="text-left py-2 px-2">받는자</th>
                                    <th className="text-right py-2 px-2">금액</th>
                                    <th className="text-center py-2 px-2">상태</th>
                                    <th className="text-center py-2 px-2">메일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.db.map((r) => (
                                    <tr key={r.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                                        <td className="py-2 px-2 text-slate-300">{r.write_date}</td>
                                        <td className="py-2 px-2 text-slate-100">
                                            {r.receiver_corp_name || '-'}
                                            <span className="text-xs text-slate-500 ml-2">{r.receiver_corp_num}</span>
                                        </td>
                                        <td className="py-2 px-2 text-right text-slate-100">{Number(r.total_amount).toLocaleString()}</td>
                                        <td className="py-2 px-2 text-center">
                                            <span className={`text-xs px-2 py-0.5 rounded ${
                                                r.status === 'issued' ? 'bg-emerald-900/40 text-emerald-300' :
                                                r.status === 'failed' ? 'bg-rose-900/40 text-rose-300' :
                                                'bg-slate-700 text-slate-300'
                                            }`}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 text-center text-slate-400">
                                            {r.email_sent_at ? '✅' : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* 발행 결과 모달 */}
            {result && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 max-w-lg w-full">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                                {result.ok ? (
                                    <CheckCircle2 className="text-emerald-400 w-6 h-6" />
                                ) : (
                                    <AlertCircle className="text-rose-400 w-6 h-6" />
                                )}
                                <div className="text-lg font-semibold text-slate-100">
                                    {result.ok ? '발행 성공' : '발행 실패'}
                                </div>
                            </div>
                            <button onClick={() => setResult(null)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {result.ok ? (
                            <div className="space-y-2 text-sm">
                                <div className="text-slate-400">양식: <span className="text-slate-100">{result.item_code}</span></div>
                                <div className="text-slate-400">관리번호: <span className="text-slate-100 font-mono">{result.mgt_key}</span></div>
                                {result.receipt_num && (
                                    <div className="text-slate-400">접수번호: <span className="text-slate-100">{result.receipt_num}</span></div>
                                )}
                                {result.email_sent && (
                                    <div className="text-emerald-300 flex items-center gap-1">
                                        <Mail className="w-4 h-4" /> 자동 이메일 발송됨
                                    </div>
                                )}
                                <div className="pt-3 border-t border-slate-700 mt-3 grid grid-cols-2 gap-2">
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
                            <div className="text-sm text-rose-300 bg-rose-900/20 border border-rose-700/50 rounded p-3 whitespace-pre-wrap">
                                {result.error || '알 수 없는 오류'}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
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

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center justify-center gap-1.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded text-sm"
            >
                <Send className="w-4 h-4" /> {kind === 'fax' ? '팩스' : 'SMS'} 발송
            </button>
            {open && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 max-w-md w-full">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-base font-semibold text-slate-100">
                                {kind === 'fax' ? '팩스' : 'SMS'} 추가 발송
                            </div>
                            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-200">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-2 text-sm">
                            <input
                                type="text" placeholder="발신 번호"
                                value={sender}
                                onChange={(e) => setSender(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100"
                            />
                            <input
                                type="text" placeholder={`수신 ${kind === 'fax' ? '팩스' : '핸드폰'} 번호`}
                                value={receiver}
                                onChange={(e) => setReceiver(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100"
                            />
                            {kind === 'sms' && (
                                <textarea
                                    rows={3} placeholder="내용"
                                    value={content}
                                    onChange={(e) => setContent(e.target.value)}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-slate-100"
                                />
                            )}
                            <button
                                onClick={submit}
                                disabled={sending}
                                className="w-full py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded font-medium"
                            >
                                {sending ? '발송 중...' : '발송'}
                            </button>
                            {resp && (
                                <div className={`text-xs p-2 rounded ${resp.ok ? 'bg-emerald-900/30 text-emerald-200' : 'bg-rose-900/30 text-rose-200'}`}>
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
