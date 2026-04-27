/**
 * ЮНИТ-ТЕСТЫ: api/balance.js — бизнес-логика баланса
 * Тестируем арифметику операций без обращения к БД
 */

// ─── Логика баланса (воспроизводим из api/balance.js) ────
function calcNewBalance(currentBalance, type, amount) {
  if (!amount || amount < 100) throw new Error('Amount must be at least 100');
  if (type === 'deposit') {
    return currentBalance + amount;
  } else if (type === 'withdraw') {
    if (currentBalance < amount) throw new Error('Insufficient balance');
    return currentBalance - amount;
  }
  throw new Error('Invalid type');
}

function buildOperationRecord(userId, type, amount) {
  return {
    user_id: userId,
    type,
    amount: type === 'deposit' ? amount : -amount,
    details: type === 'deposit' ? 'Пополнение баланса' : 'Вывод средств',
  };
}

// ─── Тесты: пополнение ───────────────────────────────────
test('Пополнение баланса — сумма прибавляется корректно', () => {
  expect(calcNewBalance(500, 'deposit', 1000)).toBe(1500);
  expect(calcNewBalance(0, 'deposit', 100)).toBe(100);
  // граница: deposit от 100
});

test('Пополнение — минимальная сумма 100 ₽', () => {
  expect(() => calcNewBalance(500, 'deposit', 99)).toThrow('Amount must be at least 100');
  expect(() => calcNewBalance(500, 'deposit', 0)).toThrow('Amount must be at least 100');
  expect(() => calcNewBalance(500, 'deposit', -500)).toThrow('Amount must be at least 100');
});

// ─── Тесты: вывод ────────────────────────────────────────
test('Вывод средств — сумма списывается корректно', () => {
  expect(calcNewBalance(1000, 'withdraw', 400)).toBe(600);
  expect(calcNewBalance(100, 'withdraw', 100)).toBe(0); // весь баланс
});

test('Вывод — ошибка при недостатке средств', () => {
  expect(() => calcNewBalance(50, 'withdraw', 200)).toThrow('Insufficient balance');
  expect(() => calcNewBalance(0, 'withdraw', 100)).toThrow('Insufficient balance');
});

test('Вывод — минимальная сумма 100 ₽', () => {
  expect(() => calcNewBalance(500, 'withdraw', 50)).toThrow('Amount must be at least 100');
});

// ─── Тест: неверный type ─────────────────────────────────
test('Неверный тип операции — выбрасывает ошибку', () => {
  expect(() => calcNewBalance(500, 'transfer', 100)).toThrow('Invalid type');
  expect(() => calcNewBalance(500, '', 100)).toThrow('Invalid type');
});

// ─── Тесты: запись операции ──────────────────────────────
test('buildOperationRecord — deposit сохраняет положительную сумму', () => {
  const op = buildOperationRecord(1, 'deposit', 500);
  expect(op.user_id).toBe(1);
  expect(op.type).toBe('deposit');
  expect(op.amount).toBe(500); // положительное
  expect(op.details).toBe('Пополнение баланса');
});

test('buildOperationRecord — withdraw сохраняет отрицательную сумму', () => {
  const op = buildOperationRecord(2, 'withdraw', 300);
  expect(op.amount).toBe(-300); // отрицательное
  expect(op.details).toBe('Вывод средств');
});

// ─── Тест: граничные значения ────────────────────────────
test('Граничное значение: баланс ровно равен сумме вывода', () => {
  expect(calcNewBalance(100, 'withdraw', 100)).toBe(0);
  expect(() => calcNewBalance(99, 'withdraw', 100)).toThrow('Insufficient balance');
});

test('Большие суммы обрабатываются корректно', () => {
  expect(calcNewBalance(1_000_000, 'deposit', 500_000)).toBe(1_500_000);
  expect(calcNewBalance(1_000_000, 'withdraw', 999_000)).toBe(1_000);
});
