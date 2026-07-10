import { describe, expect, it } from 'vitest';
import { APP_NAME } from './index.ts';

describe('smoke', () => {
	it('exports the app name', () => {
		expect(APP_NAME).toBe('Splatbook');
	});
});
