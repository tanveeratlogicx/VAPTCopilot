// VAPT Copilot - Auto-Interface Generator
// Analyzes remediation text and returns a UI Schema for the dashboard.

(function () {
  const InterfaceGenerator = {
    /**
     * Main entry point to generate a schema from a feature's remediation text.
     * @param {string} remediationText 
     * @param {string} customInstruction Optional user-provided context
     * @returns {object} Schema object { type, props }
     */
    generate: function (remediationText, customInstruction = '') {
      if (!remediationText) return { type: 'manual', instruction: customInstruction || '' };

      const fullInstruction = customInstruction
        ? customInstruction + '\n\n--- Original Remediation ---\n' + remediationText
        : remediationText;

      // 1. Check for wp-config.php modifications
      // Pattern: "Add to wp-config.php: `CODE`" or similar
      const wpConfigMatch = remediationText.match(/wp-config\.php.*?:?\s*`([^`]+)`/i);
      if (wpConfigMatch) {
        return {
          type: 'wp_config',
          code: wpConfigMatch[1].trim(),
          instruction: fullInstruction
        };
      }

      // 2. Check for .htaccess modifications
      // Pattern: "Add `CODE` to .htaccess" or ".htaccess.*?:?\s*`([^`]+)`"
      const htaccessMatch = remediationText.match(/\.htaccess.*?:?\s*`([^`]+)`/i) ||
        remediationText.match(/Add\s*`([^`]+)`\s*to\s*\.htaccess/i);

      if (htaccessMatch) {
        return {
          type: 'htaccess',
          rule: htaccessMatch[1].trim(),
          instruction: fullInstruction
        };
      }

      // 3. Check for specific numeric inputs (heuristics)
      // Pattern: "min X chars" or "X minutes"
      const minLengthMatch = remediationText.match(/min(?:imum)?\s*(\d+)\s*char/i);
      if (minLengthMatch) {
        return {
          type: 'complex_input',
          instruction: fullInstruction,
          inputs: [
            {
              id: 'min_length',
              type: 'number',
              label: 'Minimum Character Length',
              default: parseInt(minLengthMatch[1], 10)
            }
          ]
        };
      }

      // 4. Fallback: Manual Instruction
      return {
        type: 'manual',
        instruction: fullInstruction
      };
    }
  };

  // Expose to global scope
  window.VAPTM_Generator = InterfaceGenerator;
})();
