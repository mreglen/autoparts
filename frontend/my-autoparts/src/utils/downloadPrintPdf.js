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
    const inSignTable = Boolean(el.closest('.repair-order-sign-table'));
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

    if (inSignTable) {
      text.style.cssText = [
        'display:inline',
        'margin:0',
        'padding:0',
        'border:0',
        'background:transparent',
        'color:#000',
        'font:inherit',
        'line-height:1.35',
        'white-space:nowrap',
        'text-decoration:none',
      ].join(';');
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
    if (cell.closest('.repair-order-sign-table')) return;
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

function copyFormValues(source, target) {
  const srcFields = source.querySelectorAll('input, textarea, select');
  const dstFields = target.querySelectorAll('input, textarea, select');
  srcFields.forEach((el, index) => {
    const dest = dstFields[index];
    if (!dest) return;
    dest.value = el.value;
    if (el.tagName === 'SELECT') dest.selectedIndex = el.selectedIndex;
  });
}

function sheetPageSize(orientation) {
  if (orientation === 'landscape') {
    return { page: 'A4 landscape', width: '297mm', height: '210mm' };
  }
  return { page: 'A4 portrait', width: '210mm', height: '297mm' };
}

function waitNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

function waitForStyles(doc) {
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')];
  if (links.length === 0) return Promise.resolve();

  return Promise.race([
    Promise.all(
      links.map(
        (link) =>
          new Promise((resolve) => {
            if (link.sheet) {
              resolve();
              return;
            }
            link.addEventListener('load', () => resolve(), { once: true });
            link.addEventListener('error', () => resolve(), { once: true });
          }),
      ),
    ),
    new Promise((resolve) => {
      setTimeout(resolve, 1500);
    }),
  ]);
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
    [data-print-sheet="true"] .repair-order-sign-table td {
      height: auto !important;
      min-height: 0 !important;
      padding: 1px 2px !important;
      line-height: 1.35 !important;
      vertical-align: bottom !important;
      white-space: nowrap !important;
      word-break: normal !important;
    }
    [data-print-sheet="true"] footer > table td {
      height: auto !important;
      min-height: 0 !important;
      padding: 2px 4px !important;
      vertical-align: top !important;
      word-break: normal !important;
      border: 0 !important;
    }
  `;
  clonedDoc.head.appendChild(style);

  sheet.style.boxShadow = 'none';
  sheet.style.margin = '0';
  sheet.style.background = '#fff';

  flattenFormFields(sheet);
  normalizeTableCells(sheet);
}

function cloneSheetForOutput(source) {
  const clone = source.cloneNode(true);
  copyFormValues(source, clone);
  flattenFormFields(clone);
  normalizeTableCells(clone);
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  clone.style.background = '#fff';
  clone.style.maxWidth = 'none';
  clone.style.transform = 'none';
  return clone;
}

function copyDocumentStyles(targetDoc) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    targetDoc.head.appendChild(node.cloneNode(true));
  });
}

function attachA4PrintStyles(targetDoc, orientation) {
  const { page, width, height } = sheetPageSize(orientation);
  const style = targetDoc.createElement('style');
  style.setAttribute('data-a4-print', 'true');
  style.textContent = `
    @page {
      size: ${page};
      margin: 0;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #fff !important;
      color: #000 !important;
      width: ${width} !important;
      min-height: ${height} !important;
      overflow: visible !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
      color-scheme: only light;
    }
    [data-print-sheet="true"] {
      box-sizing: border-box !important;
      width: ${width} !important;
      max-width: none !important;
      min-height: ${height} !important;
      margin: 0 !important;
      box-shadow: none !important;
      background: #fff !important;
      color: #000 !important;
      font-family: Arial, Helvetica, "Liberation Sans", sans-serif !important;
      transform: none !important;
      zoom: 1 !important;
    }
    .upd-edit,
    .upd-uv .upd-edit,
    input,
    textarea,
    select {
      background: transparent !important;
      color: #000 !important;
      box-shadow: none !important;
    }
  `;
  targetDoc.head.appendChild(style);
}

/**
 * Печать листа в диалоге браузера как настоящий A4, без масштаба экранного предпросмотра.
 */
export async function printDocumentSheet(element, { orientation = 'portrait' } = {}) {
  if (!element) {
    throw new Error('Нет документа для печати');
  }

  const { width, height } = sheetPageSize(orientation);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Печать документа');
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${width}`,
    `height:${height}`,
    'border:0',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(iframe);

  const frameDoc = iframe.contentDocument;
  frameDoc.open();
  frameDoc.write('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
  frameDoc.close();

  copyDocumentStyles(frameDoc);
  attachA4PrintStyles(frameDoc, orientation);
  frameDoc.body.appendChild(cloneSheetForOutput(element));

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    iframe.remove();
  };

  try {
    await waitForStyles(frameDoc);
    if (frameDoc.fonts?.ready) {
      await frameDoc.fonts.ready.catch(() => {});
    }
    await waitNextPaint();
    iframe.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } catch (error) {
    cleanup();
    throw error;
  }
  setTimeout(cleanup, 60000);
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

  const { width, height } = sheetPageSize(orientation);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = [
    'position:fixed',
    'left:-10000px',
    'top:0',
    `width:${width}`,
    'margin:0',
    'padding:0',
    'background:#fff',
    'opacity:1',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  const clone = cloneSheetForOutput(element);
  clone.style.width = width;
  clone.style.maxWidth = 'none';
  clone.style.minHeight = height;
  host.appendChild(clone);
  document.body.appendChild(host);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => {});
    }
    await waitNextPaint();

    const canvasWidth = clone.scrollWidth || clone.offsetWidth;
    const canvasHeight = clone.scrollHeight || clone.offsetHeight;
    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      scrollX: 0,
      scrollY: 0,
      width: canvasWidth,
      height: canvasHeight,
      windowWidth: canvasWidth,
      windowHeight: canvasHeight,
      foreignObjectRendering: false,
      onclone: (clonedDoc) => {
        prepareSheetForPdf(
          clonedDoc,
          clonedDoc.querySelector('[data-print-sheet="true"]') || clonedDoc.body,
        );
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
    const imgData = canvas.toDataURL('image/jpeg', 0.98);

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
  } finally {
    host.remove();
  }
}
