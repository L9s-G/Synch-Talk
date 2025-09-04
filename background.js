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

// 在扩展程序安装或更新时设置侧边栏的行为
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setOptions({
    panelOrigin: 'developer', // 或者 'global', 'tab'
    enabled: true // 默认启用侧边栏
  });
});

// 监听工具栏图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  // 检查侧边栏是否已在当前tab中打开
  // Chrome没有直接的 API 来获取侧边栏的“打开/关闭”状态，
  // 所以我们采取一种变通的方法：尝试打开它。如果它已经打开，
  // 再次调用open()不会有副作用。
  // 要实现精确的“切换”，我们需要在content script或storage中维护状态，
  // 但最直接的“点击图标显示侧边栏”可以通过 open() 实现。
  // 如果要精确切换，可以考虑另一种策略：
  // 在storage中维护一个isSidePanelOpen的状态，点击时切换并调用open/close。

  // 直接打开侧边栏。如果它已经打开，这不会导致任何问题。
  // 如果要实现关闭，我们需要更多的上下文。
  // 鉴于目前的需求是“点击图标打开/关闭”，最简单的是如果它关闭则打开，
  // 如果它打开了，再点一下图标，我们无法直接“关闭”它（没有chrome.sidePanel.close()这样的API）。
  // 最接近“关闭”的效果是用户点击侧边栏的关闭按钮。

  // 更新：为了实现点击图标“切换”侧边栏（打开/关闭），
  // 我们需要一个更明确的方法来控制。Chrome Side Panel API 在 Manifest V3 中
  // 没有提供直接的 chrome.sidePanel.close() 方法来关闭一个已打开的侧边栏。
  // 通常，侧边栏是与标签页绑定的，用户会手动关闭它。
  // openPanelOnActionClick 是一个更全局的控制。
  // 如果要实现点击图标“切换”侧边栏，一个常见的做法是：
  // 1. 设置 openPanelOnActionClick 为 true。
  // 2. 如果用户想关闭，他们会点击侧边栏本身的关闭按钮。

  // 然而，如果你坚持“点击图标切换”的交互，我们只能模拟它。
  // 最接近 Manifest V3 的原生方式是：
  //   - 如果侧边栏未打开，点击图标**打开**它。
  //   - 如果侧边栏已打开，点击图标**关闭当前页面的侧边栏** (但这是一个高级操作，需要Content Script协助)。
  // 最简单的“点击图标打开”：
  await chrome.sidePanel.open({ tabId: tab.id });
});

// 处理来自popup.js的AI请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processInput') {
    const { userInput, sourceLanguage, targetLanguages, isTutorMode } = request;

    // TODO: 在这里集成你的AI服务API调用
    // 这是一个模拟的AI响应
    setTimeout(() => {
      let response = {};
      if (isTutorMode) {
        response.mode = 'tutor';
        response.corrected_text = `AI纠正: ${userInput.toUpperCase()} (模拟)`;
      }

      response.translations = {};
      targetLanguages.forEach(lang => {
        response.translations[lang] = `你好，这是 "${userInput}" 的 ${lang} 翻译。`;
      });

      sendResponse(response);
    }, 1000); // 模拟网络延迟
    return true; // 表示异步响应
  } else if (request.action === 'reverseCheck') {
    const { textToTranslate } = request;
    // 模拟反向校验
    setTimeout(() => {
      sendResponse({ text: `Reverse of "${textToTranslate}" in English (simulated)` });
    }, 500);
    return true;
  }
});
