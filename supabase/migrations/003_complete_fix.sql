-- ═══════════════════════════════════════════════════════════
-- MUHIYA ERP — 003 COMPLETE FIX
-- جميع الجداول الناقصة + تهيئة البيانات الأولية + Cron
-- ═══════════════════════════════════════════════════════════

-- ── Enable extensions ──────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Tenants (multi-tenant SaaS base) ──────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'مهيأ',
  slug text UNIQUE NOT NULL DEFAULT 'muhiya',
  plan text NOT NULL DEFAULT 'pro',
  max_branches integer NOT NULL DEFAULT 10,
  max_users integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Add tenant_id to users if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
    ALTER TABLE users ADD COLUMN phone text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='role_name') THEN
    ALTER TABLE users ADD COLUMN role_name text DEFAULT 'كاشير';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_user_id') THEN
    ALTER TABLE users ADD COLUMN auth_user_id uuid;
  END IF;
END $$;

-- ── Branches ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL,
  address text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_branches_main ON branches(is_main);

-- ── Warehouses ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  branch_id uuid REFERENCES branches(id),
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_branch ON warehouses(branch_id);

-- ── Stock Locations ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity numeric(15,3) NOT NULL DEFAULT 0,
  UNIQUE(product_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_stock_locations_product ON stock_locations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_locations_warehouse ON stock_locations(warehouse_id);

-- ── Stock Transfers ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  product_id uuid REFERENCES products(id),
  from_warehouse_id uuid REFERENCES warehouses(id),
  to_warehouse_id uuid REFERENCES warehouses(id),
  quantity numeric(15,3) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_tenant ON stock_transfers(tenant_id);

-- ── Suppliers ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  balance numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ── Purchase Orders ────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS po_ref_seq START 1000;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  supplier_id uuid REFERENCES suppliers(id),
  supplier_name text NOT NULL DEFAULT '',
  po_ref text UNIQUE NOT NULL DEFAULT ('PO-' || LPAD(nextval('po_ref_seq')::text, 6, '0')),
  status text NOT NULL DEFAULT 'draft',
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  expected_date date,
  received_at timestamptz,
  expense_id uuid,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);

-- ── Purchase Order Items ───────────────────────────────────
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity numeric(15,3) NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL DEFAULT 0,
  line_total numeric(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_poi_order ON purchase_order_items(purchase_order_id);

-- ── Supplier Payments ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  supplier_id uuid REFERENCES suppliers(id),
  amount numeric(15,2) NOT NULL,
  method text DEFAULT 'cash',
  notes text,
  paid_at timestamptz DEFAULT now()
);

-- ── Shifts ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  branch_id uuid REFERENCES branches(id),
  cashier_id text,
  cashier_name text NOT NULL,
  starting_cash numeric(15,2) NOT NULL DEFAULT 0,
  closing_cash numeric(15,2),
  total_sales numeric(15,2) NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- Add shift/branch/tenant columns to orders
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='cashier_id') THEN
    ALTER TABLE orders ADD COLUMN cashier_id text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='shift_id') THEN
    ALTER TABLE orders ADD COLUMN shift_id uuid REFERENCES shifts(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='branch_id') THEN
    ALTER TABLE orders ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tenant_id') THEN
    ALTER TABLE orders ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='return_status') THEN
    ALTER TABLE orders ADD COLUMN return_status text;
  END IF;
END $$;

-- ── Promo Codes ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  min_order_amount numeric(15,2),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from date,
  valid_until date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(code)
);
CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

-- ── Returns ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  order_id uuid REFERENCES orders(id),
  order_ref text,
  reason text,
  refund_amount numeric(15,2) NOT NULL DEFAULT 0,
  refund_method text DEFAULT 'cash',
  items jsonb DEFAULT '[]',
  status text NOT NULL DEFAULT 'completed',
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- ── Notifications ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id),
  user_id text,
  title text NOT NULL,
  body text,
  type text DEFAULT 'info',
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

