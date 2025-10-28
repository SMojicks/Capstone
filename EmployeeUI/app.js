import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { loadTransactions } from "../scripts/transaction.js"; // Adjust the path as necessary
import { loadAnalytics } from "../scripts/analytics.js"; // 👈 ADD THIS
// Cart state
let cart = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    setupPOSFunctionality();
    setupLogout();
});

// Navigation functionality
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const targetSection = this.getAttribute('data-section');
            
            // Remove active class from all links and sections
            navLinks.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.remove('active'));
            
            // Add active class to clicked link and corresponding section
            this.classList.add('active');
            document.getElementById(`${targetSection}-section`).classList.add('active');

            if (targetSection === 'analytics') {
                // Check if VanillaCalendar is loaded before calling loadAnalytics
                // Since we removed the calendar, we don't need this check anymore.
                // Let's just call loadAnalytics directly after a log.

                console.log("Analytics tab clicked, attempting to call loadAnalytics..."); // <-- ADD THIS LINE

                if (typeof loadAnalytics === 'function') { // Check if the function is imported correctly
                    loadAnalytics();
                } else {
                    console.error("loadAnalytics function is not defined or imported correctly!");
                }
            }
        });
    });
}

// POS Section Functions
function loadPOSProducts() {
    const productGrid = document.getElementById('product-grid');
    productGrid.innerHTML = '';
    
    data.products.forEach(product => {
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-name">${product.name}</div>
            <div class="product-category">${product.category}</div>
            <div class="product-price">$${product.price.toFixed(2)}</div>
            <div class="product-stock">Stock: ${product.stock}</div>
        `;
        
        productCard.addEventListener('click', () => addToCart(product));
        productGrid.appendChild(productCard);
    });
}

function setupPOSFunctionality() {
    const clearCartBtn = document.querySelector('.payment-buttons .btn--secondary');
    const processPaymentBtn = document.querySelector('.payment-buttons .btn--primary');

    if (clearCartBtn) clearCartBtn.addEventListener('click', clearCart);
    if (processPaymentBtn) processPaymentBtn.addEventListener('click', processPayment);
}

function addToCart(product) {
    const existingItem = cart.find(item => item.id === product.id);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }
    
    updateCartDisplay();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartDisplay();
}

function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(productId);
        } else {
            updateCartDisplay();
        }
    }
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const subtotalEl = document.getElementById('cart-subtotal');
    const taxEl = document.getElementById('cart-tax');
    const totalEl = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Cart is empty</p>';
        subtotalEl.textContent = '$0.00';
        taxEl.textContent = '$0.00';
        totalEl.textContent = '$0.00';
        return;
    }
    
    let subtotal = 0;
    cartItems.innerHTML = '';
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">$${item.price.toFixed(2)} each</div>
            </div>
            <div class="cart-item-quantity">
                <button class="qty-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                <span>${item.quantity}</span>
                <button class="qty-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
            </div>
        `;
        
        cartItems.appendChild(cartItem);
    });
    
    const tax = subtotal * 0.08; // 8% tax
    const total = subtotal + tax;
    
    subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
    taxEl.textContent = `$${tax.toFixed(2)}`;
    totalEl.textContent = `$${total.toFixed(2)}`;
}

function clearCart() {
    cart = [];
    updateCartDisplay();
}

function processPayment() {
    if (cart.length === 0) {
        alert('Cart is empty!');
        return;
    }
    
    const total = parseFloat(document.getElementById('cart-total').textContent.replace('$', ''));
    alert(`Payment processed successfully! Total: $${total.toFixed(2)}`);
    clearCart();
}

// Inventory Section
function loadInventoryTable() {
    const tbody = document.getElementById('inventory-table');
    tbody.innerHTML = '';
    
    data.products.forEach(product => {
        const row = document.createElement('tr');
        const stockClass = product.stock < 20 ? 'stock-low' : product.stock < 40 ? 'stock-medium' : 'stock-high';
        
        row.innerHTML = `
            <td>${product.id}</td>
            <td>${product.name}</td>
            <td>${product.category}</td>
            <td class="${stockClass}">${product.stock}</td>
            <td>$${product.price.toFixed(2)}</td>
            <td>
                <button class="btn btn--outline action-btn">Edit</button>
                <button class="btn btn--outline action-btn">Delete</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}


// Reservations Section
function loadReservationsTable() {
    const tbody = document.getElementById('reservations-table');
    tbody.innerHTML = '';
    
    data.reservations.forEach(reservation => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservation.id}</td>
            <td>${reservation.date}</td>
            <td>${reservation.time}</td>
            <td>${reservation.party}</td>
            <td>${reservation.name}</td>
            <td>${reservation.phone}</td>
            <td>
                <button class="btn btn--outline action-btn">Edit</button>
                <button class="btn btn--outline action-btn">Cancel</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Accounts Section
function loadAccountsTable() {
    const tbody = document.getElementById('accounts-table');
    tbody.innerHTML = '';
    
    data.customers.forEach(customer => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${customer.id}</td>
            <td>${customer.name}</td>
            <td>${customer.email}</td>
            <td>${customer.phone}</td>
            <td>${customer.visits}</td>
            <td>$${customer.total_spent.toFixed(2)}</td>
            <td>
                <button class="btn btn--outline action-btn">View</button>
                <button class="btn btn--outline action-btn">Edit</button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Feedback Section
function loadFeedbackSection() {
    const feedbackList = document.getElementById('feedback-list');
    const avgRatingEl = document.getElementById('avg-rating');
    
    // Calculate average rating
    const totalRating = data.feedback.reduce((sum, item) => sum + item.rating, 0);
    const avgRating = (totalRating / data.feedback.length).toFixed(1);
    avgRatingEl.textContent = avgRating;
    
    // Load feedback items
    feedbackList.innerHTML = '';
    
    data.feedback.forEach(feedback => {
        const feedbackItem = document.createElement('div');
        feedbackItem.className = 'feedback-item';
        
        const stars = '★'.repeat(feedback.rating) + '☆'.repeat(5 - feedback.rating);
        
        feedbackItem.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-customer">${feedback.customer}</div>
                <div class="feedback-rating">${stars}</div>
            </div>
            <div class="feedback-comment">${feedback.comment}</div>
            <div class="feedback-date">${feedback.date}</div>
        `;
        
        feedbackList.appendChild(feedbackItem);
    });
}

// Logout functionality - Fixed implementation
function setupLogout() {
    // Wait for DOM to be fully loaded
    setTimeout(() => {
        const logoutBtn = document.querySelector('.logout-btn');
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                if (confirm('Are you sure you want to logout?')) {
                    alert('Logged out successfully!');
                    // In a real application, this would redirect to login page
                    // For demo purposes, we'll simulate a logout by clearing cart and showing confirmation
                    clearCart();
                    // Reset to POS section
                    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
                    document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
                    document.querySelector('[data-section="pos"]').classList.add('active');
                    document.getElementById('pos-section').classList.add('active');
                }
            });
        } else {
            console.error('Logout button not found');
        }
    }, 100);
}

// Listen for Transactions tab click
document.addEventListener("DOMContentLoaded", () => {
  const transactionsTab = document.querySelector('button[data-section="transactions"]');
  if (transactionsTab) {
    transactionsTab.addEventListener("click", loadTransactions);
  }
});

// Make functions available globally for onclick handlers
window.updateQuantity = updateQuantity;
window.removeFromCart = removeFromCart;