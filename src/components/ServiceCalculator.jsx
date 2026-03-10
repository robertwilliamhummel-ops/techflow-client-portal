import { useState, forwardRef, useImperativeHandle } from 'react';
import { roundToTwo, formatCurrency } from '../utils/formatters';
import './ServiceCalculator.css';

// Service types with rates — exact values from calculator.js
const SERVICE_TYPES = [
  { value: 'website-design', label: 'Website Design & Development', rate: 100 },
  { value: 'seo-consulting', label: 'Digital Growth & SEO', rate: 100 },
  { value: 'it-remote', label: 'Remote IT Support', rate: 90 },
  { value: 'it-onsite', label: 'On-Site IT Support', rate: 100 },
  { value: 'it-priority', label: 'Business-Critical Support', rate: 175 },
  { value: 'emergency', label: 'Emergency/Rush Service', rate: 120 },
];

// Description optgroups — exact options from calculator.js
const DESCRIPTION_OPTIONS = {
  'Website Design & Development': [
    'Custom Website Design',
    'Website Development',
    'Website Redesign',
    'E-commerce Website Development',
    'Website Maintenance',
    'Content Management & Updates',
    'Custom Features & Functionality',
    'Website Performance Optimization',
    'Website Security Hardening',
    'Domain & Hosting Setup',
    'Website Migration',
    'Landing Page Design',
  ],
  'Digital Growth & SEO': [
    'SEO Audit & Analysis',
    'Technical SEO Optimization',
    'Keyword Research & Strategy',
    'On-Page SEO Optimization',
    'Content Optimization',
    'Local SEO Setup & Management',
    'Google My Business Optimization',
    'Link Building Strategy',
    'SEO Performance Monitoring',
    'Competitor Analysis',
    'SEO Consulting',
    'Search Engine Marketing (SEM)',
  ],
  'Business IT Services': [
    'Remote IT Support',
    'On-Site IT Support',
    'Network Setup & Configuration',
    'Server Administration',
    'Cloud Migration & Setup',
    'Email System Setup (Microsoft 365, Google Workspace)',
    'Cybersecurity Assessment',
    'Data Backup & Recovery',
    'IT Consulting & Strategy',
    'System Monitoring & Maintenance',
    'Software Installation & Configuration',
    'Hardware Procurement & Setup',
  ],
};

const emptyHourly = () => ({
  id: Date.now() + Math.random(),
  serviceType: '',
  description: '',
  notes: '',
  hours: '',
  rate: '',
});

const emptyLineItem = () => ({
  id: Date.now() + Math.random(),
  description: '',
  quantity: 1,
  price: '',
});

