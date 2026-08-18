/**
 * SHARED CONFIG — loaded by both index.html (worker page) and admin.html
 * (manager page). Edit the values below once; both pages pick them up.
 *
 * NOTE: businessName, systemName, and categories below are only used to
 * SEED your Firestore "settings" document the very first time the app
 * runs. After that first run, the manager can change all three from the
 * admin page's Settings screen — no code edits or re-uploading needed.
 */
const CONFIG = {
  businessName: "ANMOL ENTERPRISE",
  systemName: "STOCK COUNT SYSTEM",
  // Fill these in from Firebase Project Settings > General > "Your apps".
  // Safe to leave public — access is controlled by Firestore Security Rules.
  firebase: {
    apiKey: "AIzaSyDtefCSc2pWU_rvRazFgEr9GPKiAp0Md5w",
    authDomain: "anmol-stock-count.firebaseapp.com",
    projectId: "anmol-stock-count",
    storageBucket: "anmol-stock-count.firebasestorage.app",
    messagingSenderId: "423074203911",
    appId: "1:423074203911:web:8f3c733c84edbd211bdda2",
  },
  productsCollection: "products",
  pendingCollection: "pendingBatches",
  settingsCollection: "settings",
  // Every product permanently belongs to exactly one of these.
  categories: ["PPF", "PRICUT", "CERAMIC COATING", "TOOLS", "ACCESSORIES", "OTHERS"]
};
