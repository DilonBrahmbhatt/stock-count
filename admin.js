/* ============================================================================
   STOCK COUNT — admin.js (manager page)
   Runs fully independent of any Google Sheet. Approving a session:
   propagates renames -> generates & downloads a PDF -> removes the session.
   ============================================================================ */

const state = {
  db: null,
  isAdmin: false,
  sessions: [],       // pending batches, live from Firestore
  sessionsUnsub: null,
  activeSession: null, // the session currently open in the review screen
  editRows: [],        // working copy of items for the review screen: {productId, name, count, originalName, deleted}

  settings: { businessName: "", systemName: "", categories: [] },
  settingsUnsub: null,
  allProducts: [],      // every product, every category — for the Products manager
  productsUnsub: null,
  productsFilterCategory: null
};

const el = {
  logoutBtn: document.getElementById("logoutBtn"),
  settingsBtn: document.getElementById("settingsBtn"),

  loginScreen: document.getElementById("loginScreen"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  loginSubmitBtn: document.getElementById("loginSubmitBtn"),

  sessionListScreen: document.getElementById("sessionListScreen"),
  sessionList: document.getElementById("sessionList"),

  reviewScreen: document.getElementById("reviewScreen"),
  backToListBtn: document.getElementById("backToListBtn"),
  reviewTitle: document.getElementById("reviewTitle"),
  reviewMeta: document.getElementById("reviewMeta"),
  reviewTable: document.getElementById("reviewTable"),
  addRowBtn: document.getElementById("addRowBtn"),
  discardSessionBtn: document.getElementById("discardSessionBtn"),
  confirmSaveBtn: document.getElementById("confirmSaveBtn"),

  settingsScreen: document.getElementById("settingsScreen"),
  backFromSettingsBtn: document.getElementById("backFromSettingsBtn"),
  settingsBusinessName: document.getElementById("settingsBusinessName"),
  settingsSystemName: document.getElementById("settingsSystemName"),
  saveGeneralBtn: document.getElementById("saveGeneralBtn"),
  categoryManageList: document.getElementById("categoryManageList"),
  newCategoryInput: document.getElementById("newCategoryInput"),
  addCategoryBtn: document.getElementById("addCategoryBtn"),
  productsCategorySelect: document.getElementById("productsCategorySelect"),
  productManageList: document.getElementById("productManageList"),
  newProductInput: document.getElementById("newProductInput"),
  addProductAdminBtn: document.getElementById("addProductAdminBtn"),

  toast: document.getElementById("toast"),

  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),

  loadingOverlay: document.getElementById("loadingOverlay")
};

/* ============================================================================
   FIREBASE INIT + AUTH
   ============================================================================ */
function isFirebaseConfigured() {
  const f = CONFIG.firebase;
  return f.apiKey && !f.apiKey.startsWith("YOUR_") && f.projectId && !f.projectId.startsWith("YOUR_");
}

function init() {
  if (!isFirebaseConfigured()) {
    el.loginError.textContent = "Firebase isn't configured yet in config.js.";
    return;
  }
  firebase.initializeApp(CONFIG.firebase);
  state.db = firebase.firestore();

  firebase.auth().onAuthStateChanged((user) => {
    state.isAdmin = !!user;
    if (state.isAdmin) showSessionListScreen();
    else showLoginScreen();
  });
}

function showLoginScreen() {
  el.loginScreen.hidden = false;
  el.sessionListScreen.hidden = true;
  el.reviewScreen.hidden = true;
  el.settingsScreen.hidden = true;
  el.logoutBtn.hidden = true;
  el.settingsBtn.hidden = true;
}
function showSessionListScreen() {
  el.loginScreen.hidden = true;
  el.sessionListScreen.hidden = false;
  el.reviewScreen.hidden = true;
  el.settingsScreen.hidden = true;
  el.logoutBtn.hidden = false;
  el.settingsBtn.hidden = false;
  subscribeSessions();
  subscribeSettings();
  subscribeAllProducts();
}

