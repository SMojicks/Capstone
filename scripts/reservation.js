// js/reservation.js
import { db, auth } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,       // 👈 ADD THIS
  getDoc     // 👈 ADD THIS
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";


const reservationsRef = collection(db, "reservations");

let selectedTableId = null;
let occupiedTables = [];
let isVipSelected = false;
let vipPaymentCompleted = false;
let currentUserId = null; // 👈 ADD THIS


async function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // User is logged in
            currentUserId = user.uid;
            const userDocRef = doc(db, "users", user.uid);
            const userDoc = await getDoc(userDocRef);

            if (userDoc.exists()) {
                const userData = userDoc.data();
                const nameInput = document.querySelector('input[name="customerName"]');
                const contactInput = document.querySelector('input[name="contactNumber"]');

                if (nameInput) {
                    nameInput.value = userData.fullName;
                    nameInput.readOnly = true;
                }
                if (contactInput) {
                    contactInput.value = userData.phone;
                    contactInput.readOnly = true;
                }
            }
        } else {
            // User is logged out
            currentUserId = null;
            const nameInput = document.querySelector('input[name="customerName"]');
            const contactInput = document.querySelector('input[name="contactNumber"]');
            if (nameInput) nameInput.readOnly = false;
            if (contactInput) contactInput.readOnly = false;
        }
    });
}

// ---------- DOM helpers ----------
function setMinDate() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateInput = document.getElementById("reservationDate");
  if (dateInput) dateInput.min = tomorrow.toISOString().split("T")[0];
}

