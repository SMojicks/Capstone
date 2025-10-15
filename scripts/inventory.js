// inventory.js
import { db } from './firebase.js';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const inventoryTable = document.getElementById('inventory-table');
const modal = document.getElementById('product-modal');
const addBtn = document.getElementById('add-product-btn');
const cancelBtn = document.getElementById('cancel-btn');
const form = document.getElementById('product-form');
const modalTitle = document.getElementById('modal-title');

// 🔹 Form Fields
const idField = document.getElementById('product-id');
const nameField = document.getElementById('product-name');
const categoryField = document.getElementById('product-category');
const stockField = document.getElementById('product-stock');
const minStockField = document.getElementById('product-min-stock'); // 🆕 added
const priceField = document.getElementById('product-price');

// 🔹 Pagination controls
const prevPageBtn = document.getElementById('prevPage');
const nextPageBtn = document.getElementById('nextPage');
const pageInfo = document.getElementById('pageInfo');

// 🔹 Sidebar red dot
const inventoryAlertDot = document.getElementById('inventory-alert-dot'); // 🆕 red dot in sidebar

const productsRef = collection(db, "inventory");
let allProducts = []; // Store all data here
let currentPage = 1;
const pageSize = 10; // number of rows per page

// 🔹 Modal Logic
function openModal(editMode = false, product = {}) {
  modal.style.display = "flex";
  modalTitle.textContent = editMode ? "Edit Product" : "Add Product";
  
  idField.value = product.id || '';
  nameField.value = product.itemName || '';
  categoryField.value = product.category || '';
  stockField.value = product.quantity || '';
  minStockField.value = product.minStock || ''; // 🆕 added
  priceField.value = product.purchasePrice || '';
}

function closeModal() {
  modal.style.display = "none";
  form.reset();
  idField.value = '';
}

addBtn.addEventListener('click', () => openModal());
cancelBtn.addEventListener('click', closeModal);

// 🔹 Render a Page
function renderPage(page) {
  inventoryTable.innerHTML = '';

  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pageData = allProducts.slice(start, end);

  if (pageData.length === 0) {
    inventoryTable.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#999;">No items found.</td></tr>`;
    return;
  }

  let hasLowStock = false;

  pageData.forEach(({ id, ...product }) => {
    const row = document.createElement('tr');
    const isLowStock = (product.quantity || 0) <= (product.minStock || 0);
    if (isLowStock) {
      row.style.backgroundColor = '#fee2e2';
      hasLowStock = true;
    }

    row.innerHTML = `
      <td>${id}</td>
      <td>${product.itemName || '-'}</td>
      <td>${product.category || '-'}</td>
      <td style="${isLowStock ? 'color:#dc2626;font-weight:600;' : ''}">
        ${product.quantity || 0}
      </td>
      <td>${product.minStock || 0}</td>
      <td>₱${product.purchasePrice ? product.purchasePrice.toFixed(2) : '0.00'}</td>
      <td>
        <button class="btn btn--small edit-btn">Edit</button>
        <button class="btn btn--small delete-btn">Delete</button>
      </td>
    `;

    // ✏️ Edit
    row.querySelector('.edit-btn').addEventListener('click', () => {
      openModal(true, { id, ...product });
    });

    // 🗑️ Delete
    row.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete "${product.itemName}"?`)) {
        await deleteDoc(doc(db, "inventory", id));
      }
    });

    inventoryTable.appendChild(row);
  });

  // Pagination button states
  prevPageBtn.disabled = page === 1;
  nextPageBtn.disabled = end >= allProducts.length;
  pageInfo.textContent = `Page ${page}`;

  // 🔴 Update sidebar alert dot
  updateInventoryNotification(hasLowStock);
}

// 🔹 Update Sidebar Notification Dot
function updateInventoryNotification(hasLowStock) {
  if (!inventoryAlertDot) return;
  inventoryAlertDot.style.display = hasLowStock ? 'inline-block' : 'none';
}

// 🔹 Load all inventory (Realtime)
// 🔹 Load all inventory
async function loadInventory() {
  try {
    const q = query(productsRef, orderBy("itemName"));
    const snapshot = await getDocs(q);
    allProducts = snapshot.docs.map(docSnap => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    // ✅ Fix: use correct property name `minStock`
    const hasLowStock = allProducts.some(p => {
      const quantity = p.quantity || 0;
      const minimum = p.minStock || 0;
      return quantity <= minimum && minimum > 0;
    });

    if (inventoryAlertDot) {
      inventoryAlertDot.style.display = hasLowStock ? 'block' : 'none';
      inventoryAlertDot.style.animation = hasLowStock ? 'blink 1s infinite' : 'none';
    }

    renderPage(currentPage);
  } catch (err) {
    console.error("❌ Error loading inventory:", err);
  }
}


// 🔹 Pagination buttons
prevPageBtn.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
});

nextPageBtn.addEventListener('click', () => {
  if ((currentPage * pageSize) < allProducts.length) {
    currentPage++;
    renderPage(currentPage);
  }
});

// 🔹 Add or Update Product
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = idField.value;
  const newData = {
    itemName: nameField.value.trim(),
    category: categoryField.value.trim(),
    quantity: parseInt(stockField.value),
    minStock: parseInt(minStockField.value) || 0, // 🆕 added
    purchasePrice: parseFloat(priceField.value),
    lastRestocked: serverTimestamp(),
  };

  try {
    if (id) {
      await updateDoc(doc(db, "inventory", id), newData);
    } else {
      await addDoc(productsRef, newData);
    }
    closeModal();
  } catch (error) {
    console.error("❌ Error saving product:", error);
    alert("Failed to save product.");
  }
});

// 🔹 Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

// 🔹 Initial Load
document.addEventListener('DOMContentLoaded', loadInventory);
