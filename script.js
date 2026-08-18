/* ============================================================================
   STOCK COUNT — script.js (worker page)
   ============================================================================ */

const state = {
  products: [],           // full shared list, synced from Firestore (or demo)
  counts: {},             // {productId: number} — SESSION ONLY
  category: null,          // currently selected category, or null = category screen
  searchTerm: "",
  usingDemoData: false,
  db: null,
  settings: { businessName: "", systemName: "", categories: [] }
};

const el = {
  businessName: document.getElementById("businessName"),
  systemName: document.getElementById("systemName"),
  syncBanner: document.getElementById("syncBanner"),

  categoryScreen: document.getElementById("categoryScreen"),
  categoryGrid: document.getElementById("categoryGrid"),

  productScreen: document.getElementById("productScreen"),
  backToCategoriesBtn: document.getElementById("backToCategoriesBtn"),
  currentCategoryLabel: document.getElementById("currentCategoryLabel"),
  searchInput: document.getElementById("searchInput"),
  searchWrap: document.querySelector(".search-wrap"),
  clearSearchBtn: document.getElementById("clearSearchBtn"),
  productList: document.getElementById("productList"),
  emptyState: document.getElementById("emptyState"),
  emptyStateText: document.getElementById("emptyStateText"),

  bottomBar: document.getElementById("bottomBar"),
  addProductBtn: document.getElementById("addProductBtn"),
  exportBtn: document.getElementById("exportBtn"),
  resetBtn: document.getElementById("resetBtn"),

  toast: document.getElementById("toast"),

  addModal: document.getElementById("addModal"),
  addProductInput: document.getElementById("addProductInput"),
  addProductError: document.getElementById("addProductError"),
  saveProductBtn: document.getElementById("saveProductBtn"),

  exportModal: document.getElementById("exportModal"),
  exportSummaryText: document.getElementById("exportSummaryText"),
  exportError: document.getElementById("exportError"),
  confirmExportBtn: document.getElementById("confirmExportBtn"),

  successModal: document.getElementById("successModal"),

  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),

  loadingOverlay: document.getElementById("loadingOverlay")
};

/* ============================================================================
   FIRESTORE (shared product list)
   ============================================================================ */
// Names are always saved in CAPITALS, no matter how staff type them.
function normalizeName(raw) { return raw.trim().replace(/\s+/g, " ").toUpperCase(); }

function isFirebaseConfigured() {
  const f = CONFIG.firebase;
  return f.apiKey && !f.apiKey.startsWith("YOUR_") && f.projectId && !f.projectId.startsWith("YOUR_");
}

function initFirestore() {
  if (!isFirebaseConfigured()) { startDemoMode(); return; }
  try {
    firebase.initializeApp(CONFIG.firebase);
    state.db = firebase.firestore();
    showSyncBanner("Connecting to shared product list…", false);

    subscribeSettings();

    state.db.collection(CONFIG.productsCollection).orderBy("nameLower").onSnapshot(
      (snapshot) => {
        state.products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        state.products.forEach((p) => { if (!(p.id in state.counts)) state.counts[p.id] = 0; });
        hideSyncBanner();
        if (state.category) renderProducts();
      },
      (err) => { console.error(err); showSyncBanner("Can't reach the shared list. Check your connection.", true); }
    );
  } catch (err) {
    console.error(err);
    startDemoMode();
  }
}

/* Business name, system name, and the category list all live in one
   Firestore doc so the manager can edit them from Settings without any
   code changes. The very first time the app ever runs (doc doesn't exist
   yet), it's seeded from the defaults in config.js. */
function subscribeSettings() {
  const ref = state.db.collection(CONFIG.settingsCollection).doc("app");
  ref.get().then((snap) => {
    if (!snap.exists) {
      ref.set({ businessName: CONFIG.businessName, systemName: CONFIG.systemName, categories: CONFIG.categories });
    }
  });
  ref.onSnapshot((snap) => {
    if (!snap.exists) return;
    state.settings = snap.data();
    el.businessName.textContent = state.settings.businessName;
    el.systemName.textContent = state.settings.systemName;
    renderCategoryGrid();
  });
}

function startDemoMode() {
  state.usingDemoData = true;
  showSyncBanner("Demo mode — add your Firebase config in config.js to go live.", false);
  state.settings = { businessName: CONFIG.businessName, systemName: CONFIG.systemName, categories: CONFIG.categories };
  el.businessName.textContent = state.settings.businessName;
  el.systemName.textContent = state.settings.systemName;
  renderCategoryGrid();
  state.products = [
    { id: "d1", name: "BMW X5", nameLower: "bmw x5", category: "PPF" },
    { id: "d2", name: "BMW X7", nameLower: "bmw x7", category: "PPF" },
    { id: "d3", name: "HYUNDAI CRETA SX", nameLower: "hyundai creta sx", category: "PPF" },
    { id: "d4", name: "BMW X5", nameLower: "bmw x5", category: "PRICUT" },
    { id: "d5", name: "TOYOTA HYCROSS", nameLower: "toyota hycross", category: "PRICUT" },
    { id: "d6", name: "MICROFIBER TOWEL", nameLower: "microfiber towel", category: "TOOLS" }
  ];
  state.products.forEach((p) => (state.counts[p.id] = 0));
}

