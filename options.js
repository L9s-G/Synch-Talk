document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  // 页面加载时，从存储中加载已保存的密钥
  chrome.storage.local.get('geminiApiKey', (data) => {
    if (data.geminiApiKey) {
      apiKeyInput.value = data.geminiApiKey;
    }
  });

  saveButton.addEventListener('click', () => {
    const apiKey = apiKeyInput.value;
    if (apiKey) {
      // 使用 chrome.storage.local 存储密钥
      chrome.storage.local.set({ geminiApiKey: apiKey }, () => {
        statusDiv.textContent = 'API 密钥保存成功！';
        statusDiv.classList.remove('error');
        statusDiv.classList.add('success');
        statusDiv.style.display = 'block';
      });
    } else {
      statusDiv.textContent = '请输入有效的 API 密钥。';
      statusDiv.classList.remove('success');
      statusDiv.classList.add('error');
      statusDiv.style.display = 'block';
    }
  });
});
