import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, MapPin, Loader2, AlertTriangle } from 'lucide-react';

/**
 * Google Maps 기반 위치 피커 컴포넌트
 * 
 * Props:
 *   latitude, longitude — 현재 좌표
 *   radius — 반경 (미터)
 *   onLocationChange(lat, lng) — 좌표 변경 콜백
 *   apiKey — Google Maps API Key (없으면 fallback UI)
 */
export default function GoogleMapPicker({ latitude = 0, longitude = 0, radius = 100, onLocationChange }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);
    const circleRef = useRef(null);
    const searchInputRef = useRef(null);

    const [sdkLoaded, setSdkLoaded] = useState(false);
    const [sdkError, setSdkError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searching, setSearching] = useState(false);
    const [searchMessage, setSearchMessage] = useState('');

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';

    // --- Dynamic SDK Loading ---
    useEffect(() => {
        if (!apiKey) {
            setSdkError('Google Maps API 키가 설정되지 않았습니다.');
            return;
        }

        // Already loaded
        if (window.google?.maps) {
            setSdkLoaded(true);
            return;
        }

        // Check if script is already being loaded
        if (document.querySelector('script[src*="maps.googleapis.com"]')) {
            const waitForLoad = setInterval(() => {
                if (window.google?.maps) {
                    setSdkLoaded(true);
                    clearInterval(waitForLoad);
                }
            }, 200);
            return () => clearInterval(waitForLoad);
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ko`;
        script.async = true;
        script.defer = true;

        script.onload = () => {
            if (window.google?.maps) {
                setSdkLoaded(true);
            }
        };
        script.onerror = () => {
            setSdkError('Google Maps SDK를 불러오지 못했습니다. API 키를 확인하세요.');
        };

        document.head.appendChild(script);
    }, [apiKey]);

    // --- Initialize Map ---
    useEffect(() => {
        if (!sdkLoaded || !mapRef.current) return;

        const google = window.google;
        const center = (latitude !== 0 || longitude !== 0)
            ? { lat: latitude, lng: longitude }
            : { lat: 37.5665, lng: 126.9780 }; // Default: Seoul

        const map = new google.maps.Map(mapRef.current, {
            center,
            zoom: 16,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
                { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
            ],
        });

        // Marker
        const marker = new google.maps.Marker({
            position: center,
            map,
            draggable: true,
            animation: google.maps.Animation.DROP,
            title: '매장 위치',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
            },
        });

        // Radius Circle
        const circle = new google.maps.Circle({
            map,
            center,
            radius: radius,
            fillColor: '#10b981',
            fillOpacity: 0.12,
            strokeColor: '#10b981',
            strokeWeight: 2,
            strokeOpacity: 0.5,
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;
        circleRef.current = circle;

        // Click on map → move marker
        map.addListener('click', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            marker.setPosition(e.latLng);
            circle.setCenter(e.latLng);
            onLocationChange?.(lat, lng);
        });

        // Drag marker → update
        marker.addListener('dragend', (e) => {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            circle.setCenter(e.latLng);
            map.panTo(e.latLng);
            onLocationChange?.(lat, lng);
        });

        return () => {
            google.maps.event.clearInstanceListeners(map);
            google.maps.event.clearInstanceListeners(marker);
        };
    }, [sdkLoaded]);

    // --- Sync marker when lat/lng/radius change externally ---
    useEffect(() => {
        if (!markerRef.current || !circleRef.current || !mapInstanceRef.current) return;
        if (latitude === 0 && longitude === 0) return;

        const pos = new window.google.maps.LatLng(latitude, longitude);
        markerRef.current.setPosition(pos);
        circleRef.current.setCenter(pos);
        mapInstanceRef.current.panTo(pos);
    }, [latitude, longitude]);

    useEffect(() => {
        if (circleRef.current) {
            circleRef.current.setRadius(radius);
        }
    }, [radius]);

    // --- Address Search (Geocoding) ---
    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim() || !sdkLoaded) return;

        setSearching(true);
        setSearchMessage('');

        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: searchQuery }, (results, status) => {
            setSearching(false);
            if (status === 'OK' && results[0]) {
                const loc = results[0].geometry.location;
                const lat = loc.lat();
                const lng = loc.lng();

                markerRef.current?.setPosition(loc);
                circleRef.current?.setCenter(loc);
                mapInstanceRef.current?.panTo(loc);
                mapInstanceRef.current?.setZoom(17);

                onLocationChange?.(lat, lng);
                setSearchMessage(`📍 ${results[0].formatted_address}`);
            } else {
                setSearchMessage('검색 결과가 없습니다. 다른 주소를 입력해보세요.');
            }
        });
    }, [searchQuery, sdkLoaded, onLocationChange]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    };

    // --- Fallback: No API Key ---
    if (sdkError || !apiKey) {
        return (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
                <p className="text-sm font-bold text-slate-700 mb-1">Google Maps를 사용할 수 없습니다</p>
                <p className="text-xs text-slate-500 mb-4">
                    {sdkError || '.env 파일에 VITE_GOOGLE_MAPS_KEY를 설정해주세요.'}
                </p>
                <div className="bg-white border border-slate-200 rounded-lg p-3 text-left">
                    <code className="text-xs text-slate-600 block">
                        # frontend/.env<br />
                        VITE_GOOGLE_MAPS_KEY=AIzaSy...발급받은키
                    </code>
                </div>
            </div>
        );
    }

    // --- Loading State ---
    if (!sdkLoaded) {
        return (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-12 text-center">
                <Loader2 className="mx-auto text-blue-500 animate-spin mb-3" size={32} />
                <p className="text-sm text-slate-600">Google Maps를 불러오는 중...</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Search Bar */}
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="주소 또는 장소명 검색 (예: 소담김밥, 강남역)"
                        className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={searching || !searchQuery.trim()}
                    className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                    {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                    검색
                </button>
            </div>

            {searchMessage && (
                <p className={`text-xs px-2 ${searchMessage.includes('없습니다') ? 'text-red-500' : 'text-emerald-600'}`}>
                    {searchMessage}
                </p>
            )}

            {/* Map Container */}
            <div
                ref={mapRef}
                className="w-full rounded-xl border border-slate-200 overflow-hidden shadow-sm"
                style={{ height: '400px' }}
            />

            {/* Hint */}
            <p className="text-xs text-slate-400 text-center">
                🖱️ 지도를 클릭하거나 마커를 드래그하여 매장 위치를 설정하세요. 초록색 원이 허용 반경입니다.
            </p>
        </div>
    );
}
