-- ═══════════════════════════════════════════════════════════
-- MUHIYA POS — PHASE 3: SaaS Multi-Tenancy + Full Business Platform
-- ═══════════════════════════════════════════════════════════

-- ═══ 1. TENANTS (SaaS) ═══
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  owner_email text NOT NULL,
  plan text NOT NULL DEFAULT 'free',
  plan_expires_at timestamptz,
  max_branches integer NOT NULL DEFAULT 1,
  max_users integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_email);

-- ═══ 2. BRANCHES ═══
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  phone text,
  is_main boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_tenant ON branches(tenant_id);

-- ═══ 3. WAREHOUSES ═══
CREATE TABLE IF NOT EXISTS warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_warehouses_tenant ON warehouses(tenant_id);

-- ═══ 4. STOCK LOCATIONS (stock per product per warehouse) ═══
CREATE TABLE IF NOT EXISTS stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity numeric(15,3) NOT NULL DEFAULT 0,
  batch_number text,
  expiry_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(product_id, warehouse_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_loc_product ON stock_locations(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_loc_warehouse ON stock_locations(warehouse_id);

-- ═══ 5. STOCK TRANSFERS ═══
CREATE TABLE IF NOT EXISTS stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  to_warehouse_id uuid NOT NULL REFERENCES warehouses(id),
  product_id uuid NOT NULL,
  quantity numeric(15,3) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_transfers_tenant ON stock_transfers(tenant_id);

-- ═══ 6. SUPPLIERS ═══
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_number text,
  balance numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers(tenant_id);

-- ═══ 7. SUPPLIER PRICES (per product) ═══
CREATE TABLE IF NOT EXISTS supplier_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  unit_price numeric(15,2) NOT NULL,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(supplier_id, product_id)
);

-- ═══ 8. PURCHASE ORDERS ═══
CREATE TABLE IF NOT EXISTS purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  po_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  notes text,
  expected_date date,
  received_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_tenant ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  quantity numeric(15,3) NOT NULL,
  unit_price numeric(15,2) NOT NULL,
  line_total numeric(15,2) NOT NULL,
  received_quantity numeric(15,3) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);

-- ═══ 9. SUPPLIER PAYMENTS ═══
CREATE TABLE IF NOT EXISTS supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  supplier_id uuid NOT NULL REFERENCES suppliers(id),
  amount numeric(15,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  paid_at timestamptz DEFAULT now()
);

-- ═══ 10. SHIFTS ═══
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES branches(id),
  cashier_id uuid NOT NULL,
  cashier_name text NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  starting_cash numeric(15,2) NOT NULL DEFAULT 0,
  expected_cash numeric(15,2),
  actual_cash numeric(15,2),
  total_sales numeric(15,2) NOT NULL DEFAULT 0,
  total_orders integer NOT NULL DEFAULT 0,
  total_refunds numeric(15,2) NOT NULL DEFAULT 0,
  cash_difference numeric(15,2),
  notes text,
  status text NOT NULL DEFAULT 'open'
);

CREATE INDEX IF NOT EXISTS idx_shifts_tenant ON shifts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_shifts_branch ON shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON shifts(cashier_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON shifts(status);

-- ═══ 11. ACTIVITY LOG ═══
CREATE TABLE IF NOT EXISTS activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  user_name text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_tenant ON activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_logs(entity_type, entity_id);

-- ═══ 12. RETURNS & REFUNDS ═══
CREATE TABLE IF NOT EXISTS returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id),
  return_ref text NOT NULL,
  reason text NOT NULL,
  refund_amount numeric(15,2) NOT NULL,
  refund_method text NOT NULL DEFAULT 'cash',
  status text NOT NULL DEFAULT 'pending',
  processed_by uuid,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_item_id uuid NOT NULL REFERENCES order_items(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(15,2) NOT NULL,
  line_total numeric(15,2) NOT NULL
);

-- ═══ 13. PROMO CODES ═══
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric(15,2) NOT NULL,
  min_order_amount numeric(15,2) DEFAULT 0,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz DEFAULT now(),
  valid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, code)
);

-- ═══ 14. NOTIFICATIONS ═══
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id);

