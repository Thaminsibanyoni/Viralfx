export interface TicketSlaEscalationData {
  supervisorName: string;
  ticketNumber: string;
  ticketId: string;
  ticketTitle: string;
  ticketCategory: string;
  ticketPriority: string;
  slaDueDate: Date;
  overdueHours: number;
  assignedAgent: string;
  customerName: string;
  escalationLevel: string; // LOW/MEDIUM/HIGH/CRITICAL
}

export function ticketSlaEscalationTemplate(data: TicketSlaEscalationData): { html: string; text: string } {
  const getEscalationColor = (level: string) => {
    switch (level.toUpperCase()) {
      case 'CRITICAL': return '#dc3545';
      case 'HIGH': return '#fd7e14';
      case 'MEDIUM': return '#ffc107';
      case 'LOW': return '#28a745';
      default: return '#6c757d';
    }
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SLA Breach Escalation - ViralFX</title>
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
            border-bottom: 3px solid ${getEscalationColor(data.escalationLevel)};
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            color: #4B0082;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .escalation-badge {
            background-color: ${getEscalationColor(data.escalationLevel)};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 16px;
            font-weight: bold;
            display: inline-block;
            margin: 10px 0;
        }
        .alert-box {
            background: linear-gradient(135deg, ${getEscalationColor(data.escalationLevel)}, ${data.escalationLevel.toUpperCase() === 'CRITICAL' ? '#c82333' : getEscalationColor(data.escalationLevel)});
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
        .overdue-hours {
            background-color: #dc3545;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
        }
        .action-buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
            margin: 30px 0;
            flex-wrap: wrap;
        }
        .btn-review {
            background-color: #4B0082;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .btn-reassign {
            background-color: #ffc107;
            color: #212529;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .btn-contact {
            background-color: #17a2b8;
            color: white;
            padding: 12px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
        }
        .escalation-recommendations {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
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
            <h1>🔥 SLA Breach Escalation</h1>
            <div class="escalation-badge">${data.escalationLevel.toUpperCase()} ESCALATION</div>
        </div>

        <div class="alert-box">
            <div class="alert-icon">🚨</div>
            <h2>Critical SLA Breach Requires Supervision</h2>
            <p>Ticket ${data.ticketNumber} requires immediate management intervention</p>
        </div>

        <p>Hi ${data.supervisorName},</p>
        <p>This is an automated escalation notification for a ticket that has significantly breached its Service Level Agreement and requires your immediate attention and intervention.</p>

        <div class="alert-details">
            <h3>Escalation Details:</h3>
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
                <span class="detail-label">Assigned Agent:</span>
                <span class="detail-value">${data.assignedAgent}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">SLA Due Date:</span>
                <span class="detail-value">${new Date(data.slaDueDate).toLocaleString()}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Overdue By:</span>
                <span class="detail-value"><span class="overdue-hours">${data.overdueHours} hours</span></span>
            </div>
        </div>

        <div class="action-buttons">
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}" class="btn-review">Review Ticket</a>
            <a href="${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}/reassign" class="btn-reassign">Reassign</a>
            <a href="mailto:${data.assignedAgent}" class="btn-contact">Contact Agent</a>
        </div>

        <div class="escalation-recommendations">
            <h3>📋 Escalation Recommendations:</h3>
            ${data.escalationLevel.toUpperCase() === 'CRITICAL' ? `
            <ul>
                <li><strong>Immediate Action:</strong> Consider reassigning to a senior agent or team lead</li>
                <li><strong>Customer Communication:</strong> Contact the customer directly to apologize and provide resolution timeline</li>
                <li><strong>Root Cause Analysis:</strong> Investigate why the breach occurred and prevent recurrence</li>
                <li><strong>Compensation:</strong> Consider service credits or other compensation for customer</li>
                <li><strong>Team Review:</strong> Review agent workload and support processes</li>
            </ul>
            ` : data.escalationLevel.toUpperCase() === 'HIGH' ? `
            <ul>
                <li><strong>Priority Review:</strong> Assess if reassignment to a more experienced agent is needed</li>
                <li><strong>Agent Support:</strong> Contact the assigned agent to offer assistance and resources</li>
                <li><strong>Customer Update:</strong> Ensure customer has been contacted with updated timeline</li>
                <li><strong>Process Review:</strong> Identify bottlenecks that caused the delay</li>
            </ul>
            ` : data.escalationLevel.toUpperCase() === 'MEDIUM' ? `
            <ul>
                <li><strong>Agent Check-in:</strong> Monitor progress and offer support if needed</li>
                <li><strong>Timeline Verification:</strong> Confirm new resolution timeline with agent</li>
                <li><strong>Customer Satisfaction:</strong> Consider reaching out to ensure customer needs are being met</li>
            </ul>
            ` : `
            <ul>
                <li><strong>Monitor Progress:</strong> Keep an eye on ticket resolution progress</li>
                <li><strong>Agent Support:</strong> Be available to assist if challenges arise</li>
            </ul>
            `}
        </div>

        ${data.overdueHours > 48 ? `
        <div style="background-color: #721c24; border: 1px solid #f5c6cb; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3>⚠️ EXTREME DELAY WARNING:</h3>
            <p>This ticket is more than 48 hours overdue. This represents a critical service failure that may require:</p>
            <ul>
                <li>Immediate customer outreach by management</li>
                <li>Service recovery compensation</li>
                <li>Formal review of support processes</li>
                <li>Escalation to department head</li>
            </ul>
        </div>
        ` : ''}

        <div class="footer">
            <p>ViralFX Support Escalation System</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated escalation notification. Please do not reply to this email.</p>
            <p>For system assistance, contact escalations@viralfx.com</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🔥 SLA BREACH ESCALATION - VIRALFX

${data.escalationLevel.toUpperCase()} ESCALATION REQUIRES MANAGEMENT INTERVENTION

Hi ${data.supervisorName},

This is an automated escalation notification for a ticket that has significantly breached its Service Level Agreement and requires your immediate attention.

ESCALATION DETAILS:
==================
Ticket Number: ${data.ticketNumber}
Title: ${data.ticketTitle}
Customer: ${data.customerName}
Category: ${data.ticketCategory}
Priority: ${data.ticketPriority}
Assigned Agent: ${data.assignedAgent}
SLA Due Date: ${new Date(data.slaDueDate).toLocaleString()}
Overdue By: ${data.overdueHours} hours

ESCALATION LEVEL: ${data.escalationLevel.toUpperCase()}

IMMEDIATE ACTIONS:
=================
1. Review ticket details: ${process.env.FRONTEND_URL || 'https://app.viralfx.com'}/support/tickets/${data.ticketId}
2. Consider reassignment to more experienced agent
3. Contact assigned agent for status update: ${data.assignedAgent}
4. Ensure customer has been notified of delay

ESCALATION RECOMMENDATIONS:
===========================
${data.escalationLevel.toUpperCase() === 'CRITICAL' ? `
• Immediate reassignment to senior agent or team lead
• Direct customer contact with apology and resolution timeline
• Root cause analysis to prevent recurrence
• Consider service compensation for customer
• Review agent workload and support processes
` : data.escalationLevel.toUpperCase() === 'HIGH' ? `
• Assess need for reassignment to more experienced agent
• Contact assigned agent to offer assistance and resources
• Ensure customer has been contacted with updated timeline
• Identify bottlenecks that caused the delay
` : data.escalationLevel.toUpperCase() === 'MEDIUM' ? `
• Monitor progress and offer support if needed
• Confirm new resolution timeline with agent
• Consider customer outreach to ensure satisfaction
` : `
• Monitor ticket resolution progress
• Be available to assist agent if challenges arise
`}

${data.overdueHours > 48 ? `
⚠️ EXTREME DELAY WARNING:
========================
This ticket is more than 48 hours overdue. This represents a critical service failure requiring:
• Immediate customer outreach by management
• Service recovery compensation consideration
• Formal review of support processes
• Escalation to department head
` : ''}

ViralFX Support Escalation System
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated escalation notification. Please do not reply to this email.
For system assistance, contact escalations@viralfx.com
`;

  return { html, text };
}