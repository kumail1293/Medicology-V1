CREATE INDEX "questions_status_idx" ON "questions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_orders_user_idem_idx" ON "payment_orders" USING btree ("user_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "payment_orders_user_idx" ON "payment_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_orders_status_idx" ON "payment_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "question_versions_question_idx" ON "question_versions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "qbank_questions_qbank_idx" ON "qbank_questions" USING btree ("qbank_id");--> statement-breakpoint
CREATE INDEX "qbank_questions_question_idx" ON "qbank_questions" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "entitlements_user_qbank_idx" ON "entitlements" USING btree ("user_id","qbank_id");--> statement-breakpoint
CREATE INDEX "entitlements_user_idx" ON "entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "waitlist_qbank_idx" ON "waitlist" USING btree ("qbank_id");