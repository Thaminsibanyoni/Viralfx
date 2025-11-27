export interface IntegrationTestFailedData {
  brokerName: string;
  integrationType: string;
  errors: string[];
  recommendations: string[];
  userName?: string;
}

export function integrationTestFailedTemplate(data: IntegrationTestFailedData): { html: string; text: string; } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Integration Test Failed - ${data.integrationType}</title>
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
        .error-icon {
            color: #dc3545;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .error-message {
            background-color: #f8d7da;
            border: 1px solid #f5c6cb;
            color: #721c24;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
        }
        .error-details {
            margin: 20px 0;
        }
        .error-item {
            background-color: #f8f9fa;
            border-left: 4px solid #dc3545;
            padding: 15px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .error-code {
            font-family: 'Courier New', monospace;
            background-color: #e9ecef;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
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
            <div class="error-icon">❌</div>
            <h1>Integration Test Failed</h1>
        </div>

        <p>Hi ${data.userName || 'Partner'},</p>

        <div class="error-message">
            <strong>Integration Issue Detected:</strong> The integration test for <strong>${data.integrationType}</strong> has failed.
        </div>

        <div class="error-details">
            <h3>Test Details:</h3>
            <ul>
                <li><strong>Broker:</strong> ${data.brokerName}</li>
                <li><strong>Integration Type:</strong> ${data.integrationType}</li>
                <li><strong>Test Time:</strong> ${new Date().toLocaleString()}</li>
                <li><strong>Status:</strong> <span class="error-code">FAILED</span></li>
            </ul>
        </div>

        <h3>Errors Encountered:</h3>
        ${data.errors.map((error) => `
        <div class="error-item">
            <strong>Error:</strong> ${error}
        </div>
        `).join('')}

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
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/integrations/${data.integrationType.toLowerCase()}" class="cta-button">
                Fix Integration
            </a>
        </div>

        <p>Please address these issues promptly to ensure smooth operation of your integration. Some features may be limited until the integration is properly configured.</p>

        <p>If you need technical assistance, please contact our integration support team with the error details above.</p>

        <div class="footer">
            <p>ViralFX Integration Team</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
INTEGRATION TEST FAILED - ${data.integrationType.toUpperCase()}
${'='.repeat(50)}

Hi ${data.userName || 'Partner'},

Integration Issue Detected: The integration test for ${data.integrationType} has failed.

TEST DETAILS:
- Broker: ${data.brokerName}
- Integration Type: ${data.integrationType}
- Test Time: ${new Date().toLocaleString()}
- Status: FAILED

ERRORS ENCOUNTERED:
${data.errors.map((error, index) => `${index + 1}. ${error}`).join('\n')}

RECOMMENDED ACTIONS:
${data.recommendations.map((recommendation) => `• ${recommendation}`).join('\n')}

Fix integration: ${process.env.FRONTEND_URL || 'https://viralfx.com'}/broker/integrations/${data.integrationType.toLowerCase()}

Please address these issues promptly to ensure smooth operation of your integration. Some features may be limited until the integration is properly configured.

If you need technical assistance, please contact our integration support team with the error details above.

${'='.repeat(50)}
ViralFX Integration Team
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}