// Global check-in for diagnostics - ABSOLUTE TOP
window.vaptmScriptLoaded = true;

(function () {
  if (typeof wp === 'undefined') {
    console.error('VAPT Copilot: "wp" global is missing!');
    return;
  }

  const { render, useState, useEffect, useMemo, Fragment, createElement: el } = wp.element || {};
  const {
    TabPanel, Panel, PanelBody, PanelRow, Button, Dashicon,
    ToggleControl, SelectControl, Modal, TextControl, Spinner,
    Notice, Placeholder, Dropdown, CheckboxControl, BaseControl, Icon,
    TextareaControl, Card, CardHeader, CardBody
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
    console.error('VAPT Copilot: One or more WordPress dependencies are missing!');
    return;
  }

  // Shared Modal Components
  const VAPTM_AlertModal = ({ isOpen, message, onClose, type = 'error' }) => {
    if (!isOpen) return null;
    return el(Modal, {
      title: type === 'error' ? __('Error', 'vapt-Copilot') : __('Notice', 'vapt-Copilot'),
      onRequestClose: onClose,
      style: { maxWidth: '400px' },
      className: 'vaptm-alert-modal'
    }, [
      el('div', { style: { display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' } }, [
        el(Icon, {
          icon: type === 'error' ? 'warning' : 'info',
          size: 32,
          style: {
            color: type === 'error' ? '#dc2626' : '#2563eb',
            background: type === 'error' ? '#fef2f2' : '#eff6ff',
            padding: '8px',
            borderRadius: '50%',
            flexShrink: 0
          }
        }),
        el('div', { style: { paddingTop: '4px' } }, [
          el('h3', { style: { margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 } }, type === 'error' ? 'Action Failed' : 'Notice'),
          el('p', { style: { margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5' } }, message)
        ])
      ]),
      el('div', { style: { textAlign: 'right', borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '10px' } },
        el(Button, { isPrimary: true, onClick: onClose }, __('OK', 'vapt-Copilot'))
      )
    ]);
  };

  const VAPTM_ConfirmModal = ({ isOpen, message, onConfirm, onCancel, confirmLabel = __('Yes', 'vapt-Copilot'), isDestructive = false }) => {
    if (!isOpen) return null;
    return el(Modal, {
      title: __('Confirmation', 'vapt-Copilot'),
      onRequestClose: onCancel,
      className: 'vaptm-modal vaptm-confirm-modal'
    }, [
      el('div', { className: 'vaptm-modal-body' }, [
        el('div', { style: { display: 'flex', gap: '15px', alignItems: 'flex-start', marginBottom: '20px' } }, [
          el(Icon, {
            icon: 'warning',
            size: 32,
            style: {
              color: '#d97706',
              background: '#fffbeb',
              padding: '8px',
              borderRadius: '50%',
              flexShrink: 0
            }
          }),
          el('div', { style: { paddingTop: '4px' } }, [
            el('h3', { style: { margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 } }, __('Are you sure?', 'vapt-Copilot')),
            el('p', { style: { margin: 0, fontSize: '14px', color: '#4b5563', lineHeight: '1.5', whiteSpace: 'pre-line' } }, message)
          ])
        ])
      ]),
      el('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e5e7eb', paddingTop: '15px', marginTop: '10px' } }, [
        el(Button, { isSecondary: true, onClick: onCancel }, __('Cancel', 'vapt-Copilot')),
        el(Button, { isDestructive: isDestructive, isPrimary: !isDestructive, onClick: onConfirm }, confirmLabel)
      ])
    ]);
  };

  const DomainFeatures = ({ domains = [], features = [], isDomainModalOpen, selectedDomain, setDomainModalOpen, setSelectedDomain, updateDomainFeatures, addDomain, deleteDomain, batchDeleteDomains, setConfirmState, selectedDomains = [], setSelectedDomains }) => {
    const [newDomain, setNewDomain] = useState('');
    const [isWildcardNew, setIsWildcardNew] = useState(false);
    const [activeCategory, setActiveCategory] = useState('all');
    const [statusFilters, setStatusFilters] = useState(['release']);
    const [sortConfig, setSortConfig] = useState({ key: 'domain', direction: 'asc' });
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [editDomainData, setEditDomainData] = useState({ id: '', domain: '', is_wildcard: false, is_enabled: true });
    const [viewFeaturesModalOpen, setViewFeaturesModalOpen] = useState(false);
    const [viewFeaturesModalDomain, setViewFeaturesModalDomain] = useState(null);

    const toggleDomainSelection = (id) => {
      const current = selectedDomains || [];
      if (current.includes(id)) {
        setSelectedDomains(current.filter(i => i !== id));
      } else {
        setSelectedDomains([...current, id]);
      }
    };

    const sortedDomains = useMemo(() => {
      const sortable = [...(domains || [])];
      if (sortConfig.key !== null) {
        sortable.sort((a, b) => {
          let valA = a[sortConfig.key];
          let valB = b[sortConfig.key];

          // Special handling for domain types (Wildcard vs Standard)
          if (sortConfig.key === 'is_wildcard') {
            valA = (valA === '1' || valA === true || valA === 1) ? 1 : 0;
            valB = (valB === '1' || valB === true || valB === 1) ? 1 : 0;
          }

          if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
          if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
          return 0;
        });
      }
      return sortable;
    }, [domains, sortConfig]);

    const requestSort = (key) => {
      let direction = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    };

    const SortIndicator = ({ column }) => {
      if (sortConfig.key !== column) return el(Dashicon, { icon: 'sort', size: 14, style: { opacity: 0.3, marginLeft: '5px' } });
      return el(Dashicon, {
        icon: sortConfig.direction === 'asc' ? 'arrow-up-alt2' : 'arrow-down-alt2',
        size: 14,
        style: { marginLeft: '5px', color: '#2271b1' }
      });
    };

    const filteredByStatus = useMemo(() => {
      return (features || []).filter(f => {
        const s = f.status ? f.status.toLowerCase() : '';
        const normalized = (s === 'implemented') ? 'release' : s;
        return (statusFilters || []).includes(normalized);
      });
    }, [features, statusFilters]);

    const categories = useMemo(() => {
      const cats = [...new Set(filteredByStatus.map(f => f.category || 'Uncategorized'))].sort();
      return cats;
    }, [filteredByStatus]);

    const displayFeatures = useMemo(() => {
      const filtered = filteredByStatus || [];
      if (activeCategory === 'all') return filtered;
      return filtered.filter(f => (f.category || 'Uncategorized') === activeCategory);
    }, [filteredByStatus, activeCategory]);

    const featuresByCategory = useMemo(() => {
      const grouped = {};
      (displayFeatures || []).forEach(f => {
        const cat = f.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(f);
      });
      // Sort categories to ensure consistent order
      const sortedResult = {};
      Object.keys(grouped).sort().forEach(key => {
        sortedResult[key] = grouped[key];
      });
      return sortedResult;
    }, [displayFeatures]);

    return el(PanelBody, { title: __('Domain Specific Features', 'vapt-Copilot'), initialOpen: true }, [
      el('div', { key: 'add-domain-header', style: { padding: '0 0 10px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Add New Domain')),
      el('div', {
        key: 'add-domain-row',
        style: {
          marginBottom: '20px',
          display: 'flex',
          gap: '15px',
          alignItems: 'center',
          background: '#f8fafc',
          padding: '15px',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }
      }, [
        el('div', { style: { flex: 1 } }, [
          el(TextControl, {
            label: __('Domain Name', 'vapt-Copilot'),
            value: newDomain,
            onChange: (val) => setNewDomain(val),
            placeholder: 'example.com',
            __nextHasNoMarginBottom: true
          })
        ]),
        el('div', { style: { minWidth: '150px' } }, [
          el(SelectControl, {
            label: __('Type', 'vapt-Copilot'),
            value: isWildcardNew ? 'wildcard' : 'standard',
            options: [
              { label: __('Standard', 'vapt-Copilot'), value: 'standard' },
              { label: __('Wildcard (*.domain)', 'vapt-Copilot'), value: 'wildcard' }
            ],
            onChange: (val) => setIsWildcardNew(val === 'wildcard'),
            __nextHasNoMarginBottom: true
          })
        ]),
        el(Button, {
          isPrimary: true,
          onClick: () => {
            const domain = (newDomain || '').trim();
            if (!domain) return;
            console.log('Adding domain:', domain, 'isWildcard:', isWildcardNew);
            addDomain(domain, isWildcardNew);
            setNewDomain('');
            setIsWildcardNew(false);
          },
          style: { alignSelf: 'flex-end', height: '32px' }
        }, __('Add Domain', 'vapt-Copilot')),
        (selectedDomains || []).length > 0 && el(Button, {
          isDestructive: true,
          onClick: () => {
            const count = (selectedDomains || []).length;
            setConfirmState({
              message: sprintf(__('Are you sure you want to delete %d selected domains?', 'vapt-Copilot'), count),
              onConfirm: () => {
                batchDeleteDomains(selectedDomains);
                setConfirmState(null);
              },
              isDestructive: true
            });
          },
          style: { alignSelf: 'flex-end', height: '32px', marginLeft: 'auto' }
        }, __('Delete Selected', 'vapt-Copilot'))
      ]),
      el('table', { key: 'table', className: 'wp-list-table widefat fixed striped' }, [
        el('thead', null, el('tr', null, [
          el('th', { style: { width: '40px' } }, el('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
            el(CheckboxControl, {
              checked: (domains || []).length > 0 && (selectedDomains || []).length === (domains || []).length,
              indeterminate: (selectedDomains || []).length > 0 && (selectedDomains || []).length < (domains || []).length,
              onChange: (val) => setSelectedDomains(val ? (domains || []).map(d => d.id) : []),
              __nextHasNoMarginBottom: true
            }),
            el('span', { style: { fontSize: '10px', opacity: 0.6, fontWeight: 600, whiteSpace: 'nowrap' } }, __('ALL', 'vapt-Copilot'))
          ])),
          el('th', {
            style: { cursor: 'pointer', userSelect: 'none' },
            onClick: () => requestSort('domain')
          }, [
            __('Domain', 'vapt-Copilot'),
            el(SortIndicator, { column: 'domain' })
          ]),
          el('th', { style: { width: '100px' } }, __('Status', 'vapt-Copilot')),
          el('th', {
            style: { width: '180px', cursor: 'pointer', userSelect: 'none' },
            onClick: () => requestSort('is_wildcard')
          }, [
            __('Type', 'vapt-Copilot'),
            el(SortIndicator, { column: 'is_wildcard' })
          ]),
          el('th', null, __('Features Enabled', 'vapt-Copilot')),
          el('th', { style: { width: '220px' } }, __('Actions', 'vapt-Copilot'))
        ])),
        el('tbody', null, sortedDomains.map((d) => el('tr', { key: d.id }, [
          el('td', null, el(CheckboxControl, {
            checked: (selectedDomains || []).includes(d.id),
            onChange: () => toggleDomainSelection(d.id),
            __nextHasNoMarginBottom: true
          })),
          el('td', null, el('strong', null, d.domain)),
          el('td', null, el(Button, {
            isLink: true,
            onClick: () => {
              const currentEnabled = !(d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0);
              addDomain(d.domain, (d.is_wildcard === '1' || d.is_wildcard === true || d.is_wildcard === 1), !currentEnabled, d.id);
            },
            style: { color: (d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0) ? '#d63638' : '#00a32a', fontWeight: 600, textDecoration: 'none' },
            title: __('Click to toggle domain status', 'vapt-Copilot')
          }, [
            el(Dashicon, { icon: (d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0) ? 'hidden' : 'visibility', size: 16, style: { marginRight: '4px' } }),
            (d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0) ? __('Disabled', 'vapt-Copilot') : __('Active', 'vapt-Copilot')
          ])),
          el('td', null, el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
            el(Button, {
              isLink: true,
              onClick: (e) => {
                e.preventDefault();
                const currentWildcard = (d.is_wildcard === '1' || d.is_wildcard === true || d.is_wildcard === 1);
                const nextWildcard = !currentWildcard;
                addDomain(d.domain, nextWildcard, !(d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0), d.id);
              },
              style: { textDecoration: 'none', color: (d.is_wildcard === '1' || d.is_wildcard === true || d.is_wildcard === 1) ? '#2271b1' : '#64748b', fontWeight: 600 },
              title: __('Click to toggle domain type', 'vapt-Copilot')
            }, (d.is_wildcard === '1' || d.is_wildcard === true || d.is_wildcard === 1) ? __('Wildcard', 'vapt-Copilot') : __('Standard', 'vapt-Copilot')),
            el(Dashicon, { icon: 'update', size: 14, style: { opacity: 0.5 } })
          ])),
          el('td', null, (Array.isArray(d.features) && d.features.length > 0) ? el(Button, {
            isLink: true,
            onClick: (e) => {
              e.preventDefault();
              setViewFeaturesModalDomain(d);
              setViewFeaturesModalOpen(true);
            }
          }, `${d.features.length} ${__('Features', 'vapt-Copilot')}`) : `${(Array.isArray(d.features) ? d.features.length : 0)} ${__('Features', 'vapt-Copilot')}`),
          el('td', null, el('div', { style: { display: 'flex', gap: '8px' } }, [
            el(Button, {
              isSecondary: true,
              isSmall: true,
              onClick: () => {
                setEditDomainData({
                  id: d.id,
                  domain: d.domain,
                  is_wildcard: (d.is_wildcard === '1' || d.is_wildcard === true || d.is_wildcard === 1),
                  is_enabled: !(d.is_enabled === '0' || d.is_enabled === false || d.is_enabled === 0)
                });
                setEditModalOpen(true);
              }
            }, __('Edit', 'vapt-Copilot')),
            el(Button, {
              isSecondary: true,
              isSmall: true,
              onClick: () => { setSelectedDomain(d); setDomainModalOpen(true); }
            }, __('Manage Features', 'vapt-Copilot')),
            el(Button, {
              isDestructive: true,
              isSmall: true,
              onClick: () => {
                setConfirmState({
                  message: sprintf(__('Are you sure you want to delete the domain "%s"? This action cannot be undone.', 'vapt-Copilot'), d.domain),
                  onConfirm: () => {
                    deleteDomain(d.id);
                    setConfirmState(null);
                  },
                  isDestructive: true
                });
              }
            }, __('Delete', 'vapt-Copilot'))
          ]))
        ])))
      ]),

      // Edit Domain Modal
      isEditModalOpen && el(Modal, {
        title: __('Edit Domain Settings', 'vapt-Copilot'),
        onRequestClose: () => setEditModalOpen(false),
        style: { maxWidth: '500px' }
      }, [
        el('div', { style: { padding: '10px 0' } }, [
          el(TextControl, {
            label: __('Domain Name', 'vapt-Copilot'),
            value: editDomainData.domain,
            onChange: (val) => setEditDomainData({ ...editDomainData, domain: val })
          }),
          el(SelectControl, {
            label: __('Type', 'vapt-Copilot'),
            value: editDomainData.is_wildcard ? 'wildcard' : 'standard',
            options: [
              { label: __('Standard', 'vapt-Copilot'), value: 'standard' },
              { label: __('Wildcard (*.domain)', 'vapt-Copilot'), value: 'wildcard' }
            ],
            onChange: (val) => setEditDomainData({ ...editDomainData, is_wildcard: val === 'wildcard' })
          }),
          el(ToggleControl, {
            label: __('Enabled', 'vapt-Copilot'),
            checked: editDomainData.is_enabled,
            onChange: (val) => setEditDomainData({ ...editDomainData, is_enabled: val }),
            help: __('Enable or disable all VAPT features for this domain.', 'vapt-Copilot')
          }),
          el('div', { style: { marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' } }, [
            el(Button, { isSecondary: true, onClick: () => setEditModalOpen(false) }, __('Cancel', 'vapt-Copilot')),
            el(Button, {
              isPrimary: true,
              onClick: () => {
                addDomain(editDomainData.domain, editDomainData.is_wildcard, editDomainData.is_enabled, editDomainData.id);
                setEditModalOpen(false);
              }
            }, __('Update Domain', 'vapt-Copilot'))
          ])
        ])
      ]),
      isDomainModalOpen && selectedDomain && el(Modal, {
        key: 'modal',
        title: sprintf(__('Features for %s', 'vapt-Copilot'), selectedDomain.domain),
        onRequestClose: () => setDomainModalOpen(false),
        className: 'vaptm-domain-features-modal',
        style: { maxWidth: '1400px', width: '90%' }
      }, [
        // Status Visibility Filters (Superadmin Only)
        isSuper && el('div', {
          style: {
            marginBottom: '20px',
            padding: '12px 20px',
            background: '#f8fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }
        }, [
          el('span', { style: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' } }, __('Status Visibility:')),
          el(Button, {
            isPrimary: (statusFilters || []).length !== 3,
            variant: (statusFilters || []).length === 3 ? 'secondary' : 'primary',
            onClick: () => {
              if ((statusFilters || []).length === 3) setStatusFilters([]);
              else setStatusFilters(['develop', 'test', 'release']);
            },
            style: {
              fontWeight: 700,
              padding: '8px 20px',
              height: 'auto',
              boxShadow: (statusFilters || []).length !== 3 ? '0 2px 4px rgba(34, 113, 177, 0.2)' : 'none'
            }
          }, (statusFilters || []).length === 3 ? __('Clear All Filters', 'vapt-Copilot') : __('Select All Statuses', 'vapt-Copilot')),
          el('div', { style: { display: 'flex', gap: '15px', paddingLeft: '20px', borderLeft: '2px solid #e2e8f0' } }, [
            { label: __('Develop', 'vapt-Copilot'), value: 'develop' },
            { label: __('Test', 'vapt-Copilot'), value: 'test' },
            { label: __('Release', 'vapt-Copilot'), value: 'release' }
          ].filter(o => o.value).map(opt => el(CheckboxControl, {
            key: opt.value,
            label: opt.label,
            checked: statusFilters.includes(opt.value),
            onChange: (val) => {
              if (val) setStatusFilters([...statusFilters, opt.value]);
              else if ((statusFilters || []).length > 1) setStatusFilters(statusFilters.filter(v => v !== opt.value));
            },
            __nextHasNoMarginBottom: true
          })))
        ]),

        el('div', { style: { display: 'flex', gap: '0', height: '60vh', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' } }, [
          // Left Sidebar: Categories
          el('aside', {
            style: {
              width: '240px',
              flexShrink: 0,
              background: '#fcfcfd',
              borderRight: '1px solid #e2e8f0',
              padding: '20px 0',
              overflowY: 'auto'
            }
          }, [
            el('div', { style: { padding: '0 20px 10px', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Feature Categories')),
            el('div', { style: { display: 'flex', flexDirection: 'column' } }, [
              // All Categories Link
              el('a', {
                href: '#',
                onClick: (e) => { e.preventDefault(); setActiveCategory('all'); },
                className: 'vaptm-sidebar-link' + (activeCategory === 'all' ? ' is-active' : ''),
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 20px',
                  textDecoration: 'none',
                  color: activeCategory === 'all' ? '#2271b1' : '#64748b',
                  background: activeCategory === 'all' ? '#eff6ff' : 'transparent',
                  fontWeight: activeCategory === 'all' ? 600 : 500,
                  fontSize: '13px',
                  borderRight: activeCategory === 'all' ? '3px solid #2271b1' : 'none'
                }
              }, [
                el('span', null, __('All Categories', 'vapt-Copilot')),
                el('span', { style: { fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: activeCategory === 'all' ? '#dbeafe' : '#f1f5f9' } }, (Array.isArray(filteredByStatus) ? filteredByStatus : []).length)
              ]),
              // Category Links
              ...categories.map(cat => {
                const count = (Array.isArray(filteredByStatus) ? filteredByStatus : []).filter(f => (f.category || 'Uncategorized') === cat).length;
                const isActive = activeCategory === cat;
                return el('a', {
                  key: cat,
                  href: '#',
                  onClick: (e) => { e.preventDefault(); setActiveCategory(cat); },
                  className: 'vaptm-sidebar-link' + (isActive ? ' is-active' : ''),
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 20px',
                    textDecoration: 'none',
                    color: isActive ? '#2271b1' : '#64748b',
                    background: isActive ? '#eff6ff' : 'transparent',
                    fontWeight: isActive ? 600 : 500,
                    fontSize: '13px',
                    borderRight: isActive ? '3px solid #2271b1' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'visible'
                  }
                }, [
                  el('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis' } }, cat),
                  el('span', { style: { fontSize: '10px', padding: '2px 6px', borderRadius: '10px', background: isActive ? '#dbeafe' : '#f1f5f9', marginLeft: '8px', flexShrink: 0 } }, count)
                ]);
              })
            ])
          ]),

          // Main Content: Feature Cards
          el('div', {
            style: {
              flexGrow: 1,
              padding: '25px',
              background: '#fff',
              overflowY: 'auto'
            }
          }, [
            ((Array.isArray(displayFeatures) ? displayFeatures : []).length === 0) ? el('div', { style: { textAlign: 'center', padding: '40px', color: '#94a3b8' } }, __('No features matching the current selection.', 'vapt-Copilot')) :
              Object.entries(featuresByCategory).map(([catName, catFeatures]) => el(Fragment, { key: catName }, [
                el('h3', { className: 'vaptm-category-header' }, [
                  el(Dashicon, { icon: 'category', size: 16 }),
                  catName
                ]),
                el('div', { className: 'vaptm-feature-grid' }, catFeatures.map(f => el('div', {
                  key: f.key,
                  className: 'vaptm-domain-feature-card',
                  style: {
                    padding: '20px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }
                }, [
                  el('div', { style: { marginBottom: '20px' } }, [
                    el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' } }, [
                      el('h4', { style: { margin: 0, fontSize: '16px', fontWeight: 700, color: '#1e293b' } }, f.label),
                      el('span', {
                        className: `vaptm-status-pill status-${(f.status || '').toLowerCase()}`,
                        style: {
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: (f.status === 'Develop' || f.status === 'develop') ? '#fee2e2' :
                            (f.status === 'Test' || f.status === 'test') ? '#dbeafe' :
                              (f.status === 'Release' || f.status === 'release' || f.status === 'implemented') ? '#dcfce7' : '#f1f5f9',
                          color: (f.status === 'Develop' || f.status === 'develop') ? '#b91c1c' :
                            (f.status === 'Test' || f.status === 'test') ? '#1d4ed8' :
                              (f.status === 'Release' || f.status === 'release' || f.status === 'implemented') ? '#15803d' : '#64748b',
                          border: '1px solid currentColor',
                          borderOpacity: 0.1
                        }
                      }, f.status)
                    ]),
                    el('p', { style: { margin: 0, fontSize: '13px', color: '#64748b', lineHeight: '1.5' } }, f.description)
                  ]),
                  el('div', {
                    style: {
                      marginTop: 'auto',
                      paddingTop: '15px',
                      borderTop: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }
                  }, [
                    el('span', { style: { fontSize: '12px', fontWeight: 600, color: '#475569' } }, (Array.isArray(selectedDomain.features) ? selectedDomain.features : []).includes(f.key) ? __('Active', 'vapt-Copilot') : __('Disabled', 'vapt-Copilot')),
                    el(ToggleControl, {
                      checked: (Array.isArray(selectedDomain.features) ? selectedDomain.features : []).includes(f.key),
                      onChange: (val) => {
                        const newFeats = val
                          ? [...(Array.isArray(selectedDomain.features) ? selectedDomain.features : []), f.key]
                          : (Array.isArray(selectedDomain.features) ? selectedDomain.features : []).filter(k => k !== f.key);
                        updateDomainFeatures(selectedDomain.id, newFeats);
                        setSelectedDomain({ ...selectedDomain, features: newFeats });
                      },
                      __nextHasNoMarginBottom: true,
                      style: { margin: 0 }
                    })
                  ])
                ])))
              ]))
          ])
        ]),
        el('div', { style: { marginTop: '20px', textAlign: 'right' } }, el(Button, {
          isPrimary: true,
          onClick: () => setDomainModalOpen(false)
        }, __('Done', 'vapt-Copilot')))
      ]),
      // View Features Modal
      viewFeaturesModalOpen && viewFeaturesModalDomain && el(Modal, {
        title: sprintf(__('Enabled Features for %s', 'vapt-Copilot'), viewFeaturesModalDomain.domain),
        onRequestClose: () => setViewFeaturesModalOpen(false),
        style: { maxWidth: '1200px', width: '90%' }
      }, [
        el('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            padding: '20px',
            maxHeight: '70vh',
            overflowY: 'auto'
          }
        },
          (features || []).filter(f => (Array.isArray(viewFeaturesModalDomain.features) ? viewFeaturesModalDomain.features : []).includes(f.key)).map(f =>
            el(Card, {
              key: f.key,
              style: { border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: 'sm' }
            }, [
              el(CardHeader, {
                style: {
                  background: '#f8fafc',
                  borderBottom: '1px solid #e2e8f0',
                  padding: '12px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '5px'
                }
              }, [
                el('span', {
                  style: {
                    fontSize: '9px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: '#e2e8f0',
                    color: '#475569'
                  }
                }, f.category || 'General'),
                el('strong', { style: { fontSize: '13px', color: '#1e293b' } }, f.label)
              ]),
              el(CardBody, { style: { padding: '16px' } }, [
                el('div', { style: { marginBottom: '10px' } }, [
                  el('span', {
                    style: {
                      display: 'inline-block',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: (f.status === 'Develop' || f.status === 'develop') ? '#fee2e2' :
                        (f.status === 'Test' || f.status === 'test') ? '#dbeafe' :
                          (f.status === 'Release' || f.status === 'release' || f.status === 'implemented') ? '#dcfce7' : '#f1f5f9',
                      color: (f.status === 'Develop' || f.status === 'develop') ? '#b91c1c' :
                        (f.status === 'Test' || f.status === 'test') ? '#1d4ed8' :
                          (f.status === 'Release' || f.status === 'release' || f.status === 'implemented') ? '#15803d' : '#64748b'
                    }
                  }, f.status || 'Unknown')
                ]),
                el('p', { style: { fontSize: '12px', color: '#64748b', margin: 0, lineHeight: '1.5' } }, f.description)
              ])
            ])
          )
        ),
        el('div', { style: { marginTop: '20px', textAlign: 'right', borderTop: '1px solid #e2e8f0', paddingTop: '15px' } },
          el(Button, { isPrimary: true, onClick: () => setViewFeaturesModalOpen(false) }, __('Close', 'vapt-Copilot'))
        )
      ])
    ]);
  };

  const BuildGenerator = ({ domains, features, setAlertState }) => {
    const [buildDomain, setBuildDomain] = useState('');
    const [buildVersion, setBuildVersion] = useState('2.4.3');
    const [includeConfig, setIncludeConfig] = useState(true);
    const [whiteLabel, setWhiteLabel] = useState({
      name: 'VAPT Security',
      description: '',
      author: 'Tanveer Malik',
      plugin_uri: 'https://vapt.copilot',
      author_uri: 'https://tanveermalik.com',
      text_domain: 'vapt-security'
    });
    const [generating, setGenerating] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [importedAt, setImportedAt] = useState(null);

    // Auto-Generation Effect
    useEffect(() => {
      const slug = whiteLabel.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      // Calculate enabled features
      const selectedDomain = (Array.isArray(domains) ? domains : []).find(d => d.domain === buildDomain);
      const feats = selectedDomain ? (Array.isArray(selectedDomain.features) ? selectedDomain.features : []) : [];
      const featCount = feats.length;

      const desc = `VAPT Security Build for ${buildDomain || 'Client Scope'}.\n` +
        `Includes ${featCount} active security modules providing defense against OWASP Top 10 threats.\n` +
        `Generated by VAPT Copilot.`;

      setWhiteLabel(prev => ({
        ...prev,
        text_domain: slug,
        description: desc
      }));

      // Sync Imported At
      if (selectedDomain && selectedDomain.imported_at) {
        setImportedAt(selectedDomain.imported_at);
      } else {
        setImportedAt(null);
      }
    }, [whiteLabel.name, buildDomain, domains]);

    const runBuild = (type = 'full_build') => {
      if (!buildDomain && type !== 'config_only') {
        setAlertState({ message: __('Please select a target domain.', 'vapt-Copilot'), type: 'error' });
        return;
      }
      setGenerating(true);
      setDownloadUrl(null);
      const selectedDomain = (Array.isArray(domains) ? domains : []).find(d => d.domain === buildDomain);
      const buildFeatures = selectedDomain ? (Array.isArray(selectedDomain.features) ? selectedDomain.features : []) : (Array.isArray(features) ? features : []).filter(f => f.status === 'implemented').map(f => f.key);

      apiFetch({
        path: 'vaptc/v1/build/generate',
        method: 'POST',
        data: {
          domain: buildDomain.trim(),
          version: buildVersion.trim(),
          features: buildFeatures,
          generate_type: type,
          include_config: includeConfig,
          white_label: {
            name: whiteLabel.name.trim(),
            description: whiteLabel.description.trim(),
            author: whiteLabel.author.trim(),
            plugin_uri: whiteLabel.plugin_uri.trim(),
            author_uri: whiteLabel.author_uri.trim(),
            text_domain: whiteLabel.text_domain.trim()
          }
        }
      }).then((res) => {
        if (res && res.download_url) {
          window.location.href = res.download_url;
          setAlertState({ message: __('Build generated and downloading!', 'vapt-Copilot'), type: 'success' });
        } else {
          setAlertState({ message: __('Build failed: No download URL received.', 'vapt-Copilot'), type: 'error' });
        }
        setGenerating(false);
      }).catch((error) => {
        setGenerating(false);
        setAlertState({ message: __('Build failed! ' + (error.message || ''), 'vapt-Copilot'), type: 'error' });
      });
    };

    const saveToServer = () => {
      if (!buildDomain) {
        setAlertState({ message: __('Please select a target domain.', 'vapt-Copilot'), type: 'error' });
        return;
      }
      setGenerating(true);
      const selectedDomain = (Array.isArray(domains) ? domains : []).find(d => d.domain === buildDomain);
      const buildFeatures = selectedDomain ? (Array.isArray(selectedDomain.features) ? selectedDomain.features : []) : [];

      apiFetch({
        path: 'vaptc/v1/build/save-config',
        method: 'POST',
        data: {
          domain: buildDomain.trim(),
          version: buildVersion.trim(),
          features: buildFeatures
        }
      }).then(res => {
        if (res.success) {
          setAlertState({ message: __('Config saved to server successfully!', 'vapt-Copilot'), type: 'success' });
        } else {
          setAlertState({ message: __('Failed to save config.', 'vapt-Copilot'), type: 'error' });
        }
        setGenerating(false);
      }).catch(err => {
        setGenerating(false);
        setAlertState({ message: 'Save failed: ' + err.message, type: 'error' });
      });
    };

    const forceReImport = () => {
      if (!buildDomain) return;
      setGenerating(true);
      apiFetch({
        path: 'vaptc/v1/build/sync-config',
        method: 'POST',
        data: { domain: buildDomain }
      }).then(res => {
        if (res.success) {
          setImportedAt(res.imported_at);
          setAlertState({ message: `Config Re-Imported! Found ${res.features_count} features.`, type: 'success' });
        } else {
          setAlertState({ message: 'Import Failed: ' + (res.error || 'Unknown'), type: 'warning' });
        }
        setGenerating(false);
      }).catch(err => {
        setGenerating(false);
        setAlertState({ message: 'Import Error: ' + err.message, type: 'error' });
      });
    }

    // Helper for Horizontal Labels
    const FieldRow = ({ label, children }) => el('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } }, [
      el('label', { style: { width: '85px', fontSize: '12px', fontWeight: '500', color: '#64748b', flexShrink: 0 } }, label),
      el('div', { style: { flex: 1 } }, children)
    ]);

    return el('div', { className: 'vaptm-build-generator' }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '25px', marginTop: '30px' } }, [
        el(Icon, { icon: 'hammer', size: 24 }),
        el('h2', { style: { margin: 0, fontSize: '20px' } }, __('Generate New Build', 'vapt-Copilot'))
      ]),
      // 60/40 Layout
      el('div', { style: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '25px', alignItems: 'start' } }, [

        // LEFT COLUMN: Configuration
        el(Card, { style: { display: 'flex', flexDirection: 'column', borderRadius: '8px', border: '1px solid #e2e8f0', height: '100%' } }, [
          el(CardHeader, { style: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' } }, [
            el('h3', { style: { margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
              el(Icon, { icon: 'admin-settings', size: 16 }),
              __('Configuration Details', 'vapt-Copilot')
            ])
          ]),
          el(CardBody, { style: { padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', flex: 1 } }, [
            // Domain & Config Toggle (Side-by-Side)
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px' } }, [
              el('div', { style: { flex: 1, display: 'flex', alignItems: 'center' } }, [
                el('label', { style: { width: '85px', fontSize: '12px', fontWeight: '500', color: '#64748b', flexShrink: 0 } }, __('Target Domain', 'vapt-Copilot')),
                el('div', { style: { flex: 1 } },
                  el(SelectControl, {
                    value: buildDomain,
                    options: [
                      { label: __('--- Select Target Domain ---', 'vapt-Copilot'), value: '' },
                      ...(Array.isArray(domains) ? domains : []).filter(d => d.status !== 'inactive').map(d => ({ label: d.domain, value: d.domain }))
                    ],
                    onChange: (val) => setBuildDomain(val),
                    style: { marginBottom: 0 }
                  })
                )
              ]),
              el(ToggleControl, {
                label: __('Include Config', 'vapt-Copilot'),
                checked: includeConfig,
                onChange: (val) => setIncludeConfig(val),
                help: null,
                style: { marginBottom: 0 }
              })
            ]),

            // Horizontal Fields in 2-Col Grid
            el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', background: '#eef2f6', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0' } }, [
              // Col 1
              el('div', null, [
                el(FieldRow, { label: __('Plugin Name', 'vapt-Copilot') },
                  el(TextControl, { value: whiteLabel.name, onChange: (val) => setWhiteLabel({ ...whiteLabel, name: val }), style: { marginBottom: 0 } })
                ),
                el(FieldRow, { label: __('Author', 'vapt-Copilot') },
                  el(TextControl, { value: whiteLabel.author, onChange: (val) => setWhiteLabel({ ...whiteLabel, author: val }), style: { marginBottom: 0 } })
                ),
                el(FieldRow, { label: __('Text Domain', 'vapt-Copilot') },
                  el(TextControl, { value: whiteLabel.text_domain, readOnly: true, style: { marginBottom: 0, background: '#f8fafc' } })
                ),
              ]),
              // Col 2
              el('div', null, [
                el(FieldRow, { label: __('Plugin URI', 'vapt-Copilot') },
                  el(TextControl, { value: whiteLabel.plugin_uri, onChange: (val) => setWhiteLabel({ ...whiteLabel, plugin_uri: val }), style: { marginBottom: 0 } })
                ),
                el(FieldRow, { label: __('Author URI', 'vapt-Copilot') },
                  el(TextControl, { value: whiteLabel.author_uri, onChange: (val) => setWhiteLabel({ ...whiteLabel, author_uri: val }), style: { marginBottom: 0 } })
                ),
                el(FieldRow, { label: __('Version', 'vapt-Copilot') },
                  el(TextControl, { value: buildVersion, onChange: (val) => setBuildVersion(val), style: { marginBottom: 0 } })
                ),
              ])
            ]),

            el('div', { style: { marginTop: '5px' } }, [
              el('label', { style: { display: 'block', fontSize: '12px', fontWeight: '500', color: '#64748b', marginBottom: '8px' } }, __('Plugin Description', 'vapt-Copilot')),
              el(TextareaControl, {
                value: whiteLabel.description,
                rows: 3,
                onChange: (val) => setWhiteLabel({ ...whiteLabel, description: val }),
                style: { marginBottom: '0', fontSize: '13px', lineHeight: '1.5' }
              })
            ]),

            el('div', { style: { display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid #eee' } }, [
              el(Button, {
                isSecondary: true,
                style: { flex: 1, justifyContent: 'center' },
                onClick: saveToServer,
                disabled: generating || !buildDomain
              }, [
                el(Icon, { icon: 'upload', size: 18, style: { marginRight: '5px' } }),
                __('Save to Server', 'vapt-Copilot')
              ]),
              el(Button, {
                isPrimary: true,
                style: { flex: 1, justifyContent: 'center', background: '#357abd' },
                onClick: () => runBuild('full_build'),
                disabled: generating || !buildDomain
              }, [
                el(Icon, { icon: 'download', size: 18, style: { marginRight: '5px' } }),
                generating ? __('Generating...', 'vapt-Copilot') : __('Download Build', 'vapt-Copilot')
              ])
            ])
          ])
        ]),

        // RIGHT COLUMN: Status (Equal Height)
        el(Card, { style: { borderRadius: '8px', border: '1px solid #e2e8f0', height: '100%', background: '#fff' } }, [
          // Content updated with better styling in next tool call or implicit here?
          // Using existing structure but ensuring it matches visual requirements
          el(CardHeader, { style: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 20px' } }, [
            el('h4', { style: { margin: 0, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' } }, [
              el(Icon, { icon: 'info-outline', size: 16 }),
              __('Build Status & History', 'vapt-Copilot')
            ])
          ]),
          el(CardBody, { style: { padding: '20px' } }, [
            // ... Content Logic
            el('div', { style: { fontSize: '13px', color: '#64748b', lineHeight: '1.8' } }, [
              el('div', { style: { marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' } }, [
                el('strong', null, __('Generated Version', 'vapt-Copilot')),
                el('span', { style: { fontFamily: 'monospace', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' } }, buildVersion)
              ]),
              el('div', { style: { marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' } }, [
                el('strong', null, __('Target Domain', 'vapt-Copilot')),
                el('code', { style: { color: '#0f172a' } }, buildDomain || 'None')
              ]),
              el('div', { style: { marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' } }, [
                el('strong', null, __('Active Features', 'vapt-Copilot')),
                el('span', { style: { fontWeight: '600', color: '#16a34a' } }, (() => {
                  const selectedDomain = domains.find(d => d.domain === buildDomain);
                  return selectedDomain ? (selectedDomain.features?.length || 0) : 0;
                })() + ' Modules')
              ]),
              el('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
                el('strong', null, __('Last Import', 'vapt-Copilot')),
                el('span', { style: { fontSize: '11px', fontStyle: 'italic' } }, importedAt || 'Never')
              ])
            ]),
            el(Button, {
              isSecondary: true,
              style: { width: '100%', marginTop: '20px' },
              onClick: forceReImport,
              disabled: generating || !buildDomain
            }, __('Force Re-import from Server', 'vapt-Copilot')),
            el('p', { style: { fontSize: '11px', color: '#94a3b8', marginTop: '10px', textAlign: 'center' } }, __('Forces sync with vapt-locked-config.php', 'vapt-Copilot'))
          ])
        ])
      ])
    ]);
  };

  const LicenseManager = ({ domains, fetchData, isSuper, loading }) => {
    // Manage state for the selected domain (if multiple, allows switching)
    const [selectedDomainId, setSelectedDomainId] = useState(() => (Array.isArray(domains) && domains.length > 0) ? domains[0].id : null);

    // Derived current domain object
    const currentDomain = useMemo(() => {
      const doms = Array.isArray(domains) ? domains : [];
      return doms.find(d => d.id === parseInt(selectedDomainId)) || (doms.length > 0 ? doms[0] : null);
    }, [domains, selectedDomainId]);

    // Local Form State
    const [formState, setFormState] = useState({
      license_type: 'standard',
      manual_expiry_date: '',
      auto_renew: false
    });

    const [isSaving, setIsSaving] = useState(false);
    const [localStatus, setLocalStatus] = useState(null);
    const [confirmState, setConfirmState] = useState({ isOpen: false, type: null });

    // Sync form with current domain when selection changes or domain updates
    useEffect(() => {
      if (currentDomain && !isSaving && !loading) {
        const newType = currentDomain.license_type || 'standard';
        const newExpiry = currentDomain.manual_expiry_date ? currentDomain.manual_expiry_date.split(' ')[0] : '';
        const newAuto = !!parseInt(currentDomain.auto_renew);

        // Only update if actually different to prevent flickering
        if (formState.license_type !== newType ||
          formState.manual_expiry_date !== newExpiry ||
          formState.auto_renew !== newAuto) {
          setFormState({
            license_type: newType,
            manual_expiry_date: newExpiry,
            auto_renew: newAuto
          });
        }
      }
    }, [currentDomain, isSaving, loading]);

    const isDirty = currentDomain ? (
      formState.license_type !== (currentDomain.license_type || 'standard') ||
      formState.manual_expiry_date !== (currentDomain.manual_expiry_date ? currentDomain.manual_expiry_date.split(' ')[0] : '') ||
      formState.auto_renew !== !!parseInt(currentDomain.auto_renew)
    ) : false;

    if (!currentDomain) {
      return el(PanelBody, { title: __('License & Subscription Management', 'vapt-Copilot'), initialOpen: true },
        el('div', { style: { padding: '30px', textAlign: 'center' } }, [
          el('div', { style: { marginBottom: '20px', color: '#666' } }, __('No domains configured.', 'vapt-Copilot')),

          // Auto-Provision for Superadmins/Admins
          el('div', {
            style: {
              padding: '20px',
              background: '#f0f6fc',
              border: '1px solid #cce5ff',
              borderRadius: '8px',
              maxWidth: '500px',
              margin: '0 auto'
            }
          }, [
            el('h3', { style: { marginTop: 0 } }, __('Initialize Workspace License', 'vapt-Copilot')),
            el('p', null, sprintf(__('Detected environment: %s', 'vapt-Copilot'), window.location.hostname)),
            el('p', { style: { fontSize: '12px', color: '#666' } }, __('As a Superadmin, you can instantly provision a Developer License for this domain.', 'vapt-Copilot')),

            el(Button, {
              isPrimary: true,
              isBusy: isSaving,
              onClick: () => {
                setIsSaving(true);
                const hostname = window.location.hostname;
                // Calculate 100 years from now for Developer
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 36500);
                const expiry = tomorrow.toISOString().split('T')[0];

                apiFetch({
                  path: 'vaptc/v1/domains/update',
                  method: 'POST',
                  data: {
                    domain: hostname,
                    license_type: 'developer',
                    auto_renew: 1,
                    manual_expiry_date: expiry,
                    license_id: 'DEV-' + Math.random().toString(36).substr(2, 9).toUpperCase()
                  }
                }).then(() => {
                  setLocalStatus({ message: 'Domain Provisioned!', type: 'success' });
                  fetchData(); // Will trigger re-render with new domain
                }).catch(err => {
                  setIsSaving(false);
                  setLocalStatus({ message: 'Provision Failed: ' + err.message, type: 'error' });
                });
              }
            }, sprintf(__('Provision %s (Developer)', 'vapt-Copilot'), window.location.hostname)),

            localStatus && el('p', { style: { color: localStatus.type === 'error' ? 'red' : 'green', marginTop: '10px' } }, localStatus.message)
          ])
        ])
      );
    }

    const handleUpdate = (isManualRenew = false) => {
      setIsSaving(true);
      setLocalStatus({
        message: isManualRenew ? __('Performing Manual Renewal...', 'vapt-Copilot') : __('Updating License...', 'vapt-Copilot'),
        type: 'info'
      });

      let payload = {
        domain: currentDomain.domain,
        license_type: formState.license_type,
        auto_renew: formState.auto_renew ? 1 : 0,
        manual_expiry_date: formState.manual_expiry_date,
        renewals_count: currentDomain.renewals_count || 0 // Explicitly send current count
      };

      // Manual Renew Logic
      if (isManualRenew) {
        const baseDateStr = currentDomain.manual_expiry_date || new Date().toISOString().split('T')[0];
        const parts = baseDateStr.split(' ')[0].split('-');
        // Create date in local time at 00:00:00 using parts
        const baseDate = new Date(parts[0], parts[1] - 1, parts[2]);

        let durationDays = 30;
        if (formState.license_type === 'pro') durationDays = 365;
        if (formState.license_type === 'developer') durationDays = 36500; // ~100 years

        baseDate.setDate(baseDate.getDate() + durationDays);

        // Format back to YYYY-MM-DD manually to avoid UTC shift
        const y = baseDate.getFullYear();
        const m = String(baseDate.getMonth() + 1).padStart(2, '0');
        const d = String(baseDate.getDate()).padStart(2, '0');
        payload.manual_expiry_date = `${y}-${m}-${d}`;
        payload.renew_source = 'manual'; // Explicitly tag as manual
      }

      apiFetch({
        path: 'vaptc/v1/domains/update',
        method: 'POST',
        data: payload
      }).then(res => {
        if (res.success && res.domain) {
          setLocalStatus({ message: __('License Updated!', 'vapt-Copilot'), type: 'success' });
          return fetchData(); // Return promise to chain
        }
      }).catch(err => {
        setLocalStatus({ message: __('Update Failed', 'vapt-Copilot'), type: 'error' });
      }).finally(() => {
        setIsSaving(false);
        setTimeout(() => setLocalStatus(null), 3000);
      });
    };

    const handleRollback = (type) => {
      setConfirmState({ isOpen: true, type });
    };

    const executeRollback = () => {
      const type = confirmState.type;
      setConfirmState({ isOpen: false, type: null });

      setIsSaving(true);
      setLocalStatus({ message: __('Reverting Renewals...', 'vapt-Copilot'), type: 'info' });

      apiFetch({
        path: 'vaptc/v1/domains/update',
        method: 'POST',
        data: {
          domain: currentDomain.domain,
          action: type
        }
      }).then(res => {
        if (res.success && res.domain) {
          setLocalStatus({ message: __('Rollback Successful!', 'vapt-Copilot'), type: 'success' });
          return fetchData();
        }
      }).catch(err => {
        setLocalStatus({ message: __('Rollback Failed', 'vapt-Copilot'), type: 'error' });
      }).finally(() => {
        setIsSaving(false);
        setTimeout(() => setLocalStatus(null), 3000);
      });
    };

    // Helper to format date
    const formatDate = (dateStr) => {
      if (!dateStr || dateStr.startsWith('0000')) return __('Never / Invalid', 'vapt-Copilot');
      return new Date(dateStr).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return el(PanelBody, { title: __('License & Subscription Management', 'vapt-Copilot'), initialOpen: true }, [
      // Domain Selector (Only if multiple)
      (Array.isArray(domains) && domains.length > 1) && el('div', { style: { marginBottom: '20px' } }, [
        el(SelectControl, {
          label: __('Select Domain to Manage', 'vapt-Copilot'),
          value: selectedDomainId,
          options: domains.map(d => ({ label: d.domain, value: d.id })),
          onChange: setSelectedDomainId
        })
      ]),

      el('div', { className: 'vaptm-license-grid' }, [
        // LEFT: Status Card
        el('div', { className: 'vaptm-license-card' }, [
          el('h3', null, __('License Status', 'vapt-Copilot')),

          el('div', { className: 'vaptm-info-row' }, [
            el('label', null, __('Current Type', 'vapt-Copilot')),
            el('span', { className: `vaptm-license-badge ${currentDomain.license_type || 'standard'}` },
              (currentDomain.license_type || 'Standard').toUpperCase()
            )
          ]),

          // First Activated (2nd Position)
          el('div', { className: 'vaptm-info-row vaptm-stat-highlight' }, [
            el('label', null, __('First Activated', 'vapt-Copilot')),
            el('span', null, currentDomain.first_activated_at ? formatDate(currentDomain.first_activated_at) : __('Not Activated', 'vapt-Copilot'))
          ]),

          el('div', { className: 'vaptm-info-row' }, [
            el('label', null, __('Expiry Date', 'vapt-Copilot')),
            el('span', { style: { color: (currentDomain.manual_expiry_date && new Date(currentDomain.manual_expiry_date) < new Date()) ? '#d63638' : 'inherit' } },
              formatDate(currentDomain.manual_expiry_date)
            )
          ]),

          el('div', { className: 'vaptm-info-row vaptm-stat-highlight' }, [
            el('label', null, __('Terms Renewed', 'vapt-Copilot')),
            el('span', null, `${currentDomain.renewals_count || 0} Times`)
          ]),

          el('div', { className: 'vaptm-desc-text' },
            currentDomain.license_type === 'developer'
              ? __('Developer License: Perpetual access with no expiration.', 'vapt-Copilot')
              : (currentDomain.license_type === 'pro'
                ? __('Pro License: Annual renewal cycle with premium features.', 'vapt-Copilot')
                : __('Standard License: 30-day renewal cycle.', 'vapt-Copilot'))
          ),

          // Status feedback
          localStatus && el('div', {
            style: {
              marginTop: '15px',
              padding: '8px',
              borderRadius: '4px',
              background: localStatus.type === 'error' ? '#fde8e8' : '#def7ec',
              color: localStatus.type === 'error' ? '#9b1c1c' : '#03543f',
              fontSize: '12px', textAlign: 'center'
            }
          }, localStatus.message)
        ]),

        // RIGHT: Update Form
        el('div', { className: 'vaptm-license-card' }, [
          el('h3', null, __('Update License', 'vapt-Copilot')),

          el(SelectControl, {
            label: __('License Type', 'vapt-Copilot'),
            value: formState.license_type,
            disabled: isSaving,
            options: [
              { label: 'Standard (30 Days)', value: 'standard' },
              { label: 'Pro (One Year)', value: 'pro' },
              { label: 'Developer (Perpetual)', value: 'developer' }
            ],
            onChange: (val) => {
              // Dynamic Expiry Calculation
              const baseDate = new Date(); // Start from today for new calculation basis
              let durationDays = 30;
              if (val === 'pro') durationDays = 365;
              if (val === 'developer') durationDays = 36500; // ~100 years

              baseDate.setDate(baseDate.getDate() + durationDays);
              const newExpiry = baseDate.toISOString().split('T')[0];

              setFormState({
                ...formState,
                license_type: val,
                manual_expiry_date: newExpiry
              });
            }
          }),

          el(TextControl, {
            label: __('New Expiry Date', 'vapt-Copilot'),
            type: 'date',
            value: formState.manual_expiry_date,
            disabled: isSaving,
            onChange: (val) => setFormState({ ...formState, manual_expiry_date: val })
          }),

          el(ToggleControl, {
            label: __('Auto Renew', 'vapt-Copilot'),
            checked: formState.auto_renew,
            disabled: isSaving,
            onChange: (val) => setFormState({ ...formState, auto_renew: val }),
            help: __('Automatically extend expiry if active.', 'vapt-Copilot')
          }),

          el('div', { style: { display: 'flex', gap: '10px', marginTop: '20px', alignItems: 'center', flexWrap: 'wrap' } }, [
            el(Button, {
              isPrimary: true,
              isBusy: isSaving && !localStatus?.message.includes('Manual'),
              disabled: !isDirty || isSaving,
              onClick: () => handleUpdate(false)
            }, __('Update License', 'vapt-Copilot')),

            el(Button, {
              isSecondary: true,
              isBusy: isSaving && localStatus?.message.includes('Manual'),
              disabled: formState.auto_renew || isSaving,
              onClick: () => handleUpdate(true)
            }, __('Manual Renew', 'vapt-Copilot')),

            // Correction Controls
            (currentDomain.renewals_count > 0) && el('div', { className: 'vaptm-correction-controls' }, [
              el(Button, {
                className: 'is-link',
                onClick: () => handleRollback('undo')
              }, __('Undo Last', 'vapt-Copilot')),
              el(Button, {
                className: 'is-link is-destructive',
                onClick: () => handleRollback('reset')
              }, __('Reset Renewals', 'vapt-Copilot'))
            ])
          ]),
        ])
      ]),

      // Confirmation Modal for Rollbacks
      el(VAPTM_ConfirmModal, {
        isOpen: confirmState.isOpen,
        message: confirmState.type === 'undo'
          ? __('Are you sure you want to undo the last manual renewal?', 'vapt-Copilot')
          : __('Are you sure you want to reset all consecutive manual renewals?', 'vapt-Copilot'),
        onConfirm: executeRollback,
        onCancel: () => setConfirmState({ isOpen: false, type: null }),
        confirmLabel: __('Revert Now', 'vapt-Copilot'),
        isDestructive: confirmState.type === 'reset'
      })
    ]);
  };

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
      const savedOrder = localStorage.getItem(`vaptm_col_order_${selectedFile} `);
      const savedVisible = localStorage.getItem(`vaptm_visible_cols_${selectedFile} `);

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
      localStorage.setItem(`vaptm_col_order_${selectedFile} `, JSON.stringify(columnOrder));
      localStorage.setItem(`vaptm_visible_cols_${selectedFile} `, JSON.stringify(visibleCols));
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
      localStorage.setItem(`vaptm_col_order_${selectedFile} `, JSON.stringify(columnOrder));
      localStorage.setItem(`vaptm_visible_cols_${selectedFile} `, JSON.stringify(visibleCols));
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
              console.log(`VAPTC: Smart Mapping populated ${contentField} from ${sourceKey} `);
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
        apiFetch({ path: `vaptc / v1 / features / ${feature.key}/history` })
          .then(res => {
            setHistory(res);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      }, [feature.key]);

      const [confirmState, setConfirmState] = useState(null);

      const resetHistory = () => {
        setConfirmState({
          message: sprintf(__('Are you sure you want to reset history for "%s"?\n\nThis will:\n1. Clear all history records.\n2. Reset status to "Draft".', 'vapt-Copilot'), feature.label),
          isDestructive: true,
          onConfirm: () => {
            setConfirmState(null);
            setLoading(true);
            updateFeature(feature.key, {
              status: 'Draft',
              reset_history: true,
              has_history: false,
              history_note: 'History Reset by User'
            }).then(() => {
              setLoading(false);
              onClose();
            });
          }
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
        ]),
        confirmState && el(VAPTM_ConfirmModal, {
          isOpen: true,
          message: confirmState.message,
          isDestructive: confirmState.isDestructive,
          onConfirm: confirmState.onConfirm,
          onCancel: () => setConfirmState(null)
        })
      ]);
    };

    // Design/Schema Modal
    const DesignModal = ({ feature, onClose }) => {
      // Default prompt for guidance but still valid JSON
      const defaultState = {
        controls: [],
        _instructions: "STOP! Do NOT copy this text. 1. Click 'Copy AI Design Prompt' button below. 2. Paste that into Antigravity Chat. 3. Paste the JSON result back here."
      };
      const getInitialSchema = () => {
        if (!feature.generated_schema) return defaultState;
        if (typeof feature.generated_schema === 'string') {
          try {
            const parsed = JSON.parse(feature.generated_schema);
            // If double-encoded, parse again
            if (typeof parsed === 'string') return JSON.parse(parsed);
            return parsed;
          } catch (e) {
            return defaultState;
          }
        }
        return feature.generated_schema;
      };

      const initialParsed = getInitialSchema();
      const defaultValue = JSON.stringify(initialParsed, null, 2);

      const [schemaText, setSchemaText] = useState(defaultValue);
      const [parsedSchema, setParsedSchema] = useState(initialParsed);
      const [localImplData, setLocalImplData] = useState(
        feature.implementation_data ? (typeof feature.implementation_data === 'string' ? JSON.parse(feature.implementation_data) : feature.implementation_data) : {}
      );
      const [isSaving, setIsSaving] = useState(false);
      const [saveStatus, setSaveStatus] = useState(null);

      // New: Toggle for Verification Guidance
      // New: Toggle for Verification Guidance
      const [includeGuidance, setIncludeGuidance] = useState(feature.include_verification_guidance !== undefined ? feature.include_verification_guidance == 1 : true);
      // New: Hover state for paste logic
      const [isHoveringSchema, setIsHoveringSchema] = useState(false);

      // Handle "Replace on Hover" Paste Logic
      useEffect(() => {
        const handleGlobalPaste = (e) => {
          if (isHoveringSchema) {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            if (text) {
              onJsonChange(text);
              setSaveStatus({ message: __('Content Replaced from Clipboard!', 'vapt-Copilot'), type: 'success' });
              setTimeout(() => setSaveStatus(null), 2000);
            }
          }
        };
        window.addEventListener('paste', handleGlobalPaste);
        return () => window.removeEventListener('paste', handleGlobalPaste);
      }, [isHoveringSchema]);

      // State for Alerts and Confirms
      const [alertState, setAlertState] = useState(null);
      const [confirmState, setConfirmState] = useState(null);

      // State for Remove Confirmation Modal
      const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);


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
            generated_schema: JSON.stringify(parsed),
            include_verification_engine: hasTestActions ? 1 : 0,
            include_verification_guidance: includeGuidance ? 1 : 0,
            implementation_data: JSON.stringify(localImplData)
          })
            .then(() => {
              setIsSaving(false);
              onClose();
            })
            .catch(() => setIsSaving(false));
        } catch (e) {
          setAlertState({ message: __('Invalid JSON format. Please check your syntax.', 'vapt-Copilot') });
        }
      };

      const handleRemoveConfirm = () => {
        setIsSaving(true);
        updateFeature(feature.key, {
          status: 'Draft',
          generated_schema: null,
          implementation_data: null,
          include_verification_engine: 0,
          include_verification_guidance: 0,
          reset_history: true,
          has_history: false
        })
          .then(() => {
            setIsSaving(false);
            setIsRemoveConfirmOpen(false); // Close confirm modal
            onClose(); // Close main modal
          })
          .catch(() => {
            setIsSaving(false);
            setIsRemoveConfirmOpen(false);
            setAlertState({ message: __('Failed to remove implementation.', 'vapt-Copilot') });
          });
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
                "evidence_list": "{{evidence}}"
              },
              "schema_fields": "{{schema_hints.fields}}",
              "automation_context": {
                "ai_check_prompt": "{{automation_prompts.ai_check}}",
                "ai_schema_fields": "{{automation_prompts.ai_schema}}"
              },
              "compliance_references": "{{references}}",
              "implementation_strategy": {
                "execution_driver": "Universal PHP Hook Driver (class-vaptc-hook-driver.php)",
                "enforcement_mechanism": "Dynamic mapping of JSON control values to backend security methods.",
                "available_methods": [
                  "limit_login_attempts - Enforces rate limiting (requires 'limit' or 'rate_limit' key)",
                  "block_xmlrpc - Blocks XML-RPC requests (requires toggle)",
                  "disable_directory_browsing - Blocks directory listing",
                  "enable_security_headers - Injects security headers",
                  "block_null_byte_injection - blocks null byte chars",
                  "hide_wp_version - Hides version",
                  "block_debug_exposure - Blocks debug.log access"
                ],
                "data_binding": "Controls must use 'key' to bind to method arguments."
              },
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

        // Replace Placeholders in the JSON portion
        const replaceAll = (str, key, val) => {
          const value = Array.isArray(val) ? val.join(', ') : (val || '');
          return str.split(`{{${key}}}`).join(value).split(`{${key}}`).join(value);
        };

        contextJson = replaceAll(contextJson, 'title', feature.label || feature.title || '');
        contextJson = replaceAll(contextJson, 'category', feature.category || 'General');
        contextJson = replaceAll(contextJson, 'description', feature.description || 'None provided');
        contextJson = replaceAll(contextJson, 'severity', feature.severity || 'Medium');
        contextJson = replaceAll(contextJson, 'remediation', feature.remediation);
        contextJson = replaceAll(contextJson, 'assurance_against', feature.assurance_against);
        contextJson = replaceAll(contextJson, 'assurance', feature.assurance);
        contextJson = replaceAll(contextJson, 'tests', feature.tests);
        contextJson = replaceAll(contextJson, 'evidence', feature.evidence);
        contextJson = replaceAll(contextJson, 'schema_hints.fields', feature.schema_hints?.fields?.map(f => `${f.name} (${f.type})`).join(', '));
        contextJson = replaceAll(contextJson, 'test_method', feature.test_method);
        contextJson = replaceAll(contextJson, 'automation_prompts.ai_ui', `Interactive JSON Schema for VAPT Workbench.`);
        contextJson = replaceAll(contextJson, 'automation_prompts.ai_check', `PHP verification logic for ${feature.label || 'this feature'}.`);

        // Assemble HYBRID PROMPT (Context + Instructions)
        // const finalPrompt = `Please generate an interactive security interface JSON based on the following context:
        //const finalPrompt = `Assume yourself as a WordPress security expert, you are desired to design an interactive WordPress security configuration interface for this feature:
        const finalPrompt = `You are an Expert Security Engineer and UI Designer for WordPress. I need you to generate a JSON Schema for a 'Functional Workbench' interface for the following security feature:

--- DESIGN CONTEXT ---
${contextJson}
--- 

INSTRUCTIONS & CRITICAL RULES:
1. **Response Format**: Provide ONLY a JSON block. No preamble or conversation.
2. **Schema Structure**: You MUST include both 'controls' and 'enforcement' blocks.
3. **Control Types**:
   - **Functional**: 'toggle', 'input', 'select', 'textarea', 'code', 'test_action', 'button', 'password'. (MUST HAVE 'key' & 'default').
   - **Presentational**: 'info', 'alert', 'section', 'group', 'divider', 'html', 'header', 'label'. (NO 'key' required).
   - **Rich UI**: 'risk_indicators', 'assurance_badges', 'test_checklist', 'evidence_list'. (NO 'key' required).
4. **Default Values**: Every functional control MUST have a 'default' property (e.g. "5", true, "off"). This is CRITICAL for backend baseline enforcement.
5. **Enforcement Mappings & Evidence**: Use the following reference for 'mappings' and 'expected_headers':
   | Method | Use in Mapping | Expected Header (X-VAPTC-Enforced) |
   | :--- | :--- | :--- |
   | Rate Limiting | limit_login_attempts | php-rate-limit |
   | Block XML-RPC | block_xmlrpc | php-xmlrpc |
   | Directory Browsing | disable_directory_browsing | php-dir |
   | Security Headers | enable_security_headers | php-headers |
   | Null Byte Block | block_null_byte_injection | php-null-byte |
   | Hide WP Version | hide_wp_version | php-version-hide |
   | Debug Exposure | block_debug_exposure | php-debug-exposure |
   - Driver: Always use "driver": "hook" for these methods.
6. **Reset Logic**: For ANY rate-limiting feature, a reset 'test_action' is MANDATORY.
   - Logic: "test_logic": "universal_probe"
   - Config: {"method": "GET", "path": "/", "params": {"vaptc_action": "reset_rate_limits"}, "expected_status": 200}
7. **Dynamic Testing**: For 'spam_requests', ensure the RPM is resolved from the 'rate_limit' or 'limit' key in sibling controls.
8. **Evidence-to-Assertion Mapping**: You MUST correlate the 'Evidence' description with functional 'test_config' assertions.
9. **Self-Verifying Tests**: Any 'test_action' MUST define its own success criteria. You MUST include 'expected_headers' (containing the 'X-VAPTC-Enforced' key from the table above) for any blocking feature.
10. **Unified Verification**: For features that have a single mapping method, generate one authoritative 'Verify' control instead of multiple fragmented tests.
11. **Truthful Reporting**: To differentiate between VAPT enforcement and external plugins/server rules, your test MUST fail if the 'X-VAPTC-Enforced' header is missing, even if the HTTP status (e.g., 403) is correct.
12. **Reference JSON Structure**:
   {
     "controls": [
       { "type": "section", "label": "Configuration" },
       { "type": "toggle", "label": "Enable Feature", "key": "status", "default": true },
       { "type": "input", "label": "Max Attempts", "key": "rate_limit", "default": "5" },
       { "type": "divider" },
       { "type": "test_action", "label": "Verify", "key": "v1", "test_logic": "spam_requests" },
       { "type": "test_action", "label": "Reset", "key": "reset", "test_logic": "universal_probe", "test_config": {"method": "GET", "path": "/", "params": {"vaptc_action": "reset_rate_limits"}, "expected_status": 200} },
       { "type": "evidence_list", "label": "Evidence", "items": ["Screenshot of block", "Log entry"] }
     ],
     "enforcement": {
       "driver": "hook",
       "mappings": { "status": "limit_login_attempts", "rate_limit": "limit_login_attempts" }
     }
   }

Feature Name: ${feature.label || feature.title}
Remediation (Core Logic): ${Array.isArray(feature.remediation) ? feature.remediation.join('\n- ') : (feature.remediation || 'None provided')}
Protection Against (Risks): ${Array.isArray(feature.assurance_against) ? feature.assurance_against.join('\n- ') : (feature.assurance_against || 'None provided')}
Success Goals (Assurance): ${Array.isArray(feature.assurance) ? feature.assurance.join('\n- ') : (feature.assurance || 'None provided')}
Test Protocol (Required Tests): ${Array.isArray(feature.tests) ? feature.tests.join('\n- ') : (feature.tests || 'None provided')}
Evidence (Success Markers): ${Array.isArray(feature.evidence) ? feature.evidence.join('\n- ') : (feature.evidence || 'None provided')}
Schema Hints: ${feature.schema_hints?.fields ? feature.schema_hints.fields.map(f => `${f.name} (${f.type})`).join(', ') : 'None provided'}
Test Method: ${feature.test_method || 'None provided'}${includeGuidance ? `
12. **Verification & Evidence (MANDATORY)**: You MUST include two specific controls at the end of the functional section:
    - One 'test_checklist' control labeled "Test Protocol" containing the items from 'Test Protocol'.
    - One 'evidence_list' control labeled "Evidence" containing the items from 'Evidence'.` : ''}`;

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
            setSaveStatus({ message: __('Design Prompt copied!', 'vapt-Copilot'), type: 'success' });
            setTimeout(() => setSaveStatus(null), 3000);
          })
          .catch((err) => {
            console.error('Copy failed', err);
            setAlertState({ message: __('Failed to copy to clipboard.', 'vapt-Copilot') });
          });
      };

      return el(Modal, {
        title: el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } }, [
          el('span', null, sprintf(__('Design Implementation: %s', 'vapt-Copilot'), feature.label)),
          el(Button, {
            isDestructive: true,
            isSmall: true,
            onClick: () => setIsRemoveConfirmOpen(true),
            disabled: isSaving || !feature.generated_schema,
            icon: 'trash'
          }, __('Remove Implementation', 'vapt-Copilot'))
        ]),
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
        // Grid Layout (Left: Editor, Right: Preview)
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: 'calc(100vh - 160px)', maxHeight: '800px', overflow: 'hidden' } }, [
          // Left Side: The Editor
          el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', paddingRight: '10px' } }, [
            el('p', { style: { margin: '0 0 10px 0', fontSize: '13px', color: '#666' } }, __('Paste the JSON schema generated via Antigravity (the AI Proxy) below.', 'vapt-Copilot')),

            // Buttons Row (Moved to Top)
            el('div', { style: { display: 'flex', gap: '10px', marginBottom: '15px' } }, [
              el(Button, { style: { flex: 1, justifyContent: 'center' }, isSecondary: true, onClick: copyContext, icon: 'clipboard' }, __('Copy Design Prompt', 'vapt-Copilot')),
              el(Button, {
                isDestructive: true,
                icon: 'trash',
                onClick: () => {
                  setConfirmState({
                    message: __('Are you sure you want to reset the schema? This will wash away any changes.', 'vapt-Copilot'),
                    isDestructive: true,
                    onConfirm: () => {
                      setConfirmState(null);
                      onJsonChange(JSON.stringify(defaultState, null, 2));
                      setSaveStatus({ message: __('Schema Reset!', 'vapt-Copilot'), type: 'success' });
                      setTimeout(() => setSaveStatus(null), 2000);
                    }
                  });
                }
              }, __('Reset', 'vapt-Copilot'))
            ]),

            // New Toggle
            el('div', { style: { marginBottom: '10px' } },
              el(ToggleControl, {
                label: __('Include Verification & Evidence in Interface', 'vapt-Copilot'),
                checked: includeGuidance,
                onChange: setIncludeGuidance,
                help: __('If enabled, the AI prompt will request a dedicated section for verification steps.', 'vapt-Copilot')
              })
            ),

            el('div', {
              style: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: '300px', marginBottom: '10px' },
              onMouseEnter: () => setIsHoveringSchema(true),
              onMouseLeave: () => setIsHoveringSchema(false)
            }, [
              el('label', { style: { fontSize: '11px', fontWeight: '500', marginBottom: '4px', textTransform: 'uppercase', color: '#101517' } }, __('Interface JSON Schema', 'vapt-Copilot')),
              el('div', { style: { fontSize: '11px', color: '#666', marginBottom: '8px' } }, __('Hover and Ctrl+V to replace content.', 'vapt-Copilot')),
              el('textarea', {
                value: schemaText,
                onChange: (e) => onJsonChange(e.target.value),
                style: {
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  background: isHoveringSchema ? '#f0fdf4' : '#fcfcfc',
                  lineHeight: '1.4',
                  flex: 1,
                  resize: 'none',
                  width: '100%',
                  border: '1px solid #757575',
                  borderRadius: '4px',
                  padding: '8px',
                  boxSizing: 'border-box',
                  transition: 'background 0.2s'
                }
              })
            ]),

          ]),

          // Right Side: Live Preview
          el('div', { style: { background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' } }, [
            el('div', { style: { padding: '10px 15px', borderBottom: '1px solid #e5e7eb', background: '#fff', borderTopLeftRadius: '8px', borderTopRightRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' } }, [
              el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
                el(Icon, { icon: 'visibility', size: 16 }),
                el('strong', { style: { fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#4b5563' } }, __('Live Implementation Preview'))
              ]),
              // Moved Buttons to Top
              el('div', { style: { display: 'flex', gap: '10px' } }, [
                el(Button, { isSecondary: true, isSmall: true, onClick: onClose }, __('Cancel', 'vapt-Copilot')),
                el(Button, { isPrimary: true, isSmall: true, onClick: handleSave, isBusy: isSaving }, __('Save & Deploy', 'vapt-Copilot'))
              ])
            ]),
            el('div', { style: { padding: '15px', flexGrow: 1 } }, [
              (() => {
                const schema = parsedSchema || { controls: [] };
                const hasTestActions = schema.controls && schema.controls.some(c => c.type === 'test_action');
                const isVerifEngine = hasTestActions; // Preview follows schema content

                // Split Controls
                const implControls = schema.controls ? schema.controls.filter(c => !['test_action', 'risk_indicators', 'assurance_badges', 'test_checklist', 'evidence_list'].includes(c.type)) : [];
                const verifActions = schema.controls ? schema.controls.filter(c => c.type === 'test_action') : [];
                const supportControls = schema.controls ? schema.controls.filter(c => ['risk_indicators', 'assurance_badges'].includes(c.type)) : [];

                const subBoxStyle = { marginTop: '15px', padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' };

                return el(Fragment, null, [
                  // Block 1: Functional & Engine (Side-by-Side Grid)
                  // Single Column Stack for Preview
                  el('div', { id: 'vaptm-preview-stack', style: { display: 'flex', flexDirection: 'column', gap: '20px' } }, [
                    // 1. Functional Implementation
                    el('div', { id: 'vaptm-preview-panel-functional' }, [
                      el('div', { style: { background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } }, [
                        el('h4', { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#111827' } }, __('Functional Implementation')),
                        GeneratedInterface
                          ? el(GeneratedInterface, {
                            feature: { ...feature, generated_schema: { ...schema, controls: implControls }, implementation_data: localImplData },
                            onUpdate: (newData) => setLocalImplData(newData)
                          })
                          : el('p', null, __('Loading Preview Interface...', 'vapt-Copilot')),

                        el('div', { style: { marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px', fontSize: '10px', color: '#888' } },
                          `Feature Reference: ${feature.key ? feature.key.toUpperCase() : 'N/A'}`
                        )
                      ])
                    ]),

                    // 2. Verification Engine (Actions)
                    isVerifEngine && el('div', { id: 'vaptm-preview-panel-engine' }, [
                      el('div', { style: { background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #eee', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } }, [
                        el('h4', { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 700, color: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px' } }, [
                          el(Icon, { icon: 'shield', size: 16 }),
                          __('Verification Engine')
                        ]),
                        el(GeneratedInterface, {
                          feature: { ...feature, generated_schema: { ...schema, controls: verifActions }, implementation_data: localImplData },
                          onUpdate: (newData) => setLocalImplData(newData)
                        })
                      ])
                    ]),

                    // 3. Manual Verification Steps
                    (() => {
                      const protocol = feature.test_method || '';
                      const checklist = typeof feature.verification_steps === 'string' ? JSON.parse(feature.verification_steps) : (feature.verification_steps || []);
                      const schemaGuideItems = schema.controls ? schema.controls.filter(c => ['test_checklist', 'evidence_list'].includes(c.type)) : [];
                      const hasManualSteps = includeGuidance && (protocol || checklist.length > 0 || schemaGuideItems.length > 0);

                      if (!hasManualSteps) return null;

                      return el('div', {
                        id: 'vaptm-preview-card-verification',
                        style: {
                          background: '#f8fafc',
                          padding: '15px',
                          borderRadius: '8px',
                          border: '1px solid #eee',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                          margin: 0
                        }
                      }, [
                        el('h5', { style: { margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' } }, __('Manual Verification Steps')),

                        el('div', { style: { display: 'flex', flexDirection: 'column', gap: '15px' } }, [
                          protocol && el('div', { id: 'vaptm-preview-col-protocol' }, [
                            el('label', { style: { display: 'block', fontSize: '10px', fontWeight: 700, color: '#92400e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Test Protocol')),
                            el('ol', { style: { margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#4b5563', lineHeight: '1.5' } },
                              protocol.split('\n').filter(l => l.trim()).map((l, i) => el('li', { key: i, style: { marginBottom: '4px' } }, l.replace(/^\d+\.\s*/, '')))
                            )
                          ]),

                          checklist.length > 0 && el('div', { id: 'vaptm-preview-col-checklist' }, [
                            el('label', { style: { display: 'block', fontSize: '10px', fontWeight: 700, color: '#0369a1', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' } }, __('Evidence Checklist')),
                            el('ol', { style: { margin: 0, padding: 0, listStyle: 'none' } },
                              checklist.map((step, i) => el('li', { key: i, style: { fontSize: '12px', color: '#4b5563', display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' } }, [
                                el('input', { type: 'checkbox', style: { margin: '2px 0 0 0', width: '13px', height: '13px' } }),
                                el('span', null, step)
                              ]))
                            )
                          ]),

                          schemaGuideItems.length > 0 && el(GeneratedInterface, {
                            feature: { ...feature, generated_schema: { ...schema, controls: schemaGuideItems }, implementation_data: localImplData },
                            onUpdate: (newData) => setLocalImplData(newData),
                            isGuidePanel: true
                          })
                        ])
                      ]);
                    })(),

                    // 4. Verification & Assurance
                    includeGuidance && supportControls.length > 0 && el('div', {
                      id: 'vaptm-preview-card-assurance',
                      style: {
                        background: '#f0fdf4',
                        padding: '15px',
                        borderRadius: '8px',
                        border: '1px solid #bbf7d0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                        margin: 0
                      }
                    }, [
                      el('h5', { style: { margin: '0 0 10px 0', fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' } }, __('Verification & Assurance')),
                      el(GeneratedInterface, {
                        feature: { ...feature, generated_schema: { ...schema, controls: supportControls }, implementation_data: localImplData },
                        onUpdate: (newData) => setLocalImplData(newData)
                      })
                    ])
                  ])
                ]);
              })(),
            ])
            // Bottom bar removed
          ])
        ]),

        // Confirmation Modal (Centered)
        isRemoveConfirmOpen && el(Modal, {
          title: __('Confirm Removal', 'vapt-Copilot'),
          onRequestClose: () => setIsRemoveConfirmOpen(false),
          style: { maxWidth: '450px', borderRadius: '8px', padding: '0' },
          className: 'vaptm-confirm-modal'
        }, [
          el('div', { style: { padding: '25px', textAlign: 'center' } }, [
            el(Icon, { icon: 'warning', size: 42, style: { color: '#dc2626', marginBottom: '15px', background: '#fef2f2', padding: '10px', borderRadius: '50%' } }),
            el('h3', { style: { fontSize: '16px', fontWeight: 'bold', margin: '0 0 10px 0', color: '#1f2937' } }, __('Remove Implementation?', 'vapt-Copilot')),
            el('p', { style: { fontSize: '13px', color: '#6b7280', margin: '0 0 25px 0', lineHeight: '1.6' } },
              __('Are you sure you want to completely remove this feature? This action will explicitly delete the assigned schema, wipe all history records, and reset the status to "Draft". This cannot be undone.', 'vapt-Copilot')
            ),
            el('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center' } }, [
              el(Button, { isSecondary: true, onClick: () => setIsRemoveConfirmOpen(false), style: { width: '100px', justifyContent: 'center' } }, __('Cancel', 'vapt-Copilot')),
              el(Button, { isDestructive: true, onClick: handleRemoveConfirm, isBusy: isSaving, style: { width: '140px', justifyContent: 'center' } }, __('Yes, Remove It', 'vapt-Copilot'))
            ])
          ])
        ]),

        // Render Shared Modals
        alertState && el(VAPTM_AlertModal, {
          isOpen: true,
          message: alertState.message,
          type: alertState.type,
          onClose: () => setAlertState(null)
        }),
        confirmState && el(VAPTM_ConfirmModal, {
          isOpen: true,
          message: confirmState.message,
          isDestructive: confirmState.isDestructive,
          onConfirm: confirmState.onConfirm,
          onCancel: () => setConfirmState(null)
        })

      ]);
    };

    // Prompt Configuration Modal
    const PromptConfigModal = ({ isOpen, onClose, feature }) => {
      const [localConfig, setLocalConfig] = useState('');
      const [isSaving, setIsSaving] = useState(false);
      const [alertState, setAlertState] = useState(null);
      const [confirmState, setConfirmState] = useState(null);

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
              setAlertState({ message: 'Failed to save configuration.' });
            });
        } catch (e) {
          setAlertState({ message: 'Invalid JSON. Please fix syntax before saving.' });
        }
      };



      const resetToDefault = () => {
        setConfirmState({
          message: __('Are you sure you want to reset to the default system prompt? This will delete your custom configuration.', 'vapt-Copilot'),
          isDestructive: true,
          onConfirm: () => {
            setConfirmState(null);
            setIsSaving(true);
            apiFetch({
              path: 'vaptc/v1/data-files/meta',
              method: 'POST',
              data: {
                file: selectedFile,
                key: 'design_prompt',
                value: null
              }
            }).then(() => {
              setDesignPromptConfig(null);
              setIsSaving(false);
              onClose();
              setSaveStatus({ message: __('Reset to Default!', 'vapt-Copilot'), type: 'success' });
            });
          }
        });
      };

      return el(Fragment, null, [
        el(Modal, {
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
                      else setAlertState({ message: sprintf(__('Manual Copy Required. Content: %s', 'vapt-Copilot'), text) });
                      setAlertState({ message: __('Prompt copied to clipboard for testing!', 'vapt-Copilot'), type: 'success' });
                    };
                    copy(template);
                  } catch (e) { setAlertState({ message: 'Error generating preview' }); }
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
        ]),
        // Render Modals
        alertState && el(VAPTM_AlertModal, {
          isOpen: true,
          message: alertState.message,
          type: alertState.type,
          onClose: () => setAlertState(null)
        }),
        confirmState && el(VAPTM_ConfirmModal, {
          isOpen: true,
          message: confirmState.message,
          isDestructive: confirmState.isDestructive,
          onConfirm: confirmState.onConfirm,
          onCancel: () => setConfirmState(null)
        })
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

            el(TextareaControl, {
              label: __('Change Note (Internal)', 'vapt-Copilot'),
              value: formValues.note,
              onChange: (val) => setFormValues({ ...formValues, note: val }),
              rows: Math.max(2, (formValues.note || '').split('\n').length),
              autoFocus: true
            }),

            transitioning.nextStatus === 'Develop' && el('div', {
              style: { marginTop: '10px', padding: '12px', background: '#f0f3f5', borderRadius: '4px', display: 'flex', flexDirection: 'column' }
            }, [
              el('h4', { style: { margin: '0 0 8px 0', fontSize: '14px' } }, __('Build Configuration', 'vapt-Copilot')),

              // Reference Box (Read Only)
              el('div', { style: { marginBottom: '10px' } }, [
                el('div', {
                  style: { padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '3px', fontSize: '11px', maxHeight: '120px', overflowY: 'auto', whiteSpace: 'pre-wrap' }
                }, Array.isArray(transitioning.remediation)
                  ? el('ul', { style: { margin: 0, paddingLeft: '20px', listStyleType: 'disc' } },
                    transitioning.remediation.map((item, idx) => el('li', { key: idx, style: { marginBottom: '4px' } }, item))
                  )
                  : (transitioning.remediation || __('No remediation defined.', 'vapt-Copilot')))
              ]),



              // Consolidated VAPT Design Context (Why -> What -> How)
              el('div', { style: { marginBottom: '10px' } }, [
                el('label', { style: { display: 'block', fontWeight: 'bold', marginBottom: '3px', fontSize: '10px', textTransform: 'uppercase', color: '#007cba' } }, __('VAPT Design Context', 'vapt-Copilot')),
                el('div', {
                  style: { padding: '8px', background: '#fff', border: '1px solid #ddd', borderRadius: '3px', fontSize: '11px', maxHeight: '180px', overflowY: 'auto' }
                }, [
                  // 1. Protection Against (Why)
                  transitioning.assurance_against && transitioning.assurance_against.length > 0 && [
                    el('div', { style: { fontWeight: 'bold', color: '#666', marginBottom: '2px', fontSize: '9px' } }, __('1. [PROTECTION AGAINST]:', 'vapt-Copilot')),
                    el('ul', { style: { margin: '0 0 8px 0', paddingLeft: '15px' } },
                      transitioning.assurance_against.map((item, idx) => el('li', { key: idx, style: { marginBottom: '2px' } }, item))
                    )
                  ],
                  // 2. Success Goals (What)
                  transitioning.assurance && transitioning.assurance.length > 0 && [
                    el('div', { style: { fontWeight: 'bold', color: '#666', marginBottom: '2px', fontSize: '9px' } }, __('2. [SUCCESS GOALS]:', 'vapt-Copilot')),
                    el('ul', { style: { margin: '0 0 8px 0', paddingLeft: '15px' } },
                      transitioning.assurance.map((item, idx) => el('li', { key: idx, style: { marginBottom: '2px' } }, item))
                    )
                  ],
                  // 3. Test Protocol (How)
                  transitioning.tests && transitioning.tests.length > 0 && [
                    el('div', { style: { fontWeight: 'bold', color: '#666', marginBottom: '2px', fontSize: '9px' } }, __('3. [TEST PROTOCOL]:', 'vapt-Copilot')),
                    el('ul', { style: { margin: '0 0 8px 0', paddingLeft: '15px' } },
                      transitioning.tests.map((item, idx) => el('li', { key: idx, style: { marginBottom: '2px' } }, item))
                    )
                  ],
                  // 4. Evidence (Proof)
                  transitioning.evidence && transitioning.evidence.length > 0 && [
                    el('div', { style: { fontWeight: 'bold', color: '#666', marginBottom: '2px', fontSize: '9px' } }, __('4. [EVIDENCE]:', 'vapt-Copilot')),
                    el('ul', { style: { margin: '0 0 8px 0', paddingLeft: '15px' } },
                      transitioning.evidence.map((item, idx) => el('li', { key: idx, style: { marginBottom: '4px' } }, item))
                    )
                  ],
                  // 5. Schema Hints (Implementation)
                  transitioning.schema_hints && transitioning.schema_hints.fields && transitioning.schema_hints.fields.length > 0 && [
                    el('div', { style: { fontWeight: 'bold', color: '#666', marginBottom: '2px', fontSize: '9px' } }, __('5. [SCHEMA HINTS]:', 'vapt-Copilot')),
                    el('ul', { style: { margin: '0', paddingLeft: '15px' } },
                      transitioning.schema_hints.fields.map((field, idx) => el('li', { key: idx, style: { marginBottom: '2px' } }, [
                        el('strong', null, field.name),
                        field.type ? ` (${field.type})` : ''
                      ]))
                    )
                  ]
                ].filter(Boolean))
              ]),

              el(wp.components.TextareaControl, {
                label: __('Additional Instructions', 'vapt-Copilot'),
                value: formValues.devInstruct,
                onChange: (val) => setFormValues({ ...formValues, devInstruct: val }),
                rows: 3
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
                onChange: (newStatus) => {
                  const now = new Date();
                  const ts = now.getFullYear().toString() +
                    (now.getMonth() + 1).toString().padStart(2, '0') +
                    now.getDate().toString().padStart(2, '0') +
                    ' @' +
                    now.getHours().toString().padStart(2, '0') +
                    now.getMinutes().toString().padStart(2, '0');

                  let defaultNote = '';
                  const title = f.label || f.title;
                  if (newStatus === 'Develop') {
                    defaultNote = `[${ts}] Initiating implementation for ${title}. Configuring workbench and internal security drivers.`;
                  } else if (newStatus === 'Test') {
                    const risk = (f.assurance_against && f.assurance_against.length > 0) ? f.assurance_against[0] : __('identified risks', 'vapt-Copilot');
                    defaultNote = `[${ts}] Development phase complete. Ready to verify protection against: ${risk}.`;
                  } else if (newStatus === 'Release') {
                    defaultNote = `[${ts}] Verification protocol passed for ${title}. Ready for baseline deployment.`;
                  } else {
                    defaultNote = `[${ts}] Reverting ${title} to Draft for further planning.`;
                  }

                  setTransitioning({
                    ...f,
                    nextStatus: newStatus,
                    note: defaultNote,
                    remediation: f.remediation || '',
                    assurance: f.assurance || [],
                    assurance_against: f.assurance_against || [],
                    tests: f.tests || [],
                    evidence: f.evidence || [],
                    schema_hints: f.schema_hints || {},
                    devInstruct: ''
                  });
                }
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
              }, __('Verification Engine', 'vapt-Copilot')),

              !['Draft', 'draft', 'available'].includes(f.status) && el('div', {
                onClick: () => setDesignFeature(f),
                title: __('Open Design Hub', 'vapt-Copilot'),
                style: {
                  cursor: 'pointer', padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', letterSpacing: '0.05em',
                  background: '#f0f0f1',
                  color: '#2271b1',
                  border: '1px solid #2271b1'
                }
              }, __('Workbench Design Hub', 'vapt-Copilot'))
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
    const [activeTab, setActiveTab] = useState(() => {
      const validTabs = ['features', 'license', 'domains', 'build'];
      const saved = localStorage.getItem('vaptm_admin_active_tab');
      return validTabs.includes(saved) ? saved : 'features';
    });

    // New: Global UI States for Modals
    const [alertState, setAlertState] = useState(null);
    const [confirmState, setConfirmState] = useState(null);
    const [selectedDomains, setSelectedDomains] = useState([]);

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
      setConfirmState({
        message: __('Changing the feature source will override the current list. Previously implemented features with matching keys will retain their status. Proceed?', 'vapt-Copilot'),
        onConfirm: () => {
          setConfirmState(null);
          setSelectedFile(file);
          fetchData(file);
          // Persist to backend
          apiFetch({
            path: 'vaptc/v1/active-file',
            method: 'POST',
            data: { file }
          }).catch(err => console.error('Failed to sync active file:', err));
        }
      });
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
        const errMsg = err.message || (err.data && err.data.message) || err.error || __('Error saving!', 'vapt-Copilot');
        setSaveStatus({ message: errMsg, type: 'error' });
      });
    };

    const addDomain = (domain, isWildcard = false, isEnabled = true, id = null) => {
      // Optimistic Update for better UX
      if (id) {
        setDomains(prev => prev.map(d => d.id === id ? { ...d, domain, is_wildcard: isWildcard, is_enabled: isEnabled } : d));
      }

      // Explicitly pass values as booleans to avoid truthiness confusion on backend
      return apiFetch({
        path: 'vaptc/v1/domains/update',
        method: 'POST',
        data: {
          id: id,
          domain,
          is_wildcard: Boolean(isWildcard),
          is_enabled: Boolean(isEnabled)
        }
      }).then((res) => {
        if (res.domain) {
          setDomains(prev => {
            const exists = prev.find(d => d.id === res.domain.id);
            if (exists) {
              return prev.map(d => d.id === res.domain.id ? res.domain : d);
            } else {
              return [...prev, res.domain];
            }
          });
        }
        setSaveStatus({ message: __('Domain updated successfully', 'vapt-Copilot'), type: 'success' });
        fetchData();
        return res;
      }).catch(err => {
        setSaveStatus({ message: __('Failed to update domain', 'vapt-Copilot'), type: 'error' });
        fetchData(); // Rollback to server state
        throw err;
      });
    };

    const deleteDomain = (domainId) => {
      apiFetch({
        path: `vaptc/v1/domains/delete?id=${domainId}`,
        method: 'DELETE'
      }).then(() => fetchData());
    };

    const batchDeleteDomains = (ids) => {
      // Optimistic Delete
      setDomains(prev => prev.filter(d => !ids.includes(d.id)));

      return apiFetch({
        path: 'vaptc/v1/domains/batch-delete',
        method: 'POST',
        data: { ids }
      }).then(() => {
        setSaveStatus({ message: sprintf(__('%d domains deleted', 'vapt-Copilot'), ids.length), type: 'success' });
        setSelectedDomains([]);
        fetchData();
      }).catch(err => {
        setSaveStatus({ message: __('Batch delete failed', 'vapt-Copilot'), type: 'error' });
        fetchData(); // Rollback
      });
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
        setAlertState({ message: __('Error uploading JSON', 'vapt-Copilot') });
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
        el('span', { style: { fontSize: '0.5em', marginLeft: '10px', color: '#666', fontWeight: 'normal' } }, `v${settings.pluginVersion}`)
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
        initialTabName: activeTab,
        onSelect: (tabName) => {
          const name = typeof tabName === 'string' ? tabName : tabName.name;
          setActiveTab(name);
          localStorage.setItem('vaptm_admin_active_tab', name);
        },
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
          case 'license': return el(LicenseManager, { domains, fetchData, isSuper, loading });
          case 'domains': return el(DomainFeatures, { domains, features, isDomainModalOpen, selectedDomain, setDomainModalOpen, setSelectedDomain, updateDomainFeatures, addDomain, deleteDomain, batchDeleteDomains, setConfirmState, selectedDomains, setSelectedDomains });
          case 'build': return el(BuildGenerator, { domains, features, setAlertState });
          default: return null;
        }
      }),

      // Global Modals
      alertState && el(VAPTM_AlertModal, {
        isOpen: true,
        message: alertState.message,
        type: alertState.type,
        onClose: () => setAlertState(null)
      }),
      confirmState && el(VAPTM_ConfirmModal, {
        isOpen: true,
        message: confirmState.message,
        isDestructive: confirmState.isDestructive,
        onConfirm: confirmState.onConfirm,
        onCancel: () => setConfirmState(null)
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
