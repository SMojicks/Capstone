// // js/reservation.js
// import { db, auth } from "./firebase.js";
// import {
//   collection,
//   addDoc,
//   doc,
//   getDoc,
//   query,
//   where,
//   getDocs,
//   updateDoc 
// } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
// import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

// async function checkAuthState() {
//     onAuthStateChanged(auth, async (user) => {
//         const modal = document.getElementById('auth-validation-modal'); // Get the modal

//         if (user) {
//             // User is LOGGED IN
//             currentUserId = user.uid;
//             const userDocRef = doc(db, "users", user.uid);
//             const userDoc = await getDoc(userDocRef);
//             if (userDoc.exists()) {
//                 const userData = userDoc.data();
//                 const nameInput = document.querySelector('input[name="customerName"]');
//                 const contactInput = document.querySelector('input[name="contactNumber"]');
//                 if (nameInput) nameInput.value = userData.fullName || "";
//                 if (contactInput) contactInput.value = userData.phone || "";
//             }
            
//             // Hide the modal if it exists
//             if (modal) modal.classList.add('hidden');

//         } else {
//             // User is NOT logged in
//             currentUserId = null;
//             const nameInput = document.querySelector('input[name="customerName"]');
//             const contactInput = document.querySelector('input[name="contactNumber"]');
//             if (nameInput) nameInput.value = "";
//             if (contactInput) contactInput.value = "";

//             // Show the modal if it exists
//             if (modal) modal.classList.remove('hidden');
//         }
//     });
// }
// const reservationsRef = collection(db, "reservations");
// const productsRef = collection(db, "products"); 

// let selectedTableId = null;
// let occupiedTables = [];
// let isVipSelected = false;
// let vipPaymentCompleted = false;
// let currentUserId = null;

// // --- DECLARE ALL DOM ELEMENT VARIABLES WITH 'let' ---
// let reservationDateInput, checkAvailabilityBtn, availabilityLoader, availabilityMessage;
// let reservationTimeInput, numberOfDinersInput, notesInput, agreeTermsCheckbox, confirmReservationBtn;
// let preOrderModal, skipPreOrderBtn, preOrderCategories, preOrderGrid, preOrderCartItems, preOrderSubtotal, preOrderTax, preOrderTotal, preOrderCheckoutBtn;
// let preOrderVariationModal, preOrderVariationTitle, preOrderVariationOptions, cancelPreOrderVariationBtn;
// let preOrderPaymentModal, cancelPaymentBtn, paymentTotalAmount, receiptFileInput, receiptPreview, uploadReceiptBtn;
// let preorderBackBtn, cartIconContainer, cartBadge, preOrderCartItemsWrapper;

// // --- Pre-Order State ---
// let allProductsCache = [];
// let preOrderCart = [];

// // --- FIX: Add variable to hold reservation data temporarily ---
// let currentReservationData = null;
// let currentReservationId = null; 
// let currentReceiptFile = null;

// // ===================================
// // CLOUDINARY UPLOAD
// // ===================================
// async function uploadToCloudinary(file) {
//     const CLOUD_NAME = "dofyjwhlu";
//     const UPLOAD_PRESET = "cafesync";

//     const URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
//     const formData = new FormData();
//     formData.append("file", file);
//     formData.append("upload_preset", UPLOAD_PRESET);

//     try {
//         const response = await fetch(URL, { method: "POST", body: formData });
//         if (!response.ok) throw new Error(`Cloudinary upload failed`);
//         const data = await response.json();
//         return data.secure_url;
//     } catch (error) {
//         console.error("Error uploading to Cloudinary:", error);
//         throw error;
//     }
// }

// // ===================================
// // AUTH & RESERVATION FORM
// // ===================================

// function setDateRestrictions() {
//   const today = new Date();
//   const tomorrow = new Date(today);
//   tomorrow.setDate(tomorrow.getDate() + 1);
//   const minDate = tomorrow.toISOString().split("T")[0];
//   if (reservationDateInput) reservationDateInput.min = minDate;
//   const max = new Date(today);
//   max.setMonth(max.getMonth() + 1);
//   const maxDate = max.toISOString().split("T")[0];
//   if (reservationDateInput) reservationDateInput.max = maxDate;
// }

// function updateTableVisuals() {
//   document.querySelectorAll(".table-spot, .vip-room-btn").forEach((spot) => {
//     const id = spot.getAttribute("data-id");
//     spot.classList.remove("available", "occupied", "selected");
//     if (occupiedTables.includes(String(id))) {
//       spot.classList.add("occupied");
//     } else {
//       spot.classList.add("available");
//     }
//   });
//   if (selectedTableId) {
//     if (occupiedTables.includes(String(selectedTableId))) {
//       selectedTableId = null;
//       document.getElementById("selectedTableInfo")?.classList.remove("show");
//     } else {
//       const mySpot = document.querySelector(`[data-id="${selectedTableId}"]`);
//       if (mySpot) {
//         mySpot.classList.remove("available", "occupied");
//         mySpot.classList.add("selected");
//         document.getElementById("selectedTableNumber").textContent = selectedTableId;
//         document.getElementById("selectedTableInfo").classList.add("show");
//       }
//     }
//   }
// }

// function initializeTableClicks() {
//   const tableSpots = document.querySelectorAll(".table-spot, .vip-room-btn");
//   tableSpots.forEach((spot) => {
//     const tableId = spot.getAttribute("data-id");
//     spot.classList.add("available");
//     spot.addEventListener("click", () => {
//         if (reservationTimeInput && reservationTimeInput.disabled) {
//             alert("Please select a date and click 'Check Availability' first.");
//             return;
//         }
//       if (occupiedTables.includes(String(tableId))) {
//         alert("This table is already occupied. Please select another table.");
//         return;
//       }
//       isVipSelected = spot.classList.contains("vip-room-btn");
//       document.querySelectorAll(".table-spot.selected, .vip-room-btn.selected").forEach((s) => {
//         s.classList.remove("selected");
//         s.classList.add("available");
//       });
//       selectedTableId = String(tableId);
//       spot.classList.remove("available");
//       spot.classList.add("selected");
//       updateSelectedTableInfo(isVipSelected ? "VIP Room" : selectedTableId);
//     });
//   });
// }

// function updateSelectedTableInfo(tableId) {
//   const selectedTableInfo = document.getElementById("selectedTableInfo");
//   const selectedTableNumber = document.getElementById("selectedTableNumber");
//   if (selectedTableNumber) selectedTableNumber.textContent = tableId;
//   if (selectedTableInfo) selectedTableInfo.classList.add("show");
// }

// function setFormDisabled(disabled) {
//     if (reservationTimeInput) reservationTimeInput.disabled = disabled;
//     if (numberOfDinersInput) numberOfDinersInput.disabled = disabled;
//     if (notesInput) notesInput.disabled = disabled;
//     if (agreeTermsCheckbox) agreeTermsCheckbox.disabled = disabled;
//     if (confirmReservationBtn) confirmReservationBtn.disabled = disabled;
//     if (disabled) {
//         selectedTableId = null;
//         isVipSelected = false;
//         vipPaymentCompleted = false;
//         document.getElementById("selectedTableInfo")?.classList.remove("show");
//         document.querySelectorAll(".table-spot.selected, .vip-room-btn.selected").forEach((s) => {
//             s.classList.remove("selected");
//         });
//         if (availabilityMessage) {
//             availabilityMessage.textContent = "Please select a date to see available tables.";
//         }
//     }
// }

// async function checkAvailability() {
//     if (!currentUserId) {
//         const modal = document.getElementById('auth-validation-modal');
//         if (modal) modal.classList.remove('hidden');
//         return; 
//     }

//     const selectedDate = reservationDateInput.value;
//     if (!selectedDate) {
//         alert("Please select a valid date.");
//         return;
//     }
//     if (checkAvailabilityBtn) checkAvailabilityBtn.disabled = true;
//     if (availabilityLoader) availabilityLoader.classList.remove("hidden");
//     if (availabilityMessage) availabilityMessage.textContent = "Checking available tables...";
//     occupiedTables = [];
//     try {
//         const q = query(
//             reservationsRef, 
//             where("date", "==", selectedDate),
//             where("status", "==", "pending")
//         );
//         const snapshot = await getDocs(q);
//         snapshot.forEach(doc => {
//             occupiedTables.push(String(doc.data().tableNumber));
//         });
//         updateTableVisuals();
//         setFormDisabled(false);
//         if (availabilityMessage) availabilityMessage.textContent = `Showing availability for ${selectedDate}.`;
//     } catch (err) {
//         console.error("Error checking availability:", err);
//         if (availabilityMessage) availabilityMessage.textContent = "Error loading tables. Please try again.";
//     } finally {
//         if (checkAvailabilityBtn) checkAvailabilityBtn.disabled = false;
//         if (availabilityLoader) availabilityLoader.classList.add("hidden");
//     }
// }

