import React, { useState, useEffect } from 'react';
import {
  Form, Input, Button, Upload, Select, DatePicker, Card, Row, Col, Avatar, Spin, message, Divider, Alert, Space, Tag, Progress, } from 'antd';
import {
  UserOutlined, CameraOutlined, UploadOutlined, MailOutlined, PhoneOutlined, CheckCircleOutlined, ExclamationCircleOutlined, } from '@ant-design/icons';
import { User } from '../../types/user.types';
import ImgCrop from 'antd-img-crop';
import dayjs from 'dayjs';
import { toast } from 'react-hot-toast';

interface ProfileTabProps {
  user: User;
  onUpdateUser: (userData: Partial<User>) => void;
}

const {Option} = Select;
const {TextArea} = Input;

// Country list with South Africa first
const countries = [
  { code: 'ZA', name: 'South Africa' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'BE', name: 'Belgium' },
  { code: 'AT', name: 'Austria' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'PL', name: 'Poland' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LV', name: 'Latvia' },
  { code: 'EE', name: 'Estonia' },
];

const ProfileTab: React.FC<ProfileTabProps> = ({ user, onUpdateUser }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [emailVerificationLoading, setEmailVerificationLoading] = useState(false);
  const [phoneVerificationLoading, setPhoneVerificationLoading] = useState(false);

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
    // Initialize form with user data
    form.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      dateOfBirth: user.dateOfBirth ? dayjs(user.dateOfBirth) : null,
      country: user.country,
      bio: user.preferences?.bio || '',
    });
  }, [user, form]);

  const handleFinish = async (values: any) => {
    setLoading(true);
    try {
      // Update user profile
      const updatedUser = {
        ...user,
        ...values,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.toISOString() : undefined,
      };

      onUpdateUser(updatedUser);
      toast.success('Profile updated successfully!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to update profile. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (file: File) => {
    setAvatarLoading(true);
    try {
      // In a real implementation, you would upload the file to your server
      // For now, we'll just simulate it
      const formData = new FormData();
      formData.append('avatar', file);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      const reader = new FileReader();
      reader.onload = (e) => {
        const updatedUser = {
          ...user,
          avatarUrl: e.target?.result as string,
        };
        onUpdateUser(updatedUser);
        toast.success('Avatar updated successfully!', {
          style: {
            background: viralFxColors.successGreen,
            color: 'white',
          },
        });
      };
      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload avatar. Please try again.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleEmailVerification = async () => {
    setEmailVerificationLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Verification email sent! Please check your inbox.', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to send verification email.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setEmailVerificationLoading(false);
    }
  };

  const handlePhoneVerification = async () => {
    setPhoneVerificationLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Verification code sent to your phone!', {
        style: {
          background: viralFxColors.successGreen,
          color: 'white',
        },
      });
    } catch (error) {
      toast.error('Failed to send verification code.', {
        style: {
          background: viralFxColors.errorRed,
          color: 'white',
        },
      });
    } finally {
      setPhoneVerificationLoading(false);
    }
  };

  const getProfileCompletion = () => {
    let completed = 0;
    const total = 8;

    if (user.firstName && user.lastName) completed++;
    if (user.avatarUrl) completed++;
    if (user.phoneNumber) completed++;
    if (user.dateOfBirth) completed++;
    if (user.emailVerified) completed++;
    if (user.phoneVerified) completed++;
    if (user.kycStatus === 'VERIFIED') completed++;
    if (user.preferences?.bio) completed++;

    return Math.round((completed / total) * 100);
  };

  const getProfileCompletionColor = () => {
    const percentage = getProfileCompletion();
    if (percentage >= 80) return viralFxColors.successGreen;
    if (percentage >= 60) return viralFxColors.warningOrange;
    return viralFxColors.errorRed;
  };

  return (
    <div>
      {/* Profile Completion Card */}
      <Card
        style={{
          marginBottom: '24px',
          border: `1px solid ${viralFxColors.borderDefault}`,
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)'
        }}
      >
        <Row gutter={24} align="middle">
          <Col xs={24} md={8}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  size={120}
                  src={user.avatarUrl}
                  icon={<UserOutlined />}
                  style={{
                    border: `4px solid ${viralFxColors.primaryPurple}`,
                    backgroundColor: viralFxColors.backgroundPrimary,
                  }}
                />
                <ImgCrop rotate>
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleAvatarChange(file);
                      return false;
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                    }}
                  >
                    <Button
                      type="primary"
                      shape="circle"
                      icon={<CameraOutlined />}
                      loading={avatarLoading}
                      style={{
                        backgroundColor: viralFxColors.primaryPurple,
                        borderColor: viralFxColors.primaryPurple,
                        boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
                      }}
                    />
                  </Upload>
                </ImgCrop>
              </div>
              <div style={{ marginTop: '12px' }}>
                <h3 style={{ margin: '8px 0', color: viralFxColors.textPrimary }}>
                  {user.firstName} {user.lastName}
                </h3>
                <p style={{ margin: 0, color: viralFxColors.textSecondary }}>
                  {user.email}
                </p>
                {user.kycStatus === 'VERIFIED' && (
                  <Tag
                    color="success"
                    icon={<CheckCircleOutlined />}
                    style={{
                      backgroundColor: '#f6ffed',
                      borderColor: '#b7eb8f',
                      color: '#52c41a',
                      marginTop: '8px',
                    }}
                  >
                    KYC Verified
                  </Tag>
                )}
              </div>
            </div>
          </Col>

          <Col xs={24} md={16}>
            <div>
              <h4 style={{ marginBottom: '16px', color: viralFxColors.textPrimary }}>
                Profile Completion
              </h4>
              <Progress
                percent={getProfileCompletion()}
                strokeColor={getProfileCompletionColor()}
                style={{ marginBottom: '16px' }}
                format={(percent) => `${percent}% Complete`}
              />
              <p style={{ color: viralFxColors.textSecondary, margin: 0 }}>
                Complete your profile to unlock all features and enhance your trading experience.
              </p>
            </div>
          </Col>
        </Row>
      </Card>

      {/* Profile Form */}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        style={{
          backgroundColor: viralFxColors.backgroundPrimary,
        }}
      >
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label="First Name"
              name="firstName"
              rules={[
                { required: true, message: 'Please enter your first name' },
                { min: 2, message: 'First name must be at least 2 characters' },
              ]}
            >
              <Input
                placeholder="Enter your first name"
                style={{
                  borderRadius: '6px',
                  borderColor: viralFxColors.borderDefault,
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="Last Name"
              name="lastName"
              rules={[
                { required: true, message: 'Please enter your last name' },
                { min: 2, message: 'Last name must be at least 2 characters' },
              ]}
            >
              <Input
                placeholder="Enter your last name"
                style={{
                  borderRadius: '6px',
                  borderColor: viralFxColors.borderDefault,
                }}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={
            <span>
              Email Address
              {user.emailVerified ? (
                <Tag
                  color="success"
                  icon={<CheckCircleOutlined />}
                  style={{
                    marginLeft: '8px',
                    backgroundColor: '#f6ffed',
                    borderColor: '#b7eb8f',
                    color: '#52c41a',
                  }}
                >
                  Verified
                </Tag>
              ) : (
                <Tag
                  color="warning"
                  icon={<ExclamationCircleOutlined />}
                  style={{
                    marginLeft: '8px',
                    backgroundColor: '#fffbe6',
                    borderColor: '#ffe58f',
                    color: '#faad14',
                  }}
                >
                  Not Verified
                </Tag>
              )}
            </span>
          }
          name="email"
        >
          <Input
            value={user.email}
            disabled
            placeholder="Email address"
            suffix={
              !user.emailVerified && (
                <Button
                  type="link"
                  size="small"
                  loading={emailVerificationLoading}
                  onClick={handleEmailVerification}
                  style={{
                    color: viralFxColors.primaryPurple,
                  }}
                >
                  Verify
                </Button>
              )
            }
            style={{
              borderRadius: '6px',
              borderColor: viralFxColors.borderDefault,
            }}
          />
        </Form.Item>

        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item
              label={
                <span>
                  Phone Number
                  {user.phoneVerified ? (
                    <Tag
                      color="success"
                      icon={<CheckCircleOutlined />}
                      style={{
                        marginLeft: '8px',
                        backgroundColor: '#f6ffed',
                        borderColor: '#b7eb8f',
                        color: '#52c41a',
                      }}
                    >
                      Verified
                    </Tag>
                  ) : (
                    <Tag
                      color="warning"
                      icon={<ExclamationCircleOutlined />}
                      style={{
                        marginLeft: '8px',
                        backgroundColor: '#fffbe6',
                        borderColor: '#ffe58f',
                        color: '#faad14',
                      }}
                    >
                      Not Verified
                    </Tag>
                  )}
                </span>
              }
              name="phoneNumber"
            >
              <Input
                placeholder="+27 12 345 6789"
                suffix={
                  !user.phoneVerified && user.phoneNumber && (
                    <Button
                      type="link"
                      size="small"
                      loading={phoneVerificationLoading}
                      onClick={handlePhoneVerification}
                      style={{
                        color: viralFxColors.primaryPurple,
                      }}
                    >
                      Verify
                    </Button>
                  )
                }
                style={{
                  borderRadius: '6px',
                  borderColor: viralFxColors.borderDefault,
                }}
              />
            </Form.Item>
          </Col>

          <Col xs={24} md={12}>
            <Form.Item
              label="Date of Birth"
              name="dateOfBirth"
              rules={[
                { required: true, message: 'Please enter your date of birth' },
              ]}
            >
              <DatePicker
                style={{
                  width: '100%',
                  borderRadius: '6px',
                  borderColor: viralFxColors.borderDefault,
                }}
                placeholder="Select date"
                disabledDate={(current) => current && current > dayjs().subtract(18, 'year')}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="Country"
          name="country"
          rules={[{ required: true, message: 'Please select your country' }]}
        >
          <Select
            placeholder="Select your country"
            showSearch
            filterOption={(input, option) =>
              (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
            }
            style={{
              borderRadius: '6px',
              borderColor: viralFxColors.borderDefault,
            }}
          >
            {countries.map((country) => (
              <Option key={country.code} value={country.code}>
                {country.name}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="Bio"
          name="bio"
        >
          <TextArea
            rows={4}
            placeholder="Tell us about yourself..."
            maxLength={500}
            showCount
            style={{
              borderRadius: '6px',
              borderColor: viralFxColors.borderDefault,
            }}
          />
        </Form.Item>

        <Divider />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <Button
            onClick={() => form.resetFields()}
            style={{
              borderRadius: '6px',
              borderColor: viralFxColors.borderDefault,
              color: viralFxColors.textSecondary,
            }}
          >
            Reset
          </Button>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            style={{
              backgroundColor: viralFxColors.primaryPurple,
              borderColor: viralFxColors.primaryPurple,
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(75, 0, 130, 0.3)',
            }}
          >
            Save Changes
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default ProfileTab;