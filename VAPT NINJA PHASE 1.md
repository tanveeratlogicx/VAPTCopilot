# Phase 1: Foundation & Authentication
**Context**: Establishing the secure core of "VAPT Copilot". Separation of Superadmin vs Client dashboards and Enhanced Email OTP implementation.
**Location**: `T:\~\Local925 Sites\vaptCopilot\app\public\wp-content\plugins\VAPTCopilot`

## Change Log
| Date | Status | Changes |
| :--- | :--- | :--- |
| 2026-01-03 | **Active** | Initial Phase 1 Plan Created. |

## 1. Objectives
- **Secure Entry Points**: Ensure Superadmin dashboard is only accessible to the authorized user (`tanmalik786`).
- **Enhanced OTP**: Implement Email OTP for Superadmin login.
- **Secure Config**: Obfuscate/Secure critical constants.

## 2. Technical Implementation Tasks

### A. Core Plugin Setup (Migration & Rename)
- [ ] Initialize `vapt-Copilot.php` (based on `vapt-master.php`).
- [ ] Update Plugin Header and Constants.
- [ ] Implement `vaptm_check_permissions` helper.

### B. Authentication Refactor (`VAPTM_Auth`)
- [ ] **Email OTP Logic**:
    - Ensure `send_otp()` sends to Superadmin Email.
    - Update `handle_otp_verification()` to verify code.
- [ ] **UI Update**:
    - Restore OTP Form to accept single code.

### C. Dashboard Separation
- [ ] **Menu Logic Refactor**:
    - Remove shared menu logic.
    - **Superadmin**: `add_menu_page` for 'VAPT Copilot' (Visible ONLY to `tanmalik786`).
    - **Client**: `add_menu_page` for 'VAPT Client' (Visible to other admins).
- [ ] **Router Check**:
    - In `vaptm_render_admin_page`, enforce `vaptm_check_permissions()` strict check.

## 3. File Structure
```text
/vapt-Copilot.php (Main Plugin File)
/includes/
  ├── class-vaptm-auth.php (Refactored)
```

## 4. Database / Storage
- **Transients**:
    - `vaptm_otp_email_{user_id}`
    - `vaptm_auth_session_{user_id}`

## 5. Security Checklist
- [ ] Rate Limit check implemented on OTP submission?
- [ ] Are OTPs strictly tied to `user_id`?
- [ ] Is SMS gateway strictly hardcoded to `+92 333 4227099` for Superadmin?
