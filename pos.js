import { db } from './firebase.js';
import {
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  query,
  where,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// =========================
// FIREBASE REFERENCES
// =========================
const menuItemsRef = collection(db, "menuItems");
const inventoryRef = collection(db, "inventory");

// =========================
// ELEMENTS
// =========================
const productGrid = document.getElementById("product-grid");
const cartItemsContainer = document.getElementById("cart-items");
const subtotalEl = document.getElementById("cart-subtotal");
const taxEl = document.getElementById("cart-tax");
const totalEl = document.getElementById("cart-total");

const processPaymentBtn = document.querySelector(".payment-buttons .btn--primary");
const clearCartBtn = document.querySelector(".payment-buttons .btn--secondary");

// =========================
// MODAL ELEMENTS
// =========================
const modal = document.getElementById("menu-item-modal");
const addMenuBtn = document.getElementById("add-menu-item-btn");
const cancelMenuBtn = document.getElementById("cancel-menu-btn");
const menuForm = document.getElementById("menu-item-form");
const recipeList = document.getElementById("recipe-list");
const addIngredientBtn = document.getElementById("add-ingredient-btn");

// =========================
// CATEGORY MANAGEMENT
// =========================
let allMenuItems = [];
let categories = new Set();
let currentCategory = 'All';

// Create category tabs container
function createCategoryTabs() {
  const searchArea = document.querySelector('.search-area');
  
  // Check if tabs already exist
  let categoryTabsContainer = document.querySelector('.category-tabs-container');
  if (!categoryTabsContainer) {
    categoryTabsContainer = document.createElement('div');
    categoryTabsContainer.classList.add('category-tabs-container');
    categoryTabsContainer.style.cssText = `
      margin-top: 15px;
      padding: 10px 0;
      border-bottom: 2px solid #e5e7eb;
      overflow-x: auto;
      white-space: nowrap;
    `;
    searchArea.parentElement.insertBefore(categoryTabsContainer, searchArea.nextSibling);
  }
  
  return categoryTabsContainer;
}

function renderCategoryTabs() {
  const container = createCategoryTabs();
  container.innerHTML = '';
  
  // Add "All" tab
  const allTab = createTabButton('All', currentCategory === 'All');
  allTab.addEventListener('click', () => {
    currentCategory = 'All';
    renderCategoryTabs();
    displayMenuItems();
  });
  container.appendChild(allTab);
  
  // Add category tabs
  const sortedCategories = Array.from(categories).sort();
  sortedCategories.forEach(category => {
    const tab = createTabButton(category, currentCategory === category);
    tab.addEventListener('click', () => {
      currentCategory = category;
      renderCategoryTabs();
      displayMenuItems();
    });
    container.appendChild(tab);
  });
}

function createTabButton(label, isActive) {
  const button = document.createElement('button');
  button.classList.add('category-tab');
  button.textContent = label;
  button.style.cssText = `
    padding: 10px 20px;
    margin-right: 8px;
    border: none;
    background: ${isActive ? '#2563eb' : '#f3f4f6'};
    color: ${isActive ? 'white' : '#374151'};
    border-radius: 6px;
    cursor: pointer;
    font-weight: ${isActive ? '600' : '400'};
    font-size: 14px;
    transition: all 0.2s;
    white-space: nowrap;
  `;
  
  if (!isActive) {
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e5e7eb';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#f3f4f6';
    });
  }
  
  return button;
}

// =========================
// MODAL HANDLING
// =========================
addMenuBtn.addEventListener("click", () => (modal.style.display = "flex"));
cancelMenuBtn.addEventListener("click", () => closeMenuModal());
window.addEventListener("click", (e) => {
  if (e.target === modal) closeMenuModal();
});

function closeMenuModal() {
  modal.style.display = "none";
  menuForm.reset();
  recipeList.innerHTML = "";
}

// =========================
// ADD INGREDIENT FIELD
// =========================
addIngredientBtn.addEventListener("click", async () => {
  const ingredientDiv = document.createElement("div");
  ingredientDiv.classList.add("ingredient-row");
  ingredientDiv.style.display = "flex";
  ingredientDiv.style.gap = "6px";
  ingredientDiv.style.marginBottom = "4px";

  ingredientDiv.innerHTML = `
    <select class="ingredient-name form-control" required style="flex: 2;">
      <option value="">Loading...</option>
    </select>
    <input type="number" placeholder="Qty" class="ingredient-qty form-control" min="0.01" step="0.01" required style="flex: 1;">
    <input type="text" placeholder="Unit" class="ingredient-unit form-control" required style="flex: 1;">
    <button type="button" class="btn btn--small btn--danger remove-ingredient">x</button>
  `;

  ingredientDiv.querySelector(".remove-ingredient").addEventListener("click", () => ingredientDiv.remove());
  recipeList.appendChild(ingredientDiv);

  // Load inventory items into the dropdown
  const selectElement = ingredientDiv.querySelector(".ingredient-name");
  await loadInventoryDropdown(selectElement);
});

