
// scripts/inventory-categories.js
import { db } from './firebase.js';
import { doc, getDoc, setDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

// Reference to the Firestore document that stores the category list
const invCategoriesRef = doc(db, "settings", "inventoryCategories");

// --- DOM Elements ---
let manageBtn, modal, closeBtn, addBtn, newCategoryInput, categoryListDiv, ingredientCategoryDropdown, posIngredientFilterDropdown;

let allInvCategories = [];

// --- Load categories from Firestore ---
async function loadCategories() {
    try {
        const docSnap = await getDoc(invCategoriesRef);
        if (docSnap.exists()) {
            allInvCategories = docSnap.data().list.sort() || [];
        } else {
            // If it doesn't exist, create it
            await setDoc(invCategoriesRef, { list: [] });
            allInvCategories = [];
        }
    } catch (error) {
        console.error("Error loading inventory categories:", error);
    }
    
    populateCategoryList();
    populateDropdowns();
}

// --- Populate the list in the "Manage" modal ---
function populateCategoryList() {
    if (!categoryListDiv) return;
    categoryListDiv.innerHTML = "";
    if (allInvCategories.length === 0) {
        categoryListDiv.innerHTML = "<p>No categories created yet.</p>";
        return;
    }
    
    allInvCategories.forEach(category => {
        const item = document.createElement("div");
        item.className = "category-list-item";
        item.innerHTML = `
            <span>${category}</span>
            <button class="btn-icon btn--icon-delete delete-cat-btn" data-category="${category}" title="Delete Category">🗑</button>
        `;
        categoryListDiv.appendChild(item);
    });
}

// --- Populate dropdowns in other modals ---
function populateDropdowns() {
    // 1. For the "Add Ingredient" modal
    ingredientCategoryDropdown = document.getElementById("product-category-dropdown");
    if (ingredientCategoryDropdown) {
        ingredientCategoryDropdown.innerHTML = `<option value="">Select category...</option>`;
        allInvCategories.forEach(category => {
            ingredientCategoryDropdown.add(new Option(category, category));
        });
    }
    
    // 2. For the "Add Menu Item" (POS) recipe filter
    posIngredientFilterDropdown = document.getElementById("ingredient-category-filter");
    if (posIngredientFilterDropdown) {
        posIngredientFilterDropdown.innerHTML = `<option value="">All Inventory Categories</option>`;
        allInvCategories.forEach(category => {
            posIngredientFilterDropdown.add(new Option(category, category));
        });
    }
}

// --- Add a new category ---
async function addCategory() {
    const newCategory = newCategoryInput.value.trim();
    if (!newCategory) {
        alert("Please enter a category name.");
        return;
    }
    if (allInvCategories.includes(newCategory)) {
        alert("This category already exists.");
        return;
    }

    try {
        await setDoc(invCategoriesRef, { list: arrayUnion(newCategory) }, { merge: true });
        newCategoryInput.value = "";
        await loadCategories(); // Reload
    } catch (error) {
        console.error("Error adding category:", error);
    }
}

// --- Delete a category ---
async function deleteCategory(categoryName) {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"? This cannot be undone.`)) {
        return;
    }
    
    try {
        await setDoc(invCategoriesRef, { list: arrayRemove(categoryName) }, { merge: true });
        await loadCategories(); // Reload
    } catch (error) {
        console.error("Error deleting category:", error);
    }
}

// --- Event Listeners ---
document.addEventListener("DOMContentLoaded", () => {
    // Assign elements
    manageBtn = document.getElementById("manage-categories-btn");
    modal = document.getElementById("inventory-category-modal");
    closeBtn = document.getElementById("close-inv-category-btn");
    addBtn = document.getElementById("add-inv-category-btn");
    newCategoryInput = document.getElementById("new-inv-category-name");
    categoryListDiv = document.getElementById("existing-inv-categories-list");

    if (manageBtn) {
        manageBtn.addEventListener("click", () => {
            loadCategories(); // Always get fresh data
            if(modal) modal.style.display = "flex";
        });
    }
    
    if (closeBtn) closeBtn.addEventListener("click", () => modal.style.display = "none");
    if (addBtn) addBtn.addEventListener("click", addCategory);
    
    if (categoryListDiv) {
        categoryListDiv.addEventListener("click", (e) => {
            if (e.target.classList.contains("delete-cat-btn")) {
                deleteCategory(e.target.dataset.category);
            }
        });
    }
    
    // Load once on page load to populate dropdowns
    loadCategories();
});