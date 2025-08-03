export async function POST(request: Request) {
  try {
    const { totalBudget, preferences, childAge } = await request.json();

    // Validate input
    if (!totalBudget || totalBudget <= 0) {
      return Response.json({ error: 'Invalid budget amount' }, { status: 400 });
    }

    // Define budget categories
    const categories = [
      { 
        name: 'Food/Catering', 
        key: 'food',
        icon: '🍰',
        color: '#8B5CF6'
      },
      { 
        name: 'Gifts/Return Gifts', 
        key: 'gifts',
        icon: '🎁',
        color: '#EC4899'
      },
      { 
        name: 'Decor/Supplies', 
        key: 'decor',
        icon: '🎈',
        color: '#10B981'
      },
      { 
        name: 'Entertainment', 
        key: 'entertainment',
        icon: '🎪',
        color: '#F59E0B'
      }
    ];

    // Get AI-powered allocation if Azure OpenAI is available
    let allocation;
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      try {
        allocation = await getAIBudgetAllocation(totalBudget, preferences, childAge);
      } catch (error) {
        console.log('AI allocation failed, using smart defaults:', error);
        allocation = getSmartDefaultAllocation(totalBudget, preferences, childAge);
      }
    } else {
      allocation = getSmartDefaultAllocation(totalBudget, preferences, childAge);
    }

    // Apply allocation to categories
    const budgetBreakdown = categories.map(category => ({
      ...category,
      amount: Math.round(allocation[category.key] || 0),
      percentage: Math.round(((allocation[category.key] || 0) / totalBudget) * 100)
    }));

    return Response.json({
      totalBudget,
      categories: budgetBreakdown,
      preferences,
      aiGenerated: !!(process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT)
    });

  } catch (error) {
    console.error('Budget allocation error:', error);
    return Response.json({ error: 'Failed to generate budget allocation' }, { status: 500 });
  }
}

async function getAIBudgetAllocation(totalBudget: number, preferences: string, childAge: number) {
  const prompt = `As a party planning expert, suggest an optimal budget allocation for a ${childAge}-year-old child's birthday party with a total budget of $${totalBudget}.

User preferences: "${preferences}"

Please allocate the budget across these 4 categories:
1. Food/Catering (cake, snacks, drinks, meals)
2. Gifts/Return Gifts (party favors, goody bags, thank you gifts)
3. Decor/Supplies (decorations, balloons, tableware, theme items)
4. Entertainment (activities, games, entertainment, rentals)

Consider the child's age, budget size, and user preferences. Return ONLY a JSON object with exact dollar amounts:
{
  "food": 200,
  "gifts": 150,
  "decor": 100,
  "entertainment": 150
}`;

  const response = await fetch(`${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': process.env.AZURE_OPENAI_API_KEY!,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 200,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  // Parse JSON response
  const jsonMatch = content.match(/\{[^}]+\}/);
  if (!jsonMatch) {
    throw new Error('Invalid JSON in AI response');
  }

  return JSON.parse(jsonMatch[0]);
}

function getSmartDefaultAllocation(totalBudget: number, preferences: string, childAge: number) {
  // Smart default allocation based on preferences and age
  let allocation = {
    food: 0.35,      // 35% - Food/Catering
    gifts: 0.15,     // 15% - Gifts/Return Gifts  
    decor: 0.25,     // 25% - Decor/Supplies
    entertainment: 0.25  // 25% - Entertainment
  };

  // Adjust based on preferences
  const prefs = preferences.toLowerCase();
  
  if (prefs.includes('cake') || prefs.includes('food') || prefs.includes('catering')) {
    allocation.food += 0.1;
    allocation.entertainment -= 0.05;
    allocation.decor -= 0.05;
  }
  
  if (prefs.includes('activities') || prefs.includes('entertainment') || prefs.includes('games')) {
    allocation.entertainment += 0.1;
    allocation.food -= 0.05;
    allocation.gifts -= 0.05;
  }
  
  if (prefs.includes('decor') || prefs.includes('decoration') || prefs.includes('theme')) {
    allocation.decor += 0.1;
    allocation.food -= 0.05;
    allocation.entertainment -= 0.05;
  }
  
  if (prefs.includes('gifts') || prefs.includes('favors') || prefs.includes('goody')) {
    allocation.gifts += 0.1;
    allocation.food -= 0.05;
    allocation.decor -= 0.05;
  }

  // Age-based adjustments
  if (childAge <= 3) {
    // Younger kids - less entertainment, more food/decor
    allocation.entertainment -= 0.05;
    allocation.food += 0.03;
    allocation.decor += 0.02;
  } else if (childAge >= 8) {
    // Older kids - more entertainment/gifts
    allocation.entertainment += 0.05;
    allocation.gifts += 0.03;
    allocation.food -= 0.05;
    allocation.decor -= 0.03;
  }

  // Ensure percentages sum to 1
  const total = Object.values(allocation).reduce((sum, val) => sum + val, 0);
  Object.keys(allocation).forEach(key => {
    allocation[key as keyof typeof allocation] /= total;
  });

  // Convert to dollar amounts
  return {
    food: Math.round(totalBudget * allocation.food),
    gifts: Math.round(totalBudget * allocation.gifts),
    decor: Math.round(totalBudget * allocation.decor),
    entertainment: Math.round(totalBudget * allocation.entertainment)
  };
}