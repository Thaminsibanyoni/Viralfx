import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Button, Tag, Statistic, Space, Badge, message, Input, Select, Empty, Spin, } from 'antd';
import {
  ApiOutlined, ThunderboltOutlined, TrophyOutlined, BarChartOutlined, SearchOutlined, CodeOutlined, RocketOutlined, CheckCircleOutlined, } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiMarketplace, { ApiProduct } from '../../services/api/api-marketplace.api';
import styles from './Overview.module.scss';

const {Title, Paragraph, Text} = Typography;
const {Search} = Input;
const {Option} = Select;

const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // Fetch products
  const {data: productsData, isLoading: productsLoading, error: productsError, } = useQuery({
    queryKey: ['api-products', categoryFilter],
    queryFn: () => apiMarketplace.products.getProducts({
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      active: true,
    }),
  });

  // Fetch platform statistics
  const {data: statsData, isLoading: statsLoading, } = useQuery({
    queryKey: ['api-marketplace-stats'],
    queryFn: () => apiMarketplace.admin.getPlatformStats(),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Code snippets
  const codeSnippets = {
    javascript: `const response = await fetch('https://api.viralfx.com/smi/v1/score?symbol=V:GLB:POL:TRMPTAX', {
  headers: {
    'x-api-key': 'your-api-key'
  }
});
const data = await response.json();`,

    python: `import requests

headers = {'x-api-key': 'your-api-key'}
response = requests.get(
  'https://api.viralfx.com/smi/v1/score?symbol=V:GLB:POL:TRMPTAX', headers=headers
)
data = response.json()`, curl: `curl -X GET "https://api.viralfx.com/smi/v1/score?symbol=V:GLB:POL:TRMPTAX" \\
     -H "x-api-key: your-api-key"`, };

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'SMI', label: 'Social Mood Index' },
    { value: 'VTS', label: 'VTS Symbol Feed' },
    { value: 'VIRAL_SCORE', label: 'ViralScore' },
    { value: 'SENTIMENT', label: 'Sentiment Analysis' },
  ];

  const formatPrice = (price: number | null) => {
    if (price === null) return 'Custom';
    return `R${price.toLocaleString()}`;
  };

  const filteredProducts = productsData?.products?.filter((product: ApiProduct) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleGetStarted = (product: ApiProduct) => {
    navigate('/developers/keys', { state: { selectedProduct: product } });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('Code copied to clipboard!');
    });
  };

  if (productsLoading || statsLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Spin size="large" />
        <Text>Loading API Marketplace...</Text>
      </div>
    );
  }

  if (productsError) {
    return (
      <div className={styles.errorContainer}>
        <Empty
          description="Failed to load API products"
          image={Empty.PRESENTED_IMAGE_ERROR}
        >
          <Button type="primary" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </Empty>
      </div>
    );
  }

  return (
    <div className={styles.overview}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <Title level={1} className={styles.heroTitle}>
            <ApiOutlined className={styles.heroIcon} />
            API Marketplace
          </Title>
          <Paragraph className={styles.heroDescription}>
            Access powerful social momentum data and analytics through our comprehensive API suite.
            Build innovative applications with real-time sentiment analysis, trend prediction, and market intelligence.
          </Paragraph>
          <Space size="large" className={styles.heroStats}>
            <Statistic
              title="Total API Calls Today"
              value={statsData?.totalCallsToday || 0}
              prefix={<ThunderboltOutlined />}
              formatter={(value) => `${Number(value).toLocaleString()}`}
            />
            <Statistic
              title="Active Developers"
              value={statsData?.activeDevelopers || 0}
              prefix={<TrophyOutlined />}
            />
            <Statistic
              title="Platform Uptime"
              value={99.9}
              suffix="%"
              prefix={<BarChartOutlined />}
            />
          </Space>
        </div>
      </div>

      {/* Search and Filter */}
      <div className={styles.searchSection}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12}>
            <Search
              placeholder="Search APIs..."
              allowClear
              enterButton={<SearchOutlined />}
              size="large"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              className={styles.categoryFilter}
              size="large"
              style={{ width: '100%' }}
            >
              {categories.map(cat => (
                <Option key={cat.value} value={cat.value}>
                  {cat.label}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={() => navigate('/developers/keys')}
              className={styles.getStartedButton}
            >
              Get Started
            </Button>
          </Col>
        </Row>
      </div>

      {/* API Products Grid */}
      <div className={styles.productsSection}>
        <Title level={2} className={styles.sectionTitle}>
          Available APIs
        </Title>

        <Row gutter={[24, 24]}>
          {filteredProducts.map((product: ApiProduct) => (
            <Col xs={24} lg={12} xl={8} key={product.id}>
              <Card
                className={styles.productCard}
                hoverable
                actions={[
                  <Button
                    type="primary"
                    icon={<RocketOutlined />}
                    onClick={() => handleGetStarted(product)}
                  >
                    Get API Key
                  </Button>,
                  <Button
                    icon={<CodeOutlined />}
                    onClick={() => navigate(`/developers/docs?product=${product.slug}`)}
                  >
                    View Docs
                  </Button>,
                ]}
              >
                <div className={styles.productHeader}>
                  <div className={styles.productIcon}>
                    <ApiOutlined />
                  </div>
                  <div className={styles.productInfo}>
                    <Title level={4} className={styles.productName}>
                      {product.name}
                    </Title>
                    <Tag color="blue">{product.category}</Tag>
                  </div>
                </div>

                <Paragraph className={styles.productDescription}>
                  {product.description}
                </Paragraph>

                {/* Features */}
                {product.features && product.features.length > 0 && (
                  <div className={styles.features}>
                    {product.features.slice(0, 3).map((feature, index) => (
                      <div key={index} className={styles.feature}>
                        <CheckCircleOutlined className={styles.featureIcon} />
                        <Text>{feature}</Text>
                      </div>
                    ))}
                    {product.features.length > 3 && (
                      <Text type="secondary">
                        +{product.features.length - 3} more features
                      </Text>
                    )}
                  </div>
                )}

                {/* Pricing */}
                <div className={styles.pricing}>
                  <Text strong>Starting at:</Text>
                  <Badge
                    count={formatPrice(product.plans?.[0]?.monthlyFee || null)}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                  <Text type="secondary">/month</Text>
                </div>

                {/* Quick Code Example */}
                <div className={styles.codeExample}>
                  <Text code>{`// ${product.name} Example`}</Text>
                  <Text code className={styles.codeSnippet}>
                    {`GET /${product.slug.toLowerCase()}/v1/score`}
                  </Text>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {filteredProducts.length === 0 && (
          <Empty
            description="No APIs found matching your criteria"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button onClick={() => {
              setSearchTerm('');
              setCategoryFilter('all');
            }}>
              Clear Filters
            </Button>
          </Empty>
        )}
      </div>

      {/* Quick Start Section */}
      <div className={styles.quickStartSection}>
        <Title level={2} className={styles.sectionTitle}>
          Quick Start
        </Title>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card className={styles.quickStartCard}>
              <Title level={4}>
                <CodeOutlined /> JavaScript
              </Title>
              <pre className={styles.codeBlock}>
                <code>{codeSnippets.javascript}</code>
              </pre>
              <Button
                size="small"
                onClick={() => copyToClipboard(codeSnippets.javascript)}
              >
                Copy Code
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card className={styles.quickStartCard}>
              <Title level={4}>
                <CodeOutlined /> Python
              </Title>
              <pre className={styles.codeBlock}>
                <code>{codeSnippets.python}</code>
              </pre>
              <Button
                size="small"
                onClick={() => copyToClipboard(codeSnippets.python)}
              >
                Copy Code
              </Button>
            </Card>
          </Col>

          <Col xs={24} md={8}>
            <Card className={styles.quickStartCard}>
              <Title level={4}>
                <CodeOutlined /> cURL
              </Title>
              <pre className={styles.codeBlock}>
                <code>{codeSnippets.curl}</code>
              </pre>
              <Button
                size="small"
                onClick={() => copyToClipboard(codeSnippets.curl)}
              >
                Copy Code
              </Button>
            </Card>
          </Col>
        </Row>
      </div>

      {/* Developer Benefits */}
      <div className={styles.benefitsSection}>
        <Title level={2} className={styles.sectionTitle}>
          Why Choose ViralFX APIs?
        </Title>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={6}>
            <Card className={styles.benefitCard}>
              <ThunderboltOutlined className={styles.benefitIcon} />
              <Title level={4}>Real-Time Data</Title>
              <Paragraph>
                Sub-second response times with WebSocket streaming for live market data
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card className={styles.benefitCard}>
              <TrophyOutlined className={styles.benefitIcon} />
              <Title level={4}>99.9% Uptime</Title>
              <Paragraph>
                Enterprise-grade reliability with comprehensive monitoring and failover systems
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card className={styles.benefitCard}>
              <BarChartOutlined className={styles.benefitIcon} />
              <Title level={4}>Advanced Analytics</Title>
              <Paragraph>
                Comprehensive usage analytics, monitoring, and custom reporting tools
              </Paragraph>
            </Card>
          </Col>

          <Col xs={24} md={6}>
            <Card className={styles.benefitCard}>
              <ApiOutlined className={styles.benefitIcon} />
              <Title level={4}>Easy Integration</Title>
              <Paragraph>
                Well-documented REST APIs with SDKs for popular programming languages
              </Paragraph>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default Overview;