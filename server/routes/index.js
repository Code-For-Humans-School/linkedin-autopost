var express = require('express');
var router = express.Router();
var axios = require('axios');
require('dotenv').config();
var OpenAI = require('openai');
const { createRestAPIClient } = require('masto');
const pool = require('../db.js');  // Import the MySQL connection pool

// Initialize OpenAI with the API key
const openai = new OpenAI();

// Initialize Mastodon API client
const masto = createRestAPIClient({
  url: process.env.MASTO_URL,
  accessToken: process.env.MASTO_TOKEN,
});

/* GET home page. */
router.get('/', async function(req, res, next) {
  // Try to fetch the user's login info, if not eixsting, redirect to the login page
  const userInfo = req.session.user;
  const { error } = req.query;
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 15;

  if (!userInfo || userInfo.length == 0) {
    return res.redirect('/users/login');
  }
  // Actually, I'd like to see what's inside userInfo
  console.log('userInfo contents fetched from session store:', userInfo);

  try {
    // Once I have the userInfo, I wan to fetch all the repositories and show them.
    const githubRepos = await fetchGitHubRepos(userInfo[0].github_token, page, perPage);
    res.render('index', { 
        title: 'LinkedIn Auto-Post',
        error,  
        userInfo, 
        githubRepos,
        currentPage: page,
        perPage
      }); 

  } catch (fetchError) {
    console.error('Error while fetching GitHub repositories:', fetchError);
    res.render('index', { 
      title: 'LinkedIn Auto-Post',
      error, 
      userInfo, 
      githubRepos: [], 
      githubRepoError: 'Error fetching repositories',
      currentPage: page,
      perPage
    }); 
  }

});

router.get('/webhook/config', async (req, res) => {
  const { repo, hassetwebhook} = req.query;
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 15;


  try {
    const githubUsername = req.session.user[0].github_username;
    const githubToken = req.session.user[0].github_token;
    const payloadUrl = process.env.GITHUB_WEBHOOK_PAYLOAD_URL;
    let setWebhookAlready = hassetwebhook === 'true';

    // If the user hasn't set up the webhook for this repo, set it up now
    if (!setWebhookAlready) {
      await axios.post(`https://api.github.com/repos/${githubUsername}/${repo}/hooks`, 
        {
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: payloadUrl,
            content_type: 'json'
          }
        },
        {
          headers: {
            Authorization: `token ${githubToken}`
          }
        });

        setWebhookAlready = true; // Mark as webhook set after creation

    } else {
      // If the webhook is already set, delete the existing webhook
      const hooksResponse = await axios.get(`https://api.github.com/repos/${githubUsername}/${repo}/hooks`, {
        headers: {
          Authorization: `token ${githubToken}`
        }
      });

      const hooks = hooksResponse.data;
      const targetHook = hooks.find(h => h.config.url === payloadUrl && h.config.content_type === 'json');

      if (targetHook) {
        await axios.delete(`https://api.github.com/repos/${githubUsername}/${repo}/hooks/${targetHook.id}`, {
          headers: {
            Authorization: `token ${githubToken}`
          }
        });

        setWebhookAlready = false;
      }
    }

    res.json({
      success: true,
      hasSetWebhook: setWebhookAlready
    });
    // res.redirect(`/?page=${page}&per_page=${perPage}`);
    
  } catch (error) {
    console.error(`Error while setting webhooks for repos via /webhook/config`, error);
    res.redirect('/?error=setWebhookError');
  }

});


// Function to fetch user's GitHub repositories
// To make the function more robust and user-friendly and void potential issues from missing parameters,
// set default values for page and perPage
async function fetchGitHubRepos(githubToken, page = 1, perPage = 15) {
  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${githubToken}`
      },
      params: {
        visibility: 'all', // to get both public and private repositories
        affiliation: 'owner', // to ensure that only repositories owned by the authenticated user are returned.
        page: page,
        per_page: perPage
      }
    });

    // Let's see what's inside the response.data
    const userRepoData = response.data;
    console.log('GitHub user repo data:', userRepoData);

    // Extract general information from the response
    const extractedRepoData = await Promise.all(userRepoData.map( async repo => {
      const webhookResponse = await axios.get(`https://api.github.com/repos/${repo.owner.login}/${repo.name}/hooks`, {
        headers: {
          Authorization: `token ${githubToken}`
        }
      });

      const webhooks = webhookResponse.data;
      console.log(`Webhooks data of ${repo.owner.login}'s repo ${repo.name} :`, webhooks);

      let hasSetWebhook = false;
      if (webhooks.length === 0) {
        hasSetWebhook = false;
      } else {
        hasSetWebhook = webhooks.some( hook => hook.config.url === process.env.GITHUB_WEBHOOK_PAYLOAD_URL && hook.config.content_type === 'json');
      }

      return {
        name: repo.name,
        description: repo.description,
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        private: repo.private,
        hasSetWebhook: hasSetWebhook
      };

    }));

    return extractedRepoData;
  } catch (error) {
    console.error('Error fetching repositories:', error);
    throw error;
  }
}

