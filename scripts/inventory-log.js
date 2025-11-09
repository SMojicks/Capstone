import { db } from "./firebase.js";
import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const inventoryLogsRef = collection(db, "inventoryLogs");

/**
 * Creates a new inventory log entry.
 * This is the central function for all inventory tracking.
 * @param {string} employeeName - Name of the employee making the change.
 * @param {string} actionType - e.g., "Add Stock", "Wastage", "Sale Deduction", "Edit Category".
 * @param {string} itemName - The name of the item, category, or product.
 * @param {string} category - The category of the item.
 * @param {number} qtyChange - The amount changed (e.g., +10, -5). Use negative for deductions.
 * @param {string} unit - The unit of the quantity change (e.g., "g", "ml", "pcs").
 * @param {number} prevQty - The quantity before this action.
 * @param {number} newQty - The quantity after this action.
 * @param {string} reason - A brief reason for the change.
 */
export async function createLog(
  employeeName, 
  actionType, 
  itemName, 
  category, 
  qtyChange, 
  unit, 
  prevQty, 
  newQty, 
  reason
) {
  try {
    await addDoc(inventoryLogsRef, {
      timestamp: serverTimestamp(),
      employeeName: employeeName || "System",
      actionType: actionType,
      itemName: itemName,
      category: category || "N/A",
      qtyChange: qtyChange || 0,
      unit: unit || "N/A",
      prevQty: prevQty || 0,
      newQty: newQty || 0,
      reason: reason
    });
  } catch (error) {
    console.error("Failed to create inventory log:", error);
    // Don't block the main action, just log the error
  }
}

/**
 * Loads and displays the inventory log table
 */
export function loadInventoryLog() {
  const logTableBody = document.getElementById("inventory-log-table-body");
  if (!logTableBody) return;

  const q = query(inventoryLogsRef, orderBy("timestamp", "desc"));
  
  onSnapshot(q, (snapshot) => {
    logTableBody.innerHTML = ""; // Clear old data

    if (snapshot.empty) {
      logTableBody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No inventory logs found.</td></tr>`;
      return;
    }

    snapshot.forEach(doc => {
      const log = doc.data();
      const row = document.createElement("tr");

      // Format timestamp
      const date = log.timestamp ? log.timestamp.toDate().toLocaleString() : "---";
      
      // Format quantity change
      let qtyDisplay = "---";
      if (log.qtyChange !== 0) {
        const sign = log.qtyChange > 0 ? "+" : "";
        const color = log.qtyChange > 0 ? "var(--color-green-700)" : "var(--color-red-600)";
        qtyDisplay = `<strong style="color: ${color};">${sign}${log.qtyChange} ${log.unit || ''}</strong>`;
      }

      row.innerHTML = `
        <td>${date}</td>
        <td>${log.employeeName}</td>
        <td>${log.actionType}</td>
        <td>${log.itemName}</td>
        <td>${log.category}</td>
        <td>${qtyDisplay}</td>
        <td>${log.prevQty} ${log.unit || ''}</td>
        <td>${log.newQty} ${log.unit || ''}</td>
        <td>${log.reason}</td>
      `;
      logTableBody.appendChild(row);
    });

  }, (error) => {
    console.error("Error loading inventory logs:", error);
    logTableBody.innerHTML = `<tr><td colspan="9">Error loading logs.</td></tr>`;
  });
}