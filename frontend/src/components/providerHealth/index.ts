// Provider Health Subcomponents
export { default as ProviderHealthCard } from './ProviderHealthCard';
export type { ProviderHealthCardProps, ProviderHealthData } from './ProviderHealthCard';

export { default as SLAMonitor } from './SLAMonitor';
export type {
  SLAMonitorProps,
  SLAData,
  SLAAlert,
  MonthlyDowntime,
  SLATarget,
  SLAActual,
  SLACompliance
} from './SLAMonitor';

export { default as ProviderTestingModal } from './ProviderTestingModal';
export type {
  ProviderTestingModalProps,
  ProviderTest,
  TestConfiguration
} from './ProviderTestingModal';

export { default as PerformanceCharts } from './PerformanceCharts';
export type {
  PerformanceChartsProps,
  PerformanceMetric,
  ProviderComparison,
  GeographicData
} from './PerformanceCharts';

export { default as ProviderTable } from './ProviderTable';
export type { ProviderTableProps, ProviderHealthData as ProviderTableData } from './ProviderTable';

export { default as AlertSystem } from './AlertSystem';
export type {
  AlertSystemProps,
  Alert,
  AlertRule,
  AlertSettings,
  AlertSeverity,
  AlertStatus,
  AlertType
} from './AlertSystem';

// Utility types for common usage
export type {
  ProviderHealthData as BaseProviderData,
} from './ProviderHealthCard';

// Component versions (for future compatibility management)
export const _COMPONENT_VERSIONS = {
  ProviderHealthCard: '1.0.0',
  SLAMonitor: '1.0.0',
  ProviderTestingModal: '1.0.0',
  PerformanceCharts: '1.0.0',
  ProviderTable: '1.0.0',
  AlertSystem: '1.0.0',
} as const;

// Re-export common constants and enums
export { AlertSeverity, AlertStatus, AlertType } from './AlertSystem';