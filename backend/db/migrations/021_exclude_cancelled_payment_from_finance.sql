-- Exclude bookings with cancelled payment from finance views and dashboard KPIs.

DROP VIEW IF EXISTS public.booking_income_summary;

CREATE VIEW public.booking_income_summary AS
SELECT
  base.*,
  GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0) AS total,
  GREATEST(
    GREATEST(base.subtotal_before_discount - COALESCE(base.discount_amount, 0), 0)
      - COALESCE(base.amount_paid, 0),
    0
  ) AS balance_due
FROM (
  SELECT
    b.id AS booking_id,
    b.tenant_id,
    b.display_id,
    b.check_in_date,
    b.check_out_date,
    b.payment_status,
    b.status AS booking_status,
    b.amount_paid,
    b.total_price,
    b.discount_amount,
    b.created_at,
    g.full_name AS guest_name,
    d.code AS discount_code,
    COALESCE((
      SELECT SUM(bp.rate_per_night * bp.nights)
      FROM booking_properties bp WHERE bp.booking_id = b.id
    ), 0) AS total_accommodation,
    COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0) AS total_addons,
    COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS total_menu_items,
    COALESCE((
      SELECT SUM(bp.rate_per_night * bp.nights)
      FROM booking_properties bp WHERE bp.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(ba.subtotal) FROM booking_addons ba WHERE ba.booking_id = b.id
    ), 0)
    + COALESCE((
      SELECT SUM(o.total_amount) FROM orders o
      WHERE o.booking_id = b.id AND o.status IN ('open', 'served', 'billed')
    ), 0) AS subtotal_before_discount
  FROM bookings b
  LEFT JOIN guests g ON g.id = b.guest_id
  LEFT JOIN discounts d ON d.id = b.discount_id
  WHERE b.status != 'cancelled'
    AND b.payment_status != 'cancelled'
) base;

DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid, date, date);
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid, date);
DROP FUNCTION IF EXISTS public.get_dashboard_kpis(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(
  p_today date DEFAULT CURRENT_DATE,
  p_month_start date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $function$
  SELECT jsonb_build_object(
    'arrivalsToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id()
        AND b.status != 'cancelled'
        AND b.payment_status != 'cancelled'
        AND b.check_in_date = p_today
    ),
    'departuresToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id()
        AND b.status != 'cancelled'
        AND b.payment_status != 'cancelled'
        AND b.check_out_date = p_today
    ),
    'inHouse', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status = 'checked_in'
    ),
    'monthRevenue', (
      SELECT COALESCE(SUM(f.amount), 0) FROM finances f
      LEFT JOIN bookings b ON b.id = f.booking_id
      WHERE f.tenant_id = auth_tenant_id()
        AND f.type = 'income'
        AND f.status = 'approved'
        AND f.transaction_date >= p_month_start
        AND f.transaction_date <= p_today
        AND (f.booking_id IS NULL OR (
          b.status IS DISTINCT FROM 'cancelled'
          AND b.payment_status IS DISTINCT FROM 'cancelled'
        ))
    )
  );
$function$;
