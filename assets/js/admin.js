// Global check-in for diagnostics - ABSOLUTE TOP
window.vaptmScriptLoaded = true;
console.log('VAPT Copilot: Admin JS bundle loaded and executing...');

(function () {
  if (typeof wp === 'undefined') {
    console.error('VAPT Copilot: "wp" global is missing!');
    return;
  }

  const { render, useState, useEffect, Fragment, createElement: el } = wp.element || {};
  const {
    TabPanel, Panel, PanelBody, PanelRow, Button, Dashicon,
    ToggleControl, SelectControl, Modal, TextControl, Spinner,
    Notice, Placeholder, Dropdown, CheckboxControl, BaseControl, Icon,
    TextareaControl
  } = wp.components || {};
  const apiFetch = wp.apiFetch;
  const { __, sprintf } = wp.i18n || {};

  // Error Boundary Component
  class ErrorBoundary extends wp.element.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
      console.error("VAPT React Error:", error, errorInfo);
      this.setState({ errorInfo });
    }

    render() {
      if (this.state.hasError) {
        return el('div', { className: 'notice notice-error inline', style: { padding: '20px', margin: '20px' } }, [
          el('h3', null, 'Something went wrong rendering the VAPT Dashboard.'),
          el('details', { style: { whiteSpace: 'pre-wrap', marginTop: '10px' } },
            this.state.error && this.state.error.toString(),
            el('br'),
            this.state.errorInfo && this.state.errorInfo.componentStack
          )
        ]);
      }
      return this.props.children;
    }
  }

  // Global Settings from wp_localize_script
  const settings = window.vaptmSettings || {};
  const isSuper = settings.isSuper || false;
  // Import Auto-Generator
  const Generator = window.VAPTM_Generator;
  // Import Generated Interface UI
  const GeneratedInterface = window.VAPTM_GeneratedInterface;

  if (!wp.element || !wp.components || !wp.apiFetch || !wp.i18n) {
    console.error('VAPT Copilot: One or more WordPress dependencies are missing!', {
      element: !!wp.element,
      components: !!wp.components,
      apiFetch: !!wp.apiFetch,
      i18n: !!wp.i18n
    });
    return;
  }

  const FeatureList = ({ features, schema, updateFeature, loading, dataFiles, selectedFile, onSelectFile, onUpload, allFiles, hiddenFiles, onUpdateHiddenFiles, isManageModalOpen, setIsManageModalOpen }) => {
    const [columnOrder, setColumnOrder] = useState(() => {
      const saved = localStorage.getItem(`vaptm_col_order_${selectedFile}`);
      return saved ? JSON.parse(saved) : (schema?.item_fields || ['id', 'category', 'title', 'severity', 'description']);
    });

    const [visibleCols, setVisibleCols] = useState(() => {
      const saved = localStorage.getItem(`vaptm_visible_cols_${selectedFile}`);
      return saved ? JSON.parse(saved) : (schema?.item_fields || ['id', 'category', 'title', 'severity', 'description']);
    });

    // Update column defaults when schema changes if not already set
    useEffect(() => {
      if (!localStorage.getItem(`vaptm_col_order_${selectedFile}`) && schema?.item_fields) {
        setColumnOrder(schema.item_fields);
        setVisibleCols(schema.item_fields);
      }
    }, [schema, selectedFile]);

    // Effective columns to show in table
    const activeCols = columnOrder.filter(c => visibleCols.includes(c));

    useEffect(() => {
      localStorage.setItem(`vaptm_col_order_${selectedFile}`, JSON.stringify(columnOrder));
      localStorage.setItem(`vaptm_visible_cols_${selectedFile}`, JSON.stringify(visibleCols));
    }, [columnOrder, visibleCols, selectedFile]);

    const [filterStatus, setFilterStatus] = useState(() => localStorage.getItem('vaptm_filter_status') || 'all');
    const [selectedCategories, setSelectedCategories] = useState(() => {
      const saved = localStorage.getItem('vaptm_selected_categories');
      return saved ? JSON.parse(saved) : [];
    });
    const [selectedSeverities, setSelectedSeverities] = useState(() => {
      const saved = localStorage.getItem('vaptm_selected_severities');
      return saved ? JSON.parse(saved) : [];
    });
    const [sortBy, setSortBy] = useState(() => localStorage.getItem('vaptm_sort_by') || 'name');
    const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vaptm_sort_order') || 'asc');
    const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('vaptm_search_query') || '');

    const toggleSort = (key) => {
      if (sortBy === key) {
        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      } else {
        setSortBy(key);
        setSortOrder('asc');
      }
    };

    // Persist filters
    useEffect(() => {
      localStorage.setItem('vaptm_filter_status', filterStatus);
      localStorage.setItem('vaptm_selected_categories', JSON.stringify(selectedCategories));
      localStorage.setItem('vaptm_selected_severities', JSON.stringify(selectedSeverities));
      localStorage.setItem('vaptm_sort_by', sortBy);
      localStorage.setItem('vaptm_sort_order', sortOrder);
      localStorage.setItem('vaptm_search_query', searchQuery);
    }, [filterStatus, selectedCategories, selectedSeverities, sortBy, sortOrder, searchQuery]);

    const [historyFeature, setHistoryFeature] = useState(null);
    const [designFeature, setDesignFeature] = useState(null);
    const [transitioning, setTransitioning] = useState(null); // { key, nextStatus, note }
    const [saveStatus, setSaveStatus] = useState(null); // Feedback for media/clipboard uploads

    const confirmTransition = (formValues) => {
      if (!transitioning) return;
      const { key, nextStatus } = transitioning;
      const { note, devInstruct, wireframeUrl } = formValues;

      const feature = features.find(f => f.key === key);
      let updates = { status: nextStatus, history_note: note };

      // Save Wireframe if provided
      if (wireframeUrl) {
        updates.wireframe_url = wireframeUrl;
      }

      // Auto-Generate Interface when moving to 'Develop' (Phase 6 transition)
      if (nextStatus === 'Develop' && Generator && feature && feature.remediation) {
        try {
          const schema = Generator.generate(feature.remediation, devInstruct);
          if (schema) {
            updates.generated_schema = schema;
            console.log('VAPT Master: Auto-generated schema for ' + key, schema);
          }
        } catch (e) {
          console.error('VAPT Master: Generation error', e);
        }
      }

      updateFeature(key, updates);
      setTransitioning(null);
    };

    // 1. Analytics (Moved below filtering for scope)

    // 2. Extract Categories & Severities & All Keys
    const categories = [...new Set(features.map(f => f.category))].filter(Boolean).sort();
    const severities = [...new Set(features.map(f => f.severity))].filter(Boolean);
    const severityOrder = ['critical', 'high', 'medium', 'low', 'informational'];
    const uniqueSeverities = [...new Set(severities.map(s => s.toLowerCase()))]
      .sort((a, b) => severityOrder.indexOf(a) - severityOrder.indexOf(b))
      .map(s => {
        const map = {
          'critical': 'Critical',
          'high': 'High',
          'medium': 'Medium',
          'low': 'Low',
          'informational': 'Informational'
        };
        return map[s] || (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
      });

    // Collect all available keys from features data
    const allKeys = [...new Set(features.reduce((acc, f) => [...acc, ...Object.keys(f)], []))].filter(k => !['key', 'label', 'status', 'has_history', 'include_test_method', 'include_verification', 'include_verification_engine', 'wireframe_url', 'generated_schema'].includes(k));

    // Update columnOrder if new keys are found that aren't in there
    useEffect(() => {
      const missingKeys = allKeys.filter(k => !columnOrder.includes(k));
      if (missingKeys.length > 0) {
        setColumnOrder([...columnOrder, ...missingKeys]);
      }
    }, [allKeys, columnOrder]);

    // 3. Filter & Sort
    let processedFeatures = [...features];

    // Category Filter First
    if (selectedCategories.length > 0) {
      processedFeatures = processedFeatures.filter(f => selectedCategories.includes(f.category));
    }

    // Severity Filter (Case-Insensitive)
    if (selectedSeverities.length > 0) {
      const lowSelected = selectedSeverities.map(s => s.toLowerCase());
      processedFeatures = processedFeatures.filter(f => f.severity && lowSelected.includes(f.severity.toLowerCase()));
    }

    const stats = {
      total: processedFeatures.length,
      draft: processedFeatures.filter(f => f.status === 'Draft' || f.status === 'draft' || f.status === 'available').length,
      develop: processedFeatures.filter(f => f.status === 'Develop' || f.status === 'develop' || f.status === 'in_progress').length,
      test: processedFeatures.filter(f => f.status === 'Test' || f.status === 'test').length,
      release: processedFeatures.filter(f => f.status === 'Release' || f.status === 'release' || f.status === 'implemented').length
    };

    // Status Filter Second
    if (filterStatus !== 'all') {
      processedFeatures = processedFeatures.filter(f => {
        if (filterStatus === 'Draft' || filterStatus === 'draft') return f.status === 'Draft' || f.status === 'draft' || f.status === 'available';
        if (filterStatus === 'Develop' || filterStatus === 'develop') return f.status === 'Develop' || f.status === 'develop' || f.status === 'in_progress';
        if (filterStatus === 'Release' || filterStatus === 'release') return f.status === 'Release' || f.status === 'release' || f.status === 'implemented';
        if (filterStatus === 'Test' || filterStatus === 'test') return f.status === 'Test' || f.status === 'test';
        return f.status === filterStatus;
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      processedFeatures = processedFeatures.filter(f =>
        (f.name || f.label).toLowerCase().includes(q) ||
        (f.description && f.description.toLowerCase().includes(q))
      );
    }

    processedFeatures.sort((a, b) => {
      const nameA = (a.name || a.label || '').toLowerCase();
      const nameB = (b.name || b.label || '').toLowerCase();
      const catA = (a.category || '').toLowerCase();
      const catB = (b.category || '').toLowerCase();

      const sevPriority = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1, 'informational': 0 };
      const sevA = sevPriority[(a.severity || '').toLowerCase()] || 0;
      const sevB = sevPriority[(b.severity || '').toLowerCase()] || 0;

      let comparison = 0;
      if (sortBy === 'name' || sortBy === 'title') comparison = nameA.localeCompare(nameB);
      else if (sortBy === 'category') comparison = catA.localeCompare(catB);
      else if (sortBy === 'severity') comparison = sevA - sevB;
      else if (sortBy === 'status') {
        const priority = {
          'Release': 4, 'release': 4, 'implemented': 4,
          'Test': 3, 'test': 3,
          'Develop': 2, 'develop': 2, 'in_progress': 2,
          'Draft': 1, 'draft': 1, 'available': 1
        };
        comparison = (priority[a.status] || 0) - (priority[b.status] || 0);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    // History Modal Component
    const HistoryModal = ({ feature, onClose }) => {
      const [history, setHistory] = useState([]);
      const [loading, setLoading] = useState(true);

      useEffect(() => {
        apiFetch({ path: `vaptc/v1/features/${feature.key}/history` })
          .then(res => {
            setHistory(res);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }, [feature.key]);

      return el(Modal, {
        title: sprintf(__('History: %s', 'vapt-Copilot'), feature.name || feature.label),
        onRequestClose: onClose,
        className: 'vaptm-history-modal'
      }, [
        loading ? el(Spinner) : el('div', { style: { minWidth: '500px' } }, [
          history.length === 0 ? el('p', null, __('No history recorded yet.', 'vapt-Copilot')) :
            el('table', { className: 'wp-list-table widefat fixed striped' }, [
              el('thead', null, el('tr', null, [
                el('th', { style: { width: '120px' } }, __('Date', 'vapt-Copilot')),
                el('th', { style: { width: '100px' } }, __('From', 'vapt-Copilot')),
                el('th', { style: { width: '100px' } }, __('To', 'vapt-Copilot')),
                el('th', { style: { width: '120px' } }, __('User', 'vapt-Copilot')),
                el('th', null, __('Note', 'vapt-Copilot')),
              ])),
              el('tbody', null, history.map((h, i) => el('tr', { key: i }, [
                el('td', null, new Date(h.created_at).toLocaleString()),
                el('td', null, el('span', { className: `vaptm-status-badge status-${h.old_status}` }, h.old_status)),
                el('td', null, el('span', { className: `vaptm-status-badge status-${h.new_status}` }, h.new_status)),
                el('td', null, h.user_name || __('System', 'vapt-Copilot')),
                el('td', null, h.note || '-')
              ])))
            ])
        ]),
        el('div', { style: { marginTop: '20px', textAlign: 'right' } }, [
          el(Button, { isPrimary: true, onClick: onClose }, __('Close', 'vapt-Copilot'))
        ])
      ]);
    };

    // Design/Schema Modal
    const DesignModal = ({ feature, onClose }) => {
      // Default prompt for guidance but still valid JSON
      const defaultState = {
        controls: [],
        _instructions: "STOP! Do NOT copy this text. 1. Click 'Copy AI Design Prompt' button below. 2. Paste that into Antigravity Chat. 3. Paste the JSON result back here."
      };
      const defaultValue = JSON.stringify(feature.generated_schema || defaultState, null, 2);
      const [schemaText, setSchemaText] = useState(defaultValue);
      const [parsedSchema, setParsedSchema] = useState(feature.generated_schema || { controls: [] });
      const [isSaving, setIsSaving] = useState(false);
      const [saveStatus, setSaveStatus] = useState(null);

      // Handle real-time preview
      const onJsonChange = (val) => {
        setSchemaText(val);
        try {
          const parsed = JSON.parse(val);
          if (parsed && parsed.controls) setParsedSchema(parsed);
        } catch (e) {
          // Silent fail for preview while typing
        }
      };

      const handleSave = () => {
        try {
          const parsed = JSON.parse(schemaText);
          setIsSaving(true);
          updateFeature(feature.key, { generated_schema: parsed })
            .then(() => {
              setIsSaving(false);
              onClose();
            })
            .catch(() => setIsSaving(false));
        } catch (e) {
          alert(__('Invalid JSON format. Please check your syntax.', 'vapt-Copilot'));
        }
      };

      const copyContext = () => {
        const prompt = `Please generate an interactive security interface JSON for the following feature:
Feature: ${feature.label}
Category: ${feature.category || 'General'}
Description: ${feature.description || 'None provided'}
Test Method: ${feature.test_method || 'None provided'}
Remediation (Core Logic): ${feature.remediation || 'None provided'}
Additional Instructions: ${feature.devInstruct || 'None provided'}

I need a JSON schema in this format:
{
  "controls": [
    { "type": "toggle", "label": "Enable Protection", "key": "status" },
    { "type": "input", "label": "Setting Name", "key": "setting_val", "default": "config_value" },
    { "type": "test_action", "label": "Verify Feature", "key": "verify_action", "test_logic": "custom_logic" }
  ]
}

CRITICAL RULES:
1. **Binding**: If there is a functional control (like a Rate Limit threshold), the Verification Engine test logic MUST use that value dynamically. For example, if the limit is set to 10, the test should generate load > 10 (e.g. 125%).
2. **Reset**: Include a configuration or test action to "Reset" state if applicable (e.g. clear rate limit counters).
3. **Attribution**: The test output message MUST explicitly state if "The Plugin" is providing the protection or if it's strictly "Server/Other".
4. **Binding Syntax**: Use the 'key' of the input control as a variable in your reasoning.
5. **Test Logic Keys**: Use one of the following for 'test_logic' if applicable:
    - 'check_headers' (Security Headers)
    - 'spam_requests' (Rate Limiting - requires 'rpm' or 'rate_limit' setting)
    - 'block_xmlrpc' (XML-RPC Blocking)
    - 'disable_directory_browsing' (Directory Listing)
            - 'block_null_byte_injection' (Null Byte / Input Validation)
            - 'hide_wp_version' (WordPress Version Disclosure)
            - 'default' (Generic Ping)

Please provide ONLY the JSON block.`;

        // Robust Copy Function with Fallback
        const copyToClipboard = (text) => {
          if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
          } else {
            // Fallback for older browsers or non-secure contexts
            let textArea = document.createElement("textarea");
            textArea.value = text;

            // Ensure strictly invisible but IN VIEWPORT to prevent scroll jumps
            textArea.style.position = "fixed";
            textArea.style.left = "0"; // Keep at (0,0) to avoid "jump to -9999px"
            textArea.style.top = "0";
            textArea.style.width = "1px";
            textArea.style.height = "1px";
            textArea.style.opacity = "0";
            textArea.style.zIndex = "-1";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            textArea.setAttribute("readonly", ""); // Prevent keyboard flash

            document.body.appendChild(textArea);

            // Focus without scrolling
            if (textArea.focus) {
              textArea.focus({ preventScroll: true });
            } else {
              textArea.focus();
            }
            textArea.select();

            return new Promise((resolve, reject) => {
              try {
                document.execCommand('copy') ? resolve() : reject();
              } catch (e) {
                reject(e);
              } finally {
                textArea.remove();
              }
            });
          }
        };

        copyToClipboard(prompt)
          .then(() => {
            setSaveStatus({ message: __('AI Prompt copied to clipboard!', 'vapt-Copilot'), type: 'success' });
            setTimeout(() => setSaveStatus(null), 3000);
          })
          .catch((err) => {
            console.error('Copy failed', err);
            alert(__('Failed to copy to clipboard. Please manually copy the prompt from the console or try again.', 'vapt-Copilot'));
          });
      };

      return el(Modal, {
        title: sprintf(__('Design Implementation: %s', 'vapt-Copilot'), feature.label),
        onRequestClose: onClose,
        className: 'vaptm-design-modal',
        style: { width: '1000px', maxWidth: '98%' }
      }, [
        // Toast Notification (Fixed Overlay)
        saveStatus && el('div', {
          style: {
            position: 'absolute', top: '20px', right: '50%', transform: 'translateX(50%)',
            background: saveStatus.type === 'error' ? '#fde8e8' : '#def7ec',
            color: saveStatus.type === 'error' ? '#9b1c1c' : '#03543f',
            padding: '10px 20px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 100, fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px'
          }
        }, [
          el(Icon, { icon: saveStatus.type === 'error' ? 'warning' : 'yes', size: 20 }),
          saveStatus.message
        ]),

        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: '65vh', overflow: 'hidden' } }, [
          // Left Side: The Editor (Scrollable)
          el('div', { style: { display: 'flex', flexDirection: 'column', gap: '15px', overflowY: 'auto', paddingRight: '10px' } }, [
            el('p', { style: { margin: 0, fontSize: '13px', color: '#666' } }, __('Paste the JSON schema generated via Antigravity (the AI Proxy) below.', 'vapt-Copilot')),
            el(wp.components.TextareaControl, {
              label: __('Interface JSON Schema', 'vapt-Copilot'),
              value: schemaText,
              onChange: onJsonChange,
              rows: 18,
              help: __('The sidebar workbench will render this instantly.', 'vapt-Copilot'),
              style: { fontFamily: 'monospace', fontSize: '13px', background: '#fcfcfc' }
            }),
            el('div', { style: { display: 'flex', gap: '10px' } }, [
              el(Button, { isSecondary: true, onClick: copyContext, icon: 'clipboard' }, __('Copy AI Design Prompt', 'vapt-Copilot')),
              el(Button, {
                isSecondary: true,
                icon: 'media-text',
                onClick: () => {
                  const doPaste = (text) => {
                    if (!text) return;
                    onJsonChange(text);
                    setSaveStatus({ message: __('JSON Pasted!', 'vapt-Copilot'), type: 'success' });
                    setTimeout(() => setSaveStatus(null), 2000);
                  };

                  // 1. Try Modern Async API
                  if (navigator.clipboard && navigator.clipboard.readText) {
                    navigator.clipboard.readText()
                      .then(doPaste)
                      .catch(err => {
                        console.warn('Clipboard API failed, trying fallback...', err);
                        // 2. Fallback: Manual Prompt (Reliable)
                        const val = prompt("Browser blocked clipboard access.\nPlease paste the JSON here manually:", "");
                        if (val) doPaste(val);
                      });
                  } else {
                    // 3. Fallback for ancient browsers
                    const val = prompt("Paste your JSON here:", "");
                    if (val) doPaste(val);
                  }
                }
              }, __('Paste JSON', 'vapt-Copilot'))
            ])
          ]),

          // Right Side: Live Preview (Scrollable)
          el('div', { style: { background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }, [
            el('div', { style: { padding: '12px 20px', borderBottom: '1px solid #e5e7eb', background: '#fff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' } }, [
              el(Icon, { icon: 'visibility', size: 16 }),
              el('strong', { style: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563' } }, __('Live Implementation Preview'))
            ]),
            el('div', { style: { padding: '24px', flexGrow: 1, overflowY: 'auto' } }, [
              el('div', { style: { background: '#fff', padding: '20px', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' } }, [
                el('h4', { style: { margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#111827' } }, __('Functional Workbench')),
                GeneratedInterface
                  ? el(GeneratedInterface, { feature: { ...feature, generated_schema: parsedSchema } })
                  : el('p', null, __('Loading Preview Interface...', 'vapt-Copilot'))
              ])
            ]),
            el('div', { style: { padding: '15px 20px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' } },
              __('This is exactly what the user will see in their dashboard.', 'vapt-Copilot')
            )
          ])
        ]),

        // Footer Actions
        el('div', { style: { marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '20px', borderTop: '1px solid #eee' } }, [
          el(Button, { isSecondary: true, onClick: onClose }, __('Cancel', 'vapt-Copilot')),
          el(Button, { isPrimary: true, onClick: handleSave, isBusy: isSaving }, __('Save & Deploy to Workbench', 'vapt-Copilot'))
        ])
      ]);
    };

    // Performance-Isolated Transition Modal
    const TransitionNoteModal = ({ transitioning, onConfirm, onCancel }) => {
      const [formValues, setFormValues] = useState({
        note: transitioning.note || '',
        devInstruct: transitioning.devInstruct || '',
        wireframeUrl: transitioning.wireframeUrl || ''
      });
      const [modalSaveStatus, setModalSaveStatus] = useState(null);

      return el(Modal, {
        title: sprintf(__('Transition to %s', 'vapt-Copilot'), transitioning.nextStatus),
        onRequestClose: onCancel,
        className: 'vaptm-transition-modal',
        style: {
          width: '600px',
          maxWidth: '95%',
          maxHeight: '800px',
          overflow: 'hidden'
        }
      }, [
        el('div', {
          style: { height: '100%', display: 'flex', flexDirection: 'column' },
          onPaste: (e) => {
            if (transitioning.nextStatus !== 'Develop') return;
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let index in items) {
              const item = items[index];
              if (item.kind === 'file' && item.type.indexOf('image/') !== -1) {
                const blob = item.getAsFile();
                setModalSaveStatus({ message: __('Uploading pasted image...', 'vapt-Copilot'), type: 'info' });

                const formData = new FormData();
                formData.append('file', blob);
                formData.append('title', 'Pasted Wireframe - ' + transitioning.key);

                apiFetch({
                  path: 'vaptc/v1/upload-media',
                  method: 'POST',
                  body: formData
                }).then(res => {
                  setFormValues({ ...formValues, wireframeUrl: res.url });
                  setModalSaveStatus({ message: __('Image Uploaded', 'vapt-Copilot'), type: 'success' });
                }).catch(err => {
                  setModalSaveStatus({ message: __('Paste failed', 'vapt-Copilot'), type: 'error' });
                });
              }
            }
          }
        }, [
          el('div', { style: { flexGrow: 1, paddingBottom: '10px' } }, [
            el('p', { style: { fontWeight: '600', marginBottom: '10px' } }, sprintf(__('Moving "%s" to %s.', 'vapt-Copilot'), transitioning.key, transitioning.nextStatus)),

            el(TextControl, {
              label: __('Change Note (Internal)', 'vapt-Copilot'),
              value: formValues.note,
              onChange: (val) => setFormValues({ ...formValues, note: val }),
              autoFocus: true
            }),

            transitioning.nextStatus === 'Develop' && el('div', {
              style: { marginTop: '10px', padding: '12px', background: '#f0f3f5', borderRadius: '4px', display: 'flex', flexDirection: 'column' }
            }, [
              el('h4', { style: { margin: '0 0 8px 0', fontSize: '14px' } }, __('Build Configuration', 'vapt-Copilot')),

              // Reference Box (Read Only)
              el('div', { style: { marginBottom: '10px' } }, [
                el('label', { style: { display: 'block', fontWeight: 'bold', marginBottom: '3px', fontSize: '10px', textTransform: 'uppercase', color: '#666' } }, __('Base Remediation Logic', 'vapt-Copilot')),
                el('div', {
                  style: { padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '3px', fontSize: '11px', maxHeight: '100px', overflow: 'hidden', whiteSpace: 'pre-wrap' }
                }, transitioning.remediation || __('No remediation defined.', 'vapt-Copilot'))
              ]),

              el(wp.components.TextareaControl, {
                label: __('Additional Instructions', 'vapt-Copilot'),
                value: formValues.devInstruct,
                onChange: (val) => setFormValues({ ...formValues, devInstruct: val }),
                rows: 8
              }),

              el('div', { style: { marginTop: '5px' } }, [
                el(TextControl, {
                  label: __('Wireframe URL', 'vapt-Copilot'),
                  value: formValues.wireframeUrl,
                  onChange: (val) => setFormValues({ ...formValues, wireframeUrl: val }),
                  help: __('Paste link or IMAGE directly!', 'vapt-Copilot')
                }),
                el('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
                  el(Button, {
                    isSecondary: true, isSmall: true,
                    onClick: () => {
                      const frame = wp.media({ title: __('Select Wireframe', 'vapt-Copilot'), multiple: false, library: { type: 'image' } });
                      frame.on('select', () => {
                        const attachment = frame.state().get('selection').first().toJSON();
                        setFormValues({ ...formValues, wireframeUrl: attachment.url });
                      });
                      frame.open();
                    }
                  }, __('Upload Image', 'vapt-Copilot')),
                  formValues.wireframeUrl && formValues.wireframeUrl.match(/\.(jpeg|jpg|gif|png)$/) &&
                  el('img', { src: formValues.wireframeUrl, style: { height: '24px', borderRadius: '3px', border: '1px solid #ddd' }, alt: 'Thumbnail' })
                ])
              ])
            ])
          ]),

          el('div', { style: { borderTop: '1px solid #ddd', paddingTop: '15px', textAlign: 'right' } }, [
            el(Button, { isSecondary: true, onClick: onCancel, style: { marginRight: '10px' } }, __('Cancel', 'vapt-Copilot')),
            el(Button, { isPrimary: true, onClick: () => onConfirm(formValues) }, __('Confirm & Build', 'vapt-Copilot'))
          ]),

          modalSaveStatus && el(Notice, {
            status: modalSaveStatus.type || 'info',
            onRemove: () => setModalSaveStatus(null),
            style: { marginTop: '10px' }
          }, modalSaveStatus.message)
        ])
      ]);
    };

    const LifecycleIndicator = ({ feature, onChange }) => {
      // Normalize to Title Case for UI display if needed, but DB is now migrated.
      const activeStep = feature.status;

      const steps = [
        { id: 'Draft', label: __('Draft', 'vapt-Copilot') },
        { id: 'Develop', label: __('Develop', 'vapt-Copilot') },
        { id: 'Test', label: __('Test', 'vapt-Copilot') },
        { id: 'Release', label: __('Release', 'vapt-Copilot') }
      ];

      return el('div', { className: 'vaptm-lifecycle-radios', style: { display: 'flex', gap: '10px', fontSize: '12px', alignItems: 'center' } }, [
        ...steps.map((step) => {
          const isChecked = step.id === activeStep;
          return el('label', {
            key: step.id,
            style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: isChecked ? '#2271b1' : 'inherit', fontWeight: isChecked ? '600' : 'normal' }
          }, [
            el('input', {
              type: 'radio',
              name: `lifecycle_${feature.key}_${Math.random()}`,
              checked: isChecked,
              onChange: () => onChange(step.id),
              style: { margin: 0 }
            }),
            step.label
          ]);
        })
      ]);
    };

    return el(PanelBody, { title: __('Exhaustive Feature List', 'vapt-Copilot'), initialOpen: true }, [
      // Top Controls & Unified Header
      el('div', { key: 'controls', style: { marginBottom: '10px' } }, [
        // Unified Header Block (Source, Columns, Manage, Upload)
        el('div', {
          style: {
            display: 'flex',
            gap: '12px',
            background: '#f6f7f7',
            padding: '10px 15px',
            borderRadius: '4px',
            border: '1px solid #dcdcde',
            marginBottom: '10px',
            alignItems: 'center'
          }
        }, [
          // Branded Icon
          el('div', {
            style: {
              background: '#2271b1',
              color: '#fff',
              borderRadius: '3px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }
          }, el(Icon, { icon: 'layout', size: 18 })),

          // Feature Source Selection
          el('div', { style: { flexGrow: 1 } }, el(SelectControl, {
            label: el('span', { style: { fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', color: '#666', letterSpacing: '0.02em', marginBottom: '2px', display: 'block' } }, __('Feature Source (JSON)', 'vapt-Copilot')),
            value: selectedFile,
            options: dataFiles,
            onChange: (val) => onSelectFile(val),
            style: { margin: 0, height: '30px', minHeight: '30px', fontSize: '13px' }
          })),

          // Configure Columns Dropdown
          el('div', { style: { borderLeft: '1px solid #dcdcde', paddingLeft: '12px', display: 'flex', alignItems: 'center' } }, [
            el(Dropdown, {
              renderToggle: ({ isOpen, onToggle }) => el(Button, {
                isSecondary: true,
                icon: 'admin-appearance', // Use layout/gear like icon
                onClick: onToggle,
                'aria-expanded': isOpen,
                label: __('Configure Columns', 'vapt-Copilot'),
                style: { height: '30px', minHeight: '30px', width: '30px', border: '1px solid #2271b1', color: '#2271b1' }
              }),
              renderContent: () => {
                const activeFields = columnOrder.filter(c => visibleCols.includes(c));
                const availableFields = columnOrder.filter(c => !visibleCols.includes(c));
                const half = Math.ceil(availableFields.length / 2);
                const availableCol1 = availableFields.slice(0, half);
                const availableCol2 = availableFields.slice(half);

                return el('div', { style: { padding: '20px', width: '850px' } }, [
                  el('h4', { style: { marginTop: 0, marginBottom: '5px' } }, __('Configure Table Columns', 'vapt-Copilot')),
                  el('p', { style: { fontSize: '12px', color: '#666', marginBottom: '20px' } }, __('Confirm the table sequence and add/remove fields.', 'vapt-Copilot')),
                  el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) 1fr 1fr', gap: '25px' } }, [
                    el('div', null, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#2271b1', fontWeight: 'bold' } }, __('Active Table Sequence', 'vapt-Copilot')),
                      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                        activeFields.map((field, activeIdx) => {
                          const masterIdx = columnOrder.indexOf(field);
                          return el('div', { key: field, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', background: '#f0f6fb', borderRadius: '4px', border: '1px solid #c8d7e1' } }, [
                            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                              el('span', { style: { fontSize: '10px', fontWeight: 'bold', color: '#72777c', minWidth: '20px' } }, `#${activeIdx + 1}`),
                              el(CheckboxControl, {
                                label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
                                checked: true,
                                onChange: () => setVisibleCols(visibleCols.filter(c => c !== field)),
                                style: { margin: 0 }
                              })
                            ]),
                            el('div', { style: { display: 'flex', gap: '2px' } }, [
                              el(Button, {
                                isSmall: true, icon: 'arrow-up-alt2', disabled: masterIdx === 0,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  const next = [...columnOrder];
                                  [next[masterIdx], next[masterIdx - 1]] = [next[masterIdx - 1], next[masterIdx]];
                                  setColumnOrder(next);
                                }
                              }),
                              el(Button, {
                                isSmall: true, icon: 'arrow-down-alt2', disabled: masterIdx === columnOrder.length - 1,
                                onClick: (e) => {
                                  e.stopPropagation();
                                  const next = [...columnOrder];
                                  [next[masterIdx], next[masterIdx + 1]] = [next[masterIdx + 1], next[masterIdx]];
                                  setColumnOrder(next);
                                }
                              })
                            ])
                          ]);
                        })
                      )
                    ]),
                    el('div', null, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' } }, __('Available Fields I', 'vapt-Copilot')),
                      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                        availableCol1.map((field) => (
                          el('div', { key: field, style: { display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: '4px', border: '1px solid #e1e1e1' } }, [
                            el(CheckboxControl, {
                              label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
                              checked: false,
                              onChange: () => setVisibleCols([...visibleCols, field]),
                              style: { margin: 0 }
                            })
                          ])
                        ))
                      )
                    ]),
                    el('div', null, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' } }, __('Available Fields II', 'vapt-Copilot')),
                      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                        availableCol2.map((field) => (
                          el('div', { key: field, style: { display: 'flex', alignItems: 'center', padding: '6px 10px', background: '#fff', borderRadius: '4px', border: '1px solid #e1e1e1' } }, [
                            el(CheckboxControl, {
                              label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
                              checked: false,
                              onChange: () => setVisibleCols([...visibleCols, field]),
                              style: { margin: 0 }
                            })
                          ])
                        ))
                      )
                    ])
                  ]),
                  el('div', { style: { marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                    el('span', { style: { fontSize: '11px', color: '#949494' } }, sprintf(__('%d Columns active, %d Available', 'vapt-Copilot'), activeFields.length, availableFields.length)),
                    el(Button, {
                      isLink: true, isDestructive: true,
                      onClick: () => {
                        const defaultFields = schema?.item_fields || ['id', 'category', 'title', 'severity', 'description'];
                        setColumnOrder(defaultFields);
                        setVisibleCols(defaultFields);
                      }
                    }, __('Reset to Factory Defaults', 'vapt-Copilot'))
                  ])
                ]);
              }
            })
          ]),

          // Manage Sources Trigger
          el('div', { style: { borderLeft: '1px solid #dcdcde', paddingLeft: '12px', display: 'flex', alignItems: 'center' } }, [
            el(Button, {
              isSecondary: true,
              icon: 'admin-settings',
              onClick: () => setIsManageModalOpen(true),
              label: __('Manage Sources', 'vapt-Copilot'),
              style: { height: '30px', minHeight: '30px', width: '30px', border: '1px solid #2271b1', color: '#2271b1' }
            })
          ]),

          // Upload Section
          el('div', { style: { borderLeft: '1px solid #dcdcde', paddingLeft: '12px', display: 'flex', flexDirection: 'column' } }, [
            el('label', { style: { fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', color: '#666', letterSpacing: '0.02em', marginBottom: '2px' } }, __('Upload New Features', 'vapt-Copilot')),
            el('input', {
              type: 'file',
              accept: '.json',
              onChange: (e) => e.target.files.length > 0 && onUpload(e.target.files[0]),
              style: { fontSize: '11px', color: '#555' }
            })
          ])
        ]),

        // Manage Sources Modal
        isManageModalOpen && el(Modal, {
          title: __('Manage JSON Sources', 'vapt-Copilot'),
          onRequestClose: () => setIsManageModalOpen(false)
        }, [
          el('p', null, __('Deselect files to hide them from the Feature Source dropdown. The active file cannot be hidden.', 'vapt-Copilot')),
          el('div', { style: { maxHeight: '400px', overflowY: 'auto' } }, [
            allFiles.map(file => el(CheckboxControl, {
              key: file.filename,
              label: file.display_name || file.filename.replace(/_/g, ' '),
              checked: !hiddenFiles.includes(file.filename),
              disabled: file.filename === selectedFile,
              onChange: (val) => {
                const newHidden = val
                  ? hiddenFiles.filter(h => h !== file.filename)
                  : [...hiddenFiles, file.filename];
                onUpdateHiddenFiles(newHidden);
              }
            }))
          ]),
          el('div', { style: { marginTop: '20px', textAlign: 'right' } }, [
            el(Button, { isPrimary: true, onClick: () => setIsManageModalOpen(false) }, __('Close', 'vapt-Copilot'))
          ])
        ]),

        // Summary Pill Row
        el('div', {
          style: {
            display: 'flex',
            gap: '15px',
            padding: '6px 15px',
            background: '#fff',
            border: '1px solid #dcdcde',
            borderRadius: '4px',
            marginBottom: '10px',
            alignItems: 'center',
            fontSize: '11px',
            color: '#333'
          }
        }, [
          el('span', { style: { fontWeight: '700', textTransform: 'uppercase', fontSize: '10px', color: '#666' } }, __('Summary:', 'vapt-Copilot')),
          el('span', { style: { fontWeight: '500' } }, sprintf(__('Total: %d', 'vapt-Copilot'), stats.total)),
          el('span', { style: { opacity: 0.7 } }, sprintf(__('Draft: %d', 'vapt-Copilot'), stats.draft)),
          el('span', { style: { color: '#d63638', fontWeight: '600' } }, sprintf(__('Develop: %d', 'vapt-Copilot'), stats.develop)),
          el('span', { style: { color: '#dba617', fontWeight: '600' } }, sprintf(__('Test: %d', 'vapt-Copilot'), stats.test)),
          el('span', { style: { color: '#46b450', fontWeight: '700' } }, sprintf(__('Release: %d', 'vapt-Copilot'), stats.release)),
        ])
      ]),
      // Filters Row (Ultra-Slim)
      el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'nowrap', alignItems: 'stretch', marginBottom: '15px' } }, [
        // Search Box
        el('div', { style: { flex: '1 1 180px', background: '#f6f7f7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #dcdcde', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }, [
          el('label', { className: 'components-base-control__label', style: { display: 'block', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase', fontSize: '9px', color: '#666', letterSpacing: '0.02em' } }, __('Search Features', 'vapt-Copilot')),
          el(TextControl, {
            value: searchQuery,
            onChange: setSearchQuery,
            placeholder: __('Search...', 'vapt-Copilot'),
            hideLabelFromVision: true,
            style: { margin: 0, height: '28px', minHeight: '28px', fontSize: '12px' }
          })
        ]),

        // Category Unit
        el('div', { style: { flex: '0 0 auto', background: '#f6f7f7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #dcdcde', display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: '150px' } }, [
          el('label', { className: 'components-base-control__label', style: { display: 'block', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase', fontSize: '9px', color: '#666', letterSpacing: '0.02em' } }, __('Filter by Category', 'vapt-Copilot')),
          el(Dropdown, {
            renderToggle: ({ isOpen, onToggle }) => el(Button, {
              isSecondary: true,
              onClick: onToggle,
              'aria-expanded': isOpen,
              icon: 'filter',
              style: {
                height: '28px',
                minHeight: '28px',
                width: '100%',
                justifyContent: 'flex-start',
                gap: '6px',
                borderColor: '#2271b1',
                color: '#2271b1',
                background: '#fff',
                fontSize: '11px',
                padding: '0 8px'
              }
            }, selectedCategories.length === 0 ? __('All Categories', 'vapt-Copilot') : sprintf(__('%d Selected', 'vapt-Copilot'), selectedCategories.length)),
            renderContent: () => el('div', { style: { padding: '15px', minWidth: '250px', maxHeight: '300px', overflowY: 'auto' } }, [
              el(CheckboxControl, {
                label: __('All Categories', 'vapt-Copilot'),
                checked: selectedCategories.length === 0,
                onChange: () => setSelectedCategories([])
              }),
              el('hr', { style: { margin: '10px 0' } }),
              ...categories.map(cat => el(CheckboxControl, {
                key: cat,
                label: cat,
                checked: selectedCategories.includes(cat),
                onChange: (isChecked) => {
                  if (isChecked) setSelectedCategories([...selectedCategories, cat]);
                  else setSelectedCategories(selectedCategories.filter(c => c !== cat));
                }
              }))
            ])
          })
        ]),

        // Severity Unit
        el('div', { style: { flex: '1 1 auto', background: '#f6f7f7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #dcdcde', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }, [
          el('label', { className: 'components-base-control__label', style: { display: 'block', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase', fontSize: '9px', color: '#666', letterSpacing: '0.02em' } }, __('Filter by Severity', 'vapt-Copilot')),
          el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            uniqueSeverities.map(sev => el(CheckboxControl, {
              key: sev,
              label: sev,
              checked: selectedSeverities.some(s => s.toLowerCase() === sev.toLowerCase()),
              onChange: (val) => {
                const lowSev = sev.toLowerCase();
                if (val) setSelectedSeverities([...selectedSeverities, sev]);
                else setSelectedSeverities(selectedSeverities.filter(s => s.toLowerCase() !== lowSev));
              },
              style: { margin: 0, fontSize: '11px' }
            }))
          )
        ]),

        // Lifecycle Unit
        el('div', { style: { flex: '1 1 auto', background: '#f6f7f7', padding: '4px 10px', borderRadius: '4px', border: '1px solid #dcdcde', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }, [
          el('label', { className: 'components-base-control__label', style: { display: 'block', marginBottom: '2px', fontWeight: '600', textTransform: 'uppercase', fontSize: '9px', color: '#666', letterSpacing: '0.02em' } }, __('Filter by Lifecycle Status', 'vapt-Copilot')),
          el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
            [
              { label: __('All', 'vapt-Copilot'), value: 'all' },
              { label: __('Draft', 'vapt-Copilot'), value: 'draft' },
              { label: __('Develop', 'vapt-Copilot'), value: 'develop' },
              { label: __('Test', 'vapt-Copilot'), value: 'test' },
              { label: __('Release', 'vapt-Copilot'), value: 'release' },
            ].map(opt => el('label', { key: opt.value, style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px' } }, [
              el('input', {
                type: 'radio',
                name: 'vaptm_filter_status',
                value: opt.value,
                checked: filterStatus === opt.value,
                onChange: (e) => setFilterStatus(e.target.value),
                style: { margin: 0, width: '14px', height: '14px' }
              }),
              opt.label
            ])))
        ])
      ]),

      loading ? el(Spinner, { key: 'loader' }) : el('table', { key: 'table', className: 'wp-list-table widefat fixed striped vaptm-feature-table' }, [
        el('thead', null, el('tr', null, [
          ...activeCols.map(col => {
            const label = col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ');
            let width = 'auto';
            if (col === 'title' || col === 'name') width = '280px';
            if (col === 'category') width = '150px';
            if (col === 'severity') width = '100px';
            if (col === 'id') width = '150px';

            const isSortable = ['title', 'name', 'category', 'severity'].includes(col);
            const isActive = sortBy === col || (col === 'title' && sortBy === 'name');

            return el('th', {
              key: col,
              onClick: isSortable ? () => toggleSort(col === 'title' ? 'name' : col) : null,
              style: {
                width,
                whiteSpace: 'nowrap',
                cursor: isSortable ? 'pointer' : 'default',
                background: isActive ? '#f0f6fb' : 'inherit',
                position: 'relative',
                paddingRight: isSortable ? '10px' : '10px',
                paddingLeft: isSortable ? '30px' : '10px'
              },
              className: isSortable ? 'vaptm-sortable-header' : ''
            }, [
              isSortable && el('span', {
                style: {
                  position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)',
                  opacity: isActive ? 1 : 0.3,
                  color: isActive ? '#2271b1' : '#72777c'
                }
              }, el(Icon, {
                icon: isActive
                  ? (sortOrder === 'asc' ? 'arrow-up' : 'arrow-down')
                  : 'sort'
              })),
              label
            ]);
          }),
          el('th', { style: { width: '380px' } }, __('Lifecycle Status', 'vapt-Copilot')),
          el('th', { style: { width: '180px' } }, __('Include', 'vapt-Copilot')),
        ])),
        el('tbody', null, processedFeatures.map((f) => el(Fragment, { key: f.key }, [
          el('tr', null, [
            ...activeCols.map(col => {
              let content = f[col] || '-';
              if (col === 'title' || col === 'label' || col === 'name') {
                content = el('strong', null, f.label || f.title || f.name);
              } else if (col === 'severity') {
                const s = (f[col] || '').toLowerCase();
                const map = { 'critical': 'Critical', 'high': 'High', 'medium': 'Medium', 'low': 'Low', 'informational': 'Informational' };
                content = map[s] || (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase());
              } else if (col === 'implemented_at' && f[col]) {
                content = new Date(f[col]).toLocaleString();
              }
              return el('td', { key: col }, content);
            }),
            el('td', { style: { display: 'flex', gap: '10px', alignItems: 'center' } }, [
              el(LifecycleIndicator, {
                feature: f,
                onChange: (newStatus) => setTransitioning({
                  key: f.key,
                  nextStatus: newStatus,
                  note: '',
                  remediation: f.remediation || '',
                  devInstruct: ''
                })
              }),
              el(Button, {
                icon: 'backup',
                isSmall: true,
                isTertiary: true,
                disabled: !f.has_history,
                onClick: () => f.has_history && setHistoryFeature(f),
                label: f.has_history ? __('View History', 'vapt-Copilot') : __('No History', 'vapt-Copilot'),
                style: { marginLeft: '10px', opacity: f.has_history ? 1 : 0.4 }
              })
            ]),
            el('td', { className: 'vaptm-support-cell', style: { verticalAlign: 'middle' } }, el('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' } }, [
              // Pill Group for Include unit
              el('div', {
                onClick: () => updateFeature(f.key, { include_test_method: !f.include_test_method }),
                title: __('Toggle Test Method', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_test_method ? '#2271b1' : '#f0f0f1',
                  color: f.include_test_method ? '#fff' : '#72777c',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_test_method ? '#2271b1' : '#dcdcde'
                }
              }, __('TEST', 'vapt-Copilot')),

              el('div', {
                onClick: () => updateFeature(f.key, { include_verification: !f.include_verification }),
                title: __('Toggle Verification Steps', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_verification ? '#2271b1' : '#f0f0f1',
                  color: f.include_verification ? '#fff' : '#72777c',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_verification ? '#2271b1' : '#dcdcde'
                }
              }, __('STEPS', 'vapt-Copilot')),

              el('div', {
                onClick: () => updateFeature(f.key, { include_verification_engine: !f.include_verification_engine }),
                title: __('Toggle Verification Engine', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_verification_engine ? '#d63638' : '#f0f0f1',
                  color: f.include_verification_engine ? '#fff' : '#d63638',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_verification_engine ? '#d63638' : '#dcdcde'
                }
              }, __('ENG', 'vapt-Copilot')),

              !['Draft', 'draft', 'available'].includes(f.status) && el('div', {
                onClick: () => setDesignFeature(f),
                title: __('Open Design Hub', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: '#f0f0f1',
                  color: '#2271b1',
                  border: '1px solid #2271b1'
                }
              }, __('HUB', 'vapt-Copilot'))
            ]))
          ]),
          // Interface Preview removed from grid view per user request
        ])))
      ]),

      // History Modal (Sibling in PanelBody Array)
      historyFeature && el(HistoryModal, {
        feature: historyFeature,
        onClose: () => setHistoryFeature(null)
      }),

      transitioning && el(TransitionNoteModal, {
        transitioning: transitioning,
        onConfirm: confirmTransition,
        onCancel: () => setTransitioning(null)
      }),

      designFeature && el(DesignModal, {
        feature: designFeature,
        onClose: () => setDesignFeature(null)
      }),

    ]);
  };

  const VAPTMAdmin = () => {
    const [features, setFeatures] = useState([]);
    const [schema, setSchema] = useState({ item_fields: [] });
    const [domains, setDomains] = useState([]);
    const [dataFiles, setDataFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState(() => localStorage.getItem('vaptm_selected_file') || 'features-with-test-methods.json');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDomainModalOpen, setDomainModalOpen] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null); // { message: '', type: 'info'|'success'|'error' }

    // Status Auto-clear helper
    useEffect(() => {
      if (saveStatus && saveStatus.type === 'success') {
        const timer = setTimeout(() => setSaveStatus(null), 2000);
        return () => clearTimeout(timer);
      }
    }, [saveStatus]);

    const fetchData = (file = selectedFile) => {
      console.log('VAPT Master: Fetching data for file:', file);
      setLoading(true);

      // Use individual catches to prevent one failure from blocking all
      const fetchFeatures = apiFetch({ path: `vaptc/v1/features?file=${file}` })
        .catch(err => { console.error('VAPT Master: Features fetch error:', err); return []; });
      const fetchDomains = apiFetch({ path: 'vaptc/v1/domains' })
        .catch(err => { console.error('VAPT Master: Domains fetch error:', err); return []; });
      const fetchDataFiles = apiFetch({ path: 'vaptc/v1/data-files' })
        .catch(err => { console.error('VAPT Master: Data files fetch error:', err); return []; });

      return Promise.all([fetchFeatures, fetchDomains, fetchDataFiles])
        .then(([res, domainData, files]) => {
          const cleanedFiles = (files || []).map(f => ({ ...f, label: (f.label || f.filename).replace(/_/g, ' ') }));
          setFeatures(res.features || []);
          setSchema(res.schema || { item_fields: [] });
          setDomains(domainData || []);
          setDataFiles(cleanedFiles);
          setLoading(false);
        })
        .catch((err) => {
          console.error('VAPT Master: Dashboard data fetch error:', err);
          setError(sprintf(__('Critical error loading dashboard data: %s', 'vapt-Copilot'), err.message || 'Unknown error'));
          setLoading(false);
        });
    };

    useEffect(() => {
      fetchData();
    }, []);

    useEffect(() => {
      localStorage.setItem('vaptm_selected_file', selectedFile);
    }, [selectedFile]);

    const updateFeature = (key, data) => {
      // Optimistic Update
      setFeatures(prev => prev.map(f => f.key === key ? { ...f, ...data } : f));
      setSaveStatus({ message: __('Saving...', 'vapt-Copilot'), type: 'info' });

      return apiFetch({
        path: 'vaptc/v1/features/update',
        method: 'POST',
        data: { key, ...data }
      }).then(() => {
        setSaveStatus({ message: __('Saved', 'vapt-Copilot'), type: 'success' });
      }).catch(err => {
        console.error('Update failed:', err);
        setSaveStatus({ message: __('Error saving!', 'vapt-Copilot'), type: 'error' });
      });
    };

    const addDomain = (domain, isWildcard = false) => {
      apiFetch({
        path: 'vaptc/v1/domains/update',
        method: 'POST',
        data: { domain, is_wildcard: isWildcard }
      }).then(() => fetchData());
    };

    const updateDomainFeatures = (domainId, updatedFeatures) => {
      // Optimistic Update
      setDomains(prev => prev.map(d => d.id === domainId ? { ...d, features: updatedFeatures } : d));
      setSaveStatus({ message: __('Saving...', 'vapt-Copilot'), type: 'info' });

      apiFetch({
        path: 'vaptc/v1/domains/features',
        method: 'POST',
        data: { domain_id: domainId, features: updatedFeatures }
      }).then(() => {
        setSaveStatus({ message: __('Saved', 'vapt-Copilot'), type: 'success' });
      }).catch(err => {
        console.error('Domain features update failed:', err);
        setSaveStatus({ message: __('Error saving!', 'vapt-Copilot'), type: 'error' });
      });
    };

    const uploadJSON = (file) => {
      const formData = new FormData();
      formData.append('file', file);

      setLoading(true);
      apiFetch({
        path: 'vaptc/v1/upload-json',
        method: 'POST',
        body: formData,
      }).then((res) => {
        console.log('VAPT Master: JSON uploaded', res);
        // Fetch fresh data (including file list) THEN update selection
        fetchData().then(() => { // Call fetchData without arguments to refresh all data, including dataFiles
          setSelectedFile(res.filename);
        });
      }).catch(err => {
        console.error('VAPT Master: Upload error:', err);
        alert(__('Error uploading JSON', 'vapt-Copilot'));
        setLoading(false);
      });
    };

    const [allFiles, setAllFiles] = useState([]);
    const [hiddenFiles, setHiddenFiles] = useState([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    const fetchAllFiles = () => {
      apiFetch({ path: 'vaptc/v1/data-files/all' }).then(res => {
        // Clean display filenames (underscores to spaces)
        const cleaned = res.map(f => ({ ...f, display_name: f.filename.replace(/_/g, ' ') }));
        setAllFiles(cleaned);
        setHiddenFiles(res.filter(f => f.isHidden).map(f => f.filename));
      });
    };

    useEffect(() => {
      if (isManageModalOpen) {
        fetchAllFiles();
      }
    }, [isManageModalOpen]);

    const updateHiddenFiles = (newHidden) => {
      setHiddenFiles(newHidden);
      apiFetch({
        path: 'vaptc/v1/update-hidden-files',
        method: 'POST',
        data: { hidden_files: newHidden }
      }).then(() => {
        fetchData(); // Refresh dropdown list
      });
    };


    const DomainFeatures = () => {
      const [newDomain, setNewDomain] = useState('');

      return el(PanelBody, { title: __('Domain Specific Features', 'vapt-Copilot'), initialOpen: true }, [
        el('div', { key: 'add-domain', style: { marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'flex-end' } }, [
          el(TextControl, {
            label: __('Add New Domain', 'vapt-Copilot'),
            value: newDomain,
            onChange: (val) => setNewDomain(val),
            placeholder: 'example.com'
          }),
          el(Button, {
            isPrimary: true,
            onClick: () => { addDomain(newDomain); setNewDomain(''); }
          }, __('Add Domain', 'vapt-Copilot'))
        ]),
        el('table', { key: 'table', className: 'wp-list-table widefat fixed striped' }, [
          el('thead', null, el('tr', null, [
            el('th', null, __('Domain', 'vapt-Copilot')),
            el('th', null, __('Type', 'vapt-Copilot')),
            el('th', null, __('Features Enabled', 'vapt-Copilot')),
            el('th', null, __('Actions', 'vapt-Copilot')),
          ])),
          el('tbody', null, domains.map((d) => el('tr', { key: d.id }, [
            el('td', null, el('strong', null, d.domain)),
            el('td', null, d.is_wildcard ? __('Wildcard', 'vapt-Copilot') : __('Standard', 'vapt-Copilot')),
            el('td', null, `${d.features.length} ${__('Features', 'vapt-Copilot')}`),
            el('td', null, el(Button, {
              isSecondary: true,
              onClick: () => { setSelectedDomain(d); setDomainModalOpen(true); }
            }, __('Manage Features', 'vapt-Copilot')))
          ])))
        ]),
        isDomainModalOpen && selectedDomain && el(Modal, {
          key: 'modal',
          title: sprintf(__('Features for %s', 'vapt-Copilot'), selectedDomain.domain),
          onRequestClose: () => setDomainModalOpen(false)
        }, [
          el('p', null, __('Select features to enable for this domain. Only "Implemented" features are available.', 'vapt-Copilot')),
          el('div', { className: 'vaptm-feature-grid' }, features.filter(f => f.status === 'implemented').map(f => el(ToggleControl, {
            key: f.key,
            label: f.label,
            help: f.description,
            checked: selectedDomain.features.includes(f.key),
            onChange: (val) => {
              const newFeats = val
                ? [...selectedDomain.features, f.key]
                : selectedDomain.features.filter(k => k !== f.key);
              updateDomainFeatures(selectedDomain.id, newFeats);
              setSelectedDomain({ ...selectedDomain, features: newFeats });
            }
          }))),
          el('div', { style: { marginTop: '20px', textAlign: 'right' } }, el(Button, {
            isPrimary: true,
            onClick: () => setDomainModalOpen(false)
          }, __('Done', 'vapt-Copilot')))
        ])
      ]);
    };

    const BuildGenerator = () => {
      const [buildDomain, setBuildDomain] = useState('');
      const [buildVersion, setBuildVersion] = useState('1.0.0');
      const [whiteLabel, setWhiteLabel] = useState({
        name: 'VAPT Master Client',
        description: 'Custom Security Build',
        author: 'Tan Malik'
      });
      const [generating, setGenerating] = useState(false);
      const [downloadUrl, setDownloadUrl] = useState(null);

      const runBuild = () => {
        setGenerating(true);
        setDownloadUrl(null);
        const selectedDomain = domains.find(d => d.domain === buildDomain);
        const buildFeatures = selectedDomain ? selectedDomain.features : features.filter(f => f.status === 'implemented').map(f => f.key);

        apiFetch({
          path: 'vaptc/v1/build/generate',
          method: 'POST',
          data: {
            domain: buildDomain,
            version: buildVersion,
            features: buildFeatures,
            white_label: whiteLabel
          }
        }).then((res) => {
          setDownloadUrl(res.download_url);
          setGenerating(false);
        }).catch(() => {
          setGenerating(false);
          alert(__('Build failed!', 'vapt-Copilot'));
        });
      };

      return el(PanelBody, { title: __('Generate Customized Plugin Build', 'vapt-Copilot'), initialOpen: true }, [
        el('div', { key: 'form', style: { maxWidth: '600px' } }, [
          el(SelectControl, {
            label: __('Select Target Domain', 'vapt-Copilot'),
            value: buildDomain,
            options: [
              { label: __('--- Select Domain ---', 'vapt-Copilot'), value: '' },
              { label: __('Wildcard (Include All Implemented Features)', 'vapt-Copilot'), value: 'wildcard' },
              ...domains.map(d => ({ label: d.domain, value: d.domain }))
            ],
            onChange: (val) => setBuildDomain(val)
          }),
          el(TextControl, {
            label: __('Build Version', 'vapt-Copilot'),
            value: buildVersion,
            onChange: (val) => setBuildVersion(val)
          }),
          el('h3', null, __('White Label Options', 'vapt-Copilot')),
          el(TextControl, {
            label: __('Plugin Name', 'vapt-Copilot'),
            value: whiteLabel.name,
            onChange: (val) => setWhiteLabel({ ...whiteLabel, name: val })
          }),
          el(TextControl, {
            label: __('Plugin Description', 'vapt-Copilot'),
            value: whiteLabel.description,
            onChange: (val) => setWhiteLabel({ ...whiteLabel, description: val })
          }),
          el(TextControl, {
            label: __('Author Name', 'vapt-Copilot'),
            value: whiteLabel.author,
            onChange: (val) => setWhiteLabel({ ...whiteLabel, author: val })
          }),
          el(Button, {
            isPrimary: true,
            isLarge: true,
            onClick: runBuild,
            disabled: !buildDomain || generating
          }, generating ? el(Spinner) : __('Generate Build ZIP', 'vapt-Copilot')),
          downloadUrl && el('div', { key: 'download', style: { marginTop: '20px', padding: '15px', background: '#edeff0', borderLeft: '4px solid #00a0d2' } }, [
            el('p', null, el('strong', null, __('Build Ready!', 'vapt-Copilot'))),
            el(Button, {
              isLink: true,
              href: downloadUrl,
              target: '_blank'
            }, __('Click here to download your custom plugin ZIP', 'vapt-Copilot'))
          ])
        ])
      ]);
    };


    const LicenseTab = () => el(PanelBody, { title: __('License & Subscription Management', 'vapt-Copilot'), initialOpen: true }, [
      el(Placeholder, {
        key: 'placeholder',
        icon: el(Dashicon, { icon: 'admin-network' }),
        label: __('License Keys', 'vapt-Copilot'),
        instructions: __('Manage domain licenses and activation status here.', 'vapt-Copilot')
      }, [
        el('table', { key: 'table', className: 'wp-list-table widefat fixed striped' }, [
          el('thead', null, el('tr', null, [
            el('th', null, __('Domain', 'vapt-Copilot')),
            el('th', null, __('License Key', 'vapt-Copilot')),
            el('th', null, __('Status', 'vapt-Copilot')),
          ])),
          el('tbody', null, domains.map(d => el('tr', { key: d.id }, [
            el('td', null, d.domain),
            el('td', null, el('code', null, d.license_id || __('No License assigned', 'vapt-Copilot'))),
            el('td', null, d.license_id ?
              el('span', { style: { color: 'green' } }, __('Active', 'vapt-Copilot')) :
              el('span', { style: { color: 'red' } }, __('Inactive', 'vapt-Copilot')))
          ])))
        ])
      ])
    ]);

    const tabs = [
      {
        name: 'features',
        title: __('Feature List', 'vapt-Copilot'),
        className: 'vaptm-tab-features',
      },
      {
        name: 'license',
        title: __('License Management', 'vapt-Copilot'),
        className: 'vaptm-tab-license',
      },
      {
        name: 'domains',
        title: __('Domain Features', 'vapt-Copilot'),
        className: 'vaptm-tab-domains',
      },
      {
        name: 'build',
        title: __('Build Generator', 'vapt-Copilot'),
        className: 'vaptm-tab-build',
      },
    ];

    if (error) {
      return el('div', { className: 'vaptm-admin-wrap' }, [
        el('h1', null, __('VAPT Copilot Dashboard', 'vapt-Copilot')),
        el(Notice, { status: 'error', isDismissible: false }, error),
        el(Button, { isSecondary: true, onClick: () => fetchData() }, __('Retry', 'vapt-Copilot'))
      ]);
    }

    return el('div', { className: 'vaptm-admin-wrap' }, [
      el('h1', null, [
        __('VAPT Copilot Dashboard', 'vapt-Copilot'),
        el('span', { style: { fontSize: '0.5em', marginLeft: '10px', color: '#666', fontWeight: 'normal' } }, `v${vaptmSettings.pluginVersion}`)
      ]),
      saveStatus && el('div', {
        style: {
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          background: saveStatus.type === 'error' ? '#d63638' : '#2271b1',
          color: '#fff',
          padding: '10px 20px',
          borderRadius: '4px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
          zIndex: 100,
          fontWeight: '600',
          transition: 'opacity 0.3s ease-in-out'
        }
      }, saveStatus.message),
      el(TabPanel, {
        className: 'vaptm-main-tabs',
        activeClass: 'is-active',
        tabs: tabs
      }, (tab) => {
        switch (tab.name) {
          case 'features': return el(FeatureList, {
            features,
            schema,
            updateFeature,
            loading,
            dataFiles,
            selectedFile,
            allFiles,
            hiddenFiles,
            onUpdateHiddenFiles: updateHiddenFiles,
            onSelectFile: (val) => {
              if (window.confirm(__('Changing the feature source will override the current list. Previously implemented features with matching keys will retain their status. Proceed?', 'vapt-Copilot'))) {
                setSelectedFile(val);
                fetchData(val);
              }
            },
            onUpload: uploadJSON,
            isManageModalOpen,
            setIsManageModalOpen
          });
          case 'license': return el(LicenseTab);
          case 'domains': return el(DomainFeatures);
          case 'build': return el(BuildGenerator);
          default: return null;
        }
      })
    ]);
  };

  const init = () => {
    const container = document.getElementById('vaptm-admin-root');
    if (!container) {
      console.warn('VAPT Copilot: Root container #vaptm-admin-root not found.');
      return;
    }

    console.log('VAPT Copilot: Starting React mount...');

    if (typeof wp === 'undefined' || !wp.element) {
      console.error('VAPT Copilot: WordPress React environment (wp.element) missing!');
      container.innerHTML = '<div class="notice notice-error"><p>Error: WordPress React components failed to load. Please check plugin dependencies.</p></div>';
      return;
    }

    try {
      const root = wp.element.createRoot ? wp.element.createRoot(container) : null;
      if (root) {
        root.render(el(ErrorBoundary, null, el(VAPTMAdmin)));
      } else {
        wp.element.render(el(ErrorBoundary, null, el(VAPTMAdmin)), container);
      }
      console.log('VAPT Copilot: React app mounted successfully.');

      // Remove the loading notice if present
      const loadingNotice = container.querySelector('.notice-info');
      if (loadingNotice) loadingNotice.remove();

    } catch (err) {
      console.error('VAPT Copilot: Mounting exception:', err);
      container.innerHTML = `<div class="notice notice-error"><p>Critical UI Mounting Error: ${err.message}</p></div>`;
    }
  };

  // Expose init globally for diagnostics
  window.vaptmInit = init;

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    console.log('VAPT Copilot: Document ready, running init');
    init();
  } else {
    console.log('VAPT Copilot: Waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
  }
})();
