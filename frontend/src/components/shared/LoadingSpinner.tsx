import React from 'react';
import { Spin } from 'antd';

interface LoadingSpinnerProps {
  size?: 'small' | 'default' | 'large';
  tip?: string;
  fullScreen?: boolean;
  overlay?: boolean;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'default',
  tip,
  fullScreen = false,
  overlay = false,
}) => {
  const _spinProps = {
    size,
    tip: tip || (size === 'small' ? undefined : 'Loading...'),
    spinning: true,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      ...(fullScreen
        ? {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            background: overlay ? 'rgba(14, 14, 16, 0.8)' : '#0E0E10',
          }
        : {
            minHeight: overlay ? '100%' : 'auto',
            padding: '20px',
          }),
    },
  };

  const customSpinner = (
    <div
      style={{
        width: size === 'small' ? '20px' : size === 'large' ? '50px' : '35px',
        height: size === 'small' ? '20px' : size === 'large' ? '50px' : '35px',
        border: `3px solid rgba(75, 0, 130, 0.2)`,
        borderTop: `3px solid #4B0082`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginRight: tip ? '12px' : '0',
      }}
    />
  );

  const spinnerWithTip = (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
      {customSpinner}
      {tip && (
        <div style={{ color: '#B8BCC8', fontSize: '14px', textAlign: 'center' }}>
          {tip}
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          background: overlay ? 'rgba(14, 14, 16, 0.8)' : '#0E0E10',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        role="alert"
        aria-busy="true"
        aria-label={tip || 'Loading'}
      >
        {spinnerWithTip}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: overlay ? '100%' : 'auto',
        padding: '20px',
      }}
      role="alert"
      aria-busy="true"
      aria-label={tip || 'Loading'}
    >
      {spinnerWithTip}
    </div>
  );
};

export default LoadingSpinner;
export { LoadingSpinner };