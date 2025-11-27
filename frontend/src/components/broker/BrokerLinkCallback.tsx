import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Result, Button, Spin, Alert, Typography, Card } from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, LinkOutlined, } from '@ant-design/icons';
import { useBrokerStore } from '../../stores/brokerStore';
import { useAuthStore } from '../../stores/authStore';
import { toast } from 'react-hot-toast';

const {Title, Text} = Typography;

const BrokerLinkCallback: React.FC = () => {
  const {code, state, error} = useParams();
  const navigate = useNavigate();
  const _location = useLocation();
  const {handleOAuthCallback, oauthState} = useBrokerStore();
  const {updateUser} = useAuthStore();

  const [processing, setProcessing] = useState(true);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    brokerName?: string;
  } | null>(null);

  // ViralFX color scheme
  const viralFxColors = {
    primaryPurple: '#4B0082',
    primaryPurpleLight: '#6a1b9a',
    accentGold: '#FFB300',
    successGreen: '#4caf50',
    errorRed: '#f44336',
    warningOrange: '#ff9800',
    textPrimary: '#212121',
    textSecondary: '#757575',
    backgroundPrimary: '#ffffff',
    backgroundSecondary: '#f5f5f5',
    borderDefault: '#d9d9d9',
  };

  useEffect(() => {
    const processCallback = async () => {
      try {
        setProcessing(true);

        // Check for errors in URL params
        if (error) {
          setResult({
            success: false,
            message: `OAuth Error: ${decodeURIComponent(error)}`,
          });
          return;
        }

        // Check for required parameters
        if (!code || !state) {
          setResult({
            success: false,
            message: 'Missing required OAuth parameters',
          });
          return;
        }

        // Process OAuth callback
        await handleOAuthCallback(code, state);

        setResult({
          success: true,
          message: 'Successfully linked to broker!',
        });

        // Update user data to reflect broker linkage
        if (updateUser) {
          await updateUser();
        }

        toast.success('Successfully linked to broker!');

      } catch (error: any) {
        setResult({
          success: false,
          message: error.message || 'Failed to complete broker linking',
        });
        toast.error(error.message || 'Failed to complete broker linking');
      } finally {
        setProcessing(false);
      }
    };

    // Process callback only once
    if (processing && !result) {
      processCallback();
    }
  }, [code, state, error, handleOAuthCallback, updateUser, processing, result]);

  const handleGoToSettings = () => {
    navigate('/settings/broker');
  };

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleTryAgain = () => {
    navigate('/settings/broker');
  };

  if (processing) {
    return (
      <div style={{
        minHeight: '100vh',
        background: viralFxColors.backgroundSecondary,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '24px',
      }}>
        <Card
          style={{
            maxWidth: '500px',
            textAlign: 'center',
            border: `1px solid ${viralFxColors.borderDefault}`,
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <Spin
            indicator={<LoadingOutlined style={{ fontSize: '48px', color: viralFxColors.primaryPurple }} spin />}
          />
          <Title level={3} style={{ marginTop: '24px', color: viralFxColors.textPrimary }}>
            Completing Broker Linking
          </Title>
          <Text type="secondary" style={{ fontSize: '16px' }}>
            Please wait while we complete the authentication process...
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: viralFxColors.backgroundSecondary,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '24px',
    }}>
      <Card
        style={{
          maxWidth: '600px',
          width: '100%',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        bodyStyle={{ padding: '40px' }}
      >
        {result?.success ? (
          <Result
            status="success"
            icon={<CheckCircleOutlined style={{ color: viralFxColors.successGreen }} />}
            title="Successfully Linked to Broker!"
            subTitle={result.message}
            extra={[
              <Button
                key="settings"
                type="primary"
                icon={<LinkOutlined />}
                onClick={handleGoToSettings}
                style={{
                  backgroundColor: viralFxColors.primaryPurple,
                  borderColor: viralFxColors.primaryPurple,
                  marginRight: '8px',
                }}
              >
                Go to Settings
              </Button>,
              <Button key="dashboard" onClick={handleGoToDashboard}>
                Go to Dashboard
              </Button>,
            ]}
          />
        ) : (
          <Result
            status="error"
            icon={<CloseCircleOutlined style={{ color: viralFxColors.errorRed }} />}
            title="Broker Linking Failed"
            subTitle={result?.message || 'An error occurred while linking your account'}
            extra={[
              <Button key="retry" type="primary" onClick={handleTryAgain}>
                Try Again
              </Button>,
              <Button key="dashboard" onClick={handleGoToDashboard}>
                Go to Dashboard
              </Button>,
            ]}
          >
            {oauthState.isProcessing && (
              <Alert
                message="Still Processing"
                description="If you just completed the OAuth flow, please wait a moment for the system to update."
                type="info"
                style={{ marginTop: '16px' }}
              />
            )}
          </Result>
        )}

        {/* Debug information for development */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '8px' }}>
            <Title level={5}>Debug Information</Title>
            <Text>
              <strong>Code:</strong> {code || 'Not provided'}<br />
              <strong>State:</strong> {state || 'Not provided'}<br />
              <strong>Error:</strong> {error || 'None'}<br />
              <strong>OAuth State:</strong> {JSON.stringify(oauthState, null, 2)}
            </Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default BrokerLinkCallback;