## 🗣️ Synch-Talk: AI-Powered Side Panel for Multilingual Precision Communication

**Fluent conversations, not just translations.**  
Synch-Talk is a browser side panel extension that I built for Chrome, Edge, and other Chromium-compatible browsers. It helps you communicate naturally and accurately across languages by generating high-quality prompts for large language models (LLMs). Whether you're chatting with international colleagues, replying on social media, or learning a new language, I designed Synch-Talk to offer a smooth, efficient experience tailored to real-world multilingual tasks.

---

## 🚀 Key Features

- **🔄 Real-Time Multilingual Translation**  
  You can translate your input into multiple target languages simultaneously.  
  _Currently supported: Chinese, English, Greek, French, German, Japanese, Korean_

  > ⚠️ If you need to customize the language list, please download or fork the source code and modify the following line in `popup.js`:
  > ```js
  > const languages = ['Chinese', 'English', 'Greek', 'French', 'German', 'Japanese', 'Korean'];
  > ```

- **🧠 AI-Powered Native Expression**  
  Synch-Talk don’t perform translation directly—instead, it craft intelligent prompts that guide your selected LLM to rewrite your message in a natural, culturally appropriate way.

- **🎓 Optional AI Tutor Mode**  
  This mode is designed to help you refine your writing and improve fluency. When enabled, the LLM will correct grammar, spelling, and phrasing.  
  > 💡 By selecting the source language as your learning language and enabling AI Tutor Mode, the LLM will help correct your original input—making it a powerful tool for practicing and improving your writing in that language. Additionally, by setting your native language as one of the target languages, you can verify whether the AI's rewritten output still aligns with your original intent. This dual-check approach ensures both linguistic accuracy and semantic fidelity.

- **🔁 Translation Quality Verification**  
  Each translation box includes a one-click **"Back to English"** button, represented by a small dot in the bottom-right corner. I designed this subtle feature to let you quickly verify translation accuracy without disrupting your workflow or cluttering the interface.  
  > By reverse-translating the output back into English, you can check whether the AI’s interpretation aligns with your original intent—especially useful when working across unfamiliar languages.  
  > English is used as the verification language by design, due to its dominant role in LLM training datasets and higher semantic reliability.

---

## 🧠 AI Model Support

Synch-Talk is model-agnostic and works with any LLM that supports the OpenAI API format. You can use your own API key to connect to:

- Google Gemini  
- Any OpenAI API-compatible provider  
- SiliconFlow, OpenRouter, and other platforms

> 💡 Because Synch-Talk's tasks are prompt-driven and lightweight, many free-tier models are sufficient for excellent results.

> ⚠️ **Important Note on Model Selection**  
> For best performance, please avoid using models that generate reflective or analytical responses by default (e.g., DeepSeek, or models designed for reasoning tasks). Synch-Talk relies on direct, prompt-driven translation and rewriting. Models that attempt to “think through” the task may produce verbose or inconsistent results, reducing translation clarity and your overall experience.

---

## 🔐 Privacy & Data Security

- Synch-Talk does **not** upload, transmit, or store any of your data externally  
- The only communication happens between your browser and the AI provider you choose—Synch-Talk simply helps structure the task and send it  
- All settings, including API keys, are stored locally using `chrome.storage.local` and never leave your device  
- No translation history is saved, ensuring privacy and simplicity

> ⚙️ To select your preferred AI provider, please go to the **Options** page and enter your settings for any supported model (e.g. OpenAI, Gemini, OpenRouter, etc.)

---

## 🎯 Use Cases

- 🌍 Multilingual communication: reply to chats or emails in multiple languages with native fluency  
- 💬 Social media interaction: express your thoughts clearly to global audiences  
- 🔍 Translation validation: reverse-translate results to English to check for semantic drift  
- 🧑‍🏫 Language learning: improve grammar, vocabulary, and phrasing with AI feedback  
- 📝 Writing assistance: polish your message for tone, clarity, and cultural appropriateness  

---

## 🧰 Tech Stack

- HTML / CSS / JavaScript  
- Chrome Extension APIs  
- Manifest V3  
- No backend required—fully local execution

---

## 📦 Installation

1. Clone or download this repository  
2. Open your browser’s extensions page (`chrome://extensions` or `edge://extensions`)  
3. Enable Developer Mode  
4. Click “Load unpacked” and select the extension folder

---

## 🔮 Future Vision: Text-to-Speech (TTS) Integration

I plan to add **text-to-speech (TTS)** functionality in future versions, allowing you to hear AI-generated translations spoken aloud. This will enhance:

- Pronunciation training  
- Listening comprehension  
- Realistic language immersion

I’m currently exploring cost-effective, high-quality TTS solutions. If you’re interested in contributing or experimenting with TTS integration, you’re very welcome to fork my project and explore!

---

## 🤝 Contributing

Welcome if you like to help with:

- UI/UX improvements  
- Prompt engineering  
- Model compatibility  
- TTS integration
- anything else

Please feel free to fork the repo and submit a pull request, or open an issue to start a discussion.

---

## 📄 License

MIT License

---

## 📬 Contact & Support

For questions, suggestions, or feedback, please visit the [GitHub repository](https://github.com/gzdanny/Synch-Talk).
