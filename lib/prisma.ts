import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Optimized configuration for Vercel serverless deployment
  transactionOptions: {
    timeout: 5000, // 5 seconds - Vercel compatible
    maxWait: 2000, // 2 seconds max wait for connection pool
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma