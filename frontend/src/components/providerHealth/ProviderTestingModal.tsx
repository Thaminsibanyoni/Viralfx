import React, { useState, useEffect } from 'react';
import {
  Modal, Form, InputNumber, Select, Button, Space, Typography, Alert, Progress, Steps, Card, Descriptions, Table, Tag, Timeline, Result, Statistic, Row, Col, Tooltip, Badge, Tabs, } from 'antd';
import {
  ExperimentOutlined, PlayCircleOutlined, PauseCircleOutlined, StopOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, InfoCircleOutlined, ThunderboltOutlined, ClockCircleOutlined, LineChartOutlined, BarChartOutlined, } from '@ant-design/icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const {Title, Text, Paragraph} = Typography;
const {Step} = Steps;
const {TabPane} = Tabs;
const {Option} = Select;

export interface ProviderTest {
  id: string;
  providerId: string;
  testName: string;
  type: 'HEALTH_CHECK' | 'PERFORMANCE' | 'LOAD' | 'FAILOVER';
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'CANCELLED';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  results?: {
    latency: number;
    successRate: number;
    throughput: number;
    errorRate: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  logs: string[];
  metadata: Record<string, any>;
}

export interface ProviderHealthData {
  id: string;
  name: string;
  type: 'email' | 'sms' | 'push' | 'in_app' | 'webhook';
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'MAINTENANCE' | 'OFFLINE';
  region: string;
}

export interface TestConfiguration {
  testType: 'HEALTH_CHECK' | 'PERFORMANCE' | 'LOAD' | 'FAILOVER';
  messageCount: number;
  duration: number; // seconds
  concurrency: number;
  regions: string[];
  rampUpTime: number; // seconds
  testPayload: string;
  customHeaders?: Record<string, string>;
}

export interface ProviderTestingModalProps {
  visible: boolean;
  onCancel: () => void;
  provider: ProviderHealthData | null;
  onRunTest: (config: TestConfiguration) => Promise<void>;
  testHistory?: ProviderTest[];
  loading?: boolean;
}

const ProviderTestingModal: React.FC<ProviderTestingModalProps> = ({
  visible,
  onCancel,
  provider,
  onRunTest,
  testHistory = [],
  loading = false,
}) => {
  const [form] = Form.useForm();
  const [currentTest, setCurrentTest] = useState<ProviderTest | null>(null);
  const [testProgress, setTestProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [testLogs, setTestLogs] = useState<string[]>([]);
  const [realTimeMetrics, setRealTimeMetrics] = useState<any[]>([]);

  const testTypeDescriptions = {
    HEALTH_CHECK: 'Basic connectivity and health check',
    PERFORMANCE: 'Performance benchmark with response time measurements',
    LOAD: 'Load testing with configurable message volume',
    FAILOVER: 'Failover and recovery testing',
  };

  const getDefaultConfiguration = (testType: string): Partial<TestConfiguration> => {
    switch (testType) {
      case 'HEALTH_CHECK':
        return {
          messageCount: 5,
          duration: 30,
          concurrency: 1,
          regions: [provider?.region || 'us-east-1'],
          rampUpTime: 5,
          testPayload: JSON.stringify({ type: 'test', timestamp: new Date().toISOString() }),
        };
      case 'PERFORMANCE':
        return {
          messageCount: 100,
          duration: 120,
          concurrency: 5,
          regions: [provider?.region || 'us-east-1'],
          rampUpTime: 10,
          testPayload: JSON.stringify({ type: 'performance_test' }),
        };
      case 'LOAD':
        return {
          messageCount: 1000,
          duration: 300,
          concurrency: 10,
          regions: ['us-east-1', 'us-west-2'],
          rampUpTime: 30,
          testPayload: JSON.stringify({ type: 'load_test' }),
        };
      case 'FAILOVER':
        return {
          messageCount: 200,
          duration: 180,
          concurrency: 3,
          regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
          rampUpTime: 15,
          testPayload: JSON.stringify({ type: 'failover_test' }),
        };
      default:
        return {
          messageCount: 10,
          duration: 60,
          concurrency: 1,
          regions: [provider?.region || 'us-east-1'],
          rampUpTime: 5,
        };
    }
  };

  const handleTestTypeChange = (testType: string) => {
    const defaultConfig = getDefaultConfiguration(testType);
    form.setFieldsValue(defaultConfig);
  };

  const handleRunTest = async () => {
    try {
      const values = await form.validateFields();
      const config: TestConfiguration = {
        ...values,
        testPayload: values.testPayload || JSON.stringify({ type: 'test' }),
      };

      // Simulate test execution
      const newTest: ProviderTest = {
        id: `test_${Date.now()}`,
        providerId: provider?.id || '',
        testName: `${config.testType}_${new Date().toISOString()}`,
        type: config.testType,
        status: 'PENDING',
        startTime: new Date(),
        logs: [],
        metadata: config,
      };

      setCurrentTest(newTest);
      setCurrentStep(1);

      // Simulate test progress
      await simulateTestExecution(newTest, config);

    } catch (error) {
      console.error('Test execution failed:', error);
    }
  };

  const _simulateTestExecution = async (test: ProviderTest, config: TestConfiguration) => {
    // Update status to running
    setCurrentTest(prev => prev ? { ...prev, status: 'RUNNING' } : null);
    setCurrentStep(2);

    // Simulate progress
    const duration = config.duration * 1000; // Convert to milliseconds
    const interval = 1000; // Update every second
    const steps = duration / interval;

    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));

      const progress = (i / steps) * 100;
      setTestProgress(progress);

      // Simulate real-time metrics
      const newMetric = {
        time: new Date().toLocaleTimeString(),
        latency: Math.floor(Math.random() * 200) + 50,
        successRate: 95 + Math.random() * 5,
        throughput: Math.floor(Math.random() * 100) + 10,
      };
      setRealTimeMetrics(prev => [...prev.slice(-50), newMetric]);

      // Add logs
      const logs = [
        `Processing message ${i + 1}/${config.messageCount}`,
        `Current latency: ${newMetric.latency}ms`,
        `Success rate: ${newMetric.successRate.toFixed(2)}%`,
      ];
      setTestLogs(prev => [...prev, ...logs]);
    }

