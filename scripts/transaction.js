// transaction.js
import { db } from "./firebase.js"; // adjust path if needed
import { 
  collection, 
  // --- MODIFICATION ---
  // Remove getDocs, add onSnapshot
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// --- MODIFICATION ---
// Keep track of the listener so we don't attach multiple
let transactionsListener = null;

export async function loadTransactions(filter = "all") {
  const transactionsList = document.getElementById("transactions-list");
  if (!transactionsList) return;

  // If we already have a listener, unsubscribe from it
  if (transactionsListener) {
    transactionsListener(); // This unsubscribes the old listener
  }

  transactionsList.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

  try {
    const transactionsRef = collection(db, "sales"); 
    const q = query(transactionsRef, orderBy("timestamp", "desc"));

    // --- MODIFICATION: Use onSnapshot ---
    transactionsListener = onSnapshot(q, (snapshot) => {
      transactionsList.innerHTML = ""; // Clear list on each update

      if (snapshot.empty) {
        transactionsList.innerHTML = "<tr><td colspan='7'>No transactions found.</td></tr>";
        return;
      }

      // Date range filtering
      const now = new Date();
      // --- FIX: Re-initialize 'now' for each date type to avoid mutation issues ---
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      
      const weekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(weekDate.setDate(weekDate.getDate() - weekDate.getDay()));
      weekStart.setHours(0, 0, 0, 0);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      // --- END FIX ---

      let transactionsFound = 0; // Keep track of filtered items

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

        transactionsFound++; // Increment counter
        const date = ts.toLocaleString();
        const processedBy = data.processedBy || "Unknown";
        
        // Use quantity (from pending_order) or quantitySold (from old logic)
        const items = data.items?.map(i => `${i.quantity || i.quantitySold}× ${i.name}`).join("<br>") || "—";
        
        const subtotal = data.subtotal?.toFixed(2) || "0.00";
        const tax = data.tax?.toFixed(2) || "0.00";
        
        // Use "totalAmount", which is what advanced-pos.js saves
        const total = data.totalAmount?.toFixed(2) || "0.00";
        
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

      // If no transactions matched the filter
      if (transactionsFound === 0 && !snapshot.empty) {
        transactionsList.innerHTML = `<tr><td colspan='7'>No transactions found for filter: ${filter}.</td></tr>`;
      }

    }); // --- End of onSnapshot ---

  } catch (error) {
    console.error("❌ Error loading transactions:", error);
    transactionsList.innerHTML = `<tr><td colspan='7'>Error loading transactions.</td></tr>`;
    if (transactionsListener) transactionsListener(); // Unsubscribe on error
  }
}

// --- Event Listener for Sidebar Tab ---
document.addEventListener("DOMContentLoaded", () => {
  const transactionsTab = document.querySelector('[data-section="transactions"]');
  const filterRange = document.getElementById("filterRange");

  if (transactionsTab) {
    // We change this to load on click, NOT on DOM load
    transactionsTab.addEventListener("click", () => loadTransactions(filterRange.value || "all"));
  }

  if (filterRange) {
    filterRange.addEventListener("change", (e) => {
      loadTransactions(e.target.value);
    });
  }
});