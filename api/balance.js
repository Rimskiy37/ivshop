const { supabase } = require('./_lib/supabase');
const { verifyToken } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyToken(req, res);
  if (!userId) return;

  const { type } = req.query; // deposit, withdraw, operations

  if (req.method === 'GET' && !type) {
    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json({ balance: data.balance });
  }

  if (req.method === 'GET' && type === 'operations') {
    const { data, error } = await supabase
      .from('operations')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { amount } = req.body;
    if (!amount || amount < 100) {
      return res.status(400).json({ error: 'Amount must be at least 100' });
    }

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error(fetchError);
      return res.status(500).json({ error: 'Database error' });
    }

    let newBalance;
    if (type === 'deposit') {
      newBalance = user.balance + amount;
    } else if (type === 'withdraw') {
      if (user.balance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
      newBalance = user.balance - amount;
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    const { error: updateError } = await supabase
      .from('users')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (updateError) {
      console.error(updateError);
      return res.status(500).json({ error: 'Update failed' });
    }

    await supabase.from('operations').insert({
      user_id: userId,
      type,
      amount: type === 'deposit' ? amount : -amount,
      details: type === 'deposit' ? 'Пополнение баланса' : 'Вывод средств'
    });

    return res.json({ balance: newBalance });
  }

  res.status(405).json({ error: 'Method not allowed' });
};