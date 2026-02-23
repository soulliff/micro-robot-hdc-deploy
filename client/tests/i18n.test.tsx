import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider, useI18n } from '../src/lib/i18n';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Since the translations record is not exported, we verify key parity
 * by parsing the raw source file for both locale blocks.
 * We also test the t() function through the useI18n hook.
 */

// Inline snapshot of ALL keys that the i18n module defines.
const EXPECTED_KEYS = [
  'app.title', 'app.subtitle', 'app.subtitle.mobile', 'app.muted', 'app.sfx',
  'app.keys', 'app.replay',
  'view.2d', 'view.3d', 'view.heat',
  'panel.commands', 'panel.mission', 'panel.mission.active', 'panel.fleet',
  'panel.network', 'panel.consensus', 'panel.hdcStats', 'panel.history',
  'panel.eventLog', 'panel.detail',
  'mission.choose', 'mission.survey', 'mission.survey.desc', 'mission.intercept',
  'mission.intercept.desc', 'mission.searchClassify', 'mission.searchClassify.desc',
  'mission.perimeter', 'mission.perimeter.desc', 'mission.stop', 'mission.score',
  'mission.classified', 'mission.expired', 'mission.total', 'mission.time', 'mission.type',
  'robot.coordinator', 'robot.zone', 'robot.tick', 'robot.jammed', 'robot.byzantine',
  'robot.forceReturn', 'robot.markByz', 'robot.clearByz', 'robot.recover',
  'robot.bleNeighbors', 'robot.hdcInference', 'robot.confidenceTrend',
  'feed.online', 'feed.radar', 'feed.camera', 'feed.spectrum',
  'stats.noData', 'stats.clickRobot',
  'hdc.accuracy', 'hdc.runMission', 'hdc.inferences', 'hdc.correct', 'hdc.wrong',
  'hdc.rolling', 'hdc.perSpecies',
  'history.title', 'history.noMissions', 'history.missions',
  'serial.notSupported', 'serial.connect', 'serial.disconnect',
  'serial.connectFirst', 'serial.notAvailable',
];

function parseTranslationKeys(locale: 'en' | 'zh'): string[] {
  const src = fs.readFileSync(
    path.resolve(__dirname, '../src/lib/i18n.ts'),
    'utf-8',
  );
  // Find the block for the given locale
  const localePattern = new RegExp(
    `${locale}:\\s*\\{([\\s\\S]*?)\\}\\s*,?\\s*(?:zh:|\\};)`,
    'm',
  );
  const match = src.match(localePattern);
  if (!match) throw new Error(`Could not find '${locale}' block in i18n.ts`);
  const block = match[1];
  // Extract quoted keys
  const keys: string[] = [];
  const keyPattern = /'([^']+)'\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = keyPattern.exec(block)) !== null) {
    keys.push(m[1]);
  }
  return keys;
}

describe('i18n translations', () => {
  const enKeys = parseTranslationKeys('en');
  const zhKeys = parseTranslationKeys('zh');

  it('en locale has all expected keys', () => {
    for (const key of EXPECTED_KEYS) {
      expect(enKeys, `en missing key: ${key}`).toContain(key);
    }
  });

  it('zh locale has all expected keys', () => {
    for (const key of EXPECTED_KEYS) {
      expect(zhKeys, `zh missing key: ${key}`).toContain(key);
    }
  });

  it('en and zh have the same set of keys', () => {
    const enSet = new Set(enKeys);
    const zhSet = new Set(zhKeys);

    const missingInZh = enKeys.filter(k => !zhSet.has(k));
    const missingInEn = zhKeys.filter(k => !enSet.has(k));

    expect(missingInZh, `Keys in en but missing in zh: ${missingInZh.join(', ')}`).toEqual([]);
    expect(missingInEn, `Keys in zh but missing in en: ${missingInEn.join(', ')}`).toEqual([]);
  });

  it('no unexpected keys beyond EXPECTED_KEYS exist', () => {
    const expectedSet = new Set(EXPECTED_KEYS);
    const extraEn = enKeys.filter(k => !expectedSet.has(k));
    const extraZh = zhKeys.filter(k => !expectedSet.has(k));

    expect(extraEn, `Unexpected en keys: ${extraEn.join(', ')}`).toEqual([]);
    expect(extraZh, `Unexpected zh keys: ${extraZh.join(', ')}`).toEqual([]);
  });
});

describe('t() function via I18nProvider', () => {
  function TestConsumer({ translationKey }: { translationKey: string }) {
    const { t } = useI18n();
    return <span data-testid="result">{t(translationKey)}</span>;
  }

  it('returns the English string for a known key', () => {
    render(
      <I18nProvider>
        <TestConsumer translationKey="app.title" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('Micro-Robot HDC Swarm Console');
  });

  it('returns the key itself for an unknown key', () => {
    render(
      <I18nProvider>
        <TestConsumer translationKey="nonexistent.key" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('result').textContent).toBe('nonexistent.key');
  });
});
