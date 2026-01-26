export type TaxonomySource = 'ast' | 'llm' | 'docs' | 'gap';

export const TAXONOMY_ITEMS = [
  'file_purpose_summaries', 'module_purpose_summaries', 'function_signatures', 'function_purpose', 'class_definitions_methods',
  'exported_api_surface', 'internal_api_surface', 'directory_purpose_ownership', 'directory_dependency_graph', 'file_dependency_graph',
  'function_call_graph', 'data_flow_between_functions', 'side_effects_per_function_module', 'error_handling_patterns', 'logging_telemetry_usage',
  'complexity_metrics', 'cognitive_complexity', 'max_nesting_depth', 'fan_in_fan_out', 'dead_code_candidates',
  'duplicate_code_detection', 'architectural_pattern_detection', 'anti_pattern_detection', 'decision_records_linkage', 'change_history_for_files',
  'rationale_for_changes', 'todos_debt_hotspots', 'test_coverage_by_module', 'test_to_code_mapping', 'flaky_test_history',
  'build_pipeline_entrypoints', 'runtime_entrypoints', 'cli_commands_flags', 'config_files_keys', 'environment_variables_usage',
  'feature_flags', 'dependency_versions_lockfile', 'dependency_risk_health', 'external_service_dependencies', 'api_schemas',
  'database_schema', 'migration_history', 'data_retention_policies', 'security_boundaries', 'secret_handling_rules',
  'pii_classification', 'performance_hotspots', 'performance_budgets', 'caching_layers', 'concurrency_model',
  'background_jobs_cron', 'queue_topic_topology', 'deployment_pipeline', 'runtime_topology_services', 'observability_dashboards',
  'alerting_rules', 'slo_sla_definitions', 'incident_runbooks', 'on_call_rotation', 'code_ownership',
  'review_rules_gates', 'branching_strategy', 'release_process', 'hotfix_process', 'architecture_layer_boundaries',
  'module_cohesion_metrics', 'coupling_metrics', 'public_private_api_boundaries', 'code_generation_sources', 'build_artifacts_mapping',
  'lint_rules_exceptions', 'formatting_conventions', 'editor_configs', 'license_compliance_files', 'third_party_attribution',
  'ui_component_library_map', 'ux_guidelines', 'accessibility_requirements', 'localization_i18n_keys', 'domain_model_invariants',
  'business_rules_constraints', 'product_roadmap_mapping', 'open_issues_bugs', 'risk_register', 'known_failure_modes',
  'test_fixtures_golden_files', 'sample_data_tests', 'code_to_doc_linkage', 'doc_freshness_coverage', 'ai_tool_allowlists',
  'agent_role_definitions', 'agent_prompt_templates', 'agent_performance_feedback', 'code_search_query_patterns', 'semantic_similarity_across_modules',
  'incremental_reindex_triggers', 'workspace_level_indexing_status', 'quality_tier_evolution_tracking', 'knowledge_confidence_calibration', 'team_collaboration_context',
] as const;

export type TaxonomyItem = typeof TAXONOMY_ITEMS[number];
export const TAXONOMY_ITEM_COUNT = TAXONOMY_ITEMS.length;
const TAXONOMY_SET = new Set<string>(TAXONOMY_ITEMS);

export function isTaxonomyItem(value: string): value is TaxonomyItem {
  return TAXONOMY_SET.has(value);
}
