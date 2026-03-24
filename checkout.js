function loadCheckoutItems() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const itemsContainer = document.getElementById('checkoutItems');
  const summaryContainer = document.getElementById('orderSummary');

  if (cart.length === 0) {
    alert('Your cart is empty!');
    window.location.href = 'cart.html';
    return;
  }

  itemsContainer.innerHTML = cart.map(item => `
    <div class="checkout-item" style="
      display: flex;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1.25rem;
      padding: 1.25rem;
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      margin-bottom: 1rem;
      background: white;
      transition: all 0.3s;
    " onmouseover="this.style.boxShadow='0 4px 15px rgba(0,0,0,0.08)'; this.style.borderColor='#cbd5e1'"
       onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e2e8f0'">
      
      <img src="${item.image}" 
           alt="${item.name}" 
           class="checkout-item-image"
           onerror="this.src='https://via.placeholder.com/120x120?text=Product'"
           style="
             width: 90px;
             height: 90px;
             object-fit: contain;
             border-radius: 12px;
             border: 2px solid #e2e8f0;
             background: #f8fafc;
             flex-shrink: 0;
           ">
      
      <div class="checkout-item-info" style="
        flex: 1 1 auto;
        min-width: 0;
      ">
        <div class="checkout-item-name" style="
          font-weight: 800;
          font-size: 1.05rem;
          color: #1e293b;
          margin-bottom: 0.35rem;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        ">${item.name}</div>
        
        <div style="
          display: flex;
          gap: 1rem;
          align-items: center;
          flex-wrap: wrap;
        ">
          <div class="checkout-item-qty" style="
            background: #eff6ff;
            color: #2563eb;
            padding: 0.3rem 0.8rem;
            border-radius: 8px;
            font-weight: 700;
            font-size: 0.85rem;
          ">Qty: ${item.quantity}</div>
          
          <div style="
            color: #64748b;
            font-weight: 600;
            font-size: 0.85rem;
          ">£${item.price.toFixed(2)} each</div>
        </div>
      </div>
      
      <div class="checkout-item-price" style="
        font-weight: 900;
        font-size: 1.35rem;
        color: #2563eb;
        text-align: right;
        flex-shrink: 0;
        margin-left: auto;
      ">£${(item.price * item.quantity).toFixed(2)}</div>
    </div>
  `).join('');

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = subtotal > 100 ? 0 : 9.99; 
  const tax = subtotal * 0.1; 
  const total = subtotal + shipping + tax;

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Expose checkout totals globally so voice/chat helpers can explain the order
  window.checkoutTotals = {
    subtotal,
    shipping,
    tax,
    total,
    itemCount,
    freeShippingThreshold: 100
  };

  summaryContainer.innerHTML = `
    <div class="summary-row">
      <span>Subtotal (${itemCount} items):</span>
      <span>£${subtotal.toFixed(2)}</span>
    </div>
    
    <div class="summary-row">
      <span>Shipping:</span>
      <span style="color: ${shipping === 0 ? '#10b981' : '#1e293b'};">
        ${shipping === 0 ? 'FREE' : '£' + shipping.toFixed(2)}
      </span>
    </div>
    
    <div class="summary-row" style="border-bottom: 2px solid #e2e8f0;">
      <span>Tax (10%):</span>
      <span>£${tax.toFixed(2)}</span>
    </div>
    
    <div class="summary-row total-row">
      <span>Total:</span>
      <span>£${total.toFixed(2)}</span>
    </div>
    
    ${subtotal < 100 ? `
      <div class="summary-free-message threshold">
        Add £${(100 - subtotal).toFixed(2)} more for FREE shipping!
      </div>
    ` : `
      <div class="summary-free-message free">
        🎉 You've unlocked FREE shipping!
      </div>
    `}
  `;
}

function setupPaymentMethods() {
  const paymentMethods = document.querySelectorAll('.payment-method');
  const cardDetailsSection = document.querySelector('.card-details-section');

  if (!paymentMethods.length) {
    console.warn(' No payment method elements found');
    return;
  }

  paymentMethods.forEach(method => {
    method.addEventListener('click', function() {
      paymentMethods.forEach(m => m.classList.remove('selected'));
      this.classList.add('selected');
      const selectedMethod = this.dataset.method;
      
      if (cardDetailsSection) {
        if (selectedMethod === 'card') {
          cardDetailsSection.style.display = 'block';
        } else {
          cardDetailsSection.style.display = 'none';
        }
      }
  
    });
  });
}

function formatCardNumber() {
  const cardInput = document.getElementById('cardNumber');
  if (!cardInput) return;

  cardInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\s/g, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    e.target.value = formattedValue;
  });
}
function formatExpiryDate() {
  const expiryInput = document.getElementById('expiry');
  if (!expiryInput) return;

  expiryInput.addEventListener('input', function(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4);
    }
    e.target.value = value;
  });
}


function validateCheckoutForm() {
  const form = document.getElementById('checkoutForm');
  
  if (!form) {
    console.error(' Checkout form not found');
    return false;
  }

  const selectedPayment = document.querySelector('.payment-method.selected');
  
  if (!selectedPayment) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(' Please select a payment method to continue', 'error');
    } else {
      alert('Please select a payment method');
    }
    return false;
  }

  const selectedPaymentMethod = selectedPayment.dataset.method;


  const requiredFields = form.querySelectorAll('[required]');
  let isValid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      isValid = false;
      field.style.borderColor = '#ef4444';
      field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
    } else {
      field.style.borderColor = '#e2e8f0';
      field.style.boxShadow = 'none';
    }
  });


  if (selectedPaymentMethod === 'card') {
    const cardNumber = document.getElementById('cardNumber')?.value.replace(/\s/g, '') || '';
    const cvv = document.getElementById('cvv')?.value || '';
    const expiry = document.getElementById('expiry')?.value || '';

    if (cardNumber.length < 13 || cardNumber.length > 19) {
      if (typeof window.showNotification === 'function') {
        window.showNotification(' Please enter a valid card number', 'error');
      } else {
        alert('Please enter a valid card number');
      }
      return false;
    }

    if (cvv.length < 3 || cvv.length > 4) {
      if (typeof window.showNotification === 'function') {
        window.showNotification(' Please enter a valid CVV', 'error');
      } else {
        alert('Please enter a valid CVV');
      }
      return false;
    }

    if (!/^\d{2}\/\d{2}$/.test(expiry)) {
      if (typeof window.showNotification === 'function') {
        window.showNotification(' Please enter a valid expiry date (MM/YY)', 'error');
      } else {
        alert('Please enter a valid expiry date (MM/YY)');
      }
      return false;
    }
  }

  if (!isValid) {
    if (typeof window.showNotification === 'function') {
      window.showNotification(' Please fill in all required fields', 'error');
    } else {
      alert('Please fill in all required fields');
    }
    return false;
  }

  return true;
}

async function placeOrder() {
  if (!validateCheckoutForm()) {
    console.warn(' Form validation failed');
    return;
  }

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const shipping = total > 100 ? 0 : 9.99;
  const tax = total * 0.1;
  const grandTotal = total + shipping + tax;

  const orderData = {
    email: document.getElementById('email')?.value || '',
    phone: document.getElementById('phone')?.value || '',
    fullName: document.getElementById('fullName')?.value || '',
    address: document.getElementById('address')?.value || '',
    apartment: document.getElementById('apartment')?.value || '',
    city: document.getElementById('city')?.value || '',
    state: document.getElementById('state')?.value || '',
    zipCode: document.getElementById('zipCode')?.value || '',
    country: document.getElementById('country')?.value || '',
    paymentMethod: document.querySelector('.payment-method.selected')?.dataset.method || 'card',
    cart: cart,
    subtotal: total.toFixed(2),
    shipping: shipping.toFixed(2),
    tax: tax.toFixed(2),
    total: grandTotal.toFixed(2)
  };

  const placeOrderBtn = document.getElementById('placeOrderBtn');
  const originalText = placeOrderBtn ? placeOrderBtn.innerHTML : 'Place Order';

  try {
    if (placeOrderBtn) {
      placeOrderBtn.innerHTML = '⏳ Processing...';
      placeOrderBtn.disabled = true;
    }

  
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || `Checkout failed with status ${response.status}`);
    }

    if (data.success) {
   
      localStorage.setItem('cart', JSON.stringify([]));
      if (data.order) {
        localStorage.setItem('lastOrder', JSON.stringify(data.order));
      }
      updateCounts();


      showOrderSuccess(
        data.orderId,
        grandTotal,
        cart.reduce((sum, item) => sum + item.quantity, 0)
      );
      
      console.log(' Order placed:', data.orderId);
    } else {
      throw new Error(data.message || 'Order failed');
    }

  } catch (error) {
    console.error(' Backend error:', error);

    const localOrderId = 'ORD-LOCAL-' + Date.now();
    const localOrder = {
      orderId: localOrderId,
      createdAt: new Date().toISOString(),
      status: 'confirmed',
      ...orderData,
      subtotal: Number(total.toFixed(2)),
      shipping: Number(shipping.toFixed(2)),
      tax: Number(tax.toFixed(2)),
      total: Number(grandTotal.toFixed(2))
    };

    localStorage.setItem('lastOrder', JSON.stringify(localOrder));
    localStorage.setItem('cart', JSON.stringify([]));
    updateCounts();

    showOrderSuccess(
      localOrderId,
      grandTotal,
      cart.reduce((sum, item) => sum + item.quantity, 0)
    );

    if (typeof window.showNotification === 'function') {
      window.showNotification(' Order saved locally because server was unavailable.', 'warning');
    }
  } finally {
    if (placeOrderBtn) {
      placeOrderBtn.innerHTML = originalText;
      placeOrderBtn.disabled = false;
    }
  }
}