// // --- FIX: Reservation submit now stores data locally, opens pre-order ---
// async function handleReservation(event) {
//   event.preventDefault();
//   if (!selectedTableId) {
//     alert("Please select an available table from the map.");
//     return;
//   }
//   if (reservationTimeInput && reservationTimeInput.disabled) {
//       alert("Please check for table availability on a specific date first.");
//       return;
//   }
//   if (isVipSelected && !vipPaymentCompleted) {
//     const vipModal = document.getElementById("vipModal");
//     if (vipModal) vipModal.classList.remove("hidden");
//     return;
//   }

//   const formData = new FormData(event.target);
  
//   // --- FIX: Store data in the global variable, DON'T save to Firestore yet ---
//   currentReservationData = {
//     name: formData.get("customerName"),
//     contactNumber: formData.get("contactNumber"),
//     numOfDiners: formData.get("numberOfDiners"),
//     date: formData.get("reservationDate"),
//     time: formData.get("reservationTime"),
//     notes: formData.get("notes") || "None",
//     tableNumber: String(selectedTableId),
//     status: "pending",
//     isVip: isVipSelected,
//     vipPaymentStatus: vipPaymentCompleted ? "paid" : "n/a",
//     timestamp: new Date(),
//     userId: currentUserId,
//     preOrder: [], // NEW: Initialize pre-order
//     paymentReceiptUrl: null // NEW: Initialize receipt URL
//   };
  
//   if (!currentReservationData.name || !currentReservationData.contactNumber) {
//       alert("Please enter your Full Name and Contact Number.");
//       currentReservationData = null; // Clear bad data
//       return;
//   }
  
//   if(confirmReservationBtn) confirmReservationBtn.disabled = true;

//   // --- FIX: Reset reservation ID tracker ---
//   currentReservationId = null; 

//   // --- FIX: Just open the pre-order modal, don't pass ID ---
//   openPreOrderModal();
// }

// // ===================================
// // NEW: PRE-ORDER LOGIC
// // ===================================

// // --- 1. Open the main Pre-Order Modal ---
// async function openPreOrderModal() {
//     preOrderCart = [];
//     updatePreOrderCart();
    
//     if (allProductsCache.length === 0) {
//         await loadPreOrderMenu();
//     } else {
//         renderPreOrderMenu("All");
//     }

//     if (preOrderModal) preOrderModal.style.display = "block";
// }

// // --- 2. Load Products from Firestore ---
// async function loadPreOrderMenu() {
//     try {
//         const q = query(productsRef, where("isVisible", "==", true));
//         const snapshot = await getDocs(q);
//         allProductsCache = [];
//         const categories = new Set();

//         snapshot.forEach(doc => {
//             const product = { id: doc.id, ...doc.data() };
//             allProductsCache.push(product);
//             categories.add(product.category);
//         });

//         if (preOrderCategories) {
//             preOrderCategories.innerHTML = '<li class="active" data-category="All">All</li>';
//             Array.from(categories).sort().forEach(cat => {
//                 const li = document.createElement("li");
//                 li.dataset.category = cat;
//                 li.textContent = cat;
//                 preOrderCategories.appendChild(li);
//             });
//         }
        
//         renderPreOrderMenu("All");

//     } catch (err) {
//         console.error("Error loading products:", err);
//         if(preOrderGrid) preOrderGrid.innerHTML = "<p>Error loading menu.</p>";
//     }
// }

// // --- 3. Render Menu Items ---
// function renderPreOrderMenu(category) {
//     if (!preOrderGrid) return;
//     preOrderGrid.innerHTML = ""; 

//     const productsToRender = (category === "All")
//         ? allProductsCache
//         : allProductsCache.filter(p => p.category === category);
    
//     if (productsToRender.length === 0) {
//         preOrderGrid.innerHTML = "<p>No items in this category.</p>";
//     }

//     productsToRender.forEach(product => {
//         const card = document.createElement("div");
//         card.className = "preorder-product-card";
        
//         let priceDisplay = "";
//         if (product.variations && product.variations.length > 0) {
//             const minPrice = Math.min(...product.variations.map(v => v.price));
//             priceDisplay = `From ₱${minPrice.toFixed(2)}`;
//         } else {
//             priceDisplay = `₱${product.price.toFixed(2)}`;
//         }

//         card.innerHTML = `
//             <img src="${product.imageUrl || 'assets/sandwich-1.jpg'}" alt="${product.name}">
//             <div class="preorder-product-card-info">
//                 <h4>${product.name}</h4>
//                 <p>${priceDisplay}</p>
//             </div>
//         `;
        
//         card.onclick = () => handlePreOrderProductClick(product);
//         preOrderGrid.appendChild(card);
//     });
// }

// // --- 4. Handle Clicks on Menu Items ---
// function handlePreOrderProductClick(product) {
//     if (product.variations && product.variations.length > 0) {
//         if (preOrderVariationModal) {
//             preOrderVariationTitle.textContent = `Select ${product.name} Size`;
//             preOrderVariationOptions.innerHTML = ""; 
            
//             product.variations.forEach(v => {
//                 const btn = document.createElement("button");
//                 btn.className = "variation-btn";
//                 btn.innerHTML = `${v.name} <span class="variation-price">₱${v.price.toFixed(2)}</span>`;
//                 btn.onclick = () => {
//                     const item = { ...product, id: `${product.id}-${v.name}`, name: `${product.name} - ${v.name}`, price: v.price };
//                     addItemToPreOrderCart(item);
//                     preOrderVariationModal.style.display = "none";
//                 };
//                 preOrderVariationOptions.appendChild(btn);
//             });
            
//             preOrderVariationModal.style.display = "flex";
//         }
//     } else {
//         addItemToPreOrderCart(product);
//     }
// }

// // --- 5. Add to Pre-Order Cart ---
// function addItemToPreOrderCart(item) {
//     const existing = preOrderCart.find(i => i.id === item.id);
//     if (existing) {
//         existing.quantity++;
//     } else {
//         preOrderCart.push({ ...item, quantity: 1 });
//     }
//     updatePreOrderCart();
// }
// function adjustPreOrderItemQuantity(itemId, change) {
//     const itemIndex = preOrderCart.findIndex(i => i.id === itemId);
//     if (itemIndex === -1) return; // Item not found

//     const item = preOrderCart[itemIndex];
//     item.quantity += change;

//     if (item.quantity <= 0) {
//         // Remove item from cart if quantity is 0 or less
//         preOrderCart.splice(itemIndex, 1);
//     }

//     updatePreOrderCart(); // Re-render the cart
// }

// // --- 6. Update Pre-Order Cart UI ---
// function updatePreOrderCart() {
//     if (!preOrderCartItems || !cartBadge) return;
    
//     const totalDistinctItems = preOrderCart.length; 
//     cartBadge.textContent = totalDistinctItems.toString();
//     cartBadge.style.display = totalDistinctItems > 0 ? 'block' : 'none';

//     if (preOrderCart.length === 0) {
//         preOrderCartItems.innerHTML = `<p style="color: #888; text-align: center;">Your cart is empty.</p>`;
//         preOrderCheckoutBtn.disabled = true;
//         if (preOrderCartItemsWrapper && !preOrderCartItemsWrapper.classList.contains('collapsed')) {
//              preOrderCartItemsWrapper.classList.add('collapsed');
//         }
//     } else {
//         preOrderCartItems.innerHTML = "";
//         preOrderCart.forEach(item => {
//             const itemEl = document.createElement("div");
//             itemEl.className = "preorder-cart-item";
            
//             // --- FIX: This HTML was incorrect in the previous version ---
//             itemEl.innerHTML = `
//                 <span class="name">${item.name}</span>
//                 <div class="preorder-qty-controls">
//                     <button class="preorder-qty-btn" data-id="${item.id}" data-change="-1">−</button>
//                     <span class="qty-display">${item.quantity}</span>
//                     <button class="preorder-qty-btn" data-id="${item.id}" data-change="1">+</button>
//                 </div>
//                 <span class="price">₱${(item.price * item.quantity).toFixed(2)}</span>
//             `;
//             preOrderCartItems.appendChild(itemEl);
//         });
//         preOrderCheckoutBtn.disabled = false;
//         if (preOrderCartItemsWrapper && preOrderCartItemsWrapper.classList.contains('collapsed')) {
//              preOrderCartItemsWrapper.classList.remove('collapsed');
//         }
//     }
    
