import { NextResponse } from 'next/server'
import { prisma, testDatabaseConnection } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 Testing database connection via Prisma...')
    
    // Test connection using our enhanced Prisma client
    const isConnected = await testDatabaseConnection()
    
    if (!isConnected) {
      throw new Error('Database connection test failed')
    }
    
    // Test basic queries to verify database is working
    const userCount = await prisma.user.count()
    const partyCount = await prisma.party.count()
    
    // Test a raw query to ensure full connectivity
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as db_version`
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection successful via Prisma',
      data: {
        current_time: (result as any)[0]?.current_time,
        db_version: (result as any)[0]?.db_version,
        user_count: userCount,
        party_count: partyCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Prisma database connection error:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed via Prisma',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}