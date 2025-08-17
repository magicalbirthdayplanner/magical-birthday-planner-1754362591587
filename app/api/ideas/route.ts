import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface GetIdeasQuery {
  partyId?: string;
  favorited?: string;
  category?: string;
  limit?: string;
  offset?: string;
}

// GET ideas for a party or favorites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const partyId = searchParams.get('partyId');
    const favoritedOnly = searchParams.get('favorited') === 'true';
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!partyId) {
      return NextResponse.json({ error: 'Party ID is required' }, { status: 400 });
    }

    // Build where clause
    const whereClause: any = {
      partyId: partyId
    };

    if (favoritedOnly) {
      whereClause.favorited = true;
    }

    if (category) {
      whereClause.category = category;
    }

    const ideas = await prisma.partyIdea.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        party: {
          select: {
            childName: true,
            theme: true
          }
        }
      }
    });

    // Get total count for pagination
    const totalCount = await prisma.partyIdea.count({
      where: whereClause
    });

    return NextResponse.json({
      success: true,
      ideas,
      pagination: {
        total: totalCount,
        offset,
        limit,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    console.error('Error fetching ideas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    );
  }
}