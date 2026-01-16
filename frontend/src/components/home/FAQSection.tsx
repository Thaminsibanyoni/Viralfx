import React from 'react';
import { Collapse, Typography } from 'antd';
import { SecurityScanOutlined, DollarCircleOutlined, ThunderboltOutlined, SafetyCertificateOutlined } from '@ant-design/icons';

const { Text } = Typography;
const { Panel } = Collapse;

const FAQSection: React.FC = () => {
  const faqs = [
    {
      key: '1',
      question: 'How does ViralFX work?',
      answer: 'ViralFX monitors social media platforms in real-time to identify trending topics and viral content. Our AI-powered system analyzes this data to predict potential market movements and trading opportunities. You can link your existing broker account and receive actionable trading signals based on social sentiment analysis.',
    },
    {
      key: '2',
      question: 'What markets can I trade?',
      answer: 'ViralFX supports trading across multiple asset classes including stocks, forex, commodities, cryptocurrencies, and indices. Our platform focuses on South African and international markets, with particular strength in identifying opportunities from viral social media trends affecting global markets.',
    },
    {
      key: '3',
      question: 'Is ViralFX FSCA authorized?',
      answer: 'Yes, ViralFX is fully authorized and regulated by the Financial Sector Conduct Authority (FSCA) of South Africa. We adhere to strict regulatory standards to ensure the safety and security of our users\' funds and personal information.',
    },
    {
      key: '4',
      question: 'How do I link my broker account?',
      answer: 'Linking your broker account is simple. After signing up, navigate to the Settings section, select "Linked Accounts", and follow the secure connection process. We support integration with major brokers through API connections. Your login credentials are never stored on our servers.',
    },
    {
      key: '5',
      question: 'What are the fees?',
      answer: 'ViralFX offers transparent pricing with no hidden fees. We charge a monthly subscription based on your chosen plan. Brokerage fees and spreads are determined by your linked broker account, not ViralFX. Contact our sales team for detailed pricing information.',
    },
    {
      key: '6',
      question: 'Is there a free trial or demo account?',
      answer: 'Currently, we do not offer a free trial or demo account. We focus on providing premium trading signals and analysis for serious traders. You can start with our basic plan to experience the platform\'s capabilities.',
    },
    {
      key: '7',
      question: 'How is social media data analyzed?',
      answer: 'Our system continuously monitors social media platforms including X (formerly Twitter), TikTok, Instagram, and YouTube. Using natural language processing and machine learning algorithms, we analyze sentiment, engagement metrics, and trending topics to identify potential trading opportunities before they become mainstream.',
    },
    {
      key: '8',
      question: 'How accurate are the trading signals?',
      answer: 'While no trading system can guarantee profits, our AI-powered signals have historically shown a high success rate. We provide probability scores and risk assessments with each signal, empowering you to make informed trading decisions. Past performance does not guarantee future results.',
    },
  ];

  return (
    <Collapse
      accordion
      style={{
        background: 'rgba(26, 26, 28, 0.8)',
        border: '1px solid rgba(255, 179, 0, 0.2)',
        borderRadius: '16px',
      }}
      expandIconPosition="end"
    >
      {faqs.map((faq) => (
        <Panel
          key={faq.key}
          header={
            <Text style={{ color: '#FFB300', fontSize: '16px', fontWeight: '500' }}>
              {faq.question}
            </Text>
          }
          style={{
            background: 'rgba(26, 26, 28, 0.8)',
            borderBottom: '1px solid rgba(255, 179, 0, 0.1)',
          }}
        >
          <Text style={{ color: '#B8BCC8', fontSize: '15px', lineHeight: '1.8' }}>
            {faq.answer}
          </Text>
        </Panel>
      ))}
    </Collapse>
  );
};

export default FAQSection;
