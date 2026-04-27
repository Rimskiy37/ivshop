# IVSHOP — Игровой маркетплейс

Веб-маркетплейс для покупки и продажи игровых цифровых товаров: игр, аккаунтов и подписок.

**Курсовой проект** по дисциплине «Разработка информационных систем»  
Студент: Бабуров Иван Дмитриевич, группа 3993  
Год: 2026

---

## О проекте

IVSHOP — это платформа, где пользователи могут покупать и продавать цифровые игровые товары с фиксированной комиссией платформы **5%**. Продавец получает **95%** от цены товара.

### Что умеет сайт

- Регистрация и вход с JWT-аутентификацией
- Каталог товаров с фильтрацией по категориям (Игры, Аккаунты, Мобильные игры)
- Покупка товаров с автоматическим расчётом баланса
- Пополнение и вывод баланса (карта, СБП, Тинькофф)
- Личный кабинет: история покупок, продаж и операций
- Система статуса продавца (заявка → одобрение)
- Управление своими товарами (добавить, редактировать, удалить)
- Тёмная и светлая тема

---

## Технологии

| Слой | Технология |
|------|-----------|
| Фронтенд | HTML5, CSS3, JavaScript (ES6+) |
| Бэкенд | Node.js, Vercel Serverless Functions |
| База данных | PostgreSQL через Supabase |
| Аутентификация | JWT (jsonwebtoken) |
| Хеширование паролей | bcryptjs |
| Хостинг | Vercel |
| Репозиторий | GitHub |
| Тестирование | Jest 29 |

---

## Структура проекта

```
ivshop/
├── index.html          — Главная страница (каталог)
├── auth.html           — Вход и регистрация
├── balance.html        — Управление балансом
├── payment.html        — Страница оплаты
├── product.html        — Страница товара
├── profile.html        — Личный кабинет
├── seller.html         — Панель продавца
├── script.js           — Весь клиентский JS
├── styles.css          — Все стили
├── vercel.json         — Конфигурация Vercel
├── package.json        — Зависимости Node.js
├── img/                — Изображения товаров и логотип
├── tests/
│   ├── unit/
│   │   ├── auth.test.js           — JWT, bcrypt, методы запросов
│   │   ├── verifyToken.test.js    — Функция проверки токена
│   │   ├── balance.test.js        — Арифметика пополнения и вывода
│   │   └── purchases.test.js      — Комиссия 5%, логика покупок
│   ├── integration/
│   │   └── api.integration.test.js — Полные API-сценарии (mock БД)
│   ├── e2e/
│   │   └── scenarios.test.js      — Сквозные пользовательские сценарии
│   └── security/
│       └── security.test.js       — Безопасность: JWT, XSS, CORS
└── api/
    ├── auth.js                  — Регистрация и вход (POST /api/auth)
    ├── balance.js               — Баланс и операции (GET/POST /api/balance)
    ├── purchases.js             — Покупки (GET/POST /api/purchases)
    ├── seller.js                — Управление товарами продавца
    ├── products/
    │   ├── index.js             — Список товаров (GET /api/products)
    │   └── [id].js              — Один товар (GET /api/products/:id)
    ├── user/
    │   └── become-seller.js     — Заявка на продавца
    └── _lib/
        ├── auth.js              — Вспомогательная функция verifyToken
        └── supabase.js          — Клиент Supabase
```

---

## База данных

Проект использует PostgreSQL через Supabase. Таблицы:

- **users** — пользователи (id, username, email, password, is_seller, balance, seller_request, seller_approved)
- **products** — товары (id, seller_id, name, description, price, category, image, status)
- **purchases** — покупки (id, product_id, buyer_id, seller_id, amount, date, email, payment_method)
- **operations** — история операций с балансом (id, user_id, type, amount, date, details)

---

## Тестирование

Проект покрыт **82 автоматическими тестами** на фреймворке Jest. Тесты не обращаются к реальной базе данных — используется mock-хранилище.

### Виды тестов

| Вид | Папка | Тестов | Что проверяет |
|-----|-------|--------|---------------|
| Юнит | `tests/unit/` | 38 | JWT, bcrypt, арифметика баланса, расчёт комиссии |
| Интеграционные | `tests/integration/` | 24 | Полные API-сценарии от запроса до ответа |
| E2E | `tests/e2e/` | 8 | Сквозные сценарии: регистрация → покупка → история |
| Безопасность | `tests/security/` | 12 | SQL-инъекции, XSS, подделка токенов, CORS |

