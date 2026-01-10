<?php
require_once('../../../wp-load.php');
global $wpdb;
$table = $wpdb->prefix . 'vaptc_feature_meta';

echo "UNIQUE MIGRATION START\n";
$res = $wpdb->query("ALTER TABLE $table ADD COLUMN include_verification_engine TINYINT(1) DEFAULT 0 AFTER include_verification");
if ($res === false) {
  echo "ERROR: " . $wpdb->last_error . "\n";
} else {
  echo "SUCCESS: Column added.\n";
}
echo "UNIQUE MIGRATION END\n";
