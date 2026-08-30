CREATE TABLE "table_feedback" (
	"table_id" text NOT NULL,
	"diner_id" text NOT NULL,
	"dish_id" text NOT NULL,
	"liked" boolean NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "table_feedback_table_id_diner_id_pk" PRIMARY KEY("table_id","diner_id")
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "confirmation_id" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "pending_action" text;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "action_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "last_revision" jsonb;--> statement-breakpoint
ALTER TABLE "tables" ADD COLUMN "memory_saved_at" timestamp;--> statement-breakpoint
ALTER TABLE "table_feedback" ADD CONSTRAINT "table_feedback_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_feedback" ADD CONSTRAINT "table_feedback_diner_id_diners_id_fk" FOREIGN KEY ("diner_id") REFERENCES "public"."diners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_feedback" ADD CONSTRAINT "table_feedback_dish_id_dishes_id_fk" FOREIGN KEY ("dish_id") REFERENCES "public"."dishes"("id") ON DELETE no action ON UPDATE no action;