<?php

if (! defined('ABSPATH')) {
  exit;
}

/**
 * Class VAPTC_Workflow
 * Manages the state machine and history for security features.
 */
class VAPTC_Workflow
{
  /**
   * Validate if a transition from old status to new status is allowed.
   */
  public static function is_transition_allowed($old_status, $new_status)
  {
    // Map legacy status if they exist and normalize to lowercase for rules
    $old = strtolower(self::map_status($old_status));
    $new = strtolower(self::map_status($new_status));

    if ($old === $new) return true;

    // Transition Rules
    $rules = array(
      'draft'   => array('develop'),
      'develop' => array('draft', 'test'),
      'test'    => array('develop', 'release'),
      'release' => array('test', 'develop') // Allow downgrading if bug found
    );

    return isset($rules[$old]) && in_array($new, $rules[$old]);
  }

  /**
   * Transition a feature to a new status.
   */
  public static function transition_feature($feature_key, $new_status, $note = '', $user_id = 0)
  {
    global $wpdb;
    $table_status = $wpdb->prefix . 'vaptc_feature_status';
    $table_history = $wpdb->prefix . 'vaptc_feature_history';

    // Get current status
    $current = $wpdb->get_row($wpdb->prepare(
      "SELECT status FROM $table_status WHERE feature_key = %s",
      $feature_key
    ));

    $old_status = $current ? $current->status : 'draft';

    if (! self::is_transition_allowed($old_status, $new_status)) {
      return new WP_Error('invalid_transition', sprintf(__('Transition from %s to %s is not allowed.', 'vapt-Copilot'), $old_status, $new_status));
    }

    // Update Status
    $update_data = array('status' => $new_status);
    if ($new_status === 'Release' || $new_status === 'release') {
      $update_data['implemented_at'] = current_time('mysql');
    } else {
      $update_data['implemented_at'] = null;
    }

    if ($current) {
      $wpdb->update($table_status, $update_data, array('feature_key' => $feature_key));
    } else {
      $update_data['feature_key'] = $feature_key;
      $wpdb->insert($table_status, $update_data);
    }

    // Record History
    $wpdb->insert($table_history, array(
      'feature_key' => $feature_key,
      'old_status'  => $old_status,
      'new_status'  => $new_status,
      'user_id'     => $user_id ? $user_id : get_current_user_id(),
      'note'        => $note,
      'created_at'  => current_time('mysql')
    ));

    return true;
  }

  /**
   * Get history for a feature.
   */
  public static function get_history($feature_key)
  {
    global $wpdb;
    $table_history = $wpdb->prefix . 'vaptc_feature_history';

    return $wpdb->get_results($wpdb->prepare(
      "SELECT h.*, u.display_name as user_name 
       FROM $table_history h
       LEFT JOIN {$wpdb->users} u ON h.user_id = u.ID
       WHERE h.feature_key = %s 
       ORDER BY h.created_at DESC",
      $feature_key
    ));
  }

  /**
   * Helper to normalize status.
   */
  private static function map_status($status)
  {
    $map = array(
      'available'   => 'draft',
      'in_progress' => 'develop',
      'testing'     => 'test',
      'implemented' => 'release'
    );
    return isset($map[$status]) ? $map[$status] : $status;
  }
}
