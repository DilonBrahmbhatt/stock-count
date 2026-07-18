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
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // The Web app URL from your Google Apps Script deployment.
  sheetWebAppUrl: "https://script.google.com/macros/s/AKfycbxeua01EH1kY2IggqYNIc0fOoMCbocPhL_EbR-hsIjR-HOJvFYy86SdXmwbd3YD3JsfFQ/exec",

  productsCollection: "products",
  pendingCollection: "pendingBatches",

  // Every product permanently belongs to exactly one of these. Each name
  // here also becomes the name of its matching tab in your Google Sheet.
  categories: ["PPF", "PRICUT", "CERAMIC COATING", "TOOLS", "ACCESSORIES", "OTHERS"]
};