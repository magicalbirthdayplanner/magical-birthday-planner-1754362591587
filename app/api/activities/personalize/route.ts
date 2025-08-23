import { NextRequest, NextResponse } from 'next/server';
import { createServerComponentClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerComponentClient({ cookies: () => [] });
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { activityId, partyContext } = await request.json();
    
    if (!activityId) {
      return NextResponse.json(
        { error: 'Activity ID is required' },
        { status: 400 }
      );
    }

    // Get activity details from Supabase
    const { data: activity, error: activityError } = await supabase
      .from('activities')
      .select('*')
      .eq('id', activityId)
      .single();

    if (activityError || !activity) {
      return NextResponse.json(
        { error: 'Activity not found' },
        { status: 404 }
      );
    }

    // For now, return a simple personalized tip
    // In the future, this could integrate with OpenAI for more sophisticated personalization
    const personalizedTip = generatePersonalizedTip(activity, partyContext);

    return NextResponse.json({
      success: true,
      personalizedTip,
      activity: {
        id: activity.id,
        name: activity.name,
        description: activity.description,
        category: activity.category,
        effortLevel: activity.effort_level,
        duration: activity.duration_minutes
      }
    });

  } catch (error) {
    console.error('Error personalizing activity:', error);
    return NextResponse.json(
      { error: 'Failed to personalize activity' },
      { status: 500 }
    );
  }
}

function generatePersonalizedTip(activity: any, partyContext?: any): string {
  if (!partyContext) {
    return `💡 Pro tip: ${activity.name} is perfect for ${activity.category.toLowerCase()} parties!`;
  }

  const { childName, age, theme, colors } = partyContext;
  
  let tip = `💡 Perfect for ${childName}'s ${age}th birthday! `;
  
  if (theme) {
    tip += `This ${activity.name} activity fits perfectly with your ${theme} theme. `;
  }
  
  if (colors && colors.length > 0) {
    tip += `Consider using ${colors.join(' and ')} colors for decorations!`;
  }
  
  return tip;
}
