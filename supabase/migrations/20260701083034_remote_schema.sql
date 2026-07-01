


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."booking_status" AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'completed'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."finance_category" AS ENUM (
    'room_revenue',
    'fb_revenue',
    'addon_revenue',
    'operational_expense',
    'salary',
    'maintenance',
    'marketing',
    'other'
);


ALTER TYPE "public"."finance_category" OWNER TO "postgres";


CREATE TYPE "public"."finance_type" AS ENUM (
    'income',
    'expense'
);


ALTER TYPE "public"."finance_type" OWNER TO "postgres";


CREATE TYPE "public"."menu_category" AS ENUM (
    'food',
    'beverage',
    'snack',
    'dessert',
    'partner_kitchen',
    'other'
);


ALTER TYPE "public"."menu_category" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'pending',
    'preparing',
    'served',
    'billed'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'owner',
    'admin',
    'staff',
    'manager',
    'receptionist',
    'housekeeping'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;


ALTER FUNCTION "public"."auth_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auth_tenant_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'property_id', '')::uuid
  );
$$;


ALTER FUNCTION "public"."auth_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_booking_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_str text;
    next_seq int;
BEGIN
    -- Format current date as DDMMYY (e.g., 090626)
    date_str := to_char(CURRENT_DATE, 'DDMMYY');
    
    -- Count how many bookings were already created today to find the next sequential index
    SELECT COALESCE(COUNT(*), 0) + 1 
    INTO next_seq
    FROM public.bookings
    WHERE created_at::date = CURRENT_DATE;
    
    -- Combine them into the target format: RES-DDMMYY-XXXX (padded to 4 digits)
    NEW.display_id := 'RES-' || date_str || '-' || lpad(next_seq::text, 4, '0');
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_booking_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_expense_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_str text;
    current_sequence int;
BEGIN
    -- Only run this logic if the transaction type is an 'expense'
    IF NEW.type = 'expense' THEN
        -- 1. Get the exact real-time date string in DDMMYY format based on local time
        date_str := to_char(CURRENT_TIMESTAMP, 'DDMMYY');
        
        -- 2. Count expenses created TODAY in real world time (matching the same DDMMYY date string)
        SELECT COALESCE(COUNT(*), 0) + 1 
        INTO current_sequence
        FROM public.finances
        WHERE type = 'expense'
          AND to_char(created_at, 'DDMMYY') = date_str;
        
        -- 3. Combine them together, padding the sequence number to 3 digits (e.g., 001)
        NEW.display_id := 'EXP-' || date_str || '-' || lpad(current_sequence::text, 3, '0');
    ELSE
        -- If it's income, leave display_id as NULL
        NEW.display_id := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_expense_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_guest_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_str text;
    next_seq int;
BEGIN
    date_str := to_char(CURRENT_DATE, 'DDMMYY');
    
    SELECT COALESCE(COUNT(*), 0) + 1 
    INTO next_seq
    FROM public.guests
    WHERE created_at::date = CURRENT_DATE;
    
    NEW.display_id := 'GU-' || date_str || '-' || lpad(next_seq::text, 4, '0');
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_guest_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_villa_display_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    date_str text;
    next_seq int;
BEGIN
    -- Extract current timestamp as DDMMYY format
    date_str := to_char(CURRENT_DATE, 'DDMMYY');
    
    -- Count how many villas were registered today to find the next increment
    SELECT COALESCE(COUNT(*), 0) + 1 
    INTO next_seq
    FROM public.villas
    WHERE created_at::date = CURRENT_DATE;
    
    -- Format and apply string to incoming record row
    NEW.display_id := 'VILLA-' || date_str || '-' || lpad(next_seq::text, 4, '0');
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."generate_villa_display_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_dashboard_kpis"("p_today" "date" DEFAULT CURRENT_DATE, "p_month_start" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date") RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT jsonb_build_object(
    'arrivalsToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status != 'cancelled' AND b.check_in_date = p_today
    ),
    'departuresToday', (
      SELECT count(*)::int FROM bookings b
      WHERE b.tenant_id = auth_tenant_id() AND b.status != 'cancelled' AND b.check_out_date = p_today
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
        AND (f.booking_id IS NULL OR b.status IS DISTINCT FROM 'cancelled')
    )
  );
