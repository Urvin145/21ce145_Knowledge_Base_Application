require('dotenv').config();
const express = require('express');
const axios = require('axios');
const nodemailer = require('nodemailer');
const port = 3000;

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Route to render page
app.get('/index.html', (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
});

app.get('/about.html', (req, res) => {
  res.sendFile(__dirname + '/views/about.html');
});

app.get('/allquestion.html', (req, res) => {
  res.sendFile(__dirname + '/views/allquestion.html');
});

// stack overflow route
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
        filter: 'default'
      }
    });

    const questionsWithBody = await Promise.all(
      response.data.items.map(async (item) => {
        const questionDetails = await getQuestionDetails(item.question_id);
        return questionDetails;
      })
    );
    res.json({ items: questionsWithBody });
  } catch (error) {
    console.error('Error fetching from StackOverflow API:', error.message, error.response?.data);
    console.error('Error fetching from StackOverflow API:', error);
    res.status(500).json({ error: 'Error fetching from StackOverflow API' });
  }
});

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
      
      return response.data.items[0].body;  
    }
    return null;  
  } catch (error) {
    console.error(`Error fetching top answer for question ${questionId}:`, error);
    return null;
  }
}


const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, // email address
    pass: process.env.EMAIL_PASS, // email password 
  },
});

// Send email route
app.post('/send-email', async (req, res) => {
  const { email, results } = req.body;

  if (!email || !results) {
    return res.status(400).json({ error: 'Email and results are required' });
  }

  let data = JSON.stringify(results);
  data = JSON.parse(data);

  function generateHTML(data) {
    let html = `
        <h2>StackOverflow Questions</h2>
        <table border="1" cellpadding="5" cellspacing="0">
        <thead>
        <tr>
        <th>Title</th>
        <th>Tags</th>
        <th>Owner</th>
        <th>Link</th>
        </tr>
        </thead>
        <tbody>`;

    data.forEach(item => {
      html += `
            <tr>
            <td>${item.title}</td>
            <td>${item.tags.join(", ")}</td>
            <td><a href="${item.owner.link}">${item.owner.display_name}</a></td>
                <td><a href="${item.link}">View Question</a></td>
                </tr>`;
    });

    html += `
            </tbody>
            </table>
            `;

    return html;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER, // Sender address
    to: email, 
    subject: 'Search Results from StackOverflow',
    html: generateHTML(data), 
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ message: 'Email sent successfully!' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`);
});
