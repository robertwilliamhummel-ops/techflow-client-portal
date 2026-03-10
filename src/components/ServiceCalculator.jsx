import { useState, forwardRef, useImperativeHandle } from 'react';
import { roundToTwo } from '../utils/formatters';
import './ServiceCalculator.css';

const SERVICE_TYPES = [
  { value: 'website-design', label: 'Website Design & Development', rate: 100 },
  { value: 'seo-consulting', label: 'Digital Growth & SEO', rate: 100 },
  { value: 'it-remote', label: 'Remote IT Support', rate: 90 },
  { value: 'it-onsite', label: 'On-Site IT Support', rate: 100 },
  { value: 'it-priority', label: 'Business-Critical Support', rate: 175 },
  { value: 'emergency', label: 'Emergency/Rush Service', rate: 120 },
];

const DESCRIPTION_OPTIONS = {
  'Website Design & Development': [
    'Custom Website Design','Website Development','Website Redesign',
    'E-commerce Website Development','Website Maintenance','Content Management & Updates',
    'Custom Features & Functionality','Website Performance Optimization',
    'Website Security Hardening','Domain & Hosting Setup','Website Migration','Landing Page Design',
  ],
  'Digital Growth & SEO': [
    'SEO Audit & Analysis','Technical SEO Optimization','Keyword Research & Strategy',
    'On-Page SEO Optimization','Content Optimization','Local SEO Setup & Management',
    'Google My Business Optimization','Link Building Strategy','SEO Performance Monitoring',
    'Competitor Analysis','SEO Consulting','Search Engine Marketing (SEM)',
  ],
  'Business IT Services': [
    'Remote IT Support','On-Site IT Support','Network Setup & Configuration',
    'Server Administration','Cloud Migration & Setup',
    'Email System Setup (Microsoft 365, Google Workspace)','Cybersecurity Assessment',
    'Data Backup & Recovery','IT Consulting & Strategy','System Monitoring & Maintenance',
    'Software Installation & Configuration','Hardware Procurement & Setup',
  ],
};

const newHourly = () => ({ id: Date.now() + Math.random(), serviceType: '', description: '', notes: '', hours: '', rate: '' });
const newLineItem = () => ({ id: Date.now() + Math.random(), description: '', quantity: 1, price: '' });

