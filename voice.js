let isListening = false;
let recognition = null;
let rippleInterval = null;
let voiceProductsCache = null;
let currentVoiceLang = 'en-US';
let speechUnlocked = false;
let isMuted = false;
let speechRate = 1.05;
let speechVolume = 1.0;
let lastSpokenText = '';
let lastHeardText = '';
let voiceKeepAlive = false;
let assistantPersistent = false;
let keepAliveTimeoutId = null;
let lastComparisonIds = [];
let lastProductFocusIndex = -1;
const MAX_VOICE_CHAT_HISTORY = 80;
const VOICE_CHAT_HISTORY_KEY = 'voiceConversationHistory';
let voiceChatHistory = loadVoiceChatHistory();


const VoiceModule = {
  isSpeaking: false,
  cachedVoice: null,
  stop() {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (e) {}
    this.isSpeaking = false;
  },

  unlock() {
    if (speechUnlocked || !window.speechSynthesis) return;
    const silent = new SpeechSynthesisUtterance('');
    silent.volume = 10;
    window.speechSynthesis.speak(silent);
    speechUnlocked = true;
  },

  getAssistantVoice() {
    if (!window.speechSynthesis) return null;
    if (this.cachedVoice) return this.cachedVoice;

    const voices = window.speechSynthesis.getVoices();
    // Look for high-quality female assistant voices
    const preferred = voices.filter(v => 
      v.lang.startsWith('en') && 
      /(samantha|siri|karen|victoria|female|google us english female|aria|jenny)/i.test(v.name)
    );
    
    this.cachedVoice = preferred[0] || voices.find(v => v.lang.startsWith('en')) || voices[0];
    return this.cachedVoice;
  },

  speak(text, tone = 'neutral', callback = null) {
    if (!window.speechSynthesis) {
      if (callback) callback();
      return;
    }

    if (isMuted) {
      if (callback) callback();
      return;
    }

    try {
      this.unlock();
      window.speechSynthesis.resume();
    } catch (e) {}

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.getAssistantVoice();

    // Apply the tone settings you created
    if (tone === 'empathetic') {
      utterance.rate = 0.95 * speechRate; utterance.pitch = 0.95; utterance.volume = Math.min(1, speechVolume);
    } else if (tone === 'excited') {
      utterance.rate = 1.15 * speechRate; utterance.pitch = 1.15; utterance.volume = Math.min(1, speechVolume);
    } else {
      utterance.rate = 1.05 * speechRate; utterance.pitch = 1.0; utterance.volume = Math.min(1, speechVolume);
    }

    this.isSpeaking = true;
    lastSpokenText = text;

    // Failsafe: Ensures the action always executes even if the browser audio glitches
    const durationEstimate = Math.max(2000, text.length * 60);
    const failSafe = setTimeout(() => {
      this.isSpeaking = false;
      if (callback) callback();
    }, durationEstimate);

    utterance.onend = () => {
      clearTimeout(failSafe);
      this.isSpeaking = false;
      if (callback) callback();
    };

    window.speechSynthesis.speak(utterance);
    setTimeout(() => {
      try {
        if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
          updateSiriTranscript('Audio may be blocked. Tap the mic button to enable sound.');
        }
      } catch (e) {}
    }, 600);
  }
};

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => VoiceModule.getAssistantVoice();
}

// 2. SPEECH RECOGNITION ENGINE
(function initVoiceAI() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return console.error('Speech recognition not supported');

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = true; // Shows text as you speak
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isListening = true;
    showFuturisticInterface();
    startRippleAnimation();
    updateSiriStatus('Listening...');
    updateSiriTranscript('Say something like "show deals" or "open cart".');
  };

  recognition.onresult = (event) => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) final += event.results[i][0].transcript;
      else interim += event.results[i][0].transcript;
    }

    if (interim) {
      updateChatUI('user', interim + '...');
      updateSiriTranscript(`Hearing: ${interim}...`, true);
    }
    
    if (final) {
      const command = final.trim();
      lastHeardText = command;
      updateChatUI('user', command);
      updateSiriTranscript(`Heard: "${command}"`);
      stopRippleAnimation();
      updateSiriStatus('Processing...');
      setSiriThinking(true);
      
      Promise.resolve(processVoiceCommand(command)).finally(() => {
        setSiriThinking(false);
        updateSiriStatus('Listening...');
      });
    }
  };

  recognition.onerror = (e) => {
    if (e.error !== 'no-speech') {
      updateSiriStatus('Mic error');
      updateSiriTranscript(`Speech error: ${e.error}. Check mic permission and reload.`);
      stopVoice();
    }
  };

  recognition.onend = () => {
    isListening = false;
    stopRippleAnimation();
    if (VoiceModule.isSpeaking || voiceKeepAlive || assistantPersistent) {
      updateSiriStatus('Processing...');
      return;
    }
    if (!document.querySelector('.siri-interface.thinking')) {
      updateSiriStatus('Paused');
      updateSiriTranscript('Tap "Listen Again" to continue.');
    }
  };
})();

function startVoice() {
  VoiceModule.unlock(); // Fixes audio blocking
  if (!recognition) return alert('Voice not supported. Use Chrome/Safari.');
  if (isListening) return pauseVoice();
  isMuted = false;
  speechVolume = 1.0;
  try { recognition.start(); } catch (e) { console.error(e); }
}

function pauseVoice() {
  if (recognition && isListening) { try { recognition.stop(); } catch (e) {} }
  voiceKeepAlive = false;
  assistantPersistent = false;
  isListening = false;
  stopRippleAnimation();
  updateSiriStatus('Paused');
  updateSiriTranscript('Tap "Listen Again" to continue.');
}

function stopVoice() {
  if (recognition && isListening) { try { recognition.stop(); } catch (e) {} }
  voiceKeepAlive = false;
  assistantPersistent = false;
  isListening = false;
  stopRippleAnimation();
  hideFuturisticInterface();
}

function listenAgain() {
  VoiceModule.unlock();
  if (!recognition) return;
  if (isListening) return;
  voiceKeepAlive = true;
  assistantPersistent = true;
  updateSiriStatus('Listening...');
  updateSiriTranscript('Listening again. Say your next command.');
  try { recognition.start(); } catch (e) { console.error(e); }
}


// 3. YOUR DATA HELPERS & NLP

function getCartData() {
  try {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    return { cart, itemCount, totalPrice };
  } catch (e) {
    return { cart: [], itemCount: 0, totalPrice: 0 };
  }
}

function getWishlistData() {
  try {
    const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
    return { wishlist, count: wishlist.length };
  } catch (e) {
    return { wishlist: [], count: 0 };
  }
}

function updateSiriStatus(text) {
  const el = document.getElementById('siriStatus');
  if (el) el.textContent = text;
}

function updateSiriTranscript(text, isInterim = false) {
  const el = document.getElementById('siriTranscript');
  if (el) {
    el.textContent = text;
    el.classList.toggle('interim', isInterim);
  }
}

function loadVoiceChatHistory() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return [];
    const navEntry = (performance.getEntriesByType('navigation') || [])[0];
    if (navEntry && navEntry.type === 'reload') {
      window.sessionStorage.removeItem(VOICE_CHAT_HISTORY_KEY);
      return [];
    }
    const raw = window.sessionStorage.getItem(VOICE_CHAT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(item =>
        item &&
        (item.sender === 'user' || item.sender === 'ai') &&
        typeof item.text === 'string'
      )
      .slice(-MAX_VOICE_CHAT_HISTORY);
  } catch (e) {
    return [];
  }
}

function persistVoiceChatHistory() {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.setItem(
      VOICE_CHAT_HISTORY_KEY,
      JSON.stringify(voiceChatHistory.slice(-MAX_VOICE_CHAT_HISTORY))
    );
  } catch (e) {}
}

function clearVoiceChatHistory(options = {}) {
  const { seedMessage = 'Started a new chat. I am ready when you are.' } = options;
  voiceChatHistory = [];
  if (seedMessage) {
    voiceChatHistory.push({ sender: 'ai', text: seedMessage, html: false });
  }
  persistVoiceChatHistory();
  renderVoiceChatHistory();
}

function renderVoiceChatHistory() {
  const chatBox = document.getElementById('aiChatBox');
  if (!chatBox) return;
  chatBox.innerHTML = '';

  if (!voiceChatHistory.length) {
    voiceChatHistory.push({ sender: 'ai', text: 'Hi! I\'m listening. How can I help?', html: false });
    persistVoiceChatHistory();
  }

  voiceChatHistory.forEach(entry => {
    updateChatUI(entry.sender, entry.text, { html: Boolean(entry.html), skipPersist: true });
  });
}

function showCommandOverlay() {
  const el = document.getElementById('siriCommandOverlay');
  if (el) {
    el.classList.add('active');
    el.setAttribute('aria-hidden', 'false');
  }
}

function hideCommandOverlay() {
  const el = document.getElementById('siriCommandOverlay');
  if (el) {
    el.classList.remove('active');
    el.setAttribute('aria-hidden', 'true');
  }
}

function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) {
    VoiceModule.stop();
    updateSiriStatus('Muted');
    updateSiriTranscript('Say "unmute" to enable voice again.');
  } else {
    updateSiriStatus('Listening...');
    updateSiriTranscript('Say a command.');
  }
}

function scrollToSection(selectors) {
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return true;
    }
  }
  return false;
}

function getProductCards() {
  return Array.from(document.querySelectorAll('.product-card'));
}

function focusProductByIndex(index) {
  const cards = getProductCards();
  if (!cards.length) return false;
  const safeIndex = Math.max(0, Math.min(cards.length - 1, index));
  const target = cards[safeIndex];
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  lastProductFocusIndex = safeIndex;
  return true;
}

function focusNextProduct() {
  const cards = getProductCards();
  if (!cards.length) return false;
  let nextIndex = lastProductFocusIndex;
  if (nextIndex < 0) {
    const firstVisible = cards.findIndex(card => card.getBoundingClientRect().top >= 0);
    nextIndex = firstVisible >= 0 ? firstVisible : 0;
  } else {
    nextIndex = Math.min(cards.length - 1, nextIndex + 1);
  }
  return focusProductByIndex(nextIndex);
}

function focusPreviousProduct() {
  const cards = getProductCards();
  if (!cards.length) return false;
  let prevIndex = lastProductFocusIndex;
  if (prevIndex < 0) {
    const firstVisible = cards.findIndex(card => card.getBoundingClientRect().top >= 0);
    prevIndex = firstVisible > 0 ? firstVisible - 1 : 0;
  } else {
    prevIndex = Math.max(0, prevIndex - 1);
  }
  return focusProductByIndex(prevIndex);
}

function openProductByIndex(index) {
  const cards = getProductCards();
  if (!cards.length) return false;
  const safeIndex = Math.max(0, Math.min(cards.length - 1, index));
  const target = cards[safeIndex];
  if (!target) return false;
  target.click();
  lastProductFocusIndex = safeIndex;
  return true;
}

function clickPagination(direction) {
  const btns = Array.from(document.querySelectorAll('.pagination-btn'));
  if (!btns.length) return false;
  const label = direction === 'next' ? 'next' : 'previous';
  const target = btns.find(btn => btn.textContent.toLowerCase().includes(label));
  if (target && !target.disabled) {
    target.click();
    return true;
  }
  return false;
}

function calculateFromCommand(command, products) {
  const cmd = command.toLowerCase();
  if (/(add|plus|sum|total|calculate|what is|what's)/i.test(cmd)) {
    const numbers = cmd.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) {
      const nums = numbers.map(n => parseFloat(n));
      return { type: 'sum', numbers: nums, result: nums.reduce((a, b) => a + b, 0) };
    }
    const productMatches = [];
    products.forEach(product => {
      const nameWords = product.name.toLowerCase().split(' ');
      if (nameWords.some(word => word.length > 3 && cmd.includes(word))) {
        productMatches.push(product);
      }
    });
    if (productMatches.length >= 2) {
      return { type: 'productSum', products: productMatches, result: productMatches.reduce((total, p) => total + p.price, 0) };
    }
  }
  if (/subtract|minus|difference|take away/i.test(cmd)) {
    const numbers = cmd.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) return { type: 'subtract', numbers: numbers.map(n => parseFloat(n)), result: numbers.map(n => parseFloat(n)).reduce((a, b) => a - b) };
  }
  if (/multiply|times|product of/i.test(cmd)) {
    const numbers = cmd.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) return { type: 'multiply', numbers: numbers.map(n => parseFloat(n)), result: numbers.map(n => parseFloat(n)).reduce((a, b) => a * b, 1) };
  }
  if (/divide|divided by/i.test(cmd)) {
    const numbers = cmd.match(/\d+\.?\d*/g);
    if (numbers && numbers.length >= 2) return { type: 'divide', numbers: numbers.map(n => parseFloat(n)), result: parseFloat(numbers[0]) / parseFloat(numbers[1]) };
  }
  return null;
}

async function loadVoiceProducts() {
  if (voiceProductsCache && Array.isArray(voiceProductsCache) && voiceProductsCache.length) return voiceProductsCache;
  try {
    const res = await fetch('/api/products');
    if (res.ok) {
      const data = await res.json();
      voiceProductsCache = Array.isArray(data) ? data : (data.products || []);
    }
  } catch (e) {}
  if (!voiceProductsCache || !voiceProductsCache.length) {
    if (typeof getFallbackProducts === 'function') { try { voiceProductsCache = getFallbackProducts() || []; } catch (e) { voiceProductsCache = []; } }
    else if (window.productDatabase) { voiceProductsCache = window.productDatabase; }
    else { voiceProductsCache = []; }
  }
  return voiceProductsCache;
}

