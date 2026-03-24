const express = require('express');
const router = express.Router();

// In-memory wishlist storage (in production, use database)
const wishlists = {};

// GET wishlist for user
router.get('/:username', (req, res) => {
  const username = req.params.username;
  const wishlist = wishlists[username] || [];
  res.json(wishlist);
});

// ADD item to wishlist
router.post('/:username/add', (req, res) => {
  const username = req.params.username;
  const { productId, name } = req.body;

  if (!wishlists[username]) {
    wishlists[username] = [];
  }

  const exists = wishlists[username].find(item => item.productId === productId);

  if (exists) {
    return res.status(400).json({ error: 'Item already in wishlist' });
  }

  wishlists[username].push({ productId, name });

  res.json({ success: true, wishlist: wishlists[username] });
});

// REMOVE item from wishlist
router.delete('/:username/remove/:productId', (req, res) => {
  const { username, productId } = req.params;

  if (!wishlists[username]) {
    return res.status(404).json({ error: 'Wishlist not found' });
  }

  wishlists[username] = wishlists[username].filter(item => item.productId !== productId);

  res.json({ success: true, wishlist: wishlists[username] });
});

// CLEAR wishlist
router.delete('/:username/clear', (req, res) => {
  const username = req.params.username;
  wishlists[username] = [];
  res.json({ success: true, message: 'Wishlist cleared' });
});

module.exports = router;
