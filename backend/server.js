import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  calculateDiscountAmount,
  mapDiscountRow,
  discountPayloadFromBody,
} from './lib/discountUtils.js';
import { streamBookingConfirmationPdf } from './lib/pdfHelpers.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json({ limit: '20mb' }));

/** Allowed values for orders.status (matches Supabase orders_status_check) */
const ORDER_STATUSES = ['open', 'served', 'billed'];
const ORDER_STATUS_OPEN = 'open';

/** Blocks use inclusive [start_date, end_date]; bookings use half-open [check_in, check_out). */
async function findBlockConflicts(villaIds, checkIn, checkOut) {
  let query = supabase
    .from('villa_date_blocks')
    .select('id, villa_id, start_date, end_date, reason')
    .lt('start_date', checkOut)
    .gte('end_date', checkIn);

  if (Array.isArray(villaIds) && villaIds.length > 0) {
    query = query.in('villa_id', villaIds);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// ─────────────────────────────────────────────────────────────
// 📋 BOOKINGS
// ─────────────────────────────────────────────────────────────

app.get('/api/bookings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        discounts (id, code, name, type, value, scope, status, application_rule),
        guests (full_name, phone_number),
        booking_villas (
          villa_id,
          rate_per_night,
          nights,
          villas (id, name, base_rate_per_night, base_breakfast, display_id)
        ),
        booking_addons (
          addon_id,
          quantity,
          unit_price,
          subtotal,
          addons (id, name, price, is_per_night, base_breakfast)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const { data: orderTotals, error: orderErr } = await supabase
      .from('orders')
      .select('booking_id, total_amount')
      .not('status', 'eq', 'billed');

    if (orderErr) throw orderErr;

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

      // FIX 4: If status is 'checked_in', phase must be 'in-house' regardless of date.
      // This ensures the badge immediately reflects the operational state after check-in.
      let stayPhase;
      if (b.status === 'checked_in') {
        stayPhase = 'in-house';
      } else if (b.check_in_date === today) {
        stayPhase = 'arrival';
      } else if (b.check_out_date === today) {
        stayPhase = 'departure';
      } else if (b.check_in_date > today) {
        stayPhase = 'upcoming';
      } else {
        stayPhase = 'in-house';
      }

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

app.post('/api/bookings', async (req, res) => {
  const {
    villa_ids,
    guest_id,
    check_in_date,
    check_out_date,
    total_guests,
    total_price,
    notes,
    selected_addons,
    apply_discount,
    discount_id,
  } = req.body;

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

    const blockConflicts = await findBlockConflicts(villa_ids, check_in_date, check_out_date);
    if (blockConflicts.length > 0) {
      return res.status(409).json({
        error: 'One or more villas are unavailable for these dates due to a scheduled block.',
      });
    }

    const charges = await computeBookingCharges({
      villa_ids,
      selected_addons: selected_addons || [],
      check_in_date,
      check_out_date,
    });

    const { discount, discount_id: resolvedDiscountId } = await resolveDiscountForBooking({
      apply_discount: !!apply_discount,
      discount_id,
    });

    let discountAmount = 0;
    if (discount) {
      const result = calculateDiscountAmount(discount, {
        villaLines: charges.villaLines,
        addonLines: charges.addonLines,
        menuLines: [],
      });
      discountAmount = result.amount;
    }

    const computedTotal = Math.max(charges.accommodationTotal - discountAmount, 0);
    const finalTotal = total_price !== undefined ? Number(total_price) : computedTotal;

    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        guest_id,
        check_in_date,
        check_out_date,
        total_guests,
        total_price: finalTotal,
        notes,
        discount_id: discount ? resolvedDiscountId : null,
        discount_amount: discountAmount,
      }])
      .select()
      .single();

    if (bookingError) throw bookingError;

    const nights = stayNights(check_in_date, check_out_date);
    const { data: villaCatalog, error: villaFetchError } = await supabase
      .from('villas')
      .select('id, base_rate_per_night')
      .in('id', villa_ids);
    if (villaFetchError) throw villaFetchError;

    const bridgeRows = buildBookingVillaRows(bookingData.id, villa_ids, villaCatalog, nights);
    const { error: bridgeError } = await supabase.from('booking_villas').insert(bridgeRows);
    if (bridgeError) throw bridgeError;

    if (selected_addons && selected_addons.length > 0) {
      const addonIds = selected_addons.map((a) => a.addon_id);
      const { data: addonCatalog, error: addonFetchError } = await supabase
        .from('addons')
        .select('id, price, is_per_night')
        .in('id', addonIds);
      if (addonFetchError) throw addonFetchError;

      const addonRows = buildBookingAddonRows(bookingData.id, selected_addons, addonCatalog, nights);
      const { error: addonError } = await supabase.from('booking_addons').insert(addonRows);
      if (addonError) {
        await supabase.from('booking_villas').delete().eq('booking_id', bookingData.id);
        await supabase.from('bookings').delete().eq('id', bookingData.id);
        throw addonError;
      }
    }

    res.status(201).json(bookingData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updateData = { status };

    if (status === 'checked_in') {
      // Checked-in bookings always operate in the in-house phase (computed on read).
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id', async (req, res) => {
  const { id } = req.params;
  const {
    check_in_date,
    check_out_date,
    total_guests,
    notes,
    total_price,
    villa_ids,
    selected_addons,
    apply_discount,
    discount_id,
  } = req.body;

  try {
    const { data: existing, error: existingError } = await supabase
      .from('bookings')
      .select('check_in_date, check_out_date, status')
      .eq('id', id)
      .single();

    if (existingError) throw existingError;
    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Cancelled bookings cannot be edited.' });
    }

    const nextCheckIn = check_in_date ?? existing.check_in_date;
    const nextCheckOut = check_out_date ?? existing.check_out_date;

    if (new Date(nextCheckOut) <= new Date(nextCheckIn)) {
      return res.status(400).json({ error: 'Check-out must be after check-in.' });
    }

    if (Array.isArray(villa_ids) && villa_ids.length > 0) {
      const { data: conflictingBookings, error: checkError } = await supabase
        .from('booking_villas')
        .select(`villa_id, booking_id, bookings!inner (id, check_in_date, check_out_date, status)`)
        .in('villa_id', villa_ids)
        .not('bookings.status', 'eq', 'cancelled')
        .neq('booking_id', id)
        .lt('bookings.check_in_date', nextCheckOut)
        .gt('bookings.check_out_date', nextCheckIn);

      if (checkError) throw checkError;
      if (conflictingBookings && conflictingBookings.length > 0) {
        return res.status(409).json({ error: 'One or more villas are already reserved for these dates.' });
      }

      const blockConflicts = await findBlockConflicts(villa_ids, nextCheckIn, nextCheckOut);
      if (blockConflicts.length > 0) {
        return res.status(409).json({
          error: 'One or more villas are unavailable for these dates due to a scheduled block.',
        });
      }
    }

    const updateData = {};
    if (check_in_date !== undefined) updateData.check_in_date = check_in_date;
    if (check_out_date !== undefined) updateData.check_out_date = check_out_date;
    if (total_guests !== undefined) updateData.total_guests = total_guests;
    if (notes !== undefined) updateData.notes = notes;

    const shouldRecalculate =
      Array.isArray(villa_ids) ||
      Array.isArray(selected_addons) ||
      apply_discount !== undefined ||
      discount_id !== undefined ||
      check_in_date !== undefined ||
      check_out_date !== undefined;

    if (shouldRecalculate) {
      let resolvedVillaIds = villa_ids;
      if (!Array.isArray(resolvedVillaIds)) {
        const { data: currentVillas, error: villaFetchError } = await supabase
          .from('booking_villas')
          .select('villa_id')
          .eq('booking_id', id);
        if (villaFetchError) throw villaFetchError;
        resolvedVillaIds = (currentVillas || []).map((row) => row.villa_id);
      }

      let resolvedAddons = selected_addons;
      if (!Array.isArray(resolvedAddons)) {
        const { data: currentAddons, error: addonFetchError } = await supabase
          .from('booking_addons')
          .select('addon_id, quantity')
          .eq('booking_id', id);
        if (addonFetchError) throw addonFetchError;
        resolvedAddons = (currentAddons || []).map((row) => ({
          addon_id: row.addon_id,
          quantity: row.quantity,
        }));
      }

      const charges = await computeBookingCharges({
        villa_ids: resolvedVillaIds,
        selected_addons: resolvedAddons,
        check_in_date: nextCheckIn,
        check_out_date: nextCheckOut,
      });

      const { discount } = await resolveDiscountForBooking({
        apply_discount: apply_discount === true,
        discount_id: apply_discount === true ? discount_id : undefined,
      });

      let discountAmount = 0;
      let appliedDiscountId = null;

      if (apply_discount === false) {
        discountAmount = 0;
        appliedDiscountId = null;
      } else {
        let discountToApply = discount;

        if (!discountToApply && apply_discount !== true) {
          const { data: currentBooking, error: currentBookingError } = await supabase
            .from('bookings')
            .select('discount_id')
            .eq('id', id)
            .single();
          if (currentBookingError) throw currentBookingError;
          if (currentBooking.discount_id) {
            discountToApply = await fetchDiscountById(currentBooking.discount_id);
          }
        }

        if (discountToApply) {
          const result = calculateDiscountAmount(discountToApply, {
            villaLines: charges.villaLines,
            addonLines: charges.addonLines,
            menuLines: [],
          });
          discountAmount = result.amount;
          appliedDiscountId = discountToApply.id;
        }
      }

      updateData.total_price = total_price !== undefined
        ? Number(total_price)
        : Math.max(charges.accommodationTotal - discountAmount, 0);
      updateData.discount_id = appliedDiscountId;
      updateData.discount_amount = discountAmount;

      const patchNights = stayNights(nextCheckIn, nextCheckOut);

      if (Array.isArray(villa_ids)) {
        await supabase.from('booking_villas').delete().eq('booking_id', id);
        if (villa_ids.length > 0) {
          const { data: villaCatalog, error: villaCatalogError } = await supabase
            .from('villas')
            .select('id, base_rate_per_night')
            .in('id', villa_ids);
          if (villaCatalogError) throw villaCatalogError;

          const bridgeRows = buildBookingVillaRows(id, villa_ids, villaCatalog, patchNights);
          const { error: bridgeError } = await supabase.from('booking_villas').insert(bridgeRows);
          if (bridgeError) throw bridgeError;
        }
      } else if (check_in_date !== undefined || check_out_date !== undefined) {
        const { data: currentBridge, error: bridgeFetchError } = await supabase
          .from('booking_villas')
          .select('id, villa_id, rate_per_night')
          .eq('booking_id', id);
        if (bridgeFetchError) throw bridgeFetchError;

        if (currentBridge?.length) {
          await Promise.all(
            currentBridge.map((row) =>
              supabase
                .from('booking_villas')
                .update({ nights: patchNights })
                .eq('id', row.id)
            )
          );
        }
      }

      if (Array.isArray(selected_addons)) {
        await supabase.from('booking_addons').delete().eq('booking_id', id);
        if (selected_addons.length > 0) {
          const addonIds = selected_addons.map((a) => a.addon_id);
          const { data: addonCatalog, error: addonFetchError } = await supabase
            .from('addons')
            .select('id, price, is_per_night')
            .in('id', addonIds);
          if (addonFetchError) throw addonFetchError;

          const addonRows = buildBookingAddonRows(id, selected_addons, addonCatalog, patchNights);
          const { error: addonInsertError } = await supabase.from('booking_addons').insert(addonRows);
          if (addonInsertError) throw addonInsertError;
        }
      }
    } else if (total_price !== undefined) {
      updateData.total_price = total_price;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        discounts (id, code, name, type, value, scope, status, application_rule),
        guests (full_name, phone_number),
        booking_villas (
          villa_id,
          rate_per_night,
          nights,
          villas (id, name, base_rate_per_night, display_id)
        ),
        booking_addons (
          addon_id,
          quantity,
          unit_price,
          subtotal,
          addons (id, name, price, is_per_night)
        )
      `)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:id/cancel', async (req, res) => {
  const { id } = req.params;
  const { cancellation_reason } = req.body;

  if (!cancellation_reason || !String(cancellation_reason).trim()) {
    return res.status(400).json({ error: 'Cancellation reason is required.' });
  }

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('bookings')
      .select('notes, status')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (existing.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    const reasonLine = `[CANCELLED ${new Date().toISOString().split('T')[0]}] ${String(cancellation_reason).trim()}`;
    const updatedNotes = existing.notes
      ? `${existing.notes}\n\n${reasonLine}`
      : reasonLine;

    const { data, error } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        payment_status: 'cancelled',
        notes: updatedNotes,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('check_payment_status')) {
        return res.status(400).json({
          error: 'Could not cancel booking: the database must allow payment_status "cancelled". Run backend/db/migrations/001_allow_cancelled_payment_status.sql in Supabase SQL Editor.',
        });
      }
      throw error;
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🍽️  MENU ITEMS
// ─────────────────────────────────────────────────────────────

app.get('/api/menu-items', async (req, res) => {
  try {
    let query = supabase.from('menu_items').select('*').order('category').order('name');
    if (req.query.all !== 'true') {
      query = query.eq('is_available', true);
    }
    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/menu-items', async (req, res) => {
  const { name, category = 'food', price, is_available = true } = req.body;
  if (!name?.trim() || price === undefined) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert([{ name: name.trim(), category, price: Number(price), is_available }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/menu-items/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.category !== undefined) payload.category = req.body.category;
  if (req.body.price !== undefined) payload.price = Number(req.body.price);
  if (req.body.is_available !== undefined) payload.is_available = !!req.body.is_available;
  try {
    const { data, error } = await supabase.from('menu_items').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/menu-items/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('menu_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Menu item deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🧾  ORDERS
// ─────────────────────────────────────────────────────────────

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
          unit_cost,
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

app.post('/api/bookings/:bookingId/orders', async (req, res) => {
  const { bookingId } = req.params;
  const { items, staff_note } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    const menuIds = items.map(i => i.menu_item_id);
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, price')
      .in('id', menuIds);

    if (menuError) throw menuError;

    const priceMap = {};
    menuData.forEach(m => { priceMap[m.id] = m.price; });

    const total_amount = items.reduce((sum, item) => {
      return sum + (priceMap[item.menu_item_id] || 0) * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ booking_id: bookingId, staff_note: staff_note || null, total_amount, status: ORDER_STATUS_OPEN }])
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItemRows = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id] || 0;
      const quantity = item.quantity;
      return {
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity,
        unit_price: unitPrice,
        unit_cost: 0,
      };
    });

    const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
    if (itemsError) throw itemsError;

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/bookings/:bookingId/food-orders', async (req, res) => {
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
          unit_cost,
          subtotal,
          menu_items (id, name, category)
        )
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(order => ({
      ...order,
      total_price: order.total_amount,
      items: (order.order_items || []).map(item => ({
        menu_item_name: item.menu_items?.name || 'Unknown',
        quantity: item.quantity,
        price_at_order: Number(item.unit_price) || 0,
        subtotal: Number(item.subtotal) || Number(item.unit_price) * (item.quantity || 1),
      })),
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:bookingId/food-orders', async (req, res) => {
  const { bookingId } = req.params;
  const { items } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Order must contain at least one item.' });
  }

  try {
    const menuIds = items.map(i => i.menu_item_id);
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('id, price')
      .in('id', menuIds);

    if (menuError) throw menuError;

    const priceMap = {};
    menuData.forEach(m => { priceMap[m.id] = m.price; });

    const total_amount = items.reduce((sum, item) => {
      return sum + (priceMap[item.menu_item_id] || 0) * item.quantity;
    }, 0);

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{
        booking_id: bookingId,
        total_amount,
        status: ORDER_STATUS_OPEN,
      }])
      .select()
      .single();

    if (orderError) {
      console.error("❌ Supabase Orders Insert Error:", orderError);
      return res.status(400).json({ error: orderError.message });
    }

    const orderItemRows = items.map(item => {
      const unitPrice = priceMap[item.menu_item_id] || 0;
      const quantity = item.quantity;
      return {
        order_id: order.id,
        menu_item_id: item.menu_item_id,
        quantity,
        unit_price: unitPrice,
        unit_cost: 0,
      };
    });

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemRows);

    if (itemsError) {
      console.error("❌ Supabase Order Items Insert Error:", itemsError);
      throw itemsError;
    }

    res.status(201).json({ ...order, items: orderItemRows });
  } catch (error) {
    console.error("Backend Food Order Submission Error:", error);
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `Invalid order status. Allowed: ${ORDER_STATUSES.join(', ')}`,
    });
  }

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
      .select(`id, display_id, status, check_in_date, check_out_date, guests (full_name), booking_villas (villa_id)`)
      .not('status', 'eq', 'cancelled');

    if (bookingError) throw bookingError;

    const { data: blocks } = await supabase
      .from('villa_date_blocks')
      .select('id, villa_id, start_date, end_date, reason');

    const ganttData = villas.map(villa => {
      const villaBookings = bookings
        .filter(b => b.booking_villas?.some(bv => bv.villa_id === villa.id))
        .map(b => ({
          id: b.id,
          displayId: b.display_id || null,
          guest: b.guests?.full_name || 'Unknown Guest',
          checkIn: b.check_in_date,
          checkOut: b.check_out_date,
          status: b.status,
        }));

      const villaBlocks = (blocks || [])
        .filter(blk => blk.villa_id === villa.id)
        .map(blk => ({
          id: blk.id,
          startDate: blk.start_date,
          endDate: blk.end_date,
          reason: blk.reason,
        }));

      return { id: villa.id, name: villa.name, bookings: villaBookings, blocks: villaBlocks };
    });

    res.json(ganttData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/villas/blocks', async (req, res) => {
  const { villa_id, start_date, end_date, reason } = req.body;
  if (!villa_id || !start_date || !end_date || !reason?.trim()) {
    return res.status(400).json({ error: 'Villa, start date, end date, and reason are required.' });
  }
  if (end_date < start_date) {
    return res.status(400).json({ error: 'End date must be on or after start date.' });
  }
  try {
    const { data, error } = await supabase
      .from('villa_date_blocks')
      .insert([{
        villa_id,
        start_date,
        end_date,
        reason: reason.trim(),
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json({
      id: data.id,
      villa_id: data.villa_id,
      startDate: data.start_date,
      endDate: data.end_date,
      reason: data.reason,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/villas/blocks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('villa_date_blocks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
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
    const occupiedVillaIds = conflicts ? [...new Set(conflicts.map((c) => c.villa_id))] : [];

    const blockRows = await findBlockConflicts(null, check_in, check_out);
    const blockedVillaIds = [...new Set(blockRows.map((b) => b.villa_id))];
    const blockedDetails = blockRows.map((b) => ({
      villa_id: b.villa_id,
      start_date: b.start_date,
      end_date: b.end_date,
      reason: b.reason,
    }));

    res.json({ occupiedVillaIds, blockedVillaIds, blockedDetails });
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

app.post('/api/villas', async (req, res) => {
  const { name, capacity = 1, base_rate_per_night, description = '', base_breakfast = 0 } = req.body;
  if (!name?.trim() || base_rate_per_night === undefined) {
    return res.status(400).json({ error: 'Name and base rate are required.' });
  }
  try {
    const { data, error } = await supabase
      .from('villas')
      .insert([{
        name: name.trim(),
        capacity: Number(capacity) || 1,
        base_rate_per_night: Number(base_rate_per_night),
        description,
        base_breakfast: Number(base_breakfast) || 0,
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/villas/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.capacity !== undefined) payload.capacity = Number(req.body.capacity);
  if (req.body.base_rate_per_night !== undefined) payload.base_rate_per_night = Number(req.body.base_rate_per_night);
  if (req.body.description !== undefined) payload.description = req.body.description;
  if (req.body.base_breakfast !== undefined) payload.base_breakfast = Number(req.body.base_breakfast) || 0;
  try {
    const { data, error } = await supabase.from('villas').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/villas/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('villas').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Villa deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 👤  GUESTS & ADD-ONS
// ─────────────────────────────────────────────────────────────

app.post('/api/guests', async (req, res) => {
  const { full_name, email, phone_number, id_card_number } = req.body;
  try {
    const { data, error } = await supabase
      .from('guests')
      .insert([{
        full_name,
        email,
        phone_number,
        ...(id_card_number !== undefined ? { id_card_number } : {}),
      }])
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
    res.json((data || []).map(mapAddonRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/addons', async (req, res) => {
  const {
    name,
    price,
    price_per_night,
    base_breakfast = 0,
    is_per_night = true,
  } = req.body;
  const resolvedPrice = price ?? price_per_night;
  if (!name?.trim() || resolvedPrice === undefined) {
    return res.status(400).json({ error: 'Name and price are required.' });
  }
  try {
    const numericPrice = Number(resolvedPrice);
    const { data, error } = await supabase
      .from('addons')
      .insert([{
        name: name.trim(),
        price: numericPrice,
        base_breakfast: Number(base_breakfast) || 0,
        is_per_night: is_per_night !== false,
      }])
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(mapAddonRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/addons/:id', async (req, res) => {
  const { id } = req.params;
  const payload = {};
  if (req.body.name !== undefined) payload.name = req.body.name.trim();
  if (req.body.price !== undefined) {
    payload.price = Number(req.body.price);
  } else if (req.body.price_per_night !== undefined) {
    payload.price = Number(req.body.price_per_night);
  }
  if (req.body.base_breakfast !== undefined) payload.base_breakfast = Number(req.body.base_breakfast) || 0;
  if (req.body.is_per_night !== undefined) payload.is_per_night = !!req.body.is_per_night;
  try {
    const { data, error } = await supabase.from('addons').update(payload).eq('id', id).select().single();
    if (error) throw error;
    res.json(mapAddonRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/addons/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('addons').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Add-on deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 🏷️  DISCOUNTS
// ─────────────────────────────────────────────────────────────

app.get('/api/discounts', async (req, res) => {
  try {
    const { data, error } = await supabase.from('discounts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map(mapDiscountRow));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/discounts', async (req, res) => {
  const payload = discountPayloadFromBody(req.body);
  if (!payload.code || !payload.name || payload.value === undefined || Number.isNaN(payload.value)) {
    return res.status(400).json({ error: 'Promo code, name, and value are required.' });
  }
  try {
    const { data, error } = await supabase.from('discounts').insert([payload]).select().single();
    if (error) throw error;
    res.status(201).json(mapDiscountRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/discounts/:id', async (req, res) => {
  const payload = discountPayloadFromBody(req.body, { partial: true });
  if (Object.keys(payload).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update.' });
  }
  try {
    const { data, error } = await supabase.from('discounts').update(payload).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(mapDiscountRow(data));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('discounts').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ message: 'Discount deleted.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 💳  PAYMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────

function stayNights(checkIn, checkOut) {
  return Math.max(
    Math.ceil((new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24)),
    1
  );
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function currentMonthBounds() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const end = lastDay.toISOString().split('T')[0];
  return { start, end };
}

function addDaysISO(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function encodeExpenseProof(description, proofUrl) {
  const base = (description || '').trim();
  if (!proofUrl) return base || null;
  return base ? `${base}\n[proof:${proofUrl}]` : `[proof:${proofUrl}]`;
}

function parseExpenseRecord(row) {
  const rawDescription = row.description || '';
  const proofMatch = rawDescription.match(/\[proof:([^\]]+)\]/);
  const proof = proofMatch?.[1] || null;
  const description = rawDescription.replace(/\n?\[proof:[^\]]+\]\s*$/, '').trim();
  return {
    id: row.id,
    displayId: row.display_id,
    category: row.category,
    description,
    amount: Number(row.amount) || 0,
    transactionDate: row.transaction_date,
    status: row.status,
    proof,
    createdAt: row.created_at,
  };
}

function addonUnitPrice(addon) {
  return Number(addon?.price) || 0;
}

function mapAddonRow(row) {
  if (!row) return row;
  const price = Number(row.price) || 0;
  return { ...row, price, price_per_night: price };
}

function buildBookingVillaRows(bookingId, villaIds, villaCatalog, nights) {
  const villaMap = Object.fromEntries((villaCatalog || []).map((v) => [v.id, v]));
  return villaIds.map((villaId) => {
    const villa = villaMap[villaId];
    const rate = Number(villa?.base_rate_per_night) || 0;
    return {
      booking_id: bookingId,
      villa_id: villaId,
      rate_per_night: rate,
      nights,
    };
  });
}

function buildBookingAddonRows(bookingId, selectedAddons, addonCatalog, nights) {
  const addonMap = Object.fromEntries((addonCatalog || []).map((a) => [a.id, a]));
  return selectedAddons.map((selection) => {
    const addon = addonMap[selection.addon_id];
    const unitPrice = addon ? addonUnitPrice(addon) : 0;
    const quantity = Number(selection.quantity) || 1;
    return {
      booking_id: bookingId,
      addon_id: selection.addon_id,
      quantity,
      unit_price: unitPrice,
    };
  });
}

async function fetchDiscountById(discountId) {
  if (!discountId) return null;
  const { data, error } = await supabase.from('discounts').select('*').eq('id', discountId).maybeSingle();
  if (error) throw error;
  return data;
}

async function computeBookingCharges({ villa_ids = [], selected_addons = [], check_in_date, check_out_date }) {
  const nights = stayNights(check_in_date, check_out_date);
  let villaTotal = 0;
  const villaLines = [];

  if (villa_ids.length > 0) {
    const { data: villas, error } = await supabase.from('villas').select('*').in('id', villa_ids);
    if (error) throw error;
    (villas || []).forEach((villa) => {
      const rate = Number(villa.base_rate_per_night) || 0;
      const subtotal = rate * nights;
      villaTotal += subtotal;
      villaLines.push({
        type: 'accommodation',
        name: villa.name,
        description: `${villa.name} — ${nights} night${nights !== 1 ? 's' : ''}`,
        quantity: nights,
        unitPrice: rate,
        subtotal,
      });
    });
  }

  let addonTotal = 0;
  const addonLines = [];

  if (selected_addons.length > 0) {
    const addonIds = selected_addons.map((a) => a.addon_id);
    const { data: addons, error } = await supabase.from('addons').select('*').in('id', addonIds);
    if (error) throw error;
    const addonMap = Object.fromEntries((addons || []).map((a) => [a.id, a]));

    selected_addons.forEach(({ addon_id, quantity }) => {
      const addon = addonMap[addon_id];
      if (!addon) return;
      const qty = Number(quantity) || 1;
      const unitPrice = addonUnitPrice(addon);
      const multiplier = addon.is_per_night !== false ? nights : 1;
      const subtotal = unitPrice * qty * multiplier;
      addonTotal += subtotal;
      addonLines.push({
        type: 'addon',
        name: addon.name,
        description: addon.name,
        quantity: qty * multiplier,
        unitPrice,
        subtotal,
      });
    });
  }

  return {
    nights,
    villaTotal,
    addonTotal,
    accommodationTotal: villaTotal + addonTotal,
    villaLines,
    addonLines,
  };
}

async function resolveDiscountForBooking({ apply_discount, discount_id }) {
  if (!apply_discount) {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  let discount = null;
  if (discount_id) {
    discount = await fetchDiscountById(discount_id);
  } else {
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    discount = data;
  }

  if (!discount || discount.status !== 'active') {
    return { discount: null, discount_id: null, discount_amount: 0 };
  }

  return { discount, discount_id: discount.id, discount_amount: null };
}

function buildInvoiceId(bookingOrId) {
  if (bookingOrId && typeof bookingOrId === 'object') {
    if (bookingOrId.display_id) return bookingOrId.display_id;
    return `UM-${String(bookingOrId.id).slice(0, 8).toUpperCase()}`;
  }
  return `UM-${String(bookingOrId).slice(0, 8).toUpperCase()}`;
}

async function buildFinancialSummary(bookingId) {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      *,
      discounts (id, code, name, type, value, scope, status, application_rule),
      guests (full_name, phone_number),
      booking_villas (rate_per_night, nights, villas (name, base_rate_per_night)),
      booking_addons (
        quantity,
        unit_price,
        subtotal,
        addons (name, price, is_per_night, base_breakfast)
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError) throw bookingError;

  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select(`
      id,
      total_amount,
      status,
      created_at,
      order_items (
        quantity,
        unit_price,
        subtotal,
        menu_items (name, category)
      )
    `)
    .eq('booking_id', bookingId)
    .in('status', ORDER_STATUSES);

  if (orderError) throw orderError;

  const nights = stayNights(booking.check_in_date, booking.check_out_date);
  const accommodationLines = [];
  let calculatedAccommodation = 0;

  (booking.booking_villas || []).forEach((bv) => {
    const rate = Number(bv.rate_per_night) || Number(bv.villas?.base_rate_per_night) || 0;
    const lineNights = Number(bv.nights) || nights;
    const subtotal = rate > 0 ? rate * lineNights : 0;
    if (rate > 0) {
      calculatedAccommodation += subtotal;
      accommodationLines.push({
        type: 'accommodation',
        name: bv.villas?.name || 'Villa',
        description: `${bv.villas?.name || 'Villa'} — ${lineNights} night${lineNights !== 1 ? 's' : ''}`,
        quantity: lineNights,
        unitPrice: rate,
        subtotal,
      });
    }
  });

  const accommodation = calculatedAccommodation > 0
    ? calculatedAccommodation
    : Number(booking.total_price) || 0;

  if (accommodationLines.length === 0) {
    accommodationLines.push({
      type: 'accommodation',
      name: 'Accommodation',
      description: `Stay ${booking.check_in_date} → ${booking.check_out_date}`,
      quantity: nights,
      unitPrice: nights > 0 ? accommodation / nights : accommodation,
      subtotal: accommodation,
    });
  }

  const addonLines = (booking.booking_addons || []).map((ba) => {
    const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
    const quantity = ba.quantity || 1;
    const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
    const billableQty = quantity * multiplier;
    const subtotal = Number(ba.subtotal) || unitPrice * billableQty;
    return {
      type: 'addon',
      name: ba.addons?.name || 'Add-on',
      description: ba.addons?.name || 'Add-on',
      quantity: billableQty,
      unitPrice,
      subtotal,
    };
  });

  let extraBeds = 0;
  let extraBreakfast = 0;
  let otherAddons = 0;
  (booking.booking_addons || []).forEach((ba) => {
    const unitPrice = Number(ba.unit_price) || addonUnitPrice(ba.addons);
    const quantity = ba.quantity || 1;
    const multiplier = ba.addons?.is_per_night !== false ? nights : 1;
    const lineTotal = Number(ba.subtotal) || unitPrice * quantity * multiplier;
    const addonName = (ba.addons?.name || '').toLowerCase();
    if (addonName.includes('extra bed')) extraBeds += lineTotal;
    else if ((ba.addons?.base_breakfast || 0) > 0 || addonName.includes('breakfast')) extraBreakfast += lineTotal;
    else otherAddons += lineTotal;
  });

  const totalAddons = addonLines.reduce((sum, line) => sum + line.subtotal, 0);

  const menuLines = [];
  let menuTotal = 0;
  (orders || []).forEach((order) => {
    if (order.order_items?.length) {
      order.order_items.forEach((item) => {
        const unitPrice = Number(item.unit_price) || 0;
        const quantity = item.quantity || 1;
        const subtotal = Number(item.subtotal) || unitPrice * quantity;
        menuTotal += subtotal;
        menuLines.push({
          type: 'menu',
          name: item.menu_items?.name || 'Menu Item',
          description: item.menu_items?.name || 'Menu Item',
          category: item.menu_items?.category || null,
          quantity,
          unitPrice,
          subtotal,
          orderDate: order.created_at,
        });
      });
    } else if (Number(order.total_amount) > 0) {
      menuTotal += Number(order.total_amount);
      menuLines.push({
        type: 'menu',
        name: 'Order (unspecified items)',
        description: 'Order total',
        quantity: 1,
        unitPrice: Number(order.total_amount),
        subtotal: Number(order.total_amount),
        orderDate: order.created_at,
      });
    }
  });

  const menuItems = menuLines.map(({ name, quantity, subtotal, unitPrice }) => ({
    name, quantity, subtotal, unitPrice,
  }));

  const subtotalBeforeDiscount = accommodation + totalAddons + menuTotal;

  let discountAmount = 0;
  let discountLines = [];
  let discountMeta = null;

  if (booking.discount_id && booking.discounts) {
    const discountResult = calculateDiscountAmount(booking.discounts, {
      villaLines: accommodationLines,
      addonLines,
      menuLines,
    });
    discountAmount = discountResult.amount;
    discountLines = discountResult.lines;
    discountMeta = mapDiscountRow(booking.discounts);
  } else if (Number(booking.discount_amount) > 0) {
    discountAmount = Number(booking.discount_amount);
    discountLines = [{
      type: 'discount',
      name: 'Discount',
      description: 'Applied discount',
      quantity: 1,
      unitPrice: -discountAmount,
      subtotal: -discountAmount,
    }];
  }

  const lineItems = [...accommodationLines, ...addonLines, ...menuLines, ...discountLines];
  const total = Math.max(subtotalBeforeDiscount - discountAmount, 0);
  const amountPaid = Number(booking.amount_paid) || 0;
  const balanceDue = Math.max(total - amountPaid, 0);

  const { data: partialPayments } = await supabase
    .from('finances')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('category', 'partial_payment')
    .limit(1);

  return {
    booking,
    invoiceId: buildInvoiceId(booking),
    displayId: booking.display_id || buildInvoiceId(booking),
    accommodation,
    totalAccommodation: accommodation,
    totalAddons,
    totalMenuItems: menuTotal,
    extraBeds,
    extraBreakfast,
    otherAddons,
    accommodationLines,
    addonLines,
    menuLines,
    discountLines,
    lineItems,
    menuItems,
    menuTotal,
    subtotalBeforeDiscount,
    discountAmount,
    discount: discountMeta,
    discountCode: discountMeta?.code || null,
    applicationRule: discountMeta?.application_rule || null,
    total,
    amountPaid,
    balanceDue,
    balance: balanceDue,
    reminder: balanceDue,
    paymentStatus: booking.payment_status || 'pending',
    hasPartialPayment: (partialPayments || []).length > 0 || booking.payment_status === 'partial' || booking.payment_status === 'complete',
    villaNames: booking.booking_villas?.map((bv) => bv.villas?.name).filter(Boolean).join(', ') || '—',
    guestName: booking.guests?.full_name || 'Guest',
    phone: booking.guests?.phone_number || '',
    totalGuests: booking.total_guests,
    nights,
    checkIn: booking.check_in_date,
    checkOut: booking.check_out_date,
  };
}

// ─────────────────────────────────────────────────────────────
// 📎  RECEIPT UPLOAD — Supabase Storage
// ─────────────────────────────────────────────────────────────

app.post('/api/bookings/:bookingId/upload-receipt', async (req, res) => {
  const { bookingId } = req.params;
  const { fileData, fileName, fileType, paymentType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: 'fileData and fileName are required.' });
  }

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('id, guest_id, payment_status, amount_paid')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    let suffix = '_partial';
    if (paymentType === 'final' || booking.payment_status === 'complete') {
      suffix = '_full';
    }

    const dotIdx = fileName.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? fileName.slice(0, dotIdx) : fileName;
    const ext      = dotIdx !== -1 ? fileName.slice(dotIdx)    : '';
    const finalFileName = `${baseName}${suffix}${ext}`;

    const storagePath = `receipt/guest/${booking.guest_id}/${bookingId}/${finalFileName}`;

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('transaction_reservation')
      .upload(storagePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('transaction_reservation')
      .getPublicUrl(storagePath);

    res.json({
      message: 'Receipt uploaded successfully',
      path: storagePath,
      publicUrl: urlData?.publicUrl || null,
      fileName: finalFileName,
      suffix,
    });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 📊  FINANCIAL ENDPOINTS
// ─────────────────────────────────────────────────────────────

app.get('/api/financial/income', async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, display_id, status, payment_status, created_at')
      .not('status', 'eq', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const rows = await Promise.all(
      (bookings || []).map(async (b) => {
        const summary = await buildFinancialSummary(b.id);
        return {
          bookingId: b.id,
          displayId: summary.displayId,
          invoiceId: summary.displayId,
          guestName: summary.booking.guests?.full_name || 'Unknown Guest',
          checkIn: summary.booking.check_in_date,
          checkOut: summary.booking.check_out_date,
          totalAccommodation: summary.totalAccommodation,
          totalAddons: summary.totalAddons,
          totalMenuItems: summary.totalMenuItems,
          total: summary.total,
          amountPaid: summary.amountPaid,
          balanceDue: summary.balanceDue,
          paymentStatus: summary.paymentStatus,
          bookingStatus: summary.booking.status,
        };
      })
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/kpis', async (req, res) => {
  try {
    const { start, end } = currentMonthBounds();
    const today = todayISO();
    const depositWindowEnd = addDaysISO(today, 30);

    const { data: incomeRows, error: incomeError } = await supabase
      .from('finances')
      .select('amount')
      .eq('type', 'income')
      .eq('status', 'approved')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (incomeError) throw incomeError;

    const { data: expenseRows, error: expenseError } = await supabase
      .from('finances')
      .select('amount')
      .eq('type', 'expense')
      .eq('status', 'approved')
      .gte('transaction_date', start)
      .lte('transaction_date', end);

    if (expenseError) throw expenseError;

    const totalRevenue = (incomeRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalExpenses = (expenseRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

    const { data: upcomingBookings, error: upcomingError } = await supabase
      .from('bookings')
      .select('id, amount_paid, payment_status, status, check_in_date')
      .eq('status', 'confirmed')
      .in('payment_status', ['partial', 'partially_paid'])
      .gt('check_in_date', today);

    if (upcomingError) throw upcomingError;

    const { data: pendingDepositBookings, error: depositError } = await supabase
      .from('bookings')
      .select('id, total_price, payment_status, status, check_in_date')
      .eq('status', 'confirmed')
      .eq('payment_status', 'pending')
      .gte('check_in_date', today)
      .lte('check_in_date', depositWindowEnd);

    if (depositError) throw depositError;

    let upcomingRevenue = 0;
    for (const booking of upcomingBookings || []) {
      const summary = await buildFinancialSummary(booking.id);
      upcomingRevenue += Math.max(summary.total - (Number(booking.amount_paid) || 0), 0);
    }

    let pendingDeposits = 0;
    for (const booking of pendingDepositBookings || []) {
      const summary = await buildFinancialSummary(booking.id);
      pendingDeposits += summary.total;
    }

    res.json({
      totalRevenue,
      upcomingRevenue,
      pendingDeposits,
      totalExpenses,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/financial/expenses', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('finances')
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .eq('type', 'expense')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json((data || []).map(parseExpenseRecord));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/expenses/upload-proof', async (req, res) => {
  const { fileData, fileName, fileType } = req.body;

  if (!fileData || !fileName) {
    return res.status(400).json({ error: 'fileData and fileName are required.' });
  }

  try {
    const dotIdx = fileName.lastIndexOf('.');
    const ext = dotIdx !== -1 ? fileName.slice(dotIdx) : '';
    const storagePath = `proofs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    const base64Data = fileData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('expenses')
      .upload(storagePath, buffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('expenses')
      .getPublicUrl(storagePath);

    res.json({
      message: 'Proof uploaded successfully',
      path: storagePath,
      publicUrl: urlData?.publicUrl || null,
    });
  } catch (error) {
    console.error('Expense proof upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/financial/expenses', async (req, res) => {
  const { category, description, amount, transactionDate, proofUrl } = req.body;

  if (!category || !amount || !transactionDate) {
    return res.status(400).json({ error: 'category, amount, and transactionDate are required.' });
  }

  const validCategories = ['operational', 'maintenance', 'salary', 'f&b_cost', 'marketing', 'other_expense'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid expense category.' });
  }

  try {
    const payload = {
      type: 'expense',
      category,
      description: encodeExpenseProof(description, proofUrl),
      amount: Number(amount),
      transaction_date: transactionDate,
      status: 'pending',
    };

    const { data, error } = await supabase
      .from('finances')
      .insert([payload])
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .single();

    if (error) throw error;

    res.status(201).json(parseExpenseRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/financial/expenses/:expenseId', async (req, res) => {
  const { expenseId } = req.params;
  const { status, category, description, amount, transactionDate, proofUrl } = req.body;

  try {
    const { data: existing, error: fetchError } = await supabase
      .from('finances')
      .select('id, description, type')
      .eq('id', expenseId)
      .single();

    if (fetchError) throw fetchError;
    if (existing.type !== 'expense') {
      return res.status(400).json({ error: 'Record is not an expense.' });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (category !== undefined) updateData.category = category;
    if (amount !== undefined) updateData.amount = Number(amount);
    if (transactionDate !== undefined) updateData.transaction_date = transactionDate;

    if (description !== undefined || proofUrl !== undefined) {
      const parsed = parseExpenseRecord(existing);
      const nextDescription = description !== undefined ? description : parsed.description;
      const nextProof = proofUrl !== undefined ? proofUrl : parsed.proof;
      updateData.description = encodeExpenseProof(nextDescription, nextProof);
    }

    const { data, error } = await supabase
      .from('finances')
      .update(updateData)
      .eq('id', expenseId)
      .select('id, display_id, category, description, amount, transaction_date, status, created_at')
      .single();

    if (error) throw error;

    res.json(parseExpenseRecord(data));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/bookings/:bookingId/invoice/pdf', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const summary = await buildFinancialSummary(bookingId, supabase);
    const displayId = summary.displayId;
    const filename = `Booking Confirmation - ${displayId}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    await streamBookingConfirmationPdf(summary, res);
  } catch (error) {
    console.error('PDF generation error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Failed to generate booking confirmation PDF' });
    } else {
      res.end();
    }
  }
});

app.get('/api/bookings/:bookingId/invoice', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const summary = await buildFinancialSummary(bookingId);
    const displayId = summary.displayId;

    res.json({
      invoiceNumber: displayId,
      displayId,
      guestName: summary.booking.guests?.full_name || 'Guest',
      checkIn: summary.booking.check_in_date,
      checkOut: summary.booking.check_out_date,
      villaNames: summary.villaNames,
      lineItems: summary.lineItems,
      accommodationLines: summary.accommodationLines,
      addonLines: summary.addonLines,
      menuLines: summary.menuLines,
      discountLines: summary.discountLines,
      accommodation: summary.accommodation,
      extraBeds: summary.extraBeds,
      extraBreakfast: summary.extraBreakfast,
      menuItems: summary.menuItems,
      subtotalBeforeDiscount: summary.subtotalBeforeDiscount,
      discountAmount: summary.discountAmount,
      discount: summary.discount,
      discountCode: summary.discountCode,
      applicationRule: summary.applicationRule,
      total: summary.total,
      amountPaid: summary.amountPaid,
      balanceDue: summary.balanceDue,
      paymentStatus: summary.paymentStatus,
      generatedAt: new Date().toLocaleString('en-GB'),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bookings/:bookingId/payments', async (req, res) => {
  const { bookingId } = req.params;
  const {
    amount,
    paymentMethod = 'transfer',
    paymentType = 'general',
    proofFileName,
    notes,
  } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid payment amount.' });
  }

  try {
    const summary = await buildFinancialSummary(bookingId);
    const booking = summary.booking;

    if (paymentType === 'final' && !summary.hasPartialPayment) {
      return res.status(400).json({ error: 'Record a partial payment before submitting the final payment.' });
    }
    if (paymentType === 'partial' && summary.paymentStatus !== 'pending') {
      return res.status(400).json({ error: 'Partial payment has already been recorded.' });
    }

    const newAmountPaid = Number(booking.amount_paid) + Number(amount);
    const grandTotal = summary.total;

    let newPaymentStatus = 'pending';
    if (paymentType === 'partial') {
      newPaymentStatus = 'partial';
    } else if (paymentType === 'final') {
      if (newAmountPaid >= grandTotal) {
        newPaymentStatus = 'complete';
      } else {
        return res.status(400).json({
          error: `Final payment insufficient. Balance remaining: Rp ${Math.max(grandTotal - newAmountPaid, 0).toLocaleString()}`,
        });
      }
    } else {
      if (newAmountPaid > 0 && newAmountPaid < grandTotal) newPaymentStatus = 'partial';
      else if (newAmountPaid >= grandTotal) newPaymentStatus = 'complete';
    }

    const descriptiveAttachmentLabel = proofFileName ? `Proof: ${proofFileName}` : 'No document uploaded';

    await supabase.from('finances').insert([{
      booking_id: bookingId,
      type: 'income',
      amount: Number(amount),
      category: paymentType === 'final' ? 'final_payment' : 'partial_payment',
      transaction_date: new Date().toISOString().split('T')[0],
      description: `${paymentType === 'final' ? 'Final' : 'Partial'} payment via ${paymentMethod}. ${descriptiveAttachmentLabel}${notes ? `. ${notes}` : ''}`,
      status: 'approved',
    }]);

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        amount_paid: newAmountPaid,
        payment_status: newPaymentStatus,
      })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (newPaymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
    }

    res.json({
      message: 'Payment recorded successfully',
      amountPaid: newAmountPaid,
      paymentStatus: newPaymentStatus,
      balanceDue: Math.max(grandTotal - newAmountPaid, 0),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:bookingId/payment-status', async (req, res) => {
  const { bookingId } = req.params;
  const { paymentStatus, amountPaid } = req.body;

  try {
    const updateData = { payment_status: paymentStatus };
    if (amountPaid !== undefined) updateData.amount_paid = amountPaid;

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (paymentStatus === 'complete' && updatedBooking.status === 'checked_out') {
      await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);
    }

    res.json(updatedBooking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/bookings/:bookingId/check-in', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'checked_in' })
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

app.patch('/api/bookings/:bookingId/check-out', async (req, res) => {
  const { bookingId } = req.params;

  try {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('payment_status, check_out_date, status')
      .eq('id', bookingId)
      .single();

    if (bookingError) throw bookingError;

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: 'Guest must be checked in before check-out.' });
    }

    const today = todayISO();
    if (booking.check_out_date !== today) {
      return res.status(400).json({ error: 'Check-out is only available on the scheduled check-out date.' });
    }

    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'checked_out' })
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) throw updateError;

    if (booking.payment_status === 'complete') {
      await supabase
        .from('bookings')
        .update({ status: 'completed' })
        .eq('id', bookingId);
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
// 📊  DASHBOARD
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
    const [
      { data: arrivalsToday,            error: e1 },
      { data: departuresToday,          error: e2 },
      { data: inHouse,                  error: e3 },
      { data: breakfastTodayBookings,   error: e4 },
      { data: breakfastTomorrowBookings,error: e5 },
    ] = await Promise.all([
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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));