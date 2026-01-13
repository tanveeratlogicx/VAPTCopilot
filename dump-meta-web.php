<?php
define('WP_USE_THEMES', false);
// Go up until we find wp-load.php
$path = __DIR__;
while ($path !== '/' && !file_exists($path . '/wp-load.php')) {
  $path = dirname($path);
}
require_once($path . '/wp-load.php');

$key = 'WP-EXPOSED-DEBUG-ENDPOINTS';
$meta = VAPTC_DB::get_feature_meta($key);

header('Content-Type: application/json');
if ($meta) {
  echo json_encode($meta, JSON_PRETTY_PRINT);
} else {
  echo json_encode(['error' => 'Feature not found']);
}
