<?php
require_once('../../../wp-load.php');

if (!current_user_can('manage_options')) {
  die("Admin access required\n");
}

// Simulate the GET parameter
$_GET['vaptc_force_fix_brute_force'] = '1';

// Call the function
vaptc_force_fix_brute_force_protection();

echo "Force fix attempted\n";
