import { useState, forwardRef, useImperativeHandle, useMemo, useRef, useEffect } from 'react';
import { roundToTwo } from '../utils/formatters';
import './ServiceCalculator.css';

/**
 * MSP-style service catalog: granular types with default rates + presets keyed by `value`.
 * Description dropdown is filtered by selected service type; changing type clears the preset.
 */
const SERVICE_TYPES = [
  // IT Services
  { value: 'it-remote', label: 'Remote IT support (business hours)', rate: 100, group: 'IT Services' },
  { value: 'it-onsite', label: 'On-site IT support', rate: 110, group: 'IT Services' },
  { value: 'it-afterhours', label: 'After-hours / priority support', rate: 155, group: 'IT Services' },
  { value: 'it-emergency', label: 'Emergency / rush response', rate: 185, group: 'IT Services' },
  { value: 'it-network', label: 'Network & infrastructure (project)', rate: 130, group: 'IT Services' },
  { value: 'it-m365', label: 'Microsoft 365 / cloud identity', rate: 120, group: 'IT Services' },
  { value: 'it-backup', label: 'Backup & disaster recovery', rate: 130, group: 'IT Services' },
  { value: 'it-security', label: 'Security hardening & endpoint', rate: 140, group: 'IT Services' },
  // Business automation
  { value: 'auto-workflow', label: 'Automation — workflows & integrations', rate: 150, group: 'Business automation' },
  { value: 'auto-data', label: 'Automation — data sync & APIs', rate: 160, group: 'Business automation' },
  // Web, email & hosting
  { value: 'web-build', label: 'Website — design & build', rate: 115, group: 'Web, email & hosting' },
  { value: 'web-care', label: 'Website — maintenance & updates', rate: 95, group: 'Web, email & hosting' },
  { value: 'email-hosting', label: 'Email & collaboration setup', rate: 125, group: 'Web, email & hosting' },
  { value: 'hosting-dns', label: 'Hosting, DNS & domain management', rate: 105, group: 'Web, email & hosting' },
  { value: 'web-ecom', label: 'E-commerce & payments', rate: 145, group: 'Web, email & hosting' },
];

/** Preset line wording per service type `value` (shown only when that type is selected). */
const DESCRIPTION_OPTIONS = {
  'it-remote': [
    'Password reset & account unlock',
    'Software & application troubleshooting',
    'VPN & remote access assistance',
    'Printer / peripheral configuration',
    'General troubleshooting (service ticket)',
    'Email client setup (Outlook, Apple Mail, etc.)',
    'Mobile device setup & enrollment',
  ],
  'it-onsite': [
    'Workstation setup / replacement',
    'On-site troubleshooting & diagnostics',
    'Network cabling / wall jack check',
    'Wi-Fi / access point troubleshooting',
    'New hire desk & hardware setup',
    'Rack / patch panel tidy & labeling',
  ],
  'it-afterhours': [
    'After-hours incident response',
    'Scheduled maintenance window',
    'Evening change window',
    'Weekend / holiday coverage',
  ],
  'it-emergency': [
    'Production-down response',
    'Security incident triage (initial)',
    'Recovery coordination (initial assessment)',
    'Critical path restoration',
  ],
  'it-network': [
    'Firewall / router configuration change',
    'VLAN & Wi-Fi segmentation',
    'Site-to-site VPN setup',
    'Network assessment & documentation',
    'Switch / access point deployment',
  ],
  'it-m365': [
    'User & license management (Microsoft 365)',
    'SharePoint / Teams site setup',
    'Groups & shared mailbox configuration',
    'Email security (rules; SPF/DKIM with DNS)',
    'Guest access & external sharing review',
    'Intune / device compliance basics',
  ],
  'it-backup': [
    'Backup job review & test restore',
    'Backup tool deployment & tuning',
    'Offsite / cloud backup configuration',
    'Disaster recovery test & documentation',
  ],
  'it-security': [
    'MFA rollout (users & admin accounts)',
    'Endpoint protection review',
    'Patch management window',
    'Admin account review & least privilege',
    'Baseline security hardening',
  ],
  'auto-workflow': [
    'Power Automate flow (new or change)',
    'Zapier / Make scenario',
    'Approval & routing workflow',
    'Email-to-ticket / CRM routing',
    'Scheduled report automation',
  ],
  'auto-data': [
    'CRM ↔ accounting sync',
    'API / webhook integration',
    'CSV import pipeline & validation',
    'Custom connector / middleware',
    'Error monitoring & retry logic',
  ],
  'web-build': [
    'New site build (page or section)',
    'Component / template development',
    'Content migration',
    'Form & notification setup',
    'Performance & technical review (metadata, structure, analytics)',
  ],
  'web-care': [
    'Plugin / theme / core updates',
    'Security patches & small fixes',
    'Content edits & minor layout changes',
    'Uptime & backup verification',
    'Broken link / form check',
  ],
  'email-hosting': [
    'Microsoft 365 / Google Workspace migration',
    'Mailbox cutover & DNS transition',
    'Shared mailbox / distribution groups',
    'SPF / DKIM / DMARC implementation',
    'Mobile device setup',
  ],
  'hosting-dns': [
    'DNS zone changes & verification',
    'SSL certificate setup / renewal',
    'Hosting or CDN migration',
    'Domain registrar & DNS cleanup',
    'Caching & performance basics',
  ],
  'web-ecom': [
    'Product catalog & checkout setup',
    'Payment gateway configuration & testing',
    'Tax, shipping & order notifications',
    'Email receipts & accounting handoff',
    'Basic integration with POS or accounting',
  ],
};

