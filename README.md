# 🎉 Party Planner - AI-Powered Kids Birthday Planner

A modern, responsive web application designed to help parents plan magical birthday parties for children aged 0-12. Built with Next.js 14, React, TypeScript, and Tailwind CSS with beautiful gradient themes and minimalistic design.

## ✨ Features

### Current MVP Features
- **🏠 Beautiful Landing Page**: Stunning gradient themes with bright colors targeting parents
- **🌓 Light/Dark Theme Toggle**: Elegant theme switcher with automatic system preference detection
- **🧭 Navigation Header**: Fixed header with home link (left) and theme switcher (right)
- **🎨 8 Trending Themes**: Superhero, Princess, Dinosaur, Space, Safari, Ocean, Pirate, and Unicorn
- **🧙‍♂️ Enhanced Party Creation Wizard**: 3-step process to create personalized party plans
  - Child information (name, age, interests & favorite colors collection)
  - Party date selection with calendar picker
  - AI-powered theme selection with personalized recommendations
- **🤖 Revolutionary AI Theme Recommendations**: Advanced GPT-4o powered suggestion engine
  - Real-time personalized theme generation based on child's profile
  - 20+ interest categories and 8 favorite color options for precise personalization
  - Custom-generated themes with unique names, descriptions, and inspiration boards
  - Intelligent match scoring and personalized explanations
  - Beautiful loading states and seamless fallback to classic themes
- **🎯 Theme Inspiration Boards**: Detailed decorations, activities, and food suggestions with mini previews
- **📋 Smart Checklists**: Comprehensive task lists organized by timeline
- **📊 Progress Tracking**: Visual progress indicators for party planning
- **👥 Guest List & RSVP Management**: Complete guest management system
  - Add, edit, and delete guests (adults and children)
  - Guest contact information (email, phone)
  - Guest type classification and age tracking
  - Guest notes and special requirements
- **📧 Bulk Invitation System**: Send customizable invitations to multiple guests
  - 4 professional invitation templates (Magical, Fun & Playful, Elegant, Superhero)
  - Dynamic content personalization with guest names and party details
  - Custom message support for personal touches
  - Template preview and copy functionality
- **📊 RSVP Tracking Dashboard**: Monitor and manage party responses
  - Real-time RSVP status tracking (Accepted, Declined, Maybe, Pending)
  - Response rate analytics and statistics
  - Guest filtering and search functionality
  - Reminder system for non-responsive guests
  - Export functionality for guest reports
- **📱 Responsive Design**: Mobile-first approach with seamless experience across devices

### Recently Added Features
- **🤖 AI-Powered Theme Recommendations**: Revolutionary personalized theme suggestion system
  - OpenAI GPT-4o integration for intelligent theme generation
  - Personalized recommendations based on child's age, interests, and favorite colors
  - 3-5 custom AI-generated themes with detailed inspiration boards
  - Match scoring system showing compatibility percentage
  - Personalized explanations for each theme recommendation
  - Dynamic color palettes, decorations, activities, and printable ideas
  - Fallback system ensures functionality without API key
  - Monthly trending data integration for current party trends
- **🔐 User Authentication**: Complete sign-up/login system with Supabase Auth
  - Secure user registration and authentication
  - Session management with automatic login persistence
  - Protected routes and user account management
- **📊 Party Dashboard**: Comprehensive party management interface
  - View all upcoming and completed parties
  - Party statistics and progress tracking
  - Quick access to continue planning
  - Real-time guest count and task completion metrics

### Planned Features
- **🔔 Smart Reminders**: Automated timeline notifications
- **📱 Mobile App**: React Native implementation for iOS and Android
- **💰 Budget Tracking**: Party expense management and cost estimates
- **📷 Photo Sharing**: Party photo gallery and memory collection
- **🏪 Vendor Recommendations**: Local party suppliers and service providers

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Database**: Prisma ORM + Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **AI Integration**: OpenAI GPT-4o for personalized theme recommendations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open in browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 📱 Current Pages

### 1. Landing Page (`/`)
- Hero section with gradient themes and authentication CTAs
- Popular themes preview (6 themes displayed)
- Feature highlights (AI suggestions, checklists, guest management, reminders)
- How it works (3-step process)
- Sign-up and sign-in links integrated throughout

### 2. Authentication Pages
- **Sign Up (`/signup`)**: User registration with email, password, and optional display name
- **Sign In (`/signin`)**: User login with email and password
- Beautiful gradient designs matching the app theme
- Form validation and error handling
- Automatic redirect to dashboard after authentication

### 3. Dashboard (`/dashboard`)
- **Protected Route**: Requires user authentication
- Welcome message with personalized greeting
- Party statistics overview (active parties, total guests, task completion)
- **Upcoming Parties Tab**: View all planned parties with progress tracking
- **Completed Parties Tab**: Archive of finished celebrations
- Party cards showing theme, date, guest count, and planning progress
- Quick access to continue planning or create new parties

### 4. Enhanced Party Creation Wizard (`/create-party`)
- **Step 1**: Child information input (name, age selection, interests collection)
- **Step 2**: Party date picker with calendar
- **Step 3**: AI-powered theme selection with personalized recommendations
- Interactive interests selection with 14 categories
- Smart AI recommendations based on age and interests
- Inspiration board previews for each theme
- Progress indicators and navigation
- Form validation and local storage persistence

### 5. Party Plan Results (`/party-plan`)
- **Overview Tab**: Theme details, party information, guest statistics, quick actions
- **Checklist Tab**: Timeline-based task management (15 pre-loaded tasks)
- **Guests Tab**: Complete guest management interface
  - Add, edit, delete guests with contact information
  - Guest type classification (Adult/Child) with age tracking
  - Individual invitation sending with custom messages
  - Guest notes and special requirements tracking
- **Invitations Tab**: Bulk invitation and RSVP management
  - **Bulk Invitations**: Send customized invitations to selected guests
    - 4 professional templates with dynamic personalization
    - Template preview and customization options
    - Batch selection and sending capabilities
  - **RSVP Tracking**: Comprehensive response monitoring
    - Real-time status updates and statistics
    - Guest filtering and search functionality
    - Response rate analytics and progress tracking
    - Reminder system and guest communication tools
- **Theme Board Tab**: Inspiration with decorations, activities, and food suggestions
- **Timeline Tab**: Visual progress tracking by timeline phases
- Interactive features with progress tracking and data persistence

## 🎨 Design System

### Color Palette
- **Primary Gradients**: Purple to Pink, Pink to Yellow, Red to Blue
- **Background**: Soft gradients (purple-50, pink-50, yellow-50)
- **Accents**: Bright, kid-friendly colors per theme

### Theme Colors
- **Superhero**: Red to Blue gradient
- **Princess**: Pink to Purple gradient  
- **Dinosaur**: Green to Emerald gradient
- **Space**: Purple to Indigo gradient
- **Safari**: Yellow to Orange gradient
- **Ocean**: Blue to Cyan gradient
- **Pirate**: Amber to Red gradient
- **Unicorn**: Pink to Violet gradient

## 📊 Current State

### ✅ Completed Features
- Modern, responsive landing page with gradient themes
- Light/dark theme toggle with system preference detection and local storage persistence
- Fixed navigation header with home link (left) and theme switcher (right)
- Enhanced 3-step party creation wizard with AI recommendations
- Interactive interests collection system (14 interest categories)
- Smart AI theme recommendation engine based on age and interests
- 8 themed party options with detailed inspiration boards and mini previews
- Comprehensive checklist system (15 tasks across 5 timeline phases)
- Progress tracking and timeline visualization
- **Complete Guest List & RSVP Management System**:
  - Full guest management (add, edit, delete) with contact information
  - Guest categorization (Adult/Child) with age tracking and notes
  - Bulk invitation system with 4 professional customizable templates
  - Real-time RSVP tracking with status management (Accepted, Declined, Maybe, Pending)
  - Advanced analytics dashboard with response rate tracking
  - Guest filtering, search, and reminder functionality
  - Export capabilities for guest reports and party planning
