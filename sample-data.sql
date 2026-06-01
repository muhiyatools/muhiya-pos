-- ═══════════════════════════════════════════════════════════
-- MUHIYA ERP — SAMPLE DATA (بيانات تجريبية)
-- ═══════════════════════════════════════════════════════════

-- ═══ تصنيفات ═══
INSERT INTO categories (name, slug, description, color_hex, applies_to, sort_order, is_active) VALUES
  ('مشروبات', 'drinks', 'مشروبات ساخنة وباردة', '#3b82f6', 'product', 1, true),
  ('وجبات', 'meals', 'وجبات رئيسية', '#10b981', 'product', 2, true),
  ('حلويات', 'desserts', 'حلويات ومعجنات', '#f59e0b', 'product', 3, true),
  ('إيجار', 'rent', 'إيجار المحل', '#ef4444', 'expense', 4, true),
  ('فواتير', 'bills', 'فواتير كهرباء ومياه', '#8b5cf6', 'expense', 5, true),
  ('رواتب', 'salaries', 'رواتب الموظفين', '#ec4899', 'expense', 6, true),
  ('مواد خام', 'raw', 'مواد خام ومستلزمات', '#06b6d4', 'expense', 7, true),
  ('مبيعات POS', 'pos-sales', 'مبيعات من نقطة البيع', '#10b981', 'product', 8, true),
  ('دخل إضافي', 'extra-income', 'دخل إضافي', '#22c55e', 'product', 9, true)
ON CONFLICT (slug) DO NOTHING;

-- ═══ منتجات ══
INSERT INTO products (name, selling_price, category_id, stock, track_stock, low_stock_threshold, unit, is_active)
SELECT 'قهوة عربية', 15, c.id, 100, true, 20, 'كوب', true FROM categories c WHERE c.slug='drinks'
UNION ALL SELECT 'شاي أحمر', 10, c.id, 200, true, 30, 'كوب', true FROM categories c WHERE c.slug='drinks'
UNION ALL SELECT 'عصير برتقال', 20, c.id, 50, true, 10, 'كوب', true FROM categories c WHERE c.slug='drinks'
UNION ALL SELECT 'برجر لحم', 65, c.id, 0, false, 0, '', true FROM categories c WHERE c.slug='meals'
UNION ALL SELECT 'شاورما دجاج', 55, c.id, 0, false, 0, '', true FROM categories c WHERE c.slug='meals'
UNION ALL SELECT 'بيتزا مارجريتا', 70, c.id, 0, false, 0, '', true FROM categories c WHERE c.slug='meals'
UNION ALL SELECT 'كنافة نابلسية', 35, c.id, 30, true, 10, 'قطعة', true FROM categories c WHERE c.slug='desserts'
UNION ALL SELECT 'بقلاوة', 40, c.id, 25, true, 5, 'قطعة', true FROM categories c WHERE c.slug='desserts'
UNION ALL SELECT 'ساندويتش كبدة', 45, c.id, 0, false, 0, '', true FROM categories c WHERE c.slug='meals'
UNION ALL SELECT 'لبن بالشوكولاتة', 18, c.id, 80, true, 15, 'كوب', true FROM categories c WHERE c.slug='drinks'
ON CONFLICT DO NOTHING;

-- ═══ مواد خام ═══
INSERT INTO raw_materials (name, unit, current_stock, min_stock_level, cost_per_unit, supplier_name) VALUES
  ('لحم مفروم', 'كجم', 25, 10, 120, 'لحوم أحمد'),
  ('دجاج', 'كجم', 30, 15, 80, 'دواجن المحلة'),
  ('دقيق', 'كجم', 50, 20, 15, 'مطاحن النيل'),
  ('سمن بلدي', 'كجم', 10, 5, 200, 'ألبان الصعيد'),
  ('سكر', 'كجم', 40, 15, 25, 'شركة السكر'),
  ('قهوة', 'كجم', 5, 2, 300, 'محمصة النيل'),
  ('شاي', 'كجم', 8, 3, 150, 'شاي العروس'),
  ('زيت نباتي', 'لتر', 20, 10, 40, 'زيوت مصر'),
  ('طماطم', 'كجم', 15, 5, 10, 'خضار السوق'),
  ('جبن موزاريلا', 'كجم', 12, 5, 180, 'ألبان الصعيد')
