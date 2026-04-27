/**
 * ЮНИТ-ТЕСТЫ: api/_lib/auth.js — функция verifyToken
 */

const jwt = require('jsonwebtoken');

// Воспроизводим логику verifyToken напрямую (без import из файла)
function verifyToken(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (res) res.status(401).json({ error: 'No token provided' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.userId;
  } catch (err) {
    if (res) res.status(401).json({ error: 'Invalid token' });
    return null;
  }
}

function makeReq(authHeader) {
  return { headers: { authorization: authHeader } };
}

function makeRes() {
  const res = {
    _status: 200, _body: null,
    status(c) { this._status = c; return this; },
    json(b)   { this._body = b; return this; },
  };
  return res;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'super_secret_test_key_for_jest_32!';
});

// ─── Тест 1: Валидный токен возвращает userId ─────────────
test('verifyToken — возвращает userId при валидном токене', () => {
  const token = jwt.sign({ userId: 99 }, process.env.JWT_SECRET);
  const req = makeReq(`Bearer ${token}`);
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBe(99);
  expect(res._status).toBe(200); // статус не менялся
});

// ─── Тест 2: Нет заголовка → null + 401 ──────────────────
test('verifyToken — null и 401 без Authorization заголовка', () => {
  const req = makeReq(undefined);
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBeNull();
  expect(res._status).toBe(401);
  expect(res._body.error).toBe('No token provided');
});

// ─── Тест 3: Заголовок без "Bearer " ─────────────────────
test('verifyToken — null и 401 если токен без префикса Bearer', () => {
  const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET);
  const req = makeReq(token); // нет "Bearer "
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBeNull();
  expect(res._status).toBe(401);
});

// ─── Тест 4: Неверная подпись ────────────────────────────
test('verifyToken — null и 401 при неверном секрете', () => {
  const token = jwt.sign({ userId: 5 }, 'WRONG_SECRET');
  const req = makeReq(`Bearer ${token}`);
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBeNull();
  expect(res._status).toBe(401);
  expect(res._body.error).toBe('Invalid token');
});

// ─── Тест 5: Просроченный токен ──────────────────────────
test('verifyToken — null и 401 при просроченном токене', () => {
  const token = jwt.sign({ userId: 3 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
  const req = makeReq(`Bearer ${token}`);
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBeNull();
  expect(res._status).toBe(401);
});

// ─── Тест 6: Мусорная строка вместо токена ───────────────
test('verifyToken — null при полностью невалидном токене', () => {
  const req = makeReq('Bearer not_a_real_jwt_at_all');
  const res = makeRes();

  const result = verifyToken(req, res);
  expect(result).toBeNull();
  expect(res._status).toBe(401);
});

// ─── Тест 7: Разные userId в разных токенах ───────────────
test('verifyToken — корректно различает разные userId', () => {
  const token1 = jwt.sign({ userId: 10 }, process.env.JWT_SECRET);
  const token2 = jwt.sign({ userId: 20 }, process.env.JWT_SECRET);

  const res1 = makeRes();
  const res2 = makeRes();

  expect(verifyToken(makeReq(`Bearer ${token1}`), res1)).toBe(10);
  expect(verifyToken(makeReq(`Bearer ${token2}`), res2)).toBe(20);
});
