interface VerificationEmailProps {
  name: string;
  verificationUrl: string;
  baseUrl: string;
}

export function generateVerificationEmail({ name, verificationUrl, baseUrl }: VerificationEmailProps) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email - Magical Birthday Planner</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .emoji {
            font-size: 48px;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .content h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .content p {
            color: #666;
            margin-bottom: 25px;
            font-size: 16px;
        }
        .verify-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .verify-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
        }
        .footer p {
            margin: 5px 0;
        }
        .security-note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #856404;
        }
        @media (max-width: 600px) {
            .container {
                margin: 20px;
                border-radius: 10px;
            }
            .header, .content, .footer {
                padding: 25px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .content h2 {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">🎉</div>
            <h1>Magical Birthday Planner</h1>
        </div>
        
        <div class="content">
            <h2>Welcome, ${name}!</h2>
            <p>Thank you for joining Magical Birthday Planner! We're excited to help you create unforgettable birthday celebrations for your little ones.</p>
            
            <p>To get started with planning magical parties, please verify your email address by clicking the button below:</p>
            
            <a href="${verificationUrl}" class="verify-button">Verify My Email</a>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong> This verification link will expire in 24 hours for your security. If you didn't create an account with us, please ignore this email.
            </div>
            
            <p>Once verified, you'll be able to:</p>
            <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                <li>Create personalized party plans with AI recommendations</li>
                <li>Manage guest lists and send beautiful invitations</li>
                <li>Track RSVPs and party planning progress</li>
                <li>Access our comprehensive party shopping suite</li>
            </ul>
        </div>
        
        <div class="footer">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Creating magical memories, one party at a time</p>
            <p>If you have any questions, reply to this email or visit <a href="${baseUrl}/help">our help center</a></p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <a href="${verificationUrl}">${verificationUrl}</a>
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
Welcome to Magical Birthday Planner!

Hi ${name},

Thank you for joining Magical Birthday Planner! To complete your registration and start planning magical birthday parties, please verify your email address.

Verification Link: ${verificationUrl}

This link will expire in 24 hours for your security.

Once verified, you'll be able to:
- Create personalized party plans with AI recommendations
- Manage guest lists and send beautiful invitations
- Track RSVPs and party planning progress
- Access our comprehensive party shopping suite

If you have any questions, reply to this email or visit ${baseUrl}/help

Best regards,
The Magical Birthday Planner Team

---
If the link doesn't work, copy and paste this URL in your browser: ${verificationUrl}
`;

  return { html, text };
}