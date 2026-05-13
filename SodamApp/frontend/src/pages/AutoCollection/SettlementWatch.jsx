import { useEffect, useState } from "react";
import api from "../../api";

export default function SettlementWatch() {
    const [alerts, setAlerts] = useState([]);

    const reload = () => {
        api.get("/auto-collection/settlement-watch/alerts?status=open")
           .then(r => setAlerts(r.data || []))
           .catch(() => setAlerts([]));
    };

    useEffect(reload, []);

    const ack = (id) => {
        if (!confirm("이 미입금 건을 '확인함' 처리합니까?")) return;
        api.post(`/auto-collection/settlement-watch/alerts/${id}/acknowledge`, {}).then(reload);
    };
    const fp = (id) => {
        if (!confirm("이 건은 '입금 안된 것 아님'으로 표시합니까? 학습값에 반영됩니다.")) return;
        api.post(`/auto-collection/settlement-watch/alerts/${id}/false-positive`).then(reload);
    };

    if (alerts.length === 0) {
        return <p className="text-sm text-emerald-700">✅ 미입금 의심 건 없음</p>;
    }

    return (
        <div className="space-y-3">
            {alerts.map(a => (
                <div key={a.id} className="p-3 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-sm">
                        <b className="text-amber-900">{a.channel_or_corp}</b>{" "}
                        {a.expected_date} 예상{" "}
                        <b>{a.expected_amount.toLocaleString()}원</b>{" "}
                        <span className="text-amber-700">(deadline {a.deadline})</span>
                    </p>
                    <div className="mt-2 flex gap-2">
                        <button className="px-3 py-1 text-xs bg-amber-700 text-white rounded"
                                onClick={() => ack(a.id)}>
                            확인함
                        </button>
                        <button className="px-3 py-1 text-xs bg-slate-200 text-slate-700 rounded"
                                onClick={() => fp(a.id)}>
                            입금 안된 것 아님
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
