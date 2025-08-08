interface WelcomeEmailProps {
  name: string;
  baseUrl: string;
}

export function generateWelcomeEmail({ name, baseUrl }: WelcomeEmailProps) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Magical Birthday Planner!</title>
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
            background: linear-gradient(135deg, #ff9a9e 0%, #fecfef 0%, #fecfef 100%);
            padding: 50px 30px;
            text-align: center;
            color: white;
            position: relative;
        }
        .header::before {
            content: '🎉🎂🎈🎁🎊';
            position: absolute;
            top: 10px;
            left: 0;
            right: 0;
            font-size: 20px;
            opacity: 0.3;
            letter-spacing: 30px;
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
            font-size: 72px;
            margin-bottom: 20px;
            text-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .content {
            padding: 50px 30px;
            text-align: center;
        }
        .content h2 {
            color: #333;
            margin-bottom: 25px;
            font-size: 26px;
        }
        .content p {
            color: #666;
            margin-bottom: 25px;
            font-size: 16px;
        }
        .features-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 25px;
            margin: 40px 0;
        }
        .feature-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            transition: transform 0.2s ease;
        }
        .feature-card:hover {
            transform: translateY(-5px);
        }
        .feature-emoji {
            font-size: 36px;
            margin-bottom: 15px;
        }
        .feature-title {
            font-weight: bold;
            color: #333;
            margin-bottom: 10px;
            font-size: 16px;
        }
        .feature-desc {
            color: #666;
            font-size: 14px;
            line-height: 1.5;
        }
        .cta-section {
            margin: 40px 0;
            padding: 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 15px;
            color: white;
        }
        .cta-button {
            display: inline-block;
            background: white;
            color: #667eea;
            text-decoration: none;
            padding: 15px 35px;
            border-radius: 50px;
            font-weight: bold;
            font-size: 16px;
            margin: 15px 10px;
            transition: transform 0.2s ease;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .cta-button:hover {
            transform: translateY(-2px);
        }
        .tips-section {
            background: #f8f9fa;
            border-radius: 15px;
            padding: 30px;
            margin: 30px 0;
            text-align: left;
        }
        .tips-section h3 {
            color: #333;
            text-align: center;
            margin-bottom: 25px;
        }
        .tips-section ul {
            color: #666;
            padding-left: 25px;
        }
        .tips-section li {
            margin-bottom: 10px;
            line-height: 1.6;
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
            .features-grid {
                grid-template-columns: 1fr;
                gap: 15px;
            }
            .cta-button {
                display: block;
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <div class="emoji">🎉</div>
                <h1>Welcome to the Magic!</h1>
                <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.9;">
                    Let's create unforgettable birthday celebrations together
                </p>
            </div>
        </div>
        
        <div class="content">
            <h2>Hello ${name}!</h2>
            <p>Welcome to <strong>Magical Birthday Planner</strong> – where every birthday becomes an extraordinary celebration! 🎈</p>
            <p>You're now part of a community of parents who believe that every child deserves a magical birthday experience. We're here to make planning stress-free and fun!</p>
            
            <div class="features-grid">
                <div class="feature-card">
                    <div class="feature-emoji">🤖</div>
                    <div class="feature-title">AI-Powered Themes</div>
                    <div class="feature-desc">Get personalized party theme recommendations based on your child's interests and age</div>
                </div>
                <div class="feature-card">
                    <div class="feature-emoji">👥</div>
                    <div class="feature-title">Guest Management</div>
                    <div class="feature-desc">Easily manage invitations, track RSVPs, and communicate with guests</div>
                </div>
                <div class="feature-card">
                    <div class="feature-emoji">🛍️</div>
                    <div class="feature-title">Shopping Suite</div>
                    <div class="feature-desc">Find everything you need with our comprehensive party shopping platform</div>
                </div>
                <div class="feature-card">
                    <div class="feature-emoji">📋</div>
                    <div class="feature-title">Smart Checklists</div>
                    <div class="feature-desc">Stay organized with timeline-based tasks and progress tracking</div>
                </div>
            </div>
            
            <div class="cta-section">
                <h3 style="margin: 0 0 15px 0; font-size: 22px;">Ready to Plan Your First Magical Party?</h3>
                <p style="margin: 0 0 20px 0; opacity: 0.9;">Let's get started with our easy 3-step party creation wizard!</p>
                <a href="${baseUrl}/create-party" class="cta-button">Create Your First Party</a>
                <a href="${baseUrl}/dashboard" class="cta-button">Visit Your Dashboard</a>
            </div>
            
            <div class="tips-section">
                <h3>💡 Pro Tips for Planning the Perfect Party</h3>
                <ul>
                    <li><strong>Start Early:</strong> Begin planning 3-4 weeks in advance for stress-free preparation</li>
                    <li><strong>Know Your Child:</strong> Use their favorite colors and interests for theme selection</li>
                    <li><strong>Budget Smart:</strong> Set a budget first, then use our shopping tools to stay on track</li>
                    <li><strong>Guest List Magic:</strong> Consider your space and child's comfort with group sizes</li>
                    <li><strong>Capture Memories:</strong> Don't forget to designate someone as the party photographer!</li>
                </ul>
            </div>
            
            <p>Need help getting started? Check out our <a href="${baseUrl}/help">Help Center</a> or simply reply to this email – we're here to help make every birthday magical!</p>
        </div>
        
        <div class="footer">
            <p><strong>Magical Birthday Planner</strong></p>
            <p>Creating magical memories, one party at a time</p>
            <p>Follow us for party inspiration and tips!</p>
            <p style="margin-top: 20px; font-size: 12px; color: #999;">
                Questions? Just reply to this email – we love hearing from you! 💕
            </p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🎉 Welcome to Magical Birthday Planner! 🎉

Hello ${name}!

Welcome to Magical Birthday Planner – where every birthday becomes an extraordinary celebration! 🎈

You're now part of a community of parents who believe that every child deserves a magical birthday experience. We're here to make planning stress-free and fun!

🌟 WHAT YOU CAN DO NOW:

🤖 AI-Powered Themes
Get personalized party theme recommendations based on your child's interests and age

👥 Guest Management  
Easily manage invitations, track RSVPs, and communicate with guests

🛍️ Shopping Suite
Find everything you need with our comprehensive party shopping platform

📋 Smart Checklists
Stay organized with timeline-based tasks and progress tracking

🚀 READY TO GET STARTED?

Create Your First Party: ${baseUrl}/create-party
Visit Your Dashboard: ${baseUrl}/dashboard

💡 PRO TIPS FOR PERFECT PARTIES:

• Start Early: Begin planning 3-4 weeks in advance for stress-free preparation
• Know Your Child: Use their favorite colors and interests for theme selection  
• Budget Smart: Set a budget first, then use our shopping tools to stay on track
• Guest List Magic: Consider your space and child's comfort with group sizes
• Capture Memories: Don't forget to designate someone as the party photographer!

Need help getting started? Check out our Help Center (${baseUrl}/help) or simply reply to this email – we're here to help make every birthday magical!

Best regards,
The Magical Birthday Planner Team

---
Creating magical memories, one party at a time
Questions? Just reply to this email – we love hearing from you! 💕
`;

  return { html, text };
}