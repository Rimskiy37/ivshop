/**
 * E2E (END-TO-END) ТЕСТЫ — полные пользовательские сценарии
 * Проверяем сквозные бизнес-процессы от начала до конца
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = 'e2e_test_secret_key_32chars_min!!';
process.env.JWT_SECRET = SECRET;

// ─── Мок-БД ──────────────────────────────────────────────
let db = { users: [], products: [], purchases: [], operations: [] };

function resetDb() {
  db = { users: [], products: [], purchases: [], operations: [] };
}

function nextId(arr) { return arr.length + 1; }

// ─── Мок-система ─────────────────────────────────────────
async function register(username, email, password) {
  if (db.users.find(u => u.username === username || u.email === email))
    return { ok: false, status: 400, body: { error: 'User already exists' } };
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: nextId(db.users), username, email, password: hashed, is_seller: false, balance: 0, seller_request: false, seller_approved: false };
  db.users.push(user);
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
  return { ok: true, status: 201, body: { token, user: { id: user.id, username, balance: 0 } } };
}

async function login(username, password) {
  const user = db.users.find(u => u.username === username);
  if (!user) return { ok: false, status: 400, body: { error: 'Invalid credentials' } };
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return { ok: false, status: 400, body: { error: 'Invalid credentials' } };
  const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '7d' });
  return { ok: true, status: 200, body: { token, user: { id: user.id, username } } };
}

function getUserFromToken(token) {
  try {
    const d = jwt.verify(token, SECRET);
    return db.users.find(u => u.id === d.userId) || null;
  } catch { return null; }
}

function addBalance(token, type, amount) {
  const user = getUserFromToken(token);
  if (!user) return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  if (!amount || amount < 100) return { ok: false, status: 400, body: { error: 'Amount must be at least 100' } };
  if (type === 'deposit') user.balance += amount;
  else if (type === 'withdraw') {
    if (user.balance < amount) return { ok: false, status: 400, body: { error: 'Insufficient balance' } };
    user.balance -= amount;
  }
  const op = { id: nextId(db.operations), user_id: user.id, type, amount: type === 'deposit' ? amount : -amount, details: type === 'deposit' ? 'Пополнение баланса' : 'Вывод средств', date: new Date().toISOString() };
  db.operations.push(op);
  return { ok: true, status: 200, body: { balance: user.balance } };
}

function addProduct(token, name, price, category) {
  const user = getUserFromToken(token);
  if (!user) return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  if (!user.is_seller) return { ok: false, status: 403, body: { error: 'Not a seller' } };
  if (!name || !price || price <= 0) return { ok: false, status: 400, body: { error: 'Invalid data' } };
  const product = { id: nextId(db.products), seller_id: user.id, name, price, category, status: 'active', created_at: new Date().toISOString() };
  db.products.push(product);
  return { ok: true, status: 201, body: product };
}

function getProducts(category) {
  let list = db.products.filter(p => p.status === 'active');
  if (category) list = list.filter(p => p.category === category);
  return { ok: true, status: 200, body: list };
}

function purchase(token, productId, email, paymentMethod) {
  const buyer = getUserFromToken(token);
  if (!buyer) return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  const product = db.products.find(p => p.id === productId && p.status === 'active');
  if (!product) return { ok: false, status: 404, body: { error: 'Product not found' } };
  if (buyer.balance < product.price) return { ok: false, status: 400, body: { error: 'Insufficient balance' } };

  const commission = Math.round(product.price * 0.05);
  buyer.balance -= product.price;

  const seller = db.users.find(u => u.id === product.seller_id);
  if (seller) seller.balance += product.price - commission;

  const p = { id: nextId(db.purchases), product_id: productId, buyer_id: buyer.id, seller_id: product.seller_id, amount: product.price, email: email || null, payment_method: paymentMethod || null, date: new Date().toISOString() };
  db.purchases.push(p);
  db.operations.push({ id: nextId(db.operations), user_id: buyer.id, type: 'purchase', amount: -product.price, details: `Покупка ${product.name}`, date: new Date().toISOString() });
  if (seller) db.operations.push({ id: nextId(db.operations), user_id: seller.id, type: 'purchase', amount: product.price - commission, details: `Продажа ${product.name}`, date: new Date().toISOString() });

  return { ok: true, status: 200, body: { message: 'Purchase successful', purchase: p } };
}

function becomeSeller(token) {
  const user = getUserFromToken(token);
  if (!user) return { ok: false, status: 401, body: { error: 'Unauthorized' } };
  user.seller_request = true;
  return { ok: true, status: 200, body: { message: 'Request sent' } };
}

function approveSellerAdmin(userId) {
  const user = db.users.find(u => u.id === userId);
  if (!user) return false;
  user.is_seller = true;
  user.seller_approved = true;
  return true;
}

// ─── E2E ТЕСТЫ ───────────────────────────────────────────

beforeEach(() => resetDb());

// ─── Сценарий 1: Полный жизненный цикл покупателя ────────
test('E2E-001: Регистрация → пополнение → покупка → история', async () => {
  // 1. Продавец регистрируется
  const sellerReg = await register('shop_owner', 'owner@test.ru', 'pass123');
  expect(sellerReg.status).toBe(201);
  const sellerToken = sellerReg.body.token;

  // 2. Продавцу вручную ставим is_seller=true (через "Admin")
  approveSellerAdmin(sellerReg.body.user.id);

  // 3. Продавец добавляет товар
  const productRes = addProduct(sellerToken, 'CS2 Prime Account', 500, 'Аккаунты');
  expect(productRes.status).toBe(201);
  const productId = productRes.body.id;

  // 4. Покупатель регистрируется
  const buyerReg = await register('buyer123', 'buyer@test.ru', 'buyerpass');
  expect(buyerReg.status).toBe(201);
  const buyerToken = buyerReg.body.token;
  const buyerId = buyerReg.body.user.id;

  // 5. Покупатель пополняет баланс
  const depositRes = addBalance(buyerToken, 'deposit', 1000);
  expect(depositRes.status).toBe(200);
  expect(depositRes.body.balance).toBe(1000);

  // 6. Покупатель видит товар в каталоге
  const catalogRes = getProducts('Аккаунты');
  expect(catalogRes.body).toHaveLength(1);
  expect(catalogRes.body[0].name).toBe('CS2 Prime Account');

  // 7. Покупатель покупает товар
  const purchaseRes = purchase(buyerToken, productId, 'buyer@test.ru', 'card');
  expect(purchaseRes.status).toBe(200);
  expect(purchaseRes.body.message).toBe('Purchase successful');

  // 8. Проверяем итоговые балансы
  const buyer = db.users.find(u => u.id === buyerId);
  expect(buyer.balance).toBe(500); // 1000 - 500

  const seller = db.users.find(u => u.username === 'shop_owner');
  const commission = Math.round(500 * 0.05); // 25
  expect(seller.balance).toBe(500 - commission); // 475

  // 9. История операций: 3 записи (deposit + purchase×2)
  expect(db.operations.length).toBe(3);
  expect(db.purchases.length).toBe(1);
  expect(db.purchases[0].email).toBe('buyer@test.ru');
  expect(db.purchases[0].payment_method).toBe('card');
});

// ─── Сценарий 2: Неудачная покупка (мало денег) ──────────
test('E2E-002: Попытка покупки с недостаточным балансом', async () => {
  // Продавец + товар
  const sReg = await register('seller2', 's2@test.ru', 'pass');
  approveSellerAdmin(sReg.body.user.id);
  addProduct(sReg.body.token, 'Дорогой товар', 5000, 'Игры');

  // Покупатель с малым балансом
  const bReg = await register('poorbuy', 'poor@test.ru', 'pass');
  const bToken = bReg.body.token;
  addBalance(bToken, 'deposit', 100);

  // Пытается купить
  const r = purchase(bToken, 1, null, null);
  expect(r.status).toBe(400);
  expect(r.body.error).toBe('Insufficient balance');

  // Баланс не изменился
  const buyer = db.users.find(u => u.username === 'poorbuy');
  expect(buyer.balance).toBe(100);
  expect(db.purchases).toHaveLength(0);
});

// ─── Сценарий 3: Получение статуса продавца ──────────────
test('E2E-003: Пользователь → заявка → одобрение → может добавить товар', async () => {
  const reg = await register('future_seller', 'fs@test.ru', 'pass123');
  const token = reg.body.token;
  const userId = reg.body.user.id;

  // Нет прав продавца
  const failRes = addProduct(token, 'Мой товар', 300, 'Игры');
  expect(failRes.status).toBe(403);

  // Подаём заявку
  const requestRes = becomeSeller(token);
  expect(requestRes.status).toBe(200);
  expect(db.users.find(u => u.id === userId).seller_request).toBe(true);

  // Администратор одобряет
  approveSellerAdmin(userId);
  expect(db.users.find(u => u.id === userId).is_seller).toBe(true);

  // Теперь может добавить товар
  const productRes = addProduct(token, 'Мой товар', 300, 'Игры');
  expect(productRes.status).toBe(201);
  expect(productRes.body.name).toBe('Мой товар');
});

// ─── Сценарий 4: Повторная регистрация ───────────────────
test('E2E-004: Нельзя зарегистрироваться с уже занятым логином', async () => {
  await register('ivan', 'ivan@test.ru', 'pass123');
  const r = await register('ivan', 'other@test.ru', 'pass456');
  expect(r.status).toBe(400);
  expect(db.users).toHaveLength(1);
});

// ─── Сценарий 5: Вход и JWT ──────────────────────────────
test('E2E-005: Вход — JWT используется для защищённых действий', async () => {
  await register('secureuser', 'sec@test.ru', 'pass123');
  const loginRes = await login('secureuser', 'pass123');
  expect(loginRes.status).toBe(200);

  const token = loginRes.body.token;
  const depositRes = addBalance(token, 'deposit', 500);
  expect(depositRes.status).toBe(200);
});

// ─── Сценарий 6: Покупка без токена ─────────────────────
test('E2E-006: Покупка без авторизации → 401', () => {
  const r = purchase('invalid_token', 1, null, null);
  expect(r.status).toBe(401);
  expect(db.purchases).toHaveLength(0);
});

// ─── Сценарий 7: Несколько пополнений и вывод ───────────
test('E2E-007: Серия операций с балансом корректна', async () => {
  const reg = await register('balancetest', 'bt@test.ru', 'pass123');
  const token = reg.body.token;

  addBalance(token, 'deposit', 1000);
  addBalance(token, 'deposit', 500);
  addBalance(token, 'withdraw', 300);
  addBalance(token, 'deposit', 200);

  const user = db.users.find(u => u.username === 'balancetest');
  expect(user.balance).toBe(1400); // 0 + 1000 + 500 - 300 + 200
  expect(db.operations).toHaveLength(4);
});

// ─── Сценарий 8: Тест-кейс TC-001 из курсовой ───────────
test('E2E-008 (TC-001): Успешная покупка — полное соответствие тест-кейсу', async () => {
  // Предусловие из ТЗ: balance=500, цена товара=200, status=active
  const sReg = await register('seller_tc', 'stc@t.ru', 'pass');
  approveSellerAdmin(sReg.body.user.id);
  addProduct(sReg.body.token, 'Test Game', 200, 'Игры');

  const bReg = await register('buyer_tc', 'btc@t.ru', 'pass');
  const bToken = bReg.body.token;
  const bId = bReg.body.user.id;
  addBalance(bToken, 'deposit', 500);

  const r = purchase(bToken, 1, 'test@ya.ru', 'card');
  expect(r.status).toBe(200);

  const buyer = db.users.find(u => u.id === bId);
  const seller = db.users.find(u => u.username === 'seller_tc');

  expect(buyer.balance).toBe(300);           // 500 - 200
  expect(seller.balance).toBe(190);          // 200 - 5% (10)
  expect(db.purchases[0].email).toBe('test@ya.ru');
  expect(db.purchases[0].payment_method).toBe('card');
});
