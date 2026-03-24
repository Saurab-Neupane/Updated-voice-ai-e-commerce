let isChatbotOpen = false;
let isChatbotListening = false;
let chatbotRecognition = null;
let voiceEnabled = false; 
let autoSpeakEnabled = false; 
const MAX_CHATBOT_HISTORY = 80;
const CHATBOT_HISTORY_KEY = 'chatbotConversationHistory';
const CHATBOT_HISTORY_FALLBACK_KEY = 'chatbotConversationHistoryFallback';
let chatHistory = loadChatbotHistory();
let userContext = {
  browsedProducts: [],
  cartItems: [],
  wishlistItems: [],
  preferences: {},
  lastInteraction: null,
  conversationMemory: [],
  userName: null,
  budget: null,
  interests: [],
  sessionStart: Date.now(),
  messageCount: 0,
  sentiment: 'neutral'
};

const micIcon = `
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
    <rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor"/>
    <path d="M7 11v1a5 5 0 0 0 10 0v-1" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 18v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  </svg>
`;

const micActiveIcon = `
  <div style="display:flex;align-items:center;gap:6px;">
    ${micIcon}
    <span style="font-size:0.75rem;font-weight:800;letter-spacing:0.5px;">REC</span>
  </div>
`;

function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function loadChatbotHistory() {
  try {
    if (typeof window === 'undefined') return [];
    const navEntry = (performance.getEntriesByType('navigation') || [])[0];
    if (navEntry && navEntry.type === 'reload') {
      try { window.sessionStorage && window.sessionStorage.removeItem(CHATBOT_HISTORY_KEY); } catch (e) {}
      try { window.localStorage && window.localStorage.removeItem(CHATBOT_HISTORY_FALLBACK_KEY); } catch (e) {}
      return [];
    }

    let raw = null;
    try {
      if (window.sessionStorage) raw = window.sessionStorage.getItem(CHATBOT_HISTORY_KEY);
    } catch (e) {}
    if (!raw) {
      try {
        if (window.localStorage) raw = window.localStorage.getItem(CHATBOT_HISTORY_FALLBACK_KEY);
      } catch (e) {}
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item && (item.role === 'user' || item.role === 'bot') && typeof item.content === 'string')
      .slice(-MAX_CHATBOT_HISTORY);
  } catch (e) {
    return [];
  }
}

function persistChatbotHistory() {
  try {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify(chatHistory.slice(-MAX_CHATBOT_HISTORY));
    try {
      if (window.sessionStorage) window.sessionStorage.setItem(CHATBOT_HISTORY_KEY, payload);
    } catch (e) {}
    try {
      if (window.localStorage) window.localStorage.setItem(CHATBOT_HISTORY_FALLBACK_KEY, payload);
    } catch (e) {}
  } catch (e) {}
}

function getDefaultChatbotWelcome() {
  return `
    👋 <strong>Welcome to AIShop!</strong><br/><br/>
    I can help you with:<br/>
     Price comparisons<br/>
     Best deals & discounts<br/>
     Cart management<br/>
     Order tracking<br/>
     Any questions?<br/><br/>
    <strong>Try asking:</strong><br/>
    "Show me best deals"<br/>
    "Compare prices"<br/>
    "What's in my cart?"<br/>
    "Track my order"<br/>
    How can I assist you today?
  `;
}

function createUserMessageHTML(message) {
  return `
    <div style="
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 1rem 1.25rem;
      border-radius: 16px 16px 4px 16px;
      max-width: 80%;
      align-self: flex-end;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      font-weight: 500;
      line-height: 1.5;
    ">
      ${message}
    </div>
  `;
}

function createBotMessageHTML(response) {
  return `
    <div style="
      background: white;
      padding: 1.25rem;
      border-radius: 16px 16px 16px 4px;
      max-width: 85%;
      align-self: flex-start;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-left: 3px solid #667eea;
    ">
      <div style="color: #667eea; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">
        AI Assistant
      </div>
      <div style="color: #1e293b; line-height: 1.6;">
        ${response}
      </div>
    </div>
  `;
}

function appendChatMessage(role, content, options = {}) {
  const { persist = true } = options;
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  const messageHTML = role === 'user'
    ? createUserMessageHTML(content)
    : createBotMessageHTML(content);

  messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  if (persist) {
    chatHistory.push({ role, content });
    if (chatHistory.length > MAX_CHATBOT_HISTORY) {
      chatHistory = chatHistory.slice(-MAX_CHATBOT_HISTORY);
    }
    persistChatbotHistory();
  }
}

function renderChatHistory() {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  messagesContainer.innerHTML = '';
  if (!chatHistory.length) {
    chatHistory.push({ role: 'bot', content: getDefaultChatbotWelcome() });
    persistChatbotHistory();
  }

  chatHistory.forEach(entry => appendChatMessage(entry.role, entry.content, { persist: false }));
}

function clearChatHistory(options = {}) {
  const { seedBotMessage = 'Started a new chat. Ask me anything.' } = options;
  chatHistory = [];
  if (seedBotMessage) {
    chatHistory.push({ role: 'bot', content: seedBotMessage });
  }
  persistChatbotHistory();
  renderChatHistory();

  const suggestionsBar = document.getElementById('smartSuggestions');
  const suggestionsList = document.getElementById('suggestionsList');
  if (suggestionsBar) suggestionsBar.style.display = 'none';
  if (suggestionsList) suggestionsList.innerHTML = '';
}


function analyzeSentiment(message) {
  const msg = message.toLowerCase();
  
  const positive = /\b(love|great|awesome|amazing|excellent|perfect|wonderful|fantastic|happy|thanks|thank you|brilliant|best)\b/gi;
  const negative = /\b(hate|bad|terrible|awful|worst|angry|frustrated|annoyed|disappointed|useless|horrible)\b/gi;
  const neutral = /\b(ok|okay|fine|alright)\b/gi;
  
  const positiveCount = (msg.match(positive) || []).length;
  const negativeCount = (msg.match(negative) || []).length;
  
  if (positiveCount > negativeCount) return 'positive';
  if (negativeCount > positiveCount) return 'negative';
  return 'neutral';
}

