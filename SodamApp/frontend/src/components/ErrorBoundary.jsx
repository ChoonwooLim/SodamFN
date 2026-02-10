import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif"
                }}>
                    <div style={{
                        fontSize: '4rem',
                        marginBottom: '1rem'
                    }}>⚠️</div>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: '#1a1a2e',
                        marginBottom: '0.5rem'
                    }}>
                        페이지 오류가 발생했습니다
                    </h2>
                    <p style={{
                        fontSize: '0.95rem',
                        color: '#666',
                        marginBottom: '1.5rem',
                        maxWidth: '400px'
                    }}>
                        일시적인 문제가 발생했습니다.
                        아래 버튼을 눌러 다시 시도해 주세요.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            onClick={this.handleReset}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '8px',
                                border: 'none',
                                backgroundColor: '#4f46e5',
                                color: '#fff',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            다시 시도
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            style={{
                                padding: '0.6rem 1.5rem',
                                borderRadius: '8px',
                                border: '1px solid #ddd',
                                backgroundColor: '#fff',
                                color: '#333',
                                fontSize: '0.9rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                            }}
                        >
                            홈으로
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
