-- CreateTable
CREATE TABLE `slack_installations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `app_name` VARCHAR(191) NOT NULL,
    `workspace_id` VARCHAR(191) NOT NULL,
    `workspace_name` VARCHAR(191) NULL,
    `enterprise_id` VARCHAR(191) NULL,
    `bot_token` TEXT NOT NULL,
    `bot_id` VARCHAR(191) NULL,
    `bot_user_id` VARCHAR(191) NULL,
    `bot_scopes` TEXT NOT NULL,
    `installed_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `slack_installations_app_name_workspace_id_key`(`app_name`, `workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workspace_calendar_configs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `workspace_id` VARCHAR(191) NOT NULL,
    `google_calendar_id` VARCHAR(191) NOT NULL,
    `reminder_channel_id` VARCHAR(191) NULL,
    `updated_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `workspace_calendar_configs_workspace_id_key`(`workspace_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
