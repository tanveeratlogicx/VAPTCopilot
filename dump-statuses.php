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
$res = $conn->query("SHOW TABLES LIKE '%vaptc_feature_status'");
$row = $res->fetch_row();
if (!$row) {
  die("Could not find table prefix.\n");
}
$prefix = str_replace('vaptc_feature_status', '', $row[0]);
$status_table = $prefix . 'vaptc_feature_status';

echo "--- ALL FEATURE STATUSES ---\n";
$res = $conn->query("SELECT * FROM $status_table");
$found = false;
while ($row = $res->fetch_assoc()) {
  $found = true;
  printf("[%s] %s\n", $row['status'], $row['feature_key']);
}
if (!$found) echo "No features found in status table.\n";

$conn->close();
