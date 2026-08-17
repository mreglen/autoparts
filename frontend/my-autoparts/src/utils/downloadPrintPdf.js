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
    const isMultiline = el.tagName === 'TEXTAREA';
    const value =
      el.tagName === 'SELECT'
        ? el.options[el.selectedIndex]?.text || el.value || ''
        : el.value || '';

    const text = document.createElement(isMultiline ? 'div' : 'span');
    text.textContent = value || '\u00a0';
    text.style.cssText = [
      'display:block',
      'margin:0',
      'padding:0',
      'border:0',
      'background:transparent',
      'color:#000',
      'font:inherit',
      'line-height:1.35',
      'white-space:pre-wrap',
      'text-decoration:none',
    ].join(';');

    if (isMultiline) {
      el.replaceWith(text);
      return;
    }

    const wrap = document.createElement('span');
    wrap.style.cssText = [
      'display:inline-block',
      'vertical-align:baseline',
      'box-sizing:border-box',
      'margin:0',
      'padding:0 2px 3px',
      'border:0',
      'border-bottom:1px solid #000',
      'background:transparent',
      'color:#000',
      'font:inherit',
      'line-height:1.35',
      'min-width:1em',
      'max-width:100%',
      'text-decoration:none',
    ].join(';');
    wrap.appendChild(text);
    el.replaceWith(wrap);
  });
}

function normalizeTableCells(sheet) {
  sheet.querySelectorAll('td, th').forEach((cell) => {
    cell.classList.remove('h-5');
    const isBorderless = cell.classList.contains('border-0');

    cell.style.setProperty('height', 'auto', 'important');
    cell.style.setProperty('line-height', '1.45', 'important');
    cell.style.setProperty('vertical-align', 'top', 'important');
    cell.style.setProperty('overflow', 'visible', 'important');
    cell.style.setProperty('box-sizing', 'border-box', 'important');
    cell.style.setProperty('word-break', 'break-word', 'important');

    if (isBorderless) {
      cell.style.setProperty('min-height', '0', 'important');
      cell.style.setProperty('padding', '2px 4px', 'important');
      return;
    }

    cell.style.setProperty('min-height', '22px', 'important');
    cell.style.setProperty('padding', '5px 4px', 'important');
  });
}

function prepareSheetForPdf(clonedDoc, sheet) {
  const style = clonedDoc.createElement('style');
  style.textContent = `
    [data-print-sheet="true"],
    [data-print-sheet="true"] * {
      text-decoration: none !important;
      box-shadow: none !important;
      text-underline-offset: 0 !important;
    }
    [data-print-sheet="true"] {
      box-shadow: none !important;
      margin: 0 !important;
      background: #fff !important;
      font-family: Arial, Helvetica, sans-serif !important;
    }
    [data-print-sheet="true"] .leading-tight {
      line-height: 1.45 !important;
    }
    [data-print-sheet="true"] table {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
    }
    [data-print-sheet="true"] th,
    [data-print-sheet="true"] td {
      height: auto !important;
      line-height: 1.45 !important;
      overflow: visible !important;
      vertical-align: top !important;
      box-sizing: border-box !important;
    }
    [data-print-sheet="true"] .invoice-bank td {
      height: auto !important;
      min-height: 22px !important;
      padding: 5px 4px !important;
    }
  `;
  clonedDoc.head.appendChild(style);

  sheet.style.boxShadow = 'none';
  sheet.style.margin = '0';
  sheet.style.background = '#fff';

  flattenFormFields(sheet);
  normalizeTableCells(sheet);
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
    scrollX: 0,
    scrollY: 0,
    foreignObjectRendering: false,
    onclone: (clonedDoc) => {
      clonedDoc
        .querySelectorAll(
          '[role="dialog"], .fixed.inset-0, .upd-print-toolbar, .repair-order-print-toolbar',
        )
        .forEach((node) => {
          node.style.display = 'none';
        });
      const sheet = clonedDoc.querySelector('[data-print-sheet="true"]') || clonedDoc.body;
      prepareSheetForPdf(clonedDoc, sheet);
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
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

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
