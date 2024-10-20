document.getElementById('search-btn').addEventListener('click', async () => {
    const query = document.getElementById('search-query').value;
    const sortBy = document.getElementById('sort-by').value;
  
    // Early return if no query is provided
    if (!query) {
      alert('Please enter a search query.');
      return;
    }
  
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = 'Loading...';  // Show loading message while fetching
  
    try {
      // Fetch Stack Overflow search results from your backend route
      const response = await fetch(`/search?q=${encodeURIComponent(query)}&sort=${sortBy}`);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      resultsDiv.innerHTML = '';  // Clear previous results
  
      if (data.items && data.items.length) {
        for (const item of data.items) {
          // Fetch top answer for each question
          const topAnswer = await fetchTopAnswer(item.question_id);
  
          // Create a div for each question result
          const questionDiv = document.createElement('div');
          questionDiv.classList.add('question', 'card', 'mb-3');
  
          // Insert HTML content for each question including title, link, and fixed excerpt of body
          questionDiv.innerHTML = `
            <div class="card-body">
              <h3 class="card-title"><a href="${item.link}" target="_blank">${item.title}</a></h3>
              <p class="card-text">Score: <span class="badge bg-success">${item.score}</span> | Answers: <span class="badge bg-info">${item.answer_count}</span></p>
              <p class="card-text">${item.body ? item.body.slice(0, 200) + '...' : 'No excerpt available'}</p>
              ${topAnswer ? `<h5>Top Answer:</h5><p>${topAnswer.slice(0, 200)}...</p>` : '<p class="text-muted">No top answer available</p>'}
            </div>
          `;
  
          // Append the question div to the results container
          resultsDiv.appendChild(questionDiv);
        }
      } else {
        resultsDiv.innerHTML = '<p>No results found.</p>';
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      resultsDiv.innerHTML = '<p>Error fetching results. Please try again later.</p>';
    }
  });
  
  // Function to fetch top answer for a question by question_id
  async function fetchTopAnswer(questionId) {
    try {
      const response = await fetch(`https://api.stackexchange.com/2.3/questions/${questionId}/answers?order=desc&sort=votes&site=stackoverflow&filter=!9_bDE(fI5`);
      
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
  
      const data = await response.json();
      // Return the top answer if available
      if (data.items && data.items.length > 0) {
        return data.items[0].body;  // Fetch the body of the top answer
      }
      return null;  // No top answer found
    } catch (error) {
      console.error(`Error fetching top answer for question ${questionId}:`, error);
      return null;
    }
  }
  