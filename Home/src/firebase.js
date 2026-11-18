import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyB4dnDnojGL8NNMSxRJFV4eVQvKUkdoKJM",
    authDomain: "agenda-iebla.firebaseapp.com",
    projectId: "agenda-iebla",
    storageBucket: "agenda-iebla.firebasestorage.app",
    messagingSenderId: "94924538907",
    appId: "1:94924538907:web:861e69bbf351973f7de4be",
    measurementId: "G-4L3GNF3SY6"
};

let firebaseApp;

export function initializeFirebase() {
    if (!firebaseApp) firebaseApp = initializeApp(firebaseConfig);

    return {
        db: getFirestore(firebaseApp),
        auth: getAuth(firebaseApp)
    };
}

export { signInAnonymously };
