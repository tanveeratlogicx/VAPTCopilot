<?php

/**
 * VAPTC_Enforcer: The Global Security Hammer
 * 
 * Acts as a generic dispatcher that routes enforcement requests to specific drivers
 * (Htaccess, Hooks, etc.) based on the feature's generated_schema.
 */

if (!defined('ABSPATH')) exit;

class VAPTC_Enforcer
{

  public static function init()
  {
    // Listen for workbench saves
    add_action('vaptc_feature_saved', array(__CLASS__, 'dispatch_enforcement'), 10, 2);

    // Apply PHP-based hooks at runtime
    self::runtime_enforcement();
  }

  /**
   * Applies all active 'hook' based enforcements on every request
   */
  public static function runtime_enforcement()
  {
    $cache_key = 'vaptc_active_enforcements';
    $enforced = get_transient($cache_key);

    if (false === $enforced) {
      global $wpdb;
      $table = $wpdb->prefix . 'vaptc_feature_meta';
      $enforced = $wpdb->get_results("SELECT * FROM $table WHERE is_enforced = 1", ARRAY_A);
      set_transient($cache_key, $enforced, HOUR_IN_SECONDS);
    }

    if (empty($enforced)) return;

    require_once VAPTC_PATH . 'includes/enforcers/class-vaptc-hook-driver.php';

    foreach ($enforced as $meta) {
      $schema = !empty($meta['generated_schema']) ? json_decode($meta['generated_schema'], true) : array();
      $impl_data = !empty($meta['implementation_data']) ? json_decode($meta['implementation_data'], true) : array();

      $driver = isset($schema['enforcement']['driver']) ? $schema['enforcement']['driver'] : '';

      // Hook driver is universally shared for PHP-based fallback rules
      if ($driver === 'hook' || $driver === 'universal' || $driver === 'htaccess') {
        VAPTC_Hook_Driver::apply($impl_data, $schema, $meta['feature_key']);
      }
    }
  }

  /**
   * Entry point for enforcement after a feature is saved
   */
  public static function dispatch_enforcement($key, $data)
  {
    // Clear runtime cache so changes apply instantly

    delete_transient('vaptc_active_enforcements');

    $meta = VAPTC_DB::get_feature_meta($key);
    if (!$meta) return;

    $schema = !empty($meta['generated_schema']) ? json_decode($meta['generated_schema'], true) : array();
    if (empty($schema['enforcement'])) return;

    $driver_name = $schema['enforcement']['driver'];
    $impl_data = !empty($meta['implementation_data']) ? json_decode($meta['implementation_data'], true) : array();

    // 1. Check if the "Enforced" toggle is ON
    // In the generic system, we'll use 'is_enforced' meta or a schema flag.
    // For now, if the feature is in 'Develop' or higher, we allow enforcement checks.
    $is_enforced = !empty($meta['is_enforced']);

    // 2. Dispatch to the correct driver
    switch ($driver_name) {
      case 'htaccess':
        require_once VAPTC_PATH . 'includes/enforcers/class-vaptc-htaccess-driver.php';
        // Pass empty data if not enforced to trigger cleanup within the driver
        VAPTC_Htaccess_Driver::enforce($is_enforced ? $impl_data : array(), $schema);
        break;

      case 'hook':
        // Future Hook Driver...
        break;
    }
  }
}
