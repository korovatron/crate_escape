// Firebase Configuration and Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCIElAtVOsMnNWTIUcmQI0TCiTa1pMzWWI",
    authDomain: "crate-escape-2d68a.firebaseapp.com",
    projectId: "crate-escape-2d68a",
    storageBucket: "crate-escape-2d68a.firebasestorage.app",
    messagingSenderId: "701113673369",
    appId: "1:701113673369:web:b02b07a1d6a93444d9ba08"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();

// Export the initialized services for use in other files
export { auth, db, signInWithPopup, GoogleAuthProvider, signOut, doc, setDoc, getDoc, updateDoc, serverTimestamp };

// Global Firebase state management
window.firebaseAuth = {
    auth: auth, // Expose the auth object
    currentUser: null,
    isAuthenticated: false,
    isInitialized: false
};

// Also expose the Firestore database
window.firebaseFirestore = db;

// Listen for authentication state changes
auth.onAuthStateChanged((user) => {
    window.firebaseAuth.currentUser = user;
    window.firebaseAuth.isAuthenticated = !!user;
    window.firebaseAuth.isInitialized = true;
    
    // Update the local cloudSyncState to match Firebase auth state
    if (typeof window.updateCloudSyncState === 'function') {
        window.updateCloudSyncState(user ? 'authenticated' : 'not_authenticated');
    }
    
    console.log('Firebase Auth state changed:', user ? 'Signed in' : 'Signed out');
    
    // Trigger cloud sync if user just signed in and we have local data
    if (user && typeof window.handleAuthStateChange === 'function') {
        window.handleAuthStateChange(user);
    }
});

console.log('Firebase initialized successfully');