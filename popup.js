// --- DOM元素获取 ---
const sourceLangSelect = document.getElementById('source-language');
const targetLangTrigger = document.getElementById('target-languages-display');
const targetLangOptionsContainer = document.getElementById('target-languages-options');
const targetLangContainer = document.getElementById('target-language-select-container');
const chatArea = document.getElementById('chat-area');
const userInputTextarea = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const tutorModeToggle = document.getElementById('tutor-mode-toggle');

// --- 全局变量和常量 ---
const languages = ['Chinese', 'English', 'Greek', 'French', 'German', 'Japanese', 'Korean'];
let selectedTargetLanguages = [];
let isTutorMode = false;

// --- 语言选择相关功能 ---

/**
 * 初始化时填充源语言和目标语言的下拉菜单。
 * 源语言使用标准的 <option> 元素。
 * 目标语言使用带复选框的自定义菜单项。
 */
function populateLanguages() {
  // 填充源语言下拉菜单
  languages.forEach(lang => {
    const sourceOption = document.createElement('option');
    sourceOption.value = lang;
    sourceOption.textContent = lang;
    sourceLangSelect.appendChild(sourceOption);
  });

  // 动态创建目标语言的多选菜单
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
}

/**
 * 从DOM中读取当前选中的目标语言，更新全局变量 `selectedTargetLanguages`，
 * 并更新显示区域的文本。
 */
function updateSelectedTargetLanguages() {
  selectedTargetLanguages = Array.from(targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]:checked'))
    .map(checkbox => checkbox.value);
  saveSettings();

  if (selectedTargetLanguages.length === 0) {
    targetLangTrigger.textContent = 'Please select target languages';
  } else {
    targetLangTrigger.textContent = selectedTargetLanguages.join(', ');
  }
}

/**
 * 根据当前选择的源语言，禁用或启用目标语言选项。
 * 规则：目标语言不能与源语言相同。
 * 调用此函数后会同步更新已选中的目标语言列表。
 */
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

// --- 设置的保存与加载 ---

/**
 * 将当前的用户设置（源语言、目标语言、导师模式）保存到 chrome.storage.local。
 */
function saveSettings() {
  const settings = {
    sourceLanguage: sourceLangSelect.value,
    targetLanguages: selectedTargetLanguages,
    isTutorMode: isTutorMode
  };
  chrome.storage.local.set({ settings });
}

/**
 * 从 chrome.storage.local 加载用户设置，并更新UI。
 */
function loadSettings() {
  chrome.storage.local.get('settings', (data) => {
    if (data.settings) {
      const { sourceLanguage, targetLanguages, isTutorMode: loadedTutorMode } = data.settings;
      if (sourceLanguage) {
        sourceLangSelect.value = sourceLanguage;
      }

      selectedTargetLanguages = targetLanguages || [];
      isTutorMode = loadedTutorMode;
      // 更新UI以反映加载的设置
      tutorModeToggle.classList.toggle('active', isTutorMode);
      const checkboxes = targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectedTargetLanguages.includes(checkbox.value);
      });
    }
    updateTargetLanguagesAvailability();
  });
}

// --- 事件监听器 ---

// 目标语言自定义下拉菜单的点击事件委托
targetLangOptionsContainer.addEventListener('click', (event) => {
  const clickedOption = event.target.closest('.custom-select-option');
  if (clickedOption) { // 确保点击的是一个选项
    const checkbox = clickedOption.querySelector('input[type="checkbox"]');
    if (checkbox && !checkbox.disabled) {
      // 如果点击的不是复选框本身或其标签，则手动切换复选框的选中状态
      if (event.target !== checkbox && event.target !== clickedOption.querySelector('label')) {
        checkbox.checked = !checkbox.checked;
      }
      updateSelectedTargetLanguages();
    }
  }
});

// 监听源语言下拉菜单的变化
sourceLangSelect.addEventListener('change', () => {
  updateTargetLanguagesAvailability();
  saveSettings();
});

// 监听导师模式开关的点击事件
tutorModeToggle.addEventListener('click', () => {
  isTutorMode = !isTutorMode;
  tutorModeToggle.classList.toggle('active', isTutorMode);
  saveSettings();
});

// 点击目标语言显示区域时，展开或收起自定义下拉菜单
targetLangTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  targetLangOptionsContainer.classList.toggle('open');
  targetLangTrigger.classList.toggle('open');

  const rect = targetLangTrigger.getBoundingClientRect();
  targetLangOptionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
  targetLangOptionsContainer.style.left = `${rect.left + window.scrollX}px`;
  targetLangOptionsContainer.style.width = `${rect.width}px`;
});

// 点击文档其他区域时，收起目标语言下拉菜单
document.addEventListener('click', (event) => {
  if (!targetLangContainer.contains(event.target)) {
    targetLangOptionsContainer.classList.remove('open');
    targetLangTrigger.classList.remove('open');
  }
});

// 页面加载完成后执行初始化操作
document.addEventListener('DOMContentLoaded', () => {
  populateLanguages();
  loadSettings();
  loadCapturedContent(); // 加载从内容脚本捕获的文本
});

// --- 聊天消息处理 ---

/**
 * 动态创建并返回一个消息气泡元素。
 * @param {string} text - 消息内容。
 * @param {string} className - 消息类型 ('user-message' 或 'ai-message')，用于样式和功能区分。
 * @param {string|null} originalFullText - 对于AI消息，这可以存储不带语言前缀的原始翻译文本，用于复制和反向校验。
 * @returns {HTMLElement} - 创建好的消息气泡DOM元素。
 */
