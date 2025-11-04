// background.js

/**
 * 根据用户输入、语言设置和模式，为AI模型构建动态提示。
 * @param {string} userInput - 用户输入的文本。
 * @param {string} sourceLanguage - 源语言。
 * @param {string[]} targetLanguages - 目标语言数组。
 * @param {boolean} isTutorMode - 是否启用AI导师模式。
 * @param {boolean} isGemini - 是否为Gemini模型（影响提示格式）。
 * @returns {string} - 构建好的AI提示字符串。
 */
function buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, isGemini) {
  const targetLanguagesString = targetLanguages.join(', ');
  // 为JSON格式示例创建翻译占位符
  const translationsExample = targetLanguages.map(lang => `"${lang}": "${lang} Translation."`).join(',\n      ');

  // Gemini模型使用更详细的JSON格式化指令
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

  // OpenAI或兼容接口使用不同的提示结构
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

/**
 * 为“反向校验”功能构建提示，要求将文本翻译为自然对话式的英语。
 * @param {string} textToTranslate - 需要翻译以进行校验的文本。
 * @returns {string} - 构建好的AI提示字符串。
 */
function buildReverseCheckPrompt(textToTranslate) {
  const safeTextToTranslate = JSON.stringify(textToTranslate);
  return `Translate the following text into conversational English, and provide ONLY the translation without any extra text.
  Text: ${safeTextToTranslate}`;
}

/**
 * 清理和规范化来自AI API的响应文本。
 * 移除Markdown代码块、多余的逗号，并尝试解析为JSON。
 * @param {string} text - 从API获取的原始响应文本。
 * @returns {string|object} - 如果能解析为JSON，则返回解析后的对象或其中的'text'字段；否则返回清理后的字符串。
 */
function cleanApiResponse(text) {
  // 移除Markdown代码块标记 (```json ... ```)
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let cleanedText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // 移除JSON中可能导致解析错误的尾随逗号
  cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');

  // 尝试将清理后的文本解析为JSON
  try {
    const parsed = JSON.parse(cleanedText);
    // 如果解析后的对象有 'text' 属性（常见于简单文本响应），则直接返回其值
    if (parsed.text) {
      return parsed.text.trim();
    }
    // 否则返回整个解析后的对象
    return parsed;
  } catch (e) {
    // Not JSON, return directly
    return cleanedText;
  }
}

// Helper function: Standardize API call handling
/**
 * 封装的fetch调用，用于向AI服务发起API请求。
 * @param {string} provider - API提供商名称（如 'Gemini', 'OpenAI'），用于日志记录。
 * @param {string} endpoint - API的URL端点。
 * @param {object} headers - 请求头。
 * @param {object} body - 请求体（将被JSON.stringify）。
 * @returns {Promise<object>} - 返回一个包含API响应数据或错误信息的对象。
 */
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
    return { error: `Unable to connect to ${provider} API: ${error.message}` };
  }
}

// ---- API Core Functionality ----

/**
 * 处理AI输入的核心函数，根据用户设置调用不同的AI服务进行翻译或语法修正。
 * @param {string} userInput - 用户输入的文本。
 * @param {string} sourceLanguage - 源语言。
 * @param {string[]} targetLanguages - 目标语言数组。
 * @param {boolean} isTutorMode - 是否启用AI导师模式。
 * @returns {Promise<object>} - 返回一个包含翻译结果、修正文本或错误信息的对象。
 */
async function processAiInput(userInput, sourceLanguage, targetLanguages, isTutorMode) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel']);
  const provider = settings.aiProvider || 'gemini';

  let prompt;
  let apiResponse;
  let responseData;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: 'Please set your Gemini API key in the options page.' };
    }
    prompt = buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, true);
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    // 更新：使用 gemini-flash-lite-latest 模型以测试速度
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);

    if (apiResponse.error) return apiResponse;
    const cleanedContent = cleanApiResponse(apiResponse.candidates[0].content.parts[0].text);

    try {
      // cleanedContent可能已经是对象了
      responseData = typeof cleanedContent === 'string' ? JSON.parse(cleanedContent) : cleanedContent;
    } catch (e) {
      return { error: `Invalid JSON format returned by Gemini API: ${e.message}` };
    }

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: 'Please set your OpenAI-compatible API URL, key, and model in the options page.' };
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
      // cleanedContent可能已经是对象了
      responseData = typeof cleanedContent === 'string' ? JSON.parse(cleanedContent) : cleanedContent;
    } catch (e) {
      return { error: `Invalid JSON format returned by OpenAI API: ${e.message}` };
    }

  } else {
    return { error: 'Unknown AI service provider.' };
  }
  return responseData;
}

