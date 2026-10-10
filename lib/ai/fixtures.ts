/**
 * Deterministic fixture output per feature for the mock provider (AI_PROVIDER=mock and all automated tests).
 * party_planner = golden scenario A (7, art + animals, ~12 kids, $250, indoors, October).
 */
export const FIXTURES: Record<string, unknown> = {
  activity_studio: {
    activity: {
      name: 'Cosmic Treasure Hunt', emoji: '🚀', description: 'Crews follow clue cards to find hidden planets and rebuild the solar system.', category: 'treasure_hunt',
      age_min: 6, age_max: 8, duration_minutes: 25, indoor_outdoor: 'indoor', estimated_cost: 12, difficulty: 'easy',
      materials: ['Glow sticks × 15', 'Paper planets × 8', 'Small treasure bags × 15', 'Clue cards × 8'],
      preparation_steps: ['Print the 8 clue cards', 'Hide the paper planets', 'Fill the treasure bags'],
      instructions: ['Split into 3 crews', 'Read clue 1 aloud', 'Each planet hides the next clue', 'Last clue leads to the treasure'],
      host_script: 'Okay astronauts! Mission control has detected eight lost planets. Find them all to save the galaxy!',
      cleanup_level: 'low', safety_notes: ['Keep clues away from stairs'], variations: ['Glow version with lights off'], backup_version: 'Hide planets in one room only.',
    },
    what_changed: '',
  },
  host_content: { title: 'Welcome, astronauts!', body: 'Welcome, astronauts! Today we are going on a mission to celebrate Mia turning 7. Find your crew badge and get ready for lift-off!', messages: [{ guest: 1, body: 'Thank you, Emma, for coming to Mia’s birthday — your rocket was the best!' }] },
  party_experience: {
    summary: 'A cosmic art adventure at home for 15 kids: paint planets, hunt for stars and launch into cake.',
    theme: { name: 'Cosmic Art Adventure', emoji: '🪐', description: 'Paint-your-own planets in a galaxy studio.', palette: ['#1B1F3B', '#6C63FF', '#FFB347'], decorations: ['Star garlands', 'Planet balloons'] },
    activities: [
      { name: 'Design Your Own Planet', emoji: '🎨', description: 'Paint a paper-plate planet.', category: 'craft', age_min: 6, age_max: 8, duration_minutes: 25, indoor_outdoor: 'indoor', estimated_cost: 15, difficulty: 'easy', materials: ['Paper plates × 15', 'Washable paint × 6'], instructions: ['Hand out plates', 'Paint', 'Dry on the rack'], cleanup_level: 'medium' },
      { name: 'Cosmic Treasure Hunt', emoji: '🚀', description: 'Find hidden planets.', category: 'treasure_hunt', age_min: 6, age_max: 8, duration_minutes: 20, indoor_outdoor: 'indoor', estimated_cost: 10, difficulty: 'easy', materials: ['Clue cards × 8'], instructions: ['Read clue 1', 'Search'], cleanup_level: 'low' },
      { name: 'Planet Relay', emoji: '🏃', description: 'Carry a planet on a spoon.', category: 'active', age_min: 6, age_max: 8, duration_minutes: 15, indoor_outdoor: 'either', estimated_cost: 0, difficulty: 'easy', materials: ['Spoons × 4'], instructions: ['Two teams', 'Race'], cleanup_level: 'none' },
    ],
    timeline: [{ minute: 0, label: 'Guests arrive', kind: 'arrival' }, { minute: 15, label: 'Welcome', kind: 'welcome' }, { minute: 20, label: 'Design Your Own Planet', kind: 'activity' }, { minute: 45, label: 'Cosmic Treasure Hunt', kind: 'activity' }, { minute: 70, label: 'Pizza', kind: 'food' }, { minute: 95, label: 'Cake', kind: 'cake' }, { minute: 110, label: 'Goodbye', kind: 'closing' }],
    food: [{ name: 'Cheese pizza', category: 'main', quantity: 4, unit: 'large pizzas', estimated_cost: 48, dietary_tags: ['vegetarian'] }, { name: 'Galaxy cupcakes', category: 'dessert', quantity: 18, unit: 'cupcakes', estimated_cost: 27, dietary_tags: [] }, { name: 'Fruit rockets', category: 'snack', quantity: 15, unit: 'skewers', estimated_cost: 12, dietary_tags: ['vegan'] }],
    shopping: [{ item: 'Paper plates', qty: '15', category: 'activities', estimatedCost: 4 }, { item: 'Washable paint', qty: '6', category: 'activities', estimatedCost: 11 }, { item: 'Star garlands', qty: '3', category: 'decorations', estimatedCost: 9 }],
    host: { welcome: 'Welcome, astronauts! Today we explore the galaxy for Mia’s birthday.', cake: 'Astronauts, gather round — it is time for our birthday celebration!', closing: 'Mission accomplished! Thank you for flying with us today.' },
    checklist: [{ title: 'Order 4 large pizzas for pickup', daysBeforeParty: 1 }, { title: 'Print 8 treasure hunt clues', daysBeforeParty: 2 }],
    budget: [{ category: 'Food', amount: 90 }, { category: 'Activities', amount: 30 }, { category: 'Decorations', amount: 20 }],
    assumptions: ['Two-hour party at home.'],
  },
  discover_explain: { picks: [{ placeId: 'ChIJfixture0000001', reason: 'Hands-on art for a 7-year-old, about $15 per kid.' }, { placeId: 'ChIJinvented999', reason: 'Made up' }] },
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
    items: [
      { name: 'Mini cheese pizzas', category: 'main', quantity: 30, unit: 'mini pizzas', estimated_cost: 24, dietary_tags: ['vegetarian'], notes: '2 per child' },
      { name: 'Fruit skewers', category: 'snack', quantity: 20, unit: 'skewers', estimated_cost: 12, dietary_tags: ['vegan'], notes: '' },
      { name: 'Nut-free trail mix', category: 'snack', quantity: 2, unit: 'bowls', estimated_cost: 8, dietary_tags: ['nut-free'], notes: '' },
      { name: 'Crown cupcakes', category: 'dessert', quantity: 18, unit: 'cupcakes', estimated_cost: 27.5, dietary_tags: [], notes: '' },
      { name: 'Water and juice boxes', category: 'drink', quantity: 24, unit: 'boxes', estimated_cost: 12, dietary_tags: [], notes: '' },
    ],
    shoppingList: [{ item: 'Mini pizza bases', qty: '30', category: 'food', estimatedCost: 24 }, { item: 'Mozzarella', qty: '2 lb', category: 'food', estimatedCost: 9 }, { item: 'Cupcakes', qty: '18', category: 'food', estimatedCost: 27.5 }, { item: 'Juice boxes', qty: '24', category: 'drinks', estimatedCost: 12 }],
    prepTimeline: [{ when: '2 days before', task: 'Order cupcakes' }, { when: 'Morning of', task: 'Assemble fruit skewers' }],
    tips: ['Label each dish so families can check ingredients.'],
  },
  activities: {
    activities: [
      { name: 'Royal portrait studio', description: 'Each guest paints a royal self-portrait on a mini canvas.', setting: 'indoor', whyItFits: 'Art + the Royal Ball theme for 10-year-olds.', durationMin: 25, estimatedCost: 18, materials: ['Mini canvases', 'Acrylic paints', 'Gold paint pens'], setup: 'Set 15 canvases on covered tables.', instructions: ['Sketch a royal self-portrait', 'Paint the background', 'Add gold details'], cleanup: 'Wet wipes and a drying rack.', ageSuitability: 'Ages 8-12', difficulty: 'medium' },
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
      { name: 'Wild Art Safari', emoji: '🦁', description: 'A paint-splattered jungle studio where every guest becomes a wildlife artist.', why: 'Paint and sculpt favourite animals.', palette: ['#F4A259', '#5B8E7D', '#F4E285'], decorations: ['Animal-print table runners', 'Paint-splatter balloons', 'Easel welcome sign'], activities: ['Animal mask painting', 'Clay critters', 'Safari scavenger hunt'], food: ['Paint-palette fruit platter', 'Animal-cracker cupcakes'], invitationIdea: 'A paint-smudged safari ticket: “Join the expedition!”', ageFit: 'Simple crafts a 7-year-old can finish in 20 minutes.' },
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
  // Founder marketing agent (lib/marketing/generate.ts): one valid founder-voice post.
  marketing_post: {
    paragraphs: ['Planning one birthday party should not need a spreadsheet, three group chats and a pile of sticky notes.', 'That mess is the reason I started building this.'],
    hook: 'Planning one birthday party should not need a spreadsheet, three group chats and a pile of sticky notes.',
    topic: 'Why I started building a birthday planner',
    cta: null,
    imageHeadline: 'Fewer tabs, more party',
    imagePrompt: 'A tidy kitchen table with a paper party hat, a cupcake and folded invitations, warm morning light',
    altText: 'A paper party hat, a cupcake and folded invitations on a kitchen table.',
    factsUsed: ['F-origin'],
    angle: 'Relatable origin story for the pre-launch objective.',
  },
}
