# Implementation Plan - Client Build Generator

## Goal
Transform the existing Build Generator into a production‑ready tool that creates white‑labeled, domain‑locked plugin bundles for clients. The build will be locked to a selected domain and will block usage on any other domain, notifying the Superadmin via email.

## User Review Required

> [!IMPORTANT]
> The build will be locked to the selected domain. If deployed on a different domain, it will automatically notify the Superadmin via email and block access for the user.

## Proposed Changes

### Build Engine (PHP)

#### [MODIFY] `class-vaptc-build.php`
- Implement recursive directory scanning to copy the entire plugin directory into a temporary build folder.
- Store generated builds permanently in `VAPT-Builds/[domain]/[version]/` for easier access.
- Exclude `.git`, `brain`, `node_modules`, `data` (see `class-vaptc-rest.php` lines 441‑475), `tests`, and any dev‑only files.
- Generate a config file named `vapt-[domain]-config-[ver].php` with only **Enabled Features** for the target domain.
- **Toggle Config**: If 'Include Config' is disabled, do not include the generated config file in the ZIP.
- Obfuscate Superadmin credentials using a hash‑based storage method.
- Inject a `VAPTC_Domain_Guard` check into the main plugin file to enforce domain locking.
- Auto‑generate `README.md` listing active security modules and a `CHANGELOG.md` with version history.

#### [MODIFY] `class-vaptc-rest.php`
- Add new actions to support `generate_type` (`config_only` vs `full_build`).
- Create an endpoint that writes the generated config file directly to the root of the active plugin.
- Wire `wp_mail` to notify the Superadmin on unauthorized usage attempts.

### Admin Interface (JavaScript)

#### [MODIFY] `admin.js`
- Add UI fields: **Plugin URI**, **Author URI**, **Text Domain**, and a **Version** input (defaults to Main Plugin Version).
- **Layout**:
    - **Panel Size**: Allocation **60% (approx 60vw)** width to the Configuration Details Panel.
    - **Config Section**: Place "Target Domain" and "**Include Config**" Toggle **side-by-side** on the top row. Remove toggle help text if needed for clean look.
    - **Input Fields**: Use **Horizontal Labels** (Label on Left, Input on Right) to save vertical space. Keep the **2-column grid**.
    - **Description**: Label stays on top. Update auto-generated text to include **Generic VAPT/OWASP** context + protection summary.
    - **History Panel**: Improve visual styling (backgrounds, icons, spacing).
- **Download Actions**:
    - **Include Config Toggle**: Add a toggle to Choose whether to include the config in the ZIP.
    - **Save to Server**: Rename "Download Config" to "Save to Server" (Functionality: Writes config to FS).
    - **Download Build**: Downloads the ZIP (respecting Include Config toggle).
- **History Panel**: Add "**Imported At**" field and a "**Force Re-Import from Server**" button.
- **Alignment**: Ensure "Configuration Details" and "Build Status" panels are **equal height** and properly aligned for a polished look.
- **Domain Selector**: Populate dropdown only with domains marked **Active** in License Management.
- Ensure the status panel content bug is resolved (vertical squeeze & missing content fix).

## Verification Plan

### Automated Tests
- **Config Integrity**: Run a PHPUnit test that invokes the build endpoint with `generate_type=config_only` and asserts that the generated `vapt-[domain]-config-[ver].php` contains the correct JSON implementation for enabled features.
- **Exclusion Check**: After a full build, unzip the bundle and verify that `.git`, `brain`, `node_modules`, `data`, and `tests` directories are absent.

### Manual Verification
1. **UI Check**: Open the Admin page, confirm the configuration panel is 60% width, padding is `15px`, and the Text Domain auto‑populates from the Plugin Name.
2. **Save to Server**: Click “Save to Server” and verify that the config file appears in the plugin root.
3. **Layout**: Ensure panels are top‑aligned, equal‑height, and vertically compact.
4. **Generation**: Generate a build for `wptest.local` and install it on a local WordPress site; confirm all enabled features are active.
5. **Button Validation**: Verify both "Download Config" and "Download Build" buttons trigger the correct endpoints and file downloads.
6. **Security**: Attempt to install the same build on `another.local`; verify that an email is sent to the Superadmin and the plugin displays a block notice.
