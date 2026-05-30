-- Create DeviceToken table for FCM push notification tokens
CREATE TABLE IF NOT EXISTS "DeviceToken" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT DEFAULT 'mobile',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", token)
);

-- Trigger for updatedAt
CREATE OR REPLACE FUNCTION update_updatedAt_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_DeviceToken_updatedAt
  BEFORE UPDATE ON "DeviceToken"
  FOR EACH ROW
  EXECUTE FUNCTION update_updatedAt_column();