-- ── Wallet ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_balance numeric(15,2) NOT NULL DEFAULT 0,
  minimum_balance_alert numeric(15,2) NOT NULL DEFAULT 500,
  updated_at timestamptz DEFAULT now()
);

-- ── Wallet Transactions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid REFERENCES wallet(id),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  amount numeric(15,2) NOT NULL,
  balance_before numeric(15,2) NOT NULL DEFAULT 0,
  balance_after numeric(15,2) NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'manual',
  description text,
  reference_id text,
  transaction_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_date ON wallet_transactions(transaction_date DESC);

-- ── Recurring Transactions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('expense', 'income')),
  category text NOT NULL DEFAULT 'عام',
  amount numeric(15,2) NOT NULL DEFAULT 0,
  recurrence_type text NOT NULL DEFAULT 'monthly',
  recurrence_day integer NOT NULL DEFAULT 1,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_run_date date,
  last_run_date date,
  total_runs integer NOT NULL DEFAULT 0,
  total_amount numeric(15,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  auto_post boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_transactions(is_active, next_run_date);

-- ── Recurring Execution Log ────────────────────────────────
CREATE TABLE IF NOT EXISTS recurring_execution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES recurring_transactions(id) ON DELETE CASCADE,
  run_date date NOT NULL,
  amount_posted numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  notes text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recurring_log_id ON recurring_execution_log(recurring_id);

-- ── Organization Profile — extra columns ───────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='einvoice_enabled') THEN
    ALTER TABLE organization_profile ADD COLUMN einvoice_enabled boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='einvoice_client_id') THEN
    ALTER TABLE organization_profile ADD COLUMN einvoice_client_id text;
    ALTER TABLE organization_profile ADD COLUMN einvoice_client_secret text;
    ALTER TABLE organization_profile ADD COLUMN einvoice_env text DEFAULT 'preprod';
    ALTER TABLE organization_profile ADD COLUMN einvoice_reg_number text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='access_time_start') THEN
    ALTER TABLE organization_profile ADD COLUMN access_time_start text;
    ALTER TABLE organization_profile ADD COLUMN access_time_end text;
    ALTER TABLE organization_profile ADD COLUMN receipt_footer text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='currency_code') THEN
    ALTER TABLE organization_profile ADD COLUMN currency_code text DEFAULT 'EGP';
    ALTER TABLE organization_profile ADD COLUMN currency_symbol text DEFAULT 'ج.م';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='print_invoices_enabled') THEN
    ALTER TABLE organization_profile ADD COLUMN print_invoices_enabled boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='logo_storage_path') THEN
    ALTER TABLE organization_profile ADD COLUMN logo_storage_path text;
  END IF;
END $$;

-- ── RLS for all new tables ──────────────────────────────────
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'tenants', 'branches', 'warehouses', 'stock_locations', 'stock_transfers',
    'suppliers', 'purchase_orders', 'purchase_order_items', 'supplier_payments',
    'shifts', 'promo_codes', 'returns', 'notifications',
    'wallet', 'wallet_transactions', 'recurring_transactions', 'recurring_execution_log'
  ) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t.tablename);
    EXECUTE format('CREATE POLICY "authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t.tablename);
    -- Allow anon read for products sync
    IF t.tablename IN ('tenants', 'branches', 'promo_codes') THEN
      EXECUTE format('DROP POLICY IF EXISTS "anon_read" ON %I', t.tablename);
      EXECUTE format('CREATE POLICY "anon_read" ON %I FOR SELECT TO anon USING (true)', t.tablename);
    END IF;
  END LOOP;
END $$;

-- Realtime for new tables
DO $$ DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'wallet', 'wallet_transactions', 'recurring_transactions', 'recurring_execution_log',
    'orders', 'order_items', 'promo_codes', 'notifications', 'shifts'
  ) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t.tablename);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ── Seed initial data ──────────────────────────────────────

-- Initial tenant
INSERT INTO tenants (name, slug, plan, is_active)
SELECT 'مهيأ', 'muhiya', 'pro', true
WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1);

