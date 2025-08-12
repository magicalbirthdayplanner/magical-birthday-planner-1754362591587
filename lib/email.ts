import { Resend } from 'resend';

// Initialize Resend client with API key from environment
export const resend = new Resend(process.env.RESEND_API_KEY);

// Email configuration - Updated to use custom verified domain
export const EMAIL_CONFIG = {
  fromDomain: 'noreply@magicalbirthdays.com', // Use your verified custom domain
  fallbackFrom: 'noreply@magicalbirthdays.com',
  replyTo: 'hello@magicalbirthdays.com', // Use verified custom domain for reply-to
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
    const response = await resend.emails.send({
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