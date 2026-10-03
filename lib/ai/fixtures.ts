/**
 * Deterministic fixture output per feature for the mock provider (AI_PROVIDER=mock and all automated tests).
 * party_planner = golden scenario A (7, art + animals, ~12 kids, $250, indoors, October).
 */
export const FIXTURES: Record<string, unknown> = {
  shopping_list: { categories: [{ item: 'Gold paint pens', category: 'activities' }, { item: 'Crowns', category: 'favors' }] },
  timeline: {
    entries: [{ minute: 0, label: 'Guests arrive, crown station' }, { minute: 15, label: 'Royal portrait painting' }, { minute: 50, label: 'Royal court charades' }, { minute: 65, label: 'Pizza and juice' }, { minute: 85, label: 'Cake, candles and Happy Birthday' }, { minute: 100, label: 'Gallery walk and goodbyes' }, { minute: 500, label: 'out of range — dropped' }, { minute: 15, label: 'duplicate minute — dropped' }],
    prepTasks: [{ title: 'Pack crowns, candles and a lighter', daysBeforeParty: 1, notes: '' }, { title: 'Confirm pizza pickup time', daysBeforeParty: 2, notes: '' }],
    assumptions: ['Two-hour party.'],
  },
  invitation: {
    options: [
      { headline: 'You’re invited to a Royal Ball!', message: 'Ava is turning 10 and wants her favourite people at the Little Picasso Art Studio. Come ready to paint, laugh and feast. Please RSVP using the link so we can save you a seat.' },
      { headline: 'Paint, crowns and cake', message: 'Join us to celebrate Ava’s 10th birthday with a royal art party. Smocks are provided — wear clothes that can get a little paint on them. Please RSVP with the link.' },
    ],
  },
  food: {
    menu: { main: [{ name: 'Mini cheese pizzas', qty: '30' }], snacks: [{ name: 'Fruit skewers', qty: '20' }, { name: 'Nut-free trail mix', qty: '2 bowls' }], dessert: [{ name: 'Crown cupcakes', qty: '18' }], drinks: [{ name: 'Water and juice boxes', qty: '24' }] },
    shoppingList: [{ item: 'Mini pizza bases', qty: '30', category: 'food', estimatedCost: 24 }, { item: 'Mozzarella', qty: '2 lb', category: 'food', estimatedCost: 9 }, { item: 'Cupcakes', qty: '18', category: 'food', estimatedCost: 27.5 }, { item: 'Juice boxes', qty: '24', category: 'drinks', estimatedCost: 12 }],
    prepTimeline: [{ when: '2 days before', task: 'Order cupcakes' }, { when: 'Morning of', task: 'Assemble fruit skewers' }],
    tips: ['Label each dish so families can check ingredients.'],
  },
  activities: {
    activities: [
      { name: 'Royal portrait studio', whyItFits: 'Art + the Royal Ball theme for 10-year-olds.', durationMin: 25, estimatedCost: 18, materials: ['Mini canvases', 'Acrylic paints', 'Gold paint pens'], setup: 'Set 15 canvases on covered tables.', instructions: ['Sketch a royal self-portrait', 'Paint the background', 'Add gold details'], cleanup: 'Wet wipes and a drying rack.', ageSuitability: 'Ages 8-12', difficulty: 'medium' },
      { name: 'Crown design challenge', whyItFits: 'Quick, creative and becomes a favor.', durationMin: 15, estimatedCost: 12, materials: ['Paper crowns', 'Gem stickers'], setup: 'One crown per guest.', instructions: ['Decorate', 'Vote on categories'], cleanup: 'Sweep sticker backs.', ageSuitability: 'Ages 5-12', difficulty: 'easy' },
      { name: 'Royal court charades', whyItFits: 'No-cost energy break between crafts.', durationMin: 10, estimatedCost: 0, materials: [], setup: 'Write prompts on cards.', instructions: ['Act it out', 'Teams guess'], cleanup: 'None', ageSuitability: 'Ages 6+', difficulty: 'easy' },
    ],
    assumptions: ['The studio provides tables and smocks.'],
  },
  budget_optimizer: {
    suggestions: [
      { category: 'Food & cake', change: 'Swap catered pizza for homemade mini pizzas', newAmount: 70, reason: 'Kids love assembling their own.' },
      { category: 'Decorations', change: 'Reuse the art supplies as table decor', newAmount: 20, reason: 'Doubles as an activity.' },
    ],
    missingExpenses: [{ category: 'Tableware', amount: 15, note: 'Plates, cups and napkins for 15.' }],
    tradeoffs: ['Homemade food takes about an hour of prep the day before.'],
    assumptions: ['Prices are typical US supermarket estimates.'],
  },
  // golden scenario B: party in 8 days, turns 10, art studio booked, theme "Royal Ball", 15 guests
  checklist: {
    tasks: [
      { title: 'Book a party venue', notes: 'Compare a few places.', daysBeforeParty: 30, priority: 'high', effort: 'big' },
      { title: 'Book entertainment or an activity', notes: 'A magician or craft host.', daysBeforeParty: 21, priority: 'medium', effort: 'medium' },
      { title: 'Order a decorated bakery cake (custom is too late)', notes: 'Custom cakes need 1-2 weeks; most bakeries decorate a stock cake in 2-3 days.', daysBeforeParty: 3, priority: 'high', effort: 'quick' },
      { title: 'Confirm headcount and arrival time with the art studio', notes: 'Studios usually need a final number 3-5 days before.', daysBeforeParty: 5, priority: 'high', effort: 'quick' },
      { title: 'Ask the studio what kids should wear', notes: 'Paint happens — tell families on the invite.', daysBeforeParty: 6, priority: 'medium', effort: 'quick' },
      { title: 'Buy crowns and royal sashes', notes: 'Fits the Royal Ball theme; doubles as favors.', daysBeforeParty: 4, priority: 'medium', effort: 'quick' },
      { title: 'Send custom save-the-dates', notes: 'Normally 4 weeks ahead.', daysBeforeParty: 28, priority: 'low', effort: 'quick' },
      { title: 'Order the cake', notes: 'duplicate of existing', daysBeforeParty: 10, priority: 'high', effort: 'quick' },
    ],
    assumptions: ['The studio provides art supplies and cleanup.'],
  },
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
