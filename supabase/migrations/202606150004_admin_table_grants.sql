grant usage on schema writing_helper to anon, authenticated, service_role;

grant select, insert, update on table writing_helper.service_settings to service_role;
grant select, insert on table writing_helper.service_audit_logs to service_role;
grant select, insert on table writing_helper.api_usage_logs to service_role;