//     // Update totals
//     const subtotal = preOrderCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
//     const tax = subtotal * 0.12;
//     const total = subtotal + tax;
    
//     if (preOrderSubtotal) preOrderSubtotal.textContent = `₱${subtotal.toFixed(2)}`;
//     if (preOrderTax) preOrderTax.textContent = `₱${tax.toFixed(2)}`;
//     if (preOrderTotal) preOrderTotal.textContent = `₱${total.toFixed(2)}`;
//     if (paymentTotalAmount) paymentTotalAmount.textContent = `₱${total.toFixed(2)}`;
// }

// // --- 7. Open Payment Modal ---
// function openPaymentModal() {
//     if (preOrderCart.length === 0) return;
//     currentReceiptFile = null;
//     if (receiptFileInput) receiptFileInput.value = "";
//     if (receiptPreview) receiptPreview.style.display = "none";
//     if (uploadReceiptBtn) uploadReceiptBtn.disabled = true;
    
//     if (preOrderPaymentModal) preOrderPaymentModal.style.display = "block";
// }

// // --- 8. Handle Receipt File Selection ---
// function handleReceiptFileSelect(event) {
//     const file = event.target.files[0];
//     if (file) {
//         if (file.size > 5 * 1024 * 1024) { // 5MB limit
//             alert('File is too large (Max 5MB).');
//             return;
//         }
//         currentReceiptFile = file;
//         const reader = new FileReader();
//         reader.onload = e => {
//             if (receiptPreview) {
//                 receiptPreview.src = e.target.result;
//                 receiptPreview.style.display = "block";
//             }
//         };
//         reader.readAsDataURL(file);
//         if (uploadReceiptBtn) uploadReceiptBtn.disabled = false;
//     } else {
//         currentReceiptFile = null;
//         if (receiptPreview) receiptPreview.style.display = "none";
//         if (uploadReceiptBtn) uploadReceiptBtn.disabled = true;
//     }
// }

// // --- 9. Finalize: Upload Receipt and Update Reservation ---
// async function finalizePreOrder() {
//     if (!currentReceiptFile || !currentReservationData) {
//         alert("Please upload a receipt screenshot.");
//         return;
//     }

//     if (uploadReceiptBtn) {
//         uploadReceiptBtn.disabled = true;
//         uploadReceiptBtn.textContent = "Uploading...";
//     }

//     try {
//         const receiptUrl = await uploadToCloudinary(currentReceiptFile);
        
//         const preOrderData = preOrderCart.map(item => ({
//             productId: item.id.split('-')[0],
//             name: item.name,
//             quantity: item.quantity,
//             pricePerItem: item.price
//         }));
        
//         currentReservationData.preOrder = preOrderData;
//         currentReservationData.paymentReceiptUrl = receiptUrl;

//         await saveReservation();

//     } catch (err) {
//         console.error("Error finalizing pre-order:", err);
//         alert("There was an error saving your pre-order. Please try again.");
//     } finally {
//         if (uploadReceiptBtn) {
//             uploadReceiptBtn.disabled = false;
//             uploadReceiptBtn.textContent = "Confirm Pre-Order";
//         }
//     }
// }

// // --- FIX: New function to handle skipping (or backing out) ---
// async function handleBackSkip() {
//     if (preOrderModal) preOrderModal.style.display = 'none'; 
//     // Save the reservation with an empty pre-order
//     await saveReservation();
// }

// // --- FIX: New central function to save the reservation ---
// async function saveReservation() {
//     if (!currentReservationData) {
//         console.log("No reservation data to save.");
//         if(confirmReservationBtn) confirmReservationBtn.disabled = false;
//         return; 
//     }
    
//     if (currentReservationId) {
//         console.log("Reservation already saved.");
//         return; 
//     }

//     try {
//         const docRef = await addDoc(reservationsRef, currentReservationData);
//         currentReservationId = docRef.id; 
//         console.log("✅ Reservation saved to Firestore, ID:", docRef.id);
        
//         showFinalSuccessMessage();

//     } catch (err) {
//         console.error("Error saving reservation:", err);
//         alert("Could not save reservation. Check console for details.");
//         if(confirmReservationBtn) confirmReservationBtn.disabled = false;
//     } finally {
//         currentReservationData = null; 
//     }
// }


// // --- 10. Show Final Success Message and Reset ---
// function showFinalSuccessMessage() {
//     if (preOrderModal) preOrderModal.style.display = "none";
//     if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
    
//     document.getElementById("reservationForm")?.reset();
//     setFormDisabled(true);
//     if (reservationDateInput) reservationDateInput.value = "";
//     checkAuthState(); // Re-fill user data
//     updateTableVisuals(); 
    
//     document.getElementById("successMessage")?.classList.add("show");
//     setTimeout(() => {
//         document.getElementById("successMessage")?.classList.remove("show");
//     }, 3000); 
    
//     if (confirmReservationBtn) confirmReservationBtn.disabled = false;
// }


// // ===================================
// // INITIALIZE
// // ===================================

// document.addEventListener("DOMContentLoaded", () => {
//   // --- Assign Reservation Form elements ---
//   reservationDateInput = document.getElementById("reservationDate");
//   checkAvailabilityBtn = document.getElementById("checkAvailabilityBtn");
//   availabilityLoader = document.getElementById("availabilityLoader");
//   availabilityMessage = document.getElementById("availability-message");
//   reservationTimeInput = document.getElementById("reservationTime");
//   numberOfDinersInput = document.getElementById("numberOfDiners");
//   notesInput = document.getElementById("notes");
//   agreeTermsCheckbox = document.getElementById("agreeTerms");
//   confirmReservationBtn = document.getElementById("confirmReservationBtn");

//   // --- Assign Pre-Order Modal elements ---
//   preOrderModal = document.getElementById("preorder-modal");
//   preOrderCategories = document.getElementById("preorder-categories");
//   preOrderGrid = document.getElementById("preorder-grid");
//   preOrderCartItems = document.getElementById("preOrderCartItems"); // <-- FIX: Corrected ID
  
//   // --- FIX: Correct all these IDs to match the HTML ---
//   preOrderSubtotal = document.getElementById("preOrderSubtotal");
//   preOrderTax = document.getElementById("preOrderTax");
//   preOrderTotal = document.getElementById("preOrderTotal");
//   preOrderCheckoutBtn = document.getElementById("preOrderCheckoutBtn");
  
//   // --- Assign Variation Modal elements ---
//   preOrderVariationModal = document.getElementById("preorder-variation-modal");
//   preOrderVariationTitle = document.getElementById("preorder-variation-title");
//   preOrderVariationOptions = document.getElementById("preorder-variation-options");
//   cancelPreOrderVariationBtn = document.getElementById("cancel-preorder-variation");
  
//   // --- Assign Payment Modal elements ---
//   preOrderPaymentModal = document.getElementById("preorder-payment-modal");
//   cancelPaymentBtn = document.getElementById("cancel-payment-btn");
//   paymentTotalAmount = document.getElementById("payment-total-amount");
//   receiptFileInput = document.getElementById("receipt-file-input");
//   receiptPreview = document.getElementById("receipt-preview");
//   uploadReceiptBtn = document.getElementById("upload-receipt-btn");

//   // --- Assign NEW Cart Icon & Header Elements ---
//   preorderBackBtn = document.querySelector(".preorder-back-btn");
//   cartIconContainer = document.getElementById("cartIconContainer");
//   cartBadge = document.getElementById("cartBadge");
//   preOrderCartItemsWrapper = document.getElementById("preOrderCartItemsWrapper");

  
//   // --- Standard Init ---
//   setDateRestrictions();
//   initializeTableClicks();
//   checkAuthState();
//   setFormDisabled(true);

//   // --- Reservation Form Listeners ---
//   if (checkAvailabilityBtn) checkAvailabilityBtn.addEventListener("click", checkAvailability);
//   if (reservationDateInput) reservationDateInput.addEventListener("input", () => setFormDisabled(true));
//   const form = document.getElementById("reservationForm");
//   if (form) form.addEventListener("submit", handleReservation);

//   // --- Auth Modal Close Button ---
//   const authModal = document.getElementById('auth-validation-modal');
//   if (authModal) {
//       const authModalClose = authModal.querySelector('.auth-modal-close-btn');
//       if (authModalClose) {
//           authModalClose.addEventListener('click', () => {
//               authModal.classList.add('hidden');
//           });
//       }
//   }

