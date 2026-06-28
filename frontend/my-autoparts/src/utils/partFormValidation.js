const REQUIRED_FIELD_ORDER = [
  'article',
  'name',
  'brand',
  'part_type_id',
  'quantity',
  'sale_price',
  'storage_location_id',
];

export function validatePartForm(formData) {
  const errors = {};

  if (!formData.article?.toString().trim()) {
    errors.article = true;
  }
  if (!formData.name?.toString().trim()) {
    errors.name = true;
  }
  if (!formData.brand?.toString().trim()) {
    errors.brand = true;
  }
  if (!formData.part_type_id) {
    errors.part_type_id = true;
  }
  const price = parseFloat(formData.sale_price);
  if (formData.sale_price === '' || formData.sale_price == null || Number.isNaN(price)) {
    errors.sale_price = true;
  }
  const quantity = parseInt(formData.quantity, 10);
  if (formData.quantity === '' || formData.quantity == null || Number.isNaN(quantity)) {
    errors.quantity = true;
  }
  if (!formData.storage_location_id) {
    errors.storage_location_id = true;
  }

  return errors;
}

export function hasPartFormErrors(errors) {
  return Object.keys(errors).length > 0;
}

export function partFieldClass(hasError) {
  return [
    'mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm',
    hasError
      ? 'border-red-500 ring-1 ring-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500',
  ].join(' ');
}

export function partFieldLabelClass(hasError) {
  return `block text-sm font-medium${hasError ? ' text-red-600' : ''}`;
}

export function scrollToFirstPartFormError(errors) {
  const firstField = REQUIRED_FIELD_ORDER.find((field) => errors[field]);
  if (!firstField) return;

  const wrapper = document.querySelector(`[data-part-field="${firstField}"]`);
  wrapper?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const control = wrapper?.querySelector('input, select, textarea');
  control?.focus({ preventScroll: true });
}
