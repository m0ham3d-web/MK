// API Base URL
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const authBtn = document.getElementById('authBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authModal = document.getElementById('authModal');
const closeBtn = document.querySelector('.close');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const tabBtns = document.querySelectorAll('.tab-btn');
const addProductBtn = document.getElementById('addProductBtn');
const productModal = document.getElementById('productModal');
const productForm = document.getElementById('productForm');
const productsGrid = document.getElementById('productsGrid');

// State
let currentUser = null;
let token = localStorage.getItem('token');

// Theme Toggle
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

// Load saved theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.theme-icon');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Auth Modal
authBtn.addEventListener('click', () => {
    authModal.classList.remove('hidden');
});

// Product Modal
addProductBtn.addEventListener('click', () => {
    productModal.classList.remove('hidden');
});

closeBtn.addEventListener('click', () => {
    authModal.classList.add('hidden');
    productModal.classList.add('hidden');
});

authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
        authModal.classList.add('hidden');
    }
});

productModal.addEventListener('click', (e) => {
    if (e.target === productModal) {
        productModal.classList.add('hidden');
    }
});

// Tab Switching
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const tab = btn.dataset.tab;
        if (tab === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
        }
    });
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(loginForm);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            token = result.token;
            currentUser = result.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            authModal.classList.add('hidden');
            loginForm.reset();
            loadProducts();
        } else {
            document.getElementById('loginError').textContent = result.error;
        }
    } catch (error) {
        document.getElementById('loginError').textContent = 'حدث خطأ في الاتصال';
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(registerForm);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            token = result.token;
            currentUser = result.user;
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(currentUser));
            updateAuthUI();
            authModal.classList.add('hidden');
            registerForm.reset();
            loadProducts();
        } else {
            document.getElementById('registerError').textContent = result.error;
        }
    } catch (error) {
        document.getElementById('registerError').textContent = 'حدث خطأ في الاتصال';
    }
});

// Logout
logoutBtn.addEventListener('click', () => {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    updateAuthUI();
    loadProducts();
});

// Update Auth UI
function updateAuthUI() {
    if (token) {
        authBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
        addProductBtn.classList.remove('hidden');
    } else {
        authBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
        addProductBtn.classList.add('hidden');
    }
}

// Add Product
productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!token) {
        document.getElementById('productError').textContent = 'يجب تسجيل الدخول لإضافة منتج';
        return;
    }
    
    const formData = new FormData(productForm);
    
    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            productForm.reset();
            productModal.classList.add('hidden');
            loadProducts();
        } else {
            document.getElementById('productError').textContent = result.error;
        }
    } catch (error) {
        document.getElementById('productError').textContent = 'حدث خطأ في الاتصال';
    }
});

// Load Products
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        displayProducts(products);
    } catch (error) {
        productsGrid.innerHTML = '<p class="no-products">حدث خطأ في تحميل المنتجات</p>';
    }
}

// Display Products
function displayProducts(products) {
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="no-products">لا توجد منتجات حالياً</p>';
        return;
    }
    
    productsGrid.innerHTML = products.map(product => `
        <div class="product-card">
            ${product.image_url ? 
                `<img src="${product.image_url}" alt="${product.name}" class="product-image">` :
                `<div class="product-image" style="display: flex; align-items: center; justify-content: center; background: var(--border-color); color: var(--text-color);">لا توجد صورة</div>`
            }
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description || 'لا يوجد وصف'}</p>
                <p class="product-price">${product.price.toFixed(2)} ر.س</p>
                <p class="product-quantity">الكمية: ${product.quantity}</p>
                ${token && currentUser ? `
                    <div class="product-actions">
                        <button class="edit-btn" onclick="editProduct(${product.id})">تعديل</button>
                        <button class="delete-btn" onclick="deleteProduct(${product.id})">حذف</button>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Delete Product
async function deleteProduct(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/products/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            loadProducts();
        } else {
            alert('فشل حذف المنتج');
        }
    } catch (error) {
        alert('حدث خطأ في الاتصال');
    }
}

// Edit Product (simplified - opens prompt)
async function editProduct(id) {
    try {
        const response = await fetch(`${API_URL}/products/${id}`);
        const product = await response.json();
        
        const newName = prompt('اسم المنتج:', product.name);
        if (newName === null) return;
        
        const newPrice = prompt('السعر:', product.price);
        if (newPrice === null) return;
        
        const newQuantity = prompt('الكمية:', product.quantity);
        if (newQuantity === null) return;
        
        const newDescription = prompt('الوصف:', product.description || '');
        if (newDescription === null) return;
        
        const formData = new FormData();
        formData.append('name', newName);
        formData.append('price', newPrice);
        formData.append('quantity', newQuantity);
        formData.append('description', newDescription);
        formData.append('existing_image', product.image_url || '');
        
        const updateResponse = await fetch(`${API_URL}/products/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        if (updateResponse.ok) {
            loadProducts();
        } else {
            alert('فشل تحديث المنتج');
        }
    } catch (error) {
        alert('حدث خطأ في الاتصال');
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const savedUser = localStorage.getItem('user');
    if (savedUser && token) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
    } else {
        updateAuthUI();
    }
    
    // Load products
    loadProducts();
});
