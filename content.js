
let mouseX, mouseY;

// Send initial page info when content script loads
// This sends the current page's URL and title to the background script
// when the content script is injected into a new page.
if (chrome.runtime && chrome.runtime.id) {
  chrome.runtime.sendMessage({
    type: 'captureContent',
    url: window.location.href,
    title: document.title,
    text: '' // No text selected initially
  }, function() {
    if (chrome.runtime.lastError) {
      console.error('Content script: Error sending initial message:', chrome.runtime.lastError.message);
    }
  });
} else {
  // If chrome.runtime is not available (e.g., extension context invalidated),
  // log a warning but do not throw an error.
  console.warn('Content script: chrome.runtime not available, cannot send initial message.');
}

// Track mouse coordinates for element selection
document.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

document.addEventListener('keydown', (event) => {
  // Listen for the Control key press
  if (event.key === 'Control') {
    // Prevent default browser actions and stop propagation to ensure our handler is prioritized.
    // This can prevent issues with other page scripts or browser shortcuts.
    event.stopImmediatePropagation();
    event.preventDefault();

    // Provide visual feedback to the user that an action is being processed.
    document.body.style.cursor = 'wait';
    setTimeout(() => {
      document.body.style.cursor = 'default';
    }, 500);

    let text = window.getSelection().toString().trim();
    
    // If no text is selected, try to get text from the parent element under the cursor.
    if (!text) {
      const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
      if (elementUnderCursor && elementUnderCursor.parentElement) {
        text = elementUnderCursor.parentElement.innerText.trim();
      }
    }

    // If text is found, send it along with the current page's URL and title to the background script.
    if (text) {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'captureContent',
          text: text,
          url: window.location.href,
          title: document.title
        }, function() {
          if (chrome.runtime.lastError) {
            // Log any errors during message sending, typically due to context invalidation.
            console.error('Content script: Error sending keydown message:', chrome.runtime.lastError.message);
          }
        });
      } else {
        // If chrome.runtime is not available, log a warning.
        console.warn('Content script: chrome.runtime not available, cannot send keydown message.');
      }
    }
  }
});
