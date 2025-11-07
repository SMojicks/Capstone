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
  updateDoc // <-- ADD THIS
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";


const reservationsRef = collection(db, "reservations");
const productsRef = collection(db, "products"); // <-- NEW

let selectedTableId = null;
let occupiedTables = [];
let isVipSelected = false;
let vipPaymentCompleted = false;
let currentUserId = null;

// --- Form Elements ---
let reservationDateInput, checkAvailabilityBtn, availabilityLoader, availabilityMessage;
let reservationTimeInput, numberOfDinersInput, notesInput, agreeTermsCheckbox, confirmReservationBtn;

// --- NEW: Pre-Order Elements ---
let preOrderModal, skipPreOrderBtn, preOrderCategories, preOrderGrid, preOrderCartItems, preOrderSubtotal, preOrderTax, preOrderTotal, preOrderCheckoutBtn;
let preOrderVariationModal, preOrderVariationTitle, preOrderVariationOptions, cancelPreOrderVariationBtn;
let preOrderPaymentModal, cancelPaymentBtn, paymentTotalAmount, receiptFileInput, receiptPreview, uploadReceiptBtn;

// --- NEW: Pre-Order State ---
let allProductsCache = [];
let preOrderCart = [];
let currentReservationId = null;
let currentReceiptFile = null;

// ===================================
// CLOUDINARY UPLOAD
// ===================================
async function uploadToCloudinary(file) {
    // --- ⬇️ ⬇️ VITAL: REPLACE THESE WITH YOUR OWN ⬇️ ⬇️ ---
    const CLOUD_NAME = "dofyjwhlu"; // <-- REPLACE WITH YOUR CLOUD_NAME
    const UPLOAD_PRESET = "cafesync"; // <-- REPLACE WITH YOUR UPLOAD_PRESET
    // --- ⬆️ ⬆️ VITAL: REPLACE THESE WITH YOUR OWN ⬆️ ⬆️ ---

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

async function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
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
        } else {
            currentUserId = null;
            const nameInput = document.querySelector('input[name="customerName"]');
            const contactInput = document.querySelector('input[name="contactNumber"]');
            if (nameInput) nameInput.value = "";
            if (contactInput) contactInput.value = "";
        }
    });
}

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

// --- MODIFIED: Reservation submit now opens pre-order ---
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
  const reservationData = {
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
    preOrder: [], // NEW: Initialize pre-order
    paymentReceiptUrl: null // NEW: Initialize receipt URL
  };
  
  if (!reservationData.name || !reservationData.contactNumber) {
      alert("Please enter your Full Name and Contact Number.");
      return;
  }
  
  // --- Disable submit button to prevent double-booking ---
  if(confirmReservationBtn) confirmReservationBtn.disabled = true;

  try {
    const docRef = await addDoc(reservationsRef, reservationData);
    console.log("✅ Reservation saved, id:", docRef.id, reservationData);
    currentReservationId = docRef.id; // <-- Store the new ID

    // --- DON'T show success yet. Open pre-order modal ---
    openPreOrderModal(docRef.id);

  } catch (err) {
    console.error("Error saving reservation:", err);
    alert("Could not save reservation. Check console for details.");
    if(confirmReservationBtn) confirmReservationBtn.disabled = false; // Re-enable on error
  }
}

// ===================================
// NEW: PRE-ORDER LOGIC
// ===================================

// --- 1. Open the main Pre-Order Modal ---
async function openPreOrderModal(reservationId) {
    currentReservationId = reservationId;
    preOrderCart = [];
    updatePreOrderCart();
    
    // Load menu items if not already cached
    if (allProductsCache.length === 0) {
        await loadPreOrderMenu();
    } else {
        // If already cached, just render them
        renderPreOrderMenu("All");
    }

    if (preOrderModal) preOrderModal.style.display = "block";
}

// --- 2. Load Products from Firestore ---
async function loadPreOrderMenu() {
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

        // Populate category sidebar
        if (preOrderCategories) {
            preOrderCategories.innerHTML = '<li class="active" data-category="All">All</li>'; // Reset
            categories.forEach(cat => {
                const li = document.createElement("li");
                li.dataset.category = cat;
                li.textContent = cat;
                preOrderCategories.appendChild(li);
            });
        }
        
        renderPreOrderMenu("All"); // Render all products by default

    } catch (err) {
        console.error("Error loading products:", err);
        if(preOrderGrid) preOrderGrid.innerHTML = "<p>Error loading menu.</p>";
    }
}

