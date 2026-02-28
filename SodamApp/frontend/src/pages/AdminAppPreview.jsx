import { useState } from 'react';
import { Monitor, ExternalLink, RefreshCw, Smartphone, Tablet, Shield, Globe } from 'lucide-react';
import './AdminAppPreview.css';

const ADMIN_APP_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || 5173}`
    : window.location.origin;

const DEVICE_PRESETS = [
    { id: 'phone', label: '스마트폰', icon: Smartphone, width: 390, height: 844 },
    { id: 'tablet', label: '태블릿', icon: Tablet, width: 768, height: 1024 },
    { id: 'desktop', label: '데스크톱', icon: Monitor, width: '100%', height: '100%' },
];

export default function AdminAppPreview() {
    const [device, setDevice] = useState('desktop');
    const [iframeKey, setIframeKey] = useState(0);
    const [currentPath, setCurrentPath] = useState('/dashboard');

    const currentDevice = DEVICE_PRESETS.find(d => d.id === device);

    const handleRefresh = () => setIframeKey(prev => prev + 1);
    const handleOpenExternal = () => window.open(`${ADMIN_APP_URL}${currentPath}`, '_blank');

    const iframeSrc = `${ADMIN_APP_URL}${currentPath}?_preview=1&_t=${iframeKey}`;

    // Quick nav pages for admin
    const QUICK_PAGES = [
        { path: '/dashboard', label: '대시보드' },
        { path: '/staff', label: '직원관리' },
        { path: '/finance/profitloss', label: '손익현황' },
        { path: '/revenue', label: '매출관리' },
        { path: '/purchase', label: '매입관리' },
        { path: '/vendor-settings', label: '거래처' },
        { path: '/settings', label: '설정' },
    ];

    return (
        <div className="admin-preview-page">
            {/* Toolbar */}
            <div className="admin-preview-toolbar">
                <div className="admin-toolbar-left">
                    <Shield size={20} className="toolbar-icon" />
                    <h1>관리자 앱 모니터</h1>
                    <span className="admin-badge">ADMIN</span>
                </div>
                <div className="admin-toolbar-center">
                    {DEVICE_PRESETS.map(preset => {
                        const Icon = preset.icon;
                        return (
                            <button
                                key={preset.id}
                                onClick={() => setDevice(preset.id)}
                                className={`admin-device-btn ${device === preset.id ? 'active' : ''}`}
                                title={preset.label}
                            >
                                <Icon size={16} />
                                <span>{preset.label}</span>
                            </button>
                        );
                    })}
                </div>
                <div className="admin-toolbar-right">
                    <button onClick={handleRefresh} className="admin-tool-btn" title="새로고침">
                        <RefreshCw size={16} />
                    </button>
                    <button onClick={handleOpenExternal} className="admin-tool-btn" title="새 탭에서 열기">
                        <ExternalLink size={16} />
                    </button>
                </div>
            </div>

            {/* URL Bar with quick navigation */}
            <div className="admin-url-bar">
                <Globe size={14} className="url-icon" />
                <span className="url-text">
                    {ADMIN_APP_URL}<span className="url-highlight">{currentPath}</span>
                </span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {QUICK_PAGES.map(page => (
                        <button
                            key={page.path}
                            onClick={() => { setCurrentPath(page.path); setIframeKey(k => k + 1); }}
                            style={{
                                padding: '3px 10px',
                                fontSize: 11,
                                fontWeight: currentPath === page.path ? 700 : 500,
                                border: 'none',
                                borderRadius: 6,
                                background: currentPath === page.path ? 'rgba(124,58,237,0.25)' : 'transparent',
                                color: currentPath === page.path ? '#c4b5fd' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {page.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview Area */}
            <div className="admin-preview-area">
                {device === 'desktop' ? (
                    <div className="admin-desktop-frame">
                        <iframe
                            key={iframeKey}
                            src={iframeSrc}
                            title="관리자 앱"
                            className="admin-desktop-iframe"
                        />
                    </div>
                ) : (
                    <div className="admin-phone-frame" style={{
                        width: currentDevice.width,
                        height: currentDevice.height,
                    }}>
                        {/* Notch */}
                        {device === 'phone' && <div className="admin-phone-notch" />}
                        {/* Status bar */}
                        <div className="admin-phone-statusbar">
                            <span className="admin-status-time">
                                {new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                            <div className="admin-status-icons">
                                <span>📶</span>
                                <span>🔋</span>
                            </div>
                        </div>
                        {/* App content */}
                        <iframe
                            key={iframeKey}
                            src={iframeSrc}
                            title="관리자 앱"
                            className="admin-phone-iframe"
                        />
                        {/* Home indicator */}
                        {device === 'phone' && <div className="admin-phone-home-indicator" />}
                    </div>
                )}
            </div>
        </div>
    );
}
