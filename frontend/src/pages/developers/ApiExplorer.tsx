import React, { useState } from 'react';
import { Card, Typography, Form, Input, Button, Select, Space, message, Tabs, Tag, Collapse } from 'antd';
import { SendOutlined, CodeOutlined, CopyOutlined, ApiOutlined } from '@ant-design/icons';

const {Title, Paragraph, Text} = Typography;
const {TextArea} = Input;
const {Option} = Select;
const {TabPane} = Tabs;
const {Panel} = Collapse;

const ApiExplorer: React.FC = () => {
  const [form] = Form.useForm();
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [requestDetails, setRequestDetails] = useState<any>(null);

  const apiEndpoints = [
    {
      category: 'Social Mood Index',
      endpoints: [
        {
          path: '/smi/v1/score',
          method: 'GET',
          description: 'Get current sentiment score for a symbol',
          params: { symbol: 'string (required)' },
        },
        {
          path: '/smi/v1/history',
          method: 'GET',
          description: 'Get historical sentiment scores',
          params: { symbol: 'string (required)', days: 'number (optional, default: 30)' },
        },
      ],
    },
    {
      category: 'VTS Symbol Feed',
      endpoints: [
        {
          path: '/vts/v1/feed',
          method: 'GET',
          description: 'Get VTS symbol feed data',
          params: { symbols: 'array (optional)', limit: 'number (optional, default: 50)' },
        },
        {
          path: '/vts/v1/search',
          method: 'GET',
          description: 'Search for trending symbols',
          params: { query: 'string (required)', limit: 'number (optional)' },
        },
      ],
    },
    {
      category: 'ViralScore',
      endpoints: [
        {
          path: '/viralscore/v1/predict',
          method: 'POST',
          description: 'Predict virality score for content',
          params: { content: 'string (required)', platform: 'string (optional)' },
        },
        {
          path: '/viralscore/v1/trending',
          method: 'GET',
          description: 'Get trending topics with viral scores',
          params: { category: 'string (optional)', limit: 'number (optional)' },
        },
      ],
    },
  ];

  const handleSendRequest = async (values: any) => {
    setLoading(true);
    setRequestDetails(values);

    try {
      const {endpoint, method, apiKey, parameters} = values;

      let parsedParams = {};
      if (parameters && parameters.trim()) {
        try {
          parsedParams = JSON.parse(parameters);
        } catch (e) {
          message.error('Invalid JSON in parameters field');
          setLoading(false);
          return;
        }
      }

      // Build URL with query parameters for GET requests
      let url = `${process.env.REACT_APP_API_URL || 'http://localhost:3000'}${endpoint}`;

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
      };

      if (method === 'GET' && Object.keys(parsedParams).length > 0) {
        const queryParams = new URLSearchParams(parsedParams as any);
        url += `?${queryParams.toString()}`;
      } else if (method === 'POST' && Object.keys(parsedParams).length > 0) {
        options.body = JSON.stringify(parsedParams);
      }

      const startTime = Date.now();
      const response = await fetch(url, options);
      const responseTime = Date.now() - startTime;

      let data;
      try {
        data = await response.json();
      } catch (e) {
        data = null;
      }

      setResponse({
        status: response.status,
        statusText: response.statusText,
        responseTime,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        success: response.ok,
      });

      if (!response.ok) {
        message.error(`Request failed: ${response.status} ${response.statusText}`);
      } else {
        message.success(`Request completed in ${responseTime}ms`);
      }
    } catch (error: any) {
      setResponse({
        status: 0,
        statusText: 'Network Error',
        responseTime: 0,
        error: error.message,
        success: false,
      });
      message.error('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const generateCodeSnippet = () => {
    const values = form.getFieldsValue();
    const {endpoint, method, apiKey, parameters} = values;

    const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';

    const snippets = {
      javascript: `// JavaScript/Node.js
const response = await fetch('${baseUrl}${endpoint}', {
  method: '${method}',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '${apiKey}'
  }${method === 'POST' && parameters ? `,
  body: JSON.stringify(${parameters})` : ''}
});

const data = await response.json();
console.log(data);`,

      python: `# Python
import requests

headers = {
    'Content-Type': 'application/json', 'x-api-key': '${apiKey}'
}

${method === 'POST' && parameters ? `data = ${parameters}` : `params = ${parameters || '{}'}`}

response = requests.${method.toLowerCase()}(
    '${baseUrl}${endpoint}', ${method === 'POST' ? 'json=data' : 'params=params'}, headers=headers
)

print(response.json())`, curl: `# cURL
curl -X ${method} '${baseUrl}${endpoint}' \\
  -H 'Content-Type: application/json' \\
  -H 'x-api-key: ${apiKey}'${method === 'POST' && parameters ? ` \\
  -d '${parameters}'` : ''}`, };

    return snippets;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('Code copied to clipboard!');
    });
  };

  const codeSnippets = generateCodeSnippet();

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>
        <ApiOutlined /> API Explorer
      </Title>
      <Paragraph>
        Test ViralFX APIs directly in your browser with our interactive API explorer. Use your existing API key or create a new one from the API Keys section.
      </Paragraph>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 400 }}>
          <Card title="Request Configuration">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSendRequest}
              initialValues={{
                endpoint: '/smi/v1/score',
                method: 'GET',
                parameters: '{"symbol": "V:GLB:POL:TRMPTAX"}',
              }}
            >
              <Form.Item
                label="Endpoint"
                name="endpoint"
                rules={[{ required: true, message: 'Please select an endpoint' }]}
              >
                <Select
                  placeholder="Select an endpoint"
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {apiEndpoints.map(category => (
                    <Select.OptGroup key={category.category} label={category.category}>
                      {category.endpoints.map(endpoint => (
                        <Option key={endpoint.path} value={endpoint.path}>
                          {endpoint.path} - {endpoint.description}
                        </Option>
                      ))}
                    </Select.OptGroup>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Method"
                name="method"
                rules={[{ required: true, message: 'Please select a method' }]}
              >
                <Select>
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="API Key"
                name="apiKey"
                rules={[{ required: true, message: 'Please enter your API key' }]}
              >
                <Input.Password placeholder="Your API key (vrfx_...)" />
              </Form.Item>

              <Form.Item
                label="Parameters (JSON)"
                name="parameters"
                rules={[{ validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  try {
                    JSON.parse(value);
                    return Promise.resolve();
                  } catch {
                    return Promise.reject(new Error('Invalid JSON format'));
                  }
                } }]}
              >
                <TextArea
                  rows={4}
                  placeholder='{"symbol": "V:GLB:POL:TRMPTAX"}'
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SendOutlined />}
                    loading={loading}
                  >
                    Send Request
                  </Button>
                  <Button icon={<CodeOutlined />}>
                    Generate Code
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          {response && (
            <Card title="Request Summary" style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <Text strong>Endpoint:</Text> {requestDetails?.method} {requestDetails?.endpoint}
                </div>
                <div>
                  <Text strong>Response Time:</Text> {response.responseTime}ms
                </div>
                <div>
                  <Text strong>Status:</Text>
                  <Tag color={response.success ? 'green' : 'red'}>
                    {response.status} {response.statusText}
                  </Tag>
                </div>
              </Space>
            </Card>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 400 }}>
          <Card title="Response">
            {response ? (
              <Tabs defaultActiveKey="body">
                <TabPane tab="Response Body" key="body">
                  <pre
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      overflow: 'auto',
                      maxHeight: 400,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(response.data || response.error, null, 2)}
                  </pre>
                </TabPane>
                <TabPane tab="Headers" key="headers">
                  <pre
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      overflow: 'auto',
                      maxHeight: 400,
                      fontSize: 12,
                    }}
                  >
                    {JSON.stringify(response.headers, null, 2)}
                  </pre>
                </TabPane>
              </Tabs>
            ) : (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>
                Send a request to see the response
              </div>
            )}
          </Card>

          <Card title="Code Examples" style={{ marginTop: 16 }}>
            <Collapse>
              <Panel header="JavaScript" key="javascript">
                <div style={{ position: 'relative' }}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    onClick={() => copyToClipboard(codeSnippets.javascript)}
                  >
                    Copy
                  </Button>
                  <pre
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {codeSnippets.javascript}
                  </pre>
                </div>
              </Panel>
              <Panel header="Python" key="python">
                <div style={{ position: 'relative' }}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    onClick={() => copyToClipboard(codeSnippets.python)}
                  >
                    Copy
                  </Button>
                  <pre
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {codeSnippets.python}
                  </pre>
                </div>
              </Panel>
              <Panel header="cURL" key="curl">
                <div style={{ position: 'relative' }}>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ position: 'absolute', top: 8, right: 8 }}
                    onClick={() => copyToClipboard(codeSnippets.curl)}
                  >
                    Copy
                  </Button>
                  <pre
                    style={{
                      background: '#f6f8fa',
                      padding: 16,
                      borderRadius: 6,
                      fontSize: 12,
                      fontFamily: 'monospace',
                      overflow: 'auto',
                      maxHeight: 200,
                    }}
                  >
                    {codeSnippets.curl}
                  </pre>
                </div>
              </Panel>
            </Collapse>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ApiExplorer;