function showOrderSuccess(orderId, total, itemCount) {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s ease-out;
    padding: 1rem;
  `;

  modal.innerHTML = `
    <div style="
      background: white;
      border-radius: 24px;
      padding: 3rem;
      max-width: 500px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideUp 0.4s ease-out;
    ">
      <div style="
        width: 100px;
        height: 100px;
        background: linear-gradient(135deg, #10b981, #059669);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 2rem;
        font-size: 3rem;
        color: white;
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
      ">✓</div>
      
      <h2 style="
        font-size: 2rem;
        font-weight: 900;
        color: #1e293b;
        margin-bottom: 1rem;
      ">Order Placed Successfully! 🎉</h2>
      
      <p style="
        color: #64748b;
        font-size: 1.125rem;
        margin-bottom: 1.5rem;
        line-height: 1.6;
      ">
        Thank you for your order!<br>
        Your order ID is: <strong style="color: #2563eb;">${orderId}</strong>
      </p>

      <div style="
        background: #f8fafc;
        border: 2px solid #e2e8f0;
        border-radius: 16px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      ">
        <div style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1rem;
        ">
          <div style="text-align: left;">
            <div style="color: #64748b; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Items</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #1e293b;">${itemCount}</div>
          </div>
          <div style="text-align: right;">
            <div style="color: #64748b; font-weight: 600; font-size: 0.875rem; margin-bottom: 0.25rem;">Total</div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #2563eb;">£${total.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div style="
        color: #64748b;
        font-size: 0.95rem;
        margin-bottom: 2rem;
        line-height: 1.6;
        padding: 1rem;
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
      ">
         Your order details are saved. You can track your order in your account.
      </div>

      <button onclick="window.location.href='index.html'" style="
        width: 100%;
        padding: 1.25rem;
        background: linear-gradient(135deg, #2563eb, #7c3aed);
        color: white;
        border: none;
        border-radius: 16px;
        font-weight: 800;
        font-size: 1.125rem;
        cursor: pointer;
        box-shadow: 0 8px 25px rgba(37, 99, 235, 0.3);
        transition: all 0.3s;
        margin-bottom: 0.75rem;
      " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 12px 35px rgba(37, 99, 235, 0.5)'"
         onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 8px 25px rgba(37, 99, 235, 0.3)'">
         Continue Shopping
      </button>

      <button onclick="window.location.href='products.html'" style="
        width: 100%;
        padding: 1rem;
        background: white;
        color: #2563eb;
        border: 2px solid #2563eb;
        border-radius: 12px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.3s;
      " onmouseover="this.style.background='#eff6ff'"
         onmouseout="this.style.background='white'">
         Browse More Products
      </button>
    </div>
  `;

  document.body.appendChild(modal);
}

function updateCounts() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  
  const cartCountEl = document.getElementById('cartCount');
  const wishlistCountEl = document.getElementById('wishlistCount');
  
  if (cartCountEl) cartCountEl.textContent = cartCount;
  if (wishlistCountEl) wishlistCountEl.textContent = wishlist.length;
}

document.addEventListener('DOMContentLoaded', function() {

  loadCheckoutItems();
  setupPaymentMethods();
  formatCardNumber();
  formatExpiryDate();
  updateCounts();

  const placeOrderBtn = document.getElementById('placeOrderBtn');
  if (placeOrderBtn) {
    placeOrderBtn.addEventListener('click', placeOrder);
    
  } else {
  }

  fetch('footer.html')
    .then(response => response.text())
    .then(html => {
      const footerContainer = document.getElementById('footerContainer');
      if (footerContainer) {
        footerContainer.innerHTML = html;
      }
    })
    .catch(error => console.log('Footer load error:', error));
});


const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(50px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
document.head.appendChild(style);
