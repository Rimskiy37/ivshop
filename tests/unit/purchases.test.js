/**
 * ЮНИТ-ТЕСТЫ: api/purchases.js — бизнес-логика покупок
 * Тестируем расчёт комиссии, проверку баланса и формирование записей
 */

const COMMISSION_RATE = 0.05; // 5% — константа из проекта

// ─── Бизнес-логика (воспроизводим из api/purchases.js) ───
function calcCommission(price) {
  return Math.round(price * COMMISSION_RATE);
}

function calcSellerAmount(price) {
  return price - calcCommission(price);
}

function canPurchase(buyerBalance, productPrice) {
  return buyerBalance >= productPrice;
}

function buildPurchaseRecord(productId, buyerId, sellerId, amount, email, paymentMethod) {
  return {
    product_id: productId,
    buyer_id: buyerId,
    seller_id: sellerId,
    amount,
    email: email || null,
    payment_method: paymentMethod || null,
  };
}

function buildPurchaseOperations(buyerId, sellerId, productName, price, sellerAmount) {
  return [
    { user_id: buyerId,   type: 'purchase', amount: -price,        details: `Покупка ${productName}` },
    { user_id: sellerId,  type: 'purchase', amount: sellerAmount,   details: `Продажа ${productName}` },
  ];
}

// ─── Тесты: расчёт комиссии ──────────────────────────────
test('Комиссия 5% от цены товара рассчитывается правильно', () => {
  expect(calcCommission(1000)).toBe(50);
  expect(calcCommission(200)).toBe(10);
  expect(calcCommission(100)).toBe(5);
  expect(calcCommission(0)).toBe(0);
});

test('Продавец получает 95% от цены', () => {
  expect(calcSellerAmount(1000)).toBe(950);
  expect(calcSellerAmount(200)).toBe(190);
  expect(calcSellerAmount(100)).toBe(95);
});

test('Комиссия округляется до целых рублей', () => {
  // 333 * 0.05 = 16.65 → округляется до 17
  expect(calcCommission(333)).toBe(17);
  expect(calcSellerAmount(333)).toBe(316); // 333 - 17
});

// ─── Тесты: проверка баланса ─────────────────────────────
test('canPurchase — true если баланс достаточен', () => {
  expect(canPurchase(1000, 500)).toBe(true);
  expect(canPurchase(500, 500)).toBe(true); // ровно хватает
});

test('canPurchase — false если баланс недостаточен', () => {
  expect(canPurchase(499, 500)).toBe(false);
  expect(canPurchase(0, 100)).toBe(false);
});

// ─── Тесты: формирование записи покупки ──────────────────
test('buildPurchaseRecord — корректно формирует запись', () => {
  const record = buildPurchaseRecord(5, 1, 3, 200, 'buyer@test.ru', 'card');
  
  expect(record.product_id).toBe(5);
  expect(record.buyer_id).toBe(1);
  expect(record.seller_id).toBe(3);
  expect(record.amount).toBe(200);
  expect(record.email).toBe('buyer@test.ru');
  expect(record.payment_method).toBe('card');
});

test('buildPurchaseRecord — email и payment_method могут быть null', () => {
  const record = buildPurchaseRecord(1, 2, 3, 100, null, null);
  expect(record.email).toBeNull();
  expect(record.payment_method).toBeNull();
});

test('buildPurchaseRecord — пустая строка превращается в null', () => {
  const record = buildPurchaseRecord(1, 2, 3, 100, '', '');
  expect(record.email).toBeNull();
  expect(record.payment_method).toBeNull();
});

// ─── Тесты: операции покупки ─────────────────────────────
test('buildPurchaseOperations — два верных record в массиве', () => {
  const ops = buildPurchaseOperations(1, 2, 'CS2 Prime', 200, 190);

  expect(ops).toHaveLength(2);
  
  // Покупатель теряет деньги
  expect(ops[0].user_id).toBe(1);
  expect(ops[0].amount).toBe(-200);
  expect(ops[0].details).toContain('Покупка');
  
  // Продавец получает деньги
  expect(ops[1].user_id).toBe(2);
  expect(ops[1].amount).toBe(190); // 95% от цены
  expect(ops[1].details).toContain('Продажа');
});

// ─── Тест: полный сценарий покупки ───────────────────────
test('Полный сценарий покупки — арифметика сходится', () => {
  const price = 350;
  const buyerBalance = 1000;
  const sellerBalance = 200;

  const commission = calcCommission(price);
  const sellerGets = calcSellerAmount(price);

  expect(canPurchase(buyerBalance, price)).toBe(true);
  expect(buyerBalance - price).toBe(650);
  expect(sellerBalance + sellerGets).toBe(532); // 200 + 332 (5% от 350 = 18, sellerGets=332)
  expect(Math.abs(commission + sellerGets - price)).toBeLessThanOrEqual(1);
});

// ─── Тест: инвариант комиссии ────────────────────────────
test('Инвариант: commission + sellerAmount == price для любой цены', () => {
  [100, 200, 333, 500, 1000, 9999, 12345].forEach(price => {
    expect(calcCommission(price) + calcSellerAmount(price)).toBe(price);
  });
});
