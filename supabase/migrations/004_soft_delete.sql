-- ================================================================
-- Migration 004: Soft Delete for Financial Records
-- Adds deleted_at + deleted_by columns to income_entries & expenses
-- Records are never hard-deleted; queries must filter deleted_at IS NULL
-- ================================================================

-- Income entries soft delete
ALTER TABLE income_entries
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Expenses soft delete
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  uuid        DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_income_entries_not_deleted ON income_entries (deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_not_deleted        ON expenses        (deleted_at) WHERE deleted_at IS NULL;

-- ================================================================
-- Audit Log Table
-- Records financial actions with user identity + timestamp
-- ================================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  action        text         NOT NULL,                         -- 'income_added', 'expense_added', 'recurring_executed', etc.
  entity_type   text         NOT NULL,                         -- 'income', 'expense', 'recurring', 'wallet'
  entity_id     uuid         DEFAULT NULL,
  user_id       uuid         DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name     text         DEFAULT NULL,
  amount        numeric(14,2) DEFAULT NULL,
  details       jsonb        DEFAULT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Index audit log by user and time
CREATE INDEX IF NOT EXISTS idx_audit_log_user_time ON audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_time      ON audit_log (created_at DESC);

-- Enable RLS on audit_log
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read all logs; users can read their own
CREATE POLICY "audit_log_read" ON audit_log
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'مدير النظام'
    )
  );

-- Anyone authenticated can insert their own logs
CREATE POLICY "audit_log_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
