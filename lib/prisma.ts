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
  // Optimized configuration for Vercel serverless deployment
  transactionOptions: {
    timeout: 20000, // 20 seconds - increased for cold starts and serverless environments
    maxWait: 10000, // 10 seconds max wait for connection pool to accommodate cold starts
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma