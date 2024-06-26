var express = require('express');
var router = express.Router();
var axios = require('axios');
require('dotenv').config();
// var OpenAI = require('openai');

// const CHATGPT_API_KEY = process.env.CHATGPT_API_KEY;
// const openai = new OpenAI();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

// Function to expand commit message and generate a full post using ChatGPT API
async function expandCommitMessage(commitMessage) {
  try {
    // const response = await axios.post('https://api.openai.com/v1/engines/davinci/completions', {
    //   prompt: commitMessage,
    //   max_tokens: 150,
    //   api_key: CHATGPT_API_KEY
    // });
    const completion = await openai.chat.completions.create({
      messages: [{ role: "system", content: `You are a professional LinkedIn user, help me expand the following text into a full post that can be posted on LinkedIn, ${commitMessage}` }],
      model: "gpt-4o",
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error expanding commit message:', error);
    throw error;
  }

};

/*  */
router.post('/webhook', async (req, res) => {
  console.log('The webhook has been invoked successfully.');
  const commitMessage = req.body.head_commit.message;
  console.log(commitMessage);

  try {
    // Expand the commit message into a full post
    const expandedMessage = await expandCommitMessage(`Expand the following text into a LinkedIn post, ${commitMessage}`);
    console.log('Expanded Message:', expandedMessage);
    res.render('index', { gptprompt: commitMessage })
    res.render('index', { gptmessage: expandedMessage });
    
    // Post to LinkedIn

    // Send a success response to GitHub
    res.status(200).send('Webhook reveived and processed.');
  } catch (error) {
    // Log the error to the server
    console.error('Error processing webhook:', error);
    res.render('error', { gpterror: error });

    // Send an error response to GitHub
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
