document.addEventListener('DOMContentLoaded', () => {
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

  // 控制保存按钮的状态（可用/禁用）
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

  // 根据用户选择的服务商显示或隐藏相应的输入框和按钮状态
  function updateUI() {
    if (providerSelect.value === 'gemini') {
      geminiSettingsGroup.style.display = 'block';
      openAiSettingsGroup.style.display = 'none';
    } else {
      geminiSettingsGroup.style.display = 'none';
      openAiSettingsGroup.style.display = 'block';
    }
    // 切换服务商时，都默认禁用保存按钮
    updateSaveButtonState(false);
  }

  // 页面加载时，从存储中加载已保存的设置
  chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel'], (data) => {
    if (data.aiProvider) {
      providerSelect.value = data.aiProvider;
    }
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey;
      // 如果已保存密钥，则默认启用保存按钮
      if (data.aiProvider === 'gemini' && data.geminiApiKey) {
        updateSaveButtonState(true);
      }
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
    updateUI();
  });

  // 监听服务商选择下拉菜单的变化
  providerSelect.addEventListener('change', updateUI);

  // 监听输入框的变化，任何更改都会禁用保存按钮
  [geminiApiKeyInput, openAiUrlInput, openAiApiKeyInput, openAiModelInput].forEach(input => {
    input.addEventListener('input', () => updateSaveButtonState(false));
  });

  // 测试按钮事件监听器
  testButton.addEventListener('click', () => {
    const provider = providerSelect.value;
    let requestData = { action: 'testApi', provider: provider };
    let isValid = true;

    if (provider === 'gemini') {
      const apiKey = geminiApiKeyInput.value.trim();
      if (!apiKey) {
        isValid = false;
        statusDiv.textContent = '请输入 Gemini API 密钥。';
      }
      requestData.apiKey = apiKey;
    } else if (provider === 'openai') {
      const url = openAiUrlInput.value.trim();
      const apiKey = openAiApiKeyInput.value.trim();
      const model = openAiModelInput.value.trim();
      if (!url || !apiKey || !model) {
        isValid = false;
        statusDiv.textContent = '请填写所有 OpenAI-兼容接口设置。';
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
    
    statusDiv.textContent = '正在测试API配置...';
    statusDiv.classList.remove('error', 'success');
    statusDiv.style.display = 'block';
    updateSaveButtonState(false);

    chrome.runtime.sendMessage(requestData, (response) => {
      if (response && response.success) {
        statusDiv.textContent = 'API配置成功！';
        statusDiv.classList.remove('error');
        statusDiv.classList.add('success');
        updateSaveButtonState(true); // 测试成功后启用保存按钮
      } else {
        statusDiv.textContent = `API配置失败: ${response.error || '未知错误'}`;
        statusDiv.classList.remove('success');
        statusDiv.classList.add('error');
        updateSaveButtonState(false);
      }
    });
  });

  // 保存按钮事件监听器
  saveButton.addEventListener('click', () => {
    if (saveButton.disabled) return; // 双重检查，防止未测试直接保存

    const provider = providerSelect.value;
    const settingsToSave = { aiProvider: provider };

    if (provider === 'gemini') {
      settingsToSave.geminiApiKey = geminiApiKeyInput.value;
    } else {
      settingsToSave.openAiUrl = openAiUrlInput.value;
      settingsToSave.openAiApiKey = openAiApiKeyInput.value;
      settingsToSave.openAiModel = openAiModelInput.value;
    }

    chrome.storage.local.set(settingsToSave, () => {
      statusDiv.textContent = '设置保存成功！';
      statusDiv.classList.remove('error');
      statusDiv.classList.add('success');
      statusDiv.style.display = 'block';
      setTimeout(() => {
        statusDiv.style.display = 'none';
      }, 3000);
    });
  });
});
