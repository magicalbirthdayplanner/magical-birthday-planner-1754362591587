# Project Structure

## Overview
The Magical Birthday Planner has been reorganized for better maintainability and clarity.

## Root Directory
```
magical-birthday-planner/
├── app/                    # Next.js App Router pages and API routes
├── components/             # React components
├── lib/                    # Utility libraries and configurations
├── contexts/               # React context providers
├── hooks/                  # Custom React hooks
├── public/                 # Static assets
├── database/               # Database setup and management
├── docs/                   # Documentation and guides
├── logs/                   # Application log files
├── data/                   # Static data files
├── utils/                  # Utility functions
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tailwind.config.ts      # Tailwind CSS configuration
└── README.md               # Main project documentation
```

## Key Directories

### `/app`
- **Pages**: Main application pages (dashboard, create-party, etc.)
- **API Routes**: Backend API endpoints
- **Layout**: Application layout and navigation

### `/components`
- **UI Components**: Reusable UI components
- **Feature Components**: Feature-specific components
- **Layout Components**: Header, footer, navigation

### `/lib`
- **Supabase Client**: Database connection and utilities
- **Configuration**: Environment and app configuration
- **Utilities**: Helper functions and utilities

### `/database`
- **Setup Scripts**: Database initialization scripts
- **SQL Files**: Database schema definitions
- **Seeding Scripts**: Sample data insertion
- **Testing**: Database connection tests

### `/docs`
- **Setup Guides**: Installation and configuration
- **Feature Docs**: Feature documentation
- **Development Logs**: Development conversation history

## Scripts

### Database Management
```bash
npm run db:setup    # Setup database tables
npm run db:verify   # Test database connection
```

### Development
```bash
npm run dev         # Start development server
npm run build       # Build for production
npm run start       # Start production server
```

## File Organization Principles

1. **Separation of Concerns**: Each directory has a specific purpose
2. **Logical Grouping**: Related files are grouped together
3. **Clear Naming**: Descriptive directory and file names
4. **Minimal Root**: Root directory contains only essential files
5. **Documentation**: Each major directory has a README

## Benefits of New Structure

- ✅ **Cleaner Root Directory**: Easy to find main files
- ✅ **Organized Database Files**: All DB-related files in one place
- ✅ **Centralized Documentation**: Easy to find guides and docs
- ✅ **Better Maintainability**: Clear separation of concerns
- ✅ **Easier Onboarding**: New developers can quickly understand structure
- ✅ **Reduced Clutter**: No more scattered files in root

## Migration Notes

- Database scripts moved from `/scripts` to `/database`
- Documentation moved from root to `/docs`
- Log files moved from root to `/logs`
- Package.json scripts updated to reflect new paths
