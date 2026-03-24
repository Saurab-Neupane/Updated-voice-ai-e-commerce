require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../AIShop')));

const orders = [];

function buildOrderFromRequest(body = {}) {
  const cart = Array.isArray(body.cart) ? body.cart : [];
  const subtotal = Number(body.subtotal || 0) || cart.reduce((sum, item) => {
    const price = Number(item.price) || 0;
    const qty = Number(item.quantity) || 0;
    return sum + (price * qty);
  }, 0);
  const shipping = Number(body.shipping || 0);
  const tax = Number(body.tax || 0);
  const total = Number(body.total || 0) || (subtotal + shipping + tax);

  return {
    orderId: 'ORD-' + Date.now(),
    createdAt: new Date().toISOString(),
    status: 'confirmed',
    email: String(body.email || '').trim(),
    phone: String(body.phone || '').trim(),
    fullName: String(body.fullName || '').trim(),
    address: String(body.address || '').trim(),
    apartment: String(body.apartment || '').trim(),
    city: String(body.city || '').trim(),
    state: String(body.state || '').trim(),
    zipCode: String(body.zipCode || '').trim(),
    country: String(body.country || '').trim(),
    paymentMethod: String(body.paymentMethod || 'card').trim(),
    cart,
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax: Number(tax.toFixed(2)),
    total: Number(total.toFixed(2))
  };
}

app.get('/api/products', (req, res) => {
  try {
    const productsPath = path.join(__dirname, 'db', 'products.json');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products;
    res.json(products);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to load products' });
  }
});


app.get('/api/products/:id', (req, res) => {
  try {
    const productsPath = path.join(__dirname, 'db', 'products.json');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products;
    const product = products.find(p => p.id === parseInt(req.params.id));
    
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load product' });
  }
});


app.get('/api/products/search/:query', (req, res) => {
  try {
    const productsPath = path.join(__dirname, 'db', 'products.json');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products;
    
    const query = req.params.query.toLowerCase();
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query))
    );
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});


app.post('/api/contact', (req, res) => {
  console.log('Contact:', req.body);
  res.json({ success: true, message: 'Message received!' });
});


app.post('/api/checkout', (req, res) => {
  try {
    const order = buildOrderFromRequest(req.body || {});

    if (!order.email || !order.fullName || !order.address || !Array.isArray(order.cart) || order.cart.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required checkout fields or cart is empty.'
      });
    }

    orders.push(order);
    res.json({
      success: true,
      orderId: order.orderId,
      message: 'Order placed!',
      order
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place order.'
    });
  }
});


app.post('/api/newsletter', (req, res) => {
  console.log('Newsletter:', req.body);
  res.json({ success: true, message: 'Subscribed!' });
});
// Simple rule-based chatbot endpoint (optional, used only if frontend calls it)
app.post('/api/chatbot', (req, res) => {
  const { message } = req.body || {};
  const text = (message || '').toString().toLowerCase();

  let response = 'Hi, I\'m your AIShop assistant. I can help with deals, products, cart, shipping and more.';

  if (text.includes('deal') || text.includes('discount') || text.includes('offer') || text.includes('sale')) {
    response = 'We\'ve got great deals on electronics, fashion and more. Try checking the Products page or looking for items with big % OFF badges.';
  } else if (text.includes('product') || text.includes('shop') || text.includes('buy') || text.includes('browse')) {
    response = 'You can browse all our products on the Products page, and add anything you like to your cart or wishlist.';
  } else if (text.includes('cart') || text.includes('basket')) {
    response = 'Your cart shows everything you\'ve added so far. Open the Cart page to review items or proceed to checkout.';
  } else if (text.includes('wishlist') || text.includes('favorite') || text.includes('saved')) {
    response = 'Your wishlist is where you can save items to decide later. Open the Wishlist page to see or manage them.';
  } else if (text.includes('ship') || text.includes('delivery')) {
    response = 'We offer fast delivery options and free shipping above a certain order value. Check the Shipping or Checkout information for details.';
  } else if (text.includes('return') || text.includes('refund')) {
    response = 'AIShop has a simple 30-day return approach. You can read the Returns/Refunds policy page for full details.';
  } else if (text.includes('help') || text.includes('support') || text.includes('contact')) {
    response = 'If you need help, you can use the Contact page to reach support, or ask me about products, deals, cart, or shipping.';
  }

  res.json({ response });
});


app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../AIShop', 'index.html'));
});


app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error' });
});


app.listen(PORT, () => {
  console.log(`
                     
 URL: http://localhost:${PORT}                        
  `);
});
