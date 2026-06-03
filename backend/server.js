import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// 📋 GET ALL BOOKINGS with guest + villa info
app.get('/api/bookings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        guests (full_name, phone_number),
        booking_villas (
          villas (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Flatten villa names into a comma-separated string
    const formatted = data.map(b => ({
      ...b,
      villa_names: b.booking_villas
        ?.map(bv => bv.villas?.name)
        .filter(Boolean)
        .join(', ') || 'No Units Assigned'
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📥 POST NEW BOOKING
app.post('/api/bookings', async (req, res) => {
  const { villa_ids, guest_id, check_in_date, check_out_date, total_guests, total_price, notes, selected_addons } = req.body;

  try {
    // Check for conflicts
    const { data: conflictingBookings, error: checkError } = await supabase
      .from('booking_villas')
      .select(`
        villa_id,
        bookings!inner (id, check_in_date, check_out_date, status)
      `)
      .in('villa_id', villa_ids)
      .not('bookings.status', 'eq', 'cancelled') // Stable filter
      .lt('bookings.check_in_date', check_out_date)
      .gt('bookings.check_out_date', check_in_date);

    if (checkError) throw checkError;

    if (conflictingBookings && conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'One or more villas are already reserved.' });
    }

    // Insert booking
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert([{ guest_id, check_in_date, check_out_date, total_guests, total_price, notes }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Insert junction rows
    const bridgeRows = villa_ids.map(vId => ({
      booking_id: bookingData.id,
      villa_id: vId
    }));

    const { error: bridgeError } = await supabase
      .from('booking_villas')
      .insert(bridgeRows);

    if (bridgeError) throw bridgeError;

    // Insert add-ons if any were selected
    if (selected_addons && selected_addons.length > 0) {
      const addonRows = selected_addons.map(a => ({
        booking_id: bookingData.id,
        addon_id: a.addon_id,
        quantity: a.quantity
      }));
      const { error: addonError } = await supabase.from('booking_addons').insert(addonRows);
      if (addonError) throw addonError;
    }
    
    res.status(201).json(bookingData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🔍 GET OCCUPIED VILLAS FOR A DATE RANGE
app.get('/api/villas/availability', async (req, res) => {
  const { check_in, check_out } = req.query;

  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Missing check_in or check_out parameters.' });
  }

  try {
    const { data: conflicts, error } = await supabase
      .from('booking_villas')
      .select(`
        villa_id,
        bookings!inner (status, check_in_date, check_out_date)
      `)
      .not('bookings.status', 'eq', 'cancelled') // Stable filter
      .lt('bookings.check_in_date', check_out)
      .gt('bookings.check_out_date', check_in);

    if (error) throw error;

    const occupiedVillaIds = conflicts ? conflicts.map(c => c.villa_id) : [];
    res.json({ occupiedVillaIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 👤 Route to create a new guest profile
app.post('/api/guests', async (req, res) => {
  const { full_name, email, phone_number } = req.body;
  try {
    const { data, error } = await supabase
      .from('guests')
      .insert([{ full_name, email, phone_number }])
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🏡 Route to fetch all villas
app.get('/api/villas', async (req, res) => {
  try {
    const { data, error } = await supabase.from('villas').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET ALL ADDONS
app.get('/api/addons', async (req, res) => {
  try {
    const { data, error } = await supabase.from('addons').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ✏️ Route to update status (Typo fixed)
app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System diagnostic check route
app.get('/status', (req, res) => res.json({ status: 'Umalila Engine Running Smoothly' }));

app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log("Registered Route:", r.route.path);
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