//   // --- Pre-Order Listeners ---
//   if (preOrderCategories) preOrderCategories.addEventListener("click", (e) => {
//       if (e.target.tagName === "LI") {
//           document.querySelectorAll("#preorder-categories li").forEach(li => li.classList.remove("active"));
//           e.target.classList.add("active");
//           renderPreOrderMenu(e.target.dataset.category);
//       }
//   });
//   if (preOrderCheckoutBtn) preOrderCheckoutBtn.addEventListener("click", openPaymentModal);
//   if (cancelPreOrderVariationBtn) cancelPreOrderVariationBtn.addEventListener("click", () => {
//       if (preOrderVariationModal) preOrderVariationModal.style.display = "none";
//   });
  
//   // --- Payment Modal Listeners ---
//   if (cancelPaymentBtn) cancelPaymentBtn.addEventListener("click", () => {
//       if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
//   });
//   if (receiptFileInput) receiptFileInput.addEventListener("change", handleReceiptFileSelect);
//   if (uploadReceiptBtn) uploadReceiptBtn.addEventListener("click", finalizePreOrder);

//   // --- NEW: Handle Back button in Pre-Order Modal ---
//   if (preorderBackBtn && preOrderModal) {
//       preorderBackBtn.addEventListener('click', handleBackSkip);
//   }

//   // --- NEW: Handle Cart Icon Click to toggle cart items visibility ---
//   if (cartIconContainer && preOrderCartItemsWrapper) {
//       cartIconContainer.addEventListener('click', () => {
//           preOrderCartItemsWrapper.classList.toggle('collapsed');
//       });
//   }
  
//   // Ensure the badge starts hidden if cart is empty
//   if (cartBadge) {
//       if (preOrderCart.length === 0) {
//           cartBadge.style.display = 'none';
//       }
//   }
  
//   // --- Event listener for the Pre-Order Cart Qty Buttons (Delegation) ---
//   if (preOrderCartItems) {
//       preOrderCartItems.addEventListener('click', (e) => {
//           const button = e.target.closest('.preorder-qty-btn');
//           if (button) {
//               const itemId = button.dataset.id;
//               const change = parseInt(button.dataset.change, 10);
//               adjustPreOrderItemQuantity(itemId, change);
//           }
//       });
//   }

//   // ... (other existing listeners: terms, floor toggle, vip)
//   const openTerms = document.getElementById("openTerms");
//   const closeTerms = document.getElementById("closeTerms");
//   const termsModal = document.getElementById("termsModal");
//   if (openTerms && closeTerms && termsModal) {
//     openTerms.addEventListener("click", (e) => { e.preventDefault(); termsModal.classList.remove("hidden"); });
//     closeTerms.addEventListener("click", () => { termsModal.classList.add("hidden"); });
//     window.addEventListener("click", (e) => { if (e.target === termsModal) termsModal.classList.add("hidden"); });
//   }
//   const floorToggle = document.getElementById("floorToggle");
//   const firstFloor = document.getElementById("cafeImageContainer");
//   const secondFloor = document.getElementById("secondFloorContainer");
//   let isUpstairs = false;
//   if (floorToggle && firstFloor && secondFloor) {
//     floorToggle.addEventListener("click", () => {
//       isUpstairs = !isUpstairs;
//       firstFloor.classList.toggle("hidden", isUpstairs);
//       secondFloor.classList.toggle("hidden", !isUpstairs);
//       floorToggle.textContent = isUpstairs ? "See Downstairs" : "See Upstairs";
//     });
//   }
//   const vipModal = document.getElementById("vipModal");
//   const paymentModal = document.getElementById("paymentModal");
//   const closeVip = document.getElementById("closeVip");
//   const cancelVip = document.getElementById("cancelVip");
//   const proceedPayment = document.getElementById("proceedPayment");
//   const closePayment = document.getElementById("closePayment");
//   const closePaymentBtn = document.getElementById("closePaymentBtn");
//   if (closeVip) closeVip.addEventListener("click", () => vipModal.classList.add("hidden"));
//   if (cancelVip) cancelVip.addEventListener("click", () => vipModal.classList.add("hidden"));
//   if (proceedPayment) proceedPayment.addEventListener("click", () => {
//       vipModal.classList.add("hidden");
//       paymentModal.classList.remove("hidden");
//   });
//   function completeVipPayment() {
//       paymentModal.classList.add("hidden");
//       vipPaymentCompleted = true;
//       if(confirmReservationBtn) confirmReservationBtn.click(); // This will now re-run handleReservation
//   }
//   if (closePayment) closePayment.addEventListener("click", completeVipPayment);
//   if (closePaymentBtn) closePaymentBtn.addEventListener("click", completeVipPayment);
//   window.addEventListener("click", (e) => {
//     if (e.target === vipModal) vipModal.classList.add("hidden");
//     if (e.target === paymentModal) paymentModal.classList.add("hidden");
//   });
// });

// js/reservation.js
import { db, auth } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

async function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        const modal = document.getElementById('auth-validation-modal'); // Get the modal

        if (user) {
            // User is LOGGED IN
            currentUserId = user.uid;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const nameInput = document.querySelector('input[name="customerName"]');
                const contactInput = document.querySelector('input[name="contactNumber"]');
                if (nameInput) nameInput.value = userData.fullName || "";
                if (contactInput) contactInput.value = userData.phone || "";
            }
            
            // Hide the modal if it exists
            if (modal) modal.classList.add('hidden');

        } else {
            // User is NOT logged in
            currentUserId = null;
            const nameInput = document.querySelector('input[name="customerName"]');
            const contactInput = document.querySelector('input[name="contactNumber"]');
            if (nameInput) nameInput.value = "";
            if (contactInput) contactInput.value = "";

            // Show the modal if it exists
            if (modal) modal.classList.remove('hidden');
        }
    });
}
const reservationsRef = collection(db, "reservations");
const productsRef = collection(db, "products"); 

let selectedTableId = null;
let occupiedTables = [];
let isVipSelected = false;
let vipPaymentCompleted = false;
let currentUserId = null;

// --- DECLARE ALL DOM ELEMENT VARIABLES WITH 'let' ---
let reservationDateInput, checkAvailabilityBtn, availabilityLoader, availabilityMessage;
let reservationTimeInput, numberOfDinersInput, notesInput, agreeTermsCheckbox, confirmReservationBtn;
let reservationSectionMain; 

// --- Mobile Modal Elements ---
let preOrderModal, preOrderCategories, preOrderGrid, preOrderCartItems, preOrderSubtotal, preOrderTax, preOrderTotal, preOrderCheckoutBtn, clearCartBtnMobile;
let preOrderVariationModal, preOrderVariationTitle, preOrderVariationOptions, cancelPreOrderVariationBtn;
let preOrderPaymentModal, cancelPaymentBtn, paymentTotalAmount, receiptFileInput, receiptPreview, uploadReceiptBtn, receiptPreviewLink;
let preorderBackBtn, cartIconContainer, cartBadge, preOrderCartItemsWrapper;
let paymentBackBtnMobile;

// --- Desktop Section Elements ---
let preOrderSection, preOrderCategoriesDesktop, preOrderGridDesktop, preOrderCartItemsDesktop, preOrderSubtotalDesktop, preOrderTaxDesktop, preOrderTotalDesktop, preOrderCheckoutBtnDesktop, clearCartBtnDesktop;
let paymentSection, cancelPaymentBtnDesktop, paymentTotalAmountDesktop, receiptFileInputDesktop, receiptPreviewDesktop, uploadReceiptBtnDesktop, receiptPreviewLinkDesktop;
let preorderBackBtnDesktop, cartIconContainerDesktop, cartBadgeDesktop, preOrderCartItemsWrapperDesktop;


// --- Pre-Order State ---
let allProductsCache = [];
let preOrderCart = [];

// --- FIX: Add variable to hold reservation data temporarily ---
let currentReservationData = null;
let currentReservationId = null; 
let currentReceiptFile = null;

// ===================================
// CLOUDINARY UPLOAD
// ===================================
async function uploadToCloudinary(file) {
    const CLOUD_NAME = "dofyjwhlu";
    const UPLOAD_PRESET = "cafesync";

    const URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
        const response = await fetch(URL, { method: "POST", body: formData });
        if (!response.ok) throw new Error(`Cloudinary upload failed`);
        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        throw error;
    }
}

// ===================================
// AUTH & RESERVATION FORM
// ===================================