// ── Material presets for line-item autocomplete ───────────────────────────────
const MATERIAL_PRESETS = [
  { label: 'Drywall Sheet 4x8', price: 18 },
  { label: 'Drywall Sheet 4x12', price: 22 },
  { label: 'Drywall Screws (1 lb box)', price: 14 },
  { label: 'Joint Compound (pail)', price: 28 },
  { label: 'Drywall Tape (roll)', price: 9 },
  { label: 'Corner Bead', price: 12 },

  { label: 'Interior Paint (1 gallon)', price: 55 },
  { label: 'Exterior Paint (1 gallon)', price: 65 },
  { label: 'Primer (1 gallon)', price: 45 },
  { label: 'Caulking Tube', price: 7 },
  { label: "Painter's Tape", price: 8 },
  { label: 'Paint Roller Kit', price: 18 },
  { label: 'Brush Set', price: 15 },
  { label: 'Drop Sheets', price: 12 },

  { label: 'Ceramic Tile (sq ft)', price: 6 },
  { label: 'Porcelain Tile (sq ft)', price: 7 },
  { label: 'Tile Adhesive (bag)', price: 35 },
  { label: 'Grout (bag)', price: 25 },
  { label: 'Floor Leveler (bag)', price: 40 },
  { label: 'Laminate Flooring (sq ft)', price: 4 },
  { label: 'Vinyl Plank Flooring (sq ft)', price: 5 },

  { label: 'Cleaning Supplies', price: 30 },
  { label: 'Garbage Bags (Contractor box)', price: 25 },
  { label: 'Rags / Towels', price: 12 },
  { label: 'Shop Towels', price: 15 },
  { label: 'Broom / Dustpan', price: 20 },
  { label: 'Disinfectant / Chemicals', price: 18 },

  { label: 'Nails (box)', price: 12 },
  { label: 'Wood Screws (box)', price: 15 },
  { label: 'Anchors / Fasteners', price: 18 },
  { label: 'Construction Adhesive', price: 9 },
  { label: 'Silicone Sealant', price: 8 },
  { label: 'Expanding Foam', price: 14 },

  { label: '2x4 Lumber', price: 7 },
  { label: '2x6 Lumber', price: 10 },
  { label: 'Plywood Sheet', price: 38 },
  { label: 'OSB Board', price: 30 },
  { label: 'Pressure Treated Lumber', price: 12 },
  { label: 'Trim / Moulding', price: 20 },

  { label: 'Electrical Wire (roll)', price: 60 },
  { label: 'Outlet / Receptacle', price: 6 },
  { label: 'Light Switch', price: 5 },
  { label: 'Junction Box', price: 8 },
  { label: 'LED Light Fixture', price: 45 },
  { label: 'Breaker / Panel Part', price: 35 },

  { label: 'PVC Pipe', price: 12 },
  { label: 'PEX Pipe', price: 15 },
  { label: 'Pipe Fittings', price: 10 },
  { label: 'Plumbing Sealant / Tape', price: 6 },
  { label: 'Shutoff Valve', price: 18 },

  { label: 'Shingles Bundle', price: 45 },
  { label: 'Roofing Nails', price: 14 },
  { label: 'Eavestrough Materials', price: 85 },
  { label: 'Flashing', price: 20 },
  { label: 'Waterproof Membrane', price: 50 },

  { label: 'Equipment Rental (per day)', price: 120 },
  { label: 'Delivery / Pickup', price: 60 },
  { label: 'Dump Fees', price: 90 },
  { label: 'Permit Fees', price: 180 },
  { label: 'Labour Adjustment / Misc', price: 50 },
];

