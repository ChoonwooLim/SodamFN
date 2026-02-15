import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { ChevronLeft, Check, Eraser, PenTool, Type, FileText, Loader2 } from 'lucide-react';

export default function ContractSign() {
    const { id } = useParams();
    const navigate = useNavigate();
    const canvasRef = useRef(null);

    const [contract, setContract] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [signMode, setSignMode] = useState('draw'); // draw | seal
    const [drawing, setDrawing] = useState(false);
    const [address, setAddress] = useState('');
    const [phone, setPhone] = useState('');
    const [sealGenerated, setSealGenerated] = useState(false);

    useEffect(() => {
        const fetchContract = async () => {
            try {
                const res = await api.get(`/contracts/${id}`);
                if (res.data.status === 'success') {
                    setContract(res.data.data);
                    // Pre-fill info from staff record
                    if (res.data.data.staff) {
                        setAddress(res.data.data.staff.address || '');
                        setPhone(res.data.data.staff.phone || '');
                    }
                }
            } catch (err) {
                console.error(err);
                if (err.response?.status === 404) navigate('/contracts');
            } finally {
                setLoading(false);
            }
        };
        fetchContract();
    }, [id, navigate]);

    // Set up canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }, [loading, signMode]);

    // Generate seal (도장)
    const generateSeal = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const name = contract?.staff?.name || localStorage.getItem('user_name') || '직원';
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) * 0.3;

        // Circle
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#dc2626';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Name
        ctx.font = `bold ${r * 0.6}px Inter, sans-serif`;
        ctx.fillStyle = '#dc2626';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (name.length <= 2) {
            ctx.font = `bold ${r * 0.8}px Inter, sans-serif`;
            ctx.fillText(name, cx, cy);
        } else if (name.length === 3) {
            ctx.font = `bold ${r * 0.5}px Inter, sans-serif`;
            ctx.fillText(name[0], cx, cy - r * 0.25);
            ctx.fillText(name.slice(1), cx, cy + r * 0.25);
        } else {
            ctx.font = `bold ${r * 0.4}px Inter, sans-serif`;
            ctx.fillText(name.slice(0, 2), cx, cy - r * 0.2);
            ctx.fillText(name.slice(2, 4), cx, cy + r * 0.2);
        }

        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 3;
        setSealGenerated(true);
    };

    // Drawing handlers (touch + mouse)
    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDraw = (e) => {
        if (signMode !== 'draw') return;
        e.preventDefault();
        setDrawing(true);
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e) => {
        if (!drawing || signMode !== 'draw') return;
        e.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = () => setDrawing(false);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setSealGenerated(false);
    };

    const handleSubmit = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const signatureData = canvas.toDataURL('image/png');

        // Check if canvas is empty
        const ctx = canvas.getContext('2d');
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasContent = pixelData.some((v, i) => i % 4 === 3 && v > 0);
        if (!hasContent) {
            alert('서명 또는 도장을 입력해주세요.');
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/contracts/${id}/sign`, {
                signature_data: signatureData,
                address: address || undefined,
                phone: phone || undefined,
            });
            alert('✅ 서명이 완료되었습니다!');
            navigate('/contracts');
        } catch (err) {
            const msg = err.response?.data?.detail || '서명 처리 중 오류가 발생했습니다.';
            alert(msg);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;
    if (!contract) return <div className="page"><p>계약서를 찾을 수 없습니다.</p></div>;

    const isSigned = contract.status === 'signed';

    return (
        <div style={{ minHeight: '100dvh', background: 'var(--bg)', paddingBottom: '24px' }} className="animate-fade">
            {/* Header */}
            <div style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'var(--surface)',
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
                zIndex: 100,
            }}>
                <button className="btn-ghost" onClick={() => navigate('/contracts')} style={{ padding: '8px' }}>
                    <ChevronLeft size={22} />
                </button>
                <div style={{ flex: 1 }}>
                    <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>{contract.title}</h2>
                    <span className="text-xs text-muted">
                        {new Date(contract.created_at).toLocaleDateString('ko-KR')}
                    </span>
                </div>
                {isSigned && <span className="badge badge-success">서명 완료</span>}
            </div>

            <div style={{ padding: '16px', maxWidth: '480px', margin: '0 auto' }}>
                {/* Contract Content */}
                <div className="card mb-4" style={{ maxHeight: '300px', overflow: 'auto' }}>
                    <div className="section-title mb-2"><FileText size={16} /> 계약 내용</div>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                        {contract.content}
                    </div>
                </div>

                {!isSigned && (
                    <>
                        {/* Additional Info */}
                        <div className="card mb-4">
                            <div className="section-title mb-2">📝 추가 정보</div>
                            <div className="input-group">
                                <label className="input-label">주소</label>
                                <input className="input" placeholder="주소 입력" value={address} onChange={(e) => setAddress(e.target.value)} />
                            </div>
                            <div className="input-group" style={{ marginBottom: 0 }}>
                                <label className="input-label">연락처</label>
                                <input className="input" placeholder="010-0000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
                            </div>
                        </div>

                        {/* Signature Area */}
                        <div className="card mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <div className="section-title">✍️ 서명</div>
                                <div className="tabs" style={{ marginBottom: 0, width: 'auto' }}>
                                    <button className={`tab ${signMode === 'draw' ? 'active' : ''}`} onClick={() => { setSignMode('draw'); clearCanvas(); }} style={{ padding: '6px 14px' }}>
                                        <PenTool size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> 서명
                                    </button>
                                    <button className={`tab ${signMode === 'seal' ? 'active' : ''}`} onClick={() => { setSignMode('seal'); clearCanvas(); setTimeout(generateSeal, 100); }} style={{ padding: '6px 14px' }}>
                                        <Type size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> 도장
                                    </button>
                                </div>
                            </div>

                            <div style={{ position: 'relative' }}>
                                <canvas
                                    ref={canvasRef}
                                    className="signature-pad"
                                    style={{ width: '100%', height: '200px' }}
                                    onMouseDown={startDraw}
                                    onMouseMove={draw}
                                    onMouseUp={stopDraw}
                                    onMouseLeave={stopDraw}
                                    onTouchStart={startDraw}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDraw}
                                />
                                <button
                                    onClick={clearCanvas}
                                    className="btn-ghost"
                                    style={{
                                        position: 'absolute', top: '8px', right: '8px',
                                        background: 'rgba(255,255,255,0.9)', borderRadius: '8px', padding: '6px 10px',
                                    }}
                                >
                                    <Eraser size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-muted" style={{ marginTop: '8px', textAlign: 'center' }}>
                                {signMode === 'draw' ? '위 영역에 손가락으로 서명하세요' : '자동 생성된 도장입니다'}
                            </p>
                        </div>

                        {/* Submit */}
                        <button
                            className="btn btn-primary btn-block btn-lg"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? <Loader2 size={20} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Check size={20} />}
                            서명 완료
                        </button>
                    </>
                )}

                {isSigned && contract.signed_at && (
                    <div className="card" style={{ background: '#f0fdf4', borderColor: '#bbf7d0', textAlign: 'center' }}>
                        <Check size={32} color="#059669" />
                        <p style={{ fontWeight: 700, color: '#065f46', marginTop: '8px' }}>서명 완료</p>
                        <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
                            {new Date(contract.signed_at).toLocaleString('ko-KR')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
