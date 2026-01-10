<?php

/**
 * Plugin Name: VAPT Copilot
 * Description: Ultimate VAPT and OWASP Security Plugin Copilot.
 * Version: 2.1.1
 * Author: Tan Malik
 * Text Domain: vapt-Copilot
 */

if (! defined('ABSPATH')) {
  exit;
}

// Plugin Constants (Copilot-specific)
define('VAPTC_VERSION', '2.1.1');
define('VAPTC_PATH', plugin_dir_path(__FILE__));
define('VAPTC_URL', plugin_dir_url(__FILE__));
define('VAPTC_SUPERADMIN_EMAIL', 'tanmalik786@gmail.com');
define('VAPTC_SUPERADMIN_USER', 'tanmalik786');

// Include core classes
require_once VAPTC_PATH . 'includes/class-vaptc-db.php';
require_once VAPTC_PATH . 'includes/class-vaptc-rest.php';
require_once VAPTC_PATH . 'includes/class-vaptc-auth.php';
require_once VAPTC_PATH . 'includes/class-vaptc-workflow.php';
require_once VAPTC_PATH . 'includes/class-vaptc-build.php';
require_once VAPTC_PATH . 'includes/class-vaptc-enforcer.php';
// require_once VAPTC_PATH . 'includes/class-vaptc-admin.php';

// Initialize Global Services (deferred to plugins_loaded to avoid DB access during activation)
add_action('plugins_loaded', array('VAPTC_Enforcer', 'init'));

// Instantiate other service objects on plugins_loaded so their constructors can hook into WP
add_action('plugins_loaded', 'vaptc_initialize_services');
function vaptc_initialize_services()
{
  if (class_exists('VAPTC_REST')) {
    new VAPTC_REST();
  }
  if (class_exists('VAPTC_Auth')) {
    // Auth may provide static helpers but instantiate to register hooks if needed
    new VAPTC_Auth();
  }
}

/**
 * Activation Hook: Initialize Database Tables
 */

/**
 * Activation Hook: Initialize Database Tables
 */
register_activation_hook(__FILE__, 'vaptc_copilot_activate_plugin');

function vaptc_copilot_activate_plugin()
{
  global $wpdb;
  $charset_collate = $wpdb->get_charset_collate();

  require_once ABSPATH . 'wp-admin/includes/upgrade.php';

  // Domains Table
  $table_domains = "CREATE TABLE {$wpdb->prefix}vaptc_domains (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        domain VARCHAR(255) NOT NULL,
        is_wildcard TINYINT(1) DEFAULT 0,
        license_id VARCHAR(100),
        license_type VARCHAR(50) DEFAULT 'standard',
        first_activated_at DATETIME DEFAULT NULL,
        manual_expiry_date DATETIME DEFAULT NULL,
        auto_renew TINYINT(1) DEFAULT 0,
        renewals_count INT DEFAULT 0,
        PRIMARY KEY  (id),
        UNIQUE KEY domain (domain)
    ) $charset_collate;";

  // Domain Features Table
  $table_features = "CREATE TABLE {$wpdb->prefix}vaptc_domain_features (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        domain_id BIGINT(20) UNSIGNED NOT NULL,
        feature_key VARCHAR(100) NOT NULL,
        enabled TINYINT(1) DEFAULT 0,
        PRIMARY KEY  (id),
        KEY domain_id (domain_id)
    ) $charset_collate;";

  // Feature Status Table
  $table_status = "CREATE TABLE {$wpdb->prefix}vaptc_feature_status (
        feature_key VARCHAR(100) NOT NULL,
        status ENUM('Draft', 'Develop', 'Test', 'Release') DEFAULT 'Draft',
        implemented_at DATETIME DEFAULT NULL,
        assigned_to BIGINT(20) UNSIGNED DEFAULT NULL,
        PRIMARY KEY  (feature_key)
    ) $charset_collate;";

  // Feature Meta Table
  $table_meta = "CREATE TABLE {$wpdb->prefix}vaptc_feature_meta (
        feature_key VARCHAR(100) NOT NULL,
        category VARCHAR(100),
        test_method TEXT,
        verification_steps TEXT,
        include_test_method TINYINT(1) DEFAULT 0,
        include_verification TINYINT(1) DEFAULT 0,
        is_enforced TINYINT(1) DEFAULT 0,
        wireframe_url TEXT DEFAULT NULL,
        generated_schema LONGTEXT DEFAULT NULL,
        implementation_data LONGTEXT DEFAULT NULL,
        PRIMARY KEY  (feature_key)
    ) $charset_collate;";

  // Feature History/Audit Table
  $table_history = "CREATE TABLE {$wpdb->prefix}vaptc_feature_history (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        feature_key VARCHAR(100) NOT NULL,
        old_status VARCHAR(50),
        new_status VARCHAR(50),
        user_id BIGINT(20) UNSIGNED,
        note TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY feature_key (feature_key)
    ) $charset_collate;";

  // Build History Table
  $table_builds = "CREATE TABLE {$wpdb->prefix}vaptc_domain_builds (
        id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        domain VARCHAR(255) NOT NULL,
        version VARCHAR(50) NOT NULL,
        features TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY domain (domain)
    ) $charset_collate;";

  dbDelta($table_domains);
  dbDelta($table_features);
  dbDelta($table_status);
  dbDelta($table_meta);
  dbDelta($table_history);
  dbDelta($table_builds);

  // Ensure data directory exists
  if (! file_exists(VAPTC_PATH . 'data')) {
    wp_mkdir_p(VAPTC_PATH . 'data');
  }

  // Ensure builds directory exists in uploads
  $upload_dir = wp_upload_dir();
  $target_dir = $upload_dir['basedir'] . '/vaptc-builds';
  if (! file_exists($target_dir)) {
    wp_mkdir_p($target_dir);
  }
}

