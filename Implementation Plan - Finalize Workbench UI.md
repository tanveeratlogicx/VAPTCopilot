# Implementation Plan - Finalize Workbench UI

Improve the Workbench UI by ensuring tab persistence and revamping the sidebar feature list for better usability.

## Proposed Changes

### Tab Persistence (Persistence Fix)
The Workbench currently fails to default to "Develop" on first click because of a `localStorage` key conflict between the main Dashboard (`admin.js`) and the Workbench (`client.js`). Both use `vaptm_active_tab`.

#### [MODIFY] [admin.js](file:///T:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/js/admin.js)
- **Rename Key**: Change `vaptm_active_tab` to `vaptm_admin_active_tab`.

#### [MODIFY] [client.js](file:///T:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/js/client.js)
- **Rename Key**: Change `vaptm_active_tab` to `vaptm_workbench_active_status`.
- **Default Value**: Ensure it defaults to `'Develop'` if the new key is not found.

---

### Sidebar Revamp (Link Style & Hover)
Implement a single-column, "Link Style" list of features in the sidebar with a smooth expansion effect on hover.

#### [MODIFY] [client.js](file:///T:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/js/client.js)
- **Structure**: Change sidebar items from `div` to `a` (anchor) elements.
- **Scroll Logic**: Use `e.preventDefault()` in the click handler to scroll to the feature while maintaining the link behavior.
- **Root/Sidebar Overflow**: Ensure `overflow-x: visible` on the sidebar and root containers to allow menu expansion.

#### [MODIFY] [admin.css](file:///T:/~/Local925%20Sites/vaptbuilder/app/public/wp-content/plugins/VAPTCopilot/assets/css/admin.css)
- **Link Styling**: Define `.vaptm-workbench-link` with `display: block`, `position: relative`, and `text-decoration: none`.
- **Hover Effect**: Implement `:hover` with `width: max-content`, `white-space: nowrap`, and a high `z-index` to expand over the workspace area.
- **Visual Polish**: Add shadow, background, and border-radius to the expanding link items.

## Verification Plan

### Manual Verification
- **First-Time Default**: Clear `localStorage` and verify the Workbench opens to the "Develop" tab.
- **Tab Persistence**: Switch to "Test" or "Release", refresh the page, and verify the tab remains active.
- **Main Dashboard Persistence**: Verify the main Dashboard also persists its active tab (e.g., Features vs License) without affecting the Workbench.
- **Sidebar Hover**: Verify that long feature names expand smoothly over the main content area when hovered.
- **Link Style**: Verify the sidebar items look and feel like links (cursor change, hover background).
