CREATE TABLE IF NOT EXISTS "DeviceToken" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'mobile',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", token)
);

CREATE TRIGGER update_DeviceToken_updatedAt
  BEFORE UPDATE ON "DeviceToken"
  FOR EACH ROW EXECUTE FUNCTION update_updatedAt_column();
