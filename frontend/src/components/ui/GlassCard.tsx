import React from 'react';

interface GlassCardProps {
  title?: React.ReactNode;
  extra?: React.ReactNode;
  children: React.ReactNode;
  variant?: 'default' | 'gradient' | 'purple' | 'gold';
  hoverable?: boolean;
  className?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({
  title,
  extra,
  children,
  variant = 'default',
  hoverable = false,
  className = '',
}) => {
  const variantStyles = {
    default: 'backdrop-blur-xl bg-white/5 border border-primary-700/20',
    gradient: 'backdrop-blur-xl bg-gradient-to-br from-primary-900/40 to-primary-700/20 border border-primary-600/30',
    purple: 'backdrop-blur-xl bg-gradient-to-br from-purple-900/40 to-purple-700/20 border border-purple-600/30',
    gold: 'backdrop-blur-xl bg-gradient-to-br from-gold-900/40 to-gold-700/20 border border-gold-600/30',
  };

  const hoverStyles = hoverable
    ? 'transition-all duration-200 hover:scale-[1.02] hover:shadow-glow hover:border-gold-600/30 cursor-pointer'
    : '';

  return (
    <div
      className={`
        rounded-xl
        ${variantStyles[variant]}
        ${hoverStyles}
        shadow-glass
        ${className}
      `}
    >
      {(title || extra) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-700/20">
          {title && (
            <div className="text-lg font-semibold text-white">
              {title}
            </div>
          )}
          {extra && <div>{extra}</div>}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
};

export default GlassCard;
