let customTheme = null;
try {
  const saved = localStorage.getItem('customTheme');
  if (saved) {
    customTheme = JSON.parse(saved);
  }
} catch (e) {
  console.warn('Failed to load custom theme, falling back to default.', e);
}



function applyTheme(theme) {
  const styles = typeof theme === 'string' ? theme : theme;
  document.body.style.background = styles.background;
  document.body.style.color = styles.textPrimary;


  const headers = document.querySelectorAll('.main-header');
  headers.forEach(header => {
    header.style.background = styles.headerBg;
    header.style.borderColor = styles.headerBorder;
  });


  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    if (!link.classList.contains('active')) {
      link.style.color = styles.navLinkColor;
    }
  });

  
  const cards = document.querySelectorAll('.product-card, .cart-item, .wishlist-item, .category-card, .feature-box, .testimonial-card, .order-summary, .checkout-form');
  cards.forEach(card => {
    card.style.background = styles.cardBg;
    card.style.borderColor = styles.border;
    card.style.color = styles.textPrimary;
  });

  
  const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div');
  textElements.forEach(el => {
    if (!el.style.color || el.style.color === '') {
      el.style.color = styles.textPrimary;
    }
  });


  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.style.background = styles.inputBg;
    input.style.color = styles.textPrimary;
    input.style.borderColor = styles.border;
  });

  
  const categoryPills = document.querySelectorAll('.category-pill');
  categoryPills.forEach(pill => {
    if (!pill.classList.contains('active')) {
      pill.style.background = styles.cardBg;
      pill.style.color = styles.textSecondary;
      pill.style.borderColor = styles.border;
    }
  });


  const filters = document.querySelectorAll('.filters-row, .search-box');
  filters.forEach(filter => {
    filter.style.background = styles.cardBg;
    filter.style.borderColor = styles.border;
  });
  // Update theme button icon/label if a span exists
  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    const iconSpan = themeBtn.querySelector('span');
    if (iconSpan) {
      iconSpan.textContent = styles.icon;
    }
  }

  // Update page headers
  const pageHeaders = document.querySelectorAll('.page-header, .hero-section');
  pageHeaders.forEach(header => {
    const gradient = theme === 'light' 
      ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
      : `linear-gradient(135deg, ${styles.inputBg} 0%, ${styles.cardBg} 100%)`;
    header.style.background = gradient;
    header.style.borderColor = styles.border;
  });

}

function cycleTheme() {
  // Open the custom palette editor instead of cycling through fixed themes
  openThemeCustomizer();
}

function showThemeNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: linear-gradient(135deg, #2563eb, #7c3aed);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
    font-weight: 700;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 2000);
}


function openThemeCustomizer() {
  if (document.getElementById('themeCustomizerPanel')) {
    return;
  }

  const panel = document.createElement('div');
  panel.id = 'themeCustomizerPanel';
  panel.style.cssText = `
    position: fixed;
    bottom: 90px;
    right: 20px;
    width: 320px;
    background: #0f172a;
    color: #f9fafb;
    border-radius: 16px;
    padding: 1rem 1.1rem 0.9rem;
    box-shadow: 0 16px 48px rgba(15, 23, 42, 0.6);
    z-index: 11000;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  `;

  const base = customTheme || {
    background: '#f8fafc',
    headerBg: '#ffffff',
    cardBg: '#ffffff',
    textPrimary: '#1e293b',
    textSecondary: '#64748b',
    navLinkActiveColor: '#2563eb'
  };

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
      <div style="font-weight:700;font-size:0.95rem;display:flex;align-items:center;gap:0.4rem;">
        <span>🎨</span><span>Custom theme</span>
      </div>
      <button type="button" id="themeCustomizerClose" style="background:none;border:none;color:#94a3b8;font-size:1rem;cursor:pointer;">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem 0.75rem;font-size:0.8rem;margin-bottom:0.75rem;">
      <label>Background
        <input type="color" id="themeBgColor" value="${base.background}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
      <label>Header
        <input type="color" id="themeHeaderColor" value="${base.headerBg}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
      <label>Cards
        <input type="color" id="themeCardColor" value="${base.cardBg}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
      <label>Text
        <input type="color" id="themeTextColor" value="${base.textPrimary}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
      <label>Muted text
        <input type="color" id="themeMutedTextColor" value="${base.textSecondary}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
      <label>Accent
        <input type="color" id="themeAccentColor" value="${base.navLinkActiveColor}" style="width:100%;height:28px;border:none;background:transparent;cursor:pointer;" />
      </label>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:0.25rem;">
      <button type="button" id="themeCustomizerReset" style="background:none;border:1px solid #4b5563;color:#e5e7eb;padding:0.4rem 0.7rem;border-radius:999px;font-size:0.75rem;cursor:pointer;">Reset</button>
      <button type="button" id="themeCustomizerSave" style="background:#22c55e;border:none;color:#022c22;padding:0.4rem 0.9rem;border-radius:999px;font-size:0.8rem;font-weight:700;cursor:pointer;">Use these colors</button>
    </div>
  `;

  document.body.appendChild(panel);

  const close = () => {
    if (panel && panel.parentNode) {
      panel.parentNode.removeChild(panel);
    }
  };

  document.getElementById('themeCustomizerClose').onclick = close;

  document.getElementById('themeCustomizerReset').onclick = () => {
    localStorage.removeItem('customTheme');
    customTheme = null;
    applyTheme({});
    close();
  };

  document.getElementById('themeCustomizerSave').onclick = () => {
    const bg = document.getElementById('themeBgColor').value || '#f8fafc';
    const header = document.getElementById('themeHeaderColor').value || '#ffffff';
    const card = document.getElementById('themeCardColor').value || '#ffffff';
    const text = document.getElementById('themeTextColor').value || '#1e293b';
    const muted = document.getElementById('themeMutedTextColor').value || '#64748b';
    const accent = document.getElementById('themeAccentColor').value || '#2563eb';

    customTheme = {
      name: 'Custom',
      icon: '🎨',
      background: bg,
      headerBg: header,
      headerBorder: header,
      cardBg: card,
      textPrimary: text,
      textSecondary: muted,
      border: accent,
      inputBg: card,
      navLinkColor: muted,
      navLinkActiveColor: accent
    };

    localStorage.setItem('customTheme', JSON.stringify(customTheme));
    applyTheme(customTheme);
    showThemeNotification('🎨 Your custom colors are now applied');
    close();
  };
}


document.addEventListener('DOMContentLoaded', () => {
  if (customTheme) {
    applyTheme(customTheme);
  }
});


if (document.readyState !== 'loading') {
  if (customTheme) {
    applyTheme(customTheme);
  }
}