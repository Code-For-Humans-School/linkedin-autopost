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
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Function to expand commit message and generate a full post using ChatGPT API
async function expandCommitMessage(commitMessage) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: `You are a professional Mastodon user, help me expand the following text into a full post that can be posted on LinkedIn. Remember that You are an experienced software engineer and you are collaborating with teammates all cross the globe. Each teammate can push a commit to the code base, so when you try to expand the commit message, you should use we, instead of I, since this is the official Mastodon account of the whole team. Keep in mind that the total character limit is 500, make the post clean and concise. Below is the commit message to be expanded: ${commitMessage}` }],
      model: "gpt-4o",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error expanding commit message:', error);
    throw error;
  }

};

// Function to make a post on Mastodon
async function postToMastodon(messageToPost) {
  try {
    const status = await masto.v1.statuses.create({
      status: messageToPost
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
