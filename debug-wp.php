<?php
define('WP_USE_THEMES', false);
require_once('../../../wp-load.php');

global $wpdb;

echo "Active File Option: " . get_option('vaptc_active_feature_file', 'NOT SET (default: features-with-test-methods.json)') . "\n\n";

$status_table = $wpdb->prefix . 'vaptc_feature_status';
$results = $wpdb->get_results("SELECT * FROM $status_table", ARRAY_A);

echo "--- ALL FEATURE STATUSES IN DB ---\n";
foreach ($results as $row) {
  if ($row['status'] === 'Develop' || $row['status'] === 'in_progress') {
    echo "[DEVELOP] " . $row['feature_key'] . "\n";
  } else {
    echo "[" . $row['status'] . "] " . $row['feature_key'] . "\n";
  }
}
if (empty($results)) echo "No features in DB status table.\n";
echo "\nDONE\n";