### Запуск тестов

```bash
# Все тесты
npx jest --verbose

# Только юнит-тесты
npm run test:unit

# Только интеграционные
npm run test:integration

# Только E2E
npm run test:e2e

# Только тесты безопасности
npm run test:security

# С отчётом о покрытии кода
npm run test:coverage
```

### Результат

```
Test Suites: 7 passed, 7 total
Tests:       82 passed, 82 total
Time:        ~9s
```

---

## Запуск локально

### Требования

- Node.js 18+
- Аккаунт Vercel (бесплатный)
- Аккаунт Supabase (бесплатный)

### 1. Клонировать репозиторий

```bash
git clone https://github.com/Rimskiy37/ivshop.git
cd ivshop
```

### 2. Установить зависимости

```bash
npm install
```

### 3. Создать файл переменных окружения

Создать файл `.env` в корне проекта:

```
SUPABASE_URL=https://ваш-проект.supabase.co
SUPABASE_ANON_KEY=ваш-anon-key
JWT_SECRET=любая-длинная-строка-секрет
```

> Значения берутся из настроек вашего проекта в Supabase: Settings → API

### 4. Создать таблицы в Supabase

Открыть SQL Editor в Supabase и выполнить:

```sql
CREATE TABLE public.users (
  id serial PRIMARY KEY,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  is_seller boolean DEFAULT false,
  balance integer DEFAULT 0,
  avatar text,
  registration_date timestamp DEFAULT now(),
  seller_request boolean DEFAULT false,
  seller_approved boolean DEFAULT false
);

CREATE TABLE public.products (
  id serial PRIMARY KEY,
  seller_id integer REFERENCES public.users(id),
  name text NOT NULL,
  description text,
  price integer NOT NULL,
  category text DEFAULT 'Игры',
  image text,
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now()
);

CREATE TABLE public.purchases (
  id serial PRIMARY KEY,
  product_id integer REFERENCES public.products(id),
  buyer_id integer REFERENCES public.users(id),
  seller_id integer REFERENCES public.users(id),
  amount integer NOT NULL,
  date timestamp DEFAULT now(),
  email text,
  payment_method text
);

CREATE TABLE public.operations (
  id serial PRIMARY KEY,
  user_id integer REFERENCES public.users(id),
  type text NOT NULL,
  amount integer NOT NULL,
  date timestamp DEFAULT now(),
  details text
);
```

### 5. Запустить локальный сервер

```bash
npm install -g vercel
vercel dev
```

Сайт откроется на `http://localhost:3000`

---

## Деплой на Vercel

1. Зайти на [vercel.com](https://vercel.com) и войти через GitHub
2. Нажать **New Project** → выбрать репозиторий `ivshop`
3. В разделе **Environment Variables** добавить три переменные:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `JWT_SECRET`
4. Нажать **Deploy**

После деплоя каждый `git push` в ветку `main` автоматически обновляет сайт.

---

## API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/auth?type=register` | Регистрация |
| POST | `/api/auth?type=login` | Вход |
| GET | `/api/auth?type=me` | Данные текущего пользователя |
| GET | `/api/products` | Список активных товаров |
| GET | `/api/products/:id` | Данные одного товара |
| GET | `/api/purchases` | История покупок (требует токен) |
| POST | `/api/purchases` | Купить товар (требует токен) |
| GET | `/api/balance` | Текущий баланс (требует токен) |
| POST | `/api/balance?type=deposit` | Пополнить баланс |
| POST | `/api/balance?type=withdraw` | Вывести средства |
| GET | `/api/seller?type=products` | Товары продавца |
| POST | `/api/seller?type=products` | Добавить товар |
| PUT | `/api/seller?type=products&id=X` | Редактировать товар |
| DELETE | `/api/seller?type=products&id=X` | Удалить товар |
| POST | `/api/user/become-seller` | Заявка на статус продавца |

---

## Ссылки

- **Сайт:** https://ivshop.vercel.app
- **Репозиторий:** https://github.com/Rimskiy37/ivshop
