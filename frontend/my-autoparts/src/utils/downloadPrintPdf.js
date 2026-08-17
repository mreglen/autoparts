function safePdfName(name) {
  const text = String(name || 'document')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return text || 'document';
}

function flattenFormFields(root) {
  root.querySelectorAll('input, textarea, select').forEach((el) => {
    const span = document.createElement(el.tagName === 'TEXTAREA' ? 'div' : 'span');
    const value =
      el.tagName === 'SELECT'
        ? el.options[el.selectedIndex]?.text || el.value || ''
        : el.value || '';
    span.textContent = value || '\u00a0';
    span.style.whiteSpace = el.tagName === 'TEXTAREA' ? 'pre-wrap' : 'pre-wrap';
    span.style.color = '#000';
    span.style.background = 'transparent';
    span.style.border = '0';
    span.style.borderBottom = el.tagName === 'TEXTAREA' ? '0' : '1px solid #000';
    span.style.font = 'inherit';
    span.style.lineHeight = 'inherit';
    span.style.display = el.tagName === 'TEXTAREA' ? 'block' : 'inline';
    span.style.minWidth = '1em';
    el.replaceWith(span);
  });
}

export async function downloadPrintSheetPdf({
  element,
  filename,
  orientation = 'portrait',
}) {
  if (!element) {
    throw new Error('Нет документа для сохранения');
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (clonedDoc) => {
      clonedDoc
        .querySelectorAll(
          '[role="dialog"], .fixed.inset-0, .upd-print-toolbar, .repair-order-print-toolbar',
        )
        .forEach((node) => {
          node.style.display = 'none';
        });
      const sheet = clonedDoc.querySelector('[data-print-sheet="true"]') || clonedDoc.body;
      sheet.style.boxShadow = 'none';
      sheet.style.margin = '0';
      flattenFormFields(sheet);
    },
  });

  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
  } else {
    let offset = 0;
    let first = true;
    while (offset < imgHeight) {
      if (!first) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -offset, imgWidth, imgHeight);
      offset += pageHeight;
      first = false;
    }
  }

  pdf.save(`${safePdfName(filename)}.pdf`);
}