ON CONFLICT DO NOTHING;

-- ═══ موظفين ═══
INSERT INTO employees (name, role, phone, email, salary, hire_date) VALUES
  ('أحمد محمد', 'كاشير', '01012345678', 'ahmed@muhiya.com', 5000, '2024-01-15'),
  ('سارة علي', 'كاشير', '01098765432', 'sara@muhiya.com', 4500, '2024-03-01'),
  ('محمود حسن', 'شيف', '01011111111', 'mahmoud@muhiya.com', 7000, '2023-06-01'),
  ('فاطمة أحمد', 'مديرة', '01022222222', 'fatma@muhiya.com', 10000, '2023-01-01'),
  ('عمر خالد', 'عامل مطبخ', '01033333333', 'omar@muhiya.com', 3500, '2024-06-01')
ON CONFLICT DO NOTHING;

-- ═══ دخل ═══
INSERT INTO income_entries (source, amount, description, income_date, is_recurring, recurring_pattern) VALUES
  ('sales', 1500, 'مبيعات POS - 2025-04-01', '2025-04-01', false, null),
  ('sales', 2200, 'مبيعات POS - 2025-04-02', '2025-04-02', false, null),
  ('sales', 1800, 'مبيعات POS - 2025-04-03', '2025-04-03', false, null),
  ('sales', 2500, 'مبيعات POS - 2025-04-04', '2025-04-04', false, null),
  ('sales', 3000, 'مبيعات POS - 2025-04-05', '2025-04-05', false, null),
  ('sales', 2800, 'مبيعات POS - 2025-04-06', '2025-04-06', false, null),
  ('sales', 2100, 'مبيعات POS - 2025-04-07', '2025-04-07', false, null),
  ('sales', 1900, 'مبيعات POS - اليوم', CURRENT_DATE, false, null),
  ('يدوي', 5000, 'إيجار فرع ثانوي', '2025-04-01', true, 'monthly'),
  ('أخرى', 3000, 'عمولة شريك', '2025-04-05', false, null)
ON CONFLICT DO NOTHING;

-- ═══ مصروفات ═══
INSERT INTO expenses (category, sub_category, amount, description, expense_date, status, is_recurring, created_by) VALUES
  ('إيجار', null, 8000, 'إيجار المحل الشهري', CURRENT_DATE - INTERVAL '10 days', 'paid', true, 'admin@muhiya.com'),
  ('فواتير', null, 1200, 'فاتورة كهرباء مارس', CURRENT_DATE - INTERVAL '5 days', 'paid', false, 'admin@muhiya.com'),
  ('فواتير', null, 350, 'فاتورة مياه مارس', CURRENT_DATE - INTERVAL '5 days', 'paid', false, 'admin@muhiya.com'),
  ('فواتير', null, 450, 'فاتورة إنترنت', CURRENT_DATE - INTERVAL '3 days', 'pending', false, 'admin@muhiya.com'),
  ('رواتب', null, 15000, 'رواتب شهر أبريل', CURRENT_DATE, 'pending', false, 'admin@muhiya.com'),
  ('مواد خام', null, 3500, 'شراء لحوم ودواجن', CURRENT_DATE - INTERVAL '2 days', 'paid', false, 'admin@muhiya.com'),
  ('مواد خام', null, 2000, 'شراء خضار ومواد غذائية', CURRENT_DATE - INTERVAL '1 day', 'paid', false, 'admin@muhiya.com'),
  ('صيانة', null, 800, 'صيانة ثلاجة', CURRENT_DATE - INTERVAL '7 days', 'paid', false, 'admin@muhiya.com'),
  ('تسويق', null, 1500, 'إعلانات سوشيال ميديا', CURRENT_DATE - INTERVAL '4 days', 'approved', false, 'admin@muhiya.com'),
  ('نقل', null, 500, 'توصيل طلبات', CURRENT_DATE, 'draft', false, 'admin@muhiya.com')
ON CONFLICT DO NOTHING;

