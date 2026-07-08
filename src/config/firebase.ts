import { getStripePayments } from "@invertase/firestore-stripe-payments";
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "fake-api-key-so-it-does-not-crash",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "fake-auth-domain",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "fake-project-id",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "fake-bucket",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "fake-sender-id",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "fake-app-id",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const payments = getStripePayments(app, {
  productsCollection: "products",
  customersCollection: "customers",
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