function setDateRestrictions() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];
  if (reservationDateInput) reservationDateInput.min = minDate;
  const max = new Date(today);
  max.setMonth(max.getMonth() + 1);
  const maxDate = max.toISOString().split("T")[0];
  if (reservationDateInput) reservationDateInput.max = maxDate;
}

function updateTableVisuals() {
  document.querySelectorAll(".table-spot, .vip-room-btn").forEach((spot) => {
    const id = spot.getAttribute("data-id");
    spot.classList.remove("available", "occupied", "selected");
    if (occupiedTables.includes(String(id))) {
      spot.classList.add("occupied");
    } else {
      spot.classList.add("available");
    }
  });
  if (selectedTableId) {
    if (occupiedTables.includes(String(selectedTableId))) {
      selectedTableId = null;
      document.getElementById("selectedTableInfo")?.classList.remove("show");
    } else {
      const mySpot = document.querySelector(`[data-id="${selectedTableId}"]`);
      if (mySpot) {
        mySpot.classList.remove("available", "occupied");
        mySpot.classList.add("selected");
        document.getElementById("selectedTableNumber").textContent = selectedTableId;
        document.getElementById("selectedTableInfo").classList.add("show");
      }
    }
  }
}

function initializeTableClicks() {
  const tableSpots = document.querySelectorAll(".table-spot, .vip-room-btn");
  tableSpots.forEach((spot) => {
    const tableId = spot.getAttribute("data-id");
    spot.classList.add("available");
    spot.addEventListener("click", () => {
        if (reservationTimeInput && reservationTimeInput.disabled) {
            alert("Please select a date and click 'Check Availability' first.");
            return;
        }
      if (occupiedTables.includes(String(tableId))) {
        alert("This table is already occupied. Please select another table.");
        return;
      }
      isVipSelected = spot.classList.contains("vip-room-btn");
      document.querySelectorAll(".table-spot.selected, .vip-room-btn.selected").forEach((s) => {
        s.classList.remove("selected");
        s.classList.add("available");
      });
      selectedTableId = String(tableId);
      spot.classList.remove("available");
      spot.classList.add("selected");
      updateSelectedTableInfo(isVipSelected ? "VIP Room" : selectedTableId);
    });
  });
}

function updateSelectedTableInfo(tableId) {
  const selectedTableInfo = document.getElementById("selectedTableInfo");
  const selectedTableNumber = document.getElementById("selectedTableNumber");
  if (selectedTableNumber) selectedTableNumber.textContent = tableId;
  if (selectedTableInfo) selectedTableInfo.classList.add("show");
}

function setFormDisabled(disabled) {
    if (reservationTimeInput) reservationTimeInput.disabled = disabled;
    if (numberOfDinersInput) numberOfDinersInput.disabled = disabled;
    if (notesInput) notesInput.disabled = disabled;
    if (agreeTermsCheckbox) agreeTermsCheckbox.disabled = disabled;
    if (confirmReservationBtn) confirmReservationBtn.disabled = disabled;
    if (disabled) {
        selectedTableId = null;
        isVipSelected = false;
        vipPaymentCompleted = false;
        document.getElementById("selectedTableInfo")?.classList.remove("show");
        document.querySelectorAll(".table-spot.selected, .vip-room-btn.selected").forEach((s) => {
            s.classList.remove("selected");
        });
        if (availabilityMessage) {
            availabilityMessage.textContent = "Please select a date to see available tables.";
        }
    }
}

async function checkAvailability() {
    if (!currentUserId) {
        const modal = document.getElementById('auth-validation-modal');
        if (modal) modal.classList.remove('hidden');
        return; 
    }

    const selectedDate = reservationDateInput.value;
    if (!selectedDate) {
        alert("Please select a valid date.");
        return;
    }
    if (checkAvailabilityBtn) checkAvailabilityBtn.disabled = true;
    if (availabilityLoader) availabilityLoader.classList.remove("hidden");
    if (availabilityMessage) availabilityMessage.textContent = "Checking available tables...";
    occupiedTables = [];
    try {
        const q = query(
            reservationsRef, 
            where("date", "==", selectedDate),
            where("status", "==", "pending")
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            occupiedTables.push(String(doc.data().tableNumber));
        });
        updateTableVisuals();
        setFormDisabled(false);
        if (availabilityMessage) availabilityMessage.textContent = `Showing availability for ${selectedDate}.`;
    } catch (err) {
        console.error("Error checking availability:", err);
        if (availabilityMessage) availabilityMessage.textContent = "Error loading tables. Please try again.";
    } finally {
        if (checkAvailabilityBtn) checkAvailabilityBtn.disabled = false;
        if (availabilityLoader) availabilityLoader.classList.add("hidden");
    }
}

// --- MODIFIED: Reservation submit now checks screen size ---
async function handleReservation(event) {
  event.preventDefault();
  if (!selectedTableId) {
    alert("Please select an available table from the map.");
    return;
  }
  if (reservationTimeInput && reservationTimeInput.disabled) {
      alert("Please check for table availability on a specific date first.");
      return;
  }
  if (isVipSelected && !vipPaymentCompleted) {
    const vipModal = document.getElementById("vipModal");
    if (vipModal) vipModal.classList.remove("hidden");
    return;
  }

  const formData = new FormData(event.target);
  
  currentReservationData = {
    name: formData.get("customerName"),
    contactNumber: formData.get("contactNumber"),
    numOfDiners: formData.get("numberOfDiners"),
    date: formData.get("reservationDate"),
    time: formData.get("reservationTime"),
    notes: formData.get("notes") || "None",
    tableNumber: String(selectedTableId),
    status: "pending",
    isVip: isVipSelected,
    vipPaymentStatus: vipPaymentCompleted ? "paid" : "n/a",
    timestamp: new Date(),
    userId: currentUserId,
    preOrder: [], 
    paymentReceiptUrl: null 
  };
  
  if (!currentReservationData.name || !currentReservationData.contactNumber) {
      alert("Please enter your Full Name and Contact Number.");
      currentReservationData = null; 
      return;
  }
  
  if(confirmReservationBtn) confirmReservationBtn.disabled = true;
  currentReservationId = null; 

  // --- NEW: Screen Width Check ---
  if (window.innerWidth <= 992) {
    // --- Mobile: Use Modal Flow ---
    openPreOrderModal();
  } else {
    // --- Desktop: Use REPLACEMENT Flow ---
    if (reservationSectionMain) reservationSectionMain.style.display = 'none'; // HIDE form
    if (preOrderSection) {
        preOrderSection.style.display = 'block'; // SHOW pre-order
        // Manually load and render the menu for this section
        (async () => {
            preOrderCart = [];
            updatePreOrderCart(); // Update desktop cart
            if (allProductsCache.length === 0) {
                await loadPreOrderMenu(true); // Pass true for desktop
            } else {
                renderPreOrderMenu("All", true); // Pass true for desktop
            }
        })();
    }
  }
}

// ===================================
// PRE-ORDER LOGIC (MODIFIED)
// ===================================

// --- 1. Open the main Pre-Order Modal (Mobile only) ---
async function openPreOrderModal() {
    preOrderCart = [];
    updatePreOrderCart(); // Update mobile cart
    
    if (allProductsCache.length === 0) {
        await loadPreOrderMenu(false); // Pass false for mobile
    } else {
        renderPreOrderMenu("All", false); // Pass false for mobile
    }

    if (preOrderModal) preOrderModal.style.display = "block";
}

// --- 2. Load Products from Firestore (Modified) ---
async function loadPreOrderMenu(isDesktop = false) {
    try {
        const q = query(productsRef, where("isVisible", "==", true));
        const snapshot = await getDocs(q);
        allProductsCache = [];
        const categories = new Set();

        snapshot.forEach(doc => {
            const product = { id: doc.id, ...doc.data() };
            allProductsCache.push(product);
            categories.add(product.category);
        });

        // Target the correct category list
        const categoriesList = isDesktop ? preOrderCategoriesDesktop : preOrderCategories;
        if (categoriesList) {
            categoriesList.innerHTML = '<li class="active" data-category="All">All</li>';
            Array.from(categories).sort().forEach(cat => {
                const li = document.createElement("li");
                li.dataset.category = cat;
                li.textContent = cat;
                categoriesList.appendChild(li);
            });
        }
        
        renderPreOrderMenu("All", isDesktop);

    } catch (err) {
        console.error("Error loading products:", err);
        const grid = isDesktop ? preOrderGridDesktop : preOrderGrid;
        if(grid) grid.innerHTML = "<p>Error loading menu.</p>";
    }
}

