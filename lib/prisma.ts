import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Enhanced connection pooling for Supabase serverless deployment
  transactionOptions: {
    timeout: 10000, // 10 seconds for operations
    maxWait: 5000, // 5 seconds max wait for connection pool
  },
  // Add datasource configuration for better serverless handling
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Enhanced connection test with retry logic for serverless
export async function testDatabaseConnection(retries = 3): Promise<boolean> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 Testing database connection (attempt ${attempt}/${retries})...`);
      
      // Test connection with a simple query
      const result = await prisma.$queryRaw`SELECT 1 as ok`;
      
      console.log('✅ Database connection successful:', result);
      return true;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Database connection failed (attempt ${attempt}/${retries}):`, {
        error: error.message,
        code: error.code,
        meta: error.meta
      });
      
      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error('💥 All database connection attempts failed:', lastError?.message);
  throw new Error(`Database connection failed after ${retries} attempts: ${lastError?.message}`);
}

// Enhanced connection management for serverless
export async function connectToPrisma() {
  try {
    return await testDatabaseConnection();
  } catch (error) {
    console.error('Prisma connection failed:', error);
    return false;
  }
}

// Graceful disconnect helper
export async function disconnectFromPrisma() {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('Prisma disconnect error:', error);
  }
}

// Wrapper for database operations with automatic retry
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationName = 'Database operation',
  retries = 2
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`${operationName} failed (attempt ${attempt}/${retries}):`, error.message);
      
      // Check if it's a connection error that might be retryable
      if (error.code === 'P1001' || error.message.includes("Can't reach database server")) {
        if (attempt < retries) {
          const delay = Math.min(1000 * attempt, 3000);
          console.log(`⏳ Retrying ${operationName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
      
      // For non-retryable errors or final attempt, throw immediately
      throw error;
    }
  }
  
  throw lastError;
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma