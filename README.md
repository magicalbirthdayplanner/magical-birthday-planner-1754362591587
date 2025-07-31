# 🎉 Party Planner - AI-Powered Kids Birthday Planner

A modern, responsive web application designed to help parents plan magical birthday parties for children aged 0-12. Built with Next.js 14, React, TypeScript, and Tailwind CSS with beautiful gradient themes and minimalistic design.

## ✨ Features

### Current MVP Features
- **🏠 Beautiful Landing Page**: Stunning gradient themes with bright colors targeting parents
- **🌓 Light/Dark Theme Toggle**: Elegant theme switcher with automatic system preference detection
- **🧭 Navigation Header**: Fixed header with home link (left) and theme switcher (right)
- **🎨 8 Trending Themes**: Superhero, Princess, Dinosaur, Space, Safari, Ocean, Pirate, and Unicorn
- **🧙‍♂️ Enhanced Party Creation Wizard**: 3-step process to create personalized party plans
  - Child information (name, age & interests collection)
  - Party date selection
  - AI-powered theme selection with personalized recommendations
- **🤖 AI Theme Recommendations**: Intelligent suggestions based on child's age and interests
- **🎯 Theme Inspiration Boards**: Detailed decorations, activities, and food suggestions with mini previews
- **📋 Smart Checklists**: Comprehensive task lists organized by timeline
- **📊 Progress Tracking**: Visual progress indicators for party planning
- **📱 Responsive Design**: Mobile-first approach with seamless experience across devices

### Planned Features
- **🔐 User Authentication**: Secure sign-up/login with Supabase
- **👥 Guest Management**: Invitation tracking and RSVP management
- **🔔 Smart Reminders**: Automated timeline notifications
- **🤖 AI Suggestions**: Personalized recommendations based on child's age and interests

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **Icons**: Lucide React
- **Database**: Prisma ORM + Supabase PostgreSQL (ready to configure)
- **Authentication**: Supabase Auth (ready to configure)

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
- Hero section with gradient themes
- Popular themes preview (6 themes displayed)
- Feature highlights (AI suggestions, checklists, guest management, reminders)
- How it works (3-step process)
- Call-to-action sections

### 2. Enhanced Party Creation Wizard (`/create-party`)
- **Step 1**: Child information input (name, age selection, interests collection)
- **Step 2**: Party date picker with calendar
- **Step 3**: AI-powered theme selection with personalized recommendations
- Interactive interests selection with 14 categories
- Smart AI recommendations based on age and interests
- Inspiration board previews for each theme
- Progress indicators and navigation
- Form validation and local storage persistence

### 3. Party Plan Results (`/party-plan`)
- **Overview Tab**: Theme details, party information, quick actions
- **Checklist Tab**: Timeline-based task management (15 pre-loaded tasks)
- **Theme Board Tab**: Inspiration with decorations, activities, and food suggestions
- **Timeline Tab**: Visual progress tracking by timeline phases
- Interactive checklist with progress tracking
- Data persistence with local storage

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
- Local storage data persistence
- Mobile-responsive design
- Build optimization and error-free compilation

### 🔄 Ready for Implementation
- **Database Integration**: Prisma schema ready, environment configuration prepared
- **Authentication**: Supabase configuration ready in `lib/env-config.ts`
- **Guest Management**: UI patterns established for future implementation
- **AI Features**: Architecture ready for AI suggestion integration

## 🗂️ Project Structure

```
app/
├── create-party/          # Party creation wizard
├── party-plan/            # Party plan results and management
├── page.tsx              # Landing page
└── layout.tsx            # Root layout

components/ui/            # shadcn/ui components (40+ components)
lib/
├── env-config.ts         # Environment configuration
└── utils.ts             # Utility functions
```

## 🔧 Environment Setup

The app is configured to work with Supabase for future database and authentication features. To enable these features:

1. Create a Supabase project
2. Add environment variables to `.env`:
   ```env
   DATABASE_URL="postgresql://..."
   NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="xxx"
   ```
3. Uncomment Supabase variables in `lib/env-config.ts`
4. Run database migrations: `npx prisma migrate dev`

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