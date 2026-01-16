import React, { useState, useEffect } from 'react';

interface ProgressProps {
  percent: number;
  showInfo?: boolean;
  strokeColor?: string;
  format?: (percent: number) => React.ReactNode;
  className?: string;
  trailColor?: string;
  strokeWidth?: number;
}

const Progress: React.FC<ProgressProps> = ({
  percent,
  showInfo = true,
  strokeColor,
  format,
  className = '',
  trailColor = 'bg-primary-900/30',
  strokeWidth = 8,
}) => {
  const [displayPercent, setDisplayPercent] = useState(0);

  useEffect(() => {
    const duration = 800;
    const steps = 60;
    const increment = percent / steps;
    const stepDuration = duration / steps;

    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= percent) {
        setDisplayPercent(percent);
        clearInterval(timer);
      } else {
        setDisplayPercent(current);
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [percent]);

  const defaultStrokeColor = 'bg-gradient-to-r from-primary-700 to-gold-600';

  const strokeClass = strokeColor || defaultStrokeColor;

  const defaultFormat = (percentNumber: number) => `${Math.round(percentNumber)}%`;

  return (
    <div className={`progress-container ${className}`}>
      <div className="w-full">
        {/* Progress Bar */}
        <div
          className={`w-full ${trailColor} rounded-full overflow-hidden`}
          style={{ height: `${strokeWidth}px` }}
        >
          <div
            className={`
              h-full
              ${strokeClass}
              rounded-full
              transition-all
              duration-700
              ease-out
              relative
              overflow-hidden
            `}
            style={{ width: `${Math.min(displayPercent, 100)}%` }}
          >
            {/* Animated shimmer effect */}
            <div
              className="
                absolute
                top-0
                left-0
                right-0
                bottom-0
                bg-gradient-to-r
                from-transparent
                via-white/20
                to-transparent
                animate-pulse
              "
              style={{
                animation: 'shimmer 2s infinite',
              }}
            />
          </div>
        </div>

        {/* Info/Label */}
        {showInfo && (
          <div className="mt-2 text-sm font-medium text-gray-300">
            {format ? format(displayPercent) : defaultFormat(displayPercent)}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};

export default Progress;