-- ═══ طلبات ═══
INSERT INTO orders (order_ref, status, type, customer_name, customer_phone, subtotal, tax_amount, discount_amount, total, payment_method, payment_status, cashier_name, kitchen_status) VALUES
  ('ORD-001', 'completed', 'sale', 'محمد أحمد', '01011111111', 150, 21, 0, 171, 'كاش', 'paid', 'أحمد', null),
  ('ORD-002', 'completed', 'sale', 'سارة محمد', '01022222222', 200, 28, 10, 218, 'فيزا', 'paid', 'أحمد', null),
  ('ORD-003', 'completed', 'sale', 'خالد عمر', '01033333333', 180, 25, 0, 205, 'كاش', 'paid', 'سارة', null),
  ('ORD-004', 'pending', 'sale', 'نورا علي', '01044444444', 95, 13, 0, 108, 'كاش', 'unpaid', 'أحمد', 'sent'),
  ('ORD-005', 'processing', 'sale', 'عمر حسن', '01055555555', 120, 17, 0, 137, 'فيزا', 'paid', 'سارة', 'in_progress'),
  ('ORD-006', 'completed', 'sale', 'فاطمة محمد', '01066666666', 250, 35, 20, 265, 'كاش', 'paid', 'أحمد', null),
  ('ORD-007', 'cancelled', 'sale', 'أحمد علي', '01077777777', 80, 11, 0, 91, 'كاش', 'unpaid', 'سارة', null)
ON CONFLICT DO NOTHING;

-- ═══ بنود الطلبات ═══
INSERT INTO order_items (order_id, product_name, quantity, unit_price, line_total)
SELECT o.id, 'قهوة عربية', 2, 15, 30 FROM orders o WHERE o.order_ref='ORD-001'
UNION ALL SELECT o.id, 'شاي أحمر', 1, 10, 10 FROM orders o WHERE o.order_ref='ORD-001'
UNION ALL SELECT o.id, 'كنافة نابلسية', 3, 35, 105 FROM orders o WHERE o.order_ref='ORD-001'
UNION ALL SELECT o.id, 'برجر لحم', 2, 65, 130 FROM orders o WHERE o.order_ref='ORD-002'
UNION ALL SELECT o.id, 'عصير برتقال', 2, 20, 40 FROM orders o WHERE o.order_ref='ORD-002'
UNION ALL SELECT o.id, 'لبن بالشوكولاتة', 1, 18, 18 FROM orders o WHERE o.order_ref='ORD-002'
UNION ALL SELECT o.id, 'شاورما دجاج', 2, 55, 110 FROM orders o WHERE o.order_ref='ORD-003'
UNION ALL SELECT o.id, 'بقلاوة', 2, 40, 80 FROM orders o WHERE o.order_ref='ORD-003'
UNION ALL SELECT o.id, 'بيتزا مارجريتا', 1, 70, 70 FROM orders o WHERE o.order_ref='ORD-004'
UNION ALL SELECT o.id, 'قهوة عربية', 1, 15, 15 FROM orders o WHERE o.order_ref='ORD-004'
UNION ALL SELECT o.id, 'ساندويتش كبدة', 2, 45, 90 FROM orders o WHERE o.order_ref='ORD-005'
UNION ALL SELECT o.id, 'عصير برتقال', 1, 20, 20 FROM orders o WHERE o.order_ref='ORD-005'
ON CONFLICT DO NOTHING;

-- ═══ عملاء ═══
INSERT INTO customers (name, phone, email, total_purchases) VALUES
  ('محمد أحمد', '01011111111', 'mohamed@email.com', 5000),
  ('سارة محمد', '01022222222', 'sara@email.com', 3200),
  ('خالد عمر', '01033333333', 'khaled@email.com', 1800),
  ('نورا علي', '01044444444', 'noura@email.com', 750),
  ('عمر حسن', '01055555555', 'omar@email.com', 2100)
ON CONFLICT DO NOTHING;

-- ═══ إعدادات نظام (تخطي لأن الجدول مش مستخدم حالياً) ═══
-- INSERT INTO system_settings (setting_key, setting_value) VALUES
--   ('tax_rate', '14'::jsonb),
--   ('currency', '"ج.م"'::jsonb)
-- ON CONFLICT (setting_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════
-- تم بحمد الله 🎉
-- ═══════════════════════════════════════════════════════════