// Intent detection - understands what user wants to do
function detectIntent(message) {
  const msg = message.toLowerCase();
  
  const intents = [
    { intent: 'search_product', patterns: [/\b(find|search|show|looking for|need|want)\b.*\b(product|item|thing)\b/i] },
    { intent: 'compare', patterns: [/\b(compare|difference|versus|vs|better)\b/i] },
    { intent: 'calculate', patterns: [/\b(add|plus|sum|subtract|minus|multiply|divide|calculate|total|how much)\b.*\d/i] },
    { intent: 'recommend', patterns: [/\b(recommend|suggest|what should|advice|help me choose|pick for me)\b/i] },
    { intent: 'cart_query', patterns: [/\b(cart|basket|bag|my items|my order)\b/i] },
    { intent: 'wishlist_query', patterns: [/\b(wishlist|favorites|saved|liked)\b/i] },
    { intent: 'price_query', patterns: [/\b(price|cost|how much|cheap|expensive|affordable)\b/i] },
    { intent: 'stock_query', patterns: [/\b(stock|available|in stock|availability)\b/i] },
    { intent: 'deal_query', patterns: [/\b(deal|discount|sale|offer|promo|coupon)\b/i] },
    { intent: 'shipping_query', patterns: [/\b(ship|shipping|delivery|deliver|when will|arrive)\b/i] },
    { intent: 'greeting', patterns: [/^(hi|hello|hey|yo|sup|good morning|good afternoon)\b/i] },
    { intent: 'help', patterns: [/\b(help|support|assist|what can you|how do)\b/i] }
  ];
  
  for (const { intent, patterns } of intents) {
    if (patterns.some(p => p.test(msg))) {
      return intent;
    }
  }
  
  return 'general';
}

// Entity extraction - pulls out important information from message
function extractEntities(message) {
  const entities = {
    numbers: [],
    products: [],
    categories: [],
    brands: [],
    priceRange: null
  };
  
  // Extract numbers
  const numbers = message.match(/\d+\.?\d*/g);
  if (numbers) {
    entities.numbers = numbers.map(n => parseFloat(n));
  }
  
  // Extract price range
  const underMatch = message.match(/under\s+(£|pound)?\s*(\d+)/i);
  const betweenMatch = message.match(/between\s+(£|pound)?\s*(\d+)\s+and\s+(£|pound)?\s*(\d+)/i);
  
  if (betweenMatch) {
    entities.priceRange = { min: parseFloat(betweenMatch[2]), max: parseFloat(betweenMatch[4]) };
  } else if (underMatch) {
    entities.priceRange = { min: 0, max: parseFloat(underMatch[2]) };
  }
  
  // Extract category mentions
  const categoryMap = {
    'electronics': ['electronics', 'gadget', 'tech', 'electronic'],
    'fashion': ['fashion', 'clothes', 'clothing', 'apparel'],
    'shoes': ['shoe', 'shoes', 'footwear', 'sneaker'],
    'bags': ['bag', 'backpack', 'handbag', 'purse'],
    'home': ['home', 'kitchen', 'decor']
  };
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => message.toLowerCase().includes(k))) {
      entities.categories.push(category);
    }
  }
  
  // Extract product names from database
  productDatabase.forEach(product => {
    const words = product.name.toLowerCase().split(' ');
    if (words.some(word => word.length > 3 && message.toLowerCase().includes(word))) {
      entities.products.push(product);
    }
  });
  
  return entities;
}

// Mathematical calculation engine for chatbot
function calculateFromChat(message, entities) {
  const msg = message.toLowerCase();
  const nums = entities.numbers;
  
  // Product price calculations
  if (entities.products.length >= 2 && /\b(add|plus|sum|total)\b/i.test(msg)) {
    const total = entities.products.reduce((sum, p) => sum + p.price, 0);
    const names = entities.products.map(p => p.name).join(' and ');
    return {
      type: 'product_sum',
      result: total,
      description: `${names} = £${total.toFixed(2)}`
    };
  }
  
  // Basic arithmetic
  if (nums.length >= 2) {
    if (/\b(add|plus|sum|total)\b/i.test(msg)) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return { type: 'sum', result: sum, description: `${nums.join(' + ')} = ${sum.toFixed(2)}` };
    }
    if (/\b(subtract|minus)\b/i.test(msg)) {
      const result = nums[0] - nums[1];
      return { type: 'subtract', result, description: `${nums[0]} - ${nums[1]} = ${result.toFixed(2)}` };
    }
    if (/\b(multiply|times)\b/i.test(msg)) {
      const result = nums.reduce((a, b) => a * b, 1);
      return { type: 'multiply', result, description: `${nums.join(' × ')} = ${result.toFixed(2)}` };
    }
    if (/\b(divide|divided)\b/i.test(msg)) {
      const result = nums[0] / nums[1];
      return { type: 'divide', result, description: `${nums[0]} ÷ ${nums[1]} = ${result.toFixed(2)}` };
    }
  }
  
  return null;
}

// Smart product recommendation engine
function getSmartRecommendations(context, count = 3) {
  let products = [...productDatabase];
  
  // Filter by budget if set
  if (context.budget) {
    products = products.filter(p => p.price <= context.budget);
  }
  
  // Filter by interests/categories
  if (context.interests.length > 0) {
    products = products.filter(p => context.interests.includes(p.category));
  }
  
  // Calculate recommendation score
  products = products.map(p => {
    let score = 0;
    
    // High discount = higher score
    score += p.discount * 2;
    
    // Good stock = higher score
    if (p.stock > 20) score += 10;
    
    // Lower price = slight boost (for budget-conscious)
    score += (500 - p.price) / 50;
    
    // Check if similar to browsed products
    if (context.browsedProducts.some(bp => bp.category === p.category)) {
      score += 15;
    }
    
    return { ...p, score };
  });
  
  // Sort by score and return top N
  return products.sort((a, b) => b.score - a.score).slice(0, count);
}

