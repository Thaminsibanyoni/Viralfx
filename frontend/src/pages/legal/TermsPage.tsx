import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Anchor, Button, Space, Breadcrumb, message, Divider, } from 'antd';
import {
  FileTextOutlined, DownloadOutlined, PrinterOutlined, SafetyCertificateOutlined, DollarCircleOutlined, UserOutlined, SecurityScanOutlined, TeamOutlined, } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';

const {Title, Text, Paragraph} = Typography;
const {Link: AnchorLink} = Anchor;

interface TermsSection {
  id: string;
  title: string;
  content: string;
}

const TermsPage: React.FC = () => {
  const [termsContent, setTermsContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const lastUpdated = '2024-11-15';

  const termsSections: TermsSection[] = [
    {
      id: 'introduction',
      title: '1. Introduction',
      content: `
Welcome to ViralFX ("ViralFX," "we," "us," or "our"), South Africa's premier viral trend trading platform.
These Terms of Service ("Terms") govern your use of our trading platform, website, and related services
(collectively, the "Service"). By accessing or using our Service, you agree to be bound by these Terms,
our Privacy Policy, and any other legal agreements referenced herein.

ViralFX is authorized and regulated by the Financial Sector Conduct Authority (FSCA) of South Africa,
operating under license number [FSCA-LICENSE-NUMBER]. Our platform is designed specifically for
South African traders and complies with all applicable South African laws and regulations, including
the Financial Markets Act and POPIA.
      `.trim(),
    },
    {
      id: 'user-accounts',
      title: '2. User Accounts',
      content: `
### 2.1 Account Creation and Eligibility
- **Age Requirement**: You must be at least 18 years old to create an account with ViralFX
- **South African Residents**: Our services are available to South African residents only
- **KYC Verification**: All users must complete Know Your Customer (KYC) verification
- **One Account Per Person**: Each individual may maintain only one ViralFX account

### 2.2 Account Responsibilities
- You are responsible for maintaining the confidentiality of your account credentials
- You must notify us immediately of any unauthorized use of your account
- You are responsible for all activities that occur under your account
- You must provide accurate, current, and complete information during registration

### 2.3 Account Suspension and Termination
We reserve the right to suspend or terminate your account:
- For violation of these Terms
- For suspicious or fraudulent activities
- For failure to complete required verification
- At our discretion with reasonable notice
      `.trim(),
    },
    {
      id: 'trading-rules',
      title: '3. Trading Rules and Regulations',
      content: `
### 3.1 General Trading Guidelines
- **Risk Acknowledgment**: Trading viral trends involves significant risk and may result in substantial losses
- **Market Volatility**: Viral markets can be extremely volatile and change rapidly
- **No Guaranteed Profits**: We do not guarantee any trading results or profits
- **Educational Content Only**: Our analysis tools and content are for educational purposes only

### 3.2 Prohibited Trading Activities
- **Market Manipulation**: Any attempt to manipulate viral trends or market sentiment
- **Insider Trading**: Using non-public information for trading advantage
- **Automated Trading**: Unauthorized algorithmic or automated trading systems
- **Cross-Border Trading**: Trading from jurisdictions where our services are not licensed

### 3.3 FSCA Compliance
- **Risk Warnings**: All trading activities must comply with FSCA risk warning requirements
- **Capital Requirements**: Traders must maintain sufficient capital for margin requirements
- **Position Limits**: Adherence to position limits as prescribed by FSCA regulations
- **Reporting Obligations**: Compliance with all FSCA reporting and record-keeping requirements
      `.trim(),
    },
    {
      id: 'fees',
      title: '4. Fees and Charges',
      content: `
### 4.1 Trading Fees
- **Commission Structure**: Our commission is [X.XX]% per trade
- **Spread Fees**: Bid-ask spreads apply to all trades
- **Withdrawal Fees**: Bank withdrawals: R50, Crypto withdrawals: Network fee + 0.5%
- **Inactivity Fees**: R100 monthly after 6 months of inactivity

### 4.2 Payment Processing
- **Deposit Methods**: EFT, Credit Card (3% fee), Cryptocurrency (1% fee)
- **Withdrawal Methods**: Bank EFT, Cryptocurrency
- **Processing Times**: Deposits: 1-2 business days, Withdrawals: 24-48 hours
- **Currency Conversion**: 2.5% fee for non-ZAR transactions

### 4.3 Fee Transparency
All fees are clearly displayed before transaction confirmation. No hidden fees will be charged.
We reserve the right to modify our fee structure with 30 days' notice to users.
      `.trim(),
    },
    {
      id: 'prohibited-activities',
      title: '5. Prohibited Activities',
      content: `
### 5.1 Platform Misuse
- **False Information**: Providing false or misleading information during registration or trading
- **System Abuse**: Any attempt to compromise, disrupt, or overload our systems
- **Unauthorized Access**: Attempting to gain unauthorized access to our systems or other user accounts
- **Data Scraping**: Unauthorized collection or use of platform data

### 5.2 Financial Crimes
- **Money Laundering**: Use of our platform for money laundering activities
- **Terrorist Financing**: Any connection to terrorist financing activities
- **Fraud**: Intentional deception for financial gain
- **Sanctions Violations**: Trading with or on behalf of sanctioned individuals or entities

### 5.3 Intellectual Property
- **Copyright Infringement**: Unauthorized use of copyrighted material on our platform
- **Trademark Violations**: Unauthorized use of trademarks or service marks
- **Reverse Engineering**: Attempting to reverse engineer our platform or systems
- **Competitive Services**: Using our platform to develop competing services
      `.trim(),
    },
    {
      id: 'intellectual-property',
      title: '6. Intellectual Property Rights',
      content: `
### 6.1 Platform Ownership
All intellectual property rights in the ViralFX platform, including but not limited to:
- Software code and algorithms
- Viral trend analysis methodologies
- Database structures and data compilations
- User interface designs
- Trademarks, logos, and branding

are owned exclusively by ViralFX (Pty) Ltd. and are protected by South African and international law.

### 6.2 User Content
- **License Grant**: By posting content on our platform, you grant us a non-exclusive, royalty-free license to use, modify, and display your content
- **User Responsibility**: You retain ownership of content you create but are responsible for its legality
- **Platform Content**: Analysis, reports, and insights generated by our platform remain our property
- **Third-Party Content**: We respect third-party intellectual property rights and will remove infringing content upon notice

### 6.3 Open Source Components
Our platform incorporates open-source software under their respective licenses.
Users may access the source code of these components as required by their licenses.
      `.trim(),
    },
    {
      id: 'liability-limitation',
      title: '7. Liability Limitation and Disclaimers',
      content: `
### 7.1 Financial Risk Disclaimer
- **High Risk Warning**: Trading viral trends involves substantial risk of loss
- **Past Performance**: Past performance is not indicative of future results
- **Market Volatility**: Viral markets can be extremely unpredictable
- **Total Loss Risk**: You may lose your entire investment

### 7.2 Service Limitations
- **Technical Issues**: We are not liable for losses due to technical failures, internet outages, or system maintenance
- **Market Data**: While we strive for accuracy, we cannot guarantee the completeness or timeliness of market data
- **Third-Party Services**: We are not liable for failures of third-party services, including brokers and payment processors
- **Force Majeure**: We are not liable for losses due to events beyond our reasonable control

### 7.3 Limitation of Damages
To the fullest extent permitted by law, our total liability for any claims related to our Service
shall not exceed the amount of fees you have paid to us in the six (6) months preceding the claim.
      `.trim(),
    },
    {
      id: 'dispute-resolution',
      title: '8. Dispute Resolution',
      content: `
### 8.1 Governing Law
These Terms and any disputes arising from them shall be governed by and construed in accordance
with the laws of the Republic of South Africa, without regard to its conflict of laws principles.

### 8.2 Jurisdiction
You agree that any legal action or proceeding arising under these Terms shall be brought exclusively
in the courts of the Republic of South Africa, specifically the Gauteng Division of the High Court.

### 8.3 Arbitration
Before initiating any legal proceedings, you agree to attempt to resolve any disputes through
binding arbitration administered by the Arbitration Foundation of Southern Africa (AFSA)
under its Commercial Arbitration Rules.

### 8.4 Class Action Waiver
You agree to resolve any disputes with us on an individual basis and waive any right to
participate in a class action, class arbitration, or other representative proceeding.
      `.trim(),
    },
    {
      id: 'governing-law',
      title: '9. Regulatory Compliance',
      content: `
### 9.1 FSCA Regulations
ViralFX operates in full compliance with:
- **Financial Markets Act, 2012**: Act 19 of 2012
- **Financial Advisory and Intermediary Services Act, 2002**: Act 37 of 2002
- **Protection of Personal Information Act, 2013**: Act 4 of 2013
- **Financial Intelligence Centre Act, 2001**: Act 38 of 2001

### 9.2 Consumer Protection
- **FAIS Act Compliance**: All financial advice and intermediary services comply with FAIS requirements
- **Fit and Proper Requirements**: Our representatives meet all Fit and Proper requirements
- **Disclosure Requirements**: Full disclosure of all fees, risks, and conflicts of interest
- **Complaints Handling**: Established complaints handling procedures as required by law

### 9.3 Anti-Money Laundering
- **FICA Compliance**: Full compliance with the Financial Intelligence Centre Act
- **Transaction Monitoring**: Ongoing monitoring of all transactions for suspicious activity
- **Reporting Obligations': Mandatory reporting of suspicious transactions to the FIC
- **Record Keeping**: Maintaining records as required by law
      `.trim(),
    },
    {
      id: 'terms-changes',
      title: '10. Changes to Terms',
      content: `
### 10.1 Modification Rights
We reserve the right to modify these Terms at any time. Changes will be effective:
- Immediately for critical changes (security, legal compliance)
- 30 days after notice for other changes

### 10.2 Notification Process
Users will be notified of significant changes via:
- Email notification
- Platform announcements
- In-app notifications
- Website banners

### 10.3 Continued Use
Your continued use of our Service after changes constitutes acceptance of the modified Terms.
If you do not agree to the changes, you must terminate your account immediately.

### 10.4 Regulatory Changes
Changes required by law or regulatory authorities will be implemented immediately
and may not require advance notice.
      `.trim(),
    },
    {
      id: 'contact',
      title: '11. Contact Information',
      content: `
### 11.1 ViralFX Contact Details
- **Company**: ViralFX (Pty) Ltd.
- **Registration Number**: 2024/123456/07
- **FSCA License Number**: [FSCA-LICENSE-NUMBER]
- **Physical Address**: 123 Trading Street, Sandton, Johannesburg, 2196, South Africa
- **Postal Address**: PO Box 12345, Sandton, 2146, South Africa
- **Phone**: +27 11 123 4567
- **Email**: support@viralfx.co.za
- **Website**: www.viralfx.co.za

### 11.2 Regulatory Contacts
- **FSCA Consumer Helpline**: 0800 203 722
- **FSCA Website**: www.fsca.co.za
- **FAIS Ombud**: 012 470 9080 / www.faisombud.co.za

### 11.3 Business Hours
- **Trading Support**: 24/5 (Monday 08:00 - Friday 17:00 SAST)
- **Customer Service**: Monday-Friday 08:00-17:00 SAST
- **Technical Support**: 24/7 for critical issues
      `.trim(),
    },
  ];

  useEffect(() => {
    // Combine all sections into a single markdown content
    const combinedContent = termsSections
      .map(section => `${section.title}\n\n${section.content}`)
      .join('\n\n---\n\n');
    setTermsContent(combinedContent);
    setLoading(false);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([termsContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `ViralFX-Terms-of-Service-${lastUpdated}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success('Terms downloaded successfully');
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', background: '#0E0E10', minHeight: '100vh' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Terms of Service - ViralFX | South Africa's Viral Trading Platform</title>
        <meta name="description" content="Read ViralFX's complete Terms of Service. FSCA authorized viral trend trading platform serving South African traders with full regulatory compliance." />
        <meta name="keywords" content="terms of service, legal, FSCA, South Africa, trading regulations, viral trading" />
      </Helmet>

      <div style={{ padding: '24px', background: '#0E0E10', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <Breadcrumb style={{ marginBottom: '16px' }}>
            <Breadcrumb.Item>
              <Link to="/" style={{ color: '#B8BCC8' }}>Home</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item>
              <Link to="/legal" style={{ color: '#B8BCC8' }}>Legal</Link>
            </Breadcrumb.Item>
            <Breadcrumb.Item style={{ color: '#FFB300' }}>
              Terms of Service
            </Breadcrumb.Item>
          </Breadcrumb>

          <Row justify="space-between" align="middle">
            <Col>
              <Title level={1} style={{ color: '#FFB300', margin: 0 }}>
                <FileTextOutlined style={{ marginRight: '12px' }} />
                Terms of Service
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '16px' }}>
                Last updated: {dayjs(lastUpdated).format('MMMM D, YYYY')}
              </Text>
            </Col>
            <Col>
              <Space>
                <Button
                  icon={<PrinterOutlined />}
                  onClick={handlePrint}
                  style={{ borderColor: '#FFB300', color: '#FFB300' }}
                >
                  Print
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={handleDownload}
                  style={{ borderColor: '#FFB300', color: '#FFB300' }}
                >
                  Download
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Regulatory Compliance Banner */}
        <Card
          style={{
            background: 'linear-gradient(135deg, rgba(75, 0, 130, 0.1) 0%, rgba(255, 179, 0, 0.1) 100%)',
            border: '1px solid rgba(255, 179, 0, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        >
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} sm={4}>
              <div style={{ textAlign: 'center' }}>
                <SafetyCertificateOutlined style={{ fontSize: '48px', color: '#4B0082' }} />
              </div>
            </Col>
            <Col xs={24} sm={20}>
              <Title level={4} style={{ color: '#FFB300', margin: '0 0 8px 0' }}>
                FSCA Authorized and Regulated
              </Title>
              <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '8px' }}>
                ViralFX (Pty) Ltd. is authorized and regulated by the Financial Sector Conduct Authority (FSCA)
                of South Africa. We operate in full compliance with all South African financial regulations.
              </Text>
              <Space>
                <Tag color="purple">FSCA License: [FSCA-LICENSE-NUMBER]</Tag>
                <Tag color="gold">POPIA Compliant</Tag>
                <Tag color="blue">FICA Compliant</Tag>
              </Space>
            </Col>
          </Row>
        </Card>

        <Row gutter={[24, 24]}>
          {/* Table of Contents */}
          <Col xs={24} lg={6}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileTextOutlined />
                  <Text style={{ color: '#FFB300' }}>Contents</Text>
                </div>
              }
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                position: 'sticky',
                top: '24px',
              }}
            >
              <Anchor
                affix={false}
                showInkInFixed={true}
                getContainer={() => window}
                style={{ background: 'transparent' }}
              >
                {termsSections.map((section) => (
                  <AnchorLink
                    key={section.id}
                    href={`#${section.id}`}
                    title={
                      <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                        {section.title}
                      </Text>
                    }
                    style={{ padding: '8px 0', borderBottom: '1px solid rgba(255, 179, 0, 0.1)' }}
                  />
                ))}
              </Anchor>
            </Card>
          </Col>

          {/* Terms Content */}
          <Col xs={24} lg={18}>
            <Card
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
              }}
              bodyStyle={{ padding: '40px' }}
            >
              <div style={{ color: '#B8BCC8' }}>
                <ReactMarkdown
                  components={{
                    h1: ({ children, ...props }) => (
                      <Title
                        level={2}
                        id={termsSections.find(s => s.title === children?.toString())?.id}
                        style={{ color: '#FFB300', marginTop: '32px', marginBottom: '16px' }}
                        {...props}
                      >
                        {children}
                      </Title>
                    ),
                    h2: ({ children, ...props }) => (
                      <Title
                        level={3}
                        style={{ color: '#FFB300', marginTop: '24px', marginBottom: '12px' }}
                        {...props}
                      >
                        {children}
                      </Title>
                    ),
                    h3: ({ children, ...props }) => (
                      <Title
                        level={4}
                        style={{ color: '#FFB300', marginTop: '20px', marginBottom: '10px' }}
                        {...props}
                      >
                        {children}
                      </Title>
                    ),
                    p: ({ children, ...props }) => (
                      <Paragraph
                        style={{ color: '#B8BCC8', lineHeight: '1.8', marginBottom: '16px' }}
                        {...props}
                      >
                        {children}
                      </Paragraph>
                    ),
                    ul: ({ children, ...props }) => (
                      <ul
                        style={{ color: '#B8BCC8', lineHeight: '1.8', paddingLeft: '24px', marginBottom: '16px' }}
                        {...props}
                      >
                        {children}
                      </ul>
                    ),
                    li: ({ children, ...props }) => (
                      <li
                        style={{ marginBottom: '8px' }}
                        {...props}
                      >
                        {children}
                      </li>
                    ),
                    strong: ({ children, ...props }) => (
                      <strong style={{ color: '#FFB300' }} {...props}>
                        {children}
                      </strong>
                    ),
                    a: ({ children, href, ...props }) => (
                      <a
                        href={href}
                        style={{ color: '#FFB300', textDecoration: 'none' }}
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                    blockquote: ({ children, ...props }) => (
                      <blockquote
                        style={{
                          borderLeft: '4px solid #4B0082',
                          paddingLeft: '16px',
                          margin: '16px 0',
                          color: '#B8BCC8',
                          background: 'rgba(75, 0, 130, 0.1)',
                          padding: '16px',
                          borderRadius: '8px',
                        }}
                        {...props}
                      >
                        {children}
                      </blockquote>
                    ),
                    hr: () => (
                      <Divider
                        style={{
                          borderColor: 'rgba(255, 179, 0, 0.2)',
                          margin: '32px 0',
                        }}
                      />
                    ),
                  }}
                >
                  {termsContent}
                </ReactMarkdown>
              </div>
            </Card>

            {/* Related Legal Documents */}
            <Card
              title={<Text style={{ color: '#FFB300' }}>Related Legal Documents</Text>}
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                marginTop: '24px',
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <Link to="/legal/privacy">
                    <Button
                      block
                      size="large"
                      style={{
                        background: 'rgba(75, 0, 130, 0.1)',
                        border: '1px solid rgba(255, 179, 0, 0.3)',
                        color: '#FFB300',
                        textAlign: 'left',
                        height: 'auto',
                        padding: '16px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>Privacy Policy</div>
                        <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                          How we collect, use, and protect your personal information (POPIA compliant)
                        </Text>
                      </div>
                    </Button>
                  </Link>
                </Col>
                <Col xs={24} sm={12}>
                  <Link to="/legal/disclaimer">
                    <Button
                      block
                      size="large"
                      style={{
                        background: 'rgba(255, 179, 0, 0.1)',
                        border: '1px solid rgba(255, 179, 0, 0.3)',
                        color: '#FFB300',
                        textAlign: 'left',
                        height: 'auto',
                        padding: '16px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>Risk Disclaimer</div>
                        <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                          Important information about trading risks and financial warnings
                        </Text>
                      </div>
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Footer CTA */}
        <div style={{ textAlign: 'center', marginTop: '40px' }}>
          <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '16px' }}>
            Have questions about our Terms of Service?
          </Text>
          <Space>
            <Link to="/contact">
              <Button
                type="primary"
                size="large"
                style={{
                  background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                  border: 'none',
                }}
              >
                Contact Support
              </Button>
            </Link>
            <Link to="/legal/privacy">
              <Button
                size="large"
                style={{
                  borderColor: '#FFB300',
                  color: '#FFB300',
                }}
              >
                Privacy Policy
              </Button>
            </Link>
          </Space>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .ant-layout {
            background: white !important;
          }
          .ant-card {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </>
  );
};

export default TermsPage;