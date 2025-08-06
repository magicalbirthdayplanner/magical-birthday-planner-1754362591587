interface DodoPaymentsConfig {
  apiKey: string;
  baseUrl: string;
  webhookSecret?: string;
}

interface CreatePaymentLinkRequest {
  amount: number;
  currency: string;
  description: string;
  customer_email?: string;
  customer_name?: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, any>;
}

interface CreateSubscriptionRequest {
  customer_email: string;
  customer_name?: string;
  plan_id: string;
  success_url: string;
  cancel_url: string;
  metadata?: Record<string, any>;
}

interface DodoPaymentsResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface PaymentLink {
  id: string;
  url: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
}

interface Subscription {
  id: string;
  customer_id: string;
  plan_id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'incomplete';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

class DodoPaymentsClient {
  private config: DodoPaymentsConfig;

  constructor(apiKey: string, webhookSecret?: string) {
    this.config = {
      apiKey,
      baseUrl: 'https://api.dodopayments.com/v1',
      webhookSecret
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<DodoPaymentsResponse<T>> {
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || `HTTP ${response.status}`,
          message: data.message || 'Request failed'
        };
      }

      return {
        success: true,
        data
      };
    } catch (error) {
      console.error('DoDo Payments API Error:', error);
      return {
        success: false,
        error: 'Network error',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Payment Links
  async createPaymentLink(request: CreatePaymentLinkRequest): Promise<DodoPaymentsResponse<PaymentLink>> {
    return this.makeRequest<PaymentLink>('/payment-links', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getPaymentLink(id: string): Promise<DodoPaymentsResponse<PaymentLink>> {
    return this.makeRequest<PaymentLink>(`/payment-links/${id}`);
  }

  // Subscriptions
  async createSubscription(request: CreateSubscriptionRequest): Promise<DodoPaymentsResponse<Subscription>> {
    return this.makeRequest<Subscription>('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getSubscription(id: string): Promise<DodoPaymentsResponse<Subscription>> {
    return this.makeRequest<Subscription>(`/subscriptions/${id}`);
  }

  async cancelSubscription(id: string, immediately = false): Promise<DodoPaymentsResponse<Subscription>> {
    return this.makeRequest<Subscription>(`/subscriptions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ immediately }),
    });
  }

  async updateSubscription(id: string, planId: string): Promise<DodoPaymentsResponse<Subscription>> {
    return this.makeRequest<Subscription>(`/subscriptions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ plan_id: planId }),
    });
  }

  // Customers
  async createCustomer(email: string, name: string): Promise<DodoPaymentsResponse<Customer>> {
    return this.makeRequest<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  }

  async getCustomer(id: string): Promise<DodoPaymentsResponse<Customer>> {
    return this.makeRequest<Customer>(`/customers/${id}`);
  }

  async getCustomerByEmail(email: string): Promise<DodoPaymentsResponse<Customer>> {
    return this.makeRequest<Customer>(`/customers?email=${encodeURIComponent(email)}`);
  }

  // Webhook verification
  verifyWebhook(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('Webhook secret not configured');
      return false;
    }

    // Implement webhook signature verification
    // This would typically use HMAC-SHA256
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('hex');
      
      return signature === `sha256=${expectedSignature}`;
    } catch (error) {
      console.error('Webhook verification error:', error);
      return false;
    }
  }
}

// Singleton instance
let dodoPaymentsClient: DodoPaymentsClient | null = null;

export function getDodoPaymentsClient(): DodoPaymentsClient | null {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  
  if (!apiKey) {
    console.warn('DoDo Payments API key not configured');
    return null;
  }

  if (!dodoPaymentsClient) {
    dodoPaymentsClient = new DodoPaymentsClient(
      apiKey,
      process.env.DODO_PAYMENTS_WEBHOOK_SECRET
    );
  }

  return dodoPaymentsClient;
}

// Subscription plan configurations
export const SUBSCRIPTION_PLANS = {
  ESSENTIAL: {
    id: 'essential_onetime',
    name: 'Essential Party',
    price: 9.99,
    currency: 'USD',
    interval: 'one-time',
    features: {
      eventsCreation: 1,
      maxGuests: 10,
      basicThemes: true,
      simpleChecklist: true,
      communitySupport: true,
      emailInvitations: false,
      aiRecommendations: false,
      customThemes: false,
      printables: false
    }
  },
  STARTER: {
    id: 'starter_monthly',
    name: 'Starter',
    price: 9.99,
    currency: 'USD',
    interval: 'month',
    features: {
      partiesPerMonth: 5,
      maxGuests: 25,
      aiRecommendations: true,
      customThemes: false,
      analytics: false,
      prioritySupport: false
    }
  },
  PROFESSIONAL: {
    id: 'professional_monthly',
    name: 'Professional',
    price: 19.99,
    currency: 'USD',
    interval: 'month',
    features: {
      partiesPerMonth: 15,
      maxGuests: 100,
      aiRecommendations: true,
      customThemes: true,
      analytics: true,
      prioritySupport: true
    }
  },
  PREMIUM: {
    id: 'premium_monthly',
    name: 'Premium',
    price: 39.99,
    currency: 'USD',
    interval: 'month',
    features: {
      partiesPerMonth: -1, // unlimited
      maxGuests: -1, // unlimited
      aiRecommendations: true,
      customThemes: true,
      analytics: true,
      prioritySupport: true,
      whiteLabel: true,
      dedicatedSupport: true
    }
  }
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;

export {
  type DodoPaymentsConfig,
  type CreatePaymentLinkRequest,
  type CreateSubscriptionRequest,
  type DodoPaymentsResponse,
  type PaymentLink,
  type Subscription,
  type Customer,
  DodoPaymentsClient
};