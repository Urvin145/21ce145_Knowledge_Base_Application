const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.static('public'));

// Route to render home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/search', async (req, res) => {
    const query = req.query.q || '';
    const sortBy = req.query.sort || 'activity';
  
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
  
    try {
      const response = await axios.get('https://api.stackexchange.com/2.3/search', {
        params: {
          intitle: query,
          order: 'desc',
          sort: sortBy,
          site: 'stackoverflow',
          filter: 'default' // This should return a standard set of question details
        }
      });
  
      // Fetch full question details for each question to include body
      const questionsWithBody = await Promise.all(
        response.data.items.map(async (item) => {
          const questionDetails = await getQuestionDetails(item.question_id);
          return questionDetails;
        })
      );
  
      res.json({ items: questionsWithBody });
    } catch (error) {
      console.error('Error fetching from StackOverflow API:', error);
      res.status(500).json({ error: 'Error fetching from StackOverflow API' });
    }
  });
  
  // Function to get detailed question information
  async function getQuestionDetails(questionId) {
    try {
      const response = await axios.get(`https://api.stackexchange.com/2.3/questions/${questionId}`, {
        params: {
          site: 'stackoverflow',
          filter: '!9_bDE(fI5' // This filter should include the body of the question
        }
      });
      return response.data.items[0]; // Return the question details
    } catch (error) {
      console.error(`Error fetching question details for ID ${questionId}:`, error);
      return null;
    }
  }
  
  // Function to fetch top answer for a question by question_id
  async function fetchTopAnswer(questionId) {
    try {
      const response = await axios.get(`https://api.stackexchange.com/2.3/questions/${questionId}/answers`, {
        params: {
          order: 'desc',
          sort: 'votes',
          site: 'stackoverflow',
          filter: '!9_bDE(fI5'  // This filter includes the body of the answers
        }
      });
  
      if (response.data.items && response.data.items.length > 0) {
        console.log(response.data.items);
        return response.data.items[0].body;  // Fetch the body of the top answer
      }
      return null;  // No top answer found
    } catch (error) {
      console.error(`Error fetching top answer for question ${questionId}:`, error);
      return null;
    }
  }
  
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
