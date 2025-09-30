#!/bin/bash

# Quick push script - one command to push all changes
# Usage: ./quick-push.sh [optional-commit-message]

cd "$(dirname "$0")/.."

if [ -n "$1" ]; then
    ./scripts/auto-push.sh "$1"
else
    ./scripts/auto-push.sh
fi