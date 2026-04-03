import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

const TOAST_STYLES = {
  success: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800', icon: Check, iconBg: 'bg-emerald-500' },
  error:   { bg: 'bg-red-50 border-red-200',     text: 'text-red-800',     icon: AlertCircle, iconBg: 'bg-red-500' },
  info:    { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-800',    icon: Info, iconBg: 'bg-blue-500' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((msg, type = 'success', duration = 3500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}

      {/* Toast Container */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 380 }}>
          {toasts.map((toast) => {
            const s = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
            const Icon = s.icon;
            return (
              <div
                key={toast.id}
                className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-[slideIn_0.3s_ease-out] ${s.bg}`}
              >
                <div className={`w-6 h-6 rounded-full ${s.iconBg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-3.5 h-3.5 text-white" />
                </div>
                <p className={`text-sm font-medium flex-1 ${s.text}`}>{toast.msg}</p>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="shrink-0 p-0.5 rounded-md hover:bg-black/5 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(100px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export default function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
