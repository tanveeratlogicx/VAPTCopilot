// Client Dashboard Entry Point
// Phase 6 Implementation - IDE Workbench Redesign
(function () {
  console.log('VAPTC: client.js version 2.4.3 loaded');
  if (typeof wp === 'undefined') return;

  const { render, useState, useEffect, useMemo, Fragment, createElement: el } = wp.element || {};
  const {
    Button, ToggleControl, Spinner, Notice,
    Card, CardBody, CardHeader, CardFooter,
    Icon
  } = wp.components || {};
  const apiFetch = wp.apiFetch;
  const { __, sprintf } = wp.i18n || {};

  const settings = window.vaptcSettings || window.vaptmSettings || {};
  const isSuper = settings.isSuper || false;
  const GeneratedInterface = window.VAPTM_GeneratedInterface || window.VAPTC_GeneratedInterface;

  const STATUS_LABELS = {
    'Develop': __('Develop', 'vapt-Copilot'),
    'Test': __('Test', 'vapt-Copilot'),
    'Release': __('Release', 'vapt-Copilot')
  };

  const ClientDashboard = () => {
    const [features, setFeatures] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [error, setError] = useState(null);
    const [activeStatus, setActiveStatus] = useState(() => {
      const saved = localStorage.getItem('vaptm_workbench_active_status');
      return saved ? saved : 'Develop';
    });
    const [activeCategory, setActiveCategory] = useState('all');
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
      localStorage.setItem('vaptm_workbench_active_status', activeStatus);
    }, [activeStatus]);

    // Auto-dismiss Success Toasts
    useEffect(() => {
      if (saveStatus && saveStatus.type === 'success') {
        const timer = setTimeout(() => setSaveStatus(null), 1500);
        return () => clearTimeout(timer);
      }
    }, [saveStatus]);

    const fetchData = (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setLoading(true);

      const domain = settings.currentDomain || window.location.hostname;
      apiFetch({ path: `vaptc/v1/features?scope=client&domain=${domain}` })
        .then(data => {
          setFeatures(data.features || []);
          setLoading(false);
          setIsRefreshing(false);
        })
        .catch(err => {
          setError(err.message || 'Failed to load features');
          setLoading(false);
          setIsRefreshing(false);
        });
    };

    useEffect(() => {
      fetchData();
    }, []);

    const updateFeature = (key, data) => {
      setFeatures(prev => prev.map(f => f.key === key ? { ...f, ...data } : f));
      setSaveStatus({ message: __('Saving...', 'vapt-Copilot'), type: 'info' });

      apiFetch({
        path: 'vaptc/v1/features/update',
        method: 'POST',
        data: { key, ...data }
      })
        .then(() => setSaveStatus({ message: __('Saved', 'vapt-Copilot'), type: 'success' }))
        .catch(err => {
          console.error('Save failed:', err);
          setSaveStatus({ message: __('Save Failed', 'vapt-Copilot'), type: 'error' });
        });
    };

    const availableStatuses = useMemo(() => isSuper ? ['Develop', 'Test', 'Release'] : ['Release'], [isSuper]);

    const statusFeatures = useMemo(() => {
      return features.filter(f => {
        const s = f.normalized_status || (f.status ? f.status.toLowerCase() : '');
        const active = activeStatus.toLowerCase();
        if (active === 'develop') return ['develop', 'in_progress'].includes(s);
        if (active === 'test') return ['test', 'testing'].includes(s);
        if (active === 'release') return ['release', 'implemented'].includes(s);
        return s === active;
      });
    }, [features, activeStatus]);

    const categories = useMemo(() => {
      const cats = [...new Set(statusFeatures.map(f => f.category || 'Uncategorized'))].sort();
      return cats;
    }, [statusFeatures]);

    useEffect(() => {
      if (categories.length > 0) {
        if (!activeCategory || (activeCategory !== 'all' && !categories.includes(activeCategory))) {
          setActiveCategory('all');
        }
      } else {
        setActiveCategory(null);
      }
    }, [categories]);

    const displayFeatures = useMemo(() => {
      if (!activeCategory) return [];
      if (activeCategory === 'all') return statusFeatures;
      return statusFeatures.filter(f => (f.category || 'Uncategorized') === activeCategory);
    }, [statusFeatures, activeCategory]);

    const scrollToFeature = (featureKey, category) => {
      if (activeCategory !== 'all' && activeCategory !== category) {
        setActiveCategory(category);
        setTimeout(() => {
          const el = document.getElementById(`feature-${featureKey}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      } else {
        const el = document.getElementById(`feature-${featureKey}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    // Helper to render a single feature card
    const renderFeatureCard = (f) => {
      return el(Card, { key: f.key, id: `feature-${f.key}`, style: { borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: 'none' } }, [
        el(CardHeader, { style: { borderBottom: '1px solid #f3f4f6', padding: '20px 24px' } }, [
          el('div', { style: { display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '30px', width: '100%' } }, [
            el('div', null, [
              el('h3', { style: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' } }, f.label),
              el('p', { style: { margin: '4px 0 0 0', fontSize: '13px', color: '#6b7280' } }, f.description)
            ]),
            el('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' } }, [
              el('span', { className: `vaptm-status-badge status-${f.status.toLowerCase()}`, style: { fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' } }, f.status),
              el('div', { style: { display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' } }, [
                el('span', { style: { fontSize: '12px', fontWeight: 600, color: '#334155', marginRight: '12px', whiteSpace: 'nowrap' } }, __('Enforce Rule')),
                el(ToggleControl, {
                  checked: !!f.is_enforced,
                  onChange: (val) => updateFeature(f.key, { is_enforced: val }),
                  __nextHasNoMarginBottom: true,
                  style: { margin: 0 }
                })
              ])
            ])
          ])
        ]),
        el(CardBody, { style: { padding: '24px' } }, [
          (() => {
            const schema = typeof f.generated_schema === 'string' ? JSON.parse(f.generated_schema) : (f.generated_schema || { controls: [] });
            const isVerifEngine = f.include_verification_engine;

            // Split Controls
            // 1. Functional Implementation
            const implControls = schema.controls ? schema.controls.filter(c => !['test_action', 'risk_indicators', 'assurance_badges', 'test_checklist', 'evidence_list'].includes(c.type)) : [];
            // 2. Verification Engines (Automated Tests)
            const verifActions = schema.controls ? schema.controls.filter(c => c.type === 'test_action') : [];
            // 3. Verification Support (Risks & Badges)
            const supportControls = schema.controls ? schema.controls.filter(c => ['risk_indicators', 'assurance_badges'].includes(c.type)) : [];

            // Helper for box style
            const boxStyle = { padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
            const subBoxStyle = { marginTop: '20px', padding: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' };

            return el(Fragment, null, [
              // Block 1: Functional & Engine (Side-by-Side Grid)
              el('div', { id: 'vaptw-preview-block-1', style: { display: 'grid', gridTemplateColumns: isVerifEngine ? '1fr 1fr' : '1fr', gap: '30px', marginBottom: '25px' } }, [
                // Left Column: Implementation
                el('div', { id: 'vaptw-preview-panel-functional', style: boxStyle }, [
                  el('h4', { style: { margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#111827', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                    el('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                      el(Icon, { icon: 'admin-settings', size: 16 }),
                      __('Functional Implementation', 'vapt-Copilot')
                    ]),
                    isVerifEngine && el('span', { style: { fontSize: '10px', background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: '4px' } }, 'CONFIG')
                  ]),
                  f.generated_schema && GeneratedInterface
                    ? el(GeneratedInterface, { feature: { ...f, generated_schema: { ...schema, controls: implControls } }, onUpdate: (data) => updateFeature(f.key, { implementation_data: data }) })
                    : el('div', { style: { padding: '30px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '8px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' } },
                      __('No configurable controls.', 'vapt-Copilot'))
                ]),

                // Right Column: Verification Engine
                isVerifEngine ? el('div', { id: 'vaptw-preview-panel-engine', style: boxStyle }, [
                  el('h4', { style: { margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                    el(Icon, { icon: 'shield', size: 16 }),
                    __('Verification Engine', 'vapt-Copilot')
                  ]),
                  el('p', { style: { fontSize: '12px', color: '#64748b', marginBottom: '20px' } }, __('Interactive security verification controls.', 'vapt-Copilot')),

                  // Automated Tests
                  verifActions.length > 0
                    ? el(GeneratedInterface, { feature: { ...f, generated_schema: { ...schema, controls: verifActions } }, onUpdate: (data) => updateFeature(f.key, { implementation_data: data }) })
                    : el('div', { style: { padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' } }, 'No automated tests defined.')
                ]) : el('div', { style: { ...boxStyle, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, [
                  el('p', { style: { margin: 0, fontSize: '12px', color: '#666', fontStyle: 'italic', textAlign: 'center' } }, __('Standard enforcement active. No direct verification engine actions.', 'vapt-Copilot'))
                ])
              ]),

              // Block 2: Functional Verification & Assurance (Full Width)
              el('div', { id: 'vaptw-preview-block-2', style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
                // Structural Header
                el('h4', { style: { margin: '0', fontSize: '13px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Functional Verification')),

                // 2-Column Grid for Verification Steps and Assurance
                el('div', { style: { display: 'grid', gridTemplateColumns: supportControls.length > 0 ? '1fr 1fr' : '1fr', gap: '25px', alignItems: 'stretch' } }, [

                  // Left Column: Manual Verification Steps
                  (() => {
                    const protocol = f.test_method || '';
                    const checklist = typeof f.verification_steps === 'string' ? JSON.parse(f.verification_steps) : (f.verification_steps || []);

                    // Also gather from schema guideControls
                    const schemaGuideItems = schema.controls ? schema.controls.filter(c => ['test_checklist', 'evidence_list'].includes(c.type)) : [];
                    const hasManualSteps = protocol || checklist.length > 0 || schemaGuideItems.length > 0;

                    if (!hasManualSteps) return null;

                    return el('div', { id: 'vaptw-preview-card-verification', style: { ...boxStyle, background: '#f8fafc', margin: 0 } }, [
                      el('h5', { style: { margin: '0 0 15px 0', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' } }, __('Manual Verification Steps')),

                      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
                        // Test Protocol (From Metadata)
                        protocol && el('div', { id: 'vaptw-preview-col-protocol' }, [
                          el('label', { style: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '10px', textTransform: 'uppercase' } }, __('Test Protocol')),
                          el('ol', { style: { margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' } },
                            protocol.split('\n').filter(line => line.trim()).map((line, i) => el('li', { key: i, style: { marginBottom: '6px' } }, line.replace(/^\d+\.\s*/, '')))
                          )
                        ]),

                        // Evidence Checklist (From Metadata)
                        checklist.length > 0 && el('div', { id: 'vaptw-preview-col-checklist' }, [
                          el('label', { style: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#0369a1', marginBottom: '10px', textTransform: 'uppercase' } }, __('Evidence Checklist')),
                          el('ol', { style: { margin: 0, padding: 0, listStyle: 'none' } },
                            checklist.map((step, i) => el('li', { key: i, style: { fontSize: '12px', color: '#4b5563', display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' } }, [
                              el('input', { type: 'checkbox', style: { margin: '3px 0 0 0', width: '14px', height: '14px' } }),
                              el('span', null, step)
                            ]))
                          )
                        ]),

                        // Schema-defined Guide Controls
                        schemaGuideItems.length > 0 && el(GeneratedInterface, {
                          feature: { ...f, generated_schema: { ...schema, controls: schemaGuideItems } },
                          onUpdate: (data) => updateFeature(f.key, { implementation_data: data }),
                          isGuidePanel: true
                        })
                      ])
                    ]);
                  })(),

                  // Right Column: Verification & Assurance Block (Badges/Risk)
                  supportControls.length > 0 && el('div', { id: 'vaptw-preview-card-assurance', style: { ...boxStyle, background: '#f0fdf4', borderColor: '#bbf7d0', margin: 0 } }, [
                    el('h5', { style: { margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Verification & Assurance')),
                    el(GeneratedInterface, { feature: { ...f, generated_schema: { ...schema, controls: supportControls } }, onUpdate: (data) => updateFeature(f.key, { implementation_data: data }) })
                  ])
                ])
              ])
            ]);
          })()
        ]),
        el(CardFooter, { style: { borderTop: '1px solid #f3f4f6', padding: '12px 24px', background: '#fafafa' } }, [
          el('span', { style: { fontSize: '11px', color: '#9ca3af' } }, sprintf(__('Feature Reference: %s', 'vapt-Copilot'), f.key))
        ])
      ]);
    };

    if (loading) return el('div', { className: 'vaptm-loading' }, [el(Spinner), el('p', null, __('Loading Workbench...', 'vapt-Copilot'))]);
    if (error) return el(Notice, { status: 'error', isDismissible: false }, error);

    return el('div', { className: 'vaptm-workbench-root', style: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f9fafb', position: 'relative' } }, [

      // Toast Notification
      saveStatus && el('div', {
        style: {
          position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)',
          background: saveStatus.type === 'error' ? '#fde8e8' : (saveStatus.type === 'success' ? '#def7ec' : '#e0f2fe'),
          color: saveStatus.type === 'error' ? '#9b1c1c' : (saveStatus.type === 'success' ? '#03543f' : '#0369a1'),
          padding: '8px 16px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 9999, fontWeight: '600', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px',
          border: '1px solid rgba(0,0,0,0.05)'
        }
      }, [
        el(Icon, { icon: saveStatus.type === 'error' ? 'warning' : (saveStatus.type === 'success' ? 'yes' : 'update'), size: 16 }),
        saveStatus.message
      ]),

      // Top Navigation
      el('header', { style: { padding: '15px 30px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '15px' } }, [
          el('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'baseline', gap: '8px' } }, [
            __('VAPT Implementation Dashboard'),
            el('span', { style: { fontSize: '11px', color: '#9ca3af', fontWeight: '400' } }, `v${settings.pluginVersion}`)
          ]),
          el('span', { style: { fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' } }, isSuper ? __('Superadmin') : __('Standard')),
          el(Button, {
            icon: 'update',
            isSmall: true,
            isSecondary: true,
            onClick: () => fetchData(true),
            disabled: loading || isRefreshing,
            isBusy: isRefreshing,
            label: __('Refresh Data', 'vapt-Copilot')
          })
        ]),
        el('div', { style: { display: 'flex', gap: '5px', background: '#f3f4f6', padding: '4px', borderRadius: '8px' } },
          availableStatuses.map(s => el(Button, {
            key: s,
            onClick: () => setActiveStatus(s),
            style: {
              background: activeStatus === s ? '#fff' : 'transparent',
              color: activeStatus === s ? '#111827' : '#6b7280',
              border: 'none', borderRadius: '6px', padding: '8px 16px', fontWeight: 600, fontSize: '13px',
              boxShadow: activeStatus === s ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
            }
          }, STATUS_LABELS[s]))
        )
      ]),

      // Main Content Area
      el('div', { style: { display: 'flex', flexGrow: 1, overflow: 'visible' } }, [
        // Sidebar
        el('aside', { className: 'vaptm-workbench-sidebar', style: { width: '280px', borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto', overflowX: 'visible', padding: '20px 0' } }, [
          el('div', { style: { padding: '0 20px 10px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' } }, __('Feature Categories')),
          categories.length > 0 && el(Fragment, null, [
            el('button', {
              onClick: () => setActiveCategory('all'),
              className: 'vaptm-sidebar-link' + (activeCategory === 'all' ? ' is-active' : ''),
              style: {
                width: '100%', border: 'none', background: activeCategory === 'all' ? '#eff6ff' : 'transparent',
                color: activeCategory === 'all' ? '#1d4ed8' : '#4b5563',
                padding: '12px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                borderRight: activeCategory === 'all' ? '3px solid #1d4ed8' : 'none', fontWeight: activeCategory === 'all' ? 600 : 500,
                fontSize: '14px'
              }
            }, [
              el('span', null, __('All Categories', 'vapt-Copilot')),
              el('span', { style: { fontSize: '11px', background: activeCategory === 'all' ? '#dbeafe' : '#f3f4f6', padding: '2px 6px', borderRadius: '4px' } }, statusFeatures.length)
            ]),
            activeCategory === 'all' && el('div', {
              style: {
                display: 'flex', flexDirection: 'column', gap: '2px',
                padding: '5px 0', background: '#fcfcfd', borderBottom: '1px solid #e5e7eb'
              }
            }, statusFeatures.map(f => el('a', {
              key: f.key,
              onClick: (e) => { e.preventDefault(); scrollToFeature(f.key, 'all'); },
              className: 'vaptm-workbench-link',
              href: `#feature-${f.key}`,
              style: {
                fontSize: '13px', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap',
                overflow: 'hidden', textOverflow: 'ellipsis', padding: '8px 20px',
                transition: 'all 0.2s ease', position: 'relative', zIndex: 10,
                display: 'block', textDecoration: 'none'
              },
              title: f.label
            }, f.label)))
          ]),
          categories.length === 0 && el('p', { style: { padding: '20px', color: '#9ca3af', fontSize: '13px' } }, __('No active categories', 'vapt-Copilot')),
          categories.map(cat => {
            const catFeatures = statusFeatures.filter(f => (f.category || 'Uncategorized') === cat);
            const isActive = activeCategory === cat;
            return el(Fragment, { key: cat }, [
              el('button', {
                onClick: () => setActiveCategory(cat),
                className: 'vaptm-sidebar-link' + (isActive ? ' is-active' : ''),
                style: {
                  width: '100%', border: 'none', background: isActive ? '#eff6ff' : 'transparent',
                  color: isActive ? '#1d4ed8' : '#4b5563',
                  padding: '12px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                  borderRight: isActive ? '3px solid #1d4ed8' : 'none', fontWeight: isActive ? 600 : 500,
                  fontSize: '14px', position: 'relative'
                }
              }, [
                el('span', null, cat),
                el('span', { style: { fontSize: '11px', background: isActive ? '#dbeafe' : '#f3f4f6', padding: '2px 6px', borderRadius: '4px' } }, catFeatures.length)
              ]),
              isActive && el('div', {
                style: {
                  display: 'flex', flexDirection: 'column', gap: '2px',
                  padding: '5px 0', background: '#fcfcfd', borderBottom: '1px solid #e5e7eb'
                }
              }, catFeatures.map(f => el('a', {
                key: f.key,
                onClick: (e) => { e.preventDefault(); scrollToFeature(f.key, cat); },
                className: 'vaptm-workbench-link',
                href: `#feature-${f.key}`,
                style: {
                  fontSize: '13px', color: '#64748b', cursor: 'pointer', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis', padding: '8px 20px',
                  transition: 'all 0.2s ease', position: 'relative', zIndex: 10,
                  display: 'block', textDecoration: 'none'
                },
                title: f.label
              }, f.label)))
            ]);
          })
        ]),

        // Workspace
        el('main', { style: { flexGrow: 1, padding: '30px', overflowY: 'auto' } }, [
          displayFeatures.length === 0 ? el('div', { style: { textAlign: 'center', padding: '100px', color: '#9ca3af' } }, __('Select a category to view implementation controls.', 'vapt-Copilot')) :
            el('div', { style: { maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' } },
              activeCategory === 'all'
                ? categories.map(cat => {
                  const catFeats = statusFeatures.filter(f => (f.category || 'Uncategorized') === cat);
                  return el('section', { key: cat, style: { marginBottom: '20px' } }, [
                    el('h4', { style: { borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', marginBottom: '25px', color: '#374151', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' } }, cat),
                    el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } },
                      catFeats.map(f => renderFeatureCard(f))
                    )
                  ]);
                })
                : displayFeatures.map(f => renderFeatureCard(f))
            )
        ])
      ])
    ]);
  };

  const init = () => {
    const container = document.getElementById('vaptm-client-root');
    if (container) render(el(ClientDashboard), container);
  };
  if (document.readyState === 'complete') init(); else document.addEventListener('DOMContentLoaded', init);
})();
