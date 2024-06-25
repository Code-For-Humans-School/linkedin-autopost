var express = require('express');
var router = express.Router();
var axios = require('axios');

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

/*  */
router.post('/webhook', async (req, res) => {
  console.log('The webhook has been invoked successfully.');
  const commitMessage = req.body.head_commit.message;
  console.log(commitMessage);

  try {
    // Expand the commit message into a full post
    
    // Post to LinkedIn

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
