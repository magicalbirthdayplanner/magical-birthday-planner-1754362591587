# Auto-Push Scripts

Automated GitHub push scripts for magical-birthday-planner following the user's preference for production testing.

## Quick Commands

### Fastest Way (from project root):
```bash
./push
```

### With custom commit message:
```bash
./push "Fixed user authentication issue"
```

### Using npm scripts:
```bash
npm run push
```

### Using the full script path:
```bash
bash scripts/auto-push.sh "Custom commit message"
```

## What the Script Does

1. ✅ Checks if you're in a git repository
2. ✅ Detects if there are changes to commit
3. ✅ Stages all changes (`git add .`)
4. ✅ Creates an automatic commit with timestamp
5. ✅ Pushes to the current branch (auto-detects master/main)
6. ✅ Provides colored output and progress updates

## Commit Message Format

**Auto-generated:** `Auto-fix: 2025-09-30 00:26:09 - Updated: file1.ts, file2.js`

**Custom message:** `Your custom message - 2025-09-30 00:26:09`

## Error Handling

- ❌ Not in git repo → exits with error
- ❌ No changes → exits gracefully
- ❌ Commit fails → exits with error
- ❌ Push fails → exits with error

## Production Deployment

Changes are automatically deployed to production via Vercel when pushed to GitHub, following the user's preference for production testing.

## Files Created

- `scripts/auto-push.sh` - Main auto-push script
- `quick-push.sh` - Alternative entry point
- `push` - Shortest command option
- Updated `package.json` with npm scripts