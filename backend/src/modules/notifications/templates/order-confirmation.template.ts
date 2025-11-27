export interface OrderConfirmationData {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price?: number;
  orderType: string;
  totalValue: number;
  feeAmount: number;
  timestamp: string;
  status?: string;
}

export function orderConfirmationTemplate(orderDetails: OrderConfirmationData): { html: string; text: string } {
  const isBuy = orderDetails.side === 'BUY';
  const sideColor = isBuy ? '#4caf50' : '#f44336';
  const sideIcon = isBuy ? '📈' : '📉';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation - ViralFX</title>
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
        .order-badge {
            display: inline-block;
            padding: 8px 16px;
            background-color: ${sideColor};
            color: white;
            font-weight: bold;
            border-radius: 20px;
            font-size: 18px;
            margin: 10px 0;
        }
        .order-summary {
            background-color: #f8f9fa;
            border-left: 4px solid #FFB300;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .details-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .details-table th {
            background-color: #4B0082;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }
        .details-table td {
            padding: 12px;
            border-bottom: 1px solid #ddd;
        }
        .details-table tr:nth-child(even) {
            background-color: #f8f9fa;
        }
        .amount-positive {
            color: #4caf50;
            font-weight: bold;
        }
        .amount-negative {
            color: #f44336;
            font-weight: bold;
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
        .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .status-pending {
            background-color: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
        }
        .status-filled {
            background-color: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        .status-cancelled {
            background-color: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
        .disclaimer {
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            padding: 15px;
            border-radius: 4px;
            margin: 20px 0;
            font-size: 12px;
            color: #6c757d;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ViralFX</div>
            <h2>Order Confirmation</h2>
        </div>

        <p>Your order has been successfully placed!</p>

        <div style="text-align: center;">
            <span class="order-badge">${sideIcon} ${orderDetails.side} ${orderDetails.orderType}</span>
        </div>

        <div class="order-summary">
            <h3>Order Details</h3>
            <table class="details-table">
                <tr>
                    <th>Order ID</th>
                    <td><strong>${orderDetails.orderId}</strong></td>
                </tr>
                <tr>
                    <th>Symbol</th>
                    <td><strong>${orderDetails.symbol}</strong></td>
                </tr>
                <tr>
                    <th>Side</th>
                    <td><span style="color: ${sideColor}; font-weight: bold;">${orderDetails.side}</span></td>
                </tr>
                <tr>
                    <th>Order Type</th>
                    <td>${orderDetails.orderType}</td>
                </tr>
                <tr>
                    <th>Quantity</th>
                    <td>${orderDetails.quantity.toLocaleString()}</td>
                </tr>
                ${orderDetails.price ? `
                <tr>
                    <th>Price</th>
                    <td>ZAR ${orderDetails.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                ` : ''}
                <tr>
                    <th>Total Value</th>
                    <td class="${isBuy ? 'amount-negative' : 'amount-positive'}">
                        ZAR ${orderDetails.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                </tr>
                <tr>
                    <th>Trading Fee</th>
                    <td>ZAR ${orderDetails.feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <th>Net Amount</th>
                    <td class="${isBuy ? 'amount-negative' : 'amount-positive'}">
                        <strong>ZAR ${(orderDetails.totalValue + orderDetails.feeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </td>
                </tr>
                <tr>
                    <th>Status</th>
                    <td>
                        <span class="status-badge status-${(orderDetails.status || 'pending').toLowerCase()}">
                            ${orderDetails.status || 'PENDING'}
                        </span>
                    </td>
                </tr>
                <tr>
                    <th>Placed At</th>
                    <td>${new Date(orderDetails.timestamp).toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <div style="text-align: center;">
            <a href="https://viralfx.com/dashboard/orders" class="cta-button">View Order in Dashboard</a>
        </div>

        <div class="disclaimer">
            <strong>Risk Disclaimer:</strong> Trading social media performance trends involves significant risk and may not be suitable for all investors. Past performance is not indicative of future results. Please trade responsibly and never risk more than you can afford to lose.
        </div>

        <div class="footer">
            <p>Thank you for using ViralFX</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
VIRALFX - ORDER CONFIRMATION

Your order has been successfully placed!

${sideIcon} ${orderDetails.side} ${orderDetails.orderType}

ORDER DETAILS:
==============
Order ID: ${orderDetails.orderId}
Symbol: ${orderDetails.symbol}
Side: ${orderDetails.side}
Order Type: ${orderDetails.orderType}
Quantity: ${orderDetails.quantity.toLocaleString()}
${orderDetails.price ? `Price: ZAR ${orderDetails.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}
Total Value: ZAR ${orderDetails.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Trading Fee: ZAR ${orderDetails.feeAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Net Amount: ZAR ${(orderDetails.totalValue + orderDetails.feeAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
Status: ${orderDetails.status || 'PENDING'}
Placed At: ${new Date(orderDetails.timestamp).toLocaleString()}

View your order in the dashboard: https://viralfx.com/dashboard/orders

RISK DISCLAIMER:
===============
Trading social media performance trends involves significant risk and may not be suitable for all investors. Past performance is not indicative of future results. Please trade responsibly and never risk more than you can afford to lose.

Thank you for using ViralFX
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated message. Please do not reply to this email.
`;

  return { html, text };
}