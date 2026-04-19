import { useState, useEffect } from 'react';
import { Wallet, Save, Building2, MapPin, Navigation, Loader2, Settings as SettingsIcon, Users, Stamp, Check } from 'lucide-react';
import VendorSettings from './VendorSettings';
import ContractSettings from './ContractSettings';
import GoogleMapPicker from '../components/GoogleMapPicker';
import { useBusinessConfig } from '../hooks/useBusinessConfig';
import { SEAL_STYLES, CompanySeal } from '../components/CompanySeal';
import api from '../api';

const TABS = [
    { key: 'vendor', label: '거래처 및 품목 관리' },
    { key: 'contract', label: '전자계약서 양식' },
    { key: 'payment', label: '급여 출금계좌' },
    { key: 'location', label: '매장 위치 관리' },
    { key: 'logo', label: '회사 로고 관리' },
    { key: 'seal', label: '회사직인 관리' },
    { key: 'business', label: '사업장 규모 설정' },
];

export default function Settings() {
    const { employeeScale, updateScale, refresh: refreshBusinessConfig } = useBusinessConfig();
    const [activeTab, setActiveTab] = useState('vendor');
    const [scaleUpdating, setScaleUpdating] = useState(false);
    const [scaleMessage, setScaleMessage] = useState(null); // { type: 'success'|'error', text }
    const [bizAccount, setBizAccount] = useState({ bank: '', number: '', holder: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Location State
    const [location, setLocation] = useState({ name: '소담김밥', latitude: 0, longitude: 0, radius_meters: 100 });
    const [locSaving, setLocSaving] = useState(false);
    const [locMessage, setLocMessage] = useState('');
    const [gettingGps, setGettingGps] = useState(false);

    // Common API URL
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    // Logo State
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoSaving, setLogoSaving] = useState(false);
    const [logoMessage, setLogoMessage] = useState('');

    // Seal State
    const [sealStyle, setSealStyle] = useState('seal-01');
    const [sealText, setSealText] = useState('');
    const [sealSaving, setSealSaving] = useState(false);
    const [sealMessage, setSealMessage] = useState(null);

    useEffect(() => {
        if (activeTab === 'payment') fetchBizAccount();
        if (activeTab === 'location') fetchLocation();
        if (activeTab === 'logo') fetchBusinessInfo();
        if (activeTab === 'seal') fetchSealSettings();
    }, [activeTab]);

    const fetchSealSettings = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const payload = JSON.parse(atob(token.split('.')[1]));
            const bid = payload.business_id || localStorage.getItem('business_id');
            if (!bid) return;
            const res = await api.get(`/auth/business-info?bid=${bid}`);
            if (res.data) {
                setSealStyle(res.data.seal_style || 'seal-01');
                setSealText(res.data.seal_text || res.data.business_name || '');
            }
        } catch (e) { console.error('Error fetching seal settings:', e); }
    };

    const handleSaveSeal = async () => {
        setSealSaving(true);
        setSealMessage(null);
        try {
            await api.put('/auth/business-settings', {
                seal_style: sealStyle,
                seal_text: sealText,
            });
            setSealMessage({ type: 'success', text: '회사 직인이 저장되었습니다.' });
        } catch (e) {
            setSealMessage({ type: 'error', text: '저장 중 오류가 발생했습니다.' });
        } finally {
            setSealSaving(false);
        }
    };

    const fetchBusinessInfo = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const payload = JSON.parse(atob(token.split('.')[1]));
            const bid = payload.business_id || localStorage.getItem('business_id');
            const res = await api.get(`/auth/business-info?bid=${bid}`);
            if (res.data?.logo_url) {
                setLogoPreview(`${API_URL}${res.data.logo_url}`);
            }
        } catch (e) { console.error('Error fetching business info:', e); }
    };

    const handleLogoFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogoPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveLogo = async () => {
        if (!logoFile) return;
        setLogoSaving(true);
        setLogoMessage('');
        const formData = new FormData();
        formData.append('file', logoFile);

        try {
            await api.post('/upload/image/business-logo', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setLogoMessage('회사 로고가 성공적으로 업데이트되었습니다.');
            setLogoFile(null);
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            setLogoMessage('저장 중 오류가 발생했습니다.');
        } finally {
            setLogoSaving(false);
        }
    };

    const fetchBizAccount = async () => {
        try {
            const res = await api.get('/payroll/transfer/biz-account');
            if (res.data?.data) {
                setBizAccount(res.data.data);
            }
        } catch (error) {
            console.error('Error fetching biz account:', error);
        }
    };

    const fetchLocation = async () => {
        try {
            const res = await api.get('/hr/location');
            if (res.data?.data) setLocation(res.data.data);
        } catch (e) { console.error('Error fetching location:', e); }
    };

    const handleSaveLocation = async () => {
        setLocSaving(true);
        setLocMessage('');
        try {
            await api.post('/hr/location', location);
            setLocMessage(`매장 위치가 저장되었습니다. (반경 ${location.radius_meters}m)`);
        } catch (e) {
            setLocMessage('저장 중 오류가 발생했습니다.');
        } finally {
            setLocSaving(false);
        }
    };

    const handleUseCurrentLocation = () => {
        if (!navigator.geolocation) {
            setLocMessage('이 브라우저에서 GPS가 지원되지 않습니다.');
            return;
        }
        setGettingGps(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setLocation(prev => ({ ...prev, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                setLocMessage(`현재 위치가 반영되었습니다. (정확도: ${Math.round(pos.coords.accuracy)}m)`);
                setGettingGps(false);
            },
            (err) => {
                setLocMessage('위치 권한이 거부되었습니다.');
                setGettingGps(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSaveBizAccount = async () => {
        setSaving(true);
        setMessage('');
        try {
            await api.put('/payroll/transfer/biz-account', bizAccount);
            setMessage('출금계좌 정보가 저장되었습니다.');
        } catch (error) {
            console.error('Save biz account error:', error.response?.status, error.response?.data);
            if (error.response?.status === 401) {
                setMessage('인증이 필요합니다. 다시 로그인해주세요.');
            } else if (error.response?.status === 403) {
                setMessage('권한이 없습니다. 관리자만 접근 가능합니다.');
            } else if (error.response?.status === 422) {
                setMessage(`입력값 오류: ${JSON.stringify(error.response?.data?.detail || '알 수 없는 오류')}`);
            } else {
                setMessage('저장 중 오류가 발생했습니다.');
            }
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-5xl mx-auto px-6 py-8 pb-32">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg shadow-slate-500/20">
                            <SettingsIcon size={20} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 tracking-tight">환경 설정</h1>
                            <p className="text-xs text-slate-400 mt-0.5">시스템의 전반적인 설정을 관리합니다</p>
                        </div>
                    </div>
                </header>

                {/* Tabs */}
                <div className="flex gap-2 mb-8 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
                                activeTab === tab.key
                                    ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                {activeTab === 'vendor' ? (
                    <div className="-mt-2">
                        <VendorSettings />
                    </div>
                ) : activeTab === 'contract' ? (
                    <ContractSettings />
                ) : activeTab === 'location' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 max-w-3xl card-animate">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                <MapPin size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">매장 위치 설정 (Geofence)</h2>
                                <p className="text-xs text-slate-400 mt-0.5">GPS 출퇴근 인증에 사용할 매장 위치와 허용 반경을 설정합니다.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">매장명</label>
                                <input type="text" value={location.name} onChange={(e) => setLocation({ ...location, name: e.target.value })} placeholder="소담김밥" className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">위도 (Latitude)</label>
                                    <input type="number" step="0.0001" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">경도 (Longitude)</label>
                                    <input type="number" step="0.0001" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all" />
                                </div>
                            </div>

                            <button onClick={handleUseCurrentLocation} disabled={gettingGps} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all disabled:opacity-50">
                                {gettingGps ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                                {gettingGps ? 'GPS 좌표 획득 중...' : '현재 위치로 설정'}
                            </button>

                            {/* Google Maps Picker */}
                            <GoogleMapPicker
                                latitude={location.latitude}
                                longitude={location.longitude}
                                radius={location.radius_meters}
                                onLocationChange={(lat, lng) => setLocation(prev => ({ ...prev, latitude: parseFloat(lat.toFixed(6)), longitude: parseFloat(lng.toFixed(6)) }))}
                            />

                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">허용 반경: <strong className="text-slate-700">{location.radius_meters}m</strong></label>
                                <input type="range" min="5" max="10" step="1" value={location.radius_meters} onChange={(e) => setLocation({ ...location, radius_meters: parseInt(e.target.value) })} className="w-full accent-emerald-600" />
                                <div className="flex justify-between text-xs text-slate-400 mt-1"><span>5m</span><span>6m</span><span>7m</span><span>8m</span><span>9m</span><span>10m</span></div>
                            </div>

                            {locMessage && (
                                <div className={`text-sm font-medium p-4 rounded-xl ${locMessage.includes('오류') || locMessage.includes('거부') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                                    {locMessage}
                                </div>
                            )}

                            <button onClick={handleSaveLocation} disabled={locSaving} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm disabled:opacity-50">
                                <Save size={16} />
                                {locSaving ? '저장 중...' : '매장 위치 저장'}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'payment' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 max-w-3xl card-animate">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Building2 size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">급여 출금계좌 설정</h2>
                                <p className="text-xs text-slate-400 mt-0.5">직원 급여 이체에 사용할 사업자 계좌 정보를 입력합니다.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">은행명</label>
                                <input
                                    type="text"
                                    value={bizAccount.bank}
                                    onChange={(e) => setBizAccount({ ...bizAccount, bank: e.target.value })}
                                    placeholder="예: 국민은행"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">계좌번호</label>
                                <input
                                    type="text"
                                    value={bizAccount.number}
                                    onChange={(e) => setBizAccount({ ...bizAccount, number: e.target.value })}
                                    placeholder="예: 123-456-789012"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">예금주</label>
                                <input
                                    type="text"
                                    value={bizAccount.holder}
                                    onChange={(e) => setBizAccount({ ...bizAccount, holder: e.target.value })}
                                    placeholder="예: 소담김밥"
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                                />
                            </div>

                            {message && (
                                <div className={`text-sm font-medium p-4 rounded-xl ${message.includes('오류') || message.includes('권한') || message.includes('인증') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                                    {message}
                                </div>
                            )}

                            <button
                                onClick={handleSaveBizAccount}
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                {saving ? '저장 중...' : '저장'}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'logo' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 max-w-3xl card-animate">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 flex items-center justify-center shadow-lg shadow-pink-500/20">
                                <Building2 size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">회사 로고 설정</h2>
                                <p className="text-xs text-slate-400 mt-0.5">사이드바 좌측 상단에 표시될 매장의 로고 이미지를 업로드합니다.</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                                {logoPreview ? (
                                    <img src={logoPreview} alt="Logo Preview" className="w-24 h-24 rounded-full object-cover bg-white shadow-md mb-4" />
                                ) : (
                                    <div className="w-24 h-24 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                                        <span className="text-slate-400 font-bold text-xs">로고 없음</span>
                                    </div>
                                )}

                                <input
                                    type="file"
                                    id="logoUpload"
                                    className="hidden"
                                    accept="image/jpeg, image/png, image/gif, image/webp"
                                    onChange={handleLogoFileChange}
                                />
                                <label
                                    htmlFor="logoUpload"
                                    className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    이미지 선택
                                </label>
                                <p className="text-xs text-slate-400 mt-3">권장 사이즈: 100x100 픽셀 이상 (정사각형)<br />지원 형식: JPG, PNG, GIF, WEBP</p>
                            </div>

                            {logoMessage && (
                                <div className={`text-sm font-medium p-4 rounded-xl ${logoMessage.includes('오류') ? 'bg-red-50 border border-red-200 text-red-600' : 'bg-emerald-50 border border-emerald-200 text-emerald-600'}`}>
                                    {logoMessage}
                                </div>
                            )}

                            <button
                                onClick={handleSaveLogo}
                                disabled={logoSaving || !logoFile}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-800 to-slate-900 text-white rounded-xl text-sm font-semibold hover:from-slate-700 hover:to-slate-800 transition-all shadow-sm disabled:opacity-50"
                            >
                                <Save size={16} />
                                {logoSaving ? '저장 중...' : '로고 저장 및 변경'}
                            </button>
                        </div>
                    </div>
                ) : activeTab === 'seal' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 max-w-5xl card-animate">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
                                <Stamp size={18} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">회사직인 관리</h2>
                                <p className="text-xs text-slate-400 mt-0.5">계약서·증명서 등에 사용할 회사 직인 스타일과 문구를 선택합니다.</p>
                            </div>
                        </div>

                        {/* 회사명 입력 + 미리보기 */}
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 mb-6 items-start">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                        직인 문구 (회사명)
                                    </label>
                                    <input
                                        type="text"
                                        value={sealText}
                                        onChange={(e) => setSealText(e.target.value)}
                                        placeholder="예: 소담김밥"
                                        maxLength={30}
                                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-all"
                                    />
                                    <p className="text-xs text-slate-400 mt-1.5">
                                        사각 인장(seal-03)은 최대 4자, 그 외는 6자 이내를 권장합니다.
                                    </p>
                                </div>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 leading-relaxed">
                                    <strong>💡 안내</strong><br />
                                    선택한 직인은 전자계약서·급여명세서·재직증명서 등 공식 문서에 자동 삽입됩니다.
                                </div>
                            </div>
                            <div className="flex flex-col items-center">
                                <div className="text-xs text-slate-500 mb-2 font-medium">현재 선택된 직인</div>
                                <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200">
                                    <CompanySeal style={sealStyle} text={sealText || '회사명'} size={160} />
                                </div>
                                <div className="text-xs font-semibold text-slate-700 mt-2">
                                    {(SEAL_STYLES.find(s => s.key === sealStyle) || {}).name}
                                </div>
                            </div>
                        </div>

                        {/* 10개 샘플 그리드 */}
                        <div className="mb-4">
                            <div className="text-sm font-bold text-slate-700 mb-3">
                                스타일 선택 (10종)
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                {SEAL_STYLES.map((s) => {
                                    const selected = s.key === sealStyle;
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => setSealStyle(s.key)}
                                            className={`relative p-3 rounded-xl border-2 transition-all text-left flex flex-col items-center gap-2 ${
                                                selected
                                                    ? 'border-red-500 bg-red-50 ring-2 ring-red-200 shadow-md'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                            }`}
                                        >
                                            {selected && (
                                                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-600 flex items-center justify-center z-10">
                                                    <Check size={12} className="text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                            <CompanySeal style={s.key} text={sealText || '회사명'} size={96} />
                                            <div className="text-center">
                                                <div className="text-xs font-bold text-slate-800">{s.name}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight line-clamp-2">{s.description}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {sealMessage && (
                            <div className={`mb-4 text-sm font-medium p-4 rounded-xl ${
                                sealMessage.type === 'error'
                                    ? 'bg-red-50 border border-red-200 text-red-600'
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
                            }`}>
                                {sealMessage.text}
                            </div>
                        )}

                        <button
                            onClick={handleSaveSeal}
                            disabled={sealSaving || !sealText.trim()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl text-sm font-semibold hover:from-red-700 hover:to-red-800 transition-all shadow-sm disabled:opacity-50"
                        >
                            <Save size={16} />
                            {sealSaving ? '저장 중...' : '직인 저장'}
                        </button>
                    </div>
                ) : activeTab === 'business' ? (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow p-6 max-w-3xl card-animate">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Users size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">사업장 규모 설정</h3>
                                <p className="text-xs text-slate-400">상시근로자 수에 따라 적용 법령과 메뉴가 달라집니다</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            {/* 5인 미만 카드 */}
                            <button
                                onClick={async () => {
                                    setScaleUpdating(true);
                                    setScaleMessage(null);
                                    const ok = await updateScale('under5');
                                    await refreshBusinessConfig();
                                    setScaleUpdating(false);
                                    setScaleMessage(ok
                                        ? { type: 'success', text: '5인 미만 사업장으로 변경되었습니다.' }
                                        : { type: 'error', text: '변경에 실패했습니다. 잠시 후 다시 시도해주세요.' });
                                }}
                                disabled={scaleUpdating}
                                className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                                    employeeScale === 'under5'
                                        ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }`}
                            >
                                {employeeScale === 'under5' && (
                                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                                <div className="text-2xl mb-2">🏪</div>
                                <h4 className="text-base font-bold text-slate-800 mb-1">5인 미만 사업장</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">간편 모드</p>
                                <ul className="mt-3 space-y-1.5 text-xs text-slate-500">
                                    <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">-</span>연차/휴가 관리 미적용</li>
                                    <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">-</span>연장근로 규제 미적용</li>
                                    <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">-</span>법정교육 의무 제외</li>
                                    <li className="flex items-start gap-1.5"><span className="text-emerald-500 mt-0.5">-</span>간편 급여/근태 관리</li>
                                </ul>
                            </button>

                            {/* 5인 이상 카드 */}
                            <button
                                onClick={async () => {
                                    setScaleUpdating(true);
                                    setScaleMessage(null);
                                    const ok = await updateScale('over5');
                                    await refreshBusinessConfig();
                                    setScaleUpdating(false);
                                    setScaleMessage(ok
                                        ? { type: 'success', text: '5인 이상 사업장으로 변경되었습니다.' }
                                        : { type: 'error', text: '변경에 실패했습니다. 잠시 후 다시 시도해주세요.' });
                                }}
                                disabled={scaleUpdating}
                                className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                                    employeeScale === 'over5'
                                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                                        : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                }`}
                            >
                                {employeeScale === 'over5' && (
                                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                                        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                    </div>
                                )}
                                <div className="text-2xl mb-2">🏢</div>
                                <h4 className="text-base font-bold text-slate-800 mb-1">5인 이상 사업장</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">전체 기능 모드</p>
                                <ul className="mt-3 space-y-1.5 text-xs text-slate-500">
                                    <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">+</span>연차/휴가 자동 관리</li>
                                    <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">+</span>근로시간 모니터링/알림</li>
                                    <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">+</span>법정 의무교육 관리</li>
                                    <li className="flex items-start gap-1.5"><span className="text-blue-500 mt-0.5">+</span>전체 HR 기능 활성화</li>
                                </ul>
                            </button>
                        </div>

                        {scaleMessage && (
                            <div className={`mb-4 rounded-xl p-3 text-sm font-medium border ${
                                scaleMessage.type === 'success'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}>
                                {scaleMessage.text}
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                            <p className="text-xs text-amber-700 font-medium">
                                <strong>참고:</strong> 상시근로자 수 기준은 근로기준법 제11조에 따릅니다.
                                상시 5인 미만 사업장은 근로기준법 일부 조항(연차유급휴가, 연장/야간/휴일 가산수당, 부당해고 보호 등)이 적용되지 않습니다.
                                설정 변경 시 즉시 메뉴와 기능이 반영됩니다.
                            </p>
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
