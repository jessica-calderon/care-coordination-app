/**
 * Firebase SDK initialization module.
 * 
 * Initializes Firebase app, Firestore, and Analytics exactly once.
 * Analytics is guarded to prevent errors in unsupported environments.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getAnalytics, type Analytics } from 'firebase/analytics';

/**
 * Firebase configuration object.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCw347LXoh-s4ZQXRsdwnwqcrQjfJiixyY",
  authDomain: "care-notebook-ccb1d.firebaseapp.com",
  projectId: "care-notebook-ccb1d",
  storageBucket: "care-notebook-ccb1d.firebasestorage.app",
  messagingSenderId: "251384508478",
  appId: "1:251384508478:web:13fa89bf593f89c25de16f",
  measurementId: "G-N133F28XZ5"
};

/**
 * Initialize Firebase app exactly once.
 * If the app is already initialized, reuse the existing instance.
 */
const firebaseApp: FirebaseApp = getApps().length === 0
  ? initializeApp(firebaseConfig)
  : getApps()[0];

/**
 * Initialize Firestore database.
 */
export const firestore: Firestore = getFirestore(firebaseApp);

/**
 * Initialize Analytics with environment guards.
 * Returns null if Analytics cannot be initialized (e.g., in unsupported environments).
 * 
 * Analytics requires:
 * - Browser environment (window object)
 * - Not in SSR/Node environments
 * - Analytics service enabled in Firebase project
 */
let analytics: Analytics | null = null;

try {
  // Analytics requires a browser environment with window object
  // Also check for document to ensure we're in a proper browser context
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    analytics = getAnalytics(firebaseApp);
  }
} catch {
  // Silently fail if Analytics cannot be initialized
  // This can happen in unsupported environments, SSR, or if Analytics is not available
  // No console error in production to avoid noise
  analytics = null;
}

/**
 * Export Firebase app instance.
 */
export { firebaseApp };

/**
 * Export Analytics instance (nullable).
 */
export { analytics };

