<?php
/**
 * VAPT Master Configuration for vaptbuilder
 * Build Version: 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) { exit; }

// Domain Locking
define( 'VAPTC_DOMAIN_LOCKED', 'vaptbuilder' );
define( 'VAPTC_BUILD_VERSION', '1.0.0' );

// Active Features
define( 'VAPTC_FEATURE_WP_XMLRPC_ABUSE', true );
define( 'VAPTC_FEATURE_WP_AUTH_BRUTE_FORCE', true );
