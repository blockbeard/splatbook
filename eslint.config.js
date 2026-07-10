import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';

export default ts.config(
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist/',
			'node_modules/',
			// Game content and pipeline output are data, not lintable source.
			'content/'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			// Allow intentionally-unused args/vars when underscore-prefixed
			// (e.g. typed-but-unused mock parameters).
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser
			}
		}
	},
	{
		// These pages resolve a route then append a `?id=`/`?archived=` query,
		// which the typed-route rule can't verify. Path resolution is still used;
		// only the query is concatenated.
		// (`[game]` would be read as a glob char-class, so match the segment with `*`.)
		files: [
			'src/routes/dashboard/+page.svelte',
			'src/routes/g/*/*/build/+page.svelte',
			'src/routes/g/*/*/sheet/+page.svelte',
			'src/routes/g/*/*/play/+page.svelte'
		],
		rules: {
			'svelte/no-navigation-without-resolve': 'off'
		}
	}
);
