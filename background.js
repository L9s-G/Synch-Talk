// 监听来自 popup.js 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processInput') {
    const { userInput, sourceLanguage, targetLanguages, isTutorMode } = request;
    
    // 在这里调用AI，并处理响应
    console.log('Received message:', request);
    
    // 假设这是调用AI的函数，并返回结果
    // const aiResponse = await callGeminiAI(userInput, sourceLanguage, targetLanguages, isTutorMode);
    
    // 为了示例，我们暂时返回一个假数据
    const mockResponse = {
      mode: isTutorMode ? 'tutor' : 'communication',
      translations: {
        'English': `Mock translation for English.`,
        'Greek': `Mock translation for Greek.`
      }
    };
    
    // 将结果发送回 popup.js
    sendResponse(mockResponse);
    return true; // 保持通信端口打开，以便异步响应
  }
});