/**
 * 执行“反向校验”，将一段文本翻译回英语以供用户核对。
 * @param {string} textToTranslate - 需要被翻译的文本。
 * @returns {Promise<object>} - 返回一个包含翻译结果或错误信息的对象。
 */
async function performReverseCheck(textToTranslate) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'openAiUrl', 'openAiApiKey', 'openAiModel']);
  const provider = settings.aiProvider || 'gemini';

  const prompt = buildReverseCheckPrompt(textToTranslate);
  let apiResponse;
  let content;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: 'Please set your Gemini API key in the options page to use the reverse check function.' };
    }
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);
    if (apiResponse.error) return apiResponse;
    content = apiResponse.candidates[0].content.parts[0].text;

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: 'Please set your OpenAI-compatible API to use the reverse check function.' };
    }
    const body = { model: openAiModel, messages: [{ role: "user", content: prompt }] };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiApiKey}` };
    apiResponse = await makeApiCall('OpenAI', openAiUrl, headers, body);
    if (apiResponse.error) return apiResponse;
    content = apiResponse.choices[0].message.content;

  } else {
    return { error: 'Unknown AI service provider.' };
  }

  // Clean the response to ensure it is plain text
  const cleanedText = cleanApiResponse(content);

  return { text: cleanedText.trim() };
}

/**
 * 测试用户提供的API配置是否有效。
 * @param {string} provider - AI提供商 ('gemini' 或 'openai')。
 * @param {object} settings - 包含API密钥、URL等设置的对象。
 * @returns {Promise<object>} - 返回一个包含测试成功与否及相关信息的对象。
 */
async function testApi(provider, settings) {
  let prompt, body, headers, endpoint;

  if (provider === 'gemini') {
    if (!settings.apiKey) return { success: false, error: 'Please enter your Gemini API key.' };
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { contents: [{ parts: [{ text: prompt }] }] };
    headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.apiKey };
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent`;

  } else if (provider === 'openai') {
    if (!settings.url || !settings.apiKey || !settings.model) {
      return { success: false, error: 'Please fill in all OpenAI-compatible interface settings.' };
    }
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { model: settings.model, messages: [{ role: "user", content: prompt }] };
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` };
    endpoint = settings.url;

  } else {
    return { success: false, error: 'Testing this provider is not supported.' };
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

  // Clean the test result to ensure proper logic
  const cleanedContent = cleanApiResponse(content);

  if (cleanedContent && cleanedContent.trim().toLowerCase().includes('ok')) {
    return { success: true, message: 'API configuration successful!' };
  } else {
    return { success: false, error: `API returned unexpected response: ${cleanedContent}` };
  }
}

// ---- Chrome Extension Event Listeners ----

/**
 * 扩展安装或更新时运行，确保侧边栏在所有页面都可用。
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true
  });
});

/**
 * 监听工具栏图标点击事件，打开侧边栏。
 */
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

/**
 * 统一的消息监听器，处理来自内容脚本、弹出窗口和选项页面的请求。
 * 使用 'action' 或 'type' 字段来分发请求到相应的处理函数。
 */
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
  } else if (request.type === 'captureContent') {
    // 处理来自内容脚本(content.js)的消息，捕获页面内容。
    // 将文本、URL和标题存储在 chrome.storage.session 中，以便侧边栏(popup.js)可以访问。
    chrome.storage.session.set({ capturedContent: { text: request.text, url: request.url, title: request.title } });
  }
});