const RECENTS_KEY = 'materialRecents';
const MAX_RECENTS = 10;

function loadRecents() {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveRecent(preset) {
  try {
    const prev = loadRecents().filter((r) => r.label !== preset.label);
    localStorage.setItem(RECENTS_KEY, JSON.stringify([preset, ...prev].slice(0, MAX_RECENTS)));
  } catch {
    // localStorage unavailable — silently skip
  }
}

// ── Autocomplete dropdown for a single line-item description field ────────────
function DescriptionAutocomplete({ value, onChange, onSelect }) {
  const [open, setOpen] = useState(false);
  const [recents, setRecents] = useState(loadRecents);
  const wrapRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const query = value.trim().toLowerCase();

  const filteredPresets = query.length >= 2
    ? MATERIAL_PRESETS.filter((p) => p.label.toLowerCase().includes(query)).slice(0, 8)
    : [];

  // Recents shown when field is focused but nothing typed yet
  const showRecents = open && query.length < 2 && recents.length > 0;
  const showMatches = open && filteredPresets.length > 0;
  const isOpen = showRecents || showMatches;

  const handleSelect = (preset) => {
    onSelect(preset);
    saveRecent(preset);
    setRecents(loadRecents());
    setOpen(false);
  };

  const formatCurrency = (n) =>
    new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', minimumFractionDigits: 0 }).format(n);

  return (
    <div className="desc-autocomplete-wrap" ref={wrapRef}>
      <input
        type="text"
        className="form-input"
        placeholder="Fixed fee, materials, license, etc."
        value={value}
        autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
      />
      {isOpen && (
        <div className="material-suggestions">
          {showRecents && (
            <>
              <div className="suggestions-group-label">
                <i className="fas fa-history"></i> Recently used
              </div>
              {recents.map((r) => (
                <button
                  key={r.label}
                  className="suggestion-item"
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                >
                  <span className="suggestion-label">{r.label}</span>
                  <span className="suggestion-price">{formatCurrency(r.price)}</span>
                </button>
              ))}
            </>
          )}
          {showMatches && (
            <>
              {showRecents && <div className="suggestions-divider" />}
              <div className="suggestions-group-label">
                <i className="fas fa-box"></i> Materials
              </div>
              {filteredPresets.map((p) => (
                <button
                  key={p.label}
                  className="suggestion-item"
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(p); }}
                >
                  <span className="suggestion-label">{p.label}</span>
                  <span className="suggestion-price">{formatCurrency(p.price)}</span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const SERVICE_TYPE_GROUPS = [...new Set(SERVICE_TYPES.map((t) => t.group))];

const newHourly = () => ({
  id: Date.now() + Math.random(),
  serviceType: '',
  description: '',
  notes: '',
  hours: '',
  rate: '',
});
const newLineItem = () => ({ id: Date.now() + Math.random(), description: '', quantity: 1, price: '' });

const ServiceCalculator = forwardRef(function ServiceCalculator(_, ref) {
  const [hourlyServices, setHourlyServices] = useState([newHourly()]);
  const [lineItems, setLineItems] = useState([]);

  const hourlyTotal = roundToTwo(
    hourlyServices.reduce(
      (s, r) => s + roundToTwo((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0)),
      0
    )
  );
  const lineItemsTotal = roundToTwo(
    lineItems.reduce(
      (s, i) => s + roundToTwo((parseFloat(i.quantity) || 0) * (parseFloat(i.price) || 0)),
      0
    )
  );
  const subtotal = roundToTwo(hourlyTotal + lineItemsTotal);

  const updateHourly = (id, field, value) => {
    setHourlyServices((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        if (field === 'serviceType') {
          const found = SERVICE_TYPES.find((t) => t.value === value);
          return {
            ...s,
            serviceType: value,
            rate: found ? String(found.rate) : '',
            description: '',
          };
        }
        return { ...s, [field]: value };
      })
    );
  };

  const updateLineItem = (id, field, value) =>
    setLineItems((p) => p.map((i) => (i.id !== id ? i : { ...i, [field]: value })));

  // Called when user clicks a material suggestion for a line item
  const applyMaterialPreset = (id, preset) => {
    setLineItems((p) =>
      p.map((i) =>
        i.id !== id ? i : { ...i, description: preset.label, price: String(preset.price) }
      )
    );
  };

  const presetsForType = (serviceTypeValue) =>
    serviceTypeValue && DESCRIPTION_OPTIONS[serviceTypeValue]
      ? DESCRIPTION_OPTIONS[serviceTypeValue]
      : [];

  const serviceTypeOptions = useMemo(
    () =>
      SERVICE_TYPE_GROUPS.map((groupName) => (
        <optgroup key={groupName} label={groupName}>
          {SERVICE_TYPES.filter((t) => t.group === groupName).map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} — ${t.rate}/hr
            </option>
          ))}
        </optgroup>
      )),
    []
  );

  useImperativeHandle(ref, () => ({
    getTotals: (chargeHST) => {
      const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0;
      return {
        hourlyTotal,
        lineItemsTotal,
        subtotal,
        taxAmount,
        finalTotal: roundToTwo(subtotal + taxAmount),
      };
    },
    getData: (chargeHST) => {
      const hourly = hourlyServices
        .filter((s) => s.serviceType && parseFloat(s.hours) > 0)
        .map((s) => {
          const label = SERVICE_TYPES.find((t) => t.value === s.serviceType)?.label || '';
          let description = (s.description && s.description.trim()) || label;
          if (s.notes.trim()) description += ` - ${s.notes.trim()}`;
          return {
            serviceType: label,
            description,
            hours: parseFloat(s.hours),
            rate: parseFloat(s.rate) || 0,
            total: roundToTwo(parseFloat(s.hours) * (parseFloat(s.rate) || 0)),
          };
        });
      const items = lineItems
        .filter(
          (i) =>
            i.description.trim() &&
            parseFloat(i.quantity) > 0 &&
            parseFloat(i.price) > 0
        )
        .map((i) => ({
          description: i.description.trim(),
          quantity: parseFloat(i.quantity),
          price: parseFloat(i.price),
          total: roundToTwo(parseFloat(i.quantity) * parseFloat(i.price)),
        }));
      const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0;
      return {
        hourlyServices: hourly,
        lineItems: items,
        totals: {
          subtotal,
          taxAmount,
          finalTotal: roundToTwo(subtotal + taxAmount),
          taxRate: chargeHST ? 0.13 : 0,
        },
      };
    },
    validate: () => {
      const errors = [];
      const hasHourly = hourlyServices.some(
        (s) => s.serviceType && parseFloat(s.hours) > 0
      );
      const hasItems = lineItems.some(
        (i) =>
          i.description.trim() &&
          parseFloat(i.quantity) > 0 &&
          parseFloat(i.price) > 0
      );
      if (!hasHourly && !hasItems) {
        errors.push('Please add at least one service or line item');
        return errors;
      }
      hourlyServices.forEach((s, i) => {
        if (s.serviceType) {
          if (!(parseFloat(s.hours) > 0))
            errors.push(`Hourly service ${i + 1}: Hours must be greater than 0`);
          if (!(parseFloat(s.rate) > 0))
            errors.push(`Hourly service ${i + 1}: Rate must be greater than 0`);
        }
      });
      return errors;
    },
    reset: () => {
      setHourlyServices([newHourly()]);
      setLineItems([]);
    },
  }));

  return (
    <div className="service-calc-card">
      <div className="card-title">
        <i className="fas fa-cogs"></i> Services
      </div>

      <div className="services-sublabel">
        <i className="fas fa-clock"></i> Hourly Services
      </div>

      {hourlyServices.map((s) => {
        const presets = presetsForType(s.serviceType);
        const presetDisabled = !s.serviceType;

        return (
          <div className="hourly-service-block" key={s.id}>
            <div className="service-row">
              <div className="form-group">
                <label className="form-label">Service type</label>
                <select
                  className="form-select"
                  value={s.serviceType}
                  onChange={(e) => updateHourly(s.id, 'serviceType', e.target.value)}
                >
                  <option value="">Select type</option>
                  {serviceTypeOptions}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Line item (preset)</label>
                <select
                  className="form-select"
                  value={presetDisabled ? '' : s.description}
                  disabled={presetDisabled}
                  onChange={(e) => updateHourly(s.id, 'description', e.target.value)}
                >
                  <option value="">
                    {presetDisabled
                      ? 'Select service type first'
                      : 'Choose preset or leave for service name only'}
                  </option>
                  {presets.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hours</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  step="0.25"
                  placeholder="0.00"
                  value={s.hours}
                  onChange={(e) => updateHourly(s.id, 'hours', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Rate/hr</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  step="1"
                  placeholder="Auto"
                  value={s.rate}
                  onChange={(e) => updateHourly(s.id, 'rate', e.target.value)}
                />
              </div>
            </div>

            <div className="notes-row">
              <div className="form-group">
                <label className="form-label">
                  Additional details{' '}
                  <span className="optional">(optional — appended on PDF)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. ticket #, tenant name, scope notes"
                  value={s.notes}
                  onChange={(e) => updateHourly(s.id, 'notes', e.target.value)}
                />
              </div>
            </div>

            <div className="hourly-service-footer">
              <button
                className="btn-remove"
                onClick={() => setHourlyServices((p) => p.filter((r) => r.id !== s.id))}
                type="button"
                aria-label="Remove this hourly service"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>
        );
      })}

      <div className="services-sublabel" style={{ marginTop: '28px' }}>
        <i className="fas fa-list"></i> Line Items
      </div>

      {lineItems.map((item) => (
        <div className="lineitem-row" key={item.id}>
          <div className="form-group desc-col">
            <label className="form-label">Description</label>
            <DescriptionAutocomplete
              value={item.description}
              onChange={(val) => updateLineItem(item.id, 'description', val)}
              onSelect={(preset) => applyMaterialPreset(item.id, preset)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Qty</label>
            <input
              type="number"
              className="form-input"
              min="1"
              step="1"
              value={item.quantity}
              onChange={(e) => updateLineItem(item.id, 'quantity', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price</label>
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={item.price}
              onChange={(e) => updateLineItem(item.id, 'price', e.target.value)}
            />
          </div>
          <div className="form-group remove-col">
            <label className="form-label">&nbsp;</label>
            <button
              className="btn-remove"
              onClick={() => setLineItems((p) => p.filter((i) => i.id !== item.id))}
              type="button"
            >
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>
      ))}

      <div className="add-btns">
        <button
          className="btn-add-service"
          onClick={() => setHourlyServices((p) => [...p, newHourly()])}
          type="button"
        >
          <i className="fas fa-plus"></i> Add Hourly Service
        </button>
        <button
          className="btn-add-line"
          onClick={() => setLineItems((p) => [...p, newLineItem()])}
          type="button"
        >
          <i className="fas fa-plus"></i> Add Line Item
        </button>
      </div>
    </div>
  );
});

export default ServiceCalculator;
