const { supabase } = require('./_lib/supabase');
const { verifyToken } = require('./_lib/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const userId = verifyToken(req, res);
  if (!userId) return;

  const { type, id } = req.query; // type: products, sales

  if (type === 'products') {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Database error' });
      }
      return res.json(data);
    }

    if (req.method === 'POST') {
      const { name, description, price, category, image } = req.body;
      if (!name || !price) {
        return res.status(400).json({ error: 'Name and price required' });
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          seller_id: userId,
          name,
          description,
          price,
          category: category || 'Игры',
          image: image || '',
          status: 'active'
        })
        .select()
        .single();

      if (error) {
        console.error(error);
        return res.status(500).json({ error: 'Insert failed' });
      }
      return res.status(201).json(data);
    }

    if ((req.method === 'PUT' || req.method === 'DELETE') && id) {
      const { data: product, error: checkError } = await supabase
        .from('products')
        .select('seller_id')
        .eq('id', id)
        .single();

      if (checkError || !product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      if (product.seller_id !== userId) {
        return res.status(403).json({ error: 'Not your product' });
      }

      if (req.method === 'PUT') {
        const { name, description, price, category, image } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (price) updates.price = price;
        if (category) updates.category = category;
        if (image !== undefined) updates.image = image;

        const { data, error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Update failed' });
        }
        return res.json(data);
      }

      if (req.method === 'DELETE') {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', id);

        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'Delete failed' });
        }
        return res.json({ message: 'Product deleted' });
      }
    }
  }

  if (type === 'sales') {
    const { data, error } = await supabase
      .from('purchases')
      .select(`*, product:products(name), buyer:users(username)`)
      .eq('seller_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Database error' });
    }
    return res.json(data);
  }

  res.status(400).json({ error: 'Invalid type' });
};