// Generate rich product card HTML
function createProductCard(product) {
  const originalPrice = (product.price / (1 - product.discount/100)).toFixed(2);
  const savings = (originalPrice - product.price).toFixed(2);
  
  return `
    <div style="
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem;
      margin: 0.75rem 0;
      transition: all 0.3s;
    ">
      <div style="display: flex; gap: 1rem; align-items: start;">
        <div style="
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        ">📦</div>
        <div style="flex: 1;">
          <div style="font-weight: 800; color: #1e293b; font-size: 1.05rem; margin-bottom: 0.25rem;">
            ${product.name}
          </div>
          <div style="color: #64748b; font-size: 0.85rem; margin-bottom: 0.5rem;">
            ${product.category.charAt(0).toUpperCase() + product.category.slice(1)} • ${product.stock} in stock
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div style="color: #10b981; font-weight: 800; font-size: 1.15rem;">£${product.price.toFixed(2)}</div>
            ${product.discount > 0 ? `
              <div style="color: #64748b; text-decoration: line-through; font-size: 0.9rem;">£${originalPrice}</div>
              <div style="background: #fef2f2; color: #ef4444; padding: 0.25rem 0.5rem; border-radius: 6px; font-weight: 700; font-size: 0.8rem;">
                ${product.discount}% OFF • Save £${savings}
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
        <a href="products.html" onclick="localStorage.setItem('pendingSearch', '${product.name}'); return true;" 
           class="product-link-btn" style="flex: 1; text-align: center; padding: 0.6rem; font-size: 0.85rem;">View Product</a>
      </div>
    </div>
  `;
}

const productDatabase = [
  { id: 1, name: 'Wireless Headphones Pro', price: 99.99, category: 'electronics', discount: 25, stock: 45 },
  { id: 2, name: 'Smart Watch Ultra', price: 199.99, category: 'electronics', discount: 15, stock: 32 },
  { id: 3, name: 'Designer Handbag', price: 349.99, category: 'fashion', discount: 30, stock: 18 },
  { id: 4, name: 'Running Shoes Elite', price: 129.99, category: 'shoes', discount: 20, stock: 56 },
  { id: 5, name: 'Gaming Laptop Pro', price: 1299.99, category: 'electronics', discount: 10, stock: 12 },
  { id: 6, name: 'Leather Jacket Premium', price: 249.99, category: 'fashion', discount: 35, stock: 28 },
  { id: 7, name: 'Bluetooth Speaker Max', price: 79.99, category: 'electronics', discount: 40, stock: 67 },
  { id: 8, name: 'Yoga Mat Premium', price: 49.99, category: 'home', discount: 15, stock: 89 },
  { id: 9, name: 'Coffee Maker Deluxe', price: 149.99, category: 'home', discount: 20, stock: 34 },
  { id: 10, name: 'Travel Backpack Pro', price: 89.99, category: 'bags', discount: 25, stock: 41 }
];

// Expose a small demo catalog for other helpers (like voice.js)
if (typeof window !== 'undefined') {
  window.productDatabase = productDatabase;
}

function createChatbotUI() {
  if (document.getElementById('chatbotContainer')) return;

  const chatbotHTML = `
    <div id="chatbotContainer" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 420px;
      height: 650px;
      background: white;
      border-radius: 20px;
      box-shadow: 0 25px 70px rgba(0, 0, 0, 0.25);
      display: none;
      flex-direction: column;
      z-index: 9999;
      border: 1px solid #e2e8f0;
      overflow: hidden;
      animation: slideUp 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    ">
      <!-- Modern Header -->
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 1.75rem 1.5rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        position: relative;
      ">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="
            width: 48px;
            height: 48px;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(10px);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
          ">💬</div>
          <div>
            <div style="color: white; font-weight: 800; font-size: 1.15rem;">
              AI Shopping Assistant
            </div>
            <div id="chatbotStatus" style="color: rgba(255, 255, 255, 0.9); font-size: 0.8rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></span>
              Always here to help
            </div>
          </div>
        </div>
        
	        <div style="display: flex; gap: 0.5rem;">
	          <!-- Voice Output Toggle (Manual) -->
	          <button id="speakerToggle" onclick="toggleSpeaker()" style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
	          " title="Toggle Voice Output">
	            🔊
	          </button>
	          
	          <!-- Close Button -->
	          <button onclick="toggleChatbot()" style="
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s;
          ">
            ✕
          </button>
	        </div>
	      </div>

	      <div style="
	        padding: 0.55rem 1rem 0.5rem;
	        background: #ffffff;
	        border-bottom: 1px solid #eef2ff;
	        display: flex;
	        justify-content: flex-end;
	      ">
	        <button id="chatbotNewChatBtn" onclick="clearChatHistory({ seedBotMessage: 'Started a new chat. Ask me anything.' }); showChatNotification('Started a new chat', 'info');" style="
	          height: 30px;
	          border-radius: 999px;
	          border: 1px solid #e2e8f0;
	          background: #f8fafc;
	          color: #475569;
	          font-size: 0.78rem;
	          font-weight: 700;
	          letter-spacing: 0.1px;
	          cursor: pointer;
	          padding: 0 10px;
	          transition: all 0.2s ease;
	        " onmouseover="this.style.background='#eef2ff'; this.style.borderColor='#cbd5e1'; this.style.color='#334155'"
	           onmouseout="this.style.background='#f8fafc'; this.style.borderColor='#e2e8f0'; this.style.color='#475569'">
	          Start New Chat
	        </button>
	      </div>

	      <!-- Chat Messages -->
	      <div id="chatMessages" style="
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        background: #f8fafc;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      "></div>

      <!-- Smart Suggestions -->
      <div id="smartSuggestions" style="
        padding: 1rem;
        background: white;
        border-top: 1px solid #e2e8f0;
        display: none;
      ">
        <div style="font-size: 0.75rem; font-weight: 700; color: #667eea; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">
          Suggestions
        </div>
        <div id="suggestionsList" style="display: flex; gap: 0.5rem; flex-wrap: wrap;"></div>
      </div>

      <!-- Quick Actions -->
      <div style="
        padding: 1rem;
        background: white;
        border-top: 1px solid #e2e8f0;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
      ">
        <button onclick="sendQuickMessage('Show deals')" class="quick-btn">
           Deals
        </button>
        <button onclick="sendQuickMessage('Compare prices')" class="quick-btn">
           Prices
        </button>
        <button onclick="sendQuickMessage('My cart')" class="quick-btn">
           Cart
        </button>
        <button onclick="sendQuickMessage('Trending')" class="quick-btn">
           Trending
        </button>
        <button onclick="sendQuickMessage('Help')" class="quick-btn">
           Help ?
        </button>
        <button onclick="sendQuickMessage('Contact')" class="quick-btn">
          Support ?
        </button>
      </div>

      <!-- Input Area (NO IMAGE UPLOAD) -->
      <div style="
        padding: 1rem;
        background: white;
        border-top: 1px solid #e2e8f0;
        display: flex;
        gap: 0.75rem;
      ">
        <!-- Voice Input Button -->
        <button id="chatVoiceBtn" onclick="startChatbotVoice()" style="
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          padding: 0.875rem;
          border-radius: 12px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          flex-shrink: 0;
        " title="Voice Input">
          ${micIcon}
        </button>

        <!-- Text Input -->
        <input 
          type="text" 
          id="chatInput" 
          placeholder="Type your message..."
          onkeypress="if(event.key==='Enter') sendChatMessage()"
          style="
            flex: 1;
            padding: 0.875rem 1rem;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-size: 0.95rem;
            outline: none;
            transition: all 0.3s;
          "
          onfocus="this.style.borderColor='#667eea'"
          onblur="this.style.borderColor='#e2e8f0'"
        />

        <!-- Send Button -->
        <button onclick="sendChatMessage()" style="
          background: linear-gradient(135deg, #667eea, #764ba2);
          color: white;
          border: none;
          padding: 0.875rem 1.25rem;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 700;
          font-size: 1.1rem;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          flex-shrink: 0;
        " onmouseover="this.style.transform='scale(1.05)'" 
           onmouseout="this.style.transform='scale(1)'">
          ➤
        </button>
      </div>
    </div>

    <!-- Minimized Toggle Button -->
    <button id="chatbotToggle" onclick="toggleChatbot()" style="
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 65px;
      height: 65px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.5);
      z-index: 9998;
      transition: all 0.3s;
      animation: float 3s ease-in-out infinite;
    " onmouseover="this.style.transform='scale(1.1)'" 
       onmouseout="this.style.transform='scale(1)'">
      <span style="font-size: 1.8rem;">🤖</span>
      <div style="
        position: absolute;
        top: -5px;
        right: -5px;
        width: 18px;
        height: 18px;
        background: #ef4444;
        border-radius: 50%;
        border: 2px solid white;
        animation: pulse 2s infinite;
      "></div>
    </button>

    <style>
      @keyframes slideUp {
        from { transform: translateY(100px) scale(0.9); opacity: 0; }
        to { transform: translateY(0) scale(1); opacity: 1; }
      }

      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-8px); }
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.15); opacity: 0.7; }
      }

      .quick-btn {
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 0.65rem 0.5rem;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 700;
        font-size: 0.8rem;
        transition: all 0.3s;
        color: #475569;
      }

      .quick-btn:hover {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-color: #667eea;
        color: white;
        transform: translateY(-2px);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }

      #chatMessages::-webkit-scrollbar {
        width: 6px;
      }

      #chatMessages::-webkit-scrollbar-track {
        background: transparent;
      }

      #chatMessages::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
      }

      #chatMessages::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }

      .voice-active {
        animation: voicePulse 1s infinite !important;
        background: linear-gradient(135deg, #ef4444, #dc2626) !important;
      }

      .typing-indicator {
        display: inline-flex;
        gap: 4px;
      }

      .typing-indicator span {
        width: 7px;
        height: 7px;
        background: #667eea;
        border-radius: 50%;
        animation: typing 1.4s infinite;
      }

      .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
      .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-8px); opacity: 1; }
      }

      @keyframes voicePulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }

      .product-link-btn {
        display: inline-block;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white !important;
        padding: 0.6rem 1.2rem;
        border-radius: 10px;
        text-decoration: none;
        font-weight: 700;
        font-size: 0.9rem;
        margin-top: 0.75rem;
        transition: all 0.3s;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
      }

      .product-link-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
      }

      @media (max-width: 768px) {
        #chatbotContainer {
          width: min(92vw, 420px) !important;
          height: 70vh !important;
          bottom: 80px !important;
          right: 4vw !important;
          border-radius: 18px !important;
        }

        #chatbotToggle {
          bottom: 15px !important;
          right: 15px !important;
          width: 56px !important;
          height: 56px !important;
        }
      }
    </style>
  `;

  document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  initializeUserContext();
  renderChatHistory();
}

function initializeUserContext() {
  userContext.cartItems = JSON.parse(localStorage.getItem('cart')) || [];
  userContext.wishlistItems = JSON.parse(localStorage.getItem('wishlist')) || [];
  userContext.lastInteraction = new Date();
}

function getSmartAIResponse(message) {
  const lowerMessage = message.toLowerCase();
  const cleanMessage = lowerMessage.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const path = (typeof window !== 'undefined' && window.location && window.location.pathname)
    ? window.location.pathname.toLowerCase()
    : '';
  const isCheckoutPage = path.includes('checkout');

  // Update context
  userContext.messageCount++;
  userContext.lastInteraction = Date.now();
  
  // Analyze sentiment
  const sentiment = analyzeSentiment(message);
  userContext.sentiment = sentiment;
  
  // Detect intent
  const intent = detectIntent(message);
  
  // Extract entities
  const entities = extractEntities(message);
  
  // Store conversation memory with metadata
  if (userContext.conversationMemory.length > 20) {
    userContext.conversationMemory.shift();
  }
  userContext.conversationMemory.push({
    ts: Date.now(),
    text: message,
    intent: intent,
    sentiment: sentiment,
    entities: entities
  });
  
  // Update interests based on mentioned categories
  entities.categories.forEach(cat => {
    if (!userContext.interests.includes(cat)) {
      userContext.interests.push(cat);
    }
  });
  
  // Extract budget if mentioned
  const budgetMatch = message.match(/budget.*?(£|pound)?\s*(\d+)/i) || 
                      message.match(/(under|less than)\s+(£|pound)?\s*(\d+)/i);
  if (budgetMatch) {
    userContext.budget = parseFloat(budgetMatch[budgetMatch.length - 1]);
  }
  
  // Extract name if mentioned
  const nameMatch = message.match(/my name is (\w+)/i) || 
                    message.match(/i'm (\w+)/i) || 
                    message.match(/call me (\w+)/i);
  if (nameMatch) {
    userContext.userName = nameMatch[1];
  }

  // --- Checkout-aware helpers (uses data from checkout.js if available) ---
  const hasWindow = typeof window !== 'undefined';
  const checkoutTotals = hasWindow && window.checkoutTotals ? window.checkoutTotals : null;
  const wantsCheckout = /\b(checkout|go to checkout|proceed to checkout|pay now|place order|complete purchase|finalize order|continue to payment)\b/i.test(lowerMessage);

  if (wantsCheckout && !isCheckoutPage) {
    setTimeout(() => {
      window.location.href = 'checkout.html';
    }, 300);
    return 'Taking you to checkout now.';
  }

  const mentionsTotal =
    lowerMessage.includes('total') ||
    lowerMessage.includes('grand total') ||
    lowerMessage.includes('how much') ||
    lowerMessage.includes('how many am i paying') ||
    lowerMessage.includes('how much am i paying') ||
    lowerMessage.includes('overall cost') ||
    lowerMessage.includes('final amount');

  const mentionsShipping =
    lowerMessage.includes('ship') ||
    lowerMessage.includes('delivery') ||
    lowerMessage.includes('postage') ||
    lowerMessage.includes('shipping cost') ||
    lowerMessage.includes('delivery cost');

  const mentionsTax =
    lowerMessage.includes('tax') ||
    lowerMessage.includes('vat') ||
    lowerMessage.includes('fees') ||
    lowerMessage.includes('extra charges') ||
    lowerMessage.includes('service charge');

  // If we're on the checkout page and we have a live summary,
  // explain the exact order breakdown using checkout.js data.
  if (checkoutTotals && (mentionsTotal || lowerMessage.includes('checkout') || lowerMessage.includes('order summary'))) {
    const { subtotal, shipping, tax, total, itemCount, freeShippingThreshold } = checkoutTotals;

    let shippingText = shipping === 0
      ? `FREE (you passed the £${freeShippingThreshold?.toFixed ? freeShippingThreshold.toFixed(2) : freeShippingThreshold} free-shipping threshold)`
      : `£${shipping.toFixed(2)}`;

    let extraForFree = '';
    if (typeof freeShippingThreshold === 'number' && subtotal < freeShippingThreshold) {
      extraForFree = `<br/>Spend <strong>£${(freeShippingThreshold - subtotal).toFixed(2)}</strong> more to unlock FREE shipping.`;
    }

    return `🧾 <strong>Your current order summary:</strong><br/><br/>
      Items: <strong>${itemCount}</strong><br/>
      Subtotal: <strong>£${subtotal.toFixed(2)}</strong><br/>
      Shipping: <strong>${shippingText}</strong><br/>
      Tax (10%): <strong>£${tax.toFixed(2)}</strong><br/>
      <span style="display:inline-block;margin-top:0.5rem;">Grand total: <strong style="color:#667eea;">£${total.toFixed(2)}</strong></span><br/>${extraForFree}<br/><br/>
      <a href="checkout.html" class="product-link-btn" onclick="window.location.href='checkout.html'; return false;">Continue to payment</a>`;
  }

  if (lowerMessage.includes('price') || lowerMessage.includes('compare')) {
    // Check if we have mathematical calculation intent
    const calculation = calculateFromChat(message, entities);
    if (calculation) {
      return `🧮 <strong>Calculation:</strong><br/><br/>${calculation.description}`;
    }
    
    //Check if comparing specific products
    if (intent === 'compare' && entities.products.length >= 2) {
      let response = `📊 <strong>Product Comparison:</strong><br/><br/>`;
      
      entities.products.slice(0, 3).forEach(product => {
        response += createProductCard(product);
      });
      
      const prices = entities.products.map(p => p.price);
      const cheapest = entities.products.find(p => p.price === Math.min(...prices));
      const mostExpensive = entities.products.find(p => p.price === Math.max(...prices));
      
      response += `<br/><strong>Quick Analysis:</strong><br/>`;
      response += `• Cheapest: ${cheapest.name} at £${cheapest.price.toFixed(2)}<br/>`;
      response += `• Most expensive: ${mostExpensive.name} at £${mostExpensive.price.toFixed(2)}<br/>`;
      response += `• Price difference: £${(mostExpensive.price - cheapest.price).toFixed(2)}`;
      
      return response;
    }
    
    const bestDeals = productDatabase
      .filter(p => p.discount > 15)
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 3);

    let response = `💰 <strong>Price Comparison - Top Deals:</strong><br/><br/>`;
    
    bestDeals.forEach((product) => {
      response += createProductCard(product);
    });

    response += `<a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">Shop All Products</a>`;
    return response;
  }

  if (lowerMessage.includes('deal') || lowerMessage.includes('discount') || lowerMessage.includes('sale') || lowerMessage.includes('offer')) {
    const topDeals = productDatabase
      .sort((a, b) => b.discount - a.discount)
      .slice(0, 3);

    let response = `🔥 <strong>Hottest Deals Right Now:</strong><br/><br/>`;
    
    topDeals.forEach((product) => {
      response += createProductCard(product);
    });

    response += `<a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">🏷️ View All Deals</a>`;
    return response;
  }

  if (lowerMessage.includes('trend') || lowerMessage.includes('popular') || lowerMessage.includes('hot') || lowerMessage.includes('best')) {
    // Use recommendation engine for trending
    const recommendations = getSmartRecommendations(userContext, 3);
    
    let response = `📈 <strong>Trending Products:</strong><br/><br/>`;
    response += `Based on popularity and your ${userContext.interests.length > 0 ? 'interests' : 'browsing'}:<br/>`;
    
    recommendations.forEach(product => {
      response += createProductCard(product);
    });
    
    response += `<a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">📈 See All Trending →</a>`;
    return response;
  }

  // More natural small-talk before strict commerce intents
  if (/\b(hi|hello|hey|hiya|yo|sup|what'?s up|good (morning|afternoon|evening))\b/i.test(message)) {
    const greeting = userContext.userName
      ? `👋 Hi ${userContext.userName}! Great to see you again!`
      : `👋 Hey there! Welcome ${userContext.messageCount > 1 ? 'back' : 'to AIShop'}!`;
    
    const cart = userContext.cartItems || [];
    const cartHint = cart.length > 0
      ? `<br/><br/>📦 You have ${cart.length} item${cart.length > 1 ? 's' : ''} in your cart (£${cart.reduce((s, i) => s + (i.price * (i.quantity || 1)), 0).toFixed(2)})`
      : '';
    
    const interestHint = userContext.interests.length > 0
      ? `<br/>I noticed you're interested in ${userContext.interests.join(' and ')}!`
      : '';
    
    return `${greeting}<br/><br/>I can help you with product search, price comparisons, math calculations, smart recommendations, and more!${cartHint}${interestHint}<br/><br/>What can I help you find today?`;
  }

  // Smart recommendations trigger
  if (/\b(recommend|suggest|what should|advice|help me (choose|pick|decide)|show me something)\b/i.test(message)) {
    const recommendations = getSmartRecommendations(userContext, 3);
    
    if (recommendations.length === 0) {
      return `I'd love to give you personalized recommendations!<br/><br/>` +
             `Tell me:<br/>• What's your budget?<br/>• What interests you (electronics, fashion, etc)?<br/>• Any specific needs?<br/><br/>` +
             `Or just say "surprise me" for random picks!`;
    }
    
    let response = `✨ <strong>Personalized for You${userContext.budget ? ' (£' + userContext.budget + ' budget)' : ''}:</strong><br/><br/>`;
    response += `${userContext.interests.length > 0 ? 'Based on your interest in ' + userContext.interests.join(', ') : 'Top picks'} right now:<br/>`;
    
    recommendations.forEach(product => {
      response += createProductCard(product);
    });
    
    return response;
  }

  if (/how are you|how's it going|how are u|how r u|are you ok/i.test(cleanMessage)) {
    return 'I\'m doing great and ready to help you shop! Thanks for asking 💙 What can I help you with right now? Deals, prices, or your cart?';
  }

  if (/who are you|what are you|are you (a )?bot|are you real/i.test(cleanMessage)) {
    return 'I\'m an AI assistant made just for AIShop. I don\'t know everything about the world, but I\'m very good at helping with products, deals, your cart, shipping, and checkout.';
  }

  if (/thank(s| you)?|thx|tysm|cheers/i.test(cleanMessage)) {
    return pickRandom([
      'You\'re very welcome! 💙 Anything else I can help with?',
      'Happy to help! Want to check your cart or see more deals?',
      'No problem at all! I\'m here if you need anything else.'
    ]);
  }

  if (/bye|goodbye|see you|cya|that'?s all|i'?m done|no thanks/i.test(cleanMessage)) {
    return 'Got it! 😊 You can close the chat whenever you like. If you need me again, just open me and start typing or talking.';
  }

  // Simple product/category search from user text
  const categoryKeywords = [
    { key: 'electronics', words: ['electronics', 'gadget', 'tech', 'headphone', 'headphones', 'watch', 'speaker', 'laptop'] },
    { key: 'fashion', words: ['fashion', 'clothes', 'clothing', 'jacket', 'coat', 'handbag', 'bag'] },
    { key: 'shoes', words: ['shoe', 'shoes', 'sneaker', 'trainers', 'running'] },
    { key: 'home', words: ['home', 'kitchen', 'coffee maker', 'coffee', 'yoga', 'mat'] },
    { key: 'bags', words: ['backpack', 'bag', 'travel bag', 'rucksack'] }
  ];

  const matchedCategories = categoryKeywords.filter(cat =>
    cat.words.some(w => cleanMessage.includes(w))
  );

  if (matchedCategories.length > 0) {
    const cats = matchedCategories.map(c => c.key);
    const matches = productDatabase.filter(p => cats.includes(p.category));

    if (matches.length) {
      let response = `🔍 <strong>Found Products:</strong><br/><br/>`;      response += `Showing ${Math.min(matches.length, 3)} of ${matches.length} ${cats.join(', ')} products:<br/>`;
      
      matches.slice(0, 3).forEach((product) => {
        response += createProductCard(product);
      });

      if (matches.length > 3) {
        response += `<br/>Plus ${matches.length - 3} more in this category!`;
      }

      response += `<br/><a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">🔎 View All Products</a>`;
      return response;
    }
  }

  if (lowerMessage.includes('cart') || lowerMessage.includes('basket') || lowerMessage.includes('my items')) {
    const cart = userContext.cartItems;
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (cart.length === 0) {
      return ` <strong>Your cart is empty</strong><br/><br/>
        Start shopping for amazing products!<br/><br/>
        <a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">Browse Products</a>`;
    }
    
    const needsShipping = total < 50;
    return `<strong>Cart Summary:</strong><br/><br/>
      <strong>${cart.length} items</strong><br/>
      Total: <strong style="color: #667eea;">£${total.toFixed(2)}</strong><br/>
            ${needsShipping ? `Add £${(50 - total).toFixed(2)} for FREE shipping` : 'FREE shipping included'}<br/><br/>
          <a href="cart.html" class="product-link-btn" onclick="window.location.href='cart.html'; return false;">View Cart →</a>`;
  }

  if (lowerMessage.includes('wishlist') || lowerMessage.includes('favorite') || lowerMessage.includes('saved')) {
    const wishlist = userContext.wishlistItems;
    
    if (wishlist.length === 0) {
      return `<strong>Wishlist is empty</strong><br/><br/>
        Browse products and save your favorites!<br/><br/>
        <a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">Start Browsing</a>`;
    }
    
    return `<strong>Your Wishlist:</strong><br/><br/>
      You have <strong>${wishlist.length} saved items</strong><br/><br/>
      <a href="wishlist.html" class="product-link-btn" onclick="window.location.href='wishlist.html'; return false;">View Wishlist →</a>`;
  }

  if (lowerMessage.includes('product') || lowerMessage.includes('shop') || lowerMessage.includes('buy') || lowerMessage.includes('browse')) {
    return `<strong>Product Categories:</strong><br/><br/>
       -Electronics - Latest gadgets<br/>
     - Fashion - Trendy styles<br/>
      - Shoes - All styles & sizes<br/>
       -Bags - Designer & casual<br/>
       -Home - Essentials & decor<br/><br/>
      <a href="products.html" class="product-link-btn" onclick="window.location.href='products.html'; return false;">Browse All →</a>`;
  }

  // Tax-specific questions during checkout
  if (checkoutTotals && mentionsTax) {
    const { subtotal, tax, total } = checkoutTotals;
    return `💸 <strong>Tax on your order:</strong><br/><br/>
      We apply a <strong>10% tax</strong> on the item subtotal.<br/>
      Current subtotal: <strong>£${subtotal.toFixed(2)}</strong><br/>
      Tax amount: <strong>£${tax.toFixed(2)}</strong><br/>
      Total including tax: <strong style="color:#667eea;">£${total.toFixed(2)}</strong><br/><br/>
      If you change the items in your cart or quantities, these values will update automatically on the checkout page.`;
  }

  if (mentionsShipping || (checkoutTotals && lowerMessage.includes('track'))) {
    if (checkoutTotals) {
      const { subtotal, shipping, freeShippingThreshold } = checkoutTotals;
      const hasFree = shipping === 0;
      const extraNeeded = typeof freeShippingThreshold === 'number' && subtotal < freeShippingThreshold
        ? `Spend <strong>£${(freeShippingThreshold - subtotal).toFixed(2)}</strong> more to unlock FREE shipping.`
        : '';

      return `<strong>Shipping for your current order:</strong><br/><br/>
        Shipping cost: <strong>${hasFree ? 'FREE 🎉' : '£' + shipping.toFixed(2)}</strong><br/>
        Free-shipping threshold: <strong>£${freeShippingThreshold?.toFixed ? freeShippingThreshold.toFixed(2) : freeShippingThreshold}</strong><br/>${extraNeeded}<br/><br/>
        Standard delivery: <strong>3-5 business days</strong><br/>
        Express delivery: <strong>1-2 business days</strong> (where available).`;
    }

    return `<strong>Shipping Info:</strong><br/><br/>
       -FREE shipping on qualifying orders<br/>
       -Standard: 3-5 days<br/>
       -Express: 1-2 days<br/>
       -International available<br/><br/>
      <a href="contact.html" class="product-link-btn" onclick="window.location.href='contact.html'; return false;">Contact Us</a>`;
  }

  if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
    return `↩️ <strong>Returns & Refunds:</strong><br/><br/>
      - 30-day return policy<br/>
      - Full refund guaranteed<br/>
       -Free return shipping<br/>
       -Quick processing<br/><br/>
      <a href="contact.html" class="product-link-btn" onclick="window.location.href='contact.html'; return false;">Get Help</a>`;
  }

  if (lowerMessage.includes('contact') || lowerMessage.includes('support') || lowerMessage.includes('help')) {
    return `<strong>Customer Support:</strong><br/><br/>
      Email: support@aishop.com<br/>
      Phone: 1-800-AISHOP<br/>
       Live chat: 24/7<br/>
      Response time: Under 1 hour<br/><br/>
      <a href="contact.html" class="product-link-btn" onclick="window.location.href='contact.html'; return false;">Contact Now →</a>`;
  }

  if (lowerMessage.includes('about') || lowerMessage.includes('who') || lowerMessage.includes('company')) {
    return `ℹ️ <strong>About AIShop:</strong><br/><br/>
      - AI-powered shopping platform<br/>
       -100% secure payments<br/>
       -Fast worldwide delivery<br/>
       -Quality guaranteed<br/><br/>
      <a href="about.html" class="product-link-btn" onclick="window.location.href='about.html'; return false;">ℹ️ Learn More →</a>`;
  }

  return pickRandom([
    `I\'m not totally sure I understood that, but I can help with deals, price comparisons, your cart, shipping, and checkout.<br/><br/>
     Try one of these quick options:<br/>
     <a href="#" onclick="sendQuickMessage('Show deals'); return false;">Best Deals</a><br/>
     <a href="#" onclick="sendQuickMessage('Compare prices'); return false;">Price Comparison</a><br/>
     <a href="#" onclick="sendQuickMessage('My cart'); return false;">Cart Summary</a><br/>
     <a href="#" onclick="sendQuickMessage('Shipping'); return false;">Shipping Info</a>`,

    `I might not fully get that specific question, but I\'m great at shopping help<br/><br/>
     You can ask me to:<br/>
     • Show current deals<br/>
     • Compare prices<br/>
     • Summarise your cart<br/>
     • Explain shipping or tax`,

    `I\'m still learning, so I may miss some questions.<br/><br/>
     Here are some things I can definitely do:<br/>
     - Find hot deals and discounts<br/>
     - Help compare products<br/>
     - Show what\'s in your cart<br/>
     - Explain checkout, shipping and tax`]
  );
}

