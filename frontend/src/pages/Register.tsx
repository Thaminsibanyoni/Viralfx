import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Form, Input, Button, Card, Typography, Space, Steps, Row, Col, Select, DatePicker, InputNumber, Checkbox, Alert, message, Progress, Tooltip, } from 'antd';
import {
  UserOutlined, MailOutlined, LockOutlined, PhoneOutlined, IdcardOutlined, BankOutlined, EyeOutlined, EyeInvisibleOutlined, CheckCircleOutlined, InfoCircleOutlined, } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useBrokerStore } from '../stores/brokerStore';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import dayjs from 'dayjs';

const {Title, Text} = Typography;
const {Step} = Steps;
const {Option} = Select;

interface RegistrationForm {
  // Step 1: Account Details
  email: string;
  username: string;
  password: string;
  confirmPassword: string;

  // Step 2: Personal Info
  firstName: string;
  lastName: string;
  dateOfBirth: dayjs.Dayjs;
  phone: string;
  idNumber: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;

  // Step 3: Broker Linking (Optional)
  brokerId?: string;
  brokerAccountNumber?: string;
  brokerApiKey?: string;
  brokerApiSecret?: string;

  // Step 4: Terms & Conditions
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptRisk: boolean;
  acceptFSCA: boolean;
  marketingConsent: boolean;
}