// --- 3. Render Menu Items ---
function renderPreOrderMenu(category) {
    if (!preOrderGrid) return;
    preOrderGrid.innerHTML = ""; // Clear grid

    const productsToRender = (category === "All")
        ? allProductsCache
        : allProductsCache.filter(p => p.category === category);
    
    if (productsToRender.length === 0) {
        preOrderGrid.innerHTML = "<p>No items in this category.</p>";
    }

    productsToRender.forEach(product => {
        const card = document.createElement("div");
        card.className = "preorder-product-card";
        
        // Price display logic
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
        preOrderGrid.appendChild(card);
    });
}

// --- 4. Handle Clicks on Menu Items ---
function handlePreOrderProductClick(product) {
    if (product.variations && product.variations.length > 0) {
        // Open variation choice modal
        if (preOrderVariationModal) {
            preOrderVariationTitle.textContent = `Select ${product.name} Size`;
            preOrderVariationOptions.innerHTML = ""; // Clear old
            
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
        // No variations, add directly
        addItemToPreOrderCart(product);
    }
}

// --- 5. Add to Pre-Order Cart ---
function addItemToPreOrderCart(item) {
    const existing = preOrderCart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity++;
    } else {
        preOrderCart.push({ ...item, quantity: 1 });
    }
    updatePreOrderCart();
}

// --- 6. Update Pre-Order Cart UI ---
function updatePreOrderCart() {
    if (!preOrderCartItems) return;
    
    if (preOrderCart.length === 0) {
        preOrderCartItems.innerHTML = `<p style="color: #888; text-align: center;">Your cart is empty.</p>`;
        preOrderCheckoutBtn.disabled = true;
    } else {
        preOrderCartItems.innerHTML = "";
        preOrderCart.forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "preorder-cart-item";
            itemEl.innerHTML = `
                <span class="name">${item.quantity}x ${item.name}</span>
                <span class="price">₱${(item.price * item.quantity).toFixed(2)}</span>
            `;
            preOrderCartItems.appendChild(itemEl);
        });
        preOrderCheckoutBtn.disabled = false;
    }
    
    // Update totals
    const subtotal = preOrderCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.12;
    const total = subtotal + tax;
    
    if (preOrderSubtotal) preOrderSubtotal.textContent = `₱${subtotal.toFixed(2)}`;
    if (preOrderTax) preOrderTax.textContent = `₱${tax.toFixed(2)}`;
    if (preOrderTotal) preOrderTotal.textContent = `₱${total.toFixed(2)}`;
    if (paymentTotalAmount) paymentTotalAmount.textContent = `₱${total.toFixed(2)}`;
}

// --- 7. Open Payment Modal ---
function openPaymentModal() {
    if (preOrderCart.length === 0) return;
    currentReceiptFile = null;
    if (receiptFileInput) receiptFileInput.value = "";
    if (receiptPreview) receiptPreview.style.display = "none";
    if (uploadReceiptBtn) uploadReceiptBtn.disabled = true;
    
    if (preOrderPaymentModal) preOrderPaymentModal.style.display = "block";
}

// --- 8. Handle Receipt File Selection ---
function handleReceiptFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            alert('File is too large (Max 5MB).');
            return;
        }
        currentReceiptFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            if (receiptPreview) {
                receiptPreview.src = e.target.result;
                receiptPreview.style.display = "block";
            }
        };
        reader.readAsDataURL(file);
        if (uploadReceiptBtn) uploadReceiptBtn.disabled = false;
    } else {
        currentReceiptFile = null;
        if (receiptPreview) receiptPreview.style.display = "none";
        if (uploadReceiptBtn) uploadReceiptBtn.disabled = true;
    }
}

