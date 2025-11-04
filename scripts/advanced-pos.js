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
const menuImageUpload = document.getElementById("menu-image-upload");
const menuImagePreview = document.getElementById("menu-image-preview");

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
let allRecipesCache = [];
let productStockStatus = new Map();
let allCategories = [];
let currentCategory = "All";
let editMode = false;
let allPendingOrders = [];
let currentOrderDetails = null;
let currentImageFile = null;
let currentImageUrl = null; 
// --- NEW CLOUDINARY UPLOAD FUNCTION ---
async function uploadToCloudinary(file) {
    // --- ⬇️ ⬇️ VITAL: REPLACE THESE WITH YOUR OWN ⬇️ ⬇️ ---
    const CLOUD_NAME = "dofyjwhlu"; 
    const UPLOAD_PRESET = "cafesync";
    // --- ⬆️ ⬆️ VITAL: REPLACE THESE WITH YOUR OWN ⬆️ ⬆️ ---

    const URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);

    try {
        const response = await fetch(URL, {
            method: "POST",
            body: formData
        });
        if (!response.ok) {
            throw new Error(`Cloudinary upload failed with status: ${response.status}`);
        }
        const data = await response.json();
        return data.secure_url; // This is the URL to save to Firestore
    } catch (error) {
        console.error("Error uploading to Cloudinary:", error);
        throw error;
    }
}

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
    
    // Update the modal dropdown
    if (menuCategoryDropdown) {
        menuCategoryDropdown.innerHTML = `<option value="">Select category...</option>`;
        allCategories.forEach(cat => menuCategoryDropdown.add(new Option(cat, cat)));
        menuCategoryDropdown.add(new Option("+ Create New Category...", "__new__"));
    }
    
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function addCategoryIfNew(categoryName) {
  if (categoryName && !allCategories.includes(categoryName)) {
    allCategories.push(categoryName);
    allCategories.sort();
    await setDoc(categoriesRef, { list: allCategories });
    loadCategories(); // Reload all category UI
  }
}

if (menuCategoryDropdown) {
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
}

// --- Recipe & Ingredient Filtering ---
async function loadAllIngredientsCache() {
  // This function is now called by the listener 'listenForIngredients'
  try {
    const snapshot = await getDocs(ingredientsRef);
    allIngredientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error("Error caching all ingredients:", error);
  }
}

function updateIngredientCacheForRecipeModal(selectedCategory) {
  if (!recipeList) return;
  if (!selectedCategory) {
    recipeList.innerHTML = "<p style='color: #666;'>Please select a product category to add ingredients.</p>";
    if (addIngredientBtn) addIngredientBtn.disabled = true;
    return;
  }
  const filteredIngredients = allIngredientsCache.filter(ing => ing.category === selectedCategory);
  recipeList.innerHTML = "";
  if (addIngredientBtn) addIngredientBtn.disabled = false;
  if (filteredIngredients.length === 0) {
     recipeList.innerHTML = `<p style='color: #888;'>No ingredients in "${selectedCategory}" category.</p>`;
  }
  if (addIngredientBtn) addIngredientBtn.onclick = () => addIngredientRow(filteredIngredients);
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

// --- Save Product and Recipe (NOW WITH CLOUDINARY) ---
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
    waitingTime: menuWaitTimeSelect.value,
    isVisible: true,
    imageUrl: currentImageUrl || null, // Start with the existing URL
    // We no longer need 'imagePath'
  };
  
  if (!productData.waitingTime) {
      alert("Please select an average waiting time."); return;
  }
  
  // ... (Recipe data logic remains the same) ...
  const recipeData = [];
  const ingredientRows = recipeList.querySelectorAll(".ingredient-row");
  if (ingredientRows.length === 0) { alert("A product must have at least one ingredient..."); return; }
  let recipeError = false;
  ingredientRows.forEach(row => {
    const ingredientId = row.querySelector(".ingredient-id").value; 
    const qty = parseFloat(row.querySelector(".ingredient-qty").value);
    const unit = row.querySelector(".ingredient-unit").value;
    if (!unit || qty <= 0 || !ingredientId) { recipeError = true; }
    recipeData.push({
      productId: productId,
      ingredientId: ingredientId,
      qtyPerProduct: qty,
      unitUsed: unit
    });
  });
  if (recipeError) { alert("Please check your recipe..."); return; }
  
  // --- NEW UPLOAD LOGIC ---
  try {
    const saveBtn = menuForm.querySelector('button[type="submit"]');

    // Step 1: Upload Image (if a new one was selected)
    if (currentImageFile) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Uploading Image...";

        // --- Use Cloudinary function ---
        const downloadURL = await uploadToCloudinary(currentImageFile);
        productData.imageUrl = downloadURL;
        // --- End Cloudinary logic ---
        
        saveBtn.textContent = "Saving Product...";
    }

    // Step 2: Save Product and Recipe to Firestore
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

    await batch.commit();
    
    alert(`Product ${isEditing ? 'updated' : 'saved'} successfully!`);
    closeMenuModal();
  
  } catch (error) {
    console.error("Error saving product:", error);
    alert(`Failed to save product: ${error.message}`);
  } finally {
    // Re-enable button
    const saveBtn = menuForm.querySelector('button[type="submit"]');
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Product & Recipe";
    }
  }
});

