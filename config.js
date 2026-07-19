/**
 * SHARED CONFIG — loaded by both index.html (worker page) and admin.html
 * (manager page). Edit the values below once; both pages pick them up.
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

  // The Web app URL from your Google Apps Script deployment.
  sheetWebAppUrl: "https://script.google.com/macros/s/AKfycbxeua01EH1kY2IggqYNIc0fOoMCbocPhL_EbR-hsIjR-HOJvFYy86SdXmwbd3YD3JsfFQ/exec",

  productsCollection: "products",
  pendingCollection: "pendingBatches",

  // Every product permanently belongs to exactly one of these. Each name
  // here also becomes the name of its matching tab in your Google Sheet.
  categories: ["PPF", "PRICUT", "CERAMIC COATING", "TOOLS", "ACCESSORIES", "OTHERS"]
};
