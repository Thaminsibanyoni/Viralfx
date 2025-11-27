import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Switch, Select, InputNumber, Upload, message, Space, Tabs, Typography, Divider, Row, Col, Alert, Table, Tag, Modal, Tooltip, Badge, } from 'antd';
import {
  SaveOutlined, ReloadOutlined, UploadOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckCircleOutlined, WarningOutlined, } from '@ant-design/icons';
import { crmApi } from '../../../services/api/crm.api';
import { useAuthStore } from '../../../stores/authStore';

const {Title, Text} = Typography;
const {Option} = Select;
const {TextArea} = Input;
const {TabPane} = Tabs;

interface CRMSettings {
  general: {
    platformName: string;
    supportEmail: string;
    autoAssignmentEnabled: boolean;
    defaultAssignee: string;
    businessHours: {
      start: string;
      end: string;
      timezone: string;
      days: string[];
    };
  };
  sla: {
    responseTimeCritical: number;
    responseTimeHigh: number;
    responseTimeNormal: number;
    responseTimeLow: number;
    resolutionTimeCritical: number;
    resolutionTimeHigh: number;
    resolutionTimeNormal: number;
    resolutionTimeLow: number;
  };
  notifications: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    inAppNotifications: boolean;
    emailAlerts: {
      newTicket: boolean;
      ticketAssigned: boolean;
      slaWarning: boolean;
      slaBreached: boolean;
      ticketClosed: boolean;
    };
  };
  automation: {
    autoCloseResolvedTickets: boolean;
    autoCloseDays: number;
    sendSatisfactionSurvey: boolean;
    autoAssignByCategory: boolean;
    categoryAssignments: Array<{
      category: string;
      assigneeId: string;
    }>;
  };
  security: {
    fileUploadLimit: number;
    allowedFileTypes: string[];
    twoFactorAuth: boolean;
    sessionTimeout: number;
    ipWhitelist: string[];
  };
}

const defaultSettings: CRMSettings = {
  general: {
    platformName: 'ViralFX CRM',
    supportEmail: 'support@viralfx.com',
    autoAssignmentEnabled: false,
    defaultAssignee: '',
    businessHours: {
      start: '09:00',
      end: '17:00',
      timezone: 'UTC',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    },
  },
  sla: {
    responseTimeCritical: 1, // hours
    responseTimeHigh: 4,
    responseTimeNormal: 8,
    responseTimeLow: 24,
    resolutionTimeCritical: 4,
    resolutionTimeHigh: 12,
    resolutionTimeNormal: 24,
    resolutionTimeLow: 72,
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    inAppNotifications: true,
    emailAlerts: {
      newTicket: true,
      ticketAssigned: true,
      slaWarning: true,
      slaBreached: true,
      ticketClosed: false,
    },
  },
  automation: {
    autoCloseResolvedTickets: true,
    autoCloseDays: 7,
    sendSatisfactionSurvey: true,
    autoAssignByCategory: false,
    categoryAssignments: [],
  },
  security: {
    fileUploadLimit: 10, // MB
    allowedFileTypes: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', '.gif'],
    twoFactorAuth: false,
    sessionTimeout: 8, // hours
    ipWhitelist: [],
  },
};

