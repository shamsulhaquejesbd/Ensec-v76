import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface ExportElementToLandscapePdfOptions {
  element: HTMLElement;
  fileName: string;
  marginMm?: number;
  minCaptureWidthPx?: number;
}

export async function exportElementToLandscapePdf({
  element,
  fileName,
  marginMm = 6,
  minCaptureWidthPx = 1400,
}: ExportElementToLandscapePdfOptions): Promise<void> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const tableEl = element.querySelector('table');
  const captureWidth = Math.max(
    element.scrollWidth,
    tableEl ? tableEl.scrollWidth + 32 : 0,
    minCaptureWidthPx
  );

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    logging: false,
    width: captureWidth,
    windowWidth: captureWidth,
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.width = `${captureWidth}px`;
      clonedEl.style.maxWidth = 'none';
      clonedEl.style.overflow = 'visible';
      clonedEl.style.margin = '0';
      clonedEl.style.border = 'none';
      clonedEl.style.borderRadius = '0';
      clonedEl.style.boxShadow = 'none';
      clonedEl.querySelectorAll<HTMLElement>('.overflow-x-auto').forEach((scrollWrap) => {
        scrollWrap.style.overflow = 'visible';
        scrollWrap.style.width = 'auto';
      });
      const thinBorderColor =
        typeof window !== 'undefined' && window.devicePixelRatio < 1.5
          ? 'rgba(17, 17, 17, 0.78)'
          : '#1a1a1a';
      clonedEl.querySelectorAll<HTMLTableElement>('table').forEach((tbl) => {
        tbl.style.borderCollapse = 'separate';
        tbl.style.borderSpacing = '0';
        tbl.style.borderTop = `0.5px solid ${thinBorderColor}`;
        tbl.style.borderLeft = `0.5px solid ${thinBorderColor}`;
        tbl.style.borderRight = 'none';
        tbl.style.borderBottom = 'none';
        tbl.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
          cell.style.borderTop = 'none';
          cell.style.borderLeft = 'none';
          cell.style.borderRight = `0.5px solid ${thinBorderColor}`;
          cell.style.borderBottom = `0.5px solid ${thinBorderColor}`;
        });
      });
    },
  });

  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const maxW = pageWidth - marginMm * 2;
  const maxH = pageHeight - marginMm * 2;
  const totalImgHeightMm = (canvas.height * maxW) / canvas.width;

  if (totalImgHeightMm <= maxH * 1.05) {
    let renderW = maxW;
    let renderH = totalImgHeightMm;
    if (renderH > maxH) {
      renderH = maxH;
      renderW = renderH * (canvas.width / canvas.height);
    }
    const offsetX = (pageWidth - renderW) / 2;
    const imgData = canvas.toDataURL('image/png', 1.0);
    pdf.addImage(imgData, 'PNG', offsetX, marginMm, renderW, renderH, undefined, 'FAST');
  } else {
    const pxPerMm = canvas.height / totalImgHeightMm;
    const pageSlicePx = Math.max(1, Math.floor(maxH * pxPerMm));
    let offsetPx = 0;
    let pageIdx = 0;

    while (offsetPx < canvas.height) {
      const sliceH = Math.min(pageSlicePx, canvas.height - offsetPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceH;
      const ctx = sliceCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          offsetPx,
          canvas.width,
          sliceH,
          0,
          0,
          canvas.width,
          sliceH
        );
        const sliceData = sliceCanvas.toDataURL('image/png', 1.0);
        const sliceHeightMm = sliceH / pxPerMm;
        if (pageIdx > 0) {
          pdf.addPage('a4', 'landscape');
        }
        pdf.addImage(sliceData, 'PNG', marginMm, marginMm, maxW, sliceHeightMm, undefined, 'FAST');
      }
      offsetPx += sliceH;
      pageIdx++;
    }
  }

  pdf.save(fileName);
}
