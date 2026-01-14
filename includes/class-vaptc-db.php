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
  public static function update_domain($domain, $is_wildcard = 0, $is_enabled = 1, $id = null, $license_id = '', $license_type = 'standard', $manual_expiry_date = null, $auto_renew = 0, $renewals_count = 0, $renewal_history = null)
  {
    global $wpdb;
    $table = $wpdb->prefix . 'vaptc_domains';

    // [SAFETY] Check if essential columns exist
    $id_col = $wpdb->get_results($wpdb->prepare("SHOW COLUMNS FROM $table LIKE %s", 'id'));
    if (empty($id_col)) {
      error_log('VAPTC: "id" column missing in domains table. Attempting to add...');
      $wpdb->query("ALTER TABLE $table DROP PRIMARY KEY");
      $wpdb->query("ALTER TABLE $table ADD COLUMN id BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id)");
    }

    $renewal_col = $wpdb->get_results($wpdb->prepare("SHOW COLUMNS FROM $table LIKE %s", 'renewal_history'));
    if (empty($renewal_col)) {
      $wpdb->query("ALTER TABLE $table ADD COLUMN renewal_history TEXT DEFAULT NULL AFTER renewals_count");
    }

    $domain = trim($domain);

    // Check for existing record to preserve first_activated_at
    if ($id) {
      $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE id = %d", $id));
    } else {
      // Case insensitive lookup for domain name
      $existing = $wpdb->get_row($wpdb->prepare("SELECT * FROM $table WHERE LOWER(domain) = LOWER(%s)", $domain));
    }

    $first_activated_at = $existing ? $existing->first_activated_at : null;

    // Only set first_activated_at if it's new and we have a license
    if (!$first_activated_at && $license_id) {
      $first_activated_at = current_time('mysql');
    }

    $data = array(
      'domain'             => $domain,
      'is_wildcard'        => $is_wildcard,
      'is_enabled'         => $is_enabled,
      'license_id'         => $license_id,
      'license_type'       => $license_type,
      'first_activated_at' => $first_activated_at,
      'manual_expiry_date' => $manual_expiry_date,
      'auto_renew'         => $auto_renew,
      'renewals_count'     => $renewals_count,
      'renewal_history'    => is_array($renewal_history) ? json_encode($renewal_history) : $renewal_history,
    );

    $formats = array('%s', '%d', '%d', '%s', '%s', '%s', '%s', '%d', '%d', '%s');

    if ($existing) {
      error_log('VAPTC: DB Found Existing Record (ID: ' . $existing->id . '). Updating...');
      $success = $wpdb->update($table, $data, array('id' => $existing->id), $formats, array('%d'));
      if ($success === false) {
        error_log('VAPTC: DB Update Error: ' . $wpdb->last_error);
        return false;
      }
      return $existing->id;
    } else {
      error_log('VAPTC: DB No Record Found. Inserting new domain: ' . $domain);
      $success = $wpdb->insert($table, $data, $formats);
      if ($success === false) {
        error_log('VAPTC: DB Insert Error: ' . $wpdb->last_error);
        return false;
      }
      $new_id = $wpdb->insert_id;
      error_log('VAPTC: DB Insert Success. New ID: ' . $new_id);
      return $new_id;
    }
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

  /**
   * Delete a domain and its features
   */
  public static function delete_domain($domain_id)
  {
    global $wpdb;
    $wpdb->delete($wpdb->prefix . 'vaptc_domains', array('id' => $domain_id), array('%d'));
    $wpdb->delete($wpdb->prefix . 'vaptc_domain_features', array('domain_id' => $domain_id), array('%d'));
    return true;
  }
  /**
   * Delete multiple domains and their features
   */
  public static function batch_delete_domains($domain_ids)
  {
    global $wpdb;
    if (empty($domain_ids) || !is_array($domain_ids)) return false;

    $ids_string = implode(',', array_map('intval', $domain_ids));

    $wpdb->query("DELETE FROM {$wpdb->prefix}vaptc_domains WHERE id IN ($ids_string)");
    $wpdb->query("DELETE FROM {$wpdb->prefix}vaptc_domain_features WHERE domain_id IN ($ids_string)");

    return true;
  }
}
