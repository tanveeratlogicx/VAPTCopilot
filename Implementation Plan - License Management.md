# Implementation Plan - License Management Transformation

Transform the "License Management" tab into a fully functional, 2-column interface for managing domain licenses, types, and renewals.

## User Review Required

> [!NOTE]
> **Refined Interpretation**:
> 1. **Auto Renew**: If enabled, the system will automatically extend the "Expiry Date" by the active license duration when appropriate (e.g., if expired or soon to expire).
> 2. **Manual Renew Button**: Explicitly and immediately adds the active license duration to the current Expiry Date.
> 3. **First Activation**: This date MUST be the very first activation on the domain and must NEVER be overwritten, even if the plugin is deactivated/reactivated.
> 4. **Timing**: All expiry and renewal dates must be set to **00:00:00**, ignoring the time of day.
>
> [!IMPORTANT]
> **New Addition (Empty State Logic)**:
> If no domains are configured, the UI will specifically display an **"Initialize Workspace"** card. This allows Superadmins to instantly provision the current hostname with a "Developer" license, ensuring unrestricted access immediately.
> **Post-Provisioning**: Once provisioned, the full "License Management" interface becomes available, allowing the Superadmin to immediately change the license type, toggle auto-renew, or test expirations to verify all functionality.

## Proposed Changes

### Backend

#### [MODIFY] [class-vaptc-db.php](file:///t:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptc-db.php)
- Update `update_domain` method to accept and save:
    - `license_type` (standard, pro, developer)
    - `first_activated_at` (datetime) - **Logic change**: Only update this if it is currently NULL. Do not overwrite existing values.
    - `manual_expiry_date` (datetime) - **Format**: Ensure this is saved as `Y-m-d 00:00:00`.
    - `auto_renew` (boolean/int)
    - `renewals_count` (int)
    - `renewal_history` (JSON/Text) **[NEW]**: Stores array of `{date_added, duration_days, type, source}` to allow accurate rollbacks. `source` identifies 'manual' or 'auto'.

#### [MODIFY] [vapt-copilot.php](file:///t:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/vapt-copilot.php)
- Update `vaptc_domains` table definition to include `renewal_history TEXT DEFAULT NULL`.
- **Note**: Requires deactivation/reactivation or dbDelta trigger to apply column.

#### [MODIFY] [includes/class-vaptc-rest.php](file:///t:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptc-rest.php)
- Update `update_domain` endpoint (`vaptc/v1/domains/update`):
    - **Refined Logic**:
        - When `Auto Renew` is saved as `1` (true), check if `manual_expiry_date` < TODAY via `Y-m-d 00:00:00`. If so, extend it immediately by the duration and increment `renewals_count`.
        - When `Manual Renew` is requested, calculate `new_expiry = current_expiry + duration`, ensuring 00:00:00 time. **[Logic Update]**: Push `{date: now, duration: D, license_type: T, source: 'manual'}` to `renewal_history`.
        - **Correction Logic**:
            - **Undo**: Pop last entry from `renewal_history`. Subtract `duration` from `manual_expiry_date`. Decrement `renewals_count`.
            - **Reset (Sequence Rollback)**: Iterate `renewal_history` **backwards**.
                - Calculate `potential_expiry = current_expiry - duration`.
                - If entry `source` is **'auto'**: **Stop/Break the sequence**.
                - If `potential_expiry < TODAY`: **Stop/Break the sequence** (to avoid accidental expiration).
                - Otherwise: Subtract `duration` from `manual_expiry_date`, decrement `renewals_count`, and remove entry from history.
    - Ensure `first_activated_at` logic respects the DB layer's "preserve existing" rule.

### Frontend

#### [MODIFY] [assets/js/admin.js](file:///t:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- Replace `LicenseTab` component with a new `LicenseManager` component.
- Implement a 2-column layout:
        - Show description text based on license type.
    - **UI Alignment**:
        - Ensure both columns in `.vaptm-license-grid` are of equal height to create a balanced, premium look.

