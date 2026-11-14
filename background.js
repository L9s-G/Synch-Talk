// background.js

/**
 * 根据用户输入、语言设置和模式，为AI模型构建动态提示。
 * @param {string} userInput - 用户输入的文本。
 * @param {string[]} targetLanguages - 目标语言数组。
 * @param {boolean} isTutorMode - 是否启用AI导师模式。
 * @param {boolean} isGemini - 是否为Gemini模型（影响提示格式）。
 * @returns {string} - 构建好的AI提示字符串。
 */
function buildDynamicPrompt(userInput, targetLanguages, isTutorMode, isGemini) {
  const targetLanguagesString = targetLanguages.join(', ');
  const translationsExample = targetLanguages.slice(0, 2).map(lang => `"${lang}": "..."`).join(', ');

  if (isGemini) {
    const safeUserInput = JSON.stringify(userInput);
    const taskDesc = isTutorMode
      ? 'Detect source, polish input (store in "corrected_text"), then translate to: ' + targetLanguagesString
      : 'Detect source, then translate to: ' + targetLanguagesString;

    return `You are a professional translator. Rules: localize (not literal), use industry-standard terms, sound native, exclude source language from output.

Input:
<<<<
${safeUserInput}
>>>>

Task: ${taskDesc}

Output JSON:
{
  "mode": "${isTutorMode ? 'tutor' : 'translator'}",
  "detected_source_language": "...",
  ${isTutorMode ? '"corrected_text": "...",' : ''}
  "translations": { ${translationsExample} }
}

Return ONLY valid JSON.`;
  } else {
    // OpenAI 兼容格式
    const taskDesc = isTutorMode
      ? 'Detect source, polish input (store in "corrected_text"), then translate to: ' + targetLanguagesString
      : 'Detect source, then translate to: ' + targetLanguagesString;

    return `You are a professional translator. Rules: localize (not literal), use industry-standard terms, sound native, exclude source language from output.

Task: ${taskDesc}
Active languages: ${targetLanguagesString}.
Output JSON keys: "mode", "detected_source_language", ${isTutorMode ? '"corrected_text", ' : ''}"translations".`;
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
 * 从 AI 响应的 content/parts 中提取文本，兼容字符串与数组分片形式。
 * @param {*} value - 可能是字符串、数组或对象。
 * @returns {string} - 拼接后的文本。
 */
function extractText(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') {
        if (item.text != null) return extractText(item.text);
        if (item.content != null) return extractText(item.content);
        if (item.value != null) return extractText(item.value);
        if (item.parts != null) return extractText(item.parts);
      }
      return '';
    }).join('');
  }
  if (typeof value === 'object') {
    if (value.text != null) return extractText(value.text);
    if (value.content != null) return extractText(value.content);
    if (value.parts != null) return extractText(value.parts);
    if (value.value != null) return extractText(value.value);
    // 无已知键时，优先 JSON 序列化，避免 String() 产生 "[object Object]"
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
}

/**
 * 将 AI 返回的可能是数组/对象的值规范化为可显示的字符串。
 * 后台负责 schema 感知的归一化；UI 侧仅有 schema-agnostic 的类型兜底。
 * @param {*} value
 * @returns {string}
 */
function normalizeAiValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return value.map(normalizeAiValue).filter(Boolean).join('\n');
  }
  if (typeof value === 'object') {
    for (const key of ['text', 'translation', 'content', 'value', 'result', 'output']) {
      if (value[key] != null) return normalizeAiValue(value[key]);
    }
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }
  return String(value);
}

/**
 * 将 AI 响应规范化为稳定的领域模型，使 UI 不依赖原始返回结构。
 * @param {*} data
 * @returns {{ mode?: string, detected_source_language?: string, corrected_text?: string, translations?: Record<string,string>, error?: string }}
 */
function normalizeAiResponse(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  if (data.error) return data;
  const out = { ...data };
  if (out.detected_source_language != null) {
    out.detected_source_language = normalizeAiValue(out.detected_source_language);
  }
  if (out.corrected_text != null) {
    out.corrected_text = normalizeAiValue(out.corrected_text);
  }
  if (out.translations != null) {
    if (typeof out.translations !== 'object') {
      out.translations = {};
    } else if (Array.isArray(out.translations)) {
      const obj = {};
      out.translations.forEach(item => {
        if (Array.isArray(item) && item.length >= 2) {
          obj[item[0]] = normalizeAiValue(item[1]);
        } else if (item && typeof item === 'object') {
          const lang = item.language || item.lang || item.target || item.name;
          if (lang != null) {
            obj[lang] = normalizeAiValue(item.text || item.translation || item.content || item.value);
          }
        }
      });
      out.translations = obj;
    } else {
      const obj = {};
      for (const key in out.translations) {
        obj[key] = normalizeAiValue(out.translations[key]);
      }
      out.translations = obj;
    }
  }
  return out;
}

