interface PasswordResetEmailProps {
  name: string;
  resetUrl: string;
  baseUrl: string;
  expiresInHours?: number;
}

export function generatePasswordResetEmail({ 
  name, 
  resetUrl, 
  baseUrl, 
  expiresInHours = 1 
}: PasswordResetEmailProps) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password - Magical Birthday Planner</title>
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
            background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%);
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
        .reset-button {
            display: inline-block;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            text-decoration: none;
            padding: 15px 40px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .reset-button:hover {
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
        .warning-note {
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-size: 14px;
            color: #721c24;
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
            <div class="emoji">🔐</div>
            <h1>Magical Birthday Planner</h1>
        </div>
        
        <div class="content">
            <h2>Password Reset Request</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password for your Magical Birthday Planner account. If you made this request, click the button below to choose a new password:</p>
            
            <a href="${resetUrl}" class="reset-button">Reset My Password</a>
            
            <div class="security-note">
                <strong>🔒 Security Note:</strong> This password reset link will expire in ${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''} for your security.
            </div>
            
            <div class="warning-note">
                <strong>⚠️ Important:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged, and no further action is needed.
            </div>
            
            <p>For your security, we recommend choosing a strong password that includes:</p>
            <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                <li>At least 8 characters</li>
                <li>A mix of uppercase and lowercase letters</li>
                <li>At least one number</li>
                <li>At least one special character</li>
            </ul>
        </div>
        
        <div class="footer">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Creating magical memories, one party at a time</p>
            <p>If you have any questions, reply to this email or visit <a href="${baseUrl}/help">our help center</a></p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <a href="${resetUrl}">${resetUrl}</a>
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
Password Reset Request - Magical Birthday Planner

Hi ${name},

We received a request to reset your password for your Magical Birthday Planner account. If you made this request, use the link below to choose a new password:

Reset Link: ${resetUrl}

This link will expire in ${expiresInHours} hour${expiresInHours !== 1 ? 's' : ''} for your security.

IMPORTANT: If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

For your security, we recommend choosing a strong password that includes:
- At least 8 characters
- A mix of uppercase and lowercase letters
- At least one number
- At least one special character

If you have any questions, reply to this email or visit ${baseUrl}/help

Best regards,
The Magical Birthday Planner Team

---
If the link doesn't work, copy and paste this URL in your browser: ${resetUrl}
`;

  return { html, text };
}