/**
 * Manual DB Fix Trigger (Force Run)
 */
add_action('init', 'vaptc_manual_db_fix');
if (! function_exists('vaptc_manual_db_fix')) {
  function vaptc_manual_db_fix()
  {
    if (isset($_GET['vaptc_fix_db']) && current_user_can('manage_options')) {
      require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
      global $wpdb;

      // 1. Run standard dbDelta
      vaptc_copilot_activate_plugin();

      // 2. Force add column just in case dbDelta missed it
      $table = $wpdb->prefix . 'vaptc_domains';
      $col = $wpdb->get_results("SHOW COLUMNS FROM $table LIKE 'manual_expiry_date'");
      if (empty($col)) {
        $wpdb->query("ALTER TABLE $table ADD COLUMN manual_expiry_date DATETIME DEFAULT NULL");
      }

      // 3. Migrate Status ENUM to Title Case
      $status_table = $wpdb->prefix . 'vaptc_feature_status';
      $wpdb->query("ALTER TABLE $status_table MODIFY COLUMN status ENUM('Draft', 'Develop', 'Test', 'Release') DEFAULT 'Draft'");

      // 4. Update existing lowercase statuses to Title Case
      $wpdb->query("UPDATE $status_table SET status = 'Draft' WHERE status IN ('draft', 'available')");
      $wpdb->query("UPDATE $status_table SET status = 'Develop' WHERE status IN ('develop', 'in_progress')");
      $wpdb->query("UPDATE $status_table SET status = 'Test' WHERE status = 'test'");
      $wpdb->query("UPDATE $status_table SET status = 'Release' WHERE status IN ('release', 'implemented')");

      // 5. Ensure wireframe_url column exists
      $meta_table = $wpdb->prefix . 'vaptc_feature_meta';
      $meta_col = $wpdb->get_results("SHOW COLUMNS FROM $meta_table LIKE 'wireframe_url'");
      if (empty($meta_col)) {
        $wpdb->query("ALTER TABLE $meta_table ADD COLUMN wireframe_url TEXT DEFAULT NULL");
      }

      echo '<div class="notice notice-success"><p>Database migration complete. Statuses normalized to Draft, Develop, Test, Release.</p></div>';

      // 4. Force add is_enforced column
      $table_meta = $wpdb->prefix . 'vaptc_feature_meta';
      $col_enforced = $wpdb->get_results("SHOW COLUMNS FROM $table_meta LIKE 'is_enforced'");
      if (empty($col_enforced)) {
        $wpdb->query("ALTER TABLE $table_meta ADD COLUMN is_enforced TINYINT(1) DEFAULT 0");
      }

      // 5. Force add assigned_to column
      $col_assigned = $wpdb->get_results("SHOW COLUMNS FROM $status_table LIKE 'assigned_to'");
      if (empty($col_assigned)) {
        $wpdb->query("ALTER TABLE $status_table ADD COLUMN assigned_to BIGINT(20) UNSIGNED DEFAULT NULL");
      }

      // 3. Force add generated_schema column
      $meta_table = $wpdb->prefix . 'vaptc_feature_meta';
      $col_schema = $wpdb->get_results("SHOW COLUMNS FROM $meta_table LIKE 'generated_schema'");
      if (empty($col_schema)) {
        $wpdb->query("ALTER TABLE $meta_table ADD COLUMN generated_schema LONGTEXT DEFAULT NULL");
      }

      $col_data = $wpdb->get_results("SHOW COLUMNS FROM $meta_table LIKE 'implementation_data'");
      if (empty($col_data)) {
        $wpdb->query("ALTER TABLE $meta_table ADD COLUMN implementation_data LONGTEXT DEFAULT NULL");
      }

      $col_verif = $wpdb->get_results("SHOW COLUMNS FROM $meta_table LIKE 'include_verification_engine'");
      if (empty($col_verif)) {
        $wpdb->query("ALTER TABLE $meta_table ADD COLUMN include_verification_engine TINYINT(1) DEFAULT 0");
      }

      $msg = "Database schema updated (History Table + assigned_to + is_enforced + Status Enum + Manual Expiry + Generated Schema + Implementation Data).";

      wp_die("<h1>VAPT Copilot Database Updated</h1><p>Schema refresh run. $msg</p><p>Please go back to the dashboard.</p>");
    }
  }
}

