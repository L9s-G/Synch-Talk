document.addEventListener('DOMContentLoaded', () => {
  // 获取所有需要操作的DOM元素
  const providerSelect = document.getElementById('providerSelect');
  const geminiSettingsGroup = document.getElementById('gemini-settings-group');
  const openAiSettingsGroup = document.getElementById('openai-settings-group');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const openAiUrlInput = document.getElementById('openAiUrl');
  const openAiApiKeyInput = document.getElementById('openAiApiKey');
  const openAiModelInput = document.getElementById('openAiModel');
  const testButton = document.getElementById('testButton');
  const saveButton = document.getElementById('saveButton');
  const statusDiv = document.getElementById('status');

  /**
   * 更新“保存”按钮的启用/禁用状态和样式。
   * @param {boolean} isEnabled - 是否启用按钮。
   */
  function updateSaveButtonState(isEnabled) {
    if (isEnabled) {
      saveButton.disabled = false;
      saveButton.classList.remove('disabled-btn');
      saveButton.classList.add('enabled-btn');
    } else {
      saveButton.disabled = true;
      saveButton.classList.remove('enabled-btn');
      saveButton.classList.add('disabled-btn');
    }
  }

  /**
   * 根据下拉框中选择的AI提供商，显示或隐藏对应的设置区域。
   * 切换时默认禁用保存按钮，强制用户先测试新配置。
   */
  function updateUI() {
    if (providerSelect.value === 'gemini') {
      geminiSettingsGroup.style.display = 'block';
      openAiSettingsGroup.style.display = 'none';
    } else {
      geminiSettingsGroup.style.display = 'none';
      openAiSettingsGroup.style.display = 'block';
    }
    // 切换提供商后，默认禁用保存按钮，鼓励用户先测试再保存。
    updateSaveButtonState(false);
  }

  // 页面加载时，从Chrome存储中加载已保存的设置
  chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel'], (data) => {
    if (data.aiProvider) {
      providerSelect.value = data.aiProvider;
    }
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey;
    }
    if (data.openAiUrl) {
      openAiUrlInput.value = data.openAiUrl;
    }
    if (data.openAiApiKey) {
      openAiApiKeyInput.value = data.openAiApiKey;
      // 优化：如果加载时所有必要的设置都已存在，则直接启用保存按钮。
      if (data.aiProvider === 'gemini' && data.geminiApiKey) {
        updateSaveButtonState(true);
      }
    }
    if (data.openAiUrl) {
      openAiUrlInput.value = data.openAiUrl;
    }
    if (data.openAiModel) {
      openAiModelInput.value = data.openAiModel;
      if (data.aiProvider === 'openai' && data.openAiUrl && data.openAiApiKey && data.openAiModel) {
        updateSaveButtonState(true);
      }
    }
    // 根据加载的设置初始化UI显示
    updateUI();
  });

  // 监听提供商下拉框的变动
  providerSelect.addEventListener('change', updateUI);

  // 监听所有输入框的输入事件，任何改动都会禁用保存按钮，直到用户重新测试。
  [geminiApiKeyInput, openAiUrlInput, openAiApiKeyInput, openAiModelInput].forEach(input => {
    input.addEventListener('input', () => updateSaveButtonState(false));
  });

  // “测试”按钮点击事件监听器
  testButton.addEventListener('click', () => {
    const provider = providerSelect.value;
    const requestData = { action: 'testApi', provider: provider };
    let isValid = true;

    if (provider === 'gemini') {
      const apiKey = geminiApiKeyInput.value.trim();
      if (!apiKey) {
        isValid = false;
        statusDiv.textContent = 'Please enter your Gemini API key.';
      }
      requestData.apiKey = apiKey;
    } else if (provider === 'openai') {
      const url = openAiUrlInput.value.trim();
      const apiKey = openAiApiKeyInput.value.trim();
      const model = openAiModelInput.value.trim();
      if (!url || !apiKey || !model) {
        isValid = false;
        statusDiv.textContent = 'Please fill in all OpenAI-compatible interface settings.';
      }
      requestData.url = url;
      requestData.apiKey = apiKey;
      requestData.model = model;
    }

    if (!isValid) {
      statusDiv.classList.remove('success');
      statusDiv.classList.add('error');
      statusDiv.style.display = 'block';
      return;
    }

    // 更新状态提示，并禁用保存按钮直到测试结果返回
    statusDiv.textContent = 'Testing API configuration...';
    statusDiv.classList.remove('error', 'success');
    statusDiv.style.display = 'block';
    updateSaveButtonState(false);

    chrome.runtime.sendMessage(requestData, (response) => {
      if (response && response.success) {
        statusDiv.textContent = 'API configuration successful!';
        statusDiv.classList.remove('error');
        statusDiv.classList.add('success');
        updateSaveButtonState(true); // 测试成功后启用保存按钮
      } else {
        statusDiv.textContent = `API configuration failed: ${response.error || 'Unknown error'}`;
        statusDiv.classList.remove('success');
        statusDiv.classList.add('error');
        updateSaveButtonState(false);
      }
    });
  });

  // “保存”按钮点击事件监听器
  saveButton.addEventListener('click', () => {
    if (saveButton.disabled) return; // 如果按钮是禁用的，则不执行任何操作

    const provider = providerSelect.value;
    const settingsToSave = { aiProvider: provider };

    if (provider === 'gemini') {
      settingsToSave.geminiApiKey = geminiApiKeyInput.value;
    } else {
      settingsToSave.openAiUrl = openAiUrlInput.value;
      settingsToSave.openAiApiKey = openAiApiKeyInput.value;
      settingsToSave.openAiModel = openAiModelInput.value;
    }

    // 将设置保存到Chrome本地存储
    chrome.storage.local.set(settingsToSave, () => {
      statusDiv.textContent = 'Settings saved successfully!';
      statusDiv.classList.remove('error');
      statusDiv.classList.add('success');
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    });
  });
});
