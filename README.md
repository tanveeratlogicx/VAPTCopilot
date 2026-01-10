# VAPT CoPilot

A comprehensive WordPress Plugin for VAPT (Vulnerability Assessment and Penetration Testing) management.

## Version

2.1.0

## Description

VAPT CoPilot is a powerful WordPress plugin designed to help manage vulnerability assessments and penetration testing features. It provides a master dashboard for superadmins to configure, organize, and release security testing features across different domains with flexible licensing options.

## Features

### Main Features

- **VAPT Master Dashboard** - Superadmin interface for feature management
- **VAPT Workbench** - Advanced testing and configuration tools
- **Client Admin Dashboard** - Regular admin interface for clients
- **Feature Management** - Upload JSON files with VAPT features and manage them
- **License Management** - Support for 30-Day, Pro One Year, and Developer Perpetual licenses
- **Domain Features** - Manage which features are released to each domain
- **Build Generator** - Create custom plugins with selected features

### Access Control

- **Superadmin Only**: VAPT Master Dashboard and VAPT Workbench are restricted to the user `tanmalik786` (tanmalik786@gmail.com)
- **Localhost Testing**: Full access on localhost without OTP verification
- **Role-Based Access**: Regular admins only see Client Admin Dashboard

### Feature Lifecycle

Each feature goes through these states:
1. **Draft** - Initial state when feature is added
2. **Build** - Feature is being built and configured
3. **Test** - Feature is in testing phase
4. **Release** - Feature is released and ready for deployment

## Installation

1. Download the plugin files
2. Upload to `/wp-content/plugins/VAPTCopilot/`
3. Activate the plugin from WordPress admin panel

## Usage

### For Superadmin Users

1. Navigate to VAPT CoPilot > VAPT Master Dashboard
2. Upload your Features List JSON file
3. View summary statistics for all features
4. Use the tabs to:
   - **Feature List**: View all features, change their status, and toggle includes
   - **License Management**: Configure license types and domain binding
   - **Domain Features**: Select which released features to deploy to this domain
   - **Build Generator**: Create custom plugins with selected features

### For Client Admins

1. Navigate to VAPT CoPilot > Client Admin Dashboard
2. View available features for their domain
3. Access released features and documentation

## File Structure

```
VAPTCopilot/
├── vapt-copilot.php           # Main plugin file
├── admin/
│   ├── class-vapt-copilot-admin-menu.php       # Admin menu and dashboard
│   └── class-vapt-copilot-ajax-handler.php     # AJAX request handlers
├── includes/
│   ├── class-vapt-copilot-loader.php           # Plugin loader and initialization
│   └── class-vapt-copilot-utils.php            # Utility functions
├── assets/
│   ├── css/
│   │   └── admin.css          # Admin interface styles
│   └── js/
│       └── admin.js           # Admin interface functionality
├── data/
│   ├── Features List.json     # Default features JSON
│   └── uploads/               # Directory for uploaded JSON files
├── README.md                  # This file
└── LICENSE                    # Plugin license
```

## JSON File Format

Your Features List.json should follow this structure:

```json
{
  "metadata": {
    "version": "2.1.0",
    "focus": "Description",
    "maintainer": "Name",
    "last_updated": "YYYY-MM-DD"
  },
  "wordpress_vapt": [
    {
      "id": "WP-FEATURE-ID",
      "category": "Category Name",
      "title": "Feature Title",
      "severity": "Critical|High|Medium|Low",
      "description": "Feature description",
      "risks": ["Risk 1", "Risk 2"],
      "tests": ["Test 1", "Test 2"],
      "assurance": ["Assurance 1"],
      "remediation": ["Step 1", "Step 2"],
      "references": [
        {
          "name": "Reference Name",
          "section": "Section",
          "url": "https://example.com"
        }
      ]
    }
  ]
}
```

## AJAX Actions

The plugin uses AJAX for all dynamic operations:

- `vapt_upload_json` - Upload and process JSON file
- `vapt_load_features` - Load feature data from JSON
- `vapt_save_feature_status` - Update feature lifecycle status
- `vapt_generate_build` - Generate a new plugin build
- `vapt_save_domain_features` - Save domain-specific features
- `vapt_save_license` - Save license configuration

## Coding Standards

This plugin adheres to:
- WordPress Coding Standards
- WordPress Security Standards
- WordPress Plugin Development Best Practices
- PHPCS configuration for automated checks

## Security

- Nonce verification on all AJAX requests
- Role-based access control
- Capability checks on all admin functions
- Proper escaping of all output
- Input validation and sanitization

## Versioning

This plugin uses Semantic Versioning (Major.Minor.Patch):
- **Major**: Significant feature additions or breaking changes
- **Minor**: New features that are backward compatible
- **Patch**: Bug fixes and minor updates

Current version: 2.1.0

## License

This plugin is licensed under GPL v2 or later.

## Author

Tanveer Malik
Email: tanmalik786@gmail.com

## Support

For support, issues, or feature requests, please contact the author.

## Changelog

### Version 2.1.0
- **Sleek UI Overhaul**: Unified header with branded icons and systematic aesthetics.
- **Ultra-Slim Filter Bar**: Optimized 28px controls for increased density.
- **Stability Fixes**: Resolved dashboard loading hang and bracket hierarchy issues.
- **Integrated Configuration**: Moved "Configure Columns" into the main unified header.
- **Enhanced Performance**: Optimized React mounting and data fetching logic.

### Version 1.0.0
- Initial release
- Master Dashboard with feature management
- License management system
- Domain feature assignment
- Build generator
- Superadmin access control
- AJAX-based operations
- WordPress Coding Standards compliance