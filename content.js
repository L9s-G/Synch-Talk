
let mouseX, mouseY;

document.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Control') {
    let text = window.getSelection().toString().trim();
    
    if (!text) {
      const elementUnderCursor = document.elementFromPoint(mouseX, mouseY);
      if (elementUnderCursor && elementUnderCursor.parentElement) {
        text = elementUnderCursor.parentElement.innerText.trim();
      }
    }

    if (text) {
      chrome.runtime.sendMessage({ type: 'translateText', text: text });
    }
  }
});
