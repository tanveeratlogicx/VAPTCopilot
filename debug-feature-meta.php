<?php
$host = 'localhost';
$user = 'root';
$pass = 'root';
$db   = 'local';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

// Get table prefix
$res = $conn->query("SHOW TABLES LIKE '%vaptc_feature_meta'");
$row = $res->fetch_row();
if (!$row) {
  die("Could not find table prefix.\n");
}
$prefix = str_replace('vaptc_feature_meta', '', $row[0]);
$meta_table = $prefix . 'vaptc_feature_meta';

$key = 'WP-VERSION-DISCLOSURE';
echo "--- METADATA FOR $key ---\n";
$res = $conn->query("SELECT * FROM $meta_table WHERE feature_key = '$key'");
if ($row = $res->fetch_assoc()) {
  print_r($row);
} else {
  echo "Feature not found in meta table.\n";
}

$conn->close();
