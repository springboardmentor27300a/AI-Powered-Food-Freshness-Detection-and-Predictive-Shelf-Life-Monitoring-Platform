
import { useEffect, useRef, useState } from "react";
import "./FreshGuardChatbot.css";

const QUICK_QUESTIONS = [
  "What is FreshGuard?",
  "What features are available?",
  "Which user roles are supported?",
  "How do I create an account?",
  "How does freshness analysis work?",
  "What can I find on my dashboard?",
];

function detectLanguage(text) {
  return /\b(bhai|kaise|kya|hai|hain|mujhe|mera|meri|karna|karo|batao|chahiye|kaun|kaunsa|kaunse|samjhao|banao|mein|aur|karta|karti|milta|milti)\b/i.test(
    text
  )
    ? "hinglish"
    : "english";
}

function getResponse(text) {
  const value = text.toLowerCase().trim();
  const language = detectLanguage(text);

  const answer = (en, hi, action = null) => ({
    message: language === "hinglish" ? hi : en,
    action,
  });

  if (
    /^(hi|hello|hey|namaste|namaskar|good morning|good afternoon|good evening)[!. ]*$/i.test(
      value
    )
  ) {
    return answer(
      "Hello! 👋 I'm FreshGuard Assistant. I can explain the platform, its features, user roles, dashboard, login, registration, and freshness analysis.",
      "Namaste! 👋 Main FreshGuard Assistant hoon. Main platform ke features, user roles, dashboard, login, registration aur freshness analysis ke baare mein bata sakta hoon."
    );
  }

  if (
    /create account|sign up|signup|register|registration|account banao|account banana|account kaise/i.test(
      value
    )
  ) {
    return answer(
      "📝 To create an account, select Create Account on the Home Page and complete the registration form. The available options depend on the current registration flow.",
      "📝 Account banane ke liye Home Page par Create Account select karein aur registration form complete karein. Available options current registration flow par depend karte hain.",
      "register"
    );
  }

  if (/login|log in|sign in|signin|password|login kaise/i.test(value)) {
    return answer(
      "🔐 Select Login on the Home Page, enter your registered credentials, and follow the sign-in process. If you see an error, check the message displayed by the platform.",
      "🔐 Home Page par Login select karein, apne registered credentials enter karein aur sign-in process follow karein. Error aaye toh platform par dikhaya gaya message check karein.",
      "login"
    );
  }

  if (/role|consumer|retail manager|warehouse|inspector|administrator|admin|kaunsa role|user type/i.test(value)) {
    return answer(
      "👥 FreshGuard supports these intended user roles:\n\n• Consumer — personal food inventory\n• Retail Manager — retail inventory\n• Warehouse Operator — warehouse operations\n• Food Quality Inspector — food-quality review\n• Administrator — platform administration\n\nAvailable access depends on the role configured for your account.",
      "👥 FreshGuard mein ye user roles hain:\n\n• Consumer — personal food inventory\n• Retail Manager — retail inventory\n• Warehouse Operator — warehouse operations\n• Food Quality Inspector — food-quality review\n• Administrator — platform management\n\nAapka access account ke configured role par depend karta hai."
    );
  }

  if (/freshguard|what is this platform|about platform|platform kya|kya hai freshguard/i.test(value)) {
    return answer(
      "🌱 FreshGuard is a Food Freshness Monitoring Platform designed to help users manage food inventory and access freshness-analysis results, shelf-life information, storage guidance, and related reports.",
      "🌱 FreshGuard ek Food Freshness Monitoring Platform hai. Iska purpose food inventory manage karne aur freshness-analysis results, shelf-life information, storage guidance aur related reports access karne mein help karna hai."
    );
  }

  if (/feature|what can|capabilities|kya kar|kya milta/i.test(value)) {
    return answer(
      "✨ Platform features include:\n\n• Food inventory management\n• Image-based AI freshness analysis\n• Freshness status and score display, where available\n• Estimated shelf-life information\n• Storage guidance and recommendations provided by the platform\n• Food records and reports\n• Role-based dashboards\n\nThe exact options available depend on your account and the deployed platform version.",
      "✨ Platform ke features mein shamil hain:\n\n• Food inventory management\n• Image-based AI freshness analysis\n• Freshness status aur score display, jahan available ho\n• Estimated shelf-life information\n• Platform ki storage guidance aur recommendations\n• Food records aur reports\n• Role-based dashboards\n\nExact options aapke account aur deployed platform version par depend karte hain."
    );
  }

  if (/dashboard|home screen|dashboard mein|dashboard par/i.test(value)) {
    return answer(
      "📊 The dashboard is the main workspace after login. Depending on your role, it may display food records, freshness information, inventory summaries, reports, and profile options.",
      "📊 Login ke baad dashboard aapka main workspace hota hai. Role ke hisaab se yahan food records, freshness information, inventory summary, reports aur profile options dikh sakte hain."
    );
  }

  if (/freshness|analyse|analyze|analysis|image upload|photo|picture|prediction|ai model/i.test(value)) {
    return answer(
      "🖼️ The freshness-analysis feature accepts a food image through the platform's available workflow and displays the analysis result. The result is an AI estimate and should not be treated as a guarantee of food safety. I can explain the feature, but I do not run an analysis myself.",
      "🖼️ Freshness-analysis feature mein platform ke available workflow se food image submit ki ja sakti hai aur analysis result display hota hai. Ye AI estimate hai, food safety ki guarantee nahi. Main feature samjha sakta hoon, lekin khud analysis run nahi karta."
    );
  }

  if (/shelf.?life|expiry|expire|storage|store food|food storage|temperature/i.test(value)) {
    return answer(
      "📦 FreshGuard includes shelf-life and storage-related information where supported by the platform. Open the relevant food record or dashboard section to see the information available for that item. I do not independently calculate expiry dates or make food-safety decisions.",
      "📦 FreshGuard mein platform ke supported features ke hisaab se shelf-life aur storage-related information mil sakti hai. Relevant food record ya dashboard section kholkar us item ki available information dekhein. Main khud expiry date calculate ya food-safety decision nahi leta."
    );
  }

  if (/report|analytics|history|food record|inventory|inventory management/i.test(value)) {
    return answer(
      "📈 Food records, inventory information, analytics, and reports are available through the relevant platform sections when enabled for your account. Open your dashboard to see the options available to your role.",
      "📈 Food records, inventory information, analytics aur reports platform ke relevant sections mein mil sakte hain, agar aapke account ke liye enabled hon. Apne role ke available options dekhne ke liye dashboard open karein."
    );
  }

  if (/profile|account details|my account|profile kaise/i.test(value)) {
    return answer(
      "👤 If your dashboard provides a Profile option, open it to view the account information available there. The fields you can see or update depend on the platform's current implementation.",
      "👤 Agar dashboard par Profile option available hai, toh use open karke wahan dikhayi gayi account information dekhein. Kaunse fields view ya update ho sakte hain, ye platform ke current implementation par depend karta hai."
    );
  }

  if (/contact|support|help|problem|error|issue|not working|kaam nahi/i.test(value)) {
    return answer(
      "🛠️ I can explain FreshGuard's platform features, but I cannot inspect your account or fix server errors directly. Please note the exact error message and share it with the platform administrator or support contact, if available.",
      "🛠️ Main FreshGuard ke features samjha sakta hoon, lekin aapka account inspect ya server error directly fix nahi kar sakta. Exact error message note karke platform administrator ya available support contact se share karein."
    );
  }

  return answer(
    "I can explain FreshGuard's platform overview, features, user roles, dashboard, login, registration, food records, and freshness analysis. Please ask a platform-related question.",
    "Main FreshGuard ke platform overview, features, user roles, dashboard, login, registration, food records aur freshness analysis ke baare mein bata sakta hoon. Kripya platform se related question poochhein."
  );
}

