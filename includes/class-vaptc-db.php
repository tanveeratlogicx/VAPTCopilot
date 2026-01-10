<?php

/**
 * Database Helper Class for VAPT Master
 */

if (! defined('ABSPATH')) {
  exit;
}

class VAPTC_DB
{

  /**
   * Get all feature statuses
   */
  public static function get_feature_statuses()
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_feature_status';
    $results = $wpdb->get_results("SELECT * FROM $table", ARRAY_A);

    $statuses = [];
    foreach ($results as $row) {
      $statuses[$row['feature_key']] = $row['status'];
    }
    return $statuses;
  }

  /**
   * Update feature status with timestamp
   */
  public static function update_feature_status($key, $status)
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_feature_status';

    $data = array(
      'feature_key' => $key,
      'status'      => $status,
    );

    if ($status === 'Release') {
      $data['implemented_at'] = current_time('mysql');
    } else {
      $data['implemented_at'] = null;
    }

    return $wpdb->replace(
      $table,
      $data,
      array('%s', '%s', '%s')
    );
  }

  /**
   * Get feature status including implemented_at
   */
  public static function get_feature_statuses_full()
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_feature_status';
    return $wpdb->get_results("SELECT * FROM $table", ARRAY_A);
  }

  /**
   * Get feature metadata
   */
  public static function get_feature_meta($key)
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_feature_meta';
    return $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE feature_key = %s", $key), ARRAY_A);
  }

  /**
   * Update feature metadata/toggles
   */
  public static function update_feature_meta($key, $data)
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_feature_meta';

    $defaults = array(
      'feature_key'          => $key,
      'category'             => '',
      'test_method'          => '',
      'verification_steps'   => '',
      'include_test_method'  => 0,
      'include_verification' => 0,
      'include_verification_engine' => 0,
      'is_enforced'          => 0,
      'wireframe_url'        => null,
      'generated_schema'     => null,
      'implementation_data'  => null,
    );

    $existing = self::get_feature_meta($key);
    $final_data = wp_parse_args($data, $existing ? $existing : $defaults);

    return $wpdb->replace(
      $table,
      $final_data,
      array('%s', '%s', '%s', '%s', '%d', '%d', '%d', '%d', '%s', '%s', '%s')
    );
  }

  /**
   * Get all domains
   */
  public static function get_domains()
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_domains';
    return $wpdb->get_results("SELECT * FROM $table", ARRAY_A);
  }

  /**
   * Add or update domain
   */
  public static function update_domain($domain, $is_wildcard = 0, $license_id = '')
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_domains';

    return $wpdb->replace(
      $table,
      array(
        'domain'      => $domain,
        'is_wildcard' => $is_wildcard,
        'license_id'  => $license_id,
      ),
      array('%s', '%d', '%s')
    );
  }

  /**
   * Record a build
   */
  public static function record_build($domain, $version, $features)
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_domain_builds';

    return $wpdb->insert(
      $table,
      array(
        'domain'    => $domain,
        'version'   => $version,
        'features'  => maybe_serialize($features),
        'timestamp' => current_time('mysql'),
      ),
      array('%s', '%s', '%s', '%s')
    );
  }

  /**
   * Get build history for a domain
   */
  public static function get_build_history($domain = '')
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_domain_builds';
    if ($domain) {
      return $wpdb->get_results($wpdb->prepare("SELECT * FROM $table WHERE domain = %s ORDER BY timestamp DESC", $domain), ARRAY_A);
    }
    return $wpdb->get_results("SELECT * FROM $table ORDER BY timestamp DESC", ARRAY_A);
  }
}
