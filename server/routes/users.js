var express = require('express');
var router = express.Router();
var axios = require('axios');
const pool = require('../db.js');  // Import the MySQL connection pool

/* GET users listing. */
// router.get('/', function(req, res, next) {
//   res.send('respond with a resource');
// });

router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Error during user log out:', err);
      res.redirect('/?error=logoutError');
    } else {
      console.error('User has successfully logged out.');
      res.redirect('/'); // Back to the main page
    }
  });
});

router.get('/login', (req, res) => {
  const { error } = req.query;
  res.render('login', { error, title: 'Login' });
});

// Once finished the authorization process during registration, the user can directly login via GitHub username,
// instead of going through the normal login workflow and try to gain authorization from GitHub or LinkedIn again.
router.get('/login/now', async (req, res) => {
  try {
    const { githubUsername } = req.query;

    console.log('githubUsername fetched from the query string: ', githubUsername);

    const [rows, fields] = await pool.query('SELECT * FROM users WHERE github_username = ?', [githubUsername]);

    if (rows.length > 0) {

      console.log('user info fetched from DB using githubUsername: ', rows);

      // Save the user info in the session store
      req.session.user = rows;
      req.session.save((err) => {
        if (err) {
          console.error('Session save error:', err);
          return res.redirect('/users/login?error=sessionError');
        } else {
          console.log('Session for login-now user info saved successfully!');
        }
        // Once successfully saved the user info, redirect the user to the main page
        res.redirect('/');
      });

    } else {
      res.redirect('/users/register?error=userNotFound');
    }

    // pool.query('SELECT * FROM users WHERE github_username = ?', [githubUsername], (error, results) => {
    //   if (error) {
    //     console.error('Database query error:', error);
    //     return res.redirect('/users/login?error=databaseError');
    //   }
    // });

  } catch (error) {
    console.error('Error during login with GitHub username directly!', error);
    res.redirect('/users/login?error=githubLoginFailed');
  }
});


router.get('/register', (req, res) => {
  const { githubUsername, linkedinId, error } = req.query;
  res.render('register', { githubUsername, linkedinId, error });
});

// async function getUserRepositories(githubToken) {
//   try {
//     const response = await axios.get('https://api.github.com/user/repos', {
//       headers: {
//         Authorization: `token ${githubToken}`
//       },
//       params: {
//         visibility: 'all' // to get both public and private repositories
//       }
//     });

//     // Extract general information from the response
//     const repos = response.data.map(repo => ({
//       name: repo.name,
//       description: repo.description,
//       language: repo.language,
//       stars: repo.stargazers_count,
//       forks: repo.forks_count,
//       private: repo.private,
//     }));

//     return repos;
//   } catch (error) {
//     console.error('Error fetching repositories:', error);
//     throw error;
//   }
// }

// // Route to register account and save access tokens
// router.post('/register/save-tokens', async (req, res) => {
//   const { githubToken, mastodonToken } = req.body;

//   try {
//     // Fetch user information from GitHub
//     const githubResponse = await axios.get('https://api.github.com/user', {
//       headers: {
//         Authorization: `token ${githubToken}`
//       }
//     });

//     const githubUsername = githubResponse.data.login;
//     console.log(githubResponse.data);
//     console.log(githubUsername);

//     getUserRepositories(githubToken).then(repos => {
//       console.log(repos);
//     }).catch(error => {
//       console.error('Error:', error);
//     });


//     const [rows, fields] = await pool.query('INSERT INTO access_tokens (github_token, mastodon_token) VALUES (?, ?)', [githubToken, mastodonToken]);

//     res.status(200).json({ message: 'Tokens saved successfully' });
//   } catch (error) {
//     console.error('Error saving tokens:', error);
//     res.status(500).json({ message: 'Internal Server Error' });
//   }
// });

module.exports = router;
