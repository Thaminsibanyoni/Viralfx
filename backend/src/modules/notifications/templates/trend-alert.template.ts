export interface TrendAlertData {
  trendName: string;
  category: string;
  momentumScore: number;
  viralityRate: number;
  description?: string;
  userName?: string;
}

export function trendAlertTemplate(data: TrendAlertData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trend Alert - ${data.trendName}</title>
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
            border-bottom: 3px solid #FF6B35;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .trend-icon {
            color: #FF6B35;
            font-size: 48px;
            margin-bottom: 10px;
        }
        .trend-name {
            color: #FF6B35;
            font-size: 32px;
            font-weight: bold;
            margin: 10px 0;
        }
        .metrics {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
        }
        .metric {
            text-align: center;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #FF6B35;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        .trend-description {
            margin: 20px 0;
            padding: 15px;
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
        }
        .cta-button {
            display: inline-block;
            background-color: #FF6B35;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
        }
        .cta-button:hover {
            background-color: #e55a2b;
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
            <div class="trend-icon">🔥</div>
            <h1>New Trend Alert!</h1>
            <div class="trend-name">${data.trendName}</div>
        </div>

        <p>Hi ${data.userName || 'Trader'},</p>

        <p>We've detected a new trending topic that's gaining significant traction on social media platforms. This could present a trading opportunity.</p>

        <div class="metrics">
            <div class="metric">
                <div class="metric-value">${data.momentumScore}</div>
                <div class="metric-label">Momentum Score</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(data.viralityRate * 100).toFixed(1)}%</div>
                <div class="metric-label">Virality Rate</div>
            </div>
            <div class="metric">
                <div class="metric-value">${data.category}</div>
                <div class="metric-label">Category</div>
            </div>
        </div>

        ${data.description ? `
        <div class="trend-description">
            <strong>About this trend:</strong> ${data.description}
        </div>
        ` : ''}

        <h3>What this means for traders:</h3>
        <ul>
            <li>High momentum score indicates strong upward trend</li>
            <li>Increasing virality suggests growing public interest</li>
            <li>Monitor related stocks and commodities for movement</li>
            <li>Consider setting up price alerts for related assets</li>
        </ul>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/trends/${encodeURIComponent(data.trendName)}" class="cta-button">
                Analyze This Trend
            </a>
        </div>

        <p><strong>Disclaimer:</strong> Trend alerts are based on social media sentiment analysis and should not be considered financial advice. Always do your own research before trading.</p>

        <div class="footer">
            <p>Stay ahead of the trends with ViralFX</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
TREND ALERT - ${data.trendName.toUpperCase()}
${'='.repeat(50)}

Hi ${data.userName || 'Trader'},

We've detected a new trending topic that's gaining significant traction on social media platforms.

TREND METRICS:
- Trend Name: ${data.trendName}
- Category: ${data.category}
- Momentum Score: ${data.momentumScore}
- Virality Rate: ${(data.viralityRate * 100).toFixed(1)}%

${data.description ? `
DESCRIPTION:
${data.description}
` : ''}

WHAT THIS MEANS FOR TRADERS:
- High momentum score indicates strong upward trend
- Increasing virality suggests growing public interest
- Monitor related stocks and commodities for movement
- Consider setting up price alerts for related assets

Analyze this trend: ${process.env.FRONTEND_URL || 'https://viralfx.com'}/trends/${encodeURIComponent(data.trendName)}

Disclaimer: Trend alerts are based on social media sentiment analysis and should not be considered financial advice. Always do your own research before trading.

${'='.repeat(50)}
Stay ahead of the trends with ViralFX
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}