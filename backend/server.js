import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────────────────────
// 📋 BOOKINGS
// ─────────────────────────────────────────────────────────────

// GET ALL BOOKINGS with guest + villa + order totals
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

    // Fetch order totals per booking
    const { data: orderTotals, error: orderErr } = await supabase
      .from('orders')
      .select('booking_id, total_amount')
      .not('status', 'eq', 'billed'); // only include unbilled orders in running total

    if (orderErr) throw orderErr;

    // Sum order totals per booking_id
    const orderTotalMap = {};
    (orderTotals || []).forEach(o => {
      orderTotalMap[o.booking_id] = (orderTotalMap[o.booking_id] || 0) + Number(o.total_amount);
    });

    const today = new Date().toISOString().split('T')[0];

    const formatted = data.map(b => {
      const villaBreakfast = b.booking_villas?.reduce((sum, bv) => sum + (bv.villas?.base_breakfast || 0), 0) || 0;
      const addonBreakfast = b.booking_addons?.reduce((sum, ba) => sum + ((ba.addons?.base_breakfast || 0) * (ba.quantity || 1)), 0) || 0;
      const totalBreakfast = villaBreakfast + addonBreakfast;

      const extraBedAddon = b.booking_addons?.find(ba => ba.addons?.name === 'Extra Bed');
      const extraBedQty = extraBedAddon?.quantity || 0;

      let stayPhase = 'in-house';
      if (b.check_in_date === today) stayPhase = 'arrival';
      else if (b.check_out_date === today) stayPhase = 'departure';
      else if (b.check_in_date > today) stayPhase = 'upcoming';

      const orderTotal = orderTotalMap[b.id] || 0;

      return {
        ...b,
        villa_names: b.booking_villas?.map(bv => bv.villas?.name).filter(Boolean).join(', ') || 'No Units Assigned',
        total_breakfast: totalBreakfast,
        extra_bed_qty: extraBedQty,
        stay_phase: stayPhase,
        order_total: orderTotal,
        grand_total: (b.total_price || 0) + orderTotal,
        payment_status: b.payment_status || 'pending',
        amount_paid: b.amount_paid || 0,
      };
    });

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST NEW BOOKING
app.post('/api/bookings', async (req, res) => {
  const { villa_ids, guest_id, check_in_date, check_out_date, total_guests, total_price, notes, selected_addons } = req.body;

  try {
    const { data: conflictingBookings, error: checkError } = await supabase
      .from('booking_villas')
      .select(`villa_id, bookings!inner (id, check_in_date, check_out_date, status)`)
      .in('villa_id', villa_ids)
      .not('bookings.status', 'eq', 'cancelled')
      .lt('bookings.check_in_date', check_out_date)
      .gt('bookings.check_out_date', check_in_date);

    if (checkError) throw checkError;
    if (conflictingBookings && conflictingBookings.length > 0) {
      return res.status(409).json({ error: 'One or more villas are already reserved.' });
    }

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert([{ guest_id, check_in_date, check_out_date, total_guests, total_price, notes }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    const bridgeRows = villa_ids.map(vId => ({ booking_id: bookingData.id, villa_id: vId }));
    const { error: bridgeError } = await supabase.from('booking_villas').insert(bridgeRows);
    if (bridgeError) throw bridgeError;

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

// PATCH booking status
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

// ─────────────────────────────────────────────────────────────
// 🍽️  MENU ITEMS
// ─────────────────────────────────────────────────────────────

// GET ALL MENU ITEMS
app.get('/api/menu-items', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_available', true)
      .order('category')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🧾  ORDERS
// ─────────────────────────────────────────────────────────────

// GET ORDERS FOR A BOOKING (with items)
app.get('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          quantity,
          unit_price,
          subtotal,
          menu_items (id, name, category)
        )
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST A NEW ORDER (creates order + line items in one shot)
app.post('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;
  const { items, staff_note } = req.body;
  // items: [{ menu_item_id, quantity }]

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    // Fetch current prices for all requested menu items
    const menuIds = items.map(i => i.menu_item_id);
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, price')
      .in('id', menuIds);

    if (menuError) throw menuError;

    const priceMap = {};
    menuData.forEach(m => { priceMap[m.id] = m.price; });

    // Calculate total
    const total_amount = items.reduce((sum, item) => {
      return sum + (priceMap[item.menu_item_id] || 0) * item.quantity;
    }, 0);

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ booking_id: bookingId, staff_note: staff_note || null, total_amount }])
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItemRows = items.map(item => ({
      order_id: order.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: priceMap[item.menu_item_id] || 0,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
    if (itemsError) throw itemsError;

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH order status (open → served → billed)
app.patch('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🏡  VILLAS
// ─────────────────────────────────────────────────────────────

app.get('/api/villas/gantt', async (req, res) => {
  try {
    const { data: villas, error: villaError } = await supabase
      .from('villas')
      .select('*')
      .order('name');

    if (villaError) throw villaError;

    const { data: bookings, error: bookingError } = await supabase
      .from('bookings')
      .select(`id, status, check_in_date, check_out_date, guests (full_name), booking_villas (villa_id)`)
      .not('status', 'eq', 'cancelled');

    if (bookingError) throw bookingError;

    const ganttData = villas.map(villa => {
      const villaBookings = bookings
        .filter(b => b.booking_villas?.some(bv => bv.villa_id === villa.id))
        .map(b => ({
          id: b.id,
          guest: b.guests?.full_name || 'Unknown Guest',
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
          status: b.status
        }));

      return { id: villa.id, name: villa.name, bookings: villaBookings };
    });

    res.json(ganttData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/villas/availability', async (req, res) => {
  const { check_in, check_out } = req.query;
  if (!check_in || !check_out) {
    return res.status(400).json({ error: 'Missing check_in or check_out parameters.' });
  }

  try {
    const { data: conflicts, error } = await supabase
      .from('booking_villas')
      .select(`villa_id, bookings!inner (status, check_in_date, check_out_date)`)
      .not('bookings.status', 'eq', 'cancelled')
      .lt('bookings.check_in_date', check_out)
      .gt('bookings.check_out_date', check_in);

    if (error) throw error;
    const occupiedVillaIds = conflicts ? conflicts.map(c => c.villa_id) : [];
    res.json({ occupiedVillaIds });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/villas', async (req, res) => {
  try {
    const { data, error } = await supabase.from('villas').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 👤  GUESTS & ADD-ONS
// ─────────────────────────────────────────────────────────────

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

app.get('/api/addons', async (req, res) => {
  try {
    const { data, error } = await supabase.from('addons').select('*').order('name');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// �  PAYMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────

// GET FINANCIAL SUMMARY FOR A BOOKING
app.get('/api/bookings/:bookingId/financial-summary', async (req, res) => {
  const { bookingId } = req.params;

  try {
    // Get booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        booking_villas (
          villas (price_per_night)
        ),
        booking_addons (
          quantity,
          addons (name, price_per_night)
        )
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    // Get order totals
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('total_amount')
      .eq('booking_id', bookingId)
      .not('status', 'eq', 'billed');

    if (orderError) throw orderError;

    // Calculate F&B total
    const fbTotal = (orders || []).reduce((sum, o) => sum + Number(o.total_amount), 0);

    // Calculate accommodation (base)
    const accommodation = Number(booking.total_price) || 0;

    // Calculate add-ons total
    const addonsTotal = (booking.booking_addons || []).reduce((sum, ba) => {
      return sum + (Number(ba.addons?.price_per_night) || 0) * (ba.quantity || 1);
    }, 0);

    // Calculate totals
    const total = accommodation + fbTotal + addonsTotal;
    const amountPaid = Number(booking.amount_paid) || 0;
    const balance = total - amountPaid;
    const reminder = balance > 0 ? balance : 0;

    res.json({
      accommodation,
      fb: fbTotal,
      addons: addonsTotal,
      total,
      amountPaid,
      balance,
      reminder,
      paymentStatus: booking.payment_status
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// RECORD PAYMENT
app.post('/api/bookings/:bookingId/payments', async (req, res) => {
  const { bookingId } = req.params;
  const { amount, paymentMethod = 'cash', notes } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  try {
    // Get current booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    // Calculate new amount paid
    const newAmountPaid = Number(booking.amount_paid) + Number(amount);
    const total = Number(booking.total_price) || 0;

    // Determine new payment status
    let newPaymentStatus = 'pending';
    if (newAmountPaid > 0 && newAmountPaid < total) {
      newPaymentStatus = 'partial';
    } else if (newAmountPaid >= total) {
      newPaymentStatus = 'complete';
    }

    // Record payment transaction
    const { error: transactionError } = await supabase
      .from('payment_transactions')
      .insert([{
        booking_id: bookingId,
        amount,
        payment_method: paymentMethod,
        notes
      }]);

    if (transactionError) throw transactionError;

    // Update booking with new payment info
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Check if should auto-complete (payment complete AND checked out)
    if (newPaymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      const { error: completeError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (completeError) throw completeError;
    }

    res.json({
      message: 'Payment recorded successfully',
      amountPaid: newAmountPaid,
      paymentStatus: newPaymentStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE PAYMENT STATUS
app.patch('/api/bookings/:bookingId/payment-status', async (req, res) => {
  const { bookingId } = req.params;
  const { paymentStatus, amountPaid } = req.body;

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    const updateData = {
      payment_status: paymentStatus,
      updated_at: new Date().toISOString()
    };

    if (amountPaid !== undefined) {
      updateData.amount_paid = amountPaid;
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Check if should auto-complete
    if (paymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      const { error: completeError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (completeError) throw completeError;
    }

    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CHECK-IN BOOKING (confirmed → checked_in, arrival → in_house)
app.patch('/api/bookings/:bookingId/check-in', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'checked_in',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      message: 'Guest checked in successfully',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CHECK-OUT BOOKING (checked_in → checked_out)
app.patch('/api/bookings/:bookingId/check-out', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'checked_out',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Check if should auto-complete (payment complete AND just checked out)
    if (booking.payment_status === 'complete') {
      const { error: completeError } = await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);

      if (completeError) throw completeError;
    }

    res.json({
      message: 'Guest checked out successfully',
      booking: updatedBooking
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// �📊  DASHBOARD
// ─────────────────────────────────────────────────────────────

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

  const fullSelect = `*, guests (full_name, phone_number), booking_villas (villas (name, base_breakfast)), booking_addons (quantity, addons (name, base_breakfast))`;

  try {
    const [{ data: arrivalsToday, error: e1 }, { data: departuresToday, error: e2 }, { data: inHouse, error: e3 }, { data: breakfastTodayBookings, error: e4 }, { data: breakfastTomorrowBookings, error: e5 }] = await Promise.all([
      supabase.from('bookings').select(fullSelect).not('status', 'eq', 'cancelled').eq('check_in_date', today),
      supabase.from('bookings').select(fullSelect).not('status', 'eq', 'cancelled').eq('check_out_date', today),
      supabase.from('bookings').select(fullSelect).not('status', 'eq', 'cancelled').lt('check_in_date', today).gt('check_out_date', today),
      supabase.from('bookings').select(`*, booking_villas (villas (base_breakfast)), booking_addons (quantity, addons (base_breakfast))`).not('status', 'eq', 'cancelled').lt('check_in_date', today).gte('check_out_date', today),
      supabase.from('bookings').select(`*, booking_villas (villas (base_breakfast)), booking_addons (quantity, addons (base_breakfast))`).not('status', 'eq', 'cancelled').lte('check_in_date', today).gte('check_out_date', tomorrow),
    ]);

    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3; if (e4) throw e4; if (e5) throw e5;

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

// ─────────────────────────────────────────────────────────────
app.get('/status', (req, res) => res.json({ status: 'Umalila Engine Running Smoothly' }));

app._router.stack.forEach(r => {
  if (r.route && r.route.path) console.log('Registered Route:', r.route.path);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));