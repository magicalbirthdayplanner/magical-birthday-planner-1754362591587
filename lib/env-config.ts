// Environment configuration for the application
export const env = {
  // Supabase Configuration
  SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL!,
  DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  
  // OpenAI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  
  // Application Configuration
  NODE_ENV: process.env.NODE_ENV || 'development',
  NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  
  // Email Configuration
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  
  // Payment Configuration
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  
  // N8N Configuration
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL,
  
  // Dodo Payments Configuration
  DODO_API_KEY: process.env.DODO_API_KEY,
  DODO_WEBHOOK_SECRET: process.env.DODO_WEBHOOK_SECRET,
  
  // Vercel-specific
  VERCEL_ENV: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
  VERCEL_URL: process.env.VERCEL_URL,
};

// Validate required environment variables
export function validateEnv() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'DATABASE_URL'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  return true;
}

// Check if we're in production
export const isProduction = env.NODE_ENV === 'production';

// Check if we're in Vercel
export const isVercel = !!env.VERCEL_URL;

// Check if we're in test mode
export const isTest = env.NODE_ENV === 'test';

// Supabase configuration validation
export function validateSupabaseConfig() {
  if (!env.SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  
  if (!env.SUPABASE_ANON_KEY) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is required');
  }

  // Validate URL format
  try {
    new URL(env.SUPABASE_URL);
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be a valid URL');
  }

  return true;
}

// Database configuration validation
export function validateDatabaseConfig() {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  // Validate database URL format
  try {
    new URL(env.DATABASE_URL);
  } catch {
    throw new Error('DATABASE_URL must be a valid URL');
  }

  return true;
}

// OpenAI configuration validation
export function validateOpenAIConfig() {
  if (!env.OPENAI_API_KEY) {
    console.warn('⚠️  OPENAI_API_KEY not set - AI features will be disabled');
    return false;
  }
  return true;
}

// Payment configuration validation
export function validatePaymentConfig() {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PUBLISHABLE_KEY) {
    console.warn('⚠️  Stripe keys not set - payment features will be disabled');
    return false;
  }
  return true;
}

// Email configuration validation
export function validateEmailConfig() {
  if (!env.RESEND_API_KEY) {
    console.warn('⚠️  RESEND_API_KEY not set - email features will be disabled');
    return false;
  }
  return true;
}

// Comprehensive environment validation
export function validateAllConfig() {
  try {
    validateEnv();
    validateSupabaseConfig();
    validateDatabaseConfig();
    
    // Optional validations
    validateOpenAIConfig();
    validatePaymentConfig();
    validateEmailConfig();
    
    console.log('✅ All environment configuration validated successfully');
    return true;
  } catch (error) {
    console.error('❌ Environment configuration validation failed:', error);
    throw error;
  }
}

// Get configuration summary
export function getConfigSummary() {
  return {
    environment: env.NODE_ENV,
    vercel: {
      isVercel: isVercel,
      url: env.VERCEL_URL || 'Not deployed',
      env: env.VERCEL_ENV,
    },
    supabase: {
      url: env.SUPABASE_URL ? '✅ Configured' : '❌ Missing',
      anonKey: env.SUPABASE_ANON_KEY ? '✅ Configured' : '❌ Missing',
      serviceKey: env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configured' : '⚠️  Optional',
    },
    database: {
      url: env.DATABASE_URL ? '✅ Configured' : '❌ Missing',
      directUrl: env.DIRECT_URL ? '✅ Configured' : '⚠️  Missing',
      type: env.DATABASE_URL?.includes('supabase.co') ? 'Supabase' : 'Custom',
    },
    openai: {
      apiKey: env.OPENAI_API_KEY ? '✅ Configured' : '⚠️  Missing',
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY ? '✅ Configured' : '⚠️  Missing',
      publishableKey: env.STRIPE_PUBLISHABLE_KEY ? '✅ Configured' : '⚠️  Missing',
    },
    email: {
      resendKey: env.RESEND_API_KEY ? '✅ Configured' : '⚠️  Missing',
    },
    baseUrl: env.NEXT_PUBLIC_BASE_URL,
  };
}

// Export default configuration
export default env;