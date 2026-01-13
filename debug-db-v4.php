<?php
// Find WP config
$dir = dirname(__FILE__);
while ($dir !== '/' && !file_exists($dir . '/wp-config.php')) {
  $dir = dirname($dir);
}

if (!file_exists($dir . '/wp-config.php')) {
  die("wp-config.php not found");
}

$config = file_get_contents($dir . '/wp-config.php');
preg_match("/define\(\s*'DB_NAME',\s*'([^']*)'/", $config, $match_name);
preg_match("/define\(\s*'DB_USER',\s*'([^']*)'/", $config, $match_user);
preg_match("/define\(\s*'DB_PASSWORD',\s*'([^']*)'/", $config, $match_pass);
preg_match("/define\(\s*'DB_HOST',\s*'([^']*)'/", $config, $match_host);
preg_match("/\$table_prefix\s*=\s*'([^']*)'/", $config, $match_prefix);

$db_name = $match_name[1];
$db_user = $match_user[1];
$db_pass = $match_pass[1];
$db_host = $match_host[1];
$prefix  = $match_prefix[1];

$mysqli = new mysqli($db_host, $db_user, $db_pass, $db_name);
if ($mysqli->connect_error) {
  die("Connect Error: " . $mysqli->connect_error);
}

$opts = ['vaptc_hidden_json_files', 'vaptc_active_feature_file'];
foreach ($opts as $opt) {
  $res = $mysqli->query("SELECT option_value FROM {$prefix}options WHERE option_name = '$opt'");
  if ($res && $res->num_rows > 0) {
    $row = $res->fetch_assoc();
    echo "$opt: " . $row['option_value'] . "\n";
  } else {
    echo "$opt: NOT FOUND\n";
  }
}
$mysqli->close();
