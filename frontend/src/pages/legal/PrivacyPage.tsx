import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Anchor, Button, Space, Breadcrumb, message, Timeline, Alert, Tag, } from 'antd';
import {
  SafetyCertificateOutlined, DownloadOutlined, PrinterOutlined, UserOutlined, DatabaseOutlined, LockOutlined, EyeOutlined, DeleteOutlined, MailOutlined, SafetyCertificateOutlined, } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';

const {Title, Text, Paragraph} = Typography;
const {Link: AnchorLink} = Anchor;

interface PrivacySection {
  id: string;
  title: string;
  content: string;
}

const PrivacyPage: React.FC = () => {
  const [privacyContent, setPrivacyContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const lastUpdated = '2024-11-15';

  const privacySections: PrivacySection[] = [
    {
      id: 'introduction',
      title: '1. Introduction & POPIA Statement',
      content: `
ViralFX (Pty) Ltd. ("ViralFX," "we," "us," or "our") is committed to protecting your privacy and
ensuring the security of your personal information. This Privacy Policy explains how we collect,
use, share, and protect your personal data in compliance with South Africa's Protection of Personal
Information Act (POPIA), Act 4 of 2013.

As an FSCA-authorized financial services provider, we adhere to the highest standards of data
protection and financial industry regulations. Our commitment to privacy extends to all aspects of
our operations, from account registration to trading activities and customer support.

**Key POPIA Principles We Follow:**
- **Lawfulness**: We process personal information lawfully and transparently
- **Minimisation**: We collect only necessary information for specific purposes
- **Accuracy**: We maintain accurate and up-to-date personal information
- **Security**: We implement appropriate security measures to protect your data
- **Accountability**: We remain accountable for our data processing activities
      `.trim(),
    },
    {
      id: 'information-collected',
      title: '2. Information We Collect',
      content: `
### 2.1 Personal Information
During account registration and use of our services, we collect:

**Identity Information:**
- Full name and date of birth
- South African ID number or passport number
- Contact information (email, phone number, physical address)
- Proof of address (utility bills, bank statements)
- Photographs for identity verification

**Financial Information:**
- Bank account details for deposits and withdrawals
- Credit/debit card information (encrypted)
- Tax identification number
- Source of funds declaration
- Trading history and transaction records

**Communication Data:**
- Communications with our support team
- Trading analysis and preferences
- Website usage patterns
- Device information and IP addresses
- Cookies and tracking data

### 2.2 Special Categories of Personal Data
We may process special categories of personal data with explicit consent:
- Biometric data for advanced authentication
- Health information for account recovery purposes
- Racial or ethnic origin for diversity monitoring (optional)
- Political opinions for marketing preference settings (optional)

### 2.3 Automatically Collected Information
- **Technical Data**: Browser type, operating system, device identifiers
- **Usage Data**: Pages visited, time spent, features used
- **Location Data**: Approximate location based on IP address
- **Performance Data**: System performance, error reports
      `.trim(),
    },
    {
      id: 'how-we-use-info',
      title: '3. How We Use Your Information',
      content: `
### 3.1 Primary Uses of Personal Information

**Account Management:**
- Creating and managing your trading account
- Identity verification and KYC compliance
- Account security and fraud prevention
- Communication about account activities

**Trading Services:**
- Executing trades and managing orders
- Market analysis and personalized recommendations
- Risk assessment and margin requirements
- Regulatory reporting and compliance

**Customer Support:**
- Responding to inquiries and support requests
- Resolving technical issues
- Providing trading assistance
- Handling complaints and disputes

**Legal and Regulatory Compliance:**
- FSCA compliance and reporting
- AML/CFT obligations under FICA
- Tax reporting requirements
- Court orders and legal proceedings

### 3.2 Secondary Uses
- **Service Improvement**: Analyzing usage patterns to enhance our platform
- **Marketing**: Sending promotional communications (with consent)
- **Research**: Conducting market research and trend analysis
- **Analytics**: Generating aggregated, anonymized statistics

### 3.3 Legal Basis for Processing
Under POPIA, we process your personal information based on:
- **Consent**: Your explicit consent for specific processing activities
- **Contract**: Necessary for performing our service contract with you
- **Legal Obligation**: Required by law or regulatory authorities
- **Legitimate Interest**: Our legitimate business interests, where not overridden by your rights
      `.trim(),
    },
    {
      id: 'data-sharing',
      title: '4. Data Sharing and Third Parties',
      content: `
### 4.1 When We Share Your Information
We only share your personal information in the following circumstances:

**Financial Services Providers:**
- **Partner Brokers**: For trade execution and settlement
- **Payment Processors**: For processing deposits and withdrawals
- **Banking Institutions**: For account verification and transactions
- **Credit Reference Agencies**: For identity verification and fraud prevention

**Regulatory Authorities:**
- **FSCA**: For regulatory oversight and compliance
- **Financial Intelligence Centre (FIC)**: For AML/CFT reporting
- **South African Reserve Bank**: For monetary policy and systemic risk
- **Revenue Service (SARS)**: For tax compliance and reporting

**Service Providers:**
- **Cloud Hosting Providers**: Secure data storage and processing
- **Cybersecurity Firms**: Threat monitoring and incident response
- **Legal Advisors**: For legal advice and dispute resolution
- **Auditors**: For financial and compliance audits

**Emergency Situations:**
- Law enforcement agencies with appropriate legal process
- Emergency services for personal safety concerns
- Public health authorities for disease control

### 4.2 International Data Transfers
Your personal information is primarily stored and processed within South Africa.
International transfers may occur for:
- Cloud services with EU/UK adequacy decisions
- Global payment processors with appropriate safeguards
- International regulatory reporting requirements

### 4.3 Data Sharing Safeguards
All third-party processors must:
- Sign data processing agreements with ViralFX
- Implement appropriate security measures
- Comply with POPIA and relevant data protection laws
- Only process data for specified purposes
- Allow for audits and compliance checks
      `.trim(),
    },
    {
      id: 'security-measures',
      title: '5. Security Measures',
      content: `
### 5.1 Technical Security Measures
- **Encryption**: All data transmitted between your device and our servers is encrypted using TLS 1.3
- **Data Encryption**: Personal and financial data is encrypted at rest using AES-256 encryption
- **Access Controls**: Multi-factor authentication and role-based access controls
- **Network Security**: Firewalls, intrusion detection, and prevention systems
- **Regular Audits**: Quarterly security audits and penetration testing

### 5.2 Organizational Security Measures
- **Employee Training**: Regular POPIA and security awareness training
- **Background Checks**: Thorough vetting of employees with data access
- **Need-to-Know Principle**: Access limited to necessary personnel only
- **Security Policies**: Comprehensive information security management system
- **Incident Response**: Established procedures for data breach response

### 5.3 Physical Security
- **Data Centers**: SOC 2 certified data centers with 24/7 monitoring
- **Access Control**: Biometric access controls and visitor management
- **Environmental Controls**: Climate control and fire suppression systems
- **Backup Systems**: Regular backups with secure off-site storage

### 5.4 Data Breach Notification
In the event of a data breach:
- We will assess the risk to your rights and freedoms
- We will notify the Information Regulator within 72 hours
- We will notify affected individuals without undue delay
- We will cooperate with authorities and provide remediation assistance
      `.trim(),
    },
    {
      id: 'popia-rights',
      title: '6. Your Rights Under POPIA',
      content: `
### 6.1 Right to Access
You have the right to request access to your personal information:
- **What information**: Details of data we hold about you
- **Processing Purposes**: Why we process your information
- **Third Parties**: Who we share your information with
- **Data Sources**: Where we obtained your information
- **Automated Decisions**: Information about automated decision-making

### 6.2 Right to Correction
You can request correction of inaccurate or incomplete personal information:
- **Process**: Submit correction requests with supporting documentation
- **Timeline**: We respond within 30 days of receipt
- **Verification**: We may verify information before making corrections
- **Notification**: We'll notify third parties of corrections where necessary

### 6.3 Right to Deletion
You can request deletion of your personal information:
- **Account Deletion**: Complete removal from our systems
- **Legal Obligations**: We may retain information required by law
- **Public Interest**: Information necessary for public interest purposes
- **Archiving**: Anonymized data may be retained for statistical purposes

### 6.4 Right to Object
You can object to processing of your personal information:
- **Direct Marketing**: Opt-out of promotional communications
- **Legitimate Interests**: Object to processing based on legitimate interests
- **Automated Decisions**: Request human review of automated decisions
- **Profiling**: Object to profiling for marketing purposes

### 6.5 Right to Restrict Processing
You can request restriction of processing:
- **Contested Accuracy**: While information accuracy is verified
- **Unlawful Processing**: Instead of deletion in certain circumstances
- **Legal Claims**: For establishment, exercise, or defense of legal claims
- **Legitimate Interests**: While we verify our legitimate interests

### 6.6 Right to Data Portability
You can request transfer of your personal information:
- **Machine-Readable Format**: Information in structured, common format
- **Direct Transfer**: Transfer to another service provider where technically feasible
- **Third-Party Providers**: Arrangements for direct data transfer
      `.trim(),
    },
    {
      id: 'cookies-tracking',
      title: '7. Cookies and Tracking Technologies',
      content: `
### 7.1 Types of Cookies We Use

**Essential Cookies:**
- **Authentication**: Maintaining your login session
- **Security**: Preventing unauthorized access
- **Preferences**: Remembering your settings and preferences
- **Shopping Cart**: Keeping track of your trading activities

**Analytics Cookies:**
- **Google Analytics**: Website usage and performance analysis
- **Custom Analytics**: Platform-specific usage patterns
- **Heat Mapping**: User interaction and navigation analysis
- **Error Tracking**: Identifying and resolving technical issues

**Functional Cookies:**
- **Language Settings**: Remembering your language preference
- **Theme Settings**: Saving your display preferences
- **Trading Preferences**: Remembering your trading settings
- **Personalization**: Customizing your user experience

### 7.2 Cookie Consent Management
- **Consent Required**: We obtain consent for non-essential cookies
- **Granular Control**: You can accept or decline specific cookie categories
- **Consent Withdrawal**: You can withdraw consent at any time
- **Cookie Duration**: Cookies have appropriate expiration dates

### 7.3 Third-Party Cookies
- **Social Media**: Integration with social media platforms
- **Advertising**: Targeted advertising partnerships
- **Analytics**: Third-party analytics services
- **Payment Processing**: Secure payment processing cookies

### 7.4 Cookie Settings
You can manage cookie preferences through:
- **Cookie Banner**: Initial consent management
- **Browser Settings**: Managing cookies in your web browser
- **Account Settings**: Ongoing preference management
- **Mobile Apps**: In-app cookie and tracking settings
      `.trim(),
    },
    {
      id: 'data-retention',
      title: '8. Data Retention',
      content: `
### 8.1 Retention Periods
We retain your personal information only as long as necessary:

**Account Information:**
- **Active Accounts**: For the duration of your account relationship
- **Closed Accounts**: 7 years after account closure (financial records)
- **Inactive Accounts**: 3 years of inactivity before deletion

**Trading Records:**
- **Transaction Records**: 7 years (FICA requirement)
- **Account Statements**: 7 years (tax requirement)
- **Communication Records**: 5 years (regulatory requirement)
- **Risk Assessments**: 7 years (FSCA requirement)

**Support Interactions:**
- **Support Tickets**: 3 years after resolution
- **Complaint Records**: 7 years (regulatory requirement)
- **Quality Assurance**: 2 years (training purposes)

### 8.2 Retention Criteria
We determine retention periods based on:
- **Legal Requirements**: Minimum retention periods under law
- **Regulatory Obligations**: FSCA and other regulatory requirements
- **Business Needs**: Legitimate business purposes for data retention
- **Historical Records**: Historical analysis and trend identification

### 8.3 Data Disposal
When retention periods expire:
- **Secure Deletion**: Permanent and secure deletion methods
- **Anonymization**: Conversion to anonymous statistical data
- **Verification**: Confirmation of complete data destruction
- **Documentation**: Records of disposal activities
      `.trim(),
    },
    {
      id: 'international-transfers',
      title: '9. International Data Transfers',
      content: `
### 9.1 Transfer Principles
Your personal information is primarily processed within South Africa. International transfers occur only when:

**Adequate Protection:**
- **EU/UK Adequacy**: Countries with EU adequacy decisions
- **Appropriate Safeguards**: Standard contractual clauses or binding corporate rules
- **Specific Laws**: Countries with comprehensive data protection laws
- **Compliance Equivalence**: Equivalent protection to POPIA

### 9.2 Transfer Mechanisms
- **Standard Contractual Clauses**: EU-approved SCCs for international transfers
- **Binding Corporate Rules**: Internal data protection policies for multinational operations
- **Specific Agreements**: Tailored agreements for specific transfer scenarios
- **Certification Programs**: International privacy certification programs

### 9.3 International Service Providers
We use international providers that:
- **Comply with POPIA**: Adherence to South African data protection requirements
- **Implement Equivalent Protection**: Security measures equivalent to local standards
- **Allow for Oversight**: Regular audits and compliance monitoring
- **Provide Redress**: Mechanisms for addressing data protection concerns

### 9.4 Your Rights
Your POPIA rights extend to international transfers:
- **Prior Notification**: Information about international transfers
- **Consent Requirements**: Explicit consent for high-risk transfers
- **Withdrawal Rights**: Ability to withdraw consent for ongoing transfers
- **Complaint Mechanisms**: Channels for raising concerns about international transfers
      `.trim(),
    },
    {
      id: 'childrens-privacy',
      title: '10. Children\'s Privacy',
      content: `
### 10.1 Age Requirements
ViralFX does not offer services to children under 18 years of age:
- **Registration**: Minimum age requirement of 18 years
- **Verification**: Age verification during account registration
- **Parental Consent**: Not applicable as minors cannot create accounts
- **Marketing**: No marketing directed at minors

### 10.2 Accidental Data Collection
If we accidentally collect information from minors:
- **Immediate Deletion**: Prompt deletion of collected information
- **Parental Notification**: Notification to parents where contact information is available
- **Process Review**: Review of processes to prevent future occurrences
- **Documentation**: Record of the incident and remediation steps

### 10.3 Educational Accounts
Special provisions for educational trading programs:
- **School Authorization**: Written authorization from educational institutions
- **Parental Consent**: Explicit parental consent for minor participation
- **Limited Processing**: Minimal personal information collection
- **Enhanced Protection**: Additional security and privacy measures

### 10.4 Reporting Mechanisms
- **Reporting Channel**: Easy-to-use reporting for privacy concerns
- **Immediate Response**: Prompt action on reports involving minors
- **Law Enforcement**: Cooperation with law enforcement when necessary
- **Prevention Measures**: Ongoing prevention and education efforts
      `.trim(),
    },
    {
      id: 'policy-changes',
      title: '11. Changes to This Policy',
      content: `
### 11.1 Policy Updates
We may update this Privacy Policy to reflect:
- **Legal Changes**: Changes in data protection laws or regulations
- **Service Changes**: New features or services requiring different data practices
- **Business Changes**: Changes in our business structure or ownership
- **Technology Changes**: New technologies affecting data processing

### 11.2 Notification Process
- **Email Notification**: Direct email to affected users
- **Platform Notices**: In-app notifications and platform announcements
- **Website Updates**: Updated policy on our website
- **Effective Date**: Clear indication of when changes become effective

### 11.3 Material Changes
Significant changes will be communicated:
- **30 Days Notice**: For substantial changes to data practices
- **Explicit Consent**: For changes requiring additional consent
- **Right to Object**: Information about exercising rights in response to changes
- **Alternative Options**: Options for users who don't agree with changes

### 11.4 Continued Use
Your continued use of our services after policy changes indicates acceptance.
If you don't agree with changes:
- **Account Closure**: Option to close your account
- **Data Portability**: Request to transfer your data to another provider
- **Limited Processing**: Options to limit certain data processing activities
- **Complaint Filing**: Right to file complaints with the Information Regulator
      `.trim(),
    },
    {
      id: 'contact',
      title: '12. Contact & Data Protection Officer',
      content: `
### 12.1 Privacy Contact Information
For privacy-related inquiries, contact us:

**Data Protection Officer (DPO):**
- **Name**: [DPO Name]
- **Email**: dpo@viralfx.co.za
- **Phone**: +27 11 123 4568
- **Address**: 123 Trading Street, Sandton, Johannesburg, 2196

**General Privacy Inquiries:**
- **Email**: privacy@viralfx.co.za
- **Phone**: +27 11 123 4567 (Option 2)
- **Online Form**: Privacy contact form on our website

### 12.2 Information Regulator
If you have concerns about how we handle your personal information:

**South African Information Regulator:**
- **Website**: www.justice.gov.za/inforeg
- **Email**: Inforeg@justice.gov.za
- **Phone**: 012 426 8843 / 0800 007 562
- **Address**: Private Bag X839, Pretoria, 0001

### 12.3 Complaint Handling Process
- **Acknowledgement**: Within 24 hours of receiving your complaint
- **Investigation**: Thorough investigation of your concerns
- **Response**: Detailed response within 30 days
- **Resolution**: Practical solutions to address your concerns
- **Escalation**: Option to escalate to senior management or the Information Regulator

### 12.4 Data Subject Request Process
**Making a Request:**
1. **Submit Request**: Complete our data subject request form
2. **Identity Verification**: Provide proof of identity
3. **Processing**: We process your request within 30 days
4. **Response**: Detailed response with requested information or actions

**Required Information:**
- Full name and contact details
- Account number or customer reference
- Specific request details
- Supporting documentation
- Signature (for written requests)
      `.trim(),
    },
  ];

  useEffect(() => {
    // Combine all sections into a single markdown content
    const combinedContent = privacySections
      .map(section => `${section.title}\n\n${section.content}`)
      .join('\n\n---\n\n');
    setPrivacyContent(combinedContent);
    setLoading(false);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([privacyContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `ViralFX-Privacy-Policy-${lastUpdated}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success('Privacy policy downloaded successfully');
  };

  const handleDataRequest = (type: 'access' | 'correction' | 'deletion') => {
    const subject = encodeURIComponent(`${type} request - ViralFX Privacy Policy`);
    const body = encodeURIComponent(`
Dear ViralFX Data Protection Officer,

I would like to exercise my right under POPIA to ${type} my personal information.

Please provide me with the necessary forms and instructions to proceed with this request.

Account Information:
- Name: [Your Name]
- Email: [Your Email]
- Phone: [Your Phone Number]
- Account Reference: [Your Account Reference]

Thank you for your assistance.

Best regards
[Your Name]
    `);

    window.location.href = `mailto:privacy@viralfx.co.za?subject=${subject}&body=${body}`;
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
        <title>Privacy Policy - ViralFX | POPIA Compliant Data Protection</title>
        <meta name="description" content="ViralFX's comprehensive privacy policy. POPIA compliant data protection for South African traders. Learn about your data rights and our privacy practices." />
        <meta name="keywords" content="privacy policy, POPIA, data protection, South Africa, FSCA, GDPR compliance" />
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
              Privacy Policy
            </Breadcrumb.Item>
          </Breadcrumb>

          <Row justify="space-between" align="middle">
            <Col>
              <Title level={1} style={{ color: '#FFB300', margin: 0 }}>
                <SafetyCertificateOutlined style={{ marginRight: '12px' }} />
                Privacy Policy
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '16px' }}>
                Last updated: {dayjs(lastUpdated).format('MMMM D, YYYY')} | POPIA Compliant
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

        {/* POPIA Compliance Banner */}
        <Alert
          message={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <SafetyCertificateOutlined style={{ fontSize: '24px', color: '#52C41A' }} />
              <div>
                <strong style={{ color: '#52C41A' }}>POPIA Compliant</strong>
                <div style={{ color: '#B8BCC8', fontSize: '14px' }}>
                  This privacy policy complies with South Africa's Protection of Personal Information Act (POPIA)
                </div>
              </div>
            </div>
          }
          type="success"
          showIcon={false}
          style={{
            background: 'rgba(82, 196, 26, 0.1)',
            border: '1px solid rgba(82, 196, 26, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        />

        {/* Data Rights Actions */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserOutlined />
              <Text style={{ color: '#FFB300' }}>Your POPIA Rights</Text>
            </div>
          }
          style={{
            background: 'linear-gradient(135deg, rgba(75, 0, 130, 0.1) 0%, rgba(255, 179, 0, 0.1) 100%)',
            border: '1px solid rgba(255, 179, 0, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Button
                block
                size="large"
                icon={<EyeOutlined />}
                onClick={() => handleDataRequest('access')}
                style={{
                  background: 'rgba(75, 0, 130, 0.2)',
                  border: '1px solid rgba(255, 179, 0, 0.3)',
                  color: '#FFB300',
                  height: 'auto',
                  padding: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>Request Access</div>
                  <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                    Access your personal information
                  </Text>
                </div>
              </Button>
            </Col>
            <Col xs={24} sm={8}>
              <Button
                block
                size="large"
                icon={<DatabaseOutlined />}
                onClick={() => handleDataRequest('correction')}
                style={{
                  background: 'rgba(255, 179, 0, 0.2)',
                  border: '1px solid rgba(255, 179, 0, 0.3)',
                  color: '#FFB300',
                  height: 'auto',
                  padding: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>Correct Information</div>
                  <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                    Update your personal details
                  </Text>
                </div>
              </Button>
            </Col>
            <Col xs={24} sm={8}>
              <Button
                block
                size="large"
                icon={<DeleteOutlined />}
                onClick={() => handleDataRequest('deletion')}
                style={{
                  background: 'rgba(75, 0, 130, 0.2)',
                  border: '1px solid rgba(255, 179, 0, 0.3)',
                  color: '#FFB300',
                  height: 'auto',
                  padding: '16px',
                }}
              >
                <div>
                  <div style={{ fontSize: '16px', marginBottom: '4px' }}>Delete Information</div>
                  <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                    Request data deletion
                  </Text>
                </div>
              </Button>
            </Col>
          </Row>
        </Card>

        <Row gutter={[24, 24]}>
          {/* Table of Contents */}
          <Col xs={24} lg={6}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <SafetyCertificateOutlined />
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
                {privacySections.map((section) => (
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

          {/* Privacy Content */}
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
                        id={privacySections.find(s => s.title === children?.toString())?.id}
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
                  {privacyContent}
                </ReactMarkdown>
              </div>
            </Card>

            {/* Contact Information Card */}
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MailOutlined />
                  <Text style={{ color: '#FFB300' }}>Contact Our Data Protection Officer</Text>
                </div>
              }
              style={{
                background: '#1A1A1C',
                border: '1px solid rgba(255, 179, 0, 0.2)',
                borderRadius: '12px',
                marginTop: '24px',
              }}
            >
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12}>
                  <div style={{ padding: '16px', background: 'rgba(75, 0, 130, 0.1)', borderRadius: '8px' }}>
                    <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>Email</Text>
                    <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>privacy@viralfx.co.za</Text>
                  </div>
                </Col>
                <Col xs={24} sm={12}>
                  <div style={{ padding: '16px', background: 'rgba(75, 0, 130, 0.1)', borderRadius: '8px' }}>
                    <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>Phone</Text>
                    <Text style={{ color: '#FFB300', fontWeight: 'bold' }}>+27 11 123 4568</Text>
                  </div>
                </Col>
              </Row>
              <div style={{ marginTop: '16px', textAlign: 'center' }}>
                <Button
                  type="primary"
                  icon={<MailOutlined />}
                  onClick={() => window.location.href = 'mailto:privacy@viralfx.co.za'}
                  style={{
                    background: 'linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%)',
                    border: 'none',
                  }}
                >
                  Contact DPO
                </Button>
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
                  <Link to="/legal/terms">
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
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>Terms of Service</div>
                        <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                          Complete terms and conditions for using ViralFX
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
                          Important financial risk warnings and disclaimers
                        </Text>
                      </div>
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Information Regulator Notice */}
        <Alert
          message={
            <div>
              <strong>Information Regulator</strong>
              <div style={{ marginTop: '8px' }}>
                If you have concerns about our handling of your personal information, you can contact the
                South African Information Regulator at <Text style={{ color: '#FFB300' }}>www.justice.gov.za/inforeg</Text>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: '32px' }}
        />
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

export default PrivacyPage;