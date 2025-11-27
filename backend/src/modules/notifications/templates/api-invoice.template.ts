export interface ApiInvoiceData {
  invoiceId: string;
  customerName: string;
  amount: number;
  currency: string;
  dueDate: string;
  billingPeriod: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }>;
  pdfUrl: string;
  subtotal?: number;
  vatAmount?: number;
  vatRate?: number;
  issueDate?: string;
}

export function apiInvoiceTemplate(data: ApiInvoiceData): { html: string; text: string } {
  // Calculate totals if not provided
  const subtotal = data.subtotal || data.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const vatAmount = data.vatAmount || subtotal * (data.vatRate || 0.15);
  const vatRate = data.vatRate || 0.15;
  const total = subtotal + vatAmount;
  const issueDate = data.issueDate || new Date().toLocaleDateString();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Marketplace Invoice - ${data.invoiceId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }

    .header {
      background: linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%);
      color: white;
      padding: 30px;
      border-radius: 10px 10px 0 0;
      text-align: center;
    }

    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }

    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
    }

    .content {
      background-color: white;
      padding: 40px;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }

    .invoice-summary {
      background: linear-gradient(135deg, #FFF8DC 0%, #FFD700 100%);
      border-left: 4px solid #FFB300;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }

    .invoice-summary h2 {
      margin: 0 0 15px 0;
      color: #4B0082;
      font-size: 20px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
    }

    .summary-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .summary-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .amount {
      color: #4B0082;
      font-weight: 700;
      font-size: 18px;
    }

    .line-items {
      margin: 30px 0;
    }

    .line-items h3 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 18px;
    }

    .line-item {
      display: grid;
      grid-template-columns: 1fr 80px 100px 100px;
      gap: 15px;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }

    .line-item:last-child {
      border-bottom: none;
    }

    .line-item-header {
      font-weight: 600;
      color: #4B0082;
      border-bottom: 2px solid #4B0082;
      padding-bottom: 10px;
      margin-bottom: 5px;
    }

    .description {
      font-size: 14px;
      line-height: 1.4;
    }

    .quantity, .unit-price, .item-amount {
      text-align: right;
      font-size: 14px;
    }

    .totals {
      margin: 30px 0;
      padding: 20px;
      background-color: #f8f9fa;
      border-radius: 8px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 15px;
    }

    .total-row.final {
      font-weight: 700;
      font-size: 18px;
      color: #4B0082;
      padding-top: 10px;
      border-top: 2px solid #4B0082;
    }

    .warning-box {
      background: linear-gradient(135deg, #FFF3CD 0%, #FFE5CC 100%);
      border-left: 4px solid #FFC107;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }

    .warning-box h3 {
      margin: 0 0 10px 0;
      color: #856404;
      font-size: 16px;
    }

    .warning-box p {
      margin: 0;
      color: #856404;
      font-size: 14px;
    }

    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%);
      color: white;
      text-decoration: none;
      padding: 15px 30px;
      border-radius: 25px;
      font-weight: 600;
      text-align: center;
      margin: 25px 0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(75, 0, 130, 0.3);
    }

    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #666;
      font-size: 14px;
    }

    .footer a {
      color: #4B0082;
      text-decoration: none;
    }

    @media (max-width: 600px) {
      .content {
        padding: 20px;
      }

      .summary-grid {
        grid-template-columns: 1fr;
      }

      .line-item {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .quantity, .unit-price, .item-amount {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 ViralFX</h1>
    <p>API Marketplace Invoice</p>
  </div>

  <div class="content">
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>Your API usage invoice is now available for the billing period <strong>${data.billingPeriod}</strong>. Please review the details below and ensure payment is made by the due date.</p>

    <div class="invoice-summary">
      <h2>📋 Invoice Summary</h2>
      <div class="summary-grid">
        <div class="summary-item">
          <span class="summary-label">Invoice ID</span>
          <span class="summary-value">${data.invoiceId}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Amount Due</span>
          <span class="summary-value amount">${data.currency} ${data.amount.toFixed(2)}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Due Date</span>
          <span class="summary-value">${data.dueDate}</span>
        </div>
        <div class="summary-item">
          <span class="summary-label">Issue Date</span>
          <span class="summary-value">${issueDate}</span>
        </div>
      </div>
    </div>

    <div class="line-items">
      <h3>💰 Invoice Details</h3>

      <div class="line-item line-item-header">
        <div class="description">Description</div>
        <div class="quantity">Qty</div>
        <div class="unit-price">Unit Price</div>
        <div class="item-amount">Amount</div>
      </div>

      ${data.lineItems.map(item => `
        <div class="line-item">
          <div class="description">${item.description}</div>
          <div class="quantity">${item.quantity}</div>
          <div class="unit-price">${data.currency} ${item.unitPrice.toFixed(2)}</div>
          <div class="item-amount">${data.currency} ${item.amount.toFixed(2)}</div>
        </div>
      `).join('')}
    </div>

    <div class="totals">
      <div class="total-row">
        <span>Subtotal:</span>
        <span>${data.currency} ${subtotal.toFixed(2)}</span>
      </div>
      <div class="total-row">
        <span>VAT (${(vatRate * 100)}%):</span>
        <span>${data.currency} ${vatAmount.toFixed(2)}</span>
      </div>
      <div class="total-row final">
        <span>Total Amount:</span>
        <span>${data.currency} ${total.toFixed(2)}</span>
      </div>
    </div>

    <div class="warning-box">
      <h3>⚠️ Payment Due</h3>
      <p>Payment is due by <strong>${data.dueDate}</strong>. Late payments may result in API access suspension and additional fees.</p>
    </div>

    <div style="text-align: center;">
      <a href="${data.pdfUrl}" class="cta-button">
        📄 View & Download Invoice
      </a>
    </div>

    <p>If you have any questions about this invoice or need assistance with payment, please contact our billing team at <a href="mailto:billing@viralfx.com">billing@viralfx.com</a>.</p>

    <div class="footer">
      <p>Thank you for using ViralFX API Services!</p>
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>© 2024 ViralFX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
VIRALFX API INVOICE
==================

Invoice ID: ${data.invoiceId}
Issue Date: ${issueDate}
Due Date: ${data.dueDate}
Billing Period: ${data.billingPeriod}

Bill To:
${data.customerName}

Invoice Details:
${data.lineItems.map(item =>
  `${item.description}
  Quantity: ${item.quantity}
  Unit Price: ${data.currency} ${item.unitPrice.toFixed(2)}
  Amount: ${data.currency} ${item.amount.toFixed(2)}
`).join('\n')}

Summary:
--------
Subtotal: ${data.currency} ${subtotal.toFixed(2)}
VAT (${(vatRate * 100)}%): ${data.currency} ${vatAmount.toFixed(2)}
TOTAL AMOUNT: ${data.currency} ${total.toFixed(2)}

PAYMENT DUE: ${data.dueDate}

Payment is required by the due date to avoid service interruption.
Late payments may result in API access suspension.

Download your invoice PDF: ${data.pdfUrl}

For questions about this invoice, contact our billing team:
Email: billing@viralfx.com

Thank you for using ViralFX API Services!

This is an automated message. Please do not reply to this email.
© 2024 ViralFX. All rights reserved.
  `;

  return { html, text };
}