el.settingsBtn.addEventListener("click", () => {
  el.sessionListScreen.hidden = true;
  el.reviewScreen.hidden = true;
  el.settingsScreen.hidden = false;
  el.settingsBusinessName.value = state.settings.businessName || "";
  el.settingsSystemName.value = state.settings.systemName || "";
  renderCategoryManageList();
  renderProductsCategorySelect();
  renderProductManageList();
});
el.backFromSettingsBtn.addEventListener("click", () => {
  el.settingsScreen.hidden = true;
  el.sessionListScreen.hidden = false;
});

el.loginSubmitBtn.addEventListener("click", async () => {
  el.loginError.textContent = "";
  const email = el.loginEmail.value.trim();
  const password = el.loginPassword.value;
  if (!email || !password) { el.loginError.textContent = "Enter your email and password."; return; }
  el.loginSubmitBtn.disabled = true;
  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    el.loginError.textContent = "Incorrect email or password.";
  }
  el.loginSubmitBtn.disabled = false;
});
el.loginPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") el.loginSubmitBtn.click(); });

el.logoutBtn.addEventListener("click", async () => {
  if (state.sessionsUnsub) { state.sessionsUnsub(); state.sessionsUnsub = null; }
  if (state.settingsUnsub) { state.settingsUnsub(); state.settingsUnsub = null; }
  if (state.productsUnsub) { state.productsUnsub(); state.productsUnsub = null; }
  await firebase.auth().signOut();
});

/* ============================================================================
   SESSION LIST
   ============================================================================ */
function subscribeSessions() {
  if (state.sessionsUnsub) return;
  state.sessionsUnsub = state.db.collection(CONFIG.pendingCollection)
    .orderBy("submittedAt", "asc")
    .onSnapshot(
      (snapshot) => {
        state.sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        renderSessionList();
      },
      (err) => {
        console.error(err);
        el.sessionList.innerHTML = '<p class="modal-text">Couldn\'t load sessions.</p>';
      }
    );
}

function renderSessionList() {
  el.sessionList.innerHTML = "";
  if (state.sessions.length === 0) {
    el.sessionList.innerHTML = '<p class="modal-text">No submitted sessions right now.</p>';
    return;
  }
  state.sessions.forEach((session) => {
    const qty = session.items.reduce((s, i) => s + i.count, 0);
    const time = session.submittedAt && session.submittedAt.toDate ? session.submittedAt.toDate() : new Date();

    const card = document.createElement("div");
    card.className = "pending-batch-card";
    card.innerHTML = `
      <div class="pending-batch-header">
        <strong>${escapeHtml(session.category)}</strong>
        <span class="pending-batch-time">${time.toLocaleString()}</span>
      </div>
      <div class="pending-batch-items">
        <div class="pending-item-row"><span>${session.items.length} product(s)</span><span>${qty} total qty</span></div>
      </div>
      <div class="pending-batch-actions">
        <button class="btn primary review-btn">Review</button>
      </div>
    `;
    card.querySelector(".review-btn").addEventListener("click", () => openReview(session));
    el.sessionList.appendChild(card);
  });
}

/* ============================================================================
   REVIEW SCREEN (full edit: rename, change qty, delete rows, add rows)
   ============================================================================ */
function openReview(session) {
  state.activeSession = session;
  state.editRows = session.items.map((i) => ({
    productId: i.productId || null,
    name: i.name,
    originalName: i.name,
    count: i.count,
    deleted: false
  }));

  el.reviewTitle.textContent = session.category;
  const time = session.submittedAt && session.submittedAt.toDate ? session.submittedAt.toDate() : new Date();
  el.reviewMeta.textContent = `Submitted ${time.toLocaleString()}`;
  renderReviewTable();

  el.sessionListScreen.hidden = true;
  el.reviewScreen.hidden = false;
}

el.backToListBtn.addEventListener("click", () => {
  state.activeSession = null;
  el.reviewScreen.hidden = true;
  el.sessionListScreen.hidden = false;
});