// --- 9. Finalize: Upload Receipt and Update Reservation ---
async function finalizePreOrder() {
    if (!currentReceiptFile || !currentReservationId) {
        alert("Please upload a receipt screenshot.");
        return;
    }

    if (uploadReceiptBtn) {
        uploadReceiptBtn.disabled = true;
        uploadReceiptBtn.textContent = "Uploading...";
    }

    try {
        // 1. Upload receipt to Cloudinary
        const receiptUrl = await uploadToCloudinary(currentReceiptFile);
        
        // 2. Prepare pre-order data
        const preOrderData = preOrderCart.map(item => ({
            productId: item.id.split('-')[0],
            name: item.name,
            quantity: item.quantity,
            pricePerItem: item.price
        }));
        
        // 3. Update the reservation in Firestore
        const resDocRef = doc(db, "reservations", currentReservationId);
        await updateDoc(resDocRef, {
            preOrder: preOrderData,
            paymentReceiptUrl: receiptUrl
        });

        // 4. Success!
        showFinalSuccessMessage();

    } catch (err) {
        console.error("Error finalizing pre-order:", err);
        alert("There was an error saving your pre-order. Please try again.");
    } finally {
        if (uploadReceiptBtn) {
            uploadReceiptBtn.disabled = false;
            uploadReceiptBtn.textContent = "Confirm Pre-Order";
        }
    }
}

// --- 10. Show Final Success Message and Reset ---
function showFinalSuccessMessage() {
    if (preOrderModal) preOrderModal.style.display = "none";
    if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
    
    // Reset the main reservation form
    document.getElementById("reservationForm")?.reset();
    setFormDisabled(true);
    if (reservationDateInput) reservationDateInput.value = "";
    checkAuthState(); // Re-fill user data
    
    // Show the success message
    document.getElementById("successMessage")?.classList.add("show");
    setTimeout(() => {
        document.getElementById("successMessage")?.classList.remove("show");
    }, 3000); // Show for 3 seconds
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

  // --- Assign Pre-Order Modal elements ---
  preOrderModal = document.getElementById("preorder-modal");
  skipPreOrderBtn = document.getElementById("skip-preorder-btn");
  preOrderCategories = document.getElementById("preorder-categories");
  preOrderGrid = document.getElementById("preorder-grid");
  preOrderCartItems = document.getElementById("preorder-cart-items");
  preOrderSubtotal = document.getElementById("preorder-subtotal");
  preOrderTax = document.getElementById("preorder-tax");
  preOrderTotal = document.getElementById("preorder-total");
  preOrderCheckoutBtn = document.getElementById("preorder-checkout-btn");
  
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
  receiptPreview = document.getElementById("receipt-preview");
  uploadReceiptBtn = document.getElementById("upload-receipt-btn");
  
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

  // --- Pre-Order Listeners ---
  if (skipPreOrderBtn) skipPreOrderBtn.addEventListener("click", showFinalSuccessMessage);
  if (preOrderCategories) preOrderCategories.addEventListener("click", (e) => {
      if (e.target.tagName === "LI") {
          document.querySelectorAll("#preorder-categories li").forEach(li => li.classList.remove("active"));
          e.target.classList.add("active");
          renderPreOrderMenu(e.target.dataset.category);
      }
  });
  if (preOrderCheckoutBtn) preOrderCheckoutBtn.addEventListener("click", openPaymentModal);
  if (cancelPreOrderVariationBtn) cancelPreOrderVariationBtn.addEventListener("click", () => {
      if (preOrderVariationModal) preOrderVariationModal.style.display = "none";
  });
  
  // --- Payment Modal Listeners ---
  if (cancelPaymentBtn) cancelPaymentBtn.addEventListener("click", () => {
      if (preOrderPaymentModal) preOrderPaymentModal.style.display = "none";
  });
  if (receiptFileInput) receiptFileInput.addEventListener("change", handleReceiptFileSelect);
  if (uploadReceiptBtn) uploadReceiptBtn.addEventListener("click", finalizePreOrder);

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
      if(confirmReservationBtn) confirmReservationBtn.click();
  }
  if (closePayment) closePayment.addEventListener("click", completeVipPayment);
  if (closePaymentBtn) closePaymentBtn.addEventListener("click", completeVipPayment);
  window.addEventListener("click", (e) => {
    if (e.target === vipModal) vipModal.classList.add("hidden");
    if (e.target === paymentModal) paymentModal.classList.add("hidden");
  });
});