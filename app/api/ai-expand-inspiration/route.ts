import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();

interface AIExpandRequest {
  inspirationId: string;
  imageUrl: string;
  title: string;
  description?: string;
  partyTheme: string;
  childAge: number;
}

// Initialize Azure OpenAI
function getOpenAIClient() {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  
  if (!apiKey || !endpoint) {
    throw new Error('Azure OpenAI credentials not configured');
  }

  return new OpenAI({
    apiKey,
    baseURL: `${endpoint}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
    defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
    defaultHeaders: {
      'api-key': apiKey,
    },
  });
}

async function generateRecreationInstructions(
  title: string,
  description: string,
  partyTheme: string,
  childAge: number
): Promise<string> {
  try {
    const openai = getOpenAIClient();
    
    const prompt = `You are a party planning expert helping parents recreate Pinterest-inspired party decorations and setups. 

Based on this Pinterest inspiration:
- Title: "${title}"
- Description: "${description}"
- Party Theme: ${partyTheme}
- Child's Age: ${childAge} years old

Please provide detailed, practical instructions on how to recreate this look including:

1. **Materials Needed**: Complete shopping list with specific items, quantities, and where to buy them (include both online and local store options)

2. **Step-by-Step Instructions**: Clear, numbered steps that a parent can follow to recreate this design

3. **Cost Estimate**: Rough budget breakdown for materials (provide ranges: budget-friendly, mid-range, premium options)

4. **Time Required**: How long this project will take (prep time + execution time)

5. **Difficulty Level**: Rate from 1-5 stars and explain any challenging aspects

6. **Pro Tips**: Insider tips to make it look professional and age-appropriate for a ${childAge}-year-old

7. **Alternatives**: Suggest 2-3 easier or budget-friendly variations of this idea

8. **Safety Considerations**: Any safety notes, especially for decorations around young children

Make the instructions encouraging and achievable for busy parents. Focus on creating magical moments without overwhelming complexity.

Format the response in clear sections with emojis for visual appeal.`;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a creative party planning expert who helps parents create amazing birthday parties. You provide practical, detailed guidance that makes complex Pinterest ideas achievable for busy parents.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || 'Unable to generate recreation instructions at this time.';
    
  } catch (error) {
    console.error('Error generating AI expansion:', error);
    
    // Fallback response if AI is unavailable
    return `## 🎨 Recreation Guide for "${title}"

### 📝 Materials Needed:
- Basic craft supplies (scissors, glue, tape)
- Decorative paper or fabric in ${partyTheme} theme colors
- Balloons, streamers, or banners
- Optional: LED lights or string lights
- Age-appropriate decorative elements

### 🔧 Step-by-Step Instructions:
1. **Planning**: Sketch out your design based on the inspiration image
2. **Preparation**: Gather all materials and clear your workspace
3. **Base Setup**: Create the foundational elements first
4. **Details**: Add decorative touches and personalized elements
5. **Final Touches**: Step back and adjust for the perfect look

### 💰 Estimated Cost: $15-50
Budget-friendly options available using items you may already have at home.

### ⏰ Time Required: 2-4 hours
- Prep time: 30 minutes
- Execution: 1.5-3.5 hours

### ⭐ Difficulty Level: 3/5 stars
Moderate skill level required. Perfect weekend project!

### 💡 Pro Tips:
- Start with the background/base and work forward
- Use double-sided tape for cleaner finishes
- Take photos as you go to remember the setup for next time
- Get your ${childAge}-year-old involved in age-appropriate steps

### 🔄 Easy Alternatives:
1. **Quick Version**: Use pre-made decorations in similar colors
2. **Budget Version**: Focus on one key element and keep the rest simple
3. **Advanced Version**: Add interactive elements or photo opportunities

### ⚠️ Safety Notes:
- Ensure all decorations are securely attached
- Avoid small pieces that could be choking hazards for young children
- Check that any electrical elements are safely positioned

This inspiration piece is perfect for creating magical ${partyTheme} memories for your ${childAge}-year-old! 🎉`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: AIExpandRequest = await request.json();
    const { inspirationId, imageUrl, title, description, partyTheme, childAge } = body;

    if (!inspirationId || !title || !partyTheme || !childAge) {
      return NextResponse.json({ 
        error: 'Missing required fields: inspirationId, title, partyTheme, childAge' 
      }, { status: 400 });
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify the inspiration belongs to a party owned by the user
    const inspiration = await prisma.partyInspiration.findFirst({
      where: { 
        id: inspirationId,
        party: {
          userId: user.id
        }
      },
      include: {
        party: true
      }
    });

    if (!inspiration) {
      return NextResponse.json({ error: 'Inspiration not found' }, { status: 404 });
    }

    // Check if AI expansion already exists
    if (inspiration.aiExpanded) {
      return NextResponse.json({ 
        success: true, 
        aiExpansion: inspiration.aiExpanded,
        cached: true
      });
    }

    // Generate AI expansion
    const aiExpansion = await generateRecreationInstructions(
      title,
      description || 'Pinterest party inspiration',
      partyTheme,
      childAge
    );

    // Save the AI expansion to database
    const updatedInspiration = await prisma.partyInspiration.update({
      where: { id: inspirationId },
      data: { aiExpanded: aiExpansion }
    });

    return NextResponse.json({
      success: true,
      aiExpansion,
      inspirationId,
      cached: false
    });

  } catch (error) {
    console.error('AI expand inspiration error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate AI expansion',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}