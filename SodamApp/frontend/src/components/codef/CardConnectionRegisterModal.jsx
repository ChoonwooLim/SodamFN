import { useState, useEffect } from 'react';
import { X, ChevronRight, ShieldCheck } from 'lucide-react';
import api from '../../api';
import AdditionalAuthStep from './AdditionalAuthStep';

/**
 * 카드사 등록 모달 — 3단계 자동 분기.
 *
 * Step 1: 카드사 선택 (카탈로그)
 * Step 2: 인증 수단 선택 (간편인증 가능 카드사) 또는 ID/PW 폼 (ID/PW only)
 * Step 3 (조건부): 추가본인확인 (SMS/캡차)
 */

const SIMPLE_AUTH_OPTIONS = [
    { id: 'kakao', label: '카카오 간편인증', desc: '카카오톡 알림 인증' },
    { id: 'naver', label: '네이버 간편인증', desc: '네이버 앱 인증' },
    { id: 'pass', label: 'PASS 간편인증', desc: '통신사 PASS 앱' },
    { id: 'toss', label: '토스 간편인증', desc: '토스 앱 인증' },
];

export default function CardConnectionRegisterModal({ isOpen, onClose, onRegistered }) {
    const [step, setStep] = useState(1);
    const [orgs, setOrgs] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [authMode, setAuthMode] = useState(null); // 'simple_auth' | 'id_pw'

    // ID/PW form
    const [userId, setUserId] = useState('');
    const [password, setPassword] = useState('');

    // Simple auth form
    const [simpleType, setSimpleType] = useState('kakao');
    const [identity, setIdentity] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [phone, setPhone] = useState('');

    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState('');

    // additional auth state
    const [pendingAuth, setPendingAuth] = useState(null); // {method, extra_info, connection_id}

    useEffect(() => {
        if (!isOpen) return;
        // reset state
        setStep(1);
        setSelectedOrg(null);
        setAuthMode(null);
        setUserId('');
        setPassword('');
        setSimpleType('kakao');
        setIdentity('');
        setBirthDate('');
        setPhone('');
        setErr('');
        setPendingAuth(null);
        // load catalog
        api.get('/codef/organizations/catalog', { params: { type: 'card' } })
            .then((res) => setOrgs(res.data.organizations || []))
            .catch(() => setErr('카드사 목록을 불러오지 못했습니다.'));
    }, [isOpen]);

    if (!isOpen) return null;

    const supportsSimple = selectedOrg?.auth_methods?.includes('simple_auth');

    const handleSelectOrg = (org) => {
        setSelectedOrg(org);
        setAuthMode(org.auth_methods.includes('simple_auth') ? 'simple_auth' : 'id_pw');
        setStep(2);
    };

    const handleSubmit = async () => {
        if (!selectedOrg) return;
        setErr('');
        setSubmitting(true);
        try {
            const auth = authMode === 'id_pw'
                ? { id: userId, password }
                : {
                    loginType: simpleType,
                    identity,
                    birthDate,
                    telecom: phone ? '1' : undefined,
                    phoneNo: phone || undefined,
                };
            const res = await api.post('/codef/connections/register', {
                organization_type: 'card',
                organization_code: selectedOrg.code,
                auth,
            });

            if (res.data.status === 'additional_auth_required') {
                setPendingAuth({
                    method: res.data.method,
                    extra_info: res.data.extra_info,
                });
                setStep(3);
            } else {
                onRegistered?.(res.data.connection);
                onClose();
            }
        } catch (e) {
            setErr(e.response?.data?.detail || '등록에 실패했습니다.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-5 border-b border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800">
                        {step === 1 && '카드사 선택'}
                        {step === 2 && `${selectedOrg?.label} 인증`}
                        {step === 3 && '추가 본인 확인'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {/* STEP 1: 카드사 선택 */}
                    {step === 1 && (
                        <div className="space-y-2">
                            <p className="text-sm text-slate-500 mb-3">
                                연동할 카드사를 선택하세요. 카드사별로 가능한 인증 방식이 자동으로 안내됩니다.
                            </p>
                            {orgs.length === 0 && (
                                <p className="text-sm text-slate-400 text-center py-8">불러오는 중...</p>
                            )}
                            {orgs.map((o) => {
                                const hasSimple = o.auth_methods.includes('simple_auth');
                                return (
                                    <button
                                        key={o.code}
                                        onClick={() => handleSelectOrg(o)}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
                                    >
                                        <div>
                                            <div className="font-medium text-slate-800">{o.label}</div>
                                            <div className="text-xs text-slate-500">
                                                {hasSimple ? '간편인증 + ID/PW' : 'ID/PW'}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-slate-400" />
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* STEP 2: 인증 수단 선택 + 입력 */}
                    {step === 2 && selectedOrg && (
                        <div className="space-y-4">
                            {supportsSimple && (
                                <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                                    <button
                                        onClick={() => setAuthMode('simple_auth')}
                                        className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                            authMode === 'simple_auth'
                                                ? 'bg-white text-blue-700 shadow-sm font-medium'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        간편인증
                                    </button>
                                    <button
                                        onClick={() => setAuthMode('id_pw')}
                                        className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                                            authMode === 'id_pw'
                                                ? 'bg-white text-blue-700 shadow-sm font-medium'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        ID/PW
                                    </button>
                                </div>
                            )}

                            {authMode === 'id_pw' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-slate-700 mb-1.5">
                                            {selectedOrg.label} ID
                                        </label>
                                        <input
                                            type="text"
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-700 mb-1.5">
                                            비밀번호
                                        </label>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            autoComplete="new-password"
                                        />
                                    </div>
                                    <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                                        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                                        <span>
                                            비밀번호는 RSA 공개키로 암호화 후 즉시 폐기됩니다.
                                            셈하나 DB 에 저장되지 않습니다.
                                        </span>
                                    </div>
                                </div>
                            )}

                            {authMode === 'simple_auth' && (
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-sm text-slate-700 mb-1.5">
                                            간편인증 수단
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {SIMPLE_AUTH_OPTIONS.map((opt) => (
                                                <button
                                                    key={opt.id}
                                                    onClick={() => setSimpleType(opt.id)}
                                                    className={`px-3 py-3 text-sm rounded-lg border text-left transition-colors ${
                                                        simpleType === opt.id
                                                            ? 'border-blue-500 bg-blue-50 text-blue-800'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                >
                                                    <div className="font-medium">{opt.label}</div>
                                                    <div className="text-xs text-slate-500">{opt.desc}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-700 mb-1.5">이름</label>
                                        <input
                                            type="text"
                                            value={identity}
                                            onChange={(e) => setIdentity(e.target.value)}
                                            placeholder="홍길동"
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-sm text-slate-700 mb-1.5">생년월일</label>
                                            <input
                                                type="text"
                                                value={birthDate}
                                                onChange={(e) => setBirthDate(e.target.value)}
                                                placeholder="19800101"
                                                maxLength={8}
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-slate-700 mb-1.5">휴대폰번호</label>
                                            <input
                                                type="text"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                placeholder="01012345678"
                                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {err && (
                                <div className="text-sm p-2 rounded bg-red-50 text-red-700 border border-red-200">
                                    {err}
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 3: 추가 본인확인 */}
                    {step === 3 && pendingAuth && (
                        <AdditionalAuthStep
                            method={pendingAuth.method}
                            extraInfo={pendingAuth.extra_info}
                            connectionId={null}  // pending — verify 흐름은 PoC 검증 후 (Phase 1G)
                            onVerified={() => {
                                onRegistered?.();
                                onClose();
                            }}
                            onCancel={onClose}
                        />
                    )}
                </div>

                {step === 2 && (
                    <div className="flex justify-end gap-2 p-5 border-t border-slate-200">
                        <button
                            onClick={() => setStep(1)}
                            className="px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg"
                        >
                            뒤로
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            {submitting ? '등록 중...' : '등록'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
