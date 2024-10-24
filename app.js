require('dotenv').config();
const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const snoowrap = require('snoowrap');
const { MongoClient } = require('mongodb');
const port = 3000;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Reddit API initialization
const reddit = new snoowrap({
  userAgent: process.env.REDDIT_USER_AGENT,
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  refreshToken: process.env.REDDIT_REFRESH_TOKEN
});


const mongoUri = 'mongodb://127.0.0.1:27017'; 
const client = new MongoClient(mongoUri);

let cacheCollection;

client.connect()
  .then(() => {
    console.log('Connected to MongoDB successfully');
    const db = client.db('knowledge_base');
    cacheCollection = db.collection('cachedSearchResults');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
  });

// Routes to render HTML pages
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/index.html', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/about.html', (req, res) => {
  res.sendFile(__dirname + '/views/about.html');
});

app.get('/allquestion.html', (req, res) => {
  res.sendFile(__dirname + '/views/allquestion.html');
});


const exponentialBackoff = async (fn, retries = 5, delay = 1000) => {
  try {
    return await fn();
  } catch (error) {
    if (error.response && error.response.status === 429 && retries > 0) {
      console.warn(`Rate limit hit, retrying in ${delay / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, delay));  
      return exponentialBackoff(fn, retries - 1, delay * 2);     
    } else {
      throw error;
    }
  }
};

// StackOverflow and Reddit search route with caching and exponential backoff
app.get('/search', async (req, res) => {
  const query = req.query.q || '';
  const sortBy = req.query.sort || 'activity';

  if (!query) {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    if (!cacheCollection) {
      return res.status(500).json({ error: 'Database connection not established' });
    }

    const cachedResults = await getCachedSearchResults(query);
    if (cachedResults) {
      console.log('Returning cached results');
      return res.status(200).json(cachedResults.results);
    }

    // Fetch results from StackOverflow and Reddit with exponential backoff
    const response = await exponentialBackoff(() => axios.get('https://api.stackexchange.com/2.3/search', {
      params: {
        intitle: query,
        order: 'desc',
        sort: sortBy,
        site: 'stackoverflow',
        filter: 'default'
      }
    }));

    const redditResults = await exponentialBackoff(() => reddit.search({
      query: query,
      sort: sortBy === 'activity' ? 'relevance' : sortBy,
      time: 'all'
    }));

    const questionsWithBody = await Promise.all(
      response.data.items.map(async (item) => {
        const questionDetails = await getQuestionDetails(item.question_id);
        return questionDetails;
      })
    );

    const redditPosts = redditResults.map(post => ({
      title: post.title,
      subreddit: post.subreddit.display_name,
      author: post.author.name,
      url: `https://reddit.com${post.permalink}`
    }));

    const results = {
      stackOverflow: questionsWithBody,
      reddit: redditPosts
    };

    // Cache the results after fetching
    await cacheSearchResults(query, results);

    res.status(200).json(results);
  } catch (error) {
    console.error('Error fetching from StackOverflow or Reddit API:', error.message);
    res.status(500).json({ error: 'Error fetching from StackOverflow or Reddit API' });
  }
});

// Function to get cached results
async function getCachedSearchResults(query) {
  if (!cacheCollection) {
    throw new Error('cacheCollection is not initialized');
  }
  return await cacheCollection.findOne({ query: query });
}

// Function to cache search results
async function cacheSearchResults(query, results) {
  if (!cacheCollection) {
    throw new Error('cacheCollection is not initialized');
  }
  const cacheData = {
    query: query,
    results: results,
    timestamp: new Date(),
  };
  await cacheCollection.insertOne(cacheData);
}

// Helper function to get question details from StackOverflow
async function getQuestionDetails(questionId) {
  try {
    const response = await exponentialBackoff(() => axios.get(`https://api.stackexchange.com/2.3/questions/${questionId}`, {
      params: {
        site: 'stackoverflow',
        filter: '!9_bDE(fI5'
      }
    }));
    return response.data.items[0];
  } catch (error) {
    console.error(`Error fetching question details for ID ${questionId}:`, error);
    return null;
  }
}

// Email transport configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send email route
app.post('/send-email', async (req, res) => {
  const { email, results } = req.body;

  if (!email || !results) {
    return res.status(400).json({ error: 'Email and results are required' });
  }

  const stackOverflowResults = results.filter(item => item.question_id);
  const redditResults = results.filter(item => item.subreddit);

  function generateHTML(stackOverflowResults, redditResults) {
    let html = `<h2>Search Results</h2><h3>Top Questions</h3><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Title</th><th>Tags</th><th>Owner</th><th>Link</th></tr></thead><tbody>`;

    stackOverflowResults.forEach(item => {
      html += `<tr><td>${item.title}</td><td>${item.tags ? item.tags.join(", ") : "No tags"}</td><td><a href="${item.owner.link}">${item.owner.display_name}</a></td><td><a href="${item.link}">View Question</a></td></tr>`;
    });

    html += `</tbody></table><h3>Reddit Posts</h3><table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>Title</th><th>Subreddit</th><th>Author</th><th>Link</th></tr></thead><tbody>`;

    redditResults.forEach(post => {
      html += `<tr><td>${post.title}</td><td>${post.subreddit}</td><td>${post.author}</td><td><a href="${post.url}">View Post</a></td></tr>`;
    });

    html += `</tbody></table>`;
    return html;
  }

  const mailContent = generateHTML(stackOverflowResults, redditResults);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Search Results from StackOverflow and Reddit',
    html: mailContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
