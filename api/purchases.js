const { supabase } = require('./_lib/supabase');
const { verifyToken } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyToken(req, res);
  if (!userId) return;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('purchases')
      .select(`*, product:products(name)`)
      .eq('buyer_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json(data);
  }

  if (req.method === 'POST') {
    const { productId, email, paymentMethod } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'Product ID required' });
    }

    const { data: product, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('status', 'active')
      .single();

    if (prodError || !product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const { data: buyer, error: buyerError } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();

    if (buyerError || !buyer) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (buyer.balance < product.price) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    await supabase.from('users').update({ balance: buyer.balance - product.price }).eq('id', userId);

    const { data: seller } = await supabase
      .from('users')
      .select('balance')
      .eq('id', product.seller_id)
      .single();

    if (seller) {
      await supabase.from('users').update({ balance: seller.balance + product.price }).eq('id', product.seller_id);
    }

    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        product_id: product.id,
        buyer_id: userId,
        seller_id: product.seller_id,
        amount: product.price,
        email: email || null,
        payment_method: paymentMethod || null
      })
      .select()
      .single();

    if (purchaseError) {
      console.error(purchaseError);
      return res.status(500).json({ error: 'Failed to record purchase' });
    }

    await supabase.from('operations').insert([
      { user_id: userId, type: 'purchase', amount: -product.price, details: `Покупка ${product.name}` },
      { user_id: product.seller_id, type: 'purchase', amount: product.price, details: `Продажа ${product.name}` }
    ]);

    return res.json({ message: 'Purchase successful', purchase });
  }

  res.status(405).json({ error: 'Method not allowed' });
};