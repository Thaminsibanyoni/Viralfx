export interface TicketSlaBreachData {
  agentName: string;
  ticketNumber: string;
  ticketId: string;
  ticketTitle: string;
  ticketCategory: string;
  ticketPriority: string;
  slaDueDate: Date;
  overdueHours: number;
  customerName: string;
}

export function ticketSlaBreachTemplate(data: TicketSlaBreachData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SLA Breach Alert - ViralFX</title>
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
            border-bottom: 3px solid #ff6b6b;
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
            background: linear-gradient(135deg, #ff6b6b, #ee5a52);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .alert-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .alert-details {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px solid #ffeaa7;
        }
        .detail-label {
            font-weight: bold;
            color: #856404;
        }
        .detail-value {
            color: #856404;
        }
        .urgency-${data.overdueHours > 24 ? 'critical' : data.overdueHours > 12 ? 'high' : 'medium'} {
            background-color: ${data.overdueHours > 24 ? '#dc3545' : data.overdueHours > 12 ? '#fd7e14' : '#ffc107'};
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 30px 0;
        }
        .btn-primary {
            background-color: #4B0082;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .btn-urgent {
            background-color: #dc3545;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
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
            <h1>🚨 SLA Breach Alert</h1>
        </div>

        <div class="alert-box">
            <div class="alert-icon">⏰</div>
            <h2>Service Level Agreement Breached</h2>
            <p>Ticket ${data.ticketNumber} has exceeded its SLA deadline</p>
            <span class="urgency-${data.overdueHours > 24 ? 'critical' : data.overdueHours > 12 ? 'high' : 'medium'}">
                ${data.overdueHours > 24 ? 'CRITICAL' : data.overdueHours > 12 ? 'HIGH PRIORITY' : 'URGENT'}
            </span>
        </div>

        <p>Hi ${data.agentName},</p>
        <p>This is an automated notification that a ticket assigned to you has breached its Service Level Agreement (SLA). Immediate attention is required.</p>

        <div class="alert-details">
            <h3>Ticket Details:</h3>
            <div class="detail-row">
                <span class="detail-label">Ticket Number:</span>
                <span class="detail-value">${data.ticketNumber}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Title:</span>
                <span class="detail-value">${data.ticketTitle}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Customer:</span>
                <span class="detail-value">${data.customerName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Category:</span>
                <span class="detail-value">${data.ticketCategory}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Priority:</span>
                <span class="detail-value">${data.ticketPriority}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">SLA Due Date:</span>
                <span class="detail-value">${new Date(data.slaDueDate).toLocaleString()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Overdue By:</span>
                <span class="detail-value">${data.overdueHours} hours</span>
            </div>
        </div>

        <div class="action-buttons">
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}" class="btn-urgent">View Ticket</a>
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}/resolve" class="btn-primary">Resolve Now</a>
        </div>

        <h3>🎯 Immediate Actions Required:</h3>
        <ul>
            <li>Review the ticket immediately and assess the situation</li>
            <li>Contact the customer to acknowledge the delay and provide updated timeline</li>
            <li>Resolve the ticket or escalate to appropriate team if needed</li>
            <li>Document reasons for the breach in ticket notes</li>
        </ul>

        ${data.overdueHours > 24 ? `
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>🚨 CRITICAL ALERT:</h3>
            <p>This ticket is more than 24 hours overdue. Immediate escalation may be required. Please contact your supervisor if you need assistance.</p>
        </div>
        ` : ''}

        <div class="footer">
            <p>ViralFX Support System</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated SLA breach notification. Please do not reply to this email.</p>
            <p>For technical assistance, contact support@viralfx.com</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🚨 SLA BREACH ALERT - VIRALFX

TICKET HAS EXCEEDED SERVICE LEVEL AGREEMENT

Hi ${data.agentName},

This is an automated notification that a ticket assigned to you has breached its Service Level Agreement (SLA).

TICKET DETAILS:
===============
Ticket Number: ${data.ticketNumber}
Title: ${data.ticketTitle}
Customer: ${data.customerName}
Category: ${data.ticketCategory}
Priority: ${data.ticketPriority}
SLA Due Date: ${new Date(data.slaDueDate).toLocaleString()}
Overdue By: ${data.overdueHours} hours

URGENCY LEVEL: ${data.overdueHours > 24 ? 'CRITICAL' : data.overdueHours > 12 ? 'HIGH PRIORITY' : 'URGENT'}

IMMEDIATE ACTIONS REQUIRED:
===========================
1. Review the ticket immediately: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}
2. Contact the customer to acknowledge the delay and provide updated timeline
3. Resolve the ticket or escalate to appropriate team if needed
4. Document reasons for the breach in ticket notes

${data.overdueHours > 24 ? `
🚨 CRITICAL ALERT:
=================
This ticket is more than 24 hours overdue. Immediate escalation may be required. Please contact your supervisor if you need assistance.
` : ''}

ViralFX Support System
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated SLA breach notification. Please do not reply to this email.
For technical assistance, contact support@viralfx.com
`;

  return { html, text };
}
