var express = require('express');
var router = express.Router();
var axios = require('axios');
require('dotenv').config();
var OpenAI = require('openai');
const { createRestAPIClient } = require('masto');

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

  if (!userInfo || userInfo.length == 0) {
    return res.redirect('/users/login');
  }
  // Actually, I'd like to see what's inside userInfo
  console.log('userInfo contents fetched from session store:', userInfo);

  try {
    // Once I have the userInfo, I wan to fetch all the repositories and show them.
    const githubRepos = await fetchGitHubRepos(userInfo[0].github_token);
    res.render('index', { error, title: 'Express', userInfo, githubRepos}); 

  } catch (fetchError) {
    console.error('Error while fetching GitHub repositories:', fetchError);
    res.render('index', { error, title: 'Express', userInfo, githubRepos: [], githubRepoError: 'Error fetching repositories'}); 
  }

});

// Function to fetch user's GitHub repositories
async function fetchGitHubRepos(githubToken) {
  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${githubToken}`
      },
      params: {
        visibility: 'all' // to get both public and private repositories
      }
    });

    // Let's see what's inside the response.data
    console.log('GitHub repo data:', response.data);

    // Extract general information from the response
    const repos = response.data.map(repo => ({
      name: repo.name,
      description: repo.description,
      language: repo.language,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      private: repo.private,
    }));

    return repos;
  } catch (error) {
    console.error('Error fetching repositories:', error);
    throw error;
  }
}

// Function to expand commit message and generate a full post using ChatGPT API
async function expandCommitMessage(commitMessage) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: `You are a professional Mastodon user, help me expand the following text into a full post that can be posted on Mastodon. Remember that You are an experienced software engineer and you are collaborating with teammates all cross the globe. Each teammate can push a commit to the code base, so when you try to expand the commit message, you should use we, instead of I, since this is the official Mastodon account of the whole team. Also note that the post should be professional, do use a relatively formal tone, and to make those posts more human-like, you need to slightly change your way of expression each time you try to generate the post. And you only need to return the post itself, you don't need to include any leading or tailing explanations associated with the post, if I want them, I'll just ask you, but since I didn't, you never include those. Keep in mind that the total character limit is 500, make the post clean and concise. That means, the entire post that you return to me, including those # tags at the end, should strictly have no more than 500 characters. Below is the commit message to be expanded: ${commitMessage}` }],
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

/* */
router.post('/webhook', async (req, res) => {
  console.log('The webhook has been invoked successfully.');
  console.log('Data received from GitHub webhook:', req.body);
  const commitMessage = req.body.head_commit.message;
  console.log(commitMessage);

  try {
    // Expand the commit message into a full post
    const expandedMessage = await expandCommitMessage(commitMessage);
    console.log('Expanded Message:', expandedMessage);
    
    // Post to Mastodon
    const mastodonPostUrl = await postToMastodon(expandedMessage);
    console.log('Mastodon Post Url: ', mastodonPostUrl);

    // Send a success response to GitHub
    res.status(200).send('Webhook reveived and processed.');
  } catch (error) {
    // Log the error to the server
    console.error('Error processing webhook:', error);

    // Send an error response to GitHub
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
