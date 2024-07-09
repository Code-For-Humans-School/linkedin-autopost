# linkedin-autopost

### Introduction
This is an app that posts a linkedin post automatically when you make a commit to GitHub, using ChatGPT to elaborate on the commit.

### Installation
```shell
# Clone the repository
git clone https://github.com/Code-For-Humans-School/linkedin-autopost.git

# Navigate to the project directory
cd linkedin-autopost/server
```

Then, create a `.env` file under the `server` folder and add the following entries to it.
```shell
# openai api key: just provide a random string
CHATGPT_API_KEY=sk-proj-thisisarandomtokenf7QIgWwfQx1rxnxpD

# mastodon url: leave it as it is
MASTO_URL=https://mastodon.social

# mastodon token: just provide a random string
MASTO_TOKEN=cE-thisisarandomtokennmGBn4gZFMk
```

Finally, install necessary dependencies and start the server
```shell
# Install dependencies
npm install

# Start the development server
npm start
```
