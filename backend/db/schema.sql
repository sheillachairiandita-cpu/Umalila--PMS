-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.


-- ============================================================
-- 1. CUSTOM ENUM TYPES DEFINITIONS
-- ============================================================

-- User Access Roles
CREATE TYPE user_role AS ENUM (
    'owner', 
    'admin', 
    'staff'
);

-- Complete Booking Lifecycle States
CREATE TYPE booking_status AS ENUM (
    'pending', 
    'confirmed', 
    'checked_in', 
    'checked_out', 
    'cancelled', 
    'completed'
);

-- Core Financial Cashflow Types
CREATE TYPE finance_type AS ENUM (
    'income', 
    'expense'
);

-- Financial Reporting Categories
CREATE TYPE finance_category AS ENUM (
    'room_revenue', 
    'fb_revenue', 
    'addon_revenue', 
    'salary', 
    'maintenance', 
    'marketing', 
    'other'
);

-- Food & Beverage Kitchen Workflow States
CREATE TYPE order_status AS ENUM (
    'pending', 
    'preparing', 
    'served', 
    'billed'
);

-- Menu Pricing & Inventory Categories
CREATE TYPE menu_category AS ENUM (
    'food', 
    'beverage', 
    'snack', 
    'dessert', 
    'partner_kitchen', 
    'other'
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role USER-DEFINED NOT NULL DEFAULT 'staff'::user_role,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT users_pkey PRIMARY KEY (id)
);
CREATE TABLE public.villas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  capacity integer NOT NULL,
  base_rate_per_night numeric NOT NULL CHECK (base_rate_per_night >= 0::numeric),
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  base_breakfast smallint NOT NULL DEFAULT '0'::smallint CHECK (base_breakfast >= 0),
  CONSTRAINT villas_pkey PRIMARY KEY (id)
);
CREATE TABLE public.guests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text,
  phone_number text NOT NULL,
  id_card_number text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT guests_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  villa_id uuid,
  guest_id uuid,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  total_guests integer NOT NULL,
  total_price numeric NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'pending'::booking_status,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  amount_paid numeric DEFAULT 0.00,
  CONSTRAINT bookings_pkey PRIMARY KEY (id),
  CONSTRAINT bookings_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id),
  CONSTRAINT bookings_guest_id_fkey FOREIGN KEY (guest_id) REFERENCES public.guests(id)
);
CREATE TABLE public.finances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  amount numeric NOT NULL,
  category text NOT NULL,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  description text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT finances_pkey PRIMARY KEY (id),
  CONSTRAINT finances_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_night numeric NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  base_breakfast smallint NOT NULL DEFAULT '0'::smallint,
  price numeric NOT NULL DEFAULT 0.00 CHECK (price >= 0::numeric),
  is_per_night boolean NOT NULL DEFAULT false,
  CONSTRAINT addons_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booking_addons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  addon_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  unit_price numeric NOT NULL DEFAULT 0.00,
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  CONSTRAINT booking_addons_pkey PRIMARY KEY (id),
  CONSTRAINT booking_addons_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_addons_addon_id_fkey FOREIGN KEY (addon_id) REFERENCES public.addons(id)
);
CREATE TABLE public.menu_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category USER-DEFINED NOT NULL DEFAULT 'food'::menu_category,
  price numeric NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT menu_items_pkey PRIMARY KEY (id)
);
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid,
  staff_note text,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::order_status CHECK (status = ANY (ARRAY['open'::text, 'served'::text, 'billed'::text])),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id)
);
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  menu_item_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  subtotal numeric DEFAULT ((quantity)::numeric * unit_price),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  unit_cost numeric NOT NULL DEFAULT 0.00,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id),
  CONSTRAINT order_items_menu_item_id_fkey FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);
CREATE TABLE public.booking_villas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL,
  villa_id uuid NOT NULL,
  custom_rate_per_night numeric,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT booking_villas_pkey PRIMARY KEY (id),
  CONSTRAINT booking_villas_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id),
  CONSTRAINT booking_villas_villa_id_fkey FOREIGN KEY (villa_id) REFERENCES public.villas(id)
);

