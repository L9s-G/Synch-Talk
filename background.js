// background.js

// 核心提示词构建函数
function buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, isGemini) {
  const targetLanguagesString = targetLanguages.join(', ');
  const translationsExample = targetLanguages.map(lang => `"${lang}": "${lang} Translation."`).join(',\n      ');

  // 如果是Gemini，则使用JSON提示词
  if (isGemini) {
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
  
  // 如果是OpenAI，则使用更简洁的提示词
  else {
    const promptPrefix = `You are an expert translator.
    You will receive user input, a source language, and a list of target languages.
    Your task is to provide a translation based on the instructions below.
    The response must be a single, valid JSON object, and nothing else.
    Source Language: ${sourceLanguage}
    Target Languages: ${targetLanguagesString}
    `;

    const instructions = isTutorMode ? 
      `Correct the user's input for natural phrasing in ${sourceLanguage}, then translate the corrected version into all target languages. The JSON must contain "mode": "tutor", "corrected_text", and a "translations" object.` :
      `Translate the user's input into all target languages. The JSON must contain "mode": "translator" and a "translations" object.`;

    const jsonFormatExample = `the JSON should look like this:
    {
      "mode": "${isTutorMode ? "tutor" : "translator"}",
      ${isTutorMode ? '"corrected_text": "The corrected and improved version of the input.",' : ''}
      "translations": {
        ${translationsExample}
      }
    }`;
    
    return `${promptPrefix}\n\nInstructions: ${instructions}\n\n${jsonFormatExample}`;
  }
}

// 反向校验提示词构建函数
function buildReverseCheckPrompt(textToTranslate) {
  const safeTextToTranslate = JSON.stringify(textToTranslate);
  return `Translate the following text into conversational English, and provide ONLY the translation without any extra text.
  Text: ${safeTextToTranslate}`;
}

// 辅助函数：统一处理模型返回的格式，移除markdown和多余逗号
function cleanApiResponse(text) {
  // 移除 markdown 代码块标记
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let cleanedText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // 移除多余的逗号
  cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');

  // 如果是JSON，尝试解析
  try {
    const parsed = JSON.parse(cleanedText);
    if (parsed.text) {
      return parsed.text.trim();
    }
    // 否则返回原始文本
    return cleanedText;
  } catch (e) {
    // 不是JSON，直接返回
    return cleanedText;
  }
}

// 辅助函数：统一处理API调用
async function makeApiCall(provider, endpoint, headers, body) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error Response from ${provider}:`, errorText);
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error(`API call to ${provider} failed:`, error);
    return { error: `无法连接到 ${provider} API: ${error.message}` };
  }
}

// ---- API 核心功能函数 ----

// 处理翻译和助教模式
async function processAiInput(userInput, sourceLanguage, targetLanguages, isTutorMode) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel']);
  const provider = settings.aiProvider || 'gemini';

  let prompt;
  let apiResponse;
  let responseData;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: '请在选项页面设置您的 Gemini API 密钥。' };
    }
    prompt = buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, true);
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);

    if (apiResponse.error) return apiResponse;
    const cleanedContent = cleanApiResponse(apiResponse.candidates[0].content.parts[0].text);
    
    try {
      responseData = JSON.parse(cleanedContent);
    } catch (e) {
      return { error: `Gemini API 返回的JSON格式无效: ${e.message}` };
    }

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: '请在选项页面设置您的 OpenAI-兼容 API 地址、密钥和模型。' };
    }
    prompt = buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, false);
    const body = {
      model: openAiModel,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: prompt }, { role: "user", content: userInput }]
    };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiApiKey}` };
    apiResponse = await makeApiCall('OpenAI', openAiUrl, headers, body);
    
    if (apiResponse.error) return apiResponse;
    const cleanedContent = cleanApiResponse(apiResponse.choices[0].message.content);

    try {
      responseData = JSON.parse(cleanedContent);
    } catch (e) {
      return { error: `OpenAI API 返回的JSON格式无效: ${e.message}` };
    }

  } else {
    return { error: '未知的AI服务提供商。' };
  }
  return responseData;
}

// 反向校验
async function performReverseCheck(textToTranslate) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel']);
  const provider = settings.aiProvider || 'gemini';

  const prompt = buildReverseCheckPrompt(textToTranslate);
  let apiResponse;
  let content;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: '请在选项页面设置您的 Gemini API 密钥以使用反向校验功能。' };
    }
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);
    if (apiResponse.error) return apiResponse;
    content = apiResponse.candidates[0].content.parts[0].text;

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: '请在选项页面设置您的 OpenAI-兼容 API 以使用反向校验功能。' };
    }
    const body = { model: openAiModel, messages: [{ role: "user", content: prompt }] };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiApiKey}` };
    apiResponse = await makeApiCall('OpenAI', openAiUrl, headers, body);
    if (apiResponse.error) return apiResponse;
    content = apiResponse.choices[0].message.content;

  } else {
    return { error: '未知的AI服务提供商。' };
  }
  
  // 对返回结果进行清理，确保是纯文本
  const cleanedText = cleanApiResponse(content);
  
  return { text: cleanedText.trim() };
}

// 测试API
async function testApi(provider, settings) {
  let prompt, body, headers, endpoint;

  if (provider === 'gemini') {
    if (!settings.apiKey) return { success: false, error: '请输入 Gemini API 密钥。' };
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { contents: [{ parts: [{ text: prompt }] }] };
    headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.apiKey };
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    
  } else if (provider === 'openai') {
    if (!settings.url || !settings.apiKey || !settings.model) {
      return { success: false, error: '请填写所有 OpenAI-兼容接口设置。' };
    }
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { model: settings.model, messages: [{ role: "user", content: prompt }] };
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` };
    endpoint = settings.url;
    
  } else {
    return { success: false, error: '不支持测试此服务商。' };
  }

  const apiResponse = await makeApiCall(provider, endpoint, headers, body);
  if (apiResponse.error) {
    return { success: false, error: apiResponse.error };
  }

  let content;
  if (provider === 'gemini') {
    content = apiResponse.candidates[0].content.parts[0].text;
  } else {
    content = apiResponse.choices[0].message.content;
  }
  
  // 对测试结果进行清理，以确保逻辑正常
  const cleanedContent = cleanApiResponse(content);
  
  if (cleanedContent && cleanedContent.trim().toLowerCase().includes('ok')) {
    return { success: true, message: 'API配置成功！' };
  } else {
    return { success: false, error: `API返回非预期响应: ${cleanedContent}` };
  }
}

// ---- Chrome 扩展程序事件监听器 ----

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

// 处理来自popup.js和options.js的请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processInput') {
    const { userInput, sourceLanguage, targetLanguages, isTutorMode } = request;
    processAiInput(userInput, sourceLanguage, targetLanguages, isTutorMode).then(sendResponse);
    return true;
  } else if (request.action === 'reverseCheck') {
    const { textToTranslate } = request;
    performReverseCheck(textToTranslate).then(sendResponse);
    return true;
  } else if (request.action === 'testApi') {
    const { provider, ...settings } = request;
    testApi(provider, settings).then(sendResponse);
    return true;
  }
});