    // Complete test
    const finalResults = {
      latency: Math.floor(Math.random() * 150) + 50,
      successRate: 95 + Math.random() * 5,
      throughput: Math.floor(Math.random() * 100) + 10,
      errorRate: Math.random() * 5,
      averageResponseTime: Math.floor(Math.random() * 120) + 80,
      p95ResponseTime: Math.floor(Math.random() * 200) + 150,
      p99ResponseTime: Math.floor(Math.random() * 300) + 200,
    };

    const completedTest: ProviderTest = {
      ...test,
      status: Math.random() > 0.2 ? 'PASSED' : 'FAILED',
      endTime: new Date(),
      duration: config.duration,
      results: finalResults,
      logs: testLogs,
    };

    setCurrentTest(completedTest);
    setCurrentStep(3);
    setTestProgress(100);

    // Call the parent callback
    await onRunTest(config);
  };

  const handleCancelTest = () => {
    if (currentTest && currentTest.status === 'RUNNING') {
      setCurrentTest(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
      setCurrentStep(4);
    }
  };

  const resetTest = () => {
    setCurrentTest(null);
    setTestProgress(0);
    setCurrentStep(0);
    setTestLogs([]);
    setRealTimeMetrics([]);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Test Name',
      dataIndex: 'testName',
      key: 'testName',
      render: (text: string, record: ProviderTest) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.startTime.toLocaleString()}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => (
        <Tag color="blue">{type.replace('_', ' ')}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge
          status={status === 'PASSED' ? 'success' :
                 status === 'FAILED' ? 'error' :
                 status === 'RUNNING' ? 'processing' : 'default'}
          text={status}
        />
      ),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      render: (duration?: number, record: ProviderTest) => {
        if (!duration && record.endTime && record.startTime) {
          return `${Math.round((record.endTime.getTime() - record.startTime.getTime()) / 1000)}s`;
        }
        return duration ? `${duration}s` : '-';
      },
    },
    {
      title: 'Success Rate',
      key: 'successRate',
      render: (record: ProviderTest) => (
        record.results ? `${record.results.successRate.toFixed(2)}%` : '-'
      ),
    },
  ];

  return (
    <Modal
      title={
        <Space>
          <ExperimentOutlined />
          Provider Testing: {provider?.name}
        </Space>
      }
      open={visible}
      onCancel={() => {
        if (currentTest && currentTest.status === 'RUNNING') {
          Modal.confirm({
            title: 'Cancel Test?',
            content: 'A test is currently running. Are you sure you want to cancel?',
            onOk: () => {
              handleCancelTest();
              onCancel();
            },
          });
        } else {
          onCancel();
        }
      }}
      width={1000}
      footer={null}
      destroyOnClose
    >
      <Tabs activeKey={currentStep === 0 ? 'config' : 'execution'} >
        <TabPane tab="Test Configuration" key="config">
          <Form
            form={form}
            layout="vertical"
            initialValues={getDefaultConfiguration('HEALTH_CHECK')}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Test Type"
                  name="testType"
                  rules={[{ required: true, message: 'Please select test type' }]}
                >
                  <Select onChange={handleTestTypeChange}>
                    <Option value="HEALTH_CHECK">Health Check</Option>
                    <Option value="PERFORMANCE">Performance Test</Option>
                    <Option value="LOAD">Load Test</Option>
                    <Option value="FAILOVER">Failover Test</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Test Description">
                  <Text type="secondary">
                    {form.getFieldValue('testType') &&
                     testTypeDescriptions[form.getFieldValue('testType') as keyof typeof testTypeDescriptions]}
                  </Text>
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={8}>
                <Form.Item
                  label="Message Count"
                  name="messageCount"
                  rules={[{ required: true, message: 'Please enter message count' }]}
                >
                  <InputNumber min={1} max={10000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Duration (seconds)"
                  name="duration"
                  rules={[{ required: true, message: 'Please enter duration' }]}
                >
                  <InputNumber min={10} max={3600} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  label="Concurrency"
                  name="concurrency"
                  rules={[{ required: true, message: 'Please enter concurrency' }]}
                >
                  <InputNumber min={1} max={50} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="Test Regions"
                  name="regions"
                  rules={[{ required: true, message: 'Please select test regions' }]}
                >
                  <Select mode="multiple" placeholder="Select regions">
                    <Option value="us-east-1">US East</Option>
                    <Option value="us-west-2">US West</Option>
                    <Option value="eu-west-1">Europe</Option>
                    <Option value="ap-southeast-1">Asia Pacific</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Ramp-up Time (seconds)"
                  name="rampUpTime"
                >
                  <InputNumber min={0} max={300} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              label="Test Payload (JSON)"
              name="testPayload"
            >
              <Input.TextArea
                rows={4}
                placeholder="Enter test payload in JSON format"
              />
            </Form.Item>

            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleRunTest}
                  loading={currentTest?.status === 'RUNNING'}
                >
                  Start Test
                </Button>
                <Button onClick={resetTest}>
                  Reset
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </TabPane>

        <TabPane tab="Test Execution" key="execution" disabled={!currentTest}>
          {currentTest && (
            <Space direction="vertical" style={{ width: '100%' }}>
              {/* Test Steps */}
              <Steps current={currentStep} size="small">
                <Step title="Configured" icon={<CheckCircleOutlined />} />
                <Step title="Queued" icon={<ClockCircleOutlined />} />
                <Step
                  title="Running"
                  icon={currentTest.status === 'RUNNING' ? <LoadingOutlined /> : <ThunderboltOutlined />}
                />
                <Step
                  title="Completed"
                  icon={currentTest.status === 'PASSED' ? <CheckCircleOutlined /> :
                        currentTest.status === 'FAILED' ? <CloseCircleOutlined /> :
                        <CloseCircleOutlined />}
                />
              </Steps>

              {/* Progress */}
              {currentTest.status === 'RUNNING' && (
                <Card size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Space>
                      <Title level={5}>Test in Progress</Title>
                      <Badge status="processing" text="Running" />
                    </Space>
                    <Progress percent={testProgress} status="active" />
                    <Button
                      danger
                      icon={<StopOutlined />}
                      onClick={handleCancelTest}
                    >
                      Cancel Test
                    </Button>
                  </Space>
                </Card>
              )}

              {/* Real-time Metrics */}
              {realTimeMetrics.length > 0 && (
                <Card title="Real-time Metrics" size="small">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={realTimeMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <RechartsTooltip />
                      <Line type="monotone" dataKey="latency" stroke="#8884d8" name="Latency (ms)" />
                      <Line type="monotone" dataKey="successRate" stroke="#82ca9d" name="Success Rate (%)" />
                      <Line type="monotone" dataKey="throughput" stroke="#ffc658" name="Throughput (msg/s)" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              )}

              {/* Test Results */}
              {currentTest.results && (
                <Card title="Test Results" size="small">
                  <Row gutter={16}>
                    <Col span={6}>
                      <Statistic
                        title="Average Latency"
                        value={currentTest.results.averageResponseTime}
                        suffix="ms"
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Success Rate"
                        value={currentTest.results.successRate}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: currentTest.results.successRate >= 95 ? '#3f8600' : '#cf1322' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Throughput"
                        value={currentTest.results.throughput}
                        suffix="msg/s"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Col>
                    <Col span={6}>
                      <Statistic
                        title="Error Rate"
                        value={currentTest.results.errorRate}
                        precision={2}
                        suffix="%"
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Col>
                  </Row>

                  <Descriptions title="Detailed Metrics" size="small" column={2} style={{ marginTop: 16 }}>
                    <Descriptions.Item label="P95 Response Time">
                      {currentTest.results.p95ResponseTime}ms
                    </Descriptions.Item>
                    <Descriptions.Item label="P99 Response Time">
                      {currentTest.results.p99ResponseTime}ms
                    </Descriptions.Item>
                    <Descriptions.Item label="Total Duration">
                      {currentTest.duration}s
                    </Descriptions.Item>
                    <Descriptions.Item label="Status">
                      <Badge
                        status={currentTest.status === 'PASSED' ? 'success' :
                               currentTest.status === 'FAILED' ? 'error' : 'default'}
                        text={currentTest.status}
                      />
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )}

              {/* Test Logs */}
              {testLogs.length > 0 && (
                <Card title="Test Logs" size="small">
                  <div style={{
                    height: 200,
                    overflowY: 'auto',
                    backgroundColor: '#f5f5f5',
                    padding: 12,
                    fontFamily: 'monospace',
                    fontSize: '12px'
                  }}>
                    {testLogs.map((log, index) => (
                      <div key={index} style={{ marginBottom: 4 }}>
                        [{new Date().toLocaleTimeString()}] {log}
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </Space>
          )}

          {!currentTest && (
            <Result
              icon={<InfoCircleOutlined />}
              title="No Test Running"
              subTitle="Configure and start a test to see execution details"
            />
          )}
        </TabPane>

        <TabPane tab="Test History" key="history">
          <Table
            columns={columns}
            dataSource={testHistory}
            rowKey="id"
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
            }}
            size="small"
          />
        </TabPane>
      </Tabs>
    </Modal>
  );
};

export default ProviderTestingModal;