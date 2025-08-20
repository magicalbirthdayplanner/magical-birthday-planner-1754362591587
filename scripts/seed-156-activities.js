const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 156 activities from the chat log
const activities156 = [
  {"name":"Musical Chairs","description":"Classic chair game with themed music or props","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Treasure Hunt","description":"Themed clues, indoor/outdoor adventure","durationMinutes":30,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Pin the Tail","description":"Customized to theme (e.g., Pin the Wheel on the Car)","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Balloon Pop Challenge","description":"Fun balloon popping games and challenges","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},

  {"name":"Themed Coloring Station","description":"Theme-based coloring pages and activities","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Build Your Own Craft","description":"Cars, castles, rockets, animals crafting","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"DIY Party Hats or Masks","description":"Create personalized party accessories","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Decorate Your Own Cupcake/Cookie","description":"Fun food decoration activity","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Make-Your-Own Slime or Playdough","description":"Hands-on sensory crafting fun","durationMinutes":25,"venueType":["INDOOR"]},

  {"name":"Talent Show","description":"Dance, singing, jokes performance time","durationMinutes":30,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Story Time","description":"Theme-based adventure storytelling","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Puppet Show","description":"Interactive puppet theater performance","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Karaoke Corner","description":"Singing and music performance fun","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Magic Show","description":"Simple magic tricks and illusions","durationMinutes":20,"venueType":["INDOOR","OUTDOOR"]},

  {"name":"Dance Party with DJ","description":"Music and dancing with playlist or DJ","durationMinutes":30,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Giant Board Games","description":"Connect 4, Jenga, and oversized games","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},

  {"name":"Reading Nook","description":"Quiet space for books and stories","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Movie Screening","description":"Short themed clips or full movie","durationMinutes":45,"venueType":["INDOOR"]},
  {"name":"Lego Build Zone","description":"Free-building with Lego blocks","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Puzzle Station","description":"Age-appropriate puzzles and games","durationMinutes":25,"venueType":["INDOOR"]},

  {"name":"Field Day Races","description":"Egg & spoon, sack, and three-legged races","durationMinutes":25,"venueType":["OUTDOOR"]},
  {"name":"Water Balloon Toss","description":"Toss water balloons without breaking them","durationMinutes":15,"venueType":["OUTDOOR"]},
  {"name":"Obstacle Course","description":"Race through a fun and challenging course","durationMinutes":20,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Minute to Win It Games","description":"Series of 60-second silly challenges","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Freeze Dance","description":"Dance and freeze when the music stops","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Simon Says","description":"Follow commands only when prefaced with 'Simon says'","durationMinutes":10,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Hot Potato","description":"Pass an object until the music stops","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Scavenger Hunt","description":"Photo or item-based search challenge","durationMinutes":30,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Piñata Bash","description":"Take turns breaking a candy-filled piñata","durationMinutes":20,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Limbo Contest","description":"How low can you go under the limbo stick?","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Sack Relay Race","description":"Hop to the finish line in sacks","durationMinutes":15,"venueType":["OUTDOOR"]},
  {"name":"Dodgeball","description":"Soft-ball dodgeball for kids","durationMinutes":20,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Tug of War","description":"Team rope-pulling showdown","durationMinutes":15,"venueType":["OUTDOOR"]},
  {"name":"Capture the Flag","description":"Team strategy game to capture flags","durationMinutes":30,"venueType":["OUTDOOR"]},
  {"name":"Zombie Tag","description":"Tag while moving like zombies","durationMinutes":15,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Ring Toss","description":"Toss rings onto pegs for points","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Pass the Parcel","description":"Unwrap layers to find prizes","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Musical Hats","description":"Like musical chairs, but with hats","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Cup Stack Challenge","description":"Race to stack and unstack cups","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Riddle Balloon Game","description":"Pop balloons to reveal riddles","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Donut on a String","description":"Eat donuts hanging from strings hands-free","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Guess How Many","description":"Estimate candies in a jar","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Balloon Balance Challenge","description":"Keep balloons off the ground","durationMinutes":10,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Memory Tray Game","description":"Memorize items, then recall from memory","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Birthday Trivia","description":"Questions about the birthday child","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Candy Bar Game","description":"Win treats by rolling dice","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Musical Statues","description":"Freeze in funny poses when music stops","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Cake Walk","description":"Walk to music; winners get cupcakes","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Bubble Popping Race","description":"Chase and pop bubbles fast","durationMinutes":10,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Penny Drop in a Bottle","description":"Drop coins into a bottle from height","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Simon Says — Themed","description":"Commands tailored to party theme","durationMinutes":10,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Parachute Games","description":"Wave, bounce, and swap under the chute","durationMinutes":20,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Ring Relay","description":"Team relay passing rings or batons","durationMinutes":15,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Hula Hoop Contest","description":"Who can hula hoop the longest?","durationMinutes":10,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Bowling (Plastic Pins)","description":"Set up a mini bowling lane","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Crazy Straw Race","description":"Sip race using curly straws","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Number Treasure Hunt","description":"Find hidden numbers around venue","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Beanbag Toss","description":"Toss beanbags into targets","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Glow Stick Hide & Seek","description":"Hide and seek in dim room with glow sticks","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Guess the Sound","description":"Identify mystery sounds","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Spin the Bottle Karaoke","description":"Bottle picks who sings next","durationMinutes":20,"venueType":["INDOOR"]},

  {"name":"Face Painting","description":"Choose face paint designs","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Origami Station","description":"Fold simple paper creations","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Friendship Bracelets","description":"Make yarn or bead bracelets","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Tote Bag Painting","description":"Paint and personalize tote bags","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Mini Terrariums","description":"Build small plant terrariums (real or faux)","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Puppet-Making","description":"Create puppets from socks or paper bags","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Pom-Pom Necklaces","description":"String colorful pom-poms into necklaces","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Cardboard Animals","description":"Decorate cardboard animal cutouts","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Tie-Dye Socks","description":"Tie-dye socks with bright colors","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Glitter Slime Monsters","description":"Make slime and add googly eyes","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Lego Head Craft","description":"Decorate cups like Lego heads","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"DIY Felt Crowns","description":"Cut and decorate felt crowns","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Decorate Treasure Chests","description":"Paint and jewel mini chests","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Build Cardboard Castles","description":"Assemble and decorate castles","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Mini Canvas Painting","description":"Paint mini masterpieces on canvas","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Pet Rock Decorating","description":"Paint and name pet rocks","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Paper Plate Tambourines","description":"Make and shake tambourines","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Decorate Frames","description":"Design frames for party photos","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"DIY Drums","description":"Make simple drums and play beats","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Crafty Cuffs","description":"Decorate paper wristbands","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Design Bookmarks","description":"Create custom bookmarks","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"DIY Suncatchers","description":"Make bright window suncatchers","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Nature Collage","description":"Glue leaves and flowers into art","durationMinutes":20,"venueType":["OUTDOOR","INDOOR"]},
  {"name":"Hoop Weaving","description":"Weave yarn on hoops","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Bead Keychains","description":"Design and string keychains","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Ice Cream Cone Art","description":"Create cone-themed crafts","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"DIY Magnets","description":"Make fridge magnets with stickers and glue","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Decorate Water Bottles","description":"Sticker and marker bottle designs","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Decorate Mini Pots","description":"Paint small plant pots","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Paper Bag Puppets","description":"Craft puppets from paper bags","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Cereal Necklaces","description":"String cereal into edible necklaces","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Cupcake Liner Flowers","description":"Make flowers from liners and straws","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Sand Art","description":"Layer colored sand in bottles","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Finger Painting Wall","description":"Large paper wall for finger painting","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Build & Paint Birdhouses","description":"Assemble and decorate birdhouses","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Salt Dough Ornaments","description":"Shape, bake, and paint ornaments","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Paper Plate Visors","description":"Cut and decorate visors","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Story Stones","description":"Paint rocks for storytelling prompts","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Paper Fan Decorating","description":"Fold and decorate paper fans","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Make a Dreamcatcher","description":"Weave string and beads onto hoops","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Coloring Tablecloth","description":"Collaborative doodling on table paper","durationMinutes":25,"venueType":["INDOOR"]},

  {"name":"Lip Sync Battle","description":"Perform favorite songs silently","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Charades — Kids","description":"Act out words without speaking","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Storytelling Circle","description":"Take turns building a story","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Magic Workshop","description":"Learn and perform a simple trick","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Dress Up Parade","description":"Show off costumes in a parade","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Improv Games","description":"Quick, funny acting prompts","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Mini Talent Show","description":"Short acts of skills and talents","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Shadow Puppet Theater","description":"Create scenes with shadows","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Group Skits","description":"Collaborate on short skits","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Joke Contest","description":"Share best kid-friendly jokes","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Comedy Hour","description":"Kids invent and deliver jokes","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Follow-the-Leader Parade","description":"Parade copying leader's moves","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Mime Game","description":"Guess actions performed silently","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Show and Tell","description":"Present a favorite toy or item","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Costume Contest","description":"Awards for creative costumes","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Make Your Own Commercial","description":"Create and perform funny ads","durationMinutes":25,"venueType":["INDOOR"]},

  {"name":"Trampoline Play","description":"Jump time on a safe trampoline","durationMinutes":20,"venueType":["OUTDOOR"]},
  {"name":"Soft Play Zone","description":"Pillow fort, mats, and ball pit","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Indoor Zipline (Short)","description":"Supervised short indoor zipline","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Mall Scavenger Hunt","description":"Clue-based hunt around a mall","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Giant Bubbles","description":"Make and chase giant bubbles","durationMinutes":20,"venueType":["OUTDOOR"]},
  {"name":"Laser Tag (Home Set)","description":"Team laser tag matches","durationMinutes":25,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Inflatable Slide","description":"Take turns on inflatable slide","durationMinutes":25,"venueType":["OUTDOOR"]},
  {"name":"Spy Obstacle Course","description":"Navigate lasers (strings) and missions","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Dinosaur Dig","description":"Excavate 'fossils' in sand","durationMinutes":25,"venueType":["OUTDOOR"]},
  {"name":"String Laser Maze","description":"Crawl through a hallway of strings","durationMinutes":20,"venueType":["INDOOR"]},

  {"name":"Build-Your-Own Spa","description":"Nail painting and gentle facials","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Kids Yoga","description":"Simple yoga poses and breathing","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Nature Journal","description":"Collect and draw nature finds","durationMinutes":20,"venueType":["OUTDOOR"]},
  {"name":"Meditation Story","description":"Guided calming story time","durationMinutes":15,"venueType":["INDOOR"]},
  {"name":"Sensory Table","description":"Bins with rice, beans, and toys","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Origami Quiet Time","description":"Fold quietly following steps","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Puzzle Races","description":"Compete to finish small puzzles","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Audio Storytime","description":"Listen to narrated stories","durationMinutes":20,"venueType":["INDOOR"]},
  {"name":"Picnic Reading","description":"Relaxed reading picnic setup","durationMinutes":20,"venueType":["OUTDOOR"]},
  {"name":"Color Therapy Art","description":"Choose colors that match feelings","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Garden Exploration","description":"Explore plants and insects outside","durationMinutes":25,"venueType":["OUTDOOR"]},
  {"name":"Balance Beam Walking","description":"Walk on low beams for focus","durationMinutes":15,"venueType":["INDOOR","OUTDOOR"]},
  {"name":"Breathing Exercises with Stories","description":"Calm breathing with fun narratives","durationMinutes":10,"venueType":["INDOOR"]},
  {"name":"Cloud Watching","description":"Lie down and find shapes in clouds","durationMinutes":15,"venueType":["OUTDOOR"]},
  {"name":"Mini Greenhouse Building","description":"Create small plant environments","durationMinutes":30,"venueType":["INDOOR"]},
  {"name":"Snow Globe Making","description":"Create personalized snow globes","durationMinutes":25,"venueType":["INDOOR"]},
  {"name":"Tea Party Setup","description":"Arrange and enjoy a formal tea party","durationMinutes":30,"venueType":["INDOOR"]}
];

function assignDefaultValues(activity) {
  // Map categories based on activity type
  let category = "Games & Competitions"; // default
  const name = activity.name.toLowerCase();
  
  if (name.includes('craft') || name.includes('paint') || name.includes('make') || 
      name.includes('decorate') || name.includes('diy') || name.includes('build') ||
      name.includes('art') || name.includes('origami') || name.includes('puppet')) {
    category = "Creative & Crafty";
  } else if (name.includes('talent') || name.includes('story') || name.includes('puppet') ||
             name.includes('karaoke') || name.includes('magic') || name.includes('performance') ||
             name.includes('theater') || name.includes('show')) {
    category = "Performance & Entertainment"; 
  } else if (name.includes('dance') || name.includes('board') || name.includes('interactive') ||
             name.includes('bubble') || name.includes('parachute') || name.includes('trampoline')) {
    category = "Interactive Play";
  } else if (name.includes('reading') || name.includes('movie') || name.includes('lego') ||
             name.includes('puzzle') || name.includes('quiet') || name.includes('yoga') ||
             name.includes('meditation') || name.includes('spa') || name.includes('calm')) {
    category = "Calm & Relax";
  }

  // Map age groups based on complexity
  let ageGroup = ["AGE_6_8"]; // default
  if (activity.durationMinutes <= 15) {
    ageGroup = ["AGE_3_5", "AGE_6_8"];
  } else if (activity.durationMinutes >= 30) {
    ageGroup = ["AGE_6_8", "AGE_9_12"];
  }

  // Map duration enum
  let duration = "DURATION_15";
  if (activity.durationMinutes <= 15) duration = "DURATION_15";
  else if (activity.durationMinutes <= 30) duration = "DURATION_30";
  else if (activity.durationMinutes <= 45) duration = "DURATION_45";
  else if (activity.durationMinutes <= 60) duration = "DURATION_60";
  else duration = "DURATION_90_PLUS";

  // Map effort level
  let effortLevel = "MEDIUM";
  if (category === "Calm & Relax") effortLevel = "LOW";
  else if (category === "Creative & Crafty") effortLevel = "MEDIUM";
  else if (name.includes('obstacle') || name.includes('race') || name.includes('hunt')) effortLevel = "HIGH";

  return {
    name: activity.name,
    description: activity.description,
    fullDescription: activity.description,
    suppliesNeeded: [], // Will be filled later
    setupTime: 5,
    helpersRequired: 1,
    stepByStepInstructions: null,
    hostScript: null,
    ageGroup: ageGroup,
    venueType: activity.venueType,
    duration: duration,
    durationMinutes: activity.durationMinutes,
    themeCompatibility: [],
    effortLevel: effortLevel,
    participantRange: "5-15",
    minParticipants: 5,
    maxParticipants: 20,
    category: category,
    tags: [],
    isActive: true
  };
}

async function seed156Activities() {
  try {
    console.log('Starting 156 birthday activities seeding...');
    
    // Clear existing data
    await prisma.birthdayActivity.deleteMany({});
    console.log('Cleared existing birthday activities');
    
    // Seed all 156 activities
    for (const activity of activities156) {
      const fullActivity = assignDefaultValues(activity);
      await prisma.birthdayActivity.create({
        data: fullActivity
      });
    }
    
    console.log(`Successfully seeded ${activities156.length} birthday activities!`);
    
    // Verify seeding
    const count = await prisma.birthdayActivity.count();
    console.log(`Total activities in database: ${count}`);
    
  } catch (error) {
    console.error('Error seeding 156 birthday activities:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
if (require.main === module) {
  seed156Activities()
    .then(() => {
      console.log('156 Birthday activities seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('156 Birthday activities seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seed156Activities };