// Function to expand commit message and generate a full post using ChatGPT API
async function expandCommitMessage(commitMessage, repoUrlLink) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: `You are a professional LinkedIn user, help me expand the following GitHub commit message into a full post that can be posted on LinkedIn. Remember that You are an experienced software engineer so your post should tell people about this recent GitHub commit and show your expertise in the tech field. Don't try to include any external links, although it might be helpful, it's not necessary and you should avoid generating any links. Also note that the post should be professional, do use a relatively formal tone, and to make those posts more human-like, you need to slightly change your way of expression each time you try to generate the post. And you only need to return the post itself, you don't need to include any leading or tailing explanations associated with the post, if I want them, I'll just ask you, but since I didn't, you never include those. Keep in mind that the total character limit is 1200, make the post clean and concise. That means, the entire post that you return to me, should strictly have no more than 1200 characters. Below is the commit message to be expanded:  ${commitMessage}. And here's the GitHub repo's url link ${repoUrlLink}, please add it as a clickable url link to the GitHub repo that we're currently working on so that people can easily find us.` }],
      model: "gpt-4o",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error expanding commit message:', error);
    throw error;
  }

};

// Function to truncate the message to limit the message length
// Although I've set the limit in the ChatGPT prompt, the generated posts sometimes still exceed the length limit
function truncateMessageFromEnd(message, maxLength) {
  if (message.length <= maxLength){
    return message;
  }

  // I truncate the message string word by word instead of character by character,
  // so here I wrap all the words in the message string into an array
  let words = message.split(' ');
  let difference = message.length - maxLength;

  while(difference > 0 && words.length > 0) {
    // Get the last word of the array and pop it from the array
    let lastWord = words.pop();
    
    // Subtract the length of the word plus one for the sapace between two words
    difference -= (lastWord.length + 1);
  }

  // Join the remaining words to form the truncated message
  return words.join(' ');
};

// Function to make a post on Mastodon
async function postToMastodon(messageToPost) {
  try {
    // Truncate the message if it's longer than 500 characters
    const truncatedMessage = truncateMessageFromEnd(messageToPost, 500);
    const status = await masto.v1.statuses.create({
      status: truncatedMessage
    });

    console.log('Maston post has been posted, the URL to the post is: ', status.url);
    return status.url;
  } catch (error) {
    console.error('Error posting to Mastodon: ', error);
    throw error;
  }
}

// Function to make a post on LinkedIn
async function postToLinkedIn(message, accessToken, linkedinId) {
  // Truncate the message if it's longer than 2000 characters
  const truncatedMessage = truncateMessageFromEnd(message, 1500);

  const url = 'https://api.linkedin.com/v2/ugcPosts';
  
  const payload = {
    author: `urn:li:person:${linkedinId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: truncatedMessage
        },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Restli-Protocol-Version': '2.0.0'
  };

  return await axios.post(url, payload, { headers });
}


/* Route to process webhook data sent from GitHub */
router.post('/webhook', async (req, res) => {
  console.log('The webhook has been invoked successfully.');
  console.log('Data received from GitHub webhook:', req.body);
  const commitMessage = req.body.head_commit.message;
  console.log(commitMessage);

  // Retrieve the GitHub username
  const githubUsername = req.body.repository.owner.login;
  // const linkedinAccessToken = req.session.user[0].linkedin_token;
  // Retrieve the repo url link
  const repoUrlLink = req.body.repository.html_url;

  try {
    // Expand the commit message into a full post 
    const expandedMessage = await expandCommitMessage(commitMessage, repoUrlLink);
    console.log('Expanded Message:', expandedMessage);
    
    // Post to Mastodon
    const mastodonPostUrl = await postToMastodon(expandedMessage);
    console.log('Mastodon Post Url: ', mastodonPostUrl);

    try {
      const [rows, fields] = await pool.query(`SELECT * FROM users WHERE github_username = ?`, [githubUsername]);
      if (rows.length > 0){
        // Retrieve the linkedin-access-token 
        const linkedinAccessToken = rows[0].linkedin_token;
        const linkedinId = rows[0].linkedin_id;

        // Post to LinkedIn on behalf of the user
        const postResponse = await postToLinkedIn(expandedMessage, linkedinAccessToken, linkedinId);
        console.log('LinkedIn post response:', postResponse.data);

        // Send a success response to GitHub
        res.status(200).send('Webhook reveived and processed.');
      } else {
        console.error(`Cannot find account info for ${githubUsername}, make sure you are the owner of the repo and have successfully created an account.`);
      }


    } catch (dbError) {
      console.error('Error while querying DB for linkedin_token with the given github_username:', dbError);
    }

  } catch (error) {
    // Log the error to the server
    console.error('Error processing webhook:', error);

    // Send an error response to GitHub
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
