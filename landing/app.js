/**
 * FerriVault Landing Page — Pure Vanilla ES6 JavaScript
 * Zero external runtime dependencies.
 */

const MOCK_VAULT_ITEMS = [
  {
    id: "github-ent",
    name: "GitHub Enterprise",
    subtitle: "victor@ferrivault.app",
    category: "login",
    favorite: true,
    folder: "Development",
    badge: "Login • Organization",
    avatarBg: "linear-gradient(135deg, #1e293b, #334155)",
    avatarText: "GH",
    username: "victor@ferrivault.app",
    password: "fv!9K#mP2$vL8@nQ4_xR7",
    uri: "https://github.com/ferrivault",
    totpBase: "482 910",
    notes: "Hardware security key + TOTP backup enabled. Scoped to FerriVault org.",
  },
  {
    id: "cloudflare-prod",
    name: "Cloudflare Zero Trust",
    subtitle: "infra-admin@ferrivault.app",
    category: "login",
    favorite: true,
    folder: "Cloud Infra",
    badge: "Login • 2FA Active",
    avatarBg: "linear-gradient(135deg, #ea580c, #f97316)",
    avatarText: "CF",
    username: "infra-admin@ferrivault.app",
    password: "Cf_Prod#8821!Oxide99$z",
    uri: "https://dash.cloudflare.com",
    totpBase: "719 304",
    notes: "DNS & HSTS preload management for ferrivault.app.",
  },
  {
    id: "proton-vault",
    name: "ProtonMail Bridge",
    subtitle: "security@ferrivault.app",
    category: "login",
    favorite: false,
    folder: "Development",
    badge: "Login • Personal",
    avatarBg: "linear-gradient(135deg, #6d28d9, #8b5cf6)",
    avatarText: "PM",
    username: "security@ferrivault.app",
    password: "Pm$4410_Zeroize!OnDrop",
    uri: "https://mail.proton.me",
    totpBase: "105 842",
    notes: "PGP key fingerprint verified in local keychain.",
  },
  {
    id: "stripe-corp-card",
    name: "Stripe Corporate Visa",
    subtitle: "•••• •••• •••• 8492",
    category: "card",
    favorite: true,
    folder: "Finance",
    badge: "Payment Card • Visa",
    avatarBg: "linear-gradient(135deg, #059669, #10b981)",
    avatarText: "VI",
    username: "VICTOR GUARDIOLA",
    password: "4532 •••• •••• 8492  (CVV: 941)",
    uri: "Exp: 09 / 2029",
    totpBase: null,
    notes: "Dedicated card for build runners, code signing certificates, and domain renewals.",
  },
  {
    id: "rust-release-key",
    name: "Tauri Updater Signing Key",
    subtitle: "Minisign / Ed25519 Private Note",
    category: "note",
    favorite: false,
    folder: "Cloud Infra",
    badge: "Secure Note • Ed25519",
    avatarBg: "linear-gradient(135deg, #2563eb, #3b82f6)",
    avatarText: "RS",
    username: "TAURI_SIGNING_PRIVATE_KEY",
    password: "RWQf6L9x... [Encrypted EncString Type 2]",
    uri: "app.ferrivault.desktop",
    totpBase: null,
    notes: "Used by GitHub Actions release workflow to sign Linux AppImage, Flatpak, macOS DMG, and Windows MSI bundles.",
  },
];

const DICEWARE_WORDS = [
  "ferrum", "cobalt", "cipher", "shield", "anvil", "quantum",
  "harbor", "velvet", "granite", "beacon", "falcon", "obsidian",
  "tundra", "vertex", "prism", "ember", "glacier", "zenith",
  "carapace", "bastion", "nebula", "vortex", "anchor", "quartz",
];

document.addEventListener("DOMContentLoaded", () => {
  initToastSystem();
  initThemeSwitcher();
  initOsDownloadDetector();
  initMockVaultSimulator();
  initHeroShowcaseToggle();
  initAccessibleTabs();
  initLivePasswordGenerator();
  initScrollAnimationFallbacks();
});

