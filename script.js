// script.js
console.log('Script started');

const API_URL = '';

// Состояние
let currentUser = null;
let token = localStorage.getItem('token');

// При загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  await loadUser();
  setupEventListeners();
  initPageSpecific();
});

// Инициализация темы
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.body.className = savedTheme + '-theme';
  updateThemeButton(savedTheme);
}

// Переключение темы
window.toggleTheme = function() {
  const isDark = document.body.classList.contains('dark-theme');
  const newTheme = isDark ? 'light' : 'dark';
  document.body.className = newTheme + '-theme';
  localStorage.setItem('theme', newTheme);
  updateThemeButton(newTheme);
};

function updateThemeButton(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
  }
}

// Загрузка пользователя по токену
async function loadUser() {
  if (!token) return;
  
  try {
    const res = await fetch(`/api/auth?type=me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      updateUIForUser();
    } else {
      localStorage.removeItem('token');
      token = null;
    }
  } catch (err) {
    console.error('Failed to load user', err);
    localStorage.removeItem('token');
    token = null;
  }
}

// Обновление интерфейса при наличии пользователя
function updateUIForUser() {
  const usernameEl = document.getElementById('username');
  if (usernameEl) usernameEl.textContent = currentUser?.username || 'Гость';
  
  const balanceSpan = document.getElementById('header-balance');
  if (balanceSpan) {
    balanceSpan.textContent = (currentUser?.balance || 0).toLocaleString('ru-RU') + ' ₽';
  }
}

// Установка обработчиков событий
function setupEventListeners() {
  document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);
  document.getElementById('logout-btn')?.addEventListener('click', logout);
}

// Выход
async function logout() {
  if (confirm('Вы уверены, что хотите выйти?')) {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    window.location.href = 'auth.html';
  }
}

// Инициализация страницы в зависимости от URL
function initPageSpecific() {
  const path = window.location.pathname;
  
  if (path.includes('auth.html')) {
    initAuthPage();
  } else if (path.includes('profile.html')) {
    initProfilePage();
  } else if (path.includes('balance.html')) {
    initBalancePage();
  } else if (path.includes('product.html')) {
    initProductPage();
  } else if (path.includes('seller.html')) {
    initSellerPage();
  } else if (path === '/' || path.includes('index.html')) {
    loadProducts(); // Загружаем товары на главную
  }
}

// ------------------ АВТОРИЗАЦИЯ ------------------
function initAuthPage() {
    document.getElementById('show-register')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('register-form').style.display = 'block';
    });
    
    document.getElementById('show-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('register-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
    });

    document.getElementById('login-form')?.addEventListener('submit', login);
    document.getElementById('register-form')?.addEventListener('submit', register);
}

async function login(event) {
    event.preventDefault();
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!username || !password) {
        alert('Заполните все поля');
        return;
    }
    
    try {
        const res = await fetch(`/api/auth?type=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'profile.html';
        } else {
            alert(data.error || 'Ошибка входа');
        }
    } catch (err) {
        alert('Ошибка соединения');
    }
}

