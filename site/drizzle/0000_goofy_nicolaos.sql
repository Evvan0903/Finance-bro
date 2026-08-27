CREATE TABLE `entity_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`research_request_id` text NOT NULL,
	`display_name` text NOT NULL,
	`legal_name` text,
	`website` text,
	`location` text,
	`industry` text,
	`relationship_type` text NOT NULL,
	`confidence` text NOT NULL,
	`match_reasons_json` text NOT NULL,
	`provenance_json` text NOT NULL,
	`selectable` integer NOT NULL,
	`candidate_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`research_request_id`) REFERENCES `research_requests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_type` text NOT NULL,
	`original_company_name` text,
	`original_website` text,
	`status` text NOT NULL,
	`record_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `selected_targets` (
	`research_request_id` text PRIMARY KEY NOT NULL,
	`candidate_id` text NOT NULL,
	`selection_status` text NOT NULL,
	`selected_at` text NOT NULL,
	`identity_verification_status` text NOT NULL,
	`identity_confidence` text NOT NULL,
	FOREIGN KEY (`research_request_id`) REFERENCES `research_requests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`candidate_id`) REFERENCES `entity_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
