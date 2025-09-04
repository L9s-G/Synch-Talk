// 核心提示词构建函数
function buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode) {
  const targetLanguagesString = targetLanguages.join(', ');
  
  // 优化点2: 在翻译示例中加入更精确的描述
  const translationsExample = targetLanguages.map(lang => `"${lang}": "${lang} Translation."`).join(',\n      ');

  // 优化点1: 使用JSON.stringify()安全地处理用户输入
  const safeUserInput = JSON.stringify(userInput);

  let prompt = `Translate the following text based on the given instructions.
  
  Source Language: ${sourceLanguage}
  Target Languages: ${targetLanguagesString}
  User Input: ${safeUserInput}
  
  Provide your output ONLY in a valid JSON format.`;

  if (isTutorMode) {
    prompt += `\n\n**MODE: AI TUTOR**
  Your task is to correct the user's input for natural phrasing in ${sourceLanguage}, then translate the corrected version.
  
  The JSON output should have a "mode" field ('tutor'), "corrected_text", and a "translations" object.
  {
    "mode": "tutor",
    "corrected_text": "The corrected and improved version of the input.",
    "translations": {
      ${translationsExample}
    }
  }`;
  } else {
    prompt += `\n\n**MODE: TRANSLATOR**
  Your task is to provide natural, idiomatic translations of the user's input.
  
  The JSON output should have a "mode" field ('translator') and a "translations" object.
  {
    "mode": "translator",
    "translations": {
      ${translationsExample}
    }
  }`;
  }

  return prompt;
}

// 反向校验提示词
function buildReverseCheckPrompt(textToTranslate) {
  // 优化点1: 使用JSON.stringify()安全地处理输入
  const safeTextToTranslate = JSON.stringify(textToTranslate);

  return `Translate the following text into conversational English, and provide ONLY the translation without any extra text.
  
  Text: ${safeTextToTranslate}`;
}

// 调用外部AI服务的通用函数
async function callGeminiApi(prompt) {
  const apiKeyData = await chrome.storage.local.get('geminiApiKey');
  const apiKey = apiKeyData.geminiApiKey;

  if (!apiKey) {
    console.error("API Key is not set in storage.");
    return { error: '请在选项页面设置您的 Gemini API 密钥。' };
  }

  const API_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

  const requestBody = {
    contents: [{
      parts: [{ text: prompt }]
    }]
  };

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    let textResponse = data.candidates[0].content.parts[0].text;
    
    if (textResponse.startsWith('```json')) {
      textResponse = textResponse.substring(7, textResponse.length - 3);
    }

    textResponse = textResponse.trim();

    try {
      return JSON.parse(textResponse);
    } catch (e) {
      return { text: textResponse };
    }

  } catch (error) {
    console.error("Gemini API call failed:", error);
    return { error: `Gemini API 调用失败: ${error.message}` };
  }
}

// 在扩展程序安装或更新时设置侧边栏的行为
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true
  });
});

// 监听工具栏图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// 处理来自popup.js的AI请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processInput') {
    const { userInput, sourceLanguage, targetLanguages, isTutorMode } = request;
    const prompt = buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode);
    
    callGeminiApi(prompt).then(response => {
      sendResponse(response);
    });
    return true;

  } else if (request.action === 'reverseCheck') {
    const { textToTranslate } = request;
    const prompt = buildReverseCheckPrompt(textToTranslate);

    callGeminiApi(prompt).then(response => {
      sendResponse(response);
    });
    return true;
  }
});
