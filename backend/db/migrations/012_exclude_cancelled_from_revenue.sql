-- Exclude payments tied to cancelled bookings from dashboard month revenue.

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_tenant_id uuid,
  p_today date DEFAULT CURRENT_DATE,
  p_month_start date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'arrivalsToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status != 'cancelled' AND b.check_in_date = p_today
    ),
    'departuresToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status != 'cancelled' AND b.check_out_date = p_today
    ),
    'inHouse', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = p_tenant_id AND b.status = 'checked_in'
    ),
    'monthRevenue', (
      SELECT COALESCE(SUM(f.amount), 0) FROM finances f
      LEFT JOIN bookings b ON b.id = f.booking_id
      WHERE f.tenant_id = p_tenant_id
        AND f.type = 'income'
        AND f.status = 'approved'
        AND f.transaction_date >= p_month_start
        AND f.transaction_date <= p_today
        AND (f.booking_id IS NULL OR b.status IS DISTINCT FROM 'cancelled')
    )
  );
$$;
