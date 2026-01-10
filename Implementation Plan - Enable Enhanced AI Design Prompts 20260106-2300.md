# Implementation Plan - Enable Enhanced AI Design Prompts

## Changelog

### [2026-01-06 22:55] Update: Prompt Enhancement & Alignment
-   **Goal**: Enrich AI Design Prompt with "Verification Steps" and align Verification Engine tests with Functional Implementation.
-   **Version Bump**: Increment plugin version.

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
-   **Context**: `DesignModal` component -> `copyContext` function.
-   **Changes**:
    1.  **Context**: Ensure `Description` is prominently included to provide the AI with key information about "what the Feature is about and supposed to help with".
    2.  Inject `Verification Steps` from `feature.verification_steps`.
    3.  **Critical Rule Additions**:
        -   Instruct AI to use verification steps for `test_logic`.
        -   **Alignment Rule**: Explicitly instruct AI to align Verification Engine tests with Functional Implementation controls (e.g., if a rate limit is set to X, test with 125% of X).

#### [MODIFY] [vapt-Copilot.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/vapt-Copilot.php) (Subject to file name verification)
-   **Change**: Bump plugin version constant/header.

## Verification Plan
1.  **Reload Dashboard**: Refresh the VAPT Master Dashboard.
2.  **Generate Prompt**: Open Design Hub for a feature (e.g., "WordPress Version Disclosure") and copy the prompt.
3.  **Inspect Output**: Verify:
    -   `Description (Context/Goal)` is present.
    -   `Verification Steps` section is populated.
    -   New **Alignment** and **Verification Logic** critical rules are present.
4.  **Check Version**: Verify the dashboard title shows the new version number.
