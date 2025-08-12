import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { partyId: string } }
) {
  try {
    const { partyId } = params;

    // Validate partyId parameter
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      console.warn('Invalid partyId provided:', partyId);
      return NextResponse.json(
        { 
          error: 'Invalid party ID',
          message: 'Party ID is required and must be a valid string'
        },
        { status: 400 }
      );
    }

    // First check if the party exists with enhanced error handling
    let party;
    try {
      party = await prisma.party.findUnique({
        where: { id: partyId.trim() }
      });
    } catch (dbError) {
      console.error('Database error while finding party:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again later.'
        },
        { status: 503 }
      );
    }

    if (!party) {
      console.warn('Party not found for ID:', partyId);
      return NextResponse.json(
        { 
          error: 'Party not found',
          message: 'The specified party does not exist or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Fetch vibe config with enhanced error handling
    let vibeConfig;
    try {
      vibeConfig = await prisma.partyVibeConfig.findUnique({
        where: { partyId: partyId.trim() },
        include: {
          activityPlans: {
            orderBy: { sequence: 'asc' }
          }
        }
      });
    } catch (dbError) {
      console.error('Database error while fetching vibe config:', dbError);
      return NextResponse.json(
        { 
          error: 'Failed to load activity configuration',
          message: 'Database error occurred while loading your activity settings'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ vibeConfig });
  } catch (error) {
    console.error('Unexpected error in GET /api/parties/[partyId]/activities:', error);
    
    // Enhanced error response with more context
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
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

    // Validate partyId parameter
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      console.warn('Invalid partyId provided in POST:', partyId);
      return NextResponse.json(
        { 
          error: 'Invalid party ID',
          message: 'Party ID is required and must be a valid string'
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let data;
    try {
      data = await request.json();
    } catch (parseError) {
      console.error('Invalid JSON in request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      );
    }

    // Validate required fields
    const requiredFields = ['theme', 'ageGroup', 'numberOfKids', 'totalDuration', 'setting', 'budgetLevel'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return NextResponse.json(
        { 
          error: 'Missing required fields',
          message: `The following fields are required: ${missingFields.join(', ')}`
        },
        { status: 400 }
      );
    }

    // First check if the party exists with enhanced error handling
    let party;
    try {
      party = await prisma.party.findUnique({
        where: { id: partyId.trim() }
      });
    } catch (dbError) {
      console.error('Database error while finding party in POST:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again later.'
        },
        { status: 503 }
      );
    }

    if (!party) {
      console.warn('Party not found in POST for ID:', partyId);
      return NextResponse.json(
        { 
          error: 'Party not found',
          message: 'The specified party does not exist or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Upsert party vibe config with enhanced error handling
    let vibeConfig;
    try {
      vibeConfig = await prisma.partyVibeConfig.upsert({
        where: { partyId: partyId.trim() },
        update: {
          theme: data.theme,
          ageGroup: data.ageGroup,
          numberOfKids: parseInt(data.numberOfKids) || 0,
          totalDuration: data.totalDuration,
          setting: data.setting,
          availableMaterials: Array.isArray(data.availableMaterials) ? data.availableMaterials : [],
          budgetLevel: data.budgetLevel,
          specialRequests: Array.isArray(data.specialRequests) ? data.specialRequests : [],
          customText: data.customText || null,
        },
        create: {
          partyId: partyId.trim(),
          theme: data.theme,
          ageGroup: data.ageGroup,
          numberOfKids: parseInt(data.numberOfKids) || 0,
          totalDuration: data.totalDuration,
          setting: data.setting,
          availableMaterials: Array.isArray(data.availableMaterials) ? data.availableMaterials : [],
          budgetLevel: data.budgetLevel,
          specialRequests: Array.isArray(data.specialRequests) ? data.specialRequests : [],
          customText: data.customText || null,
        },
      });
    } catch (dbError) {
      console.error('Database error while upserting vibe config:', dbError);
      
      // Check if it's a constraint violation or other specific error
      if (dbError instanceof Error && dbError.message.includes('foreign key constraint')) {
        return NextResponse.json(
          { 
            error: 'Invalid party reference',
            message: 'The party you are trying to update no longer exists'
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to save activity configuration',
          message: 'Database error occurred while saving your activity settings'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ vibeConfig });
  } catch (error) {
    console.error('Unexpected error in POST /api/parties/[partyId]/activities:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
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

    // Validate partyId parameter
    if (!partyId || typeof partyId !== 'string' || partyId.trim() === '') {
      console.warn('Invalid partyId provided in PUT:', partyId);
      return NextResponse.json(
        { 
          error: 'Invalid party ID',
          message: 'Party ID is required and must be a valid string'
        },
        { status: 400 }
      );
    }

    // Parse and validate request body
    let requestData;
    try {
      requestData = await request.json();
    } catch (parseError) {
      console.error('Invalid JSON in PUT request body:', parseError);
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          message: 'Request body must be valid JSON'
        },
        { status: 400 }
      );
    }

    const { activityPlans } = requestData;

    // Validate activity plans data
    if (!Array.isArray(activityPlans)) {
      return NextResponse.json(
        { 
          error: 'Invalid activity plans data',
          message: 'Activity plans must be an array'
        },
        { status: 400 }
      );
    }

    // First check if the party exists with enhanced error handling
    let party;
    try {
      party = await prisma.party.findUnique({
        where: { id: partyId.trim() }
      });
    } catch (dbError) {
      console.error('Database error while finding party in PUT:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again later.'
        },
        { status: 503 }
      );
    }

    if (!party) {
      console.warn('Party not found in PUT for ID:', partyId);
      return NextResponse.json(
        { 
          error: 'Party not found',
          message: 'The specified party does not exist or you do not have access to it'
        },
        { status: 404 }
      );
    }

    // Find vibe config with enhanced error handling
    let vibeConfig;
    try {
      vibeConfig = await prisma.partyVibeConfig.findUnique({
        where: { partyId: partyId.trim() }
      });
    } catch (dbError) {
      console.error('Database error while finding vibe config in PUT:', dbError);
      return NextResponse.json(
        { 
          error: 'Database connection error',
          message: 'Unable to connect to database. Please try again later.'
        },
        { status: 503 }
      );
    }

    if (!vibeConfig) {
      console.warn('Party vibe config not found for ID:', partyId);
      return NextResponse.json(
        { 
          error: 'Party configuration not found',
          message: 'Please configure your party settings first before adding activities'
        },
        { status: 404 }
      );
    }

    // Use database transaction to ensure data consistency
    let createdPlans;
    try {
      createdPlans = await prisma.$transaction(async (tx) => {
        // Delete existing activity plans
        await tx.activityPlan.deleteMany({
          where: { vibeConfigId: vibeConfig.id }
        });

        // Create new activity plans with validation
        const plans = await Promise.all(
          activityPlans.map(async (plan: any, index: number) => {
            // Validate required fields for each plan
            const requiredPlanFields = ['name', 'category', 'difficulty', 'timeEstimate', 'bestGroupSize', 'instructions', 'materials', 'energyLevel'];
            const missingPlanFields = requiredPlanFields.filter(field => !plan[field]);
            
            if (missingPlanFields.length > 0) {
              throw new Error(`Activity plan ${index + 1} is missing required fields: ${missingPlanFields.join(', ')}`);
            }

            return tx.activityPlan.create({
              data: {
                vibeConfigId: vibeConfig.id,
                name: plan.name,
                category: plan.category,
                difficulty: plan.difficulty,
                timeEstimate: plan.timeEstimate,
                bestGroupSize: plan.bestGroupSize,
                instructions: Array.isArray(plan.instructions) ? plan.instructions : [],
                materials: Array.isArray(plan.materials) ? plan.materials : [],
                materialAlternatives: plan.materialAlternatives || {},
                energyLevel: plan.energyLevel,
                sequence: index + 1,
                isAiGenerated: Boolean(plan.isAiGenerated),
                aiPrompt: plan.aiPrompt || null,
              }
            });
          })
        );

        return plans;
      });
    } catch (dbError) {
      console.error('Database transaction error while saving activity plans:', dbError);
      
      if (dbError instanceof Error && dbError.message.includes('missing required fields')) {
        return NextResponse.json(
          { 
            error: 'Invalid activity plan data',
            message: dbError.message
          },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to save activity plans',
          message: 'Database error occurred while saving your activity plans'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ activityPlans: createdPlans });
  } catch (error) {
    console.error('Unexpected error in PUT /api/parties/[partyId]/activities:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}