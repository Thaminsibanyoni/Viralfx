export interface BrokerVerificationFailedData {
  brokerName: string;
  result: string;
  message: string;
  rejectionReason: string;
  recommendations: string[];
  userName?: string;
}

export function brokerVerificationFailedTemplate(data: BrokerVerificationFailedData): { html: string; text: string; } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broker Verification Review Required</title>
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
            border-bottom: 3px solid #dc3545;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .alert-icon {
            color: #dc3545;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .alert-message {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .rejection-reason {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .recommendations {
            margin: 20px 0;
        }
        .recommendation {
            display: flex;
            align-items: flex-start;
            margin: 15px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
            border-left: 4px solid #ffc107;
        }
        .recommendation-icon {
            color: #ffc107;
            margin-right: 15px;
            font-size: 20px;
        }
        .cta-button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #0056b3;
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
            <div class="alert-icon">⚠️</div>
            <h1>Verification Review Required</h1>
        </div>

        <p>Hi ${data.userName || 'Partner'},</p>

        <div class="alert-message">
            <strong>Action Required:</strong> Your broker verification for <strong>${data.brokerName}</strong> requires attention.
        </div>

        <h3>Verification Details:</h3>
        <ul>
            <li><strong>Broker:</strong> ${data.brokerName}</li>
            <li><strong>Status:</strong> ${data.result}</li>
            <li><strong>Reviewed:</strong> ${new Date().toLocaleDateString()}</li>
        </ul>

        <p>${data.message}</p>

        <div class="rejection-reason">
            <strong>Reason for Review:</strong> ${data.rejectionReason}
        </div>

        <div class="recommendations">
            <h3>Recommended Actions:</h3>
            ${data.recommendations.map((recommendation) => `
            <div class="recommendation">
                <div class="recommendation-icon">💡</div>
                <div>${recommendation}</div>
            </div>
            `).join('')}
        </div>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/verification" class="cta-button">
                Update Verification
            </a>
        </div>

        <p>Please review the feedback and update your verification information. Our team will review your submission within 2-3 business days.</p>

        <p>If you have any questions or need assistance, please contact our partner support team.</p>

        <div class="footer">
            <p>ViralFX Partner Support</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
BROKER VERIFICATION REVIEW REQUIRED
${'='.repeat(50)}

Hi ${data.userName || 'Partner'},

Action Required: Your broker verification for ${data.brokerName} requires attention.

VERIFICATION DETAILS:
- Broker: ${data.brokerName}
- Status: ${data.result}
- Reviewed: ${new Date().toLocaleDateString()}

${data.message}

REASON FOR REVIEW:
${data.rejectionReason}

RECOMMENDED ACTIONS:
${data.recommendations.map((recommendation) => `• ${recommendation}`).join('\n')}

Update your verification: ${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/verification

Please review the feedback and update your verification information. Our team will review your submission within 2-3 business days.

If you have any questions or need assistance, please contact our partner support team.

${'='.repeat(50)}
ViralFX Partner Support
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}