// forwardRef so InvoiceForm can call getData(), reset(), validate()
const ServiceCalculator = forwardRef(function ServiceCalculator(props, ref) {
  const [hourlyServices, setHourlyServices] = useState([emptyHourly()]);
  const [lineItems, setLineItems] = useState([]);
  const [chargeHST, setChargeHST] = useState(false);

  // ── COMPUTED TOTALS ──────────────────────────────────────
  const hourlyTotal = roundToTwo(
    hourlyServices.reduce((sum, s) => sum + roundToTwo((parseFloat(s.hours) || 0) * (parseFloat(s.rate) || 0)), 0)
  );
  const lineItemsTotal = roundToTwo(
    lineItems.reduce((sum, i) => sum + roundToTwo((parseFloat(i.quantity) || 0) * (parseFloat(i.price) || 0)), 0)
  );
  const subtotal = roundToTwo(hourlyTotal + lineItemsTotal);
  const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0;
  const finalTotal = roundToTwo(subtotal + taxAmount);

  // ── HOURLY SERVICES ──────────────────────────────────────
  const addHourly = () => setHourlyServices(prev => [...prev, emptyHourly()]);

  const removeHourly = (id) => setHourlyServices(prev => prev.filter(s => s.id !== id));

  const updateHourly = (id, field, value) => {
    setHourlyServices(prev => prev.map(s => {
      if (s.id !== id) return s;
      const updated = { ...s, [field]: value };
      // Auto-fill rate when service type changes — matches calculator.js updateHourlyServiceRate()
      if (field === 'serviceType') {
        const found = SERVICE_TYPES.find(t => t.value === value);
        updated.rate = found ? String(found.rate) : '';
      }
      return updated;
    }));
  };

  // ── LINE ITEMS ────────────────────────────────────────────
  const addLineItem = () => setLineItems(prev => [...prev, emptyLineItem()]);

  const removeLineItem = (id) => setLineItems(prev => prev.filter(i => i.id !== id));

  const updateLineItem = (id, field, value) => {
    setLineItems(prev => prev.map(i => i.id !== id ? i : { ...i, [field]: value }));
  };

  // ── EXPOSED VIA REF ───────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getData: () => {
      // Build hourly services — append notes to description (matches calculator.js getHourlyServiceData())
      const hourly = hourlyServices
        .filter(s => s.serviceType && (parseFloat(s.hours) || 0) > 0)
        .map(s => {
          const serviceLabel = SERVICE_TYPES.find(t => t.value === s.serviceType)?.label || '';
          let description = s.description || serviceLabel;
          if (s.notes.trim()) description += ` - ${s.notes.trim()}`;
          return {
            serviceType: serviceLabel,
            description,
            hours: parseFloat(s.hours) || 0,
            rate: parseFloat(s.rate) || 0,
            total: roundToTwo((parseFloat(s.hours) || 0) * (parseFloat(s.rate) || 0)),
          };
        });

      const items = lineItems
        .filter(i => i.description.trim() && (parseFloat(i.quantity) || 0) > 0 && (parseFloat(i.price) || 0) > 0)
        .map(i => ({
          description: i.description.trim(),
          quantity: parseFloat(i.quantity) || 0,
          price: parseFloat(i.price) || 0,
          total: roundToTwo((parseFloat(i.quantity) || 0) * (parseFloat(i.price) || 0)),
        }));

      return {
        hourlyServices: hourly,
        lineItems: items,
        totals: { subtotal, taxAmount, finalTotal, taxRate: chargeHST ? 0.13 : 0 },
      };
    },

    validate: () => {
      const { hourlyServices: h, lineItems: li } = (() => {
        const hourly = hourlyServices.filter(s => s.serviceType && (parseFloat(s.hours) || 0) > 0);
        const items = lineItems.filter(i => i.description.trim() && (parseFloat(i.quantity) || 0) > 0 && (parseFloat(i.price) || 0) > 0);
        return { hourlyServices: hourly, lineItems: items };
      })();

      const errors = [];
      if (h.length === 0 && li.length === 0) {
        errors.push('Please add at least one service or line item');
      }
      hourlyServices.forEach((s, i) => {
        if (s.serviceType) {
          if (!(parseFloat(s.hours) > 0)) errors.push(`Hourly service ${i + 1}: Hours must be greater than 0`);
          if (!(parseFloat(s.rate) > 0)) errors.push(`Hourly service ${i + 1}: Rate must be greater than 0`);
        }
      });
      return errors;
    },

    reset: () => {
      setHourlyServices([emptyHourly()]);
      setLineItems([]);
      setChargeHST(false);
    },
  }));

  // ── RENDER ────────────────────────────────────────────────
  return (
    <div className="service-calculator">

      {/* ── HOURLY SERVICES ── */}
      <div className="calc-section">
        <div className="calc-section-header">
          <h3><i className="fas fa-clock"></i> Hourly Services</h3>
          <button className="btn-add" onClick={addHourly} type="button">
            <i className="fas fa-plus"></i> Add Service
          </button>
        </div>

        {hourlyServices.length === 0 && (
          <div className="calc-empty">No hourly services added</div>
        )}

        <div className="hourly-list">
          {hourlyServices.map((s, idx) => (
            <div className="hourly-row" key={s.id}>
              <div className="hourly-row-header">
                <span className="row-label">Service {idx + 1}</span>
                <button className="btn-remove" onClick={() => removeHourly(s.id)} type="button" title="Remove">
                  <i className="fas fa-trash"></i>
                </button>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Service Type</label>
                  <select
                    className="form-control"
                    value={s.serviceType}
                    onChange={e => updateHourly(s.id, 'serviceType', e.target.value)}
                  >
                    <option value="">Select service type</option>
                    {SERVICE_TYPES.map(t => (
                      <option key={t.value} value={t.value}>
                        {t.label} — ${t.rate}/hr
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Service Description</label>
                  <select
                    className="form-control"
                    value={s.description}
                    onChange={e => updateHourly(s.id, 'description', e.target.value)}
                  >
                    <option value="">Select description</option>
                    {Object.entries(DESCRIPTION_OPTIONS).map(([group, options]) => (
                      <optgroup key={group} label={group}>
                        {options.map(o => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Additional Details <span className="optional">(optional)</span></label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={s.notes}
                  onChange={e => updateHourly(s.id, 'notes', e.target.value)}
                  placeholder="Add specific details (e.g. migrated 50GB data, configured 5 security groups)"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label>Hours Worked</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.25"
                    value={s.hours}
                    onChange={e => updateHourly(s.id, 'hours', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="form-group">
                  <label>Rate / Hour</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="1"
                    value={s.rate}
                    onChange={e => updateHourly(s.id, 'rate', e.target.value)}
                    placeholder="Auto-fills from type"
                  />
                </div>
              </div>

              {s.hours && s.rate && (
                <div className="row-subtotal">
                  Subtotal: <strong>{formatCurrency(roundToTwo((parseFloat(s.hours) || 0) * (parseFloat(s.rate) || 0)))}</strong>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="section-total">
          Hourly Services Total: <span>{formatCurrency(hourlyTotal)}</span>
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="calc-section">
        <div className="calc-section-header">
          <h3><i className="fas fa-list"></i> Line Items</h3>
          <button className="btn-add" onClick={addLineItem} type="button">
            <i className="fas fa-plus"></i> Add Line Item
          </button>
        </div>

        {lineItems.length === 0 && (
          <div className="calc-empty">No line items added</div>
        )}

        <div className="lineitems-list">
          {lineItems.map((item, idx) => (
            <div className="lineitem-row" key={item.id}>
              <div className="lineitem-row-header">
                <span className="row-label">Item {idx + 1}</span>
                <button className="btn-remove" onClick={() => removeLineItem(item.id)} type="button" title="Remove">
                  <i className="fas fa-trash"></i>
                </button>
              </div>
              <div className="form-grid-3">
                <div className="form-group" style={{ gridColumn: '1 / 2' }}>
                  <label>Description</label>
                  <input
                    type="text"
                    className="form-control"
                    value={item.description}
                    onChange={e => updateLineItem(item.id, 'description', e.target.value)}
                    placeholder="Service or product description"
                  />
                </div>
                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    className="form-control"
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={e => updateLineItem(item.id, 'quantity', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Unit Price</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={e => updateLineItem(item.id, 'price', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-total">
          Line Items Total: <span>{formatCurrency(lineItemsTotal)}</span>
        </div>
      </div>

      {/* ── TOTALS ── */}
      <div className="totals-section">
        <div className="hst-row">
          <label className="hst-label">
            <input
              type="checkbox"
              checked={chargeHST}
              onChange={e => setChargeHST(e.target.checked)}
            />
            <span>Add HST (13%)</span>
          </label>
        </div>

        <div className="totals-rows">
          <div className="totals-row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="totals-row">
            <span>HST (13%)</span>
            <span>{formatCurrency(taxAmount)}</span>
          </div>
          <div className="totals-row grand-total">
            <span>Total</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
        </div>
      </div>

    </div>
  );
});

export default ServiceCalculator;
