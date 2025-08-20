interface InvitationEmailProps {
  guestName: string;
  hostName: string;
  childName: string;
  childAge: number;
  partyTheme: string;
  partyDate: string;
  partyTime: string;
  partyLocation: string;
  rsvpUrl: string;
  personalMessage?: string;
  baseUrl: string;
}

export function generateInvitationEmail({
  guestName,
  hostName,
  childName,
  childAge,
  partyTheme,
  partyDate,
  partyTime,
  partyLocation,
  rsvpUrl,
  personalMessage,
  baseUrl
}: InvitationEmailProps) {
  // Theme-based styling
  const themeColors: Record<string, { primary: string; secondary: string; emoji: string }> = {
    'superhero': { primary: '#ff4757', secondary: '#3742fa', emoji: '🦸' },
    'princess': { primary: '#ff6b9d', secondary: '#c44569', emoji: '👑' },
    'dinosaur': { primary: '#26de81', secondary: '#20bf6b', emoji: '🦕' },
    'space': { primary: '#4834d4', secondary: '#686de0', emoji: '🚀' },
    'safari': { primary: '#fed330', secondary: '#f39801', emoji: '🦁' },
    'ocean': { primary: '#0abde3', secondary: '#006ba6', emoji: '🐠' },
    'pirate': { primary: '#fd9644', secondary: '#e17055', emoji: '🏴‍☠️' },
    'unicorn': { primary: '#fd79a8', secondary: '#fdcb6e', emoji: '🦄' },
  };

  const theme = themeColors[partyTheme.toLowerCase()] || themeColors['superhero'];
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>You're Invited! ${childName}'s ${childAge}th Birthday Party</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
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
            background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
            padding: 40px 30px;
            text-align: center;
            color: white;
            position: relative;
        }
        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="2" fill="rgba(255,255,255,0.1)"/><circle cx="80" cy="30" r="1.5" fill="rgba(255,255,255,0.1)"/><circle cx="40" cy="70" r="1" fill="rgba(255,255,255,0.1)"/><circle cx="90" cy="80" r="2.5" fill="rgba(255,255,255,0.1)"/><circle cx="10" cy="90" r="1.5" fill="rgba(255,255,255,0.1)"/></svg>') repeat;
        }
        .header-content {
            position: relative;
            z-index: 1;
        }
        .header h1 {
            margin: 0;
            font-size: 32px;
            font-weight: bold;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .emoji {
            font-size: 64px;
            margin-bottom: 15px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .invitation-title {
            font-size: 18px;
            margin-top: 10px;
            opacity: 0.9;
        }
        .content {
            padding: 40px 30px;
            text-align: center;
        }
        .greeting {
            font-size: 24px;
            color: #333;
            margin-bottom: 20px;
            font-weight: bold;
        }
        .party-details {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            text-align: left;
        }
        .party-details h3 {
            color: ${theme.primary};
            margin: 0 0 20px 0;
            font-size: 20px;
            text-align: center;
            border-bottom: 2px solid ${theme.primary};
            padding-bottom: 10px;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 15px 0;
            padding: 10px 0;
            border-bottom: 1px solid #dee2e6;
        }
        .detail-row:last-child {
            border-bottom: none;
        }
        .detail-label {
            font-weight: bold;
            color: #495057;
            min-width: 100px;
        }
        .detail-value {
            color: #212529;
            flex: 1;
            text-align: right;
        }
        .personal-message {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
            font-style: italic;
            color: #856404;
            position: relative;
        }
        .personal-message::before {
            content: '"';
            font-size: 48px;
            position: absolute;
            top: -10px;
            left: 15px;
            color: ${theme.primary};
            opacity: 0.3;
        }
        .rsvp-section {
            margin: 40px 0;
        }
        .rsvp-button {
            display: inline-block;
            background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%);
            color: white;
            text-decoration: none;
            padding: 18px 45px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 18px;
            margin: 10px;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .rsvp-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        .footer {
            background: #f8f9fa;
            padding: 30px;
            text-align: center;
            color: #666;
            font-size: 14px;
            border-top: 1px solid #eee;
        }
        .footer p {
            margin: 5px 0;
        }
        @media (max-width: 600px) {
            .container {
                margin: 20px;
                border-radius: 10px;
            }
            .header, .content, .footer {
                padding: 25px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .greeting {
                font-size: 20px;
            }
            .detail-row {
                flex-direction: column;
                align-items: flex-start;
                text-align: left;
            }
            .detail-value {
                text-align: left;
                margin-top: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="emoji">${theme.emoji}</div>
                <h1>You're Invited!</h1>
                <div class="invitation-title">${childName}'s ${childAge}${getOrdinalSuffix(childAge)} Birthday Party</div>
            </div>
        </div>
        
        <div class="content">
            <div class="greeting">Hello ${guestName}!</div>
            
            <p>You're invited to celebrate ${childName}'s special day! Join us for an amazing ${partyTheme} themed birthday party filled with fun, games, and magical memories.</p>
            
            ${personalMessage ? `
            <div class="personal-message">
                ${personalMessage}
                <div style="margin-top: 15px; text-align: right; font-weight: bold;">- ${hostName}</div>
            </div>
            ` : ''}
            
            <div class="party-details">
                <h3>${theme.emoji} Party Details</h3>
                <div class="detail-row">
                    <span class="detail-label">🎂 Celebrating:</span>
                    <span class="detail-value">${childName} (turning ${childAge}!)</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🎨 Theme:</span>
                    <span class="detail-value">${partyTheme} Party</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📅 Date:</span>
                    <span class="detail-value">${partyDate}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">⏰ Time:</span>
                    <span class="detail-value">${partyTime}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">📍 Location:</span>
                    <span class="detail-value">${partyLocation}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">🎉 Host:</span>
                    <span class="detail-value">${hostName}</span>
                </div>
            </div>
            
            <div class="rsvp-section">
                <p>Please let us know if you can make it!</p>
                <a href="${rsvpUrl}" class="rsvp-button">RSVP Now</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 30px;">
                Can't wait to celebrate with you! If you have any questions or dietary requirements, please let us know when you RSVP.
            </p>
        </div>
        
        <div class="footer">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Making birthday wishes come true</p>
            <p>If you have any issues with this invitation, visit <a href="${baseUrl}/help">our help center</a></p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                Can't click the button? Copy this link: <a href="${rsvpUrl}">${rsvpUrl}</a>
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🎉 You're Invited to ${childName}'s ${childAge}${getOrdinalSuffix(childAge)} Birthday Party! 🎉

Hello ${guestName}!

You're invited to celebrate ${childName}'s special day! Join us for an amazing ${partyTheme} themed birthday party filled with fun, games, and magical memories.

${personalMessage ? `Personal Message from ${hostName}: "${personalMessage}"` : ''}

PARTY DETAILS:
🎂 Celebrating: ${childName} (turning ${childAge}!)
🎨 Theme: ${partyTheme} Party
📅 Date: ${partyDate}
⏰ Time: ${partyTime}
📍 Location: ${partyLocation}
🎉 Host: ${hostName}

Please RSVP: ${rsvpUrl}

Can't wait to celebrate with you! If you have any questions or dietary requirements, please let us know when you RSVP.

Best regards,
${hostName}

---
Powered by Magical Birthday Planner
If you can't click the link: ${rsvpUrl}
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