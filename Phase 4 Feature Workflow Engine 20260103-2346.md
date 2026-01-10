# Phase 4: Feature Workflow Engine

## Goal Description
This phase implements the logic and infrastructure to manage the lifecycle of a security feature from initial drafting to final release. It ensures data integrity through enforced state transitions and provides an audit trail for accountability.

## Proposed Changes

### [Component] Database Schema (PHP/SQL)

#### [MODIFY] [vapt-Copilot.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/vapt-Copilot.php)
- **New Table**: `vaptm_feature_history`
    - `id` (INT, AI, PK) - Standard primary key.
    - `feature_key` (VARCHAR) - Linking to the feature.
    - `old_status` (VARCHAR) - Previous state.
    - `new_status` (VARCHAR) - New state.
    - `user_id` (BIGINT) - User who performed the action.
    - `note` (TEXT) - Optional comment from the dev.
    - `created_at` (DATETIME) - Timestamp of change.
- **Table Update**: `vaptm_feature_status`
    - Add `assigned_to` column (BIGINT) to track the current developer.

### [Component] Workflow Logic (PHP)

#### [NEW] [class-vaptm-workflow.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-workflow.php)
- Implement `transition_feature` method:
    - Validate transitions (e.g., must be in `develop` before `test`).
    - Record entry in `vaptm_feature_history`.
    - Update `vaptm_feature_status`.

#### [MODIFY] [class-vaptm-rest.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php)
- Add endpoint `POST [transition](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php#43-150)` logic.
- Add endpoint `GET [history](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php#151-180)` fetcher.

### [Component] Dashboard UI (React)

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Status Change Hooks**: Update [LifecycleIndicator](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js#72-109) to prompt for an optional "Change Note".
- **History Viewer**: Add a "History" icon/button to each feature row.
- **Assignment**: Add an "Assign To" dropdown in [FeatureList](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js#6-109).

## Verification Plan

### Automated Tests
- REST API tests for invalid transitions.
- DB Verification for history logs.

### Manual Verification
- Change a feature status in the UI, provide a note, and verify history entry.
- Verify Superadmin reassignment.