- **User Authentication & Dashboard System**:
  - Secure sign-up and sign-in with Supabase Auth
  - Session management with automatic authentication state
  - Protected routing for authenticated users
  - Personalized party dashboard with all upcoming parties
  - Party statistics and progress tracking
  - Navigation integration with user account management
- Database integration with Supabase PostgreSQL and Prisma ORM
- Row Level Security (RLS) policies for data protection
- Mobile-responsive design across all components
- Build optimization and error-free compilation

### 🔄 Ready for Enhancement
- **Production Migration**: Guest management currently uses localStorage for immediate functionality
  - Ready to migrate to full database-backed storage for multi-user functionality
  - All CRUD operations and business logic already implemented
- **Multi-Party Management**: Database schema supports multiple parties per user
  - Ready to extend dashboard for managing multiple parties simultaneously
  - Party creation wizard can be enhanced for database persistence
- **AI Features**: Architecture ready for enhanced AI suggestion integration
  - API integration for more sophisticated theme recommendations
  - Personalized suggestions based on user history and preferences

## 🗂️ Project Structure

```
app/
├── create-party/          # Party creation wizard
├── party-plan/            # Party plan results and management
├── page.tsx              # Landing page
└── layout.tsx            # Root layout

components/
├── ui/                   # shadcn/ui components (40+ components)
├── auth/                 # Authentication components
│   ├── SignUp.tsx        # User registration form
│   └── SignIn.tsx        # User login form
├── dashboard/            # Dashboard components
│   ├── Dashboard.tsx     # Main dashboard interface
│   └── PartyCard.tsx     # Party card component
├── GuestList.tsx         # Guest management interface
├── BulkInvitations.tsx   # Bulk invitation system
├── RSVPTracker.tsx       # RSVP tracking dashboard
├── Header.tsx            # Navigation header with auth
└── ThemeSwitcher.tsx     # Theme toggle component

contexts/
├── ThemeContext.tsx      # Theme management context
└── AuthContext.tsx       # Authentication context

lib/
├── env-config.ts         # Environment configuration
├── supabase.ts          # Supabase client configuration
└── utils.ts             # Utility functions

prisma/
└── schema.prisma         # Database schema with guest management models
```

## 🔧 Environment Setup

The app is configured to work with Supabase for database/authentication and OpenAI for AI-powered features:

### Required for Database & Authentication:
1. Create a Supabase project
2. Add Supabase environment variables to `.env`:
   ```env
   DATABASE_URL="postgresql://..."
   NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="xxx"
   ```
3. Run database migrations: `npx prisma migrate dev`

### Optional for AI Theme Recommendations:
1. Create an OpenAI account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key from the API Keys section
3. Add OpenAI environment variable to `.env`:
   ```env
   OPENAI_API_KEY="sk-..."
   ```
4. The app works perfectly without this - it will use high-quality fallback themes

**Note**: AI features enhance the experience but aren't required. The app provides excellent theme recommendations even without an OpenAI API key.

## 🎯 Target Audience

**Primary Users**: Parents of children aged 0-12
**Use Cases**: 
- Busy parents seeking stress-free party planning
- Parents wanting age-appropriate party ideas
- Users who appreciate beautiful, intuitive design
- Families looking for comprehensive party organization tools

## 🔮 Next Steps

1. **User Authentication**: Implement Supabase auth for user accounts
2. **Database Integration**: Migrate from localStorage to Supabase database
3. **Guest Management**: Add RSVP and invitation features
4. **AI Integration**: Add personalized suggestion engine
5. **Mobile App**: Consider React Native implementation
6. **Advanced Features**: Photo sharing, budget tracking, vendor recommendations

## 📄 License

This project is private and proprietary.

---

Built with ❤️ for creating magical childhood memories