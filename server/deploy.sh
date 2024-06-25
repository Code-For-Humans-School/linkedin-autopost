#!/bin/bash

# Navigate to the project directory
cd /home/tiger/projects/linkedin_autopost/github_team_implementation/linkedin-autopost/server

# Pull the latest changes from the main branch
git pull origin main

# Install dependencies
npm install

# Restart the application (assuming you use PM2)
pm2 restart all