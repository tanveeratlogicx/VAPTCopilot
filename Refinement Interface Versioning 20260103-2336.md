# Refinement: Interface & Versioning

## Proposed Changes

### [Component] Dashboard UI (React)

#### [MODIFY] [admin.js](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Title & Version**: Update all instances of "VAPT Master Dashboard" to "VAPT Copilot Dashboard". Append `vaptmSettings.pluginVersion` (or `vaptmData.version`) to the title.
- **Column Widths**: 
    - Set `Feature Name` to use `white-space: nowrap` and width based on content (shrink-to-fit) so it takes exactly as much space as the longest name requires.
    - Adjust `Include` column if necessary.
    - Ensure `Description` remains the primary expanding column.
- **JSON Management**:
    - Implement a "Manage Sources" button (icon) next to the dropdown.
    - This button will open a **Manage JSON Sources** modal.
    - Inside the modal:
        - A list of all available JSON files.
        - Checkboxes next to each file to "Hide from Dropdown".
        - **Safety**: The active file will be disabled/hidden from checkboxes and cannot be hidden.
    - **Backend Logic**:
        - Use a WordPress option `vaptm_hidden_json_files` to persist the list of hidden filenames.
        - Update `get_data_files` REST endpoint to filter out filenames present in this option.
        - Add a new REST endpoint `POST /vaptm/v1/update-hidden-files` to update this list.

### [Component] Plugin Metadata

#### [MODIFY] [vapt-Copilot.php](file:///t:/~/Local925%20Sites/vaptCopilot/app/public/wp-content/plugins/VAPTCopilot/vapt-Copilot.php)
- Bump `VAPTM_VERSION` constant.
- Update version in plugin header.

## Verification Plan

### Manual Verification
1.  **UI Check**: Verify title says "VAPT Copilot Dashboard vX.X.X".
2.  **Layout Check**: Verify "Feature Name" is narrower and "Description" is wider.
3.  **Deletion Check**: Verify that users can delete files from the new UI location, but the active file remains protected.
4.  **Metadata Check**: Check plugin version in WP admin.
