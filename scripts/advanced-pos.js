import { db } from './firebase.js';
import {
  collection, addDoc, getDocs, onSnapshot, doc,
  updateDoc, getDoc, setDoc, deleteDoc, serverTimestamp,
  query, where, writeBatch, runTransaction, orderBy
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// --- Collections ---
const productsRef = collection(db, "products");
const ingredientsRef = collection(db, "ingredients");
const recipesRef = collection(db, "recipes");
const salesRef = collection(db, "sales"); // For COMPLETED orders
const pendingOrdersRef = collection(db, "pending_orders"); // For KITCHEN QUEUE
const stockMovementsRef = collection(db, "stock_movements");
const categoriesRef = doc(db, "settings", "categories");

// --- Page Elements ---
const productGrid = document.getElementById("product-grid");
const cartItemsContainer = document.getElementById("cart-items");
const subtotalEl = document.getElementById("cart-subtotal");
const taxEl = document.getElementById("cart-tax");
const totalEl = document.getElementById("cart-total");
const processPaymentBtn = document.querySelector(".payment-buttons .btn--primary");
const clearCartBtn = document.querySelector(".payment-buttons .btn--secondary");
const displayModeBtn = document.getElementById("display-mode-btn");
const categoryTabsContainer = document.getElementById("category-tabs-container");

// --- Add Menu Item Modal ---
const addMenuBtn = document.getElementById("add-menu-item-btn");
const cancelMenuBtn = document.getElementById("cancel-menu-btn");
const menuModal = document.getElementById("menu-item-modal");
const menuForm = document.getElementById("menu-item-form");
const recipeList = document.getElementById("recipe-list");
const addIngredientBtn = document.getElementById("add-ingredient-btn");
const menuCategoryDropdown = document.getElementById("menu-category");
const newCategoryInput = document.getElementById("new-category-input");
const menuWaitTimeSelect = document.getElementById("menu-waiting-time");

// --- Customer Info Modal ---
const customerInfoModal = document.getElementById("customer-info-modal");
const customerInfoForm = document.getElementById("customer-info-form");
const cancelCustomerInfoBtn = document.getElementById("cancel-customer-info-btn");

// --- Order Details Modal ---
const orderDetailsModal = document.getElementById("order-details-modal");
const orderModalBackBtn = document.getElementById("order-modal-back-btn");
const orderModalVoidBtn = document.getElementById("order-modal-void-btn");
const orderModalProgressBtn = document.getElementById("order-modal-progress-btn");

// --- Pending Orders Line ---
const ordersLine = document.getElementById("orders-line");

// --- State Variables ---
let cart = [];
let allProducts = [];
let allIngredientsCache = [];
let allCategories = [];
let currentCategory = "All";
let displayMode = false;
let currentOrderDetails = null; // Holds data for the modal

// --- Category Management ---
async function loadCategories() {
  try {
    const docSnap = await getDoc(categoriesRef);
    if (docSnap.exists()) {
      allCategories = docSnap.data().list || [];
    } else {
      await setDoc(categoriesRef, { list: [] });
      allCategories = [];
    }
    allCategories.sort();
    
    renderCategoryTabs();
    
    menuCategoryDropdown.innerHTML = `<option value="">Select category...</option>`;
    allCategories.forEach(cat => menuCategoryDropdown.add(new Option(cat, cat)));
    menuCategoryDropdown.add(new Option("+ Create New Category...", "__new__"));
    
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function addCategoryIfNew(categoryName) {
  if (categoryName && !allCategories.includes(categoryName)) {
    allCategories.push(categoryName);
    allCategories.sort();
    await setDoc(categoriesRef, { list: allCategories });
    loadCategories();
  }
}

menuCategoryDropdown.addEventListener("change", function() {
  if (this.value === "__new__") {
    newCategoryInput.style.display = "block";
    newCategoryInput.focus();
  } else {
    newCategoryInput.style.display = "none";
    newCategoryInput.value = "";
    updateIngredientCacheForRecipeModal(this.value);
  }
});

// --- Recipe & Ingredient Filtering ---
async function loadAllIngredientsCache() {
  try {
    const snapshot = await getDocs(ingredientsRef);
    allIngredientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error caching all ingredients:", error);
  }
}

function updateIngredientCacheForRecipeModal(selectedCategory) {
  if (!selectedCategory) {
    recipeList.innerHTML = "<p style='color: #666;'>Please select a product category to add ingredients.</p>";
    addIngredientBtn.disabled = true;
    return;
  }
  const filteredIngredients = allIngredientsCache.filter(ing => ing.category === selectedCategory);
  recipeList.innerHTML = "";
  addIngredientBtn.disabled = false;
  if (filteredIngredients.length === 0) {
     recipeList.innerHTML = `<p style='color: #888;'>No ingredients in "${selectedCategory}" category.</p>`;
  }
  addIngredientBtn.onclick = () => addIngredientRow(filteredIngredients);
}

function addIngredientRow(filteredIngredients) {
  const row = document.createElement("div");
  row.className = "ingredient-row";
  const selectOptions = filteredIngredients.map(ing => `<option value="${ing.id}" data-base-unit="${ing.baseUnit}">${ing.name} (${ing.baseUnit})</option>`).join('');
  row.innerHTML = `
    <select class="ingredient-id form-control" required><option value="">Select Ingredient...</option>${selectOptions}</select>
    <input type="number" class="ingredient-qty form-control" placeholder="Qty" required step="any" min="0">
    <input type="text" class="ingredient-unit form-control" placeholder="Unit (g, ml)" required readonly>
    <button type="button" class="btn btn--secondary remove-ingredient">X</button>
  `;
  row.querySelector(".remove-ingredient").addEventListener("click", () => row.remove());
  row.querySelector(".ingredient-id").addEventListener("change", (e) => {
    const baseUnit = e.target.options[e.target.selectedIndex].dataset.baseUnit;
    row.querySelector(".ingredient-unit").value = baseUnit || '';
  });
  recipeList.appendChild(row);
}

// --- Save Product and Recipe ---
menuForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const productId = document.getElementById("menu-product-id").value || doc(productsRef).id;
  const isEditing = !!document.getElementById("menu-product-id").value;
  
  let productCategory = menuCategoryDropdown.value;
  if (productCategory === "__new__") {
    productCategory = newCategoryInput.value.trim();
    if (productCategory) {
      await addCategoryIfNew(productCategory);
    } else {
      alert("Please enter a name for the new category.");
      return;
    }
  }

  const productData = {
    name: document.getElementById("menu-name").value,
    price: parseFloat(document.getElementById("menu-price").value),
    category: productCategory,
    waitingTime: menuWaitTimeSelect.value, // Save waiting time
    isVisible: true // Default to visible
  };
  
  if (!productData.waitingTime) {
      alert("Please select an average waiting time."); return;
  }

  const recipeData = [];
  const ingredientRows = recipeList.querySelectorAll(".ingredient-row");
  
  if (ingredientRows.length === 0) {
    alert("A product must have at least one ingredient in its recipe.");
    return;
  }

  let recipeError = false;
  ingredientRows.forEach(row => {
    const ingredientId = row.querySelector(".ingredient-id").value; // 👈 Get the ID
    const qty = parseFloat(row.querySelector(".ingredient-qty").value);
    const unit = row.querySelector(".ingredient-unit").value;

    // 👇 --- THIS IS THE FIX --- 👇
    // We must check if an ingredientId was actually selected.
    if (!unit || qty <= 0 || !ingredientId) { 
        recipeError = true;
    }
    // 👆 --- END OF FIX --- 👆

    recipeData.push({
      productId: productId,
      ingredientId: ingredientId,
      qtyPerProduct: qty,
      unitUsed: unit
    });
  });

  if (recipeError) {
      alert("Please check your recipe. All ingredients must be selected and have a quantity greater than 0.");
      return;
  }

  const batch = writeBatch(db);
  const productDocRef = doc(db, "products", productId);
  batch.set(productDocRef, productData, { merge: true });

  if (isEditing) {
    const q = query(recipesRef, where("productId", "==", productId));
    const oldRecipes = await getDocs(q);
    oldRecipes.forEach(recipeDoc => batch.delete(recipeDoc.ref));
  }
  
  recipeData.forEach(recipeItem => {
    const recipeDocRef = doc(collection(db, "recipes"));
    batch.set(recipeDocRef, recipeItem);
  });

  try {
    await batch.commit();
    alert("Product and recipe saved successfully!");
    closeMenuModal();
    loadProducts(); // Refresh the POS grid
  } catch (error) {
    console.error("Error saving product and recipe:", error);
    alert("Failed to save product.");
  }
});

function closeMenuModal() {
  menuModal.style.display = "none";
  menuForm.reset();
  recipeList.innerHTML = "";
  document.getElementById("menu-product-id").value = "";
  newCategoryInput.style.display = "none";
  addIngredientBtn.disabled = true;
}

addMenuBtn.addEventListener("click", () => {
    closeMenuModal();
    loadCategories(); 
    menuModal.style.display = "flex";
});
cancelMenuBtn.addEventListener("click", closeMenuModal);

// --- Display Mode ---
displayModeBtn.addEventListener("click", () => {
  displayMode = !displayMode;
  displayModeBtn.textContent = displayMode ? 'Exit Display Mode' : 'Display Mode';
  displayModeBtn.classList.toggle('btn--danger', displayMode);
  productGrid.classList.toggle('display-mode-active', displayMode);
  loadProducts();
});

// --- POS Category Tabs ---
function renderCategoryTabs() {
  categoryTabsContainer.innerHTML = "";
  const allTab = document.createElement("button");
  allTab.className = "category-tab" + (currentCategory === "All" ? " active" : "");
  allTab.textContent = "All";
  allTab.onclick = () => { currentCategory = "All"; loadCategories(); };
  categoryTabsContainer.appendChild(allTab);
  
  allCategories.forEach(category => {
    const tab = document.createElement("button");
    tab.className = "category-tab" + (currentCategory === category ? " active" : "");
    tab.textContent = category;
    tab.onclick = () => { currentCategory = category; loadCategories(); };
    categoryTabsContainer.appendChild(tab);
  });
  loadProducts();
}

// --- Load Products to POS Grid ---
async function loadProducts() {
  productGrid.innerHTML = "Loading products...";
  try {
    let q = query(productsRef, orderBy("category"), orderBy("name"));
    if (!displayMode) {
      q = query(q, where("isVisible", "==", true));
    }
    const snapshot = await getDocs(q);
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    productGrid.innerHTML = "";
    let productsToRender = allProducts;
    if (currentCategory !== "All") {
      productsToRender = allProducts.filter(p => p.category === currentCategory);
    }
    if (productsToRender.length === 0) {
      productGrid.innerHTML = `<p>No products found in "${currentCategory}".</p>`; return;
    }
    let currentHeader = "";
    productsToRender.forEach(product => {
      if (currentCategory === "All" && product.category !== currentHeader) {
        currentHeader = product.category;
        const headerEl = document.createElement("div");
        headerEl.className = "product-category-header";
        headerEl.textContent = currentHeader;
        productGrid.appendChild(headerEl);
      }
      productGrid.appendChild(createProductCard(product));
    });
  } catch (error) {
    console.error("Error loading products:", error);
    productGrid.innerHTML = "<p>Error loading products.</p>";
    if (error.code === 'failed-precondition') {
      alert("Error: Database query failed. You may need to create a composite index in Firebase. Check console (F12) for the link.");
    }
  }
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;
  if (!product.isVisible) card.classList.add("is-hidden");
  card.innerHTML = `
    <div class="product-name">${product.name}</div>
    <div class="product-category">${product.category}</div>
    <div class="product-price">₱${product.price.toFixed(2)}</div>
  `;
  if (displayMode) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "product-toggle-btn" + (product.isVisible ? " is-visible" : "");
    toggleBtn.innerHTML = product.isVisible ? "✓" : "×";
    toggleBtn.title = product.isVisible ? "Click to Hide" : "Click to Show";
    toggleBtn.onclick = (e) => { e.stopPropagation(); handleToggleVisibility(product.id, product.isVisible); };
    card.appendChild(toggleBtn);
  } else {
    card.onclick = () => addToCart(product);
  }
  return card;
}

