<?php

/**
 * Build Generator for VAPT Master
 */

if (! defined('ABSPATH')) {
  exit;
}

class VAPTM_Build
{

  /**
   * Generate a build ZIP for a specific domain
   */
  public static function generate($data)
  {
    $domain = sanitize_text_field($data['domain']);
    $features = $data['features']; // Array of keys
    $version = sanitize_text_field($data['version']);
    $white_label = $data['white_label'];

    $temp_dir = get_temp_dir() . 'vaptm-build-' . time() . '-' . wp_generate_password(8, false);
    wp_mkdir_p($temp_dir);

    // 1. Create the plugin folder
    $plugin_slug = sanitize_title($white_label['name']);
    $plugin_dir = $temp_dir . '/' . $plugin_slug;
    wp_mkdir_p($plugin_dir);

    // 2. Generate config file
    $config_content = "<?php\n";
    $config_content .= "/**\n * VAPT Master Configuration for $domain\n * Build Version: $version\n */\n\n";
    $config_content .= "define( 'VAPTM_DOMAIN_LOCKED', '" . esc_sql($domain) . "' );\n";
    $config_content .= "define( 'VAPTM_BUILD_VERSION', '" . esc_sql($version) . "' );\n\n";

    foreach ($features as $key) {
      $config_content .= "define( 'VAPTM_FEATURE_" . strtoupper($key) . "', true );\n";
    }

    file_put_contents($plugin_dir . '/config-' . $domain . '.php', $config_content);

    // 3. Create main plugin file (simplified copy with white label headers)
    $main_content = "<?php\n";
    $main_content .= "/**\n";
    $main_content .= " * Plugin Name: " . esc_html($white_label['name']) . "\n";
    $main_content .= " * Description: " . esc_html($white_label['description']) . "\n";
    $main_content .= " * Version: " . esc_html($version) . "\n";
    $main_content .= " * Author: " . esc_html($white_label['author']) . "\n";
    $main_content .= " */\n\n";
    $main_content .= "require_once __DIR__ . '/config-" . $domain . ".php';\n";
    $main_content .= "// Security implementation logic would follow...\n";

    file_put_contents($plugin_dir . '/' . $plugin_slug . '.php', $main_content);

    // 4. Generate User Guide
    $guide_template = VAPTM_PATH . 'data/user-guide-template.md';
    $guide_content = file_exists($guide_template) ? file_get_contents($guide_template) : "# VAPT Master User Guide\n";

    $feat_list = "";
    foreach ($features as $key) {
      $feat_list .= "- " . strtoupper($key) . "\n";
    }
    $guide_content = str_replace('[FEATURE_LIST]', $feat_list, $guide_content);
    file_put_contents($plugin_dir . '/USER-GUIDE.md', $guide_content);

    // 5. Generate Folder Structure
    $folder_structure = "Plugin Folder Structure:\n";
    $folder_structure .= "/$plugin_slug\n";
    $folder_structure .= "  |-- $plugin_slug.php (Main)\n";
    $folder_structure .= "  |-- config-$domain.php (Locked Configuration)\n";
    $folder_structure .= "  |-- USER-GUIDE.md\n";
    $folder_structure .= "  |-- CHANGELOG.md\n";
    file_put_contents($plugin_dir . '/FOLDER-STRUCTURE.txt', $folder_structure);

    // 6. Generate CHANGELOG.md
    $changelog = "# Changelog\n\n";
    $changelog .= "## [" . $version . "] - " . date('Y-m-d') . "\n";
    $changelog .= "### Added\n";
    foreach ($features as $key) {
      $changelog .= "- Initial implementation of " . strtoupper($key) . " security module.\n";
    }
    file_put_contents($plugin_dir . '/CHANGELOG.md', $changelog);

    // 7. Record Build in History
    VAPTM_DB::record_build($domain, $version, $features);

    // 8. Create ZIP
    $zip_file = $temp_dir . '/' . $domain . '-build.zip';
    $zip = new ZipArchive();
    if ($zip->open($zip_file, ZipArchive::CREATE) === TRUE) {
      self::add_dir_to_zip($plugin_dir, $zip, $plugin_slug);
      $zip->close();
    }

    return $zip_file;
  }

  private static function add_dir_to_zip($dir, $zip, $zip_path)
  {
    $files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir), RecursiveIteratorIterator::LEAVES_ONLY);
    foreach ($files as $name => $file) {
      if (! $file->isDir()) {
        $file_path = $file->getRealPath();
        $relative_path = $zip_path . '/' . substr($file_path, strlen($dir) + 1);
        $zip->addFile($file_path, $relative_path);
      }
    }
  }
}
