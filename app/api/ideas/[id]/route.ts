import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface UpdateIdeaRequest {
  liked?: boolean;
  disliked?: boolean;
  favorited?: boolean;
}

// GET specific idea
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const idea = await prisma.partyIdea.findUnique({
      where: { id: params.id },
      include: {
        party: {
          select: {
            childName: true,
            theme: true
          }
        }
      }
    });

    if (!idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, idea });

  } catch (error) {
    console.error('Error fetching idea:', error);
    return NextResponse.json(
      { error: 'Failed to fetch idea' },
      { status: 500 }
    );
  }
}

// PATCH to update idea (like, dislike, favorite)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates: UpdateIdeaRequest = await request.json();
    const { liked, disliked, favorited } = updates;

    // Validate that we have at least one field to update
    if (liked === undefined && disliked === undefined && favorited === undefined) {
      return NextResponse.json(
        { error: 'At least one field (liked, disliked, favorited) must be provided' },
        { status: 400 }
      );
    }

    // Ensure mutual exclusivity of liked and disliked
    let updateData: any = {};
    
    if (liked !== undefined) {
      updateData.liked = liked;
      if (liked) {
        updateData.disliked = false; // Can't be both liked and disliked
      }
    }
    
    if (disliked !== undefined) {
      updateData.disliked = disliked;
      if (disliked) {
        updateData.liked = false; // Can't be both liked and disliked
      }
    }
    
    if (favorited !== undefined) {
      updateData.favorited = favorited;
    }

    const updatedIdea = await prisma.partyIdea.update({
      where: { id: params.id },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      idea: updatedIdea
    });

  } catch (error) {
    console.error('Error updating idea:', error);
    return NextResponse.json(
      { error: 'Failed to update idea' },
      { status: 500 }
    );
  }
}

// DELETE idea
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.partyIdea.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error deleting idea:', error);
    return NextResponse.json(
      { error: 'Failed to delete idea' },
      { status: 500 }
    );
  }
}