/**
 * Detect Localhost Environment
 */
/**
 * 🚨 FORCE FIX: API Rate Limiting
 * Trigger via URL: ?vaptc_force_fix_ratelimit=1
 */
add_action('init', 'vaptc_force_fix_ratelimit');
if (! function_exists('vaptc_force_fix_ratelimit')) {
  function vaptc_force_fix_ratelimit()
  {
    if (isset($_GET['vaptc_force_fix_ratelimit']) && current_user_can('manage_options')) {
      global $wpdb;
      $key = 'api-rate-limiting';

      // 1. Force Schema with Enforcer Mapping
      $schema = array(
        'controls' => array(
          array('type' => 'toggle', 'label' => 'Enable API Rate Limiting', 'key' => 'enable_api_rate_limiting', 'help' => 'Activates the global rate limiting middleware.'),
          array('type' => 'test_action', 'label' => 'Test: Burst Resilience (13 req/min)', 'key' => 'verif_rate_limit', 'test_logic' => 'spam_requests', 'help' => 'Sends a sharp burst of traffic to test server stability.'),
          array('type' => 'test_action', 'label' => 'Test: Limit Enforcement', 'key' => 'verif_limit_enforce', 'test_logic' => 'default', 'help' => 'Intentionally exceeds the limit to verify HTTP 429 response.')
        ),
        'enforcement' => array(
          'driver' => 'hook',
          'mappings' => array('enable_api_rate_limiting' => 'limit_login_attempts')
        )
      );

      // 2. Direct DB Update
      $table = $wpdb->prefix . 'vaptc_feature_meta';

      // Ensure row exists
      $exists = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE feature_key = %s", $key));
      if (!$exists) {
        $wpdb->insert($table, array('feature_key' => $key, 'is_enforced' => 1));
      }

      $wpdb->update($table, array(
        'generated_schema' => json_encode($schema),
        'is_enforced' => 1,
        'include_verification_engine' => 1
      ), array('feature_key' => $key));

      // 3. Clear Cache
      delete_transient('vaptc_active_enforcements');

      // 4. Set Implementation Data if empty
      $meta = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE feature_key = %s", $key), ARRAY_A);
      if (empty($meta['implementation_data'])) {
        $impl = array('enable_api_rate_limiting' => true);
        $wpdb->update($table, array('implementation_data' => json_encode($impl)), array('feature_key' => $key));
      }

      die("<h1>VAPTM: Rate Limit Force Fix Applied! 🛡️</h1><p>Schema Updated. Enforcement Forced = 1. Cache Cleared.</p><a href='/wp-admin/admin.php?page=vapt-Copilot'>Return to Dashboard</a>");
    }
  }
}

/**
 * 🚨 FORCE FIX: WordPress Version Disclosure Feature
 * Ensures the feature is fully wired to hide the WP version and supports verification engine.
 * Trigger via URL: ?vaptc_force_fix_wp_version=1
 */
