export interface BrokerPayoutData {
  companyName: string;
  amount: number;
  period: string;
  transactionId: string;
  breakdown: {
    commissionRevenue: number;
    bonusRevenue: number;
    volumeDiscount: number;
  };
  clientCount: number;
  transactionCount: number;
  currency?: string;
}

export function brokerPayoutTemplate(payoutData: BrokerPayoutData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Broker Payout Confirmation - ViralFX</title>
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
            font-size: 28px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .payout-amount {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background: linear-gradient(135deg, #4caf50, #45a049);
            color: white;
            border-radius: 8px;
        }
        .amount {
            font-size: 36px;
            font-weight: bold;
            margin: 10px 0;
        }
        .payout-summary {
            background-color: #f8f9fa;
            border-left: 4px solid #FFB300;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .revenue-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .revenue-table th {
            background-color: #4B0082;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        .revenue-table td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        .revenue-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 20px 0;
        }
        .metric-card {
            background-color: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            text-align: center;
            border-left: 3px solid #4B0082;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #4B0082;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        .success-badge {
            display: inline-block;
            background-color: #4caf50;
            color: white;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
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
            <h1>🎉 Payout Confirmation</h1>
        </div>

        <p>Dear <strong>${payoutData.companyName}</strong>,</p>

        <p>Great news! Your monthly payout has been successfully processed and transferred to your account.</p>

        <div class="payout-amount">
            <h3>Total Payout Amount</h3>
            <div class="amount">${payoutData.currency || 'ZAR'} ${payoutData.amount.toLocaleString()}</div>
            <div style="margin-top: 10px;">
                <span class="success-badge">PAID</span>
            </div>
        </div>

        <div class="payout-summary">
            <h3>Transaction Details</h3>
            <table class="revenue-table">
                <tr>
                    <th>Payout Period</th>
                    <td>${payoutData.period}</td>
                </tr>
                <tr>
                    <th>Transaction ID</th>
                    <td><strong>${payoutData.transactionId}</strong></td>
                </tr>
                <tr>
                    <th>Processing Date</th>
                    <td>${new Date().toLocaleDateString()}</td>
                </tr>
                <tr>
                    <th>Status</th>
                    <td><span class="success-badge">Completed</span></td>
                </tr>
            </table>
        </div>

        <h3>Revenue Breakdown</h3>
        <table class="revenue-table">
            <tr>
                <th>Revenue Source</th>
                <th>Amount</th>
                <th>Percentage</th>
            </tr>
            <tr>
                <td>Commission Revenue</td>
                <td>${payoutData.currency || 'ZAR'} ${payoutData.breakdown.commissionRevenue.toLocaleString()}</td>
                <td>${((payoutData.breakdown.commissionRevenue / payoutData.amount) * 100).toFixed(1)}%</td>
            </tr>
            ${payoutData.breakdown.bonusRevenue > 0 ? `
            <tr>
                <td>Performance Bonus</td>
                <td>${payoutData.currency || 'ZAR'} ${payoutData.breakdown.bonusRevenue.toLocaleString()}</td>
                <td>${((payoutData.breakdown.bonusRevenue / payoutData.amount) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            ${payoutData.breakdown.volumeDiscount > 0 ? `
            <tr>
                <td>Volume Discount Credit</td>
                <td>${payoutData.currency || 'ZAR'} ${payoutData.breakdown.volumeDiscount.toLocaleString()}</td>
                <td>${((payoutData.breakdown.volumeDiscount / payoutData.amount) * 100).toFixed(1)}%</td>
            </tr>
            ` : ''}
            <tr>
                <td><strong>Total Payout</strong></td>
                <td><strong>${payoutData.currency || 'ZAR'} ${payoutData.amount.toLocaleString()}</strong></td>
                <td><strong>100%</strong></td>
            </tr>
        </table>

        <h3>Performance Metrics</h3>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${payoutData.clientCount}</div>
                <div class="metric-label">Active Clients</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${payoutData.transactionCount}</div>
                <div class="metric-label">Total Trades</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${payoutData.currency || 'ZAR'} ${(payoutData.breakdown.commissionRevenue / payoutData.clientCount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                <div class="metric-label">Avg. Revenue per Client</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${payoutData.currency || 'ZAR'} ${(payoutData.breakdown.commissionRevenue / payoutData.transactionCount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="metric-label">Avg. Commission per Trade</div>
            </div>
        </div>

        <h3>Next Steps</h3>
        <ul>
            <li>The funds should appear in your designated bank account within 1-3 business days</li>
            <li>You can view detailed transaction reports in your broker dashboard</li>
            <li>Monthly statements are available for download in the billing section</li>
        </ul>

        <p>Thank you for your continued partnership with ViralFX. We appreciate your business and look forward to another successful month!</p>

        <div class="footer">
            <p>Best regards,<br>The ViralFX Team</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
VIRALFX - BROKER PAYOUT CONFIRMATION

Dear ${payoutData.companyName},

Great news! Your monthly payout has been successfully processed and transferred to your account.

TOTAL PAYOUT AMOUNT:
====================
${payoutData.currency || 'ZAR'} ${payoutData.amount.toLocaleString()}
STATUS: PAID ✅

TRANSACTION DETAILS:
====================
Payout Period: ${payoutData.period}
Transaction ID: ${payoutData.transactionId}
Processing Date: ${new Date().toLocaleDateString()}
Status: Completed

REVENUE BREAKDOWN:
==================
Commission Revenue: ${payoutData.currency || 'ZAR'} ${payoutData.breakdown.commissionRevenue.toLocaleString()} (${((payoutData.breakdown.commissionRevenue / payoutData.amount) * 100).toFixed(1)}%)
${payoutData.breakdown.bonusRevenue > 0 ? `Performance Bonus: ${payoutData.currency || 'ZAR'} ${payoutData.breakdown.bonusRevenue.toLocaleString()} (${((payoutData.breakdown.bonusRevenue / payoutData.amount) * 100).toFixed(1)}%)` : ''}
${payoutData.breakdown.volumeDiscount > 0 ? `Volume Discount Credit: ${payoutData.currency || 'ZAR'} ${payoutData.breakdown.volumeDiscount.toLocaleString()} (${((payoutData.breakdown.volumeDiscount / payoutData.amount) * 100).toFixed(1)}%)` : ''}
Total Payout: ${payoutData.currency || 'ZAR'} ${payoutData.amount.toLocaleString()} (100%)

PERFORMANCE METRICS:
====================
Active Clients: ${payoutData.clientCount}
Total Trades: ${payoutData.transactionCount}
Avg. Revenue per Client: ${payoutData.currency || 'ZAR'} ${(payoutData.breakdown.commissionRevenue / payoutData.clientCount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
Avg. Commission per Trade: ${payoutData.currency || 'ZAR'} ${(payoutData.breakdown.commissionRevenue / payoutData.transactionCount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

NEXT STEPS:
============
• The funds should appear in your designated bank account within 1-3 business days
• You can view detailed transaction reports in your broker dashboard
• Monthly statements are available for download in the billing section

Thank you for your continued partnership with ViralFX. We appreciate your business and look forward to another successful month!

Best regards,
The ViralFX Team
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}