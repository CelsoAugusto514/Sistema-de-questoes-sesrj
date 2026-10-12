CREATE TABLE `study_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`matter` text NOT NULL,
	`chosen` integer NOT NULL,
	`correct` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_attempts_user_created` ON `study_attempts` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_attempts_session` ON `study_attempts` (`session_id`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`state` text NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_created` ON `study_sessions` (`user_id`,`created_at`);