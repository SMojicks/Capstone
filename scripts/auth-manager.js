// smojicks/capstone/Capstone-a41e211d34513ead335274eeb7694bc93e7453e6/scripts/auth-manager.js

import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    // Find all login/logout buttons (ID 'i1mew' in your files)
    const loginButtons = document.querySelectorAll('#i1mew');
    
    if (user) {
        // --- User is logged in ---
        loginButtons.forEach(button => {
            button.textContent = 'Logout';
            button.href = '#'; // Remove direct link to login.html
            button.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Are you sure you want to log out?')) {
                    signOut(auth).then(() => {
                        alert('You have been logged out.');
                        window.location.href = 'index.html'; // Redirect to home
                    }).catch((error) => {
                        alert(`Logout failed: ${error.message}`);
                    });
                }
            });
        });

    } else {
        // --- User is logged out ---
        loginButtons.forEach(button => {
            button.textContent = 'Login/Sign up';
            button.href = 'login.html';
        });
    }
});