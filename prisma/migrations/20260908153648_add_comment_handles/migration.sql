-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "displayName" VARCHAR(20),
ADD COLUMN     "handleId" INTEGER,
ALTER COLUMN "authorId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "CommentHandle" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(20) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentHandle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommentHandle_username_key" ON "CommentHandle"("username");

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_handleId_fkey" FOREIGN KEY ("handleId") REFERENCES "CommentHandle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
