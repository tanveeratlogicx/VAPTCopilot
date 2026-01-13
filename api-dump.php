<?php
define('WP_USE_THEMES', false);
require_once('wp-load.php');

$rest = new VAPTC_REST();
$request = new WP_REST_Request('GET', '/vaptc/v1/features');
$request->set_param('scope', 'client');

$response = $rest->get_features($request);
$data = $response->get_data();

echo "Active File: " . get_option('vaptc_active_feature_file', 'features-with-test-methods.json') . "\n";
echo "--- FEATURES IN DEVELOP TAB ---\n";

foreach ($data['features'] as $f) {
  if (in_array(strtolower($f['status']), ['develop', 'in_progress'])) {
    echo "[" . $f['status'] . "] " . $f['key'] . " - " . $f['label'] . "\n";
  }
}
echo "\nDONE\n";
