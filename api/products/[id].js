const { supabase } = require('../_lib/supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;
        
        if (!id) {
            return res.status(400).json({ error: 'Product ID required' });
        }

        const { data, error } = await supabase
            .from('products')
            .select(`
                *,
                seller:users(id, username)
            `)
            .eq('id', id)
            .maybeSingle();

        return res.status(200).json(data);
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
};