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
  // Optimized configuration for production deployment with faster connections
  transactionOptions: {
    timeout: 8000, // 8 seconds - increased for better reliability
    maxWait: 3000, // 3 seconds max wait for connection pool
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma