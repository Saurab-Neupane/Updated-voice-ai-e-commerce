function createHeader(activePage = 'home') {
  const headerHTML = `
    <header class="main-header">
      <div class="logo" onclick="window.location.href='index.html'">🛍️ AIShop</div>

      <nav class="nav-links">
        <a href="index.html" class="${activePage === 'home' ? 'active' : ''}">Home</a>
        <a href="products.html" class="${activePage === 'products' ? 'active' : ''}">Products</a>
        <a href="cart.html" class="${activePage === 'cart' ? 'active' : ''}">Cart</a>
        <a href="wishlist.html" class="${activePage === 'wishlist' ? 'active' : ''}">Wishlist</a>
        <a href="about.html" class="${activePage === 'about' ? 'active' : ''}">About</a>
        <a href="contact.html" class="${activePage === 'contact' ? 'active' : ''}">Contact</a>
      </nav>

      <div class="header-icons">
        <!-- Theme Toggle -->
        <button class="header-icon-btn" id="themeToggle" title="Change Theme">
          <span style="font-size: 1.3rem;">Theme</span>
        </button>
        
        <button class="header-icon-btn" id="voiceBtn" title="Voice AI">
          Voice
        </button>
        
        <button class="header-icon-btn" onclick="window.location.href='wishlist.html'" title="Wishlist">
          Wishlist <span class="badge" id="wishlistCount">0</span>
        </button>
        
        <button class="header-icon-btn" onclick="window.location.href='cart.html'" title="Cart">
          Cart <span class="badge" id="cartCount">0</span>
        </button>
      </div>
    </header>
  `;

  
  document.body.insertAdjacentHTML('afterbegin', headerHTML);


  updateHeaderCounts();


  setTimeout(() => {
    setupHeaderEventListeners();
  }, 100);
}

function updateHeaderCounts() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
  
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartBadge = document.getElementById('cartCount');
  const wishlistBadge = document.getElementById('wishlistCount');
  
  if (cartBadge) cartBadge.textContent = cartCount;
  if (wishlistBadge) wishlistBadge.textContent = wishlist.length;
}

function setupHeaderEventListeners() {

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn && typeof cycleTheme === 'function') {
    themeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      cycleTheme();
    });

  }

  const voiceBtn = document.getElementById('voiceBtn');
  if (voiceBtn && typeof startVoice === 'function') {
    voiceBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startVoice();
    });

  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {

    if (!document.querySelector('.main-header')) {
      createHeader();
    }
  });
} else {
  if (!document.querySelector('.main-header')) {
    createHeader();
  }
}
window.createHeader = createHeader;
window.updateHeaderCounts = updateHeaderCounts;