-- Initial main branch
INSERT INTO branches (tenant_id, name, address, is_main, is_active)
SELECT t.id, 'الفرع الرئيسي', 'المقر الرئيسي', true, true
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1)
LIMIT 1;

-- Initialize wallet (balance = sum of income - sum of expenses + sum of paid expenses treated as outflows)
INSERT INTO wallet (current_balance, minimum_balance_alert)
SELECT 0, 500
WHERE NOT EXISTS (SELECT 1 FROM wallet LIMIT 1);

-- Recalculate wallet balance from wallet_transactions
DO $$ DECLARE
  total_in numeric;
  total_out numeric;
  w_id uuid;
BEGIN
  SELECT id INTO w_id FROM wallet LIMIT 1;
  IF w_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_in FROM wallet_transactions WHERE direction = 'in';
    SELECT COALESCE(SUM(amount), 0) INTO total_out FROM wallet_transactions WHERE direction = 'out';
    UPDATE wallet SET current_balance = total_in - total_out, updated_at = now() WHERE id = w_id;
  END IF;
END $$;

-- Sample promo code
INSERT INTO promo_codes (code, discount_type, discount_value, max_uses, is_active)
SELECT 'WELCOME10', 'percentage', 10, 100, true
WHERE NOT EXISTS (SELECT 1 FROM promo_codes WHERE code = 'WELCOME10');

-- Link tenant_id to users (first tenant)
UPDATE users SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- ── pg_cron: daily recurring transactions ─────────────────
-- Note: pg_cron extension must be enabled in Supabase Dashboard
-- Dashboard → Database → Extensions → pg_cron
DO $$
BEGIN
  -- Remove old schedule if exists
  BEGIN
    PERFORM cron.unschedule('daily-recurring-transactions');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  -- Create schedule: run at 01:00 AM daily
  BEGIN
    PERFORM cron.schedule(
      'daily-recurring-transactions',
      '0 1 * * *',
      $$
      DO $inner$
      DECLARE r record;
      BEGIN
        FOR r IN
          SELECT * FROM recurring_transactions
          WHERE is_active = true
            AND auto_post = true
            AND (next_run_date IS NULL OR next_run_date <= CURRENT_DATE)
        LOOP
          IF r.type = 'expense' THEN
            INSERT INTO expenses (category, amount, description, expense_date, status, is_recurring, recurring_pattern, created_by)
            VALUES (r.category, r.amount, r.name, CURRENT_DATE, 'paid', true, r.recurrence_type, 'system');
          ELSE
            INSERT INTO income_entries (source, amount, description, income_date, is_recurring, recurring_pattern)
            VALUES (r.category, r.amount, r.name, CURRENT_DATE, true, r.recurrence_type);
          END IF;

          INSERT INTO recurring_execution_log (recurring_id, run_date, amount_posted, status)
          VALUES (r.id, CURRENT_DATE, r.amount, 'success');

          UPDATE recurring_transactions SET
            last_run_date = CURRENT_DATE,
            total_runs = total_runs + 1,
            total_amount = total_amount + r.amount,
            next_run_date = CASE
              WHEN r.recurrence_type = 'daily'   THEN CURRENT_DATE + INTERVAL '1 day'
              WHEN r.recurrence_type = 'weekly'  THEN CURRENT_DATE + INTERVAL '7 days'
              WHEN r.recurrence_type = 'yearly'  THEN CURRENT_DATE + INTERVAL '1 year'
              ELSE CURRENT_DATE + INTERVAL '1 month'
            END
          WHERE id = r.id;
        END LOOP;
      END;
      $inner$
      $$
    );
  EXCEPTION WHEN OTHERS THEN
    -- pg_cron not enabled, skip silently
    RAISE NOTICE 'pg_cron not available: %', SQLERRM;
  END;
END $$;

-- ── Storage bucket for logos ───────────────────────────────
-- Note: Run this in Supabase SQL editor or the bucket will be created via code
-- INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true) ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- تمت التهيئة بحمد الله ✅
-- ═══════════════════════════════════════════════════════════