/* ============================================================================
   CATEGORY SCREEN
   ============================================================================ */
function renderCategoryGrid() {
  el.categoryGrid.innerHTML = "";
  (state.settings.categories || []).forEach((cat) => {
    const btn = document.createElement("button");
    btn.className = "category-btn";
    btn.textContent = cat;
    btn.addEventListener("click", () => openCategory(cat));
    el.categoryGrid.appendChild(btn);
  });
}

function openCategory(cat) {
  state.category = cat;
  el.currentCategoryLabel.textContent = cat;
  el.categoryScreen.hidden = true;
  el.productScreen.hidden = false;
  el.bottomBar.hidden = false;
  el.searchInput.value = "";
  state.searchTerm = "";
  el.searchWrap.classList.remove("has-text");
  renderProducts();
}

el.backToCategoriesBtn.addEventListener("click", () => {
  state.category = null;
  el.productScreen.hidden = true;
  el.bottomBar.hidden = true;
  el.categoryScreen.hidden = false;
});

/* ============================================================================
   PRODUCT LIST (within selected category)
   ============================================================================ */
function getVisibleProducts() {
  let list = state.products.filter((p) => p.category === state.category);
  if (state.searchTerm) {
    const term = state.searchTerm.toLowerCase();
    list = list.filter((p) => p.nameLower.includes(term));
  }
  list.sort((a, b) => a.nameLower.localeCompare(b.nameLower));
  return list;
}

function renderProducts() {
  const list = getVisibleProducts();
  el.productList.innerHTML = "";
  el.emptyState.hidden = list.length !== 0;
  if (list.length === 0) {
    el.emptyStateText.textContent = state.products.filter((p) => p.category === state.category).length === 0
      ? "No products in this category yet."
      : "No products match your search.";
  }
  const frag = document.createDocumentFragment();
  list.forEach((p) => frag.appendChild(buildProductCard(p)));
  el.productList.appendChild(frag);
}

function buildProductCard(product) {
  const count = state.counts[product.id] || 0;
  const li = document.createElement("li");
  li.className = "product-card" + (count > 0 ? " has-count" : "");

  const name = document.createElement("span");
  name.className = "product-name";
  name.textContent = product.name;

  const controls = document.createElement("div");
  controls.className = "count-controls";

  const minusBtn = document.createElement("button");
  minusBtn.className = "count-btn minus";
  minusBtn.textContent = "\u2212";
  minusBtn.setAttribute("aria-label", "Decrease count");

  const valueSpan = document.createElement("span");
  valueSpan.className = "count-value";
  valueSpan.textContent = count;
  valueSpan.setAttribute("aria-label", "Tap to type exact quantity");
  valueSpan.addEventListener("click", () => startEditingCount(product.id, li, valueSpan));

  const plusBtn = document.createElement("button");
  plusBtn.className = "count-btn plus";
  plusBtn.textContent = "+";
  plusBtn.setAttribute("aria-label", "Increase count");

  controls.appendChild(minusBtn);
  controls.appendChild(valueSpan);
  controls.appendChild(plusBtn);
  li.appendChild(name);
  li.appendChild(controls);

  minusBtn.addEventListener("click", () => changeCount(product.id, -1, li));
  plusBtn.addEventListener("click", () => changeCount(product.id, 1, li));

  return li;
}

function changeCount(productId, delta, cardEl) {
  const current = state.counts[productId] || 0;
  const next = Math.max(0, current + delta);
  if (next === current) return;
  state.counts[productId] = next;
  const valueSpan = cardEl.querySelector(".count-value");
  if (!valueSpan) return; // currently in "type a number" mode
  valueSpan.textContent = next;
  valueSpan.classList.remove("bump");
  void valueSpan.offsetWidth;
  valueSpan.classList.add("bump");
  cardEl.classList.toggle("has-count", next > 0);
}

/* Tap the number itself to type an exact quantity (e.g. 3, 4, 12) instead
   of tapping + repeatedly. The +/- buttons keep working as before. */
function startEditingCount(productId, cardEl, valueSpan) {
  if (cardEl.classList.contains("editing")) return;
  cardEl.classList.add("editing");

  const input = document.createElement("input");
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.className = "count-input";
  input.value = state.counts[productId] || 0;
  valueSpan.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  const commit = () => {
    if (done) return;
    done = true;

    let next = parseInt(input.value, 10);
    if (isNaN(next) || next < 0) next = 0;
    state.counts[productId] = next;

    const newSpan = document.createElement("span");
    newSpan.className = "count-value";
    newSpan.textContent = next;
    newSpan.setAttribute("aria-label", "Tap to type exact quantity");
    newSpan.addEventListener("click", () => startEditingCount(productId, cardEl, newSpan));
    input.replaceWith(newSpan);

    cardEl.classList.remove("editing");
    cardEl.classList.toggle("has-count", next > 0);
  };

  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); });
}

