(function initSiteEnhancements() {
  const path = (window.location.pathname || "/").toLowerCase();

  function ensureMeta(attr, key, value) {
    if (!value) return;
    let el = document.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", value);
  }

  function injectBaseMeta() {
    ensureMeta("name", "theme-color", "#2563eb");
    ensureMeta("property", "og:site_name", "AIShop");
    ensureMeta("property", "og:locale", "en_GB");
    ensureMeta("name", "twitter:card", "summary_large_image");
  }

  function injectStructuredData() {
    const existing = document.querySelector('script[data-enhanced-schema="1"]');
    if (existing) return;

    const schemas = [];
    const isHome = path === "/" || path.endsWith("/index.html");
    const isProducts = path.endsWith("/products.html");
    const isAbout = path.endsWith("/about.html");
    const isContact = path.endsWith("/contact.html");

    if (isHome) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AIShop",
        url: "https://aishop.com/",
        potentialAction: {
          "@type": "SearchAction",
          target: "https://aishop.com/products.html?search={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      });

      schemas.push({
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "AIShop",
        url: "https://aishop.com/",
        logo: "https://aishop.com/assets/logo.png",
        sameAs: [
          "https://www.facebook.com",
          "https://www.instagram.com",
          "https://www.linkedin.com"
        ]
      });
    }

    if (isProducts) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "AIShop Products",
        url: "https://aishop.com/products.html",
        description: "Browse AIShop products in electronics, fashion, shoes, bags, and home."
      });
    }

    if (isAbout) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "About AIShop",
        url: "https://aishop.com/about.html"
      });
    }

    if (isContact) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Contact AIShop",
        url: "https://aishop.com/contact.html"
      });
    }

    if (!schemas.length) return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.enhancedSchema = "1";
    script.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : schemas);
    document.head.appendChild(script);
  }

  function ensureMainTarget() {
    if (!document.querySelector("#main-content")) {
      const preferred = document.querySelector("main") ||
        document.querySelector(".main-content") ||
        document.querySelector(".content") ||
        document.querySelector(".products-section") ||
        document.querySelector(".checkout-container") ||
        document.querySelector(".cart-container");
      if (preferred) preferred.id = "main-content";
    }
  }

  function ensureSkipLink() {
    if (document.querySelector(".skip-link")) return;
    const target = document.querySelector("#main-content");
    if (!target) return;
    const a = document.createElement("a");
    a.className = "skip-link";
    a.href = "#main-content";
    a.textContent = "Skip to content";
    document.body.insertBefore(a, document.body.firstChild);
  }

  function optimizeMediaLoading() {
    const images = Array.from(document.querySelectorAll("img"));
    images.forEach((img, idx) => {
      if (!img.getAttribute("decoding")) img.setAttribute("decoding", "async");
      if (!img.getAttribute("loading")) img.setAttribute("loading", idx < 2 ? "eager" : "lazy");
      if (idx === 0 && !img.getAttribute("fetchpriority")) img.setAttribute("fetchpriority", "high");
    });
  }

  function enhanceNavA11y() {
    const links = Array.from(document.querySelectorAll(".nav-links a[href]"));
    if (!links.length) return;
    const normalized = path.replace(/\/+$/, "");
    links.forEach(link => {
      const href = (link.getAttribute("href") || "").toLowerCase();
      if (!href) return;
      const linkPath = href.startsWith("http")
        ? new URL(href).pathname.toLowerCase().replace(/\/+$/, "")
        : "/" + href.replace(/^\//, "").replace(/\/+$/, "");
      if (
        normalized.endsWith(linkPath) ||
        (normalized === "" && (linkPath === "/index.html" || linkPath === "/"))
      ) {
        link.setAttribute("aria-current", "page");
      }
    });
  }

  function setupScrollReveal() {
    const selectors = [
      "section",
      ".product-card",
      ".value-card",
      ".team-card",
      ".checkout-item",
      ".info-section",
      ".cart-items",
      ".order-summary",
      ".contact-card"
    ];

    const nodes = Array.from(document.querySelectorAll(selectors.join(",")))
      .filter((el, idx) => idx < 80 && !el.classList.contains("reveal-on-scroll"));

    if (!nodes.length || !("IntersectionObserver" in window)) return;
    nodes.forEach(el => el.classList.add("reveal-on-scroll"));

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    nodes.forEach(el => observer.observe(el));
  }

  document.addEventListener("DOMContentLoaded", function onReady() {
    injectBaseMeta();
    injectStructuredData();
    ensureMainTarget();
    ensureSkipLink();
    optimizeMediaLoading();
    enhanceNavA11y();
    setupScrollReveal();
  });
})();