function FreshGuardChatbot({ onLogin, onRegister }) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: "bot",
      text: "Namaste! 👋 Hello! Main FreshGuard Assistant hoon. Aap Hinglish ya English mein platform features, roles aur dashboard ke baare mein pooch sakte hain.",
    },
  ]);

  const messageEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleAction = (action) => {
    if (action === "login" && typeof onLogin === "function") {
      setIsOpen(false);
      onLogin();
    } else if (action === "register" && typeof onRegister === "function") {
      setIsOpen(false);
      onRegister();
    }
  };

  const sendMessage = (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isTyping) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsTyping(true);

    // Frontend-only response: no backend API request required.
    window.setTimeout(() => {
      const response = getResponse(trimmed);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          sender: "bot",
          text: response.message,
          action: response.action,
        },
      ]);

      setIsTyping(false);
    }, 250);
  };

  return (
    <div className="fg-chatbot">
      {isOpen && (
        <section
          className="fg-chat-window"
          role="dialog"
          aria-label="FreshGuard Assistant"
        >
          <header className="fg-chat-header">
            <div className="fg-chat-avatar">🤖</div>

            <div className="fg-chat-heading">
              <strong>FreshGuard Assistant</strong>
              <span>
                <i className="fg-online-dot" />
                Platform help guide
              </span>
              <small>Hinglish + English</small>
            </div>

            <button
              className="fg-chat-close"
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </header>

          <div className="fg-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`fg-chat-message-row ${
                  message.sender === "user" ? "fg-user-row" : "fg-bot-row"
                }`}
              >
                {message.sender === "bot" && (
                  <span className="fg-message-avatar">🌱</span>
                )}

                <div className="fg-chat-message-content">
                  <div
                    className={`fg-chat-bubble ${
                      message.sender === "user"
                        ? "fg-user-bubble"
                        : "fg-bot-bubble"
                    }`}
                  >
                    {message.text}
                  </div>

                  {message.action && (
                    <button
                      className="fg-chat-action"
                      type="button"
                      onClick={() => handleAction(message.action)}
                    >
                      {message.action === "login"
                        ? "Go to Login →"
                        : "Create Account →"}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="fg-chat-message-row fg-bot-row">
                <span className="fg-message-avatar">🌱</span>
                <div className="fg-chat-bubble fg-bot-bubble fg-typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            <div ref={messageEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="fg-chat-quick-questions">
              <span>Try asking</span>
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendMessage(question)}
                  disabled={isTyping}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          <form
            className="fg-chat-input-area"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about FreshGuard..."
              aria-label="Type your message"
              maxLength={1000}
              autoComplete="off"
            />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              aria-label="Send message"
            >
              ➤
            </button>
          </form>

          <div className="fg-chat-disclaimer">
            Platform help only · No independent decisions
          </div>
        </section>
      )}

      <button
        className={`fg-chat-launcher ${isOpen ? "fg-launcher-open" : ""}`}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={
          isOpen ? "Close FreshGuard Assistant" : "Open FreshGuard Assistant"
        }
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <span className="fg-launcher-close-icon">×</span>
        ) : (
          <>
            <span className="fg-launcher-robot">🤖</span>
            <span className="fg-launcher-pulse" />
            <span className="fg-launcher-label">Ask FreshGuard</span>
          </>
        )}
      </button>
    </div>
  );
}

export default FreshGuardChatbot;