async function register(event) {
    event.preventDefault();
    
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value.trim();
    const password2 = document.getElementById('register-password2').value.trim();
    
    if (!username || !email || !password) {
        alert('Заполните все поля');
        return;
    }
    
    if (password !== password2) {
        alert('Пароли не совпадают');
        return;
    }
    
    if (password.length < 6) {
        alert('Пароль должен быть не менее 6 символов');
        return;
    }
    
    try {
        const res = await fetch(`/api/auth?type=register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = 'profile.html';
        } else {
            alert(data.error || 'Ошибка регистрации');
        }
    } catch (err) {
        alert('Ошибка соединения');
    }
}

// ------------------ ПРОФИЛЬ ------------------
async function initProfilePage() {
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }
  
  try {
    const res = await fetch(`/api/auth?type=me`, {  // ИСПРАВЛЕНО
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      document.getElementById('username').textContent = currentUser.username;
      const profileBalanceEl = document.getElementById('profile-balance');
      if (profileBalanceEl) {
        profileBalanceEl.textContent = currentUser.balance.toLocaleString('ru-RU') + ' ₽';
      }
      
      loadPurchases();
      if (currentUser.is_seller) {
        loadSellerProducts();
        loadSales();
      }
    } else {
      localStorage.removeItem('token');
      token = null;
      window.location.href = 'auth.html';
    }
  } catch (err) {
    console.error(err);
  }
  
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active-tab'));
      
      e.target.classList.add('active');
      const tabId = e.target.dataset.tab;
      document.getElementById(tabId).classList.add('active-tab');
    });
  });
  
  document.getElementById('become-seller-btn')?.addEventListener('click', becomeSeller);
}

async function loadPurchases() {
  try {
    const res = await fetch(`/api/purchases`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const purchases = await res.json();
      const container = document.getElementById('purchases-list');
      if (purchases.length === 0) {
        container.innerHTML = '<p class="empty-message">У вас пока нет покупок</p>';
      } else {
        container.innerHTML = purchases.map(p => `
          <div class="purchase-item">
            <span>${p.product?.name || 'Товар'}</span>
            <span>${p.amount.toLocaleString('ru-RU')} ₽</span>
            <span class="purchase-date">${new Date(p.date).toLocaleDateString()}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadSellerProducts() {
  try {
    const res = await fetch(`/api/seller?type=products`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const products = await res.json();
      const container = document.getElementById('seller-products-list');
      if (products.length === 0) {
        container.innerHTML = '<p class="empty-message">У вас нет товаров</p>';
      } else {
        container.innerHTML = products.map(p => `
          <div class="product-item">
            <span>${p.name}</span>
            <span>${p.price.toLocaleString('ru-RU')} ₽</span>
            <span class="product-status">${p.status}</span>
            <button onclick="editProduct('${p.id}')">✏️</button>
            <button onclick="deleteProduct('${p.id}')">🗑️</button>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadSales() {
  try {
    const res = await fetch(`/api/seller?type=sales`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const sales = await res.json();
      const container = document.getElementById('sales-list');
      if (sales.length === 0) {
        container.innerHTML = '<p class="empty-message">Продаж пока нет</p>';
      } else {
        container.innerHTML = sales.map(s => `
          <div class="sale-item">
            <span>${s.product?.name || 'Товар'}</span>
            <span>${s.buyer?.username || 'Покупатель'}</span>
            <span>${s.amount.toLocaleString('ru-RU')} ₽</span>
            <span class="sale-date">${new Date(s.date).toLocaleDateString()}</span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

async function becomeSeller() {
  try {
    const res = await fetch(`/api/user/become-seller`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (res.ok) {
      alert('Заявка на продавца отправлена!');
      document.getElementById('become-seller-btn').disabled = true;
    } else {
      alert('Ошибка отправки заявки');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
}

// ------------------ БАЛАНС ------------------
async function initBalancePage() {
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }
  
  await loadBalance();
  await loadOperations();
  
  document.querySelectorAll('.balance-actions button').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.textContent.includes('Пополнить')) {
        showPaymentModal();
      } else {
        showWithdrawModal();
      }
    });
  });
}

async function loadBalance() {
  try {
    const res = await fetch(`/api/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('balance-amount').textContent = data.balance.toLocaleString('ru-RU');
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadOperations() {
  try {
    const res = await fetch(`/api/balance?type=operations`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const ops = await res.json();
      const container = document.getElementById('operations-list');
      if (ops.length === 0) {
        container.innerHTML = '<p class="empty-message">Нет операций</p>';
      } else {
        container.innerHTML = ops.map(op => `
          <div class="operation">
            <span>${op.details || op.type}</span>
            <span class="operation-date">${new Date(op.date).toLocaleDateString()}</span>
            <span class="${op.amount > 0 ? 'positive' : 'negative'}">
              ${op.amount > 0 ? '+' : ''}${op.amount.toLocaleString('ru-RU')} ₽
            </span>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error(err);
  }
}

window.showPaymentModal = function() {
  document.getElementById('payment-modal').style.display = 'block';
};

window.showWithdrawModal = function() {
  document.getElementById('withdraw-modal').style.display = 'block';
};

window.closeModal = function(modalId) {
  document.getElementById(modalId).style.display = 'none';
};

window.selectPaymentMethod = function(method) {
  document.querySelectorAll('#payment-modal .method').forEach(m => m.classList.remove('active'));
  document.querySelector(`#payment-modal .method[data-method="${method}"]`).classList.add('active');
  
  document.querySelectorAll('#payment-modal .payment-details').forEach(d => d.style.display = 'none');
  document.getElementById(`${method}-details`).style.display = 'block';
};

window.selectWithdrawMethod = function(method) {
  document.querySelectorAll('#withdraw-modal .method').forEach(m => m.classList.remove('active'));
  document.querySelector(`#withdraw-modal .method[data-method="${method}"]`).classList.add('active');
  
  document.querySelectorAll('#withdraw-modal .payment-details').forEach(d => d.style.display = 'none');
  document.getElementById(`withdraw-${method}-details`).style.display = 'block';
};

window.addBalance = async function() {
  const amount = parseFloat(document.getElementById('payment-amount').value);
  if (!amount || amount < 100) {
    alert('Минимальная сумма 100 ₽');
    return;
  }
  
  try {
    const res = await fetch(`/api/balance?type=deposit`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('balance-amount').textContent = data.balance.toLocaleString('ru-RU');
      closeModal('payment-modal');
      await loadOperations();
      alert('Баланс пополнен!');
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
};

window.withdrawBalance = async function() {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  if (!amount || amount < 100) {
    alert('Минимальная сумма 100 ₽');
    return;
  }
  
  try {
    const res = await fetch(`/api/balance?type=withdraw`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount })
    });
    
    if (res.ok) {
      const data = await res.json();
      document.getElementById('balance-amount').textContent = data.balance.toLocaleString('ru-RU');
      closeModal('withdraw-modal');
      await loadOperations();
      alert('Средства выведены!');
    } else {
      const err = await res.json();
      alert(err.error || 'Ошибка');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
};

// ------------------ ТОВАРЫ ------------------
async function initProductPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id');
  
  if (!productId) {
    window.location.href = 'index.html';
    return;
  }
  
  try {
    const res = await fetch(`/api/products/${productId}`);
    if (res.ok) {
      const product = await res.json();
      displayProduct(product);
    } else {
      window.location.href = 'index.html';
    }
  } catch (err) {
    console.error(err);
  }
  
  document.getElementById('purchase-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!token) {
      alert('Войдите в аккаунт');
      window.location.href = 'auth.html';
      return;
    }
    
    const email = document.getElementById('user-email').value;
    const paymentMethod = document.getElementById('payment-type').value;
    
    try {
      const res = await fetch(`/api/purchases`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ productId, email, paymentMethod })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert('Покупка успешна! Ключ отправлен на email');
        window.location.href = 'profile.html';
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка покупки');
      }
    } catch (err) {
      alert('Ошибка соединения');
    }
  });
}

function displayProduct(product) {
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-price').textContent = product.price.toLocaleString('ru-RU') + ' ₽';
  document.getElementById('seller-name').textContent = product.seller?.username || 'IVSHOP';
  document.getElementById('seller-rating').textContent = '★★★★★ 5.0';
  document.getElementById('product-description').textContent = product.description || 'Описание отсутствует';
  if (product.image) {
    document.getElementById('product-image').style.backgroundImage = `url('${product.image}')`;
  }
}

// ------------------ ГЛАВНАЯ (ЗАГРУЗКА ТОВАРОВ) ------------------
async function loadProducts() {
  try {
    const res = await fetch(`/api/products`);
    if (res.ok) {
      const products = await res.json();
      renderProducts(products);
    } else {
      console.error('Failed to load products');
    }
  } catch (err) {
    console.error(err);
  }
}

function renderProducts(products) {
  const gamesGrid = document.querySelector('.games-grid');
  if (!gamesGrid) return;
  
  if (products.length === 0) {
    gamesGrid.innerHTML = '<p class="empty-message">Товаров пока нет</p>';
    return;
  }
  
  gamesGrid.innerHTML = products.map(product => `
    <div class="game-card" data-id="${product.id}">
      <div class="game-image" style="background-image: url('${product.image || 'img/default.jpg'}');">
        <span class="price">${product.price.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div class="game-info">
        <h3>${product.name}</h3>
        <div class="game-meta">
          <span class="genre">${product.category || 'Игры'}</span>
          <span class="rating">★ 5.0</span>
        </div>
        <a href="product.html?id=${product.id}" class="buy-btn">Купить сейчас</a>
      </div>
    </div>
  `).join('');
}

// ------------------ ПРОДАВЕЦ ------------------
async function initSellerPage() {
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }
  
  document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('product-name').value;
    const price = parseFloat(document.getElementById('product-price').value);
    const description = document.getElementById('product-description').value;
    const category = document.getElementById('product-category').value;
    const image = document.getElementById('product-image').value;
    
    try {
      const res = await fetch(`/api/seller?type=products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, price, description, category, image })
      });
      
      if (res.ok) {
        alert('Товар добавлен!');
        window.location.href = 'profile.html';
      } else {
        const err = await res.json();
        alert(err.error || 'Ошибка');
      }
    } catch (err) {
      alert('Ошибка соединения');
    }
  });
}

// Глобальные функции для кнопок
window.editProduct = function(id) {
  window.location.href = `seller.html?edit=${id}`;
};

window.deleteProduct = async function(id) {
  if (!confirm('Удалить товар?')) return;
  
  try {
    const res = await fetch(`/api/seller?type=products&id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (res.ok) {
      alert('Товар удалён');
      window.location.reload();
    } else {
      alert('Ошибка');
    }
  } catch (err) {
    alert('Ошибка соединения');
  }
};