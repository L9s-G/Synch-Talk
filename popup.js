// Get DOM elements
const sourceLangSelect = document.getElementById('source-language');
const targetLangTrigger = document.getElementById('target-languages-display');
const targetLangOptionsContainer = document.getElementById('target-languages-options');
const targetLangContainer = document.getElementById('target-language-select-container');
const chatArea = document.getElementById('chat-area');
const userInputTextarea = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const tutorModeToggle = document.getElementById('tutor-mode-toggle');

// Define supported languages
const languages = ['Chinese', 'English', 'Greek' , 'French' ,  'German' , 'Japanese', 'Korean'];

// Store currently selected target languages
let selectedTargetLanguages = [];

// Populate source language dropdown and custom target language menu
function populateLanguages() {
  languages.forEach(lang => {
    const sourceOption = document.createElement('option');
    sourceOption.value = lang;
    sourceOption.textContent = lang;
    sourceLangSelect.appendChild(sourceOption);
  });
  
  targetLangOptionsContainer.innerHTML = '';
  languages.forEach(lang => {
    const optionDiv = document.createElement('div');
    optionDiv.classList.add('custom-select-option');
    optionDiv.setAttribute('data-value', lang);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `target-lang-${lang.toLowerCase()}`;
    checkbox.value = lang;

    const label = document.createElement('label');
    label.htmlFor = `target-lang-${lang.toLowerCase()}`;
    label.textContent = lang;

    optionDiv.appendChild(checkbox);
    optionDiv.appendChild(label);
    targetLangOptionsContainer.appendChild(optionDiv);
  });
  
  // This logic will be handled by loadSettings(), so remove it from here
  // updateSelectedTargetLanguages();
}

// Update display of selected target languages
function updateSelectedTargetLanguages() {
  selectedTargetLanguages = Array.from(targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.value);
  //TODO: Add: Save new selectedTargetLanguages[]
  saveSettings();
  
  if (selectedTargetLanguages.length === 0) {
    targetLangTrigger.textContent = 'Please select target languages';
  } else {
    targetLangTrigger.textContent = selectedTargetLanguages.join(', ');
  }
}

// Enable or disable target language options
function updateTargetLanguagesAvailability() {
  const selectedSourceLang = sourceLangSelect.value;
  targetLangOptionsContainer.querySelectorAll('.custom-select-option').forEach(optionDiv => {
    const checkbox = optionDiv.querySelector('input[type="checkbox"]');
    if (checkbox.value === selectedSourceLang) {
      optionDiv.classList.add('disabled');
      checkbox.disabled = true;
      checkbox.checked = false;
    } else {
      optionDiv.classList.remove('disabled');
      checkbox.disabled = false;
    }
  });
  updateSelectedTargetLanguages();
}

// --- New: Save and load settings ---
function saveSettings() {
  const settings = {
    sourceLanguage: sourceLangSelect.value,
    targetLanguages: selectedTargetLanguages,
    isTutorMode: tutorModeToggle.checked
  };
  chrome.storage.local.set({ settings });
}

function loadSettings() {
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      const { sourceLanguage, targetLanguages, isTutorMode } = data.settings;
      //TODO: Modify: Select source language based on record
      if (sourceLanguage) {
        sourceLangSelect.value = sourceLanguage;
      }
      
      //TODO: Add: Update selectedTargetLanguages[] based on recorded languages
      selectedTargetLanguages = targetLanguages || [];
      tutorModeToggle.checked = isTutorMode;
      const checkboxes = targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectedTargetLanguages.includes(checkbox.value);
      });
    }
    // Ensure language availability is updated immediately after loading
    updateTargetLanguagesAvailability();
  });
}

// --- Critical fix: Unified handling of language option click events ---
targetLangOptionsContainer.addEventListener('click', (event) => {
  const clickedOption = event.target.closest('.custom-select-option');
  if (clickedOption) {
    const checkbox = clickedOption.querySelector('input[type="checkbox"]');
    // If the checkbox is not disabled, toggle its checked state and update UI
    if (checkbox && !checkbox.disabled) {
      // Check if the clicked element is the checkbox or its label
      // If it is, the default behavior handles the checked state. We only update the UI.
      // If not, we manually toggle the checked state and update the UI.
      if (event.target !== checkbox && event.target !== clickedOption.querySelector('label')) {
        checkbox.checked = !checkbox.checked;
      }
      // In any case, call the update function to ensure UI syncs with checked state
      updateSelectedTargetLanguages();	  
    }
  }
});
// ---------------------------------------------

// Listen for changes in the source language dropdown
									   
sourceLangSelect.addEventListener('change', () => {
  updateTargetLanguagesAvailability();
  //TODO: Add: Save new source language
  saveSettings();
});

// Listen for changes in the tutor mode toggle
tutorModeToggle.addEventListener('change', saveSettings);

// Show/hide target language options on trigger click
targetLangTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  targetLangOptionsContainer.classList.toggle('open');
  targetLangTrigger.classList.toggle('open');
  
  // Position the dropdown below the trigger
  const rect = targetLangTrigger.getBoundingClientRect();
  targetLangOptionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
  targetLangOptionsContainer.style.left = `${rect.left + window.scrollX}px`;
  targetLangOptionsContainer.style.width = `${rect.width}px`;
});

// Hide target language options when clicking elsewhere in the document
document.addEventListener('click', (event) => {
  if (!targetLangContainer.contains(event.target)) {
    targetLangOptionsContainer.classList.remove('open');
    targetLangTrigger.classList.remove('open');
  }
});

