import React from 'react';
import { ReactNode } from 'react';

interface IconWrapperProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wrapper component for Ant Design icons to add className support
 * Ant Design icons don't support className directly, so we wrap them in a span
 */
const IconWrapper: React.FC<IconWrapperProps> = ({ children, className, style }) => {
  return (
    <span className={className} style={style}>
      {children}
    </span>
  );
};

export default IconWrapper;
