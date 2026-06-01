-- ═══════════════════════════════════════════════════════════
-- MUHIYA ERP — FIX EXISTING SCHEMA (مهيأ)
-- يصلح الجداول الموجودة ويضيف الجديد
-- ═══════════════════════════════════════════════════════════

-- ═══ UUID Function fix ═══
CREATE OR REPLACE FUNCTION public.uuid_generate_v4() RETURNS uuid AS $$
  SELECT gen_random_uuid();
$$ LANGUAGE sql;

-- ═══════════════════════════════════════════════════════════
-- 1. التصنيفات — لو موجودة بالفعل نضيف أعمدة ناقصة
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  parent_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text,
  color_hex text DEFAULT '#10b981',
  sort_order integer NOT NULL DEFAULT 0,
  applies_to text NOT NULL DEFAULT 'all',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='image_url') THEN
    ALTER TABLE categories ADD COLUMN image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='deleted_at') THEN
    ALTER TABLE categories ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='color_hex') THEN
    ALTER TABLE categories ADD COLUMN color_hex text DEFAULT '#10b981';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sort_order') THEN
    ALTER TABLE categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='applies_to') THEN
    ALTER TABLE categories ADD COLUMN applies_to text NOT NULL DEFAULT 'all';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='parent_category_id') THEN
    ALTER TABLE categories ADD COLUMN parent_category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='slug') THEN
    ALTER TABLE categories ADD COLUMN slug text DEFAULT '';
    UPDATE categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug = '';
    ALTER TABLE categories ALTER COLUMN slug SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

-- ═══════════════════════════════════════════════════════════
-- 2. المنتجات — إضافة أعمدة جديدة للجدول الموجود
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  -- إضافة category_id لو مش موجود
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE products ADD COLUMN category_id uuid REFERENCES categories(id);
    -- ربط التصنيفات النصية بالأUUID
    UPDATE products p SET category_id = c.id FROM categories c WHERE c.name = p.category AND p.category_id IS NULL;
  END IF;
  -- إضافة أعمدة جديدة
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='track_stock') THEN
    ALTER TABLE products ADD COLUMN track_stock boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='primary_image_url') THEN
    ALTER TABLE products ADD COLUMN primary_image_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='description') THEN
    ALTER TABLE products ADD COLUMN description text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') THEN
    ALTER TABLE products ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='updated_at') THEN
    ALTER TABLE products ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  -- التأكد إن stock nullable
  ALTER TABLE products ALTER COLUMN stock DROP NOT NULL;
  ALTER TABLE products ALTER COLUMN stock SET DEFAULT NULL;
  -- التأكد إن low_stock_threshold nullable
  ALTER TABLE products ALTER COLUMN low_stock_threshold DROP NOT NULL;
  ALTER TABLE products ALTER COLUMN low_stock_threshold SET DEFAULT NULL;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 3. صور المنتجات
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS product_images (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid,
  image_url text NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);

-- ═══════════════════════════════════════════════════════════
-- 4. المواد الخام
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS raw_materials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  unit text NOT NULL,
  current_stock numeric(15,3) NOT NULL DEFAULT 0,
  min_stock_level numeric(15,3) DEFAULT 0,
  cost_per_unit numeric(15,2) DEFAULT 0,
  supplier_name text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON raw_materials(name);

-- ═══════════════════════════════════════════════════════════
-- 5. الطلبات (Orders)
-- ═══════════════════════════════════════════════════════════

-- تحديث جدول transactions القديم لإضافة أعمدة جديدة
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='customer_id') THEN
    ALTER TABLE transactions ADD COLUMN customer_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='split_payments') THEN
    ALTER TABLE transactions ADD COLUMN split_payments jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='deleted_at') THEN
    ALTER TABLE transactions ADD COLUMN deleted_at timestamptz;
  END IF;
END $$;