$$;


ALTER FUNCTION "public"."get_dashboard_kpis"("p_today" "date", "p_month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_addons_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_addons_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_booking_properties_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_booking_properties_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_order_items_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.orders WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_order_items_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_payment_proofs_tenant_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  SELECT tenant_id INTO NEW.tenant_id FROM public.bookings WHERE id = NEW.booking_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_payment_proofs_tenant_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_booking_payment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_total_verified numeric;
  v_booking_total numeric;
  v_booking_id uuid;
BEGIN
  v_booking_id := COALESCE(NEW.booking_id, OLD.booking_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_verified
  FROM public.payment_proofs
  WHERE booking_id = v_booking_id AND status = 'verified';

  SELECT total_price INTO v_booking_total
  FROM public.bookings
  WHERE id = v_booking_id;

  UPDATE public.bookings
  SET amount_paid = v_total_verified,
      payment_status = CASE
        WHEN v_total_verified <= 0 THEN 'pending'
        WHEN v_total_verified >= v_booking_total THEN 'complete'
        ELSE 'partial'
      END
  WHERE id = v_booking_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_booking_payment_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "base_breakfast" smallint DEFAULT '0'::smallint NOT NULL,
    "price" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "is_per_night" boolean DEFAULT false NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "chk_addon_price" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "action" "text" NOT NULL,
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "old_values" "jsonb",
    "new_values" "jsonb",
    "ip_address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."audit_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_addons" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "addon_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "unit_price" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "subtotal" numeric(10,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "chk_addon_quantity" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."booking_addons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."booking_properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "rate_per_night" numeric(10,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "nights" integer NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "booking_villas_nights_check" CHECK (("nights" > 0))
);


ALTER TABLE "public"."booking_properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_id" "uuid",
    "check_in_date" "date" NOT NULL,
    "check_out_date" "date" NOT NULL,
    "total_guests" integer NOT NULL,
    "total_price" numeric(10,2) NOT NULL,
    "status" "public"."booking_status" DEFAULT 'pending'::"public"."booking_status" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "amount_paid" numeric(10,2) DEFAULT 0.00,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "display_id" "text",
    "discount_id" "uuid",
    "discount_amount" numeric DEFAULT 0.00,
    "tenant_id" "uuid" NOT NULL,
    "manage_token_hash" "text",
    CONSTRAINT "bookings_discount_amount_check" CHECK (("discount_amount" >= (0)::numeric)),
    CONSTRAINT "bookings_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'partial'::"text", 'complete'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "check_payment_status" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'partial'::"text", 'complete'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_dates" CHECK (("check_out_date" > "check_in_date"))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."discounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "value" numeric NOT NULL,
    "scope" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "application_rule" "text" DEFAULT 'all_items'::"text" NOT NULL,
    "description" "text",
    "max_discount_amount" numeric,
    "booking_start_date" "date",
    "booking_end_date" "date",
    "stay_start_date" "date",
    "stay_end_date" "date",
    "property_ids" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "min_booking_amount" numeric,
    "min_nights" integer,
    "total_usage_limit" integer,
    "per_guest_limit" integer,
    "usage_count" integer DEFAULT 0 NOT NULL,
    "stackable" boolean DEFAULT false NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "discounts_application_rule_check" CHECK (("application_rule" = ANY (ARRAY['all_items'::"text", 'highest_priced_single'::"text", 'lowest_priced_single'::"text"]))),
    CONSTRAINT "discounts_scope_check" CHECK (("scope" = ANY (ARRAY['global'::"text", 'all_items'::"text", 'properties'::"text", 'addons'::"text", 'menu'::"text"]))),
    CONSTRAINT "discounts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'active'::"text", 'archived'::"text"]))),
    CONSTRAINT "discounts_type_check" CHECK (("type" = ANY (ARRAY['percentage'::"text", 'fixed'::"text"]))),
    CONSTRAINT "discounts_value_check" CHECK (("value" >= (0)::numeric))
);


ALTER TABLE "public"."discounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."guests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text",
    "phone_number" "text" NOT NULL,
    "id_card_number" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "display_id" "text",
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."guests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "staff_note" "text",
    "total_amount" numeric(10,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'pending'::"public"."order_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "orders_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'served'::"text", 'billed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."booking_income_summary" WITH ("security_invoker"='true') AS
 SELECT "booking_id",
    "tenant_id",
    "display_id",
    "check_in_date",
    "check_out_date",
    "payment_status",
    "booking_status",
    "amount_paid",
    "total_price",
    "discount_amount",
    "created_at",
    "guest_name",
    "discount_code",
    "total_accommodation",
    "total_addons",
    "total_menu_items",
    "subtotal_before_discount",
    GREATEST(("subtotal_before_discount" - COALESCE("discount_amount", (0)::numeric)), (0)::numeric) AS "total",
    GREATEST((GREATEST(("subtotal_before_discount" - COALESCE("discount_amount", (0)::numeric)), (0)::numeric) - COALESCE("amount_paid", (0)::numeric)), (0)::numeric) AS "balance_due"
   FROM ( SELECT "b"."id" AS "booking_id",
            "b"."tenant_id",
            "b"."display_id",
            "b"."check_in_date",
            "b"."check_out_date",
            "b"."payment_status",
            "b"."status" AS "booking_status",
            "b"."amount_paid",
            "b"."total_price",
            "b"."discount_amount",
            "b"."created_at",
            "g"."full_name" AS "guest_name",
            "d"."code" AS "discount_code",
            COALESCE(( SELECT "sum"(("bp"."rate_per_night" * ("bp"."nights")::numeric)) AS "sum"
                   FROM "public"."booking_properties" "bp"
                  WHERE ("bp"."booking_id" = "b"."id")), (0)::numeric) AS "total_accommodation",
            COALESCE(( SELECT "sum"("ba"."subtotal") AS "sum"
                   FROM "public"."booking_addons" "ba"
                  WHERE ("ba"."booking_id" = "b"."id")), (0)::numeric) AS "total_addons",
            COALESCE(( SELECT "sum"("o"."total_amount") AS "sum"
                   FROM "public"."orders" "o"
                  WHERE (("o"."booking_id" = "b"."id") AND ("o"."status" = ANY (ARRAY['open'::"text", 'served'::"text", 'billed'::"text"])))), (0)::numeric) AS "total_menu_items",
            ((COALESCE(( SELECT "sum"(("bp"."rate_per_night" * ("bp"."nights")::numeric)) AS "sum"
                   FROM "public"."booking_properties" "bp"
                  WHERE ("bp"."booking_id" = "b"."id")), (0)::numeric) + COALESCE(( SELECT "sum"("ba"."subtotal") AS "sum"
                   FROM "public"."booking_addons" "ba"
                  WHERE ("ba"."booking_id" = "b"."id")), (0)::numeric)) + COALESCE(( SELECT "sum"("o"."total_amount") AS "sum"
                   FROM "public"."orders" "o"
                  WHERE (("o"."booking_id" = "b"."id") AND ("o"."status" = ANY (ARRAY['open'::"text", 'served'::"text", 'billed'::"text"])))), (0)::numeric)) AS "subtotal_before_discount"
           FROM (("public"."bookings" "b"
             LEFT JOIN "public"."guests" "g" ON (("g"."id" = "b"."guest_id")))
             LEFT JOIN "public"."discounts" "d" ON (("d"."id" = "b"."discount_id")))
          WHERE ("b"."status" <> 'cancelled'::"public"."booking_status")) "base";


ALTER VIEW "public"."booking_income_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid",
    "type" "text" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category" "text" NOT NULL,
    "transaction_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "order_id" "uuid",
    "status" "text" DEFAULT 'approved'::"text" NOT NULL,
    "display_id" "text",
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "finances_category_check" CHECK (((("type" = 'income'::"text") AND ("category" = ANY (ARRAY['room_revenue'::"text", 'order_revenue'::"text", 'addon_revenue'::"text", 'other_income'::"text"]))) OR (("type" = 'expense'::"text") AND ("category" = ANY (ARRAY['operational'::"text", 'f&b_cost'::"text", 'maintenance'::"text", 'marketing'::"text", 'salary'::"text", 'other_expense'::"text"]))))),
    CONSTRAINT "finances_status_check" CHECK (((("type" = 'income'::"text") AND ("status" = 'approved'::"text")) OR (("type" = 'expense'::"text") AND ("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))))),
    CONSTRAINT "finances_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."finances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."menu_category" DEFAULT 'food'::"public"."menu_category" NOT NULL,
    "price" numeric(10,2) NOT NULL,
    "is_available" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "menu_item_id" "uuid",
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(10,2) NOT NULL,
    "subtotal" numeric(10,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "unit_cost" numeric(10,2) DEFAULT 0.00 NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_proofs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "payment_type" "text" NOT NULL,
    "amount" numeric NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "uploaded_by" "uuid" NOT NULL,
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "rejection_reason" "text",
    CONSTRAINT "payment_proofs_amount_check" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payment_proofs_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['partial'::"text", 'final'::"text"]))),
    CONSTRAINT "payment_proofs_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."payment_proofs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "pricing_holidays_date_range" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."pricing_holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."properties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "capacity" integer NOT NULL,
    "base_rate_per_night" numeric(10,2) NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "base_breakfast" smallint DEFAULT '0'::smallint NOT NULL,
    "display_id" "text",
    "weekend_rate_per_night" numeric,
    "holiday_rate_per_night" numeric,
    "tenant_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'Villa'::"text" NOT NULL,
    CONSTRAINT "chk_base_rate" CHECK (("base_rate_per_night" >= (0)::numeric)),
    CONSTRAINT "chk_breakfast" CHECK (("base_breakfast" >= 0)),
    CONSTRAINT "villas_holiday_rate_per_night_check" CHECK ((("holiday_rate_per_night" IS NULL) OR ("holiday_rate_per_night" >= (0)::numeric))),
    CONSTRAINT "villas_weekend_rate_per_night_check" CHECK ((("weekend_rate_per_night" IS NULL) OR ("weekend_rate_per_night" >= (0)::numeric)))
);


ALTER TABLE "public"."properties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_cost_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "fixed_stay_cost" numeric DEFAULT 0 NOT NULL,
    "cost_per_night" numeric DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "villa_cost_profiles_cost_per_night_check" CHECK (("cost_per_night" >= (0)::numeric)),
    CONSTRAINT "villa_cost_profiles_fixed_stay_cost_check" CHECK (("fixed_stay_cost" >= (0)::numeric))
);


ALTER TABLE "public"."property_cost_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."property_date_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "property_id" "uuid" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "reason" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "created_by" "uuid",
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "villa_date_blocks_dates_check" CHECK (("end_date" >= "start_date"))
);


ALTER TABLE "public"."property_date_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reservation_profitability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "property_id" "uuid" NOT NULL,
    "revenue" numeric DEFAULT 0 NOT NULL,
    "room_revenue" numeric DEFAULT 0 NOT NULL,
    "addon_revenue" numeric DEFAULT 0 NOT NULL,
    "fb_revenue" numeric DEFAULT 0 NOT NULL,
    "cogs" numeric DEFAULT 0 NOT NULL,
    "gross_profit" numeric DEFAULT 0 NOT NULL,
    "fixed_stay_cost_snapshot" numeric DEFAULT 0 NOT NULL,
    "cost_per_night_snapshot" numeric DEFAULT 0 NOT NULL,
    "nights" integer DEFAULT 0 NOT NULL,
    "calculated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "tenant_id" "uuid" NOT NULL
);


ALTER TABLE "public"."reservation_profitability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "timezone" "text" DEFAULT 'Asia/Jakarta'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "email_domains" "text"[] DEFAULT '{}'::"text"[] NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'staff'::"public"."user_role" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "display_id" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "users_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'deactivated'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_addons"
    ADD CONSTRAINT "booking_addons_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_properties"
    ADD CONSTRAINT "booking_properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."booking_properties"
    ADD CONSTRAINT "booking_villas_booking_id_villa_id_key" UNIQUE ("booking_id", "property_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finances"
    ADD CONSTRAINT "finances_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."finances"
    ADD CONSTRAINT "finances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_holidays"
    ADD CONSTRAINT "pricing_holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "properties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "properties_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."property_cost_profiles"
    ADD CONSTRAINT "property_cost_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."property_cost_profiles"
    ADD CONSTRAINT "property_cost_profiles_property_id_key" UNIQUE ("property_id");



ALTER TABLE ONLY "public"."property_date_blocks"
    ADD CONSTRAINT "property_date_blocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reservation_profitability"
    ADD CONSTRAINT "reservation_profitability_booking_property_key" UNIQUE ("booking_id", "property_id");



ALTER TABLE ONLY "public"."reservation_profitability"
    ADD CONSTRAINT "reservation_profitability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "villas_display_id_key" UNIQUE ("display_id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "villas_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "villas_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_audit_entity" ON "public"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_log_property_date" ON "public"."audit_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_audit_log_tenant" ON "public"."audit_log" USING "btree" ("tenant_id");



CREATE INDEX "idx_audit_log_tenant_created" ON "public"."audit_log" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_booking_addons_booking_id" ON "public"."booking_addons" USING "btree" ("booking_id");



CREATE INDEX "idx_booking_villas_booking_id" ON "public"."booking_properties" USING "btree" ("booking_id");



CREATE UNIQUE INDEX "idx_booking_villas_unique" ON "public"."booking_properties" USING "btree" ("booking_id", "property_id");



CREATE INDEX "idx_booking_villas_villa_id" ON "public"."booking_properties" USING "btree" ("property_id");



CREATE INDEX "idx_bookings_guest_id" ON "public"."bookings" USING "btree" ("guest_id");



CREATE INDEX "idx_bookings_payment" ON "public"."bookings" USING "btree" ("tenant_id", "payment_status", "status");



CREATE INDEX "idx_bookings_property_created" ON "public"."bookings" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_bookings_property_dates" ON "public"."bookings" USING "btree" ("tenant_id", "check_in_date", "check_out_date") WHERE ("status" <> 'cancelled'::"public"."booking_status");



CREATE INDEX "idx_bookings_tenant_checkin" ON "public"."bookings" USING "btree" ("tenant_id", "check_in_date");



CREATE INDEX "idx_bookings_tenant_dates" ON "public"."bookings" USING "btree" ("tenant_id", "check_in_date", "check_out_date");



CREATE INDEX "idx_bookings_tenant_guest" ON "public"."bookings" USING "btree" ("tenant_id", "guest_id");



CREATE INDEX "idx_bookings_tenant_status" ON "public"."bookings" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_discounts_code" ON "public"."discounts" USING "btree" ("code");



CREATE INDEX "idx_discounts_property" ON "public"."discounts" USING "btree" ("tenant_id");



CREATE INDEX "idx_finances_booking_id" ON "public"."finances" USING "btree" ("booking_id");



CREATE INDEX "idx_finances_property_date" ON "public"."finances" USING "btree" ("tenant_id", "type", "status", "transaction_date" DESC);



CREATE INDEX "idx_finances_tenant_booking" ON "public"."finances" USING "btree" ("tenant_id", "booking_id");



CREATE INDEX "idx_finances_tenant_category" ON "public"."finances" USING "btree" ("tenant_id", "category", "type");



CREATE INDEX "idx_finances_tenant_date" ON "public"."finances" USING "btree" ("tenant_id", "transaction_date");



CREATE INDEX "idx_guests_property" ON "public"."guests" USING "btree" ("tenant_id");



CREATE INDEX "idx_guests_tenant" ON "public"."guests" USING "btree" ("tenant_id");



CREATE INDEX "idx_guests_tenant_search" ON "public"."guests" USING "btree" ("tenant_id", "full_name", "email");



CREATE INDEX "idx_order_items_order_id" ON "public"."order_items" USING "btree" ("order_id");



CREATE INDEX "idx_order_items_tenant_order" ON "public"."order_items" USING "btree" ("tenant_id", "order_id");



CREATE INDEX "idx_orders_booking_id" ON "public"."orders" USING "btree" ("booking_id");



CREATE INDEX "idx_orders_property_booking" ON "public"."orders" USING "btree" ("tenant_id", "booking_id", "status");



CREATE INDEX "idx_orders_tenant" ON "public"."orders" USING "btree" ("tenant_id");



CREATE INDEX "idx_orders_tenant_booking" ON "public"."orders" USING "btree" ("tenant_id", "booking_id", "status");



CREATE INDEX "idx_payment_proofs_booking" ON "public"."payment_proofs" USING "btree" ("booking_id");



CREATE INDEX "idx_payment_proofs_tenant_status" ON "public"."payment_proofs" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_properties_tenant" ON "public"."properties" USING "btree" ("tenant_id", "id");



CREATE INDEX "idx_property_date_blocks_tenant_property_dates" ON "public"."property_date_blocks" USING "btree" ("tenant_id", "property_id", "start_date", "end_date");



CREATE INDEX "idx_reservation_profitability_booking" ON "public"."reservation_profitability" USING "btree" ("booking_id");



CREATE INDEX "idx_reservation_profitability_property" ON "public"."reservation_profitability" USING "btree" ("tenant_id", "calculated_at" DESC);



CREATE INDEX "idx_reservation_profitability_villa" ON "public"."reservation_profitability" USING "btree" ("property_id");



CREATE INDEX "idx_users_property" ON "public"."users" USING "btree" ("tenant_id");



CREATE INDEX "idx_villa_date_blocks_dates" ON "public"."property_date_blocks" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_villa_date_blocks_range" ON "public"."property_date_blocks" USING "btree" ("tenant_id", "property_id", "start_date", "end_date");



CREATE INDEX "idx_villa_date_blocks_villa_id" ON "public"."property_date_blocks" USING "btree" ("property_id");



CREATE INDEX "idx_villas_property" ON "public"."properties" USING "btree" ("tenant_id");



CREATE INDEX "tenants_email_domains_gin" ON "public"."tenants" USING "gin" ("email_domains");



CREATE OR REPLACE TRIGGER "tr_generate_booking_display_id" BEFORE INSERT ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."generate_booking_display_id"();



CREATE OR REPLACE TRIGGER "tr_generate_guest_display_id" BEFORE INSERT ON "public"."guests" FOR EACH ROW EXECUTE FUNCTION "public"."generate_guest_display_id"();



CREATE OR REPLACE TRIGGER "tr_set_booking_addons_tenant_id" BEFORE INSERT ON "public"."booking_addons" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_addons_tenant_id"();



CREATE OR REPLACE TRIGGER "tr_set_booking_properties_tenant_id" BEFORE INSERT ON "public"."booking_properties" FOR EACH ROW EXECUTE FUNCTION "public"."set_booking_properties_tenant_id"();



CREATE OR REPLACE TRIGGER "tr_set_order_items_tenant_id" BEFORE INSERT ON "public"."order_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_order_items_tenant_id"();



CREATE OR REPLACE TRIGGER "tr_set_payment_proofs_tenant_id" BEFORE INSERT ON "public"."payment_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."set_payment_proofs_tenant_id"();



CREATE OR REPLACE TRIGGER "tr_sync_booking_payment_status" AFTER INSERT OR DELETE OR UPDATE OF "status", "amount" ON "public"."payment_proofs" FOR EACH ROW EXECUTE FUNCTION "public"."sync_booking_payment_status"();



CREATE OR REPLACE TRIGGER "trigger_generate_expense_id" BEFORE INSERT ON "public"."finances" FOR EACH ROW EXECUTE FUNCTION "public"."generate_expense_display_id"();



ALTER TABLE ONLY "public"."addons"
    ADD CONSTRAINT "addons_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."audit_log"
    ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."booking_addons"
    ADD CONSTRAINT "booking_addons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "public"."addons"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_addons"
    ADD CONSTRAINT "booking_addons_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."booking_addons"
    ADD CONSTRAINT "booking_addons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."booking_properties"
    ADD CONSTRAINT "booking_properties_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."booking_properties"
    ADD CONSTRAINT "booking_properties_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."booking_properties"
    ADD CONSTRAINT "booking_villas_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."discounts"
    ADD CONSTRAINT "discounts_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."finances"
    ADD CONSTRAINT "finances_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."finances"
    ADD CONSTRAINT "finances_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id");



ALTER TABLE ONLY "public"."finances"
    ADD CONSTRAINT "finances_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."guests"
    ADD CONSTRAINT "guests_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."payment_proofs"
    ADD CONSTRAINT "payment_proofs_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."pricing_holidays"
    ADD CONSTRAINT "pricing_holidays_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."property_cost_profiles"
    ADD CONSTRAINT "property_cost_profiles_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."property_date_blocks"
    ADD CONSTRAINT "property_date_blocks_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_profitability"
    ADD CONSTRAINT "reservation_profitability_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reservation_profitability"
    ADD CONSTRAINT "reservation_profitability_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."reservation_profitability"
    ADD CONSTRAINT "reservation_profitability_villa_id_fkey" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."property_cost_profiles"
    ADD CONSTRAINT "villa_cost_profiles_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."property_date_blocks"
    ADD CONSTRAINT "villa_date_blocks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."property_date_blocks"
    ADD CONSTRAINT "villa_date_blocks_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."properties"
    ADD CONSTRAINT "villas_property_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE "public"."addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "addons_tenant" ON "public"."addons" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."audit_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_log_tenant_insert" ON "public"."audit_log" FOR INSERT WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "audit_log_tenant_select" ON "public"."audit_log" FOR SELECT USING (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."booking_addons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_addons_tenant" ON "public"."booking_addons" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."booking_properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "booking_properties_tenant" ON "public"."booking_properties" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_tenant_delete" ON "public"."bookings" FOR DELETE USING (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "bookings_tenant_insert" ON "public"."bookings" FOR INSERT WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "bookings_tenant_select" ON "public"."bookings" FOR SELECT USING (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "bookings_tenant_update" ON "public"."bookings" FOR UPDATE USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."discounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "discounts_tenant" ON "public"."discounts" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."finances" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "finances_tenant_delete" ON "public"."finances" FOR DELETE USING (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "finances_tenant_select" ON "public"."finances" FOR SELECT USING (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "finances_tenant_update" ON "public"."finances" FOR UPDATE USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "finances_tenant_write" ON "public"."finances" FOR INSERT WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."guests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "guests_tenant" ON "public"."guests" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "menu_items_tenant" ON "public"."menu_items" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_items_tenant" ON "public"."order_items" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_tenant" ON "public"."orders" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."payment_proofs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_proofs_tenant" ON "public"."payment_proofs" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."pricing_holidays" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pricing_holidays_tenant" ON "public"."pricing_holidays" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."properties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "properties_tenant" ON "public"."properties" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."property_cost_profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_cost_profiles_tenant" ON "public"."property_cost_profiles" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."property_date_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "property_date_blocks_tenant" ON "public"."property_date_blocks" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."reservation_profitability" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reservation_profitability_tenant" ON "public"."reservation_profitability" USING (("tenant_id" = "public"."auth_tenant_id"())) WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenants_select" ON "public"."tenants" FOR SELECT USING (("id" = "public"."auth_tenant_id"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_tenant_select" ON "public"."users" FOR SELECT USING (("tenant_id" = "public"."auth_tenant_id"()));



CREATE POLICY "users_tenant_write" ON "public"."users" FOR INSERT WITH CHECK (("tenant_id" = "public"."auth_tenant_id"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."auth_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auth_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."auth_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auth_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_booking_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_booking_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_booking_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_expense_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_expense_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_expense_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_guest_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_guest_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_guest_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_villa_display_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_villa_display_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_villa_display_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_dashboard_kpis"("p_today" "date", "p_month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_kpis"("p_today" "date", "p_month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_addons_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_addons_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_addons_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_booking_properties_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_booking_properties_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_booking_properties_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_order_items_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_order_items_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_order_items_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_payment_proofs_tenant_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_payment_proofs_tenant_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_payment_proofs_tenant_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_booking_payment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_booking_payment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_booking_payment_status"() TO "service_role";


















GRANT ALL ON TABLE "public"."addons" TO "anon";
GRANT ALL ON TABLE "public"."addons" TO "authenticated";
GRANT ALL ON TABLE "public"."addons" TO "service_role";



GRANT ALL ON TABLE "public"."audit_log" TO "anon";
GRANT ALL ON TABLE "public"."audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."booking_addons" TO "anon";
GRANT ALL ON TABLE "public"."booking_addons" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_addons" TO "service_role";



GRANT ALL ON TABLE "public"."booking_properties" TO "anon";
GRANT ALL ON TABLE "public"."booking_properties" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_properties" TO "service_role";



GRANT ALL ON TABLE "public"."bookings" TO "anon";
GRANT ALL ON TABLE "public"."bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."bookings" TO "service_role";



GRANT ALL ON TABLE "public"."discounts" TO "anon";
GRANT ALL ON TABLE "public"."discounts" TO "authenticated";
GRANT ALL ON TABLE "public"."discounts" TO "service_role";



GRANT ALL ON TABLE "public"."guests" TO "anon";
GRANT ALL ON TABLE "public"."guests" TO "authenticated";
GRANT ALL ON TABLE "public"."guests" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."booking_income_summary" TO "anon";
GRANT ALL ON TABLE "public"."booking_income_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."booking_income_summary" TO "service_role";



GRANT ALL ON TABLE "public"."finances" TO "anon";
GRANT ALL ON TABLE "public"."finances" TO "authenticated";
GRANT ALL ON TABLE "public"."finances" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."payment_proofs" TO "anon";
GRANT ALL ON TABLE "public"."payment_proofs" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_proofs" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_holidays" TO "anon";
GRANT ALL ON TABLE "public"."pricing_holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_holidays" TO "service_role";



GRANT ALL ON TABLE "public"."properties" TO "anon";
GRANT ALL ON TABLE "public"."properties" TO "authenticated";
GRANT ALL ON TABLE "public"."properties" TO "service_role";



GRANT ALL ON TABLE "public"."property_cost_profiles" TO "anon";
GRANT ALL ON TABLE "public"."property_cost_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."property_cost_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."property_date_blocks" TO "anon";
GRANT ALL ON TABLE "public"."property_date_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."property_date_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."reservation_profitability" TO "anon";
GRANT ALL ON TABLE "public"."reservation_profitability" TO "authenticated";
GRANT ALL ON TABLE "public"."reservation_profitability" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