function renderReviewTable() {
  el.reviewTable.innerHTML = "";
  state.editRows.forEach((row, idx) => {
    if (row.deleted) return;

    const rowEl = document.createElement("div");
    rowEl.className = "review-row";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = row.name;
    nameInput.className = "review-name-input";
    nameInput.addEventListener("input", () => { row.name = nameInput.value; });

    const qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.min = "0";
    qtyInput.value = row.count;
    qtyInput.className = "review-qty-input";
    qtyInput.addEventListener("input", () => { row.count = Math.max(0, parseInt(qtyInput.value, 10) || 0); });

    const delBtn = document.createElement("button");
    delBtn.className = "review-delete-btn";
    delBtn.setAttribute("aria-label", "Delete row");
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z"/></svg>';
    delBtn.addEventListener("click", () => {
      row.deleted = true;
      renderReviewTable();
    });

    rowEl.appendChild(nameInput);
    rowEl.appendChild(qtyInput);
    rowEl.appendChild(delBtn);
    el.reviewTable.appendChild(rowEl);
  });

  if (state.editRows.every((r) => r.deleted)) {
    el.reviewTable.innerHTML += '<p class="modal-text">All rows removed — add one below or discard this session.</p>';
  }
}

el.addRowBtn.addEventListener("click", () => {
  state.editRows.push({ productId: null, name: "", originalName: "", count: 0, deleted: false });
  renderReviewTable();
});

/* ============================================================================
   CONFIRM & SAVE  /  DISCARD
   No network call outside Firebase. No Google Sheet involved anywhere.
   ============================================================================ */
el.confirmSaveBtn.addEventListener("click", async () => {
  // Names are always saved in CAPITALS, no matter how they were typed/edited.
  const finalItems = state.editRows
    .filter((r) => !r.deleted && r.name.trim() && r.count > 0)
    .map((r) => ({
      productId: r.productId,
      name: r.name.trim().toUpperCase(),
      count: r.count,
      originalName: r.originalName
    }));

  if (finalItems.length === 0) { showToast("Nothing to save — add at least one row."); return; }

  const category = state.activeSession.category;
  const sessionId = state.activeSession.id;

  el.confirmSaveBtn.disabled = true;
  el.loadingOverlay.hidden = false;

  try {
    // 1) Propagate any corrected names back to the shared master product list.
    for (const item of finalItems) {
      if (item.productId && item.originalName && item.name !== item.originalName.toUpperCase()) {
        try {
          await state.db.collection(CONFIG.productsCollection).doc(item.productId).update({
            name: item.name,
            nameLower: item.name.toLowerCase()
          });
        } catch (err) {
          console.error("Rename propagation failed for", item.name, err);
        }
      }
    }

    // 2) Generate and download the PDF stock count report for this category.
    //    Every product in the category is listed — uncounted ones show 0, never blank.
    downloadStockCountPdf(category, finalItems);

    // 3) Remove the session from the pending queue.
    await state.db.collection(CONFIG.pendingCollection).doc(sessionId).delete();

    showToast("PDF downloaded.");
    el.reviewScreen.hidden = true;
    el.sessionListScreen.hidden = false;
  } catch (err) {
    console.error(err);
    showToast("Something went wrong. Check your connection and try again.");
  }

  el.loadingOverlay.hidden = true;
  el.confirmSaveBtn.disabled = false;
});

el.discardSessionBtn.addEventListener("click", () => {
  confirmAction("Discard this session?", "It will be removed and no PDF will be generated.", async () => {
    await state.db.collection(CONFIG.pendingCollection).doc(state.activeSession.id).delete();
    showToast("Session discarded.");
    el.reviewScreen.hidden = true;
    el.sessionListScreen.hidden = false;
  });
});

/* ============================================================================
   PDF — full stock count report for the approved category
   Every product in the category appears; uncounted ones show 0, never blank.
   ============================================================================ */
