<?php
$host = 'localhost';
$user = 'root';
$pass = 'root';
$db   = 'local';

$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) {
  die("Connection failed: " . $conn->connect_error);
}

echo "DB Connection SUCCESS\n";

// Get table prefix
$res = $conn->query("SHOW TABLES LIKE '%vaptc_feature_status'");
$row = $res->fetch_row();
if (!$row) {
  die("Could not find table prefix. Searching all tables...\n");
}
$prefix = str_replace('vaptc_feature_status', '', $row[0]);
echo "Table Prefix: $prefix\n";

$status_table = $prefix . 'vaptc_feature_status';
$meta_table = $prefix . 'vaptc_feature_meta';

echo "\n--- FEATURE STATUSES ---\n";
$res = $conn->query("SELECT * FROM $status_table");
while ($row = $res->fetch_assoc()) {
  print_r($row);
}

echo "\n--- XML-RPC SPECIFIC CHECK ---\n";
$res = $conn->query("SELECT * FROM $status_table WHERE feature_key LIKE '%xmlrpc%'");
while ($row = $res->fetch_assoc()) {
  echo "Found in Status Table:\n";
  print_r($row);
}

$res = $conn->query("SELECT feature_key, label, status FROM $meta_table WHERE feature_key LIKE '%xmlrpc%'");
while ($row = $res->fetch_assoc()) {
  echo "Found in Meta Table:\n";
  print_r($row);
}

$conn->close();
echo "\nDONE\n";
