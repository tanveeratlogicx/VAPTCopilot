# Bug Fix: Retaining Dashboard Lifecycle Changes

The dashboard is failing to persist status changes because the new lifecycle strings (`draft`, `develop`, `test`, `release`) do not match the database `ENUM` definition (`available`, `in_progress`, `testing`, `implemented`).

## Proposed Changes

### [Component] Database Schema & Migration

#### [MODIFY] [vapt-Copilot.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/vapt-Copilot.php)
- Update `vaptm_activate_plugin` to redefine the `status` column enum in `vaptm_feature_status` as `'draft', 'develop', 'test', 'release'`.
- Since `dbDelta` often fails to update `ENUM` definitions, I will add a migration check that runs `ALTER TABLE` if needed.

#### [MODIFY] [class-vaptm-db.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-db.php)
- Update `update_feature_status` to check for `'release'` instead of `'implemented'` when setting the `implemented_at` timestamp.

### [Component] REST API

#### [MODIFY] [class-vaptm-rest.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php)
- Update `get_features` default status from `available` to `draft`.

### [Component] Dashboard UI (React)

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- Implement `localStorage` persistence for:
    - `selectedCategories`
    - `filterStatus`
    - `searchQuery`
    - `selectedFile`
- Use `useEffect` to load these values on initialization and save them whenever they change.
- Ensure that selecting a new JSON file resets or handles the filters appropriately.

### [Component] JSON Management (Phase 3 Refinements)

#### [NEW] [REST API] Delete JSON Endpoint
- Add `POST` or `DELETE` route `/vaptm/v1/delete-json` in `class-vaptm-rest.php`.
- Implement `delete_json` method to remove files from `VAPTM_PATH . 'data/'`.
- **Constraint**: Return an error if the requested file is the "active" one (passed in request or verified).

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Delete UI**: Add a Dashicon 'trash' button next to the "Feature Source" dropdown.
- **Safety**: Disable the delete button for the `selectedFile` (or show a warning and prevent the action).
- **UI Renaming**:
    - Rename "Support" column to "Include".
    - Update Toggle labels: `Test` -> `Test Method`, `Verify` -> `Verification Steps`.

### [Component] JSON Management (Phase 3)

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Upload Sync**: Update `uploadJSON` to re-fetch `data-files` from the REST API so the new file name appears in the dropdown immediately.
- **Switch Warning**: Wrap `onSelectFile` in a confirmation dialog (e.g., `window.confirm`) to warn the user about overriding the current feature list.
- **Loading State**: Show a clearer loading indicator when transitioning between files.

#### [MODIFY] [class-vaptm-rest.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php)
- **Status Sync**: (Already mostly handled) Ensure `get_features` consistently merges database statuses into the JSON feature objects based on their `key`.

## Verification Plan

### Automated Tests
- None available in current workspace.

### Manual Verification
1.  **Trigger Migration**: I will run a manual command to update the table structure.
2.  **Save Test**:
    - Change a feature to `Develop` in the dashboard.
    - Refresh the page.
    - Verify it stays as `Develop`.
    - Change it to `Release`.
    - Verify `implemented_at` timestamp appears and persists.
3.  **Scoped Stats**: Verify that stats still update correctly with the new strings.