function toggleSpeaker() {
  autoSpeakEnabled = !autoSpeakEnabled;
  const btn = document.getElementById('speakerToggle');
  if (btn) {
    btn.textContent = autoSpeakEnabled ? '🔊' : '🔇';
    btn.title = autoSpeakEnabled ? 'Voice ON' : 'Voice OFF';
  }
  showChatNotification(
    autoSpeakEnabled ? '🔊 Voice responses enabled' : '🔇 Voice responses disabled',
    'info'
  );
}

function startChatbotVoice() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showChatNotification(' Voice not supported in this browser', 'error');
    return;
  }

  const voiceBtn = document.getElementById('chatVoiceBtn');
  const statusDiv = document.getElementById('chatbotStatus');
  const chatInput = document.getElementById('chatInput');

  if (isChatbotListening) {
    if (chatbotRecognition) chatbotRecognition.stop();
    isChatbotListening = false;
    voiceBtn.classList.remove('voice-active');
    voiceBtn.innerHTML = micIcon;
    statusDiv.innerHTML = '<span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></span> Always here to help';
    chatInput.placeholder = 'Type your message...';
    return;
  }

  isChatbotListening = true;
  voiceBtn.classList.add('voice-active');
  voiceBtn.innerHTML = micActiveIcon;
  statusDiv.innerHTML = 'Listening...';
  chatInput.placeholder = 'Listening...';

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  chatbotRecognition = new SpeechRecognition();
  chatbotRecognition.continuous = false;
  chatbotRecognition.interimResults = true;
  chatbotRecognition.lang = 'en-US';

  chatbotRecognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    if (interimTranscript) chatInput.value = interimTranscript;

    if (finalTranscript) {
      chatInput.value = finalTranscript;
      setTimeout(() => {
        sendChatMessage();
        stopChatbotVoice();
      }, 500);
    }
  };

  chatbotRecognition.onerror = (event) => {
    console.error('Voice error:', event.error);
    stopChatbotVoice();
    if (event.error === 'no-speech') {
      showChatNotification('No speech detected', 'warning');
    }
  };

  chatbotRecognition.onend = () => {
    if (isChatbotListening) stopChatbotVoice();
  };

  try {
    chatbotRecognition.start();
  } catch (error) {
    console.error('Voice start error:', error);
    stopChatbotVoice();
  }
}

