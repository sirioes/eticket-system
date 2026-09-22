-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `fullName` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPERADMIN', 'TEAM_MAIN_OFFICE', 'MANAGER_MAIN_OFFICE', 'FINANCE_MAIN_OFFICE', 'FINANCE_MANAGER_MAIN_OFFICE') NOT NULL,
    `divisi` ENUM('IT', 'FINANCE', 'TAX', 'YOUTUBE', 'DIGITAL_MARKETING', 'DESIGN', 'PROJECT', 'LEGAL', 'SO') NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `passwordChangedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_fullName_key`(`fullName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Ticket` (
    `id` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `stage` ENUM('MENUNGGU_MANAGER_ASAL', 'MENUNGGU_MANAGER_TUJUAN', 'MENUNGGU_STAF_TUJUAN', 'DIPROSES', 'SELESAI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU_MANAGER_ASAL',
    `fromDivisi` ENUM('IT', 'FINANCE', 'TAX', 'YOUTUBE', 'DIGITAL_MARKETING', 'DESIGN', 'PROJECT', 'LEGAL', 'SO') NOT NULL,
    `toDivisi` ENUM('IT', 'FINANCE', 'TAX', 'YOUTUBE', 'DIGITAL_MARKETING', 'DESIGN', 'PROJECT', 'LEGAL', 'SO') NOT NULL,
    `createdById` INTEGER NOT NULL,
    `rejectedAtStage` ENUM('MENUNGGU_MANAGER_ASAL', 'MENUNGGU_MANAGER_TUJUAN', 'MENUNGGU_STAF_TUJUAN', 'DIPROSES', 'SELESAI', 'DITOLAK') NULL,
    `rejectedById` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Ticket_fromDivisi_createdAt_idx`(`fromDivisi`, `createdAt`),
    INDEX `Ticket_toDivisi_createdAt_idx`(`toDivisi`, `createdAt`),
    INDEX `Ticket_stage_idx`(`stage`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `storedName` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `size` INTEGER NOT NULL,
    `uploadedById` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketAttachment_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_rejectedById_fkey` FOREIGN KEY (`rejectedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
