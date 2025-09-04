// 获取DOM元素
const sourceLangSelect = document.getElementById('source-language');
const targetLangSelect = document.getElementById('target-languages');
const chatArea = document.getElementById('chat-area');
const userInputTextarea = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const tutorModeToggle = document.getElementById('tutor-mode-toggle');

// 定义支持的语言
const languages = ['Chinese', 'English', 'Greek']; // 我们最初设定的语言

// 填充下拉菜单
function populateLanguages() {
  languages.forEach(lang => {
    const sourceOption = document.createElement('option');
    sourceOption.value = lang;
    sourceOption.textContent = lang;
    sourceLangSelect.appendChild(sourceOption);

    const targetOption = document.createElement('option');
    targetOption.value = lang;
    targetOption.textContent = lang;
    targetLangSelect.appendChild(targetOption);
  });
  // 默认选中一些项，方便测试
  sourceLangSelect.value = 'Chinese'; // 默认源语言
  // 默认选中英文和希腊语作为目标语言
  Array.from(targetLangSelect.options).forEach(option => {
    if (option.value === 'English' || option.value === 'Greek') {
      option.selected = true;
    }
  });
}

// 禁用目标语言下拉菜单中的源语言选项，并处理默认选择
function updateTargetLanguages() {
  const selectedSourceLang = sourceLangSelect.value;
  Array.from(targetLangSelect.options).forEach(option => {
    if (option.value === selectedSourceLang) {
      option.disabled = true; // 禁用源语言选项
      option.style.color = '#aaa'; // 灰化显示
      // 如果禁用的选项之前被选中了，则取消选中
      if (option.selected) {
        option.selected = false;
      }
    } else {
      option.disabled = false;
      option.style.color = '#e0e0e0'; // 恢复正常颜色
    }
  });
}

// 监听源语言下拉菜单的变化
sourceLangSelect.addEventListener('change', updateTargetLanguages);

// 在页面加载时调用
populateLanguages();
updateTargetLanguages(); // 页面加载时也执行一次更新

// 动态创建消息气泡并添加到聊天区域
function createMessageBubble(text, className, originalFullText = null) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', className);

  // 创建一个段落来包含文本，方便后续添加按钮
  const textContent = document.createElement('p');
  textContent.textContent = text;
  messageEl.appendChild(textContent);

  // 只有AI消息才需要反向校验按钮
  if (className === 'ai-message') {
    const checkBtn = document.createElement('button');
    checkBtn.textContent = '校验';
    checkBtn.classList.add('reverse-check-btn');
    messageEl.appendChild(checkBtn);

    checkBtn.addEventListener('click', () => {
      // 避免重复校验，如果已经有结果了，直接显示
      if (messageEl.querySelector('.reverse-check-result')) {
        messageEl.querySelector('.reverse-check-result').remove(); // 移除旧结果
      }
      // 向后台服务发送请求，进行反向校验
      chrome.runtime.sendMessage({
        action: 'reverseCheck',
        textToTranslate: originalFullText || text // 使用原始完整文本进行校验
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
  // 如果是AI助教模式，先显示校正后的用户输入
  if (isTutorMode && data.mode === 'tutor' && data.corrected_text) {
    const correctedUserMessage = createMessageBubble(`AI 校正: ${data.corrected_text}`, 'ai-message', data.corrected_text);
    chatArea.appendChild(correctedUserMessage);
  }
  
  // 显示翻译结果
  if (data.translations) {
    for (const lang in data.translations) {
      const translation = data.translations[lang];
      // originalFullText 参数用于反向校验，确保校验的是整个翻译结果
      const translatedMessage = createMessageBubble(`${lang}: ${translation}`, 'ai-message', translation);
      chatArea.appendChild(translatedMessage);
    }
  } else if (data.error) {
    const errorMessage = createMessageBubble(`错误: ${data.error}`, 'ai-message');
    chatArea.appendChild(errorMessage);
  }

  // 滚动到最新消息
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 发送消息的函数
sendBtn.addEventListener('click', () => {
  const userInput = userInputTextarea.value.trim(); // 去除首尾空格
  if (!userInput) return;

  // 将用户输入显示到聊天区域
  const userMessage = createMessageBubble(userInput, 'user-message');
  chatArea.appendChild(userMessage);

  const sourceLang = sourceLangSelect.value;
  const targetLangs = Array.from(targetLangSelect.selectedOptions).map(option => option.value);
  const isTutorMode = tutorModeToggle.checked;

  // 检查是否选择了目标语言
  if (targetLangs.length === 0) {
    const errorMessage = createMessageBubble("请至少选择一个目标语言。", 'ai-message');
    chatArea.appendChild(errorMessage);
    userInputTextarea.value = '';
    chatArea.scrollTop = chatArea.scrollHeight;
    return;
  }

  // 向后台服务发送消息，携带所有必要数据
  chrome.runtime.sendMessage({
    action: 'processInput',
    userInput: userInput,
    sourceLanguage: sourceLang,
    targetLanguages: targetLangs,
    isTutorMode: isTutorMode
  }, (response) => {
    // 接收后台服务的响应，并更新UI
    if (response) {
      displayAiResults(response, isTutorMode);
    } else {
      // 处理AI服务没有响应的情况
      const errorMessage = createMessageBubble("AI服务无响应，请稍后再试。", 'ai-message');
      chatArea.appendChild(errorMessage);
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  });

  // 清空输入框
  userInputTextarea.value = '';
});

// 监听 Shift + Enter 发送，Enter 换行
userInputTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); // 阻止默认的换行行为
    sendBtn.click(); // 触发发送按钮点击事件
  }
});
