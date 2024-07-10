const express = require('express');
const axios = require('axios');
const router = express.Router();
require('dotenv').config();


const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_AUTH_CALLBACK_URL = process.env.GITHUB_AUTH_CALLBACK_URL;

// Redirect the user to GitHub's OAuth authorization page
router.get('/github', (req, res) => {
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${GITHUB_AUTH_CALLBACK_URL}&scope=repo`;
    res.redirect(githubAuthUrl);
});

// Handle the callback from GitHub and exchange the authorization code for an access token
router.get('/github/callback', async (req, res) => {
    // Temporary code provided by GitHub which will expire after 10 minutes.
    const { code } = req.query;

    try {
        // Exchange the authorization code for an access token
        const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', null, {
            params: {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code
            },

            headers: {
                Accept: 'application/json'
            },
        });

        const accessToken = tokenResponse.data.access_token;

        // Fetch user information from GitHub
        const githubResponse = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `token ${accessToken}`
            }
        });
    
        const githubUsername = githubResponse.data.login;
        console.log(githubResponse.data);
        console.log(githubUsername);

        // Redirect to the registration page with the GitHub username
        res.redirect(`/users/register?githubUsername=${githubUsername}`);
    } catch (error) {
        console.error('Error during gitHub authentication:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
});


module.exports = router;