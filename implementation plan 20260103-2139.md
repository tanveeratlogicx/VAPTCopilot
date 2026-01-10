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
