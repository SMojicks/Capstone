
// inventory.js
import { db } from './firebase.js';
import {
  collection, addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// --- Elements ---
const inventoryTableBody = document.getElementById('inventory-table');
const modal = document.getElementById('product-modal');
const addBtn = document.getElementById('add-product-btn');
const cancelBtn = document.getElementById('cancel-btn');
const form = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');

// Form Fields
const idField = document.getElementById('product-id');
const nameField = document.getElementById('product-name');
const categoryField = document.getElementById('product-category');
const stockField = document.getElementById('product-stock');
const stockUnitField = document.getElementById('product-stock-unit');
const baseUnitField = document.getElementById('product-base-unit');
const conversionField = document.getElementById('product-conversion');
const minStockField = document.getElementById('product-min-stock');

const inventoryAlertDot = document.getElementById('inventory-alert-dot');
const productsRef = collection(db, "ingredients"); // Now points to 'ingredients'

// --- Modal Logic ---
function openModal(editMode = false, product = {}) {
  form.reset();
  modal.style.display = "flex";
  modalTitle.textContent = editMode ? "Edit Ingredient" : "Add Ingredient";
  
  idField.value = product.id || '';
  nameField.value = product.name || '';
  categoryField.value = product.category || '';
  stockField.value = product.stockQuantity || '';
  stockUnitField.value = product.stockUnit || '';
  baseUnitField.value = product.baseUnit || '';
  conversionField.value = product.conversionFactor || '';
  minStockField.value = product.minStockThreshold || '';
}

function closeModal() {
  modal.style.display = "none";
  form.reset();
  idField.value = '';
}

addBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);

// --- Render Table ---
function renderInventoryTable(snapshot) {
  inventoryTableBody.innerHTML = '';
  let hasLowStock = false;

  if (snapshot.empty) {
    inventoryTableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">No ingredients found.</td></tr>`;
    updateInventoryNotification(false);
    return;
  }
  
  snapshot.forEach(docSnap => {
    const id = docSnap.id;
    const ing = docSnap.data();
    
    // Calculate current stock in BASE units
    const currentStockInBase = (ing.stockQuantity || 0) * (ing.conversionFactor || 1);
    const minStock = ing.minStockThreshold || 0;
    
    const isLowStock = currentStockInBase <= minStock;
    if (isLowStock) hasLowStock = true;

    const row = document.createElement('tr');
    row.style.backgroundColor = isLowStock ? '#fee2e2' : 'transparent';
    
    // Display helper function
    const displayStock = formatStockDisplay(ing.stockQuantity, ing.stockUnit, ing.baseUnit, ing.conversionFactor);

    row.innerHTML = `
      <td>${id}</td>
      <td>${ing.name || '-'}</td>
      <td>${ing.category || '-'}</td>
      <td style="${isLowStock ? 'color:#dc2626;font-weight:600;' : ''}">
        ${displayStock}
      </td>
      <td>${minStock} ${ing.baseUnit}</td>
      <td>1 ${ing.stockUnit} = ${ing.conversionFactor} ${ing.baseUnit}</td>
      <td>
        <button class="btn btn--small edit-btn">Edit</button>
        <button class="btn btn--small delete-btn">Delete</button>
      </td>
    `;

    row.querySelector('.edit-btn').addEventListener('click', () => {
      openModal(true, { id, ...ing });
    });

    row.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete "${ing.name}"? This is permanent.`)) {
        await deleteDoc(doc(db, "ingredients", id));
      }
    });

    inventoryTableBody.appendChild(row);
  });
  
  updateInventoryNotification(hasLowStock);
}

// --- Stock Display Helper ---
function formatStockDisplay(stockQty, stockUnit, baseUnit, conversion) {
  if (stockUnit === baseUnit) {
    return `${stockQty.toFixed(2)} ${baseUnit}`;
  }
  
  const wholeUnits = Math.floor(stockQty);
  const fractionalPart = stockQty - wholeUnits;
  const remainingBaseUnits = (fractionalPart * conversion).toFixed(0);
  
  if (remainingBaseUnits > 0) {
    return `${wholeUnits} ${stockUnit} + ${remainingBaseUnits} ${baseUnit}`;
  } else {
    return `${wholeUnits} ${stockUnit}`;
  }
}

// --- Update Sidebar Notification ---
function updateInventoryNotification(hasLowStock) {
  if (inventoryAlertDot) {
    inventoryAlertDot.style.display = hasLowStock ? 'inline-block' : 'none';
  }
}

// --- Load Inventory (Realtime) ---
function loadInventory() {
  const q = query(productsRef, orderBy("name"));
  onSnapshot(q, (snapshot) => {
    renderInventoryTable(snapshot);
  }, (error) => {
    console.error("❌ Error loading inventory:", error);
    inventoryTableBody.innerHTML = `<tr><td colspan="7">Error loading inventory.</td></tr>`;
  });
}

// --- Add or Update Ingredient ---
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const id = idField.value;
  const newData = {
    name: nameField.value.trim(),
    category: categoryField.value.trim(),
    stockQuantity: parseFloat(stockField.value),
    stockUnit: stockUnitField.value.trim(),
    baseUnit: baseUnitField.value.trim(),
    conversionFactor: parseFloat(conversionField.value),
    minStockThreshold: parseInt(minStockField.value) || 0,
    lastUpdated: serverTimestamp(),
  };

  // Validation
  if (newData.conversionFactor <= 0) {
      alert("Conversion Factor must be greater than 0.");
      return;
  }
  if (newData.stockUnit === newData.baseUnit && newData.conversionFactor !== 1) {
      alert("If Stock Unit and Base Unit are the same, Conversion Factor must be 1.");
      return;
  }

  try {
    if (id) {
      await updateDoc(doc(db, "ingredients", id), newData);
    } else {
      await addDoc(productsRef, newData);
    }
    closeModal();
  } catch (error) {
    console.error("❌ Error saving ingredient:", error);
    alert("Failed to save ingredient.");
  }
});

// --- Initial Load ---
document.addEventListener('DOMContentLoaded', loadInventory);
