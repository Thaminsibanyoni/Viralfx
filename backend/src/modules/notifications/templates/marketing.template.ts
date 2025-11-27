export interface MarketingData {
  campaign: string;
  content: string;
  subject: string;
  promotionCode?: string;
  promotionDetails?: string;
  userName?: string;
  unsubscribeUrl?: string;
}

export function marketingTemplate(data: MarketingData): { html: string; text: string; } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.subject}</title>
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
        .promo-badge {
            display: inline-block;
            background-color: #FF6B35;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 10px;
        }
        .campaign-content {
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #4B0082;
        }
        .promo-box {
            background: linear-gradient(135deg, #4B0082, #6a1b9a);
            color: white;
            padding: 30px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .promo-code {
            font-size: 24px;
            font-weight: bold;
            background-color: rgba(255,255,255,0.2);
            padding: 10px 20px;
            border-radius: 5px;
            display: inline-block;
            margin: 10px 0;
            letter-spacing: 2px;
        }
        .cta-button {
            display: inline-block;
            background-color: #FF6B35;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
            font-size: 16px;
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
        .unsubscribe {
            font-size: 11px;
            color: #999;
            margin-top: 20px;
        }
        .unsubscribe a {
            color: #999;
            text-decoration: underline;
        }
        .features {
            display: flex;
            justify-content: space-between;
            margin: 30px 0;
        }
        .feature {
            flex: 1;
            text-align: center;
            padding: 20px 10px;
        }
        .feature-icon {
            font-size: 32px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="promo-badge">Special Offer</div>
            <h1>${data.subject}</h1>
        </div>

        <p>Hi ${data.userName || 'Trader'},</p>

        <div class="campaign-content">
            <h3>${data.campaign}</h3>
            <div>${data.content}</div>
        </div>

        ${data.promotionCode ? `
        <div class="promo-box">
            <h3>🎉 Exclusive Offer Just For You!</h3>
            <p>Use this special promotion code to unlock amazing benefits:</p>
            <div class="promo-code">${data.promotionCode}</div>
            ${data.promotionDetails ? `<p>${data.promotionDetails}</p>` : ''}
        </div>
        ` : ''}

        ${data.promotionCode ? `
        <div class="features">
            <div class="feature">
                <div class="feature-icon">🚀</div>
                <h4>Fast Execution</h4>
                <p>Lightning-fast trade execution</p>
            </div>
            <div class="feature">
                <div class="feature-icon">📊</div>
                <h4>Real-time Data</h4>
                <p>Live market trends and insights</p>
            </div>
            <div class="feature">
                <div class="feature-icon">🛡️</div>
                <h4>Secure Trading</h4>
                <p>Bank-level security for your funds</p>
            </div>
        </div>
        ` : ''}

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/campaigns/${encodeURIComponent(data.campaign)}" class="cta-button">
                ${data.promotionCode ? 'Claim Your Offer' : 'Learn More'}
            </a>
        </div>

        <p>This is a limited-time opportunity to enhance your trading experience with ViralFX's innovative social media trading platform.</p>

        <div class="footer">
            <p>Happy Trading! 📈</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>

            <div class="unsubscribe">
                <p>You're receiving this email because you subscribed to ViralFX marketing communications.</p>
                <p><a href="${data.unsubscribeUrl || (process.env.FRONTEND_URL || 'https://viralfx.com') + '/unsubscribe'}">Unsubscribe</a> |
                <a href="${process.env.FRONTEND_URL || 'https://viralfx.com'}/preferences">Manage Preferences</a></p>
            </div>
        </div>
    </div>
</body>
</html>`;

  const text = `
${data.subject.toUpperCase()}
${'='.repeat(50)}

Hi ${data.userName || 'Trader'},

${data.campaign}

${data.content}

${data.promotionCode ? `
🎉 EXCLUSIVE OFFER JUST FOR YOU! 🎉
Use this special promotion code to unlock amazing benefits:

PROMOTION CODE: ${data.promotionCode}

${data.promotionDetails || 'Apply this code at checkout to receive your special discount.'}

Features:
🚀 Fast Execution - Lightning-fast trade execution
📊 Real-time Data - Live market trends and insights
🛡️ Secure Trading - Bank-level security for your funds
` : ''}

This is a limited-time opportunity to enhance your trading experience with ViralFX's innovative social media trading platform.

${data.promotionCode ? 'Claim your offer now:' : 'Learn more:'}
${process.env.FRONTEND_URL || 'https://viralfx.com'}/campaigns/${encodeURIComponent(data.campaign)}

Happy Trading! 📈

${'='.repeat(50)}
© ${new Date().getFullYear()} ViralFX. All rights reserved.

You're receiving this email because you subscribed to ViralFX marketing communications.
Unsubscribe: ${data.unsubscribeUrl || (process.env.FRONTEND_URL || 'https://viralfx.com') + '/unsubscribe'}
Manage Preferences: ${process.env.FRONTEND_URL || 'https://viralfx.com'}/preferences
`;

  return { html, text };
}