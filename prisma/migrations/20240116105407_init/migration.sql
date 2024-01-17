/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "event";

-- CreateTable
CREATE TABLE "event" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "image" VARCHAR(255) NOT NULL,
    "date" TIMESTAMP(6) NOT NULL,
    "time" TIMESTAMP(5) NOT NULL,
    "location" VARCHAR(255) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);