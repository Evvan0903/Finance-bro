CREATE TABLE `hiring_job_postings` (
	`id` text PRIMARY KEY NOT NULL,
	`hiring_run_id` text NOT NULL,
	`job_id` text NOT NULL,
	`company_id` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`country` text,
	`remote` integer,
	`function` text,
	`seniority` text,
	`source_url` text NOT NULL,
	`source_type` text NOT NULL,
	`source_job_id` text,
	`posted_at` text,
	`retrieved_at` text NOT NULL,
	`job_json` text NOT NULL,
	FOREIGN KEY (`hiring_run_id`) REFERENCES `hiring_research_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `hiring_research_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`research_request_id` text NOT NULL,
	`company_id` text NOT NULL,
	`status` text NOT NULL,
	`source_url` text,
	`adapter` text,
	`retrieved_at` text NOT NULL,
	`result_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`research_request_id`) REFERENCES `research_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
