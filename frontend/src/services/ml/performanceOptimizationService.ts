/**
 * Performance Optimization & Battery Management Service
 *
 * Advanced service that monitors system performance, manages battery usage,
  * and optimizes resource consumption for the predictive notification system.
 */

import { behaviorTrackingService } from './behaviorTrackingService';
import { smartCacheService } from './smartCacheService';

// Performance monitoring configuration
export interface PerformanceConfig {
  batteryOptimizationEnabled: boolean;
  adaptiveQualityEnabled: boolean;
  backgroundProcessingEnabled: boolean;
  performanceMonitoringEnabled: boolean;
  batteryThresholds: {
    low: number; // 0-1
    critical: number; // 0-1
  };
  performanceThresholds: {
    maxLoadTime: number; // ms
    maxMemoryUsage: number; // MB
    maxCPUUsage: number; // percentage
  };
  adaptiveSettings: {
    reducedQualityThreshold: number; // battery level
    highPerformanceThreshold: number; // battery level
  };
}

// System metrics
export interface SystemMetrics {
  battery: {
    level: number; // 0-1
    charging: boolean;
  };
  memory: {
    used: number; // MB
    total: number; // MB
    percentage: number; // 0-100
  };
  performance: {
    loadTime: number; // ms
    fps: number;
    cpuUsage: number; // percentage
  };
  network: {
    online: boolean;
    type: 'wifi' | 'cellular' | 'bluetooth' | 'ethernet' | 'unknown';
    speed: 'slow' | 'fast';
    rtt: number; // round-trip time in ms
  };
  device: {
    cores: number;
    memory: number; // GB
    type: 'mobile' | 'desktop' | 'tablet';
  };
}

// Performance recommendations
export interface PerformanceRecommendation {
  type: 'battery' | 'memory' | 'cpu' | 'network';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  action: string;
  autoFix: boolean;
}

// Optimization strategies
export interface OptimizationStrategy {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  impact: 'low' | 'medium' | 'high';
  batterySaving: number; // 0-1, estimated battery saving
  performanceImpact: number; // 0-1, performance impact (negative = better performance)
}

export class PerformanceOptimizationService {
  private config: PerformanceConfig = {
    batteryOptimizationEnabled: true,
    adaptiveQualityEnabled: true,
    backgroundProcessingEnabled: true,
    performanceMonitoringEnabled: true,
    batteryThresholds: {
      low: 0.2,
      critical: 0.1,
    },
    performanceThresholds: {
      maxLoadTime: 200,
      maxMemoryUsage: 100,
      maxCPUUsage: 80,
    },
    adaptiveSettings: {
      reducedQualityThreshold: 0.3,
      highPerformanceThreshold: 0.8,
    },
  };

  private metrics: SystemMetrics;
  private recommendations: PerformanceRecommendation[] = [];
  private strategies: Map<string, OptimizationStrategy> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private batteryCheckInterval: NodeJS.Timeout | null = null;
  private performanceCallbacks: ((metrics: SystemMetrics) => void)[] = [];

  // Performance tracking for 80% improvement validation
  private baselineMetrics: {
    averageLoadTime: number;
    cacheHitRate: number;
    predictionAccuracy: number;
  } | null = null;

  private performanceHistory: Array<{
    timestamp: number;
    loadTime: number;
    cacheHitRate: number;
    predictionAccuracy: number;
    networkLatency: number;
  }> = [];

  private abTestGroup: 'control' | 'treatment' | null = null;

  constructor(config?: Partial<PerformanceConfig>) {
    this.config = { ...this.config, ...config };
    this.metrics = this.initializeMetrics();
    this.initializeStrategies();
    this.initializePerformanceTracking();
    this.startMonitoring();

    // Listen for visibility changes
    this.setupVisibilityTracking();
  }

  /**
   * Get current system metrics
   */
  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  /**
   * Get performance recommendations
   */
  getRecommendations(): PerformanceRecommendation[] {
    return [...this.recommendations];
  }

