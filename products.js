const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Get all products
router.get('/', (req, res) => {
  try {
    const productsPath = path.join(__dirname, '../db/products.json');
    
    if (!fs.existsSync(productsPath)) {
      // If no products.json, return sample data
      return res.json([
        {
          id: 1,
          name: 'Premium Sneakers',
          price: 129.99,
          category: 'shoes',
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
          description: 'Comfortable and stylish sneakers',
          rating: 4.5,
          discount: 20
        },
        {
          id: 2,
          name: 'Designer Handbag',
          price: 299.99,
          category: 'bags',
          image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3',
          description: 'Luxury designer handbag',
          rating: 4.8,
          discount: 15
        }
      ]);
    }

    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products || [];
    res.json(products);
  } catch (error) {
    console.error('Error reading products:', error);
    res.status(500).json({ error: 'Failed to load products', message: error.message });
  }
});

// Get single product by ID
router.get('/:id', (req, res) => {
  try {
    const productsPath = path.join(__dirname, '../db/products.json');
    
    if (!fs.existsSync(productsPath)) {
      return res.status(404).json({ error: 'Products not found' });
    }

    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products || [];
    
    const product = products.find(p => p.id === parseInt(req.params.id));
    
    if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: 'Product not found' });
    }
  } catch (error) {
    console.error('Error reading product:', error);
    res.status(500).json({ error: 'Failed to load product', message: error.message });
  }
});

// Search products
router.get('/search/:query', (req, res) => {
  try {
    const productsPath = path.join(__dirname, '../db/products.json');
    
    if (!fs.existsSync(productsPath)) {
      return res.json([]);
    }

    const productsData = fs.readFileSync(productsPath, 'utf8');
    const data = JSON.parse(productsData);
    const products = Array.isArray(data) ? data : data.products || [];
    
    const query = req.params.query.toLowerCase();
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.description && p.description.toLowerCase().includes(query)) ||
      (p.category && p.category.toLowerCase().includes(query)) ||
      (p.brand && p.brand.toLowerCase().includes(query))
    );
    
    res.json(filtered);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Failed to search products', message: error.message });
  }
});

// Product Loading and Display

let allProducts = [];
let filteredProducts = [];

async function loadProducts() {
  try {
    // Try loading from server first
    const response = await fetch('http://localhost:3000/api/products');
    if (response.ok) {
      const data = await response.json();
      allProducts = Array.isArray(data) ? data : data.products || [];
    } else {
      throw new Error('Server not available');
    }
  } catch (error) {
    console.log('Loading from local data...');
    // Fallback to local products
    allProducts = [
      {
        id: 1,
        name: "Premium Sneakers",
        price: 129.99,
        category: "shoes",
        brand: "Nike",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
        description: "Comfortable and stylish premium sneakers",
        rating: 4.5,
        reviews: 128,
        discount: 20,
        inStock: true
      },
      {
        id: 2,
        name: "Designer Handbag",
        price: 299.99,
        category: "bags",
        brand: "Gucci",
        image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400",
        description: "Luxury designer handbag",
        rating: 4.8,
        reviews: 89,
        discount: 15,
        inStock: true
      },
      {
        id: 3,
        name: "Smart Watch",
        price: 199.99,
        category: "accessories",
        brand: "Apple",
        image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400",
        description: "Smart watch with fitness tracking",
        rating: 4.7,
        reviews: 256,
        discount: 10,
        inStock: true
      },
      {
        id: 4,
        name: "Running Shoes",
        price: 89.99,
        category: "shoes",
        brand: "Adidas",
        image: "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400",
        description: "Lightweight running shoes",
        rating: 4.6,
        reviews: 178,
        discount: 25,
        inStock: true
      },
      {
        id: 5,
        name: "Leather Backpack",
        price: 149.99,
        category: "bags",
        brand: "Herschel",
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400",
        description: "Stylish leather backpack",
        rating: 4.4,
        reviews: 92,
        discount: 0,
        inStock: true
      },
      {
        id: 6,
        name: "Wireless Earbuds",
        price: 179.99,
        category: "accessories",
        brand: "Sony",
        image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400",
        description: "Premium wireless earbuds",
        rating: 4.6,
        reviews: 342,
        discount: 5,
        inStock: true
      }
    ];
  }
  
  filteredProducts = [...allProducts];
  displayProducts();
  updateProductCount();
}

