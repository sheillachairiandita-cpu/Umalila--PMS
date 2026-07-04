import { parsePagination, fetchCursorPage, paginatedJson } from '../lib/pagination.js';
import { mapBookingIncomeSummaryRow } from '../lib/financialUtils.js';
import {
  parseExpenseRecord,
  encodeExpenseProof,
  mapCostProfileRow,
  mapProfitabilityRow,
} from '../lib/financialMappers.js';
import { todayISO, currentMonthBounds, addDaysISO } from '../lib/stayUtils.js';
import { auditLog } from '../lib/auditLog.js';
import {
  FINANCE_INCOME_WITH_BOOKING_SELECT,
  FINANCE_TRANSACTION_SELECT,
  sumCountableFinanceIncome,
  filterApprovedTransactions,
} from '../lib/financeEligibility.js';

export function registerFinancialRoutes(app, ctx) {
  const {
    supabase,
    S,
    INS,
    getCachedSummary,
    upsertReservationProfitability,
  } = ctx;

  app.get('/api/financial/income', async (req, res) => {
    try {
      const { limit, cursor } = parsePagination(req.query);
      const { data, nextCursor, hasMore } = await fetchCursorPage(
        supabase.from('booking_income_summary').select('*').eq('tenant_id', req.tenantId),
        { limit, cursor },
      );

      const rows = (data || []).map(mapBookingIncomeSummaryRow);
      paginatedJson(res, { data: rows, nextCursor, hasMore });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/financial/kpis', async (req, res) => {
    try {
      const { start, end } = currentMonthBounds();
      const today = todayISO();
      const depositWindowEnd = addDaysISO(today, 30);

      const { data: incomeRows, error: incomeError } = await S(req, 'finances')
        .select(FINANCE_INCOME_WITH_BOOKING_SELECT)
        .eq('type', 'income')
        .eq('status', 'approved')
        .gte('transaction_date', start)
        .lte('transaction_date', end);

      if (incomeError) throw incomeError;

      const { data: expenseRows, error: expenseError } = await S(req, 'finances')
        .select('amount')
        .eq('type', 'expense')
        .eq('status', 'approved')
        .gte('transaction_date', start)
        .lte('transaction_date', end);

      if (expenseError) throw expenseError;

      const totalRevenue = sumCountableFinanceIncome(incomeRows);
      const totalExpenses = (expenseRows || []).reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      const { data: upcomingBookings, error: upcomingError } = await S(req, 'bookings')
        .select('id, amount_paid, payment_status, status, check_in_date')
        .eq('status', 'confirmed')
        .neq('payment_status', 'cancelled')
        .in('payment_status', ['partial', 'partially_paid'])
        .gt('check_in_date', today);

      if (upcomingError) throw upcomingError;

      const { data: pendingDepositBookings, error: depositError } = await S(req, 'bookings')
        .select('id, total_price, payment_status, status, check_in_date')
        .eq('status', 'confirmed')
        .neq('payment_status', 'cancelled')
        .eq('payment_status', 'pending')
        .gte('check_in_date', today)
        .lte('check_in_date', depositWindowEnd);

      if (depositError) throw depositError;

      let upcomingRevenue = 0;
      for (const booking of upcomingBookings || []) {
        const summary = await getCachedSummary(booking.id, req.tenantId);
        upcomingRevenue += Math.max(summary.total - (Number(booking.amount_paid) || 0), 0);
      }

      let pendingDeposits = 0;
      for (const booking of pendingDepositBookings || []) {
        const summary = await getCachedSummary(booking.id, req.tenantId);
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

  app.get('/api/financial/transactions', async (req, res) => {
    try {
      const { data, error } = await S(req, 'finances')
        .select(FINANCE_TRANSACTION_SELECT)
        .eq('status', 'approved')
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      res.json(filterApprovedTransactions(data));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/financial/expenses', async (req, res) => {
    try {
      const { data, error } = await S(req, 'finances')
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

      const { data, error } = await INS(req, 'finances', [payload])
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
      const { data: existing, error: fetchError } = await S(req, 'finances')
        .select('id, description, type, status, amount')
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

      const { data, error } = await S(req, 'finances')
        .update(updateData)
        .eq('id', expenseId)
        .select('id, display_id, category, description, amount, transaction_date, status, created_at')
        .single();

      if (error) throw error;

      await auditLog(supabase, {
        tenantId: req.tenantId,
        userId: req.user?.id,
        action: status === 'approved' ? 'expense.approved' : status === 'rejected' ? 'expense.rejected' : 'expense.updated',
        entityType: 'finance',
        entityId: expenseId,
        oldValues: { status: existing.status, amount: existing.amount },
        newValues: updateData,
        req,
      });

      res.json(parseExpenseRecord(data));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/financial/cogs/profiles', async (req, res) => {
    try {
      const { data, error } = await S(req, 'property_cost_profiles')
        .select(`
          id,
          property_id,
          fixed_stay_cost,
          cost_per_night,
          created_at,
          updated_at,
          properties (id, name)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      res.json((data || []).map(mapCostProfileRow));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/financial/cogs/profiles', async (req, res) => {
    const { propertyId, fixedStayCost, costPerNight } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property is required.' });
    }

    try {
      const { data: existing } = await S(req, 'property_cost_profiles')
        .select('id')
        .eq('property_id', propertyId)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: 'A cost profile already exists for this property. Edit the existing profile instead.' });
      }

      const now = new Date().toISOString();
      const { data, error } = await INS(req, 'property_cost_profiles', [{
        property_id: propertyId,
        fixed_stay_cost: Math.max(Number(fixedStayCost) || 0, 0),
        cost_per_night: Math.max(Number(costPerNight) || 0, 0),
        created_at: now,
        updated_at: now,
      }]).select(`
          id,
          property_id,
          fixed_stay_cost,
          cost_per_night,
          created_at,
          updated_at,
          properties (id, name)
        `)
        .single();

      if (error) throw error;
      res.status(201).json(mapCostProfileRow(data));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch('/api/financial/cogs/profiles/:profileId', async (req, res) => {
    const { profileId } = req.params;
    const { fixedStayCost, costPerNight } = req.body;

    try {
      const updateData = { updated_at: new Date().toISOString() };
      if (fixedStayCost !== undefined) updateData.fixed_stay_cost = Math.max(Number(fixedStayCost) || 0, 0);
      if (costPerNight !== undefined) updateData.cost_per_night = Math.max(Number(costPerNight) || 0, 0);

      const { data, error } = await S(req, 'property_cost_profiles')
        .update(updateData)
        .eq('id', profileId)
        .select(`
          id,
          property_id,
          fixed_stay_cost,
          cost_per_night,
          created_at,
          updated_at,
          properties (id, name)
        `)
        .single();

      if (error) throw error;
      res.json(mapCostProfileRow(data));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/financial/cogs/profiles/:profileId', async (req, res) => {
    const { profileId } = req.params;

    try {
      const { error } = await S(req, 'property_cost_profiles')
        .delete()
        .eq('id', profileId);

      if (error) throw error;
      res.json({ message: 'Cost profile deleted.' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/financial/profitability', async (req, res) => {
    try {
      const { data, error } = await S(req, 'reservation_profitability')
        .select(`
          id,
          booking_id,
          property_id,
          revenue,
          room_revenue,
          addon_revenue,
          fb_revenue,
          cogs,
          gross_profit,
          fixed_stay_cost_snapshot,
          cost_per_night_snapshot,
          nights,
          calculated_at,
          properties (id, name),
          bookings!inner (check_in_date, check_out_date, status, payment_status)
        `)
        .neq('bookings.status', 'cancelled')
        .neq('bookings.payment_status', 'cancelled')
        .order('calculated_at', { ascending: false });

      if (error) throw error;
      res.json((data || []).map(mapProfitabilityRow));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/financial/profitability/backfill', async (req, res) => {
    try {
      const { data: bookings, error } = await S(req, 'bookings')
        .select('id')
        .not('status', 'eq', 'cancelled')
        .not('payment_status', 'eq', 'cancelled');

      if (error) throw error;

      let updated = 0;
      for (const b of bookings || []) {
        try {
          await upsertReservationProfitability(b.id, req.tenantId);
          updated += 1;
        } catch (err) {
          console.error(`Backfill ${b.id}:`, err.message);
        }
      }

      res.json({ message: `Profitability recalculated for ${updated} reservations.` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}
