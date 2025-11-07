import { db } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Firestore collection reference
const reservationCollection = collection(db, "reservations");
const reservationTableBody = document.querySelector("#reservationTable tbody");

// --- NEW: Modal Elements (for viewing receipt) ---
let imageModal, modalImage, closeImageModal;

// Real-time listener for reservations
onSnapshot(reservationCollection, (snapshot) => {
  if (!reservationTableBody) return;
  reservationTableBody.innerHTML = ""; // Clear old data

  // --- MODIFIED: colspan is now 11 ---
  if (snapshot.empty) {
    reservationTableBody.innerHTML = `
      <tr>
        <td colspan="11" style="text-align: center; padding: 20px; color: #999;">
          No reservations found
        </td>
      </tr>
    `;
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");

    // --- NEW: Process Pre-Order Items into an HTML list ---
    let preOrderCell = "—"; // Default value
    if (data.preOrder && data.preOrder.length > 0) {
        preOrderCell = `<ul class="pre-order-item-list">`;
        data.preOrder.forEach(item => {
            // e.g., "2x Cappuccino - 12oz"
            preOrderCell += `<li>${item.quantity}x ${item.name}</li>`;
        });
        preOrderCell += `</ul>`;
    }
    // --- END NEW ---

    // Check for receipt
    let receiptCell = "—";
    if (data.paymentReceiptUrl) {
        receiptCell = `<button class="btn btn--secondary btn--sm view-receipt-btn" data-src="${data.paymentReceiptUrl}">View</button>`;
    }

    // --- MODIFIED: Added new <td> cells ---
    row.innerHTML = `
      <td>${data.name}</td>
      <td>${data.contactNumber}</td>
      <td>${data.tableNumber}</td>
      <td>${data.date}</td>
      <td>${data.time}</td>
      <td>${data.numOfDiners}</td>
      
      <td>${preOrderCell}</td>
      <td>${receiptCell}</td>
      <td>${data.notes || "—"}</td>
      <td class="status ${data.status || "pending"}">${data.status || "pending"}</td>
      <td class="actions-cell">
        <button class="btn-icon btn--icon-approve complete-btn" title="Complete Reservation" data-id="${docSnap.id}">✔️</button>
        <button class="btn-icon btn--icon-cancel cancel-btn" title="Cancel Reservation" data-id="${docSnap.id}">❌</button>
        <button class="btn-icon btn--icon-delete delete-btn" title="Delete Reservation" data-id="${docSnap.id}">🗑</button>
      </td>
      `;
      
    reservationTableBody.appendChild(row);
  });
}, (error) => {
    console.error("Error loading reservations: ", error);
    if (reservationTableBody) {
        // --- MODIFIED: colspan is now 11 ---
        reservationTableBody.innerHTML = `<tr><td colspan="11">Error loading reservations.</td></tr>`;
    }
});

// Update reservation status
async function updateStatus(id, newStatus) {
  const docRef = doc(db, "reservations", id);
  try {
    await updateDoc(docRef, { status: newStatus });
    alert(`Reservation marked as ${newStatus}.`);
  } catch (error) {
    console.error("Error updating status:", error);
  }
}

// Delete reservation
async function deleteReservation(id) {
  if (!confirm("Are you sure you want to delete this reservation?")) return;

  const docRef = doc(db, "reservations", id);
  try {
    await deleteDoc(docRef);
    alert("Reservation deleted successfully.");
  } catch (error) {
    console.error("Error deleting reservation:", error);
  }
}

// Setup all event listeners on DOM load
document.addEventListener('DOMContentLoaded', () => {
    // Find modal elements
    imageModal = document.getElementById('image-view-modal');
    modalImage = document.getElementById('modal-image-src');
    closeImageModal = document.getElementById('close-image-modal');

    if (reservationTableBody) {
        // Use event delegation for all clicks on the table body
        reservationTableBody.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;

            const id = target.dataset.id;
            
            if (target.classList.contains('complete-btn')) {
                updateStatus(id, "completed");
            } 
            else if (target.classList.contains('cancel-btn')) {
                updateStatus(id, "canceled");
            } 
            else if (target.classList.contains('delete-btn')) {
                deleteReservation(id);
            }
            else if (target.classList.contains('view-receipt-btn')) {
                const imageUrl = target.dataset.src;
                if (imageModal && modalImage && imageUrl) {
                    modalImage.src = imageUrl;
                    imageModal.style.display = 'flex';
                }
            }
        });
    }

    // Modal close listeners
    if (closeImageModal) {
        closeImageModal.addEventListener('click', () => {
            if (imageModal) imageModal.style.display = 'none';
        });
    }
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.style.display = 'none';
            }
        });
    }
});