CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`type` text NOT NULL,
	`severity` text NOT NULL,
	`message` text NOT NULL,
	`is_active` integer DEFAULT 1 NOT NULL,
	`acknowledged_at` text,
	`resolved_at` text,
	`triggered_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_items` (
	`bom_id` text NOT NULL,
	`item_id` text NOT NULL,
	`quantity` integer NOT NULL,
	PRIMARY KEY(`bom_id`, `item_id`),
	FOREIGN KEY (`bom_id`) REFERENCES `bom_templates`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bom_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP'
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`aging_days` integer DEFAULT 90 NOT NULL,
	`color` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`category_id` text,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'pcs' NOT NULL,
	`threshold` integer DEFAULT 5 NOT NULL,
	`max_stock` integer,
	`location` text,
	`cost_per_unit` real DEFAULT 0 NOT NULL,
	`supplier` text,
	`last_moved_at` text,
	`added_at` text DEFAULT 'CURRENT_TIMESTAMP',
	`notes` text,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`quantity_before` integer NOT NULL,
	`performed_by` text NOT NULL,
	`reference` text,
	`notes` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP',
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bom_templates_name_unique` ON `bom_templates` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_name_unique` ON `categories` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `items_sku_unique` ON `items` (`sku`);