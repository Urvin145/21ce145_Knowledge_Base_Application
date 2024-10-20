const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(express.static('public'));

// Route to render home page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

// Route to search and fetch data from Stack Overflow API
// Route to search StackOverflow
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
          filter: '!9_bDE(fI5'  // This filter includes the body of the questions
        }
      });
  
      res.json(response.data);  // Send the response back to the frontend
    } catch (error) {
      console.error('Error fetching from StackOverflow API:', error);
      res.status(500).json({ error: 'Error fetching from StackOverflow API' });
    }
  });

  
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
