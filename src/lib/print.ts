/**
 * Printing a sheet — and, through the browser's own "Save as PDF", exporting one.
 *
 * There is no server-side PDF renderer here on purpose: producing one means
 * shipping a headless browser, which the Cloudflare Pages target can't run
 * (docs/deployment.md). The print stylesheet in `app.css` is the PDF's design,
 * and every browser's print dialog will save it as a file.
 *
 * The one thing CSS can't do is unset the dark theme: a game's dark palette is
 * scoped more specifically than any shell-level print override, and nobody wants
 * a black page and an empty toner cartridge. So we drop the `dark` class for the
 * duration of the print and put it back afterwards — which also means each game's
 * *light* theme (designed to look like paper) is what prints.
 */

/** Print the current page as a sheet, in light theme, restoring the theme after. */
export function printSheet(doc: Document = document, win: Window = window): void {
	const root = doc.documentElement;
	const wasDark = root.classList.contains('dark');
	if (wasDark) root.classList.remove('dark');

	const restore = (): void => {
		if (wasDark) root.classList.add('dark');
		win.removeEventListener('afterprint', restore);
	};
	win.addEventListener('afterprint', restore);

	win.print();

	// Safari fires `afterprint` unreliably; a timer makes the restore certain
	// (a double restore is harmless — the listener removes itself).
	setTimeout(restore, 1000);
}