const CRMSettings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CRMSettings>(defaultSettings);
  const [activeTab, setActiveTab] = useState('general');
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const {user} = useAuthStore();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await crmApi.getSettings();
      if (response.data) {
        setSettings({ ...defaultSettings, ...response.data });
        form.setFieldsValue({ ...defaultSettings, ...response.data });
      }
    } catch (error) {
      console.error('Failed to fetch CRM settings:', error);
      message.error('Failed to load CRM settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const updatedSettings = { ...settings, ...values };
      const response = await crmApi.updateSettings(updatedSettings);
      if (response.data) {
        setSettings(response.data);
        message.success('CRM settings updated successfully');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      message.error('Failed to save CRM settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    Modal.confirm({
      title: 'Reset Settings',
      content: 'Are you sure you want to reset all settings to their default values?',
      icon: <ExclamationCircleOutlined />,
      onOk: () => {
        setSettings(defaultSettings);
        form.setFieldsValue(defaultSettings);
        message.success('Settings reset to defaults');
      },
    });
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    try {
      await crmApi.testEmailSettings(settings.general.supportEmail);
      message.success('Test email sent successfully');
    } catch (error) {
      console.error('Failed to send test email:', error);
      message.error('Failed to send test email');
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleAddCategoryAssignment = () => {
    const newAssignment = {
      category: '',
      assigneeId: '',
    };
    setSettings(prev => ({
      ...prev,
      automation: {
        ...prev.automation,
        categoryAssignments: [...prev.automation.categoryAssignments, newAssignment],
      },
    }));
  };

  const handleRemoveCategoryAssignment = (index: number) => {
    setSettings(prev => ({
      ...prev,
      automation: {
        ...prev.automation,
        categoryAssignments: prev.automation.categoryAssignments.filter((_, i) => i !== index),
      },
    }));
  };

  const systemHealthColumns = [
    {
      title: 'Service',
      dataIndex: 'service',
      key: 'service',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'healthy' ? 'green' : status === 'warning' ? 'orange' : 'red'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Last Check',
      dataIndex: 'lastCheck',
      key: 'lastCheck',
    },
  ];

  const systemHealth = [
    {
      key: 'database',
      service: 'Database Connection',
      status: 'healthy',
      lastCheck: new Date().toLocaleString(),
    },
    {
      key: 'email',
      service: 'Email Service',
      status: 'healthy',
      lastCheck: new Date().toLocaleString(),
    },
    {
      key: 'storage',
      service: 'File Storage',
      status: 'healthy',
      lastCheck: new Date().toLocaleString(),
    },
    {
      key: 'api',
      service: 'API Gateway',
      status: 'healthy',
      lastCheck: new Date().toLocaleString(),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Title level={2}>CRM Settings</Title>
          <Text type="secondary">
            Configure your CRM system settings and preferences
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchSettings} loading={loading}>
            Refresh
          </Button>
          <Button danger onClick={handleReset}>
            Reset to Defaults
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="General" key="general">
            <Form
              form={form}
              layout="vertical"
              initialValues={settings.general}
              onFinish={(values) => handleSave({ general: values })}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    label="Platform Name"
                    name="platformName"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="Enter platform name" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Support Email"
                    name="supportEmail"
                    rules={[
                      { required: true },
                      { type: 'email' },
                    ]}
                  >
                    <Input placeholder="support@example.com" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                label="Default Assignee"
                name="defaultAssignee"
                tooltip="New tickets will be automatically assigned to this user if auto-assignment is enabled"
              >
                <Select placeholder="Select default assignee" allowClear>
                  <Option value="user1">John Doe</Option>
                  <Option value="user2">Jane Smith</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Auto Assignment"
                name="autoAssignmentEnabled"
                valuePropName="checked"
              >
                <Switch /> Automatically assign new tickets to available support staff
              </Form.Item>

              <Divider>Business Hours</Divider>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label="Start Time" name={['businessHours', 'start']}>
                    <Input type="time" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="End Time" name={['businessHours', 'end']}>
                    <Input type="time" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Timezone" name={['businessHours', 'timezone']}>
                    <Select>
                      <Option value="UTC">UTC</Option>
                      <Option value="America/New_York">Eastern Time</Option>
                      <Option value="America/Los_Angeles">Pacific Time</Option>
                      <Option value="Europe/London">London</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  Save General Settings
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="SLA Settings" key="sla">
            <Form
              layout="vertical"
              initialValues={settings.sla}
              onFinish={(values) => handleSave({ sla: values })}
            >
              <Alert
                message="SLA Configuration"
                description="Configure Service Level Agreement (SLA) response and resolution times for different priority levels."
                type="info"
                showIcon
                className="mb-4"
              />

              <Title level={5}>Response Times (in hours)</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Critical" name="responseTimeCritical">
                    <InputNumber min={0.5} max={24} step={0.5} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="High" name="responseTimeHigh">
                    <InputNumber min={0.5} max={48} step={0.5} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Normal" name="responseTimeNormal">
                    <InputNumber min={1} max={72} step={1} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Low" name="responseTimeLow">
                    <InputNumber min={1} max={168} step={1} />
                  </Form.Item>
                </Col>
              </Row>

              <Title level={5}>Resolution Times (in hours)</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item label="Critical" name="resolutionTimeCritical">
                    <InputNumber min={1} max={48} step={1} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="High" name="resolutionTimeHigh">
                    <InputNumber min={2} max={96} step={1} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Normal" name="resolutionTimeNormal">
                    <InputNumber min={4} max={168} step={1} />
                  </Form.Item>
                </Col>
                <Col span={6}>
                  <Form.Item label="Low" name="resolutionTimeLow">
                    <InputNumber min={8} max={336} step={1} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  Save SLA Settings
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="Notifications" key="notifications">
            <Form
              layout="vertical"
              initialValues={settings.notifications}
              onFinish={(values) => handleSave({ notifications: values })}
            >
              <Title level={5}>Notification Channels</Title>
              <Space direction="vertical" className="w-full">
                <Form.Item name="emailNotifications" valuePropName="checked">
                  <Switch /> Email Notifications
                </Form.Item>
                <Form.Item name="smsNotifications" valuePropName="checked">
                  <Switch /> SMS Notifications
                </Form.Item>
                <Form.Item name="inAppNotifications" valuePropName="checked">
                  <Switch /> In-App Notifications
                </Form.Item>
              </Space>

              <Divider>Email Alerts</Divider>
              <Form.List name={['emailAlerts']}>
                {(fields) => (
                  <>
                    {[
                      { key: 'newTicket', label: 'New Ticket Created' },
                      { key: 'ticketAssigned', label: 'Ticket Assigned' },
                      { key: 'slaWarning', label: 'SLA Warning' },
                      { key: 'slaBreached', label: 'SLA Breached' },
                      { key: 'ticketClosed', label: 'Ticket Closed' },
                    ].map((alert) => (
                      <Form.Item key={alert.key} name={['emailAlerts', alert.key]} valuePropName="checked">
                        <Switch /> {alert.label}
                      </Form.Item>
                    ))}
                  </>
                )}
              </Form.List>

              <div className="mt-4">
                <Button
                  onClick={handleTestEmail}
                  loading={testEmailLoading}
                  disabled={!settings.notifications.emailNotifications}
                >
                  Send Test Email
                </Button>
              </div>

              <Form.Item className="mt-4">
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  Save Notification Settings
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="Automation" key="automation">
            <Form
              layout="vertical"
              initialValues={settings.automation}
              onFinish={(values) => handleSave({ automation: values })}
            >
              <Space direction="vertical" className="w-full" size="large">
                <Form.Item name="autoCloseResolvedTickets" valuePropName="checked">
                  <Switch /> Auto-close resolved tickets
                </Form.Item>
                {settings.automation.autoCloseResolvedTickets && (
                  <Form.Item name="autoCloseDays" label="Auto-close after (days)">
                    <InputNumber min={1} max={30} />
                  </Form.Item>
                )}

                <Form.Item name="sendSatisfactionSurvey" valuePropName="checked">
                  <Switch /> Send satisfaction survey when ticket is closed
                </Form.Item>

                <Form.Item name="autoAssignByCategory" valuePropName="checked">
                  <Switch /> Auto-assign tickets by category
                </Form.Item>
              </Space>

              {settings.automation.autoAssignByCategory && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Title level={5}>Category Assignments</Title>
                    <Button onClick={handleAddCategoryAssignment}>
                      Add Assignment
                    </Button>
                  </div>
                  {settings.automation.categoryAssignments.map((assignment, index) => (
                    <Row key={index} gutter={16} className="mb-2">
                      <Col span={10}>
                        <Input
                          placeholder="Category"
                          value={assignment.category}
                          onChange={(e) => {
                            const newAssignments = [...settings.automation.categoryAssignments];
                            newAssignments[index].category = e.target.value;
                            setSettings(prev => ({
                              ...prev,
                              automation: {
                                ...prev.automation,
                                categoryAssignments: newAssignments,
                              },
                            }));
                          }}
                        />
                      </Col>
                      <Col span={10}>
                        <Select
                          placeholder="Assignee"
                          value={assignment.assigneeId}
                          onChange={(value) => {
                            const newAssignments = [...settings.automation.categoryAssignments];
                            newAssignments[index].assigneeId = value;
                            setSettings(prev => ({
                              ...prev,
                              automation: {
                                ...prev.automation,
                                categoryAssignments: newAssignments,
                              },
                            }));
                          }}
                          style={{ width: '100%' }}
                        >
                          <Option value="user1">John Doe</Option>
                          <Option value="user2">Jane Smith</Option>
                        </Select>
                      </Col>
                      <Col span={4}>
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleRemoveCategoryAssignment(index)}
                        />
                      </Col>
                    </Row>
                  ))}
                </div>
              )}

              <Form.Item className="mt-4">
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  Save Automation Settings
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="Security" key="security">
            <Form
              layout="vertical"
              initialValues={settings.security}
              onFinish={(values) => handleSave({ security: values })}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    label="File Upload Limit (MB)"
                    name="fileUploadLimit"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={100} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    label="Session Timeout (hours)"
                    name="sessionTimeout"
                    rules={[{ required: true }]}
                  >
                    <InputNumber min={1} max={24} />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item label="Allowed File Types" name="allowedFileTypes">
                <Select mode="tags" placeholder="Add file extensions">
                  <Option value=".pdf">PDF</Option>
                  <Option value=".doc">Word Document</Option>
                  <Option value=".docx">Word Document</Option>
                  <Option value=".xls">Excel Spreadsheet</Option>
                  <Option value=".xlsx">Excel Spreadsheet</Option>
                  <Option value=".png">PNG Image</Option>
                  <Option value=".jpg">JPEG Image</Option>
                  <Option value=".jpeg">JPEG Image</Option>
                  <Option value=".gif">GIF Image</Option>
                </Select>
              </Form.Item>

              <Space direction="vertical" className="w-full">
                <Form.Item name="twoFactorAuth" valuePropName="checked">
                  <Switch /> Enable Two-Factor Authentication for all staff
                </Form.Item>
              </Space>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>
                  Save Security Settings
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="System Health" key="health">
            <div className="space-y-4">
              <Alert
                message="System Status"
                description="Monitor the health and performance of your CRM system components."
                type="info"
                showIcon
              />

              <Table
                columns={systemHealthColumns}
                dataSource={systemHealth}
                pagination={false}
                size="small"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <Card size="small">
                  <div className="text-center">
                    <Badge count="98%" status="success" />
                    <Title level={5}>System Uptime</Title>
                    <Text type="secondary">Last 30 days</Text>
                  </div>
                </Card>
                <Card size="small">
                  <div className="text-center">
                    <Badge count="45ms" status="success" />
                    <Title level={5}>Avg Response Time</Title>
                    <Text type="secondary">API calls</Text>
                  </div>
                </Card>
                <Card size="small">
                  <div className="text-center">
                    <Badge count="2.3GB" status="normal" />
                    <Title level={5}>Storage Used</Title>
                    <Text type="secondary">Of 10GB allocated</Text>
                  </div>
                </Card>
              </div>
            </div>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default CRMSettings;