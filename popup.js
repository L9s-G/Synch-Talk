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
  // 填充源语言下拉菜单
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    sourceLangSelect.appendChild(option);
  });

  // 填充目标语言下拉菜单
  languages.forEach(lang => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = lang;
    targetLangSelect.appendChild(option);
  });
}

// 禁用目标语言下拉菜单中的源语言选项
function updateTargetLanguages() {
  const selectedSourceLang = sourceLangSelect.value;
  // 遍历所有目标语言选项
  Array.from(targetLangSelect.options).forEach(option => {
    if (option.value === selectedSourceLang) {
      option.disabled = true; // 禁用源语言选项
      option.style.color = '#aaa'; // 灰化显示
    } else {
      option.disabled = false;
      option.style.color = '#000'; // 恢复正常颜色
    }
  });
}

// 监听源语言下拉菜单的变化
sourceLangSelect.addEventListener('change', updateTargetLanguages);

// 在页面加载时调用
populateLanguages();
updateTargetLanguages(); // 页面加载时也执行一次更新

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