// --- 3. Render Menu Items (Modified) ---
function renderPreOrderMenu(category, isDesktop = false) {
    const grid = isDesktop ? preOrderGridDesktop : preOrderGrid;
    if (!grid) return;
    grid.innerHTML = ""; 

    const productsToRender = (category === "All")
        ? allProductsCache
        : allProductsCache.filter(p => p.category === category);
    
    if (productsToRender.length === 0) {
        grid.innerHTML = "<p>No items in this category.</p>";
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "preorder-product-card";
        
        let priceDisplay = "";
        if (product.variations && product.variations.length > 0) {
            const minPrice = Math.min(...product.variations.map(v => v.price));
            priceDisplay = `From ₱${minPrice.toFixed(2)}`;
        } else {
            priceDisplay = `₱${product.price.toFixed(2)}`;
        }

        card.innerHTML = `
            <img src="${product.imageUrl || 'assets/sandwich-1.jpg'}" alt="${product.name}">
            <div class="preorder-product-card-info">
                <h4>${product.name}</h4>
                <p>${priceDisplay}</p>
            </div>
        `;
        
        card.onclick = () => handlePreOrderProductClick(product);
        grid.appendChild(card);
    });
}

// --- 4. Handle Clicks on Menu Items (Unchanged) ---
function handlePreOrderProductClick(product) {
    if (product.variations && product.variations.length > 0) {
        if (preOrderVariationModal) {
            preOrderVariationTitle.textContent = `Select ${product.name} Size`;
            preOrderVariationOptions.innerHTML = ""; 
            
            product.variations.forEach(v => {
                const btn = document.createElement("button");
                btn.className = "variation-btn";
                btn.innerHTML = `${v.name} <span class="variation-price">₱${v.price.toFixed(2)}</span>`;
                btn.onclick = () => {
                    const item = { ...product, id: `${product.id}-${v.name}`, name: `${product.name} - ${v.name}`, price: v.price };
                    addItemToPreOrderCart(item);
                    preOrderVariationModal.style.display = "none";
                };
                preOrderVariationOptions.appendChild(btn);
            });
            
            preOrderVariationModal.style.display = "flex";
        }
    } else {
        addItemToPreOrderCart(product);
    }
}

// --- 5. Add to Pre-Order Cart (Unchanged) ---
function addItemToPreOrderCart(item) {
    const existing = preOrderCart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity++;
    } else {
        preOrderCart.push({ ...item, quantity: 1 });
    }
    updatePreOrderCart();
}
function adjustPreOrderItemQuantity(itemId, change) {
    const itemIndex = preOrderCart.findIndex(i => i.id === itemId);
    if (itemIndex === -1) return; // Item not found

    const item = preOrderCart[itemIndex];
    item.quantity += change;

    if (item.quantity <= 0) {
        // Remove item from cart if quantity is 0 or less
        preOrderCart.splice(itemIndex, 1);
    }

    updatePreOrderCart(); // Re-render the cart
}

// --- 6. Update Pre-Order Cart UI (Modified) ---
function updatePreOrderCart() {
    // Determine which set of elements to update
    const isDesktop = window.innerWidth > 992;
    
    const itemsEl = isDesktop ? preOrderCartItemsDesktop : preOrderCartItems;
    const badgeEl = isDesktop ? cartBadgeDesktop : cartBadge;
    const wrapperEl = isDesktop ? preOrderCartItemsWrapperDesktop : preOrderCartItemsWrapper;
    const checkoutBtnEl = isDesktop ? preOrderCheckoutBtnDesktop : preOrderCheckoutBtn;
    const subtotalEl = isDesktop ? preOrderSubtotalDesktop : preOrderSubtotal;
    const taxEl = isDesktop ? preOrderTaxDesktop : preOrderTax;
    const totalEl = isDesktop ? preOrderTotalDesktop : preOrderTotal;
    const paymentTotalEl = isDesktop ? paymentTotalAmountDesktop : paymentTotalAmount;
    const clearCartBtn = isDesktop ? clearCartBtnDesktop : clearCartBtnMobile; // NEW

    if (!itemsEl || !badgeEl) return;
    
    const totalDistinctItems = preOrderCart.length; 
    badgeEl.textContent = totalDistinctItems.toString();
    badgeEl.style.display = totalDistinctItems > 0 ? 'block' : 'none';

    if (preOrderCart.length === 0) {
        itemsEl.innerHTML = `<p style="color: #888; text-align: center;">Your cart is empty.</p>`;
        checkoutBtnEl.disabled = true;
        if (clearCartBtn) clearCartBtn.disabled = true; // NEW
        if (wrapperEl && !wrapperEl.classList.contains('collapsed')) {
             wrapperEl.classList.add('collapsed');
        }
    } else {
        itemsEl.innerHTML = "";
        preOrderCart.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "preorder-cart-item";
            
            itemEl.innerHTML = `
                <span class="name">${item.name}</span>
                <div class="preorder-qty-controls">
                    <button class="preorder-qty-btn" data-id="${item.id}" data-change="-1">−</button>
                    <span class="qty-display">${item.quantity}</span>
                    <button class="preorder-qty-btn" data-id="${item.id}" data-change="1">+</button>
                </div>
                <span class="price">₱${(item.price * item.quantity).toFixed(2)}</span>
            `;
            itemsEl.appendChild(itemEl);
        });
        checkoutBtnEl.disabled = false;
        if (clearCartBtn) clearCartBtn.disabled = false; // NEW
        if (wrapperEl && wrapperEl.classList.contains('collapsed')) {
             wrapperEl.classList.remove('collapsed');
        }
    }
    
    // Update totals
    const subtotal = preOrderCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;
    const total = subtotal + tax;
    
    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
    if (taxEl) taxEl.textContent = `₱${tax.toFixed(2)}`;
    if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;
    if (paymentTotalEl) paymentTotalEl.textContent = `₱${total.toFixed(2)}`;
}

// --- 7. Open Payment Modal (Modified) ---
function openPaymentModal() {
    if (preOrderCart.length === 0) return;
    
    const isDesktop = window.innerWidth > 992;
    const receiptFile = isDesktop ? receiptFileInputDesktop : receiptFileInput;
    const uploadBtn = isDesktop ? uploadReceiptBtnDesktop : uploadReceiptBtn;
    const previewLink = isDesktop ? receiptPreviewLinkDesktop : receiptPreviewLink; // UPDATED
    
    currentReceiptFile = null;
    if (receiptFile) receiptFile.value = "";
    if (previewLink) previewLink.style.display = "none"; // UPDATED
    if (uploadBtn) uploadBtn.disabled = true;
    
    if (window.innerWidth <= 992) {
        // --- Mobile: Use Modal Flow ---
        if (preOrderPaymentModal) preOrderPaymentModal.style.display = "block";
    } else {
        // --- Desktop: Use REPLACEMENT Flow ---
        if (preOrderSection) preOrderSection.style.display = 'none'; // HIDE pre-order
        if (paymentSection) paymentSection.style.display = 'block'; // SHOW payment
    }
}

// --- 8. Handle Receipt File Selection (Modified) ---
function handleReceiptFileSelect(event, isDesktop = false) {
    const uploadBtn = isDesktop ? uploadReceiptBtnDesktop : uploadReceiptBtn;
    const previewLink = isDesktop ? receiptPreviewLinkDesktop : receiptPreviewLink; // UPDATED

    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large (Max 5MB).');
            return;
        }
        currentReceiptFile = file;

        // Use URL.createObjectURL for lightweight preview
        const objectURL = URL.createObjectURL(file);
        
        if (previewLink) {
            previewLink.dataset.src = objectURL; // Store the URL on the button
            previewLink.style.display = "block"; // Show the button
        }
        
        if (uploadBtn) uploadBtn.disabled = false;
    } else {
        currentReceiptFile = null;
        if (previewLink) {
            previewLink.style.display = "none"; // Hide the button
            previewLink.dataset.src = "";
        }
        if (uploadBtn) uploadBtn.disabled = true;
    }
}

// --- 9. Finalize: Upload Receipt and Update Reservation (Modified) ---
async function finalizePreOrder() {
    if (!currentReceiptFile || !currentReservationData) {
        alert("Please upload a receipt screenshot.");
        return;
    }
    
    const isDesktop = window.innerWidth > 992;
    const uploadBtn = isDesktop ? uploadReceiptBtnDesktop : uploadReceiptBtn;

    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.textContent = "Uploading...";
    }

    try {
        const receiptUrl = await uploadToCloudinary(currentReceiptFile);
        
        const preOrderData = preOrderCart.map(item => ({
            productId: item.id.split('-')[0],
            name: item.name,
            quantity: item.quantity,
            pricePerItem: item.price
        }));
        
        currentReservationData.preOrder = preOrderData;
        currentReservationData.paymentReceiptUrl = receiptUrl;

        await saveReservation();

    } catch (err) {
        console.error("Error finalizing pre-order:", err);
        alert("There was an error saving your pre-order. Please try again.");
    } finally {
        if (uploadBtn) {
            uploadBtn.disabled = false;
            uploadBtn.textContent = "Confirm Pre-Order";
        }
    }
}

