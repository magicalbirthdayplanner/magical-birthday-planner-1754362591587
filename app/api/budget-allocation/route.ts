export async function POST(request: Request) {
  try {
    const { totalBudget, preferences, childAge, selectedCategories } = await request.json();

    // Validate input
    if (!totalBudget || totalBudget <= 0) {
      return Response.json({ error: 'Invalid budget amount' }, { status: 400 });
    }

    // Define available budget categories
    const allCategories = {
      venue: { name: '🏢 Venue', icon: '🏢', color: '#7C3AED' },
      food_cake: { name: '🍰 Food & Cake', icon: '🍰', color: '#8B5CF6' },
      decorations: { name: '🎈 Decorations', icon: '🎈', color: '#10B981' },
      party_favors: { name: '🎁 Party Favors', icon: '🎁', color: '#EC4899' },
      entertainment: { name: '🎪 Entertainment', icon: '🎪', color: '#F59E0B' },
      photography: { name: '📸 Photography', icon: '📸', color: '#06B6D4' },
      catering: { name: '🍕 Catering', icon: '🍕', color: '#EF4444' },
      music_dj: { name: '🎵 Music/DJ', icon: '🎵', color: '#8B5CF6' },
      // Fallback categories if none selected
      food: { name: 'Food/Catering', icon: '🍰', color: '#8B5CF6' },
      gifts: { name: 'Gifts/Return Gifts', icon: '🎁', color: '#EC4899' },
      decor: { name: 'Decor/Supplies', icon: '🎈', color: '#10B981' }
    };

    // Use selected categories or fallback to default 4 categories
    const selectedKeys = selectedCategories && selectedCategories.length > 0 
      ? selectedCategories 
      : ['food', 'gifts', 'decor', 'entertainment'];

    const categories = selectedKeys.map(key => ({
      name: allCategories[key as keyof typeof allCategories]?.name || key,
      key,
      icon: allCategories[key as keyof typeof allCategories]?.icon || '📝',
      color: allCategories[key as keyof typeof allCategories]?.color || '#6B7280'
    }));

    // Get AI-powered allocation if Azure OpenAI is available
    let allocation;
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      try {
        allocation = await getAIBudgetAllocation(totalBudget, preferences, childAge, selectedKeys);
      } catch (error) {
        console.log('AI allocation failed, using smart defaults:', error);
        allocation = getSmartDefaultAllocation(totalBudget, preferences, childAge, selectedKeys);
      }
    } else {
      allocation = getSmartDefaultAllocation(totalBudget, preferences, childAge, selectedKeys);
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

async function getAIBudgetAllocation(totalBudget: number, preferences: string, childAge: number, selectedCategories: string[]) {
  const categoryDescriptions = {
    venue: 'Venue rental, location costs',
    food_cake: 'Food, cake, snacks, drinks, meals',
    decorations: 'Decorations, balloons, tableware, theme items',
    party_favors: 'Party favors, goody bags, thank you gifts',
    entertainment: 'Activities, games, entertainment, rentals',
    photography: 'Photography, videography services',
    catering: 'Catering services, professional food service',
    music_dj: 'DJ, music system, sound equipment',
    food: 'Food, catering, cake, snacks, drinks',
    gifts: 'Gifts, return gifts, party favors',
    decor: 'Decorations, balloons, tableware, theme items'
  };

  const categoryList = selectedCategories.map((key, index) => 
    `${index + 1}. ${key} (${categoryDescriptions[key as keyof typeof categoryDescriptions] || 'Party expenses'})`
  ).join('\n');

  const prompt = `As a party planning expert, suggest an optimal budget allocation for a ${childAge}-year-old child's birthday party with a total budget of $${totalBudget}.

User preferences: "${preferences}"

Please allocate the budget across these ${selectedCategories.length} categories:
${categoryList}

Consider the child's age, budget size, and user preferences. Return ONLY a JSON object with exact dollar amounts using the category keys:
{
  ${selectedCategories.map(key => `"${key}": 100`).join(',\n  ')}
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

function getSmartDefaultAllocation(totalBudget: number, preferences: string, childAge: number, selectedCategories: string[]) {
  // Smart default allocation percentages for different categories
  const categoryPercentages: Record<string, number> = {
    venue: 0.30,           // 30% - Venue
    food_cake: 0.25,       // 25% - Food & Cake
    decorations: 0.20,     // 20% - Decorations
    party_favors: 0.15,    // 15% - Party Favors
    entertainment: 0.25,   // 25% - Entertainment
    photography: 0.10,     // 10% - Photography
    catering: 0.30,        // 30% - Catering
    music_dj: 0.15,        // 15% - Music/DJ
    // Fallback categories
    food: 0.35,            // 35% - Food/Catering
    gifts: 0.15,           // 15% - Gifts/Return Gifts  
    decor: 0.25,           // 25% - Decor/Supplies
  };

  // Create base allocation from selected categories
  const numCategories = selectedCategories.length;
  let allocation: Record<string, number> = {};
  
  // Assign base percentages
  selectedCategories.forEach(key => {
    allocation[key] = categoryPercentages[key] || (1.0 / numCategories);
  });

  // Normalize to ensure total equals 1
  const currentTotal = Object.values(allocation).reduce((sum, val) => sum + val, 0);
  Object.keys(allocation).forEach(key => {
    allocation[key] /= currentTotal;
  });

  // Adjust based on preferences
  const prefs = preferences.toLowerCase();
  
  if (prefs.includes('cake') || prefs.includes('food') || prefs.includes('catering')) {
    const foodKeys = selectedCategories.filter(key => key.includes('food') || key.includes('cake') || key.includes('catering'));
    if (foodKeys.length > 0) {
      const adjustment = 0.1 / foodKeys.length;
      foodKeys.forEach(key => allocation[key] += adjustment);
      // Reduce other categories proportionally
      const otherKeys = selectedCategories.filter(key => !foodKeys.includes(key));
      if (otherKeys.length > 0) {
        const reduction = 0.1 / otherKeys.length;
        otherKeys.forEach(key => allocation[key] = Math.max(0.05, allocation[key] - reduction));
      }
    }
  }
  
  if (prefs.includes('activities') || prefs.includes('entertainment') || prefs.includes('games')) {
    const entertainmentKeys = selectedCategories.filter(key => key.includes('entertainment') || key.includes('music'));
    if (entertainmentKeys.length > 0) {
      const adjustment = 0.1 / entertainmentKeys.length;
      entertainmentKeys.forEach(key => allocation[key] += adjustment);
      const otherKeys = selectedCategories.filter(key => !entertainmentKeys.includes(key));
      if (otherKeys.length > 0) {
        const reduction = 0.1 / otherKeys.length;
        otherKeys.forEach(key => allocation[key] = Math.max(0.05, allocation[key] - reduction));
      }
    }
  }
  
  if (prefs.includes('decor') || prefs.includes('decoration') || prefs.includes('theme')) {
    const decorKeys = selectedCategories.filter(key => key.includes('decor') || key.includes('decoration'));
    if (decorKeys.length > 0) {
      const adjustment = 0.1 / decorKeys.length;
      decorKeys.forEach(key => allocation[key] += adjustment);
      const otherKeys = selectedCategories.filter(key => !decorKeys.includes(key));
      if (otherKeys.length > 0) {
        const reduction = 0.1 / otherKeys.length;
        otherKeys.forEach(key => allocation[key] = Math.max(0.05, allocation[key] - reduction));
      }
    }
  }

  // Age-based adjustments
  if (childAge <= 3) {
    // Younger kids - less entertainment, more food/decor
    const entertainmentKeys = selectedCategories.filter(key => key.includes('entertainment') || key.includes('music'));
    const foodDecorKeys = selectedCategories.filter(key => key.includes('food') || key.includes('decor') || key.includes('cake'));
    
    entertainmentKeys.forEach(key => allocation[key] *= 0.8);
    foodDecorKeys.forEach(key => allocation[key] *= 1.2);
  } else if (childAge >= 8) {
    // Older kids - more entertainment/activities
    const entertainmentKeys = selectedCategories.filter(key => key.includes('entertainment') || key.includes('music') || key.includes('photography'));
    const foodKeys = selectedCategories.filter(key => key.includes('food') || key.includes('cake'));
    
    entertainmentKeys.forEach(key => allocation[key] *= 1.3);
    foodKeys.forEach(key => allocation[key] *= 0.9);
  }

  // Ensure percentages sum to 1
  const total = Object.values(allocation).reduce((sum, val) => sum + val, 0);
  Object.keys(allocation).forEach(key => {
    allocation[key] /= total;
  });

  // Convert to dollar amounts
  const result: Record<string, number> = {};
  selectedCategories.forEach(key => {
    result[key] = Math.round(totalBudget * allocation[key]);
  });

  return result;
}