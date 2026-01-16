import React from 'react';

interface TabItem {
  key: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  size = 'medium',
  className = '',
}) => {
  const sizeStyles = {
    small: 'px-3 py-2 text-sm',
    medium: 'px-4 py-3 text-base',
    large: 'px-6 py-4 text-lg',
  };

  return (
    <div className={`tabs-container ${className}`}>
      {/* Tab Headers */}
      <div className="flex items-center gap-2 border-b border-primary-700/20 bg-white/[0.02] rounded-t-lg px-2">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => !item.disabled && onChange(item.key)}
            disabled={item.disabled}
            className={`
              flex
              items-center
              gap-2
              font-medium
              transition-all
              duration-200
              relative
              ${sizeStyles[size]}
              ${
                activeKey === item.key
                  ? 'text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }
              ${
                item.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : 'cursor-pointer hover:bg-primary-700/10 rounded-lg'
              }
            `}
          >
            {item.icon && (
              <span className={activeKey === item.key ? 'text-gold-600' : ''}>
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>

            {/* Active indicator - gold underline */}
            {activeKey === item.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold-600 shadow-glow-gold" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {items.find((item) => item.key === activeKey)?.children}
      </div>
    </div>
  );
};

export default Tabs;