function stopChatbotVoice() {
  isChatbotListening = false;
  const voiceBtn = document.getElementById('chatVoiceBtn');
  const statusDiv = document.getElementById('chatbotStatus');
  const chatInput = document.getElementById('chatInput');

  if (voiceBtn) {
    voiceBtn.classList.remove('voice-active');
    voiceBtn.innerHTML = micIcon;
  }
  if (statusDiv) {
    statusDiv.innerHTML = '<span style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; animation: pulse 2s infinite;"></span> Always here to help';
  }
  if (chatInput) chatInput.placeholder = 'Type your message...';
  if (chatbotRecognition) {
    chatbotRecognition.stop();
    chatbotRecognition = null;
  }
}

function speakChatResponse(text) {
  if (!autoSpeakEnabled) return; 
  if (!('speechSynthesis' in window)) return;

  let cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  
  window.speechSynthesis.cancel();

  setTimeout(() => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'en-US';

    let preferred = null;
    try {
      if (typeof window.getAssistantVoice === 'function') {
        preferred = window.getAssistantVoice();
      }
    } catch (e) {}

    if (!preferred && typeof window.assistantVoiceName === 'string' && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      preferred = voices.find(v => v.name === window.assistantVoiceName) || null;
    }

    if (preferred) {
      utterance.voice = preferred;
    }

    // Match the neutral tone used by the main voice assistant
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    window.speechSynthesis.speak(utterance);
  }, 100);
}