const ServiceCalculator = forwardRef(function ServiceCalculator(_, ref) {
  const [hourlyServices, setHourlyServices] = useState([newHourly()]);
  const [lineItems, setLineItems] = useState([]);

  const hourlyTotal = roundToTwo(hourlyServices.reduce((s, r) => s + roundToTwo((parseFloat(r.hours) || 0) * (parseFloat(r.rate) || 0)), 0));
  const lineItemsTotal = roundToTwo(lineItems.reduce((s, i) => s + roundToTwo((parseFloat(i.quantity) || 0) * (parseFloat(i.price) || 0)), 0));
  const subtotal = roundToTwo(hourlyTotal + lineItemsTotal);

  const updateHourly = (id, field, value) => {
    setHourlyServices(prev => prev.map(s => {
      if (s.id !== id) return s;
      const u = { ...s, [field]: value };
      if (field === 'serviceType') {
        const found = SERVICE_TYPES.find(t => t.value === value);
        u.rate = found ? String(found.rate) : '';
      }
      return u;
    }));
  };

  useImperativeHandle(ref, () => ({
    getTotals: (chargeHST) => {
      const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0;
      return { hourlyTotal, lineItemsTotal, subtotal, taxAmount, finalTotal: roundToTwo(subtotal + taxAmount) };
    },
    getData: (chargeHST) => {
      const hourly = hourlyServices
        .filter(s => s.serviceType && parseFloat(s.hours) > 0)
        .map(s => {
          const label = SERVICE_TYPES.find(t => t.value === s.serviceType)?.label || '';
          let description = s.description || label;
          if (s.notes.trim()) description += ` - ${s.notes.trim()}`;
          return { serviceType: label, description, hours: parseFloat(s.hours), rate: parseFloat(s.rate) || 0, total: roundToTwo(parseFloat(s.hours) * (parseFloat(s.rate) || 0)) };
        });
      const items = lineItems
        .filter(i => i.description.trim() && parseFloat(i.quantity) > 0 && parseFloat(i.price) > 0)
        .map(i => ({ description: i.description.trim(), quantity: parseFloat(i.quantity), price: parseFloat(i.price), total: roundToTwo(parseFloat(i.quantity) * parseFloat(i.price)) }));
      const taxAmount = chargeHST ? roundToTwo(subtotal * 0.13) : 0;
      return { hourlyServices: hourly, lineItems: items, totals: { subtotal, taxAmount, finalTotal: roundToTwo(subtotal + taxAmount), taxRate: chargeHST ? 0.13 : 0 } };
    },
    validate: () => {
      const errors = [];
      const hasHourly = hourlyServices.some(s => s.serviceType && parseFloat(s.hours) > 0);
      const hasItems = lineItems.some(i => i.description.trim() && parseFloat(i.quantity) > 0 && parseFloat(i.price) > 0);
      if (!hasHourly && !hasItems) { errors.push('Please add at least one service or line item'); return errors; }
      hourlyServices.forEach((s, i) => {
        if (s.serviceType) {
          if (!(parseFloat(s.hours) > 0)) errors.push(`Hourly service ${i + 1}: Hours must be greater than 0`);
          if (!(parseFloat(s.rate) > 0)) errors.push(`Hourly service ${i + 1}: Rate must be greater than 0`);
        }
      });
      return errors;
    },
    reset: () => { setHourlyServices([newHourly()]); setLineItems([]); },
  }));

  return (
    <div className="service-calc-card">
      <div className="card-title"><i className="fas fa-cogs"></i> Services</div>

      {/* HOURLY SERVICES */}
      <div className="services-sublabel"><i className="fas fa-clock"></i> Hourly Services</div>

      {hourlyServices.map((s) => (
        // Each service is a self-contained block with its OWN notes field
        <div className="hourly-service-block" key={s.id}>

          <div className="service-row">
            <div className="form-group">
              <label className="form-label">Service Type</label>
              <select className="form-select" value={s.serviceType} onChange={e => updateHourly(s.id, 'serviceType', e.target.value)}>
                <option value="">Select type</option>
                {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label} — ${t.rate}/hr</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <select className="form-select" value={s.description} onChange={e => updateHourly(s.id, 'description', e.target.value)}>
                <option value="">Select description</option>
                {Object.entries(DESCRIPTION_OPTIONS).map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Hours</label>
              <input type="number" className="form-input" min="0" step="0.25" placeholder="0.00" value={s.hours} onChange={e => updateHourly(s.id, 'hours', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Rate/hr</label>
              <input type="number" className="form-input" min="0" step="1" placeholder="Auto" value={s.rate} onChange={e => updateHourly(s.id, 'rate', e.target.value)} />
            </div>
            <div className="form-group remove-col">
              <label className="form-label">&nbsp;</label>
              <button className="btn-remove" onClick={() => setHourlyServices(p => p.filter(r => r.id !== s.id))} type="button">
                <i className="fas fa-trash"></i>
              </button>
            </div>
          </div>

          {/* Notes field — inside THIS block, belongs to THIS service */}
          <div className="notes-row">
            <div className="form-group">
              <label className="form-label">Additional Details <span className="optional">(optional — appended to description on PDF)</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. migrated 50GB data, configured 5 security groups"
                value={s.notes}
                onChange={e => updateHourly(s.id, 'notes', e.target.value)}
              />
            </div>
          </div>

        </div>
      ))}

      {/* LINE ITEMS */}
      <div className="services-sublabel" style={{ marginTop: '28px' }}><i className="fas fa-list"></i> Line Items</div>

      {lineItems.map((item) => (
        <div className="lineitem-row" key={item.id}>
          <div className="form-group desc-col">
            <label className="form-label">Description</label>
            <input type="text" className="form-input" placeholder="Service or product description" value={item.description} onChange={e => setLineItems(p => p.map(i => i.id !== item.id ? i : { ...i, description: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Qty</label>
            <input type="number" className="form-input" min="1" step="1" value={item.quantity} onChange={e => setLineItems(p => p.map(i => i.id !== item.id ? i : { ...i, quantity: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price</label>
            <input type="number" className="form-input" min="0" step="0.01" placeholder="0.00" value={item.price} onChange={e => setLineItems(p => p.map(i => i.id !== item.id ? i : { ...i, price: e.target.value }))} />
          </div>
          <div className="form-group remove-col">
            <label className="form-label">&nbsp;</label>
            <button className="btn-remove" onClick={() => setLineItems(p => p.filter(i => i.id !== item.id))} type="button">
              <i className="fas fa-trash"></i>
            </button>
          </div>
        </div>
      ))}

      <div className="add-btns">
        <button className="btn-add-service" onClick={() => setHourlyServices(p => [...p, newHourly()])} type="button">
          <i className="fas fa-plus"></i> Add Hourly Service
        </button>
        <button className="btn-add-line" onClick={() => setLineItems(p => [...p, newLineItem()])} type="button">
          <i className="fas fa-plus"></i> Add Line Item
        </button>
      </div>
    </div>
  );
});

export default ServiceCalculator;
