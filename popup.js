// 获取DOM元素
const sourceLangSelect = document.getElementById('source-language');
const targetLangTrigger = document.getElementById('target-languages-display');
const targetLangOptionsContainer = document.getElementById('target-languages-options');
const targetLangContainer = document.getElementById('target-language-select-container');
const chatArea = document.getElementById('chat-area');
const userInputTextarea = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const tutorModeToggle = document.getElementById('tutor-mode-toggle');

// 定义支持的语言
const languages = ['Chinese', 'English', 'Greek'];

// 用于存储当前选中的目标语言
let selectedTargetLanguages = [];

// 填充源语言下拉菜单和自定义目标语言菜单
function populateLanguages() {
  languages.forEach(lang => {
    const sourceOption = document.createElement('option');
    sourceOption.value = lang;
    sourceOption.textContent = lang;
    sourceLangSelect.appendChild(sourceOption);
  });
  sourceLangSelect.value = 'Chinese';

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

    if (lang === 'English' || lang === 'Greek') {
      checkbox.checked = true;
      selectedTargetLanguages.push(lang);
    }

    // 关键修改点：将事件监听器绑定到整个 optionDiv
    optionDiv.addEventListener('click', (event) => {
      // 如果点击的是label或checkbox本身，则让其默认行为处理
      if (event.target === checkbox || event.target === label) {
        if (optionDiv.classList.contains('disabled')) {
          event.preventDefault();
        }
        return;
      }
      
      // 如果点击的是行背景，切换checkbox状态
      if (!checkbox.disabled) {
        checkbox.checked = !checkbox.checked;
        updateSelectedTargetLanguages();
      }
    });
  });
  updateSelectedTargetLanguages();
}

// 更新显示已选中的目标语言
function updateSelectedTargetLanguages() {
  selectedTargetLanguages = Array.from(targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.value);
  
  if (selectedTargetLanguages.length === 0) {
    targetLangTrigger.textContent = '请选择目标语言';
  } else {
    targetLangTrigger.textContent = selectedTargetLanguages.join(', ');
  }
}

// 禁用或启用目标语言选项
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


// 监听源语言下拉菜单的变化
sourceLangSelect.addEventListener('change', updateTargetLanguagesAvailability);

// 点击触发器显示/隐藏目标语言选项
targetLangTrigger.addEventListener('click', (event) => {
  event.stopPropagation();
  targetLangOptionsContainer.classList.toggle('open');
  targetLangTrigger.classList.toggle('open');
  
  // 定位下拉框到触发器下方
  const rect = targetLangTrigger.getBoundingClientRect();
  targetLangOptionsContainer.style.top = `${rect.bottom + window.scrollY}px`;
  targetLangOptionsContainer.style.left = `${rect.left + window.scrollX}px`;
  targetLangOptionsContainer.style.width = `${rect.width}px`;
});

// 点击文档其他地方隐藏目标语言选项
document.addEventListener('click', (event) => {
  if (!targetLangContainer.contains(event.target)) {
    targetLangOptionsContainer.classList.remove('open');
    targetLangTrigger.classList.remove('open');
  }
});

// 在页面加载时调用
populateLanguages();
updateTargetLanguagesAvailability();

// 动态创建消息气泡并添加到聊天区域
function createMessageBubble(text, className, originalFullText = null) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', className);

  const textContent = document.createElement('p');
  textContent.textContent = text;
  messageEl.appendChild(textContent);

  if (className === 'ai-message') {
    const checkBtn = document.createElement('button');
    checkBtn.textContent = '校验';
    checkBtn.classList.add('reverse-check-btn');
    messageEl.appendChild(checkBtn);

    checkBtn.addEventListener('click', () => {
      if (messageEl.querySelector('.reverse-check-result')) {
        messageEl.querySelector('.reverse-check-result').remove();
      }
      chrome.runtime.sendMessage({
        action: 'reverseCheck',
        textToTranslate: originalFullText || text
      }, (response) => {
        if (response && response.text) {
          const checkResult = document.createElement('div');
          checkResult.classList.add('reverse-check-result');
          checkResult.textContent = `反向校验 (EN): ${response.text}`;
          messageEl.appendChild(checkResult);
        } else {
          const checkResult = document.createElement('div');
          checkResult.classList.add('reverse-check-result');
          checkResult.textContent = `反向校验失败。`;
          messageEl.appendChild(checkResult);
        }
      });
    });
  }
  return messageEl;
}

// 显示 AI 翻译结果
function displayAiResults(data, isTutorMode) {
  if (isTutorMode && data.mode === 'tutor' && data.corrected_text) {
    const correctedUserMessage = createMessageBubble(`AI 校正: ${data.corrected_text}`, 'ai-message', data.corrected_text);
    chatArea.appendChild(correctedUserMessage);
  }
  
  if (data.translations) {
    for (const lang in data.translations) {
      const translation = data.translations[lang];
      const translatedMessage = createMessageBubble(`${lang}: ${translation}`, 'ai-message', translation);
      chatArea.appendChild(translatedMessage);
    }
  } else if (data.error) {
    const errorMessage = createMessageBubble(`错误: ${data.error}`, 'ai-message');
    chatArea.appendChild(errorMessage);
  }

  chatArea.scrollTop = chatArea.scrollHeight;
}

// 发送消息的函数
sendBtn.addEventListener('click', () => {
  const userInput = userInputTextarea.value.trim();
  if (!userInput) return;

  const userMessage = createMessageBubble(userInput, 'user-message');
  chatArea.appendChild(userMessage);

  const sourceLang = sourceLangSelect.value;
  const targetLangs = selectedTargetLanguages;
  const isTutorMode = tutorModeToggle.checked;

  if (targetLangs.length === 0) {
    const errorMessage = createMessageBubble("请至少选择一个目标语言。", 'ai-message');
    chatArea.appendChild(errorMessage);
    userInputTextarea.value = '';
    chatArea.scrollTop = chatArea.scrollHeight;
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
      const errorMessage = createMessageBubble("AI服务无响应，请稍后再试。", 'ai-message');
      chatArea.appendChild(errorMessage);
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  });

  userInputTextarea.value = '';
});

// 监听 Shift + Enter 发送，Enter 换行
userInputTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendBtn.click();
  }
});
