export interface ComplianceAlertData {
  brokerName: string;
  alertType: string;
  severity: 'HIGH' | 'CRITICAL';
  message: string;
  recommendations: string[];
  requiresAction: boolean;
  userName?: string;
}

export function complianceAlertTemplate(data: ComplianceAlertData): { html: string; text: string; } {
  const severityColor = data.severity === 'CRITICAL' ? '#dc3545' : '#ffc107';
  const severityIcon = data.severity === 'CRITICAL' ? '🚨' : '⚠️';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Compliance Alert - ${data.alertType}</title>
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
            border-bottom: 3px solid ${severityColor};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .alert-icon {
            color: ${severityColor};
            font-size: 48px;
            margin-bottom: 10px;
        }
        .alert-message {
            background-color: ${data.severity === 'CRITICAL' ? '#f8d7da' : '#fff3cd'};
            border: 1px solid ${data.severity === 'CRITICAL' ? '#f5c6cb' : '#ffeaa7'};
            color: ${data.severity === 'CRITICAL' ? '#721c24' : '#856404'};
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .alert-details {
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 5px;
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
            border-left: 4px solid ${severityColor};
        }
        .recommendation-icon {
            color: ${severityColor};
            margin-right: 15px;
            font-size: 20px;
        }
        .action-required {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            text-align: center;
        }
        .cta-button {
            display: inline-block;
            background-color: ${severityColor};
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            opacity: 0.9;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
        .severity-badge {
            display: inline-block;
            background-color: ${severityColor};
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="alert-icon">${severityIcon}</div>
            <h1>Compliance Alert</h1>
            <span class="severity-badge">${data.severity}</span>
        </div>

        <p>Hi ${data.userName || 'Partner'},</p>

        <div class="alert-message">
            <strong>${data.severity === 'CRITICAL' ? 'URGENT:' : 'ATTENTION:'}</strong> ${data.message}
        </div>

        <div class="alert-details">
            <h3>Alert Details:</h3>
            <ul>
                <li><strong>Broker:</strong> ${data.brokerName}</li>
                <li><strong>Alert Type:</strong> ${data.alertType}</li>
                <li><strong>Severity:</strong> ${data.severity}</li>
                <li><strong>Timestamp:</strong> ${new Date().toLocaleString()}</li>
            </ul>
        </div>

        ${data.requiresAction ? `
        <div class="action-required">
            <strong>⚡ Immediate Action Required</strong><br>
            This compliance issue requires your immediate attention to ensure regulatory compliance.
        </div>
        ` : ''}

        <div class="recommendations">
            <h3>Recommended Actions:</h3>
            ${data.recommendations.map((recommendation) => `
            <div class="recommendation">
                <div class="recommendation-icon">📋</div>
                <div>${recommendation}</div>
            </div>
            `).join('')}
        </div>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/compliance" class="cta-button">
                ${data.requiresAction ? 'Take Action Now' : 'Review Compliance Dashboard'}
            </a>
        </div>

        ${data.severity === 'CRITICAL' ? `
        <p><strong>Note:</strong> This is a critical compliance alert. Failure to address this issue promptly may result in regulatory penalties or account suspension.</p>
        ` : ''}

        <p>If you have any questions or need assistance with compliance requirements, please contact our compliance team immediately.</p>

        <div class="footer">
            <p>ViralFX Compliance Team</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
COMPLIANCE ALERT - ${data.alertType.toUpperCase()}
${data.severity === 'CRITICAL' ? 'URGENT' : 'ATTENTION'}
${'='.repeat(50)}

Hi ${data.userName || 'Partner'},

${data.severity === 'CRITICAL' ? 'URGENT:' : 'ATTENTION:'} ${data.message}

ALERT DETAILS:
- Broker: ${data.brokerName}
- Alert Type: ${data.alertType}
- Severity: ${data.severity}
- Timestamp: ${new Date().toLocaleString()}

${data.requiresAction ? `
IMMEDIATE ACTION REQUIRED
This compliance issue requires your immediate attention to ensure regulatory compliance.
` : ''}

RECOMMENDED ACTIONS:
${data.recommendations.map((recommendation) => `• ${recommendation}`).join('\n')}

${data.requiresAction ? 'Take action now:' : 'Review compliance dashboard:'}
${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/compliance

${data.severity === 'CRITICAL' ? `
NOTE: This is a critical compliance alert. Failure to address this issue promptly may result in regulatory penalties or account suspension.
` : ''}

If you have any questions or need assistance with compliance requirements, please contact our compliance team immediately.

${'='.repeat(50)}
ViralFX Compliance Team
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}