function closeMenuModal() {
  if (menuModal) {
    menuModal.style.display = "none";
    if (menuForm) menuForm.reset();
    if (recipeList) recipeList.innerHTML = "";
    if (document.getElementById("menu-product-id")) document.getElementById("menu-product-id").value = "";
    if (newCategoryInput) newCategoryInput.style.display = "none";
    if (addIngredientBtn) addIngredientBtn.disabled = true;
  }
}

if (addMenuBtn) {
    addMenuBtn.addEventListener("click", () => {
        closeMenuModal();
        loadCategories(); // Reload categories for the modal
        loadAllIngredientsCache(); // Reload ingredients for the modal
        if (menuModal) menuModal.style.display = "flex";
    });
}
if (cancelMenuBtn) {
    cancelMenuBtn.addEventListener("click", closeMenuModal);
}

// --- Display Mode ---
if (displayModeBtn) {
    displayModeBtn.addEventListener("click", () => {
      displayMode = !displayMode;
      displayModeBtn.textContent = displayMode ? 'Exit Display Mode' : 'Display Mode';
      displayModeBtn.classList.toggle('btn--danger', displayMode);
      if (productGrid) productGrid.classList.toggle('display-mode-active', displayMode);
      renderProducts(); // Re-render with display mode
    });
}

// --- POS Category Tabs ---
function renderCategoryTabs() {
  if (!categoryTabsContainer) return;
  categoryTabsContainer.innerHTML = "";
  
  const allTab = document.createElement("button");
  allTab.className = "category-tab" + (currentCategory === "All" ? " active" : "");
  allTab.textContent = "All";
  allTab.onclick = () => { currentCategory = "All"; renderCategoryTabs(); renderProducts(); };
  categoryTabsContainer.appendChild(allTab);
  
  allCategories.forEach(category => {
    const tab = document.createElement("button");
    tab.className = "category-tab" + (currentCategory === category ? " active" : "");
    tab.textContent = category;
    tab.onclick = () => { currentCategory = category; renderCategoryTabs(); renderProducts(); };
    categoryTabsContainer.appendChild(tab);
  });
}

// --- Data Listeners (Fix for doubled items) ---

// 1. Listen to Products
function listenForProducts() {
  const q = query(productsRef, orderBy("category"), orderBy("name"));
  onSnapshot(q, (snapshot) => {
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateAllProductStockStatusAndRender();
  }, (error) => console.error("Error listening to products:", error));
}

// 2. Listen to Ingredients
function listenForIngredients() {
  const qIngredients = query(ingredientsRef, orderBy("name"));
  onSnapshot(qIngredients, (snapshot) => {
    allIngredientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateAllProductStockStatusAndRender();
  }, (error) => console.error("Error listening to ingredients:", error));
}
  
// 3. Listen to Recipes
function listenForRecipes() {
  const qRecipes = query(recipesRef);
  onSnapshot(qRecipes, (snapshot) => {
    allRecipesCache = snapshot.docs.map(doc => doc.data());
    updateAllProductStockStatusAndRender();
  }, (error) => console.error("Error listening to recipes:", error));
}

// 4. Main calculation and render function
function updateAllProductStockStatusAndRender() {
  if (allIngredientsCache.length === 0 || allRecipesCache.length === 0 || allProducts.length === 0) {
    // Don't run until all three caches are populated
    return;
  }
  
  const ingredientStockMap = new Map();
  allIngredientsCache.forEach(ing => {
    const currentStockInBase = (ing.stockQuantity || 0) * (ing.conversionFactor || 1);
    ingredientStockMap.set(ing.id, {
        stock: currentStockInBase,
        minStock: ing.minStockThreshold || 0
    });
  });

  productStockStatus.clear();

  for (const product of allProducts) {
    const productRecipes = allRecipesCache.filter(r => r.productId === product.id);
    let status = "in-stock"; // Default

    if (productRecipes.length === 0) {
      status = "out-of-stock"; // No recipe = out of stock
    } else {
      for (const recipe of productRecipes) {
        const ingredient = ingredientStockMap.get(recipe.ingredientId);
        const neededQty = parseFloat(recipe.qtyPerProduct);

        if (!ingredient) {
          status = "out-of-stock"; // Ingredient missing
          break;
        }
        
        if (ingredient.stock <= 0 || ingredient.stock < neededQty) {
          status = "out-of-stock"; // Not enough for one item
          break;
        }

        if (ingredient.stock <= ingredient.minStock) {
          status = "low-stock"; // Mark as low, but keep checking
        }
      }
    }
    productStockStatus.set(product.id, status);
  }
  
  renderProducts(); // Re-render POS grid with new stock info
  loadCategories(); // Re-render category tabs
}

// --- Render Products to POS Grid ---
function renderProducts() {
  if (!productGrid) return;
  
  productGrid.innerHTML = ""; // Clear grid

  let productsToRender = allProducts;
  if (!editMode) { // <--- THIS IS THE FIX (changed to 'editMode')
    productsToRender = allProducts.filter(p => p.isVisible === true);
  }

  if (currentCategory !== "All") {
    productsToRender = productsToRender.filter(p => p.category === currentCategory);
  }

  if (productsToRender.length === 0) {
    if (currentCategory === "All" && allProducts.length === 0) {
        productGrid.innerHTML = "<p>Loading products...</p>"; // Initial state
    } else {
        productGrid.innerHTML = `<p>No products found in "${currentCategory}".</p>`;
    }
    return;
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
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;
  if (!product.isVisible) card.classList.add("is-hidden");
  
  // --- ADD IMAGE ---
  if (product.imageUrl) {
    const img = document.createElement("img");
    img.src = product.imageUrl;
    img.alt = product.name;
    img.className = "product-card-image";
    card.appendChild(img);
  }
  
  // Create a container for the info
  const infoDiv = document.createElement("div");
  infoDiv.className = "product-card-info";
  infoDiv.innerHTML = `
    <div class="product-name">${product.name}</div>
    <div class="product-category">${product.category}</div>
    <div class="product-price">₱${product.price.toFixed(2)}</div>
  `;
  card.appendChild(infoDiv);

  // --- ADD STOCK LABEL LOGIC ---
  const stockStatus = productStockStatus.get(product.id);
  if (stockStatus === "low-stock" || stockStatus === "out-of-stock") {
    const label = document.createElement("div");
    label.className = `product-stock-label ${stockStatus}`;
    label.textContent = stockStatus === "low-stock" ? "Low Stock" : "Out of Stock";
    card.appendChild(label);
  }
  
  // --- NEW EDIT/HIDE BUTTONS ---
  if (editMode) { // <--- THIS IS THE FIX (was 'displayMode')
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "product-card-edit-controls";

    // 1. Edit Button (Pencil)
    const editBtn = document.createElement("button");
    editBtn.className = "product-edit-btn";
    editBtn.innerHTML = "&#9998;"; // Pencil icon
    editBtn.title = "Edit Item";
    editBtn.onclick = (e) => {
        e.stopPropagation(); // Stop click from bubbling to card
        openEditModal(product);
    };
    controlsDiv.appendChild(editBtn);

    // 2. Visibility Toggle Button
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "product-toggle-btn" + (product.isVisible ? " is-visible" : "");
    toggleBtn.innerHTML = product.isVisible ? "✓" : "×";
    toggleBtn.title = product.isVisible ? "Click to Hide" : "Click to Show";
    toggleBtn.onclick = (e) => { 
        e.stopPropagation();
        handleToggleVisibility(product.id, product.isVisible); 
    };
    controlsDiv.appendChild(toggleBtn);
    
    card.appendChild(controlsDiv);

  } else {
    // Normal mode: check stock and add to cart
    if (stockStatus === "out-of-stock") {
      card.style.cursor = "not-allowed";
      card.style.opacity = "0.6";
    } else {
      card.onclick = () => addToCart(product);
    }
  }
  return card;
}

async function handleToggleVisibility(productId, currentVisibility) {
  try {
    await updateDoc(doc(db, "products", productId), { isVisible: !currentVisibility });
    // No need to call renderProducts(), listener will handle it.
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
    cart.push({ ...product, quantity: 1, waitingTime: product.waitingTime });
  }
  updateCartDisplay();
}

function updateCartDisplay() {
  if (!cartItemsContainer) return;
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
  if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `₱${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `₱${total.toFixed(2)}`;
}

if (cartItemsContainer) {
    cartItemsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("qty-btn")) {
        updateCartQuantity(e.target.dataset.id, parseInt(e.target.dataset.change));
      }
    });
}

if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      if (confirm("Clear the entire cart?")) {
        cart = []; updateCartDisplay();
      }
    });
}

// --- Pending Order System (Cashier) ---

// 1. Listen for clicks on "Process Payment" (Cashier Modal)
if (processPaymentBtn) {
    processPaymentBtn.addEventListener("click", () => {
      if (cart.length === 0) {
        alert("Cart is empty."); return;
      }
      
      // --- NEW LOGIC: Calculate total and show modal ---
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;

      // Show the total in the customer modal
      const customerModalTotal = document.getElementById("customer-modal-total");
      if (customerModalTotal) customerModalTotal.textContent = `₱${total.toFixed(2)}`;

      // --- ADDED: Setup payment listeners ---
      const paymentMethodRadios = document.querySelectorAll('#customer-info-modal input[name="paymentMethod"]');
      const cashDetails = document.getElementById("payment-cash-details");
      const paymentAmountInput = document.getElementById("payment-amount");
      const changeDisplay = document.getElementById("payment-change-display");

      // Real-time change calculator
      if (paymentAmountInput) {
          paymentAmountInput.oninput = () => {
            const paid = parseFloat(paymentAmountInput.value) || 0;
            const change = paid - total;
            
            if (change >= 0) {
              changeDisplay.textContent = `₱${change.toFixed(2)}`;
              changeDisplay.style.color = "var(--color-green-700)";
            } else {
              changeDisplay.textContent = `₱${change.toFixed(2)} (Insufficient)`;
              changeDisplay.style.color = "var(--color-red-500)";
            }
          };
      }
      
      // Toggle cash/online
      paymentMethodRadios.forEach(radio => {
        radio.onchange = () => {
          if (cashDetails) cashDetails.classList.toggle('hidden', radio.value !== 'Cash');
        };
      });

      // Reset form
      const payCashRadio = document.getElementById('pay-cash');
      if (payCashRadio) payCashRadio.checked = true;
      if (cashDetails) cashDetails.classList.remove('hidden');
      if (paymentAmountInput) paymentAmountInput.value = '';
      if (changeDisplay) {
          changeDisplay.textContent = '₱0.00';
          changeDisplay.style.color = "var(--color-text)";
      }
      
      if (customerInfoModal) customerInfoModal.style.display = "flex";
      if (customerInfoForm) customerInfoForm.reset();
    });
}
if (cancelCustomerInfoBtn) {
    cancelCustomerInfoBtn.addEventListener("click", () => {
        if (customerInfoModal) customerInfoModal.style.display = "none";
    });
}

// 2. Handle the customer info form submission
if (customerInfoForm) {
    customerInfoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      
      const customerName = document.getElementById("customer-name").value;
      const orderType = document.getElementById("order-type").value;

      // --- NEW PAYMENT VALIDATION ---
      const paymentMethodRadio = document.querySelector('#customer-info-modal input[name="paymentMethod"]:checked');
      if (!paymentMethodRadio) {
          alert("Please select a payment method.");
          return;
      }
      const paymentMethod = paymentMethodRadio.value;
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;
      
      let paymentAmount = 0;
      let change = 0;

      if (paymentMethod === 'Cash') {
        paymentAmount = parseFloat(document.getElementById('payment-amount').value);
        if (isNaN(paymentAmount) || paymentAmount < total) {
          alert("Payment amount is insufficient or invalid.");
          return; // Stop submission
        }
        change = paymentAmount - total;
      } else {
        // (Online payment)
        paymentAmount = total;
        change = 0;
      }
      
      const paymentDetails = {
        paymentMethod,
        paymentAmount,
        change,
        processedBy: "Cashier" // TODO: Get real employee name
      };
      // --- END VALIDATION ---

      if (customerInfoModal) customerInfoModal.style.display = "none";
      
      // Process the sale *with* payment details
      processSale(customerName, orderType, total, subtotal, tax, paymentDetails);
    });
}

// 3. Main function to process the sale and create a pending order
async function processSale(customerName, orderType, totalAmount, subtotal, tax, paymentDetails) {
  if (processPaymentBtn) {
    processPaymentBtn.disabled = true;
    processPaymentBtn.textContent = "Processing...";
  }
  
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
    const orderRef = doc(collection(db, "pending_orders"));
    const orderId = orderRef.id.substring(0, 4).toUpperCase();
    
    await setDoc(orderRef, { 
      orderId: orderId,
      customerName: customerName,
      orderType: orderType,
      status: "Pending",
      avgWaitTime: avgWaitTime,
      createdAt: serverTimestamp(),
      totalAmount: totalAmount,
      subtotal: subtotal,
      tax: tax,
      ...paymentDetails, // Add payment details to the order
      items: cart.map(item => ({
        productId: item.id,
        name: item.name,
        quantity: item.quantity,
        pricePerItem: item.price,
        waitingTime: item.waitingTime,
        isDone: false
      }))
    });
    
    alert("Order created successfully! Sent to kitchen.");
    cart = [];
    updateCartDisplay();
  } catch (error) {
    console.error("Sale Failed:", error);
    alert(`Sale Failed: ${error.message}`);
  } finally {
    if (processPaymentBtn) {
        processPaymentBtn.disabled = false;
        processPaymentBtn.textContent = "Process Payment";
    }
  }
}

// --- Kitchen / Pending Order Logic ---

// 4. Listen for Pending Orders and render them
function listenForPendingOrders() {
  const q = query(pendingOrdersRef, orderBy("createdAt", "asc"));
  
  onSnapshot(q, (snapshot) => {
    if (!ordersLine) return;
    ordersLine.innerHTML = ""; // Clear the line
    allPendingOrders = []; // Clear and repopulate global list
    
    if (snapshot.empty) {
        ordersLine.innerHTML = "<p class='empty-cart'>No pending orders.</p>";
        return;
    }
    
    snapshot.forEach(doc => {
      const order = { id: doc.id, ...doc.data() };
      allPendingOrders.push(order); // Add to global list
      ordersLine.appendChild(createOrderCard(order));
    });
    
    checkOverdueStatus(); // Check status immediately
    
  }, (error) => {
    console.error("Error listening to pending orders:", error);
    if (ordersLine) ordersLine.innerHTML = "<p class='empty-cart'>Error loading orders.</p>";
  });
}

// Function to check for overdue items
function checkOverdueStatus() {
  const waitTimes = { short: 5, medium: 10, long: 20 }; // minutes
  const now = new Date();

  allPendingOrders.forEach(order => {
    if (order.status !== "Pending" && order.status !== "Preparing") {
        const card = document.querySelector(`.order-card[data-id="${order.id}"]`);
        const dot = card ? card.querySelector('.overdue-dot') : null;
        if (dot) dot.remove(); 
        return; 
    }
    
    const createdAt = order.createdAt?.toDate();
    if (!createdAt) return;

    const minutesPassed = (now - createdAt) / 60000;

    const isOverdue = order.items.some(item =>
        !item.isDone && minutesPassed > waitTimes[item.waitingTime]
    );

    const card = document.querySelector(`.order-card[data-id="${order.id}"]`);
    if (card) {
        const dot = card.querySelector('.overdue-dot');
        if (isOverdue && !dot) {
            const newDot = document.createElement('span');
            newDot.className = 'overdue-dot';
            card.appendChild(newDot);
        } else if (!isOverdue && dot) {
            dot.remove();
        }
    }
  });
}

// 5. Create Order Card HTML (Fix for disappearing orders)
function createOrderCard(order) {
  const card = document.createElement("div");
  card.className = "order-card";
  card.dataset.id = order.id;
  
  const orderStatus = order.status || "Pending";
  const avgTime = order.avgWaitTime || "short";
  const orderId = order.orderId || "----";
  const customerName = order.customerName || "Walk-in";

  let waitClass = "wait-short";
  if (avgTime === "medium") waitClass = "wait-medium";
  if (avgTime === "long") waitClass = "wait-long";
  
  const totalItems = order.items?.length || 0;
  const doneItems = order.items?.filter(i => i.isDone).length || 0;
  const progressPercent = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;
  const progressWidth = `${Math.max(progressPercent, 5)}%`; 
  
  card.innerHTML = `
    <div class="order-card-header">
      <span class="order-card-id">#${orderId}</span>
      <span class="order-card-status status-${orderStatus.toLowerCase()}">${orderStatus}</span>
    </div>
    <p class="order-card-customer">${customerName}</p>
    <p class="order-card-wait-info">
      <span class="wait-text ${waitClass}">Wait: ${avgTime}</span>
    </p>
    <div class="progress-bar" title="${doneItems} / ${totalItems} items ready">
      <div class="progress-bar-inner" style="width: ${progressWidth}; background-color: var(--color-blue-500);"></div>
    </div>
  `;
  
  card.addEventListener("click", () => openOrderDetailsModal(order));
  return card;
}

// 6. Open Order Details Modal (Kitchen Modal)
function openOrderDetailsModal(order) {
  currentOrderDetails = order; 
  
  document.getElementById("order-modal-title").textContent = `Order #${order.orderId}`;
  document.getElementById("order-modal-customer").textContent = order.customerName;
  document.getElementById("order-modal-type").textContent = order.orderType;
  document.getElementById("order-modal-total").textContent = `₱${order.totalAmount.toFixed(2)}`;
  
  const waitText = { short: "< 5 min", medium: "5-10 min", long: "15-20 min" };
  const waitValues = { short: 5, medium: 10, long: 20 };
  document.getElementById("order-modal-wait-time").textContent = waitText[order.avgWaitTime] || "N/A";

  const itemList = document.getElementById("order-modal-item-list");
  if (!itemList) return;
  itemList.innerHTML = "";
  
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item, index) => {
      const li = document.createElement("li");
      let itemWaitClass = "wait-short";
      if (item.waitingTime === "medium") itemWaitClass = "wait-medium";
      if (item.waitingTime === "long") itemWaitClass = "wait-long";
      
      const isPreparing = order.status === "Preparing";
      const isDone = item.isDone || false;
      
      li.innerHTML = `
        <button class="item-check-btn ${isDone ? 'done' : ''}" 
                data-item-index="${index}" ${!isPreparing || isDone ? 'disabled' : ''}>
            ${isDone ? '✓' : ''}
        </button>
        <span>${item.quantity} x ${item.name}</span>
        <span class="item-wait-time ${itemWaitClass}">${waitText[item.waitingTime]}</span>
      `;
      itemList.appendChild(li);
    });
  }
  
  // Clone and replace to remove old listeners, then add new one
  const newItemList = itemList.cloneNode(true);
  itemList.parentNode.replaceChild(newItemList, itemList);
  
  newItemList.addEventListener("click", (e) => {
      if (e.target.classList.contains("item-check-btn")) {
          handleItemCheck(e.target);
      }
  });

  // Helper function to recalculate progress and time
  function recalculateProgress() {
    if (!currentOrderDetails || !currentOrderDetails.items || !Array.isArray(currentOrderDetails.items)) return;

    const totalItems = currentOrderDetails.items.length;
    const doneItems = currentOrderDetails.items.filter(i => i.isDone).length;
    const progressPercent = totalItems > 0 ? (doneItems / totalItems) * 100 : 0;

    const itemProgress = document.getElementById("order-modal-item-progress");
    if (itemProgress) itemProgress.style.width = `${progressPercent}%`;

    let maxRemainingTime = 0;
    currentOrderDetails.items.forEach(item => {
        if (!item.isDone) {
            const itemTime = waitValues[item.waitingTime] || 0;
            if (itemTime > maxRemainingTime) {
                maxRemainingTime = itemTime;
            }
        }
    });

    const estimatedEl = document.getElementById("order-modal-estimated-time");
    if (estimatedEl) {
        if (maxRemainingTime === 0 && doneItems === totalItems) {
            estimatedEl.textContent = "All items ready!";
        } else if (maxRemainingTime === 0) {
            estimatedEl.textContent = "N/A";
        } else {
            estimatedEl.textContent = `Est. ${maxRemainingTime} min remaining`;
        }
    }
    
    const progressBtn = document.getElementById("order-modal-progress-btn");
    if (progressBtn && currentOrderDetails.status === "Preparing") {
        const allDone = currentOrderDetails.items.every(i => i.isDone);
        if (allDone) {
            progressBtn.disabled = false;
            progressBtn.title = "Mark as Ready";
        } else {
            progressBtn.disabled = true;
            progressBtn.title = "Check off all items to mark as ready";
        }
    }
  }

  // Helper function to handle item check/uncheck
  async function handleItemCheck(button) {
    if (!currentOrderDetails || currentOrderDetails.status !== "Preparing") {
        alert("Order must be marked as 'Preparing' before checking off items.");
        return;
    }
    if (button.classList.contains('done')) {
        return;
    }
    
    const itemIndex = parseInt(button.dataset.itemIndex);
    if (isNaN(itemIndex) || !currentOrderDetails.items[itemIndex]) return;

    const item = currentOrderDetails.items[itemIndex];
    item.isDone = true; 

    button.classList.add('done');
    button.innerHTML = '✓';
    button.disabled = true; 
    button.classList.add('disabled');

    try {
        const orderRef = doc(db, "pending_orders", currentOrderDetails.id);
        await updateDoc(orderRef, { items: currentOrderDetails.items });
        recalculateProgress(); 
        checkOverdueStatus(); 
    } catch (error) {
        console.error("Error updating item status:", error);
        item.isDone = false;
        button.classList.remove('done');
        button.innerHTML = '';
        button.disabled = false;
        button.classList.remove('disabled');
        alert("Failed to update item status. Please try again.");
    }
  }
  
  recalculateProgress(); 
  updateModalProgress(order.status);
  orderDetailsModal.style.display = "flex";

  // --- ADD PAYMENT LOGIC (for when modal opens) ---
  const paymentModalTotal = document.getElementById("payment-modal-total");
  if (paymentModalTotal) paymentModalTotal.textContent = `₱${order.totalAmount.toFixed(2)}`;
  
  const paymentMethodRadios = document.querySelectorAll('#order-details-modal input[name="paymentMethod"]');
  const cashDetails = document.getElementById("payment-cash-details");
  const paymentAmountInput = document.getElementById("payment-amount");
  const changeDisplay = document.getElementById("payment-change-display");

  // Radio button listener
  paymentMethodRadios.forEach(radio => {
    radio.onchange = () => {
      if (cashDetails) cashDetails.classList.toggle('hidden', radio.value !== 'Cash');
    };
  });

  // Real-time change calculator
  if (paymentAmountInput) {
      paymentAmountInput.oninput = () => {
        if (!currentOrderDetails) return;
        const total = currentOrderDetails.totalAmount || 0;
        const paid = parseFloat(paymentAmountInput.value) || 0;
        const change = paid - total;
        
        if (change >= 0) {
          changeDisplay.textContent = `₱${change.toFixed(2)}`;
          changeDisplay.style.color = "var(--color-green-700)";
        } else {
          changeDisplay.textContent = `₱${change.toFixed(2)} (Insufficient)`;
          changeDisplay.style.color = "var(--color-red-500)";
        }
      };
  }
  
  // Reset payment form
  const payCashRadio = document.getElementById('pay-cash');
  if (payCashRadio) payCashRadio.checked = true;
  if (cashDetails) cashDetails.classList.remove('hidden');
  if (paymentAmountInput) paymentAmountInput.value = '';
  if (changeDisplay) {
      changeDisplay.textContent = '₱0.00';
      changeDisplay.style.color = "var(--color-text)";
  }
}

// 7. Update Modal Progress Bar & Buttons
function updateModalProgress(status) {
  const statusText = document.getElementById("order-modal-status-text");
  const progressBtn = document.getElementById("order-modal-progress-btn");
  const voidBtn = document.getElementById("order-modal-void-btn");
  
  const itemsContainer = document.getElementById("order-modal-items-container");
  const paymentContainer = document.getElementById("payment-details");

  if (!statusText || !progressBtn || !voidBtn || !itemsContainer || !paymentContainer) return;

  statusText.textContent = status;
  statusText.className = `status status-${status.toLowerCase()}`;

  if (status === "Pending") {
    progressBtn.textContent = "Mark as Preparing";
    progressBtn.disabled = false;
    voidBtn.disabled = false; // Void ENABLED
    
    itemsContainer.classList.remove('hidden');
    paymentContainer.classList.add('hidden'); // Hide payment
    
  } else if (status === "Preparing") {
    progressBtn.textContent = "Mark as Ready";
    voidBtn.disabled = true; // Void DISABLED
    
    itemsContainer.classList.remove('hidden');
    paymentContainer.classList.add('hidden'); // Hide payment
    
    // Check if all items are done
    if (currentOrderDetails && currentOrderDetails.items) {
        const allDone = currentOrderDetails.items.every(i => i.isDone);
        if (allDone) {
            progressBtn.disabled = false;
            progressBtn.title = "Mark as Ready";
        } else {
            progressBtn.disabled = true;
            progressBtn.title = "Check off all items to mark as ready";
        }
    }
    
} else if (status === "Ready") {
    progressBtn.textContent = "Complete Order";
    progressBtn.disabled = false;
    voidBtn.disabled = true; // Void DISABLED
    
    // --- THIS IS THE FIX ---
    // We KEEP the items container visible
    itemsContainer.classList.remove('hidden'); 
    // We HIDE the payment container (which isn't here anyway)
    paymentContainer.classList.add('hidden'); 
    // --- END FIX ---
  }
}

// Helper function to update check buttons state
function updateCheckButtonsState(status) {
    const isPreparing = (status === "Preparing");
    document.querySelectorAll("#order-modal-item-list .item-check-btn").forEach(btn => {
        const isDone = btn.classList.contains('done');
        
        if (isDone) {
            btn.disabled = true; 
            btn.classList.add('disabled');
        } else if (!isPreparing) {
            btn.disabled = true;
            btn.classList.add('disabled');
        } else {
            btn.disabled = false;
            btn.classList.remove('disabled');
        }
    });
}

// 8. Add Event Listeners for Modal Buttons
if (orderModalBackBtn) {
    orderModalBackBtn.addEventListener("click", () => {
      if (orderDetailsModal) orderDetailsModal.style.display = "none";
      currentOrderDetails = null;
    });
}

// --- REPLACE THIS ENTIRE BLOCK ---
if (orderModalProgressBtn) {
    orderModalProgressBtn.addEventListener("click", async () => {
      if (!currentOrderDetails) return;
      
      let newStatus = ""; // This will only be set for 'Pending' or 'Preparing'

      if (currentOrderDetails.status === "Pending") {
        newStatus = "Preparing";
      } 
      else if (currentOrderDetails.status === "Preparing") {
        const allDone = currentOrderDetails.items.every(i => i.isDone);
        if (!allDone) {
            alert("Please check off all items before marking the order as ready.");
            return;
        }
        newStatus = "Ready";
      } 
      else if (currentOrderDetails.status === "Ready") {
        
        // --- FIX: All payment logic is REMOVED ---
        // The payment details are already on the order object.
        // We just need to call completeOrder.
        await completeOrder(currentOrderDetails);
        return; // Stop here
        // --- END OF FIX ---
      }
      
      // This 'if' block is now correctly placed.
      // It will only run if newStatus was set (i.e., for "Pending" or "Preparing")
      if (newStatus) {
        try {
            const orderRef = doc(db, "pending_orders", currentOrderDetails.id);
            await updateDoc(orderRef, { status: newStatus });
            
            currentOrderDetails.status = newStatus;
            updateModalProgress(newStatus);
            updateCheckButtonsState(newStatus);
            
        } catch (error) {
            console.error("Error updating order status:", error);
        }
      }
    });
}

if (orderModalVoidBtn) {
    orderModalVoidBtn.addEventListener("click", async () => {
      if (!currentOrderDetails) return;
      if (!confirm(`Are you sure you want to void Order #${currentOrderDetails.orderId}? This cannot be undone.`)) return;
      
      await voidOrder(currentOrderDetails);
    });
}

// 9. Functions to Complete or Void an Order
async function completeOrder(order, paymentDetails) {
  
  const stockMovements = []; 

  try {
    const allRecipes = [];
    if (order.items && Array.isArray(order.items)) {
        for (const item of order.items) { 
          const q = query(recipesRef, where("productId", "==", item.productId));
          const recipeSnapshot = await getDocs(q);
          if (recipeSnapshot.empty) {
            throw new Error(`No recipe found for "${item.name}".`);
          }
          recipeSnapshot.forEach(recipeDoc => {
            allRecipes.push({ ...recipeDoc.data(), cartQuantity: item.quantity });
          });
        }
    }

    await runTransaction(db, async (transaction) => {
      const ingredientDeductions = new Map();
      
      for (const recipe of allRecipes) {
        if (recipe.ingredientId && recipe.ingredientId.trim() !== "") {
          
          const qtyPer = parseFloat(recipe.qtyPerProduct);
          const cartQty = parseFloat(recipe.cartQuantity);

          if (isNaN(qtyPer) || isNaN(cartQty)) {
             console.error(`Invalid recipe data for product: ${recipe.productId}. qtyPer: ${recipe.qtyPerProduct}, cartQty: ${recipe.cartQuantity}`);
             throw new Error(`Invalid recipe/order data for an item. Check product ID ${recipe.productId}.`);
          }
          
          const totalDeduction = qtyPer * cartQty;

          const existing = ingredientDeductions.get(recipe.ingredientId) || { 
            amountToDeduction: 0, 
            unit: recipe.unitUsed 
          };
          existing.amountToDeduction += totalDeduction;
          ingredientDeductions.set(recipe.ingredientId, existing);
        } else {
          console.warn(`Skipping recipe with missing ingredientId for product ${recipe.productId}`);
        }
      }

      const ingredientDataMap = new Map();
      for (const [ingId, deduction] of ingredientDeductions.entries()) {
        if (!ingId || typeof ingId !== 'string' || ingId.trim() === "") {
          console.warn("⚠️ Skipping ingredient with invalid ID:", ingId);
          continue;
        }
        
        const ingRef = doc(db, "ingredients", ingId);
        const ingDoc = await transaction.get(ingRef);
        
        if (!ingDoc.exists()) {
          throw new Error(`CRITICAL: Ingredient ${ingId} not found.`);
        }
        
        const ingData = ingDoc.data();
        const currentStockInBaseUnits = ingData.stockQuantity * ingData.conversionFactor;
        
        if (deduction.unit !== ingData.baseUnit) {
          throw new Error(`Unit mismatch for ${ingData.name}.`);
        }
        if (currentStockInBaseUnits < deduction.amountToDeduction) {
          throw new Error(`Not enough stock for ${ingData.name}. Order cannot be completed.`);
        }

        ingredientDataMap.set(ingId, {
          ref: ingRef,
          data: ingData,
          currentStockInBaseUnits: currentStockInBaseUnits,
          deduction: deduction
        });
      }

      for (const [ingId, info] of ingredientDataMap.entries()) {
        const newStockInBaseUnits = info.currentStockInBaseUnits - info.deduction.amountToDeduction;
        const newStockInStockUnits = newStockInBaseUnits / info.data.conversionFactor;
        transaction.update(info.ref, { stockQuantity: newStockInStockUnits });

        stockMovements.push({
          ingredientId: ingId,
          ingredientName: info.data.name,
          qtyDeducted: info.deduction.amountToDeduction,
          unit: info.deduction.unit,
          reason: `Sale (Order #${order.orderId})`,
          date: serverTimestamp() 
        });
      }
      
      const saleRef = doc(db, "sales", order.id); 
      const pendingOrderRef = doc(db, "pending_orders", order.id);
  
      transaction.set(saleRef, { 
        ...order, 
        ...paymentDetails, // Add payment details
        status: "Completed", 
        completedAt: serverTimestamp(),
        timestamp: order.createdAt // Keep original timestamp for filtering
      });
      transaction.delete(pendingOrderRef);
    });

    const logBatch = writeBatch(db);
    stockMovements.forEach(log => logBatch.set(doc(collection(db, "stock_movements")), log));
    await logBatch.commit();
    
    alert(`Order #${order.orderId} completed! Stock updated and transaction saved.`);
    if (orderDetailsModal) orderDetailsModal.style.display = "none";
    
  } catch (error) {
    console.error("Error completing order:", error);
    alert(`Error: ${error.message}`);
  }
}

async function voidOrder(order) {
  const saleRef = doc(db, "sales", order.id);
  const pendingOrderRef = doc(db, "pending_orders", order.id);
  
  const batch = writeBatch(db);
  batch.set(saleRef, { ...order, status: "Voided", voidedAt: serverTimestamp() });
  batch.delete(pendingOrderRef);
  
  try {
    await batch.commit();
    alert(`Order #${order.orderId} has been voided.`);
    if (orderDetailsModal) orderDetailsModal.style.display = "none";
  } catch (error) {
    console.error("Error voiding order:", error);
  }
}

// --- Initial Load ---
document.addEventListener("DOMContentLoaded", () => {
  // Start all data listeners
  listenForProducts();
  listenForIngredients();
  listenForRecipes();
  listenForPendingOrders(); // Start listening for kitchen orders
  
  // Start the background timer
  setInterval(checkOverdueStatus, 30000); 
  
  // Note: We no longer call renderProducts() or loadCategories().
  // The listeners will automatically trigger the first render.
});