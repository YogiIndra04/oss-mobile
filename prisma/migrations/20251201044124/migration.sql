/*
  Warnings:

  - You are about to alter the column `created_at` on the `currency_rates` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `updated_at` on the `currency_rates` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `total_event_cost` on the `event_detail` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(18,2)`.
  - You are about to alter the column `event_date` on the `events` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `changed_at` on the `invoice_rate_audit` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `invoice_creation_date` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `payment_date` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `completion_date` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `due_date` on the `invoices` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.
  - You are about to alter the column `proof_amount` on the `payment_proofs` table. The data in that column could be lost. The data in that column will be cast from `Decimal(10,2)` to `Decimal(18,2)`.
  - You are about to alter the column `proof_date` on the `payment_proofs` table. The data in that column could be lost. The data in that column will be cast from `DateTime(0)` to `DateTime`.

*/
-- AlterTable
ALTER TABLE `currency_rates` MODIFY `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `event_detail` MODIFY `total_event_cost` DECIMAL(18, 2) NOT NULL;

-- AlterTable
ALTER TABLE `events` MODIFY `event_date` DATETIME NOT NULL;

-- AlterTable
ALTER TABLE `invoice_rate_audit` MODIFY `changed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `invoices` MODIFY `invoice_creation_date` DATETIME NOT NULL,
    MODIFY `payment_date` DATETIME NULL,
    MODIFY `completion_date` DATETIME NULL,
    MODIFY `due_date` DATETIME NULL;

-- AlterTable
ALTER TABLE `payment_proofs` MODIFY `proof_amount` DECIMAL(18, 2) NOT NULL,
    MODIFY `proof_date` DATETIME NULL;
