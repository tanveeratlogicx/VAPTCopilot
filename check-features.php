<?php
// Skip WP load, just use mysqli if we can find credentials in wp-config or etc
// Actually, let's try to just use VAPTC_DB if we can load it partially

echo "TESTING DB TABLES DIRECTLY\n";

// Try to find table prefix
$wp_load_content = file_get_contents('t:/~/Local925 Sites/vaptbuilder/app/public/wp-load.php');
echo "WP_LOAD LOADED\n";

// Just try to see if we can get a clean error message
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
  include 't:/~/Local925 Sites/vaptbuilder/app/public/wp-load.php';
} catch (Exception $e) {
  echo "EX: " . $e->getMessage() . "\n";
}
echo "\nDONE\n";
