 // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
 import { getFirestore } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
//  import { getStorage } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-storage.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDOPz-t3f_xRKiy3o614-gbzRp7V9YWQXU",
    authDomain: "cafesync-5f6fa.firebaseapp.com",
    projectId: "cafesync-5f6fa",
    storageBucket: "cafesync-5f6fa.firebasestorage.app",
    messagingSenderId: "638004757461",
    appId: "1:638004757461:web:752bfd898bd2b25bf3b35c",
    measurementId: "G-56DGL7YGRY"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  //const analytics = getAnalytics(app);

const db = getFirestore(app);
// const storage = getStorage(app);

// ✅ Export this so other scripts can use it
export { db, };

