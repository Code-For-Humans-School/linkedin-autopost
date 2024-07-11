const express = require('express');
const axios = require('axios');
const router = express.Router();
const querystring = require('querystring');
require('dotenv').config();
const pool = require('../db.js');  // Import the MySQL connection pool
const jwt = require('jsonwebtoken'); // used to decode the id_token(JWT token) and extract user's LinkedIn profile information
const jwksClient = require('jwks-rsa');

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_AUTH_CALLBACK_URL = process.env.GITHUB_AUTH_CALLBACK_URL;

const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const LINKEDIN_CALLBACK_URL = process.env.LINKEDIN_CALLBACK_URL;

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
        // Extract the access token
        const accessToken = tokenResponse.data.access_token;

        // Fetch user information from GitHub using the fetched access token
        const githubResponse = await axios.get('https://api.github.com/user', {
            headers: {
                Authorization: `token ${accessToken}`
            }
        });
        // Extract the user's GitHub username
        const githubUsername = githubResponse.data.login;
        console.log(githubResponse.data);
        console.log(githubUsername);

        // Store Github username and access token in session for later use with LinkedIn OAuth
        req.session.githubUsername = githubUsername;
        req.session.githubAccessToken = accessToken;

        // Redirect to the registration page with the GitHub username
        res.redirect(`/users/register?githubUsername=${githubUsername}`);
    } catch (error) {
        console.error('Error during gitHub authentication:', error);
        // If the authorization process failed, redirect the user to the registration page with an error message
        res.redirect(`/users/register?error=githubAuthFailed`);
    }
});

// Redirect the user to LinkedIn's OAuth page 
router.get('/linkedin', (req, res) => {
    try {
        // Need to add the scope w_member_social in order to make posts on behalf of the user
        const linkedinAuthUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${LINKEDIN_CLIENT_ID}&redirect_uri=${encodeURIComponent(LINKEDIN_CALLBACK_URL)}&scope=openid%20profile%20email%20w_member_social`;
        // extra scope that needs company page verification: %20w_member_social  r_liteprofile, r_emailaddress, and w_member_social  
        // &scope=openid%20profile%20email

        res.redirect(linkedinAuthUrl);
    } catch (error) {
        console.error('Error during LinkedIn authorization:', error);
        // Redirect the user back to the registration page
        res.redirect(`/users/register?githubUsername=${req.session.githubUsername}&error=linkedinAuthFailed`);
    }
});

// Helper function to get the sigining key from LinkedIn
const client = jwksClient({
    jwksUri: 'https://www.linkedin.com/oauth/openid/jwks'
});

function getKey(header, callback) {
    client.getSigningKey(header.kid, function (err, key) {
        const signingKey = key.publicKey || key.rsaPublicKey;
        callback(null, signingKey);
    });
};

// Handle the callback from LinkedIn and exchange the authorization code for an access token
router.get('/linkedin/callback', async (req, res) => {
    // Extract the temporary authorization code from LinkedIn
    const { code } = req.query;

    try {
        // Exchange the authorization code for an access token
        const params = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            client_id: LINKEDIN_CLIENT_ID,
            client_secret: LINKEDIN_CLIENT_SECRET,
            redirect_uri: LINKEDIN_CALLBACK_URL
        }).toString();

        const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', params, {
            headers: {
                'Content-Type' : 'application/x-www-form-urlencoded',
            }
        });

        // Extract the access token from the response data
        const accessToken = tokenResponse.data.access_token; // Valid within 60 days
        console.log(tokenResponse.data);
        const openidToken = tokenResponse.data.id_token;
        console.log('Received openid token:', openidToken);

        // Verify the JWT openid token and extract user data from it
        // var decodedUserData;
        jwt.verify(openidToken, getKey, (err, decoded) => {
            if (err) {
                console.error('Error verifying openid token:', err);
                res.redirect(`/users/register?githubUsername=${req.session.githubUsername}&error=openidTokenVerificationFailed`);
            }

            // Access verified claims
            // decodedUserData = decoded;
            const { sub, name, email, picture } = decoded;
            const linkedinId = sub; // user id
            console.log('Decoded user data:', decoded);

            // Retrieve the github credentials from session store and save all of them in local DB
            const { githubUsername, githubAccessToken } = req.session;
            pool.query(
                'INSERT INTO users (github_username, linkedin_id, github_token, linkedin_token) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE github_token = VALUES(github_token), linkedin_token = VALUES(linkedin_token)',
                [githubUsername, linkedinId, githubAccessToken, accessToken]
            );

            // Redirect to the registration page with the GitHub username and LinkedIn id
            res.redirect(`/users/register?githubUsername=${githubUsername}&linkedinId=${linkedinId}`);
        });

        // const { sub } = decodedUserData;
        // const linkedinId = sub; // user id
        // console.log(decodedUserData);

        // Now we can use the access token to fetch the user's profile information
        // data: {
        //     status: 403,
        //     serviceErrorCode: 100,
        //     code: 'ACCESS_DENIED',
        //     message: 'Not enough permissions to access: me.GET.NO_VERSION'
        // }
        // const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        //     headers: {
        //         Authorization: `Bearer ${accessToken}`
        //     }
        // });
        // const linkedinId = profileResponse.data.id;

    } catch (error) {
        console.error('Error during LinkedIn access token exchanging:', error);
        // If the authorization process failed, redirect the user back to the registration page with an error message
        // Since the user has already done the GitHub authorization, we need to include the githubUsername here
        res.redirect(`/users/register?githubUsername=${req.session.githubUsername}&error=linkedinAuthFailed`);
    }
});


module.exports = router;