/**
 * 清理和规范化来自AI API的响应文本。
 * 移除Markdown代码块、多余的逗号，并尝试解析为JSON。
 * @param {string} text - 从API获取的原始响应文本。
 * @returns {string|object} - 如果能解析为JSON，则返回解析后的对象或其中的'text'字段；否则返回清理后的字符串。
 */
function cleanApiResponse(text) {
  if (text == null) return '';
  if (Array.isArray(text)) {
    text = text.map(item => (typeof item === 'string' ? item : (item && item.text != null ? item.text : JSON.stringify(item)))).join('');
  }
  text = String(text);

  // 移除Markdown代码块标记 (```json ... ```)
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let cleanedText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // 移除JSON中可能导致解析错误的尾随逗号
  cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');

  // 尝试解析：先直接，失败则做常见修复后重试
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch (e) { return null; }
  };

  let parsed = tryParse(cleanedText);

  // 修复1：键与值之间缺失冒号（"key" "value" -> "key": "value"）
  if (!parsed) {
    const repaired = cleanedText.replace(/"([^"\n]+)"\s+"([^"\n]*)"/g, '"$1": "$2"');
    parsed = tryParse(repaired);
    if (parsed) cleanedText = repaired;
  }

  // 修复2：提取第一个完整的 {...} 块再解析
  if (!parsed) {
    const m = cleanedText.match(/\{[\s\S]*\}/);
    if (m) {
      parsed = tryParse(m[0]);
      if (parsed) cleanedText = m[0];
    }
  }

  if (parsed) {
    // 如果解析后的对象有 'text' 属性（常见于简单文本响应），则直接返回其值
    if (parsed && parsed.text != null) {
      const textValue = normalizeAiValue(parsed.text);
      if (textValue !== '') {
        return textValue.trim();
      }
    }
    // 否则返回整个解析后的对象
    return parsed;
  }

  // Not JSON, return directly
  return cleanedText;
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
      let detail = '';
      try { detail = await response.text(); } catch (e) { detail = ''; }
      return { error: `API Error: ${response.status} ${response.statusText}${detail ? ' - ' + detail.slice(0, 300) : ''}`, status: response.status };
    }

    const data = await response.json();
    return data;

  } catch (error) {
    return { error: `Unable to connect to ${provider} API: ${error.message}`, status: 0 };
  }
}

/**
 * OpenAI 兼容接口的调用封装：优先使用 response_format=json_object，
 * 若服务端不支持（HTTP 400），则自动降级为不带该字段的请求。
 * @param {string} provider
 * @param {string} endpoint
 * @param {object} headers
 * @param {object} body - 含 response_format 的请求体
 * @returns {Promise<object>}
 */
async function callOpenAiLike(provider, endpoint, headers, body) {
  const first = await makeApiCall(provider, endpoint, headers, body);
  if (first.error && first.status === 400 && body && body.response_format) {
    const { response_format, ...rest } = body;
    return makeApiCall(provider, endpoint, headers, rest);
  }
  return first;
}

// ---- API Core Functionality ----

/**
 * 处理AI输入的核心函数，根据用户设置调用不同的AI服务进行翻译或语法修正。
 * @param {string} userInput - 用户输入的文本。
 * @param {string[]} targetLanguages - 目标语言数组。
 * @param {boolean} isTutorMode - 是否启用AI导师模式。
 * @returns {Promise<object>} - 返回一个包含翻译结果、修正文本或错误信息的对象。
 */
