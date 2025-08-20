import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    console.log('🔍 Testing database connection...')
    
    // Simple connection test
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, 1 as test_value`
    
    console.log('✅ Database connection successful:', result)
    
    return NextResponse.json({
      status: 'success',
      message: 'Database connection is working',
      data: result,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('❌ Database connection failed:', error)
    
    return NextResponse.json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
