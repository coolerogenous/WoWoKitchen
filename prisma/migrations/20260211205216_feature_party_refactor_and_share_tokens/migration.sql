/*
  Warnings:

  - You are about to drop the `partydish` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `partydish` DROP FOREIGN KEY `PartyDish_addedByGuestId_fkey`;

-- DropForeignKey
ALTER TABLE `partydish` DROP FOREIGN KEY `PartyDish_partyId_fkey`;

-- DropTable
DROP TABLE `partydish`;

-- CreateTable
CREATE TABLE `ShareToken` (
    `code` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `refId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PartyDishPool` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `partyId` INTEGER NOT NULL,
    `dishName` VARCHAR(191) NOT NULL,
    `ingredientsSnapshot` TEXT NOT NULL,
    `costSnapshot` DOUBLE NOT NULL,
    `originalDishId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestSelection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guestId` INTEGER NOT NULL,
    `poolDishId` INTEGER NOT NULL,

    UNIQUE INDEX `GuestSelection_guestId_poolDishId_key`(`guestId`, `poolDishId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PartyDishPool` ADD CONSTRAINT `PartyDishPool_partyId_fkey` FOREIGN KEY (`partyId`) REFERENCES `Party`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestSelection` ADD CONSTRAINT `GuestSelection_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `PartyGuest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestSelection` ADD CONSTRAINT `GuestSelection_poolDishId_fkey` FOREIGN KEY (`poolDishId`) REFERENCES `PartyDishPool`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
