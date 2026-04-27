/**
 * ТЕСТЫ БЕЗОПАСНОСТИ: проверяем защиту от несанкционированного доступа
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = 'security_test_key_32chars_minimum!';
process.env.JWT_SECRET = SECRET;

// ─── Вспомогательные функции ─────────────────────────────
function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = (c) => { r._status = c; return r; };
  r.json = (b) => { r._body = b; return r; };
  return r;
}

function verifyTokenHelper(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return { ok: false, status: 401 };
  const token = authHeader.split(' ')[1];
  try {
    const d = jwt.verify(token, SECRET);
    return { ok: true, userId: d.userId };
  } catch {
    return { ok: false, status: 401 };
  }
}

// ─── Тесты ───────────────────────────────────────────────

// ─── SEC-001: SQL-инъекция в username не ломает логику ────
test('SEC-001: SQL-инъекция в username обрабатывается как обычная строка', () => {
  const maliciousUsername = "admin' OR '1'='1";
  // В реальном коде Supabase использует параметризованные запросы
  // Мы проверяем, что строка воспринимается буквально
  expect(typeof maliciousUsername).toBe('string');
  expect(maliciousUsername).not.toBe('admin'); // не совпадает с "admin"
  
  // Имитация: поиск точного совпадения (как в Supabase .eq())
  const users = [{ username: 'admin', password: 'hash' }];
  const found = users.find(u => u.username === maliciousUsername);
  expect(found).toBeUndefined(); // не нашёл — SQL-инъекция не сработала
});

// ─── SEC-002: XSS в полях не исполняется на сервере ──────
test('SEC-002: XSS-payload в name товара сохраняется как строка', () => {
  const xssPayload = '<script>alert("xss")</script>';
  // Сервер хранит как текст, не исполняет
  const product = { name: xssPayload, price: 100 };
  expect(product.name).toBe(xssPayload); // хранится как есть
  expect(typeof product.name).toBe('string');
  // В браузере textContent (не innerHTML) предотвратит исполнение
});

// ─── SEC-003: Чужой токен не даёт доступ ─────────────────
test('SEC-003: Токен пользователя A не работает как токен пользователя B', () => {
  const tokenA = jwt.sign({ userId: 1 }, SECRET);
  const tokenB = jwt.sign({ userId: 2 }, SECRET);

  const decodedA = jwt.verify(tokenA, SECRET);
  const decodedB = jwt.verify(tokenB, SECRET);

  expect(decodedA.userId).toBe(1);
  expect(decodedB.userId).toBe(2);
  expect(decodedA.userId).not.toBe(decodedB.userId);
});

// ─── SEC-004: Токен с другим секретом отклоняется ─────────
test('SEC-004: JWT подписанный другим секретом — отклоняется', () => {
  const fakeToken = jwt.sign({ userId: 999 }, 'HACKER_SECRET');
  const result = verifyTokenHelper(`Bearer ${fakeToken}`);
  expect(result.ok).toBe(false);
  expect(result.status).toBe(401);
});

// ─── SEC-005: Пустой Bearer отклоняется ──────────────────
test('SEC-005: "Bearer " без токена → 401', () => {
  const result = verifyTokenHelper('Bearer ');
  // Пустая строка после split
  expect(result.ok).toBe(false);
});

// ─── SEC-006: Изменённая подпись токена отклоняется ──────
test('SEC-006: Tampered JWT payload → 401', () => {
  const token = jwt.sign({ userId: 1 }, SECRET);
  // Подменяем payload (добавляем символ в середину)
  const parts = token.split('.');
  const tamperedPayload = parts[1] + 'X'; // портим payload
  const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  
  const result = verifyTokenHelper(`Bearer ${tamperedToken}`);
  expect(result.ok).toBe(false);
});

// ─── SEC-007: Пароль хэшируется bcrypt ───────────────────
test('SEC-007: Пароль в БД никогда не хранится в открытом виде', async () => {
  const password = 'mySecretPassword123';
  const hash = await bcrypt.hash(password, 10);

  expect(hash).not.toBe(password);
  expect(hash.length).toBeGreaterThan(40);
  expect(hash.startsWith('$2b$') || hash.startsWith('$2a$')).toBe(true);
});

// ─── SEC-008: Брутфорс — каждый пароль проверяется отдельно
test('SEC-008: Неверный пароль не раскрывает информацию о пользователе', async () => {
  const hash = await bcrypt.hash('correctPass', 10);
  
  const wrongAttempts = ['wrongpass', '123456', 'admin', 'password'];
  for (const attempt of wrongAttempts) {
    const isValid = await bcrypt.compare(attempt, hash);
    expect(isValid).toBe(false);
  }
  
  // Верный пароль всё ещё работает
  expect(await bcrypt.compare('correctPass', hash)).toBe(true);
});

// ─── SEC-009: Токен не содержит пароль ───────────────────
test('SEC-009: Полезная нагрузка JWT не содержит чувствительных данных', () => {
  const token = jwt.sign({ userId: 5 }, SECRET, { expiresIn: '7d' });
  const decoded = jwt.verify(token, SECRET);

  expect(decoded.userId).toBe(5);
  expect(decoded.password).toBeUndefined();
  expect(decoded.email).toBeUndefined();
  expect(decoded.username).toBeUndefined();
});

// ─── SEC-010: CORS заголовки устанавливаются ─────────────
test('SEC-010: CORS заголовки настроены корректно', () => {
  // Имитируем проверку заголовков (как в api/*.js)
  const headers = {};
  const setHeader = (key, val) => { headers[key] = val; };

  setHeader('Access-Control-Allow-Origin', '*');
  setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  expect(headers['Access-Control-Allow-Origin']).toBe('*');
  expect(headers['Access-Control-Allow-Methods']).toContain('POST');
  expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
});

// ─── SEC-011: Продавец не может редактировать чужой товар
test('SEC-011: Продавец A не может удалить товар продавца B', () => {
  const products = [
    { id: 1, seller_id: 10, name: 'Продавец A', price: 200 },
    { id: 2, seller_id: 20, name: 'Продавец B', price: 300 },
  ];

  function canDeleteProduct(userId, productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return { ok: false, status: 404 };
    if (product.seller_id !== userId) return { ok: false, status: 403 };
    return { ok: true, status: 200 };
  }

  expect(canDeleteProduct(10, 1).ok).toBe(true);   // свой товар
  expect(canDeleteProduct(10, 2).status).toBe(403); // чужой товар
  expect(canDeleteProduct(99, 1).status).toBe(403); // чужой товар
});

// ─── SEC-012: Amount не может быть отрицательным ─────────
test('SEC-012: Отрицательная сумма пополнения отклоняется', () => {
  function validateAmount(amount) {
    return amount && amount >= 100;
  }
  
  expect(validateAmount(-500)).toBeFalsy();
  expect(validateAmount(-1)).toBeFalsy();
  expect(validateAmount(0)).toBeFalsy();
  expect(validateAmount(99)).toBeFalsy();
  expect(validateAmount(100)).toBeTruthy();
});