// Call on page load
document.addEventListener('DOMContentLoaded', () => {
  populateLanguages();
  loadSettings();
  loadCapturedContent(); // Load captured content when popup opens
});

// Dynamically create message bubble and add to chat area
function createMessageBubble(text, className, originalFullText = null) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', className);

  const textContent = document.createElement('p');
  textContent.textContent = text;
  messageEl.appendChild(textContent);

  if (className === 'ai-message') {
    const checkBtn = document.createElement('button');
    checkBtn.classList.add('reverse-check-btn');
    messageEl.appendChild(checkBtn);

    checkBtn.addEventListener('click', () => {
      // If the result already exists, do not call again and return directly
      if (messageEl.querySelector('.reverse-check-result')) {
        return;
      }
      
      chrome.runtime.sendMessage({
        action: 'reverseCheck',
        textToTranslate: originalFullText || text
      }, (response) => {
        if (response && response.text) {
          const checkResult = document.createElement('div');
          checkResult.classList.add('reverse-check-result');
          checkResult.textContent = `Verify (EN): ${response.text}`;
          messageEl.appendChild(checkResult);
          messageEl.classList.add('has-reverse-check');
        } else {
          const checkResult = document.createElement('div');
          checkResult.classList.add('reverse-check-result');
          checkResult.textContent = `Verify failed.`;
          messageEl.appendChild(checkResult);
          messageEl.classList.add('has-reverse-check');
        }
      });
    });
  }
  return messageEl;
}

// Display AI translation results
function displayAiResults(data, isTutorMode) {
  if (isTutorMode && data.mode === 'tutor' && data.corrected_text) {
    const correctedUserMessage = createMessageBubble(`AI Tutor: ${data.corrected_text}`, 'ai-message', data.corrected_text);
    chatArea.appendChild(correctedUserMessage);
  }
  
  if (data.translations) {
    for (const lang in data.translations) {
      const translation = data.translations[lang];
      const translatedMessage = createMessageBubble(`${lang}: ${translation}`, 'ai-message', translation);
      chatArea.appendChild(translatedMessage);
    }
  } else if (data.error) {
    const errorMessage = createMessageBubble(`Error: ${data.error}`, 'ai-message');
    chatArea.appendChild(errorMessage);
  }

  scrollChatToBottom();
}

// Send message function
sendBtn.addEventListener('click', () => {
  const userInput = userInputTextarea.value.trim();
  if (!userInput) return;

  const userMessage = createMessageBubble(userInput, 'user-message');
  chatArea.appendChild(userMessage);
  scrollChatToBottom();

  const sourceLang = sourceLangSelect.value;
  const targetLangs = selectedTargetLanguages;
  const isTutorMode = tutorModeToggle.checked;

  if (targetLangs.length === 0) {
    const errorMessage = createMessageBubble("Please select at least one target language.", 'ai-message');
    chatArea.appendChild(errorMessage);
    userInputTextarea.value = '';
    scrollChatToBottom();
    return;
  }

  chrome.runtime.sendMessage({
    action: 'processInput',
    userInput: userInput,
    sourceLanguage: sourceLang,
    targetLanguages: targetLangs,
    isTutorMode: isTutorMode
  }, (response) => {
    if (response) {
      displayAiResults(response, isTutorMode);
    } else {
      const errorMessage = createMessageBubble("AI service did not respond, please try again later.", 'ai-message');
      chatArea.appendChild(errorMessage);
      scrollChatToBottom();
    }
  });

  userInputTextarea.value = '';
  userInputTextarea.style.height = '60px'; // Reset height
});

// Listen for Ctrl + Enter to send, Enter for newline
userInputTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// Auto-expanding textarea
userInputTextarea.addEventListener('input', () => {
  userInputTextarea.style.height = 'auto';
  userInputTextarea.style.height = `${userInputTextarea.scrollHeight}px`;
});

// Chat list scroll effect
function scrollChatToBottom() {
  chatArea.scrollTo({
    top: chatArea.scrollHeight,
    behavior: 'smooth'
  });
}

// Header auto-hide on scroll
const header = document.querySelector('.header');
let lastScrollTop = 0;

chatArea.addEventListener('scroll', () => {
  let scrollTop = chatArea.scrollTop;
  const headerHeight = header.offsetHeight;

  // If scrolled close to the top, show header
  if (scrollTop < headerHeight) {
    header.classList.remove('header-hidden');
  } 
  // If scrolling down and away from the top, hide header
  else if (scrollTop > lastScrollTop) {
    header.classList.add('header-hidden');
  }
  
  lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

chatArea.addEventListener('mousemove', (event) => {
  const headerHeight = header.offsetHeight;
  if (event.clientY < headerHeight) {
    header.classList.remove('header-hidden');
  }
});

// Listen for changes in session storage (e.g., from content script)
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && changes.capturedContent) {
    const newContent = changes.capturedContent.newValue;
    if (newContent && newContent.text) {
      console.log('Popup script: Captured content updated via storage change.', newContent);
      userInputTextarea.value = newContent.text;
      console.log('Updated Captured URL:', newContent.url);
      console.log('Updated Captured Title:', newContent.title);
      userInputTextarea.dispatchEvent(new Event('input'));
      console.log('Popup script: Attempting to click send button with text:', userInputTextarea.value);
      sendBtn.click(); // Automatically trigger send
    } else {
      console.log('Popup script: Captured content cleared or invalid via storage change.');
    }
  }
});