# Phase 4: Feature Workflow Engine

## Goal Description
This phase implements the logic and infrastructure to manage the lifecycle of a security feature from initial drafting to final release. It ensures data integrity through enforced state transitions and provides an audit trail for accountability.

## Proposed Changes

### [Component] Database Schema (PHP/SQL)

#### [MODIFY] [vapt-Copilot.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/vapt-Copilot.php)
- **New Table**: `vaptm_feature_history`
    - `id` (INT, AI, PK)
    - `feature_key` (VARCHAR)
    - `old_status` (VARCHAR)
    - `new_status` (VARCHAR)
    - `user_id` (BIGINT)
    - `note` (TEXT)
    - `created_at` (DATETIME)
- **Table Update**: `vaptm_feature_status`
    - Add `assigned_to` column (BIGINT) to track the current developer.

### [Component] Workflow Logic (PHP)

#### [NEW] [class-vaptm-workflow.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-workflow.php)
- Implement `transition_feature` method:
    - Validate transitions (e.g., must be in `develop` before `test`).
    - Record entry in `vaptm_feature_history`.
    - Update `vaptm_feature_status`.

#### [MODIFY] [class-vaptm-rest.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php)
- Add endpoint `POST /vaptm/v1/features/transition`.
- Add endpoint `GET /vaptm/v1/features/{key}/history`.

### [Component] Dashboard UI (React)

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Status Change Hooks**: Update `LifecycleIndicator` to prompt for an optional "Change Note" when changing status.
- **History Viewer**: Add a "History" icon/button to each feature row that opens a modal showing the audit trail.
- **Assignment**: Add an "Assign To" dropdown in the feature list or a management modal.

## Verification Plan

### Automated Tests
- REST API tests to ensure invalid transitions (e.g. Draft -> Release) are rejected with a 400 error.
- Verify database entries in `vaptm_feature_history` after a successful transition.

### Manual Verification
- Change a feature status in the UI, provide a note, and verify it appears in the history log.
- Verify that only the Superadmin can reassign features.
