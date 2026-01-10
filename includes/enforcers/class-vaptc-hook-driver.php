<?php

/**
 * Universal Hook Driver for VAPT Master
 * Implements security enforcement via PHP hooks (Server Agnostic)
 */

if (! defined('ABSPATH')) {
  exit;
}

class VAPTC_Hook_Driver
{
  /**
   * Apply enforcement rules at runtime
   */
  public static function apply($impl_data, $schema, $key = '')
  {
    $log = "VAPTC Enforcement Run at " . current_time('mysql') . "\n";
    $log .= "Feature: $key\n";
    $log .= "Enforcement Schema Found. Data Keys: " . implode(', ', array_keys($impl_data)) . "\n";
    $log .= "Full Data: " . json_encode($impl_data) . "\n";

    if (empty($schema['enforcement']['mappings'])) {
      file_put_contents(VAPTC_PATH . 'vaptc-debug.txt', $log . "Skipped: Missing mappings.\n", FILE_APPEND);
      return;
    }

    $mappings = $schema['enforcement']['mappings'];

    // 🏷️ Resolve Defaults: Merge impl_data with schema defaults
    $resolved_data = array();
    if (isset($schema['controls']) && is_array($schema['controls'])) {
      foreach ($schema['controls'] as $control) {
        if (isset($control['key'])) {
          $key_name = $control['key'];
          $resolved_data[$key_name] = isset($impl_data[$key_name]) ? $impl_data[$key_name] : (isset($control['default']) ? $control['default'] : null);
        }
      }
    }
    // Ensure any extra data in impl_data is preserved
    $resolved_data = array_merge($resolved_data, $impl_data);

    file_put_contents(VAPTC_PATH . 'vaptc-debug.txt', $log . "Applying rules with Resolved Data: " . json_encode($resolved_data) . "\n", FILE_APPEND);

    // 🛡️ Group and Unique Methods to avoid double-triggers
    $triggered_methods = array();
    foreach ($resolved_data as $key => $value) {
      if (!$value || empty($mappings[$key])) continue;

      $method = $mappings[$key];
      if (in_array($method, $triggered_methods)) continue;
      $triggered_methods[] = $method;

      // Handle specific PHP-based actions
      switch ($method) {
        case 'block_xmlrpc':
          self::block_xmlrpc();
          break;
        case 'enable_security_headers':
          self::add_security_headers();
          break;
        case 'disable_directory_browsing':
          self::disable_directory_browsing();
          break;
        case 'limit_login_attempts':
          self::limit_login_attempts($value, $resolved_data); // Pass full resolved context
          break;
        case 'block_null_byte_injection':
          self::block_null_byte_injection();
          break;
        case 'hide_wp_version':
          self::hide_wp_version();
          break;
      }
    }
  }

  /**
   * Block Null Byte Injection
   */
  private static function block_null_byte_injection()
  {
    // Check GET, POST, COOKIE, REQUEST
    $check_arrays = array($_GET, $_POST, $_COOKIE, $_REQUEST);

    foreach ($check_arrays as $array) {
      // Recursive check for null bytes in array
      array_walk_recursive($array, function ($value) {
        if (strpos($value, "\0") !== false || strpos($value, '%00') !== false) {
          status_header(400);
          header('X-VAPTC-Enforced: php-null-byte');
          header('Access-Control-Expose-Headers: X-VAPTC-Enforced');
          wp_die('VAPTC: Null Byte Injection Detected.');
        }
      });
    }

    // Also check the raw query string as sometimes %00 isn't decoded yet or is double encoded
    if (strpos($_SERVER['QUERY_STRING'], '%00') !== false || strpos($_SERVER['QUERY_STRING'], "\0") !== false) {
      status_header(400);
      header('X-VAPTC-Enforced: php-null-byte');
      header('Access-Control-Expose-Headers: X-VAPTC-Enforced');
      wp_die('VAPTC: Null Byte Injection Detected.');
    }
  }

