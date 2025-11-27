import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Typography, Card, Row, Col, Anchor, Button, Space, Breadcrumb, message, Alert, Progress, Divider, Tag, Checkbox, Form, } from 'antd';
import {
  WarningOutlined, DownloadOutlined, PrinterOutlined, ExclamationCircleOutlined, SecurityScanOutlined, DollarCircleOutlined, RiseOutlined, FallOutlined, FireOutlined, SafetyCertificateOutlined, InfoCircleOutlined, } from '@ant-design/icons';
import { Helmet } from 'react-helmet-async';
import ReactMarkdown from 'react-markdown';
import dayjs from 'dayjs';

const {Title, Text, Paragraph} = Typography;
const {Link: AnchorLink} = Anchor;

interface DisclaimerSection {
  id: string;
  title: string;
  content: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
}

const DisclaimerPage: React.FC = () => {
  const [disclaimerContent, setDisclaimerContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const lastUpdated = '2024-11-15';

  const disclaimerSections: DisclaimerSection[] = [
    {
      id: 'general-risk-warning',
      title: '1. General Risk Warning',
      content: `
**EXTREME RISK WARNING: Trading viral trends and cryptocurrencies involves substantial risk of loss and may not be suitable for all investors.**

ViralFX provides a platform for trading based on social media trends and market sentiment analysis. The value of viral trend investments can be extremely volatile and unpredictable. You should carefully consider whether trading viral trends is appropriate for you in light of your financial condition, investment experience, risk tolerance, and other relevant factors.

**Key Risk Factors:**
- You may lose your entire investment
- Past performance is not indicative of future results
- Viral trends can change direction rapidly without warning
- Market sentiment can be manipulated or artificially influenced
- Social media trends may not reflect actual market fundamentals
- Trading involves emotional and psychological pressures
- Technical failures may result in significant losses

**Investment Rules:**
- Only invest what you can afford to lose completely
- Never invest money needed for essential living expenses
- Consider viral trend trading as high-risk speculation
- Diversify your investment portfolio
- Seek independent financial advice before trading

**By using ViralFX, you acknowledge and accept these risks and agree that you are solely responsible for your trading decisions.**
      `.trim(),
      riskLevel: 'EXTREME',
    },
    {
      id: 'trading-risks',
      title: '2. Trading Risks',
      content: `
### 2.1 Market Volatility
Viral trend markets are characterized by extreme volatility:
- **Price Swings**: Prices can change dramatically in minutes
- **Liquidity Risk**: Limited liquidity can lead to slippage
- **Gap Risk**: Markets may gap up or down significantly
- **Flash Crashes**: Rapid price declines can occur unexpectedly
- **Pump and Dump**: Coordinated manipulation schemes are common

### 2.2 Viral Trend Specific Risks
- **Trend Reversal**: Viral trends can reverse direction suddenly
- **False Signals**: Social media sentiment may provide misleading signals
- **Bot Activity**: Automated trading bots can influence trends
- **Platform Dependency**: Reliance on social media platforms creates additional risk
- **Algorithm Risk**: Trend analysis algorithms may have limitations

### 2.3 Technical and Platform Risks
- **System Failures**: Trading platform may experience technical issues
- **Internet Connectivity**: Connection problems can prevent trade execution
- **Order Delays**: Orders may not execute in volatile markets
- **Data Accuracy**: Market data may be delayed or inaccurate
- **Cybersecurity**: Hacking and cyber attacks pose ongoing threats

### 2.4 Regulatory Risks
- **Regulatory Changes**: Sudden regulatory announcements can impact markets
- **Platform Bans**: Social media platforms may ban or restrict content
- **Legal Uncertainty**: Legal status of certain viral trends may be unclear
- **Compliance Requirements**: Regulatory compliance requirements may change

**Risk Level Assessment:**
- **Beginner Traders**: EXTREME RISK - Not recommended
- **Experienced Traders**: HIGH RISK - Only with small capital allocation
- **Professional Traders**: MEDIUM TO HIGH RISK - With proper risk management
      `.trim(),
      riskLevel: 'HIGH',
    },
    {
      id: 'market-risks',
      title: '3. Market Risks',
      content: `
### 3.1 Systemic Market Risks
- **Market Crashes**: Entire market sectors can experience rapid declines
- **Contagion Risk**: Problems in one market can spread to others
- **Liquidity Crisis**: Market liquidity can disappear suddenly
- **Counterparty Risk**: Brokers or exchanges may fail or default
- **Settlement Risk**: Trade settlement may be delayed or fail

### 3.2 Sentiment-Driven Risks
- **Herd Mentality**: Following popular trends can lead to losses
- **Echo Chambers**: Confirmation bias in social media analysis
- **Misinformation**: False or misleading information can spread rapidly
- **Manipulation**: Coordinated efforts to influence sentiment
- **Algorithm Bias**: AI analysis may have inherent biases

### 3.3 Platform-Related Risks
- **Content Moderation**: Platform content policies can affect trends
- **Algorithm Changes**: Social media algorithm changes impact visibility
- **Account Suspension**: Influencer accounts may be suspended
- **Platform Outages**: Social media platform failures affect data sources
- **API Limitations**: Rate limiting and API changes affect data collection

### 3.4 Geographic and Regulatory Risks
- **Cross-Border Issues**: International trends may face different regulations
- **Time Zone Differences**: Global markets operate across time zones
- **Currency Risk**: Exchange rate fluctuations affect returns
- **Political Events**: Political developments can impact markets
- **Economic Indicators**: Economic data releases can cause volatility

**Risk Mitigation Recommendations:**
- Use stop-loss orders to limit potential losses
- Monitor multiple data sources for trend confirmation
- Maintain adequate capital reserves
- Diversify across different viral trend categories
- Stay informed about regulatory developments
      `.trim(),
      riskLevel: 'HIGH',
    },
    {
      id: 'technology-risks',
      title: '4. Technology Risks',
      content: `
### 4.1 Platform Technology Risks
- **System Downtime**: Platform may be unavailable during critical market movements
- **Software Bugs**: Programming errors can cause incorrect trade execution
- **Data Corruption**: Market data may be corrupted or lost
- **Scaling Issues**: High traffic volumes may cause system overload
- **Integration Failures**: Third-party service integrations may fail

### 4.2 Security Risks
- **Hacking Attempts**: Platform may be targeted by cybercriminals
- **Account Compromise**: User accounts may be hacked or compromised
- **Data Breaches**: Personal and financial data may be exposed
- **Phishing Attacks**: Users may be targeted by phishing scams
- **Malware**: Malicious software can compromise trading systems

### 4.3 Connectivity Risks
- **Internet Outages**: Connection problems can prevent trading
- **ISP Issues**: Internet service provider problems affect access
- **Network Congestion**: High traffic can slow or prevent trading
- **Hardware Failures**: Computer or device failures disrupt trading
- **Mobile Device Risks**: Mobile trading apps may have limited functionality

### 4.4 Data and Analytics Risks
- **Data Accuracy**: Real-time data may contain errors or delays
- **Algorithm Limitations**: AI analysis may not predict all market movements
- **Model Risk**: Mathematical models may have fundamental flaws
- **Backtesting Bias**: Historical data may not predict future performance
- **Overfitting**: Models may be too specific to historical data

**Technology Best Practices:**
- Use reliable internet connections and backup connectivity
- Keep software and antivirus programs updated
- Use strong, unique passwords and two-factor authentication
- Monitor account activity regularly
- Maintain backup trading methods
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'regulatory-risks',
      title: '5. Regulatory Risks',
      content: `
### 5.1 South African Regulatory Framework
- **FSCA Oversight**: Financial Sector Conduct Authority regulation
- **FAIS Compliance**: Financial Advisory and Intermediary Services Act
- **FICA Requirements**: Financial Intelligence Centre Act compliance
- **POPIA Compliance**: Protection of Personal Information Act
- **Tax Obligations**: South African Revenue Service requirements

### 5.2 International Regulatory Risks
- **Cross-Border Trading**: Multiple regulatory jurisdictions apply
- **Regulatory Arbitrage**: Differences in regulations between countries
- **Sanctions Compliance**: International sanctions may affect trading
- **AML/CFT Requirements**: Anti-money laundering and counter-terrorist financing
- **Consumer Protection**: Varying levels of investor protection

### 5.3 Legal and Compliance Risks
- **Regulatory Changes**: Laws and regulations can change suddenly
- **License Requirements**: Trading platforms may require specific licenses
- **Reporting Obligations': Mandatory reporting to regulatory authorities
- **Compliance Costs**: Regulatory compliance may be expensive
- **Legal Proceedings**: Participation in legal disputes may be required

### 5.4 Enforcement Actions
- **Regulatory Investigations**: Authorities may investigate trading activities
- **Penalties and Fines**: Non-compliance may result in financial penalties
- **License Suspension**: Regulatory licenses may be suspended or revoked
- **Criminal Charges**: Serious violations may result in criminal charges
- **Civil Liability**: Legal action may be taken by affected parties

**Regulatory Compliance Requirements:**
- Complete all required KYC/AML verification procedures
- Report suspicious activities to appropriate authorities
- Maintain accurate records for required retention periods
- Comply with all tax reporting obligations
- Stay informed about regulatory changes
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'no-investment-advice',
      title: '6. No Investment Advice',
      content: `
### 6.1 Educational Content Only
All information provided by ViralFX is for educational and informational purposes only:
- **Not Financial Advice**: Content does not constitute personalized financial advice
- **No Recommendations**: We do not recommend specific investments or strategies
- **Educational Purpose**: Materials are designed to educate, not advise
- **General Information**: Content applies to general market conditions, not specific situations
- **No Guarantees**: We make no guarantees about future performance

### 6.2 Professional Advice Required
- **Independent Advice**: Consult with qualified financial professionals
- **Personal Circumstances**: Consider your individual financial situation
- **Risk Tolerance**: Evaluate your personal risk tolerance
- **Investment Goals**: Align investments with your financial objectives
- **Tax Considerations**: Consult tax advisors for tax implications

### 6.3 Responsibility for Decisions
- **Your Responsibility**: You are solely responsible for trading decisions
- **Due Diligence**: Conduct your own research before trading
- **Independent Verification**: Verify information from multiple sources
- **Professional Judgment**: Use professional judgment in decision-making
- **Accountability**: You are accountable for your investment choices

### 6.4 Limitations of Our Analysis
- **Historical Data**: Analysis based on historical data may not predict future
- **Model Limitations**: Our models have inherent limitations and assumptions
- **Market Complexity**: Markets are too complex for perfect prediction
- **External Factors**: Unforeseen events can affect markets
- **Human Factor**: Human psychology affects market behavior unpredictably

**Professional Resources:**
- Financial advisors for personalized advice
- Tax professionals for tax planning
- Legal counsel for regulatory compliance
- Risk management specialists for portfolio protection
      `.trim(),
      riskLevel: 'LOW',
    },
    {
      id: 'past-performance',
      title: '7. Past Performance Disclaimer',
      content: `
### 7.1 No Guarantee of Future Results
**IMPORTANT DISCLAIMER: Past performance is not indicative of future results.**

Historical performance data:
- **Not Predictive**: Historical trends do not guarantee future performance
- **Different Conditions**: Market conditions change over time
- **Selection Bias**: Successful examples may not represent typical results
- **Survivorship Bias**: Failed trends may not be included in historical data
- **Market Evolution**: Markets evolve and change over time

### 7.2 Hypothetical Performance
- **Not Real Trading**: Backtested results are not actual trading results
- **No Slippage**: Hypothetical results don't account for real-world trading costs
- **Perfect Execution**: Assumes ideal execution conditions
- **No Emotional Factors**: Doesn't account for emotional trading decisions
- **Technical Factors**: Ignores technical issues and system failures

### 7.3 Marketing Material Limitations
- **Selective Information**: Marketing materials may highlight successful examples
- **Best Case Scenarios**: May represent optimal outcomes rather than typical results
- **Cherry Picking**: May use carefully selected time periods
- **Glossing Over Losses**: May not emphasize losing periods
- **Overoptimistic Projections**: Future projections may be overly optimistic

### 7.4 Risk of Overconfidence
- **False Confidence**: Past success can create false confidence
- **Complacency**: Success may lead to reduced risk management
- **Overtrading**: Belief in continued success may lead to overtrading
- **Position Sizing**: Success may encourage excessive position sizing
- **Risk Taking**: Past success may encourage excessive risk-taking

**Realistic Expectations:**
- Expect both wins and losses
- Understand that losses are part of trading
- Focus on long-term performance, not short-term gains
- Maintain disciplined risk management
- Continuously educate yourself about markets
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'third-party-content',
      title: '8. Third-Party Content',
      content: `
### 8.1 Social Media Content Disclaimer
ViralFX analyzes social media content but does not endorse or verify:
- **User-Generated Content**: Social media posts are created by users, not ViralFX
- **Accuracy Claims**: We do not verify the accuracy of social media claims
- **User Intentions**: We cannot determine user intentions or motivations
- **Content Authenticity**: Social media content may be manipulated or fake
- **Legal Compliance**: We do not ensure legal compliance of user content

### 8.2 Influencer and Celebrity Content
- **No Endorsement**: Celebrity mentions do not constitute endorsements
- **Paid Promotions**: Content may be sponsored without disclosure
- **Manipulation**: Influencers may manipulate trends for personal gain
- **Conflicts of Interest**: Financial interests may not be disclosed
- **Authenticity Questions**: Celebrity involvement may be staged or artificial

### 8.3 News and Media Content
- **Source Reliability**: News sources may have varying levels of reliability
- **Editorial Bias**: Media coverage may reflect editorial biases
- **Sensationalism**: News may be exaggerated for attention
- **Fake News**: Deliberate misinformation may be present
- **Timing Differences**: News reporting may be delayed or超前

### 8.4 Data Provider Limitations
- **API Limitations**: Third-party APIs have rate limits and restrictions
- **Data Quality**: Data quality may vary between providers
- **Coverage Gaps**: Some platforms may have incomplete data coverage
- **Real-Time Delays**: Real-time data may have inherent delays
- **Technical Issues**: Provider technical issues may affect data availability

**Content Verification:**
- Cross-reference information from multiple sources
- Consider the credibility of content creators
- Be aware of potential conflicts of interest
- Question sensational or extraordinary claims
- Verify important information independently
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'broker-relationship',
      title: '9. Broker Relationship Disclaimer',
      content: `
### 9.1 Third-Party Broker Integration
ViralFX integrates with third-party brokers but:
- **No Endorsement**: Integration does not constitute endorsement
- **Independent Entities**: Brokers are independent legal entities
- **Separate Relationships**: Your relationship is with the broker, not ViralFX
- **No Liability**: We are not liable for broker actions or failures
- **No Guarantee**: We do not guarantee broker performance or reliability

### 9.2 Broker Selection Risks
- **Due Diligence Required**: Users must conduct their own broker due diligence
- **Regulatory Status**: Verify broker regulatory status and licenses
- **Financial Stability**: Assess broker financial health and stability
- **Reputation Considerations**: Research broker reputation and customer reviews
- **Fee Structures**: Understand all broker fees and commission structures

### 9.3 Trading Execution Risks
- **Execution Differences**: Actual execution may differ from displayed prices
- **Slippage Risk**: Prices may change between order and execution
- **Partial Fills**: Orders may be partially filled
- **Order Rejection**: Brokers may reject orders for various reasons
- **Platform Issues**: Broker platform issues may affect trading

### 9.4 Fund Protection
- **Segregated Funds**: Client funds should be segregated from broker funds
- **Insurance Coverage**: Check for insurance coverage for client funds
- **Compensation Schemes**: Understand investor compensation schemes
- **Withdrawal Limits**: Be aware of withdrawal limits and processing times
- **Currency Risk**: Consider currency conversion risks and fees

**Broker Due Diligence Checklist:**
- Verify FSCA authorization and license number
- Check financial statements and capital adequacy
- Research customer complaints and regulatory actions
- Understand fee structures and hidden costs
- Test customer service responsiveness
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'liability-limitation',
      title: '10. Liability Limitation',
      content: `
### 10.1 Limitation of Liability
To the fullest extent permitted by law:

**Direct Damages:**
- Our total liability for any claims shall not exceed the fees you have paid to us in the six (6) months preceding the claim
- We are not liable for any trading losses or investment losses
- We are not liable for lost profits or consequential damages
- We are not liable for damages arising from third-party actions

**Indirect Damages:**
- We are not liable for indirect, special, or consequential damages
- This includes lost business opportunities, reputation damage, or emotional distress
- We are not liable for damages arising from system failures or internet outages
- We are not liable for damages from third-party service failures

### 10.2 No Warranties
We provide our services "as is" without warranties:
- No warranty of merchantability or fitness for a particular purpose
- No warranty of uninterrupted or error-free service
- No warranty of accuracy or completeness of information
- No warranty of security or data protection
- No warranty of profitability or trading success

### 10.3 Force Majeure
We are not liable for failures due to events beyond our control:
- Natural disasters, wars, or civil unrest
- Government actions or regulatory changes
- Internet infrastructure failures
- Power outages or utility failures
- Third-party service provider failures

### 10.4 Indemnification
You agree to indemnify and hold us harmless from:
- Any claims arising from your use of our services
- Any violations of these terms or applicable laws
- Any damages caused by your negligence or willful misconduct
- Any third-party claims arising from your trading activities
- Any costs of defending against such claims

**Legal Rights:**
- Some jurisdictions do not allow exclusion of certain warranties
- Some jurisdictions do not allow limitation of liability for personal injury
- This section does not affect your statutory rights
- Consult legal counsel for advice on your rights and obligations
      `.trim(),
      riskLevel: 'LOW',
    },
    {
      id: 'user-responsibility',
      title: '11. User Responsibility',
      content: `
### 11.1 Trading Responsibility
You acknowledge and accept that:
- **Trading Decisions**: All trading decisions are your sole responsibility
- **Risk Assessment**: You are responsible for assessing your own risk tolerance
- **Financial Decisions**: Financial decisions are your personal responsibility
- **Market Research**: You are responsible for conducting your own market research
- **Professional Advice**: You are responsible for seeking professional advice when needed

### 11.2 Account Security
You are responsible for:
- **Password Security**: Maintaining strong, unique passwords
- **Device Security**: Securing your devices against unauthorized access
- **Authentication**: Using two-factor authentication when available
- **Sharing Credentials**: Not sharing your account credentials with others
- **Monitoring Activity**: Regularly monitoring your account for suspicious activity

### 11.3 Compliance Responsibility
You must comply with:
- **Applicable Laws**: All relevant laws and regulations
- **Tax Obligations**: All applicable tax reporting and payment obligations
- **Terms of Service**: Our terms of service and user agreement
- **Broker Terms**: Your broker's terms and conditions
- **Platform Policies**: Social media platform policies and community guidelines

### 11.4 Ethical Trading
You agree to:
- **Market Integrity**: Not engage in market manipulation or insider trading
- **Fair Dealing**: Deal fairly with other market participants
- **Professional Conduct**: Maintain professional trading conduct
- **Reporting**: Report suspicious activities to appropriate authorities
- **Continuous Education**: Continuously educate yourself about markets and regulations

**Risk Management Checklist:**
- Understand your risk tolerance and financial capacity
- Use appropriate position sizing
- Implement stop-loss orders
- Diversify your investments
- Monitor your positions regularly
- Have an exit strategy for each trade
      `.trim(),
      riskLevel: 'MEDIUM',
    },
    {
      id: 'acknowledgment',
      title: '12. Acknowledgment and Acceptance',
      content: `
### 12.1 Acknowledgment of Risks
By using ViralFX services, you acknowledge that:

**You understand and accept that:**
- Trading viral trends involves EXTREME financial risk
- You may lose your entire investment and more
- Past performance is not indicative of future results
- Markets can be extremely volatile and unpredictable
- Technical failures may result in significant losses
- No one can predict market movements with certainty
- Viral trends can change direction suddenly and without warning
- Social media sentiment may not reflect fundamental value

**You confirm that you:**
- Have read and understood this risk disclaimer
- Have the financial capacity to withstand potential losses
- Are trading at your own risk and discretion
- Have sought independent financial advice if necessary
- Are not relying on ViralFX for investment advice
- Understand the limitations of our analysis and predictions

### 12.2 Legal Acknowledgment
**You legally acknowledge that:**
- ViralFX is not liable for your trading decisions or losses
- Your relationship with brokers is separate from ViralFX
- You are responsible for compliance with all applicable laws
- You indemnify ViralFX against claims arising from your actions
- This disclaimer limits ViralFX's liability as described herein
- Some rights may vary by jurisdiction

### 12.3 Ongoing Acceptance
**Your continued use of ViralFX services indicates:**
- Ongoing acceptance of these risk disclaimers
- Agreement to comply with all terms and conditions
- Understanding that markets and risks may change over time
- Commitment to monitor your own risk exposure
- Acceptance of responsibility for your trading outcomes

### 12.4 Withdrawal Agreement
**If you do not agree with these terms:**
- You must cease using ViralFX services immediately
- You should close your account and withdraw all funds
- You should seek alternative trading platforms
- You should consult with legal counsel if needed
- You cannot hold ViralFX liable for any consequences

**Final Warning:**
Trading viral trends is EXTREMELY RISKY and may result in the loss of your entire investment. Only trade with money you can afford to lose completely. If you do not understand these risks or cannot afford potential losses, DO NOT TRADE.

**By proceeding with ViralFX, you confirm that you understand and accept all risks described in this disclaimer.**
      `.trim(),
      riskLevel: 'EXTREME',
    },
  ];

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'LOW': return '#52C41A';
      case 'MEDIUM': return '#FFB300';
      case 'HIGH': return '#FF7A45';
      case 'EXTREME': return '#FF4D4F';
      default: return '#B8BCC8';
    }
  };

  const getRiskTag = (level?: string) => {
    switch (level) {
      case 'LOW': return <Tag color="green">LOW RISK</Tag>;
      case 'MEDIUM': return <Tag color="orange">MEDIUM RISK</Tag>;
      case 'HIGH': return <Tag color="red">HIGH RISK</Tag>;
      case 'EXTREME': return <Tag color="red">EXTREME RISK</Tag>;
      default: return null;
    }
  };

  useEffect(() => {
    // Combine all sections into a single markdown content
    const combinedContent = disclaimerSections
      .map(section => `${section.title}\n\n${section.content}`)
      .join('\n\n---\n\n');
    setDisclaimerContent(combinedContent);
    setLoading(false);
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob([disclaimerContent], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `ViralFX-Risk-Disclaimer-${lastUpdated}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    message.success('Risk disclaimer downloaded successfully');
  };

  const handleAcknowledgment = () => {
    setAcknowledged(!acknowledged);
    if (!acknowledged) {
      message.success('Thank you for acknowledging the risks. Please trade responsibly.');
    }
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
        <title>Risk Disclaimer - ViralFX | Financial Risk Warnings & Trading Risks</title>
        <meta name="description" content="Important financial risk disclaimer for ViralFX viral trend trading platform. Understand trading risks, market volatility, and investor warnings." />
        <meta name="keywords" content="risk disclaimer, financial warning, trading risks, investment risks, FSCA, South Africa" />
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
              Risk Disclaimer
            </Breadcrumb.Item>
          </Breadcrumb>

          <Row justify="space-between" align="middle">
            <Col>
              <Title level={1} style={{ color: '#FFB300', margin: 0 }}>
                <WarningOutlined style={{ marginRight: '12px', color: '#FF4D4F' }} />
                Financial Risk Disclaimer
              </Title>
              <Text style={{ color: '#B8BCC8', fontSize: '16px' }}>
                Important information about trading risks and financial warnings
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

        {/* Critical Risk Alert */}
        <Alert
          message={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ExclamationCircleOutlined style={{ fontSize: '24px', color: '#FF4D4F' }} />
              <div>
                <strong style={{ color: '#FF4D4F' }}>CRITICAL WARNING</strong>
                <div style={{ marginTop: '4px' }}>
                  Trading viral trends involves EXTREME RISK and may result in complete loss of capital.
                  Only trade with money you can afford to lose entirely.
                </div>
              </div>
            </div>
          }
          type="error"
          showIcon={false}
          style={{
            background: 'rgba(255, 77, 79, 0.1)',
            border: '1px solid rgba(255, 77, 79, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        />

        {/* Risk Level Overview */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SecurityScanOutlined />
              <Text style={{ color: '#FFB300' }}>Risk Level Overview</Text>
            </div>
          }
          style={{
            background: 'linear-gradient(135deg, rgba(255, 77, 79, 0.1) 0%, rgba(255, 122, 69, 0.1) 100%)',
            border: '1px solid rgba(255, 77, 79, 0.3)',
            borderRadius: '12px',
            marginBottom: '32px',
          }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', color: '#FF4D4F', fontWeight: 'bold', marginBottom: '8px' }}>
                  95%
                </div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>
                  High Risk Sections
                </Text>
                <Progress percent={95} strokeColor="#FF4D4F" showInfo={false} />
              </div>
            </Col>
            <Col xs={24} sm={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', color: '#FF7A45', fontWeight: 'bold', marginBottom: '8px' }}>
                  5%
                </div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>
                  Medium Risk Sections
                </Text>
                <Progress percent={5} strokeColor="#FF7A45" showInfo={false} />
              </div>
            </Col>
            <Col xs={24} sm={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', color: '#FFB300', fontWeight: 'bold', marginBottom: '8px' }}>
                  0%
                </div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>
                  Low Risk Sections
                </Text>
                <Progress percent={0} strokeColor="#FFB300" showInfo={false} />
              </div>
            </Col>
            <Col xs={24} sm={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', color: '#52C41A', fontWeight: 'bold', marginBottom: '8px' }}>
                  ✅
                </div>
                <Text style={{ color: '#B8BCC8', display: 'block', marginBottom: '4px' }}>
                  Acknowledge to Proceed
                </Text>
                <Checkbox
                  checked={acknowledged}
                  onChange={handleAcknowledgment}
                  style={{ marginTop: '8px' }}
                >
                  I understand the risks
                </Checkbox>
              </div>
            </Col>
          </Row>
        </Card>

        <Row gutter={[24, 24]}>
          {/* Table of Contents */}
          <Col xs={24} lg={6}>
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <WarningOutlined />
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
                {disclaimerSections.map((section) => (
                  <AnchorLink
                    key={section.id}
                    href={`#${section.id}`}
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Text style={{ color: '#B8BCC8', fontSize: '14px' }}>
                          {section.title}
                        </Text>
                        {section.riskLevel && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: getRiskColor(section.riskLevel),
                            }}
                          />
                        )}
                      </div>
                    }
                    style={{ padding: '8px 0', borderBottom: '1px solid rgba(255, 179, 0, 0.1)' }}
                  />
                ))}
              </Anchor>
            </Card>
          </Col>

          {/* Disclaimer Content */}
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
                    h1: ({ children, ...props }) => {
                      const section = disclaimerSections.find(s => s.title === children?.toString());
                      return (
                        <div style={{ marginBottom: '24px' }}>
                          <Title
                            level={2}
                            id={section?.id}
                            style={{
                              color: getRiskColor(section?.riskLevel),
                              marginTop: '32px',
                              marginBottom: '16px'
                            }}
                            {...props}
                          >
                            {children}
                          </Title>
                          {section?.riskTag && (
                            <div style={{ marginBottom: '16px' }}>
                              {getRiskTag(section.riskLevel)}
                            </div>
                          )}
                        </div>
                      );
                    },
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
                          borderLeft: '4px solid #FF4D4F',
                          paddingLeft: '16px',
                          margin: '16px 0',
                          color: '#B8BCC8',
                          background: 'rgba(255, 77, 79, 0.1)',
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
                          borderColor: 'rgba(255, 77, 79, 0.2)',
                          margin: '32px 0',
                        }}
                      />
                    ),
                  }}
                >
                  {disclaimerContent}
                </ReactMarkdown>
              </div>

              {/* Final Acknowledgment */}
              <Card
                style={{
                  background: 'rgba(255, 77, 79, 0.1)',
                  border: '1px solid rgba(255, 77, 79, 0.3)',
                  borderRadius: '12px',
                  marginTop: '32px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <Title level={4} style={{ color: '#FF4D4F', marginBottom: '16px' }}>
                    Final Acknowledgment
                  </Title>
                  <Paragraph style={{ color: '#B8BCC8', marginBottom: '24px' }}>
                    By checking the box below, you acknowledge that you have read, understood, and accept
                    all risks associated with trading viral trends through ViralFX. You understand that
                    you may lose your entire investment and trade at your own risk.
                  </Paragraph>
                  <Checkbox
                    checked={acknowledged}
                    onChange={handleAcknowledgment}
                    style={{ fontSize: '16px' }}
                  >
                    <span style={{ color: '#FFB300', fontWeight: 'bold' }}>
                      I have read and accept all risks described in this disclaimer
                    </span>
                  </Checkbox>
                </div>
              </Card>
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
                  <Link to="/legal/privacy">
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
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>Privacy Policy</div>
                        <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                          POPIA compliant data protection policy
                        </Text>
                      </div>
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>

        {/* Risk Management Resources */}
        <Card
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SafetyCertificateOutlined />
              <Text style={{ color: '#FFB300' }}>Risk Management Resources</Text>
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
            <Col xs={24} sm={8}>
              <div style={{ padding: '16px', background: 'rgba(75, 0, 130, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                <DollarCircleOutlined style={{ fontSize: '32px', color: '#4B0082', marginBottom: '8px' }} />
                <div style={{ fontSize: '16px', color: '#FFB300', marginBottom: '4px' }}>Financial Advisor</div>
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  Consult with qualified financial professionals
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ padding: '16px', background: 'rgba(255, 179, 0, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                <RiseOutlined style={{ fontSize: '32px', color: '#FFB300', marginBottom: '8px' }} />
                <div style={{ fontSize: '16px', color: '#FFB300', marginBottom: '4px' }}>Risk Management Tools</div>
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  Use stop-loss orders and position sizing
                </Text>
              </div>
            </Col>
            <Col xs={24} sm={8}>
              <div style={{ padding: '16px', background: 'rgba(75, 0, 130, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
                <FireOutlined style={{ fontSize: '32px', color: '#4B0082', marginBottom: '8px' }} />
                <div style={{ fontSize: '16px', color: '#FFB300', marginBottom: '4px' }}>Education Resources</div>
                <Text style={{ color: '#B8BCC8', fontSize: '12px' }}>
                  Learn about trading strategies and risk management
                </Text>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Emergency Contact */}
        <Alert
          message={
            <div>
              <strong>Need Help?</strong>
              <div style={{ marginTop: '8px' }}>
                If you have questions about these risks or need assistance, contact our support team at
                <Text style={{ color: '#FFB300', marginLeft: '8px' }}>support@viralfx.co.za</Text>
              </div>
            </div>
          }
          type="info"
          showIcon
          style={{ marginTop: '24px' }}
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

export default DisclaimerPage;