// Load inventory items for dropdown
async function loadInventoryDropdown(selectElement) {
  try {
    const snapshot = await getDocs(inventoryRef);
    selectElement.innerHTML = '<option value="">Select ingredient...</option>';
    
    snapshot.forEach(docSnap => {
      const item = docSnap.data();
      const option = document.createElement("option");
      option.value = docSnap.id;
      option.textContent = `${item.itemName} (Stock: ${item.quantity || 0})`;
      option.dataset.itemName = item.itemName;
      selectElement.appendChild(option);
    });
  } catch (error) {
    console.error("Error loading inventory:", error);
    selectElement.innerHTML = '<option value="">Error loading inventory</option>';
  }
}

// =========================
// ADD MENU ITEM
// =========================
menuForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const productName = document.getElementById("menu-name").value.trim();
  const category = document.getElementById("menu-category").value.trim();
  const price = parseFloat(document.getElementById("menu-price").value);

  const ingredients = [];
  const ingredientRows = document.querySelectorAll(".ingredient-row");
  
  ingredientRows.forEach(row => {
    const selectEl = row.querySelector(".ingredient-name");
    const inventoryId = selectEl.value;
    const itemName = selectEl.options[selectEl.selectedIndex]?.dataset.itemName;
    const quantity = parseFloat(row.querySelector(".ingredient-qty").value);
    const unit = row.querySelector(".ingredient-unit").value.trim();

    if (inventoryId && itemName && quantity > 0) {
      ingredients.push({
        inventoryId,
        itemName,
        quantity,
        unit
      });
    }
  });

  if (!productName || !category || isNaN(price)) {
    alert("Please fill out all required fields.");
    return;
  }

  if (ingredients.length === 0) {
    alert("Please add at least one ingredient to the recipe.");
    return;
  }

  try {
    await addDoc(menuItemsRef, {
      productName,
      category,
      price,
      recipe: ingredients,
      createdAt: serverTimestamp()
    });
    
    alert("Menu item added successfully!");
    closeMenuModal();
  } catch (error) {
    console.error("Error adding menu item:", error);
    alert("Failed to add menu item.");
  }
});

// =========================
// DISPLAY MENU ITEMS
// =========================
function displayMenuItems() {
  onSnapshot(menuItemsRef, (snapshot) => {
    allMenuItems = [];
    categories.clear();

    snapshot.forEach(docSnap => {
      const item = { id: docSnap.id, ...docSnap.data() };
      allMenuItems.push(item);
      if (item.category) {
        categories.add(item.category);
      }
    });

    renderCategoryTabs();
    renderProducts();
  });
}

function renderProducts() {
  productGrid.innerHTML = "";
  productGrid.style.cssText = `
    max-height: calc(100vh - 250px);
    overflow-y: auto;
    padding-right: 10px;
  `;

  if (allMenuItems.length === 0) {
    productGrid.innerHTML = "<p style='text-align: center; color: #999; padding: 20px;'>No menu items available yet.</p>";
    return;
  }

  if (currentCategory === 'All') {
    // Display all items grouped by category
    const sortedCategories = Array.from(categories).sort();
    
    sortedCategories.forEach(category => {
      const categoryItems = allMenuItems.filter(item => item.category === category);
      
      if (categoryItems.length > 0) {
        // Category header
        const categoryHeader = document.createElement('div');
        categoryHeader.style.cssText = `
          grid-column: 1 / -1;
          font-size: 18px;
          font-weight: 600;
          color: #1f2937;
          margin: 20px 0 10px 0;
          padding-bottom: 8px;
          border-bottom: 2px solid #e5e7eb;
        `;
        categoryHeader.textContent = category;
        productGrid.appendChild(categoryHeader);
        
        // Category items
        categoryItems.forEach(item => {
          productGrid.appendChild(createProductCard(item));
        });
      }
    });
  } else {
    // Display items for selected category only
    const filteredItems = allMenuItems.filter(item => item.category === currentCategory);
    
    if (filteredItems.length === 0) {
      productGrid.innerHTML = `<p style='text-align: center; color: #999; padding: 20px;'>No items in "${currentCategory}" category.</p>`;
      return;
    }
    
    filteredItems.forEach(item => {
      productGrid.appendChild(createProductCard(item));
    });
  }
}