// --- 10. Handle Back/Skip (UPDATED) ---
async function handleBackSkip() {
    // This function now does the same thing on mobile and desktop:
    // It cancels the reservation process and goes back to the main form.
    
    if (window.innerWidth <= 992) {
        // --- Mobile: Hide Modal ---
        if (preOrderModal) preOrderModal.style.display = 'none'; 
    } else {
        // --- Desktop: Hide Section and show previous ---
        if (preOrderSection) preOrderSection.style.display = 'none';
        if (reservationSectionMain) reservationSectionMain.style.display = 'flex'; // Show form again
    }
    
    // --- Logic for both platforms ---
    // Re-enable the "Confirm Reservation" button so the user can try again
    if(confirmReservationBtn) confirmReservationBtn.disabled = false;
    
    // Clear the temporary reservation data
    currentReservationData = null; 
    
    // Reset the pre-order cart
    preOrderCart = [];
    updatePreOrderCart(); // This will update both mobile/desktop carts
}

// --- 11. Central Save Function (Unchanged) ---
async function saveReservation() {
    if (!currentReservationData) {
        console.log("No reservation data to save.");
        if(confirmReservationBtn) confirmReservationBtn.disabled = false;
        return; 
    }
    
    if (currentReservationId) {
        console.log("Reservation already saved.");
        return; 
    }

    try {
        const docRef = await addDoc(reservationsRef, currentReservationData);
        currentReservationId = docRef.id; 
        console.log("✅ Reservation saved to Firestore, ID:", docRef.id);
        
        showFinalSuccessMessage();

    } catch (err) {
        console.error("Error saving reservation:", err);
        alert("Could not save reservation. Check console for details.");
        if(confirmReservationBtn) confirmReservationBtn.disabled = false;
    } finally {
        currentReservationData = null; 
    }
}


// --- 12. Show Final Success Message and Reset (Modified) ---
function showFinalSuccessMessage() {
    if (window.innerWidth <= 992) {
        // --- Mobile: Hide Modals ---
        if (preOrderModal) preOrderModal.style.display = "none";
        if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
    } else {
        // --- Desktop: Hide Sections ---
        if (paymentSection) paymentSection.style.display = 'none';
        if (reservationSectionMain) reservationSectionMain.style.display = 'flex'; // Show form
    }
    
    document.getElementById("reservationForm")?.reset();
    setFormDisabled(true);
    if (reservationDateInput) reservationDateInput.value = "";
    checkAuthState(); // Re-fill user data
    updateTableVisuals(); 
    
    document.getElementById("successMessage")?.classList.add("show");
    setTimeout(() => {
        document.getElementById("successMessage")?.classList.remove("show");
    }, 3000); 
    
    if (confirmReservationBtn) confirmReservationBtn.disabled = false;
}


// ===================================
// INITIALIZE
// ===================================

