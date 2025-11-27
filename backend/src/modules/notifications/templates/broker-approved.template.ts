export interface BrokerApprovedData {
  brokerName: string;
  status: string;
  nextSteps?: string;
  userName?: string;
  email?: string;
}

export function brokerApprovedTemplate(data: BrokerApprovedData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broker Account Approved - ${data.brokerName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #28a745;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            color: #4B0082;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .success-box {
            background: linear-gradient(135deg, #28a745, #20c997);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .success-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .broker-info {
            background-color: #e8f5e8;
            border: 1px solid #4caf50;
            color: #2e7d32;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #c8e6c9;
        }
        .info-label {
            font-weight: bold;
        }
        .action-steps {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .step {
            margin: 10px 0;
            padding: 10px 0;
        }
        .cta-button {
            display: inline-block;
            background-color: #4B0082;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #3a0066;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ViralFX</div>
            <h1>✅ Broker Account Approved</h1>
        </div>

        <div class="success-box">
            <div class="success-icon">🎉</div>
            <h2>Congratulations! Your Broker Account is Approved</h2>
            <p>${data.brokerName} has been successfully verified and connected</p>
        </div>

        <p>Hi ${data.userName || 'Trader'},</p>
        <p>Great news! Your broker account with <strong>${data.brokerName}</strong> has been approved and is now ready to use on the ViralFX platform.</p>

        <div class="broker-info">
            <h3>📊 Broker Account Details:</h3>
            <div class="info-row">
                <span class="info-label">Broker Name:</span>
                <span>${data.brokerName}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span style="color: #28a745; font-weight: bold;">✅ Approved</span>
            </div>
            <div class="info-row">
                <span class="info-label">Approval Date:</span>
                <span>${new Date().toLocaleDateString()}</span>
            </div>
        </div>

        <div class="action-steps">
            <h3>🚀 Next Steps:</h3>
            <div class="step">
                <strong>1. Connect Your Account:</strong> Link your ${data.brokerName} trading account to start executing trades through ViralFX.
            </div>
            <div class="step">
                <strong>2. Verify API Access:</strong> Ensure your API credentials are properly configured for seamless integration.
            </div>
            <div class="step">
                <strong>3. Start Trading:</strong> Begin leveraging our social media trading insights with your approved broker.
            </div>
            ${data.nextSteps ? `<div class="step"><strong>4. Additional Requirements:</strong> ${data.nextSteps}</div>` : ''}
        </div>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/brokers/connect" class="cta-button">Connect Your Account</a>
        </div>

        <h3>🎯 Benefits of Your Approved Broker:</h3>
        <ul>
            <li>⚡ Instant trade execution with low latency</li>
            <li>📈 Real-time market data and analytics</li>
            <li>🔒 Enhanced security and regulatory compliance</li>
            <li>💰 Access to advanced trading features</li>
            <li>📱 Mobile trading capabilities</li>
        </ul>

        <h3>📞 Need Help?</h3>
        <p>Our support team is here to assist you:</p>
        <ul>
            <li>📧 Email: <a href="mailto:support@viralfx.com">support@viralfx.com</a></li>
            <li>📚 Documentation: Comprehensive setup guides and FAQs</li>
            <li>💬 Live Chat: Available during business hours</li>
        </ul>

        <div class="footer">
            <p>Welcome to the ViralFX trading community!</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
✅ BROKER ACCOUNT APPROVED - ${data.brokerName}

CONGRATULATIONS! Your broker account has been approved.

Hi ${data.userName || 'Trader'},

Great news! Your broker account with ${data.brokerName} has been approved and is now ready to use on the ViralFX platform.

BROKER ACCOUNT DETAILS:
======================
Broker Name: ${data.brokerName}
Status: ✅ Approved
Approval Date: ${new Date().toLocaleDateString()}

🚀 NEXT STEPS:
===============
1. Connect Your Account: Link your ${data.brokerName} trading account to start executing trades through ViralFX.
2. Verify API Access: Ensure your API credentials are properly configured for seamless integration.
3. Start Trading: Begin leveraging our social media trading insights with your approved broker.
${data.nextSteps ? `4. Additional Requirements: ${data.nextSteps}` : ''}

Connect Your Account: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/brokers/connect

🎯 BENEFITS OF YOUR APPROVED BROKER:
====================================
⚡ Instant trade execution with low latency
📈 Real-time market data and analytics
🔒 Enhanced security and regulatory compliance
💰 Access to advanced trading features
📱 Mobile trading capabilities

📞 NEED HELP?
=============
📧 Email: support@viralfx.com
📚 Documentation: Comprehensive setup guides and FAQs
💬 Live Chat: Available during business hours

Welcome to the ViralFX trading community!
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}