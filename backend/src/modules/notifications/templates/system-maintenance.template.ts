export interface SystemMaintenanceData {
  startTime: Date;
  endTime: Date;
  description: string;
  affectedServices: string[];
  userName?: string;
  email?: string;
}

export function systemMaintenanceTemplate(data: SystemMaintenanceData): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Scheduled Maintenance - ViralFX</title>
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
            border-bottom: 3px solid #17a2b8;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .logo {
            color: #4B0082;
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
        }
        .maintenance-box {
            background: linear-gradient(135deg, #17a2b8, #138496);
            color: white;
            padding: 25px;
            border-radius: 8px;
            text-align: center;
            margin: 20px 0;
        }
        .maintenance-icon {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .timeline {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 2px solid #17a2b8;
        }
        .time-block {
            text-align: center;
            flex: 1;
        }
        .time-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .time-value {
            font-size: 18px;
            font-weight: bold;
            color: #17a2b8;
        }
        .duration {
            background-color: #17a2b8;
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-weight: bold;
            margin: 0 20px;
        }
        .affected-services {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
        }
        .service-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 15px;
        }
        .service-tag {
            background-color: #ffc107;
            color: #212529;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
        }
        .what-to-expect {
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
            <h1>🔧 Scheduled Maintenance</h1>
        </div>

        <div class="maintenance-box">
            <div class="maintenance-icon">⏰</div>
            <h2>System Maintenance Scheduled</h2>
            <p>We're upgrading our systems to serve you better</p>
        </div>

        <p>Hi ${data.userName || 'Trader'},</p>
        <p>We'll be performing scheduled maintenance to improve our platform performance and add new features.</p>

        <div class="timeline">
            <div class="time-block">
                <div class="time-label">Start Time</div>
                <div class="time-value">${new Date(data.startTime).toLocaleString()}</div>
            </div>
            <div class="duration">
                ${Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / (1000 * 60 * 60))}h
            </div>
            <div class="time-block">
                <div class="time-label">End Time</div>
                <div class="time-value">${new Date(data.endTime).toLocaleString()}</div>
            </div>
        </div>

        <div class="affected-services">
            <h3>📋 Affected Services:</h3>
            <p>The following services will be temporarily unavailable:</p>
            <div class="service-list">
                ${data.affectedServices.map(service => `<span class="service-tag">${service}</span>`).join('')}
            </div>
        </div>

        <h3>📝 Maintenance Details:</h3>
        <p>${data.description}</p>

        <div class="what-to-expect">
            <h3>🔍 What to Expect:</h3>
            <ul>
                <li>Temporary service interruption during maintenance window</li>
                <li>Login and trading functions may be unavailable</li>
                <li>Real-time data feeds may be temporarily suspended</li>
                <li>Mobile app may show limited functionality</li>
            </ul>
        </div>

        <h3>✨ What's New After Maintenance:</h3>
        <ul>
            <li>🚀 Improved platform performance and speed</li>
            <li>🛡️ Enhanced security features</li>
            <li>📊 New analytics and reporting tools</li>
            <li>🔧 Bug fixes and stability improvements</li>
        </ul>

        <h3>💡 Tips for Traders:</h3>
        <ul>
            <li>Complete any urgent trades before the maintenance window</li>
            <li>Set up price alerts for your monitored assets</li>
            <li>Download any important reports or statements</li>
            <li>Check our status page for real-time updates</li>
        </ul>

        <h3>📞 Stay Connected:</h3>
        <ul>
            <li>🌐 Status Page: <a href="https://status.viralfx.com">status.viralfx.com</a></li>
            <li>🐦 Twitter: <a href="https://twitter.com/viralfx">@viralfx</a></li>
            <li>📧 Support: <a href="mailto:support@viralfx.com">support@viralfx.com</a></li>
        </ul>

        <div class="footer">
            <p>Thank you for your patience and understanding</p>
            <p>© ${new Date().getFullYear()} ViralFX. All rights reserved.</p>
            <p>This is an automated maintenance notification. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🔧 SCHEDULED MAINTENANCE - VIRALFX

System maintenance scheduled for platform improvements

Hi ${data.userName || 'Trader'},

We'll be performing scheduled maintenance to improve our platform performance and add new features.

MAINTENANCE SCHEDULE:
====================
Start Time: ${new Date(data.startTime).toLocaleString()}
End Time: ${new Date(data.endTime).toLocaleString()}
Duration: ${Math.round((new Date(data.endTime).getTime() - new Date(data.startTime).getTime()) / (1000 * 60 * 60))} hours

📋 AFFECTED SERVICES:
=====================
${data.affectedServices.map(service => `• ${service}`).join('\n')}

📝 MAINTENANCE DETAILS:
======================
${data.description}

🔍 WHAT TO EXPECT:
==================
• Temporary service interruption during maintenance window
• Login and trading functions may be unavailable
• Real-time data feeds may be temporarily suspended
• Mobile app may show limited functionality

✨ WHAT'S NEW AFTER MAINTENANCE:
================================
🚀 Improved platform performance and speed
🛡️ Enhanced security features
📊 New analytics and reporting tools
🔧 Bug fixes and stability improvements

💡 TIPS FOR TRADERS:
==================
• Complete any urgent trades before the maintenance window
• Set up price alerts for your monitored assets
• Download any important reports or statements
• Check our status page for real-time updates

📞 STAY CONNECTED:
==================
🌐 Status Page: status.viralfx.com
🐦 Twitter: @viralfx
📧 Support: support@viralfx.com

Thank you for your patience and understanding
© ${new Date().getFullYear()} ViralFX. All rights reserved.
This is an automated maintenance notification. Please do not reply to this email.
`;

  return { html, text };
}
