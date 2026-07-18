/* ============================================================================
   STOCK COUNT — admin.js (manager page)
   ============================================================================ */

const state = {
  db: null,
  isAdmin: false,
  sessions: [],       // pending batches, live from Firestore
  sessionsUnsub: null,
  activeSession: null, // the session currently open in the review screen
  editRows: []         // working copy of items for the review screen: {productId, name, count, originalName, deleted}
};

const el = {
  logoutBtn: document.getElementById("logoutBtn"),

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
  el.logoutBtn.hidden = true;
}
function showSessionListScreen() {
  el.loginScreen.hidden = true;
  el.sessionListScreen.hidden = false;
  el.reviewScreen.hidden = true;
  el.logoutBtn.hidden = false;
  subscribeSessions();
}

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
        <strong>${escapeHtml(session.category)} · ${escapeHtml(session.workerName)}</strong>
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
  el.reviewMeta.textContent = `Worker: ${session.workerName}`;
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
   ============================================================================ */
el.confirmSaveBtn.addEventListener("click", async () => {
  const finalItems = state.editRows
    .filter((r) => !r.deleted && r.name.trim() && r.count > 0)
    .map((r) => ({ productId: r.productId, name: r.name.trim(), count: r.count, originalName: r.originalName }));

  if (finalItems.length === 0) { showToast("Nothing to save — add at least one row."); return; }

  el.confirmSaveBtn.disabled = true;
  el.loadingOverlay.hidden = false;

  // 1) Propagate any corrected names back to the shared master product list.
  for (const item of finalItems) {
    if (item.productId && item.originalName && item.name !== item.originalName) {
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

  // 2) Write into the Google Sheet (this category's tab + master list mirror).
  const sheetResult = await sendToSheet(state.activeSession.category, finalItems.map((i) => ({ name: i.name, count: i.count })));

  el.loadingOverlay.hidden = true;
  el.confirmSaveBtn.disabled = false;

  if (!sheetResult.ok) { showToast(sheetResult.error); return; }

  // 3) Remove the session from the pending queue.
  await state.db.collection(CONFIG.pendingCollection).doc(state.activeSession.id).delete();
  showToast("Saved to Excel.");
  el.reviewScreen.hidden = true;
  el.sessionListScreen.hidden = false;
});

el.discardSessionBtn.addEventListener("click", () => {
  confirmAction("Discard this session?", "It will be removed and nothing will be saved to Excel.", async () => {
    await state.db.collection(CONFIG.pendingCollection).doc(state.activeSession.id).delete();
    showToast("Session discarded.");
    el.reviewScreen.hidden = true;
    el.sessionListScreen.hidden = false;
  });
});

async function sendToSheet(category, items) {
  if (!CONFIG.sheetWebAppUrl || CONFIG.sheetWebAppUrl.startsWith("PASTE_")) {
    return { ok: false, error: "Excel sync isn't set up yet. Add the Sheet link in config.js." };
  }
  try {
    await fetch(CONFIG.sheetWebAppUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ category, items })
    });
    return { ok: true };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't reach Excel. Check your connection and try again." };
  }
}

/* ============================================================================
   UI HELPERS
   ============================================================================ */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
function confirmAction(title, message, onConfirm) {
  el.confirmTitle.textContent = title;
  el.confirmMessage.textContent = message;
  el.confirmModal.classList.add("show");
  const okHandler = () => {
    el.confirmModal.classList.remove("show");
    el.confirmOkBtn.removeEventListener("click", okHandler);
    onConfirm();
  };
  el.confirmOkBtn.addEventListener("click", okHandler);
}
el.confirmCancelBtn.addEventListener("click", () => el.confirmModal.classList.remove("show"));

init();