
let mouseX, mouseY;

// Send initial page info when content script loads
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
  console.log('Content script: Initial page info sent.', { url: window.location.href, title: document.title });
} else {
  console.warn('Content script: chrome.runtime not available, cannot send initial message.');
}

document.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Control') {
    event.stopImmediatePropagation();
    event.preventDefault();

    // Add visual feedback
    document.body.style.cursor = 'wait';
    setTimeout(() => {
      document.body.style.cursor = 'default';
    }, 500);

    let text = window.getSelection().toString().trim();
    
    if (!text) {
      const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
      if (elementUnderCursor && elementUnderCursor.parentElement) {
        text = elementUnderCursor.parentElement.innerText.trim();
      }
    }

    if (text) {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'captureContent',
          text: text,
          url: window.location.href,
          title: document.title
        }, function() {
          if (chrome.runtime.lastError) {
            console.error('Content script: Error sending keydown message:', chrome.runtime.lastError.message);
          }
        });
        console.log('Content script: Captured content sent from keydown.', { text: text, url: window.location.href, title: document.title });
      } else {
        console.warn('Content script: chrome.runtime not available, cannot send keydown message.');
      }
    }
  }
});