function updateTableVisuals() {
  document.querySelectorAll(".table-spot").forEach((spot) => {
    const id = spot.getAttribute("data-id");
    spot.classList.remove("available", "occupied", "selected");

    if (occupiedTables.includes(String(id))) {
      spot.classList.add("occupied");
    } else {
      spot.classList.add("available");
    }
  });

  // If user had selected a table, reapply selection (only if still available)
  if (selectedTableId) {
    if (occupiedTables.includes(String(selectedTableId))) {
      // someone else reserved it — clear selection
      selectedTableId = null;
      document.getElementById("selectedTableInfo")?.classList.remove("show");
      // optional: notify user
      // alert("The table you selected was just reserved. Please choose another.");
    } else {
      const mySpot = document.querySelector(`.table-spot[data-id="${selectedTableId}"]`);
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
  // Select ALL table spots (both floors)
  const tableSpots = document.querySelectorAll(".table-spot");
  tableSpots.forEach((spot) => {
    const tableId = spot.getAttribute("data-id");
    spot.classList.add("available");

    spot.addEventListener("click", () => {
      if (occupiedTables.includes(String(tableId))) {
        alert("This table is already occupied. Please select another table.");
        return;
      }

      // Deselect any previously selected
      document.querySelectorAll(".table-spot.selected").forEach((s) => {
        s.classList.remove("selected");
        s.classList.add("available");
      });

      // Select new one
      selectedTableId = String(tableId);
      spot.classList.remove("available");
      spot.classList.add("selected");
      updateSelectedTableInfo(selectedTableId);
    });
  });
}

function updateSelectedTableInfo(tableId) {
  const selectedTableInfo = document.getElementById("selectedTableInfo");
  const selectedTableNumber = document.getElementById("selectedTableNumber");
  if (selectedTableNumber) selectedTableNumber.textContent = tableId;
  selectedTableInfo?.classList.add("show");
}

// ---------- Firestore real-time listener ----------
onSnapshot(reservationsRef, (snapshot) => {
  // Map reservations where status === "pending" -> tableNumber (as strings)
  occupiedTables = snapshot.docs
    .map((d) => d.data())
    .filter((r) => r.status === "pending")
    .map((r) => String(r.tableNumber));

  console.log("onSnapshot - pending occupiedTables:", occupiedTables);
  updateTableVisuals();
});

// ---------- Form submit & save ----------
async function handleReservation(event) {
  event.preventDefault();

  if (!selectedTableId) {
    alert("Please select a table before making a reservation.");
    return;
  }

  // Check if VIP room selected and payment not completed
  if (isVipSelected && !vipPaymentCompleted) {
    vipModal.classList.remove("hidden");
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
    userId: currentUserId // 👈 ADD THIS: Attach the logged-in user's ID
  };
  
  // 🚀 NEW: Check for non-logged-in user
  if (!reservationData.name || !reservationData.contactNumber) {
      alert("Please enter your Full Name and Contact Number.");
      return;
  }

  try {
    const docRef = await addDoc(reservationsRef, reservationData);
    console.log("✅ Reservation saved, id:", docRef.id, reservationData);

    document.getElementById("successMessage")?.classList.add("show");
    setTimeout(() => {
      document.getElementById("reservationForm")?.reset();
      document.getElementById("successMessage")?.classList.remove("show");
      document.getElementById("selectedTableInfo")?.classList.remove("show");
      
      // Reset VIP states
      selectedTableId = null;
      isVipSelected = false;
      vipPaymentCompleted = false;
      
      // Remove selected class from VIP button
      document.querySelectorAll(".vip-room-btn.selected").forEach((btn) => {
        btn.classList.remove("selected");
      });
      // Re-run auth check to pre-fill again if user is still logged in
      checkAuthState();
    }, 1800);
  } catch (err) {
    console.error("Error saving reservation:", err);
    alert("Could not save reservation. Check console for details.");
  }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
  setMinDate();
  initializeTableClicks();
  checkAuthState(); // 👈 ADD THIS: Check for logged-in user on page load
// Terms and Conditions modal logic
const openTerms = document.getElementById("openTerms");
const closeTerms = document.getElementById("closeTerms");
const termsModal = document.getElementById("termsModal");

if (openTerms && closeTerms && termsModal) {
  openTerms.addEventListener("click", (e) => {
    e.preventDefault();
    termsModal.classList.remove("hidden");
  });

  closeTerms.addEventListener("click", () => {
    termsModal.classList.add("hidden");
  });

  // Close modal when clicking outside
  window.addEventListener("click", (e) => {
    if (e.target === termsModal) {
      termsModal.classList.add("hidden");
    }
  });
}
 // Floor Toggle Logic
const floorToggle = document.getElementById("floorToggle");
const firstFloor = document.getElementById("cafeImageContainer");
const secondFloor = document.getElementById("secondFloorContainer");

let isUpstairs = false;

if (floorToggle && firstFloor && secondFloor) {
  floorToggle.addEventListener("click", () => {
    isUpstairs = !isUpstairs;
    
    if (isUpstairs) {
      firstFloor.classList.add("hidden");
      secondFloor.classList.remove("hidden");
      floorToggle.textContent = "See Downstairs";
    } else {
      firstFloor.classList.remove("hidden");
      secondFloor.classList.add("hidden");
      floorToggle.textContent = "See Upstairs";
    }
  });
}
// VIP Room Modal Logic
const vipModal = document.getElementById("vipModal");
const paymentModal = document.getElementById("paymentModal");
const closeVip = document.getElementById("closeVip");
const cancelVip = document.getElementById("cancelVip");
const proceedPayment = document.getElementById("proceedPayment");
const closePayment = document.getElementById("closePayment");
const closePaymentBtn = document.getElementById("closePaymentBtn");



// VIP Room button click
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("vip-room-btn")) {
    const vipId = e.target.getAttribute("data-id");
    
    // Check if occupied
    if (occupiedTables.includes(String(vipId))) {
      alert("VIP Room is already reserved.");
      return;
    }
    
    // Deselect other tables
    document.querySelectorAll(".table-spot.selected, .vip-room-btn.selected").forEach((s) => {
      s.classList.remove("selected");
    });
    
    // Select VIP room
    e.target.classList.add("selected");
    selectedTableId = String(vipId);
    isVipSelected = true;
    updateSelectedTableInfo("VIP Room");
  }
});

// Close VIP modal
if (closeVip) {
  closeVip.addEventListener("click", () => {
    vipModal.classList.add("hidden");
  });
}

if (cancelVip) {
  cancelVip.addEventListener("click", () => {
    vipModal.classList.add("hidden");
  });
}

// Proceed to payment
if (proceedPayment) {
  proceedPayment.addEventListener("click", () => {
    vipModal.classList.add("hidden");
    paymentModal.classList.remove("hidden");
  });
}

// Close payment modal and complete reservation
if (closePayment) {
  closePayment.addEventListener("click", () => {
    paymentModal.classList.add("hidden");
    vipPaymentCompleted = true;
    // Trigger form submission
    document.getElementById("reservationForm").dispatchEvent(new Event('submit'));
  });
}

if (closePaymentBtn) {
  closePaymentBtn.addEventListener("click", () => {
    paymentModal.classList.add("hidden");
    vipPaymentCompleted = true;
    // Trigger form submission
    document.getElementById("reservationForm").dispatchEvent(new Event('submit'));
  });
}

// Close modals when clicking outside
window.addEventListener("click", (e) => {
  if (e.target === vipModal) {
    vipModal.classList.add("hidden");
  }
  if (e.target === paymentModal) {
    paymentModal.classList.add("hidden");
  }
});
  const form = document.getElementById("reservationForm");
  if (form) form.addEventListener("submit", handleReservation);
});
