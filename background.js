// background.js

// Core prompt construction function
function buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode, isGemini) {
  const targetLanguagesString = targetLanguages.join(', ');
  const translationsExample = targetLanguages.map(lang => `"${lang}": "${lang} Translation."`).join(',\n      ');

  // If Gemini, use JSON prompt
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
  
  // If OpenAI, use a simpler prompt
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

// Reverse check prompt construction function
function buildReverseCheckPrompt(textToTranslate) {
  const safeTextToTranslate = JSON.stringify(textToTranslate);
  return `Translate the following text into conversational English, and provide ONLY the translation without any extra text.
  Text: ${safeTextToTranslate}`;
}

// Helper function: Standardize handling of model response format, removing markdown and extra commas
function cleanApiResponse(text) {
  // Remove markdown code block markers
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let cleanedText = codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();

  // Remove extra commas
  cleanedText = cleanedText.replace(/,(\s*[}\]])/g, '$1');

  // If JSON, attempt to parse
  try {
    const parsed = JSON.parse(cleanedText);
    if (parsed.text) {
      return parsed.text.trim();
    }
    // Otherwise return the raw text
    return cleanedText;
  } catch (e) {
    // Not JSON, return directly
    return cleanedText;
  }
}

// Helper function: Standardize API call handling
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

// Process translation and tutor mode
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    apiResponse = await makeApiCall('Gemini', endpoint, headers, body);

    if (apiResponse.error) return apiResponse;
    const cleanedContent = cleanApiResponse(apiResponse.candidates[0].content.parts[0].text);
    
    try {
      responseData = JSON.parse(cleanedContent);
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
      responseData = JSON.parse(cleanedContent);
    } catch (e) {
      return { error: `Invalid JSON format returned by OpenAI API: ${e.message}` };
    }

  } else {
    return { error: 'Unknown AI service provider.' };
  }
  return responseData;
}

// Reverse check
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
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
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

// Test API
async function testApi(provider, settings) {
  let prompt, body, headers, endpoint;

  if (provider === 'gemini') {
    if (!settings.apiKey) return { success: false, error: 'Please enter your Gemini API key.' };
    prompt = "Test API connectivity. Respond with a single word: 'OK'.";
    body = { contents: [{ parts: [{ text: prompt }] }] };
    headers = { 'Content-Type': 'application/json', 'X-goog-api-key': settings.apiKey };
    endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;
    
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

// Set sidebar behavior on extension install or update
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    enabled: true
  });
});

// Listen for toolbar icon click events
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Handle requests from popup.js and options.js
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
