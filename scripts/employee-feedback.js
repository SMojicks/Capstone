import { db } from "./firebase.js";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Firestore collection reference
const feedbackCollection = collection(db, "customerFeedback");
const feedbackTableBody = document.querySelector("#feedbackTable tbody");

// --- NEW: Modal Elements ---
let imageModal, modalImage, closeImageModal;

// Real-time listener for customer feedback
onSnapshot(feedbackCollection, (snapshot) => {
  if (!feedbackTableBody) return; // Guard clause
  feedbackTableBody.innerHTML = ""; // Clear old data

  if (snapshot.empty) {
    feedbackTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 20px; color: #999;">
          No customer feedback yet
        </td>
      </tr>
    `; // <-- MODIFIED colspan to 7
    return;
  }

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");

    // Format timestamp
    let dateStr = "—";
    if (data.timestamp) {
      const date = data.timestamp.toDate();
      dateStr = date.toLocaleDateString() + " " + date.toLocaleTimeString();
    }

    // --- NEW: Get Rating and Image ---
    const rating = data.rating || "—";
    const imageUrl = data.imageUrl;

    // Create image cell content
    let imageCell = "—";
    if (imageUrl) {
        // Add data-src to be picked up by the event listener
        imageCell = `<img src="${imageUrl}" class="feedback-image-thumb" data-src="${imageUrl}" alt="Feedback Image">`;
    }

    // --- MODIFIED: row.innerHTML with new <td>s ---
    row.innerHTML = `
      <td>${data.name || "Anonymous"}</td>
      <td class="feedback-rating">${rating}</td>
      <td>${data.comment || "—"}</td>
      <td>${imageCell}</td>
      <td>${dateStr}</td>
      <td class="status ${data.status || "pending"}">${data.status || "pending"}</td>
      <td class="actions-cell">
        <button class="btn-icon btn--icon-approve approve-btn" title="Approve Feedback" data-id="${docSnap.id}">✔️</button>
        <button class="btn-icon btn--icon-cancel reject-btn" title="Reject Feedback" data-id="${docSnap.id}">❌</button>
        <button class="btn-icon btn--icon-delete delete-btn" title="Delete Feedback" data-id="${docSnap.id}">🗑</button>
      </td>
      `;
    feedbackTableBody.appendChild(row);
  });
  
  // --- Re-attach button listeners (moved outside forEach) ---
  attachButtonListeners();

}, (error) => {
    console.error("Error loading feedback: ", error);
    if (feedbackTableBody) {
        feedbackTableBody.innerHTML = `<tr><td colspan="7">Error loading feedback.</td></tr>`;
    }
});

// --- NEW: Function to attach listeners ---
function attachButtonListeners() {
  // Use event delegation for button clicks to avoid re-attaching on every row
  const table = feedbackTableBody.closest('table');
  if (!table) return;

  // Clear old listeners by cloning the node (if they were attached directly)
  // Note: Since we repopulate innerHTML, this is implicitly handled,
  // but we add button listeners *after* populating.
  
  document.querySelectorAll(".approve-btn").forEach(btn => {
    // Check if listener already exists to avoid duplicates (simple check)
    if (btn.dataset.listenerAttached) return;
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener("click", () => updateFeedbackStatus(btn.dataset.id, "approved"));
  });

  document.querySelectorAll(".reject-btn").forEach(btn => {
    if (btn.dataset.listenerAttached) return;
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener("click", () => updateFeedbackStatus(btn.dataset.id, "rejected"));
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    if (btn.dataset.listenerAttached) return;
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener("click", () => deleteFeedback(btn.dataset.id));
  });
}

// Update feedback status
async function updateFeedbackStatus(id, newStatus) {
  const docRef = doc(db, "customerFeedback", id);
  try {
    await updateDoc(docRef, { status: newStatus });
    alert(`Feedback ${newStatus}.`);
  } catch (error) {
    console.error("Error updating feedback status:", error);
    alert("Error updating feedback status. Check console.");
  }
}

// Delete feedback
async function deleteFeedback(id) {
  if (!confirm("Are you sure you want to delete this feedback?")) return;

  const docRef = doc(db, "customerFeedback", id);
  try {
    await deleteDoc(docRef);
    alert("Feedback deleted successfully.");
  } catch (error) {
    console.error("Error deleting feedback:", error);
    alert("Error deleting feedback. Check console.");
  }
}

// --- NEW: Add logic for the Image View Modal ---
document.addEventListener('DOMContentLoaded', () => {
    imageModal = document.getElementById('image-view-modal');
    modalImage = document.getElementById('modal-image-src');
    closeImageModal = document.getElementById('close-image-modal');

    if (feedbackTableBody) {
        // Use event delegation to catch clicks on thumbnails
        feedbackTableBody.addEventListener('click', (e) => {
            if (e.target.classList.contains('feedback-image-thumb')) {
                const fullImageUrl = e.target.dataset.src;
                if (modalImage) modalImage.src = fullImageUrl;
                if (imageModal) imageModal.style.display = 'flex';
            }
        });
    }

    if (closeImageModal) {
        closeImageModal.addEventListener('click', () => {
            if (imageModal) imageModal.style.display = 'none';
        });
    }

    // Close modal on outside click
    if (imageModal) {
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                imageModal.style.display = 'none';
            }
        });
    }
});