import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getDatabase, ref, onValue, push, set, update, query, orderByChild, equalTo, get } from "firebase/database";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBLroV8NLx6vZ5nnegHcXdQOcUoo7BuFD0",
  authDomain: "teste-a662c.firebaseapp.com",
  databaseURL: "https://teste-a662c-default-rtdb.firebaseio.com",
  projectId: "teste-a662c",
  storageBucket: "teste-a662c.firebasestorage.app",
  messagingSenderId: "1000360050261",
  appId: "1:1000360050261:web:26d4a3636e71e366f19edc",
  measurementId: "G-TR12H5L8S1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const auth = getAuth(app);

export { 
    app, 
    analytics, 
    database, 
    auth,
    ref, 
    onValue, 
    push, 
    set, 
    update,
    query,
    orderByChild,
    equalTo,
    get,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged
};