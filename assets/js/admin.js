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

  const FeatureList = ({ features, schema, updateFeature, loading, dataFiles, selectedFile, onSelectFile, onUpload, allFiles, hiddenFiles, onUpdateHiddenFiles, manageSourcesStatus, isManageModalOpen, setIsManageModalOpen, designPromptConfig, setDesignPromptConfig, isPromptConfigModalOpen, setIsPromptConfigModalOpen }) => {
    const [columnOrder, setColumnOrder] = useState(() => {
      const saved = localStorage.getItem(`vaptm_col_order_${selectedFile}`);
      return saved ? JSON.parse(saved) : ['title', 'category', 'severity', 'description'];
    });

    const [visibleCols, setVisibleCols] = useState(() => {
      const saved = localStorage.getItem(`vaptm_visible_cols_${selectedFile}`);
      return saved ? JSON.parse(saved) : ['title', 'category', 'severity', 'description'];
    });

    // Update column defaults when schema changes if not already set
    useEffect(() => {
      const savedOrder = localStorage.getItem(`vaptm_col_order_${selectedFile}`);
      const savedVisible = localStorage.getItem(`vaptm_visible_cols_${selectedFile}`);

      console.log('[VAPTM] Init Check:', { selectedFile, savedOrder: !!savedOrder, savedVisible: !!savedVisible });

      if (!savedOrder && schema?.item_fields) {
        console.log('[VAPTM] Applying default order');
        setColumnOrder(['title', 'category', 'severity', 'description']);
      }
      if (!savedVisible && schema?.item_fields) {
        console.log('[VAPTM] Applying default visibility');
        setVisibleCols(['title', 'category', 'severity', 'description']);
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

    // Local Save Status for Columns
    const [colSaveStatus, setColSaveStatus] = useState(null);
    const isFirstMount = wp.element.useRef(true);

    useEffect(() => {
      if (isFirstMount.current) {
        isFirstMount.current = false;
        return;
      }
      localStorage.setItem(`vaptm_col_order_${selectedFile}`, JSON.stringify(columnOrder));
      localStorage.setItem(`vaptm_visible_cols_${selectedFile}`, JSON.stringify(visibleCols));
      setColSaveStatus('Saved');
      const timer = setTimeout(() => setColSaveStatus(null), 2000);
      return () => clearTimeout(timer);
    }, [columnOrder, visibleCols, selectedFile]);

    // Drag and Drop State
    const [draggedCol, setDraggedCol] = useState(null);

    const handleDragStart = (e, col) => {
      setDraggedCol(col);
      e.dataTransfer.effectAllowed = 'move';
      // e.target.style.opacity = '0.5'; 
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetCol) => {
      e.preventDefault();
      if (draggedCol === targetCol) return;

      const newOrder = [...columnOrder];
      const draggedIdx = newOrder.indexOf(draggedCol);
      const targetIdx = newOrder.indexOf(targetCol);

      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedCol);

      setColumnOrder(newOrder);
      setDraggedCol(null);
    };

    const [selectedSeverities, setSelectedSeverities] = useState(() => {
      const saved = localStorage.getItem('vaptm_selected_severities');
      return saved ? JSON.parse(saved) : [];
    });
    const [sortBy, setSortBy] = useState(() => localStorage.getItem('vaptm_sort_by') || 'name');
    const [sortOrder, setSortOrder] = useState(() => localStorage.getItem('vaptm_sort_order') || 'asc');
    const [searchQuery, setSearchQuery] = useState(() => localStorage.getItem('vaptm_search_query') || '');
    const [fieldMapping, setFieldMapping] = useState(() => {
      const saved = localStorage.getItem('vaptm_field_mapping');
      return saved ? JSON.parse(saved) : { test_method: '', verification_steps: '', verification_engine: '' };
    });
    const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);

    // Persist Field Mapping
    useEffect(() => {
      localStorage.setItem('vaptm_field_mapping', JSON.stringify(fieldMapping));
    }, [fieldMapping]);

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

    // Smart Toggle Handling
    const handleSmartToggle = (feature, toggleKey) => {
      const newVal = !feature[toggleKey];
      let updates = { [toggleKey]: newVal ? 1 : 0 }; // Ensure 1/0 for DB compatibility

      if (newVal) {
        let contentField = null;
        let mappingKey = null;

        if (toggleKey === 'include_test_method') {
          contentField = 'test_method'; mappingKey = 'test_method';
        } else if (toggleKey === 'include_verification') {
          contentField = 'verification_steps'; mappingKey = 'verification_steps';
        } else if (toggleKey === 'include_verification_engine') {
          contentField = 'generated_schema'; mappingKey = 'verification_engine';
        }

        if (contentField && mappingKey && fieldMapping[mappingKey]) {
          // Check if destination is effectively empty
          let isEmpty = !feature[contentField];
          if (Array.isArray(feature[contentField]) && feature[contentField].length === 0) isEmpty = true;
          if (typeof feature[contentField] === 'object' && feature[contentField] !== null && Object.keys(feature[contentField]).length === 0) isEmpty = true;
          // Special check for schema with empty controls
          if (contentField === 'generated_schema' && feature[contentField]?.controls?.length === 0) isEmpty = true;

          if (isEmpty) {
            const sourceKey = fieldMapping[mappingKey];
            let sourceVal = feature[sourceKey];
            if (sourceVal) {
              if (contentField === 'generated_schema' && typeof sourceVal === 'string') {
                try { sourceVal = JSON.parse(sourceVal); } catch (e) {
                  console.warn('VAPTC: Failed to parse source JSON for mapping', e);
                }
              }
              updates[contentField] = sourceVal;
              console.log(`VAPTC: Smart Mapping populated ${contentField} from ${sourceKey}`);
            }
          }
        }
      }
      updateFeature(feature.key, updates);
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
    const HistoryModal = ({ feature, updateFeature, onClose }) => {
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

      const resetHistory = () => {
        if (!confirm(sprintf(__('Are you sure you want to reset history for "%s"?\n\nThis will:\n1. Clear all history records.\n2. Reset status to "Draft".', 'vapt-Copilot'), feature.label))) return;

        setLoading(true);
        // Call API directly to ensure specific params are handled if updateFeature wrapper is too simple, 
        // but updateFeature should work if updated backend handles 'reset_history'.
        // Let's use updateFeature if it wraps apiFetch mostly transparently, or check implementation.
        // updateFeature in admin.js likely does optimistic UI updates which might be good, 
        // but here we want a hard reset. Let's assume updateFeature calls 'vaptc/v1/features/update'.
        // Backend expects 'reset_history' param.

        updateFeature(feature.key, {
          status: 'Draft',
          reset_history: true,
          has_history: false, // Optimistically disable history button
          history_note: 'History Reset by User'
        }).then(() => {
          setLoading(false);
          onClose();
          // No need to alert, the main UI updates status via prop
        });
      };

      return el(Modal, {
        title: sprintf(__('History: %s', 'vapt-Copilot'), feature.name || feature.label),
        onRequestClose: onClose,
        className: 'vaptm-history-modal'
      }, [
        el('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' } },
          el(Button, {
            isDestructive: true,
            isSmall: true,
            icon: 'trash',
            onClick: resetHistory,
            disabled: loading || history.length === 0
          }, __('Reset History & Status', 'vapt-Copilot'))
        ),
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
      const [localImplData, setLocalImplData] = useState(
        feature.implementation_data ? (typeof feature.implementation_data === 'string' ? JSON.parse(feature.implementation_data) : feature.implementation_data) : {}
      );
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
          const hasTestActions = parsed.controls && parsed.controls.some(c => c.type === 'test_action');

          setIsSaving(true);
          updateFeature(feature.key, {
            generated_schema: JSON.stringify(parsed), // Ensure it is sent as string just in case, though apiFetch handles objects
            include_verification_engine: hasTestActions ? 1 : 0,
            implementation_data: JSON.stringify(localImplData)
          })
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
        let contextJson = '';

        if (designPromptConfig) {
          contextJson = typeof designPromptConfig === 'string'
            ? designPromptConfig
            : JSON.stringify(designPromptConfig, null, 2);
        } else {
          // New Default JSON Template per User Request
          // const defaultTemplate = {
          //   "design_prompt": {
          //     "interface_type": "{automation_prompts.ai_ui}",
          //     "schema_definition": "{schema_hints}",
          //     "title": "{title}",
          //     "description": "{description}",
          //     "severity": "{severity}",
          //     "validation_rules": "{automation_prompts.ai_check}",
          //     "context": "{category}"
          //   }
          const defaultTemplate = {
            "design_prompt": {
              "interface_type": "Interactive Security Assessment Interface",
              "schema_definition": "WordPress VAPT schema with standardized control fields",
              // "control_id": "{{id}}",
              "title": "{{title}}",
              "description": "{{description}}",
              "severity": "{{severity}}",
              "category": "{{category}}",
              "validation_rules": "PHP verification logic for {{title}}",
              "context": "{{category}}",
              "ui_components": {
                "primary_card": "{{automation_prompts.ai_ui}}",
                "test_checklist": "{{tests}}",
                "risk_indicators": "{{risks}}",
                "assurance_badges": "{{assurance}}",
                "evidence_uploader": "{{evidence}}",
                "remediation_steps": "{{remediation}}"
              },
              "schema_fields": "{{schema_hints.fields}}",
              "automation_context": {
                "ai_check_prompt": "{{automation_prompts.ai_check}}",
                "ai_schema_fields": "{{automation_prompts.ai_schema}}"
              },
              "compliance_references": "{{references}}",
              "threat_model": {
                "risks": "{{risks}}",
                "assurance_against": "{{assurance_against}}"
              },
              "interaction_model": {
                "test_execution": "Manual and automated test execution interface",
                "evidence_collection": "File upload and screenshot capture",
                "status_tracking": "Pass/Fail/In Progress/Not Applicable",
                "remediation_tracking": "Action items with assignment and due dates"
              }
            }
          };

          contextJson = JSON.stringify(defaultTemplate, null, 2);
        }

        // // Replace Placeholders in the JSON portion
        // contextJson = contextJson.replace(/{title}/g, feature.label || feature.title || '');
        // contextJson = contextJson.replace(/{category}/g, feature.category || 'General');
        // contextJson = contextJson.replace(/{description}/g, feature.description || 'None provided');
        // contextJson = contextJson.replace(/{severity}/g, feature.severity || 'Medium');
        // contextJson = contextJson.replace(/{automation_prompts\.ai_ui}/g, `Interactive JSON Schema for VAPT Workbench.`);
        // contextJson = contextJson.replace(/{automation_prompts\.ai_check}/g, `PHP verification logic for ${feature.label || 'this feature'}.`);
        // contextJson = contextJson.replace(/{schema_hints}/g, "Standard VAPT schema with 'controls' array.");
        // contextJson = contextJson.replace(/{remediation}/g, feature.remediation || 'None provided');
        // contextJson = contextJson.replace(/{test_method}/g, feature.test_method || 'None provided');

        // Assemble HYBRID PROMPT (Context + Instructions)
        // const finalPrompt = `Please generate an interactive security interface JSON based on the following context:
        const finalPrompt = `Assume yourself as a WordPress security expert, you are desired to design an interactive WordPress security configuration interface for this feature:

--- DESIGN CONTEXT ---
${contextJson}
--- 

INSTRUCTIONS & CRITICAL RULES:
1. **Response Format**: Provide ONLY a JSON block. No preamble or conversation.
2. **Schema Structure**: You MUST include both 'controls' and 'enforcement' blocks.
3. **Default Values**: Every input/toggle control MUST have a 'default' property (e.g. "5", true, "off"). This is CRITICAL for backend baseline enforcement.
4. **Enforcement Mappings**: You MUST map control keys to backend methods in the 'enforcement' block, keeping all the variables and constants local to this implementation.
   - Available Methods: 'limit_login_attempts', 'block_xmlrpc', 'disable_directory_browsing', 'enable_security_headers', 'block_null_byte_injection', 'hide_wp_version'.
   - Driver: Always use "driver": "hook" for these methods.
5. **Reset Logic**: For ANY rate-limiting feature, a reset 'test_action' is MANDATORY.
   - Logic: "test_logic": "universal_probe"
   - Config: {"method": "GET", "path": "/", "params": {"vaptc_action": "reset_rate_limits"}, "expected_status": 200}
6. **Dynamic Testing**: For 'spam_requests', ensure the RPM is resolved from the 'rate_limit' or 'limit' key in sibling controls.
7. **Attribution**: Test outcomes must explicitly state if "The Plugin" is enforcing based on headers like X-VAPTC-Enforced.
8. **Reference JSON Structure**:
   {
     "controls": [
       { "type": "toggle", "label": "Enable Feature", "key": "status", "default": true },
       { "type": "input", "label": "Max Attempts", "key": "rate_limit", "default": "5" },
       { "type": "test_action", "label": "Verify", "key": "v1", "test_logic": "spam_requests" },
       { "type": "test_action", "label": "Reset", "key": "reset", "test_logic": "universal_probe", "test_config": {"method": "GET", "path": "/", "params": {"vaptc_action": "reset_rate_limits"}, "expected_status": 200} }
     ],
     "enforcement": {
       "driver": "hook",
       "mappings": { "status": "limit_login_attempts", "rate_limit": "limit_login_attempts" }
     }
   }

Feature Name: ${feature.label || feature.title}
Remediation (Core Logic): ${feature.remediation || 'None provided'}
Test Method: ${feature.test_method || 'None provided'}`;

        // Robust Copy Function
        const copyToClipboard = (text) => {
          if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text);
          } else {
            // Fallback for older browsers or non-secure contexts
            let textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.left = "0";
            textArea.style.top = "0";
            textArea.style.opacity = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            return new Promise((resolve, reject) => {
              try {
                document.execCommand('copy') ? resolve() : reject(new Error('Copy failed'));
              } catch (e) { reject(e); }
              document.body.removeChild(textArea);
            });
          }
        };

        copyToClipboard(finalPrompt)
          .then(() => {
            setSaveStatus({ message: __('Design Prompt copied!', 'vapt-Copilot'), type: 'success' });
            setTimeout(() => setSaveStatus(null), 3000);
          })
          .catch((err) => {
            console.error('Copy failed', err);
            alert(__('Failed to copy to clipboard.', 'vapt-Copilot'));
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

        // Grid Layout (Left: Editor, Right: Preview)
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: '520px' } }, [
          // Left Side: The Editor
          el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', paddingRight: '10px' } }, [
            el('p', { style: { margin: '0 0 10px 0', fontSize: '13px', color: '#666' } }, __('Paste the JSON schema generated via Antigravity (the AI Proxy) below.', 'vapt-Copilot')),
            el('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } }, [
              el(wp.components.TextareaControl, {
                label: __('Interface JSON Schema', 'vapt-Copilot'),
                value: schemaText,
                onChange: onJsonChange,
                rows: 20,
                help: __('The sidebar workbench will render this instantly.', 'vapt-Copilot'),
                style: { fontFamily: 'monospace', fontSize: '12px', background: '#fcfcfc', lineHeight: '1.4', flex: 1, resize: 'none' }
              })
            ]),
            el('div', { style: { display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '15px' } }, [
              el(Button, {
                isSecondary: true,
                icon: designPromptConfig ? 'yes' : 'admin-settings',
                style: designPromptConfig ? { color: '#46b450', borderColor: '#46b450' } : {},
                onClick: () => setIsPromptConfigModalOpen(true),
                label: __('Configure Design Prompt', 'vapt-Copilot')
              }),
              el(Button, { isSecondary: true, onClick: copyContext, icon: 'clipboard' }, __('Copy Design Prompt', 'vapt-Copilot')),
              el(Button, {
                isDestructive: true,
                icon: 'trash',
                onClick: () => {
                  if (confirm(__('Are you sure you want to reset the schema? This will wash away any changes.', 'vapt-Copilot'))) {
                    onJsonChange(JSON.stringify(defaultState, null, 2));
                    setSaveStatus({ message: __('Schema Reset!', 'vapt-Copilot'), type: 'success' });
                    setTimeout(() => setSaveStatus(null), 2000);
                  }
                }
              }, __('Reset', 'vapt-Copilot'))
            ])
          ]),

          // Right Side: Live Preview
          el('div', { style: { background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100%' } }, [
            el('div', { style: { padding: '10px 15px', borderBottom: '1px solid #e5e7eb', background: '#fff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
              el(Icon, { icon: 'visibility', size: 16 }),
              el('strong', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563' } }, __('Live Implementation Preview'))
            ]),
            el('div', { style: { padding: '15px', flexGrow: 1, overflowY: 'auto' } }, [ // Added overflowY auto to inner content if it grows
              el('div', { style: { background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } }, [
                el('h4', { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#111827' } }, __('Functional Workbench')),
                GeneratedInterface
                  ? el(GeneratedInterface, {
                    feature: { ...feature, generated_schema: parsedSchema, implementation_data: localImplData },
                    onUpdate: (newData) => setLocalImplData(newData)
                  })
                  : el('p', null, __('Loading Preview Interface...', 'vapt-Copilot'))
              ])
            ]),
            el('div', { style: { padding: '10px 15px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#fff', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' } }, [
              el(Button, { isSecondary: true, onClick: onClose }, __('Cancel', 'vapt-Copilot')),
              el(Button, { isPrimary: true, onClick: handleSave, isBusy: isSaving }, __('Save & Deploy to Workbench', 'vapt-Copilot'))
            ])
          ])
        ])
      ]);
    };

    // Prompt Configuration Modal
    const PromptConfigModal = ({ isOpen, onClose, feature }) => {
      const [localConfig, setLocalConfig] = useState('');
      const [isSaving, setIsSaving] = useState(false);

      useEffect(() => {
        if (isOpen) {
          const val = designPromptConfig
            ? (typeof designPromptConfig === 'string' ? designPromptConfig : JSON.stringify(designPromptConfig, null, 2))
            : '';
          setLocalConfig(val || JSON.stringify({
            "design_prompt": {
              "title": "{title}",
              "description": "{description}",
              "context": "{category}"
            }
          }, null, 2));
        }
      }, [isOpen]);

      const save = () => {
        try {
          // Validate JSON
          const parsed = JSON.parse(localConfig);
          setIsSaving(true);
          apiFetch({
            path: 'vaptc/v1/data-files/meta',
            method: 'POST',
            data: {
              file: selectedFile,
              key: 'design_prompt',
              value: parsed
            }
          })
            .then(res => {
              setDesignPromptConfig(parsed); // Update global state
              setIsSaving(false);
              onClose(); // Close modal to return to Design Hub
              setSaveStatus({ message: __('Prompt Config Saved!', 'vapt-Copilot'), type: 'success' });
            })
            .catch(err => {
              console.error(err);
              setIsSaving(false);
              alert('Failed to save configuration.');
            });
        } catch (e) {
          alert('Invalid JSON. Please fix syntax before saving.');
        }
      };

      const resetToDefault = () => {
        if (!confirm(__('Are you sure you want to reset to the default system prompt? This will delete your custom configuration.', 'vapt-Copilot'))) return;
        setIsSaving(true);
        apiFetch({
          path: 'vaptc/v1/data-files/meta',
          method: 'POST',
          data: {
            file: selectedFile,
            key: 'design_prompt',
            value: null
          }
        })
          .then(() => {
            setDesignPromptConfig(null);
            setIsSaving(false);
            onClose();
            setSaveStatus({ message: __('Configuration Reset!', 'vapt-Copilot'), type: 'success' });
          });
      };

      return el(Modal, {
        title: __('Configure AI Design Prompt Template', 'vapt-Copilot'),
        onRequestClose: onClose,
        style: { maxWidth: '600px' }
      }, [
        el('p', { style: { fontSize: '13px', color: '#666', marginBottom: '10px' } },
          __('Customize the JSON payload copied to the clipboard. This configuration is saved to the active JSON file.', 'vapt-Copilot')
        ),
        el(wp.components.TextareaControl, {
          label: __('Template JSON', 'vapt-Copilot'),
          value: localConfig,
          onChange: setLocalConfig,
          rows: 15,
          style: { fontFamily: 'monospace', fontSize: '12px', whiteSpace: 'pre' }
        }),
        el('div', { style: { background: '#f0f0f1', padding: '10px', borderRadius: '4px', fontSize: '11px', color: '#555', marginBottom: '15px' } }, [
          el('strong', null, 'Available Variables: '),
          '{title}, {description}, {category}, {severity}, {test_method}, {remediation}'
        ]),
        el('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '10px' } }, [
          // Left: Test Copy & Reset
          el('div', { style: { display: 'flex', gap: '5px' } }, [
            feature ? el(Button, {
              isSecondary: true,
              icon: 'clipboard',
              onClick: () => {
                try {
                  let template = localConfig;
                  // Replace Placeholders on local config (preview)
                  template = template.replace(/{title}/g, feature.label || '');
                  template = template.replace(/{category}/g, feature.category || 'General');
                  template = template.replace(/{description}/g, feature.description || 'None provided');
                  template = template.replace(/{severity}/g, feature.severity || 'Medium');
                  template = template.replace(/{remediation}/g, feature.remediation || 'None provided');
                  template = template.replace(/{test_method}/g, feature.test_method || 'None provided');
                  // Advanced placeholders
                  template = template.replace(/{automation_prompts\.ai_ui}/g, 'Generate a React component...');
                  template = template.replace(/{automation_prompts\.ai_check}/g, 'Generate PHP verification logic...');
                  template = template.replace(/{schema_hints}/g, 'Define schema for inputs.');

                  const copy = (text) => {
                    if (navigator.clipboard) navigator.clipboard.writeText(text);
                    else prompt('Copy:', text);
                    alert(__('Prompt copied to clipboard for testing!', 'vapt-Copilot'));
                  };
                  copy(template);
                } catch (e) { alert('Error generating preview'); }
              }
            }, __('Test Copy', 'vapt-Copilot')) : null,
            el(Button, {
              isDestructive: true,
              icon: 'trash',
              disabled: !designPromptConfig,
              onClick: resetToDefault,
              label: __('Reset', 'vapt-Copilot')
            })
          ]),

          // Right: Actions
          el('div', { style: { display: 'flex', gap: '10px' } }, [
            el(Button, { isSecondary: true, onClick: onClose }, __('Close', 'vapt-Copilot')),
            el(Button, { isPrimary: true, onClick: save, isBusy: isSaving }, __('Save Configuration', 'vapt-Copilot'))
          ])
        ])
      ]);
    };

    // Field Mapping Modal
    const FieldMappingModal = ({ isOpen, onClose }) => {
      const [localMapping, setLocalMapping] = useState(fieldMapping);

      const save = () => {
        setFieldMapping(localMapping);
        onClose();
      };

      return el(Modal, {
        title: __('Map Include Fields via JSON Source', 'vapt-Copilot'),
        onRequestClose: onClose,
        style: { maxWidth: '500px' }
      }, [
        el('p', { style: { fontSize: '13px', color: '#666' } }, __('Select which JSON fields should be automatically copied when you toggle these features ON. If the database field is empty, it will be populated from the mapped JSON key.', 'vapt-Copilot')),
        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '15px' } }, [
          el(SelectControl, {
            label: __('Test Method Source', 'vapt-Copilot'),
            help: __('Maps to the "Test Method" toggle.', 'vapt-Copilot'),
            value: localMapping.test_method,
            options: [{ label: __('(None)', 'vapt-Copilot'), value: '' }, ...allKeys.map(k => ({ label: k, value: k }))],
            onChange: (val) => setLocalMapping({ ...localMapping, test_method: val })
          }),
          el(SelectControl, {
            label: __('Verification Steps Source', 'vapt-Copilot'),
            help: __('Maps to the "Verif. Steps" toggle (Interactive Checklist).', 'vapt-Copilot'),
            value: localMapping.verification_steps,
            options: [{ label: __('(None)', 'vapt-Copilot'), value: '' }, ...allKeys.map(k => ({ label: k, value: k }))],
            onChange: (val) => setLocalMapping({ ...localMapping, verification_steps: val })
          }),
          el(SelectControl, {
            label: __('Verification Engine Source', 'vapt-Copilot'),
            help: __('Maps to the "Verif. Engine" toggle (Automated Tests).', 'vapt-Copilot'),
            value: localMapping.verification_engine,
            options: [{ label: __('(None)', 'vapt-Copilot'), value: '' }, ...allKeys.map(k => ({ label: k, value: k }))],
            onChange: (val) => setLocalMapping({ ...localMapping, verification_engine: val })
          })
        ]),
        el('div', { style: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
          el(Button, { isSecondary: true, onClick: onClose }, __('Cancel', 'vapt-Copilot')),
          el(Button, { isPrimary: true, onClick: save }, __('Save Mapping', 'vapt-Copilot'))
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

    return el(Fragment, null, [
      el(PanelBody, { title: __('Exhaustive Feature List', 'vapt-Copilot'), initialOpen: true }, [
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
            // Branded Icon with Configure Columns Dropdown
            el(Dropdown, {
              renderToggle: ({ isOpen, onToggle }) => el('div', {
                onClick: onToggle,
                style: {
                  cursor: 'pointer',
                  background: '#2271b1',
                  color: '#fff',
                  borderRadius: '3px',
                  width: '30px',
                  height: '30px',
                  minHeight: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                  boxSizing: 'border-box'
                },
                'aria-expanded': isOpen,
                title: __('Configure Table Columns', 'vapt-Copilot')
              }, el(Icon, { icon: 'layout', size: 18 })),
              renderContent: ({ onClose }) => {
                const activeFields = columnOrder.filter(c => visibleCols.includes(c) && allKeys.includes(c));
                const availableFields = allKeys.filter(c => !visibleCols.includes(c));
                const half = Math.ceil(availableFields.length / 2);
                const availableCol1 = availableFields.slice(0, half);
                const availableCol2 = availableFields.slice(half);

                return el('div', { style: { padding: '20px', width: '850px' } }, [
                  el('h4', { style: { marginTop: 0, marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' } }, [
                    sprintf(__('Configure Table Columns: %s', 'vapt-Copilot'), selectedFile),
                    el('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } }, [
                      colSaveStatus && el('span', { style: { fontSize: '11px', color: '#00a32a', fontWeight: 'bold' } }, __('Saved to Browser', 'vapt-Copilot')),
                      el(Button, {
                        isSecondary: true,
                        isSmall: true,
                        onClick: onClose,
                        style: { height: '24px', lineHeight: '1' }
                      }, __('Close', 'vapt-Copilot'))
                    ])
                  ]),
                  el('p', { style: { fontSize: '12px', color: '#666', marginBottom: '20px' } }, __('Confirm the table sequence and add/remove fields.', 'vapt-Copilot')),
                  el('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) 1fr 1fr', gap: '25px' } }, [
                    el('div', null, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#2271b1', fontWeight: 'bold' } }, __('Active Table Sequence', 'vapt-Copilot')),
                      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                        activeFields.map((field, activeIdx) => {
                          const masterIdx = columnOrder.indexOf(field);
                          return el('div', {
                            key: field,
                            draggable: true,
                            onDragStart: (e) => handleDragStart(e, field),
                            onDragOver: handleDragOver,
                            onDrop: (e) => handleDrop(e, field),
                            style: {
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '6px 10px',
                              background: draggedCol === field ? '#eef' : '#f0f6fb',
                              borderRadius: '4px',
                              border: '1px solid #c8d7e1',
                              cursor: 'grab',
                              opacity: draggedCol === field ? 0.5 : 1,
                              transition: 'all 0.2s'
                            }
                          }, [
                            el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                              el('span', { className: 'dashicons dashicons-menu', style: { color: '#aaa', cursor: 'grab', fontSize: '16px' } }),
                              el('span', { style: { fontSize: '10px', fontWeight: 'bold', color: '#72777c', minWidth: '20px' } }, `#${activeIdx + 1}`),
                              el(CheckboxControl, {
                                label: field.charAt(0).toUpperCase() + field.slice(1).replace(/_/g, ' '),
                                checked: true,
                                onChange: () => setVisibleCols(visibleCols.filter(c => c !== field)),
                                __nextHasNoMarginBottom: true,
                                __next40pxDefaultSize: true,
                                style: { margin: 0 }
                              })
                            ])
                          ]);
                        })
                      )]),
                    el('div', null, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' } }, __('Available Fields', 'vapt-Copilot')),
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
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', textTransform: 'uppercase', color: '#666', fontWeight: 'bold' } }, __('Available Fields', 'vapt-Copilot')),
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
                        const defaultFields = ['title', 'category', 'severity', 'description'];
                        setColumnOrder(defaultFields);
                        setVisibleCols(defaultFields);
                      }
                    }, __('Reset to Default', 'vapt-Copilot'))
                  ])
                ]);
              }
            }),

            // Map Include Fields Button
            el(Button, {
              isSecondary: true,
              isSmall: true,
              icon: 'networking', // Using networking to represent mapping
              onClick: () => setIsMappingModalOpen(true),
              style: { marginLeft: '5px', fontSize: '11px', height: '30px', minHeight: '30px', boxSizing: 'border-box', lineHeight: '1' }
            }, __('Map Include Fields', 'vapt-Copilot')),

            // Feature Source Selection
            el('div', { style: { flexGrow: 1, paddingLeft: '12px' } }, el(SelectControl, {
              // Label removed per user request
              value: selectedFile,
              options: dataFiles,
              onChange: (val) => onSelectFile(val),
              style: { margin: 0, height: '30px', minHeight: '30px', fontSize: '13px', boxSizing: 'border-box' }
            })),

            // Manage Sources Trigger
            el('div', { style: { borderLeft: '1px solid #dcdcde', paddingLeft: '12px', display: 'flex', alignItems: 'center' } }, [
              el(Button, {
                isSecondary: true,
                icon: 'admin-settings',
                onClick: () => setIsManageModalOpen(true),
                label: __('Manage Sources', 'vapt-Copilot'),
                style: { height: '30px', minHeight: '30px', width: '30px', border: '1px solid #2271b1', color: '#2271b1', boxSizing: 'border-box', padding: 0 }
              })
            ]),

            // Upload Section
            el('div', { style: { borderLeft: '1px solid #dcdcde', paddingLeft: '12px', display: 'flex', flexDirection: 'column' } }, [
              // Label removed per user request
              el('input', {
                type: 'file',
                accept: '.json',
                onChange: (e) => e.target.files.length > 0 && onUpload(e.target.files[0]),
                style: { fontSize: '11px', color: '#555', height: '30px', padding: '4px 0', boxSizing: 'border-box' }
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
            el('div', { style: { marginTop: '20px', textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' } }, [
              manageSourcesStatus === 'saving' && el(Spinner),
              manageSourcesStatus === 'saved' && el('span', { style: { color: '#00a32a', fontWeight: 'bold' } }, __('Saved', 'vapt-Copilot')),
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
      ]), // End Header PanelBody

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
          el('th', { style: { width: '300px' } }, __('Include', 'vapt-Copilot')),
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
              } else if (col === 'references' && Array.isArray(f[col])) {
                content = el('ul', { style: { margin: 0, padding: 0, listStyle: 'none' } },
                  f[col].map((ref, idx) => el('li', { key: idx, style: { fontSize: '11px', marginBottom: '2px' } },
                    el('a', { href: ref.url, target: '_blank', rel: 'noopener noreferrer' },
                      ref.name || ref.url
                    )
                  ))
                );
              } else if (Array.isArray(f[col])) {
                content = el('div', { style: { fontSize: '11px' } }, f[col].map((item, idx) => el('span', { key: idx, className: 'vaptm-pill-compact' },
                  typeof item === 'object' ? JSON.stringify(item) : String(item)
                )));
              } else if (typeof f[col] === 'object' && f[col] !== null) {
                content = el('pre', { style: { fontSize: '10px', margin: 0, background: '#f0f0f0', padding: '4px' } }, JSON.stringify(f[col], null, 2));
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
            el('td', { className: 'vaptm-support-cell', style: { verticalAlign: 'middle' } }, el('div', { style: { display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' } }, [
              // Pill Group for Include unit
              el('div', {
                onClick: () => handleSmartToggle(f, 'include_test_method'),
                title: __('Toggle Test Method', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_test_method ? '#2271b1' : '#f0f0f1',
                  color: f.include_test_method ? '#fff' : '#72777c',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_test_method ? '#2271b1' : '#dcdcde',
                  whiteSpace: 'nowrap'
                }
              }, __('Test Method', 'vapt-Copilot')),

              el('div', {
                onClick: () => handleSmartToggle(f, 'include_verification'),
                title: __('Toggle Verification Steps', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_verification ? '#2271b1' : '#f0f0f1',
                  color: f.include_verification ? '#fff' : '#72777c',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_verification ? '#2271b1' : '#dcdcde',
                  whiteSpace: 'nowrap'
                }
              }, __('Verif. Steps', 'vapt-Copilot')),

              el('div', {
                onClick: () => handleSmartToggle(f, 'include_verification_engine'),
                title: __('Toggle Verification Engine', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: f.include_verification_engine ? '#d63638' : '#f0f0f1',
                  color: f.include_verification_engine ? '#fff' : '#d63638',
                  opacity: ['Draft', 'draft', 'available'].includes(f.status) ? 0.3 : 1,
                  pointerEvents: ['Draft', 'draft', 'available'].includes(f.status) ? 'none' : 'auto',
                  border: '1px solid', borderColor: f.include_verification_engine ? '#d63638' : '#dcdcde',
                  whiteSpace: 'nowrap'
                }
              }, __('Verif. Engine', 'vapt-Copilot')),

              !['Draft', 'draft', 'available'].includes(f.status) && el('div', {
                onClick: () => setDesignFeature(f),
                title: __('Open Design Hub', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: '#f0f0f1',
                  color: '#2271b1',
                  border: '1px solid #2271b1'
                }
              }, __('Design Hub', 'vapt-Copilot'))
            ]))
          ])
        ])))
      ]),

      // History Modal (Sibling in PanelBody Array)
      historyFeature && el(HistoryModal, {
        feature: historyFeature,
        updateFeature: updateFeature,
        onClose: () => setHistoryFeature(null)
      }),

      transitioning && el(TransitionNoteModal, {
        transitioning: transitioning,
        onConfirm: confirmTransition,
        onCancel: () => setTransitioning(null)
      }),

      designFeature && el(DesignModal, {
        feature: designFeature,
        onClose: () => !isPromptConfigModalOpen && setDesignFeature(null)
      }),

      isPromptConfigModalOpen && el(PromptConfigModal, {
        isOpen: isPromptConfigModalOpen,
        onClose: () => setIsPromptConfigModalOpen(false),
        feature: designFeature // Pass current feature for testing
      }),

      isMappingModalOpen && el(FieldMappingModal, {
        isOpen: isMappingModalOpen,
        onClose: () => setIsMappingModalOpen(false)
      }),

    ]);
  };

  const VAPTMAdmin = () => {
    const [features, setFeatures] = useState([]);
    const [schema, setSchema] = useState({ item_fields: [] });
    const [domains, setDomains] = useState([]);
    const [dataFiles, setDataFiles] = useState([]);
    const [selectedFile, setSelectedFile] = useState('features-with-test-methods.json');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isDomainModalOpen, setDomainModalOpen] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState(null);
    const [saveStatus, setSaveStatus] = useState(null); // { message: '', type: 'info'|'success'|'error' }
    const [designPromptConfig, setDesignPromptConfig] = useState(null);
    const [isPromptConfigModalOpen, setIsPromptConfigModalOpen] = useState(false);

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

      setLoading(true);
      setSchema({ item_fields: [] }); // Clear previous schema while loading

      // Use individual catches to prevent one failure from blocking all
      const fetchFeatures = apiFetch({ path: `vaptc/v1/features?file=${file}` })
        .then(res => {
          if (res.error) throw new Error(res.error);
          setFeatures(res.features || []);
          setSchema(res.schema || { item_fields: [] });
          setDesignPromptConfig(res.design_prompt || null); // Load prompt config
          return res;
        })
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
      // First fetch the active file from backend setup
      apiFetch({ path: 'vaptc/v1/active-file' }).then(res => {
        if (res.active_file) {
          setSelectedFile(res.active_file);
          fetchData(res.active_file);
        } else {
          fetchData();
        }
      }).catch(() => fetchData());
    }, []);

    const onSelectFile = (file) => {
      if (!window.confirm(__('Changing the feature source will override the current list. Previously implemented features with matching keys will retain their status. Proceed?', 'vapt-Copilot'))) {
        return;
      }
      setSelectedFile(file);
      fetchData(file);
      // Persist to backend
      apiFetch({
        path: 'vaptc/v1/active-file',
        method: 'POST',
        data: { file }
      }).catch(err => console.error('Failed to sync active file:', err));
    };

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

    const [manageSourcesStatus, setManageSourcesStatus] = useState(null);

    const updateHiddenFiles = (newHidden) => {
      setHiddenFiles(newHidden);
      setManageSourcesStatus('saving');
      apiFetch({
        path: 'vaptc/v1/update-hidden-files',
        method: 'POST',
        data: { hidden_files: newHidden }
      }).then(() => {
        fetchData(); // Refresh dropdown list
        setManageSourcesStatus('saved');
        setTimeout(() => setManageSourcesStatus(null), 2000);
      }).catch(() => setManageSourcesStatus('error'));
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
          el('p', null, __('Select features to enable for this domain. Only "Published" features are available.', 'vapt-Copilot')),
          el('div', { className: 'vaptm-feature-grid' }, features.filter(f => ['implemented', 'release'].includes(f.status.toLowerCase())).map(f => el(ToggleControl, {
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
            key: selectedFile, // Force remount on file change to fix persistence
            features,
            schema,
            updateFeature,
            loading,
            dataFiles,
            selectedFile,
            allFiles,
            hiddenFiles,
            onUpdateHiddenFiles: updateHiddenFiles,
            manageSourcesStatus: manageSourcesStatus,
            onSelectFile: onSelectFile,
            onUpload: uploadJSON,
            isManageModalOpen,
            setIsManageModalOpen,
            designPromptConfig,
            setDesignPromptConfig,
            isPromptConfigModalOpen,
            setIsPromptConfigModalOpen
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
