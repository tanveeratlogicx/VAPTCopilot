<?php
// Try different paths for wp-load.php
$paths = [
  '../../../../wp-load.php', // Standard plugins folder
  '../../../wp-load.php',    // Some custom structures
  '../../wp-load.php',
  '../wp-load.php'
];

$found = false;
foreach ($paths as $path) {
  if (file_exists($path)) {
    require_once($path);
    $found = true;
    break;
  }
}

if (!$found) {
  die("Error: wp-load.php not found.");
}

global $wpdb;
$table = $wpdb->prefix . 'vaptc_domains';
$cols = $wpdb->get_results("SHOW COLUMNS FROM $table");
$keys = $wpdb->get_results("SHOW KEYS FROM $table");

header('Content-Type: application/json');
echo json_encode([
  'columns' => $cols,
  'keys' => $keys,
  'wp_prefix' => $wpdb->prefix
], JSON_PRETTY_PRINT);
