/**
 * Deterministic fixture output per feature for the mock provider (AI_PROVIDER=mock and all automated tests).
 * party_planner = golden scenario A (7, art + animals, ~12 kids, $250, indoors, October).
 */
export const FIXTURES: Record<string, unknown> = {
  theme_ideas: {
    themes: [
      { name: 'Wild Art Safari', emoji: '🦁', why: 'Paint and sculpt favourite animals.', palette: ['#F4A259', '#5B8E7D', '#F4E285'], decorations: ['Animal-print table runners', 'Paint-splatter balloons', 'Easel welcome sign'], activities: ['Animal mask painting', 'Clay critters', 'Safari scavenger hunt'], ageFit: 'Simple crafts a 7-year-old can finish in 20 minutes.' },
      { name: 'Pop-Star Concert Party', emoji: '🎤', why: 'Sing-along stage fun without any real artists.', palette: ['#B5179E', '#7209B7', '#F72585'], decorations: ['Starry backdrop', 'Microphone cupcake toppers'], activities: ['Lip-sync showcase', 'Design your tour shirt'], ageFit: 'Great for confident performers aged 6-10.' },
      { name: 'Rainforest Explorers', emoji: '🌿', why: 'Animals plus hands-on discovery.', palette: ['#2D6A4F', '#95D5B2', '#FFB703'], decorations: ['Paper vines', 'Binocular favors'], activities: ['Bug hunt', 'Leaf rubbing art'], ageFit: 'Active but gentle for mixed ages.' },
      { name: 'Little Picasso Studio', emoji: '🎨', why: 'A gallery day for budding artists.', palette: ['#E63946', '#F1FAEE', '#457B9D'], decorations: ['Mini gallery wall', 'Frame photo booth'], activities: ['Canvas painting', 'Gallery walk'], ageFit: 'Calm, creative and easy indoors.' },
      { name: 'Pet Spa Day', emoji: '🐶', why: 'Pamper plush pets with crafts.', palette: ['#FFAFCC', '#BDE0FE', '#CDB4DB'], decorations: ['Pet bed centerpieces'], activities: ['Decorate a pet collar', 'Plush pet show'], ageFit: 'Gentle, imaginative play for 5-8.' },
    ],
    assumptions: ['Indoor party assumed.'],
  },
  party_planner: {
    summary: 'A colourful indoor art-and-animals studio party for about 12 kids, built to stay under $250.',
    partyConcept: 'Kids become "wild artists" who paint, sculpt and parade their own animal creations.',
    theme: { name: 'Wild Art Safari', why: 'Combines painting with favourite animals for a 7-year-old.', palette: ['#F4A259', '#5B8E7D', '#F4E285', '#BC4B51'] },
    activities: [
      { name: 'Paint-your-own animal masks', description: 'Kids decorate pre-cut paper masks with paint pens and stickers.', durationMin: 25, estimatedCost: 24, materials: ['Paper masks', 'Paint pens', 'Stickers'], difficulty: 'easy' },
      { name: 'Air-dry clay critters', description: 'Each child sculpts a small animal to take home.', durationMin: 30, estimatedCost: 30, materials: ['Air-dry clay', 'Craft sticks', 'Paper plates'], difficulty: 'medium' },
      { name: 'Animal charades relay', description: 'Teams act out animals while the others guess — no materials needed.', durationMin: 15, estimatedCost: 0, materials: [], difficulty: 'easy' },
      { name: 'Gallery parade', description: 'Kids show their masks and clay animals in a mini runway show.', durationMin: 10, estimatedCost: 0, materials: ['Music speaker'], difficulty: 'easy' },
    ],
    food: { main: ['Mini pizzas'], snacks: ['Fruit skewers', 'Pretzel "sticks"'], dessert: ['Animal-print cupcakes'], drinks: ['Water', 'Juice boxes'] },
    decorations: ['Paper animal garland', 'Butcher-paper table covers kids can draw on', 'Paint-splatter balloons'],
    timeline: [{ minute: 0, label: 'Guests arrive, start mask painting' }, { minute: 25, label: 'Clay critters' }, { minute: 55, label: 'Animal charades relay' }, { minute: 70, label: 'Pizza and snacks' }, { minute: 90, label: 'Cupcakes and Happy Birthday' }, { minute: 105, label: 'Gallery parade and goodbyes' }],
    shoppingList: [
      { item: 'Paper animal masks', qty: '12', category: 'activities', estimatedCost: 12 },
      { item: 'Paint pens', qty: '2 packs', category: 'activities', estimatedCost: 12 },
      { item: 'Air-dry clay', qty: '3 lb', category: 'activities', estimatedCost: 18 },
      { item: 'Mini pizzas', qty: '24', category: 'food', estimatedCost: 36 },
      { item: 'Cupcakes', qty: '15', category: 'food', estimatedCost: 30 },
      { item: 'Balloons', qty: '20', category: 'decorations', estimatedCost: 8 },
      { item: 'Small sketchbooks', qty: '12', category: 'favors', estimatedCost: 24 },
    ],
    budget: { lines: [{ category: 'Activities', amount: 54 }, { category: 'Food & cake', amount: 96 }, { category: 'Decorations', amount: 28 }, { category: 'Party favors', amount: 36 }], total: 999 },
    backupPlan: 'If clay runs long, skip charades and go straight to food.',
    assumptions: ['Party length assumed to be 2 hours.', 'Please check allergies and dietary needs with each family.'],
    followUpQuestions: ['Will the kids need aprons, or should guests be told to wear old clothes?'],
  },
}
