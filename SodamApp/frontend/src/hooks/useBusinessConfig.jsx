import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';

const BusinessConfigContext = createContext({
  employeeScale: 'over5', // "under5" | "over5"
  isSimpleMode: false,    // 5인 미만 간편 모드
  businessType: '',
  loading: true,
  refresh: () => {},
  updateScale: async () => {},
});

export function BusinessConfigProvider({ children }) {
  const [config, setConfig] = useState({
    employeeScale: 'over5',
    businessType: '',
    loading: true,
  });

  const fetchConfig = useCallback(async () => {
    const bid = localStorage.getItem('business_id');
    if (!bid) {
      setConfig(prev => ({ ...prev, loading: false }));
      return;
    }
    try {
      const res = await api.get(`/api/auth/business-info?bid=${bid}`);
      setConfig({
        employeeScale: res.data.employee_scale || 'over5',
        businessType: res.data.business_type || '',
        loading: false,
      });
    } catch {
      setConfig(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateScale = useCallback(async (scale) => {
    try {
      await api.put('/api/auth/business-settings', { employee_scale: scale });
      setConfig(prev => ({ ...prev, employeeScale: scale }));
      return true;
    } catch (err) {
      console.error('Failed to update scale', err);
      return false;
    }
  }, []);

  const value = {
    employeeScale: config.employeeScale,
    isSimpleMode: config.employeeScale === 'under5',
    businessType: config.businessType,
    loading: config.loading,
    refresh: fetchConfig,
    updateScale,
  };

  return (
    <BusinessConfigContext.Provider value={value}>
      {children}
    </BusinessConfigContext.Provider>
  );
}

export function useBusinessConfig() {
  return useContext(BusinessConfigContext);
}

/**
 * 5인 미만 / 5인 이상 기능 차이 매핑
 *
 * 5인 미만 (간편모드) 숨김 항목:
 * - 연차/휴가 관리 탭 (법적 유급휴가 의무 없음)
 * - 근로시간 모니터링 (연장근로 규제 미적용)
 * - HR 대시보드의 일부 알림 (취업규칙 미적용)
 *
 * 5인 미만에서도 유지:
 * - 기본정보, 근태, 급여, 퇴직금, 계약, 교육, 서류, 변경이력
 * - 퇴직금은 1년 이상 근무 시 의무
 */
export const SCALE_FEATURES = {
  // StaffDetail 탭 표시 여부
  tabs: {
    basic: { under5: true, over5: true },
    attendance: { under5: true, over5: true },
    leave: { under5: false, over5: true },      // 연차관리: 5인 이상만
    payroll: { under5: true, over5: true },
    retirement: { under5: true, over5: true },
    contract: { under5: true, over5: true },
    training: { under5: false, over5: true },    // 법정교육: 5인 이상만
    document: { under5: true, over5: true },
    changelog: { under5: true, over5: true },
  },
  // 사이드바 HR 서브메뉴
  hrMenu: {
    'hr-dashboard': { under5: true, over5: true },
    'employees': { under5: true, over5: true },
    'retirement': { under5: true, over5: true },
    'foreign-worker': { under5: true, over5: true },
  },
  // 기능 플래그
  features: {
    overtimeAlert: { under5: false, over5: true },
    annualLeaveCalc: { under5: false, over5: true },
    workRules: { under5: false, over5: true },
    mandatoryTraining: { under5: false, over5: true },
  },
};

export function isFeatureEnabled(featureKey, scale) {
  const parts = featureKey.split('.');
  let ref = SCALE_FEATURES;
  for (const p of parts) {
    ref = ref?.[p];
  }
  return ref?.[scale] ?? true;
}

/**
 * 사업장 규모(employee_scale) 기반 라우팅 가드.
 *
 * 사용 예:
 *   <Route path="/hr/leave" element={
 *     <ProtectedRoute adminOnly>
 *       <ScaleProtectedRoute feature="tabs.leave" redirectTo="/hr/dashboard">
 *         <LeavePage />
 *       </ScaleProtectedRoute>
 *     </ProtectedRoute>
 *   } />
 *
 * - feature: SCALE_FEATURES의 경로 (예: 'tabs.leave', 'features.overtimeAlert')
 * - requireOver5: feature 없이 단순히 5인 이상만 허용할 때
 * - redirectTo: 차단 시 이동할 경로 (기본: /hr/dashboard)
 *
 * loading 중에는 children을 보류하여 깜빡임 방지.
 */
export function ScaleProtectedRoute({ children, feature, requireOver5 = false, redirectTo = '/hr/dashboard' }) {
  const { employeeScale, loading } = useBusinessConfig();
  if (loading) return null;
  const allowed = feature ? isFeatureEnabled(feature, employeeScale) : (!requireOver5 || employeeScale === 'over5');
  if (!allowed) return <Navigate to={redirectTo} replace />;
  return children;
}
