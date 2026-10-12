CREATE TABLE `study_essays` (
	`user_id` text NOT NULL,
	`prompt_id` text NOT NULL,
	`text` text NOT NULL,
	`checks` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `prompt_id`)
);
