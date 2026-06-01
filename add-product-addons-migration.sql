-- Product Add-ons Table
CREATE TABLE IF NOT EXISTS product_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  extra_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_product_addons_product_id ON product_addons(product_id);
CREATE INDEX IF NOT EXISTS idx_product_addons_active ON product_addons(product_id, is_active);

-- RLS Policies
ALTER TABLE product_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_addons_select" ON product_addons FOR SELECT USING (true);
CREATE POLICY "product_addons_insert" ON product_addons FOR INSERT WITH CHECK (true);
CREATE POLICY "product_addons_update" ON product_addons FOR UPDATE USING (true);
CREATE POLICY "product_addons_delete" ON product_addons FOR DELETE USING (true);
