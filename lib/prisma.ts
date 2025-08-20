import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimized configuration for Vercel serverless deployment with Supabase
  transactionOptions: {
    timeout: 20000, // 20 seconds - increased for cold starts and serverless environments
    maxWait: 10000, // 10 seconds max wait for connection pool to accommodate cold starts
  },
  // Enhanced connection pooling for Supabase + Vercel
  connection: {
    pool: {
      min: 0,
      max: 1, // Limit to 1 connection for serverless
    },
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Database connection test function
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Test basic connectivity with timeout
    const testPromise = prisma.$queryRaw`SELECT 1 as test`
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 5000)
    })
    
    await Promise.race([testPromise, timeoutPromise])
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}