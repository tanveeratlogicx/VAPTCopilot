<?php
require_once('../../../wp-load.php');
global $wpdb;
$table = $wpdb->prefix . 'vaptc_feature_meta';
$row = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE feature_key = %s", 'brute-force-protection'), ARRAY_A);

echo "DATABASE STATE:\n";
print_r($row);

$enforced = get_transient('vaptc_active_enforcements');
echo "\nTRANSIENT STATE:\n";
print_r($enforced);
