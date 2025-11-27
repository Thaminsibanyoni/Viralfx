export interface PriceAlertData {
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  alertType: 'ABOVE' | 'BELOW';
  userName?: string;
  email?: string;
}

export function priceAlertTemplate(alertData: PriceAlertData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Price Alert - ${alertData.symbol}</title>
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
        .alert-box {
            background: linear-gradient(135deg, #FF6B6B, #FF8E53);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .alert-box.above {
            background: linear-gradient(135deg, #4CAF50, #8BC34A);
        }
        .price-info {
            display: flex;
            justify-content: space-around;
            margin: 20px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
        }
        .price-item {
            text-align: center;
        }
        .price-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .price-value {
            font-size: 24px;
            font-weight: bold;
            color: #4B0082;
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
            <h1>Price Alert Triggered</h1>
        </div>

        <div class="alert-box ${alertData.alertType === 'ABOVE' ? 'above' : ''}">
            <h2>${alertData.alertType === 'ABOVE' ? '📈 Price Above Target' : '📉 Price Below Target'}</h2>
            <p>${alertData.symbol} has moved ${alertData.alertType.toLowerCase()} your target price!</p>
        </div>

        <div class="price-info">
            <div class="price-item">
                <div class="price-label">Current Price</div>
                <div class="price-value">$${alertData.currentPrice.toLocaleString()}</div>
            </div>
            <div class="price-item">
                <div class="price-label">Target Price</div>
                <div class="price-value">$${alertData.targetPrice.toLocaleString()}</div>
            </div>
            <div class="price-item">
                <div class="price-label">Alert Type</div>
                <div class="price-value">${alertData.alertType}</div>
            </div>
        </div>

        <p>Hi ${alertData.userName || 'Trader'},</p>
        <p>Your price alert for <strong>${alertData.symbol}</strong> has been triggered. The current price is <strong>$${alertData.currentPrice.toLocaleString()}</strong>, which is ${alertData.alertType.toLowerCase()} your target price of <strong>$${alertData.targetPrice.toLocaleString()}</strong>.</p>

        <div style="text-align: center;">
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/trade/${alertData.symbol}" class="cta-button">Trade Now</a>
        </div>

        <h3>What's Next?</h3>
        <ul>
            <li>📊 Check the live price chart for detailed analysis</li>
            <li>🔔 Set up additional alerts for other price levels</li>
            <li>💰 Consider your trading strategy and risk management</li>
            <li>📱 Monitor the position on your mobile app</li>
        </ul>

        <div class="footer">
            <p>Thank you for using ViralFX for your trading alerts</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Prices are delayed and may not reflect real-time market data.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
PRICE ALERT - ${alertData.symbol}

${alertData.alertType === 'ABOVE' ? '📈 Price Above Target' : '📉 Price Below Target'}

Hi ${alertData.userName || 'Trader'},

Your price alert for ${alertData.symbol} has been triggered!

CURRENT SITUATION:
==================
Current Price: $${alertData.currentPrice.toLocaleString()}
Target Price: $${alertData.targetPrice.toLocaleString()}
Alert Type: ${alertData.alertType}

The current price is ${alertData.alertType.toLowerCase()} your target price by $${Math.abs(alertData.currentPrice - alertData.targetPrice).toLocaleString()}.

WHAT'S NEXT?
===========
📊 Check the live price chart for detailed analysis
🔔 Set up additional alerts for other price levels
💰 Consider your trading strategy and risk management
📱 Monitor the position on your mobile app

Trade Now: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/trade/${alertData.symbol}

Thank you for using ViralFX for your trading alerts
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Prices are delayed and may not reflect real-time market data.
`;

  return { html, text };
}