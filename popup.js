// 获取DOM元素
const sourceLangSelect = document.getElementById('source-language');
const targetLangSelect = document.getElementById('target-languages');
const chatArea = document.getElementById('chat-area');
const userInputTextarea = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const tutorModeToggle = document.getElementById('tutor-mode-toggle');

// 定义支持的语言
const languages = ['Chinese', 'English', 'Greek'];

// 填充下拉菜单
function populateLanguages() {
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    sourceLangSelect.appendChild(option);
  });
  // 目标语言多选，这里简化处理，可以后续添加
}

// 在页面加载时调用
populateLanguages();

// 发送消息的函数
sendBtn.addEventListener('click', () => {
  const userInput = userInputTextarea.value;
  if (!userInput) return;

  const sourceLang = sourceLangSelect.value;
  const targetLangs = Array.from(targetLangSelect.selectedOptions).map(option => option.value);
  const isTutorMode = tutorModeToggle.checked;

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
      console.log('Response from background:', response);
      // 在这里添加将翻译结果显示到chatArea的逻辑
    }
  });

  // 清空输入框
  userInputTextarea.value = '';
});

// 这里只是前端的骨架，真正调用AI的逻辑在background.js中
