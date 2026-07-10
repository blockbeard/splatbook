/**
 * Content-pack envelope types.
 *
 * A content pack is a folder under `static/content-packs/<gameId>/` carrying
 * everything game-visible for one game: data files, licensing, attribution.
 * The shell knows only this envelope; the *contents* of pack files are typed
 * and validated by the owning game module (see `docs/architecture.md`).
 */

/** `manifest.json` at the root of every content pack. */
export interface PackManifest {
	/** Game id, kebab-case. Must match the pack's folder name. */
	id: string;
	/** Display name of the game. */
	name: string;
	/** Version of the pack content (semver). Independent of the app version. */
	version: string;
	/** License of the pack *text* (SPDX identifier, e.g. "CC-BY-SA-4.0"). */
	license: string;
	/** Human-readable credit line, e.g. author and publisher. */
	attribution: string;
	/** Data files belonging to this pack, as paths relative to the pack root. */
	files: string[];
}

/** Thrown by loaders when a pack is missing, malformed, or incomplete. */
export class PackError extends Error {
	constructor(
		message: string,
		/** Pack folder the error relates to. */
		public readonly packRoot: string,
		/** File within the pack, if the error is file-specific. */
		public readonly file?: string
	) {
		super(file ? `${packRoot}/${file}: ${message}` : `${packRoot}: ${message}`);
		this.name = 'PackError';
	}
}
