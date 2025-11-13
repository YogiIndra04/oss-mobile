-- CreateTable
CREATE TABLE `users` (
    `id_user` CHAR(36) NOT NULL,
    `role_user` ENUM('admin', 'konsultan') NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `reset_password` VARCHAR(255) NULL,
    `reset_password_expires` DATETIME(3) NULL,
    `reset_password_attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `username`(`username`),
    INDEX `users_role_idx`(`role_user`),
    PRIMARY KEY (`id_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `profile_user` (
    `id_user` CHAR(36) NOT NULL,
    `profile_image` TEXT NULL,
    `user_name` VARCHAR(100) NOT NULL,
    `email_user` VARCHAR(100) NULL,
    `user_contact` VARCHAR(20) NULL,
    `user_address` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `profile_user_email_idx`(`email_user`),
    PRIMARY KEY (`id_user`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `companies` (
    `company_id` CHAR(36) NOT NULL,
    `business_name` VARCHAR(255) NOT NULL,
    `company_name` VARCHAR(255) NOT NULL,
    `company_email` VARCHAR(255) NULL,
    `company_contact` VARCHAR(20) NULL,
    `company_web` VARCHAR(255) NULL,
    `company_registration` VARCHAR(50) NULL,
    `company_wa` VARCHAR(20) NULL,
    `company_ig` VARCHAR(50) NULL,
    `company_yt` VARCHAR(50) NULL,
    `company_tt` VARCHAR(50) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`company_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `company_addresses` (
    `address_id` CHAR(36) NOT NULL DEFAULT (uuid()),
    `company_id` CHAR(36) NOT NULL,
    `address_type` ENUM('Head_Office', 'Branch_Office', 'Warehouse') NOT NULL,
    `company_address` VARCHAR(255) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `company_addresses_company_id_idx`(`company_id`),
    PRIMARY KEY (`address_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tac` (
    `tac_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `tac_description` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`tac_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `bank` (
    `bank_id` CHAR(36) NOT NULL,
    `bank_name` VARCHAR(255) NOT NULL,
    `bank_address` VARCHAR(255) NULL,
    `account_number` VARCHAR(50) NOT NULL,
    `beneficiary_name` VARCHAR(255) NOT NULL,
    `beneficiary_address` VARCHAR(255) NULL,
    `swift_code` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `bank_account_number_key`(`account_number`),
    PRIMARY KEY (`bank_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer` (
    `customer_id` CHAR(36) NOT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NULL,
    `customer_contact` VARCHAR(20) NULL,
    `customer_address` VARCHAR(255) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `customer_email_key`(`email`),
    PRIMARY KEY (`customer_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `category_id` CHAR(36) NOT NULL,
    `category_name` VARCHAR(255) NOT NULL,
    `category_description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`category_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_template` (
    `template_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `template_name` ENUM('Pelanggan', 'Kerjasama') NOT NULL,
    `image_logo` LONGTEXT NULL,
    `background` LONGTEXT NULL,
    `header_client` LONGTEXT NULL,
    `footer_client` LONGTEXT NULL,
    `header_partner` LONGTEXT NULL,
    `footer_partner` LONGTEXT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `invoice_template_company_id_idx`(`company_id`),
    PRIMARY KEY (`template_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product` (
    `product_id` CHAR(36) NOT NULL,
    `category_id` CHAR(36) NULL,
    `product_title` VARCHAR(255) NOT NULL,
    `product_description` TEXT NULL,
    `product_amount` INTEGER NOT NULL,
    `item_type` ENUM('product', 'service') NOT NULL,
    `type_status` ENUM('tetap', 'tidak_tetap') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`product_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `events` (
    `event_id` CHAR(36) NOT NULL,
    `event_name` VARCHAR(255) NOT NULL,
    `event_description` TEXT NULL,
    `event_venue` VARCHAR(255) NULL,
    `event_address` VARCHAR(255) NULL,
    `event_date` DATETIME NOT NULL,
    `event_cost` INTEGER NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`event_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoices` (
    `invoice_id` CHAR(36) NOT NULL,
    `invoice_number` VARCHAR(20) NOT NULL,
    `document_type` ENUM('Invoice', 'Receipt') NOT NULL DEFAULT 'Invoice',
    `invoice_type` ENUM('Pelanggan', 'Kerjasama') NOT NULL,
    `customer_name` VARCHAR(255) NOT NULL,
    `customer_address` VARCHAR(255) NULL,
    `unpaid` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `subtotal_before_invoice_discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `invoice_discount_type` ENUM('PERCENT', 'FIXED') NULL,
    `invoice_discount_value` DECIMAL(10, 2) NULL,
    `invoice_discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `subtotal_after_invoice_discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `payment_status` ENUM('Belum_dibayar', 'Lunas', 'Mencicil', 'Jatuh_tempo') NOT NULL,
    `invoice_creation_date` DATETIME NOT NULL,
    `payment_date` DATETIME NULL,
    `completion_date` DATETIME NULL,
    `due_date` DATETIME NULL,
    `currency_accepted` VARCHAR(10) NOT NULL,
    `currency_exchange_rate` DECIMAL(18, 6) NULL,
    `currency_exchange_rate_date` DATE NULL,
    `pdf_path` LONGTEXT NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `invoices_invoice_number_key`(`invoice_number`),
    INDEX `invoices_created_by_idx`(`created_by_user_id`),
    INDEX `invoices_creator_created_at_idx`(`created_by_user_id`, `created_at`),
    PRIMARY KEY (`invoice_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_detail` (
    `product_detail_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `currency_code` VARCHAR(10) NULL,
    `unit_price_foreign` DECIMAL(18, 6) NULL,
    `line_total_foreign` DECIMAL(18, 6) NULL,
    `line_total_idr` DECIMAL(18, 2) NULL,
    `currency_rate_used` DECIMAL(18, 6) NULL,
    `total_product_amount` DECIMAL(10, 2) NOT NULL,
    `discount_type` ENUM('PERCENT', 'FIXED') NULL,
    `discount_value` DECIMAL(10, 2) NULL,
    `line_total_before_discount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `line_discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `line_total_before_discount_foreign` DECIMAL(18, 6) NULL,
    `line_discount_amount_foreign` DECIMAL(18, 6) NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `product_detail_invoice_id_product_id_key`(`invoice_id`, `product_id`),
    PRIMARY KEY (`product_detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `event_detail` (
    `event_detail_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `event_id` CHAR(36) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `total_event_cost` DECIMAL(10, 2) NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `event_detail_invoice_id_event_id_key`(`invoice_id`, `event_id`),
    PRIMARY KEY (`event_detail_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_proofs` (
    `payment_proof_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `proof_status` ENUM('Pending', 'Verified', 'Rejected') NOT NULL,
    `proof_image_path` TEXT NOT NULL,
    `proof_title` VARCHAR(255) NULL,
    `proof_description` TEXT NULL,
    `proof_amount` DECIMAL(10, 2) NOT NULL,
    `uploaded_by_user_id` CHAR(36) NOT NULL,
    `proof_sequence` INTEGER NULL,
    `proof_date` DATETIME NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `payment_proofs_invoice_id_proof_sequence_idx`(`invoice_id`, `proof_sequence`),
    PRIMARY KEY (`payment_proof_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `barcodes` (
    `barcode_id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `barcode_link` TEXT NOT NULL,
    `barcode_image_path` TEXT NOT NULL,
    `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `barcodes_invoice_id_key`(`invoice_id`),
    PRIMARY KEY (`barcode_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currency_rates` (
    `rate_id` CHAR(36) NOT NULL,
    `currency_code` VARCHAR(10) NOT NULL,
    `rate_to_base` DECIMAL(18, 6) NOT NULL,
    `effective_date` DATE NOT NULL,
    `source` VARCHAR(100) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `currency_rates_currency_code_effective_date_idx`(`currency_code`, `effective_date`),
    UNIQUE INDEX `currency_rates_currency_code_effective_date_key`(`currency_code`, `effective_date`),
    PRIMARY KEY (`rate_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_rate_audit` (
    `id` CHAR(36) NOT NULL,
    `invoice_id` CHAR(36) NOT NULL,
    `old_rate` DECIMAL(18, 6) NULL,
    `new_rate` DECIMAL(18, 6) NOT NULL,
    `old_date` DATE NULL,
    `new_date` DATE NOT NULL,
    `changed_by` CHAR(36) NOT NULL,
    `notes` TEXT NULL,
    `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_rate_audit_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `profile_user` ADD CONSTRAINT `fk_user_profile` FOREIGN KEY (`id_user`) REFERENCES `users`(`id_user`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `company_addresses` ADD CONSTRAINT `company_addresses_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tac` ADD CONSTRAINT `tac_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_template` ADD CONSTRAINT `invoice_template_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`company_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product` ADD CONSTRAINT `product_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`category_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoices` ADD CONSTRAINT `fk_invoices_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id_user`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_detail` ADD CONSTRAINT `product_detail_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_detail` ADD CONSTRAINT `product_detail_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `product`(`product_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_detail` ADD CONSTRAINT `event_detail_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `event_detail` ADD CONSTRAINT `event_detail_event_id_fkey` FOREIGN KEY (`event_id`) REFERENCES `events`(`event_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id_user`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcodes` ADD CONSTRAINT `barcodes_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_rate_audit` ADD CONSTRAINT `invoice_rate_audit_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE ON UPDATE CASCADE;
