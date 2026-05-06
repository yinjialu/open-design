import assert from 'node:assert/strict';
import test from 'node:test';
import { createDesktopHarness, waitFor } from './desktop-test-helpers.ts';

const desktop = createDesktopHarness('settings-api-protocol');

type SettingsSnapshot = {
  selectedTab: string | null;
  quickFillProvider: string | null;
  baseUrl: string | null;
  modelSelectValue: string | null;
  customModelValue: string | null;
  dialogOpen: boolean;
};

test.before(async () => {
  await desktop.start();
});

test.after(async () => {
  await desktop.stop();
});

test('legacy known OpenAI provider switches to the matching Anthropic preset', async () => {
  await runScenarioWithDebugScreenshot(
    'legacy-known-openai-provider',
    async () => {
      await seedLegacyConfigAndReload({
        mode: 'api',
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-chat',
        agentId: null,
        skillId: null,
        designSystemId: null,
        onboardingCompleted: true,
        mediaProviders: {},
        agentModels: {},
      });

      await openSettings();

      await waitFor(() => assertSettingsSnapshot((snapshot) => {
        assert.equal(snapshot.dialogOpen, true);
        assert.equal(snapshot.selectedTab, 'OpenAI API');
        assert.equal(snapshot.quickFillProvider, 'DeepSeek — OpenAI');
        assert.equal(snapshot.baseUrl, 'https://api.deepseek.com');
      }));

      await clickTab('Anthropic API');

      await waitFor(() => assertSettingsSnapshot((snapshot) => {
        assert.equal(snapshot.selectedTab, 'Anthropic API');
        assert.equal(snapshot.quickFillProvider, 'DeepSeek — Anthropic');
        assert.equal(snapshot.baseUrl, 'https://api.deepseek.com/anthropic');
        assert.equal(snapshot.modelSelectValue, 'deepseek-chat');
      }));
    },
  );
});

test('legacy custom provider preserves custom baseUrl and model when switching protocols', async () => {
  await runScenarioWithDebugScreenshot(
    'legacy-custom-provider',
    async () => {
      await seedLegacyConfigAndReload({
        mode: 'api',
        apiKey: 'sk-test',
        baseUrl: 'https://my-proxy.example.com/v1',
        model: 'my-custom-model',
        agentId: null,
        skillId: null,
        designSystemId: null,
        onboardingCompleted: true,
        mediaProviders: {},
        agentModels: {},
      });

      await openSettings();

      await waitFor(() => assertSettingsSnapshot((snapshot) => {
        assert.equal(snapshot.dialogOpen, true);
        assert.equal(snapshot.selectedTab, 'OpenAI API');
        assert.equal(snapshot.quickFillProvider, 'Custom provider');
        assert.equal(snapshot.baseUrl, 'https://my-proxy.example.com/v1');
        assert.equal(snapshot.customModelValue, 'my-custom-model');
      }));

      await clickTab('Anthropic API');

      await waitFor(() => assertSettingsSnapshot((snapshot) => {
        assert.equal(snapshot.selectedTab, 'Anthropic API');
        assert.equal(snapshot.quickFillProvider, 'Custom provider');
        assert.equal(snapshot.baseUrl, 'https://my-proxy.example.com/v1');
        assert.equal(snapshot.customModelValue, 'my-custom-model');
      }));
    },
  );
});

async function runScenarioWithDebugScreenshot(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    await desktop.screenshot(name).catch(() => undefined);
    throw error;
  }
}

async function seedLegacyConfigAndReload(config: Record<string, unknown>): Promise<void> {
  await desktop.seedConfigAndReload(config, 'baseUrl');
}

async function openSettings(): Promise<void> {
  await desktop.openSettings();
}

async function clickTab(label: 'Anthropic API' | 'OpenAI API'): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const tab = Array.from(document.querySelectorAll('[role="tab"]'))
        .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
      if (!(tab instanceof HTMLElement)) return false;
      tab.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click ${label} tab.`);
}

async function assertSettingsSnapshot(assertion: (snapshot: SettingsSnapshot) => void | Promise<void>): Promise<void> {
  const snapshot = await readSettingsSnapshot();
  await assertion(snapshot);
}

async function readSettingsSnapshot(): Promise<SettingsSnapshot> {
  return await desktop.eval<SettingsSnapshot>(`
    (() => {
      const labelFields = Array.from(document.querySelectorAll('label.field'));
      const getField = (label) => {
        const field = labelFields.find((node) =>
          node.querySelector('.field-label')?.textContent?.trim() === label,
        );
        if (!field) return null;
        const control = field.querySelector('input, select, textarea');
        if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
          return null;
        }
        if (control instanceof HTMLSelectElement) {
          const option = control.selectedOptions.item(0);
          return { value: control.value, text: option?.textContent?.trim() ?? null };
        }
        return { value: control.value, text: null };
      };

      const activeTab = Array.from(document.querySelectorAll('[role="tab"]'))
        .find((node) => node.getAttribute('aria-selected') === 'true');
      const baseUrl = getField('Base URL');
      const model = getField('Model');
      const quickFill = getField('Quick fill provider');
      const customModel = getField('Custom model id');

      return {
        selectedTab: activeTab?.querySelector('.seg-title')?.textContent?.trim() ?? null,
        quickFillProvider: quickFill?.text ?? quickFill?.value ?? null,
        baseUrl: baseUrl?.value ?? null,
        modelSelectValue: model?.value ?? null,
        customModelValue: customModel?.value ?? null,
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
      };
    })()
  `);
}
