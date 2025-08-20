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
  // Enhanced connection pooling for Supabase
  transactionOptions: {
    timeout: 15000, // 15 seconds for complex operations
    maxWait: 8000, // 8 seconds max wait for connection pool
  },
})

// Enhanced connection management for serverless
export async function connectToPrisma() {
  try {
    await prisma.$connect();
    return true;
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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma