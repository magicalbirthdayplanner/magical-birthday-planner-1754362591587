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
  // Enhanced configuration for Vercel serverless deployment
  transactionOptions: {
    timeout: 30000, // Reduced to 30 seconds for serverless
    maxWait: 20000, // Reduced max wait time for faster failure detection
  }
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma