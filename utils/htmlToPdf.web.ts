// Web-only: render a full HTML document string into a real, downloaded PDF file.
// Renders in a hidden, style-isolated iframe (so the document's global CSS never
// leaks into the app), rasterizes with html2canvas, then paginates into a true
// multi-page PDF that the browser saves to the user's device — no popup, no
// print dialog, no new tab.

function ensurePdfName(filename: string): string {
  const trimmed = (filename || 'document').trim() || 'document';
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

async function waitForDocumentReady(doc: Document): Promise<void> {
  if (doc.readyState !== 'complete') {
    await new Promise<void>((resolve) => {
      const win = doc.defaultView;
      const done = () => resolve();
      win?.addEventListener('load', done, { once: true });
      setTimeout(done, 3000);
    });
  }

  // Wait for every <img> to finish (or fail) so nothing is blank in the capture.
  const images = Array.from(doc.images || []);
  await Promise.all(
    images.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener('load', done, { once: true });
            img.addEventListener('error', done, { once: true });
            setTimeout(done, 5000);
          }),
    ),
  );

  // Wait for web fonts when supported, then a short settle for layout.
  try {
    await (doc as any).fonts?.ready;
  } catch {
    /* ignore */
  }
  await new Promise((r) => setTimeout(r, 120));
}

export async function htmlToPdf(html: string, filename: string): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('htmlToPdf can only run in a browser environment.');
  }

  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // A4 width at 96dpi ≈ 794px. Fixing the render width keeps line breaks and
  // layout consistent regardless of the user's screen size.
  const RENDER_WIDTH = 794;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '0';
  iframe.style.top = '0';
  iframe.style.width = `${RENDER_WIDTH}px`;
  iframe.style.height = '10px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-1';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Could not access the rendering frame.');
    doc.open();
    doc.write(html);
    doc.close();

    await waitForDocumentReady(doc);

    const body = doc.body;
    const target = doc.documentElement;
    const fullHeight = Math.max(
      body.scrollHeight,
      body.offsetHeight,
      target.scrollHeight,
      target.offsetHeight,
    );

    // Give the iframe its full content height so layout is complete before capture.
    iframe.style.height = `${fullHeight}px`;

    // Browsers cap canvas dimensions (~16k px / total area). Use 2x for crispness
    // normally, but scale *down* (below 1 when necessary) for very long documents
    // so generation never silently produces a blank/over-limit canvas.
    const MAX_CANVAS_PX = 14000;
    const scale = Math.min(2, MAX_CANVAS_PX / fullHeight);

    const canvas = await html2canvas(body, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: RENDER_WIDTH,
      windowHeight: fullHeight,
      width: RENDER_WIDTH,
      height: fullHeight,
      scrollX: 0,
      scrollY: 0,
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(ensurePdfName(filename));
  } finally {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  }
}
