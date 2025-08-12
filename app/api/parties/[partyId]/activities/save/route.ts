import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface ActivitySuggestion {
  id: string;
  name: string;
  category: 'game' | 'craft' | 'creative' | 'active' | 'quiet' | 'educational';
  difficulty: 'easy' | 'medium' | 'advanced';
  duration: string;
  ageAppropriate: string;
  participants: string;
  description: string;
  materials: string[];
  instructions: string[];
  tips: string[];
  safetyNotes?: string[];
  energyLevel: 'low' | 'medium' | 'high';
  setupTime: string;
  cost: 'free' | 'low' | 'medium' | 'high';
}

interface SaveActivitiesRequest {
  activities: ActivitySuggestion[];
  partyConfiguration: {
    theme: string;
    childAge: number;
    guestCount: number;
    budget: 'low' | 'medium' | 'high';
    venue: 'indoor' | 'outdoor' | 'mixed';
    duration: string;
    customRequests?: string;
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;

    if (!partyId || partyId.trim() === '') {
      return NextResponse.json(
        { error: 'Invalid party ID' },
        { status: 400 }
      );
    }

    let requestData: SaveActivitiesRequest;
    try {
      requestData = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate request data
    if (!requestData.activities || !Array.isArray(requestData.activities)) {
      return NextResponse.json(
        { error: 'Activities array is required' },
        { status: 400 }
      );
    }

    if (!requestData.partyConfiguration) {
      return NextResponse.json(
        { error: 'Party configuration is required' },
        { status: 400 }
      );
    }

    console.log('Saving activities for party:', partyId, {
      activityCount: requestData.activities.length,
      configuration: requestData.partyConfiguration
    });

    // Check if party exists
    const existingParty = await prisma.party.findUnique({
      where: { id: partyId }
    });

    if (!existingParty) {
      return NextResponse.json(
        { error: 'Party not found' },
        { status: 404 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Remove existing activity plan for this party
      const existingPlans = await tx.partyActivityPlan.findMany({
        where: { partyId }
      });

      if (existingPlans.length > 0) {
        console.log(`Removing ${existingPlans.length} existing activity plans`);
        await tx.partyActivityPlan.deleteMany({
          where: { partyId }
        });
      }

      // Create new activity plan
      const activityPlan = await tx.partyActivityPlan.create({
        data: {
          partyId,
          theme: requestData.partyConfiguration.theme,
          childAge: requestData.partyConfiguration.childAge,
          guestCount: requestData.partyConfiguration.guestCount,
          budget: requestData.partyConfiguration.budget.toUpperCase() as any,
          venue: requestData.partyConfiguration.venue.toUpperCase() as any,
          duration: requestData.partyConfiguration.duration,
          customRequests: requestData.partyConfiguration.customRequests || null,
          isAiGenerated: true, // Assume AI generated since this is from the new system
          generationSource: 'ai',
          aiModel: 'gpt-4'
        }
      });

      // Create activity suggestions
      const activityPromises = requestData.activities.map((activity, index) => {
        return tx.activitySuggestion.create({
          data: {
            partyActivityPlanId: activityPlan.id,
            name: activity.name,
            category: activity.category.toUpperCase() as any,
            difficulty: activity.difficulty.toUpperCase() as any,
            duration: activity.duration,
            ageAppropriate: activity.ageAppropriate,
            participants: activity.participants,
            description: activity.description,
            materials: activity.materials,
            instructions: activity.instructions,
            tips: activity.tips,
            safetyNotes: activity.safetyNotes || [],
            energyLevel: activity.energyLevel.toUpperCase() as any,
            setupTime: activity.setupTime,
            cost: activity.cost.toUpperCase() as any,
            isSelected: true,
            sequenceOrder: index + 1
          }
        });
      });

      const savedActivities = await Promise.all(activityPromises);

      return {
        activityPlan,
        activities: savedActivities
      };
    });

    console.log(`Successfully saved ${result.activities.length} activities for party ${partyId}`);

    return NextResponse.json({
      success: true,
      message: 'Activities saved successfully',
      activityPlanId: result.activityPlan.id,
      activityCount: result.activities.length,
      savedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error saving activities:', error);
    
    if (error instanceof Error && error.message.includes('Foreign key constraint')) {
      return NextResponse.json(
        { 
          error: 'Party not found',
          message: 'The specified party does not exist'
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to save activities',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}