add_action('init', 'vaptc_force_fix_wp_version_disclosure');
if (! function_exists('vaptc_force_fix_wp_version_disclosure')) {
  function vaptc_force_fix_wp_version_disclosure()
  {
    if (isset($_GET['vaptc_force_fix_wp_version']) && current_user_can('manage_options')) {
      global $wpdb;

      $key = 'wordpress-version-disclosure';
      $table = $wpdb->prefix . 'vaptc_feature_meta';

      // 1. Define schema: Functional toggle + Verification test_action
      $schema = array(
        'controls' => array(
          array(
            'type' => 'toggle',
            'label' => 'Hide WordPress Version',
            'key' => 'hide_wp_version',
            'help' => 'Removes the WordPress generator meta tag and signals enforcement via headers.'
          ),
          array(
            'type' => 'test_action',
            'label' => 'Verify: Version Hidden',
            'key' => 'verif_hide_version',
            'test_logic' => 'hide_wp_version',
            'help' => 'Checks that the generator tag is removed and plugin enforcement header is present.'
          )
        ),
        'enforcement' => array(
          'driver' => 'hook',
          'mappings' => array(
            'hide_wp_version' => 'hide_wp_version'
          )
        )
      );

      // 2. Ensure row exists
      $exists = $wpdb->get_var($wpdb->prepare("SELECT COUNT(*) FROM $table WHERE feature_key = %s", $key));
      if (!$exists) {
        $wpdb->insert($table, array(
          'feature_key' => $key,
          'category' => 'Information Disclosure',
          'include_test_method' => 1,
          'include_verification' => 1,
          'include_verification_engine' => 1,
          'is_enforced' => 1
        ));
      }

      // 3. Update schema + flags
      $wpdb->update(
        $table,
        array(
          'generated_schema' => json_encode($schema),
          'include_verification_engine' => 1,
          'is_enforced' => 1
        ),
        array('feature_key' => $key)
      );

      // 4. Ensure implementation_data enables the toggle
      $meta = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE feature_key = %s", $key), ARRAY_A);
      if (empty($meta['implementation_data'])) {
        $impl = array('hide_wp_version' => true);
        $wpdb->update(
          $table,
          array('implementation_data' => json_encode($impl)),
          array('feature_key' => $key)
        );
      }

      // 5. Clear runtime enforcement cache so it applies immediately
      delete_transient('vaptc_active_enforcements');

      wp_die(
        "<h1>VAPTM: WordPress Version Disclosure Fix Applied 🛡️</h1>" .
          "<p>The feature <strong>WordPress Version Disclosure</strong> is now fully wired:</p>" .
          "<ul>" .
          "<li>Functional toggle: Hide WordPress Version</li>" .
          "<li>Enforcement driver: hook → hide_wp_version()</li>" .
          "<li>Verification: test_action using hide_wp_version probe</li>" .
          "</ul>" .
          "<p>You can now open the VAPT dashboard, enable <em>Hide WordPress Version</em>, and run the verification test to see real results.</p>" .
          "<a href='/wp-admin/admin.php?page=vapt-Copilot'>Return to Dashboard</a>"
      );
    }
  }
}

