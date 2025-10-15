// transaction.js
import { db } from "./firebase.js"; // adjust path if needed
import { 
  collection, 
  getDocs, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

export async function loadTransactions(filter = "all") {
  const transactionsList = document.getElementById("transactions-list");
  if (!transactionsList) return;

  transactionsList.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const transactionsRef = collection(db, "transactions");
    const q = query(transactionsRef, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);

    transactionsList.innerHTML = "";

    if (snapshot.empty) {
      transactionsList.innerHTML = "<tr><td colspan='7'>No transactions found.</td></tr>";
      return;
    }

    // Date range filtering
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())); // start of week
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const ts = data.timestamp?.toDate();
      if (!ts) return;

      // Apply filter
      let include = false;
      switch (filter) {
        case "today":
          include = ts >= todayStart;
          break;
        case "week":
          include = ts >= weekStart;
          break;
        case "month":
          include = ts >= monthStart;
          break;
        default:
          include = true;
      }
      if (!include) return;

      const date = ts.toLocaleString();
      const processedBy = data.processedBy || "Unknown";
      const items = data.items?.map(i => `${i.qty}× ${i.name}`).join("<br>") || "—";
      const subtotal = data.subtotal?.toFixed(2) || "0.00";
      const tax = data.tax?.toFixed(2) || "0.00";
      const total = data.total?.toFixed(2) || "0.00";
      const paymentMethod = data.paymentMethod || "N/A";

      const row = `
        <tr>
          <td>${date}</td>
          <td>${processedBy}</td>
          <td>${items}</td>
          <td>₱${subtotal}</td>
          <td>₱${tax}</td>
          <td><strong>₱${total}</strong></td>
          <td>${paymentMethod}</td>
        </tr>
      `;
      transactionsList.insertAdjacentHTML("beforeend", row);
    });

  } catch (error) {
    console.error("❌ Error loading transactions:", error);
    transactionsList.innerHTML = `<tr><td colspan='7'>Error loading transactions.</td></tr>`;
  }
}

// --- Event Listener for Sidebar Tab ---
document.addEventListener("DOMContentLoaded", () => {
  const transactionsTab = document.querySelector('[data-section="transactions"]');
  const filterRange = document.getElementById("filterRange");

  if (transactionsTab) {
    transactionsTab.addEventListener("click", () => loadTransactions());
  }

  if (filterRange) {
    filterRange.addEventListener("change", (e) => {
      loadTransactions(e.target.value);
    });
  }
});