function createMessageBubble(text, className, originalFullText = null) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', className);

  const textContent = document.createElement('p');
  textContent.textContent = text;
  messageEl.appendChild(textContent);

  // 为消息按钮创建一个容器，便于样式控制
  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('message-buttons');
  messageEl.appendChild(buttonContainer);

  if (className === 'ai-message') {
    // AI消息：添加“反向校验”按钮
    const checkBtn = document.createElement('button');
    checkBtn.classList.add('reverse-check-btn');
    checkBtn.title = 'Verify(EN)';
    buttonContainer.appendChild(checkBtn);

    // AI消息：添加“复制”按钮
    const copyBtn = document.createElement('button');
    copyBtn.classList.add('copy-btn');
    copyBtn.title = 'Copy';
    buttonContainer.appendChild(copyBtn);

    copyBtn.addEventListener('click', () => {
      // Extract the translation text (remove language prefix if present)
      let textToCopy = originalFullText || text;
      const colonIndex = textToCopy.indexOf(': ');
      if (colonIndex > 0) {
        textToCopy = textToCopy.substring(colonIndex + 2);
      }

      // Copy to clipboard
      navigator.clipboard.writeText(textToCopy).then(() => {
        // Visual feedback for successful copy
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.classList.remove('copied');
        }, 1500);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });

    checkBtn.addEventListener('click', () => {
      if (messageEl.querySelector('.reverse-check-result')) {
        return; // 如果已经校验过，则不再重复请求
      }

      // 点击后提供视觉反馈
      checkBtn.classList.add('checked');
      setTimeout(() => {
        checkBtn.classList.remove('checked');
      }, 1500);

      // 向后台脚本发送反向校验请求
      chrome.runtime.sendMessage({
        action: 'reverseCheck',
        // 优先使用不带前缀的原始文本进行校验
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
  } else if (className === 'user-message') {
    // 用户消息：添加“编辑”按钮
    const editBtn = document.createElement('button');
    editBtn.classList.add('edit-btn');
    editBtn.title = 'Edit';
    buttonContainer.appendChild(editBtn);

    editBtn.addEventListener('click', () => {
      // Extract user message text
      let textToEdit = text;

      // Fill the input textarea with the user message
      userInputTextarea.value = textToEdit;
      userInputTextarea.focus();

      // Visual feedback for successful edit
      editBtn.classList.add('edited');
      setTimeout(() => {
        editBtn.classList.remove('edited');
      }, 1500);

      // Trigger input event to auto-resize textarea
      userInputTextarea.dispatchEvent(new Event('input'));

      // Scroll to the input area
      userInputTextarea.scrollIntoView({ behavior: 'smooth' });
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

// “发送”按钮的点击事件
sendBtn.addEventListener('click', () => {
  const userInput = userInputTextarea.value.trim();
  if (!userInput) return;

  const userMessage = createMessageBubble(userInput, 'user-message');
  chatArea.appendChild(userMessage);
  scrollChatToBottom();

  const sourceLang = sourceLangSelect.value;
  const targetLangs = selectedTargetLanguages;


  // 如果未选择目标语言，则显示提示信息
  if (targetLangs.length === 0) {
    const errorMessage = createMessageBubble("Please select at least one target language.", 'ai-message');
    chatArea.appendChild(errorMessage);
    userInputTextarea.value = '';
    scrollChatToBottom();
    return;
  }

  // 向后台脚本发送处理请求
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
  userInputTextarea.style.height = '60px'; // 重置输入框高度
});

// 监听输入框的键盘事件，实现 Ctrl+Enter 发送消息
userInputTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendBtn.click();
  }
});

// --- UI交互与效果 ---

// 自动扩展文本输入框的高度
userInputTextarea.addEventListener('input', () => {
  userInputTextarea.style.height = 'auto';
  userInputTextarea.style.height = `${userInputTextarea.scrollHeight}px`;
});

// 将聊天区域滚动到底部
function scrollChatToBottom() {
  chatArea.scrollTo({
    top: chatArea.scrollHeight,
    behavior: 'smooth'
  });
}

// 聊天区域滚动时自动隐藏/显示顶部的语言选择栏
const header = document.querySelector('.header');
let lastScrollTop = 0;

// 注意：对于非常频繁的滚动，可以考虑使用 throttle (节流) 来优化性能。
chatArea.addEventListener('scroll', () => {
  let scrollTop = chatArea.scrollTop;
  const headerHeight = header.offsetHeight;

  if (scrollTop < headerHeight) {
    header.classList.remove('header-hidden');
  }
  else if (scrollTop > lastScrollTop) {
    header.classList.add('header-hidden');
  }

  lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
});

// 当鼠标移动到顶部区域时，也显示语言选择栏
chatArea.addEventListener('mousemove', (event) => {
  const headerHeight = header.offsetHeight;
  if (event.clientY < headerHeight) {
    header.classList.remove('header-hidden');
  }
});

// --- 与内容脚本的交互 ---

/**
 * 从会话存储(session storage)中加载由内容脚本捕获的文本。
 * 这在侧边栏打开时运行，用捕获到的文本预填充输入框。
 */
function loadCapturedContent() {
  chrome.storage.session.get(['capturedContent'], (result) => {
    if (result.capturedContent && result.capturedContent.text) {
      userInputTextarea.value = result.capturedContent.text;
      // 触发input事件以自动调整文本框高度
      userInputTextarea.dispatchEvent(new Event('input'));
    }
  });
}

/**
 * 监听会话存储的变化。当内容脚本捕获到新文本时，此函数会被触发。
 * 它会自动更新输入框内容并模拟点击发送按钮，实现“划词即翻译”的效果。
 */
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'session' && changes.capturedContent) {
    const newContent = changes.capturedContent.newValue;
    if (newContent && newContent.text) {
      userInputTextarea.value = newContent.text;
      userInputTextarea.dispatchEvent(new Event('input'));
      sendBtn.click(); // 自动触发发送
    }
  }
});
