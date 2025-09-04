// 核心提示词构建函数
function buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode) {
  const targetLanguagesString = targetLanguages.join(', ');

  let prompt = `You are a sophisticated AI assistant named Synch-Talk. Your task is to process user input based on the provided mode and language parameters.
  
  Source Language: ${sourceLanguage}
  Target Languages: ${targetLanguagesString}
  User Input: "${userInput}"
  
  Provide your output ONLY in a valid JSON format.`;

  if (isTutorMode) {
    prompt += `\n\n**MODE: AI TUTOR**
  Your goal is to correct the user's input and then translate it.
  
  1.  **Correct the input:** Correct any grammatical errors, typos, and improve the phrasing of the input to make it sound more natural.
  2.  **Generate translations:** Translate the **corrected version** into ALL of the target languages.
  
  The JSON output should have a "mode" field ('tutor') and a "results" object.
  {
    "mode": "tutor",
    "corrected_text": "The corrected and improved version of the input.",
    "translations": {
      "English": "Translation.",
      "Greek": "Translation."
    }
  }`;
  } else {
    prompt += `\n\n**MODE: COMMUNICATION**
  Your goal is to provide natural, idiomatic translations of the user's input.
  
  1.  **Generate translations:** Translate the user's input into ALL of the target languages. The focus is on conveying the meaning perfectly, not literal translation.
  
  The JSON output should have a "mode" field ('communication') and a "results" object.
  {
    "mode": "communication",
    "translations": {
      "English": "A natural English phrasing.",
      "Greek": "A natural Greek phrasing."
    }
  }`;
  }

  return prompt;
}

// 反向校验提示词
function buildReverseCheckPrompt(textToTranslate) {
  return `Translate the following text into conversational English.
  
  Text: "${textToTranslate}"
  
  Provide ONLY the English translation in your response, with no additional text or JSON.`;
}

// 调用AI服务的通用函数
async function callAI(prompt) {
  try {
    const response = await chrome.ai.generateText({
      prompt: prompt,
      model: 'gemini-pro',
      temperature: 0.7 
    });
    
    try {
      return JSON.parse(response);
    } catch (e) {
      return { text: response };
    }

  } catch (error) {
    console.error("AI service call failed:", error);
    return { error: 'AI 服务调用失败' };
  }
}

// 监听来自 popup.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processInput') {
    const { userInput, sourceLanguage, targetLanguages, isTutorMode } = request;
    
    const prompt = buildDynamicPrompt(userInput, sourceLanguage, targetLanguages, isTutorMode);
    
    callAI(prompt).then(aiResponse => {
      sendResponse(aiResponse);
    });
    
    return true; 
  } else if (request.action === 'reverseCheck') {
    const { textToTranslate } = request;
    
    const prompt = buildReverseCheckPrompt(textToTranslate);
    
    callAI(prompt).then(aiResponse => {
      sendResponse(aiResponse);
    });
    
    return true;
  }
});
