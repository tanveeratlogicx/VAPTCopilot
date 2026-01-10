# VAPT Ninja Development Plan

## Phase 1: Foundation & Authentication [2026-01-03 14:35]
**Objectives**: Establish the secure core of "VAPT Ninja" (formerly VAPT Master), focusing on role-based access control and dual-factor authentication for the Superadmin.
**Technical Tasks**:
1. **Refactor Authentication Class ([VAPTM_Auth](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/includes/class-vaptm-auth.php#11-216))**:
   - Implement Dual OTP System: Email (existing) + SMS (New).
   - Integrate SMS Gateway API (or hook system for provider flexibility) for `+92 333 4227099`.
   - Ensure OTPs are user-specific and transient-based (Verified: logic exists, needs SMS addition).
2. **Dashboard Entry Point Separation**:
   - Strictly separate [vaptm_render_admin_page](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/vapt-master.php#297-316) (Superadmin) from [vaptm_render_client_status_page](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/vapt-master.php#257-296) (Client).
   - Ensure Superadmin menu is visible *only* to `tanmalik786` (or defined secure user).
3. **Secure Credentials Storage**:
   - Move `VAPTM_SUPERADMIN_USER` and Email to sensitive config or obfuscate in code to prevent casual editing.
   - Implement `vaptm_check_permissions` capability wrapper.

**Database Schema**:
- **Updates**: No new tables needed for this phase.
- **Transients**: Use `vaptm_otp_{user_id}` and `vaptm_sms_otp_{user_id}`.

**File Structure**:
- [/includes/class-vaptm-auth.php](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/includes/class-vaptm-auth.php) (Update)
- `/includes/services/class-vaptm-sms.php` (New)

**Ajax Endpoints**:
- `vaptm_verify_otp` (Refactor to accept/require both codes if enabled).
- `vaptm_resend_otp` (Trigger both).
**Security Considerations**:
- Rate limiting on OTP endpoint (Max 3 attempts/5 mins).
- Session hijacking prevention (Bind session to IP/User Agent - Basic existing check [is_vaptm_localhost](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/vapt-master.php#153-164) needs expansion for production).

**Dependencies**: None.
**Success Criteria**: Superadmin can login *only* via Dual OTP. Client Admin sees restricted view.
**Estimated Effort**: 12 Hours.
**Risks**: SMS delivery failures (Mitigation: Backup codes or Email fallback option).

---

## Phase 2: Superadmin Dashboard Structure [2026-01-03 14:35]
**Objectives**: Build the React-based shell for the Superadmin Dashboard with the required 4 tabs.
**Technical Tasks**:
1. **React App Shell (`admin.js`)**:
   - Implement Tab Router: Feature Management, License Management, Domain Features, Build Generator.
   - Setup global Context for state management (`VAPTMContext`).
2. **Tab: Feature Management (Read-Only UI)**:
   - Grid/List view of features fetched from DB.
   - Categories filters.
3. **Tab: License Management**:
   - UI for managing `vaptm_domains` table.
   - Add/Edit Domain, License Type, Expiry.
4. **Tab: Domain Features**:
   - Interface to toggling features per domain (`vaptm_domain_features`).

**Database Schema**:
- Ensure `vaptm_domains` has `manual_expiry_date` (Confirmed).
- Ensure `vaptm_feature_status` is populated.

**File Structure**:
- `/assets/js/components/DashboardShell.js`
- `/assets/js/components/tabs/FeatureManagement.js`
- `/assets/js/components/tabs/LicenseManagement.js`
- `/assets/js/components/tabs/DomainFeatures.js`

**Ajax Endpoints**:
- `GET /vaptm/v1/dashboard/init` (Fetch initial state for all tabs).

**Security Considerations**:
- Nonce verification on all React API calls (`wp.apiFetch`).
- Capability check `manage_options` + `vaptm_superadmin` on all REST endpoints.

**Dependencies**: Phase 1 (Auth).
**Success Criteria**: Superadmin can navigate between 4 tabs; UI matches "Premium" aesthetic.
**Estimated Effort**: 16 Hours.
**Risks**: React build complexity (Mitigation: Use `wp-scripts` or simple Babel setup if standard).

---

## Phase 3: JSON Feature Management [2026-01-03 14:35]
**Objectives**: Implement the "Brain" of the system – importing and managing security features via JSON.
**Technical Tasks**:
1. **JSON Import Engine**:
   - Upload handler for JSON files.
   - Validator against schema (name, description, category, severity, owasp, etc.).
   - Parser to insert/update `vaptm_feature_meta` and `vaptm_feature_status`.
2. **Feature Editor UI**:
   - interface to edit loaded JSON data before "building".
   - "Draft" status assignment upon import.

**Database Schema**:
- **`vaptm_feature_meta`**: Verify columns align with JSON fields (severity, owasp, remediation).
- **`vaptm_feature_status`**: Ensure status defaults to 'available' (Draft).

**File Structure**:
- `/includes/class-vaptm-feature-manager.php` (New)
- `/assets/js/components/feature-upload/JsonUploader.js`

**Ajax Endpoints**:
- `POST /vaptm/v1/features/import` (Handle JSON upload & parse).
- `PUT /vaptm/v1/features/{key}` (Update feature metadata).

**Security Considerations**:
- Sanitize all HTML/Text in JSON to prevent Stored XSS in Dashboards.
- Strict file type validation (.json only).

**Dependencies**: Phase 2.
**Success Criteria**: Admin can upload a JSON, see it in "Draft", and data persists to DB.
**Estimated Effort**: 14 Hours.
**Risks**: Malformed JSON crashing importer (Mitigation: Robust error handling/reporting).

---

## Phase 4: Feature Workflow Engine [2026-01-03 14:35]
**Objectives**: Manage the lifecycle of a security feature (Draft -> Develop -> Test -> Release).
**Technical Tasks**:
1. **Status State Machine**:
   - Backend logic to enforce transitions (e.g., cannot go Draft -> Release without Test).
   - Visual Status Indicators in Dashboard (Kanban or Badge style).
2. **Developer Assignment**:
   - Logic to "Take out" a feature for development (Phase implementation logic described in prompt).
   - Logging mechanisms for changelogs.

**Database Schema**:
- **`vaptm_feature_status`**: potentially add `assigned_to` or `history_log` if detailed tracking needed.
- Suggestion: New Table `vaptm_feature_history` for audit trail.

**File Structure**:
- `/includes/class-vaptm-workflow.php`
- `/assets/js/components/workflow/StatusStepper.js`

**Ajax Endpoints**:
- `POST /vaptm/v1/features/{key}/transition` (Change status).

**Security Considerations**: None specific beyond standard ACL.
**Dependencies**: Phase 3.
**Success Criteria**: Features move through columns/statuses correctly.
**Estimated Effort**: 10 Hours.
**Risks**: Infinite loops in logic (Mitigation: Simple linear state machine).

---

## Phase 5: Client Dashboard Implementation [2026-01-03 14:35]
**Objectives**: The view for the "End User" (Client) who is testing or using the features.
**Technical Tasks**:
1. **Client View Logic**:
   - Filter features: Show only assigned features in 'Develop' or 'Test' status (for dev sites) or 'Release' (for prod).
   - Hide "VAPT Master Dashboard" menu; expose "VAPT Ninja Security".
2. **Test Interface**:
   - UI for Client to mark "Verified" or "Failed" during Test phase.
   - Feedback form for "Remediation" issues.

**Database Schema**:
- `vaptm_domain_features` (Enabled features per domain).

**File Structure**:
- `/includes/class-vaptm-client.php`
- `/assets/js/client-app.js` (Separate bundle for client view to keep file size down).

**Ajax Endpoints**:
- `POST /vaptm/v1/client/feedback` (Store testing feedback).

**Security Considerations**:
- **Critical**: Ensure Client cannot access Superadmin endpoints.
- Isolate Client API routes.

**Dependencies**: Phase 4.
**Success Criteria**: Client user sees *only* their features and can interact (Test/Verify).
**Estimated Effort**: 16 Hours.
**Risks**: Leaking Superadmin features to Client (Mitigation: Strict `current_user` checks).

---

## Phase 6: Auto-Interface Generation [2026-01-03 14:35]
**Objectives**: The "Magic" phase. Automatically build settings pages from the JSON definitions.
**Technical Tasks**:
1. **Dynamic Form Copilot**:
   - React component that takes `remediation` schema (inputs, toggles) and renders UI.
   - Map `test_method` to an interactive "Run Test" button/terminal output style.
2. **Feature Customization**:
   - Allow "Client" to tweak parameters (e.g., "Max Login Attempts" threshold) if JSON defines variables.

**Database Schema**:
- `vaptm_feature_settings` (New table: store values for dynamic fields per domain/feature).

**File Structure**:
- `/assets/js/components/dynamic/FormGenerator.js`
- `/assets/js/components/dynamic/TestRunner.js`

**Ajax Endpoints**:
- `POST /vaptm/v1/features/{key}/execute-test` (Mock or real execution of test method).

**Security Considerations**:
- Validate all dynamic inputs against types (int, string, email).

**Dependencies**: Phase 3, 5.
**Success Criteria**: A JSON with "input: threshold" renders a Number Input in Client Dashboard automatically.
**Estimated Effort**: 20 Hours.
**Risks**: Complex UI requirements not expressible in simple JSON (Mitigation: Support "Custom Component" map).

---

## Phase 7: Domain Locking & Build System [2026-01-03 14:35]
**Objectives**: Generate the "White Label" plugin zip, locked to a domain securely.
**Technical Tasks**:
1. **Digital Signature Domain Locking** (Secure & Non-Obfuscated):
   - Generate a private/public key pair.
   - Sign the `domain + expiration` string.
   - Embed Public Key in the built plugin.
   - Plugin verifies signature on load. If signature invalid for current domain = die().
   - This effectively prevents changing the domain constant without the private key.
2. **Build Generator UI**:
   - Card layout selection of "Release" features.
   - Toggle: "Include Superadmin Tools?" (for dev builds).
3. **Zip Copilot ([VAPTM_Build](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/includes/class-vaptm-build.php#11-112) Update)**:
   - Dynamic file copying.
   - Rename plugin files/headers based on White Label inputs.
   - Exclude "Source" JSONs/Dev tools from final zip.

**Database Schema**:
- `vaptm_domain_builds` (History - Existing).

**File Structure**:
- `/includes/class-vaptm-crypto.php` (New: Handle signing/verification).
- [/includes/class-vaptm-build.php](file:///t:/~/Local925%20Sites/wptest/app/public/wp-content/plugins/VAPTMaster/includes/class-vaptm-build.php) (Enhance).

**Ajax Endpoints**:
- `POST /vaptm/v1/build/generate`.

**Security Considerations**:
- Secure usage of `eval()` or dynamic `include`? Avoid `eval()`. Use templating.
- Ensure keys are not included in the client zip (Private key stays on server).

**Dependencies**: Phase 6.
**Success Criteria**: Generated ZIP installs on correct domain (Works) and fails on wrong domain (Locked).
**Estimated Effort**: 18 Hours.
**Risks**: False positives on domain check (e.g. `www.` vs non-`www`). Mitigation: Normalize domains in check.

---

## Phase 8: Testing, Security & Deployment [2026-01-03 14:35]
**Objectives**: Final polish, penetration test of the Copilot itself, and deployment.
**Technical Tasks**:
1. **Security Audit**:
   - Check all AJAX endpoints for IDOR (Can client A see client B data?).
   - Verify OTP bypass resistance.
2. **Performance Tuning**:
   - optimize SQL queries for dashboards with many features.
3. **Migration**:
   - Script to suck in code/data from GitHub repo/current setup into new structure.

**Database Schema**: Final Cleanup.
**File Structure**: Cleanup temp dirs.
**Dependencies**: All Phases.
**Success Criteria**: Production Release 1.0.
**Estimated Effort**: 10 Hours.
