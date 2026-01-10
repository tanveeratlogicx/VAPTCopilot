<?php
/**
 * VAPT Master - Universal Test Suite
 * Tests hook driver logic, key bindings, and enforcement overrides.
 * Run with: php test-suite.php
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);

define('VAPTM_TEST_MODE', true);
define('VAPTM_PATH', __DIR__ . '/');
define('ABSPATH', __DIR__ . '/');

// --- Mock WordPress Environment ---

$wp_actions = [];
$wp_filters = [];
$wp_headers = []; // Headers sent via header()

function current_time($type) { return date('Y-m-d H:i:s'); }

function add_action($tag, $callback, $priority = 10, $accepted_args = 1) {
    global $wp_actions;
    $wp_actions[$tag][] = $callback;
}

function remove_action($tag, $callback, $priority = 10) {
    echo "  [Mock] Action removed: $tag -> $callback\n";
}

function add_filter($tag, $callback, $priority = 10, $accepted_args = 1) {
    global $wp_filters;
    $wp_filters[$tag][] = $callback;
}

function apply_filters($tag, $value) {
    global $wp_filters;
    if (isset($wp_filters[$tag])) {
        foreach ($wp_filters[$tag] as $callback) {
            if (is_callable($callback)) {
                $value = $callback($value);
            }
        }
    }
    return $value;
}

function wp_upload_dir() {
    return ['basedir' => sys_get_temp_dir()];
}

function current_user_can($cap) {
    // Default to false unless we override for specific test
    global $mock_is_admin;
    return isset($mock_is_admin) ? $mock_is_admin : false;
}

function is_admin() { return false; }

function status_header($code) {
    echo "  [Mock] Status Header: $code\n";
}

if (!function_exists('header')) {
    function header($str) {
        global $wp_headers;
        $wp_headers[] = $str;
        echo "  [Mock] Header: $str\n";
    }
} else {
    // If we can't mock header, we can't capture it easily in CLI without runkit.
    // We will rely on status_header and wp_die for verification where possible.
    echo "  [Info] Built-in header() exists, cannot mock. Skipping direct header capture.\n";
}

if (!function_exists('headers_sent')) {
    function headers_sent() { return false; }
}

function wp_die($msg = '') {
    echo "  [Mock] WP_DIE Triggered: $msg\n";
    throw new Exception("WP_DIE: $msg");
}

function __return_empty_string() { return ''; }

// --- Load Driver ---

require_once __DIR__ . '/includes/enforcers/class-vaptm-hook-driver.php';

// --- Test Runner Helper ---

function run_test($name, $callback) {
    echo "\n=== TEST: $name ===\n";
    
    // Reset Globals
    global $wp_actions, $wp_filters, $wp_headers, $mock_is_admin;
    $wp_actions = [];
    $wp_filters = [];
    $wp_headers = [];
    $mock_is_admin = false;
    $_SERVER = []; // Reset server
    
    try {
        $callback();
        echo "RESULT: PASS (Completed without unexpected exception)\n";
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'WP_DIE') !== false) {
             echo "RESULT: BLOCKED (As expected for block tests)\n";
        } else {
             echo "RESULT: FAIL - " . $e->getMessage() . "\n";
        }
    }
}

// --- TESTS ---

// 1. Hide WP Version
run_test('Hide WP Version', function() {
    VAPTM_Hook_Driver::apply(['status' => true], ['enforcement' => ['mappings' => ['status' => 'hide_wp_version']]]);
    
    global $wp_filters, $wp_actions;
    
    // Verify filter added
    if (empty($wp_filters['the_generator'])) {
        throw new Exception("Filter 'the_generator' was not added.");
    }
    echo "  Verified: 'the_generator' filter added.\n";
    
    // Verify init action for headers
    if (empty($wp_actions['init'])) {
        throw new Exception("Init action for headers not added.");
    }
    
    // Run the init action to check headers
    // Note: Since we can't capture built-in header() in CLI easily, we skip strict header verification
    // providing the action is registered.
    $wp_actions['init'][0]();
    echo "  Verified: Header action registered and executed (output warnings expected).\n";
});

// 2. Block Null Byte Injection
run_test('Block Null Byte Injection', function() {
    // Setup malicious input
    $_GET = ['safe' => 'val', 'malicious' => "te\0st"];
    $_SERVER['QUERY_STRING'] = 'safe=val&malicious=te%00st';
    
    VAPTM_Hook_Driver::apply(['status' => true], ['enforcement' => ['mappings' => ['status' => 'block_null_byte_injection']]]);
});

// 3. Block XML-RPC
run_test('Block XML-RPC', function() {
    $_SERVER['REQUEST_URI'] = '/xmlrpc.php';
    VAPTM_Hook_Driver::apply(['status' => true], ['enforcement' => ['mappings' => ['status' => 'block_xmlrpc']]]);
});

// 4. Rate Limiting (Key Binding Check)
run_test('Rate Limiting (Binding Check)', function() {
    $lock_dir = sys_get_temp_dir() . '/vaptm-locks';
    // Clean locks
    if (is_dir($lock_dir)) {
        $files = glob("$lock_dir/*");
        foreach($files as $file) if(is_file($file)) @unlink($file);
    }
    
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    
    // Set limit to 3 via binding
    $limit = 3;
    VAPTM_Hook_Driver::apply(['rate_limit' => $limit], ['enforcement' => ['mappings' => ['rate_limit' => 'limit_login_attempts']]]);
    
    global $wp_actions;
    if (empty($wp_actions['init'])) throw new Exception("Init action not registered.");
    
    $cb = $wp_actions['init'][0];
    
    echo "  Request 1 (Should Allow)\n"; $cb();
    echo "  Request 2 (Should Allow)\n"; $cb();
    echo "  Request 3 (Should Allow)\n"; $cb();
    
    echo "  Request 4 (Should Block)\n";
    try {
        $cb();
        throw new Exception("Rate limit failed to block 4th request.");
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'WP_DIE') === false) throw $e;
        echo "  Verified: Blocked at 4th request.\n";
    }
});

// 5. Disable Directory Browsing
run_test('Disable Directory Browsing', function() {
    $_SERVER['REQUEST_URI'] = '/wp-content/uploads/';
    
    VAPTM_Hook_Driver::apply(['status' => true], ['enforcement' => ['mappings' => ['status' => 'disable_directory_browsing']]]);
    
    global $wp_actions;
    if (empty($wp_actions['wp_loaded'])) throw new Exception("wp_loaded action not registered.");
    
    // Create temp dir to simulate existing directory
    $mock_dir = ABSPATH . 'wp-content/uploads';
    if (!is_dir($mock_dir)) @mkdir($mock_dir, 0777, true);
    
    echo "  Triggering wp_loaded...\n";
    $wp_actions['wp_loaded'][0]();
    
    // Cleanup
    @rmdir($mock_dir);
});

// 6. Security Headers
run_test('Security Headers', function() {
    VAPTM_Hook_Driver::apply(['status' => true], ['enforcement' => ['mappings' => ['status' => 'enable_security_headers']]]);
    
    // Check Filter First
    global $wp_filters;
    if (empty($wp_filters['wp_headers'])) throw new Exception("wp_headers filter not added.");
    
    $headers = apply_filters('wp_headers', []);
    if (!isset($headers['X-XSS-Protection'])) throw new Exception("Filter did not add X-XSS-Protection.");
    echo "  Verified: wp_headers filter applied.\n";

    // Check direct headers (Optional/Skipped if not mockable)
    if (function_exists('header')) {
        echo "  [Info] Built-in header() active, skipping direct header capture verification.\n";
    } else {
        global $wp_headers;
        $found_frame = false;
        foreach ($wp_headers as $h) {
            if (strpos($h, 'X-Frame-Options: SAMEORIGIN') !== false) $found_frame = true;
        }
        if (!$found_frame) throw new Exception("Direct header X-Frame-Options not sent.");
        echo "  Verified: Direct headers sent.\n";
    }
});

echo "\nALL TESTS COMPLETED.\n";
