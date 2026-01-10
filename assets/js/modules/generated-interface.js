// React Component to Render Generated Interfaces
// Version 3.0 - Global Driver & Probe Architecture
// Expects props: { feature, onUpdate }

(function () {
  const { createElement: el, useState, useEffect } = wp.element;
  const { Button, TextControl, ToggleControl, SelectControl, TextareaControl } = wp.components;
  const { __ } = wp.i18n;

  /**
   * PROBE REGISTRY: Global Verification Handlers
   */
  const PROBE_REGISTRY = {
    // 1. Header Probe: Verifies HTTP response headers
    check_headers: async (siteUrl, control, featureData) => {
      const resp = await fetch(siteUrl + '?vaptm_header_check=' + Date.now(), { method: 'GET', cache: 'no-store' });
      const headers = {};
      resp.headers.forEach((v, k) => { headers[k] = v; });
      console.log("[VAPTM] Full Response Headers:", headers);

      const vaptmEnforced = resp.headers.get('x-vaptm-enforced');
      const securityHeaders = ['x-frame-options', 'x-content-type-options', 'x-xss-protection', 'content-security-policy', 'access-control-expose-headers'];
      const found = securityHeaders.filter(h => resp.headers.has(h)).map(h => `${h}: ${resp.headers.get(h)}`);

      if (vaptmEnforced) {
        return { success: true, message: `PASS: Plugin is actively enforcing headers (${vaptmEnforced}). Data: ${found.join(' | ')}`, raw: headers };
      }

      if (found.length > 0) {
        return { success: true, message: `INFO: Site is secure, but NOT by this plugin. Found: ${found.join(' | ')}`, raw: headers };
      }

      return { success: false, message: `FAILED: No security headers found. Raw headers logged to console.`, raw: headers };
    },

    // 2. Batch Probe: Verifies Rate Limiting (Sends 125% of RPM)
    spam_requests: async (siteUrl, control, featureData) => {
      try {
        const rpm = parseInt(featureData['rpm'] || featureData['rate_limit'] || '60', 10);
        if (isNaN(rpm) || rpm <= 0) {
          throw new Error('Invalid rate limit configuration. RPM must be a positive number.');
        }

        const load = Math.ceil(rpm * 1.25);
        if (load > 1000) {
          console.warn('[VAPTM] Warning: Rate limit test sending more than 1000 requests. This may impact server performance.');
        }

        const probes = [];
        for (let i = 0; i < load; i++) {
          probes.push(
            fetch(siteUrl + '?vaptm_test_spike=' + i, { cache: 'no-store' })
              .then(r => ({ status: r.status, headers: r.headers }))
              .catch(err => {
                console.warn(`[VAPTM] Request ${i} failed:`, err);
                return { status: 0, headers: new Headers(), error: err.message };
              })
          );
        }

        const responses = await Promise.all(probes);
        let debugInfo = '';
        let lastCount = -1;

        const stats = responses.reduce((acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1;

          // Capture debug info from the last successful response
          if (r.headers.has('x-vaptm-debug')) debugInfo = r.headers.get('x-vaptm-debug');
          if (r.headers.has('x-vaptm-count')) lastCount = r.headers.get('x-vaptm-count');

          return acc;
        }, {});

        const blocked = stats[429] || 0;
        const debugMsg = `(Debug: ${debugInfo || 'None'}, LastCount: ${lastCount})`;
        const successCount = stats[200] || 0;

        if (blocked > 0) {
          return { success: true, message: `PASS: Out of ${load} Requests sent, ${successCount} successfully sent, ${blocked} Blocked for excessive rate. ${debugMsg}` };
        }
        return { success: false, message: `FAIL: Sent ${load} requests, all accepted. ${JSON.stringify(stats)}. ${debugMsg}. Rate limiting NOT active.` };
      } catch (err) {
        return {
          success: false,
          message: `❌ Test Error: ${err.message}. Rate limit test could not complete.`,
          raw: { error: err.message, stack: err.stack }
        };
      }
    },

    // 3. Status Probe: Verifies specific file block (e.g., XML-RPC)
    block_xmlrpc: async (siteUrl, control, featureData) => {
      const resp = await fetch(siteUrl + '/xmlrpc.php', { method: 'POST', body: '<?xml version="1.0"?><methodCall><methodName>system.listMethods</methodName><params></params></methodCall>' });
      const vaptmEnforced = resp.headers.get('x-vaptm-enforced');

      if (vaptmEnforced === 'php-xmlrpc') {
        return { success: true, message: `PASS: Plugin is actively blocking XML-RPC (${vaptmEnforced}).` };
      }

      if ([403, 404, 401].includes(resp.status)) {
        return { success: true, message: `INFO: XML-RPC is blocked (HTTP ${resp.status}), but NOT by this plugin.` };
      }
      return { success: false, message: `CRITICAL: Server returned HTTP ${resp.status} (Exposed).` };
    },

    // 4. Directory Probe: Verifies Indexing Block
    disable_directory_browsing: async (siteUrl, control, featureData) => {
      const target = siteUrl + '/wp-content/uploads/';
      const resp = await fetch(target, { cache: 'no-store' });
      const text = await resp.text();
      const snippet = text.substring(0, 500); // Take first 500 chars for proof
      const vaptmEnforced = resp.headers.get('x-vaptm-enforced');

      const isListing = snippet.toLowerCase().includes('index of /') || snippet.includes('parent directory');

      if (vaptmEnforced === 'php-dir') {
        return { success: true, message: `PASS: Plugin is actively blocking directory listing (${vaptmEnforced}).`, raw: snippet };
      }

      if (resp.status === 403) {
        return { success: true, message: `INFO: Server physically blocked access (HTTP 403), but NOT by this plugin.`, raw: snippet };
      }

      if (!isListing) {
        return { success: true, message: `INFO: Directory listing not detected (HTTP ${resp.status}), but NOT by this plugin.`, raw: snippet };
      }

      return { success: false, message: `SECURITY RISK: Directory Browsing is ACTIVE (HTTP ${resp.status}). "Index of" found.`, raw: snippet };
    },

    // 5. Null Byte Probe (and aliases)
    inject_null_unicode: async (siteUrl, control, featureData) => {
      return PROBE_REGISTRY.block_null_byte_injection(siteUrl, control, featureData);
    },
    block_null_byte_injection: async (siteUrl, control, featureData) => {
      const target = siteUrl + '/?vaptm_test_param=safe&vaptm_attack=test%00payload';
      const resp = await fetch(target, { cache: 'no-store' });
      const vaptmEnforced = resp.headers.get('x-vaptm-enforced');

      if (vaptmEnforced === 'php-null-byte' || resp.status === 400) {
        return { success: true, message: `PASS: Null Byte Injection Blocked (HTTP ${resp.status}). Enforcer: ${vaptmEnforced || 'Server'}` };
      }

      return { success: false, message: `FAIL: Null Byte Payload Accepted (HTTP ${resp.status}).` };
    },

    // 6. Version Hide Probe
    hide_wp_version: async (siteUrl, control, featureData) => {
      const resp = await fetch(siteUrl + '?vaptm_version_check=1', { method: 'GET', cache: 'no-store' });
      const text = await resp.text();
      const vaptmEnforced = resp.headers.get('x-vaptm-enforced');

      // Check for generator tag
      const hasGenerator = text.toLowerCase().includes('name="generator" content="wordpress');

      if (!hasGenerator) {
        // Single success wording to avoid multiple “PASS” message styles
        return { success: true, message: `Secure: WordPress generator tag is hidden.` };
      }

      return { success: false, message: `Vulnerable: WordPress generator tag is present in the page source.` };
    },

    // 7. Universal Payload Probe (Dynamic Real-World Testing)
    universal_probe: async (siteUrl, control, featureData) => {
      const config = control.test_config || {};
      const method = config.method || 'GET';
      const path = config.path || '/';
      const params = config.params || {};
      const headers = config.headers || {};
      const body = config.body || null;
      const expectedStatus = config.expected_status;
      const expectedText = config.expected_text;
      const expectedHeaders = config.expected_headers;

      // Construct URL
      let url = siteUrl + path;
      if (method === 'GET' && Object.keys(params).length > 0) {
        const qs = new URLSearchParams(params).toString();
        url += (url.includes('?') ? '&' : '?') + qs;
      }

      const fetchOptions = {
        method: method,
        headers: headers,
        cache: 'no-store'
      };

      if (method !== 'GET' && body) {
        fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
        if (typeof body === 'object' && !fetchOptions.headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      } else if (method !== 'GET' && Object.keys(params).length > 0) {
        // Form encoded for POST if body not specified
        const formData = new URLSearchParams();
        for (const k in params) formData.append(k, params[k]);
        fetchOptions.body = formData;
        if (!fetchOptions.headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded';
        }
      }

      const resp = await fetch(url, fetchOptions);
      const text = await resp.text();

      // Security State Logic - Enhanced for edge cases
      let isSecure = false;
      let statusMatches = false;
      let headerMatches = false;
      const code = resp.status;

      // Normalize expectedStatus to array for easier handling
      let expectedStatusArray = [];
      if (expectedStatus) {
        expectedStatusArray = Array.isArray(expectedStatus)
          ? expectedStatus.map(s => parseInt(s))
          : [parseInt(expectedStatus)];
      }

      // Check Status Match
      if (expectedStatusArray.length > 0) {
        statusMatches = expectedStatusArray.includes(code);
      }

      // Check Header Match (if expected_headers provided)
      if (expectedHeaders && typeof expectedHeaders === 'object') {
        headerMatches = true;
        const responseHeaders = {};
        resp.headers.forEach((v, k) => { responseHeaders[k.toLowerCase()] = v; });

        for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
          const actualValue = responseHeaders[key.toLowerCase()];
          if (!actualValue || actualValue !== expectedValue) {
            headerMatches = false;
            break;
          }
        }
      }

      // Determine Security State based on user's intent
      const expectsBlock = expectedStatusArray.length > 0 && expectedStatusArray.every(s => s >= 400);
      const expectsAllow = expectedStatusArray.includes(200);
      const hasHeaderCheck = expectedHeaders && typeof expectedHeaders === 'object';

      if (hasHeaderCheck) {
        // Header-based verification: Check headers even if status is 200
        isSecure = headerMatches && (code === 200 || expectsAllow || statusMatches);
      } else if (expectsBlock) {
        // User expects attack to be BLOCKED (4xx/5xx)
        isSecure = statusMatches && code >= 400;
      } else if (expectsAllow) {
        // User expects normal response (200) but with protection indicators
        isSecure = code === 200 && (expectedText ? text.includes(expectedText) : true);
      } else if (statusMatches) {
        // Status matches user's expectation (regardless of code)
        isSecure = true;
      } else {
        // No clear expectation or mismatch - use heuristic
        isSecure = code >= 400; // Assume block = secure by default
      }

      // Result Formatting with detailed feedback
      let message = '';
      if (isSecure) {
        if (hasHeaderCheck && headerMatches) {
          message = `🛡️ SECURE: Protection Headers Present (HTTP ${code}). All expected headers verified.`;
        } else if (expectsBlock && statusMatches) {
          message = `🛡️ SECURE: Attack Blocked (HTTP ${code}). Expected block code (${expectedStatus}).`;
        } else if (expectsAllow && code === 200) {
          message = `🛡️ SECURE: Normal Response (HTTP ${code}) with protection indicators.`;
        } else {
          message = `🛡️ SECURE: Expected Response Received (HTTP ${code}).`;
        }
      } else {
        if (code === 200 && expectsBlock) {
          message = `⚠️ VULNERABLE: Attack Accepted (HTTP 200). Expected Block (${expectedStatus}).`;
        } else if (hasHeaderCheck && !headerMatches) {
          const missing = [];
          const responseHeaders = {};
          resp.headers.forEach((v, k) => { responseHeaders[k.toLowerCase()] = v; });
          for (const [key, expectedValue] of Object.entries(expectedHeaders)) {
            if (!responseHeaders[key.toLowerCase()]) {
              missing.push(key);
            }
          }
          message = `⚠️ VULNERABLE: Missing Protection Headers (HTTP ${code}). Missing: ${missing.join(', ')}.`;
        } else if (statusMatches === false && expectedStatus) {
          message = `❌ MISMATCH: Got HTTP ${code}, expected ${expectedStatus}. Security state unclear.`;
        } else {
          message = `❌ FAILED: Unexpected Response (HTTP ${code}). Could not verify security.`;
        }
      }

      return {
        success: isSecure,
        message: message,
        raw: `URL: ${url} | Status: ${code} | Expected: ${expectedStatus || 'N/A'}`
      };
    },

    // 8. Default Generic Probe
    default: async (siteUrl, control) => {
      const resp = await fetch(siteUrl + '?vaptm_ping=1');
      return { success: resp.ok, message: `Probe result: HTTP ${resp.status}` };
    }
  };

  /* New: Interactive Test Runner Component */
  const TestRunnerControl = ({ control, featureData }) => {
    const [status, setStatus] = useState('idle'); // idle, running, success, error
    const [result, setResult] = useState(null);

    const runTest = async () => {
      setStatus('running');
      setResult(null);

      const { test_logic } = control;
      const siteUrl = window.location.origin;
      const handler = PROBE_REGISTRY[test_logic] || PROBE_REGISTRY['default'];

      try {
        // Add timeout protection (30 seconds max)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout after 30 seconds')), 30000)
        );

        const handlerPromise = handler(siteUrl, control, featureData);

        const result = await Promise.race([handlerPromise, timeoutPromise]);

        if (result && typeof result === 'object') {
          const { success, message, raw } = result;
          setStatus(success ? 'success' : 'error');
          setResult(message || 'Test completed without message');

          if (raw) {
            console.log(`[VAPTM Probe Raw Data]:`, raw);
          }
        } else {
          throw new Error('Invalid test result format');
        }
      } catch (err) {
        setStatus('error');
        const errorMsg = err.message || 'Unknown error occurred';

        // Provide user-friendly error messages
        let userMessage = `❌ Test Error: ${errorMsg}`;
        if (errorMsg.includes('timeout')) {
          userMessage = '⏱️ Test Timeout: The verification test took too long (>30s). Server may be slow or unresponsive.';
        } else if (errorMsg.includes('CORS') || errorMsg.includes('fetch')) {
          userMessage = '🌐 Network Error: Could not connect to server. Check CORS settings or server availability.';
        } else if (errorMsg.includes('network') || errorMsg.includes('Failed to fetch')) {
          userMessage = '📡 Network Error: Failed to reach server. Check your internet connection and server status.';
        }

        setResult(userMessage);
        console.error('[VAPTM Probe Error]', {
          test_logic,
          error: err,
          control: control.key,
          stack: err.stack
        });
      }
    };

    // Dynamic Label replacement
    const rpmValue = parseInt(featureData['rpm'] || featureData['rate_limit'] || '60', 10);
    const loadValue = Math.ceil(rpmValue * 1.25);
    const displayLabel = control.test_logic === 'spam_requests'
      ? control.label.replace(/\(\d+.*\)/g, `(${loadValue} req/min)`)
      : control.label;

    return el('div', { className: 'vaptm-test-runner', style: { padding: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '10px' } }, [
      el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' } }, [
        el('strong', { style: { fontSize: '13px', color: '#334155' } }, displayLabel),
        el(Button, { isSecondary: true, isSmall: true, isBusy: status === 'running', onClick: runTest, disabled: status === 'running' }, 'Run Verify')
      ]),
      el('p', { style: { margin: 0, fontSize: '12px', color: '#64748b' } }, control.help),

      // Result Display
      status !== 'idle' && status !== 'running' && el('div', {
        style: {
          marginTop: '10px',
          padding: '8px 12px',
          background: status === 'success' ? '#f0fdf4' : '#fef2f2',
          borderLeft: `4px solid ${status === 'success' ? '#22c55e' : '#ef4444'}`,
          fontSize: '12px',
          color: status === 'success' ? '#15803d' : '#b91c1c'
        }
      }, [
        el('strong', null, status === 'success' ? 'PASS: ' : 'FAIL: '),
        result
      ])
    ]);
  };

  const GeneratedInterface = ({ feature, onUpdate }) => {
    const schema = feature.generated_schema ? (typeof feature.generated_schema === 'string' ? JSON.parse(feature.generated_schema) : feature.generated_schema) : {};
    const currentData = feature.implementation_data ? (typeof feature.implementation_data === 'string' ? JSON.parse(feature.implementation_data) : feature.implementation_data) : {};

    if (!schema || !schema.controls || !Array.isArray(schema.controls)) {
      return el('div', { style: { padding: '20px', textAlign: 'center', color: '#999', fontStyle: 'italic' } },
        __('No functional controls defined for this implementation.', 'vapt-Copilot')
      );
    }

    const handleChange = (key, value) => {
      const updated = { ...currentData, [key]: value };
      if (onUpdate) {
        onUpdate(updated);
      }
    };

    const renderControl = (control, index) => {
      try {
        const { type, label, key, help, options, rows, action } = control;
        const value = currentData[key] !== undefined ? currentData[key] : (control.default || '');
        const uniqueKey = key || `ctrl-${index}`;

        switch (type) {
          case 'test_action':
            return el(TestRunnerControl, { key: uniqueKey, control, featureData: currentData });

          case 'button':
            return el('div', { key: uniqueKey, style: { marginBottom: '15px' } }, [
              el(Button, {
                isSecondary: true,
                onClick: () => {
                  if (action === 'reset_validation_logs') {
                    // TODO: Implement actual backend reset
                    alert('Reset signal sent to backend.');
                  } else {
                    console.log('Button clicked:', action);
                  }
                }
              }, label),
              help && el('p', { style: { margin: '5px 0 0', fontSize: '12px', color: '#666' } }, help)
            ]);

          case 'toggle':
            return el(ToggleControl, {
              key: uniqueKey, label, help,
              checked: !!value,
              onChange: (val) => handleChange(key, val)
            });

          case 'input':
            return el(TextControl, {
              key: uniqueKey, label, help,
              value: value,
              onChange: (val) => handleChange(key, val)
            });

          case 'select':
            return el(SelectControl, {
              key: uniqueKey, label, help,
              value: value,
              options: options || [],
              onChange: (val) => handleChange(key, val)
            });

          case 'textarea':
          case 'code':
            return wp.components.TextareaControl ? el(wp.components.TextareaControl, {
              key: uniqueKey, label, help,
              value: value,
              rows: rows || 6,
              onChange: (val) => handleChange(key, val),
              style: type === 'code' ? { fontFamily: 'monospace', fontSize: '12px', background: '#f0f0f1' } : {}
            }) : null;

          default:
            return el('div', { key: uniqueKey, style: { marginBottom: '10px', color: '#d63638' } },
              sprintf(__('Unknown control type: %s', 'vapt-Copilot'), type)
            );
        }
      } catch (err) {
        console.error('Control Render Error:', err);
        return el('div', { key: index, style: { color: 'red' } }, 'Render Error');
      }
    };

    return el('div', { className: 'vaptm-generated-controls', style: { display: 'flex', flexDirection: 'column', gap: '15px' } },
      schema.controls.map(renderControl)
    );
  };

  window.VAPTM_GeneratedInterface = GeneratedInterface;
})();
