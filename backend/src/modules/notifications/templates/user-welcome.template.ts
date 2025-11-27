export interface UserWelcomeData {
  name: string;
  email: string;
  loginUrl: string;
  supportEmail: string;
  hasBroker?: boolean;
  brokerName?: string;
}

export function userWelcomeTemplate(userData: UserWelcomeData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ViralFX</title>
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
            border-bottom: 3px solid #4B0082;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            color: #4B0082;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .welcome-message {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: linear-gradient(135deg, #4B0082, #6a1b9a);
            color: white;
            border-radius: 8px;
        }
        .steps-container {
            margin: 30px 0;
        }
        .step {
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #FFB300;
        }
        .step-number {
            background-color: #4B0082;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
            flex-shrink: 0;
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
        .broker-info {
            background-color: #e8f5e8;
            border: 1px solid #4caf50;
            color: #2e7d32;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
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
            <h1>Welcome to ViralFX!</h1>
        </div>

        <div class="welcome-message">
            <h2>Hi ${userData.name},</h2>
            <p>Welcome to the future of social media trading! We're excited to have you join our community.</p>
        </div>

        <p>Your account has been successfully created with email: <strong>${userData.email}</strong></p>

        <div class="steps-container">
            <h3>Getting Started Guide</h3>

            <div class="step">
                <div class="step-number">1</div>
                <div>
                    <strong>Verify Your Email</strong>
                    <p>Check your inbox for a verification email to activate your account.</p>
                </div>
            </div>

            <div class="step">
                <div class="step-number">2</div>
                <div>
                    <strong>Complete KYC Verification</strong>
                    <p>Verify your identity to unlock full trading features and higher limits.</p>
                </div>
            </div>

            <div class="step">
                <div class="step-number">3</div>
                <div>
                    <strong>Fund Your Wallet</strong>
                    <p>Add funds to your wallet using our secure payment methods.</p>
                </div>
            </div>

            <div class="step">
                <div class="step-number">4</div>
                <div>
                    <strong>Start Trading</strong>
                    <p>Explore trending topics and place your first trades on social media performance.</p>
                </div>
            </div>
        </div>

        ${userData.hasBroker ? `
        <div class="broker-info">
            <strong>🎉 You're connected with ${userData.brokerName}!</strong>
            <p>Your broker will provide additional support and services to enhance your trading experience.</p>
        </div>
        ` : ''}

        <div style="text-align: center;">
            <a href="${userData.loginUrl}" class="cta-button">Login to Your Account</a>
        </div>

        <h3>Need Help?</h3>
        <p>Our support team is here to help you get started:</p>
        <ul>
            <li>📧 Email: <a href="mailto:${userData.supportEmail}">${userData.supportEmail}</a></li>
            <li>📚 Help Center: Visit our comprehensive FAQ section</li>
            <li>💬 Live Chat: Available on our website during business hours</li>
        </ul>

        <div class="footer">
            <p>Thank you for choosing ViralFX</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
WELCOME TO VIRALFX!

Hi ${userData.name},

Welcome to the future of social media trading! We're excited to have you join our community.

Your account has been successfully created with email: ${userData.email}

GETTING STARTED GUIDE:
====================

1. VERIFY YOUR EMAIL
   Check your inbox for a verification email to activate your account.

2. COMPLETE KYC VERIFICATION
   Verify your identity to unlock full trading features and higher limits.

3. FUND YOUR WALLET
   Add funds to your wallet using our secure payment methods.

4. START TRADING
   Explore trending topics and place your first trades on social media performance.

${userData.hasBroker ? `
🎉 You're connected with ${userData.brokerName}!
Your broker will provide additional support and services to enhance your trading experience.
` : ''}

Login to your account: ${userData.loginUrl}

NEED HELP?
========
Our support team is here to help you get started:
📧 Email: ${userData.supportEmail}
📚 Help Center: Visit our comprehensive FAQ section
💬 Live Chat: Available on our website during business hours

Thank you for choosing ViralFX
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}