-- إنشاء جدول orders الجديد
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_ref text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending',
  type text NOT NULL DEFAULT 'sale',
  customer_name text,
  customer_phone text,
  subtotal numeric(15,2) NOT NULL DEFAULT 0,
  tax_amount numeric(15,2) NOT NULL DEFAULT 0,
  discount_amount numeric(15,2) NOT NULL DEFAULT 0,
  total numeric(15,2) NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  cashier_name text,
  notes text,
  kitchen_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_ref ON orders(order_ref);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(15,2) NOT NULL,
  line_total numeric(15,2) NOT NULL,
  notes text,
  kitchen_status text
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ═══════════════════════════════════════════════════════════
-- 6. الدخل
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS income_entries (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source text NOT NULL,
  amount numeric(15,2) NOT NULL,
  description text,
  income_date date DEFAULT CURRENT_DATE,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_pattern text,
  recurring_next_date date,
  recurring_end_date date,
  order_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_income_date ON income_entries(income_date);
CREATE INDEX IF NOT EXISTS idx_income_source ON income_entries(source);

-- ═══════════════════════════════════════════════════════════
-- 7. المصروفات
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='sub_category') THEN
    ALTER TABLE expenses ADD COLUMN sub_category text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='is_recurring') THEN
    ALTER TABLE expenses ADD COLUMN is_recurring boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='recurring_pattern') THEN
    ALTER TABLE expenses ADD COLUMN recurring_pattern text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='recurring_next_date') THEN
    ALTER TABLE expenses ADD COLUMN recurring_next_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='recurring_end_date') THEN
    ALTER TABLE expenses ADD COLUMN recurring_end_date date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='employee_id') THEN
    ALTER TABLE expenses ADD COLUMN employee_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='attachment_url') THEN
    ALTER TABLE expenses ADD COLUMN attachment_url text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='status') THEN
    ALTER TABLE expenses ADD COLUMN status text NOT NULL DEFAULT 'draft';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='approved_by') THEN
    ALTER TABLE expenses ADD COLUMN approved_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='approved_at') THEN
    ALTER TABLE expenses ADD COLUMN approved_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='paid_at') THEN
    ALTER TABLE expenses ADD COLUMN paid_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='created_by') THEN
    ALTER TABLE expenses ADD COLUMN created_by text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='updated_at') THEN
    ALTER TABLE expenses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='deleted_at') THEN
    ALTER TABLE expenses ADD COLUMN deleted_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='wallet_transaction_id') THEN
    ALTER TABLE expenses ADD COLUMN wallet_transaction_id uuid;
  END IF;
  -- إضافة category_id لو مش موجود
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='expenses' AND column_name='category_id') THEN
    ALTER TABLE expenses ADD COLUMN category_id uuid REFERENCES categories(id);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 8. الموظفين
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  role text NOT NULL,
  phone text,
  email text,
  salary numeric(15,2) DEFAULT 0,
  salary_day integer DEFAULT 1,
  hire_date date,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 9. العملاء
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  total_purchases numeric(15,2) NOT NULL DEFAULT 0,
  last_visit date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ═══════════════════════════════════════════════════════════
-- 10. إعدادات النظام
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════
-- 11. المستخدمين والأدوار
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  UNIQUE(role_id, module)
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role_id)
);

