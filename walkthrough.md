# Walkthrough - Universal Payload Probe & Enhanced AI Prompts
**Date**: 2026-01-07

## Changes Implemented

### 1. Backend API Update
- **File**: `includes/class-vaptm-rest.php`
- **Change**: Updated `get_features` endpoint to explicit pass `verification_steps` and `test_method` from the database metadata to the frontend.
- **Impact**: The React frontend now has access to the manual verification steps defined in the data, allowing it to inject them into the AI prompt.

### 2. Frontend AI Prompt Enhancement
- **File**: `assets/js/admin.js`
- **Feature**: Universal Payload Probe & Alignment Rules.
- **Modifications**:
    - **Context Injection**: The AI prompt now includes the `Verification Steps` field immediately after the Description.
    - **Alignment Rule**: Added a CRITICAL rule enforcing that Verification Tests must strictly match Functional Control values (e.g. Rate Limit thresholds).
    - **Universal Probe**: Clarified instructions for using `universal_probe` for custom attacks (SQLi, XSS), requiring explicit `test_config` definitions (method, path, params).

### 3. Versioning
- Bumped Plugin Version to **1.1.4**.
- Bumped Asset Version (`VAPTM_VERSION`) to **1.4.9** to force a browser cache refresh.

### 4. Design Hub UX Refinement
- **File**: `assets/js/admin.js`
- **Change**: Swapped positions of "Copy AI Design Prompt" (now first) and "Reset Interface Schema" (now second).
- **Behavior Update**: The "Reset Interface Schema" button now forcefully resets the editor to the *default instructions* state, rather than the last saved state, acting as a true "Clear to Defaults" action.
- **Version**: Bumped to 1.5.0 (Assets) / 1.1.5 (Plugin).

## Verification

### How to Verify
1.  **Open Dashboard**: Go to the VAPT Copilot Dashboard.
2.  **Select Feature**: Choose a feature that has "Verification Steps" defined in its JSON/DB.
3.  **Design Hub**: Click the "Design" button.
4.  **Copy Prompt**: Click "Copy AI Design Prompt".
5.  **Inspect**: Paste the prompt into a text editor.
    - ✅ Verify `Verification Steps` section exists and contains text.
    - ✅ Verify text contains "Binding & Alignment (CRITICAL)".
    - ✅ Verify text contains explicit `universal_probe` instructions with the SQLi example.

### Automated Test Capability
- The frontend `universal_probe` logic was already present in `generated-interface.js`. With the new prompt instructions, the AI will now correctly generate schemas that utilize this probe, sending real payloads (like `' OR 1=1--`) to the target site to verify security blocks.
