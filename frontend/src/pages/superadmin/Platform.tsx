import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Input, Select, Space, Tag, Modal, Form, InputNumber, Switch, Tooltip, Badge, Row, Col, Statistic, Progress, message, Popconfirm, Typography, Tabs, Alert, Descriptions, Timeline, Avatar, Dropdown, Menu, List, Rate, Divider, Upload, UploadProps, Empty, Spin, Slider, ColorPicker, Image, Collapse, } from 'antd';
import {
  SettingOutlined, GlobalOutlined, SecurityScanOutlined, BulbOutlined, MailOutlined, EyeOutlined, EditOutlined, SaveOutlined, ReloadOutlined, PlusOutlined, SearchOutlined, FilterOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, InfoCircleOutlined, LockOutlined, UnlockOutlined, CloudUploadOutlined, DeleteOutlined, CopyOutlined, ThunderboltOutlined, FireOutlined, RocketOutlined, SafetyOutlined, CrownOutlined, ApiOutlined, DatabaseOutlined, DeploymentUnitOutlined, TeamOutlined, DollarOutlined, BankOutlined, } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ColumnType } from 'antd/lib/table';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api/admin.api';
import { PlatformSetting, FeatureFlag, BrandingSettings } from '../../types/admin.types';
import { useAdminStore } from '../../stores/adminStore';
import moment from 'moment';

const {Title, Text, Paragraph} = Typography;
const {TextArea} = Input;
const {TabPane} = Tabs;
const {Panel} = Collapse;

interface PlatformSettingsFilters {
  page: number;
  limit: number;
  category?: string;
  search?: string;
}

