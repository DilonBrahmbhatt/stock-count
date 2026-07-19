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
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
  },

  // The Web app URL from your Google Apps Script deployment.
  sheetWebAppUrl: "PASTE_YOUR_GOOGLE_SHEETS_WEB_APP_URL_HERE",

  productsCollection: "products",
  pendingCollection: "pendingBatches",
  settingsCollection: "settings",

  // Every product permanently belongs to exactly one of these. Each name
  // here also becomes the name of its matching tab in your Google Sheet.
  categories: ["PPF", "PRICUT", "CERAMIC COATING", "TOOLS", "ACCESSORIES", "OTHERS"]
};
