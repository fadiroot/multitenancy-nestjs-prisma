/*
  Warnings:

  - You are about to drop the column `dbName` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `dbPassword` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `dbPort` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the column `dbUser` on the `Tenant` table. All the data in the column will be lost.
  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `databaseUrl` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tenant" DROP COLUMN "dbName",
DROP COLUMN "dbPassword",
DROP COLUMN "dbPort",
DROP COLUMN "dbUser",
ADD COLUMN     "databaseUrl" TEXT NOT NULL,
ALTER COLUMN "isUsed" SET DEFAULT false;

-- DropTable
DROP TABLE "User";