if (! function_exists('is_vaptc_localhost')) {
  function is_vaptc_localhost()
  {
    $whitelist = array('127.0.0.1', '::1', 'localhost');
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : '';
    $addr = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '';

    if (in_array($addr, $whitelist) || in_array($host, $whitelist)) {
      return true;
    }

    // Common dev suffixes
    $dev_suffixes = array('.local', '.test', '.dev', '.wp', '.site');
    foreach ($dev_suffixes as $suffix) {
      if (strpos($host, $suffix) !== false) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Admin Menu Setup
 */
add_action('admin_menu', 'vaptc_add_admin_menu');
add_action('admin_notices', 'vaptc_localhost_admin_notice');

// Global to store hook suffixes for asset loading
$vaptc_hooks = array();

/**
 * Check Strict Permissions
 */
if (! function_exists('vaptc_check_permissions')) {
  function vaptc_check_permissions()
  {
    // Allow any administrator during testing; restrict to superadmin only in production
    if (! current_user_can('manage_options')) {
      wp_die(__('You do not have permission to access the VAPT Copilot Dashboard.', 'vapt-Copilot'));
    }
  }
}

if (! function_exists('vaptc_add_admin_menu')) {
  function vaptc_add_admin_menu()
  {
    $current_user = wp_get_current_user();
    $login = strtolower($current_user->user_login);
    $email = strtolower($current_user->user_email);
    $is_superadmin = (
      $login === strtolower(VAPTC_SUPERADMIN_USER) ||
      $email === strtolower(VAPTC_SUPERADMIN_EMAIL) ||
      is_vaptc_localhost()
    );

    // 1. Parent Menu
    add_menu_page(
      __('VAPT Copilot', 'vapt-Copilot'),
      __('VAPT Copilot', 'vapt-Copilot'),
      'manage_options',
      'vapt-Copilot',
      'vaptc_render_client_status_page',
      'dashicons-shield',
      80
    );

    // 2. Sub-menu 1: Status
    add_submenu_page(
      'vapt-Copilot',
      __('VAPT Copilot', 'vapt-Copilot'),
      __('VAPT Copilot', 'vapt-Copilot'),
      'manage_options',
      'vapt-Copilot',
      'vaptc_render_client_status_page'
    );

    // 3. Sub-menu 2: Domain Admin (Superadmin Only)
    if ($is_superadmin) {
      add_submenu_page(
        'vapt-Copilot',
        __('VAPT Domain Admin', 'vapt-Copilot'),
        __('VAPT Domain Admin', 'vapt-Copilot'),
        'manage_options',
        'vapt-domain-admin',
        'vaptc_render_admin_page'
      );
    }
  }
}

/**
 * Handle Legacy Slug Redirects
 */
add_action('admin_init', 'vaptc_handle_legacy_redirects');
if (! function_exists('vaptc_handle_legacy_redirects')) {
  function vaptc_handle_legacy_redirects()
  {
    if (!isset($_GET['page'])) return;

    $legacy_slugs = array('vapt-Copilot-main', 'vapt-Copilot-status', 'vapt-Copilot-domain-build', 'vapt-client');
    if (in_array($_GET['page'], $legacy_slugs)) {
      wp_safe_redirect(admin_url('admin.php?page=vapt-Copilot'));
      exit;
    }
  }
}

/**
 * Localhost Admin Notice
 */
if (! function_exists('vaptc_localhost_admin_notice')) {
  function vaptc_localhost_admin_notice()
  {
    // Notice shows ONLY on localhost
    if (!is_vaptc_localhost()) {
      return;
    }

    // Notice shows ONLY to NON-Superadmin administrators
    $current_user = wp_get_current_user();
    $login = strtolower($current_user->user_login);
    $email = strtolower($current_user->user_email);
    $is_superadmin = ($login === strtolower(VAPTC_SUPERADMIN_USER) || $email === strtolower(VAPTC_SUPERADMIN_EMAIL) || is_vaptc_localhost());

    if ($is_superadmin || !current_user_can('manage_options')) {
      return;
    }

    $dashboard_url = admin_url('admin.php?page=vapt-domain-admin');
?>
    <div class="notice notice-info is-dismissible">
      <p>
        <strong><?php _e('VAPT Copilot:', 'vapt-Copilot'); ?></strong>
        <?php _e('Local environment detected. Test the Superadmin Dashboard here:', 'vapt-Copilot'); ?>
        <a href="<?php echo esc_url($dashboard_url); ?>"><?php echo esc_url($dashboard_url); ?></a>
      </p>
    </div>
  <?php
  }
}

/**
 * Render Client Status Page
 */
if (! function_exists('vaptc_render_client_status_page')) {
  function vaptc_render_client_status_page()
  {
  ?>
    <div class="wrap">
      <h1 class="wp-heading-inline"><?php _e('VAPT Copilot', 'vapt-Copilot'); ?></h1>
      <hr class="wp-header-end">

      <div id="vaptm-client-root">
        <div style="padding: 40px; text-align: center; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px;">
          <span class="spinner is-active" style="float: none; margin: 0 auto;"></span>
          <p><?php _e('Loading Implementation Workbench...', 'vapt-Copilot'); ?></p>
        </div>
      </div>
    </div>
  <?php
  }
}

/**
 * Render Main Admin Page
 */
if (! function_exists('vaptc_render_admin_page')) {
  function vaptc_render_admin_page()
  {
    vaptc_check_permissions();
    vaptc_master_dashboard_page();
  }
}

if (! function_exists('vaptc_master_dashboard_page')) {
  function vaptc_master_dashboard_page()
  {
    if (! VAPTC_Auth::is_authenticated()) {
      if (! get_transient('vaptc_otp_email_' . VAPTC_SUPERADMIN_USER)) {
        VAPTC_Auth::send_otp();
      }
      VAPTC_Auth::render_otp_form();
      return;
    }
  ?>
    <div id="vaptm-admin-root" class="wrap">
      <h1><?php _e('VAPT Domain Admin', 'vapt-Copilot'); ?></h1>
      <div style="padding: 20px; text-align: center;">
        <span class="spinner is-active" style="float: none; margin: 0 auto;"></span>
        <p><?php _e('Loading VAPT Master...', 'vapt-Copilot'); ?></p>
      </div>
    </div>
<?php
  }
}

/**
 * Enqueue Admin Assets
 */
add_action('admin_enqueue_scripts', 'vaptc_enqueue_admin_assets');

/**
 * Enqueue Assets for React App
 */
function vaptc_enqueue_admin_assets($hook)
{
  global $vaptc_hooks;
  $GLOBALS['vaptc_current_hook'] = $hook;

  $screen = get_current_screen();

  // Calculate is_superadmin for use in both blocks
  $current_user = wp_get_current_user();
  $user_login = $current_user->user_login;
  $user_email = $current_user->user_email;

  // Re-deriving strict superadmin status
  $is_superadmin = ($user_login === strtolower(VAPTC_SUPERADMIN_USER) || $user_email === strtolower(VAPTC_SUPERADMIN_EMAIL) || is_vaptc_localhost());

  if (!$screen) return;

  // Enqueue Shared Styles
  wp_enqueue_style('vaptc-admin-css', VAPTC_URL . 'assets/css/admin.css', array('wp-components'), VAPTC_VERSION);

  // 1. Superadmin Dashboard (admin.js)
  if ($screen->id === 'toplevel_page_vapt-domain-admin' || $screen->id === 'vapt-copilot_page_vapt-domain-admin' || $screen->id === 'vapt-Copilot_page_vapt-domain-admin') {
    error_log('VAPT Admin Assets Enqueued for: ' . $screen->id);
    // Enqueue Auto-Interface Generator (Module)
    wp_enqueue_script(
      'vaptc-interface-generator',
      plugin_dir_url(__FILE__) . 'assets/js/modules/interface-generator.js',
      array(), // No deps, but strictly before admin.js
      VAPTC_VERSION,
      true
    );

    // Enqueue Generated Interface UI Component
    wp_enqueue_script(
      'vaptc-generated-interface-ui',
      plugin_dir_url(__FILE__) . 'assets/js/modules/generated-interface.js',
      array('wp-element', 'wp-components'),
      VAPTC_VERSION,
      true
    );

    // Enqueue Admin Dashboard Script
    wp_enqueue_script(
      'vaptc-admin-js',
      plugin_dir_url(__FILE__) . 'assets/js/admin.js',
      array('wp-element', 'wp-components', 'wp-api-fetch', 'wp-i18n', 'vaptc-interface-generator', 'vaptc-generated-interface-ui'),
      VAPTC_VERSION,
      true
    );

    wp_localize_script('vaptc-admin-js', 'vaptmSettings', array(
      'root' => esc_url_raw(rest_url()),
      'nonce' => wp_create_nonce('wp_rest'),
      'pluginVersion' => VAPTC_VERSION
    ));
  }

  // 2. Client Dashboard (client.js) - "VAPT Copilot" page
  if ($screen->id === 'toplevel_page_vapt-Copilot' || $screen->id === 'vapt-Copilot_page_vapt-Copilot') {

    // Enqueue Generated Interface UI Component (Shared)
    wp_enqueue_script(
      'vaptc-generated-interface-ui',
      plugin_dir_url(__FILE__) . 'assets/js/modules/generated-interface.js',
      array('wp-element', 'wp-components'),
      VAPTC_VERSION,
      true
    );

    wp_enqueue_script('vaptc-client-js', VAPTC_URL . 'assets/js/client.js', array('wp-element', 'wp-components', 'wp-i18n', 'wp-api-fetch', 'vaptc-generated-interface-ui'), VAPTC_VERSION, true);

    wp_localize_script('vaptc-client-js', 'vaptcSettings', array(
      'root' => esc_url_raw(rest_url()),
      'nonce' => wp_create_nonce('wp_rest'),
      'isSuper' => $is_superadmin,
      'pluginVersion' => VAPTC_VERSION // Version Info
    ));

    // Enqueue Styles
    wp_enqueue_style('wp-components');
  }
}
