
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
    // Message sent successfully or ignored
  });
} else {
  // chrome.runtime not available
}

// Track mouse coordinates for element selection
document.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

document.addEventListener('keydown', (event) => {
  // Listen for the Control key press
  if (event.key === 'Control') {
    // 不阻止事件传播/默认行为，避免干扰宿主网页对 Ctrl 键的处理；
    // 仅在成功捕获到文本时才阻止默认（多数页面对单独的 Ctrl 无默认行为，此调用通常无副作用）。

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
      if (typeof mouseX === 'number' && typeof mouseY === 'number') {
        const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
        if (elementUnderCursor && elementUnderCursor.parentElement) {
          text = elementUnderCursor.parentElement.innerText.trim();
        }
      }
    }

    // 避免捕获过大的文本块导致请求体过大
    if (text && text.length > 5000) {
      text = text.slice(0, 5000);
    }

    // 仅在成功捕获到文本时阻止默认行为，尽量减少对宿主页面的干扰。
    if (text) {
      try { event.preventDefault(); } catch (e) {}
      if (chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'captureContent',
          text: text,
          url: window.location.href,
          title: document.title
        }, function () {
          // Message sent successfully or ignored
        });
      } else {
        // chrome.runtime not available
      }
    }
  }
});
