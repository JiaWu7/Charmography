CREATE TABLE `charm_stories` (
  `id` text PRIMARY KEY NOT NULL,
  `submission_token` text NOT NULL UNIQUE,
  `origin` text NOT NULL,
  `accumulation` text NOT NULL,
  `outcome` text NOT NULL,
  `photo_key` text NOT NULL,
  `photo_type` text NOT NULL,
  `photo_size` integer NOT NULL,
  `contributor_id` text,
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `charm_stories_created_at_idx` ON `charm_stories` (`created_at`);
