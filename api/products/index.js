const { supabase } = require('../_lib/supabase');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*, seller:users(id, username)')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Products fetch error:', error);
                return res.status(500).json({ error: 'Database error' });
            }
            return res.status(200).json(data || []);
        } catch (err) {
            console.error('Server error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    if (req.method === 'POST') {
        try {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'No token' });
            }

            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decoded.userId;

            const { name, description, price, category, image } = req.body;

            if (!name || !price) {
                return res.status(400).json({ error: 'Name and price required' });
            }

            const { data, error } = await supabase
                .from('products')
                .insert([{
                    seller_id: userId,
                    name,
                    description: description || '',
                    price,
                    category: category || 'Игры',
                    image: image || '',
                    status: 'active'
                }])
                .select()
                .single();

            if (error) {
                console.error('Insert error:', error);
                return res.status(500).json({ error: 'Failed to create product' });
            }
            return res.status(201).json(data);
        } catch (err) {
            console.error('Server error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
};