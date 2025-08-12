import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;

    // First check if the party exists
    const party = await prisma.party.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    const vibeConfig = await prisma.partyVibeConfig.findUnique({
      where: { partyId },
      include: {
        activityPlans: {
          orderBy: { sequence: 'asc' }
        }
      }
    });

    return NextResponse.json({ vibeConfig });
  } catch (error) {
    console.error('Error fetching activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;
    const data = await request.json();

    // First check if the party exists
    const party = await prisma.party.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Upsert party vibe config
    const vibeConfig = await prisma.partyVibeConfig.upsert({
      where: { partyId },
      update: {
        theme: data.theme,
        ageGroup: data.ageGroup,
        numberOfKids: data.numberOfKids,
        totalDuration: data.totalDuration,
        setting: data.setting,
        availableMaterials: data.availableMaterials || [],
        budgetLevel: data.budgetLevel,
        specialRequests: data.specialRequests || [],
        customText: data.customText,
      },
      create: {
        partyId,
        theme: data.theme,
        ageGroup: data.ageGroup,
        numberOfKids: data.numberOfKids,
        totalDuration: data.totalDuration,
        setting: data.setting,
        availableMaterials: data.availableMaterials || [],
        budgetLevel: data.budgetLevel,
        specialRequests: data.specialRequests || [],
        customText: data.customText,
      },
    });

    return NextResponse.json({ vibeConfig });
  } catch (error) {
    console.error('Error saving party vibe config:', error);
    return NextResponse.json(
      { error: 'Failed to save party vibe config' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;
    const { activityPlans } = await request.json();

    // First check if the party exists
    const party = await prisma.party.findUnique({
      where: { id: partyId }
    });

    if (!party) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    const vibeConfig = await prisma.partyVibeConfig.findUnique({
      where: { partyId }
    });

    if (!vibeConfig) {
      return NextResponse.json(
        { error: 'Party vibe config not found' },
        { status: 404 }
      );
    }

    // Delete existing activity plans
    await prisma.activityPlan.deleteMany({
      where: { vibeConfigId: vibeConfig.id }
    });

    // Create new activity plans
    const createdPlans = await Promise.all(
      activityPlans.map((plan: any, index: number) =>
        prisma.activityPlan.create({
          data: {
            vibeConfigId: vibeConfig.id,
            name: plan.name,
            category: plan.category,
            difficulty: plan.difficulty,
            timeEstimate: plan.timeEstimate,
            bestGroupSize: plan.bestGroupSize,
            instructions: plan.instructions,
            materials: plan.materials,
            materialAlternatives: plan.materialAlternatives,
            energyLevel: plan.energyLevel,
            sequence: index + 1,
            isAiGenerated: plan.isAiGenerated || false,
            aiPrompt: plan.aiPrompt,
          }
        })
      )
    );

    return NextResponse.json({ activityPlans: createdPlans });
  } catch (error) {
    console.error('Error saving activity plans:', error);
    return NextResponse.json(
      { error: 'Failed to save activity plans' },
      { status: 500 }
    );
  }
}