function buildVoiceComparisonSummary(products) {
  if (!products || products.length < 2) return 'I could not find enough matching products to compare.';
  const sorted = [...products].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const mostExpensive = sorted[sorted.length - 1];
  let summary = 'Here is a quick comparison: ';
  summary += products.map(p => `${p.name} at £${Number(p.price).toFixed(2)}${p.category ? ' in ' + p.category : ''}`).join(', ');
  summary += `. The cheapest is ${cheapest.name} at £${Number(cheapest.price).toFixed(2)}`;
  if (products.length > 1 && mostExpensive !== cheapest) {
    const diff = Number(mostExpensive.price) - Number(cheapest.price);
    if (!isNaN(diff) && diff > 0) summary += `, which is about £${diff.toFixed(2)} less than ${mostExpensive.name}`;
  }
  summary += '.';
  return summary;
}

function setLastComparison(ids) {
  lastComparisonIds = Array.isArray(ids) ? ids : [];
  try { localStorage.setItem('voiceLastComparison', JSON.stringify(lastComparisonIds)); } catch (e) {}
}

function getLastComparison() {
  if (lastComparisonIds.length) return lastComparisonIds;
  try {
    const stored = JSON.parse(localStorage.getItem('voiceLastComparison') || '[]');
    if (Array.isArray(stored)) return stored;
  } catch (e) {}
  return [];
}

async function addToCartById(productId) {
  const products = await loadVoiceProducts();
  const product = products.find(p => String(p.id) === String(productId));
  if (!product) return false;
  const { cart } = getCartData();
  const existing = cart.find(item => String(item.id) === String(product.id));
  if (existing) existing.quantity = (existing.quantity || 1) + 1;
  else cart.push({ ...product, quantity: 1 });
  localStorage.setItem('cart', JSON.stringify(cart));
  if (typeof window.showNotification === 'function') {
    window.showNotification(`Added ${product.name} to cart`);
  }
  return product;
}

function renderVoiceCompareHTML(p1, p2) {
  return `
    <div style="display:grid;grid-template-columns:repeat(2, minmax(0,1fr));gap:10px;">
      ${[p1, p2].map(p => `
        <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.2);border-radius:14px;padding:10px;">
          <div style="font-weight:800;margin-bottom:6px;">${p.name}</div>
          <div style="font-size:13px;opacity:0.9;">£${p.price.toFixed(2)} • ${(p.rating || 4.5).toFixed(1)} ★</div>
          <div style="font-size:12px;opacity:0.75;margin-top:4px;">${(p.category || '').toUpperCase()}</div>
          <div style="margin-top:8px;font-size:12px;opacity:0.8;">Say: "add first" or "add second"</div>
        </div>
      `).join('')}
    </div>
  `;
}

function findProductByName(products, term) {
  if (!term) return null;
  const clean = term.toLowerCase().trim();
  const direct = products.find(p =>
    p.name && (p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase().split(' ')[0]))
  );
  if (direct) return direct;
  let best = null;
  let bestScore = 0;
  for (const p of products) {
    const score = NLPMatcher.similarity(p.name || '', clean);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.4 ? best : null;
}

const NLPMatcher = {
  similarity(text1, text2) {
    const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(Boolean));
    const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(Boolean));
    const intersection = [...words1].filter(w => words2.has(w)).length;
    const union = words1.size + words2.size - intersection;
    return union > 0 ? intersection / union : 0;
  },
  classifyIntent(command) {
    const cmd = command.toLowerCase().trim();
    const intents = {
      'SEARCH': { patterns: ['search for', 'find', 'look for', 'show me', 'get me', 'locate'], confidence: 0.9 },
      'ADD_TO_CART': { patterns: ['add to cart', 'buy', 'purchase', 'add', 'add to bag'], confidence: 0.9 },
      'COMPARE': { patterns: ['compare', 'difference', 'versus', 'versus', 'vs'], confidence: 0.85 },
      'NAVIGATE': { patterns: ['go to', 'open', 'show', 'take me', 'navigate'], confidence: 0.85 },
      'FILTER': { patterns: ['filter', 'sort', 'arrange', 'organize', 'by price', 'by rating'], confidence: 0.8 },
      'CALCULATE': { patterns: ['calculate', 'add', 'sum', 'total', 'multiply', 'divide'], confidence: 0.8 },
      'FORM_FILL': { patterns: ['enter', 'fill', 'type', 'my name', 'my email', 'my address'], confidence: 0.85 },
      'QUESTION': { patterns: ['what', 'which', 'how', 'tell me', 'explain'], confidence: 0.8 },
      'ACTION': { patterns: ['scroll', 'refresh', 'go back', 'remove', 'delete'], confidence: 0.8 }
    };
    let bestMatch = null;
    let bestScore = 0;
    for (const [intent, data] of Object.entries(intents)) {
      for (const pattern of data.patterns) {
        if (cmd.includes(pattern)) {
          if (data.confidence > bestScore) { bestScore = data.confidence; bestMatch = intent; }
        }
      }
    }
    return { intent: bestMatch || 'GENERAL', confidence: bestScore };
  },
  extractEntities(command) {
    const entities = { productName: null, productId: null, price: null, color: null, size: null, brand: null, category: null, number: null };
    const productMatch = command.match(/(?:search for|find|show me|look for|get me|buy|add|compare)\s+(.+?)(?:\s+under|\s+for|\s+vs|\s+and|$)/i);
    if (productMatch) entities.productName = productMatch[1].trim();
    const idMatch = command.match(/(?:product|item|#)\s*(\d+)/i);
    if (idMatch) entities.productId = parseInt(idMatch[1]);
    const priceMatch = command.match(/£?\s*(\d+(?:\.\d{2})?)/g);
    if (priceMatch) entities.price = parseFloat(priceMatch[0]);
    const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'pink', 'purple', 'orange', 'grey', 'gray', 'brown'];
    const colorMatch = command.match(new RegExp(`(${colors.join('|')})`, 'i'));
    if (colorMatch) entities.color = colorMatch[1].toLowerCase();
    const sizes = ['small', 'medium', 'large', 'xl', 'xxl', 'xs', 's', 'm', 'l'];
    const sizeMatch = command.match(new RegExp(`(?:size\\s+)?(${sizes.join('|')})`, 'i'));
    if (sizeMatch) entities.size = sizeMatch[1].toLowerCase();
    const brands = ['nike', 'adidas', 'apple', 'samsung', 'sony', 'gucci', 'prada', 'zara', 'h&m'];
    const brandMatch = command.match(new RegExp(`(${brands.join('|')})`, 'i'));
    if (brandMatch) entities.brand = brandMatch[1].toLowerCase();
    return entities;
  }
};

