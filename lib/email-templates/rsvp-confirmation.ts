interface RSVPConfirmationProps {
  guestName: string;
  childName: string;
  partyDate: string;
  partyTime: string;
  partyLocation: string;
  rsvpStatus: 'accepted' | 'declined' | 'maybe';
  hostName: string;
  baseUrl: string;
}

interface RSVPReminderProps {
  guestName: string;
  childName: string;
  childAge: number;
  partyDate: string;
  partyTime: string;
  rsvpUrl: string;
  daysUntilParty: number;
  hostName: string;
  baseUrl: string;
}

export function generateRSVPConfirmationEmail({
  guestName,
  childName,
  partyDate,
  partyTime,
  partyLocation,
  rsvpStatus,
  hostName,
  baseUrl
}: RSVPConfirmationProps) {
  const statusConfig = {
    accepted: {
      emoji: '🎉',
      title: 'RSVP Confirmed - See You There!',
      message: 'Thank you for confirming your attendance! We can\'t wait to celebrate with you.',
      color: '#10b981'
    },
    declined: {
      emoji: '😢',
      title: 'RSVP Received - You\'ll Be Missed!',
      message: 'Thank you for letting us know. We\'ll miss you at the party, but we understand!',
      color: '#f87171'
    },
    maybe: {
      emoji: '🤔',
      title: 'RSVP Received - Hope to See You!',
      message: 'Thank you for your response. We hope you can make it to the celebration!',
      color: '#f59e0b'
    }
  };

  const config = statusConfig[rsvpStatus];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title} - ${childName}'s Birthday Party</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .emoji {
            font-size: 64px;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .content h2 {
            color: #333;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .content p {
            color: #666;
            margin-bottom: 25px;
            font-size: 16px;
        }
        .party-summary {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            border-left: 4px solid ${config.color};
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">${config.emoji}</div>
            <h1>${config.title}</h1>
        </div>
        
        <div class="content">
            <h2>Hi ${guestName}!</h2>
            <p>${config.message}</p>
            
            <div class="party-summary">
                <h3>Party Details:</h3>
                <p><strong>🎂 ${childName}'s Birthday Party</strong></p>
                <p>📅 ${partyDate}</p>
                <p>⏰ ${partyTime}</p>
                <p>📍 ${partyLocation}</p>
                <p><strong>Your RSVP:</strong> ${rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}</p>
            </div>
            
            ${rsvpStatus === 'accepted' ? `
            <p>We're so excited you can join us! If you have any dietary requirements or questions, please contact ${hostName} directly.</p>
            ` : rsvpStatus === 'maybe' ? `
            <p>We hope your schedule clears up and you can join the celebration! Feel free to update your RSVP if your plans change.</p>
            ` : `
            <p>Thank you for letting us know. We hope to celebrate with you at a future party!</p>
            `}
        </div>
        
        <div class="footer">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Making every birthday magical</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
${config.title} - ${childName}'s Birthday Party

Hi ${guestName}!

${config.message}

Party Details:
🎂 ${childName}'s Birthday Party
📅 ${partyDate}
⏰ ${partyTime}
📍 ${partyLocation}

Your RSVP: ${rsvpStatus.charAt(0).toUpperCase() + rsvpStatus.slice(1)}

${rsvpStatus === 'accepted' ? 
  `We're so excited you can join us! If you have any dietary requirements or questions, please contact ${hostName} directly.` :
  rsvpStatus === 'maybe' ?
  `We hope your schedule clears up and you can join the celebration! Feel free to update your RSVP if your plans change.` :
  `Thank you for letting us know. We hope to celebrate with you at a future party!`
}

Best regards,
${hostName}

---
Powered by Magical Birthday Planner
`;

  return { html, text };
}

export function generateRSVPReminderEmail({
  guestName,
  childName,
  childAge,
  partyDate,
  partyTime,
  rsvpUrl,
  daysUntilParty,
  hostName,
  baseUrl
}: RSVPReminderProps) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RSVP Reminder - ${childName}'s Birthday Party</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-top: 40px;
            margin-bottom: 40px;
        }
        .header {
            background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
            padding: 40px 30px;
            text-align: center;
            color: #8b4513;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: bold;
        }
        .emoji {
            font-size: 64px;
            margin-bottom: 15px;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .rsvp-button {
            display: inline-block;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            text-decoration: none;
            padding: 18px 45px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 18px;
            margin: 20px 0;
            transition: transform 0.2s ease;
        }
        .rsvp-button:hover {
            transform: translateY(-2px);
        }
        .urgency-note {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            font-size: 16px;
            color: #856404;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="emoji">⏰</div>
            <h1>RSVP Reminder</h1>
        </div>
        
        <div class="content">
            <h2>Hi ${guestName}!</h2>
            <p>Just a friendly reminder that we haven't heard back from you yet about ${childName}'s ${childAge}${getOrdinalSuffix(childAge)} birthday party.</p>
            
            ${daysUntilParty <= 3 ? `
            <div class="urgency-note">
                <strong>⚡ Party is ${daysUntilParty} day${daysUntilParty !== 1 ? 's' : ''} away!</strong><br>
                Please RSVP soon so we can plan accordingly.
            </div>
            ` : `
            <p>The party is coming up on <strong>${partyDate} at ${partyTime}</strong>. We'd love to know if you can join us!</p>
            `}
            
            <a href="${rsvpUrl}" class="rsvp-button">RSVP Now</a>
            
            <p style="font-size: 14px; color: #666;">
                It only takes a moment to let us know if you can make it!
            </p>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; text-align: center; color: #666; font-size: 14px;">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Making birthday celebrations stress-free</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
RSVP Reminder - ${childName}'s Birthday Party

Hi ${guestName}!

Just a friendly reminder that we haven't heard back from you yet about ${childName}'s ${childAge}${getOrdinalSuffix(childAge)} birthday party.

${daysUntilParty <= 3 ? 
  `⚡ Party is ${daysUntilParty} day${daysUntilParty !== 1 ? 's' : ''} away! Please RSVP soon so we can plan accordingly.` :
  `The party is coming up on ${partyDate} at ${partyTime}. We'd love to know if you can join us!`
}

Please RSVP: ${rsvpUrl}

It only takes a moment to let us know if you can make it!

Best regards,
${hostName}

---
Powered by Magical Birthday Planner
`;

  return { html, text };
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}