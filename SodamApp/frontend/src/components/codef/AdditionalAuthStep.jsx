import { useState } from 'react';
import { Smartphone, Image as ImageIcon } from 'lucide-react';
import api from '../../api';

/**
 * 추가 본인확인 (SMS / 캡차) 단계.
 *
 * 주의: /api/codef/connections/{cid}/verify 엔드포인트는 현재 501 (PoC 검증 후 보강 예정).
 * 이 컴포넌트는 UI 흐름을 미리 만들어두고, 백엔드 보강 후 즉시 동작 — 진행은 안내 메시지로 처리.
 */
export default function AdditionalAuthStep({ method, extraInfo, connectionId, onVerified, onCancel }) {
    const [code, setCode] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [err, setErr] = useState('');

    const handleVerify = async () => {
        if (!code.trim()) {
            setErr('코드를 입력하세요.');
            return;
        }
        setErr('');
        setSubmitting(true);
        try {
            const body = method === 'sms' ? { sms_code: code, extra: extraInfo } : { captcha: code, extra: extraInfo };
            await api.post(`/codef/connections/${connectionId}/verify`, body);
            onVerified?.();
        } catch (e) {
            const detail = e.response?.data?.detail || '인증 실패';
            // 501 = 백엔드 미구현 상태
            if (e.response?.status === 501) {
                setErr('추가본인확인 verify 흐름은 PoC 검증 후 보강 예정입니다. 카드사 ID/PW 직접 등록을 시도해주세요.');
            } else {
                setErr(detail);
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="text-center py-3">
                {method === 'sms' ? (
                    <Smartphone className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                ) : (
                    <ImageIcon className="w-10 h-10 text-blue-600 mx-auto mb-2" />
                )}
                <h3 className="text-base font-semibold text-slate-800">
                    {method === 'sms' ? '추가 본인 확인' : '캡차 입력'}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                    {method === 'sms'
                        ? '카드사가 SMS 인증을 요구합니다. 휴대폰으로 받은 코드를 입력하세요.'
                        : '카드사가 캡차 인증을 요구합니다.'}
                </p>
            </div>

            <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={method === 'sms' ? '인증번호 6자리' : '캡차 입력'}
                className="w-full px-4 py-3 text-center text-lg tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={method === 'sms' ? 6 : 32}
                autoFocus
            />

            {err && (
                <div className="text-sm p-2 rounded bg-red-50 text-red-700 border border-red-200">
                    {err}
                </div>
            )}

            <div className="flex gap-2">
                <button
                    onClick={onCancel}
                    className="flex-1 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300"
                >
                    취소
                </button>
                <button
                    onClick={handleVerify}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                    {submitting ? '확인 중...' : '확인'}
                </button>
            </div>
        </div>
    );
}