async function processAiInput(userInput, targetLanguages, isTutorMode) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'geminiModel', 'openAiUrl', 'openAiApiKey', 'openAiModel', 'cfGatewayUrl', 'cfApiKey', 'cfModel']);
  const provider = settings.aiProvider || 'gemini';

  let prompt;
  let apiResponse;
  let responseData;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: 'Please set your Gemini API key in the options page.' };
    }
    const model = settings.geminiModel || 'gemini-flash-latest'; // Default to gemini-flash-latest if not set
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      return { error: 'Invalid Gemini model name.' };
    }
    prompt = buildDynamicPrompt(userInput, targetLanguages, isTutorMode, true);
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);

    if (apiResponse.error) return apiResponse;
    const geminiText = extractText(apiResponse?.candidates?.[0]?.content?.parts);
    if (!geminiText) {
      return { error: 'Unexpected response from Gemini API.' };
    }
    const cleanedContent = cleanApiResponse(geminiText);

    try {
      // cleanedContent可能已经是对象了
      responseData = typeof cleanedContent === 'string' ? JSON.parse(cleanedContent) : cleanedContent;
    } catch (e) {
      return { error: `Invalid JSON format returned by Gemini API: ${e.message}. Raw: ${String(cleanedContent).slice(0, 200)}` };
    }

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: 'Please set your OpenAI-compatible API URL, key, and model in the options page.' };
    }
    prompt = buildDynamicPrompt(userInput, targetLanguages, isTutorMode, false);
    const body = {
      model: openAiModel,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: prompt }, { role: "user", content: userInput }]
    };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiApiKey}` };
    apiResponse = await callOpenAiLike('OpenAI', openAiUrl, headers, body);

    if (apiResponse.error) return apiResponse;
    const openAiText = extractText(apiResponse?.choices?.[0]?.message?.content);
    if (!openAiText) {
      return { error: 'Unexpected response from OpenAI API.' };
    }
    const cleanedContent = cleanApiResponse(openAiText);

    try {
      // cleanedContent可能已经是对象了
      responseData = typeof cleanedContent === 'string' ? JSON.parse(cleanedContent) : cleanedContent;
    } catch (e) {
      return { error: `Invalid JSON format returned by OpenAI API: ${e.message}. Raw: ${String(cleanedContent).slice(0, 200)}` };
    }

  } else if (provider === 'cloudflare') {
    const { cfGatewayUrl, cfApiKey, cfModel } = settings;
    if (!cfGatewayUrl || !cfApiKey || !cfModel) {
      return { error: 'Please set your CloudFlare Gateway URL, key, and model in the options page.' };
    }
    prompt = buildDynamicPrompt(userInput, targetLanguages, isTutorMode, false);
    const body = {
      model: cfModel,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: prompt }, { role: "user", content: userInput }]
    };
    const headers = { 'Content-Type': 'application/json', 'cf-aig-authorization': `Bearer ${cfApiKey}` };
    apiResponse = await callOpenAiLike('CloudFlare', cfGatewayUrl, headers, body);

    if (apiResponse.error) return apiResponse;
    const cfText = extractText(apiResponse?.choices?.[0]?.message?.content);
    if (!cfText) {
      return { error: 'Unexpected response from CloudFlare API.' };
    }
    const cleanedContent = cleanApiResponse(cfText);

    try {
      responseData = typeof cleanedContent === 'string' ? JSON.parse(cleanedContent) : cleanedContent;
    } catch (e) {
      return { error: `Invalid JSON format returned by CloudFlare API: ${e.message}. Raw: ${String(cleanedContent).slice(0, 200)}` };
    }

  } else {
    return { error: 'Unknown AI service provider.' };
  }
  return normalizeAiResponse(responseData);
}

/**
 * 执行“反向校验”，将一段文本翻译回英语以供用户核对。
 * @param {string} textToTranslate - 需要被翻译的文本。
 * @returns {Promise<object>} - 返回一个包含翻译结果或错误信息的对象。
 */
async function performReverseCheck(textToTranslate) {
  const settings = await chrome.storage.local.get(['aiProvider', 'geminiApiKey', 'geminiModel', 'openAiUrl', 'openAiApiKey', 'openAiModel', 'cfGatewayUrl', 'cfApiKey', 'cfModel']);
  const provider = settings.aiProvider || 'gemini';

  const prompt = buildReverseCheckPrompt(textToTranslate);
  let apiResponse;
  let content;

  if (provider === 'gemini') {
    if (!settings.geminiApiKey) {
      return { error: 'Please set your Gemini API key in the options page to use the reverse check function.' };
    }
    const model = settings.geminiModel || 'gemini-flash-latest'; // Default to gemini-flash-latest if not set
    const body = { contents: [{ parts: [{ text: prompt }] }] };
    const headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.geminiApiKey };
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);
    if (apiResponse.error) return apiResponse;
    content = extractText(apiResponse?.candidates?.[0]?.content?.parts);
    if (!content) return { error: 'Unexpected response from Gemini API.' };

  } else if (provider === 'openai') {
    const { openAiUrl, openAiApiKey, openAiModel } = settings;
    if (!openAiUrl || !openAiApiKey || !openAiModel) {
      return { error: 'Please set your OpenAI-compatible API to use the reverse check function.' };
    }
    const body = { model: openAiModel, messages: [{ role: "user", content: prompt }] };
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAiApiKey}` };
    apiResponse = await callOpenAiLike('OpenAI', openAiUrl, headers, body);
    if (apiResponse.error) return apiResponse;
    content = extractText(apiResponse?.choices?.[0]?.message?.content);
    if (!content) return { error: 'Unexpected response from OpenAI API.' };

  } else if (provider === 'cloudflare') {
    const { cfGatewayUrl, cfApiKey, cfModel } = settings;
    if (!cfGatewayUrl || !cfApiKey || !cfModel) {
      return { error: 'Please set your CloudFlare Gateway to use the reverse check function.' };
    }
    const body = { model: cfModel, messages: [{ role: "user", content: prompt }] };
    const headers = { 'Content-Type': 'application/json', 'cf-aig-authorization': `Bearer ${cfApiKey}` };
    apiResponse = await callOpenAiLike('CloudFlare', cfGatewayUrl, headers, body);
    if (apiResponse.error) return apiResponse;
    content = extractText(apiResponse?.choices?.[0]?.message?.content);
    if (!content) return { error: 'Unexpected response from CloudFlare API.' };

  } else {
    return { error: 'Unknown AI service provider.' };
  }

  // Clean the response to ensure it is plain text
  const cleanedText = cleanApiResponse(content);
  const finalText = normalizeAiValue(cleanedText);

  return { text: finalText.trim() };
}

