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
          villas (name, base_breakfast)
        ),
        booking_addons (
          quantity,
          addons (id, name, base_breakfast)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];

    const formatted = data.map(b => {
      const villaBreakfast = b.booking_villas?.reduce((sum, bv) => sum + (bv.villas?.base_breakfast || 0), 0) || 0;
      const addonBreakfast = b.booking_addons?.reduce((sum, ba) => sum + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)), 0) || 0;
      const totalBreakfast = villaBreakfast + addonBreakfast;

      const extraBedAddon = b.booking_addons?.find(ba => ba.addons?.name === 'Extra Bed');
      const extraBedQty = extraBedAddon?.quantity || 0;

      // Determine stay phase
      let stayPhase = 'in-house';
      if (b.check_in_date === today) stayPhase = 'arrival';
      else if (b.check_out_date === today) stayPhase = 'departure';
      else if (b.check_in_date > today) stayPhase = 'upcoming';

      return {
        ...b,
        villa_names: b.booking_villas?.map(bv => bv.villas?.name).filter(Boolean).join(', ') || 'No Units Assigned',
        total_breakfast: totalBreakfast,
        extra_bed_qty: extraBedQty,
        stay_phase: stayPhase
      };
    });

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

// 🗓️ GET VILLAS WITH THEIR BOOKINGS FOR GANTT CHART
app.get('/api/villas/gantt', async (req, res) => {
  try {
    // 1. Fetch all villas from database
    const { data: villas, error: villaError } = await supabase
      .from('villas')
      .select('*')
      .order('name');
      
    if (villaError) throw villaError;

    // 2. Fetch all active bookings with guest profiles linked
    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        check_in_date,
        check_out_date,
        guests (full_name),
        booking_villas (villa_id)
      `)
      .not('status', 'eq', 'cancelled'); // Disregard cancelled bookings

    if (bookingError) throw bookingError;

    // 3. Map bookings into an array grouped inside each matching villa object
    const ganttData = villas.map(villa => {
      // Find bookings associated with this specific villa
      const villaBookings = bookings
        .filter(b => b.booking_villas?.some(bv => bv.villa_id === villa.id))
        .map(b => ({
          id: b.id,
          guest: b.guests?.full_name || 'Unknown Guest',
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
          status: b.status
        }));

      return {
        id: villa.id,
        name: villa.name,
        bookings: villaBookings
      };
    });

    res.json(ganttData);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.get('/api/dashboard', async (req, res) => {
  const todayDate = new Date();
  const today = todayDate.toISOString().split('T')[0];

  const tomorrowDate = new Date(todayDate);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = tomorrowDate.toISOString().split('T')[0];

  const calcBreakfast = (bookings) =>
    (bookings || []).reduce((total, b) => {
      const villaBreakfast = b.booking_villas?.reduce((s, bv) => s + (bv.villas?.base_breakfast || 0), 0) || 0;
      const addonBreakfast = b.booking_addons?.reduce((s, ba) => s + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)), 0) || 0;
      return total + villaBreakfast + addonBreakfast;
    }, 0);

  const fullSelect = `
    *,
    guests (full_name, phone_number),
    booking_villas (villas (name, base_breakfast)),
    booking_addons (quantity, addons (name, base_breakfast))
  `;

  try {
    // Arrivals today: check_in_date = today
    const { data: arrivalsToday, error: e1 } = await supabase
      .from('bookings').select(fullSelect)
      .not('status', 'eq', 'cancelled')
      .eq('check_in_date', today);
    if (e1) throw e1;

    // Departures today: check_out_date = today
    const { data: departuresToday, error: e2 } = await supabase
      .from('bookings').select(fullSelect)
      .not('status', 'eq', 'cancelled')
      .eq('check_out_date', today);
    if (e2) throw e2;

    // In house: arrived before today, leaving after today
    const { data: inHouse, error: e3 } = await supabase
      .from('bookings').select(fullSelect)
      .not('status', 'eq', 'cancelled')
      .lt('check_in_date', today)
      .gt('check_out_date', today);
    if (e3) throw e3;

    // Breakfast TODAY: guests who arrived BEFORE today and are still here
    // (check_in < today AND check_out >= today)
    // = in-house + departures today (they eat this morning before leaving)
    const { data: breakfastTodayBookings, error: e4 } = await supabase
      .from('bookings')
      .select(`*, booking_villas (villas (base_breakfast)), booking_addons (quantity, addons (base_breakfast))`)
      .not('status', 'eq', 'cancelled')
      .lt('check_in_date', today)   // arrived BEFORE today
      .gte('check_out_date', today); // still here today (including departing today)
    if (e4) throw e4;

    // Breakfast TOMORROW: check_in <= today AND check_out >= tomorrow
    // Includes: today's arrivals (eating tomorrow morning) + in-house guests still there tomorrow
    // Excludes: guests checking out today (already gone)
    const { data: breakfastTomorrowBookings, error: e5 } = await supabase
      .from('bookings')
      .select(`*, booking_villas (villas (base_breakfast)), booking_addons (quantity, addons (base_breakfast))`)
      .not('status', 'eq', 'cancelled')
      .lte('check_in_date', today)    // arrived today or earlier
      .gte('check_out_date', tomorrow); // still here tomorrow morning
    if (e5) throw e5;

    res.json({
      arrivalsToday: arrivalsToday?.length || 0,
      departuresToday: departuresToday?.length || 0,
      inHouseCount: inHouse?.length || 0,
      breakfastToday: calcBreakfast(breakfastTodayBookings),
      breakfastTomorrow: calcBreakfast(breakfastTomorrowBookings),
      today,
      tomorrow,
    });
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

