export interface PaymentReminderData {
  customerName: string;
  invoiceId: string;
  amount: number;
  currency: string;
  daysOverdue: number;
  dueDate: string;
  pdfUrl: string;
  paymentUrl: string;
}

export function paymentReminderTemplate(data: PaymentReminderData): { html: string; text: string } {
  // Determine urgency level and colors
  const urgencyLevel = data.daysOverdue <= 3 ? 'friendly' : data.daysOverdue <= 7 ? 'important' : 'urgent';
  const urgencyText = data.daysOverdue <= 3 ? 'Friendly Reminder' : data.daysOverdue <= 7 ? 'Payment Overdue' : 'URGENT: Payment Required';

  // Color scheme based on urgency
  const bgColor = data.daysOverdue <= 3 ? '#FFF8DC' : data.daysOverdue <= 7 ? '#FFE5CC' : '#FFCCCC';
  const borderColor = data.daysOverdue <= 3 ? '#FFC107' : data.daysOverdue <= 7 ? '#FF9800' : '#F44336';
  const headerBg = data.daysOverdue <= 3 ? '#4B0082' : data.daysOverdue <= 7 ? '#FF6B35' : '#D32F2F';
  const urgencyEmoji = data.daysOverdue <= 3 ? '⏰' : data.daysOverdue <= 7 ? '⚠️' : '🚨';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder - ${data.invoiceId}</title>
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
      background: linear-gradient(135deg, ${headerBg} 0%, ${data.daysOverdue <= 3 ? '#6A0DAD' : data.daysOverdue <= 7 ? '#FF8A65' : '#F44336'} 100%);
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

    .header .urgency {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
      font-weight: 600;
    }

    .content {
      background-color: white;
      padding: 40px;
      border-radius: 0 0 10px 10px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
    }

    .urgency-box {
      background: linear-gradient(135deg, ${bgColor} 0%, ${borderColor} 100%);
      border-left: 4px solid ${borderColor};
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }

    .urgency-box h2 {
      margin: 0 0 10px 0;
      color: ${data.daysOverdue <= 7 ? '#856404' : '#721C24'};
      font-size: 18px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .urgency-box p {
      margin: 0;
      color: ${data.daysOverdue <= 7 ? '#856404' : '#721C24'};
      font-size: 15px;
    }

    .invoice-details {
      background: #f8f9fa;
      padding: 25px;
      margin: 25px 0;
      border-radius: 8px;
      border: 1px solid #dee2e6;
    }

    .invoice-details h3 {
      margin: 0 0 15px 0;
      color: #4B0082;
      font-size: 18px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }

    .detail-item {
      display: flex;
      flex-direction: column;
    }

    .detail-label {
      font-size: 12px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }

    .detail-value {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }

    .amount {
      color: #4B0082;
      font-weight: 700;
      font-size: 18px;
    }

    .consequences {
      background: linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 100%);
      border-left: 4px solid #6C757D;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }

    .consequences h3 {
      margin: 0 0 15px 0;
      color: #495057;
      font-size: 16px;
    }

    .consequences ul {
      margin: 0;
      padding-left: 20px;
    }

    .consequences li {
      margin-bottom: 8px;
      color: #495057;
      font-size: 14px;
    }

    .cta-buttons {
      display: flex;
      gap: 15px;
      margin: 30px 0;
      flex-wrap: wrap;
    }

    .cta-button {
      display: inline-block;
      text-decoration: none;
      padding: 15px 25px;
      border-radius: 25px;
      font-weight: 600;
      text-align: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      flex: 1;
      min-width: 200px;
    }

    .cta-button.primary {
      background: linear-gradient(135deg, #4B0082 0%, #6A0DAD 100%);
      color: white;
    }

    .cta-button.primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(75, 0, 130, 0.3);
    }

    .cta-button.secondary {
      background: white;
      color: #4B0082;
      border: 2px solid #4B0082;
    }

    .cta-button.secondary:hover {
      background: #4B0082;
      color: white;
    }

    .support-section {
      background: linear-gradient(135deg, #E8F5E8 0%, #C8E6C9 100%);
      border-left: 4px solid #4CAF50;
      padding: 20px;
      margin: 25px 0;
      border-radius: 8px;
    }

    .support-section h3 {
      margin: 0 0 10px 0;
      color: #2E7D32;
      font-size: 16px;
    }

    .support-section p {
      margin: 0;
      color: #2E7D32;
      font-size: 14px;
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

      .detail-grid {
        grid-template-columns: 1fr;
      }

      .cta-buttons {
        flex-direction: column;
      }

      .cta-button {
        min-width: auto;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧪 ViralFX</h1>
    <div class="urgency">${urgencyEmoji} ${urgencyText}</div>
  </div>

  <div class="content">
    <p>Dear <strong>${data.customerName}</strong>,</p>
    <p>This is a <strong>${urgencyLevel}</strong> reminder that invoice <strong>${data.invoiceId}</strong> is now <strong>${data.daysOverdue} days overdue</strong>.</p>

    <div class="urgency-box">
      <h2>${urgencyEmoji} ${urgencyText}</h2>
      <p>Your payment of <strong>${data.currency} ${data.amount.toFixed(2)}</strong> was due on <strong>${data.dueDate}</strong>. Immediate action is required to avoid service disruption.</p>
    </div>

    <div class="invoice-details">
      <h3>📋 Invoice Information</h3>
      <div class="detail-grid">
        <div class="detail-item">
          <span class="detail-label">Invoice ID</span>
          <span class="detail-value">${data.invoiceId}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Amount Due</span>
          <span class="detail-value amount">${data.currency} ${data.amount.toFixed(2)}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Original Due Date</span>
          <span class="detail-value">${data.dueDate}</span>
        </div>
        <div class="detail-item">
          <span class="detail-label">Days Overdue</span>
          <span class="detail-value">${data.daysOverdue} days</span>
        </div>
      </div>
    </div>

    ${data.daysOverdue > 7 ? `
    <div class="consequences">
      <h3>⚠️ Service Impact Notice</h3>
      <p>Continued non-payment may result in:</p>
      <ul>
        <li>API access suspension within 24-48 hours</li>
        <li>Loss of service for all connected applications</li>
        <li>Additional late payment fees (5% of outstanding amount)</li>
        <li>Account restrictions until payment is received</li>
      </ul>
    </div>
    ` : ''}

    <div class="cta-buttons">
      <a href="${data.paymentUrl}" class="cta-button primary">
        💳 Pay Now
      </a>
      <a href="${data.pdfUrl}" class="cta-button secondary">
        📄 View Invoice
      </a>
    </div>

    <div class="support-section">
      <h3>💬 Need Help?</h3>
      <p>Having trouble with payment? Contact our billing team for assistance:</p>
      <p><strong>Email:</strong> <a href="mailto:billing@viralfx.com">billing@viralfx.com</a></p>
      <p><strong>Phone:</strong> +27 12 345 6789 (Mon-Fri, 9AM-5PM)</p>
    </div>

    <p>Please disregard this message if payment has already been made. It may take 24-48 hours for payments to reflect in our system.</p>

    <div class="footer">
      <p>Thank you for your prompt attention to this matter.</p>
      <p>ViralFX API Services Team</p>
      <p>This is an automated message. Please do not reply to this email.</p>
      <p>© 2024 ViralFX. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
VIRALFX PAYMENT REMINDER
=======================

${urgencyEmoji} ${urgencyText}

Dear ${data.customerName},

This is a ${urgencyLevel} reminder that invoice ${data.invoiceId} is now ${data.daysOverdue} days overdue.

Invoice Details:
----------------
Invoice ID: ${data.invoiceId}
Amount Due: ${data.currency} ${data.amount.toFixed(2)}
Original Due Date: ${data.dueDate}
Days Overdue: ${data.daysOverdue}

${data.daysOverdue > 7 ? `
IMPORTANT: Service Impact Notice
--------------------------------
Your API access is at risk of suspension. Continued non-payment may result in:
- API access suspension within 24-48 hours
- Loss of service for all connected applications
- Additional late payment fees (5% of outstanding amount)
- Account restrictions until payment is received
` : ''}

Payment Options:
----------------
Pay Online: ${data.paymentUrl}
View Invoice: ${data.pdfUrl}

Need Help?
----------
Having trouble with payment? Contact our billing team:
Email: billing@viralfx.com
Phone: +27 12 345 6789 (Mon-Fri, 9AM-5PM)

Please disregard this message if payment has already been made.
It may take 24-48 hours for payments to reflect in our system.

Thank you for your prompt attention to this matter.

ViralFX API Services Team
This is an automated message. Please do not reply to this email.
© 2024 ViralFX. All rights reserved.
  `;

  return { html, text };
}