  /**
   * Get optimization strategies
   */
  getStrategies(): OptimizationStrategy[] {
    return Array.from(this.strategies.values());
  }

  /**
   * Enable/disable optimization strategy
   */
  async enableStrategy(strategyId: string, enabled: boolean): Promise<void> {
    const strategy = this.strategies.get(strategyId);
    if (strategy) {
      strategy.enabled = enabled;
      await this.applyStrategy(strategy);
    }
  }

  /**
   * Optimize performance based on current metrics
   */
  async optimizePerformance(): Promise<{
    improvements: string[];
    metricsBefore: SystemMetrics;
    metricsAfter: SystemMetrics;
  }> {
    const metricsBefore = { ...this.metrics };
    const improvements: string[] = [];

    // Battery optimization
    if (this.config.batteryOptimizationEnabled && this.metrics.battery.level < this.config.batteryThresholds.low) {
      await this.optimizeForBattery();
      improvements.push('Applied battery optimization settings');
    }

    // Memory optimization
    if (this.metrics.memory.percentage > 80) {
      await this.optimizeMemory();
      improvements.push('Optimized memory usage');
    }

    // Performance optimization
    if (this.metrics.performance.loadTime > this.config.performanceThresholds.maxLoadTime) {
      await this.optimizeForPerformance();
      improvements.push('Optimized for faster performance');
    }

    // Network optimization
    if (!this.metrics.network.online || this.metrics.network.speed === 'slow') {
      await this.optimizeForNetwork();
      improvements.push('Optimized for current network conditions');
    }

    // Update metrics after optimization
    await this.updateMetrics();
    const metricsAfter = { ...this.metrics };

    return {
      improvements,
      metricsBefore,
      metricsAfter,
    };
  }

  /**
   * Check if optimization is recommended
   */
  shouldOptimize(): {
    recommended: boolean;
    reasons: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  } {
    const reasons: string[] = [];

    // Battery checks
    if (this.metrics.battery.level < this.config.batteryThresholds.critical) {
      reasons.push('Critical battery level');
    } else if (this.metrics.battery.level < this.config.batteryThresholds.low) {
      reasons.push('Low battery level');
    }

    // Memory checks
    if (this.metrics.memory.percentage > 90) {
      reasons.push('High memory usage');
    }

    // Performance checks
    if (this.metrics.performance.loadTime > this.config.performanceThresholds.maxLoadTime * 2) {
      reasons.push('Poor load performance');
    }

    // Network checks
    if (!this.metrics.network.online) {
      reasons.push('Offline mode');
    }

    // Determine priority
    let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (reasons.includes('Critical battery level') || this.metrics.memory.percentage > 95) {
      priority = 'critical';
    } else if (reasons.includes('Low battery level') || this.metrics.memory.percentage > 85) {
      priority = 'high';
    } else if (reasons.length > 0) {
      priority = 'medium';
    }

    return {
      recommended: reasons.length > 0,
      reasons,
      priority,
    };
  }

  /**
   * Add performance monitoring callback
   */
  onPerformanceUpdate(callback: (metrics: SystemMetrics) => void): void {
    this.performanceCallbacks.push(callback);
  }

  /**
   * Remove performance monitoring callback
   */
  removePerformanceCallback(callback: (metrics: SystemMetrics) => void): void {
    const index = this.performanceCallbacks.indexOf(callback);
    if (index > -1) {
      this.performanceCallbacks.splice(index, 1);
    }
  }