function displayProducts() {
  const container = document.getElementById('productsContainer');
  if (!container) return;
  
  if (filteredProducts.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem;">
        <h2 style="font-size: 2rem; margin-bottom: 1rem;">😔 No products found</h2>
        <p style="color: var(--text-muted);">Try adjusting your filters or search</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredProducts.map(product => `
    <div class="product-card" data-id="${product.id}">
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='https://via.placeholder.com/400'" />
        ${product.discount > 0 ? `<span class="discount-badge">-${product.discount}%</span>` : ''}
        <button class="wishlist-btn" onclick="toggleWishlist(${product.id})" title="Add to Wishlist">
          <span>❤️</span>
        </button>
      </div>
      <div class="product-info">
        <span class="product-brand">${product.brand || 'Brand'}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-description">${product.description || ''}</p>
        <div class="product-rating">
          <span class="stars">${'⭐'.repeat(Math.floor(product.rating))}${product.rating % 1 ? '½' : ''}</span>
          <span class="rating-text">${product.rating} (${product.reviews || 0} reviews)</span>
        </div>
        <div class="product-price">
          ${product.discount > 0 ? `
            <span class="original-price">$${product.price.toFixed(2)}</span>
            <span class="discounted-price">$${(product.price * (1 - product.discount / 100)).toFixed(2)}</span>
          ` : `
            <span class="current-price">$${product.price.toFixed(2)}</span>
          `}
        </div>
        <button class="add-to-cart-btn" onclick="addToCart(${product.id})">
          <span>🛒</span> Add to Cart
        </button>
      </div>
    </div>
  `).join('');
}

function updateProductCount() {
  const countEl = document.getElementById('productCount');
  if (countEl) {
    countEl.textContent = `${filteredProducts.length} Products`;
  }
}

// Pagination

let currentPage = 1;
const itemsPerPage = 12;
let totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

function displayPagination() {
  const container = document.getElementById('paginationButtons');
  const maxButtons = window.innerWidth <= 768 ? 3 : 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  let html = '';

  // Previous button
  html += `
    <button class="pagination-btn" 
            onclick="goToPage(${currentPage - 1})" 
            ${currentPage === 1 ? 'disabled' : ''} 
            aria-label="Previous page"
            title="Previous page">
      <span>←</span> Prev
    </button>
  `;

  // First page
  if (startPage > 1) {
    html += `
      <button class="pagination-btn page-number" 
              onclick="goToPage(1)" 
              aria-label="Page 1"
              title="Go to page 1">
        1
      </button>
    `;
    if (startPage > 2) {
      html += `<span class="pagination-ellipsis" aria-hidden="true">⋯</span>`;
    }
  }

  // Page numbers
  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button class="pagination-btn page-number ${i === currentPage ? 'active' : ''}" 
              onclick="goToPage(${i})"
              aria-label="Page ${i}"
              title="Go to page ${i}"
              ${i === currentPage ? 'aria-current="page"' : ''}>
        ${i}
      </button>
    `;
  }

  // Last page
  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="pagination-ellipsis" aria-hidden="true">⋯</span>`;
    }
    html += `
      <button class="pagination-btn page-number" 
              onclick="goToPage(${totalPages})" 
              aria-label="Page ${totalPages}"
              title="Go to page ${totalPages}">
        ${totalPages}
      </button>
    `;
  }

  // Next button
  html += `
    <button class="pagination-btn" 
            onclick="goToPage(${currentPage + 1})" 
            ${currentPage === totalPages ? 'disabled' : ''}
            aria-label="Next page"
            title="Next page">
      Next <span>→</span>
    </button>
  `;

  container.innerHTML = html;
}

function goToPage(page) {
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  displayProducts();
  displayPagination();
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadProducts);
} else {
  loadProducts();
}

module.exports = router;