-- ═══════════════════════════════════════════════════════════
-- 12. بيانات المؤسسة
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS organization_profile (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL DEFAULT 'مهيأ',
  logo_url text,
  phone text,
  email text,
  address text,
  tax_number text,
  currency text NOT NULL DEFAULT 'ج.م',
  fiscal_year_start text NOT NULL DEFAULT '01-01',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organization_profile LIMIT 1) THEN
    INSERT INTO organization_profile (name, currency) VALUES ('مهيأ', 'ج.م');
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 13. السمات
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'themes') THEN
    CREATE TABLE themes (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      name text NOT NULL,
      primary_color text NOT NULL DEFAULT '#10b981',
      secondary_color text NOT NULL DEFAULT '#059669',
      accent_color text NOT NULL DEFAULT '#f59e0b',
      danger_color text NOT NULL DEFAULT '#ef4444',
      success_color text NOT NULL DEFAULT '#10b981',
      background text NOT NULL DEFAULT '#09090b',
      surface text NOT NULL DEFAULT '#18181b',
      sidebar_bg text NOT NULL DEFAULT '#0c0c0e',
      text_color text NOT NULL DEFAULT '#f4f4f5',
      corner_radius integer NOT NULL DEFAULT 12,
      is_dark boolean NOT NULL DEFAULT true,
      is_default boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
  ELSE
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='themes' AND column_name='is_active') THEN
      ALTER TABLE themes ADD COLUMN is_active boolean NOT NULL DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='themes' AND column_name='primary_color') THEN
      ALTER TABLE themes ADD COLUMN primary_color text NOT NULL DEFAULT '#10b981';
      ALTER TABLE themes ADD COLUMN secondary_color text NOT NULL DEFAULT '#059669';
      ALTER TABLE themes ADD COLUMN accent_color text NOT NULL DEFAULT '#f59e0b';
      ALTER TABLE themes ADD COLUMN danger_color text NOT NULL DEFAULT '#ef4444';
      ALTER TABLE themes ADD COLUMN success_color text NOT NULL DEFAULT '#10b981';
      ALTER TABLE themes ADD COLUMN background text NOT NULL DEFAULT '#09090b';
      ALTER TABLE themes ADD COLUMN surface text NOT NULL DEFAULT '#18181b';
      ALTER TABLE themes ADD COLUMN sidebar_bg text NOT NULL DEFAULT '#0c0c0e';
      ALTER TABLE themes ADD COLUMN text_color text NOT NULL DEFAULT '#f4f4f5';
      ALTER TABLE themes ADD COLUMN corner_radius integer NOT NULL DEFAULT 12;
      ALTER TABLE themes ADD COLUMN is_dark boolean NOT NULL DEFAULT true;
      ALTER TABLE themes ADD COLUMN is_default boolean NOT NULL DEFAULT false;
    END IF;
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 14. الضرائب وطرق الدفع
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tax_rates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  percentage numeric(5,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tax_rates WHERE name = 'ضريبة القيمة المضافة') THEN
    INSERT INTO tax_rates (name, percentage, is_active) VALUES ('ضريبة القيمة المضافة', 14, true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payment_methods (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM payment_methods WHERE name = 'كاش') THEN
    INSERT INTO payment_methods (name, is_active, sort_order) VALUES ('كاش', true, 1);
    INSERT INTO payment_methods (name, is_active, sort_order) VALUES ('فيزا', true, 2);
    INSERT INTO payment_methods (name, is_active, sort_order) VALUES ('تحويل بنكي', true, 3);
    INSERT INTO payment_methods (name, is_active, sort_order) VALUES ('محفظة', true, 4);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 15. أدوار افتراضية
-- ═══════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'مدير النظام') THEN
    INSERT INTO roles (name, description, is_system) VALUES ('مدير النظام', 'وصول كامل', true);
    INSERT INTO roles (name, description, is_system) VALUES ('كاشير', 'نقطة بيع وطلبات', true);
    INSERT INTO roles (name, description, is_system) VALUES ('مطبخ', 'عرض المطبخ فقط', true);
    INSERT INTO roles (name, description, is_system) VALUES ('مشرف', 'عرض وتقارير', true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 16. فهارس
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_orders_kitchen ON orders(kitchen_status);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);

-- ═══════════════════════════════════════════════════════════
-- 17. RLS
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "authenticated_all" ON %I', t.tablename);
    EXECUTE format('CREATE POLICY "authenticated_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t.tablename);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- 18. Realtime
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
    'orders', 'order_items', 'income_entries', 'expenses', 'products', 'product_images',
    'categories', 'raw_materials', 'employees', 'customers', 'system_settings',
    'themes', 'organization_profile', 'users', 'user_roles'
  ) LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t.tablename);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════
-- تم بحمد الله — نظام مهيأ جاهز ✅
-- ═══════════════════════════════════════════════════════════