/* ==========================================================================
   Toast Notification Helper
   ========================================================================== */
let toastTimeoutId = null;
function showLandingToast(message) {
  const toast = document.getElementById("landing-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  if (toastTimeoutId) clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3200);
}

function initToastSystem() {
  document.querySelectorAll("[data-copy-text]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.getAttribute("data-copy-text") || "";
      if (navigator.clipboard && text) {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      showLandingToast(`Copied "${text}" to clipboard`);
    });
  });
}

/* ==========================================================================
   Live Theme Switcher (Syncs Landing Page + App Preview)
   ========================================================================== */
function initThemeSwitcher() {
  const selectors = document.querySelectorAll("[data-theme-selector]");
  selectors.forEach((select) => {
    select.addEventListener("change", (e) => {
      const themeId = e.target.value;
      applyTheme(themeId);
      selectors.forEach((other) => {
        if (other !== e.target) other.value = themeId;
      });
    });
  });

  document.querySelectorAll("[data-theme-preset]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const themeId = btn.getAttribute("data-theme-preset");
      if (!themeId) return;
      applyTheme(themeId);
      selectors.forEach((s) => {
        s.value = themeId;
      });
    });
  });
}

function applyTheme(themeId) {
  const root = document.documentElement;
  if (themeId === "ferrivault-dark") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", themeId);
  }
  showLandingToast(`Applied theme: ${themeId}`);
}

/* ==========================================================================
   Automatic OS Detection for Primary Download CTA
   ========================================================================== */
function initOsDownloadDetector() {
  const labelEl = document.getElementById("primary-os-label");
  if (!labelEl) return;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("linux")) {
    labelEl.textContent = "Download for Linux (.AppImage / .deb)";
  } else if (ua.includes("mac")) {
    labelEl.textContent = "Download for macOS (Universal .dmg)";
  } else if (ua.includes("win")) {
    labelEl.textContent = "Download for Windows (.msi)";
  }
}

/* ==========================================================================
   Hero Showcase Mode Switcher (Interactive Simulator vs Screenshots Gallery)
   ========================================================================== */
function initHeroShowcaseToggle() {
  const modeButtons = document.querySelectorAll("[data-showcase-mode]");
  const simulatorView = document.getElementById("showcase-simulator-view");
  const galleryView = document.getElementById("showcase-gallery-view");
  if (!simulatorView || !galleryView) return;

  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-showcase-mode");
      modeButtons.forEach((b) =>
        b.setAttribute("aria-pressed", String(b === btn))
      );
      if (mode === "gallery") {
        simulatorView.hidden = true;
        galleryView.hidden = false;
      } else {
        simulatorView.hidden = false;
        galleryView.hidden = true;
      }
    });
  });
}

/* ==========================================================================
   Interactive 3-Pane Mock Vault Simulator
   ========================================================================== */
