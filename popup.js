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
const languages = ['Chinese', 'English', 'Greek' , 'French' ,  'German' , 'Japanese', 'Korean'];

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
  
  // 这部分逻辑将由 loadSettings() 处理，因此从这里移除
  // updateSelectedTargetLanguages();
}

// 更新显示已选中的目标语言
function updateSelectedTargetLanguages() {
  selectedTargetLanguages = Array.from(targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                               .map(checkbox => checkbox.value);
  //TODO：添加：保存新的selectedTargetLanguages[]
  saveSettings();
  
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

// --- 新增: 保存和加载设置 ---
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
      //TODO：修改：根据记录选中源语言
      if (sourceLanguage) {
        sourceLangSelect.value = sourceLanguage;
      }
      
      //TODO：添加：根据记录的语言项更新selectedTargetLanguages[]
      selectedTargetLanguages = targetLanguages || [];
      tutorModeToggle.checked = isTutorMode;
      const checkboxes = targetLangOptionsContainer.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        checkbox.checked = selectedTargetLanguages.includes(checkbox.value);
      });
    }
    // 确保加载后立即更新语言可用性
    updateTargetLanguagesAvailability();
  });
}

// --- 关键修复点: 统一处理语言选项的点击事件 ---
targetLangOptionsContainer.addEventListener('click', (event) => {
  const clickedOption = event.target.closest('.custom-select-option');
  if (clickedOption) {
    const checkbox = clickedOption.querySelector('input[type="checkbox"]');
    // 如果复选框未被禁用，则切换其选中状态并更新UI
    if (checkbox && !checkbox.disabled) {
      // 检查点击的元素是否是label或checkbox本身
      // 如果是，其默认行为会处理选中状态。我们只负责更新UI。
      // 如果不是，我们手动切换选中状态，并更新UI。
      if (event.target !== checkbox && event.target !== clickedOption.querySelector('label')) {
        checkbox.checked = !checkbox.checked;
      }
      // 无论如何，都调用更新函数来确保UI与选中状态同步
      updateSelectedTargetLanguages();	  
    }
  }
});
// ---------------------------------------------


// 监听源语言下拉菜单的变化
sourceLangSelect.addEventListener('change', () => {
  updateTargetLanguagesAvailability();
  //TODO：添加：保存新的源语言
  saveSettings();
});

// 监听助教模式开关的变化
tutorModeToggle.addEventListener('change', saveSettings);

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
document.addEventListener('DOMContentLoaded', () => {
  populateLanguages();
  loadSettings();
});

// 动态创建消息气泡并添加到聊天区域
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
      // 如果结果已存在，不再重复调用，并直接返回
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
          checkResult.textContent = `校验 (EN): ${response.text}`;
          messageEl.appendChild(checkResult);
          messageEl.classList.add('has-reverse-check');
        } else {
          const checkResult = document.createElement('div');
          checkResult.classList.add('reverse-check-result');
          checkResult.textContent = `校验失败。`;
          messageEl.appendChild(checkResult);
          messageEl.classList.add('has-reverse-check');
        }
      });
    });
  }
  return messageEl;
}

// 显示 AI 翻译结果
function displayAiResults(data, isTutorMode) {
  if (isTutorMode && data.mode === 'tutor' && data.corrected_text) {
    const correctedUserMessage = createMessageBubble(`AI 校正:  ${data.corrected_text}`, 'ai-message', data.corrected_text);
    chatArea.appendChild(correctedUserMessage);
  }
  
  if (data.translations) {
    for (const lang in data.translations) {
      const translation = data.translations[lang];
      const translatedMessage = createMessageBubble(`${lang}:  ${translation}`, 'ai-message', translation);
      chatArea.appendChild(translatedMessage);
    }
  } else if (data.error) {
    const errorMessage = createMessageBubble(`错误:  ${data.error}`, 'ai-message');
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
