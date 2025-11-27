import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  onToggle?: (isExpanded: boolean) => void;
  variant?: 'default' | 'sidebar' | 'card';
  persistState?: boolean;
  storageKey?: string;
}

export const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultExpanded = true,
  icon,
  badge,
  className = '',
  headerClassName = '',
  contentClassName = '',
  onToggle,
  variant = 'default',
  persistState = false,
  storageKey,
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    if (persistState && storageKey) {
      const savedState = localStorage.getItem(`collapsible_${storageKey}`);
      return savedState !== null ? JSON.parse(savedState) : defaultExpanded;
    }
    return defaultExpanded;
  });

  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (contentRef.current) {
      if (isExpanded) {
        const scrollHeight = contentRef.current.scrollHeight;
        setHeight(scrollHeight);
        setTimeout(() => setHeight('auto'), 300);
      } else {
        setHeight(contentRef.current.scrollHeight);
        setTimeout(() => setHeight(0), 10);
      }
    }
  }, [isExpanded]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);

    if (onToggle) {
      onToggle(newExpanded);
    }

    if (persistState && storageKey) {
      localStorage.setItem(`collapsible_${storageKey}`, JSON.stringify(newExpanded));
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'sidebar':
        return {
          header: `w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 hover:bg-gray-100 ${headerClassName}`,
          headerExpanded: 'bg-gray-50 text-gray-900',
          headerCollapsed: 'text-gray-600 hover:text-gray-900',
          content: 'overflow-hidden transition-all duration-300 ease-in-out',
          contentWrapper: 'px-2 py-1'
        };
      case 'card':
        return {
          header: `w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-t-lg transition-all duration-200 ${headerClassName}`,
          headerExpanded: 'bg-gray-50 border-b-0',
          headerCollapsed: 'hover:bg-gray-50',
          content: 'overflow-hidden transition-all duration-300 ease-in-out bg-white border border-t-0 border-gray-200 rounded-b-lg',
          contentWrapper: 'p-4'
        };
      default:
        return {
          header: `w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg transition-all duration-200 hover:shadow-sm ${headerClassName}`,
          headerExpanded: 'bg-gray-50 shadow-sm',
          headerCollapsed: 'hover:bg-gray-50',
          content: 'overflow-hidden transition-all duration-300 ease-in-out',
          contentWrapper: 'p-4'
        };
    }
  };

  const styles = getVariantStyles();
  const isExpandedClass = isExpanded ? styles.headerExpanded : styles.headerCollapsed;

  return (
    <div className={`${className}`}>
      <button
        onClick={handleToggle}
        className={`${styles.header} ${isExpandedClass}`}
        aria-expanded={isExpanded}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center gap-2">
          <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
            <ChevronRightIcon className="w-4 h-4" />
          </span>
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span className="truncate">{title}</span>
          {badge && <span className="flex-shrink-0">{badge}</span>}
        </div>
        <ChevronDownIcon
          className={`w-4 h-4 transform transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      <div
        ref={contentRef}
        className={styles.content}
        style={{ height: isExpanded ? height : 0 }}
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className={styles.contentWrapper}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;