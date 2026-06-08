CREATE INDEX `items_name_idx` ON `items` (`name`);--> statement-breakpoint
CREATE INDEX `items_category_idx` ON `items` (`category_id`);--> statement-breakpoint
CREATE INDEX `items_location_idx` ON `items` (`location`);--> statement-breakpoint
CREATE INDEX `items_deleted_at_idx` ON `items` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `transactions_item_idx` ON `transactions` (`item_id`);--> statement-breakpoint
CREATE INDEX `transactions_created_at_idx` ON `transactions` (`created_at`);