const Platform: React.FC = () => {
  const _navigate = useNavigate();
  const {checkPermission} = useAdminStore();
  const queryClient = useQueryClient();

  // State management
  const [activeTab, setActiveTab] = useState<string>('settings');
  const [settingsFilters, setSettingsFilters] = useState<PlatformSettingsFilters>({
    page: 1,
    limit: 20,
  });
  const [selectedSetting, setSelectedSetting] = useState<PlatformSetting | null>(null);
  const [settingModalVisible, setSettingModalVisible] = useState<boolean>(false);
  const [maintenanceModalVisible, setMaintenanceModalVisible] = useState<boolean>(false);
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState<string>('');
  const [brandingModalVisible, setBrandingModalVisible] = useState<boolean>(false);
  const [featureModalVisible, setFeatureModalVisible] = useState<boolean>(false);
  const [selectedFeature, setSelectedFeature] = useState<FeatureFlag | null>(null);

  // Forms
  const [settingForm] = Form.useForm();
  const [maintenanceForm] = Form.useForm();
  const [brandingForm] = Form.useForm();

  // Permissions
  const canViewPlatform = checkPermission('platform:view');
  const canManageSettings = checkPermission('platform:settings');
  const canManageFeatures = checkPermission('platform:features');
  const canManageBranding = checkPermission('platform:branding');
  const canManageMaintenance = checkPermission('platform:maintenance');

  // Data fetching
  const {data: platformSettingsData, isLoading: settingsLoading, refetch: refetchSettings, } = useQuery(
    ['platform-settings', settingsFilters],
    () => adminApi.getPlatformSettings(),
    {
      enabled: canViewPlatform,
      keepPreviousData: true,
    }
  );

  const {data: featureFlagsData, isLoading: featuresLoading, refetch: refetchFeatures, } = useQuery(
    'feature-flags',
    () => adminApi.getFeatureFlags(),
    {
      enabled: canManageFeatures,
    }
  );

  // Mutations
  const updateSettingMutation = useMutation(
    ({ key, value }: { key: string; value: any }) =>
      adminApi.updateSetting(key, value),
    {
      onSuccess: () => {
        message.success('Setting updated successfully');
        queryClient.invalidateQueries('platform-settings');
        setSettingModalVisible(false);
      },
      onError: () => {
        message.error('Failed to update setting');
      },
    }
  );

  const toggleFeatureMutation = useMutation(
    ({ feature, enabled }: { feature: string; enabled: boolean }) =>
      adminApi.toggleFeature(feature, enabled),
    {
      onSuccess: () => {
        message.success('Feature flag updated successfully');
        queryClient.invalidateQueries('feature-flags');
        setFeatureModalVisible(false);
      },
      onError: () => {
        message.error('Failed to update feature flag');
      },
    }
  );

  const setMaintenanceModeMutation = useMutation(
    ({ enabled, message }: { enabled: boolean; message?: string }) =>
      adminApi.setMaintenanceMode(enabled, message),
    {
      onSuccess: () => {
        message.success('Maintenance mode updated successfully');
        setMaintenanceModalVisible(false);
        maintenanceForm.resetFields();
      },
      onError: () => {
        message.error('Failed to update maintenance mode');
      },
    }
  );

  // Event handlers
  const handleSettingFilterChange = (key: string, value: any) => {
    setSettingsFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleViewSetting = (setting: PlatformSetting) => {
    setSelectedSetting(setting);
    settingForm.setFieldsValue({
      value: setting.type === 'boolean' ? setting.value === 'true' :
              setting.type === 'number' ? Number(setting.value) :
              setting.value,
    });
    setSettingModalVisible(true);
  };

  const handleUpdateSetting = () => {
    settingForm.validateFields().then((values) => {
      if (selectedSetting) {
        updateSettingMutation.mutate({
          key: selectedSetting.key,
          value: values.value,
        });
      }
    });
  };

  const handleToggleFeature = (feature: string, enabled: boolean) => {
    toggleFeatureMutation.mutate({ feature, enabled });
  };

  const handleSetMaintenanceMode = () => {
    maintenanceForm.validateFields().then((values) => {
      setMaintenanceModeMutation.mutate(values);
    });
  };

  const renderSettingValue = (setting: PlatformSetting) => {
    switch (setting.type) {
      case 'boolean':
        return <Switch checked={setting.value === 'true'} disabled />;
      case 'number':
        return <Text>{Number(setting.value).toLocaleString()}</Text>;
      case 'json':
        return <Text code ellipsis style={{ maxWidth: 200 }}>
          {JSON.stringify(JSON.parse(setting.value), null, 2)}
        </Text>;
      default:
        return <Text ellipsis style={{ maxWidth: 200 }}>{setting.value}</Text>;
    }
  };

  // Table columns for Platform Settings
  const settingColumns: ColumnType<PlatformSetting>[] = [
    {
      title: 'Setting Key',
      dataIndex: 'key',
      key: 'key',
      render: (key: string) => (
        <Text code copyable={{ text: key }}>{key}</Text>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => (
        <Tooltip title={description}>
          <Text ellipsis style={{ maxWidth: 250 }}>{description}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => {
        const colors = {
          SECURITY: 'red',
          TRADING: 'blue',
          NOTIFICATION: 'green',
          GENERAL: 'gray',
          PERFORMANCE: 'orange',
          INTEGRATION: 'purple',
        };
        return (
          <Tag color={colors[category as keyof typeof colors] || 'default'}>
            {category}
          </Tag>
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag>{type}</Tag>
      ),
    },
    {
      title: 'Current Value',
      dataIndex: 'value',
      key: 'value',
      render: (_, record: PlatformSetting) => renderSettingValue(record),
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (date: string) => (
        <Tooltip title={moment(date).format('YYYY-MM-DD HH:mm:ss')}>
          {moment(date).fromNow()}
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: PlatformSetting) => (
        <Space>
          <Tooltip title="Edit Setting">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleViewSetting(record)}
              disabled={!canManageSettings}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  if (!canViewPlatform) {
    return (
      <div className="p-6">
        <Alert
          message="Access Denied"
          description="You don't have permission to access the Platform Management page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Mock data for feature flags and branding
  const mockFeatureFlags: FeatureFlag[] = featureFlagsData || [
    { name: 'real_time_trading', enabled: true, description: 'Enable real-time trading features' },
    { name: 'social_sharing', enabled: false, description: 'Enable social media sharing' },
    { name: 'advanced_analytics', enabled: true, description: 'Enable advanced analytics dashboard' },
    { name: 'mobile_app', enabled: false, description: 'Enable mobile app features' },
    { name: 'api_access', enabled: true, description: 'Enable public API access' },
  ];

  const mockBrandingSettings: BrandingSettings = {
    logoLight: '/logo-light.png',
    logoDark: '/logo-dark.png',
    primaryColor: '#1890ff',
    accentColor: '#52c41a',
    notificationTemplates: {},
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} className="mb-0">
              Platform Management
            </Title>
            <Text type="secondary">Manage platform settings, features, and configuration</Text>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  refetchSettings();
                  refetchFeatures();
                }}
              >
                Refresh
              </Button>
              {canManageMaintenance && (
                <Button
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={() => setMaintenanceModalVisible(true)}
                >
                  Maintenance Mode
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Settings"
              value={platformSettingsData?.length || 0}
              prefix={<SettingOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Features"
              value={mockFeatureFlags.filter(f => f.enabled).length}
              prefix={<BulbOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Security Settings"
              value={platformSettingsData?.filter((s: PlatformSetting) => s.category === 'SECURITY').length || 0}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Trading Settings"
              value={platformSettingsData?.filter((s: PlatformSetting) => s.category === 'TRADING').length || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane
            tab={
              <span>
                <SettingOutlined />
                Platform Settings
              </span>
            }
            key="settings"
          >
            {/* Settings Filters */}
            <Card className="mb-4" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={8}>
                  <Input
                    placeholder="Search settings..."
                    prefix={<SearchOutlined />}
                    value={settingsFilters.search}
                    onChange={(e) => handleSettingFilterChange('search', e.target.value)}
                    allowClear
                  />
                </Col>
                <Col xs={24} sm={12} md={8}>
                  <Select
                    placeholder="Category"
                    value={settingsFilters.category}
                    onChange={(value) => handleSettingFilterChange('category', value)}
                    allowClear
                    style={{ width: '100%' }}
                  >
                    <Select.Option value="SECURITY">Security</Select.Option>
                    <Select.Option value="TRADING">Trading</Select.Option>
                    <Select.Option value="NOTIFICATION">Notifications</Select.Option>
                    <Select.Option value="GENERAL">General</Select.Option>
                    <Select.Option value="PERFORMANCE">Performance</Select.Option>
                    <Select.Option value="INTEGRATION">Integration</Select.Option>
                  </Select>
                </Col>
              </Row>
            </Card>

            {/* Settings Table */}
            <Table
              columns={settingColumns}
              dataSource={platformSettingsData || []}
              loading={settingsLoading}
              rowKey="key"
              pagination={{
                current: settingsFilters.page,
                pageSize: settingsFilters.limit,
                total: platformSettingsData?.length || 0,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} settings`,
                onChange: (page, pageSize) => {
                  setSettingsFilters(prev => ({
                    ...prev,
                    page,
                    limit: pageSize || 20,
                  }));
                },
              }}
              scroll={{ x: 1200 }}
            />
          </TabPane>

          <TabPane
            tab={
              <span>
                <BulbOutlined />
                Feature Flags
              </span>
            }
            key="features"
            disabled={!canManageFeatures}
          >
            {!canManageFeatures ? (
              <Alert
                message="Access Restricted"
                description="You need feature management permissions to access this section."
                type="warning"
                showIcon
              />
            ) : (
              <Row gutter={[16, 16]}>
                {mockFeatureFlags.map((feature) => (
                  <Col xs={24} sm={12} md={8} key={feature.name}>
                    <Card
                      size="small"
                      actions={[
                        <Switch
                          checked={feature.enabled}
                          onChange={(checked) => handleToggleFeature(feature.name, checked)}
                          loading={toggleFeatureMutation.isLoading}
                        />
                      ]}
                    >
                      <Card.Meta
                        avatar={
                          <Avatar
                            icon={feature.enabled ? <BulbOutlined /> : <InfoCircleOutlined />}
                            style={{
                              backgroundColor: feature.enabled ? '#52c41a' : '#d9d9d9'
                            }}
                          />
                        }
                        title={feature.name.replace(/_/g, ' ').toUpperCase()}
                        description={feature.description}
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <CrownOutlined />
                Branding
              </span>
            }
            key="branding"
            disabled={!canManageBranding}
          >
            {!canManageBranding ? (
              <Alert
                message="Access Restricted"
                description="You need branding permissions to access this section."
                type="warning"
                showIcon
              />
            ) : (
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <Card title="Logo Configuration" size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text strong>Light Theme Logo</Text>
                        <div className="mt-2">
                          {mockBrandingSettings.logoLight ? (
                            <Image
                              width={100}
                              src={mockBrandingSettings.logoLight}
                              fallback="/logo-placeholder.png"
                            />
                          ) : (
                            <Empty description="No logo uploaded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </div>
                        <Upload className="mt-2">
                          <Button icon={<CloudUploadOutlined />}>Upload Light Logo</Button>
                        </Upload>
                      </div>
                      <Divider />
                      <div>
                        <Text strong>Dark Theme Logo</Text>
                        <div className="mt-2">
                          {mockBrandingSettings.logoDark ? (
                            <Image
                              width={100}
                              src={mockBrandingSettings.logoDark}
                              fallback="/logo-placeholder.png"
                            />
                          ) : (
                            <Empty description="No logo uploaded" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                          )}
                        </div>
                        <Upload className="mt-2">
                          <Button icon={<CloudUploadOutlined />}>Upload Dark Logo</Button>
                        </Upload>
                      </div>
                    </Space>
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="Color Scheme" size="small">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <div>
                        <Text strong>Primary Color</Text>
                        <div className="mt-2">
                          <ColorPicker
                            value={mockBrandingSettings.primaryColor}
                            onChange={(color) => {
                              // Handle color change
                            }}
                          />
                          <Text className="ml-2">{mockBrandingSettings.primaryColor}</Text>
                        </div>
                      </div>
                      <div>
                        <Text strong>Accent Color</Text>
                        <div className="mt-2">
                          <ColorPicker
                            value={mockBrandingSettings.accentColor}
                            onChange={(color) => {
                              // Handle color change
                            }}
                          />
                          <Text className="ml-2">{mockBrandingSettings.accentColor}</Text>
                        </div>
                      </div>
                    </Space>
                  </Card>
                </Col>
              </Row>
            )}
          </TabPane>

          <TabPane
            tab={
              <span>
                <SecurityScanOutlined />
                Security
              </span>
            }
            key="security"
          >
            <Card title="Security Configuration" size="small">
              <Collapse>
                <Panel header="Authentication Settings" key="auth">
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title="Password Requirements">
                        <Space direction="vertical">
                          <div>
                            <Text>Minimum Password Length: </Text>
                            <InputNumber min={8} max={32} defaultValue={12} />
                          </div>
                          <div>
                            <Text>Require Special Characters: </Text>
                            <Switch defaultChecked />
                          </div>
                          <div>
                            <Text>Password Expiry (days): </Text>
                            <InputNumber min={30} max={365} defaultValue={90} />
                          </div>
                        </Space>
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="Two-Factor Authentication">
                        <Space direction="vertical">
                          <div>
                            <Text>Enable 2FA for Admins: </Text>
                            <Switch defaultChecked />
                          </div>
                          <div>
                            <Text>Enable 2FA for Users: </Text>
                            <Switch defaultChecked />
                          </div>
                          <div>
                            <Text>Allow Backup Codes: </Text>
                            <Switch defaultChecked />
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Panel>
                <Panel header="Session Management" key="session">
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Card size="small" title="Session Timeout">
                        <Space direction="vertical">
                          <div>
                            <Text>Admin Session Timeout (minutes): </Text>
                            <InputNumber min={15} max={480} defaultValue={60} />
                          </div>
                          <div>
                            <Text>User Session Timeout (minutes): </Text>
                            <InputNumber min={30} max={1440} defaultValue={240} />
                          </div>
                        </Space>
                      </Card>
                    </Col>
                    <Col span={12}>
                      <Card size="small" title="Concurrent Sessions">
                        <Space direction="vertical">
                          <div>
                            <Text>Max Admin Sessions: </Text>
                            <InputNumber min={1} max={10} defaultValue={3} />
                          </div>
                          <div>
                            <Text>Max User Sessions: </Text>
                            <InputNumber min={1} max={5} defaultValue={2} />
                          </div>
                        </Space>
                      </Card>
                    </Col>
                  </Row>
                </Panel>
              </Collapse>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <DatabaseOutlined />
                Integration
              </span>
            }
            key="integration"
          >
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card title="Payment Gateway" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Stripe Configuration</Text>
                      <div className="mt-2">
                        <Input placeholder="Publishable Key" className="mb-2" />
                        <Input.Password placeholder="Secret Key" className="mb-2" />
                        <Input placeholder="Webhook Secret" />
                      </div>
                    </div>
                    <div>
                      <Text strong>PayPal Configuration</Text>
                      <div className="mt-2">
                        <Input placeholder="Client ID" className="mb-2" />
                        <Input.Password placeholder="Client Secret" />
                      </div>
                    </div>
                  </Space>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="External APIs" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div>
                      <Text strong>Market Data Provider</Text>
                      <Select placeholder="Select provider" className="mt-2" style={{ width: '100%' }}>
                        <Select.Option value="alpha_vantage">Alpha Vantage</Select.Option>
                        <Select.Option value="iex_cloud">IEX Cloud</Select.Option>
                        <Select.Option value="finnhub">Finnhub</Select.Option>
                      </Select>
                    </div>
                    <div>
                      <Text strong>Email Service</Text>
                      <Select placeholder="Select provider" className="mt-2" style={{ width: '100%' }}>
                        <Select.Option value="sendgrid">SendGrid</Select.Option>
                        <Select.Option value="ses">Amazon SES</Select.Option>
                        <Select.Option value="mailgun">Mailgun</Select.Option>
                      </Select>
                    </div>
                  </Space>
                </Card>
              </Col>
            </Row>
          </TabPane>
        </Tabs>
      </Card>

      {/* Edit Setting Modal */}
      <Modal
        title={
          <Space>
            <EditOutlined />
            Edit Setting: {selectedSetting?.key}
          </Space>
        }
        visible={settingModalVisible}
        onCancel={() => setSettingModalVisible(false)}
        onOk={handleUpdateSetting}
        confirmLoading={updateSettingMutation.isLoading}
        width={600}
      >
        {selectedSetting && (
          <Form form={settingForm} layout="vertical">
            <Form.Item label="Setting Key">
              <Input value={selectedSetting.key} disabled />
            </Form.Item>
            <Form.Item label="Description">
              <TextArea value={selectedSetting.description} disabled rows={2} />
            </Form.Item>
            <Form.Item label="Value" name="value" rules={[{ required: true }]}>
              {selectedSetting.type === 'boolean' ? (
                <Switch />
              ) : selectedSetting.type === 'number' ? (
                <InputNumber style={{ width: '100%' }} />
              ) : selectedSetting.type === 'json' ? (
                <TextArea rows={6} placeholder="Enter valid JSON" />
              ) : (
                <TextArea rows={3} />
              )}
            </Form.Item>
          </Form>
        )}
      </Modal>

      {/* Maintenance Mode Modal */}
      <Modal
        title={
          <Space>
            <SettingOutlined />
            Maintenance Mode
          </Space>
        }
        visible={maintenanceModalVisible}
        onCancel={() => setMaintenanceModalVisible(false)}
        onOk={handleSetMaintenanceMode}
        confirmLoading={setMaintenanceModeMutation.isLoading}
        width={600}
      >
        <Form form={maintenanceForm} layout="vertical">
          <Form.Item
            label="Enable Maintenance Mode"
            name="enabled"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Maintenance Message"
            name="message"
            help="This message will be displayed to users during maintenance"
          >
            <TextArea
              rows={3}
              placeholder="The platform is currently under maintenance. We'll be back shortly."
            />
          </Form.Item>
          <Alert
            message="Warning"
            description="Enabling maintenance mode will make the platform inaccessible to regular users. Admin users will still be able to access the system."
            type="warning"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
};

export default Platform;