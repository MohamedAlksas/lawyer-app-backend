-- Auto-update updatedAt for Client
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS \$\$
BEGIN
    NEW."updatedAt" = NOW();
    RETURN NEW;
END;
\$\$ language 'plpgsql';

-- Create triggers for each table with updatedAt
CREATE TRIGGER update_Client_updatedAt BEFORE UPDATE ON "Client" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Case_updatedAt BEFORE UPDATE ON "Case" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Session_updatedAt BEFORE UPDATE ON "Session" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_Payment_updatedAt BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
