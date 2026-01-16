import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  prefix?: string;
  suffix?: string;
  variant?: 'default' | 'purple' | 'gold' | 'success' | 'warning';
  className?: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  icon,
  label,
  value,
  trend,
  trendValue,
  prefix = '',
  suffix = '',
  variant = 'default',
  className = '',
  delay = 0,
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(value) || 0;

  useEffect(() => {
    const duration = 1000;
    const steps = 60;
    const increment = numericValue / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericValue) {
        setDisplayValue(numericValue);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [numericValue]);

  const variantStyles = {
    default: 'bg-gradient-purple text-primary-700',
    purple: 'bg-gradient-purple text-primary-700',
    gold: 'bg-gradient-gold text-gold-600',
    success: 'bg-gradient-to-br from-success-500/20 to-success-600/10 text-success-500',
    warning: 'bg-gradient-to-br from-warning-500/20 to-warning-600/10 text-warning-500',
  };

  const trendStyles = {
    up: 'text-success-500',
    down: 'text-danger-500',
    neutral: 'text-gray-400',
  };

  const trendIcons = {
    up: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
    ),
    down: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    ),
    neutral: null,
  };

  const formatValue = (val: number) => {
    if (numericValue >= 1000000) {
      return (val / 1000000).toFixed(1) + 'M';
    } else if (numericValue >= 1000) {
      return (val / 1000).toFixed(1) + 'K';
    }
    return typeof value === 'number' ? val.toFixed(0) : val;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className={`
        glass-card
        backdrop-blur-xl
        bg-white/5
        border
        border-primary-700/20
        rounded-xl
        p-6
        hover:scale-105
        transition-all
        duration-200
        hover:shadow-glow
        hover:border-gold-600/30
        ${className}
      `}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${variantStyles[variant]}`}>
              {icon}
            </div>
            <p className="text-sm text-gray-400 font-medium">{label}</p>
          </div>

          <div className="flex items-baseline gap-2 mt-4">
            {prefix && <span className="text-gray-400">{prefix}</span>}
            <h3 className="text-3xl font-bold text-white">
              {typeof value === 'number'
                ? formatValue(displayValue)
                : prefix + formatValue(displayValue) + suffix
              }
            </h3>
            {suffix && <span className="text-gray-400">{suffix}</span>}
          </div>

          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trendStyles[trend]}`}>
              {trendIcons[trend]}
              <span className="font-medium">{trendValue}</span>
              <span className="text-gray-400 ml-1">vs last month</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
