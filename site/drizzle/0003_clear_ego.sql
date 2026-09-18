CREATE TABLE `clara_research_states` (
	`id` text PRIMARY KEY NOT NULL,
	`research_request_id` text,
	`company_id` text,
	`objective` text NOT NULL,
	`status` text NOT NULL,
	`state_json` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clara_research_states_company_idx` ON `clara_research_states` (`company_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `clara_research_states_request_idx` ON `clara_research_states` (`research_request_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `clara_tool_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`research_state_id` text NOT NULL,
	`tool_name` text NOT NULL,
	`attempt` integer NOT NULL,
	`status` text NOT NULL,
	`input_json` text NOT NULL,
	`observations_json` text NOT NULL,
	`gaps_json` text NOT NULL,
	`resolved_gap_codes_json` text NOT NULL,
	`evidence_refs_json` text NOT NULL,
	`errors_json` text NOT NULL,
	`metadata_json` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text NOT NULL,
	FOREIGN KEY (`research_state_id`) REFERENCES `clara_research_states`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `clara_tool_executions_state_time_idx` ON `clara_tool_executions` (`research_state_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `clara_tool_executions_state_tool_idx` ON `clara_tool_executions` (`research_state_id`,`tool_name`,`attempt`);