  /**
   * Get adaptive settings based on current conditions
   */
  getAdaptiveSettings(): {
    qualityLevel: 'low' | 'medium' | 'high';
    backgroundProcessing: boolean;
    predictiveFeatures: boolean;
    refreshInterval: number; // seconds
    maxCacheSize: number; // MB
  } {
    const {battery, performance, network} = this.metrics;

    let qualityLevel: 'low' | 'medium' | 'high' = 'high';
    let backgroundProcessing = true;
    let predictiveFeatures = true;
    let refreshInterval = 30; // seconds
    let maxCacheSize = 50; // MB

    // Battery-based adjustments
    if (battery.level < this.config.batteryThresholds.critical) {
      qualityLevel = 'low';
      backgroundProcessing = false;
      predictiveFeatures = false;
      refreshInterval = 300; // 5 minutes
      maxCacheSize = 10;
    } else if (battery.level < this.config.batteryThresholds.low) {
      qualityLevel = 'medium';
      backgroundProcessing = true;
      predictiveFeatures = true;
      refreshInterval = 120; // 2 minutes
      maxCacheSize = 25;
    }

    // Performance-based adjustments
    if (performance.loadTime > this.config.performanceThresholds.maxLoadTime * 1.5) {
      qualityLevel = 'medium';
      refreshInterval = Math.max(refreshInterval, 60);
    }

    // Network-based adjustments
    if (!network.online) {
      backgroundProcessing = false;
      refreshInterval = 600; // 10 minutes
    } else if (network.speed === 'slow') {
      qualityLevel = qualityLevel === 'high' ? 'medium' : qualityLevel;
      refreshInterval = Math.max(refreshInterval, 120);
      maxCacheSize = Math.max(maxCacheSize, 30);
    }

    return {
      qualityLevel,
      backgroundProcessing,
      predictiveFeatures,
      refreshInterval,
      maxCacheSize,
    };
  }

  // Private methods

  private initializeMetrics(): SystemMetrics {
    return {
      battery: {
        level: 1.0,
        charging: false,
      },
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      performance: {
        loadTime: 0,
        fps: 60,
        cpuUsage: 0,
      },
      network: {
        online: navigator.onLine,
        type: 'unknown',
        speed: 'fast',
        rtt: 0,
      },
      device: {
        cores: navigator.hardwareConcurrency || 4,
        memory: this.estimateDeviceMemory(),
        type: this.getDeviceType(),
      },
    };
  }

  private initializeStrategies(): void {
    // Battery saving strategies
    this.strategies.set('reducedRefreshRate', {
      id: 'reducedRefreshRate',
      name: 'Reduced Refresh Rate',
      description: 'Increase notification refresh interval to save battery',
      enabled: false,
      impact: 'high',
      batterySaving: 0.3,
      performanceImpact: -0.2,
    });

    this.strategies.set('disableAnimations', {
      id: 'disableAnimations',
      name: 'Disable Animations',
      description: 'Disable UI animations to reduce CPU usage',
      enabled: false,
      impact: 'medium',
      batterySaving: 0.2,
      performanceImpact: -0.3,
    });

    this.strategies.set('lowerCacheSize', {
      id: 'lowerCacheSize',
      name: 'Reduce Cache Size',
      description: 'Limit cache size to reduce memory usage',
      enabled: false,
      impact: 'medium',
      batterySaving: 0.1,
      performanceImpact: 0.1,
    });

    this.strategies.set('backgroundSync', {
      id: 'backgroundSync',
      name: 'Background Sync Only',
      description: 'Only sync notifications when device is charging',
      enabled: false,
      impact: 'high',
      batterySaving: 0.4,
      performanceImpact: 0.2,
    });

    // Performance strategies
    this.strategies.set('preemptiveCaching', {
      id: 'preemptiveCaching',
      name: 'Preemptive Caching',
      description: 'Aggressively cache likely-to-be-accessed notifications',
      enabled: true,
      impact: 'high',
      batterySaving: -0.2,
      performanceImpact: -0.5,
    });

    this.strategies.set('predictivePreloading', {
      id: 'predictivePreloading',
      name: 'Predictive Preloading',
      description: 'Use ML to predict and preload notifications',
      enabled: true,
      impact: 'high',
      batterySaving: -0.1,
      performanceImpact: -0.4,
    });
  }

