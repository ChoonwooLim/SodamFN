import { useState, useEffect } from 'react';
import { Wallet, Save, Building2, MapPin, Navigation, Loader2 } from 'lucide-react';
import VendorSettings from './VendorSettings';
import ContractSettings from './ContractSettings';
import GoogleMapPicker from '../components/GoogleMapPicker';
import api from '../api';

export default function Settings() {
    const [activeTab, setActiveTab] = useState('vendor');
    const [bizAccount, setBizAccount] = useState({ bank: '', number: '', holder: '' });
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    // Location State
    const [location, setLocation] = useState({ name: '소담김밥', latitude: 0, longitude: 0, radius_meters: 100 });
    const [locSaving, setLocSaving] = useState(false);
    const [locMessage, setLocMessage] = useState('');
    const [gettingGps, setGettingGps] = useState(false);

    useEffect(() => {
        if (activeTab === 'payment') fetchBizAccount();
        if (activeTab === 'location') fetchLocation();
    }, [activeTab]);

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
        <div className="p-6 bg-slate-50 min-h-screen pb-24">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">환경 설정</h1>
                <p className="text-slate-500">시스템의 전반적인 설정을 관리합니다.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('vendor')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'vendor'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    거래처 및 품목 관리
                </button>
                <button
                    onClick={() => setActiveTab('contract')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'contract'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    전자계약서 양식
                </button>
                <button
                    onClick={() => setActiveTab('payment')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'payment'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    급여 출금계좌
                </button>
                <button
                    onClick={() => setActiveTab('location')}
                    className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${activeTab === 'location'
                        ? 'bg-white text-blue-600 border-t border-x border-slate-200 -mb-px'
                        : 'text-slate-500 hover:text-slate-800'
                        }`}
                >
                    📍 매장 위치 관리
                </button>
            </div>

            {/* Content Area */}
            {activeTab === 'vendor' ? (
                <div className="-mt-6 -mx-6">
                    <VendorSettings />
                </div>
            ) : activeTab === 'contract' ? (
                <ContractSettings />
            ) : activeTab === 'location' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-100 rounded-xl">
                            <MapPin className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">매장 위치 설정 (Geofence)</h2>
                            <p className="text-sm text-slate-500">GPS 출퇴근 인증에 사용할 매장 위치와 허용 반경을 설정합니다.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">매장명</label>
                            <input type="text" value={location.name} onChange={(e) => setLocation({ ...location, name: e.target.value })} placeholder="소담김밥" className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">위도 (Latitude)</label>
                                <input type="number" step="0.0001" value={location.latitude} onChange={(e) => setLocation({ ...location, latitude: parseFloat(e.target.value) || 0 })} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">경도 (Longitude)</label>
                                <input type="number" step="0.0001" value={location.longitude} onChange={(e) => setLocation({ ...location, longitude: parseFloat(e.target.value) || 0 })} className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                        </div>

                        <button onClick={handleUseCurrentLocation} disabled={gettingGps} className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50">
                            {gettingGps ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                            {gettingGps ? 'GPS 좌표 획득 중...' : '📍 현재 위치로 설정'}
                        </button>

                        {/* Google Maps Picker */}
                        <GoogleMapPicker
                            latitude={location.latitude}
                            longitude={location.longitude}
                            radius={location.radius_meters}
                            onLocationChange={(lat, lng) => setLocation(prev => ({ ...prev, latitude: parseFloat(lat.toFixed(6)), longitude: parseFloat(lng.toFixed(6)) }))}
                        />

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-2">허용 반경: <strong>{location.radius_meters}m</strong></label>
                            <input type="range" min="5" max="10" step="1" value={location.radius_meters} onChange={(e) => setLocation({ ...location, radius_meters: parseInt(e.target.value) })} className="w-full accent-emerald-600" />
                            <div className="flex justify-between text-xs text-slate-400 mt-1"><span>5m</span><span>6m</span><span>7m</span><span>8m</span><span>9m</span><span>10m</span></div>
                        </div>

                        {locMessage && (
                            <div className={`text-sm font-medium p-3 rounded-lg ${locMessage.includes('오류') || locMessage.includes('거부') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {locMessage}
                            </div>
                        )}

                        <button onClick={handleSaveLocation} disabled={locSaving} className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white py-3 rounded-lg font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50">
                            <Save size={18} />
                            {locSaving ? '저장 중...' : '매장 위치 저장'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-xl">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 rounded-xl">
                            <Building2 className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">급여 출금계좌 설정</h2>
                            <p className="text-sm text-slate-500">직원 급여 이체에 사용할 사업자 계좌 정보를 입력합니다.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">은행명</label>
                            <input
                                type="text"
                                value={bizAccount.bank}
                                onChange={(e) => setBizAccount({ ...bizAccount, bank: e.target.value })}
                                placeholder="예: 국민은행"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">계좌번호</label>
                            <input
                                type="text"
                                value={bizAccount.number}
                                onChange={(e) => setBizAccount({ ...bizAccount, number: e.target.value })}
                                placeholder="예: 123-456-789012"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">예금주</label>
                            <input
                                type="text"
                                value={bizAccount.holder}
                                onChange={(e) => setBizAccount({ ...bizAccount, holder: e.target.value })}
                                placeholder="예: 소담김밥"
                                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                        </div>

                        {message && (
                            <div className={`text-sm font-medium p-3 rounded-lg ${message.includes('오류') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                {message}
                            </div>
                        )}

                        <button
                            onClick={handleSaveBizAccount}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Save size={18} />
                            {saving ? '저장 중...' : '저장'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