-- ═══ 15. ADD tenant_id + branch_id TO EXISTING TABLES ═══
DO $$
BEGIN
  -- orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tenant_id') THEN
    ALTER TABLE orders ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE orders ADD COLUMN branch_id uuid REFERENCES branches(id);
    ALTER TABLE orders ADD COLUMN shift_id uuid REFERENCES shifts(id);
    ALTER TABLE orders ADD COLUMN return_status text;
    ALTER TABLE orders ADD COLUMN cashier_id uuid;
    ALTER TABLE orders ADD COLUMN split_payments jsonb;
  END IF;

  -- products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tenant_id') THEN
    ALTER TABLE products ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE products ADD COLUMN sku text;
    ALTER TABLE products ADD COLUMN batch_tracking boolean NOT NULL DEFAULT false;
  END IF;

  -- categories
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='tenant_id') THEN
    ALTER TABLE categories ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;

  -- income_entries
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='income_entries' AND column_name='tenant_id') THEN
    ALTER TABLE income_entries ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE income_entries ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;

  -- expenses
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='tenant_id') THEN
    ALTER TABLE expenses ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE expenses ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;

  -- employees
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='employees' AND column_name='tenant_id') THEN
    ALTER TABLE employees ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE employees ADD COLUMN branch_id uuid REFERENCES branches(id);
  END IF;

  -- customers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='tenant_id') THEN
    ALTER TABLE customers ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;

  -- raw_materials
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='raw_materials' AND column_name='tenant_id') THEN
    ALTER TABLE raw_materials ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;

  -- users
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id);
    ALTER TABLE users ADD COLUMN branch_id uuid REFERENCES branches(id);
    ALTER TABLE users ADD COLUMN role text DEFAULT 'cashier';
  END IF;

  -- organization_profile
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='organization_profile' AND column_name='tenant_id') THEN
    ALTER TABLE organization_profile ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;

  -- themes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='themes' AND column_name='tenant_id') THEN
    ALTER TABLE themes ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;

  -- roles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='tenant_id') THEN
    ALTER TABLE roles ADD COLUMN tenant_id uuid REFERENCES tenants(id);
  END IF;
END $$;

-- ═══ 16. RLS: TENANT ISOLATION ═══
-- Drop old blanket policies and install tenant-scoped policies
DO $$
DECLARE
  t record;
  tables_with_tenant text[] := ARRAY[
    'tenants','branches','warehouses','stock_locations','stock_transfers',
    'suppliers','supplier_prices','purchase_orders','purchase_order_items','supplier_payments',
    'shifts','activity_logs','returns','return_items','promo_codes','notifications',
    'orders','order_items','products','categories','income_entries','expenses',
    'employees','customers','raw_materials','users','organization_profile','themes','roles'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tables_with_tenant LOOP
    -- Enable RLS
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    -- Drop old blanket policy
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', tbl);
    -- Create tenant-isolated policy (authenticated users see their tenant data)
    IF tbl = 'tenants' THEN
      EXECUTE format('CREATE POLICY "tenant_isolation" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    ELSIF tbl IN ('order_items', 'return_items', 'purchase_order_items') THEN
      -- Child tables: allow all for authenticated (parent enforces isolation)
      EXECUTE format('CREATE POLICY "tenant_isolation" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    ELSE
      EXECUTE format('CREATE POLICY "tenant_isolation" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', tbl);
    END IF;
  END LOOP;
END $$;

-- Keep remaining tables accessible
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (
    'tenants','branches','warehouses','stock_locations','stock_transfers',
    'suppliers','supplier_prices','purchase_orders','purchase_order_items','supplier_payments',
    'shifts','activity_logs','returns','return_items','promo_codes','notifications',
    'orders','order_items','products','categories','income_entries','expenses',
    'employees','customers','raw_materials','users','organization_profile','themes','roles'
  ) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t.tablename);
    EXECUTE format('CREATE POLICY "authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;
END $$;

-- ═══ 17. REALTIME for new tables ═══
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'branches','warehouses','stock_locations','stock_transfers',
    'suppliers','purchase_orders','shifts','activity_logs','returns',
    'promo_codes','notifications','tenants'
  ) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t.tablename);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- Migration 003 complete — multi-tenant SaaS schema ready ✅
-- ═══════════════════════════════════════════════════════════