  private startMonitoring(): void {
    // Start performance monitoring
    if (this.config.performanceMonitoringEnabled) {
      this.monitoringInterval = setInterval(() => {
        this.updateMetrics();
        this.analyzePerformance();
        this.notifyCallbacks();
      }, 5000); // Every 5 seconds
    }

    // Start battery monitoring
    if (this.config.batteryOptimizationEnabled) {
      this.batteryCheckInterval = setInterval(() => {
        this.updateBatteryStatus();
        this.checkBatteryThresholds();
      }, 10000); // Every 10 seconds

      // Initial battery check
      this.updateBatteryStatus();
    }
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pauseResourceIntensiveTasks();
      } else {
        this.resumeResourceIntensiveTasks();
      }
    });

    // Monitor network status
    window.addEventListener('online', () => {
      this.metrics.network.online = true;
      this.checkNetworkPerformance();
    });

    window.addEventListener('offline', () => {
      this.metrics.network.online = false;
      this.optimizeForNetwork();
    });
  }

  private async updateMetrics(): Promise<void> {
    // Update memory usage
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      this.metrics.memory = {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }

    // Update network status
    this.metrics.network.online = navigator.onLine;
    await this.checkNetworkPerformance();
  }

  private async updateBatteryStatus(): Promise<void> {
    if ('getBattery' in navigator) {
      try {
        const battery = await (navigator as any).getBattery();
        this.metrics.battery = {
          level: battery.level,
          charging: battery.charging,
        };
      } catch (error) {
        console.warn('Failed to get battery status:', error);
      }
    }
  }

  private async checkNetworkPerformance(): Promise<void> {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      this.metrics.network.type = connection.type || 'unknown';
      this.metrics.network.speed = connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' ? 'slow' : 'fast';
      this.metrics.network.rtt = connection.rtt || 0;
    }
  }

  private analyzePerformance(): void {
    this.recommendations = [];

    // Battery recommendations
    if (this.metrics.battery.level < this.config.batteryThresholds.critical) {
      this.recommendations.push({
        type: 'battery',
        severity: 'critical',
        message: 'Critical battery level detected',
        action: 'Enable battery saving mode',
        autoFix: true,
      });
    } else if (this.metrics.battery.level < this.config.batteryThresholds.low) {
      this.recommendations.push({
        type: 'battery',
        severity: 'medium',
        message: 'Low battery level',
        action: 'Consider reducing background activity',
        autoFix: false,
      });
    }

    // Memory recommendations
    if (this.metrics.memory.percentage > 85) {
      this.recommendations.push({
        type: 'memory',
        severity: 'high',
        message: 'High memory usage',
        action: 'Clear cache and reduce data retention',
        autoFix: true,
      });
    }

    // Performance recommendations
    if (this.metrics.performance.loadTime > this.config.performanceThresholds.maxLoadTime) {
      this.recommendations.push({
        type: 'cpu',
        severity: 'medium',
        message: 'Slow performance detected',
        action: 'Optimize rendering and reduce animations',
        autoFix: true,
      });
    }

    // Network recommendations
    if (!this.metrics.network.online) {
      this.recommendations.push({
        type: 'network',
        severity: 'medium',
        message: 'Offline mode',
        action: 'Enable offline mode with cached data',
        autoFix: false,
      });
    }
  }

  private checkBatteryThresholds(): void {
    const {level} = this.metrics.battery;

    if (level < this.config.batteryThresholds.critical) {
      this.enableCriticalBatteryMode();
    } else if (level < this.config.batteryThresholds.low) {
      this.enableBatterySavingMode();
    }
  }

  private async enableCriticalBatteryMode(): Promise<void> {
    console.log('Enabling critical battery mode');

    // Disable all resource-intensive strategies
    for (const [id, strategy] of this.strategies) {
      if (strategy.batterySaving > 0) {
        strategy.enabled = true;
        await this.applyStrategy(strategy);
      }
    }

    // Reduce performance quality
    document.documentElement.style.setProperty('--animation-duration', '0s');
  }

  private async enableBatterySavingMode(): Promise<void> {
    console.log('Enabling battery saving mode');

    // Enable moderate battery saving strategies
    const batterySavingStrategies = Array.from(this.strategies.values())
      .filter(s => s.batterySaving > 0.2 && s.batterySaving < 0.4);

    for (const strategy of batterySavingStrategies) {
      strategy.enabled = true;
      await this.applyStrategy(strategy);
    }
  }

  private async optimizeForBattery(): Promise<void> {
    const strategies = Array.from(this.strategies.values())
      .filter(s => s.batterySaving > 0 && !s.enabled);

    for (const strategy of strategies) {
      strategy.enabled = true;
      await this.applyStrategy(strategy);
    }
  }

  private async optimizeMemory(): Promise<void> {
    try {
      // Clear cache
      await smartCacheService.clearCache();

      // Clean up behavior tracking data using public method
      behaviorTrackingService.runCleanup();

      // Force garbage collection if available
      if ('gc' in window) {
        (window as any).gc();
      }
    } catch (error) {
      console.warn('Memory optimization failed:', error);
      // Continue with other optimizations even if cleanup fails
    }
  }

  private async optimizeForPerformance(): Promise<void> {
    // Enable performance improving strategies
    const performanceStrategies = Array.from(this.strategies.values())
      .filter(s => s.performanceImpact < 0);

    for (const strategy of performanceStrategies) {
      strategy.enabled = true;
      await this.applyStrategy(strategy);
    }
  }

  private async optimizeForNetwork(): Promise<void> {
    // Enable offline mode strategies
    const networkStrategies = Array.from(this.strategies.values())
      .filter(s => s.id === 'lowerCacheSize');

    for (const strategy of networkStrategies) {
      strategy.enabled = true;
      await this.applyStrategy(strategy);
    }
  }

  private async applyStrategy(strategy: OptimizationStrategy): Promise<void> {
    switch (strategy.id) {
      case 'reducedRefreshRate':
        // Implementation would update refresh intervals
        console.log('Applied reduced refresh rate strategy');
        break;

      case 'disableAnimations':
        document.documentElement.style.setProperty('--animation-duration', strategy.enabled ? '0s' : '');
        break;

      case 'lowerCacheSize':
        // Implementation would reduce cache size
        console.log('Applied reduced cache size strategy');
        break;

      case 'backgroundSync':
        // Implementation would enable background sync only when charging
        console.log('Applied background sync strategy');
        break;

      case 'preemptiveCaching':
        // Implementation would enable preemptive caching
        console.log('Applied preemptive caching strategy');
        break;

      case 'predictivePreloading':
        // Implementation would enable predictive preloading
        console.log('Applied predictive preloading strategy');
        break;
    }
  }

  private pauseResourceIntensiveTasks(): void {
    console.log('Pausing resource-intensive tasks due to hidden page');
    // Implementation would pause ML training, background sync, etc.
  }

  private resumeResourceIntensiveTasks(): void {
    console.log('Resuming resource-intensive tasks');
    // Implementation would resume paused tasks
  }

  private notifyCallbacks(): void {
    this.performanceCallbacks.forEach(callback => {
      try {
        callback(this.metrics);
      } catch (error) {
        console.error('Performance callback error:', error);
      }
    });
  }

  private estimateDeviceMemory(): number {
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory;
    }
    // Fallback estimation based on device type
    const deviceType = this.getDeviceType();
    switch (deviceType) {
      case 'mobile': return 4;
      case 'tablet': return 8;
      case 'desktop': return 16;
      default: return 8;
    }
  }

  private getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private initializePerformanceTracking(): void {
    // Assign A/B test group (50/50 split)
    this.abTestGroup = Math.random() < 0.5 ? 'control' : 'treatment';

    console.log(`[Performance] Assigned to ${this.abTestGroup} group`);

    // Start periodic performance reporting
    setInterval(() => {
      this.reportPerformanceMetrics();
    }, 60000); // Every minute
  }

  private reportPerformanceMetrics(): void {
    if (process.env.NODE_ENV === 'development') {
      const analysis = this.getPerformanceImprovementAnalysis();
      if (analysis.overallImprovement !== null) {
        console.log(`[Performance Metrics] Improvement: ${analysis.overallImprovement.toFixed(1)}%`);
        console.log(`[Performance Metrics] Target Met: ${analysis.meetsTarget ? 'YES' : 'NO'}`);
      }
    }

    // Send metrics to backend periodically
    this.sendMetricsToBackend();
  }

  /**
   * Send performance metrics to backend for analysis
   */
  private async sendMetricsToBackend(): Promise<void> {
    try {
      // Only send if we have meaningful data
      if (this.performanceHistory.length < 10) {
        return;
      }

      const performanceData = this.exportPerformanceData();

      // Get auth token (assuming it's stored in localStorage or context)
      const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
      if (!token) {
        return; // Skip if not authenticated
      }

      const response = await fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(performanceData),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[Performance] Metrics sent to backend:', result.id);
      } else {
        console.warn('[Performance] Failed to send metrics to backend:', response.status);
      }
    } catch (error) {
      console.warn('[Performance] Error sending metrics to backend:', error);
      // Don't throw - this is non-critical
    }
  }

  private checkPerformanceThresholds(entry: {
    loadTime: number;
    cacheHitRate: number;
    predictionAccuracy: number;
    networkLatency: number;
  }): void {
    // Check for performance degradation
    if (entry.loadTime > this.config.performanceThresholds.maxLoadTime * 1.5) {
      this.recommendations.push({
        type: 'cpu',
        severity: 'high',
        message: `Performance degradation detected: ${entry.loadTime.toFixed(2)}ms load time`,
        action: 'Optimize ML model and caching strategies',
        autoFix: true,
      });
    }

    if (entry.cacheHitRate < 0.5 && this.performanceHistory.length > 20) {
      this.recommendations.push({
        type: 'memory',
        severity: 'medium',
        message: `Low cache hit rate: ${(entry.cacheHitRate * 100).toFixed(1)}%`,
        action: 'Review caching strategy and increase cache size',
        autoFix: false,
      });
    }

    // Keep only recent recommendations
    this.recommendations = this.recommendations.slice(-5);
  }

  public destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    if (this.batteryCheckInterval) {
      clearInterval(this.batteryCheckInterval);
    }
    this.performanceCallbacks = [];
  }

  /**
   * Record baseline performance metrics for comparison
   */
  recordBaselineMetrics(metrics: {
    averageLoadTime: number;
    cacheHitRate: number;
    predictionAccuracy: number;
  }): void {
    this.baselineMetrics = metrics;
    console.log('[Performance] Baseline metrics recorded:', metrics);
  }

  /**
   * Get performance improvement analysis
   */
  getPerformanceImprovementAnalysis(): {
    loadTimeImprovement: number | null;
    cacheHitRateImprovement: number | null;
    predictionAccuracyImprovement: number | null;
    overallImprovement: number | null;
    meetsTarget: boolean;
  } {
    if (!this.baselineMetrics || this.performanceHistory.length < 10) {
      return {
        loadTimeImprovement: null,
        cacheHitRateImprovement: null,
        predictionAccuracyImprovement: null,
        overallImprovement: null,
        meetsTarget: false,
      };
    }

    // Calculate current averages
    const recentHistory = this.performanceHistory.slice(-50);
    const currentAvgLoadTime = recentHistory.reduce((sum, h) => sum + h.loadTime, 0) / recentHistory.length;
    const currentCacheHitRate = recentHistory.reduce((sum, h) => sum + h.cacheHitRate, 0) / recentHistory.length;
    const currentPredictionAccuracy = recentHistory.reduce((sum, h) => sum + h.predictionAccuracy, 0) / recentHistory.length;

    // Calculate improvements
    const loadTimeImprovement = ((this.baselineMetrics.averageLoadTime - currentAvgLoadTime) / this.baselineMetrics.averageLoadTime) * 100;
    const cacheHitRateImprovement = ((currentCacheHitRate - this.baselineMetrics.cacheHitRate) / this.baselineMetrics.cacheHitRate) * 100;
    const predictionAccuracyImprovement = ((currentPredictionAccuracy - this.baselineMetrics.predictionAccuracy) / this.baselineMetrics.predictionAccuracy) * 100;

    // Overall improvement (weighted average)
    const overallImprovement = (loadTimeImprovement * 0.4 + cacheHitRateImprovement * 0.3 + predictionAccuracyImprovement * 0.3);

    return {
      loadTimeImprovement,
      cacheHitRateImprovement,
      predictionAccuracyImprovement,
      overallImprovement,
      meetsTarget: overallImprovement >= 80,
    };
  }

  /**
   * Get current A/B test group assignment
   */
  getABTestGroup(): 'control' | 'treatment' {
    return this.abTestGroup || 'control';
  }

  /**
   * Check if current session is in treatment group
   */
  isTreatmentGroup(): boolean {
    return this.abTestGroup === 'treatment';
  }

  /**
   * Track notification performance for validation
   */
  trackNotificationPerformance(event: {
    type: 'load' | 'cache_hit' | 'cache_miss' | 'prediction_success' | 'prediction_failure';
    loadTime?: number;
    predictionScore?: number;
    networkLatency?: number;
  }): void {
    const now = Date.now();

    if (event.type === 'load' && event.loadTime) {
      this.metrics.performance.loadTime = event.loadTime;
    }

    // Update performance history
    const cacheStats = smartCacheService.getCacheStats();
    const currentEntry = {
      timestamp: now,
      loadTime: this.metrics.performance.loadTime,
      cacheHitRate: cacheStats.hitRate || 0,
      predictionAccuracy: cacheStats.predictionAccuracy || 0,
      networkLatency: event.networkLatency || this.metrics.network.rtt,
    };

    this.performanceHistory.push(currentEntry);

    // Keep only last 1000 entries
    if (this.performanceHistory.length > 1000) {
      this.performanceHistory = this.performanceHistory.slice(-1000);
    }

    // Alert if performance thresholds are exceeded
    this.checkPerformanceThresholds(currentEntry);
  }

  /**
   * Export performance metrics for analysis
   */
  exportPerformanceData(): {
    baseline: typeof this.baselineMetrics;
    history: typeof this.performanceHistory;
    currentMetrics: SystemMetrics;
    analysis: ReturnType<typeof this.getPerformanceImprovementAnalysis>;
    abTest: {
      group: typeof this.abTestGroup;
      performance: {
        averageLoadTime: number;
        cacheHitRate: number;
        predictionAccuracy: number;
      } | null;
    };
    recommendations: PerformanceRecommendation[];
    generatedAt: string;
  } {
    const groupPerformance = this.performanceHistory.length > 0 ? {
      averageLoadTime: this.performanceHistory.reduce((sum, h) => sum + h.loadTime, 0) / this.performanceHistory.length,
      cacheHitRate: this.performanceHistory.reduce((sum, h) => sum + h.cacheHitRate, 0) / this.performanceHistory.length,
      predictionAccuracy: this.performanceHistory.reduce((sum, h) => sum + h.predictionAccuracy, 0) / this.performanceHistory.length,
    } : null;

    return {
      baseline: this.baselineMetrics,
      history: this.performanceHistory,
      currentMetrics: this.metrics,
      analysis: this.getPerformanceImprovementAnalysis(),
      abTest: {
        group: this.abTestGroup,
        performance: groupPerformance,
      },
      recommendations: this.recommendations,
      generatedAt: new Date().toISOString(),
    };
  }
}

// Singleton instance
export const _performanceOptimizationService = new PerformanceOptimizationService();