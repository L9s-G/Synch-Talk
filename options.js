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

  // Control the state of the save button (enabled/disabled)
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

  // Show or hide the corresponding input fields and button state based on the selected provider
  function updateUI() {
    if (providerSelect.value === 'gemini') {
      geminiSettingsGroup.style.display = 'block';
      openAiSettingsGroup.style.display = 'none';
    } else {
      geminiSettingsGroup.style.display = 'none';
      openAiSettingsGroup.style.display = 'block';
    }
    // Disable the save button by default when switching providers
    updateSaveButtonState(false);
  }

  // Load saved settings from storage when the page loads
  chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel'], (data) => {
    if (data.aiProvider) {
      providerSelect.value = data.aiProvider;
    }
    if (data.geminiApiKey) {
      geminiApiKeyInput.value = data.geminiApiKey;
      // If a key is already saved, enable the save button by default
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

  // Listen for changes in the provider selection dropdown
  providerSelect.addEventListener('change', updateUI);

  // Listen for changes in input fields; any change disables the save button
  [geminiApiKeyInput, openAiUrlInput, openAiApiKeyInput, openAiModelInput].forEach(input => {
    input.addEventListener('input', () => updateSaveButtonState(false));
  });

  // Test button event listener
  testButton.addEventListener('click', () => {
    const provider = providerSelect.value;
    let requestData = { action: 'testApi', provider: provider };
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
    
    statusDiv.textContent = 'Testing API configuration...';
    statusDiv.classList.remove('error', 'success');
    statusDiv.style.display = 'block';
    updateSaveButtonState(false);

    chrome.runtime.sendMessage(requestData, (response) => {
      if (response && response.success) {
        statusDiv.textContent = 'API configuration successful!';
        statusDiv.classList.remove('error');
        statusDiv.classList.add('success');
        updateSaveButtonState(true); // Enable save button after successful test
      } else {
        statusDiv.textContent = `API configuration failed: ${response.error || 'Unknown error'}`;
        statusDiv.classList.remove('success');
        statusDiv.classList.add('error');
        updateSaveButtonState(false);
      }
    });
  });

  // Save button event listener
  saveButton.addEventListener('click', () => {
    if (saveButton.disabled) return; // Double-check to prevent saving without testing

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
