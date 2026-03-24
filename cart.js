const express = require('express');
const router = express.Router();

// In-memory cart storage (for demo - use database in production)
let carts = {};

// Get cart
router.get('/:userId', (req, res) => {
  const userId = req.params.userId || 'guest';
  const cart = carts[userId] || [];
  res.json(cart);
});

// Add to cart
router.post('/:userId', (req, res) => {
  const userId = req.params.userId || 'guest';
  const item = req.body;
  
  if (!carts[userId]) {
    carts[userId] = [];
  }
  
  const existingItem = carts[userId].find(i => i.id === item.id);
  
  if (existingItem) {
    existingItem.quantity += item.quantity || 1;
  } else {
    carts[userId].push({ ...item, quantity: item.quantity || 1 });
  }
  
  res.json({ success: true, cart: carts[userId] });
});

// Update cart item
router.put('/:userId/:itemId', (req, res) => {
  const userId = req.params.userId || 'guest';
  const itemId = parseInt(req.params.itemId);
  const { quantity } = req.body;
  
  if (!carts[userId]) {
    return res.status(404).json({ error: 'Cart not found' });
  }
  
  const item = carts[userId].find(i => i.id === itemId);
  
  if (item) {
    item.quantity = quantity;
    res.json({ success: true, cart: carts[userId] });
  } else {
    res.status(404).json({ error: 'Item not found' });
  }
});

// Remove from cart
router.delete('/:userId/:itemId', (req, res) => {
  const userId = req.params.userId || 'guest';
  const itemId = parseInt(req.params.itemId);
  
  if (!carts[userId]) {
    return res.status(404).json({ error: 'Cart not found' });
  }
  
  carts[userId] = carts[userId].filter(i => i.id !== itemId);
  res.json({ success: true, cart: carts[userId] });
});

// Clear cart
router.delete('/:userId', (req, res) => {
  const userId = req.params.userId || 'guest';
  carts[userId] = [];
  res.json({ success: true, cart: [] });
});

module.exports = router;
