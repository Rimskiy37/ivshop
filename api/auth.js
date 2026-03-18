const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Инициализация Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// CORS-заголовки
const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
};

module.exports = async (req, res) => {
  // CORS preflight
  setCors(res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { type } = req.query;

  // ==================== ПОЛУЧИТЬ ДАННЫЕ ПОЛЬЗОВАТЕЛЯ (GET) ====================
  if (req.method === 'GET' && type === 'me') {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const userId = decoded.userId;
      
      const { data: user, error } = await supabase
        .from('users')
        .select('id, username, email, is_seller, balance')
        .eq('id', userId)
        .single();
        
      if (error || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      return res.json({ user });
    } catch (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  }

  // Для всех остальных запросов — только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ==================== РЕГИСТРАЦИЯ ====================
  if (type === 'register') {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Проверяем, существует ли пользователь
    const { data: existing, error: checkError } = await supabase
      .from('users')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`)
      .maybeSingle();

    if (checkError) {
      console.error('Check error:', checkError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Хешируем пароль
    const hashedPassword = await bcrypt.hash(password, 10);

    // Создаём пользователя
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert([
        {
          username,
          email,
          password: hashedPassword,
          is_seller: false,
          balance: 0,
          seller_request: false,
          seller_approved: false
        }
      ])
      .select('id, username, email, is_seller, balance')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ error: 'Failed to create user' });
    }

    // Создаём токен
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.status(201).json({ token, user });
  }

  // ==================== ВХОД ====================
  if (type === 'login') {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    // Ищем пользователя
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (findError) {
      console.error('Find error:', findError);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Проверяем пароль
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Создаём токен
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_seller: user.is_seller,
        balance: user.balance
      }
    });
  }

  // ==================== НЕИЗВЕСТНЫЙ TYPE ====================
  return res.status(400).json({ error: 'Invalid type' });
};