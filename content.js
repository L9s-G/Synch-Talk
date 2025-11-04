
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
  }, function () {
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

    // 文本捕获策略：
    // 1. 如果用户有高亮选中的文本，则使用该文本。
    // 2. 如果没有选中文本，则尝试获取当前鼠标指针下方元素的父元素的`innerText`。
    //    这是一种启发式方法，旨在捕获用户可能感兴趣的整个文本块（如段落）。
    if (!text) {
      const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
      if (elementUnderCursor && elementUnderCursor.parentElement) {
        text = elementUnderCursor.parentElement.innerText.trim();
      }
    }

    // 如果成功捕获到文本，则将其发送到后台脚本。
    if (text) {
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'captureContent',
          text: text,
          url: window.location.href,
          title: document.title
        }, function () {
          if (chrome.runtime.lastError) {
            // 记录消息发送时可能发生的错误，通常是由于扩展上下文失效。
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
