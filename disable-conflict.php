<?php
define('WP_USE_THEMES', false);
require_once(dirname(dirname(dirname(dirname(__FILE__)))) . '/wp-load.php');

global $wpdb;
$table = $wpdb->prefix . 'vaptc_feature_status';

// Features to disable (Limit 5 culprits)
$to_disable = ['xml-rpc-api-security', 'xmlrpc-protector', 'login-guard'];

foreach ($to_disable as $key) {
  $updated = $wpdb->update($table, ['status' => 'Draft'], ['feature_key' => $key]);
  if ($updated) {
    echo "Disabled $key\n";
  }
}

// Also verify what's active
$active = $wpdb->get_results("SELECT feature_key FROM $table WHERE status IN ('implemented','release','test','develop')");
echo "Active features:\n";
foreach ($active as $f) {
  echo "- " . $f->feature_key . "\n";
}
