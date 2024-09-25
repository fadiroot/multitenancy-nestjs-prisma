/*
  Warnings:

  - Added the required column `dbName` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dbPassword` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dbPort` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dbUser` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "dbName" TEXT NOT NULL,
ADD COLUMN     "dbPassword" TEXT NOT NULL,
ADD COLUMN     "dbPort" INTEGER NOT NULL,
ADD COLUMN     "dbUser" TEXT NOT NULL;
