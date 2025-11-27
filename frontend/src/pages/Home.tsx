import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Row, Col, Card, Typography, Button, Space, Statistic, Carousel, List, Avatar, Rate, Divider, message, } from 'antd';
import {
  ArrowRightOutlined, PlayCircleOutlined, SafetyCertificateOutlined, TrophyOutlined, RocketOutlined, SecurityScanOutlined, DollarCircleOutlined, ThunderboltOutlined, CheckCircleOutlined, StarOutlined, TwitterOutlined, InstagramOutlined, VideoCameraOutlined, } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';

const {Title, Text, Paragraph} = Typography;

interface StatProps {
  value: number;
  suffix?: string;
  prefix?: React.ReactNode;
  title: string;
}

interface FeatureCard {
  icon: React.ReactNode;
  title: string;
  description: string;
  link?: string;
}

interface Testimonial {
  avatar: string;
  name: string;
  role: string;
  content: string;
  rating: number;
  profit: string;
}

const Home: React.FC = () => {
  const [stats, setStats] = useState({
    activeTraders: 15420,
    totalVolume: 2847392,
    successRate: 87.3,
    viralSignals: 1247,
  });

  const [animatedStats, setAnimatedStats] = useState({
    activeTraders: 0,
    totalVolume: 0,
    successRate: 0,
    viralSignals: 0,
  });

  useEffect(() => {
    const duration = 2000;
    const steps = 60;
    const increment = {
      activeTraders: stats.activeTraders / steps,
      totalVolume: stats.totalVolume / steps,
      successRate: stats.successRate / steps,
      viralSignals: stats.viralSignals / steps,
    };

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      setAnimatedStats({
        activeTraders: Math.floor(increment.activeTraders * currentStep),
        totalVolume: Math.floor(increment.totalVolume * currentStep),
        successRate: Math.min(increment.successRate * currentStep, stats.successRate),
        viralSignals: Math.floor(increment.viralSignals * currentStep),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [stats]);

  const features: FeatureCard[] = [
    {
      icon: <ThunderboltOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: 'Real-time Trends',
      description: 'Track viral trends as they happen across social media platforms',
    },
    {
      icon: <RocketOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: 'AI-Powered Analysis',
      description: 'Advanced algorithms analyze sentiment and predict market movements',
    },
    {
      icon: <SafetyCertificateOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: 'Secure Trading',
      description: 'Bank-grade security with 2FA and encrypted transactions',
    },
    {
      icon: <SecurityScanOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: 'FSCA Compliant',
      description: 'Fully authorized by South Africa\'s Financial Sector Conduct Authority',
    },
    {
      icon: <DollarCircleOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: 'Multi-Currency',
      description: 'Trade in ZAR, USD, EUR, and other major currencies',
    },
    {
      icon: <TrophyOutlined style={{ fontSize: '32px', color: '#FFB300' }} />,
      title: '24/7 Support',
      description: 'Round-the-clock customer support from trading experts',
    },
  ];

  const testimonials: Testimonial[] = [
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
      name: 'John M.',
      role: 'Johannesburg',
      content: 'ViralFX helped me catch the meme stock trends early. Made 45% returns in just 2 weeks!',
      rating: 5,
      profit: '+45%',
    },
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
      name: 'Sarah P.',
      role: 'Cape Town',
      content: 'The AI analysis is incredibly accurate. I\'ve doubled my portfolio in 3 months.',
      rating: 5,
      profit: '+102%',
    },
    {
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
      name: 'Mike K.',
      role: 'Durban',
      content: 'Finally a trading platform that understands South African traders and trends!',
      rating: 4.5,
      profit: '+67%',
    },
  ];

  const howItWorks = [
    {
      title: 'Sign Up',
      description: 'Create your free account in minutes',
      icon: '1',
    },
    {
      title: 'Link Broker',
      description: 'Connect your existing broker account',
      icon: '2',
    },
    {
      title: 'Start Trading',
      description: 'Trade viral trends with AI-powered insights',
      icon: '3',
    },
  ];

  const StatCard: React.FC<StatProps> = ({ value, suffix, prefix, title }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Card
        style={{
          background: 'rgba(26, 26, 28, 0.8)',
          border: '1px solid rgba(255, 179, 0, 0.2)',
          borderRadius: '16px',
          textAlign: 'center',
          height: '100%',
        }}
        bodyStyle={{ padding: '24px' }}
      >
        <Statistic
          title={<Text style={{ color: '#B8BCC8' }}>{title}</Text>}
          value={value}
          suffix={suffix}
          prefix={prefix}
          valueStyle={{
            color: '#FFB300',
            fontSize: '32px',
            fontWeight: 'bold',
          }}
        />
      </Card>
    </motion.div>
  );

  const FeatureCardComponent: React.FC<FeatureCard> = ({ icon, title, description, link }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      viewport={{ once: true }}
    >
      <Card
        hoverable
        style={{
          background: 'rgba(26, 26, 28, 0.8)',
          border: '1px solid rgba(255, 179, 0, 0.2)',
          borderRadius: '16px',
          height: '100%',
          transition: 'all 0.3s ease',
        }}
        bodyStyle={{ padding: '32px' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-5px)';
          e.currentTarget.style.boxShadow = '0 10px 30px rgba(75, 0, 130, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.3)';
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>{icon}</div>
        <Title level={4} style={{ color: '#FFB300', textAlign: 'center', marginBottom: '12px' }}>
          {title}
        </Title>
        <Text style={{ color: '#B8BCC8', textAlign: 'center', display: 'block', lineHeight: '1.6' }}>
          {description}
        </Text>
      </Card>
    </motion.div>
  );

  return (
    <>
      <Helmet>
        <title>ViralFX - Trade Viral Trends | South Africa's Leading Trading Platform</title>
        <meta name="description" content="Trade viral trends with AI-powered insights. FSCA authorized trading platform for South African traders. Real-time social media analysis and market predictions." />
        <meta name="keywords" content="viral trading, AI trading, South Africa, FSCA, meme stocks, social trading, viral trends" />
      </Helmet>

      <div style={{ background: '#0E0E10', overflow: 'hidden' }}>
        {/* Hero Section */}
        <section
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            background: 'linear-gradient(135deg, #0E0E10 0%, #1A1A1C 50%, #2A1A3C 100%)',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'url("data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L75 25L100 50L75 75L50 50Z" fill="none" stroke="rgba(255,179,0,0.1)" stroke-width="1"/%3E%3C/svg%3E") repeat',
            opacity: 0.3,
          }} />

          <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px', position: 'relative', zIndex: 1 }}>
            <Row gutter={[64, 32]} align="middle">
              <Col xs={24} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <Title
                    level={1}
                    style={{
                      color: '#FFB300',
                      fontSize: 'clamp(36px, 8vw, 64px)',
                      fontWeight: 'bold',
                      marginBottom: '24px',
                      lineHeight: '1.2',
                    }}
                  >
                    Trade Viral Trends
                    <br />
                    Before Everyone Else
                  </Title>
                  <Paragraph
                    style={{
                      color: '#B8BCC8',
                      fontSize: '18px',
                      lineHeight: '1.8',
                      marginBottom: '32px',
                    }}
                  >
                    Join South Africa's most innovative trading platform. Leverage AI-powered analysis of social media trends to make smarter trading decisions.
                    <span style={{ color: '#FFB300', fontWeight: 'bold' }}> FSCA Authorized</span> and POPIA compliant.
                  </Paragraph>
                  <Space size="large" wrap>
                    <Link to="/register">
                      <Button
                        type="primary"
                        size="large"
                        style={{
                          background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                          border: 'none',
                          height: '56px',
                          padding: '0 32px',
                          fontSize: '16px',
                          fontWeight: '600',
                          boxShadow: '0 8px 24px rgba(75, 0, 130, 0.4)',
                        }}
                      >
                        Start Trading Free
                        <ArrowRightOutlined style={{ marginLeft: '8px' }} />
                      </Button>
                    </Link>
                    <Button
                      size="large"
                      icon={<PlayCircleOutlined />}
                      style={{
                        borderColor: '#FFB300',
                        color: '#FFB300',
                        height: '56px',
                        padding: '0 24px',
                      }}
                      onClick={() => message.info('Platform demo coming soon!')}
                    >
                      Watch Demo
                    </Button>
                  </Space>

                  <div style={{ marginTop: '32px' }}>
                    <Space split={<Divider type="vertical" style={{ borderColor: 'rgba(255, 179, 0, 0.3)' }} />}>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52C41A' }} />
                        <Text style={{ color: '#B8BCC8' }}>No credit card required</Text>
                      </Space>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52C41A' }} />
                        <Text style={{ color: '#B8BCC8' }}>ZAR 10,000 demo account</Text>
                      </Space>
                      <Space>
                        <CheckCircleOutlined style={{ color: '#52C41A' }} />
                        <Text style={{ color: '#B8BCC8' }}>Cancel anytime</Text>
                      </Space>
                    </Space>
                  </div>
                </motion.div>
              </Col>

              <Col xs={24} lg={12}>
                <motion.div
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  style={{ position: 'relative' }}
                >
                  <div
                    style={{
                      background: 'linear-gradient(135deg, rgba(75, 0, 130, 0.1) 0%, rgba(255, 179, 0, 0.1) 100%)',
                      borderRadius: '20px',
                      padding: '2px',
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(26, 26, 28, 0.9)',
                        borderRadius: '18px',
                        padding: '40px',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '24px',
                        marginBottom: '32px'
                      }}>
                        <div>
                          <TwitterOutlined style={{ fontSize: '32px', color: '#1DA1F2' }} />
                          <div style={{ fontSize: '12px', color: '#B8BCC8', marginTop: '4px' }}>Twitter</div>
                        </div>
                        <div>
                          <InstagramOutlined style={{ fontSize: '32px', color: '#E4405F' }} />
                          <div style={{ fontSize: '12px', color: '#B8BCC8', marginTop: '4px' }}>Instagram</div>
                        </div>
                        <div>
                          <VideoCameraOutlined style={{ fontSize: '32px', color: '#000000' }} />
                          <div style={{ fontSize: '12px', color: '#B8BCC8', marginTop: '4px' }}>TikTok</div>
                        </div>
                      </div>

                      <Title level={3} style={{ color: '#FFB300', marginBottom: '16px' }}>
                        Real-time Trend Analysis
                      </Title>
                      <Text style={{ color: '#B8BCC8', fontSize: '16px', display: 'block', marginBottom: '24px' }}>
                        Monitor trending topics across social platforms and get AI-powered trading signals
                      </Text>

                      <div style={{
                        background: 'rgba(75, 0, 130, 0.2)',
                        borderRadius: '12px',
                        padding: '16px',
                        border: '1px solid rgba(255, 179, 0, 0.2)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text style={{ color: '#B8BCC8' }}>Trending Now</Text>
                          <Text style={{ color: '#52C41A', fontWeight: 'bold' }}>▲ 247%</Text>
                        </div>
                        <div style={{ color: '#FFB300', fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>
                          #GameStockMeme
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </Col>
            </Row>
          </div>
        </section>

        {/* Stats Section */}
        <section style={{ padding: '80px 20px', background: '#1A1A1C' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Row gutter={[32, 32]}>
              <Col xs={12} sm={6}>
                <StatCard
                  value={animatedStats.activeTraders.toLocaleString()}
                  title="Active Traders"
                  prefix={<StarOutlined />}
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  value={`R${(animatedStats.totalVolume / 1000000).toFixed(1)}M`}
                  title="Total Volume"
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  value={animatedStats.successRate}
                  suffix="%"
                  title="Success Rate"
                />
              </Col>
              <Col xs={12} sm={6}>
                <StatCard
                  value={animatedStats.viralSignals}
                  title="Viral Signals"
                  prefix={<ThunderboltOutlined />}
                />
              </Col>
            </Row>
          </div>
        </section>

        {/* Features Section */}
        <section style={{ padding: '80px 20px', background: '#0E0E10' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              style={{ textAlign: 'center', marginBottom: '64px' }}
            >
              <Title level={2} style={{ color: '#FFB300', marginBottom: '16px' }}>
                Why Choose ViralFX?
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '18px' }}>
                Cutting-edge technology combined with South African market expertise
              </Text>
            </motion.div>

            <Row gutter={[32, 32]}>
              {features.map((feature, index) => (
                <Col xs={24} sm={12} lg={8} key={index}>
                  <FeatureCardComponent {...feature} />
                </Col>
              ))}
            </Row>
          </div>
        </section>

        {/* How It Works Section */}
        <section style={{ padding: '80px 20px', background: '#1A1A1C' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              style={{ textAlign: 'center', marginBottom: '64px' }}
            >
              <Title level={2} style={{ color: '#FFB300', marginBottom: '16px' }}>
                How It Works
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '18px' }}>
                Start trading viral trends in 3 simple steps
              </Text>
            </motion.div>

            <Row gutter={[32, 32]} align="middle">
              {howItWorks.map((step, index) => (
                <Col xs={24} md={8} key={index}>
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    style={{ textAlign: 'center' }}
                  >
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 24px',
                        fontSize: '32px',
                        fontWeight: 'bold',
                        color: 'white',
                      }}
                    >
                      {step.icon}
                    </div>
                    <Title level={4} style={{ color: '#FFB300', marginBottom: '12px' }}>
                      {step.title}
                    </Title>
                    <Text style={{ color: '#B8BCC8', fontSize: '16px' }}>
                      {step.description}
                    </Text>
                  </motion.div>
                </Col>
              ))}
            </Row>

            <div style={{ textAlign: 'center', marginTop: '48px' }}>
              <Link to="/register">
                <Button
                  type="primary"
                  size="large"
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                    height: '56px',
                    padding: '0 32px',
                    fontSize: '16px',
                    fontWeight: '600',
                    boxShadow: '0 8px 24px rgba(75, 0, 130, 0.4)',
                  }}
                >
                  Get Started Now
                  <ArrowRightOutlined style={{ marginLeft: '8px' }} />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section style={{ padding: '80px 20px', background: '#0E0E10' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
              style={{ textAlign: 'center', marginBottom: '64px' }}
            >
              <Title level={2} style={{ color: '#FFB300', marginBottom: '16px' }}>
                What Our Traders Say
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '18px' }}>
                Join thousands of successful South African traders
              </Text>
            </motion.div>

            <Row gutter={[32, 32]}>
              <Col xs={24} lg={8}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card
                    style={{
                      background: 'rgba(26, 26, 28, 0.8)',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      borderRadius: '16px',
                      height: '100%',
                    }}
                    bodyStyle={{ padding: '32px' }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <Avatar size={64} src={testimonials[0].avatar} />
                      <Title level={5} style={{ color: '#FFB300', margin: '12px 0 4px' }}>
                        {testimonials[0].name}
                      </Title>
                      <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                        {testimonials[0].role}
                      </Text>
                    </div>
                    <Rate disabled value={testimonials[0].rating} style={{ color: '#FFB300', marginBottom: '16px' }} />
                    <Text style={{ color: '#B8BCC8', display: 'block', lineHeight: '1.6', marginBottom: '16px' }}>
                      "{testimonials[0].content}"
                    </Text>
                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: '#52C41A', fontSize: '18px', fontWeight: 'bold' }}>
                        {testimonials[0].profit}
                      </Text>
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} lg={8}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  viewport={{ once: true }}
                >
                  <Card
                    style={{
                      background: 'rgba(26, 26, 28, 0.8)',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      borderRadius: '16px',
                      height: '100%',
                    }}
                    bodyStyle={{ padding: '32px' }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <Avatar size={64} src={testimonials[1].avatar} />
                      <Title level={5} style={{ color: '#FFB300', margin: '12px 0 4px' }}>
                        {testimonials[1].name}
                      </Title>
                      <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                        {testimonials[1].role}
                      </Text>
                    </div>
                    <Rate disabled value={testimonials[1].rating} style={{ color: '#FFB300', marginBottom: '16px' }} />
                    <Text style={{ color: '#B8BCC8', display: 'block', lineHeight: '1.6', marginBottom: '16px' }}>
                      "{testimonials[1].content}"
                    </Text>
                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: '#52C41A', fontSize: '18px', fontWeight: 'bold' }}>
                        {testimonials[1].profit}
                      </Text>
                    </div>
                  </Card>
                </motion.div>
              </Col>

              <Col xs={24} lg={8}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  viewport={{ once: true }}
                >
                  <Card
                    style={{
                      background: 'rgba(26, 26, 28, 0.8)',
                      border: '1px solid rgba(255, 179, 0, 0.2)',
                      borderRadius: '16px',
                      height: '100%',
                    }}
                    bodyStyle={{ padding: '32px' }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <Avatar size={64} src={testimonials[2].avatar} />
                      <Title level={5} style={{ color: '#FFB300', margin: '12px 0 4px' }}>
                        {testimonials[2].name}
                      </Title>
                      <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                        {testimonials[2].role}
                      </Text>
                    </div>
                    <Rate disabled value={testimonials[2].rating} style={{ color: '#FFB300', marginBottom: '16px' }} />
                    <Text style={{ color: '#B8BCC8', display: 'block', lineHeight: '1.6', marginBottom: '16px' }}>
                      "{testimonials[2].content}"
                    </Text>
                    <div style={{ textAlign: 'center' }}>
                      <Text style={{ color: '#52C41A', fontSize: '18px', fontWeight: 'bold' }}>
                        {testimonials[2].profit}
                      </Text>
                    </div>
                  </Card>
                </motion.div>
              </Col>
            </Row>
          </div>
        </section>

        {/* CTA Section */}
        <section style={{ padding: '100px 20px', background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)' }}>
          <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              viewport={{ once: true }}
            >
              <Title level={2} style={{ color: 'white', marginBottom: '24px', fontSize: 'clamp(32px, 6vw, 48px)' }}>
                Ready to Trade Viral Trends?
              </Title>
              <Text style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '20px', display: 'block', marginBottom: '40px', lineHeight: '1.6' }}>
                Join thousands of South African traders who are already profiting from viral market movements.
                Start with a free demo account and upgrade when you're ready.
              </Text>
              <Space size="large">
                <Link to="/register">
                  <Button
                    size="large"
                    style={{
                      background: '#FFB300',
                      border: 'none',
                      color: '#0E0E10',
                      height: '56px',
                      padding: '0 40px',
                      fontSize: '16px',
                      fontWeight: '600',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                    }}
                  >
                    Start Free Trial
                  </Button>
                </Link>
                <Link to="/markets">
                  <Button
                    size="large"
                    ghost
                    style={{
                      borderColor: 'white',
                      color: 'white',
                      height: '56px',
                      padding: '0 32px',
                      fontSize: '16px',
                      fontWeight: '600',
                    }}
                  >
                    Explore Markets
                  </Button>
                </Link>
              </Space>

              <div style={{ marginTop: '32px' }}>
                <Text style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
                  No credit card required • ZAR 10,000 demo account • Cancel anytime
                </Text>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;