function createProductCard(item) {
  const card = document.createElement("div");
  card.classList.add("product-card");
  card.style.cssText = `
    border: 1px solid #e5e7eb;
    padding: 16px;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  `;

  card.innerHTML = `
    <h4 style="margin: 0 0 8px 0; font-size: 16px; color: #1f2937;">${item.productName || "Unnamed"}</h4>
    <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 14px;">${item.category || "No category"}</p>
    <p style="margin: 0; font-size: 18px; font-weight: 600; color: #2563eb;">₱${item.price ? item.price.toFixed(2) : "0.00"}</p>
  `;

  card.addEventListener("mouseenter", () => {
    card.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
    card.style.transform = "translateY(-2px)";
  });

  card.addEventListener("mouseleave", () => {
    card.style.boxShadow = "none";
    card.style.transform = "translateY(0)";
  });

  card.addEventListener("click", () => addToCart(item));
  
  return card;
}

// =========================
// CART SYSTEM
// =========================
let cart = [];

function addToCart(item) {
  const existing = cart.find(i => i.id === item.id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  renderCart();
}

function removeFromCart(itemId) {
  cart = cart.filter(i => i.id !== itemId);
  renderCart();
}

function renderCart() {
  cartItemsContainer.innerHTML = "";

  if (cart.length === 0) {
    cartItemsContainer.innerHTML = "<p class='empty-cart' style='text-align: center; color: #999; padding: 20px;'>Cart is empty</p>";
  } else {
    cart.forEach(item => {
      const div = document.createElement("div");
      div.classList.add("cart-item");
      div.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding: 12px;
        background: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
      `;

      div.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: 500; color: #1f2937; margin-bottom: 4px;">${item.productName}</div>
          <div style="font-size: 12px; color: #6b7280;">₱${item.price.toFixed(2)} × ${item.qty}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <strong style="min-width: 70px; text-align: right; color: #2563eb;">₱${(item.price * item.qty).toFixed(2)}</strong>
          <button class="delete-cart-item" style="
            background: #ef4444;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background 0.2s;
          ">Delete</button>
        </div>
      `;

      const deleteBtn = div.querySelector('.delete-cart-item');
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#dc2626';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ef4444';
      });
      deleteBtn.addEventListener('click', () => {
        if (confirm(`Remove "${item.productName}" from cart?`)) {
          removeFromCart(item.id);
        }
      });

      cartItemsContainer.appendChild(div);
    });
  }

  updateTotals();
}

function updateTotals() {
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const tax = subtotal * 0.12; // 12% VAT
  const total = subtotal + tax;

  subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  taxEl.textContent = `₱${tax.toFixed(2)}`;
  totalEl.textContent = `₱${total.toFixed(2)}`;
}

// =========================
// CLEAR CART
// =========================
clearCartBtn.addEventListener("click", () => {
  if (cart.length > 0) {
    if (confirm("Clear all items from cart?")) {
      cart = [];
      renderCart();
    }
  }
});

// =========================
// PROCESS PAYMENT
// =========================
processPaymentBtn.addEventListener("click", async () => {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  // Disable button to prevent double-clicks
  processPaymentBtn.disabled = true;
  processPaymentBtn.textContent = "Processing...";

  try {
    // Deduct ingredients from inventory
    for (const cartItem of cart) {
      if (cartItem.recipe && cartItem.recipe.length > 0) {
        for (const ingredient of cartItem.recipe) {
          try {
            // Get the inventory document directly by ID
            const invDocRef = doc(db, "inventory", ingredient.inventoryId);
            const invDocSnap = await getDoc(invDocRef);
            
            if (invDocSnap.exists()) {
              const currentQty = invDocSnap.data().quantity || 0;
              const deductAmount = ingredient.quantity * cartItem.qty;
              const newQty = Math.max(currentQty - deductAmount, 0);
              
              // Update the inventory
              await updateDoc(invDocRef, {
                quantity: newQty,
                lastRestocked: serverTimestamp()
              });
              
              console.log(`Updated ${ingredient.itemName}: ${currentQty} - ${deductAmount} = ${newQty}`);
            } else {
              console.warn(`Inventory item not found: ${ingredient.inventoryId}`);
            }
          } catch (ingredientError) {
            console.error(`Error updating ingredient ${ingredient.itemName}:`, ingredientError);
          }
        }
      }
    }

    alert("Transaction complete! Inventory updated.");
    cart = [];
    renderCart();
  } catch (error) {
    console.error("Error processing payment:", error);
    alert("Error processing payment. Please try again.");
  } finally {
    processPaymentBtn.disabled = false;
    processPaymentBtn.textContent = "Process Payment";
  }
});

// =========================
// INITIAL LOAD
// =========================
document.addEventListener("DOMContentLoaded", displayMenuItems);