function initMockVaultSimulator() {
  let activeFilter = "all";
  let searchQuery = "";
  let selectedId = MOCK_VAULT_ITEMS[0].id;
  let passwordRevealed = false;
  let totpSeconds = 24;

  const listContainer = document.getElementById("mock-cipher-list");
  const searchInput = document.getElementById("mock-search-input");
  const filterButtons = document.querySelectorAll("[data-vault-filter]");

  const detailTitle = document.getElementById("mock-detail-title");
  const detailBadge = document.getElementById("mock-detail-badge");
  const detailAvatar = document.getElementById("mock-detail-avatar");
  const detailUsername = document.getElementById("mock-detail-username");
  const detailPassword = document.getElementById("mock-detail-password");
  const detailUri = document.getElementById("mock-detail-uri");
  const detailNotes = document.getElementById("mock-detail-notes");
  const totpContainer = document.getElementById("mock-totp-box");
  const totpCodeEl = document.getElementById("mock-totp-code");
  const totpTimerEl = document.getElementById("mock-totp-timer");
  const togglePassBtn = document.getElementById("mock-toggle-pass");
  const copyUserBtn = document.getElementById("mock-copy-user");
  const copyPassBtn = document.getElementById("mock-copy-pass");
  const copyTotpBtn = document.getElementById("mock-copy-totp");

  if (!listContainer || !detailTitle) return;

  function getFilteredItems() {
    return MOCK_VAULT_ITEMS.filter((item) => {
      if (activeFilter === "favorites" && !item.favorite) return false;
      if (
        ["login", "card", "note"].includes(activeFilter) &&
        item.category !== activeFilter
      ) {
        return false;
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.folder.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }

  function renderList() {
    const items = getFilteredItems();
    listContainer.innerHTML = "";

    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.style.padding = "1.5rem 1rem";
      empty.style.color = "var(--text-muted)";
      empty.style.fontSize = "0.84rem";
      empty.style.textAlign = "center";
      empty.textContent = "No matching vault items";
      listContainer.appendChild(empty);
      return;
    }

    if (!items.some((i) => i.id === selectedId)) {
      selectedId = items[0].id;
    }

    items.forEach((item) => {
      const row = document.createElement("button");
      row.type = "button";
      row.className = `mock-cipher-row ${item.id === selectedId ? "selected" : ""}`;
      row.innerHTML = `
        <div class="cipher-avatar" style="background: ${item.avatarBg}">${item.avatarText}</div>
        <div class="cipher-row-meta">
          <div class="cipher-row-title">${item.name}</div>
          <div class="cipher-row-sub">${item.subtitle}</div>
        </div>
      `;
      row.addEventListener("click", () => {
        selectedId = item.id;
        passwordRevealed = false;
        renderList();
        renderDetail();
      });
      listContainer.appendChild(row);
    });
  }

  function renderDetail() {
    const item =
      MOCK_VAULT_ITEMS.find((i) => i.id === selectedId) || MOCK_VAULT_ITEMS[0];

    detailTitle.textContent = item.name;
    detailBadge.textContent = item.badge;
    detailAvatar.textContent = item.avatarText;
    detailAvatar.style.background = item.avatarBg;
    detailUsername.textContent = item.username;
    detailPassword.textContent = passwordRevealed
      ? item.password
      : "••••••••••••••••••••";
    if (togglePassBtn) {
      togglePassBtn.textContent = passwordRevealed ? "Hide" : "Reveal";
    }
    detailUri.textContent = item.uri;
    detailNotes.textContent = item.notes;

    if (item.totpBase) {
      totpContainer.hidden = false;
      totpCodeEl.textContent = item.totpBase;
    } else {
      totpContainer.hidden = true;
    }
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      activeFilter = btn.getAttribute("data-vault-filter") || "all";
      filterButtons.forEach((b) => b.classList.toggle("active", b === btn));
      renderList();
      renderDetail();
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value;
      renderList();
      renderDetail();
    });
  }

  if (togglePassBtn) {
    togglePassBtn.addEventListener("click", () => {
      passwordRevealed = !passwordRevealed;
      renderDetail();
    });
  }

  if (copyUserBtn) {
    copyUserBtn.addEventListener("click", () => {
      const item = MOCK_VAULT_ITEMS.find((i) => i.id === selectedId);
      if (item) {
        showLandingToast(`Username "${item.username}" copied (auto-clears in 30s)`);
      }
    });
  }

  if (copyPassBtn) {
    copyPassBtn.addEventListener("click", () => {
      showLandingToast("Password copied via Rust arboard engine (auto-clears in 30s)");
    });
  }

  if (copyTotpBtn) {
    copyTotpBtn.addEventListener("click", () => {
      const code = totpCodeEl ? totpCodeEl.textContent : "482 910";
      showLandingToast(`TOTP code ${code} copied to clipboard`);
    });
  }

  // Live RFC-6238 countdown simulation
  setInterval(() => {
    totpSeconds -= 1;
    if (totpSeconds <= 0) {
      totpSeconds = 30;
      MOCK_VAULT_ITEMS.forEach((it) => {
        if (it.totpBase) {
          const p1 = String(Math.floor(100 + Math.random() * 900));
          const p2 = String(Math.floor(100 + Math.random() * 900));
          it.totpBase = `${p1} ${p2}`;
        }
      });
      renderDetail();
    }
    if (totpTimerEl) {
      totpTimerEl.textContent = `${totpSeconds}s`;
    }
  }, 1000);

  renderList();
  renderDetail();
}

