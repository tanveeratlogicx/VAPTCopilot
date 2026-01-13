<?php
define('WP_USE_THEMES', false);
require_once('../../../wp-load.php');

$key = 'WP-EXPOSED-DEBUG-ENDPOINTS';
$meta = VAPTC_DB::get_feature_meta($key);

if ($meta) {
  file_put_contents('debug-meta-output.json', json_encode($meta, JSON_PRETTY_PRINT));
  echo "Metadata dumped to debug-meta-output.json\n";
} else {
  echo "Feature not found.\n";
}