function downloadStockCountPdf(category, finalItems) {
  if (!window.jspdf) { showToast("PDF library didn't load. Check your connection."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // Map of counted items from this approval, keyed by productId (or name for
  // manually-added rows that have no productId).
  const countMap = {};
  finalItems.forEach((item) => {
    const key = item.productId || ("name:" + item.name.toLowerCase());
    countMap[key] = item.count;
  });

  const rows = [];
  const coveredProductIds = new Set();

  // Every product that belongs to this category, whether counted or not.
  state.allProducts
    .filter((p) => p.category === category)
    .forEach((p) => {
      const count = countMap[p.id] !== undefined ? countMap[p.id] : 0;
      rows.push([p.name, String(count)]);
      coveredProductIds.add(p.id);
    });

  // Any manually-added rows (no productId, e.g. typed fresh in Review) that
  // aren't already part of the master list above.
  finalItems.forEach((item) => {
    if (item.productId && coveredProductIds.has(item.productId)) return;
    if (!item.productId) rows.push([item.name, String(item.count)]);
  });

  rows.sort((a, b) => a[0].localeCompare(b[0]));

  const businessName = state.settings.businessName || CONFIG.businessName;
  const now = new Date();

  doc.setFontSize(14);
  doc.text(businessName, 14, 16);
  doc.setFontSize(11);
  doc.text(`Stock Count Report — ${category}`, 14, 24);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated: ${now.toLocaleString()}`, 14, 30);
  doc.setTextColor(0);

  doc.autoTable({
    startY: 36,
    head: [["Product", "Quantity"]],
    body: rows,
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [13, 71, 161], textColor: 255 },
    columnStyles: { 1: { halign: "center", cellWidth: 30 } }
  });

  const fileSafeCategory = category.replace(/[^a-z0-9]+/gi, "_");
  const fileSafeDate = now.toISOString().slice(0, 10);
  doc.save(`StockCount_${fileSafeCategory}_${fileSafeDate}.pdf`);
}

/* ============================================================================
   SETTINGS — General (business name / system name)
   ============================================================================ */
function subscribeSettings() {
  if (state.settingsUnsub) return;
  const ref = state.db.collection(CONFIG.settingsCollection).doc("app");
  ref.get().then((snap) => {
    if (!snap.exists) {
      ref.set({ businessName: CONFIG.businessName, systemName: CONFIG.systemName, categories: CONFIG.categories });
    }
  });
  state.settingsUnsub = ref.onSnapshot((snap) => {
    if (!snap.exists) return;
    state.settings = snap.data();
    if (!el.settingsScreen.hidden) {
      el.settingsBusinessName.value = state.settings.businessName || "";
      el.settingsSystemName.value = state.settings.systemName || "";
      renderCategoryManageList();
      renderProductsCategorySelect();
    }
  });
}

el.saveGeneralBtn.addEventListener("click", async () => {
  const businessName = el.settingsBusinessName.value.trim();
  const systemName = el.settingsSystemName.value.trim();
  if (!businessName || !systemName) { showToast("Both fields are required."); return; }
  await state.db.collection(CONFIG.settingsCollection).doc("app").update({ businessName, systemName });
  showToast("Saved.");
});

/* ============================================================================
   SETTINGS — Categories (add / rename with cascade / delete)
   ============================================================================ */
function renderCategoryManageList() {
  const categories = state.settings.categories || [];
  el.categoryManageList.innerHTML = "";
  categories.forEach((cat) => {
    const row = document.createElement("div");
    row.className = "manage-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = cat;

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-icon-btn";
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM7 8V4h8v4H7Z"/></svg>';
    saveBtn.addEventListener("click", () => renameCategory(cat, input.value.trim()));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-icon-btn";
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z"/></svg>';
    delBtn.addEventListener("click", () => deleteCategory(cat));

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(delBtn);
    el.categoryManageList.appendChild(row);
  });
}

async function renameCategory(oldName, newName) {
  if (!newName) { showToast("Category name can't be empty."); return; }
  const categories = state.settings.categories || [];
  if (newName !== oldName && categories.some((c) => c.toLowerCase() === newName.toLowerCase())) {
    showToast("That category already exists.");
    return;
  }
  if (newName === oldName) return;

  el.loadingOverlay.hidden = false;
  try {
    // Cascade: every product currently tagged with the old category name
    // needs to move to the new name too, or it would silently disappear.
    const snap = await state.db.collection(CONFIG.productsCollection).where("category", "==", oldName).get();
    const batch = state.db.batch();
    snap.docs.forEach((doc) => batch.update(doc.ref, { category: newName }));
    const updatedCategories = categories.map((c) => (c === oldName ? newName : c));
    batch.update(state.db.collection(CONFIG.settingsCollection).doc("app"), { categories: updatedCategories });
    await batch.commit();
    showToast(`Renamed to "${newName}".`);
  } catch (err) {
    console.error(err);
    showToast("Couldn't rename. Check your connection.");
  }
  el.loadingOverlay.hidden = true;
}

function deleteCategory(name) {
  const inUse = state.allProducts.filter((p) => p.category === name).length;
  if (inUse > 0) {
    showToast(`Can't delete — ${inUse} product(s) still use "${name}". Move or delete them first.`);
    return;
  }
  confirmAction(`Delete "${name}"?`, "Workers will no longer see this category.", async () => {
    const updated = (state.settings.categories || []).filter((c) => c !== name);
    await state.db.collection(CONFIG.settingsCollection).doc("app").update({ categories: updated });
    showToast("Category deleted.");
  });
}

el.addCategoryBtn.addEventListener("click", async () => {
  const name = el.newCategoryInput.value.trim();
  if (!name) { showToast("Enter a category name."); return; }
  const categories = state.settings.categories || [];
  if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) { showToast("That category already exists."); return; }
  await state.db.collection(CONFIG.settingsCollection).doc("app").update({
    categories: [...categories, name]
  });
  el.newCategoryInput.value = "";
  showToast("Category added.");
});

