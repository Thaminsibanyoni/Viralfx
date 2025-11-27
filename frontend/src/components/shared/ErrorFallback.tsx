import React from 'react';
import { Result, Button, Typography, Card, Space, Divider, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ExclamationCircleOutlined, HomeOutlined, ReloadOutlined, CopyOutlined, BugOutlined, } from '@ant-design/icons';

const {Text, Paragraph} = Typography;

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  const navigate = useNavigate();
  const isDev = process.env.NODE_ENV === 'development';

  const handleCopyError = () => {
    const errorDetails = `
Error: ${error.name}
Message: ${error.message}
Stack Trace: ${error.stack}
Timestamp: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}
    `.trim();

    navigator.clipboard.writeText(errorDetails).then(() => {
      message.success('Error details copied to clipboard');
    });
  };

  const handleGoHome = () => {
    navigate('/');
    resetErrorBoundary();
  };

  const getErrorType = (error: Error): { title: string; description: string; icon: React.ReactNode } => {
    if (error.message.includes('Network Error') || error.message.includes('fetch')) {
      return {
        title: 'Network Error',
        description: 'Unable to connect to our servers. Please check your internet connection and try again.',
        icon: <ExclamationCircleOutlined style={{ color: '#FFB300' }} />,
      };
    }

    if (error.message.includes('Unauthorized') || error.message.includes('401')) {
      return {
        title: 'Authentication Error',
        description: 'Your session has expired. Please log in again to continue.',
        icon: <ExclamationCircleOutlined style={{ color: '#FF6B6B' }} />,
      };
    }

    if (error.message.includes('Forbidden') || error.message.includes('403')) {
      return {
        title: 'Access Denied',
        description: 'You don\'t have permission to access this resource.',
        icon: <ExclamationCircleOutlined style={{ color: '#FF6B6B' }} />,
      };
    }

    if (error.message.includes('Not Found') || error.message.includes('404')) {
      return {
        title: 'Page Not Found',
        description: 'The page you\'re looking for doesn\'t exist or has been moved.',
        icon: <ExclamationCircleOutlined style={{ color: '#4ECDC4' }} />,
      };
    }

    return {
      title: 'Something Went Wrong',
      description: 'An unexpected error occurred. Our team has been notified and is working to fix it.',
      icon: <ExclamationCircleOutlined style={{ color: '#4B0082' }} />,
    };
  };

  const errorInfo = getErrorType(error);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0E0E10',
        padding: '20px',
      }}
    >
      <Card
        style={{
          maxWidth: '600px',
          width: '100%',
          background: '#1A1A1C',
          border: '1px solid rgba(255, 179, 0, 0.2)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        bodyStyle={{ padding: '40px' }}
      >
        <Result
          status="error"
          icon={errorInfo.icon}
          title={
            <Typography.Title level={2} style={{ color: '#FFB300', marginBottom: '16px' }}>
              {errorInfo.title}
            </Typography.Title>
          }
          subTitle={
            <Text style={{ color: '#B8BCC8', fontSize: '16px', lineHeight: '1.6' }}>
              {errorInfo.description}
            </Text>
          }
          extra={
            <Space size="middle" wrap>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={resetErrorBoundary}
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                }}
              >
                Try Again
              </Button>
              <Button
                icon={<HomeOutlined />}
                onClick={handleGoHome}
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                Go Home
              </Button>
            </Space>
          }
        />

        {isDev && (
          <>
            <Divider style={{ borderColor: 'rgba(255, 179, 0, 0.2)' }} />
            <Card
              size="small"
              style={{
                background: '#0E0E10',
                border: '1px solid rgba(75, 0, 130, 0.3)',
                borderRadius: '8px',
              }}
              title={
                <Space>
                  <BugOutlined style={{ color: '#4B0082' }} />
                  <Text style={{ color: '#FFB300' }}>Error Details (Development)</Text>
                </Space>
              }
            >
              <div style={{ maxHeight: '300px', overflow: 'auto' }}>
                <Paragraph
                  code
                  style={{
                    background: '#000',
                    color: '#FF6B6B',
                    padding: '12px',
                    borderRadius: '4px',
                    marginBottom: '12px',
                    fontSize: '12px',
                    lineHeight: '1.4',
                  }}
                >
                  <strong>Error:</strong> {error.name}
                  <br />
                  <strong>Message:</strong> {error.message}
                </Paragraph>
                {error.stack && (
                  <Paragraph
                    code
                    style={{
                      background: '#000',
                      color: '#B8BCC8',
                      padding: '12px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      lineHeight: '1.4',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    <strong>Stack Trace:</strong>
                    <br />
                    {error.stack}
                  </Paragraph>
                )}
              </div>
              <Button
                size="small"
                icon={<CopyOutlined />}
                onClick={handleCopyError}
                style={{ marginTop: '12px' }}
              >
                Copy Error Details
              </Button>
            </Card>
          </>
        )}

        {!isDev && (
          <>
            <Divider style={{ borderColor: 'rgba(255, 179, 0, 0.2)' }} />
            <div style={{ textAlign: 'center' }}>
              <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                Need help? Contact our{' '}
                <a
                  href="mailto:support@viralfx.co.za"
                  style={{ color: '#FFB300', textDecoration: 'none' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  support team
                </a>{' '}
                or visit our{' '}
                <a
                  href="/help"
                  style={{ color: '#FFB300', textDecoration: 'none' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = 'underline';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = 'none';
                  }}
                >
                  help center
                </a>
                .
              </Text>
              <div style={{ marginTop: '16px' }}>
                <Button
                  size="small"
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={handleCopyError}
                  style={{ color: '#B8BCC8' }}
                >
                  Copy Error Report
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default ErrorFallback;