document.addEventListener("DOMContentLoaded", () => {
  // --- Assign Reservation Form elements ---
  reservationDateInput = document.getElementById("reservationDate");
  checkAvailabilityBtn = document.getElementById("checkAvailabilityBtn");
  availabilityLoader = document.getElementById("availabilityLoader");
  availabilityMessage = document.getElementById("availability-message");
  reservationTimeInput = document.getElementById("reservationTime");
  numberOfDinersInput = document.getElementById("numberOfDiners");
  notesInput = document.getElementById("notes");
  agreeTermsCheckbox = document.getElementById("agreeTerms");
  confirmReservationBtn = document.getElementById("confirmReservationBtn");
  reservationSectionMain = document.getElementById("reservation-section-main"); 

  // --- Assign Pre-Order Modal elements ---
  preOrderModal = document.getElementById("preorder-modal");
  preOrderCategories = document.getElementById("preorder-categories");
  preOrderGrid = document.getElementById("preorder-grid");
  preOrderCartItems = document.getElementById("preOrderCartItems");
  preOrderSubtotal = document.getElementById("preOrderSubtotal");
  preOrderTax = document.getElementById("preOrderTax");
  preOrderTotal = document.getElementById("preOrderTotal");
  preOrderCheckoutBtn = document.getElementById("preOrderCheckoutBtn");
  clearCartBtnMobile = document.getElementById("clear-cart-btn-mobile"); 
  
  // --- Assign Variation Modal elements ---
  preOrderVariationModal = document.getElementById("preorder-variation-modal");
  preOrderVariationTitle = document.getElementById("preorder-variation-title");
  preOrderVariationOptions = document.getElementById("preorder-variation-options");
  cancelPreOrderVariationBtn = document.getElementById("cancel-preorder-variation");
  
  // --- Assign Payment Modal elements ---
  preOrderPaymentModal = document.getElementById("preorder-payment-modal");
  cancelPaymentBtn = document.getElementById("cancel-payment-btn");
  paymentTotalAmount = document.getElementById("payment-total-amount");
  receiptFileInput = document.getElementById("receipt-file-input");
  receiptPreviewLink = document.getElementById("receipt-preview-link"); 
  uploadReceiptBtn = document.getElementById("upload-receipt-btn");
  paymentBackBtnMobile = document.getElementById("payment-back-btn-mobile"); 

  // --- Assign Mobile Cart Icon & Header Elements ---
  preorderBackBtn = document.querySelector("#preorder-modal .preorder-back-btn");
  cartIconContainer = document.getElementById("cartIconContainer");
  cartBadge = document.getElementById("cartBadge");
  preOrderCartItemsWrapper = document.getElementById("preOrderCartItemsWrapper");

  // --- Assign Desktop Section Elements ---
  preOrderSection = document.getElementById("preorder-section");
  preOrderCategoriesDesktop = document.getElementById("preorder-categories-desktop");
  preOrderGridDesktop = document.getElementById("preorder-grid-desktop");
  preOrderCartItemsDesktop = document.getElementById("preOrderCartItems-desktop");
  preOrderSubtotalDesktop = document.getElementById("preOrderSubtotal-desktop");
  preOrderTaxDesktop = document.getElementById("preOrderTax-desktop");
  preOrderTotalDesktop = document.getElementById("preOrderTotal-desktop");
  preOrderCheckoutBtnDesktop = document.getElementById("preOrderCheckoutBtn-desktop");
  clearCartBtnDesktop = document.getElementById("clear-cart-btn-desktop"); // NEW
  paymentSection = document.getElementById("payment-section");
  cancelPaymentBtnDesktop = document.getElementById("cancel-payment-btn-desktop");
  paymentTotalAmountDesktop = document.getElementById("payment-total-amount-desktop");
  receiptFileInputDesktop = document.getElementById("receipt-file-input-desktop");
  receiptPreviewLinkDesktop = document.getElementById("receipt-preview-link-desktop"); // UPDATED
  uploadReceiptBtnDesktop = document.getElementById("upload-receipt-btn-desktop");
  preorderBackBtnDesktop = document.querySelector("#preorder-section .preorder-back-btn");
  cartIconContainerDesktop = document.getElementById("cartIconContainer-desktop");
  cartBadgeDesktop = document.getElementById("cartBadge-desktop");
  preOrderCartItemsWrapperDesktop = document.getElementById("preOrderCartItemsWrapper-desktop");

  // --- NEW: Assign Receipt Preview Modal Elements ---
  const receiptModal = document.getElementById("reservation-receipt-modal");
  const receiptModalImage = document.getElementById("receipt-modal-image");
  const closeReceiptModalBtn = document.getElementById("close-receipt-modal");

  
  // --- Standard Init ---
  setDateRestrictions();
  initializeTableClicks();
  checkAuthState();
  setFormDisabled(true);

  // --- Reservation Form Listeners ---
  if (checkAvailabilityBtn) checkAvailabilityBtn.addEventListener("click", checkAvailability);
  if (reservationDateInput) reservationDateInput.addEventListener("input", () => setFormDisabled(true));
  const form = document.getElementById("reservationForm");
  if (form) form.addEventListener("submit", handleReservation);

  // --- Auth Modal Close Button ---
  const authModal = document.getElementById('auth-validation-modal');
  if (authModal) {
      const authModalClose = authModal.querySelector('.auth-modal-close-btn');
      if (authModalClose) {
          authModalClose.addEventListener('click', () => {
              authModal.classList.add('hidden');
          });
      }
  }

  // --- Pre-Order Listeners (Mobile) ---
  if (preOrderCategories) preOrderCategories.addEventListener("click", (e) => {
      if (e.target.tagName === "LI") {
          document.querySelectorAll("#preorder-categories li").forEach(li => li.classList.remove("active"));
          e.target.classList.add("active");
          renderPreOrderMenu(e.target.dataset.category, false); // Mobile
      }
  });
  if (preOrderCheckoutBtn) preOrderCheckoutBtn.addEventListener("click", openPaymentModal);
  if (cancelPreOrderVariationBtn) cancelPreOrderVariationBtn.addEventListener("click", () => {
      if (preOrderVariationModal) preOrderVariationModal.style.display = "none";
  });
  
  // --- Payment Modal Listeners (Mobile) ---
  if (cancelPaymentBtn) cancelPaymentBtn.addEventListener("click", () => {
      if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
  });
  if (receiptFileInput) receiptFileInput.addEventListener("change", (e) => handleReceiptFileSelect(e, false)); // Mobile
  if (uploadReceiptBtn) uploadReceiptBtn.addEventListener("click", finalizePreOrder);

  // --- Mobile Back Button ---
  if (preorderBackBtn && preOrderModal) {
      preorderBackBtn.addEventListener('click', handleBackSkip);
  }
// --- NEW: Payment Modal Back Button (Mobile) ---
  if (paymentBackBtnMobile) {
      paymentBackBtnMobile.addEventListener('click', () => {
          if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
          if (preOrderModal) preOrderModal.style.display = "block";
      });
  }
  // --- Mobile Cart Icon Click ---
  if (cartIconContainer && preOrderCartItemsWrapper) {
      cartIconContainer.addEventListener('click', () => {
          preOrderCartItemsWrapper.classList.toggle('collapsed');
      });
  }
  
  // --- Mobile Cart Qty Buttons (Delegation) ---
  if (preOrderCartItems) {
      preOrderCartItems.addEventListener('click', (e) => {
          const button = e.target.closest('.preorder-qty-btn');
          if (button) {
              const itemId = button.dataset.id;
              const change = parseInt(button.dataset.change, 10);
              adjustPreOrderItemQuantity(itemId, change);
          }
      });
  }

  // --- Pre-Order Listeners (Desktop) ---
  if (preOrderCategoriesDesktop) preOrderCategoriesDesktop.addEventListener("click", (e) => {
      if (e.target.tagName === "LI") {
          document.querySelectorAll("#preorder-categories-desktop li").forEach(li => li.classList.remove("active"));
          e.target.classList.add("active");
          renderPreOrderMenu(e.target.dataset.category, true); // Desktop
      }
  });
  if (preOrderCheckoutBtnDesktop) preOrderCheckoutBtnDesktop.addEventListener("click", openPaymentModal);

  // --- Payment Modal Listeners (Desktop) ---
  if (cancelPaymentBtnDesktop) cancelPaymentBtnDesktop.addEventListener("click", () => {
      if (paymentSection) paymentSection.style.display = "none";
      if (preOrderSection) preOrderSection.style.display = "block"; // Show pre-order section again
  });
  if (receiptFileInputDesktop) receiptFileInputDesktop.addEventListener("change", (e) => handleReceiptFileSelect(e, true)); // Desktop
  if (uploadReceiptBtnDesktop) uploadReceiptBtnDesktop.addEventListener("click", finalizePreOrder);

  // --- Desktop Back Button ---
  if (preorderBackBtnDesktop && preOrderSection) {
      preorderBackBtnDesktop.addEventListener('click', handleBackSkip);
  }

  // --- Desktop Cart Icon Click ---
  if (cartIconContainerDesktop && preOrderCartItemsWrapperDesktop) {
      cartIconContainerDesktop.addEventListener('click', () => {
          preOrderCartItemsWrapperDesktop.classList.toggle('collapsed');
      });
  }
  
  // --- Desktop Cart Qty Buttons (DelegATION) ---
  if (preOrderCartItemsDesktop) {
      preOrderCartItemsDesktop.addEventListener('click', (e) => {
          const button = e.target.closest('.preorder-qty-btn');
          if (button) {
              const itemId = button.dataset.id;
              const change = parseInt(button.dataset.change, 10);
              adjustPreOrderItemQuantity(itemId, change);
          }
      });
  }

  // --- Clear Cart Button Listeners ---
  const clearCartAction = () => {
      if (preOrderCart.length > 0 && confirm("Are you sure you want to clear your cart?")) {
          preOrderCart = [];
          updatePreOrderCart();
      }
  };
  if (clearCartBtnMobile) clearCartBtnMobile.addEventListener('click', clearCartAction);
  if (clearCartBtnDesktop) clearCartBtnDesktop.addEventListener('click', clearCartAction);


  // --- NEW: Receipt Preview Modal Listeners ---
  const openReceiptModal = (e) => {
      const src = e.target.dataset.src;
      if (src && receiptModal && receiptModalImage) {
          receiptModalImage.src = src;
          receiptModal.classList.remove("hidden");
      }
  };
  const closeReceiptModal = () => {
      if (receiptModal) receiptModal.classList.add("hidden");
      if (receiptModalImage) receiptModalImage.src = ""; // Clear image
  };

  if (receiptPreviewLink) receiptPreviewLink.addEventListener('click', openReceiptModal);
  if (receiptPreviewLinkDesktop) receiptPreviewLinkDesktop.addEventListener('click', openReceiptModal);
  if (closeReceiptModalBtn) closeReceiptModalBtn.addEventListener('click', closeReceiptModal);
  if (receiptModal) receiptModal.addEventListener('click', (e) => {
      if (e.target === receiptModal) closeReceiptModal(); // Close on backdrop click
  });


  // Ensure the badges start hidden
  if (cartBadge) cartBadge.style.display = 'none';
  if (cartBadgeDesktop) cartBadgeDesktop.style.display = 'none';
  

  // ... (other existing listeners: terms, floor toggle, vip)
  const openTerms = document.getElementById("openTerms");
  const closeTerms = document.getElementById("closeTerms");
  const termsModal = document.getElementById("termsModal");
  if (openTerms && closeTerms && termsModal) {
    openTerms.addEventListener("click", (e) => { e.preventDefault(); termsModal.classList.remove("hidden"); });
    closeTerms.addEventListener("click", () => { termsModal.classList.add("hidden"); });
    window.addEventListener("click", (e) => { if (e.target === termsModal) termsModal.classList.add("hidden"); });
  }
  const floorToggle = document.getElementById("floorToggle");
  const firstFloor = document.getElementById("cafeImageContainer");
  const secondFloor = document.getElementById("secondFloorContainer");
  let isUpstairs = false;
  if (floorToggle && firstFloor && secondFloor) {
    floorToggle.addEventListener("click", () => {
      isUpstairs = !isUpstairs;
      firstFloor.classList.toggle("hidden", isUpstairs);
      secondFloor.classList.toggle("hidden", !isUpstairs);
      floorToggle.textContent = isUpstairs ? "See Downstairs" : "See Upstairs";
    });
  }
  const vipModal = document.getElementById("vipModal");
  const paymentModal = document.getElementById("paymentModal");
  const closeVip = document.getElementById("closeVip");
  const cancelVip = document.getElementById("cancelVip");
  const proceedPayment = document.getElementById("proceedPayment");
  const closePayment = document.getElementById("closePayment");
  const closePaymentBtn = document.getElementById("closePaymentBtn");
  if (closeVip) closeVip.addEventListener("click", () => vipModal.classList.add("hidden"));
  if (cancelVip) cancelVip.addEventListener("click", () => vipModal.classList.add("hidden"));
  if (proceedPayment) proceedPayment.addEventListener("click", () => {
      vipModal.classList.add("hidden");
      paymentModal.classList.remove("hidden");
  });
  function completeVipPayment() {
      paymentModal.classList.add("hidden");
      vipPaymentCompleted = true;
      if(confirmReservationBtn) confirmReservationBtn.click(); // This will now re-run handleReservation
  }
  if (closePayment) closePayment.addEventListener("click", completeVipPayment);
  if (closePaymentBtn) closePaymentBtn.addEventListener("click", completeVipPayment);
  window.addEventListener("click", (e) => {
    if (e.target === vipModal) vipModal.classList.add("hidden");
    if (e.target === paymentModal) paymentModal.classList.add("hidden");
  });
});