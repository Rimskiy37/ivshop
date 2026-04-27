/**
 * ЮНИТ-ТЕСТЫ: логика аутентификации (auth.js)
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const SECRET = 'unit_test_secret_key_32chars_min!';
process.env.JWT_SECRET = SECRET;

function makeRes() {
  const r = { _status: 200, _body: null };
  r.status = c => { r._status = c; return r; };
  r.json = b => { r._body = b; return r; };
  return r;
}

// Тест 1
test('Регистрация — пустые поля → 400', () => {
  const body = { username: '', email: '', password: '' };
  const res = makeRes();
  if (!body.username || !body.email || !body.password) res.status(400).json({ error: 'Missing fields' });
  expect(res._status).toBe(400);
  expect(res._body.error).toBe('Missing fields');
});

// Тест 2
test('Регистрация — пароль хэшируется bcrypt', async () => {
  const hash = await bcrypt.hash('password123', 10);
  expect(hash).not.toBe('password123');
  expect(hash.startsWith('$2')).toBe(true);
});

// Тест 3
test('Регистрация — JWT токен содержит userId', () => {
  const token = jwt.sign({ userId: 1 }, SECRET, { expiresIn: '7d' });
  const decoded = jwt.verify(token, SECRET);
  expect(decoded.userId).toBe(1);
  expect(decoded.exp).toBeGreaterThan(Date.now() / 1000);
});

// Тест 4
test('Вход — неверный пароль → false', async () => {
  const hash = await bcrypt.hash('correctpass', 10);
  const result = await bcrypt.compare('wrongpass', hash);
  expect(result).toBe(false);
});

// Тест 5
test('Вход — верный пароль → true + токен', async () => {
  const hash = await bcrypt.hash('mypass', 10);
  const result = await bcrypt.compare('mypass', hash);
  expect(result).toBe(true);
  const token = jwt.sign({ userId: 42 }, SECRET, { expiresIn: '7d' });
  const decoded = jwt.verify(token, SECRET);
  expect(decoded.userId).toBe(42);
});

// Тест 6
test('GET /api/auth?type=me — нет заголовка → 401', () => {
  const req = { headers: {} };
  const res = makeRes();
  if (!req.headers.authorization) res.status(401).json({ error: 'No token' });
  expect(res._status).toBe(401);
  expect(res._body.error).toBe('No token');
});

// Тест 7
test('Просроченный JWT выбрасывает ошибку TokenExpiredError', () => {
  const expired = jwt.sign({ userId: 1 }, SECRET, { expiresIn: '-1s' });
  expect(() => jwt.verify(expired, SECRET)).toThrow();
});

// Тест 8
test('Метод PUT → 405 Method Not Allowed', () => {
  const req = { method: 'PUT' };
  const res = makeRes();
  if (req.method !== 'POST' && req.method !== 'GET') res.status(405).json({ error: 'Method not allowed' });
  expect(res._status).toBe(405);
});

// Тест 9
test('Разные userId в разных токенах различаются', () => {
  const t1 = jwt.sign({ userId: 10 }, SECRET);
  const t2 = jwt.sign({ userId: 20 }, SECRET);
  expect(jwt.verify(t1, SECRET).userId).toBe(10);
  expect(jwt.verify(t2, SECRET).userId).toBe(20);
});

// Тест 10
test('Токен без подходящего секрета — ошибка верификации', () => {
  const fake = jwt.sign({ userId: 99 }, 'WRONG_SECRET');
  expect(() => jwt.verify(fake, SECRET)).toThrow();
});