el.searchInput.addEventListener("input", () => {
  state.searchTerm = el.searchInput.value;
  el.searchWrap.classList.toggle("has-text", state.searchTerm.length > 0);
  renderProducts();
});
el.clearSearchBtn.addEventListener("click", () => {
  el.searchInput.value = "";
  state.searchTerm = "";
  el.searchWrap.classList.remove("has-text");
  renderProducts();
  el.searchInput.focus();
});

/* ============================================================================
   ADD PRODUCT (auto-tagged with the currently open category)
   ============================================================================ */
function productExists(nameLower, category) {
  return state.products.some((p) => p.nameLower === nameLower && p.category === category);
}

async function addProduct(rawName) {
  const name = normalizeName(rawName); // always CAPITALS
  if (!name) return { ok: false, error: "Enter a product name." };
  const nameLower = name.toLowerCase();
  if (productExists(nameLower, state.category)) return { ok: false, error: "Product already exists." };

  if (state.usingDemoData) {
    const id = "demo" + Date.now();
    state.products.push({ id, name, nameLower, category: state.category });
    state.counts[id] = 0;
    renderProducts();
    return { ok: true };
  }

  try {
    await state.db.collection(CONFIG.productsCollection).add({
      name, nameLower, category: state.category,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save. Check your connection." };
  }
}

el.addProductBtn.addEventListener("click", () => {
  el.addProductInput.value = "";
  el.addProductError.textContent = "";
  openModal(el.addModal);
  setTimeout(() => el.addProductInput.focus(), 150);
});
el.saveProductBtn.addEventListener("click", async () => {
  const result = await addProduct(el.addProductInput.value);
  if (result.ok) { closeModal(el.addModal); showToast("Product added."); }
  else el.addProductError.textContent = result.error;
});
el.addProductInput.addEventListener("keydown", (e) => { if (e.key === "Enter") el.saveProductBtn.click(); });

/* ============================================================================
   EXPORT — one tap, then straight to "success", no approval language
   ============================================================================ */
el.exportBtn.addEventListener("click", () => {
  const counted = getVisibleCategoryCounted();
  el.exportSummaryText.textContent = counted.length === 0
    ? "Nothing counted yet in this category."
    : `${counted.length} product(s) counted in ${state.category}.`;
  el.exportError.textContent = "";
  openModal(el.exportModal);
});

function getVisibleCategoryCounted() {
  return state.products
    .filter((p) => p.category === state.category && (state.counts[p.id] || 0) > 0)
    .map((p) => ({ productId: p.id, name: p.name, count: state.counts[p.id] }));
}

el.confirmExportBtn.addEventListener("click", async () => {
  const items = getVisibleCategoryCounted();
  if (items.length === 0) { el.exportError.textContent = "Nothing counted yet."; return; }

  el.confirmExportBtn.disabled = true;
  const result = await sendForReview(state.category, items);
  el.confirmExportBtn.disabled = false;

  if (result.ok) {
    closeModal(el.exportModal);
    // Reset only this category's counts — worker's job is done.
    items.forEach((i) => (state.counts[i.productId] = 0));
    renderProducts();
    openModal(el.successModal);
  } else {
    el.exportError.textContent = result.error;
  }
});

async function sendForReview(category, items) {
  if (state.usingDemoData) return { ok: true }; // nothing to send to in demo mode
  try {
    await state.db.collection(CONFIG.pendingCollection).add({
      category, items,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't submit. Check your connection and try again." };
  }
}

/* ============================================================================
   RESET (this category only)
   ============================================================================ */
el.resetBtn.addEventListener("click", () => {
  confirmAction("Reset counts?", `All quantities in ${state.category} go back to zero.`, () => {
    state.products.filter((p) => p.category === state.category).forEach((p) => (state.counts[p.id] = 0));
    renderProducts();
    showToast("Counts reset.");
  });
});

/* ============================================================================
   UI HELPERS
   ============================================================================ */
let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
function showSyncBanner(message, isError) {
  el.syncBanner.textContent = message;
  el.syncBanner.classList.add("show");
  el.syncBanner.classList.toggle("error", !!isError);
}
function hideSyncBanner() { el.syncBanner.classList.remove("show"); }

function openModal(m) { m.classList.add("show"); }
function closeModal(m) { m.classList.remove("show"); }
document.querySelectorAll("[data-close]").forEach((btn) => {
  btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
});
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(overlay); });
});

function confirmAction(title, message, onConfirm) {
  el.confirmTitle.textContent = title;
  el.confirmMessage.textContent = message;
  openModal(el.confirmModal);
  const okHandler = () => {
    closeModal(el.confirmModal);
    el.confirmOkBtn.removeEventListener("click", okHandler);
    onConfirm();
  };
  el.confirmOkBtn.addEventListener("click", okHandler);
}

/* ============================================================================
   INIT
   ============================================================================ */
el.businessName.textContent = CONFIG.businessName;
el.systemName.textContent = CONFIG.systemName;
initFirestore();
