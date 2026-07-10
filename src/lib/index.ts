// Shell-level constants and exports. Game-specific code belongs in src/lib/games/<gameId>/.

export const APP_NAME = 'Splatbook';

/** Public source for the (GPL-3.0-or-later) application. */
export const APP_REPO_URL = 'https://github.com/blockbeard/splatbook';

/** Prior art the framework's architecture is modelled on (credited on /credits). */
export const INSPIRATIONS = [
	{ name: 'guild-book', url: 'https://github.com/arrowedisgaming/guild-book' },
	{
		name: 'Miskatonic University Registrar',
		url: 'https://github.com/arrowedisgaming/MiskatonicUniversityRegistrar'
	}
] as const;
