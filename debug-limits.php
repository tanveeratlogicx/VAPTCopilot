<?php
// Load WP
$root = dirname(dirname(dirname(dirname(__FILE__))));
require_once($root . '/wp-load.php');
require_once(plugin_dir_path(__FILE__) . 'includes/class-vaptc-db.php');

global $wpdb;
$meta_table = $wpdb->prefix . 'vaptc_feature_meta';
$status_table = $wpdb->prefix . 'vaptc_feature_status';

$features = $wpdb->get_results("
    SELECT s.feature_key, s.status, m.meta_value as implementation_data, m2.meta_value as generated_schema
    FROM $status_table s
    LEFT JOIN $meta_table m ON s.feature_key = m.feature_key AND m.meta_key = 'implementation_data'
    LEFT JOIN $meta_table m2 ON s.feature_key = m.feature_key AND m2.meta_key = 'generated_schema'
    WHERE s.status IN ('implemented', 'release', 'test', 'develop')
");

echo "Checking " . count($features) . " active features...\n";

foreach ($features as $f) {
  $schema = json_decode($f->generated_schema, true);
  if (!$schema || empty($schema['enforcement']['mappings'])) continue;

  $mappings = $schema['enforcement']['mappings'];
  if (in_array('limit_login_attempts', $mappings)) {

    $data = json_decode($f->implementation_data, true) ?: [];

    // Resolve limit
    $limit = null;
    $candidates = ['rate_limit', 'limit', 'max_login_attempts', 'max_attempts', 'api_limit'];
    foreach ($candidates as $k) {
      if (isset($data[$k]) && is_numeric($data[$k]) && $data[$k] > 1) {
        $limit = $data[$k];
        break;
      }
    }

    // Check schema defaults if not found in data
    if ($limit === null && isset($schema['controls'])) {
      foreach ($schema['controls'] as $c) {
        // Check if any of the candidate keys match and have a default
        if (isset($c['valid_keys'])) { // Hypothetical
        }
        if (isset($c['key']) && in_array($c['key'], $candidates) && isset($c['default'])) {
          // Check if data actually has this key but it was empty/null
          if (!isset($data[$c['key']])) {
            $limit = $c['default'];
          }
        }
      }
    }

    echo "Feature [{$f->feature_key}] uses 'limit_login_attempts'. Resolved Limit: " . ($limit ?: 'UNKNOWN (likely 5 due to default fallback)') . "\n";
  }
}
