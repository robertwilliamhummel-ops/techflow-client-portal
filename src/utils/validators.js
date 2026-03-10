// Validate customer — name and phone are required (matches customer.js)
export const validateCustomer = (customer) => {
  const errors = [];
  if (!customer.name?.trim()) errors.push('Customer name is required');
  if (!customer.phone?.trim()) errors.push('Customer phone is required');
  return errors;
};

// Validate that email exists for sending (not required to save)
export const validateCustomerEmail = (customer) => {
  if (!customer.email?.trim()) return 'Customer email is required to send invoice';
  return null;
};

// Validate services — matches calculator.js validateInvoiceData()
export const validateServices = (hourlyServices, lineItems) => {
  const errors = [];

  const hasHourly = hourlyServices && hourlyServices.length > 0;
  const hasLineItems = lineItems && lineItems.length > 0;

  if (!hasHourly && !hasLineItems) {
    errors.push('Please add at least one service or line item');
    return errors;
  }

  if (hasHourly) {
    hourlyServices.forEach((service, i) => {
      if (!service.serviceType) errors.push(`Hourly service ${i + 1}: Please select a service type`);
      if (service.hours <= 0) errors.push(`Hourly service ${i + 1}: Hours worked must be greater than 0`);
      if (service.rate <= 0) errors.push(`Hourly service ${i + 1}: Hourly rate must be greater than 0`);
    });
  }

  if (hasLineItems) {
    lineItems.forEach((item, i) => {
      if (!item.description?.trim()) errors.push(`Line item ${i + 1}: Description is required`);
      if (item.quantity <= 0) errors.push(`Line item ${i + 1}: Quantity must be greater than 0`);
      if (item.price <= 0) errors.push(`Line item ${i + 1}: Price must be greater than 0`);
    });
  }

  return errors;
};

// Full invoice validation (customer + services)
export const validateInvoice = (customer, hourlyServices, lineItems) => {
  return [
    ...validateCustomer(customer),
    ...validateServices(hourlyServices, lineItems),
  ];
};
