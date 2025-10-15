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

// Real-time listener for customer feedback
onSnapshot(feedbackCollection, (snapshot) => {
  feedbackTableBody.innerHTML = ""; // Clear old data

  if (snapshot.empty) {
    feedbackTableBody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 20px; color: #999;">
          No customer feedback yet
        </td>
      </tr>
    `;
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

    row.innerHTML = `
      <td>${data.name || "Anonymous"}</td>
      <td>${data.comment || "—"}</td>
      <td>${dateStr}</td>
      <td class="status ${data.status || "pending"}">${data.status || "pending"}</td>
      <td>
        <button class="approve-btn" data-id="${docSnap.id}">✔️ Approve</button>
        <button class="reject-btn" data-id="${docSnap.id}">❌ Reject</button>
        <button class="delete-btn" data-id="${docSnap.id}">🗑 Delete</button>
      </td>
    `;

    feedbackTableBody.appendChild(row);
  });

  // Attach button listeners after rendering
  document.querySelectorAll(".approve-btn").forEach(btn => {
    btn.addEventListener("click", () => updateFeedbackStatus(btn.dataset.id, "approved"));
  });

  document.querySelectorAll(".reject-btn").forEach(btn => {
    btn.addEventListener("click", () => updateFeedbackStatus(btn.dataset.id, "rejected"));
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteFeedback(btn.dataset.id));
  });
});

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