async function processVoiceCommand(command) {
  const cmd = command.toLowerCase().trim();
  let response = '';
  let action = null;
  let tone = 'neutral';
  let keepListening = true;
  let skipDefaultChatUpdate = false;
  

  const intent = NLPMatcher.classifyIntent(command);
  const entities = NLPMatcher.extractEntities(command);

  const path = (window.location.pathname || '').toLowerCase();
  const isProductsPage = path.includes('products.html');
  const isCartPage = path.includes('cart.html');
  const isCheckoutPage = path.includes('checkout.html');
  const isWishlistPage = path.includes('wishlist.html');
  const isProductDetailPage = path.includes('product-detail.html');

  const isNegativeMood = /(angry|upset|frustrated|annoyed|mad|furious|terrible|hate this|hate you|worst|bad service|very bad|i am sad|so sad)/i.test(command);
  const isPositiveMood = /(i love this|love it|awesome|amazing|great job|so happy|really good|fantastic|brilliant|this is perfect|i'm excited|super excited)/i.test(command);

  if (isNegativeMood) {
    response = 'I\'m really sorry you\'re having a bad experience. I can connect you to support or help fix things step by step.';
    action = () => window.location.href = 'contact.html';
    tone = 'empathetic';
  } else if (isPositiveMood) {
    response = 'That honestly makes my day. I\'ll keep doing my best to make everything feel smooth and enjoyable for you here.';
    tone = 'excited';
  }

  // System
  if (/(stop|stop listening|stop voice|stop assistant|cancel|exit voice)/i.test(cmd)) {
    voiceKeepAlive = false;
    assistantPersistent = false;
    stopVoice();
    return;
  }
  if (!response && /(new chat|start new chat|clear chat|reset chat|clear conversation|delete chat history)/i.test(cmd)) {
    clearVoiceChatHistory({ seedMessage: '' });
    response = 'Started a new chat. What would you like to do next?';
    keepListening = true;
  }
  if (/(keep listening|continue listening|stay listening|continuous mode|hands free|always listen)/i.test(cmd)) {
    assistantPersistent = true;
    voiceKeepAlive = true;
    response = 'Continuous mode on. I will keep listening until you say stop listening.';
    keepListening = true;
  }
  if (!response && /(stop continuous|pause listening|stop continuous mode|turn off continuous|end continuous)/i.test(cmd)) {
    assistantPersistent = false;
    voiceKeepAlive = false;
    response = 'Continuous mode off. I will pause after each reply.';
    keepListening = false;
  }
  if (!response && /(pause|hold on|wait a sec|wait a second)/i.test(cmd)) {
    assistantPersistent = false;
    voiceKeepAlive = false;
    response = 'Pausing the mic. Tap Listen Again when you are ready.';
    keepListening = false;
  }
  if (/(close help|hide help|close commands)/i.test(cmd)) {
    hideCommandOverlay();
    response = 'Closing the command guide.';
  }
  if (!response && /(show help|open help|show commands|command list|command guide)/i.test(cmd)) {
    showCommandOverlay();
    response = 'Opening the command guide on screen.';
  }

  if (!response && /(mute|quiet|silence)/i.test(cmd)) {
    isMuted = true;
    response = 'Muted. Say "unmute" to turn voice back on.';
  } else if (!response && /(unmute|sound on|speak again)/i.test(cmd)) {
    isMuted = false;
    response = 'Voice is back on.';
  } else if (!response && /(sound check|test voice|test audio)/i.test(cmd)) {
    response = 'This is a quick audio test. If you hear me, sound is working.';
  } else if (!response && /(repeat|say that again)/i.test(cmd)) {
    response = lastSpokenText || 'Nothing to repeat yet.';
  } else if (!response && /(speak faster|speed up)/i.test(cmd)) {
    speechRate = Math.min(1.3, speechRate + 0.1);
    response = 'Speaking a bit faster now.';
  } else if (!response && /(speak slower|slow down)/i.test(cmd)) {
    speechRate = Math.max(0.8, speechRate - 0.1);
    response = 'Speaking a bit slower now.';
  } else if (!response && /(volume up|louder)/i.test(cmd)) {
    speechVolume = Math.min(1.0, speechVolume + 0.1);
    response = 'Volume increased.';
  } else if (!response && /(volume down|quieter)/i.test(cmd)) {
    speechVolume = Math.max(0.2, speechVolume - 0.1);
    response = 'Volume decreased.';
  }

  // PRIORITY: add from last comparison (first/second/cheaper/better)
  if (!response && /(add (first|second|left|right)|add cheaper|add better|add higher rated|add lower priced)/i.test(cmd)) {
    const ids = getLastComparison();
    if (ids.length >= 2) {
      const products = await loadVoiceProducts();
      const p1 = products.find(p => String(p.id) === String(ids[0]));
      const p2 = products.find(p => String(p.id) === String(ids[1]));
      if (p1 && p2) {
        let chosen = p1;
        if (/second|right/.test(cmd)) chosen = p2;
        else if (/cheaper|lower priced/.test(cmd)) chosen = p1.price <= p2.price ? p1 : p2;
        else if (/better|higher rated/.test(cmd)) {
          const r1 = p1.rating || 0;
          const r2 = p2.rating || 0;
          chosen = r1 >= r2 ? p1 : p2;
        }
        const added = await addToCartById(chosen.id);
        if (added) {
          response = `Added ${added.name} to your cart. Anything else?`;
          tone = 'excited';
        }
      } else {
        response = 'I could not find the compared items. Try comparing again.';
        tone = 'empathetic';
      }
    }
  }

  // PRIORITY: compare + add-to-cart by name before other commands
  if (!response && /(compare|vs|versus|which is better|better between|difference between)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const pairMatch = command.match(/compare\s+(.+?)\s+(?:and|with|vs|versus|or)\s+(.+)/i) ||
      command.match(/(.+?)\s+(?:vs|versus)\s+(.+)/i) ||
      command.match(/which is better\s+(.+?)\s+(?:or|vs|versus)\s+(.+)/i);

    if (pairMatch) {
      const term1 = (pairMatch[1] || '').trim();
      const term2 = (pairMatch[2] || '').trim();
      const p1 = findProductByName(products, term1);
      const p2 = findProductByName(products, term2);

      if (p1 && p2) {
        const priceDiff = Math.abs(p1.price - p2.price);
        const rating1 = p1.rating || 0;
        const rating2 = p2.rating || 0;
        let suggestion = '';
        if (Math.abs(rating1 - rating2) >= 0.2) {
          suggestion = rating1 > rating2 ? p1.name : p2.name;
        } else {
          suggestion = p1.price <= p2.price ? p1.name : p2.name;
        }

        response = `${p1.name} is £${p1.price.toFixed(2)} and ${p2.name} is £${p2.price.toFixed(2)}. ` +
          `${p1.name} is rated ${rating1 || 4.5} and ${p2.name} is rated ${rating2 || 4.5}. ` +
          `I’d go with ${suggestion} overall.`;
        tone = 'neutral';
        setLastComparison([p1.id, p2.id]);
        updateChatUI('ai', response);
        updateChatUI('ai', renderVoiceCompareHTML(p1, p2), { html: true });
        updateSiriTranscript('Say "add first" or "add second" to add one to cart.');
        skipDefaultChatUpdate = true;
      } else {
        response = 'I could not find both products to compare. Try saying their full names.';
        tone = 'empathetic';
      }
    }
  }

  if (!response && isProductsPage && /(next page|page next|more products|show more|next results)/i.test(cmd)) {
    const ok = clickPagination('next');
    if (ok) {
      response = 'Showing the next page of products.';
    } else {
      response = 'No more pages. Scrolling down for more products.';
      action = () => window.scrollBy({ top: 800, behavior: 'smooth' });
    }
  }

  if (!response && isProductsPage && /(previous page|prev page|page back|go back a page|earlier page)/i.test(cmd)) {
    const ok = clickPagination('previous');
    response = ok ? 'Going back to the previous page.' : 'You are already on the first page.';
  }

  if (!response && isProductsPage && /(next product|show next|go next product)/i.test(cmd)) {
    const ok = focusNextProduct();
    response = ok ? 'Here is the next product.' : 'I could not find any products to move to.';
  }

  if (!response && isProductsPage && /(previous product|prev product|go back product|show previous)/i.test(cmd)) {
    const ok = focusPreviousProduct();
    response = ok ? 'Here is the previous product.' : 'I could not find any products to move to.';
  }

  if (!response && isProductsPage && /(open|view|show|select) (product|item) (number )?\d+/i.test(cmd)) {
    const match = cmd.match(/(\d+)/);
    const index = match ? parseInt(match[1], 10) - 1 : -1;
    const ok = index >= 0 ? openProductByIndex(index) : false;
    response = ok ? `Opening product ${index + 1}.` : 'I could not find that product on this page.';
  }

  if (!response && /(add|buy|purchase|get|put in cart|add to cart)\s+(.+)/i.test(cmd) && !/(add number|number \d+)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const match = command.match(/(?:add|buy|purchase|get|put in cart|add to cart)\s+(.+)/i);
    const term = match ? match[1].trim() : '';
    const product = findProductByName(products, term);

    if (product) {
      const { cart } = getCartData();
      const existing = cart.find(item => item.id === product.id);
      if (existing) existing.quantity = (existing.quantity || 1) + 1;
      else cart.push({ ...product, quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Added ${product.name} to your cart for £${product.price.toFixed(2)}.`;
      tone = 'excited';
    } else if (term) {
      response = `I couldn’t find "${term}". Say the full product name or ask me to search first.`;
      tone = 'empathetic';
    }
  }

  if (/(undo|change it back|revert that|go back to before|reverse that|put it back as before|undo that)/i.test(cmd)) {
    try {
      const raw = localStorage.getItem('voiceLastUndo');
      if (raw) {
        const undo = JSON.parse(raw);
        if (undo.type === 'nav' && undo.from) {
          response = 'Taking you back to where you were before.';
          action = () => { window.location.href = undo.from; };
        } else if (undo.type === 'search') {
          const prev = typeof undo.prevSearch === 'string' ? undo.prevSearch : null;
          if (prev) localStorage.setItem('pendingSearch', prev);
          else localStorage.removeItem('pendingSearch');
          response = 'I removed the last search filter I added.';
        } else if (undo.type === 'category') {
          const prevCat = typeof undo.prevCategory === 'string' ? undo.prevCategory : 'all';
          localStorage.setItem('pendingCategory', prevCat);
          response = 'I reset your last category choice.';
        }
        localStorage.removeItem('voiceLastUndo');
      } else {
        response = 'There is nothing recent from me to undo, but I can still help you move back or clear filters if you like.';
      }
    } catch (e) {
      response = 'I tried to change it back, but something went wrong. You can still use the normal buttons to go back or clear filters.';
      tone = 'empathetic';
    }
  }

  if (/(add|plus|sum|subtract|minus|multiply|times|divide|calculate|what is|what's the|total of)/i.test(cmd) && (/\d+/.test(cmd) || /(product|item|price)/i.test(cmd))) {
    const products = await loadVoiceProducts();
    const calculation = calculateFromCommand(command, products);
    if (calculation) {
      if (calculation.type === 'productSum') {
        const names = calculation.products.map(p => p.name).join(' and ');
        response = `Adding ${names}: that's £${calculation.result.toFixed(2)} in total`;
        tone = 'neutral';
      } else if (calculation.type === 'sum') {
        response = `The sum of ${calculation.numbers.join(' + ')} is ${calculation.result.toFixed(2)}`;
        tone = 'neutral';
      } else if (calculation.type === 'subtract') {
        response = `${calculation.numbers[0]} minus ${calculation.numbers[1]} equals ${calculation.result.toFixed(2)}`;
        tone = 'neutral';
      } else if (calculation.type === 'multiply') {
        response = `${calculation.numbers.join(' × ')} equals ${calculation.result.toFixed(2)}`;
        tone = 'neutral';
      } else if (calculation.type === 'divide') {
        response = `${calculation.numbers[0]} divided by ${calculation.numbers[1]} equals ${calculation.result.toFixed(2)}`;
        tone = 'neutral';
      }
    }
  }
  
  if (!response && entities.productName && intent.intent === 'SEARCH') {
    const products = await loadVoiceProducts();
    const searchTerm = entities.productName.toLowerCase();
    const matches = products.filter(p => {
      const similarity = NLPMatcher.similarity(p.name.toLowerCase(), searchTerm);
      const categoryMatch = p.category && p.category.toLowerCase().includes(searchTerm);
      const brandMatch = p.brand && p.brand.toLowerCase().includes(searchTerm);
      return similarity > 0.4 || categoryMatch || brandMatch;
    }).sort((a, b) => NLPMatcher.similarity(b.name.toLowerCase(), searchTerm) - NLPMatcher.similarity(a.name.toLowerCase(), searchTerm));
    
    if (matches.length > 0) {
      if (matches.length === 1) {
        response = `Found ${matches[0].name} at £${matches[0].price.toFixed(2)}. Adding to your cart.`;
        tone = 'excited';
        action = () => {
          const { cart } = getCartData();
          const existing = cart.find(item => item.id === matches[0].id);
          if (existing) existing.quantity = (existing.quantity || 1) + 1;
          else cart.push({ ...matches[0], quantity: 1 });
          localStorage.setItem('cart', JSON.stringify(cart));
          if (typeof window.showNotification === 'function') window.showNotification(`Added ${matches[0].name} to cart`);
        };
      } else {
        const topMatches = matches.slice(0, 5);
        const names = topMatches.map((p, i) => `${i + 1}. ${p.name} at £${p.price.toFixed(2)}`).join(', ');
        response = `Found ${matches.length} ${searchTerm} products: ${names}. Say "add number 1" to choose one, or say "show all" to see more.`;
        tone = 'neutral';
        action = () => {
          localStorage.setItem('pendingSearchResults', JSON.stringify(topMatches));
          localStorage.setItem('pendingSearch', searchTerm);
          window.location.href = 'products.html';
        };
      }
    } else {
      response = `I couldn't find any ${searchTerm} products. I'll search the catalog for you.`;
      action = () => {
        localStorage.setItem('pendingSearch', searchTerm);
        window.location.href = 'products.html';
      };
    }
  }

  if (!response && /(add number|add item number|choose number) \d+/i.test(cmd)) {
    const match = cmd.match(/(\d+)/);
    const index = match ? parseInt(match[1], 10) - 1 : -1;
    try {
      const list = JSON.parse(localStorage.getItem('pendingSearchResults') || '[]');
      const picked = list[index];
      if (picked) {
        const { cart } = getCartData();
        const existing = cart.find(item => item.id === picked.id);
        if (existing) existing.quantity = (existing.quantity || 1) + 1;
        else cart.push({ ...picked, quantity: 1 });
        localStorage.setItem('cart', JSON.stringify(cart));
        response = `Added ${picked.name} to your cart.`;
        tone = 'excited';
      } else {
        response = 'I could not find that item number.';
        tone = 'empathetic';
      }
    } catch (e) {
      response = 'I do not have any recent search results.';
      tone = 'empathetic';
    }
  }

  if (!response && /(show all|see all results|open results)/i.test(cmd)) {
    response = 'Opening all results.';
    action = () => window.location.href = 'products.html';
  }
  if (!response && /(compare number|compare items?) \d+ (and|with|vs|versus) \d+/i.test(cmd)) {
    const nums = cmd.match(/\d+/g) || [];
    const a = parseInt(nums[0], 10) - 1;
    const b = parseInt(nums[1], 10) - 1;
    try {
      const list = JSON.parse(localStorage.getItem('pendingSearchResults') || '[]');
      const p1 = list[a];
      const p2 = list[b];
      if (p1 && p2) {
        const diff = Math.abs(p1.price - p2.price);
        const cheaper = p1.price < p2.price ? p1 : p2;
        response = `${p1.name} is £${p1.price.toFixed(2)} and ${p2.name} is £${p2.price.toFixed(2)}. ${cheaper.name} is £${diff.toFixed(2)} cheaper.`;
      } else {
        response = 'I could not find those item numbers to compare.';
        tone = 'empathetic';
      }
    } catch (e) {
      response = 'I do not have any recent search results to compare.';
      tone = 'empathetic';
    }
  }
  
  if (!response && /(how much|what's the total|cart total|cart value|cart price|total price|how many items in cart)/i.test(cmd)) {
    const { cart, itemCount, totalPrice } = getCartData();
    if (itemCount > 0) {
      response = `You have ${itemCount} item${itemCount > 1 ? 's' : ''} in your cart worth £${totalPrice.toFixed(2)}`;
      tone = 'neutral';
    } else {
      response = 'Your cart is empty at the moment';
      tone = 'neutral';
    }
  }
  
  if (!response && /(wishlist total|wishlist value|wishlist price|how many in wishlist|what's in my wishlist)/i.test(cmd)) {
    const { wishlist, count } = getWishlistData();
    if (count > 0) {
      const total = wishlist.reduce((sum, item) => sum + (item.price || 0), 0);
      const names = wishlist.slice(0, 3).map(p => p.name).join(', ');
      response = `You have ${count} item${count > 1 ? 's' : ''} in your wishlist worth £${total.toFixed(2)}. Including: ${names}${count > 3 ? ' and more' : ''}`;
      tone = 'neutral';
    } else {
      response = 'Your wishlist is empty';
      tone = 'neutral';
    }
  }
  
  if (!response && /(tell me about|what is|info about|details about|describe|information on) (.+)/i.test(cmd)) {
    const match = cmd.match(/(tell me about|what is|info about|details about|describe|information on)\s+(.+)/i);
    if (match) {
      const query = match[2].trim();
      const products = await loadVoiceProducts();
      const product = products.find(p => p.name.toLowerCase().includes(query) || query.includes(p.name.toLowerCase().split(' ')[0]));
      if (product) {
        response = `${product.name} costs £${product.price.toFixed(2)}. It's rated ${product.rating || 4.5} stars with ${product.reviews || 0} reviews. ${product.description || ''}`;
        tone = 'neutral';
      }
    }
  }
  
  if (!response && /(compare|difference between) (.+) (and|with|versus|vs) (.+)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const parts = cmd.split(/(and|with|versus|vs)/i);
    if (parts.length >= 3) {
      const product1Query = parts[0].replace(/(compare|difference between)/i, '').trim();
      const product2Query = parts[2].trim();
      const p1 = products.find(p => p.name.toLowerCase().includes(product1Query));
      const p2 = products.find(p => p.name.toLowerCase().includes(product2Query));
      
      if (p1 && p2) {
        const priceDiff = Math.abs(p1.price - p2.price);
        const cheaper = p1.price < p2.price ? p1 : p2;
        response = `${p1.name} costs £${p1.price.toFixed(2)} and ${p2.name} costs £${p2.price.toFixed(2)}. ${cheaper.name} is £${priceDiff.toFixed(2)} cheaper`;
        tone = 'neutral';
      }
    }
  }
  
  if (!response && /(cheapest|lowest price|most affordable|least expensive)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    if (products.length > 0) {
      const cheapest = products.reduce((min, p) => p.price < min.price ? p : min);
      response = `The cheapest product is ${cheapest.name} at £${cheapest.price.toFixed(2)}`;
      tone = 'neutral';
    }
  }
  if (!response && /(add cheapest|buy cheapest|add lowest price)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    if (products.length > 0) {
      const cheapest = products.reduce((min, p) => p.price < min.price ? p : min);
      const { cart } = getCartData();
      const existing = cart.find(item => item.id === cheapest.id);
      if (existing) existing.quantity = (existing.quantity || 1) + 1;
      else cart.push({ ...cheapest, quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Added the cheapest item: ${cheapest.name}.`;
      tone = 'excited';
    }
  }
  
  if (!response && /(most expensive|highest price|priciest|costliest)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    if (products.length > 0) {
      const expensive = products.reduce((max, p) => p.price > max.price ? p : max);
      response = `The most expensive product is ${expensive.name} at £${expensive.price.toFixed(2)}`;
      tone = 'neutral';
    }
  }
  if (!response && /(add most expensive|buy most expensive|add priciest)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    if (products.length > 0) {
      const expensive = products.reduce((max, p) => p.price > max.price ? p : max);
      const { cart } = getCartData();
      const existing = cart.find(item => item.id === expensive.id);
      if (existing) existing.quantity = (existing.quantity || 1) + 1;
      else cart.push({ ...expensive, quantity: 1 });
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Added the most expensive item: ${expensive.name}.`;
      tone = 'excited';
    }
  }
  
  if (!response && /(show me all|list all|what are the) (.+) (products?|items?)/i.test(cmd)) {
    const match = cmd.match(/(show me all|list all|what are the)\s+(.+?)\s+(products?|items?)/i);
    if (match) {
      const category = match[2].trim();
      const products = await loadVoiceProducts();
      const filtered = products.filter(p => p.category && p.category.toLowerCase().includes(category));
      if (filtered.length > 0) {
        const names = filtered.slice(0, 5).map(p => p.name).join(', ');
        response = `Found ${filtered.length} ${category} products: ${names}${filtered.length > 5 ? ' and more' : ''}. Opening products page`;
        action = () => {
          localStorage.setItem('pendingCategory', category);
          window.location.href = 'products.html';
        };
        tone = 'neutral';
      }
    }
  }
  
  if (!response && /(what's the average|average price|mean price) (of |for )?(.+)?/i.test(cmd)) {
    const match = cmd.match(/(average price|mean price|what's the average)\s+(of |for )?(.+)?/i);
    const products = await loadVoiceProducts();
    let filtered = products;
    if (match && match[3]) {
      const category = match[3].replace(/(products?|items?)/gi, '').trim();
      filtered = products.filter(p => p.category && p.category.toLowerCase().includes(category));
    }
    if (filtered.length > 0) {
      const avg = filtered.reduce((sum, p) => sum + p.price, 0) / filtered.length;
      const categoryName = match && match[3] ? match[3] : 'all';
      response = `The average price for ${categoryName} products is £${avg.toFixed(2)}`;
      tone = 'neutral';
    }
  }
  
  if (!response && /(best value|best deal|most worth it|value for money|bang for buck)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const withValue = products.map(p => ({ ...p, value: p.rating / p.price })).sort((a, b) => b.value - a.value);
    if (withValue.length > 0) {
      const best = withValue[0];
      response = `Best value: ${best.name} at £${best.price.toFixed(2)} with ${best.rating} stars rating`;
      tone = 'excited';
    }
  }
  
  if (!response && /(is|check|verify) (.+) (in stock|available|still available)/i.test(cmd)) {
    const match = cmd.match(/(is|check|verify)\s+(.+?)\s+(in stock|available)/i);
    if (match) {
      const productQuery = match[2].trim();
      const products = await loadVoiceProducts();
      const product = products.find(p => p.name.toLowerCase().includes(productQuery));
      if (product) {
        if (product.inStock) {
          response = `Yes, ${product.name} is in stock${product.stock ? ` with ${product.stock} units available` : ''}`;
          tone = 'neutral';
        } else {
          response = `Sorry, ${product.name} is currently out of stock`;
          tone = 'empathetic';
        }
      }
    }
  }
  
  if (!response && /(what's on sale|any discounts|sales today|what's discounted|show discounted)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const onSale = products.filter(p => p.discount && p.discount > 0);
    if (onSale.length > 0) {
      const topDiscounts = onSale.sort((a, b) => b.discount - a.discount).slice(0, 3);
      const names = topDiscounts.map(p => `${p.name} (${p.discount}% off)`).join(', ');
      response = `${onSale.length} products on sale! Top discounts: ${names}`;
      tone = 'excited';
      action = () => window.location.href = 'products.html?deals=true';
    } else {
      response = 'No products are currently on sale';
      tone = 'neutral';
    }
  }
  
  if (!response && /(sort by|order by|arrange by) (price|rating|name|popularity)/i.test(cmd)) {
    const sortType = cmd.match(/(price|rating|name|popularity)/i)[0].toLowerCase();
    response = `Sorting products by ${sortType}`;
    action = () => {
      localStorage.setItem('voiceSortBy', sortType);
      window.location.href = 'products.html';
    };
    tone = 'neutral';
  }
  
  if (!response && /(surprise me|random product|pick something|your choice|dealer's choice)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    if (products.length > 0) {
      const random = products[Math.floor(Math.random() * products.length)];
      response = `How about ${random.name}? It costs £${random.price.toFixed(2)} and has ${random.rating} stars rating. ${random.description || ''}`;
      tone = 'excited';
      action = () => {
        localStorage.setItem('pendingSearch', random.name);
        window.location.href = 'products.html';
      };
    }
  }
  
  if (!response && /(who are you|what are you|who made you|who created you|tell me about yourself)/i.test(cmd)) {
    response = 'I\'m an AI shopping assistant built to help you navigate, search, calculate prices, and manage your shopping experience hands-free!';
    tone = 'neutral';
  }
  
  if (!response && /(popular|trending|bestsellers?|best sellers?|most popular|what's popular)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const popular = products.sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 3);
    if (popular.length > 0) {
      const names = popular.map(p => p.name).join(', ');
      response = `Most popular products: ${names}`;
      tone = 'excited';
      action = () => window.location.href = 'products.html';
    }
  }
  
  if (!response && /(show|find|get|tell me about|open) (product|item) (number )?\d+/i.test(cmd)) {
    const match = cmd.match(/\d+/);
    if (match) {
      const productId = parseInt(match[0]);
      const products = await loadVoiceProducts();
      const product = products.find(p => p.id === productId);
      if (product) {
        response = `Found ${product.name} at £${product.price.toFixed(2)}. ${product.description || ''}`;
        action = () => {
          localStorage.setItem('pendingSearch', product.name);
          window.location.href = 'products.html';
        };
        tone = 'neutral';
      } else {
        response = `Could not find product with ID ${productId}`;
        tone = 'empathetic';
      }
    }
  }
  
  if (!response && /(how much|what's the|calculate) (would I save|savings?|discount)/i.test(cmd)) {
    const { cart } = getCartData();
    if (cart.length > 0) {
      const totalSavings = cart.reduce((total, item) => {
        const discount = item.discount || 0;
        const savings = (item.price * discount / 100) * (item.quantity || 1);
        return total + savings;
      }, 0);
      if (totalSavings > 0) {
        response = `You're saving £${totalSavings.toFixed(2)} with current discounts in your cart!`;
        tone = 'excited';
      } else {
        response = 'No discounted items in your cart at the moment';
        tone = 'neutral';
      }
    } else {
      response = 'Your cart is empty';
      tone = 'neutral';
    }
  }
  
  if (!response && /(how many|count) (.+) (products?|items?) (do you have|are there)/i.test(cmd)) {
    const match = cmd.match(/(how many|count)\s+(.+?)\s+(products?|items?)/i);
    if (match) {
      const brand = match[2].trim();
      const products = await loadVoiceProducts();
      const filtered = products.filter(p => (p.brand && p.brand.toLowerCase().includes(brand)) || (p.category && p.category.toLowerCase().includes(brand)));
      if (filtered.length > 0) {
        response = `We have ${filtered.length} ${brand} products`;
        tone = 'neutral';
      } else {
        response = `No ${brand} products found`;
        tone = 'empathetic';
      }
    }
  }
  
  if (/^(hi|hello|hey|ola|greetings|good morning|good afternoon|good evening|what's up|wassup|yo|howdy|hiya|sup|namaste|bonjour|hola)/i.test(cmd)) {
    if (isCheckoutPage) {
      response = 'Hi. You\'re already at checkout – I can read your order summary, fill in your details, or explain shipping and tax. What would you like?';
    } else if (isProductDetailPage) {
      response = 'Hello! You\'re looking at a product. You can ask me to explain this product, compare it with others, or help you decide if it\'s right for you.';
    } else if (isCartPage) {
      response = 'Hi! I can summarise your cart, suggest what to add for free shipping, or help you move to checkout.';
    } else if (isProductsPage) {
      response = 'Hello! I can search, filter, or talk you through the best picks on this products page.';
    } else {
      const greetings = ['Hello! How can I help?', 'Hi there! Ready to shop?', 'Hey! What can I do for you?', 'Hello! I\'m your AI assistant.', 'Hi! Let\'s find something great!'];
      response = greetings[Math.floor(Math.random() * greetings.length)];
    }
  }
  else if (/(go to|show|open|take me to|navigate to|display|visit|load|bring up) (home|homepage|main page|start page|landing page|index)/i.test(cmd) || /^(home|homepage|main page|go home|back to home|start page|landing)$/i.test(cmd)) {
    response = 'Going to homepage';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'index.html';
  }
  else if (/(go to|show|open|navigate to|visit|take me to) (privacy|privacy policy|terms|terms of service|returns|return policy|shipping|security)/i.test(cmd)) {
    const pageMatch = cmd.match(/(privacy|terms|returns|shipping|security)/i);
    if (pageMatch) {
      const page = pageMatch[0].toLowerCase();
      let targetPage = '';
      let pageName = '';
      if (page.includes('privacy')) { targetPage = 'pages/privacy.html'; pageName = 'privacy policy'; }
      else if (page.includes('terms')) { targetPage = 'pages/terms.html'; pageName = 'terms of service'; }
      else if (page.includes('return')) { targetPage = 'pages/returns.html'; pageName = 'returns policy'; }
      else if (page.includes('shipping')) { targetPage = 'shipping.html'; pageName = 'shipping information'; }
      else if (page.includes('security')) { targetPage = 'security.html'; pageName = 'security page'; }
      
      if (targetPage) {
        response = `Opening ${pageName}`;
        const from = window.location.href;
        try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
        action = () => window.location.href = targetPage;
        tone = 'neutral';
      }
    }
  }
  else if (/(go to|show|open|take me to|navigate to|display|visit|browse|explore|view|check out) (products?|shop|store|catalog|items?|all products|product page|shopping page|marketplace)/i.test(cmd) || /^(products?|shop|store|browse|shopping|catalog|items?|marketplace)$/i.test(cmd) || /(what do you have|what do you sell|what products|show me everything|show inventory|view all|see all)/i.test(cmd)) {
    response = 'Opening products page';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'products.html';
  }
  else if (!response && /(go to|show|open|take me to|check|view|display|see) (cart|shopping cart|basket|my cart|shopping basket|my bag)/i.test(cmd) || /^(cart|my cart|shopping cart|basket|bag|checkout|my bag)$/i.test(cmd) || /(what's in my cart|show my cart|view my items|check my cart|open basket|view basket|check bag)/i.test(cmd) || /(how many items|what did I add|what's in my basket|cart items|bag contents)/i.test(cmd)) {
    try {
      const cart = JSON.parse(localStorage.getItem('cart') || '[]');
      const itemCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
      if (itemCount > 0) {
        response = `You have ${itemCount} item${itemCount > 1 ? 's' : ''} in your cart. Opening your cart.`;
      } else {
        response = 'Your cart is currently empty. Opening your cart.';
      }
    } catch (e) {
      response = 'Opening your cart';
    }
    tone = tone || 'neutral';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'cart.html';
  }
  else if (!response && /(go to|show|open|take me to|check|view|display|see) (wishlist|wish list|favorites?|saved items?|liked items?|saved products)/i.test(cmd) || /^(wishlist|wish list|favorites?|saved|my favorites|likes)$/i.test(cmd) || /(what's in my wishlist|show my wishlist|view saved items|check favorites|my saved|view likes)/i.test(cmd)) {
    try {
      const wishlist = JSON.parse(localStorage.getItem('wishlist') || '[]');
      const itemCount = wishlist.length;
      if (itemCount > 0) {
        response = `You have ${itemCount} item${itemCount > 1 ? 's' : ''} in your wishlist. Opening your wishlist.`;
      } else {
        response = 'Your wishlist is currently empty. Opening your wishlist.';
      }
    } catch (e) {
      response = 'Opening your wishlist';
    }
    tone = tone || 'neutral';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'wishlist.html';
  }
  else if (/(go to|show|open|take me to|navigate to) (about|about us|about page|company|who are you|about section)/i.test(cmd) || /^(about|about us|who are you|company info|about company)$/i.test(cmd) || /(tell me about|learn about|information about) (you|company|business|your company)/i.test(cmd)) {
    response = 'Opening about page';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'about.html';
  }
  else if (/(go to|show|open|take me to|navigate to) (contact|contact us|contact page|get in touch|support|help)/i.test(cmd) || /^(contact|contact us|reach you|get in touch|support|customer service)$/i.test(cmd) || /(how to contact|how can I reach|customer service|customer support|help desk|support team)/i.test(cmd)) {
    response = 'Opening contact page';
    const from = window.location.href;
    try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'nav', from })); } catch (e) {}
    action = () => window.location.href = 'contact.html';
  }
  else if (/(search for|find|show me|look for|looking for|I want|get me|fetch|locate|discover) (.+)/i.test(cmd)) {
    const match = cmd.match(/(search for|find|show me|look for|looking for|i want|get me|fetch|locate|discover)\s+(.+)/i);
    if (match) {
      const searchTerm = match[2].trim();
      response = `Searching for ${searchTerm}`;
      action = () => {
        const prev = localStorage.getItem('pendingSearch');
        try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'search', prevSearch: prev || null })); } catch (e) {}
        localStorage.setItem('pendingSearch', searchTerm);
        window.location.href = 'products.html';
      };
    }
  }
  else if (/(brand|by brand) (.+)/i.test(cmd)) {
    const match = cmd.match(/(brand|by brand)\s+(.+)/i);
    const brand = match ? match[2].trim() : '';
    if (brand) {
      response = `Finding ${brand} products`;
      action = () => {
        localStorage.setItem('pendingSearch', brand);
        window.location.href = 'products.html';
      };
      tone = 'neutral';
    }
  }
  else if (/(show|find|any|got) (nike|adidas|apple|samsung|sony|gucci|herschel|fossil) (products?|items?)/i.test(cmd)) {
    const brand = cmd.match(/(nike|adidas|apple|samsung|sony|gucci|herschel|fossil)/i)[0];
    response = `Finding ${brand} products`;
    action = () => {
      localStorage.setItem('pendingSearch', brand);
      window.location.href = 'products.html';
    };
    tone = 'neutral';
  }
  else if (/(show|find|products?) (under|below|cheaper than|less than|between) (.+)/i.test(cmd)) {
    const between = cmd.match(/between\s+(?:£|pound|pounds?)?\s*(\d+(?:\.\d+)?)\s+and\s+(?:£|pound|pounds?)?\s*(\d+(?:\.\d+)?)/i);
    const under = cmd.match(/(under|below|cheaper than|less than)\s+(?:£|pound|pounds?)?\s*(\d+(?:\.\d+)?)/i);
    if (between) {
      const min = between[1];
      const max = between[2];
      response = `Showing products between £${min} and £${max}`;
      action = () => {
        localStorage.setItem('voicePriceMin', min);
        localStorage.setItem('voicePriceMax', max);
        window.location.href = 'products.html';
      };
      tone = 'neutral';
    } else if (under) {
      const price = under[2];
      response = `Showing products under £${price}`;
      action = () => {
        localStorage.setItem('voicePriceFilter', price);
        window.location.href = 'products.html';
      };
      tone = 'neutral';
    }
  }
  else if (/(show|find|search|browse|view|display|get|explore) (electronics?|tech|gadgets?|devices?|technology|tech products)/i.test(cmd) || /^(electronics?|tech|gadgets?|technology|devices?)$/i.test(cmd) || /(phones?|laptops?|computers?|tablets?|smartwatch|headphones?|speakers?)/i.test(cmd)) {
    response = 'Showing electronics';
    action = () => {
      const prevCat = localStorage.getItem('pendingCategory') || 'all';
      try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'category', prevCategory: prevCat })); } catch (e) {}
      localStorage.setItem('pendingCategory', 'electronics');
      window.location.href = 'products.html';
    };
  }
  else if (/(show|find|search|browse|view|display|get) (fashion|clothes?|clothing|apparel|wear|outfits?|dress|fashion items)/i.test(cmd) || /^(fashion|clothes?|clothing|wear|apparel|outfits?)$/i.test(cmd) || /(shirts?|pants?|jeans?|jackets?|sweaters?|t-shirts?|hoodies?|tops?|dresses?)/i.test(cmd)) {
    response = 'Showing fashion items';
    action = () => {
      const prevCat = localStorage.getItem('pendingCategory') || 'all';
      try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'category', prevCategory: prevCat })); } catch (e) {}
      localStorage.setItem('pendingCategory', 'fashion');
      window.location.href = 'products.html';
    };
  }
  else if (/(show|find|search|browse|view|display|get) (shoes?|footwear|sneakers?|boots?|sandals?|slippers?)/i.test(cmd) || /^(shoes?|footwear|sneakers?|running shoes?|casual shoes?|boots?)$/i.test(cmd) || /(nike|adidas|jordans?|trainers?|running shoes|sports shoes|athletic shoes)/i.test(cmd)) {
    response = 'Showing shoes';
    action = () => {
      const prevCat = localStorage.getItem('pendingCategory') || 'all';
      try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'category', prevCategory: prevCat })); } catch (e) {}
      localStorage.setItem('pendingCategory', 'shoes');
      window.location.href = 'products.html';
    };
  }
  else if (/(show|find|search|browse|view|display|get) (bags?|backpacks?|handbags?|purses?|luggage|suitcase)/i.test(cmd) || /^(bags?|backpacks?|handbags?|purse|luggage|suitcase)$/i.test(cmd) || /(travel bags?|school bags?|laptop bags?|messenger bags?|tote bags?)/i.test(cmd)) {
    response = 'Showing bags';
    action = () => {
      const prevCat = localStorage.getItem('pendingCategory') || 'all';
      try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'category', prevCategory: prevCat })); } catch (e) {}
      localStorage.setItem('pendingCategory', 'bags');
      window.location.href = 'products.html';
    };
  }
  else if (/(show|find|search|browse|view|display|get) (home|home items?|home decor|furniture|household|home products)/i.test(cmd) || /^(home|home items?|furniture|decor|household|home decor)$/i.test(cmd) || /(lamps?|pillows?|rugs?|decorations?|curtains?|bedding?|kitchen)/i.test(cmd)) {
    response = 'Showing home items';
    action = () => {
      const prevCat = localStorage.getItem('pendingCategory') || 'all';
      try { localStorage.setItem('voiceLastUndo', JSON.stringify({ type: 'category', prevCategory: prevCat })); } catch (e) {}
      localStorage.setItem('pendingCategory', 'home');
      window.location.href = 'products.html';
    };
  }
  else if (/(show|find|view|check|what are the|any|got|display) (deals?|sales?|offers?|discounts?|promotions?|specials?)/i.test(cmd) || /^(deals?|sales?|offers?|discounts?|promotions?|specials?)$/i.test(cmd) || /(on sale|best deals?|hot deals?|special offers?|clearance|discount|promo|limited offer)/i.test(cmd) || /(save money|cheap|affordable|budget|bargain|reduced price|price cut)/i.test(cmd)) {
    response = 'I love hunting for bargains with you. Let\'s look at the strongest deals I can find.';
    tone = 'excited';
    action = () => window.location.href = 'products.html?deals=true';
  }
  else if (/(compare deals|compare offers|compare discounts)/i.test(cmd)) {
    response = 'Opening deals so you can compare.';
    action = () => window.location.href = 'products.html?deals=true';
  }
  else if (/(compare products|product comparison|comparison view)/i.test(cmd)) {
    response = 'Opening comparison view.';
    action = () => window.location.href = 'products.html?compare=true';
  }
  else if (/(add to cart|put in cart|add this|buy this|purchase this|I want this|add item|put this in|add in)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    let foundProduct = null;
    const productMatch = cmd.replace(/(add to cart|put in cart|buy|purchase|add|i want|please)/gi, '').trim();
    if (productMatch) {
      foundProduct = products.find(p => p.name.toLowerCase().includes(productMatch) || productMatch.includes(p.name.toLowerCase().split(' ')[0]));
    }
    if (foundProduct) {
      const { cart } = getCartData();
      const existing = cart.find(item => item.id === foundProduct.id);
      if (existing) { existing.quantity = (existing.quantity || 1) + 1; } 
      else { cart.push({ ...foundProduct, quantity: 1 }); }
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Added ${foundProduct.name} to your cart for £${foundProduct.price.toFixed(2)}`;
      tone = 'excited';
      if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
    } else {
      response = 'Please select an item from products page first';
      action = () => window.location.href = 'products.html';
    }
  }
  else if (/(remove from cart|delete from cart|remove item|take out) (.+)/i.test(cmd)) {
    const itemMatch = cmd.replace(/(remove from cart|delete from cart|remove|delete|take out)/gi, '').trim();
    const { cart } = getCartData();
    if (itemMatch) {
      const itemIndex = cart.findIndex(item => item.name.toLowerCase().includes(itemMatch));
      if (itemIndex !== -1) {
        const removedItem = cart.splice(itemIndex, 1)[0];
        localStorage.setItem('cart', JSON.stringify(cart));
        response = `Removed ${removedItem.name} from your cart`;
        tone = 'neutral';
        if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
      } else {
        response = 'Could not find that item in your cart';
        tone = 'empathetic';
      }
    } else {
      response = 'Opening cart to manage items';
      action = () => window.location.href = 'cart.html';
    }
  }
  else if (/(remove last item|undo last item|remove recent item)/i.test(cmd)) {
    const { cart } = getCartData();
    if (cart.length > 0) {
      const removed = cart.pop();
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Removed ${removed.name} from your cart.`;
      tone = 'neutral';
      if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
    } else {
      response = 'Your cart is empty.';
      tone = 'neutral';
    }
  }
  else if (/(clear cart|empty cart|remove all items|delete everything from cart)/i.test(cmd)) {
    localStorage.setItem('cart', JSON.stringify([]));
    response = 'Your cart has been cleared';
    tone = 'neutral';
    if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
  }
  else if (/(set quantity|set qty|quantity of) (.+) (to|as) (\d+)/i.test(cmd)) {
    const match = cmd.match(/(set quantity|set qty|quantity of)\s+(.+?)\s+(to|as)\s+(\d+)/i);
    const qty = match ? parseInt(match[4], 10) : 1;
    const name = match ? match[2].trim() : '';
    const { cart } = getCartData();
    const item = cart.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
    if (item) {
      item.quantity = Math.max(1, qty);
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Updated ${item.name} quantity to ${item.quantity}.`;
      if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
    } else {
      response = 'I could not find that item in your cart.';
      tone = 'empathetic';
    }
  }
  else if (/(increase|decrease|reduce) (quantity|qty) (of )?(.+?)( by (\d+))?/i.test(cmd)) {
    const match = cmd.match(/(increase|decrease|reduce)\s+(quantity|qty)\s+(of\s+)?(.+?)(\s+by\s+(\d+))?/i);
    const name = match ? match[4].trim() : '';
    const delta = match && match[6] ? parseInt(match[6], 10) : 1;
    const { cart } = getCartData();
    const item = cart.find(i => i.name.toLowerCase().includes(name.toLowerCase()));
    if (item) {
      const next = /decrease|reduce/.test(cmd) ? (item.quantity || 1) - delta : (item.quantity || 1) + delta;
      item.quantity = Math.max(1, next);
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Updated ${item.name} quantity to ${item.quantity}.`;
      if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
    } else {
      response = 'I could not find that item in your cart.';
      tone = 'empathetic';
    }
  }
  else if (/(add to wishlist|save this|add to favorites?|like this|favorite this|save product|add to saves) (.+)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const itemMatch = cmd.replace(/(add to wishlist|save|favorite|like)/gi, '').trim();
    if (itemMatch) {
      const foundProduct = products.find(p => p.name.toLowerCase().includes(itemMatch) || itemMatch.includes(p.name.toLowerCase().split(' ')[0]));
      if (foundProduct) {
        const { wishlist } = getWishlistData();
        if (!wishlist.find(item => item.id === foundProduct.id)) {
          wishlist.push(foundProduct);
          localStorage.setItem('wishlist', JSON.stringify(wishlist));
          response = `Added ${foundProduct.name} to your wishlist`;
          tone = 'neutral';
        } else {
          response = `${foundProduct.name} is already in your wishlist`;
          tone = 'neutral';
        }
      } else {
        response = 'Could not find that product';
        tone = 'empathetic';
      }
    } else {
      response = 'Please select an item from products page first';
      action = () => window.location.href = 'products.html';
    }
  }
  else if (/(move|transfer) (wishlist|all wishlist items?|everything) (to cart|into cart)/i.test(cmd)) {
    const { wishlist } = getWishlistData();
    const { cart } = getCartData();
    if (wishlist.length > 0) {
      wishlist.forEach(item => {
        const existing = cart.find(c => c.id === item.id);
        if (!existing) { cart.push({ ...item, quantity: 1 }); }
      });
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Moved ${wishlist.length} item${wishlist.length > 1 ? 's' : ''} from wishlist to cart`;
      tone = 'excited';
    } else {
      response = 'Your wishlist is empty';
      tone = 'neutral';
    }
  }
  else if (/(checkout|pay now|proceed to checkout|complete purchase|buy now|place order|make payment|proceed to payment|finalize order)/i.test(cmd)) {
    const { itemCount } = getCartData();
    if (itemCount > 0) {
      response = `Taking you to checkout with ${itemCount} item${itemCount > 1 ? 's' : ''}`;
      action = () => window.location.href = 'checkout.html';
      tone = 'neutral';
    } else {
      response = 'Your cart is empty. Add some items first!';
      action = () => window.location.href = 'products.html';
      tone = 'empathetic';
    }
  }
  else if (/(summarize|summarise|tell me about|what's in|read) (my )?cart/i.test(cmd)) {
    const { cart, itemCount, totalPrice } = getCartData();
    if (itemCount > 0) {
      const items = cart.slice(0, 3).map(item => `${item.name} (${item.quantity})`).join(', ');
      response = `Your cart has ${itemCount} item${itemCount > 1 ? 's' : ''}: ${items}${cart.length > 3 ? ' and more' : ''}. Total: £${totalPrice.toFixed(2)}`;
      tone = 'neutral';
    } else {
      response = 'Your cart is empty';
      tone = 'neutral';
    }
  }
  else if (/(show|view|open|check) (my )?(invoice|receipt|order summary)/i.test(cmd)) {
    response = 'Opening your invoice';
    action = () => window.location.href = 'invoice.html';
    tone = 'neutral';
  }
  else if (/(what can I (buy|afford|get)|show me (products?|items?)|recommend) (under|for|within|with) (£|pound)?\s*(\d+)/i.test(cmd)) {
    const match = cmd.match(/(under|for|within|with)\s+(?:£|pound)?\s*(\d+)/i);
    if (match) {
      const budget = parseFloat(match[2]);
      const products = await loadVoiceProducts();
      const affordable = products.filter(p => p.price <= budget).sort((a, b) => b.rating - a.rating).slice(0, 3);
      if (affordable.length > 0) {
        const names = affordable.map(p => `${p.name} at £${p.price.toFixed(2)}`).join(', ');
        response = `Within £${budget}, I recommend: ${names}`;
        tone = 'excited';
        action = () => {
          localStorage.setItem('voicePriceFilter', budget.toString());
          window.location.href = 'products.html';
        };
      } else {
        response = `Sorry, couldn't find products within £${budget}`;
        tone = 'empathetic';
      }
    }
  }
  else if (/(show|find|get) (top rated|best rated|highest rated|5 star|4 star) (products?|items?)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const topRated = products.filter(p => p.rating >= 4.5).sort((a, b) => b.rating - a.rating).slice(0, 5);
    if (topRated.length > 0) {
      const names = topRated.slice(0, 3).map(p => p.name).join(', ');
      response = `Top rated products: ${names}. Opening products page`;
      action = () => {
        localStorage.setItem('voiceRatingFilter', '4.5');
        window.location.href = 'products.html';
      };
      tone = 'neutral';
    }
  }
  else if (/(how many|count|total) (products?|items?) (do you have|are there|available)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    response = `We have ${products.length} products available in our catalog`;
    tone = 'neutral';
  }
  else if (/(how many|count) (.+) (products?|items?)/i.test(cmd)) {
    const match = cmd.match(/(how many|count)\s+(.+?)\s+(products?|items?)/i);
    if (match) {
      const category = match[2].trim();
      const products = await loadVoiceProducts();
      const filtered = products.filter(p => p.category && p.category.toLowerCase().includes(category));
      response = `There are ${filtered.length} ${category} products available`;
      tone = 'neutral';
    }
  }
  else if (/(update cart|modify cart|change quantity|update quantity|edit cart)/i.test(cmd)) {
    response = 'Opening cart to update items';
    action = () => window.location.href = 'cart.html';
  }
  else if (/(add to wishlist|save this|add to favorites?|like this|favorite this|save product|add to saves)/i.test(cmd)) {
    response = 'Please select an item from products page first';
    action = () => window.location.href = 'products.html';
  }
  else if (/(remove from wishlist|delete from wishlist|unlike|unfavorite|remove favorite)/i.test(cmd)) {
    response = 'Opening wishlist to manage items';
    action = () => window.location.href = 'wishlist.html';
  }
  else if (/(compare|comparison|compare products|product comparison|compare items|show comparison)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    let mentioned = [];
    const compareMatch = command.match(/compare\s+(.+)/i);
    if (compareMatch) {
      const tail = compareMatch[1].replace(/between\s+/i, '').replace(/please|for me|thanks?/gi, '').trim();
      if (tail) {
        const parts = tail.split(/\s+vs\s+|\s+versus\s+|\s+and\s+|,|\s+with\s+/i).map(p => p.trim()).filter(Boolean);
        parts.forEach(p => {
          const idMatch = p.match(/(product|item|number)\s*(\d+)/i);
          if (idMatch) {
            const id = parseInt(idMatch[2], 10);
            const byId = products.find(pr => pr.id === id);
            if (byId && !mentioned.includes(byId)) { mentioned.push(byId); return; }
          }
          const lower = p.toLowerCase();
          const byName = products.find(pr => pr.name && pr.name.toLowerCase().includes(lower));
          if (byName && !mentioned.includes(byName)) { mentioned.push(byName); }
        });
      }
    }
    if (mentioned.length < 2 && products.length >= 2) {
      mentioned = [...products].sort((a, b) => a.price - b.price).slice(0, 2);
    }
    if (mentioned.length >= 2) {
      try { localStorage.setItem('compareProducts', JSON.stringify(mentioned.map(p => p.id))); } catch (e) {}
      response = buildVoiceComparisonSummary(mentioned);
      action = () => window.location.href = 'products.html?compare=true';
    } else {
      response = 'Opening comparison view. On the products page you can pick specific items to compare.';
      action = () => window.location.href = 'products.html?compare=true';
    }
  }
  else if (/(add to compare|compare this|add for comparison|select for comparison)/i.test(cmd)) {
    response = 'Please select products from the products page to compare';
    action = () => window.location.href = 'products.html?compare=true';
  }
  else if (/(clear comparison|remove comparison|stop comparing|cancel comparison|reset comparison|reset the comparison|reset compare|change it back|undo comparison|start over comparison)/i.test(cmd)) {
    response = 'Okay, Ive reset your comparison and cleared the highlighted products.';
    tone = 'neutral';
    action = () => {
      try { localStorage.removeItem('compareProducts'); } catch (e) {}
      if (typeof window.clearComparisonState === 'function') { try { window.clearComparisonState(); return; } catch (e) {} }
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('compare');
        if (url.pathname.toLowerCase().includes('products.html')) { window.location.href = url.toString(); }
      } catch (e) {}
    };
  }
  else if (/(show compared|view comparison|see comparison|compare results)/i.test(cmd)) {
    response = 'Showing comparison results';
    action = () => window.location.href = 'products.html?compare=view';
  }
  else if (/(compare (prices?|features?|specs?|ratings?))/i.test(cmd)) {
    const compareType = cmd.match(/(prices?|features?|specs?|ratings?)/i)[0];
    response = `Comparing ${compareType}`;
    action = () => window.location.href = 'products.html?compare=true';
  }
  else if (isProductDetailPage && /(add this|buy this|add to cart|purchase this)/i.test(cmd)) {
    try {
      if (typeof window.addToCartDetail === 'function') {
        window.addToCartDetail();
        response = 'Added this item to your cart.';
        tone = 'excited';
      } else {
        const p = (typeof window !== 'undefined' && window.currentProduct) ? window.currentProduct : null;
        if (p) {
          const { cart } = getCartData();
          const existing = cart.find(item => item.id === p.id);
          if (existing) existing.quantity = (existing.quantity || 1) + 1;
          else cart.push({ ...p, quantity: 1 });
          localStorage.setItem('cart', JSON.stringify(cart));
          response = `Added ${p.name || 'this item'} to your cart.`;
          tone = 'excited';
          if (typeof window.updateCartDisplay === 'function') action = () => window.updateCartDisplay();
        } else {
          response = 'I need the product details to finish that. Please wait a moment.';
          tone = 'empathetic';
        }
      }
    } catch (e) {
      response = 'I could not add this item right now.';
      tone = 'empathetic';
    }
  }
  else if (isProductDetailPage && /(compare with similar|compare with others|find similar|show similar)/i.test(cmd)) {
    try {
      const p = (typeof window !== 'undefined' && window.currentProduct) ? window.currentProduct : null;
      const term = p?.category || p?.brand || p?.name || '';
      response = 'Showing similar products.';
      action = () => {
        if (term) localStorage.setItem('pendingSearch', term);
        window.location.href = 'products.html';
      };
    } catch (e) {
      response = 'I could not find similar products right now.';
      tone = 'empathetic';
    }
  }
  else if (isProductDetailPage && /(show reviews|read reviews|customer reviews)/i.test(cmd)) {
    const found = scrollToSection(['.reviews-section', '#reviews', '.reviews', '[data-section=\"reviews\"]']);
    response = found ? 'Jumping to reviews.' : 'I could not find reviews on this page.';
  }
  else if (isProductDetailPage && /(show specs|specifications|show details|tech specs)/i.test(cmd)) {
    const found = scrollToSection(['.specifications', '#specs', '.specs', '[data-section=\"specs\"]', '#details', '.details']);
    response = found ? 'Jumping to specifications.' : 'I could not find specs on this page.';
  }
  else if (isProductDetailPage && /(show description|show features|show details)/i.test(cmd)) {
    const found = scrollToSection(['.product-description', '.features-list', '.details']);
    response = found ? 'Jumping to product details.' : 'I could not find details on this page.';
  }
  else if (isProductDetailPage && /(explain( this| the)? product|tell me about this( product| item)?|what can you tell me about (this|it)|describe this( product| item)?|is this (good|worth it)|is this a good choice|help me decide (on|about) this)/i.test(cmd)) {
    try {
      const p = (typeof window !== 'undefined' && window.currentProduct) ? window.currentProduct : null;
      if (!p) {
        response = 'I can explain this product in more detail once the page has fully loaded.';
      } else {
        const name = p.name || 'this item';
        const category = p.category || 'versatile piece';
        const brand = p.brand || '';
        const priceNum = typeof p.price === 'number' ? p.price : parseFloat(p.price) || 0;
        const ratingNum = typeof p.rating === 'number' ? p.rating : parseFloat(p.rating) || 4.5;
        const reviewsNum = typeof p.reviews === 'number' ? p.reviews : parseInt(p.reviews, 10) || 0;
        let priceLevel = '';
        if (priceNum >= 150) priceLevel = 'a more premium choice';
        else if (priceNum >= 80) priceLevel = 'a solid mid-range option';
        else if (priceNum > 0) priceLevel = 'quite budget-friendly';
        const rawDesc = (p.description || '').trim();
        let shortDesc = '';
        if (rawDesc) {
          const firstSentence = rawDesc.split(/[.!?]/)[0].trim();
          if (firstSentence) shortDesc = firstSentence;
        }
        let stockLine = '';
        if (p.inStock === false) stockLine = 'Right now it appears to be out of stock.';
        else if (p.inStock && typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5) stockLine = `It is in stock, but there are only about ${p.stock} left at the moment.`;
        else if (p.inStock) stockLine = 'It is in stock and ready to ship.';
        const intro = `This is the ${name}${brand ? ` from ${brand}` : ''}, in our ${category.toLowerCase()} range.`;
        const pricing = priceNum > 0 ? ` It costs around £${priceNum.toFixed(2)}, which makes it ${priceLevel || 'good value for what it offers'}.` : '';
        const socialProof = ` Customers rate it about ${ratingNum.toFixed(1)} out of 5 based on roughly ${reviewsNum.toLocaleString()} review${reviewsNum === 1 ? '' : 's'}.`;
        const descPart = shortDesc ? ` In simple terms, ${shortDesc}.` : '';
        const stockPart = stockLine ? ` ${stockLine}` : '';
        response = (intro + pricing + socialProof + descPart + stockPart).trim();
        tone = 'neutral';
      }
    } catch (e) {
      response = 'I tried to explain this product but something went a bit wrong. You can still read all the details on the page while I improve.';
      tone = 'empathetic';
    }
  }
  else if (/(shipping|delivery|ship|deliver|free shipping|shipping cost|delivery time|shipping info|delivery info)/i.test(cmd) || /(when will it arrive|how long|delivery date|shipping time|arrival time|shipping speed)/i.test(cmd) || /(track|tracking|where is my order|track order|track package|track delivery)/i.test(cmd)) {
    response = 'Here\'s the calm, honest shipping story: standard delivery is about 3 to 5 days, express is usually 1 to 2 days, and many orders over £50 qualify for free shipping.';
    tone = 'neutral';
  }
  else if (/(return|refund|money back|send back|exchange|replacement|return policy|refund policy)/i.test(cmd) || /(how to return|can I return|return process|refund process|exchange policy)/i.test(cmd)) {
    response = '↩ 30-day money-back guarantee! Easy returns with full refund.';
  }
  else if (/(payment|pay|payment methods?|credit card|debit card|paypal|payment options)/i.test(cmd) || /(how to pay|how can I pay|accepted payments?|payment accepted|pay with)/i.test(cmd)) {
    response = 'We accept Credit/Debit cards, PayPal, Apple Pay, and Google Pay 💳';
  }
  else if (/(my account|account|profile|login|sign in|log in|user account|my profile)/i.test(cmd) || /(register|sign up|create account|new account|join|sign up now)/i.test(cmd) || /(logout|log out|sign out)/i.test(cmd)) {
    response = 'Account features coming soon! Currently in guest mode.';
  }
  else if (/(my orders?|order history|past orders?|previous orders?|track order|order tracking)/i.test(cmd) || /(where is my order|order status|tracking|track my order|order info)/i.test(cmd)) {
    response = ' Order tracking available after checkout';
  }
  else if (/(order total|grand total|how much am i paying|how much do i pay|what is my total)/i.test(cmd)) {
    const checkoutTotals = window.checkoutTotals || null;
    if (checkoutTotals) {
      const { subtotal, shipping, tax, total } = checkoutTotals;
      response = `Right now your full order comes to about £${total.toFixed(2)}. That includes £${subtotal.toFixed(2)} of items, £${tax.toFixed(2)} in tax, and ${shipping === 0 ? 'free shipping' : 'about £' + shipping.toFixed(2) + ' for shipping'}.`;
      tone = 'neutral';
    } else {
      try {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        if (subtotal > 0) {
          response = `At the moment your items add up to roughly £${subtotal.toFixed(2)} before shipping and tax.`;
          tone = 'neutral';
        } else {
          response = 'Your cart looks empty, so there isn\'t really an order total yet.';
          tone = 'empathetic';
        }
      } catch (e) {
        response = 'I tried to read your order total, but something didn\'t quite load. You can still see the full breakdown on the checkout page.';
        tone = 'empathetic';
      }
    }
  }
  else if (/(recommend|suggest|what should I buy|best products?|popular items?|trending|top picks|what else should i add|any suggestions for my order)/i.test(cmd) || /(top rated|best sellers?|most popular|highly rated|customer favorites)/i.test(cmd)) {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const subtotal = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    const freeShippingThreshold = (window.checkoutTotals && typeof window.checkoutTotals.freeShippingThreshold === 'number') ? window.checkoutTotals.freeShippingThreshold : 50;
    let suggestionNote = '';
    if (subtotal > 0 && subtotal < freeShippingThreshold) {
      const diff = freeShippingThreshold - subtotal;
      suggestionNote = `If you add around £${diff.toFixed(2)} more, you should unlock free shipping.`;
    } else if (subtotal >= freeShippingThreshold) {
      suggestionNote = 'You already qualify for free shipping on this order.';
    }
    const products = await loadVoiceProducts();
    const topSuggestions = (products || []).slice().sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 2);
    if (topSuggestions.length) {
      const names = topSuggestions.map(p => p.name).join(' or ');
      response = `If you\'d like a gentle nudge, people really love ${names}. ${suggestionNote}`.trim();
      tone = 'excited';
    } else if (suggestionNote) {
      response = suggestionNote;
      tone = 'neutral';
    } else {
      response = 'When you\'re ready, you can check out our trending products for some smart additions to your order.';
      tone = 'neutral';
    }
    action = () => window.location.href = 'products.html';
  }
  else if (/(filter|sort|arrange|order by|show by|organize) (price|rating|newest|popular|name)/i.test(cmd) || /(low to high|high to low|cheapest|most expensive|price ascending|price descending)/i.test(cmd) || /(newest first|oldest first|latest|recent)/i.test(cmd)) {
    response = 'Opening products with sorting options';
    action = () => window.location.href = 'products.html';
  }
  else if (/(nike|adidas|apple|samsung|sony|lg|dell|hp|zara|h&m|gucci|prada)/i.test(cmd)) {
    const brand = cmd.match(/(nike|adidas|apple|samsung|sony|lg|dell|hp|zara|h&m|gucci|prada)/i)[0];
    response = `Searching for ${brand} products`;
    action = () => { localStorage.setItem('pendingSearch', brand); window.location.href = 'products.html'; };
  }
  else if (/(red|blue|green|black|white|yellow|pink|purple|orange|grey|gray|brown) (products?|items?|shoes?|clothes?)/i.test(cmd)) {
    const color = cmd.match(/(red|blue|green|black|white|yellow|pink|purple|orange|grey|gray|brown)/i)[0];
    response = `Searching for ${color} items`;
    action = () => { localStorage.setItem('pendingSearch', color); window.location.href = 'products.html'; };
  }
  else if (/(small|medium|large|extra large|x large|xl|xxl|s|m|l) (size|items?|clothes?)/i.test(cmd)) {
    response = 'Opening products to filter by size';
    action = () => window.location.href = 'products.html';
  }
  else if (/(under|below|less than|cheaper than) (\d+)/i.test(cmd)) {
    const match = cmd.match(/(\d+)/);
    response = `Searching products under £${match[0]}`;
    action = () => window.location.href = 'products.html';
  }
  else if (/(over|above|more than|expensive than) (\d+)/i.test(cmd)) {
    const match = cmd.match(/(\d+)/);
    response = `Searching products over £${match[0]}`;
    action = () => window.location.href = 'products.html';
  }
  else if (/(help|assist|support|what can you do|how does this work|guide|tutorial|instructions)/i.test(cmd) || /(how to use|need help|can you help|help me|assist me|show me how)/i.test(cmd) || /(what commands|available commands|what can I say|voice commands)/i.test(cmd)) {
    response = 'Opening the command guide on screen. You can also ask naturally.';
    showCommandOverlay();
  }
  else if (/(open chatbot|show chatbot|chatbot|chat|customer service|live chat|talk to agent)/i.test(cmd)) {
    response = 'Opening AI chatbot';
    action = () => { if (typeof toggleChatbot === 'function') toggleChatbot(); };
  }
  else if (/(change theme|dark mode|light mode|theme|change color|toggle theme|switch theme)/i.test(cmd)) {
    response = 'Changing theme';
    action = () => { if (typeof cycleTheme === 'function') cycleTheme(); };
  }
  else if (/(scroll down|go down|page down|move down|scroll below|down)/i.test(cmd)) {
    response = 'Scrolling down';
    action = () => window.scrollBy({ top: 500, behavior: 'smooth' });
  }
  else if (/(scroll up|go up|page up|move up|top|back to top|scroll top|go to top)/i.test(cmd)) {
    response = 'Scrolling to top';
    action = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  else if (/(refresh|reload|restart|reset page|reload page|refresh page)/i.test(cmd)) {
    response = 'Refreshing page';
    action = () => location.reload();
  }
  else if (/(go back|back|previous page|last page|go to previous|return)/i.test(cmd)) {
    response = 'Going back';
    action = () => history.back();
  }
  else if (/(go forward|forward|next page|go ahead)/i.test(cmd)) {
    response = 'Going forward';
    action = () => history.forward();
  }
  else if (/(thank you|thanks|thank|appreciate|awesome|great|perfect|nice|excellent|wonderful)/i.test(cmd)) {
    const thanks = ['You\'re welcome!', 'Happy to help!', 'My pleasure!', 'Anytime!', 'Glad I could help!'];
    response = thanks[Math.floor(Math.random() * thanks.length)];
  }
  else if (/(bye|goodbye|see you|later|exit|close|quit|see ya|catch you later)/i.test(cmd)) {
    response = 'Goodbye! Have a great day!';
  }
  else if (/(what's the time|what time|current time|tell me the time|time now)/i.test(cmd)) {
    response = `It's ${new Date().toLocaleTimeString()}`;
  }
  else if (/(what's the date|what date|today's date|tell me the date|current date)/i.test(cmd)) {
    response = `Today is ${new Date().toLocaleDateString()}`;
  }
  else if (/(what day|which day|day today|today)/i.test(cmd)) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    response = `Today is ${days[new Date().getDay()]}`;
  }
  else if (/(reviews|ratings|customer reviews|product reviews|show reviews|read reviews)/i.test(cmd)) {
    response = 'Opening products to view reviews';
    action = () => window.location.href = 'products.html';
  }
  else if (/(new arrivals|new products|what's new|latest products|recently added)/i.test(cmd)) {
    response = 'Showing latest products';
    action = () => window.location.href = 'products.html';
  }
  else if (/(fill form|fill out form|complete form|auto fill|fill details|fill information)/i.test(cmd)) {
    response = 'Form assistant ready! Say commands like "enter name John" or "enter email test@email.com"';
  }
  else if (/(enter name|fill name|my name is|type name) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter name|fill name|my name is|type name)\s+(.+)/i);
    if (match) {
      const name = match[2].trim();
      response = `Entering name: ${name}`;
      action = () => {
        const field = document.querySelector('input[name*="name"], input[id*="name"], input[placeholder*="name"]');
        if (field) { field.value = name; field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter email|fill email|my email is|email address) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter email|fill email|my email is|email address)\s+(.+)/i);
    if (match) {
      const email = match[2].trim();
      response = `Entering email: ${email}`;
      action = () => {
        const field = document.querySelector('input[type="email"], input[name*="email"], input[id*="email"]');
        if (field) { field.value = email; field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter phone|fill phone|my phone is|phone number|contact number) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter phone|fill phone|my phone is|phone number|contact number)\s+(.+)/i);
    if (match) {
      const phone = match[2].trim();
      response = `Entering phone: ${phone}`;
      action = () => {
        const field = document.querySelector('input[type="tel"], input[name*="phone"], input[id*="phone"]');
        if (field) { field.value = phone; field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter address|fill address|my address is|shipping address|delivery address) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter address|fill address|my address is|shipping address|delivery address)\s+(.+)/i);
    if (match) {
      const address = match[2].trim();
      response = `Entering address: ${address}`;
      action = () => {
        const field = document.querySelector('input[name*="address"], textarea[name*="address"], input[id*="address"], textarea[id*="address"], input[placeholder*="address"], textarea[placeholder*="address"]');
        if (field) { field.value = address; field.classList.add('voice-filled'); field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter city|fill city|my city is) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter city|fill city|my city is)\s+(.+)/i);
    if (match) {
      const city = match[2].trim();
      response = `Entering city: ${city}`;
      action = () => {
        const field = document.querySelector('input[name*="city"], input[id*="city"], input[placeholder*="city"]');
        if (field) { field.value = city; field.classList.add('voice-filled'); field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter (postal|post|zip) code|my (postal|post|zip) code is) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter (postal|post|zip) code|my (postal|post|zip) code is)\s+(.+)/i);
    if (match) {
      const code = match[4].trim();
      response = `Entering postal code: ${code}`;
      action = () => {
        const field = document.querySelector('input[name*="post"], input[name*="zip"], input[name*="code"], input[id*="post"], input[id*="zip"], input[id*="code"], input[placeholder*="post"], input[placeholder*="zip"], input[placeholder*="code"]');
        if (field) { field.value = code; field.classList.add('voice-filled'); field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter country|fill country|my country is) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter country|fill country|my country is)\s+(.+)/i);
    if (match) {
      const country = match[2].trim();
      response = `Entering country: ${country}`;
      action = () => {
        const field = document.querySelector('input[name*="country"], select[name*="country"], input[id*="country"], select[id*="country"], input[placeholder*="country"]');
        if (field) {
          field.value = country;
          field.classList.add('voice-filled');
          field.dispatchEvent(new Event('input', { bubbles: true }));
          field.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      tone = 'neutral';
    }
  }
  else if (/(enter note|enter message|fill note|fill message|special instructions|order notes|comments) (.+)/i.test(cmd)) {
    const match = cmd.match(/(enter note|enter message|fill note|fill message|special instructions|order notes|comments)\s+(.+)/i);
    if (match) {
      const note = match[2].trim();
      response = 'Adding your message to the form.';
      action = () => {
        const field = document.querySelector('textarea[name*="note"], textarea[name*="message"], textarea[id*="note"], textarea[id*="message"], textarea[placeholder*="note"], textarea[placeholder*="message"]');
        if (field) { field.value = note; field.dispatchEvent(new Event('input', { bubbles: true })); }
      };
      tone = 'neutral';
    }
  }
  else if (!response && intent.confidence > 0.7 && (/(show|display|find|list|get|bring|pull up|load|fetch|discover|explore) (all the|the |the top|the best|high rated|bestselling|featured|recommended|latest|new|trending|popular)\s+(.+)/i.test(cmd))) {
    const categoryMatch = cmd.match(/(electronics|fashion|shoes|bags|home|tech|gadgets|clothes|furniture|decor|accessories|jewelry|watches|phones|laptops|tablets|sneakers|boots|sandals|jackets|shirts|pants|dresses|handbags|backpacks|lamps|pillows|rugs)/i);
    if (entities.productName || categoryMatch) {
      const term = entities.productName || categoryMatch[0];
      response = `Searching for ${term} in our collection. Let me find the best options for you.`;
      action = () => { localStorage.setItem('pendingSearch', term); localStorage.setItem('voiceFilterType', 'bestselling'); window.location.href = 'products.html'; };
      tone = 'excited';
    }
  }
  else if (!response && /(compare|show me (the )?(difference|differences)|which is better|which one should|help me choose between) (.+) (and|with|versus|vs|or) (.+)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const parts = cmd.match(/(?:and|with|versus|vs|or)\s+/i);
    if (parts) {
      const segments = cmd.split(parts[0]);
      const term1 = segments[0].replace(/(compare|difference|which|better|choose|between|show)/gi, '').trim();
      const term2 = segments[1].trim();
      const p1 = products.find(p => NLPMatcher.similarity(p.name.toLowerCase(), term1) > 0.5);
      const p2 = products.find(p => NLPMatcher.similarity(p.name.toLowerCase(), term2) > 0.5);
      if (p1 && p2) {
        const priceComparison = p1.price < p2.price ? `${p1.name} is £${(p2.price - p1.price).toFixed(2)} cheaper` : `${p2.name} is £${(p1.price - p2.price).toFixed(2)} cheaper`;
        response = `Comparing ${p1.name} and ${p2.name}: ${priceComparison}. Which would you prefer?`;
        tone = 'neutral';
        action = () => { localStorage.setItem('compareProducts', JSON.stringify([p1.id, p2.id])); window.location.href = 'products.html?compare=true'; };
      }
    }
  }
  else if (!response && /(increase|add|raise|boost) (quantity|amount|number) (of|to|by) (\d+)/i.test(cmd)) {
    const match = cmd.match(/(\d+)/);
    if (match) { const quantity = parseInt(match[0]); response = `Quantity updated to ${quantity} items`; tone = 'neutral'; }
  }
  else if (!response && /(when will|how long|delivery time|shipping time|arrive|ship|how fast|expedited|overnight|same day|next day)/i.test(cmd)) {
    response = 'Standard delivery: 3-5 days. Express: 1-2 days. Free shipping on orders over £50. You can select your preferred shipping at checkout.';
  }
  else if (!response && /(payment|pay|card|secure|encrypted|safe|ssl|safe to|fraud|protection|guarantee)/i.test(cmd)) {
    response = 'All payments are encrypted and secure. We accept credit cards, debit cards, PayPal, Apple Pay, and Google Pay. Your data is protected.';
  }
  else if (!response && /(coupon|promo|code|discount code|apply code|use code|have a code|enter code)/i.test(cmd)) {
    response = 'You can enter a coupon code at checkout. Just enter the code in the promotional code field. Do you have a code to apply?';
  }
  else if (!response && entities.productName && /(in stock|available|out of stock|stock|quantity available|how many left)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const product = products.find(p => NLPMatcher.similarity(p.name.toLowerCase(), entities.productName.toLowerCase()) > 0.5);
    if (product) {
      if (product.inStock === false) { response = `${product.name} is currently out of stock. Would you like me to notify you when it's back?`; tone = 'empathetic'; }
      else if (product.stock && product.stock <= 5) { response = `${product.name} is in stock but only ${product.stock} left. Stock is running low!`; tone = 'excited'; }
      else { response = `${product.name} is in stock and ready to ship`; tone = 'neutral'; }
    }
  }
  else if (!response && /(review|rating|stars?|how many stars|user feedback|what do people say|customer feedback)/i.test(cmd)) {
    if (entities.productName) {
      const products = await loadVoiceProducts();
      const product = products.find(p => NLPMatcher.similarity(p.name.toLowerCase(), entities.productName.toLowerCase()) > 0.5);
      if (product) response = `${product.name} has ${product.rating || 4.5} stars based on ${product.reviews || 0} customer reviews`;
    } else {
      response = 'Opening products to see reviews';
      action = () => window.location.href = 'products.html';
    }
  }
  else if (!response && /(show|play|video|live|stream|virtual|tour|demonstration|how to|tutorial) (video|stream|tour|demo|guide|walkthrough)/i.test(cmd)) {
    response = 'Video content would appear here. Let me take you to our product videos.';
    action = () => window.location.href = 'products.html';
  }
  else if (!response && /(size|fit|measurement|how (do|does|will) (it|this) fit|what size|measurement guide|fitting guide)/i.test(cmd)) {
    response = 'You can check our size guide on the product page. Or I can help you find the right size if you tell me your measurements.';
    action = () => window.location.href = 'products.html';
  }
  else if (!response && /(eco|organic|sustainable|biodegradable|eco friendly|recyclable|green|environment)/i.test(cmd)) {
    response = 'Many of our products are eco-friendly. Let me show you our sustainable selection.';
    action = () => { localStorage.setItem('pendingCategory', 'eco-friendly'); window.location.href = 'products.html'; };
  }
  else if (!response && /(gift|wrap|wrapping|personalize|message|custom|inscription|engraving|personalization)/i.test(cmd)) {
    response = 'We offer gift wrapping and personalization options. You can select these at checkout.';
  }
  else if (!response && /(bulk|wholesale|bulk order|quantity discount|corporate|business|wholesale price)/i.test(cmd)) {
    response = 'Contact our team for bulk orders and wholesale pricing. I can take you to our contact page.';
    action = () => window.location.href = 'contact.html';
  }
  else if (!response && /(add all wishlist|move all|transfer all) (to cart|into cart)/i.test(cmd)) {
    const { wishlist } = getWishlistData();
    const { cart } = getCartData();
    if (wishlist.length > 0) {
      wishlist.forEach(item => { const existing = cart.find(c => c.id === item.id); if (!existing) cart.push({ ...item, quantity: 1 }); });
      localStorage.setItem('cart', JSON.stringify(cart));
      response = `Moved all ${wishlist.length} items from wishlist to cart`;
      tone = 'excited';
    } else {
      response = 'Your wishlist is empty';
    }
  }
  else if (!response && /(price alert|notify me|when goes down|price drop|notify when|alert me)/i.test(cmd)) {
    response = 'I can set a price alert for you. Just tell me which product and your target price.';
  }
  else if (!response && /(refer|referral|share|friend|invite|earn|bonus|reward)/i.test(cmd)) {
    response = 'Share your referral link with friends and earn rewards. Visit the referral program page for more details.';
  }
  else if (!response && /(larger text|easier|accessible|reading|blind|screen reader|font size|dark mode)/i.test(cmd)) {
    response = 'We support dark mode, larger text, and screen readers. Let me help you adjust your settings.';
    action = () => { if (typeof cycleTheme === 'function') cycleTheme(); };
  }
  else if (!response && /(what's on sale today|today's deals|special today|limited time|flash sale|hourly deals)/i.test(cmd)) {
    response = 'Let me show you today\'s best deals and limited-time offers.';
    action = () => window.location.href = 'products.html?deals=true';
    tone = 'excited';
  }
  else if (!response && /(what's trending|most loved|customer favorites|bestsellers|most popular|trending now|top choices)/i.test(cmd)) {
    const products = await loadVoiceProducts();
    const trending = products.sort((a, b) => (b.reviews || 0) - (a.reviews || 0)).slice(0, 3);
    const names = trending.map(p => p.name).join(', ');
    response = `Our trending picks: ${names}. Let me show you more.`;
    tone = 'excited';
    action = () => window.location.href = 'products.html';
  }
  else if (!response && /(set reminder|reminder|alarm|timer|set timer)/i.test(cmd)) {
    response = 'I can\'t set reminders yet, but you can ask me about products or orders anytime!';
  }
  else if (!response && /(show low stock|running out|stock status|inventory|restock|back in stock|coming soon)/i.test(cmd)) {
    response = 'Let me show you what\'s in stock and coming soon.';
    action = () => window.location.href = 'products.html';
  }
  else if (!response && /(call|representative|agent|human|person|speak to|talk to|transfer|escalate|manager)/i.test(cmd)) {
    response = 'I\'ll connect you with our support team. Taking you there now.';
    action = () => window.location.href = 'contact.html';
  }
  else if (!response && /(currency|change|pounds|dollars|euros|exchange|convert)/i.test(cmd)) {
    response = 'We currently display prices in British pounds. Change currency on your account settings.';
  }
  else if (!response && /(holiday|christmas|black friday|cyber monday|easter|summer|winter|seasonal)/i.test(cmd)) {
    response = 'Let me show you our seasonal collection.';
    action = () => window.location.href = 'products.html';
    tone = 'excited';
  }
  else if (!response && /(voice command|voice help|what can you do|all commands|voice features|help with voice)/i.test(cmd)) {
    response = 'I can: Search products, add to cart, compare items, fill forms, navigate pages, calculate prices, manage your wishlist, and handle checkout! Just speak naturally!';
  }
  else if (/(submit form|send form|submit|send message|complete submission|upload|finish|done)/i.test(cmd)) {
    response = 'Submitting form';
    action = () => {
      const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button[aria-label*="submit" i], button[aria-label*="send" i]');
      if (submitBtn) submitBtn.click();
    };
  }
  else if (/(clear form|reset form|empty form|start over|clear fields|delete form)/i.test(cmd)) {
    response = 'Clearing form';
    action = () => { const form = document.querySelector('form'); if (form) form.reset(); };
  }
  else {
    if (!response) {
      const fallbacks = [
        'I didn\'t quite understand. Try "show products" or "open cart"',
        'Hmm, not sure. Say "help" to see what I can do!',
        'Could you rephrase? I can help with navigation and shopping!'
      ];
      response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      if (tone === 'neutral') tone = 'empathetic';
    }
  }

  // --- THE FIX: Speak first, wait to finish, THEN execute action ---
  if (!skipDefaultChatUpdate) {
    updateChatUI('ai', response);
    updateSiriTranscript(response);
  }
  
  VoiceModule.speak(response, tone, () => {
    if (action) {
      action();
    }
    if (keepListening || assistantPersistent) {
      voiceKeepAlive = true;
      updateSiriStatus('Listening...');
      updateSiriTranscript('Anything else I can help you with?');
      try { if (recognition && !isListening) recognition.start(); } catch (e) {}
    } else {
      voiceKeepAlive = false;
      updateSiriStatus('Paused');
      updateSiriTranscript('Tap "Listen Again" to continue.');
    }
  });
}


function showFuturisticInterface() {
  const existing = document.getElementById('siriVoiceInterface');
  if (existing) return;

  const html = `
    <div id="siriVoiceInterface" class="siri-interface">
      <div class="siri-backdrop" onclick="stopVoice()"></div>
      <div class="siri-content">
        <div class="siri-orb-container">
          <canvas id="siriCanvas" width="360" height="360"></canvas>
          <div class="orb-core">
            <svg viewBox="0 0 24 24" fill="white" width="36" height="36">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
            </svg>
          </div>
        </div>
        <div id="siriStatus" class="siri-status" aria-live="polite">Listening...</div>
        <div class="siri-hint">Try: "next page", "open product 3", "compare headphones"</div>
        <div id="siriTranscript" class="siri-transcript">Say something like "show deals" or "open cart".</div>
        <div id="aiChatBox" class="chat-container">
          <div class="chat-msg ai-msg">Hi! I'm listening. How can I help?</div>
        </div>
        <div class="siri-controls">
          <button onclick="listenAgain()" class="siri-mini-btn siri-primary-btn">Listen Again</button>
          <button onclick="clearVoiceChatHistory(); updateSiriTranscript('Started a new chat.')" class="siri-mini-btn">New Chat</button>
          <button onclick="toggleMute()" class="siri-mini-btn">Mute</button>
          <button onclick="stopVoice()" class="siri-mini-btn">Stop</button>
        </div>
        <button onclick="stopVoice()" class="siri-close-btn">✕</button>
      </div>
      <div id="siriCommandOverlay" class="siri-command-overlay" aria-hidden="true">
        <div class="siri-command-card">
          <button class="siri-command-close" onclick="hideCommandOverlay()">✕</button>
          <div class="siri-command-title">Voice Command Guide</div>
          <div class="siri-command-grid">
            <div class="siri-command-group">
              <h4>Shopping</h4>
              <p>"search for headphones"</p>
              <p>"show deals"</p>
              <p>"compare deals"</p>
              <p>"compare products"</p>
              <p>"add number 1"</p>
            </div>
            <div class="siri-command-group">
              <h4>Cart & Wishlist</h4>
              <p>"summarize my cart"</p>
              <p>"set quantity of shoes to 2"</p>
              <p>"remove last item"</p>
              <p>"move wishlist to cart"</p>
            </div>
            <div class="siri-command-group">
              <h4>Navigation</h4>
              <p>"open cart"</p>
              <p>"go back"</p>
              <p>"open wishlist"</p>
              <p>"refresh"</p>
            </div>
            <div class="siri-command-group">
              <h4>Product Page</h4>
              <p>"add this"</p>
              <p>"compare with similar"</p>
              <p>"show reviews"</p>
              <p>"show specs"</p>
              <p>"next product"</p>
              <p>"open product 3"</p>
            </div>
            <div class="siri-command-group">
              <h4>Voice</h4>
              <p>"mute"</p>
              <p>"unmute"</p>
              <p>"sound check"</p>
              <p>"speak faster"</p>
              <p>"repeat"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);
  setTimeout(() => {
    document.getElementById('siriVoiceInterface').classList.add('active');
    renderVoiceChatHistory();
  }, 10);
}

function updateChatUI(sender, text, options = {}) {
  const chatBox = document.getElementById('aiChatBox');
  if (!chatBox) return;

  const existingTyping = chatBox.querySelector('.user-msg.typing');
  if (sender === 'user' && existingTyping) existingTyping.remove();

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-msg ${sender}-msg ${text.endsWith('...') ? 'typing' : ''}`;
  if (options.html) {
    msgDiv.innerHTML = text;
  } else {
    msgDiv.textContent = text;
  }
  
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  const isTyping = typeof text === 'string' && text.endsWith('...');
  if (!options.skipPersist && !options.html && !isTyping && (sender === 'user' || sender === 'ai')) {
    voiceChatHistory.push({ sender, text, html: false });
    if (voiceChatHistory.length > MAX_VOICE_CHAT_HISTORY) {
      voiceChatHistory = voiceChatHistory.slice(-MAX_VOICE_CHAT_HISTORY);
    }
    persistVoiceChatHistory();
  }
}

function hideFuturisticInterface() {
  const siri = document.getElementById('siriVoiceInterface');
  if (siri) {
    siri.classList.remove('active');
    setTimeout(() => siri.remove(), 400);
  }
}

function startRippleAnimation() {
  const canvas = document.getElementById('siriCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const center = size / 2;
  let ripples = [], frame = 0;

  function animate() {
    ctx.clearRect(0, 0, size, size);
    if (frame % 12 === 0) ripples.push({ r: size * 0.18, op: 1, hue: 190 + Math.random() * 60 });

    ripples.forEach((rip, i) => {
      ctx.beginPath();
      ctx.arc(center, center, rip.r, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${rip.hue}, 95%, 60%, ${rip.op})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      rip.r += size * 0.008;
      rip.op -= 0.02;
      if (rip.op <= 0) ripples.splice(i, 1);
    });

    frame++;
    if (isListening) rippleInterval = requestAnimationFrame(animate);
  }
  animate();
}

function stopRippleAnimation() {
  if (rippleInterval) {
    cancelAnimationFrame(rippleInterval);
    rippleInterval = null;
  }
}

function setSiriThinking(isThinking) {
  const el = document.querySelector('.orb-core');
  const root = document.getElementById('siriVoiceInterface');
  if (el) el.style.animation = isThinking ? 'orbThinking 0.8s infinite alternate' : 'none';
  if (root) root.classList.toggle('thinking', isThinking);
}

const styles = document.createElement('style');
styles.textContent = `
  .siri-interface { position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: 0.4s ease; pointer-events: none; }
  .siri-interface.active { opacity: 1; pointer-events: all; }
  .siri-backdrop { position: absolute; inset: 0; background:
    radial-gradient(circle at 15% 20%, rgba(14, 165, 233, 0.35), transparent 40%),
    radial-gradient(circle at 80% 30%, rgba(34, 211, 238, 0.35), transparent 45%),
    radial-gradient(circle at 60% 80%, rgba(249, 115, 22, 0.25), transparent 40%),
    rgba(6, 9, 20, 0.95); backdrop-filter: blur(22px); }
  
  .siri-content {
    position: relative; z-index: 1; width: min(620px, 92vw);
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    text-align: center;
  }

  .siri-orb-container { position: relative; width: 360px; height: 360px; display: flex; align-items: center; justify-content: center; }
  #siriCanvas { position: absolute; }
  .orb-core {
    position: relative; z-index: 1; width: 120px; height: 120px;
    background: conic-gradient(from 120deg, #22d3ee, #38bdf8, #f97316, #22d3ee); border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 70px rgba(56, 189, 248, 0.9), inset 0 0 25px rgba(255,255,255,0.35);
  }
  @keyframes orbThinking { 100% { transform: scale(1.12); box-shadow: 0 0 90px rgba(249,115,22,0.9); } }

  .siri-status { margin-top: 6px; font-size: 24px; font-weight: 700; color: #eaf1ff; text-shadow: 0 6px 20px rgba(59,130,246,0.4); }
  .siri-hint { font-size: 14px; color: rgba(255,255,255,0.7); }
  .siri-transcript { font-size: 13px; color: rgba(255,255,255,0.75); margin-bottom: 6px; text-align: center; }
  .siri-transcript.interim { color: rgba(147,197,253,0.95); }

  .chat-container { width: min(520px, 90vw); max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding: 8px 6px; scroll-behavior: smooth; }
  .chat-container::-webkit-scrollbar { width: 4px; }
  .chat-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

  .chat-msg {
    max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 15px; line-height: 1.4; font-family: system-ui, sans-serif;
    animation: popIn 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; transform: scale(0.95); opacity: 0;
  }
  @keyframes popIn { to { transform: scale(1); opacity: 1; } }

  .ai-msg { align-self: flex-start; background: rgba(255, 255, 255, 0.1); color: #fff; border-bottom-left-radius: 4px; }
  .user-msg { align-self: flex-end; background: linear-gradient(135deg, #3b82f6, #60a5fa); color: #fff; border-bottom-right-radius: 4px; }
  .user-msg.typing { opacity: 0.7; font-style: italic; }

  .siri-controls { display: flex; gap: 10px; margin-top: 8px; }
  .siri-mini-btn { background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 6px 14px; border-radius: 999px; cursor: pointer; transition: transform 0.2s ease, background 0.2s ease; font-size: 12px; }
  .siri-mini-btn:hover { transform: translateY(-1px); background: rgba(255,255,255,0.18); }
  .siri-primary-btn { background: linear-gradient(135deg, #0ea5e9, #0284c7); border-color: rgba(186, 230, 253, 0.6); }

  .siri-command-overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(3, 7, 18, 0.7); opacity: 0; pointer-events: none; transition: opacity 0.25s ease; z-index: 100000; }
  .siri-command-overlay.active { opacity: 1; pointer-events: all; }
  .siri-command-card { width: min(760px, 92vw); background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 18px; padding: 20px; color: #e2e8f0; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
  .siri-command-title { font-size: 18px; font-weight: 700; margin-bottom: 12px; }
  .siri-command-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; }
  .siri-command-group h4 { margin: 0 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: rgba(148,163,184,0.9); }
  .siri-command-group p { margin: 0 0 6px; font-size: 13px; color: rgba(226,232,240,0.85); }
  .siri-command-close { position: absolute; top: 12px; right: 12px; background: transparent; border: none; color: rgba(226,232,240,0.7); font-size: 18px; cursor: pointer; }

  .siri-close-btn { position: absolute; top: 16px; right: 16px; background: transparent; border: none; color: rgba(255,255,255,0.5); font-size: 20px; cursor: pointer; transition: color 0.2s; }
  .siri-close-btn:hover { color: white; }
`;
document.head.appendChild(styles);

window.startVoice = startVoice;
window.stopVoice = stopVoice;
window.listenAgain = listenAgain;
window.clearVoiceChatHistory = clearVoiceChatHistory;
