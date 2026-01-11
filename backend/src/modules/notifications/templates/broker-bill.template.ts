export interface BrokerBillData {
  billId: string;
  companyName: string;
  period: string;
  amount: number;
  dueDate: string;
  invoiceUrl: string;
  currency?: string;
}

export function brokerBillTemplate(billData: BrokerBillData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monthly Broker Bill - ViralFX</title>
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
        .bill-summary {
            background-color: #f8f9fa;
            border-left: 4px solid #FFB300;
            padding: 20px;
            margin: 20px 0;
            border-radius: 0 4px 4px 0;
        }
        .amount {
            font-size: 32px;
            font-weight: bold;
            color: #4B0082;
            margin: 10px 0;
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
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .info-table th {
            background-color: #4B0082;
            color: white;
            padding: 10px;
            text-align: left;
        }
        .info-table td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
        }
        .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 4px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">ViralFX</div>
            <h2>Monthly Broker Bill</h2>
        </div>

        <p>Dear <strong>${billData.companyName}</strong>,</p>

        <p>Your monthly broker bill for the period <strong>${billData.period}</strong> is now available.</p>

        <div class="bill-summary">
            <h3>Bill Summary</h3>
            <div class="amount">${billData.currency || 'ZAR'} ${billData.amount.toLocaleString()}</div>
            <p><strong>Due Date:</strong> ${billData.dueDate}</p>
            <p><strong>Bill ID:</strong> ${billData.billId}</p>
        </div>

        <table class="info-table">
            <tr>
                <th>Period</th>
                <td>${billData.period}</td>
            </tr>
            <tr>
                <th>Total Amount Due</th>
                <td><strong>${billData.currency || 'ZAR'} ${billData.amount.toLocaleString()}</strong></td>
            </tr>
            <tr>
                <th>Due Date</th>
                <td>${billData.dueDate}</td>
            </tr>
            <tr>
                <th>Bill ID</th>
                <td>${billData.billId}</td>
            </tr>
        </table>

        <div class="warning">
            <strong>Important:</strong> Please ensure payment is made by the due date to avoid service interruption.
        </div>

        <div style="text-align: center;">
            <a href="${billData.invoiceUrl}" class="cta-button">View & Pay Bill</a>
        </div>

        <p>If you have any questions about this bill or need assistance with payment, please don't hesitate to contact our broker support team.</p>

        <div class="footer">
            <p>Thank you for partnering with ViralFX</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
VIRALFX - MONTHLY BROKER BILL

Dear ${billData.companyName},

Your monthly broker bill for the period ${billData.period} is now available.

BILL SUMMARY:
=============
Amount Due: ${billData.currency || 'ZAR'} ${billData.amount.toLocaleString()}
Due Date: ${billData.dueDate}
Bill ID: ${billData.billId}

Please ensure payment is made by the due date to avoid service interruption.

View your full bill and make payment here: ${billData.invoiceUrl}

If you have any questions about this bill or need assistance with payment, please don't hesitate to contact our broker support team.

Thank you for partnering with ViralFX
© ${new Date().getFullYear()} ViralFX. All rights reserved.
`;

  return { html, text };
}
