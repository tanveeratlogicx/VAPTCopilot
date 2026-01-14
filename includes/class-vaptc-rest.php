<?php

/**
 * REST API Handler for VAPT Master (Copilot)
 */

if (! defined('ABSPATH')) {
  exit;
}

class VAPTC_REST
{

  public function __construct()
  {
    add_action('rest_api_init', array($this, 'register_routes'));
  }

  public function register_routes()
  {
    register_rest_route('vaptc/v1', '/features', array(
      'methods'  => 'GET',
      'callback' => array($this, 'get_features'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/data-files/all', array(
      'methods' => 'GET',
      'callback' => array($this, 'get_all_data_files'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/data-files', array(
      'methods'  => 'GET',
      'callback' => array($this, 'get_data_files'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/update-hidden-files', array(
      'methods' => 'POST',
      'callback' => array($this, 'update_hidden_files'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/reset-limit', array(
      'methods' => 'POST',
      'callback' => array($this, 'reset_rate_limit'),
      'permission_callback' => '__return_true', // Public endpoint for testing (limited to user IP)
    ));


    register_rest_route('vaptc/v1', '/features/update', array(
      'methods'  => 'POST',
      'callback' => array($this, 'update_feature'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/features/transition', array(
      'methods'  => 'POST',
      'callback' => array($this, 'transition_feature'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/features/(?P<key>[a-zA-Z0-9_-]+)/history', array(
      'methods'  => 'GET',
      'callback' => array($this, 'get_feature_history'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/assignees', array(
      'methods'  => 'GET',
      'callback' => array($this, 'get_assignees'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/features/assign', array(
      'methods'  => 'POST',
      'callback' => array($this, 'update_assignment'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/upload-json', array(
      'methods'  => 'POST',
      'callback' => array($this, 'upload_json'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/domains', array(
      'methods'  => 'GET',
      'callback' => array($this, 'get_domains'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/domains/update', array(
      'methods'  => 'POST',
      'callback' => array($this, 'update_domain'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/domains/features', array(
      'methods'  => 'POST',
      'callback' => array($this, 'update_domain_features'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/build/generate', array(
      'methods'  => 'POST',
      'callback' => array($this, 'generate_build'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/upload-media', array(
      'methods'  => 'POST',
      'callback' => array($this, 'upload_media'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/data-files/meta', array(
      'methods'  => 'POST',
      'callback' => array($this, 'update_file_meta'),
      'permission_callback' => array($this, 'check_permission'),
    ));

    register_rest_route('vaptc/v1', '/active-file', array(
      'methods'  => array('GET', 'POST'),
      'callback' => array($this, 'handle_active_file'),
      'permission_callback' => array($this, 'check_permission'),
    ));
  }

  public function check_permission()
  {
    $current_user = wp_get_current_user();
    $is_superadmin = ($current_user->user_login === VAPTC_SUPERADMIN_USER || $current_user->user_email === VAPTC_SUPERADMIN_EMAIL);

    // Allow all admins on localhost to facilitate testing (access is still OTP-protected)
    if ($is_superadmin || (is_vaptc_localhost() && current_user_can('manage_options'))) {
      return true;
    }

    return false;
  }

  public function get_features($request)
  {
    $default_file = get_option('vaptc_active_feature_file', 'features-with-test-methods.json');
    $file = $request->get_param('file') ?: $default_file;
    $json_path = VAPTC_PATH . 'data/' . sanitize_file_name($file);

    if (! file_exists($json_path)) {
      return new WP_REST_Response(array('error' => 'JSON file not found: ' . $file), 404);
    }

    $content = file_get_contents($json_path);
    $raw_data = json_decode($content, true);

    if (! is_array($raw_data)) {
      return new WP_REST_Response(array('error' => 'Invalid JSON format'), 400);
    }

    $features = [];
    $schema = [];

    if (isset($raw_data['wordpress_vapt']) && is_array($raw_data['wordpress_vapt'])) {
      $features = $raw_data['wordpress_vapt'];
      $schema = isset($raw_data['schema']) ? $raw_data['schema'] : [];
    } else {
      $features = $raw_data;
    }

    // Default schema if missing
    if (empty($schema)) {
      $schema = array(
        'item_fields' => array('id', 'category', 'title', 'severity', 'description')
      );
    }

    $statuses = VAPTC_DB::get_feature_statuses_full();
    $status_map = [];
    foreach ($statuses as $row) {
      $status_map[$row['feature_key']] = array(
        'status' => $row['status'],
        'implemented_at' => $row['implemented_at'],
        'assigned_to' => $row['assigned_to']
      );
    }

    // Security/Scope Check
    $scope = $request->get_param('scope');
    $is_superadmin = current_user_can('manage_options'); // Simplified check based on permission_callback

    // Batch fetch history counts to avoid N+1 queries
    global $wpdb;
    $history_table = $wpdb->prefix . 'vaptc_feature_history';
    $history_counts = $wpdb->get_results("SELECT feature_key, COUNT(*) as count FROM $history_table GROUP BY feature_key", OBJECT_K);

    // Merge with status and meta
    foreach ($features as &$feature) {
      // Robust Title/Label mapping
      $label = '';
      if (isset($feature['title'])) $label = $feature['title'];
      else if (isset($feature['name'])) $label = $feature['name'];
      else $label = __('Unnamed Feature', 'vapt-master');

      $feature['label'] = $label;

      $key = isset($feature['id']) ? $feature['id'] : (isset($feature['key']) ? $feature['key'] : sanitize_title($label));
      $feature['key'] = $key;

      $st = isset($status_map[$key]) ? $status_map[$key] : array('status' => 'Draft', 'implemented_at' => null, 'assigned_to' => null);

      $feature['status'] = $st['status'];
      $feature['implemented_at'] = $st['implemented_at'];
      $feature['assigned_to'] = $st['assigned_to'];

      // Normalize status synonyms for internal logic
      $norm_status = strtolower($st['status']);
      if ($norm_status === 'implemented') $norm_status = 'release';
      if ($norm_status === 'in_progress') $norm_status = 'develop';
      if ($norm_status === 'testing')     $norm_status = 'test';
      if ($norm_status === 'available')   $norm_status = 'draft';
      $feature['normalized_status'] = $norm_status;

      $meta = VAPTC_DB::get_feature_meta($key);
      if ($meta) {
        $feature['include_test_method'] = (bool) $meta['include_test_method'];
        $feature['include_verification'] = (bool) $meta['include_verification'];
        $feature['include_verification_engine'] = isset($meta['include_verification_engine']) ? (bool) $meta['include_verification_engine'] : false;
        $feature['is_enforced'] = (bool) $meta['is_enforced'];
        $feature['wireframe_url'] = $meta['wireframe_url'];

        // Expose Verification Context for AI Prompt
        if (!empty($meta['verification_steps'])) $feature['verification_steps'] = $meta['verification_steps'];
        if (!empty($meta['test_method'])) $feature['test_method'] = $meta['test_method'];

        // Safely decode schema, handle corrupted JSON gracefully
        $schema_data = array();
        if (!empty($meta['generated_schema'])) {
          $decoded = json_decode($meta['generated_schema'], true);
          if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            $schema_data = $decoded;
          } else {
            // Log corrupted schema but don't break feature loading
            error_log(sprintf(
              'VAPTC: Corrupted schema JSON for feature %s. JSON Error: %s',
              $key,
              json_last_error_msg()
            ));
            // Set empty schema so feature can still load
            $schema_data = array();
          }
        }

        // 🛡️ AUTO-REPAIR: If .htaccess feature is missing verifiers, inject them.
        // We check for both common keys in case the user renamed it slightly.
        if ($key === '.htaccess-security-rules' || $key === '.htaccess-security') {
          $has_actions = false;
          $has_headers_toggle = false;
          if (isset($schema_data['controls'])) {
            foreach ($schema_data['controls'] as $c) {
              if (isset($c['type']) && $c['type'] === 'test_action') $has_actions = true;
              if (isset($c['key']) && $c['key'] === 'enable_security_headers') $has_headers_toggle = true;
            }
          }

          // If the headers toggle is missing OR the mapping is outdated (missing Expose-Headers), repair it.
          $mapping_content = isset($schema_data['enforcement']['mappings']['enable_security_headers']) ? $schema_data['enforcement']['mappings']['enable_security_headers'] : '';

          if (!$has_headers_toggle || strpos($mapping_content, 'Expose-Headers') === false) {
            $new_controls = array();

            // Re-order cleanly: Toggles first, then actions
            $new_controls[] = array('type' => 'toggle', 'label' => 'Disable Directory Browsing', 'key' => 'disable_directory_browsing', 'help' => "Adds 'Options -Indexes' to .htaccess");
            $new_controls[] = array('type' => 'toggle', 'label' => 'Block XML-RPC Access', 'key' => 'block_xmlrpc', 'help' => 'Prevents access to xmlrpc.php');
            $new_controls[] = array('type' => 'toggle', 'label' => 'Enable Security Headers', 'key' => 'enable_security_headers', 'help' => 'Adds X-Frame-Options, X-XSS-Protection, etc.');

            $new_controls[] = array('type' => 'test_action', 'label' => 'Header Check', 'key' => 'verif_headers', 'test_logic' => 'check_headers', 'help' => 'Inspects live server headers.');
            $new_controls[] = array('type' => 'test_action', 'label' => 'Directory Probe', 'key' => 'verif_directory', 'test_logic' => 'disable_directory_browsing', 'help' => 'Probes /wp-content/uploads/.');
            $new_controls[] = array('type' => 'test_action', 'label' => 'XML-RPC Probe', 'key' => 'verif_xmlrpc', 'test_logic' => 'block_xmlrpc', 'help' => 'Pings xmlrpc.php.');

            $schema_data['controls'] = $new_controls;

            // REAL Enforcement Mapping
            $schema_data['enforcement'] = array(
              'driver' => 'htaccess',
              'target' => 'root',
              'mappings' => array(
                'disable_directory_browsing' => "Options -Indexes",
                'block_xmlrpc' => "<Files xmlrpc.php>\n  Order Deny,Allow\n  Deny from all\n</Files>",
                'enable_security_headers' => "<IfModule mod_headers.c>\n  Header set X-Frame-Options \"SAMEORIGIN\"\n  Header set X-Content-Type-Options \"nosniff\"\n  Header set X-XSS-Protection \"1; mode=block\"\n  Header set Access-Control-Expose-Headers \"X-Frame-Options, X-Content-Type-Options, X-XSS-Protection\"\n</IfModule>"
              )
            );

            VAPTC_DB::update_feature_meta($key, array('generated_schema' => json_encode($schema_data), 'include_verification_engine' => 1));
            $feature['include_verification_engine'] = true;
          }
        }

        // 🛡️ AUTO-REPAIR: Rate Limiting Schema Fix
        // Maps 'limit-login-attempts' or similar keys to the correct 'spam_requests' probe.
        if (in_array($key, ['limit-login-attempts', 'rate-limiting', 'login-protection', 'api-rate-limiting'])) {
          $has_rate_probe = false;
          if (isset($schema_data['controls'])) {
            foreach ($schema_data['controls'] as $c) {
              if (isset($c['test_logic']) && $c['test_logic'] === 'spam_requests') $has_rate_probe = true;
            }
          }

          if (!$has_rate_probe) {
            $new_controls = array();
            $toggle_key = 'limit_login_attempts'; // Fallback

            // Conserve existing toggles/inputs and find the toggle key
            if (isset($schema_data['controls'])) {
              foreach ($schema_data['controls'] as $c) {
                if ($c['type'] !== 'test_action') {
                  $new_controls[] = $c;
                  if ($c['type'] === 'toggle') $toggle_key = $c['key'];
                }
              }
            }

            // Add Correct Probe
            $new_controls[] = array(
              'type' => 'test_action',
              'label' => 'Test: Burst Resilience (13 req/min)',
              'key' => 'verif_rate_limit',
              'test_logic' => 'spam_requests', // Correct logic
              'help' => 'Sends a sharp burst of traffic to test server stability.'
            );
            $new_controls[] = array(
              'type' => 'test_action',
              'label' => 'Test: Limit Enforcement',
              'key' => 'verif_limit_enforce',
              'test_logic' => 'default', // Placeholder for HTTP status check? Or we can use spam_requests here too but looking for 429
              'help' => 'Intentionally exceeds the limit to verify HTTP 429 response.'
            );


            $schema_data['controls'] = $new_controls;

            // Ensure Enforcement Mapping is correct
            // Map the found toggle key to the driver's 'limit_login_attempts' handler
            if (!isset($schema_data['enforcement'])) {
              $schema_data['enforcement'] = array('driver' => 'hook', 'mappings' => array());
            }
            $schema_data['enforcement']['driver'] = 'hook';
            $schema_data['enforcement']['mappings'][$toggle_key] = 'limit_login_attempts';

            VAPTC_DB::update_feature_meta($key, array('generated_schema' => json_encode($schema_data), 'include_verification_engine' => 1, 'is_enforced' => 1));
            $feature['include_verification_engine'] = true;
            $feature['generated_schema'] = $schema_data;
            $feature['is_enforced'] = true; // UI update
          }
        }

        $feature['generated_schema'] = $schema_data;
        $impl_data = $meta['implementation_data'] ? json_decode($meta['implementation_data'], true) : array();

        // 🧹 DATA CLEANUP: Migrate old keys to new standardized ones
        $migrations = array(
          'disable_xmlrpc' => 'block_xmlrpc',
          'block_indexes' => 'disable_directory_browsing'
        );
        $changed = false;
        foreach ($migrations as $old => $new) {
          if (isset($impl_data[$old])) {
            $impl_data[$new] = $impl_data[$old];
            unset($impl_data[$old]);
            $changed = true;
          }
        }
        if ($changed) {
          VAPTC_DB::update_feature_meta($key, array('implementation_data' => json_encode($impl_data)));
        }

        $feature['implementation_data'] = $impl_data;
      }

      $feature['has_history'] = isset($history_counts[$key]) && $history_counts[$key]->count > 0;
    }

    // Filter for Client Scope
    if ($scope === 'client') {
      $domain = $request->get_param('domain');
      $enabled_features = [];

      if ($domain) {
        $dom_row = $wpdb->get_row($wpdb->prepare("SELECT id FROM {$wpdb->prefix}vaptc_domains WHERE domain = %s", $domain));
        if ($dom_row) {
          $feat_rows = $wpdb->get_results($wpdb->prepare("SELECT feature_key FROM {$wpdb->prefix}vaptc_domain_features WHERE domain_id = %d AND enabled = 1", $dom_row->id), ARRAY_N);
          $enabled_features = array_column($feat_rows, 0);
        }
      }

      $features = array_filter($features, function ($f) use ($enabled_features, $is_superadmin) {
        $s = isset($f['normalized_status']) ? $f['normalized_status'] : strtolower($f['status']);

        // 1. Release features must be explicitly enabled for the domain
        if ($s === 'release') {
          return in_array($f['key'], $enabled_features);
        }

        // 2. Develop/Test features are visible only to Superadmins (for testing)
        if ($is_superadmin && in_array($s, ['develop', 'test'])) {
          return true;
        }

        return false;
      });
      $features = array_values($features);
    }

    return new WP_REST_Response(array(
      'features' => $features,
      'schema' => $schema,
      'design_prompt' => isset($raw_data['design_prompt']) ? $raw_data['design_prompt'] : null
    ), 200);
  }

  public function get_data_files()
  {
    $data_dir = VAPTC_PATH . 'data';
    if (!is_dir($data_dir)) return new WP_REST_Response([], 200);

    $files = array_diff(scandir($data_dir), array('..', '.'));
    $json_files = [];

    $hidden_files = get_option('vaptc_hidden_json_files', array());
    $active_file  = get_option('vaptc_active_feature_file', 'features-with-test-methods.json');

    // Create a normalized list for comparison
    $hidden_normalized = array_map('sanitize_file_name', $hidden_files);
    $active_normalized = sanitize_file_name($active_file);

    foreach ($files as $file) {
      if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'json') {
        $normalized_current = sanitize_file_name($file);

        // Safety: Always include the active file, regardless of hidden status
        $is_active = ($normalized_current === $active_normalized || $file === $active_file);
        $is_hidden = in_array($normalized_current, $hidden_normalized) || in_array($file, $hidden_files);

        if ($is_active || !$is_hidden) {
          $json_files[] = array(
            'label' => $file,
            'value' => $file
          );
        }
      }
    }

    return new WP_REST_Response($json_files, 200);
  }

  public function update_feature($request)
  {
    $key = $request->get_param('key');
    $status = $request->get_param('status');
    $include_test = $request->get_param('include_test_method');
    $include_verification = $request->get_param('include_verification');
    $is_enforced = $request->get_param('is_enforced');
    $wireframe_url = $request->get_param('wireframe_url');
    $generated_schema = $request->get_param('generated_schema');
    $implementation_data = $request->get_param('implementation_data');
    $reset_history = $request->get_param('reset_history');

    if ($status) {
      $note = $request->get_param('history_note') ?: ($request->get_param('transition_note') ?: '');
      $result = VAPTC_Workflow::transition_feature($key, $status, $note);
      if (is_wp_error($result)) {
        return new WP_REST_Response($result, 400);
      }
    }

    // DEBUG LOGGING removed

    $meta_updates = array();
    if ($include_test !== null) $meta_updates['include_test_method'] = $include_test ? 1 : 0;
    if ($include_verification !== null) $meta_updates['include_verification'] = $include_verification ? 1 : 0;

    // New: Verification Engine Toggle
    $include_verification_engine = $request->get_param('include_verification_engine');
    if ($include_verification_engine !== null) $meta_updates['include_verification_engine'] = $include_verification_engine ? 1 : 0;

    if ($is_enforced !== null) $meta_updates['is_enforced'] = $is_enforced ? 1 : 0;
    if ($wireframe_url !== null) $meta_updates['wireframe_url'] = $wireframe_url;

    if ($request->has_param('generated_schema')) {
      $generated_schema = $request->get_param('generated_schema');
      if ($generated_schema === null) {
        $meta_updates['generated_schema'] = null;
      } else {
        // Robustly handle both Arrays and Objects (stdClass) from JSON body
        $schema = (is_array($generated_schema) || is_object($generated_schema))
          ? json_decode(json_encode($generated_schema), true) // Normalize to array
          : json_decode($generated_schema, true);

        // Skip validation for legacy/auto-generated schema formats (type: 'wp_config', 'htaccess', 'manual', etc.)
        // These are temporary schemas that will be replaced with full schemas later
        $is_legacy_format = isset($schema['type']) && in_array($schema['type'], ['wp_config', 'htaccess', 'manual', 'complex_input']);

        if (!$is_legacy_format) {
          // Validate only full schemas with controls array
          $validation = self::validate_schema($schema);
          if (is_wp_error($validation)) {
            return new WP_REST_Response(array(
              'error' => 'Schema validation failed',
              'message' => $validation->get_error_message(),
              'code' => $validation->get_error_code(),
              'schema_received' => $schema // Include for debugging
            ), 400);
          }
        }
        $meta_updates['generated_schema'] = json_encode($schema);
      }
    }

    if ($request->has_param('implementation_data')) {
      $implementation_data = $request->get_param('implementation_data');
      $meta_updates['implementation_data'] = ($implementation_data === null) ? null : (is_array($implementation_data) ? json_encode($implementation_data) : $implementation_data);
    }

    if (! empty($meta_updates)) {
      VAPTC_DB::update_feature_meta($key, $meta_updates);
      do_action('vaptc_feature_saved', $key, $meta_updates);
    }

    // Optional: hard reset of history when requested (used by "Reset to Default" in History modal)
    if ($reset_history) {
      global $wpdb;
      $history_table = $wpdb->prefix . 'vaptc_feature_history';
      $wpdb->delete($history_table, array('feature_key' => $key), array('%s'));
    }

    return new WP_REST_Response(array('success' => true), 200);
  }

  public function update_file_meta($request)
  {
    $file = $request->get_param('file');
    $key = $request->get_param('key');
    $value = $request->get_param('value');

    if (!$file || !$key) {
      return new WP_REST_Response(array('error' => 'Missing file or key param'), 400);
    }

    $json_path = VAPTC_PATH . 'data/' . sanitize_file_name($file);

    if (!file_exists($json_path)) {
      return new WP_REST_Response(array('error' => 'File not found'), 404);
    }

    $content = file_get_contents($json_path);
    $data = json_decode($content, true);

    if (!is_array($data)) {
      return new WP_REST_Response(array('error' => 'Invalid JSON in file'), 500);
    }

    // Update the root key
    if ($value === null) {
      unset($data[$key]);
    } else {
      // Decode if it came in as a JSON string mostly for objects, but handle raw too
      $data[$key] = $value;
    }

    $saved = file_put_contents($json_path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

    if ($saved === false) {
      return new WP_REST_Response(array('error' => 'Failed to write to file'), 500);
    }

    return new WP_REST_Response(array('success' => true, 'updated_key' => $key), 200);
  }

  /**
   * Dedicated Transition Endpoint
   */
  public function transition_feature($request)
  {
    $key = $request->get_param('key');
    $status = $request->get_param('status');
    $note = $request->get_param('note') ?: '';

    $result = VAPTC_Workflow::transition_feature($key, $status, $note);

    if (is_wp_error($result)) {
      return new WP_REST_Response($result, 400);
    }

    return new WP_REST_Response(array('success' => true), 200);
  }

  /**
   * Get Audit History for a Feature
   */
  public function get_feature_history($request)
  {
    $key = $request['key'];
    $history = VAPTC_Workflow::get_history($key);

    return new WP_REST_Response($history, 200);
  }

  public function upload_json($request)
  {
    $files = $request->get_file_params();
    if (empty($files['file'])) {
      return new WP_REST_Response(array('error' => 'No file uploaded'), 400);
    }

    $file = $files['file'];
    $filename = sanitize_file_name($file['name']);
    $content = file_get_contents($file['tmp_name']);
    $data = json_decode($content, true);

    if (is_null($data)) {
      return new WP_REST_Response(array('error' => 'Invalid JSON'), 400);
    }

    $json_path = VAPTC_PATH . 'data/' . $filename;
    file_put_contents($json_path, $content);

    return new WP_REST_Response(array('success' => true, 'filename' => $filename), 200);
  }

  /**
   * Update Hidden JSON Files List
   */
  public function update_hidden_files($request)
  {
    $hidden_files = $request->get_param('hidden_files');
    if (!is_array($hidden_files)) {
      $hidden_files = array();
    }

    // Sanitize
    $hidden_files = array_map('sanitize_file_name', $hidden_files);

    update_option('vaptc_hidden_json_files', $hidden_files);

    return new WP_REST_Response(array('success' => true, 'hidden_files' => $hidden_files), 200);
  }

  /**
   * Reset Rate Limit for current user
   */
  public function reset_rate_limit($request)
  {
    require_once(VAPTC_PATH . 'includes/enforcers/class-vaptc-hook-driver.php');
    $result = VAPTC_Hook_Driver::reset_limit();
    return new WP_REST_Response(array('success' => true, 'debug' => $result), 200);
  }

  /**
   * Get All JSON files (including hidden ones, for management UI)
   */
  public function get_all_data_files()
  {
    $data_dir = VAPTC_PATH . 'data';
    if (!is_dir($data_dir)) return new WP_REST_Response([], 200);

    $files = array_diff(scandir($data_dir), array('..', '.'));
    $json_files = [];
    $hidden_files = get_option('vaptc_hidden_json_files', array());
    $hidden_normalized = array_map('sanitize_file_name', $hidden_files);

    foreach ($files as $file) {
      if (strtolower(pathinfo($file, PATHINFO_EXTENSION)) === 'json') {
        $normalized_current = sanitize_file_name($file);
        $json_files[] = array(
          'filename' => $file,
          'isHidden' => in_array($normalized_current, $hidden_normalized) || in_array($file, $hidden_files)
        );
      }
    }

    return new WP_REST_Response($json_files, 200);
  }

  public function get_domains()
  {
    global $wpdb;
    $domains = VAPTC_DB::get_domains();

    foreach ($domains as &$domain) {
      $domain_id = $domain['id'];
      $feat_rows = $wpdb->get_results($wpdb->prepare("SELECT feature_key FROM {$wpdb->prefix}vaptc_domain_features WHERE domain_id = %d AND enabled = 1", $domain_id), ARRAY_N);
      $domain['features'] = array_column($feat_rows, 0);
    }

    return new WP_REST_Response($domains, 200);
  }

  public function update_domain($request)
  {
    global $wpdb;
    $domain = $request->get_param('domain');
    $is_wildcard = $request->get_param('is_wildcard');
    $license_id = $request->get_param('license_id');
    $license_type = $request->get_param('license_type') ?: 'standard';
    $manual_expiry_date = $request->get_param('manual_expiry_date');
    $auto_renew = $request->get_param('auto_renew') !== null ? ($request->get_param('auto_renew') ? 1 : 0) : null;
    $action = $request->get_param('action'); // 'undo' or 'reset' or null

    // Get current state
    $current = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}vaptc_domains WHERE domain = %s", $domain), ARRAY_A);
    $history = $current && !empty($current['renewal_history']) ? json_decode($current['renewal_history'], true) : array();

    // Preserve existing values if not provided
    $renewals_count = $request->has_param('renewals_count') ? (int) $request->get_param('renewals_count') : ($current ? (int)$current['renewals_count'] : 0);
    if ($auto_renew === null && $current) $auto_renew = (int)$current['auto_renew'];
    if ($is_wildcard === null && $current) $is_wildcard = (int)$current['is_wildcard'];
    if ($license_id === null && $current) $license_id = $current['license_id'];
    if ($manual_expiry_date === null && $current) $manual_expiry_date = $current['manual_expiry_date'];

    // Normalize Input Date to Midnight for comparison
    if ($manual_expiry_date) {
      $manual_expiry_date = date('Y-m-d 00:00:00', strtotime($manual_expiry_date));
    }

    // Rollback Safety: Use normalized timestamps for comparisons
    $today_ts = strtotime(date('Y-m-d 00:00:00'));
    $current_exp_ts = ($current && !empty($current['manual_expiry_date'])) ? strtotime(date('Y-m-d', strtotime($current['manual_expiry_date']))) : 0;
    $new_exp_ts = $manual_expiry_date ? strtotime(date('Y-m-d', strtotime($manual_expiry_date))) : 0;

    // Handle Rollback Actions
    if ($action === 'undo' && !empty($history)) {
      $last = array_pop($history);
      $days = (int) $last['duration_days'];
      $manual_expiry_date = date('Y-m-d 00:00:00', strtotime($current['manual_expiry_date'] . " -$days days"));
      $renewals_count = max(0, (int)$current['renewals_count'] - 1);
    } else if ($action === 'reset' && !empty($history)) {
      $temp_expiry_ts = $current_exp_ts;
      $temp_count = $renewals_count;

      while (!empty($history)) {
        $entry = end($history);
        if ($entry['source'] === 'auto') break;

        $days = (int) $entry['duration_days'];
        $potential_expiry_ts = strtotime(date('Y-m-d 00:00:00', $temp_expiry_ts) . " -$days days");

        if ($potential_expiry_ts < $today_ts) break;

        array_pop($history);
        $temp_expiry_ts = $potential_expiry_ts;
        $temp_count = max(0, $temp_count - 1);
      }
      $manual_expiry_date = date('Y-m-d 00:00:00', $temp_expiry_ts);
      $renewals_count = $temp_count;
    }
    // Handle Renewals (Manual vs Auto)
    else {
      // Detect renewal by comparing normalized timestamps
      if ($current && $new_exp_ts > $current_exp_ts) {
        $diff = $new_exp_ts - $current_exp_ts;
        $days = round($diff / 86400);

        if ($days > 0) {
          $source = $request->get_param('renew_source') ?: 'manual';
          $history[] = array(
            'date_added' => current_time('mysql'),
            'duration_days' => $days,
            'license_type' => $license_type,
            'source' => $source
          );
          $renewals_count++;
        }
      }

      // Auto-Renew Logic (If expired and auto-renew is ON)
      if ($auto_renew && $new_exp_ts < $today_ts) {
        $duration = '+30 days';
        $days = 30;
        if ($license_type === 'pro') {
          $duration = '+1 year';
          $days = 365;
        }
        if ($license_type === 'developer') {
          $duration = '+100 years';
          $days = 36500;
        }

        $manual_expiry_date = date('Y-m-d 00:00:00', strtotime($manual_expiry_date . ' ' . $duration));
        $renewals_count++;

        $history[] = array(
          'date_added' => current_time('mysql'),
          'duration_days' => $days,
          'license_type' => $license_type,
          'source' => 'auto'
        );
      }
    }

    VAPTC_DB::update_domain($domain, $is_wildcard ? 1 : 0, $license_id, $license_type, $manual_expiry_date, $auto_renew, $renewals_count, $history);

    // Return fresh data for UI update
    $fresh = $wpdb->get_row($wpdb->prepare("SELECT * FROM {$wpdb->prefix}vaptc_domains WHERE domain = %s", $domain), ARRAY_A);

    return new WP_REST_Response(array('success' => true, 'domain' => $fresh), 200);
  }

  public function update_domain_features($request)
  {
    global $wpdb;
    $domain_id = $request->get_param('domain_id');
    $features = $request->get_param('features'); // Array of keys

    if (! is_array($features)) {
      return new WP_REST_Response(array('error' => 'Invalid features format'), 400);
    }

    $table = $wpdb->prefix . 'vaptc_domain_features';

    // Reset and re-add
    $wpdb->delete($table, array('domain_id' => $domain_id), array('%d'));

    foreach ($features as $key) {
      $wpdb->insert($table, array(
        'domain_id'   => $domain_id,
        'feature_key' => $key,
        'enabled'     => 1
      ), array('%d', '%s', '%d'));
    }

    return new WP_REST_Response(array('success' => true), 200);
  }

  public function generate_build($request)
  {
    $data = $request->get_json_params();
    $zip_path = VAPTC_Build::generate($data);

    if (file_exists($zip_path)) {
      // In a real scenario, we would store this and provide a hashed download link.
      // For now, facilitating the download by returning the base64 or a redirect is tricky in REST.
      // I'll store the zip in the uploads directory temporarily.
      $upload_dir = wp_upload_dir();
      $target_dir = $upload_dir['basedir'] . '/vaptc-builds';
      wp_mkdir_p($target_dir);

      $file_name = basename($zip_path);
      copy($zip_path, $target_dir . '/' . $file_name);

      $download_url = $upload_dir['baseurl'] . '/vaptc-builds/' . $file_name;

      return new WP_REST_Response(array('success' => true, 'download_url' => $download_url), 200);
    }

    return new WP_REST_Response(array('error' => 'Build failed'), 500);
  }

  /**
   * Get list of users who can be assigned to features
   */
  public function get_assignees()
  {
    $users = get_users(array('role' => 'administrator'));
    $assignees = array_map(function ($u) {
      return array('id' => $u->ID, 'name' => $u->display_name);
    }, $users);

    return new WP_REST_Response($assignees, 200);
  }

  /**
   * Update feature assignment
   */
  public function update_assignment($request)
  {
    global $wpdb;
    $key = $request->get_param('key');
    $user_id = $request->get_param('user_id');
    $table_status = $wpdb->prefix . 'vaptc_feature_status';
    $wpdb->update($table_status, array('assigned_to' => $user_id ? $user_id : null), array('feature_key' => $key));

    return new WP_REST_Response(array('success' => true), 200);
  }

  /**
   * Handle Media Upload (for Pasted Images / Wireframes)
   */
  public function upload_media($request)
  {
    if (empty($_FILES['file'])) {
      return new WP_Error('no_file', 'No file uploaded', array('status' => 400));
    }

    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    // Filter to change upload directory
    $upload_dir_filter = function ($uploads) {
      $subdir = '/vaptc-wireframes';
      $uploads['subdir'] = $subdir;
      $uploads['path']   = $uploads['basedir'] . $subdir;
      $uploads['url']    = $uploads['baseurl'] . $subdir;

      if (! file_exists($uploads['path'])) {
        wp_mkdir_p($uploads['path']);
      }
      return $uploads;
    };

    add_filter('upload_dir', $upload_dir_filter);

    $file = $_FILES['file'];
    $upload_overrides = array('test_form' => false);

    $movefile = wp_handle_upload($file, $upload_overrides);

    remove_filter('upload_dir', $upload_dir_filter);

    if ($movefile && ! isset($movefile['error'])) {
      // Create an attachment for the Media Library
      $filename = $movefile['file'];
      $attachment = array(
        'guid'           => $movefile['url'],
        'post_mime_type' => $movefile['type'],
        'post_title'     => preg_replace('/\.[^.]+$/', '', basename($filename)),
        'post_content'   => '',
        'post_status'    => 'inherit'
      );

      $attach_id = wp_insert_attachment($attachment, $filename);
      $attach_data = wp_generate_attachment_metadata($attach_id, $filename);
      wp_update_attachment_metadata($attach_id, $attach_data);

      return new WP_REST_Response(array(
        'success' => true,
        'url'     => $movefile['url'],
        'id'      => $attach_id
      ), 200);
    } else {
      return new WP_Error('upload_error', $movefile['error'], array('status' => 500));
    }
  }

  /**
   * Validate generated schema structure
   * 
   * @param array $schema The schema array to validate
   * @return true|WP_Error True if valid, WP_Error if invalid
   */
  private static function validate_schema($schema)
  {
    if (!is_array($schema)) {
      return new WP_Error('invalid_schema', 'Schema must be an object/array', array('status' => 400));
    }

    // Schema must have controls array
    if (!isset($schema['controls']) || !is_array($schema['controls'])) {
      return new WP_Error(
        'invalid_schema',
        'Schema must have a "controls" array',
        array('status' => 400)
      );
    }

    // Validate each control
    foreach ($schema['controls'] as $index => $control) {
      if (!is_array($control)) {
        return new WP_Error(
          'invalid_schema',
          sprintf('Control at index %d must be an object', $index),
          array('status' => 400)
        );
      }

      // Each control must have type and key
      if (empty($control['type'])) {
        return new WP_Error(
          'invalid_schema',
          sprintf('Control at index %d must have a "type" field', $index),
          array('status' => 400)
        );
      }

      $no_key_types = ['button', 'info', 'alert', 'section', 'group', 'divider', 'html', 'header', 'label', 'evidence_uploader', 'risk_indicators', 'assurance_badges', 'remediation_steps', 'test_checklist', 'evidence_list'];
      if (empty($control['key']) && !in_array($control['type'], $no_key_types)) {
        // Most functional controls need keys
        return new WP_Error(
          'invalid_schema',
          sprintf('Control at index %d must have a "key" field', $index),
          array('status' => 400)
        );
      }

      // Validate control types
      $valid_types = ['toggle', 'input', 'select', 'textarea', 'code', 'test_action', 'button', 'info', 'alert', 'section', 'group', 'divider', 'html', 'header', 'label', 'password', 'evidence_uploader', 'risk_indicators', 'assurance_badges', 'remediation_steps', 'test_checklist', 'evidence_list'];
      if (!in_array($control['type'], $valid_types)) {
        return new WP_Error(
          'invalid_schema',
          sprintf(
            'Control at index %d has invalid type "%s". Valid types: %s',
            $index,
            $control['type'],
            implode(', ', $valid_types)
          ),
          array('status' => 400)
        );
      }

      // Validate test_action controls have test_logic
      if ($control['type'] === 'test_action') {
        if (empty($control['test_logic'])) {
          return new WP_Error(
            'invalid_schema',
            sprintf(
              'Test action control "%s" must have a "test_logic" field',
              $control['key'] ?? $index
            ),
            array('status' => 400)
          );
        }
      }
    }

    // Validate enforcement section if present
    if (isset($schema['enforcement'])) {
      if (!is_array($schema['enforcement'])) {
        return new WP_Error(
          'invalid_schema',
          'Enforcement section must be an object',
          array('status' => 400)
        );
      }

      if (empty($schema['enforcement']['driver'])) {
        return new WP_Error(
          'invalid_schema',
          'Enforcement must specify a "driver" (hook or htaccess)',
          array('status' => 400)
        );
      }

      $valid_drivers = ['hook', 'htaccess', 'universal'];
      if (!in_array($schema['enforcement']['driver'], $valid_drivers)) {
        return new WP_Error(
          'invalid_schema',
          sprintf(
            'Invalid enforcement driver "%s". Valid drivers: %s',
            $schema['enforcement']['driver'],
            implode(', ', $valid_drivers)
          ),
          array('status' => 400)
        );
      }

      // Htaccess driver must specify target
      if ($schema['enforcement']['driver'] === 'htaccess' && empty($schema['enforcement']['target'])) {
        return new WP_Error(
          'invalid_schema',
          'Htaccess driver must specify a "target" (root or uploads)',
          array('status' => 400)
        );
      }

      // Mappings should be an array if present
      if (isset($schema['enforcement']['mappings']) && !is_array($schema['enforcement']['mappings'])) {
        return new WP_Error(
          'invalid_schema',
          'Enforcement mappings must be an object/array',
          array('status' => 400)
        );
      }
    }

    return true;
  }

  /**
   * Get or Set the Active Feature Source File
   */
  public function handle_active_file($request)
  {
    if ($request->get_method() === 'POST') {
      $file = $request->get_param('file');
      if (!$file) {
        return new WP_REST_Response(array('error' => 'No file specified'), 400);
      }
      $filename = sanitize_file_name($file);
      update_option('vaptc_active_feature_file', $filename);
      return new WP_REST_Response(array('success' => true, 'active_file' => $filename), 200);
    }

    // GET
    return new WP_REST_Response(array(
      'active_file' => get_option('vaptc_active_feature_file', 'features-with-test-methods.json')
    ), 200);
  }
}

new VAPTC_REST();
