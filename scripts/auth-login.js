// smojicks/capstone/Capstone-a41e211d34513ead335274eeb7694bc93e7453e6/scripts/auth-login.js

import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Handle form submission
document.getElementById('loginForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (currentLoginType === 'customer') {
        if (isRegisterMode) {
            // --- Handle Customer Registration ---
            const fullName = document.getElementById('fullName').value;
            const phone = document.getElementById('phone').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert('Passwords do not match!');
                return;
            }
            if (!fullName || !phone) {
                alert('Please fill out your full name and phone number.');
                return;
            }
            if (password.length < 6) {
                alert('Password must be at least 6 characters long.');
                return;
            }

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    const userDocRef = doc(db, "users", user.uid);
                    
                    setDoc(userDocRef, {
                        fullName: fullName,
                        email: email,
                        phone: phone,
                        userId: user.uid,
                        role: "customer" // 👈 Assign "customer" role by default
                    })
                    .then(() => {
                        alert('Account created successfully! Redirecting to homepage...');
                        window.location.href = 'index.html';
                    })
                    .catch((error) => {
                         alert(`Error saving user data: ${error.message}`);
                    });
                })
                .catch((error) => {
                    let userMessage = "An unknown error occurred. Please try again.";
                    switch (error.code) {
                        case "auth/email-already-in-use":
                            userMessage = "This email address is already in use by another account.";
                            break;
                        case "auth/invalid-email":
                            userMessage = "The email address is not valid. Please enter a valid email.";
                            break;
                        case "auth/weak-password":
                            userMessage = "The password is too weak. It must be at least 6 characters long.";
                            break;
                        case "auth/operation-not-allowed":
                            userMessage = "Email/Password sign-up is not enabled. (Developer: Check your Firebase console).";
                            break;
                        default:
                            userMessage = `Error creating account: ${error.message}`;
                    }
                    alert(userMessage);
                });

        } else {
            // --- Handle Customer Login ---
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    alert('Customer login successful! Redirecting to homepage...');
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    let userMessage = "An unknown error occurred. Please try again.";
                    switch (error.code) {
                        case "auth/user-not-found":
                        case "auth/wrong-password":
                        case "auth/invalid-credential":
                            userMessage = "Invalid email or password. Please try again.";
                            break;
                        case "auth/invalid-email":
                            userMessage = "The email address is not valid.";
                            break;
                        default:
                            userMessage = `Login failed: ${error.message}`;
                    }
                    alert(userMessage);
                });
        }
    } else {
        // --- Handle Employee Login (NEW LOGIC) ---
        signInWithEmailAndPassword(auth, email, password)
            .then(async (userCredential) => {
                const user = userCredential.user;
                // 1. User is signed in, now check their role
                const userDocRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userDocRef);

                if (userDoc.exists() && userDoc.data().role === 'employee') {
                    // 2. User exists AND has the 'employee' role
                    alert('Employee login successful! Redirecting to dashboard...');
                    window.location.href = 'EmployeeUI/index.html';
                } else {
                    // 3. User is a customer or has no role
                    alert('Access Denied: This is not an authorized employee account.');
                    signOut(auth); // Log them out immediately
                }
            })
            .catch((error) => {
                // 4. Login failed (wrong password, etc.)
                alert('Invalid employee email or password.');
            });
    }
});