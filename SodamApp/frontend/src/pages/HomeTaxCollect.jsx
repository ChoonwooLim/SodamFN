import { useState, useEffect, useRef } from 'react';
import {
    FileText, ExternalLink, Loader2, RefreshCw, AlertCircle, CheckCircle2,
    Lock, ShieldAlert, Calendar, Database, Download, X, Info,
} from 'lucide-react';
import api from '../api';

const STATE_LABELS = {
    0: { label: '대기', color: 'text-slate-500 bg-slate-100' },
    1: { label: '진행 중', color: 'text-blue-700 bg-blue-100' },
    2: { label: '완료', color: 'text-emerald-700 bg-emerald-100' },
    3: { label: '실패', color: 'text-red-700 bg-red-100' },
};

const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

export default function HomeTaxCollect() {
    const [status, setStatus] = useState(null);
    const [deptUser, setDeptUser] = useState(null);
    const [openingUrl, setOpeningUrl] = useState(null);

    // 등록 모달
    const [showRegistModal, setShowRegistModal] = useState(false);
    const [registForm, setRegistForm] = useState({ dept_user_id: '', dept_user_pwd: '' });
    const [registing, setRegisting] = useState(false);

    // 수집
    const [type, setType] = useState('SELL');
    const [presets, setPresets] = useState(null);
    const [activePreset, setActivePreset] = useState('this_month');
    const [sDate, setSDate] = useState('');
    const [eDate, setEDate] = useState('');
    const [requesting, setRequesting] = useState(false);
    const [job, setJob] = useState(null); // { job_id, job_state, ... }
    const [polling, setPolling] = useState(false);
    const pollRef = useRef(null);

    // 결과
    const [summary, setSummary] = useState(null);
    const [list, setList] = useState([]);
    const [resultsLoading, setResultsLoading] = useState(false);

    useEffect(() => {
        loadStatus();
        loadDeptUser();
        loadPresets();
        return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }, []);

    useEffect(() => {
        if (presets && activePreset && presets[activePreset]) {
            setSDate(presets[activePreset].s_date);
            setEDate(presets[activePreset].e_date);
        }
    }, [presets, activePreset]);

    const loadStatus = async () => {
        try {
            const res = await api.get('/hometax/status');
            setStatus(res.data);
        } catch { /* noop */ }
    };

    const loadDeptUser = async () => {
        try {
            const res = await api.get('/hometax/dept-user');
            setDeptUser(res.data);
        } catch (e) {
            setDeptUser({ ok: false, error: e?.response?.data?.detail || '확인 실패' });
        }
    };

    const loadPresets = async () => {
        try {
            const res = await api.get('/hometax/quick-range');
            setPresets(res.data);
        } catch { /* noop */ }
    };

    const openPopbillURL = async (togo) => {
        setOpeningUrl(togo);
        try {
            const res = await api.get('/hometax/popbill-url', { params: { togo } });
            if (res.data.ok && res.data.url) {
                window.open(res.data.url, '_blank', 'noopener');
            }
        } catch (e) {
            alert(e?.response?.data?.detail || 'URL 생성 실패');
        } finally {
            setOpeningUrl(null);
        }
    };

    const handleRegist = async () => {
        if (!registForm.dept_user_id || !registForm.dept_user_pwd) return;
        setRegisting(true);
        try {
            await api.post('/hometax/dept-user', registForm);
            setShowRegistModal(false);
            setRegistForm({ dept_user_id: '', dept_user_pwd: '' });
            await loadDeptUser();
            alert('홈택스 부서사용자 등록 완료');
        } catch (e) {
            alert(e?.response?.data?.detail || '등록 실패');
        } finally {
            setRegisting(false);
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('홈택스 부서사용자 등록을 해제하시겠습니까?\n수집된 데이터는 유지됩니다.')) return;
        try {
            await api.delete('/hometax/dept-user');
            await loadDeptUser();
        } catch (e) {
            alert(e?.response?.data?.detail || '삭제 실패');
        }
    };

    const handleRequest = async () => {
        if (!sDate || !eDate) return;
        if ((sDate || '').length !== 8 || (eDate || '').length !== 8) {
            alert('날짜는 YYYYMMDD 형식이어야 합니다.');
            return;
        }
        setRequesting(true);
        setJob(null);
        setSummary(null);
        setList([]);
        try {
            const res = await api.post('/hometax/request-job', {
                type, s_date: sDate, e_date: eDate,
            });
            const newJob = { job_id: res.data.job_id, job_state: 0 };
            setJob(newJob);
            startPolling(newJob.job_id);
        } catch (e) {
            alert(e?.response?.data?.detail || '수집 요청 실패');
        } finally {
            setRequesting(false);
        }
    };

    const startPolling = (jobId) => {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(true);
        pollRef.current = setInterval(async () => {
            try {
                const res = await api.get(`/hometax/job-state/${jobId}`);
                setJob(res.data);
                if (res.data.job_state === 2) {
                    clearInterval(pollRef.current);
                    setPolling(false);
                    loadResults(jobId);
                } else if (res.data.job_state === 3) {
                    clearInterval(pollRef.current);
                    setPolling(false);
                }
            } catch {
                clearInterval(pollRef.current);
                setPolling(false);
            }
        }, 3000);
    };

    const loadResults = async (jobId) => {
        setResultsLoading(true);
        try {
            const [sumRes, listRes] = await Promise.all([
                api.get('/hometax/summary', { params: { job_id: jobId, type } }),
                api.get('/hometax/search', { params: { job_id: jobId, type, page: 1, per_page: 200 } }),
            ]);
            setSummary(sumRes.data);
            setList(listRes.data.list || []);
        } catch (e) {
            alert(e?.response?.data?.detail || '결과 조회 실패');
        } finally {
            setResultsLoading(false);
        }
    };

    const exportCsv = () => {
        if (list.length === 0) return;
        const headers = ['승인번호', '작성일', '발급일', '공급자', '공급자번호', '공급받는자', '공급받는자번호', '공급가액', '세액', '합계', '청구/영수'];
        const rows = list.map((r) => [
            r.ntsconfirmNum || '', r.writeDate || '', r.issueDate || '',
            r.invoicerCorpName || '', r.invoicerCorpNum || '',
            r.invoiceeCorpName || '', r.invoiceeCorpNum || '',
            r.supplyCostTotal || 0, r.taxTotal || 0, r.totalAmount || 0,
            r.purposeType || '',
        ]);
        const csv = [headers, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `homtax_${type}_${sDate}_${eDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const inputCls = "w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none";

    const isReady = deptUser?.registered;

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* 헤더 */}
                <div className="mb-6 flex items-center gap-3">
                    <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl">
                        <Database size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">홈택스 자동 수집</h1>
                        <p className="text-sm text-slate-500">전자세금계산서 매출/매입을 홈택스에서 일괄 조회 · 세무사 준비용</p>
                    </div>
                </div>

                {/* 상태 배너 */}
                {status?.is_stub && (
                    <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5" />
                        <span>{status.note}</span>
                    </div>
                )}

                {/* 1. 부서사용자 인증 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                            <Lock size={18} className="text-violet-600" /> 1단계 · 홈택스 인증
                        </h2>
                        {isReady && (
                            <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">등록 해제</button>
                        )}
                    </div>

                    {deptUser?.registered ? (
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-800 rounded-xl text-sm">
                            <CheckCircle2 size={16} />
                            <span className="font-medium">홈택스 부서사용자 등록됨 — 수집 가능</span>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-sm flex items-start gap-2">
                                <ShieldAlert size={16} className="mt-0.5" />
                                <div>
                                    <div className="font-semibold mb-1">홈택스 부서사용자 ID 등록 필요</div>
                                    <div className="text-xs">홈택스에서 발급한 <b>부서사용자 ID/비밀번호</b>를 팝빌에 등록해야 매출·매입 자동 수집이 가능합니다.</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setShowRegistModal(true)}
                                    className="px-4 py-2.5 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 text-sm"
                                >
                                    부서사용자 ID 등록
                                </button>
                                <button
                                    onClick={() => openPopbillURL('HOMETAX')}
                                    disabled={openingUrl === 'HOMETAX'}
                                    className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-semibold hover:bg-slate-200 text-sm flex items-center justify-center gap-1.5"
                                >
                                    {openingUrl === 'HOMETAX' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                                    팝빌에서 직접 등록
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* 2. 수집 요청 */}
                <div className={`bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6 ${!isReady ? 'opacity-50 pointer-events-none' : ''}`}>
                    <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar size={18} className="text-violet-600" /> 2단계 · 수집 요청
                    </h2>

                    {/* 매출/매입 토글 */}
                    <div className="flex gap-2 mb-4">
                        {[
                            { id: 'SELL', label: '매출 (발급)' },
                            { id: 'BUY', label: '매입 (수신)' },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={`flex-1 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                                    type === t.id
                                        ? 'bg-violet-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* 기간 프리셋 */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {presets && Object.entries(presets).map(([key, p]) => (
                            <button
                                key={key}
                                onClick={() => setActivePreset(key)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                    activePreset === key
                                        ? 'bg-violet-100 text-violet-700 border border-violet-300'
                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* 날짜 입력 */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <input
                            className={inputCls}
                            placeholder="시작일 YYYYMMDD"
                            value={sDate}
                            onChange={(e) => { setSDate(e.target.value.replace(/\D/g, '').slice(0, 8)); setActivePreset(null); }}
                        />
                        <input
                            className={inputCls}
                            placeholder="종료일 YYYYMMDD"
                            value={eDate}
                            onChange={(e) => { setEDate(e.target.value.replace(/\D/g, '').slice(0, 8)); setActivePreset(null); }}
                        />
                    </div>

                    <button
                        onClick={handleRequest}
                        disabled={requesting || polling || !sDate || !eDate}
                        className="w-full py-3 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:bg-slate-300 transition-colors flex items-center justify-center gap-2"
                    >
                        {requesting ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                        {requesting ? '요청 중...' : `${type === 'SELL' ? '매출' : '매입'} 수집 시작`}
                    </button>
                </div>

                {/* 3. 작업 상태 */}
                {job && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <RefreshCw size={18} className={polling ? 'animate-spin text-violet-600' : 'text-slate-500'} />
                            3단계 · 작업 상태
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATE_LABELS[job.job_state]?.color || 'bg-slate-100'}`}>
                                {STATE_LABELS[job.job_state]?.label || '알수없음'}
                            </span>
                        </h2>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                            <div><b>JobID:</b> <span className="font-mono">{job.job_id}</span></div>
                            <div><b>요청유형:</b> {job.request_type || type}</div>
                            <div><b>요청기간:</b> {job.request_s_date || sDate} ~ {job.request_e_date || eDate}</div>
                            <div><b>요청시각:</b> {job.request_dt || '-'}</div>
                        </div>
                        {job.error_reason && (
                            <div className="mt-3 p-2 bg-red-50 text-red-700 rounded-lg text-xs">
                                {job.error_reason}
                            </div>
                        )}
                        {polling && (
                            <div className="mt-3 text-xs text-slate-500 flex items-center gap-1">
                                <Loader2 size={12} className="animate-spin" /> 3초마다 자동 새로고침... (수집 1~5분 소요)
                            </div>
                        )}
                    </div>
                )}

                {/* 4. 결과 요약 */}
                {summary?.ok && (
                    <div className="bg-gradient-to-r from-violet-50 to-indigo-50 p-5 rounded-2xl border border-violet-100 mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-bold text-slate-800">📊 수집 결과 요약</h2>
                            <button
                                onClick={exportCsv}
                                disabled={list.length === 0}
                                className="px-3 py-1.5 bg-white border border-violet-200 rounded-lg text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1"
                            >
                                <Download size={12} /> CSV
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-white p-3 rounded-xl">
                                <div className="text-xs text-slate-500 mb-1">건수</div>
                                <div className="text-lg font-bold text-slate-800">{summary.count}</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl">
                                <div className="text-xs text-slate-500 mb-1">공급가액</div>
                                <div className="text-lg font-bold text-slate-800">{fmt(summary.supplyCostTotal)}</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl">
                                <div className="text-xs text-slate-500 mb-1">세액</div>
                                <div className="text-lg font-bold text-slate-800">{fmt(summary.taxTotal)}</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl">
                                <div className="text-xs text-slate-500 mb-1">합계</div>
                                <div className="text-lg font-bold text-violet-700">{fmt(summary.totalAmount)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. 결과 리스트 */}
                {(list.length > 0 || resultsLoading) && (
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText size={18} className="text-violet-600" /> 수집된 세금계산서
                            <span className="text-xs text-slate-400">({list.length}건)</span>
                        </h2>
                        {resultsLoading ? (
                            <div className="text-center py-8 text-slate-400">
                                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                                결과 로딩 중...
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50 text-slate-600">
                                            <th className="px-2 py-2 text-left">작성일</th>
                                            <th className="px-2 py-2 text-left">{type === 'SELL' ? '공급받는자' : '공급자'}</th>
                                            <th className="px-2 py-2 text-right">공급가액</th>
                                            <th className="px-2 py-2 text-right">세액</th>
                                            <th className="px-2 py-2 text-right">합계</th>
                                            <th className="px-2 py-2 text-center">청구/영수</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.map((r, idx) => {
                                            const counterpartName = type === 'SELL' ? r.invoiceeCorpName : r.invoicerCorpName;
                                            const counterpartNum = type === 'SELL' ? r.invoiceeCorpNum : r.invoicerCorpNum;
                                            return (
                                                <tr key={idx} className="border-t hover:bg-slate-50">
                                                    <td className="px-2 py-2">{r.writeDate}</td>
                                                    <td className="px-2 py-2">
                                                        <div className="font-medium">{counterpartName || '-'}</div>
                                                        <div className="text-[10px] text-slate-400">{counterpartNum}</div>
                                                    </td>
                                                    <td className="px-2 py-2 text-right">{fmt(r.supplyCostTotal)}</td>
                                                    <td className="px-2 py-2 text-right">{fmt(r.taxTotal)}</td>
                                                    <td className="px-2 py-2 text-right font-bold text-violet-700">{fmt(r.totalAmount)}</td>
                                                    <td className="px-2 py-2 text-center">{r.purposeType || '-'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 가이드 */}
                {!job && isReady && (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 flex items-start gap-2">
                        <Info size={16} className="mt-0.5 flex-shrink-0" />
                        <div>
                            <div className="font-semibold mb-1">활용 팁</div>
                            <ul className="text-xs space-y-1 list-disc list-inside">
                                <li>매월 1일경 <b>지난달</b> 프리셋으로 매출+매입을 각각 수집하면 세무사 자료 준비 끝</li>
                                <li>수집은 비동기 — JobID 발급 후 1~5분 정도 소요됩니다</li>
                                <li>동일 기간 재수집 시 최신 데이터로 갱신됩니다 (홈택스 발행 지연 반영)</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* 등록 모달 */}
                {showRegistModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowRegistModal(false)}>
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800">홈택스 부서사용자 등록</h3>
                                <button onClick={() => setShowRegistModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="text-xs text-slate-500 mb-4 p-3 bg-slate-50 rounded-lg">
                                <b>※ 부서사용자 ID란?</b><br />
                                홈택스 → 회원가입 → "부서사용자" 또는 "수임사용자"로 발급받은 ID입니다. 사업자 ID(대표자)와 별개입니다.
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">부서사용자 ID</label>
                                    <input
                                        className={inputCls}
                                        value={registForm.dept_user_id}
                                        onChange={(e) => setRegistForm({ ...registForm, dept_user_id: e.target.value })}
                                        autoComplete="off"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 mb-1">부서사용자 비밀번호</label>
                                    <input
                                        type="password"
                                        className={inputCls}
                                        value={registForm.dept_user_pwd}
                                        onChange={(e) => setRegistForm({ ...registForm, dept_user_pwd: e.target.value })}
                                        autoComplete="new-password"
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2 mt-5">
                                <button
                                    onClick={() => setShowRegistModal(false)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200"
                                >
                                    취소
                                </button>
                                <button
                                    onClick={handleRegist}
                                    disabled={registing || !registForm.dept_user_id || !registForm.dept_user_pwd}
                                    className="flex-1 py-2.5 bg-violet-600 text-white rounded-xl font-bold hover:bg-violet-700 disabled:bg-slate-300 flex items-center justify-center gap-1"
                                >
                                    {registing ? <Loader2 size={14} className="animate-spin" /> : null}
                                    {registing ? '등록 중...' : '등록'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