/* ==========================================================================
   Accessible Tabs (Follows modern-web-guidance `tabs` specification)
   ========================================================================== */
function initAccessibleTabs() {
  const tablist = document.querySelector('[focusgroup*="tablist"]');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('[role="tab"], button'));
  const panels = tabs
    .map((tab) =>
      document.querySelector(`[ role="tabpanel"][aria-labelledby="${tab.id}"]`)
    )
    .filter(Boolean);

  function selectTab(selectedTab) {
    for (const tab of tabs) {
      const isSelected = tab === selectedTab;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.toggleAttribute("focusgroupstart", isSelected);
    }

    for (const panel of panels) {
      const isMatch =
        panel.getAttribute("aria-labelledby") === selectedTab.id;
      if (isMatch) {
        panel.removeAttribute("hidden");
        panel.setAttribute("tabindex", "0");
      } else {
        panel.setAttribute("hidden", "until-found");
        panel.removeAttribute("tabindex");
      }
    }

    selectedTab.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      container: "nearest",
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab));
    tab.addEventListener("focus", () => selectTab(tab));
  });

  // Sync selection if browser Find-in-Page reveals a `hidden="until-found"` panel
  panels.forEach((panel) => {
    panel.addEventListener("beforematch", () => {
      const tabId = panel.getAttribute("aria-labelledby");
      const matchingTab = tabs.find((t) => t.id === tabId);
      if (matchingTab) selectTab(matchingTab);
    });
  });

  // Arrow-key navigation fallback when native `focusgroup` is not supported
  if (!Object.hasOwn(HTMLElement.prototype, "focusGroup")) {
    tablist.addEventListener("keydown", (e) => {
      const currentIndex = tabs.indexOf(document.activeElement);
      if (currentIndex === -1) return;
      let nextIndex = currentIndex;
      if (e.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % tabs.length;
      } else if (e.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      } else if (e.key === "Home") {
        nextIndex = 0;
      } else if (e.key === "End") {
        nextIndex = tabs.length - 1;
      } else {
        return;
      }
      e.preventDefault();
      tabs[nextIndex].focus();
    });
  }

  // Fallback for tablist horizontal scroll edge fades
  if (!CSS.supports("animation-timeline", "scroll()")) {
    const first = tablist.firstElementChild;
    const last = tablist.lastElementChild;
    if (first && last) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const { target, intersectionRatio } of entries) {
            tablist.classList.toggle(
              target === first ? "more-start" : "more-end",
              intersectionRatio < 1
            );
          }
        },
        { root: tablist, threshold: 1, rootMargin: "1px" }
      );
      observer.observe(first);
      observer.observe(last);
    }
  }
}

/* ==========================================================================
   Live CSPRNG Password & Diceware Generator Demo (Tab 3)
   ========================================================================== */