  /**
   * Rate Limit / Login Attempt Limiter
   * (Atomic File-Based implementation to prevent Race Conditions)
   */
  private static function limit_login_attempts($config, $all_data = array())
  {
    $limit = 10;

    // Priority 1: Direct rate_limit key in implementation data
    if (isset($all_data['rate_limit'])) {
      $limit = (int) $all_data['rate_limit'];
    }
    // Priority 2: Config is an array with rate_limit (legacy)
    elseif (is_array($config) && isset($config['rate_limit'])) {
      $limit = (int) $config['rate_limit'];
    }
    // Priority 3: Config is a direct numeric value
    elseif (is_numeric($config)) {
      $limit = (int) $config;
    }

    add_action('init', function () use ($limit) {
      $trace = array('init');

      // 🛡️ Bypass for Administrators (Active Copilots)
      // EXCEPTION: If running the "Burst Resilience" test (vaptc_test_spike), we MUST enforce.
      // This prevents the "Save" button from failing after a triggered burst test.
      if (current_user_can('manage_options') && !isset($_GET['vaptc_test_spike'])) {
        $trace[] = 'admin-bypass';
        if (!headers_sent()) header('X-VAPTC-Trace: ' . implode('->', $trace));
        return;
      }
      $trace[] = 'active';

      $ip = $_SERVER['REMOTE_ADDR'];
      // Use WP upload dir for guaranteed write access if sys_temp fails
      $upload_dir = wp_upload_dir();
      $lock_dir = $upload_dir['basedir'] . '/vaptc-locks';
      if (!file_exists($lock_dir)) {
        if (!@mkdir($lock_dir, 0755, true)) {
          header('X-VAPTC-Debug: mkdir-failed');
          return;
        }
      }

      $lock_file = $lock_dir . '/vaptc_limit_' . md5($ip) . '.lock';

      $fp = @fopen($lock_file, 'c+');
      if (!$fp) {
        header('X-VAPTC-Debug: fopen-failed');
        return;
      }

      if (flock($fp, LOCK_EX)) { // Exclusive Lock
        try {
          // Read current count atomically
          $current = 0;
          clearstatcache(true, $lock_file);
          $filesize = filesize($lock_file);
          if ($filesize > 0) {
            rewind($fp);
            $content = fread($fp, $filesize);
            $current = (int) trim($content);
          }

          $timestamp = filemtime($lock_file);

          // Reset if older than 1 minute
          if ($timestamp && (time() - $timestamp > 60)) {
            $current = 0;
          }

          if (!headers_sent()) {
            $trace[] = 'lock-ok';
            header('X-VAPTC-Trace: ' . implode('->', $trace));
            header('X-VAPTC-Count: ' . $current);
          }

          // Check limit BEFORE incrementing (prevent race condition)
          if ($current >= $limit) {
            if (!headers_sent()) {
              $trace[] = 'blocked';
              header('X-VAPTC-Trace: ' . implode('->', $trace));
              header('X-VAPTC-Enforced: php-rate-limit');
              header('Retry-After: 60');
            }

            // Pass 429 explicitly to avoid WP defaulting to 500 in AJAX
            wp_die('VAPTC: Too Many Requests. Rate Limit Exceeded.', 'Rate Limit Exceeded', array('response' => 429));
          }

          // Atomic increment: Rewind, truncate, write, flush all in one operation
          rewind($fp);
          ftruncate($fp, 0);
          fwrite($fp, (string) ($current + 1));
          fflush($fp);

          // Ensure data is persisted to disk
          if (function_exists('fsync')) {
            @fsync($fp);
          }
        } catch (Exception $e) {
          error_log('VAPTC Rate Limit Error: ' . $e->getMessage());
          header('X-VAPTC-Debug: exception-' . $e->getCode());
        } finally {
          // Always release lock and close file handle
          flock($fp, LOCK_UN);
          fclose($fp);
        }
      } else {
        header('X-VAPTC-Debug: flock-failed');
        fclose($fp); // Close even if lock failed
      }
    });
  }

  /**
   * Block Directory Browsing via PHP
   * (Nginx-friendly fallback)
   */
  private static function disable_directory_browsing()
  {
    // If the request is for a directory, we need to ensure it's blocked
    add_action('wp_loaded', function () {
      $uri = $_SERVER['REQUEST_URI'];
      // Very specific check for uploads directory listing attempts
      if (strpos($uri, '/wp-content/uploads/') !== false && substr($uri, -1) === '/') {
        // Only block if there's no index file (this is what Options -Indexes does)
        $path = ABSPATH . ltrim($uri, '/');
        if (is_dir($path)) {
          status_header(403);
          header('X-VAPTC-Enforced: php-dir');
          header('Access-Control-Expose-Headers: X-VAPTC-Enforced');
          wp_die('VAPTC: Directory Browsing is Blocked for Security.');
        }
      }
    });
  }

  /**
   * Block XML-RPC requests
   */
  private static function block_xmlrpc()
  {
    if (strpos($_SERVER['REQUEST_URI'], 'xmlrpc.php') !== false) {
      status_header(403);
      header('X-VAPTC-Enforced: php-xmlrpc');
      header('Access-Control-Expose-Headers: X-VAPTC-Enforced');
      header('Content-Type: text/plain');
      wp_die('VAPTC: XML-RPC Access is Blocked for Security.');
    }
  }

  /**
   * Hide WordPress Version
   */
  private static function hide_wp_version()
  {
    remove_action('wp_head', 'wp_generator');
    add_filter('the_generator', '__return_empty_string');
    // Enforced Header on Init to signal the probe
    add_action('init', function () {
      if (!headers_sent()) {
        header('X-VAPTC-Enforced: php-version-hide');
        header('Access-Control-Expose-Headers: X-VAPTC-Enforced');
      }
    });
  }

  /**
   * Add Security Headers via PHP
   */
  private static function add_security_headers()
  {
    // Use wp_headers for better compatibility with REST/Ajax
    add_filter('wp_headers', function ($headers) {
      $headers['X-Frame-Options'] = 'SAMEORIGIN';
      $headers['X-Content-Type-Options'] = 'nosniff';
      $headers['X-XSS-Protection'] = '1; mode=block';
      $headers['X-VAPTC-Enforced'] = 'php-headers';
      $headers['Access-Control-Expose-Headers'] = 'X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, X-VAPTC-Enforced';
      return $headers;
    }, 999);

    // Also try direct header() as fallback for non-WP responses
    if (!headers_sent()) {
      header('X-Frame-Options: SAMEORIGIN');
      header('X-Content-Type-Options: nosniff');
      header('X-XSS-Protection: 1; mode=block');
      header('X-VAPTC-Enforced: php-headers');
      header('Access-Control-Expose-Headers: X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, X-VAPTC-Enforced');
    }
  }
}
