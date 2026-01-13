<?php
require_once('wp-load.php');

echo "vaptc_hidden_json_files: " . print_r(get_option('vaptc_hidden_json_files'), true) . "\n";
echo "vaptc_active_feature_file: " . get_option('vaptc_active_feature_file') . "\n";

$rest = new VAPTC_REST();
$request = new WP_REST_Request('GET', '/vaptc/v1/data-files');
$response = $rest->get_data_files($request);
echo "Filtered files response: " . print_r($response->get_data(), true) . "\n";

$request_all = new WP_REST_Request('GET', '/vaptc/v1/data-files/all');
$response_all = $rest->get_all_data_files($request_all);
echo "All files response: " . print_r($response_all->get_data(), true) . "\n";
