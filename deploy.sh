#!/bin/bash

# Navigate to the project root directory
cd /home/tiger/projects/linkedin_autopost/github_team_implementation/linkedin-autopost

# Stash any local changes
git stash

# Pull the latest changes from the main branch
git pull origin main


cd server

# Install dependencies
npm install

# Restart the application (assuming you use PM2)
pm2 restart all