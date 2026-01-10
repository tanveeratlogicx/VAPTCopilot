<?php

/**
 * VAPTM_Htaccess_Driver
 * Handles enforcement of rules into .htaccess
 */

if (!defined('ABSPATH')) exit;

class VAPTC_Htaccess_Driver
{
  /**
   * Whitelist of allowed .htaccess directives for security
   * Prevents injection of dangerous PHP/Server directives
   */
  private static $allowed_directives = [
    'Options', 'Header', 'Files', 'FilesMatch', 
    'IfModule', 'Order', 'Deny', 'Allow', 'Directory', 'DirectoryMatch'
  ];

  /**
   * Dangerous patterns that should never be allowed
   */
  private static $dangerous_patterns = [
    '/php_value/i',
    '/php_admin_value/i',
    '/SetEnvIf.*passthrough/i',
    '/RewriteRule.*passthrough/i',
    '/RewriteRule.*exec/i',
    '/<FilesMatch.*\.php/i', // Prevent PHP execution blocking (can break site)
    '/php_flag\s/i',
    '/AddHandler.*php/i',
    '/Action\s/i',
    '/SetHandler\s/i'
  ];

  public static function enforce($data, $schema)
  {
    $log = "[Htaccess Debug " . date('Y-m-d H:i:s') . "] Enforce Called.\n";
    $log .= "Data Keys: " . implode(',', array_keys($data)) . "\n";
    $log .= "Schema Driver: " . ($schema['enforcement']['driver'] ?? 'N/A') . "\n";
    $log .= "Mappings: " . json_encode($schema['enforcement']['mappings'] ?? []) . "\n";
    $enf_config = isset($schema['enforcement']) ? $schema['enforcement'] : array();
    $target_key = isset($enf_config['target']) ? $enf_config['target'] : 'root';

    $htaccess_path = ABSPATH . '.htaccess';
    if ($target_key === 'uploads') {
      $upload_dir = wp_upload_dir();
      $htaccess_path = $upload_dir['basedir'] . '/.htaccess';
    }

    // If it's a sub-folder and we are DE-enforcing, we might just want to delete the file
    if (empty($data) && $target_key !== 'root') {
      if (file_exists($htaccess_path)) {
        @unlink($htaccess_path);
      }
      return;
    }

    // Ensure directories exist
    $dir = dirname($htaccess_path);
    if (!is_dir($dir)) {
      wp_mkdir_p($dir);
    }

    // Load existing content or start fresh for sub-folders
    $content = "";
    if (file_exists($htaccess_path)) {
      $content = file_get_contents($htaccess_path);
    }

    $start_marker = "# BEGIN VAPTC SECURITY RULES";
    $end_marker = "# END VAPTC SECURITY RULES";

    $rules = array();
    $mappings = isset($enf_config['mappings']) ? $enf_config['mappings'] : array();

    foreach ($mappings as $key => $directive) {
      if (!empty($data[$key])) {
        // Validate directive before adding
        $validation = self::validate_htaccess_directive($directive);
        if ($validation['valid']) {
          $rules[] = $directive;
        } else {
          $log .= "SECURITY: Rejected directive for key '$key': " . $validation['reason'] . "\n";
          error_log(sprintf(
            'VAPTM: Invalid .htaccess directive rejected for feature %s (key: %s). Reason: %s',
            $schema['feature_key'] ?? 'unknown',
            $key,
            $validation['reason']
          ));
          // Optionally notify admin
          set_transient(
            'vaptm_htaccess_validation_error_' . time(),
            sprintf(
              'Security: Invalid .htaccess directive rejected for "%s". Reason: %s',
              $key,
              $validation['reason']
            ),
            300
          );
        }
      }
    }

    // Generate the block
    $rules_string = "";
    if (!empty($rules)) {
      $rules_string = "\n" . $start_marker . "\n" . implode("\n\n", $rules) . "\n" . $end_marker . "\n";
    }
    $log .= "Generated Rules String Length: " . strlen($rules_string) . "\n";
    file_put_contents(WP_CONTENT_DIR . '/vaptc-htaccess-debug.txt', $log, FILE_APPEND);

    // For root .htaccess, use markers and preserve content
    if ($target_key === 'root') {
      $pattern = "/# BEGIN VAPTC SECURITY RULES.*?# END VAPTC SECURITY RULES/s";
      if (preg_match($pattern, $content)) {
        $new_content = preg_replace($pattern, trim($rules_string), $content);
      } else {
        if (strpos($content, "# END WordPress") !== false) {
          $new_content = str_replace("# END WordPress", "# END WordPress\n" . $rules_string, $content);
        } else {
          $new_content = $content . $rules_string;
        }
      }
    } else {
      // For others (like uploads), we might just overwrite or use markers
      // For now, let's just overwrite for specific sub-files for simplicity
      $new_content = trim($rules_string);
      if (empty($new_content)) {
        if (file_exists($htaccess_path)) @unlink($htaccess_path);
        return;
      }
    }

    if (!empty($new_content) || file_exists($htaccess_path)) {
      $result = @file_put_contents($htaccess_path, trim($new_content) . "\n");
      if ($result === false) {
        $log .= "ERROR: Failed to write .htaccess to $htaccess_path\n";
        error_log("VAPTC: Failed to write .htaccess to $htaccess_path. Check file permissions.");
        set_transient(
          'vaptc_htaccess_write_error_' . time(),
          "Failed to update .htaccess file. Please check file permissions.",
          300
        );
      } else {
        $log .= "SUCCESS: .htaccess updated successfully.\n";
      }
      file_put_contents(WP_CONTENT_DIR . '/vaptc-htaccess-debug.txt', $log, FILE_APPEND);
    }
  }

  /**
   * Validate .htaccess directive to prevent injection attacks
   * 
   * @param string $directive The directive string to validate
   * @return array ['valid' => bool, 'reason' => string]
   */
  private static function validate_htaccess_directive($directive)
  {
    if (empty($directive) || !is_string($directive)) {
      return ['valid' => false, 'reason' => 'Directive must be a non-empty string'];
    }

    // Check for dangerous patterns
    foreach (self::$dangerous_patterns as $pattern) {
      if (preg_match($pattern, $directive)) {
        return [
          'valid' => false,
          'reason' => sprintf('Contains dangerous pattern: %s', $pattern)
        ];
      }
    }

    // Check for suspicious PHP execution patterns
    if (preg_match('/<[^>]*php[^>]*>/i', $directive)) {
      return ['valid' => false, 'reason' => 'Contains PHP-related tags'];
    }

    // Basic sanitization: Check for unescaped special characters that could break .htaccess
    // Allow normal directives like "Options -Indexes" or "Header set X-Frame-Options..."
    if (preg_match('/[<>{}]/', $directive) && !preg_match('/<(?:IfModule|Files|Directory|FilesMatch|DirectoryMatch)/i', $directive)) {
      return ['valid' => false, 'reason' => 'Contains unescaped special characters'];
    }

    // Maximum length check (prevent DoS via extremely long directives)
    if (strlen($directive) > 4096) {
      return ['valid' => false, 'reason' => 'Directive exceeds maximum length (4096 characters)'];
    }

    return ['valid' => true, 'reason' => ''];
  }
}
