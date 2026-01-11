export interface BrokerVerificationSuccessData {
  brokerName: string;
  result: string;
  message: string;
  nextSteps: string[];
  userName?: string;
}

export function brokerVerificationSuccessTemplate(data: BrokerVerificationSuccessData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broker Verification Successful</title>
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
        .success-icon {
            color: #28a745;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .success-message {
            background-color: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .next-steps {
            margin: 20px 0;
        }
        .step {
            display: flex;
            align-items: center;
            margin: 15px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #28a745;
        }
        .step-number {
            background-color: #28a745;
            color: white;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            margin-right: 15px;
        }
        .cta-button {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #218838;
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
            <div class="success-icon">✅</div>
            <h1>Verification Successful!</h1>
        </div>

        <p>Hi ${data.userName || 'Partner'},</p>

        <div class="success-message">
            <strong>Congratulations!</strong> Your broker account for <strong>${data.brokerName}</strong> has been successfully verified and approved.
        </div>

        <h3>Verification Details:</h3>
        <ul>
            <li><strong>Broker:</strong> ${data.brokerName}</li>
            <li><strong>Status:</strong> ${data.result}</li>
            <li><strong>Completed:</strong> ${new Date().toLocaleDateString()}</li>
        </ul>

        <p>${data.message}</p>

        <div class="next-steps">
            <h3>Next Steps:</h3>
            ${data.nextSteps.map((step, index) => `
            <div class="step">
                <div class="step-number">${index + 1}</div>
                <div>${step}</div>
            </div>
            `).join('')}
        </div>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/dashboard" class="cta-button">
                Go to Broker Dashboard
            </a>
        </div>

        <p>You can now start onboarding clients and managing your broker operations through the ViralFX platform.</p>

        <div class="footer">
            <p>Welcome to the ViralFX Partner Network</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
BROKER VERIFICATION SUCCESSFUL
${'='.repeat(50)}

Hi ${data.userName || 'Partner'},

Congratulations! Your broker account for ${data.brokerName} has been successfully verified and approved.

VERIFICATION DETAILS:
- Broker: ${data.brokerName}
- Status: ${data.result}
- Completed: ${new Date().toLocaleDateString()}

${data.message}

NEXT STEPS:
${data.nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

Go to your broker dashboard: ${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/dashboard

You can now start onboarding clients and managing your broker operations through the ViralFX platform.

${'='.repeat(50)}
Welcome to the ViralFX Partner Network
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}
