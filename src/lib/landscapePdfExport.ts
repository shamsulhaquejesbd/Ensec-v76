import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export interface ExportElementToLandscapePdfOptions {
  element: HTMLElement;
  fileName: string;
  marginMm?: number;
  minCaptureWidthPx?: number;
  tableBorderStyle?: 'thin-black-grid' | 'preserve';
}

interface CapturedLineBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface CapturedTableGrid {
  tableBox: CapturedLineBox;
  cells: CapturedLineBox[];
}

function drawVectorTableGridForSlice(
  pdf: jsPDF,
  grids: CapturedTableGrid[],
  rootWidthPx: number,
  cssSliceTop: number,
  cssSliceBottom: number,
  sliceOffsetXMm: number,
  sliceOffsetYMm: number,
  sliceWidthMm: number,
  sliceHeightMm: number
): void {
  if (grids.length === 0 || rootWidthPx <= 0 || cssSliceBottom <= cssSliceTop) return;

  const sliceCssHeight = cssSliceBottom - cssSliceTop;
  const mapX = (cssX: number) => sliceOffsetXMm + (cssX / rootWidthPx) * sliceWidthMm;
  const mapY = (cssY: number) =>
    sliceOffsetYMm + ((cssY - cssSliceTop) / sliceCssHeight) * sliceHeightMm;

  const drawHorizontal = (x1: number, x2: number, y: number) => {
    if (x2 <= x1 + 0.05) return;
    if (y < cssSliceTop - 0.1 || y > cssSliceBottom + 0.1) return;
    const clampedY = Math.min(Math.max(y, cssSliceTop), cssSliceBottom);
    pdf.line(mapX(x1), mapY(clampedY), mapX(x2), mapY(clampedY));
  };

  const drawVertical = (x: number, y1: number, y2: number) => {
    const cy1 = Math.max(y1, cssSliceTop);
    const cy2 = Math.min(y2, cssSliceBottom);
    if (cy2 <= cy1 + 0.05) return;
    pdf.line(mapX(x), mapY(cy1), mapX(x), mapY(cy2));
  };

  pdf.setDrawColor(25, 25, 25);
  pdf.setLineWidth(0.09);
  pdf.setLineCap('square');

  for (const grid of grids) {
    const { tableBox, cells } = grid;
    drawHorizontal(tableBox.left, tableBox.right, tableBox.top);
    drawVertical(tableBox.left, tableBox.top, tableBox.bottom);

    for (const cell of cells) {
      drawVertical(cell.right, cell.top, cell.bottom);
      drawHorizontal(cell.left, cell.right, cell.bottom);
    }
  }
}

export async function exportElementToLandscapePdf({
  element,
  fileName,
  marginMm = 6,
  minCaptureWidthPx = 1400,
  tableBorderStyle = 'thin-black-grid',
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

  let measuredRootWidth = captureWidth;
  let measuredRootHeight = 0;
  const capturedGrids: CapturedTableGrid[] = [];

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
      clonedEl.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-hidden').forEach((wrap) => {
        wrap.style.overflow = 'visible';
        wrap.style.width = 'auto';
      });

      if (tableBorderStyle === 'thin-black-grid') {
        // Keep 0.5px transparent borders during rasterization so cell geometry stays identical
        // while crisp thin dark-black grid lines are drawn as true PDF vectors below.
        clonedEl.querySelectorAll<HTMLTableElement>('table').forEach((tbl) => {
          tbl.style.borderCollapse = 'separate';
          tbl.style.borderSpacing = '0';
          tbl.style.borderTop = '0.5px solid transparent';
          tbl.style.borderLeft = '0.5px solid transparent';
          tbl.style.borderRight = 'none';
          tbl.style.borderBottom = 'none';
          tbl.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
            cell.style.borderTop = 'none';
            cell.style.borderLeft = 'none';
            cell.style.borderRight = '0.5px solid transparent';
            cell.style.borderBottom = '0.5px solid transparent';
          });
        });

        // Force reflow after setting capture width & border styles, then record exact geometry
        void clonedEl.offsetHeight;
        const rootRect = clonedEl.getBoundingClientRect();
        measuredRootWidth = rootRect.width || captureWidth;
        measuredRootHeight = rootRect.height || clonedEl.scrollHeight;

        clonedEl.querySelectorAll<HTMLTableElement>('table').forEach((tbl) => {
          const tblRect = tbl.getBoundingClientRect();
          if (tblRect.width <= 0 || tblRect.height <= 0) return;
          const cells: CapturedLineBox[] = [];
          tbl.querySelectorAll<HTMLTableCellElement>('th, td').forEach((cell) => {
            const r = cell.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return;
            cells.push({
              left: r.left - rootRect.left,
              top: r.top - rootRect.top,
              right: r.right - rootRect.left,
              bottom: r.bottom - rootRect.top,
            });
          });
          capturedGrids.push({
            tableBox: {
              left: tblRect.left - rootRect.left,
              top: tblRect.top - rootRect.top,
              right: tblRect.right - rootRect.left,
              bottom: tblRect.bottom - rootRect.top,
            },
            cells,
          });
        });
      }
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
  const rootHeightPx = measuredRootHeight > 0 ? measuredRootHeight : canvas.height / 2;

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

    if (tableBorderStyle === 'thin-black-grid') {
      drawVectorTableGridForSlice(
        pdf,
        capturedGrids,
        measuredRootWidth,
        0,
        rootHeightPx,
        offsetX,
        marginMm,
        renderW,
        renderH
      );
    }
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

        if (tableBorderStyle === 'thin-black-grid') {
          const cssSliceTop = (offsetPx / canvas.height) * rootHeightPx;
          const cssSliceBottom = ((offsetPx + sliceH) / canvas.height) * rootHeightPx;
          drawVectorTableGridForSlice(
            pdf,
            capturedGrids,
            measuredRootWidth,
            cssSliceTop,
            cssSliceBottom,
            marginMm,
            marginMm,
            maxW,
            sliceHeightMm
          );
        }
      }
      offsetPx += sliceH;
      pageIdx++;
    }
  }

  pdf.save(fileName);
}