function toggleChatbot() {
  const container = document.getElementById('chatbotContainer');
  const toggle = document.getElementById('chatbotToggle');
  
  if (!container || !toggle) {
    createChatbotUI();
    setTimeout(toggleChatbot, 100);
    return;
  }

  isChatbotOpen = !isChatbotOpen;
  
  if (isChatbotOpen) {
    container.style.display = 'flex';
    toggle.style.display = 'none';
    document.getElementById('chatInput')?.focus();
  } else {
    container.style.display = 'none';
    toggle.style.display = 'flex';
    stopChatbotVoice();
    speechSynthesis.cancel();
  }
}

function sendQuickMessage(message) {
  const input = document.getElementById('chatInput');
  if (input) {
    input.value = message;
    sendChatMessage();
  }
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const messagesContainer = document.getElementById('chatMessages');
  
  if (!input || !messagesContainer) return;
  
  const message = input.value.trim();
  if (!message) return;

  if (/(^|\b)(new chat|start new chat|clear chat|reset chat|clear conversation|start new conversation|delete chat history)(\b|$)/i.test(message)) {
    input.value = '';
    clearChatHistory({ seedBotMessage: 'Started a new chat. Ask me anything.' });
    showChatNotification('Started a new chat', 'info');
    return;
  }

  appendChatMessage('user', message);
  input.value = '';

  const typingHTML = `
    <div id="typingIndicator" style="
      background: white;
      padding: 1rem 1.25rem;
      border-radius: 16px 16px 16px 4px;
      max-width: 80%;
      align-self: flex-start;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      border-left: 3px solid #667eea;
    ">
      <div style="color: #667eea; font-weight: 700; font-size: 0.85rem; margin-bottom: 0.5rem;">AI Typing...</div>
      <div class="typing-indicator">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  
  messagesContainer.insertAdjacentHTML('beforeend', typingHTML);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Purely rule-based, local response
  setTimeout(() => {
    const response = getSmartAIResponse(message);

    document.getElementById('typingIndicator')?.remove();
    appendChatMessage('bot', response);

    speakChatResponse(response);
    showSmartSuggestions(message);
  }, 700);
}

function showSmartSuggestions(lastMessage) {
  const suggestions = [];
  const lowerMsg = lastMessage.toLowerCase();

  if (lowerMsg.includes('price') || lowerMsg.includes('deal')) {
    suggestions.push('View cart', 'Best sellers', 'New arrivals');
  } else if (lowerMsg.includes('cart')) {
    suggestions.push('Checkout', 'Continue shopping', 'Apply coupon');
  } else if (lowerMsg.includes('product')) {
    suggestions.push('Show deals', 'Compare prices', 'Trending');
  } else {
    suggestions.push('Best deals', 'My cart', 'Help');
  }

  const suggestionsBar = document.getElementById('smartSuggestions');
  const suggestionsList = document.getElementById('suggestionsList');
  
  if (suggestions.length > 0 && suggestionsBar && suggestionsList) {
    suggestionsList.innerHTML = suggestions.map(s => 
      `<button onclick="sendQuickMessage('${s}')" style="
        background: #f1f5f9;
        border: 1px solid #e2e8f0;
        padding: 0.5rem 0.75rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        color: #475569;
        transition: all 0.3s;
      " onmouseover="this.style.background='#667eea'; this.style.color='white'; this.style.borderColor='#667eea'" 
         onmouseout="this.style.background='#f1f5f9'; this.style.color='#475569'; this.style.borderColor='#e2e8f0'">
        ${s}
      </button>`
    ).join('');
    suggestionsBar.style.display = 'block';
  }
}

function showChatNotification(message, type = 'info') {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#667eea'
  };

  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: ${colors[type]};
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    z-index: 100000;
    font-weight: 700;
    font-size: 0.95rem;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(400px)';
    notification.style.transition = 'all 0.3s';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

window.clearChatHistory = clearChatHistory;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createChatbotUI);
} else {
  createChatbotUI();
}
