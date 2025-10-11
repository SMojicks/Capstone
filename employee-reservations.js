import { db } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Firestore collection reference
const reservationCollection = collection(db, "reservations");
const reservationTableBody = document.querySelector("#reservationTable tbody");

// Real-time listener for reservations
onSnapshot(reservationCollection, (snapshot) => {
  reservationTableBody.innerHTML = ""; // Clear old data

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>${data.name}</td>
      <td>${data.contactNumber}</td>
      <td>${data.tableNumber}</td>
      <td>${data.date}</td>
      <td>${data.time}</td>
      <td>${data.numOfDiners}</td>
      <td>${data.notes || "—"}</td>
      <td class="status ${data.status || "pending"}">${data.status || "pending"}</td>
      <td>
        <button class="complete-btn" data-id="${docSnap.id}">✔️ Complete</button>
        <button class="cancel-btn" data-id="${docSnap.id}">❌ Cancel</button>
        <button class="delete-btn" data-id="${docSnap.id}">🗑 Delete</button>
      </td>
    `;

    reservationTableBody.appendChild(row);
  });

  // Attach button listeners after rendering
  document.querySelectorAll(".complete-btn").forEach(btn => {
    btn.addEventListener("click", () => updateStatus(btn.dataset.id, "completed"));
  });

  document.querySelectorAll(".cancel-btn").forEach(btn => {
    btn.addEventListener("click", () => updateStatus(btn.dataset.id, "canceled"));
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteReservation(btn.dataset.id));
  });
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