async function handleToggleVisibility(productId, currentVisibility) {
  try {
    await updateDoc(doc(db, "products", productId), { isVisible: !currentVisibility });
    loadProducts();
  } catch (error) {
    console.error("Error toggling visibility:", error);
  }
}

// --- Cart Functions ---
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    // Add waitingTime to the cart object
    cart.push({ ...product, quantity: 1, waitingTime: product.waitingTime });
  }
  updateCartDisplay();
}

function updateCartDisplay() {
  cartItemsContainer.innerHTML = "";
  if (cart.length === 0) {
    cartItemsContainer.innerHTML = '<p class="empty-cart">Cart is empty</p>';
  }
  cart.forEach(item => {
    const itemEl = document.createElement("div");
    itemEl.className = "cart-item";
    itemEl.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">₱${item.price.toFixed(2)}</div>
      </div>
      <div class="cart-item-quantity">
        <button class="qty-btn" data-id="${item.id}" data-change="-1">-</button>
        <span>${item.quantity}</span>
        <button class="qty-btn" data-id="${item.id}" data-change="1">+</button>
      </div>
    `;
    cartItemsContainer.appendChild(itemEl);
  });
  updateCartTotals();
}

function updateCartQuantity(productId, change) {
  const item = cart.find(item => item.id === productId);
  if (item) {
    item.quantity += change;
    if (item.quantity <= 0) cart = cart.filter(cartItem => cartItem.id !== productId);
  }
  updateCartDisplay();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.12;
  const total = subtotal + tax;
  subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  taxEl.textContent = `₱${tax.toFixed(2)}`;
  totalEl.textContent = `₱${total.toFixed(2)}`;
}

cartItemsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("qty-btn")) {
    updateCartQuantity(e.target.dataset.id, parseInt(e.target.dataset.change));
  }
});

clearCartBtn.addEventListener("click", () => {
  if (confirm("Clear the entire cart?")) {
    cart = []; updateCartDisplay();
  }
});

// --- NEW: Pending Order System ---

// 1. Listen for clicks on "Process Payment"
processPaymentBtn.addEventListener("click", () => {
  if (cart.length === 0) {
    alert("Cart is empty."); return;
  }
  // Show the customer info modal instead of processing payment
  customerInfoModal.style.display = "flex";
  customerInfoForm.reset();
});
cancelCustomerInfoBtn.addEventListener("click", () => customerInfoModal.style.display = "none");

// 2. Handle the customer info form submission
customerInfoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const customerName = document.getElementById("customer-name").value;
  const orderType = document.getElementById("order-type").value;
  customerInfoModal.style.display = "none";
  
  // Now process the sale with the new info
  processSale(customerName, orderType);
});

// 3. Main function to process the sale and create a pending order
async function processSale(customerName, orderType) {
  processPaymentBtn.disabled = true;
  processPaymentBtn.textContent = "Processing...";
  
  const stockMovements = []; 

  const getAvgWaitTime = (cart) => {
    let maxTime = 0;
    let waitCategory = "short";
    cart.forEach(item => {
        if (item.waitingTime === "medium" && maxTime < 1) maxTime = 1;
        if (item.waitingTime === "long" && maxTime < 2) maxTime = 2;
    });
    if (maxTime === 1) waitCategory = "medium";
    if (maxTime === 2) waitCategory = "long";
    return waitCategory;
  };
  
  const avgWaitTime = getAvgWaitTime(cart);

  try {
    // Fetch all recipes OUTSIDE the transaction
    const allRecipes = [];
    for (const item of cart) {
      const q = query(recipesRef, where("productId", "==", item.id));
      const recipeSnapshot = await getDocs(q);
      if (recipeSnapshot.empty) {
        throw new Error(`No recipe found for "${item.name}".`);
      }
      recipeSnapshot.forEach(recipeDoc => {
        allRecipes.push({ ...recipeDoc.data(), cartQuantity: item.quantity });
      });
    }

    await runTransaction(db, async (transaction) => {
      const ingredientDeductions = new Map();
      
      // Build the deductions map
      for (const recipe of allRecipes) {
        if (recipe.ingredientId && recipe.ingredientId.trim() !== "") {
          const totalDeduction = recipe.qtyPerProduct * recipe.cartQuantity;
          const existing = ingredientDeductions.get(recipe.ingredientId) || { 
            amountToDeduct: 0, 
            unit: recipe.unitUsed 
          };
          existing.amountToDeduct += totalDeduction;
          ingredientDeductions.set(recipe.ingredientId, existing);
        } else {
          console.warn(`Skipping recipe with missing ingredientId for product ${recipe.productId}`);
        }
      }

      console.log("=== INGREDIENT DEDUCTIONS MAP ===");
      console.log("Map size:", ingredientDeductions.size);
      ingredientDeductions.forEach((deduction, ingId) => {
        console.log(`ID: "${ingId}"`, deduction);
      });
      console.log("=================================");

      // STEP 1: Do ALL reads first
      const ingredientDataMap = new Map();
      for (const [ingId, deduction] of ingredientDeductions.entries()) {
        if (!ingId || typeof ingId !== 'string' || ingId.trim() === "") {
          console.warn("⚠️ Skipping ingredient with invalid ID:", ingId);
          continue;
        }
        
        const ingRef = doc(db, "ingredients", ingId);
        const ingDoc = await transaction.get(ingRef);
        
        if (!ingDoc.exists()) {
          throw new Error(`Ingredient ${ingId} not found in database.`);
        }
        
        const ingData = ingDoc.data();
        const currentStockInBaseUnits = ingData.stockQuantity * ingData.conversionFactor;
        
        // Validate stock
        if (deduction.unit !== ingData.baseUnit) {
          throw new Error(`Unit mismatch for ${ingData.name}.`);
        }
        if (currentStockInBaseUnits < deduction.amountToDeduct) {
          throw new Error(`Not enough stock for ${ingData.name}.`);
        }

        // Store for later writing
        ingredientDataMap.set(ingId, {
          ref: ingRef,
          data: ingData,
          currentStockInBaseUnits: currentStockInBaseUnits,
          deduction: deduction
        });
      }

      // STEP 2: Now do ALL writes
      for (const [ingId, info] of ingredientDataMap.entries()) {
        const newStockInBaseUnits = info.currentStockInBaseUnits - info.deduction.amountToDeduct;
        const newStockInStockUnits = newStockInBaseUnits / info.data.conversionFactor;
        transaction.update(info.ref, { stockQuantity: newStockInStockUnits });

        stockMovements.push({
          ingredientId: ingId,
          ingredientName: info.data.name,
          qtyDeducted: info.deduction.amountToDeduct,
          unit: info.deduction.unit,
          reason: "Sale",
          date: serverTimestamp()
        });
      }
      
      // Create the pending order
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;

      const orderRef = doc(collection(db, "pending_orders"));
      const orderId = orderRef.id.substring(0, 4).toUpperCase();
      
      transaction.set(orderRef, {
        orderId: orderId,
        customerName: customerName,
        orderType: orderType,
        status: "Pending",
        avgWaitTime: avgWaitTime,
        createdAt: serverTimestamp(),
        totalAmount: total,
        subtotal: subtotal,
        tax: tax,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          pricePerItem: item.price,
          waitingTime: item.waitingTime
        }))
      });
    });

    // Log stock movements
    const logBatch = writeBatch(db);
    stockMovements.forEach(log => logBatch.set(doc(collection(db, "stock_movements")), log));
    await logBatch.commit();
    
    alert("Order created successfully! Inventory updated.");
    cart = [];
    updateCartDisplay();
  } catch (error) {
    console.error("Sale Failed:", error);
    alert(`Sale Failed: ${error.message}`);
  } finally {
    processPaymentBtn.disabled = false;
    processPaymentBtn.textContent = "Process Payment";
  }
}

// 4. Listen for Pending Orders and render them
function listenForPendingOrders() {
  const q = query(pendingOrdersRef, orderBy("createdAt", "asc"));
  
  onSnapshot(q, (snapshot) => {
    ordersLine.innerHTML = ""; // Clear the line
    if (snapshot.empty) {
        ordersLine.innerHTML = "<p class='empty-cart'>No pending orders.</p>";
        return;
    }
    
    snapshot.forEach(doc => {
      const order = { id: doc.id, ...doc.data() };
      ordersLine.appendChild(createOrderCard(order));
    });
  }, (error) => {
    console.error("Error listening to pending orders:", error);
  });
}

// 5. Create Order Card HTML
function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = "order-card";
  card.dataset.id = order.id;
  
  let waitClass = "wait-short";
  if (order.avgWaitTime === "medium") waitClass = "wait-medium";
  if (order.avgWaitTime === "long") waitClass = "wait-long";
  
  let progressWidth = "10%"; // Pending
  if (order.status === "Preparing") progressWidth = "50%";
  if (order.status === "Ready") progressWidth = "100%";
  
  card.innerHTML = `
    <div class="order-card-header">
      <span class="order-card-id">#${order.orderId}</span>
      <span class="order-card-wait-time ${waitClass}">${order.avgWaitTime}</span>
    </div>
    <p class="order-card-customer">${order.customerName}</p>
    <div class="progress-bar">
      <div class="progress-bar-inner" style="width: ${progressWidth};"></div>
    </div>
  `;
  
  card.addEventListener("click", () => openOrderDetailsModal(order));
  return card;
}

// 6. Open Order Details Modal
function openOrderDetailsModal(order) {
  currentOrderDetails = order; // Store current order data
  
  document.getElementById("order-modal-title").textContent = `Order #${order.orderId}`;
  document.getElementById("order-modal-customer").textContent = order.customerName;
  document.getElementById("order-modal-type").textContent = order.orderType;
  document.getElementById("order-modal-total").textContent = `₱${order.totalAmount.toFixed(2)}`;
  
  const waitText = { short: "< 5 min", medium: "5-10 min", long: "15-20 min" };
  document.getElementById("order-modal-wait-time").textContent = waitText[order.avgWaitTime] || "N/A";

  // Populate item list
  const itemList = document.getElementById("order-modal-item-list");
  itemList.innerHTML = "";
  order.items.forEach(item => {
    const li = document.createElement("li");
    let itemWaitClass = "wait-short";
    if (item.waitingTime === "medium") itemWaitClass = "wait-medium";
    if (item.waitingTime === "long") itemWaitClass = "wait-long";
    
    li.innerHTML = `
      <span>${item.quantity} x ${item.name}</span>
      <span class="item-wait-time ${itemWaitClass}">${waitText[item.waitingTime]}</span>
    `;
    itemList.appendChild(li);
  });
  
  updateModalProgress(order.status);
  orderDetailsModal.style.display = "flex";
}

// 7. Update Modal Progress Bar & Buttons
function updateModalProgress(status) {
  const progressBar = document.getElementById("order-modal-progress-bar");
  const statusText = document.getElementById("order-modal-status-text");
  const progressBtn = document.getElementById("order-modal-progress-btn");
  
  if (status === "Pending") {
    progressBar.style.width = "10%";
    statusText.textContent = "Pending";
    progressBtn.textContent = "Mark as Preparing";
    progressBtn.disabled = false;
  } else if (status === "Preparing") {
    progressBar.style.width = "50%";
    statusText.textContent = "Preparing";
    progressBtn.textContent = "Mark as Ready";
    progressBtn.disabled = false;
  } else if (status === "Ready") {
    progressBar.style.width = "100%";
    statusText.textContent = "Ready";
    progressBtn.textContent = "Complete Order";
    progressBtn.disabled = false;
  }
}

// 8. Add Event Listeners for Modal Buttons
orderModalBackBtn.addEventListener("click", () => {
  orderDetailsModal.style.display = "none";
  currentOrderDetails = null;
});

orderModalProgressBtn.addEventListener("click", async () => {
  if (!currentOrderDetails) return;
  
  let newStatus = "";
  if (currentOrderDetails.status === "Pending") newStatus = "Preparing";
  else if (currentOrderDetails.status === "Preparing") newStatus = "Ready";
  else if (currentOrderDetails.status === "Ready") {
    // This is the final step
    await completeOrder(currentOrderDetails);
    return;
  }
  
  if (newStatus) {
    try {
      const orderRef = doc(db, "pending_orders", currentOrderDetails.id);
      await updateDoc(orderRef, { status: newStatus });
      
      // Update the local data and modal UI
      currentOrderDetails.status = newStatus;
      updateModalProgress(newStatus);
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  }
});

orderModalVoidBtn.addEventListener("click", async () => {
  if (!currentOrderDetails) return;
  if (!confirm(`Are you sure you want to void Order #${currentOrderDetails.orderId}? This cannot be undone.`)) return;
  
  await voidOrder(currentOrderDetails);
});

// 9. Functions to Complete or Void an Order
async function completeOrder(order) {
  // 1. Move from pending_orders to sales
  const saleRef = doc(db, "sales", order.id); // Use same ID for consistency
  const pendingOrderRef = doc(db, "pending_orders", order.id);
  
  const batch = writeBatch(db);
  batch.set(saleRef, { ...order, status: "Completed", completedAt: serverTimestamp() });
  batch.delete(pendingOrderRef);
  
  try {
    await batch.commit();
    alert(`Order #${order.orderId} completed and moved to sales history.`);
    orderDetailsModal.style.display = "none";
  } catch (error) {
    console.error("Error completing order:", error);
  }
}

async function voidOrder(order) {
  // 1. Move from pending_orders to sales with "Void" status
  const saleRef = doc(db, "sales", order.id);
  const pendingOrderRef = doc(db, "pending_orders", order.id);
  
  const batch = writeBatch(db);
  batch.set(saleRef, { ...order, status: "Voided", voidedAt: serverTimestamp() });
  batch.delete(pendingOrderRef);
  
  // 2. We should also *return* the stock. This is complex, but for now, we just log it.
  // In a real system, you'd reverse the stock_movements.
  
  try {
    await batch.commit();
    alert(`Order #${order.orderId} has been voided.`);
    orderDetailsModal.style.display = "none";
  } catch (error) {
    console.error("Error voiding order:", error);
  }
}

// --- Initial Load ---
document.addEventListener("DOMContentLoaded", () => {
  loadAllIngredientsCache();
  loadCategories();
  listenForPendingOrders(); // Start listening for kitchen orders
});