import { useEffect, useState } from "react";
import api from "../../api";
import SettlementWatch from "./SettlementWatch";

export default function AutoCollection() {
    const [status, setStatus] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get("/auto-collection/status")
            .then(r => setStatus(r.data))
            .catch(e => setError(e?.response?.data?.detail || e.message));
    }, []);

    if (error) return <div className="p-6 text-red-600">오류: {error}</div>;
    if (!status) return <div className="p-6">로딩…</div>;

    return (
        <div className="p-6 max-w-4xl">
            <h2 className="text-2xl font-bold mb-6">자동수집 상태</h2>

            <section className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">매장 (EasyPOS)</h3>
                <ChannelStatus s={status.channels.easypos} />
            </section>

            <section className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">쿠팡이츠</h3>
                <ChannelStatus s={status.channels.coupang_eats} />
            </section>

            <section className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">수수료 자동 추정</h3>
                <p className="text-sm text-slate-700">학습 카드사: <b>{status.fee_estimator.card_corps_learned}</b>개</p>
                <p className="text-sm text-slate-700">평균 신뢰도: <b>{status.fee_estimator.avg_confidence}</b></p>
            </section>

            <section className="mb-6 p-4 bg-white rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold mb-2">입금 모니터</h3>
                <SettlementWatch />
            </section>
        </div>
    );
}

function ChannelStatus({ s }) {
    if (s.status === "no_data") return <p className="text-sm text-slate-500">아직 동기화 안 됨</p>;
    return (
        <p className="text-sm text-slate-700">
            마지막 동기화: {s.started_at}<br/>
            inserted {s.inserted} / updated {s.updated} ({s.status})
        </p>
    );
}
