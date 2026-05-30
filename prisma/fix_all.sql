-- Add UUID defaults to all tables
ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Client" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Case" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Action" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Payment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Document" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Notification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- Auto-update updatedAt columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_Client_updatedAt BEFORE UPDATE ON "Client" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Case_updatedAt BEFORE UPDATE ON "Case" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Session_updatedAt BEFORE UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Payment_updatedAt BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