/* ============================================================================
   SETTINGS — Products (add / rename / delete, per category)
   Names are always saved in CAPITALS, no matter how the admin types them.
   ============================================================================ */
function subscribeAllProducts() {
  if (state.productsUnsub) return;
  state.productsUnsub = state.db.collection(CONFIG.productsCollection).orderBy("nameLower").onSnapshot((snapshot) => {
    state.allProducts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (!el.settingsScreen.hidden) renderProductManageList();
  });
}

function renderProductsCategorySelect() {
  const categories = state.settings.categories || [];
  const prevValue = state.productsFilterCategory;
  el.productsCategorySelect.innerHTML = categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  state.productsFilterCategory = categories.includes(prevValue) ? prevValue : categories[0] || null;
  if (state.productsFilterCategory) el.productsCategorySelect.value = state.productsFilterCategory;
  renderProductManageList();
}
el.productsCategorySelect.addEventListener("change", () => {
  state.productsFilterCategory = el.productsCategorySelect.value;
  renderProductManageList();
});

function renderProductManageList() {
  const list = state.allProducts.filter((p) => p.category === state.productsFilterCategory);
  el.productManageList.innerHTML = "";
  if (list.length === 0) {
    el.productManageList.innerHTML = '<p class="modal-text">No products in this category yet.</p>';
    return;
  }
  list.forEach((product) => {
    const row = document.createElement("div");
    row.className = "manage-row";

    const input = document.createElement("input");
    input.type = "text";
    input.value = product.name;

    const saveBtn = document.createElement("button");
    saveBtn.className = "save-icon-btn";
    saveBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM7 8V4h8v4H7Z"/></svg>';
    saveBtn.addEventListener("click", () => renameProductAdmin(product, input.value.trim()));

    const delBtn = document.createElement("button");
    delBtn.className = "delete-icon-btn";
    delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 7h12l-1 14H7L6 7Zm3-3h6l1 2H8l1-2Z"/></svg>';
    delBtn.addEventListener("click", () => deleteProductAdmin(product));

    row.appendChild(input);
    row.appendChild(saveBtn);
    row.appendChild(delBtn);
    el.productManageList.appendChild(row);
  });
}

async function renameProductAdmin(product, newName) {
  if (!newName) { showToast("Product name can't be empty."); return; }
  newName = newName.toUpperCase();
  const nameLower = newName.toLowerCase();
  const dup = state.allProducts.some((p) => p.id !== product.id && p.category === product.category && p.nameLower === nameLower);
  if (dup) { showToast("A product with that name already exists in this category."); return; }
  await state.db.collection(CONFIG.productsCollection).doc(product.id).update({ name: newName, nameLower });
  showToast("Product renamed.");
}

function deleteProductAdmin(product) {
  confirmAction(`Delete "${product.name}"?`, "This removes it from the shared product list for every worker.", async () => {
