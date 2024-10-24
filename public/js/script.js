let searchResults = []; 

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
}

// Function to show Bootstrap-styled alerts
function showAlert(message, type) {
  const alertDiv = document.createElement('div');
  alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
  alertDiv.role = 'alert';
  alertDiv.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  document.querySelector('.container').prepend(alertDiv);
  setTimeout(() => alertDiv.remove(), 5000); 
}

document.getElementById('search-btn').addEventListener('click', debounce(async () => {
  const query = document.getElementById('search-query').value;
  const sortBy = document.getElementById('sort-by').value;
  const emailSection = document.getElementById('email-section');

  if (!query) {
    showAlert('Please enter a search query.', 'danger');
    return;
  }

  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = 'Loading...';

  try {
    const response = await fetch(`/search?q=${encodeURIComponent(query)}&sort=${sortBy}`);
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    console.log("Data:", JSON.stringify(data));

    searchResults = [...data.stackOverflow, ...data.reddit];
    resultsDiv.innerHTML = ''; 

    if (searchResults.length) {
      emailSection.style.display = 'block';
      for (const item of searchResults) {
        const questionDiv = document.createElement('div');
        questionDiv.classList.add('question', 'card', 'mb-3');

        // Handling StackOverflow posts
        if (item.question_id) {
          const topAnswer = await fetchTopAnswer(item.question_id);  

          questionDiv.innerHTML = `
            <div class="card-body">
              <h3 class="card-title"><a href="${item.link}" target="_blank">${item.title}</a></h3>
              <h6 class="card">${item.tags}</h6>
              ${topAnswer ? `<h5>Top Answer:</h5><p>${topAnswer.slice(0, 600)}...</p>` : '<p class="text-muted">No top answer available</p>'}
            </div>
          `;
        }
        
        // Handling Reddit posts
        if (item.subreddit) {
          questionDiv.innerHTML = `
            <div class="card-body">
              <h3 class="card-title"><a href="${item.url}" target="_blank">${item.title}</a></h3>
              <p>Posted by: ${item.author} in r/${item.subreddit}</p>
            </div>
          `;
        }

        resultsDiv.appendChild(questionDiv);
      }
    } else {
      resultsDiv.innerHTML = '<p>No results found.</p>';
      showAlert('No results found.', 'warning');
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    resultsDiv.innerHTML = '<p>Error fetching results. Please try again later.</p>';
    showAlert('Error fetching results. Please try again later.', 'danger');
  }
}, 300));

document.getElementById('send-email-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value;

  if (!email || searchResults.length === 0) {
    showAlert('Please enter a valid email and make sure to search first.', 'danger');
    return;
  }

  try {
    const response = await fetch('/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, results: searchResults }),
    });

    if (!response.ok) {
      throw new Error('Failed to send email');
    }

    const data = await response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    showAlert('There was an error sending the email. Please try again later.', 'danger');
  }
});

async function fetchTopAnswer(questionId) {
  try {
    const response = await fetch(`https://api.stackexchange.com/2.3/questions/${questionId}/answers?order=desc&sort=votes&site=stackoverflow&filter=!9_bDE(fI5`);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].body;  
    }
    return null; 
  } catch (error) {
    console.error(`Error fetching top answer for question ${questionId}:`, error);
    return null;
  }
}

window.onscroll = function () {
  const backToTopBtn = document.getElementById('back-to-top');
  if (document.body.scrollTop > 100 || document.documentElement.scrollTop > 100) {
    backToTopBtn.style.display = 'block';
  } else {
    backToTopBtn.style.display = 'none';
  }
};

document.getElementById('back-to-top').onclick = function () {
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
