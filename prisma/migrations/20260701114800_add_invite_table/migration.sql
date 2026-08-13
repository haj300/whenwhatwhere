-- CreateTable
CREATE TABLE "Invite" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'CONTRIBUTOR',
    "tokenHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invite_email_key" ON "Invite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "Invite"("tokenHash");
