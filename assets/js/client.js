// Client Dashboard Entry Point
// Phase 6 Implementation - IDE Workbench Redesign
(function () {
  if (typeof wp === 'undefined') return;

  const { render, useState, useEffect, useMemo, createElement: el } = wp.element || {};
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
      const saved = localStorage.getItem('vaptm_active_tab');
      return saved ? saved : (isSuper ? 'Develop' : 'Release');
    });
    const [activeCategory, setActiveCategory] = useState('all');
    const [saveStatus, setSaveStatus] = useState(null);

    useEffect(() => {
      localStorage.setItem('vaptm_active_tab', activeStatus);
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

      apiFetch({ path: 'vaptc/v1/features?scope=client' })
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
        const s = f.status ? f.status.toLowerCase() : '';
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

    // Helper to render a single feature card
    const renderFeatureCard = (f) => {
      return el(Card, { key: f.key, style: { borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: 'none' } }, [
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
            const schema = f.generated_schema || { controls: [] };
            const isVerifEngine = f.include_verification_engine;

            // Split Controls
            const implControls = schema.controls ? schema.controls.filter(c => c.type !== 'test_action') : [];
            const verifControls = schema.controls ? schema.controls.filter(c => c.type === 'test_action') : [];

            // Helper for box style
            const boxStyle = { padding: '20px', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', height: '100%' };

            return el('div', { style: { display: 'grid', gridTemplateColumns: isVerifEngine ? '1fr 1fr' : 'minmax(0, 1fr) 300px', gap: '30px' } }, [
              // Box 1: Implementation
              el('div', { style: boxStyle }, [
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

              // Box 2: Verification Engine OR Passive Sidebar
              isVerifEngine ? el('div', { style: boxStyle }, [
                el('h4', { style: { margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                  el(Icon, { icon: 'shield', size: 16 }),
                  __('Verification Engine', 'vapt-Copilot')
                ]),
                el('p', { style: { fontSize: '12px', color: '#64748b', marginBottom: '20px' } }, __('Interactive security verification controls.', 'vapt-Copilot')),

                verifControls.length > 0
                  ? el(GeneratedInterface, { feature: { ...f, generated_schema: { ...schema, controls: verifControls } }, onUpdate: (data) => updateFeature(f.key, { implementation_data: data }) })
                  : el('div', { style: { padding: '20px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' } }, 'No verification controls defined.')
              ]) : (f.include_test_method) ? el('aside', { style: { ...boxStyle, background: '#f8fafc', border: '1px solid #f1f5f9' } }, [
                f.include_test_method && f.test_method && el('div', { style: { marginBottom: '0' } }, [
                  el('label', { style: { display: 'block', fontSize: '11px', fontWeight: 700, color: '#92400e', textTransform: 'uppercase', marginBottom: '8px' } }, __('Test Protocol')),
                  el('div', { style: { fontSize: '12px', color: '#4b5563', lineHeight: '1.5', background: '#fff', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '6px' } }, f.test_method)
                ])
              ]) : el('div'),

              // Box 3: Full Width Manual Steps (if enabled)
              (f.include_verification && f.verification_steps && f.verification_steps.length > 0) && el('div', { style: { ...boxStyle, gridColumn: '1 / -1', marginTop: '0' } }, [
                el('h4', { style: { margin: '0 0 15px 0', fontSize: '14px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '8px' } }, [
                  el(Icon, { icon: 'clipboard', size: 16 }),
                  __('Manual Verification Checklist', 'vapt-Copilot')
                ]),
                el('ul', { style: { margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } },
                  f.verification_steps.map((step, i) => el('li', { key: i, style: { fontSize: '12px', color: '#4b5563', display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' } }, [
                    el('input', { type: 'checkbox' }),
                    el('span', null, step)
                  ]))
                )
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
      el('div', { style: { display: 'flex', flexGrow: 1, overflow: 'hidden' } }, [
        // Sidebar
        el('aside', { style: { width: '280px', borderRight: '1px solid #e5e7eb', background: '#fff', overflowY: 'auto', padding: '20px 0' } }, [
          el('div', { style: { padding: '0 20px 10px', fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' } }, __('Feature Categories')),
          categories.length > 0 && el('button', {
            onClick: () => setActiveCategory('all'),
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
          categories.length === 0 && el('p', { style: { padding: '20px', color: '#9ca3af', fontSize: '13px' } }, __('No active categories', 'vapt-Copilot')),
          categories.map(cat => {
            const count = statusFeatures.filter(f => (f.category || 'Uncategorized') === cat).length;
            return el('button', {
              key: cat,
              onClick: () => setActiveCategory(cat),
              style: {
                width: '100%', border: 'none', background: activeCategory === cat ? '#eff6ff' : 'transparent',
                color: activeCategory === cat ? '#1d4ed8' : '#4b5563',
                padding: '12px 20px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
                borderRight: activeCategory === cat ? '3px solid #1d4ed8' : 'none', fontWeight: activeCategory === cat ? 600 : 500,
                fontSize: '14px'
              }
            }, [
              el('span', null, cat),
              el('span', { style: { fontSize: '11px', background: activeCategory === cat ? '#dbeafe' : '#f3f4f6', padding: '2px 6px', borderRadius: '4px' } }, count)
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
