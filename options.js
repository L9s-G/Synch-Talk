document.addEventListener('DOMContentLoaded', () => {
  // 获取所有需要操作的DOM元素
  const providerSelect = document.getElementById('providerSelect');
  const geminiSettingsGroup = document.getElementById('gemini-settings-group');
  const openAiSettingsGroup = document.getElementById('openai-settings-group');
  const cfSettingsGroup = document.getElementById('cloudflare-settings-group');
  const geminiApiKeyInput = document.getElementById('geminiApiKey');
  const openAiUrlInput = document.getElementById('openAiUrl');
  const openAiApiKeyInput = document.getElementById('openAiApiKey');
  const openAiModelInput = document.getElementById('openAiModel');
  const geminiModel = document.getElementById('geminiModel');
  const cfGatewayUrlInput = document.getElementById('cfGatewayUrl');
  const cfApiKeyInput = document.getElementById('cfApiKey');
  const cfModelInput = document.getElementById('cfModel');
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
      cfSettingsGroup.style.display = 'none';
    } else if (providerSelect.value === 'openai') {
      geminiSettingsGroup.style.display = 'none';
      openAiSettingsGroup.style.display = 'block';
      cfSettingsGroup.style.display = 'none';
    } else {
      geminiSettingsGroup.style.display = 'none';
      openAiSettingsGroup.style.display = 'none';
      cfSettingsGroup.style.display = 'block';
    }
    // 切换提供商后，默认禁用保存按钮，鼓励用户先测试再保存。
    updateSaveButtonState(false);
  }

  // 页面加载时，从Chrome存储中加载已保存的设置
  chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'geminiModel', 'openAiUrl', 'openAiApiKey', 'openAiModel', 'cfGatewayUrl', 'cfApiKey', 'cfModel'], (data) => {
    if (data.aiProvider) {
      providerSelect.value = data.aiProvider;
    }
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey;
    }
    if (data.geminiModel) {
      geminiModel.value = data.geminiModel;
    }
    if (data.openAiUrl) {
      openAiUrlInput.value = data.openAiUrl;
    }
    if (data.openAiApiKey) {
      openAiApiKeyInput.value = data.openAiApiKey;
    }
    if (data.openAiModel) {
      openAiModelInput.value = data.openAiModel;
    }
    if (data.cfGatewayUrl) {
      cfGatewayUrlInput.value = data.cfGatewayUrl;
    }
    if (data.cfApiKey) {
      cfApiKeyInput.value = data.cfApiKey;
    }
    if (data.cfModel) {
      cfModelInput.value = data.cfModel;
    }

    // 先根据提供商切换显示区域（updateUI 会重置保存按钮为禁用）
    updateUI();

    // 若当前提供商的所有必要字段都已存在，则启用保存按钮
    const provider = data.aiProvider || 'gemini';
    let canSave = false;
    if (provider === 'gemini' && data.geminiApiKey && data.geminiModel) {
      canSave = true;
    } else if (provider === 'openai' && data.openAiUrl && data.openAiApiKey && data.openAiModel) {
      canSave = true;
    } else if (provider === 'cloudflare' && data.cfGatewayUrl && data.cfApiKey && data.cfModel) {
      canSave = true;
    }
    updateSaveButtonState(canSave);
  });

  // 监听提供商下拉框的变动
  providerSelect.addEventListener('change', updateUI);

  // 监听所有输入框的输入事件，任何改动都会禁用保存按钮，直到用户重新测试。
  [geminiApiKeyInput, openAiUrlInput, openAiApiKeyInput, openAiModelInput, geminiModel, cfGatewayUrlInput, cfApiKeyInput, cfModelInput].forEach(input => {
    input.addEventListener('input', () => updateSaveButtonState(false));
  });

  // “测试”按钮点击事件监听器
  testButton.addEventListener('click', () => {
    const provider = providerSelect.value;
    const requestData = { action: 'testApi', provider: provider };
    let isValid = true;

    if (provider === 'gemini') {
      const apiKey = geminiApiKeyInput.value.trim();
      const model = geminiModel.value;
      if (!apiKey) {
        isValid = false;
        statusDiv.textContent = 'Please enter your Gemini API key.';
      }
      requestData.apiKey = apiKey;
      requestData.model = model;
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
    } else if (provider === 'cloudflare') {
      const url = cfGatewayUrlInput.value.trim();
      const apiKey = cfApiKeyInput.value.trim();
      const model = cfModelInput.value.trim();
      if (!url || !apiKey || !model) {
        isValid = false;
        statusDiv.textContent = 'Please fill in all CloudFlare Gateway settings.';
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
      settingsToSave.geminiModel = geminiModel.value;
    } else if (provider === 'openai') {
      settingsToSave.openAiUrl = openAiUrlInput.value;
      settingsToSave.openAiApiKey = openAiApiKeyInput.value;
      settingsToSave.openAiModel = openAiModelInput.value;
    } else if (provider === 'cloudflare') {
      settingsToSave.cfGatewayUrl = cfGatewayUrlInput.value;
      settingsToSave.cfApiKey = cfApiKeyInput.value;
      settingsToSave.cfModel = cfModelInput.value;
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