const Register: React.FC = () => {
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [searchParams] = useSearchParams();
  const referralCode = searchParams.get('ref');

  const {register, user} = useAuthStore();
  const {brokers, fetchBrokers} = useBrokerStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchBrokers();
  }, [fetchBrokers]);

  useEffect(() => {
    if (referralCode) {
      form.setFieldsValue({ referralCode });
    }
  }, [referralCode, form]);

  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 10;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 20;
    if (/[^a-zA-Z\d]/.test(password)) strength += 20;
    return Math.min(strength, 100);
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 30) return '#FF4D4F';
    if (passwordStrength < 60) return '#FFB300';
    if (passwordStrength < 80) return '#52C41A';
    return '#1890FF';
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 30) return 'Weak';
    if (passwordStrength < 60) return 'Fair';
    if (passwordStrength < 80) return 'Good';
    return 'Strong';
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setPasswordStrength(calculatePasswordStrength(password));
  };

  const validateEmailUnique = async (_: any, value: string) => {
    if (!value) return Promise.resolve();

    // Simulate email uniqueness check
    const commonDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com'];
    const domain = value.split('@')[1];

    if (!commonDomains.includes(domain)) {
      // In production, this would call an API to check uniqueness
      return Promise.resolve();
    }

    return Promise.resolve();
  };

  const validateUsername = async (_: any, value: string) => {
    if (!value) return Promise.resolve();

    if (value.length < 3) {
      return Promise.reject('Username must be at least 3 characters');
    }

    if (value.length > 20) {
      return Promise.reject('Username must be less than 20 characters');
    }

    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return Promise.reject('Username can only contain letters, numbers, and underscores');
    }

    // Simulate username uniqueness check
    return Promise.resolve();
  };

  const validateSouthAfricanID = async (_: any, value: string) => {
    if (!value) return Promise.resolve();

    // SA ID number validation (basic)
    if (!/^\d{13}$/.test(value)) {
      return Promise.reject('South African ID must be 13 digits');
    }

    return Promise.resolve();
  };

  const handleNext = async () => {
    try {
      if (currentStep === 0) {
        // Validate account details
        await form.validateFields(['email', 'username', 'password', 'confirmPassword']);
      } else if (currentStep === 1) {
        // Validate personal info
        await form.validateFields([
          'firstName', 'lastName', 'dateOfBirth', 'phone', 'idNumber',
          'address', 'city', 'province', 'postalCode'
        ]);
      } else if (currentStep === 2) {
        // Broker linking is optional, skip validation
      }

      setCurrentStep(currentStep + 1);
    } catch (error) {
      message.error('Please fill in all required fields correctly');
    }
  };

  const handlePrevious = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async (values: RegistrationForm) => {
    setLoading(true);

    try {
      const registrationData = {
        ...values,
        dateOfBirth: values.dateOfBirth.toISOString(),
        referralCode: referralCode || undefined,
      };

      await register(registrationData);

      setRegistrationComplete(true);
      message.success('Registration successful! Welcome to ViralFX!');

      // Auto-redirect after 3 seconds
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 3000);

    } catch (error: any) {
      message.error(error.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    {
      title: 'Account Details',
      icon: <UserOutlined />,
    },
    {
      title: 'Personal Info',
      icon: <IdcardOutlined />,
    },
    {
      title: 'Broker Linking',
      icon: <BankOutlined />,
    },
    {
      title: 'Terms',
      icon: <CheckCircleOutlined />,
    },
  ];

  if (registrationComplete) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
          padding: '20px',
        }}
      >
        <Card
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255, 179, 0, 0.2)',
            borderRadius: '16px',
            textAlign: 'center',
            maxWidth: '400px',
            width: '100%',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
            }}
          >
            <CheckCircleOutlined style={{ color: 'white' }} />
          </div>
          <Title level={2} style={{ color: '#FFB300', marginBottom: '16px' }}>
            Registration Complete!
          </Title>
          <Text style={{ color: '#B8BCC8', fontSize: '16px', display: 'block', marginBottom: '24px' }}>
            Welcome to ViralFX! Your account has been created successfully.
          </Text>
          <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
            Redirecting to your dashboard...
          </Text>
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 100%)',
        padding: '20px 0',
      }}
    >
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              width: '60px',
              height: '60px',
              background: 'linear-gradient(135deg, #4B0082 0%, #FFB300 100%)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            VF
          </div>
          <Title level={2} style={{ color: '#FFB300', margin: 0 }}>
            Create Your Account
          </Title>
          <Text style={{ color: '#B8BCC8' }}>
            Join South Africa's viral trading platform
          </Text>
        </div>

        <Steps current={currentStep} style={{ marginBottom: '40px' }}>
          {steps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              icon={step.icon}
              style={{
                color: index <= currentStep ? '#FFB300' : '#B8BCC8',
              }}
            />
          ))}
        </Steps>

        <Card
          style={{
            background: '#1A1A1C',
            border: '1px solid rgba(255, 179, 0, 0.2)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
          bodyStyle={{ padding: '40px' }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            size="large"
          >
            {currentStep === 0 && (
              // Step 1: Account Details
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="Account Setup"
                  description="Create your login credentials. Your password should be strong and unique."
                  type="info"
                  showIcon
                />

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Email Address</span>}
                      name="email"
                      rules={[
                        { required: true, message: 'Please input your email!' },
                        { type: 'email', message: 'Please enter a valid email!' },
                        { validator: validateEmailUnique },
                      ]}
                    >
                      <Input
                        prefix={<MailOutlined style={{ color: '#4B0082' }} />}
                        placeholder="your@email.com"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Username</span>}
                      name="username"
                      rules={[
                        { required: true, message: 'Please input your username!' },
                        { validator: validateUsername },
                      ]}
                    >
                      <Input
                        prefix={<UserOutlined style={{ color: '#4B0082' }} />}
                        placeholder="johndoe"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label={<span style={{ color: '#B8BCC8' }}>Password</span>}
                  name="password"
                  rules={[
                    { required: true, message: 'Please input your password!' },
                    { min: 8, message: 'Password must be at least 8 characters!' },
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#4B0082' }} />}
                    placeholder="Create a strong password"
                    onChange={handlePasswordChange}
                    visibilityToggle={{
                      visible: showPassword,
                      onVisibleChange: setShowPassword,
                    }}
                    iconRender={(visible) =>
                      visible ? (
                        <EyeOutlined style={{ color: '#FFB300' }} />
                      ) : (
                        <EyeInvisibleOutlined style={{ color: '#B8BCC8' }} />
                      )
                    }
                    style={{
                      background: '#0E0E10',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  />
                </Form.Item>

                {passwordStrength > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                        Password Strength
                      </Text>
                      <Text style={{ color: getPasswordStrengthColor(), fontSize: '12px' }}>
                        {getPasswordStrengthText()}
                      </Text>
                    </div>
                    <Progress
                      percent={passwordStrength}
                      strokeColor={getPasswordStrengthColor()}
                      showInfo={false}
                      size="small"
                    />
                  </div>
                )}

                <Form.Item
                  label={<span style={{ color: '#B8BCC8' }}>Confirm Password</span>}
                  name="confirmPassword"
                  dependencies={['password']}
                  rules={[
                    { required: true, message: 'Please confirm your password!' },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('password') === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject('Passwords do not match!');
                      },
                    }),
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: '#4B0082' }} />}
                    placeholder="Confirm your password"
                    style={{
                      background: '#0E0E10',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  />
                </Form.Item>
              </Space>
            )}

            {currentStep === 1 && (
              // Step 2: Personal Information
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="Personal Information"
                  description="We need this information for KYC compliance and to personalize your experience."
                  type="info"
                  showIcon
                />

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>First Name</span>}
                      name="firstName"
                      rules={[{ required: true, message: 'Please input your first name!' }]}
                    >
                      <Input
                        placeholder="John"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Last Name</span>}
                      name="lastName"
                      rules={[{ required: true, message: 'Please input your last name!' }]}
                    >
                      <Input
                        placeholder="Doe"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Date of Birth</span>}
                      name="dateOfBirth"
                      rules={[{ required: true, message: 'Please select your date of birth!' }]}
                    >
                      <DatePicker
                        style={{
                          width: '100%',
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                        disabledDate={(current) => current && current.isAfter(dayjs().subtract(18, 'year'))}
                        placeholder="Select date"
                      />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Phone Number</span>}
                      name="phone"
                      rules={[
                        { required: true, message: 'Please input your phone number!' },
                        { pattern: /^(\+27|0)[6-8][0-9]{8}$/, message: 'Please enter a valid South African phone number!' },
                      ]}
                    >
                      <Input
                        prefix={<PhoneOutlined style={{ color: '#4B0082' }} />}
                        placeholder="+27 12 345 6789"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item
                  label={
                    <span style={{ color: '#B8BCC8' }}>
                      South African ID Number
                      <Tooltip title="Your 13-digit South African ID number for KYC verification">
                        <InfoCircleOutlined style={{ marginLeft: '8px', color: '#FFB300' }} />
                      </Tooltip>
                    </span>
                  }
                  name="idNumber"
                  rules={[{ validator: validateSouthAfricanID }]}
                >
                  <Input
                    placeholder="0001010000000"
                    maxLength={13}
                    style={{
                      background: '#0E0E10',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  />
                </Form.Item>

                <Form.Item
                  label={<span style={{ color: '#B8BCC8' }}>Address</span>}
                  name="address"
                  rules={[{ required: true, message: 'Please input your address!' }]}
                >
                  <Input
                    placeholder="123 Main Street"
                    style={{
                      background: '#0E0E10',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  />
                </Form.Item>

                <Row gutter={16}>
                  <Col span={8}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>City</span>}
                      name="city"
                      rules={[{ required: true, message: 'Please input your city!' }]}
                    >
                      <Input
                        placeholder="Johannesburg"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Province</span>}
                      name="province"
                      rules={[{ required: true, message: 'Please select your province!' }]}
                    >
                      <Select
                        placeholder="Select province"
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      >
                        <Option value="gauteng">Gauteng</Option>
                        <Option value="western-cape">Western Cape</Option>
                        <Option value="kwazulu-natal">KwaZulu-Natal</Option>
                        <Option value="eastern-cape">Eastern Cape</Option>
                        <Option value="free-state">Free State</Option>
                        <Option value="mpumalanga">Mpumalanga</Option>
                        <Option value="limpopo">Limpopo</Option>
                        <Option value="north-west">North West</Option>
                        <Option value="northern-cape">Northern Cape</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      label={<span style={{ color: '#B8BCC8' }}>Postal Code</span>}
                      name="postalCode"
                      rules={[
                        { required: true, message: 'Please input your postal code!' },
                        { pattern: /^\d{4}$/, message: 'Postal code must be 4 digits!' },
                      ]}
                    >
                      <Input
                        placeholder="0001"
                        maxLength={4}
                        style={{
                          background: '#0E0E10',
                          border: '1px solid rgba(255, 179, 0, 0.2)',
                          color: '#B8BCC8',
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Space>
            )}

            {currentStep === 2 && (
              // Step 3: Broker Linking (Optional)
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="Broker Integration (Optional)"
                  description="Link your existing trading account to sync trades automatically. You can skip this step and add it later."
                  type="info"
                  showIcon
                />

                <Form.Item
                  label={<span style={{ color: '#B8BCC8' }}>Select Broker (Optional)</span>}
                  name="brokerId"
                >
                  <Select
                    placeholder="Choose your broker or skip"
                    allowClear
                    style={{
                      background: '#0E0E10',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      color: '#B8BCC8',
                    }}
                  >
                    {brokers.map((broker) => (
                      <Option key={broker.id} value={broker.id}>
                        {broker.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.brokerId !== currentValues.brokerId}>
                  {({ getFieldValue }) =>
                    getFieldValue('brokerId') ? (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Form.Item
                          label={<span style={{ color: '#B8BCC8' }}>Account Number</span>}
                          name="brokerAccountNumber"
                        >
                          <Input
                            placeholder="Your broker account number"
                            style={{
                              background: '#0E0E10',
                              border: '1px solid rgba(255, 179, 0, 0.2)',
                              color: '#B8BCC8',
                            }}
                          />
                        </Form.Item>

                        <Form.Item
                          label={<span style={{ color: '#B8BCC8' }}>API Key</span>}
                          name="brokerApiKey"
                        >
                          <Input.Password
                            placeholder="Your broker API key"
                            style={{
                              background: '#0E0E10',
                              border: '1px solid rgba(255, 179, 0, 0.2)',
                              color: '#B8BCC8',
                            }}
                          />
                        </Form.Item>

                        <Form.Item
                          label={<span style={{ color: '#B8BCC8' }}>API Secret</span>}
                          name="brokerApiSecret"
                        >
                          <Input.Password
                            placeholder="Your broker API secret"
                            style={{
                              background: '#0E0E10',
                              border: '1px solid rgba(255, 179, 0, 0.2)',
                              color: '#B8BCC8',
                            }}
                          />
                        </Form.Item>
                      </Space>
                    ) : null
                  }
                </Form.Item>
              </Space>
            )}

            {currentStep === 3 && (
              // Step 4: Terms & Conditions
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Alert
                  message="Terms & Agreements"
                  description="Please review and accept the following terms to complete your registration."
                  type="info"
                  showIcon
                />

                <Form.Item
                  name="acceptTerms"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value ? Promise.resolve() : Promise.reject('You must accept the Terms of Service'),
                    },
                  ]}
                >
                  <Checkbox style={{ color: '#B8BCC8' }}>
                    I accept the{' '}
                    <Link to="/legal/terms" target="_blank" style={{ color: '#FFB300' }}>
                      Terms of Service
                    </Link>
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="acceptPrivacy"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value ? Promise.resolve() : Promise.reject('You must accept the Privacy Policy'),
                    },
                  ]}
                >
                  <Checkbox style={{ color: '#B8BCC8' }}>
                    I have read and agree to the{' '}
                    <Link to="/legal/privacy" target="_blank" style={{ color: '#FFB300' }}>
                      Privacy Policy
                    </Link>{' '}
                    (POPIA Compliant)
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="acceptRisk"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value ? Promise.resolve() : Promise.reject('You must accept the Risk Disclaimer'),
                    },
                  ]}
                >
                  <Checkbox style={{ color: '#B8BCC8' }}>
                    I understand and accept the{' '}
                    <Link to="/legal/disclaimer" target="_blank" style={{ color: '#FFB300' }}>
                      Financial Risk Disclaimer
                    </Link>
                  </Checkbox>
                </Form.Item>

                <Form.Item
                  name="acceptFSCA"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value ? Promise.resolve() : Promise.reject('You must accept FSCA compliance terms'),
                    },
                  ]}
                >
                  <Checkbox style={{ color: '#B8BCC8' }}>
                    I acknowledge that ViralFX is{' '}
                    <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>FSCA Authorized</Text>
                    {' '}and I understand the regulatory requirements for trading in South Africa
                  </Checkbox>
                </Form.Item>

                <Form.Item name="marketingConsent" valuePropName="checked">
                  <Checkbox style={{ color: '#B8BCC8' }}>
                    I would like to receive marketing communications about new features, market insights, and promotional offers
                  </Checkbox>
                </Form.Item>

                {referralCode && (
                  <Alert
                    message="Referral Code Applied"
                    description={`You've been referred with code: ${referralCode}`}
                    type="success"
                    showIcon
                  />
                )}
              </Space>
            )}

            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'space-between' }}>
              <Button
                disabled={currentStep === 0}
                onClick={handlePrevious}
                size="large"
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                Previous
              </Button>

              {currentStep < 3 ? (
                <Button
                  type="primary"
                  onClick={handleNext}
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                  }}
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(75, 0, 130, 0.3)',
                  }}
                >
                  Complete Registration
                </Button>
              )}
            </div>
          </Form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Text style={{ color: '#B8BCC8' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#FFB300' }}>
              Sign in
            </Link>
          </Text>
        </div>
      </div>
    </div>
  );
};

export default Register;