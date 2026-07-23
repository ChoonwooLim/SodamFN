import { useState, useEffect, useMemo } from 'react';
import {
    Banknote, ExternalLink, Loader2, RefreshCw, AlertCircle, CheckCircle2,
    Send, Smartphone, FileCheck, Info, Wallet, CreditCard,
} from 'lucide-react';
import api from '../api';

const today = () => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
};

const fmt = (n) => Number(String(n || '').replace(/,/g, '') || 0).toLocaleString('ko-KR');
const toInt = (s) => parseInt(String(s || '').replace(/[^\d-]/g, ''), 10) || 0;

export default function CashBill() {
    const [status, setStatus] = useState(null);
    const [issuer, setIssuer] = useState(null);
    const [issuing, setIssuing] = useState(false);
    const [result, setResult] = useState(null);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [history, setHistory] = useState({ total: 0, list: [] });
    const [openingUrl, setOpeningUrl] = useState(null);
    const [balance, setBalance] = useState(null);

    const [form, setForm] = useState({
        trade_usage: '소득공제용',
        trade_opt: '일반',
        taxation_type: '과세',
        identity_num: '',
        customer_name: '',
        item_name: '',
        order_number: '',
        email: '',
        hp: '',
        smssend_yn: false,
        trade_date: today(),
        supply_cost: '',
        tax: '',
        total_amount: '',
    });

    useEffect(() => {
        loadStatus();
        loadIssuer();
        loadHistory();
        loadBalance();
    }, []);

    // 과세 시 공급가액의 10% = 세액 자동 계산
    useEffect(() => {
        const supply = toInt(form.supply_cost);
        const tax = form.taxation_type === '과세' && supply ? Math.round(supply * 0.1) : 0;
        setForm((f) => ({
            ...f,
            tax: tax ? String(tax) : '0',
            total_amount: supply ? String(supply + tax) : '',
        }));
    }, [form.supply_cost, form.taxation_type]);

    const loadStatus = async () => {
        try { setStatus((await api.get('/cashbill/status')).data); } catch { /* noop */ }
    };

    const loadIssuer = async () => {
        try { setIssuer((await api.get('/cashbill/issuer')).data); }
        catch (e) { setIssuer({ error: e?.response?.data?.detail || '공급자 정보를 불러올 수 없습니다.' }); }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get('/cashbill/search', { params: { per_page: 50 } });
            if (res.data.ok) setHistory({ total: res.data.total || 0, list: res.data.list || [] });
            else setHistory({ total: 0, list: [], error: res.data.error });
        } catch (e) {
            setHistory({ total: 0, list: [], error: e?.response?.data?.detail || '이력 조회 실패' });
        } finally {
            setHistoryLoading(false);
        }
    };

    const openPopbillURL = async (togo) => {
        setOpeningUrl(togo);
        try {
            const res = await api.get('/cashbill/popbill-url', { params: { togo } });
            if (res.data.ok && res.data.url) window.open(res.data.url, '_blank', 'noopener');
        } catch (e) { alert(e?.response?.data?.detail || 'URL 생성 실패'); }
        finally { setOpeningUrl(null); }
    };

    const loadBalance = async () => {
        try { setBalance((await api.get('/cashbill/balance')).data); } catch { /* noop */ }
    };

    const openChargeURL = async () => {
        try {
            const res = await api.get('/cashbill/charge-url');
            if (res.data.ok && res.data.url) window.open(res.data.url, '_blank', 'noopener');
        } catch (e) { alert(e?.response?.data?.detail || '충전 URL 생성 실패'); }
    };

    const idNumPlaceholder = useMemo(() => {
        if (form.trade_usage === '지출증빙용') return '사업자번호 10자리';
        return '휴대폰번호 또는 주민번호';
    }, [form.trade_usage]);

    const canIssue = useMemo(() => {
        const idOk = form.trade_usage === '지출증빙용'
            ? (form.identity_num || '').replace(/\D/g, '').length === 10
            : [10, 11, 13].includes((form.identity_num || '').replace(/\D/g, '').length);
        return form.item_name && idOk && toInt(form.total_amount) > 0 && !issuing;
    }, [form, issuing]);

    const handleIssue = async () => {
        if (!canIssue) return;
        const msg = `${form.customer_name || form.identity_num}님에게 ${fmt(form.total_amount)}원 현금영수증(${form.trade_usage})을 발행합니다.\n※ 팝빌 건당 과금(~88원)이 발생합니다.`;
        if (!window.confirm(msg)) return;
        setIssuing(true);
        setResult(null);
        try {
            const res = await api.post('/cashbill/issue', {
                ...form,
                supply_cost: String(toInt(form.supply_cost)),
                tax: String(toInt(form.tax)),
                total_amount: String(toInt(form.total_amount)),
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
            ...form,
            identity_num: '', customer_name: '', item_name: '', order_number: '',
            email: '', hp: '', supply_cost: '', tax: '', total_amount: '',
            trade_date: today(), smssend_yn: false,
        });
        setResult(null);
    };

    const inputCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none";

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                        <Banknote size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">현금영수증</h1>
                        <p className="text-sm text-slate-500">매출 현금영수증 자동 발행 · 팝빌 연동</p>
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

                {/* 잔액 + 팝빌 바로가기 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                    {/* 잔액 카드 */}
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

                    {/* 팝빌 바로가기 (2칸) */}
                    <div className="md:col-span-2 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-3">
                            <ExternalLink size={16} className="text-slate-500" />
                            <h2 className="font-semibold text-slate-700 text-sm">팝빌 공식 페이지</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                { togo: 'PBOX', label: '발행함', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                                { togo: 'WRITE', label: '직접 작성', color: 'bg-slate-50 text-slate-700 hover:bg-slate-100' },
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* 발행 폼 */}
                    <div className="lg:col-span-3 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <FileCheck size={18} className="text-emerald-600" /> 빠른 발행
                            </h2>
                            <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                <RefreshCw size={12} /> 초기화
                            </button>
                        </div>

                        {/* 가맹점 정보 (자동) */}
                        {issuer && !issuer.error && (
                            <div className="mb-4 p-3 bg-slate-50 rounded-xl text-sm">
                                <div className="text-xs text-slate-500 mb-1">가맹점 (자동)</div>
                                <div className="font-semibold text-slate-800">{issuer.corp_name} · {issuer.corp_num}</div>
                            </div>
                        )}
                        {issuer?.error && (
                            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5" />
                                <span>{issuer.error}</span>
                            </div>
                        )}

                        {/* 거래용도 */}
                        <div className="text-xs font-semibold text-slate-500 mb-2">거래 용도</div>
                        <div className="grid grid-cols-2 gap-2 mb-4">
                            {[
                                { id: '소득공제용', label: '소득공제용 (개인)' },
                                { id: '지출증빙용', label: '지출증빙용 (법인)' },
                            ].map((u) => (
                                <button
                                    key={u.id}
                                    onClick={() => setForm({ ...form, trade_usage: u.id, identity_num: '' })}
                                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                                        form.trade_usage === u.id
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {u.label}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">식별번호 *</label>
                                <input
                                    className={inputCls}
                                    placeholder={idNumPlaceholder}
                                    value={form.identity_num}
                                    onChange={(e) => setForm({ ...form, identity_num: e.target.value.replace(/\D/g, '') })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputCls} placeholder="고객명 (선택)"
                                    value={form.customer_name}
                                    onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
                                <input className={inputCls} placeholder="주문번호 (선택)"
                                    value={form.order_number}
                                    onChange={(e) => setForm({ ...form, order_number: e.target.value })} />
                            </div>

                            <input className={inputCls} placeholder="상품명 *"
                                value={form.item_name}
                                onChange={(e) => setForm({ ...form, item_name: e.target.value })} />

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input className={inputCls} placeholder="거래일 YYYYMMDD"
                                    value={form.trade_date}
                                    onChange={(e) => setForm({ ...form, trade_date: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
                                <select className={inputCls}
                                    value={form.trade_opt}
                                    onChange={(e) => setForm({ ...form, trade_opt: e.target.value })}>
                                    <option value="일반">일반</option>
                                    <option value="도서공연">도서공연</option>
                                    <option value="대중교통">대중교통</option>
                                </select>
                                <select className={inputCls}
                                    value={form.taxation_type}
                                    onChange={(e) => setForm({ ...form, taxation_type: e.target.value })}>
                                    <option value="과세">과세 (10%)</option>
                                    <option value="비과세">비과세</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <input className={inputCls} placeholder="공급가액 *"
                                    value={fmt(form.supply_cost)}
                                    onChange={(e) => setForm({ ...form, supply_cost: e.target.value.replace(/\D/g, '') })} />
                                <input className={`${inputCls} bg-slate-100`} placeholder="세액"
                                    value={fmt(form.tax)} readOnly />
                                <input className={`${inputCls} bg-slate-100 font-bold`} placeholder="합계"
                                    value={fmt(form.total_amount)} readOnly />
                            </div>

                            {/* 알림 */}
                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputCls} placeholder="이메일 (알림)"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })} />
                                <div className="flex gap-2">
                                    <input className={inputCls} placeholder="휴대폰 (알림)"
                                        value={form.hp}
                                        onChange={(e) => setForm({ ...form, hp: e.target.value.replace(/\D/g, '') })} />
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.smssend_yn}
                                    onChange={(e) => setForm({ ...form, smssend_yn: e.target.checked })}
                                    className="w-4 h-4 accent-emerald-600"
                                />
                                <Smartphone size={12} /> 발행 완료 시 고객 휴대폰으로 SMS 알림 (별도 과금)
                            </label>

                            <button
                                onClick={handleIssue}
                                disabled={!canIssue}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                                {issuing ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                {issuing ? '발행 중...' : '현금영수증 발행'}
                            </button>

                            {result && (
                                <div className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
                                    result.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                }`}>
                                    {result.ok ? <CheckCircle2 size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
                                    <div className="flex-1">
                                        {result.ok ? (
                                            <>
                                                <div className="font-bold">발행 완료</div>
                                                {result.confirm_num && <div className="text-xs">국세청 승인번호: {result.confirm_num}</div>}
                                                {result.trade_date && <div className="text-xs">거래일자: {result.trade_date}</div>}
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
                                <Banknote size={18} className="text-emerald-600" /> 발행 이력
                                <span className="text-xs text-slate-400 font-normal">({history.total})</span>
                            </h2>
                            <button onClick={loadHistory} disabled={historyLoading} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                                {historyLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} 새로고침
                            </button>
                        </div>

                        {history.error && (
                            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs">{history.error}</div>
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
                                            {it.customerName || it.identityNum || '-'}
                                        </span>
                                        <span className="text-xs text-slate-500">{it.tradeDate || ''}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-slate-500 truncate">{it.itemName || ''}</span>
                                        <span className="font-bold text-emerald-700">
                                            {Number(it.totalAmount || 0).toLocaleString('ko-KR')}원
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                        <span>{it.tradeUsage || ''}</span>
                                        {it.confirmNum && <span className="font-mono truncate">{it.confirmNum}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
