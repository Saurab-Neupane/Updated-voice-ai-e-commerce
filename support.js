const express = require('express');
const router = express.Router();

// In-memory support tickets
let tickets = [];

// Chatbot responses database
const responses = {
  greetings: [
    "Hello! I'm AIShopBot. How can I assist you today? 😊",
    "Hi there! Welcome to NeoShop! What can I help you with?",
    "Hey! Great to see you! What would you like to know?"
  ],
  products: [
    "We have an amazing collection of 20+ products! Check out our shoes, bags, and accessories. What are you interested in?",
    "Looking for something specific? We have shoes 👟, bags 👜, and accessories ⌚. Which category interests you?",
    "Our products range from £29.99 to £189.99. Browse by category or tell me what you need!"
  ],
  pricing: [
    "Our prices range from £29.99 to £189.99. We offer great value for premium quality!",
    "Products start at just £29.99! Would you like to see our best deals?",
    "We have options for every budget! Prices range from £29.99 to £189.99."
  ],
  shipping: [
    "Great news! We offer FREE shipping on all orders! 🚚",
    "All orders ship for FREE! Standard delivery takes 3-5 business days.",
    "FREE shipping worldwide! Orders are processed within 24 hours."
  ],
  returns: [
    "We have a 30-day money-back guarantee! Not satisfied? Return it hassle-free.",
    "Returns are easy! 30-day return policy, no questions asked.",
    "Changed your mind? No problem! 30-day free returns on all items."
  ],
  help: [
    "I can help you with:\n• Product recommendations\n• Pricing information\n• Shipping details\n• Order tracking\n• Returns & refunds\n\nWhat do you need?",
    "Here's what I can do:\n Find products\n Answer questions\n Track orders\n Process returns\n\nHow can I help?",
    "Need assistance? I can help with products, orders, shipping, returns, and more! What's on your mind?"
  ],
  thanks: [
    "You're welcome! Happy shopping! 😊",
    "Glad I could help! Let me know if you need anything else!",
    "Anytime! Enjoy your shopping experience! 🛍️"
  ],
  goodbye: [
    "Goodbye! Come back soon! 👋",
    "See you later! Happy shopping!",
    "Bye! Don't hesitate to reach out if you need help!"
  ],
  default: [
    "I'm not sure about that. Try asking about products, shipping, or returns!",
    "Hmm, I didn't quite catch that. Can you rephrase?",
    "I can help with products, pricing, shipping, and more. What would you like to know?"
  ]
};

// Keywords mapping
const keywords = {
  greetings: ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening'],
  products: ['product', 'item', 'show', 'catalog', 'collection', 'shoes', 'bags', 'accessories', 'what do you have', 'what do you sell'],
  pricing: ['price', 'cost', 'how much', 'expensive', 'cheap', 'affordable', 'budget'],
  shipping: ['ship', 'delivery', 'shipping', 'deliver', 'how long', 'when will'],
  returns: ['return', 'refund', 'money back', 'exchange', 'not satisfied'],
  help: ['help', 'assist', 'support', 'what can you do', 'features'],
  thanks: ['thank', 'thanks', 'appreciate', 'grateful'],
  goodbye: ['bye', 'goodbye', 'see you', 'later', 'exit']
};

// Smart response function
function getBotResponse(message) {
  const lowerMessage = message.toLowerCase().trim();

  // Check for keyword matches
  for (const [category, words] of Object.entries(keywords)) {
    if (words.some(word => lowerMessage.includes(word))) {
      const options = responses[category];
      return options[Math.floor(Math.random() * options.length)];
    }
  }

  // Special case: Specific product queries
  if (lowerMessage.includes('recommend')) {
    return "Based on your interests, I recommend:\n• Premium Running Shoes - £129.99\n• Leather Messenger Bag - £89.99\n• Smart Watch - ££149.99\n\nWould you like to see more details?";
  }

  if (lowerMessage.includes('best seller') || lowerMessage.includes('popular')) {
    return "Our best sellers are:\n🏆 Premium Sneakers - $129.99\n🏆 Designer Handbag - £159.99\n🏆 Luxury Watch - £189.99\n\nCheck them out in the Products section!";
  }

  if (lowerMessage.includes('track') || lowerMessage.includes('order status')) {
    return "To track your order, please provide your order number (format: NS12345678) or check your email for tracking information!";
  }

  // Default response
  const defaultOptions = responses.default;
  return defaultOptions[Math.floor(Math.random() * defaultOptions.length)];
}

// Chatbot endpoint
router.post('/bot', (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const reply = getBotResponse(message);

  res.json({
    reply,
    timestamp: new Date().toISOString()
  });
});

// Submit support ticket
router.post('/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  
  if (!name || !email || !message) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing required fields' 
    });
  }
  
  const ticket = {
    id: tickets.length + 1,
    ticketId: 'TKT-' + Date.now(),
    name,
    email,
    subject: subject || 'General Inquiry',
    message,
    status: 'open',
    createdAt: new Date().toISOString()
  };
  
  tickets.push(ticket);
  
  console.log('New support ticket:', ticket);
  
  res.json({ 
    success: true, 
    message: 'Thank you for contacting us! We will get back to you soon.',
    ticketId: ticket.ticketId
  });
});

// Newsletter subscription
router.post('/newsletter', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email is required' 
    });
  }
  
  console.log('Newsletter subscription:', email);
  
  res.json({ 
    success: true, 
    message: 'Successfully subscribed to newsletter!' 
  });
});

// Chatbot
router.post('/chatbot', (req, res) => {
  const { message } = req.body;
  
  let response = '';
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
    response = 'Hello! Welcome to NeoShop. How can I help you today?';
  } else if (lowerMessage.includes('product') || lowerMessage.includes('item')) {
    response = 'We have a wide range of products including shoes, bags, and accessories. What are you looking for?';
  } else if (lowerMessage.includes('price') || lowerMessage.includes('cost')) {
    response = 'Our products range from £49.99 to £499.99. You can filter by price on our products page.';
  } else if (lowerMessage.includes('shipping') || lowerMessage.includes('delivery')) {
    response = 'We offer free shipping on orders over $100. Standard delivery takes 3-5 business days.';
  } else if (lowerMessage.includes('return') || lowerMessage.includes('refund')) {
    response = 'We offer 30-day returns on all items. Items must be unused and in original packaging.';
  } else if (lowerMessage.includes('help') || lowerMessage.includes('support')) {
    response = 'I\'m here to help! You can ask me about products, shipping, returns, or use voice commands to navigate.';
  } else {
    response = 'I\'m not sure about that. Please contact our support team or try asking: "Tell me about your products" or "What\'s your shipping policy?"';
  }
  
  res.json({ response });
});

// Get all tickets
router.get('/tickets', (req, res) => {
  res.json(tickets);
});

// Get ticket by ID
router.get('/tickets/:ticketId', (req, res) => {
  const ticket = tickets.find(t => t.ticketId === req.params.ticketId);
  
  if (ticket) {
    res.json(ticket);
  } else {
    res.status(404).json({ error: 'Ticket not found' });
  }
});

module.exports = router;
