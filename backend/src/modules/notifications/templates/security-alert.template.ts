export interface SecurityAlertData {
  alertType: string;
  description: string;
  ipAddress: string;
  timestamp: Date;
  userName?: string;
  email?: string;
}

export function securityAlertTemplate(alertData: SecurityAlertData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Alert - ViralFX</title>
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
        .logo {
            color: #4B0082;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .alert-box {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .alert-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .alert-details {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #ffeaa7;
        }
        .detail-label {
            font-weight: bold;
            color: #856404;
        }
        .detail-value {
            color: #856404;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 30px 0;
        }
        .btn-secure {
            background-color: #28a745;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .btn-review {
            background-color: #ffc107;
            color: #212529;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .security-tips {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
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
            <h1>🔒 Security Alert</h1>
        </div>

        <div class="alert-box">
            <div class="alert-icon">⚠️</div>
            <h2>Security Activity Detected</h2>
            <p>We've detected unusual activity on your ViralFX account</p>
        </div>

        <p>Hi ${alertData.userName || 'User'},</p>
        <p>We detected a security event on your ViralFX account that requires your attention.</p>

        <div class="alert-details">
            <h3>Alert Details:</h3>
            <div class="detail-row">
                <span class="detail-label">Alert Type:</span>
                <span class="detail-value">${alertData.alertType}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Description:</span>
                <span class="detail-value">${alertData.description}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">IP Address:</span>
                <span class="detail-value">${alertData.ipAddress}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${new Date(alertData.timestamp).toLocaleString()}</span>
            </div>
        </div>

        <div class="action-buttons">
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/security" class="btn-secure">Secure Account</a>
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/activity" class="btn-review">Review Activity</a>
        </div>

        <div class="security-tips">
            <h3>🛡️ Security Recommendations:</h3>
            <ul>
                <li>Change your password immediately if you don't recognize this activity</li>
                <li>Enable two-factor authentication (2FA) for added security</li>
                <li>Review your recent login history and connected devices</li>
                <li>Contact support if you believe your account has been compromised</li>
            </ul>
        </div>

        <h3>🚨 If This Wasn't You:</h3>
        <p>If you don't recognize this activity, please take immediate action:</p>
        <ol>
            <li>Change your password immediately</li>
            <li>Enable 2FA if not already enabled</li>
            <li>Review and revoke any unauthorized sessions</li>
            <li>Contact our support team at security@viralfx.com</li>
        </ol>

        <div class="footer">
            <p>Security is our top priority at ViralFX</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated security alert. Please do not reply to this email.</p>
            <p>If you have concerns about this alert, contact security@viralfx.com</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🔒 SECURITY ALERT - VIRALFX

IMPORTANT: Security activity detected on your account

Hi ${alertData.userName || 'User'},

We've detected unusual security activity on your ViralFX account that requires your immediate attention.

ALERT DETAILS:
==============
Alert Type: ${alertData.alertType}
Description: ${alertData.description}
IP Address: ${alertData.ipAddress}
Time: ${new Date(alertData.timestamp).toLocaleString()}

IMMEDIATE ACTIONS:
=================
1. Secure your account: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/security
2. Review your activity: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/activity

🛡️ SECURITY RECOMMENDATIONS:
============================
• Change your password immediately if you don't recognize this activity
• Enable two-factor authentication (2FA) for added security
• Review your recent login history and connected devices
• Contact support if you believe your account has been compromised

🚨 IF THIS WASN'T YOU:
=====================
If you don't recognize this activity, please take immediate action:
1. Change your password immediately
2. Enable 2FA if not already enabled
3. Review and revoke any unauthorized sessions
4. Contact our support team at security@viralfx.com

Security is our top priority at ViralFX
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated security alert. Please do not reply to this email.
If you have concerns about this alert, contact security@viralfx.com
`;

  return { html, text };
}
