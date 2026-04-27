/**
 * ИНТЕГРАЦИОННЫЕ ТЕСТЫ: полные сценарии API
 * Мокируем Supabase, тестируем всю цепочку запрос → обработчик → ответ
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = 'integration_test_secret_32chars!!';
process.env.JWT_SECRET = SECRET;

// ─── Мок-хранилище (имитирует Supabase) ──────────────────
let db = {
  users: [],
  products: [],
  purchases: [],
  operations: [],
};

function resetDb() {
  db = { users: [], products: [], purchases: [], operations: [] };
}

// Хелперы для имитации запросов к "БД"
const fakeSupabase = {
  findUserByUsernameOrEmail(username, email) {
    return db.users.find(u => u.username === username || u.email === email) || null;
  },
  findUserById(id) {
    return db.users.find(u => u.id === id) || null;
  },
  findProductById(id) {
    return db.products.find(p => p.id === id) || null;
  },
  insertUser(data) {
    const user = { id: db.users.length + 1, ...data };
    db.users.push(user);
    return user;
  },
  insertProduct(data) {
    const p = { id: db.products.length + 1, created_at: new Date().toISOString(), ...data };
    db.products.push(p);
    return p;
  },
  insertPurchase(data) {
    const p = { id: db.purchases.length + 1, date: new Date().toISOString(), ...data };
    db.purchases.push(p);
    return p;
  },
  insertOperation(data) {
    const op = { id: db.operations.length + 1, date: new Date().toISOString(), ...data };
    db.operations.push(op);
    return op;
  },
  updateBalance(userId, newBalance) {
    const u = db.users.find(u => u.id === userId);
    if (u) u.balance = newBalance;
  },
  getActiveProducts() {
    return db.products.filter(p => p.status === 'active');
  },
};

// ─── Имитация обработчиков (аналог api/*.js) ─────────────

// auth — register
async function handleRegister({ username, email, password }) {
  if (!username || !email || !password) {
    return { status: 400, body: { error: 'Missing fields' } };
  }
  const existing = fakeSupabase.findUserByUsernameOrEmail(username, email);
  if (existing) {
    return { status: 400, body: { error: 'User already exists' } };
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = fakeSupabase.insertUser({
    username, email, password: hashed,
    is_seller: false, balance: 0,
    seller_request: false, seller_approved: false,
  });
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
  return { status: 201, body: { token, user: { id: user.id, username, email, is_seller: false, balance: 0 } } };
}

// auth — login
async function handleLogin({ username, password }) {
  if (!username || !password) {
    return { status: 400, body: { error: 'Missing fields' } };
  }
  const user = fakeSupabase.findUserByUsernameOrEmail(username, null);
  if (!user) return { status: 400, body: { error: 'Invalid credentials' } };
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return { status: 400, body: { error: 'Invalid credentials' } };
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
  return { status: 200, body: { token, user: { id: user.id, username } } };
}

// purchases
async function handlePurchase({ userId, productId, email, paymentMethod }) {
  const product = fakeSupabase.findProductById(productId);
  if (!product || product.status !== 'active') {
    return { status: 404, body: { error: 'Product not found' } };
  }
  const buyer = fakeSupabase.findUserById(userId);
  if (!buyer) return { status: 404, body: { error: 'User not found' } };
  if (buyer.balance < product.price) {
    return { status: 400, body: { error: 'Insufficient balance' } };
  }

  fakeSupabase.updateBalance(userId, buyer.balance - product.price);
  const seller = fakeSupabase.findUserById(product.seller_id);
  if (seller) {
    const commission = Math.round(product.price * 0.05);
    fakeSupabase.updateBalance(seller.id, seller.balance + product.price - commission);
  }

  const purchase = fakeSupabase.insertPurchase({
    product_id: productId, buyer_id: userId,
    seller_id: product.seller_id, amount: product.price,
    email: email || null, payment_method: paymentMethod || null,
  });
  fakeSupabase.insertOperation({ user_id: userId, type: 'purchase', amount: -product.price, details: `Покупка ${product.name}` });
  if (seller) fakeSupabase.insertOperation({ user_id: seller.id, type: 'purchase', amount: product.price - Math.round(product.price * 0.05), details: `Продажа ${product.name}` });

  return { status: 200, body: { message: 'Purchase successful', purchase } };
}

// balance
async function handleBalance({ userId, type, amount }) {
  if (!amount || amount < 100) {
    return { status: 400, body: { error: 'Amount must be at least 100' } };
  }
  const user = fakeSupabase.findUserById(userId);
  if (!user) return { status: 404, body: { error: 'User not found' } };

  let newBalance;
  if (type === 'deposit') {
    newBalance = user.balance + amount;
  } else if (type === 'withdraw') {
    if (user.balance < amount) return { status: 400, body: { error: 'Insufficient balance' } };
    newBalance = user.balance - amount;
  } else {
    return { status: 400, body: { error: 'Invalid type' } };
  }

  fakeSupabase.updateBalance(userId, newBalance);
  fakeSupabase.insertOperation({
    user_id: userId, type,
    amount: type === 'deposit' ? amount : -amount,
    details: type === 'deposit' ? 'Пополнение баланса' : 'Вывод средств',
  });

  return { status: 200, body: { balance: newBalance } };
}

// ─── ТЕСТЫ ────────────────────────────────────────────────

beforeEach(() => resetDb());

// ─── Регистрация ─────────────────────────────────────────
describe('Регистрация (POST /api/auth?type=register)', () => {
  test('IT-001: Успешная регистрация нового пользователя', async () => {
    const r = await handleRegister({ username: 'ivan', email: 'ivan@test.ru', password: 'secret123' });
    expect(r.status).toBe(201);
    expect(r.body.token).toBeTruthy();
    expect(r.body.user.username).toBe('ivan');
    expect(r.body.user.balance).toBe(0);
    expect(db.users).toHaveLength(1);
  });

  test('IT-002: Дубликат username → 400', async () => {
    await handleRegister({ username: 'ivan', email: 'ivan@test.ru', password: 'secret123' });
    const r = await handleRegister({ username: 'ivan', email: 'other@test.ru', password: 'pass456' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('User already exists');
    expect(db.users).toHaveLength(1);
  });

  test('IT-003: Дубликат email → 400', async () => {
    await handleRegister({ username: 'ivan', email: 'shared@test.ru', password: 'pass1' });
    const r = await handleRegister({ username: 'petya', email: 'shared@test.ru', password: 'pass2' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('User already exists');
  });

  test('IT-004: Отсутствуют обязательные поля → 400', async () => {
    const r = await handleRegister({ username: 'ivan', email: '', password: '' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Missing fields');
  });

  test('IT-005: Пароль хэшируется, не хранится в открытом виде', async () => {
    await handleRegister({ username: 'user1', email: 'u@u.ru', password: 'mypassword' });
    const storedUser = db.users[0];
    expect(storedUser.password).not.toBe('mypassword');
    expect(storedUser.password.startsWith('$2')).toBe(true); // bcrypt hash
  });
});

// ─── Вход ────────────────────────────────────────────────
describe('Вход (POST /api/auth?type=login)', () => {
  beforeEach(async () => {
    await handleRegister({ username: 'testuser', email: 'test@test.ru', password: 'mypass123' });
  });

  test('IT-006: Успешный вход с верными данными', async () => {
    const r = await handleLogin({ username: 'testuser', password: 'mypass123' });
    expect(r.status).toBe(200);
    expect(r.body.token).toBeTruthy();
    const decoded = jwt.verify(r.body.token, SECRET);
    expect(decoded.userId).toBe(1);
  });

  test('IT-007: Неверный пароль → 400', async () => {
    const r = await handleLogin({ username: 'testuser', password: 'wrongpassword' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Invalid credentials');
  });

  test('IT-008: Несуществующий пользователь → 400', async () => {
    const r = await handleLogin({ username: 'ghost', password: 'pass' });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Invalid credentials');
  });
});

// ─── Покупка ─────────────────────────────────────────────
describe('Покупка (POST /api/purchases)', () => {
  let buyerId, sellerId;

  beforeEach(async () => {
    // Создаём продавца
    const sellerReg = await handleRegister({ username: 'seller', email: 'seller@test.ru', password: 'pass123' });
    sellerId = sellerReg.body.user.id;
    fakeSupabase.updateBalance(sellerId, 0);

    // Создаём покупателя с балансом 1000
    const buyerReg = await handleRegister({ username: 'buyer', email: 'buyer@test.ru', password: 'pass123' });
    buyerId = buyerReg.body.user.id;
    fakeSupabase.updateBalance(buyerId, 1000);

    // Добавляем товар
    fakeSupabase.insertProduct({ seller_id: sellerId, name: 'CS2 Prime', price: 350, category: 'Аккаунты', status: 'active' });
  });

  test('IT-009: Успешная покупка — балансы обновляются', async () => {
    const r = await handlePurchase({ userId: buyerId, productId: 1, email: 'buyer@mail.ru', paymentMethod: 'card' });
    
    expect(r.status).toBe(200);
    expect(r.body.message).toBe('Purchase successful');
    
    const buyer = fakeSupabase.findUserById(buyerId);
    const seller = fakeSupabase.findUserById(sellerId);
    
    expect(buyer.balance).toBe(650);      // 1000 - 350
    expect(seller.balance).toBe(332);     // 350 - 18 (5% от 350 = 17.5 → 18)
  });

  test('IT-010: Создаются записи операций после покупки', async () => {
    await handlePurchase({ userId: buyerId, productId: 1, email: null, paymentMethod: null });
    expect(db.operations).toHaveLength(2);
    expect(db.operations[0].amount).toBeLessThan(0); // покупатель теряет
    expect(db.operations[1].amount).toBeGreaterThan(0); // продавец получает
  });

  test('IT-011: Недостаток баланса → 400', async () => {
    fakeSupabase.updateBalance(buyerId, 100); // меньше цены товара 350
    const r = await handlePurchase({ userId: buyerId, productId: 1, email: null, paymentMethod: null });
    
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Insufficient balance');
    
    // Баланс не изменился
    expect(fakeSupabase.findUserById(buyerId).balance).toBe(100);
  });

  test('IT-012: Несуществующий товар → 404', async () => {
    const r = await handlePurchase({ userId: buyerId, productId: 999 });
    expect(r.status).toBe(404);
    expect(r.body.error).toBe('Product not found');
  });

  test('IT-013: Товар не active → 404', async () => {
    fakeSupabase.insertProduct({ id: 99, seller_id: sellerId, name: 'Old', price: 100, status: 'sold' });
    const r = await handlePurchase({ userId: buyerId, productId: 99 });
    expect(r.status).toBe(404);
  });

  test('IT-014: Создаётся запись в purchases с email и способом оплаты', async () => {
    await handlePurchase({ userId: buyerId, productId: 1, email: 'buyer@test.ru', paymentMethod: 'sbp' });
    expect(db.purchases).toHaveLength(1);
    expect(db.purchases[0].email).toBe('buyer@test.ru');
    expect(db.purchases[0].payment_method).toBe('sbp');
  });

  test('IT-015: Комиссия 5% удерживается платформой', async () => {
    const price = 350;
    const commission = Math.round(price * 0.05); // 18
    
    await handlePurchase({ userId: buyerId, productId: 1, email: null, paymentMethod: null });
    
    const seller = fakeSupabase.findUserById(sellerId);
    const buyer = fakeSupabase.findUserById(buyerId);
    
    expect(buyer.balance + price).toBe(1000); // баланс до покупки
    expect(seller.balance + commission).toBe(price); // seller_amount + commission = price
  });
});

// ─── Баланс ──────────────────────────────────────────────
describe('Управление балансом (POST /api/balance)', () => {
  let userId;

  beforeEach(async () => {
    const r = await handleRegister({ username: 'balanceuser', email: 'b@test.ru', password: 'pass123' });
    userId = r.body.user.id;
    fakeSupabase.updateBalance(userId, 500);
  });

  test('IT-016: Пополнение баланса', async () => {
    const r = await handleBalance({ userId, type: 'deposit', amount: 1000 });
    expect(r.status).toBe(200);
    expect(r.body.balance).toBe(1500);
    expect(fakeSupabase.findUserById(userId).balance).toBe(1500);
  });

  test('IT-017: Вывод средств', async () => {
    const r = await handleBalance({ userId, type: 'withdraw', amount: 300 });
    expect(r.status).toBe(200);
    expect(r.body.balance).toBe(200);
  });

  test('IT-018: Вывод больше баланса → 400', async () => {
    const r = await handleBalance({ userId, type: 'withdraw', amount: 1000 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Insufficient balance');
    expect(fakeSupabase.findUserById(userId).balance).toBe(500); // не изменился
  });

  test('IT-019: Сумма менее 100 → 400', async () => {
    const r = await handleBalance({ userId, type: 'deposit', amount: 50 });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Amount must be at least 100');
  });

  test('IT-020: Операция записывается в историю', async () => {
    await handleBalance({ userId, type: 'deposit', amount: 500 });
    expect(db.operations).toHaveLength(1);
    expect(db.operations[0].type).toBe('deposit');
    expect(db.operations[0].amount).toBe(500); // положительное
  });

  test('IT-021: Вывод записывается как отрицательная операция', async () => {
    await handleBalance({ userId, type: 'withdraw', amount: 200 });
    expect(db.operations[0].amount).toBe(-200);
  });
});

// ─── Каталог товаров ─────────────────────────────────────
describe('Каталог товаров (GET /api/products)', () => {
  beforeEach(() => {
    fakeSupabase.insertProduct({ seller_id: 1, name: 'Игра 1', price: 200, category: 'Игры', status: 'active' });
    fakeSupabase.insertProduct({ seller_id: 1, name: 'Аккаунт CS2', price: 350, category: 'Аккаунты', status: 'active' });
    fakeSupabase.insertProduct({ seller_id: 1, name: 'Проданная игра', price: 100, category: 'Игры', status: 'sold' });
  });

  test('IT-022: Возвращаются только активные товары', () => {
    const products = fakeSupabase.getActiveProducts();
    expect(products).toHaveLength(2);
    expect(products.every(p => p.status === 'active')).toBe(true);
  });

  test('IT-023: Фильтрация по категории "Игры"', () => {
    const games = fakeSupabase.getActiveProducts().filter(p => p.category === 'Игры');
    expect(games).toHaveLength(1);
    expect(games[0].name).toBe('Игра 1');
  });

  test('IT-024: Фильтрация по категории "Аккаунты"', () => {
    const accounts = fakeSupabase.getActiveProducts().filter(p => p.category === 'Аккаунты');
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe('Аккаунт CS2');
  });
});