function initLivePasswordGenerator() {
  const outputEl = document.getElementById("demo-gen-output");
  const lengthInput = document.getElementById("demo-gen-length");
  const lengthLabel = document.getElementById("demo-gen-length-val");
  const modePassBtn = document.getElementById("demo-mode-password");
  const modePhraseBtn = document.getElementById("demo-mode-passphrase");
  const regenBtn = document.getElementById("demo-gen-refresh");
  const copyBtn = document.getElementById("demo-gen-copy");
  const chkUpper = document.getElementById("demo-chk-upper");
  const chkLower = document.getElementById("demo-chk-lower");
  const chkNum = document.getElementById("demo-chk-num");
  const chkSym = document.getElementById("demo-chk-sym");

  if (!outputEl || !lengthInput) return;

  let mode = "password";

  function randomUint32(max) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    return arr[0] % max;
  }

  function generateNow() {
    const len = parseInt(lengthInput.value, 10) || 20;
    if (lengthLabel) lengthLabel.textContent = String(len);

    if (mode === "passphrase") {
      const wordCount = Math.max(4, Math.min(8, Math.round(len / 4)));
      const picked = [];
      for (let i = 0; i < wordCount; i++) {
        const w = DICEWARE_WORDS[randomUint32(DICEWARE_WORDS.length)];
        picked.push(w.charAt(0).toUpperCase() + w.slice(1));
      }
      picked.push(String(randomUint32(90) + 10));
      outputEl.textContent = picked.join("-");
      return;
    }

    let charset = "";
    if (chkUpper?.checked) charset += "ABCDEFGHJKLMNPQRSTUVWXYZ";
    if (chkLower?.checked) charset += "abcdefghijkmnopqrstuvwxyz";
    if (chkNum?.checked) charset += "23456789";
    if (chkSym?.checked) charset += "!@#$%^&*_-+=";
    if (!charset) charset = "abcdefghijkmnopqrstuvwxyz23456789";

    let result = "";
    for (let i = 0; i < len; i++) {
      result += charset[randomUint32(charset.length)];
    }
    outputEl.textContent = result;
  }

  lengthInput.addEventListener("input", generateNow);
  [chkUpper, chkLower, chkNum, chkSym].forEach((el) =>
    el?.addEventListener("change", generateNow)
  );
  regenBtn?.addEventListener("click", generateNow);
  copyBtn?.addEventListener("click", () => {
    const val = outputEl.textContent || "";
    if (navigator.clipboard && val) {
      navigator.clipboard.writeText(val).catch(() => {});
    }
    showLandingToast("Generated credential copied to clipboard");
  });

  modePassBtn?.addEventListener("click", () => {
    mode = "password";
    modePassBtn.classList.add("btn-primary");
    modePassBtn.classList.remove("btn-secondary");
    modePhraseBtn?.classList.remove("btn-primary");
    modePhraseBtn?.classList.add("btn-secondary");
    generateNow();
  });

  modePhraseBtn?.addEventListener("click", () => {
    mode = "passphrase";
    modePhraseBtn.classList.add("btn-primary");
    modePhraseBtn.classList.remove("btn-secondary");
    modePassBtn?.classList.remove("btn-primary");
    modePassBtn?.classList.add("btn-secondary");
    generateNow();
  });

  generateNow();
}

/* ==========================================================================
   Fallbacks for Scroll-Driven Animations
   ========================================================================== */
function initScrollAnimationFallbacks() {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  if (reducedMotion) return;

  // 1. Shrinking header fallback
  if (
    !CSS.supports(
      "(animation-timeline: scroll()) and (animation-range: 0% 100%)"
    )
  ) {
    const header = document.querySelector(".site-header");
    if (header) {
      const initialHeight = 84;
      const finalHeight = 60;
      const scrollDistance = 120;
      window.addEventListener(
        "scroll",
        () => {
          const pct = Math.min(1, window.scrollY / scrollDistance);
          const h = initialHeight - (initialHeight - finalHeight) * pct;
          header.style.height = `${h}px`;
        },
        { passive: true }
      );
    }
  }

  // 2. ViewTimeline entry/exit reveal fallback
  if (
    !CSS.supports("(animation-timeline: view()) and (animation-range: entry)")
  ) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const ratio = entry.intersectionRatio;
          entry.target.style.opacity = String(0.35 + ratio * 0.65);
          entry.target.style.transform = `scale(${0.96 + ratio * 0.04})`;
        }
      },
      {
        threshold: Array.from({ length: 21 }, (_, i) => i / 20),
      }
    );

    document.querySelectorAll(".scroll-reveal").forEach((el) => {
      observer.observe(el);
    });
  }
}
