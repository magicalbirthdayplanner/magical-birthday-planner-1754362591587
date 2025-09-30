#!/bin/bash

# Auto-push script for magical-birthday-planner
# This script automatically commits and pushes changes to GitHub

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Auto-push script starting...${NC}"

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo -e "${RED}❌ Error: Not in a git repository${NC}"
    exit 1
fi

# Check if there are any changes (including untracked files)
if git diff-index --quiet HEAD -- && [ -z "$(git ls-files --others --exclude-standard)" ]; then
    echo -e "${YELLOW}ℹ️  No changes to commit${NC}"
    exit 0
fi

# Get current timestamp for commit message
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Get a brief description of changes (including untracked files)
CHANGED_FILES=$(git diff --name-only; git ls-files --others --exclude-standard | head -5 | tr '\n' ', ' | sed 's/,$//')

# Create commit message
if [ -z "$1" ]; then
    COMMIT_MSG="Auto-fix: ${TIMESTAMP} - Updated: ${CHANGED_FILES}"
else
    COMMIT_MSG="$1 - ${TIMESTAMP}"
fi

echo -e "${YELLOW}📝 Staging changes...${NC}"
git add .

echo -e "${YELLOW}💾 Committing changes...${NC}"
git commit -m "${COMMIT_MSG}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Commit successful${NC}"
else
    echo -e "${RED}❌ Commit failed${NC}"
    exit 1
fi

echo -e "${YELLOW}🌐 Pushing to GitHub...${NC}"
# Get current branch name
CURRENT_BRANCH=$(git branch --show-current)
git push origin $CURRENT_BRANCH

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Push successful - Changes deployed to production${NC}"
    echo -e "${GREEN}🎉 Auto-push completed successfully!${NC}"
else
    echo -e "${RED}❌ Push failed${NC}"
    exit 1
fi