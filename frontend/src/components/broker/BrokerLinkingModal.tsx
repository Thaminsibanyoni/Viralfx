import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Select, Button, Space, Alert, Steps, Card, Typography, Divider, Row, Col, Tag, Avatar, Descriptions, Spin, Result, } from 'antd';
import {
  LinkOutlined, CheckCircleOutlined, UserOutlined, TeamOutlined, StarOutlined, SafetyCertificateOutlined, TrophyOutlined, GoogleOutlined, AppleOutlined, } from '@ant-design/icons';
import { useBrokerStore } from '../../stores/brokerStore';
import { useAuthStore } from '../../stores/authStore';
import { Broker } from '../../types/broker';
import { toast } from 'react-hot-toast';

const {Title, Text, Paragraph} = Typography;
const {Step} = Steps;
const {Option} = Select;

interface BrokerLinkingModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (broker: Broker) => void;
}

const BrokerLinkingModal: React.FC<BrokerLinkingModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const {user, updateUser} = useAuthStore();
  const {availableBrokers, isLoadingBrokers, brokersError, linkBroker, isLinking, linkingError, oauthState, } = useBrokerStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedBroker, setSelectedBroker] = useState<Broker | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('google');
  const [linkingSuccess, setLinkingSuccess] = useState(false);
  const [form] = Form.useForm();

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

  const oauthProviders = [
    {
      id: 'google',
      name: 'Google',
      icon: <GoogleOutlined style={{ color: '#4285F4' }} />,
      description: 'Link using your Google account',
    },
    {
      id: 'apple',
      name: 'Apple',
      icon: <AppleOutlined style={{ color: '#000' }} />,
      description: 'Link using your Apple ID',
    },
  ];

  useEffect(() => {
    if (visible) {
      // Reset state when modal opens
      setCurrentStep(0);
      setSelectedBroker(null);
      setSelectedProvider('google');
      setLinkingSuccess(false);
      form.resetFields();
    }
  }, [visible, form]);

  useEffect(() => {
    // Listen for OAuth completion
    if (oauthState.isProcessing === false && oauthState.brokerId) {
      // OAuth flow completed
      setLinkingSuccess(true);
      setCurrentStep(3);
      if (onSuccess) {
        onSuccess(selectedBroker!);
      }
    }
  }, [oauthState, onSuccess, selectedBroker]);

  const _handleBrokerSelect = (brokerId: string) => {
    const broker = availableBrokers.find(b => b.id === brokerId);
    setSelectedBroker(broker || null);
  };

  const _handleProviderSelect = (provider: string) => {
    setSelectedProvider(provider);
  };

  const handleNext = async () => {
    if (currentStep === 0) {
      // Validate broker selection
      if (!selectedBroker) {
        toast.error('Please select a broker');
        return;
      }
      setCurrentStep(1);
    } else if (currentStep === 1) {
      // Start OAuth linking
      if (!selectedBroker) return;

      try {
        await linkBroker(selectedBroker.id, selectedProvider);
        setCurrentStep(2);
      } catch (error) {
        toast.error('Failed to initiate linking');
      }
    } else if (currentStep === 2) {
      // OAuth in progress - handle completion in useEffect
      setCurrentStep(3);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const renderBrokerSelection = () => (
    <div>
      <Title level={4}>Select a Broker</Title>
      <Paragraph type="secondary">
        Choose the broker you want to link with your account
      </Paragraph>

      {isLoadingBrokers ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading available brokers...</div>
        </div>
      ) : brokersError ? (
        <Alert
          message="Error loading brokers"
          description={brokersError}
          type="error"
          style={{ marginBottom: '16px' }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {availableBrokers.map((broker) => (
            <Col xs={24} sm={12} key={broker.id}>
              <Card
                hoverable
                onClick={() => setSelectedBroker(broker)}
                style={{
                  border: selectedBroker?.id === broker.id
                    ? `2px solid ${viralFxColors.primaryPurple}`
                    : `1px solid ${viralFxColors.borderDefault}`,
                  backgroundColor: selectedBroker?.id === broker.id
                    ? `${viralFxColors.primaryPurple}10`
                    : viralFxColors.backgroundPrimary,
                }}
                bodyStyle={{ padding: '16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <Avatar
                    size="large"
                    src={broker.logoUrl}
                    icon={<TeamOutlined />}
                    style={{ marginRight: '12px' }}
                  />
                  <div>
                    <Title level={5} style={{ margin: 0 }}>
                      {broker.companyName}
                    </Title>
                    <Tag color="purple">{broker.tier}</Tag>
                  </div>
                </div>
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Trust Score">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <StarOutlined style={{ color: viralFxColors.accentGold, marginRight: '4px' }} />
                      {broker.trustScore || 0}/100
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Status">
                    <Tag color={broker.status === 'VERIFIED' ? 'green' : 'orange'}>
                      {broker.status}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Clients">
                    {broker.totalTraders || 0} active traders
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );

  const renderProviderSelection = () => (
    <div>
      <Title level={4}>Choose OAuth Provider</Title>
      <Paragraph type="secondary">
        Select how you want to authenticate with {selectedBroker?.companyName}
      </Paragraph>

      <Row gutter={[16, 16]}>
        {oauthProviders.map((provider) => (
          <Col xs={24} sm={12} key={provider.id}>
            <Card
              hoverable
              onClick={() => setSelectedProvider(provider.id)}
              style={{
                border: selectedProvider === provider.id
                  ? `2px solid ${viralFxColors.primaryPurple}`
                  : `1px solid ${viralFxColors.borderDefault}`,
                backgroundColor: selectedProvider === provider.id
                  ? `${viralFxColors.primaryPurple}10`
                  : viralFxColors.backgroundPrimary,
              }}
              bodyStyle={{ padding: '20px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>
                {provider.icon}
              </div>
              <Title level={5} style={{ margin: 0 }}>
                {provider.name}
              </Title>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {provider.description}
              </Text>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  const renderOAuthInProgress = () => (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <Spin size="large" />
      <Title level={4} style={{ marginTop: '16px' }}>
        Completing OAuth Authentication
      </Title>
      <Paragraph type="secondary">
        Please complete the authentication in the popup window that opened.
        <br />
        If the popup didn't open, please check your browser's popup settings.
      </Paragraph>
    </div>
  );

  const renderSuccess = () => (
    <Result
      status="success"
      title="Successfully Linked to Broker!"
      subTitle={`Your account is now linked with ${selectedBroker?.companyName}`}
      extra={[
        <Button key="dashboard" type="primary" onClick={onClose}>
          Go to Dashboard
        </Button>,
      ]}
    />
  );

  const steps = [
    {
      title: 'Select Broker',
      description: 'Choose your broker',
    },
    {
      title: 'Authentication',
      description: 'Select OAuth provider',
    },
    {
      title: 'Connecting',
      description: 'Complete OAuth flow',
    },
    {
      title: 'Complete',
      description: 'Successfully linked',
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderBrokerSelection();
      case 1:
        return renderProviderSelection();
      case 2:
        return renderOAuthInProgress();
      case 3:
        return renderSuccess();
      default:
        return null;
    }
  };

  return (
    <Modal
      title="Link with Broker"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={
        linkingSuccess ? null : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              onClick={handlePrevious}
              disabled={currentStep === 0 || isLinking}
            >
              Previous
            </Button>
            <Button
              type="primary"
              onClick={handleNext}
              loading={isLinking}
              disabled={
                (currentStep === 0 && !selectedBroker) ||
                (currentStep === 2) // Don't allow next during OAuth
              }
              style={{
                backgroundColor: viralFxColors.primaryPurple,
                borderColor: viralFxColors.primaryPurple,
              }}
            >
              {currentStep === 0 ? 'Next' : currentStep === 1 ? 'Start Linking' : 'Connecting...'}
            </Button>
          </div>
        )
      }
    >
      <div style={{ marginBottom: '24px' }}>
        <Steps current={currentStep} size="small">
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
            />
          ))}
        </Steps>
      </div>

      {linkingError && (
        <Alert
          message="Linking Error"
          description={linkingError}
          type="error"
          style={{ marginBottom: '16px' }}
        />
      )}

      {renderStepContent()}
    </Modal>
  );
};

export default BrokerLinkingModal;