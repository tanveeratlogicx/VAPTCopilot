# Implementation Plan - Universal Payload Probe & Enhanced AI Prompts

## Goal Description
Finalize the "Universal Payload Probe" and "Enhanced AI Design Prompts" to enable accurate, AI-generated security verification tests. This ensures the AI can define dynamic tests (like SQLi payloads) and that these tests are strictly aligned with the functional implementation.

## User Review Required
> [!IMPORTANT]
> None. Proceeding with suggested improvements as authorized.

## Proposed Changes

### [Backend] Expose Verification Metadata
#### [MODIFY] [includes/class-vaptm-rest.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/includes/class-vaptm-rest.php)
- **Method**: `get_features`
- **Change**: Explicitly map `verification_steps` and `test_method` from the database (`$meta`) to the API response (`$feature`).
- **Reason**: The frontend needs these fields to inject them into the AI Prompt context. Currently, they are missing from the REST response if they aren't in the raw JSON.

### [Frontend] Enhance AI Design Prompt
#### [MODIFY] [assets/js/admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Component**: `DesignModal` -> `copyContext`
- **Change 1 (Context)**: Inject `Verification Steps: ${feature.verification_steps}` into the prompt context immediately after "Remediation Guidelines".
- **Change 2 (Instructions)**: Update "CRITICAL RULES" to explicitly require alignment between Functional Controls and Verification Tests (e.g., "If rate limit is 60, test MUST use 75").
- **Change 3 (Probe Usage)**: Refine `universal_probe` instructions to be clearer about defining `test_config`.

## Verification Plan

### Automated Verification
- **check_rest_field**: Verify `verification_steps` field appears in `/vaptm/v1/features` response.

### Manual Verification
- **Prompt Check**: Open "Design Hub" -> Click "Copy AI Design Prompt" -> Paste and verify:
    - `Verification Steps` section is present.
    - Alignment rules are present.
