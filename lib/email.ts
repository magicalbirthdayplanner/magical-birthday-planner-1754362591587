import { Resend } from 'resend';

// Initialize Resend client with API key from environment
// Lazily constructed: `new Resend(undefined)` throws, which used to break `next build`
// whenever RESEND_API_KEY was not set. Sends fail gracefully instead.
let resendClient: Resend | null = null
export function getResend(): Resend {
  if (!resendClient) {
    if (!process.env.RESEND_API_KEY) throw new Error('Email is not configured (RESEND_API_KEY missing)')
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  return resendClient
}

// Email configuration - Updated to use custom verified domain
export const EMAIL_CONFIG = {
  // Resend's shared sender (no verified custom domain on this account). Override with EMAIL_FROM.
  fromDomain: process.env.EMAIL_FROM?.trim() || 'Magical Birthday Planner <onboarding@resend.dev>',
  fallbackFrom: 'Magical Birthday Planner <onboarding@resend.dev>',
  replyTo: process.env.EMAIL_REPLY_TO?.trim() || undefined,
};

// Email template types
export interface EmailTemplate {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

// Email sending utility
export async function sendEmail(template: EmailTemplate) {
  try {
    const response = await getResend().emails.send({
      from: template.from || EMAIL_CONFIG.fromDomain,
      to: Array.isArray(template.to) ? template.to : [template.to],
      subject: template.subject,
      html: template.html,
      text: template.text,
      replyTo: template.replyTo || EMAIL_CONFIG.replyTo,
    });

    return {
      success: true,
      id: response.data?.id,
      error: null,
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      id: null,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// Email validation utility
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Generate secure token for email links
export function generateEmailToken(): string {
  return Math.random().toString(36).substr(2, 12) + Date.now().toString(36);
}

// Email tracking status types
export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  FAILED = 'failed',
}

// Email types for tracking
export enum EmailType {
  VERIFICATION = 'verification',
  PASSWORD_RESET = 'password_reset',
  INVITATION = 'invitation',
  RSVP_REMINDER = 'rsvp_reminder',
  RSVP_CONFIRMATION = 'rsvp_confirmation',
  WELCOME = 'welcome',
  EARLY_ACCESS = 'early_access',
  NOTIFICATION = 'notification',
}

// Email log interface for database storage
export interface EmailLog {
  id?: string;
  userId: string;
  partyId?: string;
  guestId?: string;
  type: EmailType;
  status: EmailStatus;
  to: string;
  subject: string;
  resendId?: string;
  error?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Early Access Email Functions
export interface EarlyAccessEmailData {
  email: string;
  firstName?: string;
}

export async function sendEarlyAccessWelcomeEmail({ email, firstName }: EarlyAccessEmailData) {
  try {
    const template: EmailTemplate = {
      to: email,
      subject: '🎉 Welcome to the Early Access Program!',
      html: getEarlyAccessEmailTemplate({ email, firstName }),
    };

    return await sendEmail(template);
  } catch (error) {
    console.error('Failed to send early access welcome email:', error);
    return {
      success: false,
      id: null,
      error: error instanceof Error ? error.message : 'Failed to send early access email',
    };
  }
}

function getEarlyAccessEmailTemplate({ email, firstName }: EarlyAccessEmailData): string {
  const greeting = firstName ? `Hi ${firstName}` : 'Hi there';
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Magical Birthday Planner Early Access</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
            background: white;
            border-radius: 16px;
            padding: 40px 30px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            font-size: 16px;
            margin: 0;
        }
        .content {
            margin: 30px 0;
        }
        .greeting {
            font-size: 20px;
            font-weight: 600;
            color: #333;
            margin-bottom: 20px;
        }
        .message {
            font-size: 16px;
            line-height: 1.7;
            color: #555;
            margin-bottom: 25px;
        }
        .features {
            background: #f8f9ff;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
        }
        .features h3 {
            color: #333;
            font-size: 18px;
            margin: 0 0 15px 0;
            font-weight: 600;
        }
        .feature-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }
        .feature-list li {
            padding: 8px 0;
            font-size: 15px;
            color: #666;
            position: relative;
            padding-left: 25px;
        }
        .feature-list li:before {
            content: "🎈";
            position: absolute;
            left: 0;
            top: 8px;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #eee;
            color: #888;
            font-size: 14px;
        }
        .social-proof {
            background: linear-gradient(135deg, #ffeaa7, #fab1a0);
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            margin: 25px 0;
        }
        .social-proof-text {
            font-size: 16px;
            font-weight: 600;
            color: #333;
            margin: 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎉 Magical Birthday Planner</div>
            <p class="subtitle">AI-Powered Kids Birthday Party Planning</p>
        </div>
        
        <div class="content">
            <h2 class="greeting">${greeting}! 🎈</h2>
            
            <p class="message">
                Thank you so much for joining our <strong>Early Access Program</strong>! We're absolutely thrilled to have you on board as we prepare to launch the most magical birthday party planning experience for parents and kids.
            </p>
            
            <div class="social-proof">
                <p class="social-proof-text">🌟 You're now part of 10,000+ parents getting early access! 🌟</p>
            </div>
            
            <p class="message">
                As an early access member, you'll be among the first to experience our revolutionary AI-powered party planning platform designed specifically for children aged 0-12. Get ready for stress-free, magical celebrations!
            </p>
            
            <div class="features">
                <h3>What's coming your way:</h3>
                <ul class="feature-list">
                    <li>AI-powered personalized party theme recommendations</li>
                    <li>Interactive party planning wizard with timeline</li>
                    <li>Smart guest management and RSVP tracking</li>
                    <li>Comprehensive shopping and vendor recommendations</li>
                    <li>Beautiful invitation templates and party checklists</li>
                    <li>Budget tracking and party organization tools</li>
                </ul>
            </div>
            
            <p class="message">
                We're putting the finishing touches on the platform and will notify you the moment it's ready to make your child's next birthday absolutely magical!
            </p>
            
            <div style="text-align: center;">
                <a href="${(process.env.NEXT_PUBLIC_BASE_URL || '').replace(/\/$/, '')}/home" class="cta-button">
                    🎯 Visit Our Website
                </a>
            </div>
            
            <p class="message">
                In the meantime, feel free to explore our website and get excited about creating unforgettable birthday memories for your little ones!
            </p>
        </div>
        
        <div class="footer">
            <p>
                Magic happens when planning meets love! ✨<br>
                <strong>The Magical Birthday Planner Team</strong>
            </p>
            <p style="margin-top: 20px; font-size: 12px;">
                Questions? Reply to this email or contact us at 
                <a href="mailto:magicalbirthdayplanner@gmail.com" style="color: #667eea;">magicalbirthdayplanner@gmail.com</a>
            </p>
        </div>
    </div>
</body>
</html>
  `;
}