/**
 * 测试用户提供的API配置是否有效。
 * @param {string} provider - AI提供商 ('gemini' 或 'openai')。
 * @param {object} settings - 包含API密钥、URL等设置的对象。
 * @returns {Promise<object>} - 返回一个包含测试成功与否及相关信息的对象。
 */
async function testApi(provider, settings) {
  let prompt, body, headers, endpoint;
  const providerName = provider === 'gemini' ? 'Gemini' : provider === 'openai' ? 'OpenAI' : provider === 'cloudflare' ? 'CloudFlare' : provider;

  if (provider === 'gemini') {
    if (!settings.apiKey) return { success: false, error: 'Please enter your Gemini API key.' };
    const model = settings.model || 'gemini-flash-latest';
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) {
      return { success: false, error: 'Invalid Gemini model name.' };
    }
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { contents: [{ parts: [{ text: prompt }] }] };
    headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.apiKey };
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  } else if (provider === 'openai') {
    if (!settings.url || !settings.apiKey || !settings.model) {
      return { success: false, error: 'Please fill in all OpenAI-compatible interface settings.' };
    }
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { model: settings.model, messages: [{ role: "user", content: prompt }] };
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` };
    endpoint = settings.url;

  } else if (provider === 'cloudflare') {
    if (!settings.url || !settings.apiKey || !settings.model) {
      return { success: false, error: 'Please fill in all CloudFlare Gateway settings.' };
    }
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { model: settings.model, messages: [{ role: "user", content: prompt }] };
    headers = { 'Content-Type': 'application/json', 'cf-aig-authorization': `Bearer ${settings.apiKey}` };
    endpoint = settings.url;

  } else {
    return { success: false, error: 'Testing this provider is not supported.' };
  }

  const apiResponse = await makeApiCall(providerName, endpoint, headers, body);
  if (apiResponse.error) {
    return { success: false, error: apiResponse.error };
  }

  let content;
  if (provider === 'gemini') {
    content = extractText(apiResponse?.candidates?.[0]?.content?.parts);
  } else {
    // openai or cloudflare — both use the same response structure
    content = extractText(apiResponse?.choices?.[0]?.message?.content);
  }
  if (!content) {
    return { success: false, error: 'Unexpected response from API.' };
  }

  // Clean the test result to ensure proper logic
  const cleanedContent = cleanApiResponse(content);

  if (cleanedContent && String(cleanedContent).trim().toLowerCase().includes('ok')) {
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
    const { userInput, targetLanguages, isTutorMode } = request;
    processAiInput(userInput, targetLanguages, isTutorMode).then(sendResponse);
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
