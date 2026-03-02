import { useState } from 'react';
import { Smartphone, ExternalLink, RefreshCw, Monitor, Tablet } from 'lucide-react';
import './StaffAppPreview.css';

const STAFF_APP_URL = import.meta.env.VITE_STAFF_APP_URL
    || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `${window.location.protocol}//${window.location.hostname}:5174`
        : 'https://sodam-staff.pages.dev');

const DEVICE_PRESETS = [
    { id: 'phone', label: '스마트폰', icon: Smartphone, width: 390, height: 844 },
    { id: 'tablet', label: '태블릿', icon: Tablet, width: 768, height: 1024 },
    { id: 'desktop', label: '데스크톱', icon: Monitor, width: '100%', height: '100%' },
];

export default function StaffAppPreview() {
    const [device, setDevice] = useState('phone');
    const [iframeKey, setIframeKey] = useState(0);

    const currentDevice = DEVICE_PRESETS.find(d => d.id === device);

    const handleRefresh = () => setIframeKey(prev => prev + 1);
    const handleOpenExternal = () => window.open(STAFF_APP_URL, '_blank');

    return (
        <div className="staff-preview-page">
            {/* Toolbar */}
            <div className="preview-toolbar">
                <div className="toolbar-left">
                    <Smartphone size={20} className="toolbar-icon" />
                    <h1>직원용 앱 미리보기</h1>
                    <span className="pwa-badge">PWA</span>
                </div>
                <div className="toolbar-center">
                    {DEVICE_PRESETS.map(preset => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => setDevice(preset.id)}
                                className={`device-btn ${device === preset.id ? 'active' : ''}`}
                                title={preset.label}
                            >
                                <Icon size={16} />
                                <span>{preset.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="toolbar-right">
                    <button onClick={handleRefresh} className="tool-btn" title="새로고침">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={handleOpenExternal} className="tool-btn" title="새 탭에서 열기">
                        <ExternalLink size={16} />
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="preview-area">
                {device === 'desktop' ? (
                    <div className="desktop-frame">
                        <iframe
                            key={iframeKey}
                            src={`${STAFF_APP_URL}?_t=${Date.now()}`}
                            title="직원용 앱"
                            className="desktop-iframe"
                            allow="geolocation; notifications"
                        />
                    </div>
                ) : (
                    <div className="phone-frame" style={{
                        width: currentDevice.width,
                        height: currentDevice.height,
                    }}>
                        {/* Notch */}
                        {device === 'phone' && <div className="phone-notch" />}
                        {/* Status bar */}
                        <div className="phone-statusbar">
                            <span className="status-time">
                                {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                            <div className="status-icons">
                                <span>📶</span>
                                <span>🔋</span>
                            </div>
                        </div>
                        {/* App content */}
                        <iframe
                            key={iframeKey}
                            src={`${STAFF_APP_URL}?_t=${Date.now()}`}
                            title="직원용 앱"
                            className="phone-iframe"
                            allow="geolocation; notifications"
                        />
                        {/* Home indicator */}
                        {device === 'phone' && <div className="phone-home-indicator" />}
                    </div>
                )}
            </div>
        </div>
    );
}
