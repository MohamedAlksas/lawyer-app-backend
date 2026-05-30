ALTER TABLE "User" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Client" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Case" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Session" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Action" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Payment" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Document" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
ALTER TABLE "Notification" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
