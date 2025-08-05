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
  // Optimize transaction timeouts for serverless environments
  transactionOptions: {
    timeout: 20000, // 20 seconds
    maxWait: 20000, // 20 seconds 
  },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma