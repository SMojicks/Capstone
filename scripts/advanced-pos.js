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
const salesRef = collection(db, "sales");
const stockMovementsRef = collection(db, "stock_movements");
const categoriesRef = doc(db, "settings", "categories"); // For managing category list

// --- Page Elements ---
const productGrid = document.getElementById("product-grid");
const cartItemsContainer = document.getElementById("cart-items");
const subtotalEl = document.getElementById("cart-subtotal");
const taxEl = document.getElementById("cart-tax");
const totalEl = document.getElementById("cart-total");
const processPaymentBtn = document.querySelector(".payment-buttons .btn--primary");
const clearCartBtn = document.querySelector(".payment-buttons .btn--secondary");
const addMenuBtn = document.getElementById("add-menu-item-btn");
const cancelMenuBtn = document.getElementById("cancel-menu-btn");
const menuModal = document.getElementById("menu-item-modal");
const menuForm = document.getElementById("menu-item-form");
const recipeList = document.getElementById("recipe-list");
const addIngredientBtn = document.getElementById("add-ingredient-btn");
const displayModeBtn = document.getElementById("display-mode-btn"); // Renamed
const categoryTabsContainer = document.getElementById("category-tabs-container");
const menuCategoryDropdown = document.getElementById("menu-category");
const newCategoryInput = document.getElementById("new-category-input");

let cart = [];
let allProducts = [];
let allIngredientsCache = []; // Caches all ingredients
let allCategories = []; // Caches all categories
let currentCategory = "All"; // For POS filtering
let displayMode = false; // Replaces deleteMode

// --- Category Management ---

async function loadCategories() {
  try {
    const docSnap = await getDoc(categoriesRef);
    if (docSnap.exists()) {
      allCategories = docSnap.data().list || [];
    } else {
      // If no category doc, create one
      await setDoc(categoriesRef, { list: [] });
      allCategories = [];
    }
    allCategories.sort();
    
    // 1. Populate POS category tabs
    renderCategoryTabs();
    
    // 2. Populate Modal category dropdown
    menuCategoryDropdown.innerHTML = `<option value="">Select category...</option>`;
    allCategories.forEach(cat => {
      const option = new Option(cat, cat);
      menuCategoryDropdown.add(option);
    });
    menuCategoryDropdown.add(new Option("+ Create New Category...", "__new__"));
    
  } catch (error) {
    console.error("Error loading categories:", error);
  }
}

async function addCategoryIfNew(categoryName) {
  if (categoryName && !allCategories.includes(categoryName)) {
    allCategories.push(categoryName);
    allCategories.sort();
    try {
      await setDoc(categoriesRef, { list: allCategories });
      console.log("New category added:", categoryName);
      loadCategories(); // Reload all category UI
    } catch (error) {
      console.error("Error adding new category:", error);
    }
  }
}

// Event listener for category dropdown in modal
menuCategoryDropdown.addEventListener("change", function() {
  if (this.value === "__new__") {
    newCategoryInput.style.display = "block";
    newCategoryInput.focus();
  } else {
    newCategoryInput.style.display = "none";
    newCategoryInput.value = "";
    // When category changes, filter ingredient cache for recipe modal
    updateIngredientCacheForRecipeModal(this.value);
  }
});

// --- Recipe & Ingredient Filtering ---

// Caches *all* ingredients on page load
async function loadAllIngredientsCache() {
  try {
    const snapshot = await getDocs(ingredientsRef);
    allIngredientsCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("All ingredients cached:", allIngredientsCache.length);
  } catch (error) {
    console.error("Error caching all ingredients:", error);
  }
}

// This function *filters* the already cached ingredients
function updateIngredientCacheForRecipeModal(selectedCategory) {
  if (!selectedCategory) {
    recipeList.innerHTML = "<p style='color: #666;'>Please select a product category to add ingredients.</p>";
    addIngredientBtn.disabled = true;
    return;
  }
  
  const filteredIngredients = allIngredientsCache.filter(ing => ing.category === selectedCategory);
  
  // Clear recipe list if category changes
  recipeList.innerHTML = "";
  addIngredientBtn.disabled = false;
  
  if (filteredIngredients.length === 0) {
     recipeList.innerHTML = `<p style='color: #888;'>No ingredients found in the "${selectedCategory}" category. Add ingredients to inventory first.</p>`;
  }
  
  // Update the 'Add Ingredient' button's logic to use the filtered list
  addIngredientBtn.onclick = () => addIngredientRow(filteredIngredients);
}

// Add Ingredient Row to Modal, using the *filtered* list
function addIngredientRow(filteredIngredients) {
  const row = document.createElement("div");
  row.className = "ingredient-row"; // Keep it simple
  
  const selectOptions = filteredIngredients
    .map(ing => `<option value="${ing.id}" data-base-unit="${ing.baseUnit}">${ing.name} (${ing.baseUnit})</option>`)
    .join('');

  row.innerHTML = `
    <select class="ingredient-id form-control" required>
      <option value="">Select Ingredient...</option>
      ${selectOptions}
    </select>
    <input type="number" class="ingredient-qty form-control" placeholder="Qty" required step="any" min="0">
    <input type="text" class="ingredient-unit form-control" placeholder="Unit (e.g., g, ml)" required>
    <button type="button" class="btn btn--secondary remove-ingredient">X</button>
  `;
  
  row.querySelector(".remove-ingredient").addEventListener("click", () => row.remove());
  
  row.querySelector(".ingredient-id").addEventListener("change", (e) => {
    const selectedOption = e.target.options[e.target.selectedIndex];
    const baseUnit = selectedOption.dataset.baseUnit;
    row.querySelector(".ingredient-unit").value = baseUnit || '';
    row.querySelector(".ingredient-unit").readOnly = true; // Unit is based on ingredient
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
    isVisible: true // Default to visible
  };

  const recipeData = [];
  const ingredientRows = recipeList.querySelectorAll(".ingredient-row");
  
  if (ingredientRows.length === 0) {
    alert("A product must have at least one ingredient in its recipe.");
    return;
  }

  let recipeError = false;
  ingredientRows.forEach(row => {
    const qty = parseFloat(row.querySelector(".ingredient-qty").value);
    const unit = row.querySelector(".ingredient-unit").value;
    if (!unit || qty <= 0) {
        recipeError = true;
    }
    recipeData.push({
      productId: productId,
      ingredientId: row.querySelector(".ingredient-id").value,
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
    // Reset modal state
    closeMenuModal();
    // Re-populate categories just in case
    loadCategories(); 
    menuModal.style.display = "flex";
});
cancelMenuBtn.addEventListener("click", closeMenuModal);

// --- Display Mode ---
displayModeBtn.addEventListener("click", () => {
  displayMode = !displayMode;
  displayModeBtn.textContent = displayMode ? 'Exit Display Mode' : 'Display Mode';
  displayModeBtn.classList.toggle('btn--danger', displayMode); // Use a different color
  productGrid.classList.toggle('display-mode-active', displayMode);
  loadProducts(); // Reload products to show/hide items
});

// --- POS Category Tabs ---
function renderCategoryTabs() {
  categoryTabsContainer.innerHTML = ""; // Clear existing tabs
  
  // 1. Create "All" tab
  const allTab = document.createElement("button");
  allTab.className = "category-tab";
  allTab.textContent = "All";
  if (currentCategory === "All") allTab.classList.add("active");
  allTab.onclick = () => {
    currentCategory = "All";
    loadCategories(); // Refreshes tabs and re-loads products
  };
  categoryTabsContainer.appendChild(allTab);
  
  // 2. Create tabs for each category
  allCategories.forEach(category => {
    const tab = document.createElement("button");
    tab.className = "category-tab";
    tab.textContent = category;
    if (currentCategory === category) tab.classList.add("active");
    tab.onclick = () => {
      currentCategory = category;
      loadCategories(); // Refreshes tabs and re-loads products
    };
    categoryTabsContainer.appendChild(tab);
  });
  
  // 3. Load products for the active category
  loadProducts();
}


// --- Load Products to POS Grid ---
async function loadProducts() {
  productGrid.innerHTML = "Loading products...";
  try {
    let q = query(productsRef, orderBy("category"), orderBy("name")); // Order by category, then name
    
    // Filter by visibility (if NOT in display mode)
    if (!displayMode) {
      q = query(q, where("isVisible", "==", true));
    }
    
    const snapshot = await getDocs(q);
    allProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    productGrid.innerHTML = "";
    
    let productsToRender = allProducts;
    
    // Filter by category if one is selected
    if (currentCategory !== "All") {
      productsToRender = allProducts.filter(p => p.category === currentCategory);
    }
    
    if (productsToRender.length === 0) {
      if (currentCategory === "All") {
          productGrid.innerHTML = "<p>No products found. Add products using the 'Add Menu Item' button.</p>";
      } else {
          productGrid.innerHTML = `<p>No products found in "${currentCategory}".</p>`;
      }
      return;
    }

    let currentHeader = "";
    productsToRender.forEach(product => {
      // If "All" is selected, add headers
      if (currentCategory === "All" && product.category !== currentHeader) {
        currentHeader = product.category;
        const headerEl = document.createElement("div");
        headerEl.className = "product-category-header";
        headerEl.textContent = currentHeader;
        productGrid.appendChild(headerEl);
      }
      
      // Create and append the product card
      productGrid.appendChild(createProductCard(product));
    });
  } catch (error) {
    console.error("Error loading products:", error);
    productGrid.innerHTML = "<p>Error loading products.</p>";
    
    // Check for composite index error
    if (error.code === 'failed-precondition') {
      console.warn(
        "Firestore query failed. This likely means you need to create a composite index. " +
        "Check the error link in the console to create it."
      );
      alert(
        "Error: The database query failed. " +
        "You may need to create a composite index in your Firebase console. " +
        "Please check the developer console (F12) for a link to create it."
      );
    }
  }
}

function createProductCard(product) {
  const card = document.createElement("div");
  card.className = "product-card";
  card.dataset.id = product.id;
  
  // Add hidden class if not visible
  if (!product.isVisible) {
    card.classList.add("is-hidden");
  }
  
  card.innerHTML = `
    <div class="product-name">${product.name}</div>
    <div class="product-category">${product.category}</div>
    <div class="product-price">₱${product.price.toFixed(2)}</div>
  `;
  
  if (displayMode) {
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "product-toggle-btn";
    toggleBtn.innerHTML = product.isVisible ? "✓" : "×"; // Show/Hide icon
    toggleBtn.classList.toggle('is-visible', product.isVisible); // Add class for styling
    toggleBtn.title = product.isVisible ? "Click to Hide" : "Click to Show";
    
    toggleBtn.onclick = (e) => {
      e.stopPropagation();
      handleToggleVisibility(product.id, product.isVisible);
    };
    card.appendChild(toggleBtn);
  } else {
    card.onclick = () => addToCart(product);
  }
  return card;
}

// --- Toggle Product Visibility ---
async function handleToggleVisibility(productId, currentVisibility) {
  const productDocRef = doc(db, "products", productId);
  try {
    await updateDoc(productDocRef, {
      isVisible: !currentVisibility // Flip the boolean
    });
    // Find the product in the local array and update it
    const product = allProducts.find(p => p.id === productId);
    if (product) product.isVisible = !currentVisibility;
    // Refresh the grid (this is simpler than manually updating one card)
    loadProducts();
  } catch (error) {
    console.error("Error toggling visibility:", error);
    alert("Failed to update product visibility.");
  }
}

// --- Cart Functions (No Changes) ---
function addToCart(product) {
  const existingItem = cart.find(item => item.id === product.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
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
    if (item.quantity <= 0) {
      cart = cart.filter(cartItem => cartItem.id !== productId);
    }
  }
  updateCartDisplay();
}

function updateCartTotals() {
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.12; // 12% tax
  const total = subtotal + tax;
  
  subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  taxEl.textContent = `₱${tax.toFixed(2)}`;
  totalEl.textContent = `₱${total.toFixed(2)}`;
}

cartItemsContainer.addEventListener("click", (e) => {
  if (e.target.classList.contains("qty-btn")) {
    const id = e.target.dataset.id;
    const change = parseInt(e.target.dataset.change);
    updateCartQuantity(id, change);
  }
});

clearCartBtn.addEventListener("click", () => {
  if (confirm("Clear the entire cart?")) {
    cart = [];
    updateCartDisplay();
  }
});

// --- Process Payment and Deduct Stock (No Changes) ---
processPaymentBtn.addEventListener("click", processSale);

async function processSale() {
  if (cart.length === 0) {
    alert("Cart is empty.");
    return;
  }
  
  processPaymentBtn.disabled = true;
  processPaymentBtn.textContent = "Processing...";
  
  const stockMovements = []; 

  try {
    await runTransaction(db, async (transaction) => {
      const ingredientDeductions = new Map(); 
      
      for (const item of cart) {
        const q = query(recipesRef, where("productId", "==", item.id));
        const recipeSnapshot = await getDocs(q);
        
        if (recipeSnapshot.empty) {
          throw new Error(`No recipe found for product "${item.name}". Cannot process sale.`);
        }
        
        recipeSnapshot.forEach(recipeDoc => {
          const recipe = recipeDoc.data();
          const totalDeduction = recipe.qtyPerProduct * item.quantity;
          const existing = ingredientDeductions.get(recipe.ingredientId) || { amountToDeduct: 0, unit: recipe.unitUsed };
          existing.amountToDeduct += totalDeduction;
          ingredientDeductions.set(recipe.ingredientId, existing);
        });
      }

      const ingredientDocs = new Map();

      for (const [ingId, deduction] of ingredientDeductions.entries()) {
        const ingRef = doc(db, "ingredients", ingId);
        const ingDoc = await transaction.get(ingRef);
        
        if (!ingDoc.exists()) {
          throw new Error(`Ingredient with ID ${ingId} not found in database.`);
        }
        
        const ingData = ingDoc.data();
        ingredientDocs.set(ingId, ingData);
        
        const currentStockInBaseUnits = ingData.stockQuantity * ingData.conversionFactor;
        
        if (deduction.unit !== ingData.baseUnit) {
          throw new Error(`Recipe unit mismatch for ${ingData.name}. Recipe uses "${deduction.unit}", but inventory base is "${ingData.baseUnit}".`);
        }
        
        if (currentStockInBaseUnits < deduction.amountToDeduct) { 
          throw new Error(`Not enough stock for ${ingData.name}. Required: ${deduction.amountToDeduct}${deduction.unit}, Available: ${currentStockInBaseUnits.toFixed(2)}${ingData.baseUnit}`);
        }

        const newStockInBaseUnits = currentStockInBaseUnits - deduction.amountToDeduct;
        const newStockInStockUnits = newStockInBaseUnits / ingData.conversionFactor;

        transaction.update(ingRef, { stockQuantity: newStockInStockUnits });

        stockMovements.push({
          ingredientId: ingId,
          ingredientName: ingData.name,
          qtyDeducted: deduction.amountToDeduct,
          unit: deduction.unit,
          reason: "Sale",
          date: serverTimestamp()
        });
      }
      
      const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.12;
      const total = subtotal + tax;

      const saleRef = doc(collection(db, "sales"));
      transaction.set(saleRef, {
        timestamp: serverTimestamp(),
        totalAmount: total,
        subtotal: subtotal,
        tax: tax,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantitySold: item.quantity,
          pricePerItem: item.price
        }))
      });
      
    });

    const logBatch = writeBatch(db);
    stockMovements.forEach(log => {
        const logRef = doc(collection(db, "stock_movements"));
        logBatch.set(logRef, log);
    });
    await logBatch.commit();
    
    alert("Sale processed successfully! Inventory updated.");
    cart = [];
    updateCartDisplay();
    
    if(typeof loadTransactions === 'function'){
        loadTransactions();
    }

  } catch (error) {
    console.error("Sale Failed:", error);
    alert(`Sale Failed: ${error.message}`);
  } finally {
    processPaymentBtn.disabled = false;
    processPaymentBtn.textContent = "Process Payment";
  }
}

// --- Initial Load ---
document.addEventListener("DOMContentLoaded", () => {
  loadAllIngredientsCache(); // Load all ingredients once
  loadCategories(); // This will also trigger the first loadProducts()
});