> [!IMPORTANT]
> **New Interactive Constraints**:
> 1. **Manual Renew Button**: Must be **DISABLED** if the "Auto Renew" toggle is **ON**.
> 2. **Update License Button**: Must be **DISABLED** by default and only blossom into an **ENABLED** state when **UNSAVED CHANGES** are detected on the panel (e.g., license type changed, date modified, or toggle flipped).
    - **Left - [License Status]**:
        - **Display "First Activated: {Date}" text** (Moved to 2nd position). **[High Prominence]**
        - Display "Expiry Date" (Formatted Date).
        - Display "Terms Renewed" (Count). **[High Prominence]**
        - Show description text based on license type.
    - **Right - [Update License]**:
        - Form controls: License Type (Select), New Expiry (Date Picker), Auto Renew (Toggle).
        - Actions: "Update License" (Save), "Manual Renew" (Calculate new date & Save).
        - Actions: "Update License" (Save), "Manual Renew" (Calculate new date & Save).
        - **AJAX**: Ensure hitting "Update License" immediately updates the left card without reload.
        - **Dynamic Form Logic**: changing "License Type" must immediately recalculate and display the corresponding "New Expiry Date" in the form input field.
        - **Correction Controls** `[NEW]`:
            - **Undo Last Renewal**: Button to decrease `renewals_count` by 1 and subtract one license duration from `manual_expiry_date`. Visible only if `renewals_count > 0`.
            - **Reset Renewals**: Button to trigger sequence rollback of consecutive manual renewals.
            - **Confirmation**: Use `VAPTM_ConfirmModal` (React Component) for all destructive or rollback actions. Do NOT use standard JS `confirm()` alert boxes.
- Add logic to calculate new expiry dates based on type:
    - Standard: +30 Days
    - Pro: +1 Year
    - Developer: Perpetual (No Expiry/ Far Future)
- **Button Relocation**:
    - Move "Undo Last" and "Reset Renewals" buttons next to the "Manual Renew" button.
    - Style these secondary buttons as links or minimal text buttons to maintain a clean interface.
- **Empty Domain State** `[UPDATED]`:
    - **[NEW]** If no domains exist, show an **"Initialize Workspace"** interface.
    - **[NEW]** Allow Superadmins to 1-click provision the current hostname with a Developer License.

#### [MODIFY] [assets/css/admin.css](file:///t:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/css/admin.css)
- Add styles for `.vaptm-license-grid`, `.vaptm-license-card`, and status badges.
- **[NEW]** Add `.vaptm-stat-box` or similar styles to make "First Activated" and "Terms Renewed" visually distinct (e.g., background color, larger numbers).
- **[NEW]** Add styles for `.vaptm-correction-controls` (small, secondary/link text buttons).
- Ensure responsive 2-column layout.

## Verification Plan

### Automated Tests
- None (UI/Manual Verification focus).

### Manual Verification
1.  **Layout Check**: Verify the "License Management" tab shows the 2-column layout (Status Left, Update Right).
2.  **Activation Logic**: Assign a license ID to a new domain. Verify "First Activated" date is set to today.
3.  **Update Type**: Change type to "Pro". Verify the description text updates and the default expiry calculation changes to 1 year.
4.  **Manual Renew**:
    - Set type to "Standard" (Expiry = X).
    - Click "Manual Renew".
    - Verify Expiry becomes X + 30 days and "Terms Renewed" increments.
5.  **Correction Controls**:
    - Click **"Undo Last Renewal"**. Verify Expiry becomes (Previous - 30 days) and Terms Renewed decrements.
    - Click **"Reset Renewals"**. Verify Terms Renewed becomes 0.
6.  **Auto Renew Toggle**: Toggle "Auto Renew" on/off. Reload page to verify state persistence.
7.  **Perpetual**: Set type to "Developer". Verify Expiry Date shows appropriately (e.g., "Never" or far future).
8.  **Empty State**: Provision a new domain via the "Initialize Workspace" card if no domains exist.
