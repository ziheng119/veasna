// Writes a complete HTML document into a pop-up window and opens the print dialog once its images
// (e.g. the letterhead logo) have loaded. Images that fail to load are removed rather than printed
// as broken icons. Printing is never held up for more than a few seconds.
const IMAGE_WAIT_MS = 3000;

export function writeAndPrint(popup: Window, html: string) {
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();

  const images = Array.from(popup.document.images ?? []);
  let printed = false;
  const print = () => {
    if (printed) return;
    printed = true;
    for (const image of images) if (!image.naturalWidth) image.remove();
    popup.print();
  };

  const loading = images.filter((image) => !image.complete);
  if (loading.length === 0) return print();
  let left = loading.length;
  const settle = () => { if (--left === 0) print(); };
  for (const image of loading) {
    image.addEventListener("load", settle, { once: true });
    image.addEventListener("error", settle, { once: true });
  }
  setTimeout(print, IMAGE_WAIT_MS);
}
