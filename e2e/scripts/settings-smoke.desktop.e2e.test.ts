import assert from 'node:assert/strict';
import test from 'node:test';
import { createDesktopHarness, STORAGE_KEY, waitFor } from './desktop-test-helpers.ts';

const desktop = createDesktopHarness('settings-smoke');

type SmokeSnapshot = {
  dialogOpen: boolean;
  heading: string | null;
  apiSectionTitle: string | null;
  baseUrl: string | null;
  model: string | null;
  modeApiSelected: boolean;
};

type AppearanceSnapshot = {
  dialogOpen: boolean;
  activeTheme: string | null;
  documentTheme: string | null;
  savedTheme: string | null;
};

type LanguageSnapshot = {
  dialogOpen: boolean;
  activeLocaleLabel: string | null;
  activeLocaleCode: string | null;
  htmlLang: string | null;
  savedLocale: string | null;
};

type MediaSnapshot = {
  dialogOpen: boolean;
  configuredBadgeVisible: boolean;
  savedApiKey: string | null;
  savedBaseUrl: string | null;
};

type ExecutionSnapshot = {
  dialogOpen: boolean;
  daemonSelected: boolean;
  apiSelected: boolean;
  sectionTitle: string | null;
};

type AboutSnapshot = {
  dialogOpen: boolean;
  version: string | null;
  channel: string | null;
  runtime: string | null;
  platform: string | null;
  architecture: string | null;
  fallbackVisible: boolean;
};

type MaxTokensSnapshot = {
  dialogOpen: boolean;
  maxTokensValue: string | null;
  savedMaxTokens: number | null;
};

type WelcomeSnapshot = {
  dialogOpen: boolean;
  heading: string | null;
  primaryButton: string | null;
  secondaryButton: string | null;
  savedOnboardingCompleted: boolean | null;
};

type ComposerSeedSnapshot = {
  projectTitle: string | null;
  composerValue: string | null;
  chatEmptyVisible: boolean;
  persistedPendingPrompt: string | null;
};

type FirstMessageSnapshot = {
  projectTitle: string | null;
  conversationTitle: string | null;
  composerValue: string | null;
  userMessages: string[];
  assistantMessageCount: number;
  errorText: string | null;
  persistedMessages: Array<{ role: string; content: string }>;
};

test.before(async () => {
  await desktop.start();
});

test.after(async () => {
  await desktop.stop();
});

test('desktop settings smoke opens the current API configuration on main', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();

  await waitFor(async () => {
    const snapshot = await readSmokeSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.heading, 'Execution & model');
    assert.equal(snapshot.apiSectionTitle, 'Anthropic API');
    assert.equal(snapshot.baseUrl, 'https://api.anthropic.com');
    assert.equal(snapshot.model, 'claude-sonnet-4-5');
    assert.equal(snapshot.modeApiSelected, true);
  });
});

test('appearance preview applies immediately and reverts on cancel', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'theme');

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);
  await clickSegmentButton('Dark');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeTheme, 'Dark');
    assert.equal(snapshot.documentTheme, 'dark');
    assert.equal(snapshot.savedTheme, 'system');
  });

  await clickFooterButtonByClass('ghost');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.documentTheme, null);
    assert.equal(snapshot.savedTheme, 'system');
  });
});

test('appearance save persists the selected theme', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'theme');

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);
  await clickSegmentButton('Dark');
  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.documentTheme, 'dark');
    assert.equal(snapshot.savedTheme, 'dark');
  });

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeTheme, 'Dark');
    assert.equal(snapshot.documentTheme, 'dark');
    assert.equal(snapshot.savedTheme, 'dark');
  });
});

test('appearance save persists the light theme', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'theme');

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);
  await clickSegmentButton('Light');
  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.documentTheme, 'light');
    assert.equal(snapshot.savedTheme, 'light');
  });

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeTheme, 'Light');
    assert.equal(snapshot.documentTheme, 'light');
    assert.equal(snapshot.savedTheme, 'light');
  });
});

test('appearance can switch from an explicit theme back to system', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'dark',
  }, 'theme');

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);
  await clickSegmentButton('System');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeTheme, 'System');
    assert.equal(snapshot.documentTheme, null);
    assert.equal(snapshot.savedTheme, 'dark');
  });

  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.documentTheme, null);
    assert.equal(snapshot.savedTheme, 'system');
  });

  await desktop.openSettings();
  await openSettingsSectionByIndex(3);

  await waitFor(async () => {
    const snapshot = await readAppearanceSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeTheme, 'System');
    assert.equal(snapshot.documentTheme, null);
    assert.equal(snapshot.savedTheme, 'system');
  });
});

test('language selection updates html lang and persists the chosen locale', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');
  await desktop.eval(`
    (() => {
      window.localStorage.setItem('open-design:locale', 'en');
      document.documentElement.setAttribute('lang', 'en');
      return true;
    })()
  `);

  await desktop.openSettings();
  await openSettingsSectionByIndex(2);
  await toggleLanguageMenu();
  await selectLanguageOption('Deutsch');

  await waitFor(async () => {
    const snapshot = await readLanguageSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.activeLocaleLabel, 'Deutsch');
    assert.equal(snapshot.activeLocaleCode, 'de');
    assert.equal(snapshot.htmlLang, 'de');
    assert.equal(snapshot.savedLocale, 'de');
  });

  await clickFooterButtonByClass('primary');

  await desktop.openSettings();
  await openSettingsSectionByIndex(2);

  await waitFor(async () => {
    const snapshot = await readLanguageSnapshot();
    assert.equal(snapshot.activeLocaleLabel, 'Deutsch');
    assert.equal(snapshot.activeLocaleCode, 'de');
    assert.equal(snapshot.htmlLang, 'de');
    assert.equal(snapshot.savedLocale, 'de');
  });
});

test('media provider credentials save into localStorage config', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();
  await openSettingsSectionByIndex(1);
  await setInputValueByAriaLabel('OpenAI API key', 'media-openai-key');
  await setInputValueByAriaLabel('OpenAI Base URL', 'https://media-proxy.example.com/v1');

  await waitFor(async () => {
    const snapshot = await readMediaSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.configuredBadgeVisible, true);
  });

  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readMediaSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.savedApiKey, 'media-openai-key');
    assert.equal(snapshot.savedBaseUrl, 'https://media-proxy.example.com/v1');
  });
});

test('execution mode can switch between API and Local CLI when desktop runtime is live', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();

  await waitFor(async () => {
    const snapshot = await readExecutionSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.apiSelected, true);
    assert.equal(snapshot.sectionTitle, 'Anthropic API');
  });

  await clickTabByText('Local CLI');

  await waitFor(async () => {
    const snapshot = await readExecutionSnapshot();
    assert.equal(snapshot.daemonSelected, true);
    assert.equal(snapshot.apiSelected, false);
    assert.equal(snapshot.sectionTitle, 'Code agent');
  });

  await clickTabByText('Anthropic API');

  await waitFor(async () => {
    const snapshot = await readExecutionSnapshot();
    assert.equal(snapshot.daemonSelected, false);
    assert.equal(snapshot.apiSelected, true);
    assert.equal(snapshot.sectionTitle, 'Anthropic API');
  });
});

test('max tokens saves and clears as an optional override', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    maxTokens: undefined,
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();
  await setInputValueByFieldLabel('Max tokens (optional)', '4096');
  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readMaxTokensSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.savedMaxTokens, 4096);
  });

  await desktop.openSettings();
  await waitFor(async () => {
    const snapshot = await readMaxTokensSnapshot();
    assert.equal(snapshot.maxTokensValue, '4096');
  });

  await setInputValueByFieldLabel('Max tokens (optional)', '');
  await clickFooterButtonByClass('primary');

  await waitFor(async () => {
    const snapshot = await readMaxTokensSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.savedMaxTokens, null);
  });
});

test('about section shows runtime metadata when daemon is online', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();
  await openSettingsSectionByIndex(4);

  await waitFor(async () => {
    const snapshot = await readAboutSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.fallbackVisible, false);
    assert.ok(snapshot.version);
    assert.ok(snapshot.channel);
    assert.ok(snapshot.runtime);
    assert.ok(snapshot.platform);
    assert.ok(snapshot.architecture);
  });
});

test('welcome settings can be skipped once and do not reopen on reload', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: '',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: false,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'onboardingCompleted');

  await waitFor(async () => {
    const snapshot = await readWelcomeSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.heading, 'Set up Open Design');
    assert.equal(snapshot.secondaryButton, 'Skip for now');
    assert.equal(snapshot.primaryButton, 'Get started');
    assert.equal(snapshot.savedOnboardingCompleted, false);
  });

  await clickFooterButtonByClass('ghost');

  await waitFor(async () => {
    const snapshot = await readWelcomeSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.savedOnboardingCompleted, true);
  });

  await desktop.eval(`window.location.reload(); true`);

  await waitFor(async () => {
    const snapshot = await readWelcomeSnapshot();
    assert.equal(snapshot.dialogOpen, false);
    assert.equal(snapshot.savedOnboardingCompleted, true);
  });
});

test('quick fill provider updates base url and model on the API settings page', async () => {
  await resetLocaleToEnglish();
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  await desktop.openSettings();
  await setSelectValueByFieldLabel('Quick fill provider', '1');

  await waitFor(async () => {
    const snapshot = await readSmokeSnapshot();
    assert.equal(snapshot.baseUrl, 'https://token-plan-cn.xiaomimimo.com/v1');
    assert.equal(snapshot.model, 'mimo-v2.5-pro');
  });
});

test('project view settings entry opens the same settings dialog after creating a project', async () => {
  await resetLocaleToEnglish();
  const projectName = `Desktop settings flow ${Date.now()}`;
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  const projectId = await desktop.eval<string>(`
    (async () => {
      const id = crypto.randomUUID();
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: ${JSON.stringify(projectName)},
          skillId: null,
          designSystemId: null,
          metadata: { projectType: 'other' },
        }),
      });
      if (!resp.ok) throw new Error('create project failed: ' + resp.status);
      const json = await resp.json();
      const target = '/projects/' + encodeURIComponent(json.project.id);
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return json.project.id;
    })()
  `);
  assert.ok(projectId);

  await waitFor(async () => {
    const inProject = await desktop.eval<boolean>(`
      (() => {
        const title = document.querySelector('[data-testid="project-title"]')?.textContent?.trim();
        return title === ${JSON.stringify(projectName)}
          && Boolean(document.querySelector('.app-chrome-back'))
          && Boolean(document.querySelector('.settings-icon-btn'));
      })()
    `);
    assert.equal(inProject, true);
  }, 30_000);

  await clickSelector('.settings-icon-btn');
  await waitFor(async () => {
    const popoverOpen = await desktop.eval<boolean>(`Boolean(document.querySelector('.avatar-popover'))`);
    assert.equal(popoverOpen, true);
  });
  await clickAvatarMenuItem('Settings');

  await waitFor(async () => {
    const snapshot = await readSmokeSnapshot();
    assert.equal(snapshot.dialogOpen, true);
    assert.equal(snapshot.heading, 'Execution & model');
  });
});

test('pending prompt seeds the composer when a new project opens and stays available after reload', async () => {
  await resetLocaleToEnglish();
  const projectName = `Pending prompt seed ${Date.now()}`;
  const pendingPrompt = 'Draft a launch-ready landing page for a payroll startup.';
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  const projectId = await desktop.eval<string>(`
    (async () => {
      const id = crypto.randomUUID();
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: ${JSON.stringify(projectName)},
          skillId: null,
          designSystemId: null,
          pendingPrompt: ${JSON.stringify(pendingPrompt)},
          metadata: { projectType: 'other' },
        }),
      });
      if (!resp.ok) throw new Error('create project failed: ' + resp.status);
      const json = await resp.json();
      const target = '/projects/' + encodeURIComponent(json.project.id);
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return json.project.id;
    })()
  `);
  assert.ok(projectId);

  await waitFor(async () => {
    const snapshot = await readComposerSeedSnapshot(projectId);
    assert.equal(snapshot.projectTitle, projectName);
    assert.equal(snapshot.composerValue, pendingPrompt);
    assert.equal(snapshot.chatEmptyVisible, true);
  }, 30_000);

  await desktop.eval(`
    (() => {
      const input = document.querySelector('[data-testid="chat-composer-input"]');
      if (!(input instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, '');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);

  await desktop.eval(`window.location.reload(); true`);

  await waitFor(async () => {
    const snapshot = await readComposerSeedSnapshot(projectId);
    assert.equal(snapshot.composerValue, pendingPrompt);
    assert.equal(snapshot.chatEmptyVisible, true);
  }, 30_000);
});

test('first project message updates the project title and persists the user turn even when the proxy request fails', async () => {
  await resetLocaleToEnglish();
  const projectName = `First message flow ${Date.now()}`;
  const prompt = 'Design a pricing page for a B2B analytics product with three plans.';
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  const bootstrap = await desktop.eval<{ projectId: string; conversationId: string }>(`
    (async () => {
      const id = crypto.randomUUID();
      const resp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: ${JSON.stringify(projectName)},
          skillId: null,
          designSystemId: null,
          metadata: { projectType: 'other' },
        }),
      });
      if (!resp.ok) throw new Error('create project failed: ' + resp.status);
      const json = await resp.json();
      const originalFetch = window.fetch.bind(window);
      window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
        if (url.includes('/api/proxy/stream') || url.includes('/api/proxy/anthropic/stream')) {
          return Promise.resolve(new Response('desktop-e2e-forced-failure', { status: 503 }));
        }
        return originalFetch(input, init);
      };
      const target = '/projects/' + encodeURIComponent(json.project.id);
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return { projectId: json.project.id, conversationId: json.conversationId };
    })()
  `);
  assert.ok(bootstrap.projectId);
  assert.ok(bootstrap.conversationId);

  await waitFor(async () => {
    const ready = await desktop.eval<boolean>(`
      (() => {
        const input = document.querySelector('[data-testid="chat-composer-input"]');
        return Boolean(
          document.querySelector('[data-testid="project-title"]') &&
          input instanceof HTMLTextAreaElement
        );
      })()
    `);
    assert.equal(ready, true);
  }, 30_000);

  await setComposerValue(prompt);
  await waitFor(async () => {
    const sendEnabled = await desktop.eval<boolean>(`
      (() => {
        const button = document.querySelector('[data-testid="chat-send"]');
        return button instanceof HTMLButtonElement && !button.disabled;
      })()
    `);
    assert.equal(sendEnabled, true);
  });
  await clickSelector('[data-testid="chat-send"]');

  await waitFor(async () => {
    const snapshot = await readFirstMessageSnapshot(bootstrap.projectId, bootstrap.conversationId);
    assert.equal(snapshot.projectTitle, projectName);
    assert.equal(snapshot.conversationTitle, prompt.slice(0, 60).trim());
    assert.equal(snapshot.userMessages.includes(prompt), true);
    assert.equal(snapshot.assistantMessageCount, 1);
    assert.equal(snapshot.persistedMessages.some((message) => message.role === 'user' && message.content === prompt), true);
    assert.equal(snapshot.composerValue, '');
  }, 30_000);
});

test('design files can be deleted from the design files browser and stay deleted after reload', async () => {
  await resetLocaleToEnglish();
  const projectName = `Delete design flow ${Date.now()}`;
  const fileName = 'delete-me.html';
  await desktop.seedConfigAndReload({
    mode: 'api',
    apiKey: 'sk-test',
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-5',
    agentId: null,
    skillId: null,
    designSystemId: null,
    onboardingCompleted: true,
    mediaProviders: {},
    agentModels: {},
    theme: 'system',
  }, 'model');

  const projectId = await desktop.eval<string>(`
    (async () => {
      window.confirm = () => true;
      const id = crypto.randomUUID();
      const createResp = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: ${JSON.stringify(projectName)},
          skillId: null,
          designSystemId: null,
          metadata: { projectType: 'other' },
        }),
      });
      if (!createResp.ok) throw new Error('create project failed: ' + createResp.status);
      const createJson = await createResp.json();
      const fileResp = await fetch('/api/projects/' + encodeURIComponent(createJson.project.id) + '/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: ${JSON.stringify(fileName)},
          content: '<!doctype html><html><body><main>delete me</main></body></html>',
        }),
      });
      if (!fileResp.ok) throw new Error('seed file failed: ' + fileResp.status);
      const target = '/projects/' + encodeURIComponent(createJson.project.id);
      window.history.pushState(null, '', target);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return createJson.project.id;
    })()
  `);
  assert.ok(projectId);

  await waitFor(async () => {
    const ready = await desktop.eval<boolean>(`
      (() => {
        return Boolean(
          document.querySelector('[data-testid="project-title"]') &&
          document.querySelector('[data-testid="design-files-tab"]')
        );
      })()
    `);
    assert.equal(ready, true);
  }, 30_000);

  await clickSelector('[data-testid="design-files-tab"]');

  await waitFor(async () => {
    const exists = await readDesignFileExists(projectId, fileName);
    assert.equal(exists.uiRowVisible, true);
    assert.equal(exists.persistedFileNames.includes(fileName), true);
  }, 30_000);

  await clickSelector(`[data-testid="design-file-menu-${fileName}"]`);
  await waitFor(async () => {
    const popoverOpen = await desktop.eval<boolean>(`Boolean(document.querySelector('[data-testid="design-file-menu-popover"]'))`);
    assert.equal(popoverOpen, true);
  });
  await clickPopoverButton('Delete');

  await waitFor(async () => {
    const exists = await readDesignFileExists(projectId, fileName);
    assert.equal(exists.uiRowVisible, false);
    assert.equal(exists.persistedFileNames.includes(fileName), false);
  }, 30_000);

  await desktop.eval(`window.location.reload(); true`);
  await waitFor(async () => {
    const exists = await readDesignFileExists(projectId, fileName);
    assert.equal(exists.uiRowVisible, false);
    assert.equal(exists.persistedFileNames.includes(fileName), false);
  }, 30_000);
});

async function readSmokeSnapshot(): Promise<SmokeSnapshot> {
  return await desktop.eval<SmokeSnapshot>(`
    (() => {
      const labelFields = Array.from(document.querySelectorAll('label.field'));
      const getInputValue = (label) => {
        const field = labelFields.find((node) =>
          node.querySelector('.field-label')?.textContent?.trim() === label,
        );
        const control = field?.querySelector('input, select, textarea');
        if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement)) {
          return null;
        }
        return control.value;
      };
      const apiTab = Array.from(document.querySelectorAll('[role="tab"]'))
        .find((node) => node.textContent?.includes('Anthropic API'));
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        heading: document.querySelector('.modal-head h2')?.textContent?.trim() ?? null,
        apiSectionTitle: document.querySelector('.settings-section .section-head h3')?.textContent?.trim() ?? null,
        baseUrl: getInputValue('Base URL'),
        model: getInputValue('Model'),
        modeApiSelected: apiTab?.getAttribute('aria-selected') === 'true',
      };
    })()
  `);
}

async function readAppearanceSnapshot(): Promise<AppearanceSnapshot> {
  return await desktop.eval<AppearanceSnapshot>(`
    (() => {
      const activeThemeButton = Array.from(document.querySelectorAll('[role="group"] .seg-btn'))
        .find((node) => node.getAttribute('aria-pressed') === 'true');
      const raw = window.localStorage.getItem(${JSON.stringify('open-design:config')});
      const savedTheme = raw ? JSON.parse(raw).theme ?? null : null;
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        activeTheme: activeThemeButton?.querySelector('.seg-title')?.textContent?.trim() ?? null,
        documentTheme: document.documentElement.getAttribute('data-theme'),
        savedTheme,
      };
    })()
  `);
}

async function readLanguageSnapshot(): Promise<LanguageSnapshot> {
  return await desktop.eval<LanguageSnapshot>(`
    (() => {
      const raw = window.localStorage.getItem('open-design:locale');
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        activeLocaleLabel: document.querySelector('.settings-language-title')?.textContent?.trim() ?? null,
        activeLocaleCode: document.querySelector('.settings-language-code')?.textContent?.trim() ?? null,
        htmlLang: document.documentElement.getAttribute('lang'),
        savedLocale: raw,
      };
    })()
  `);
}

async function readMediaSnapshot(): Promise<MediaSnapshot> {
  return await desktop.eval<MediaSnapshot>(`
    (() => {
      const raw = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        configuredBadgeVisible: Array.from(document.querySelectorAll('.media-provider-row'))
          .some((row) => row.textContent?.includes('OpenAI') && row.textContent?.includes('Configured')),
        savedApiKey: parsed?.mediaProviders?.openai?.apiKey ?? null,
        savedBaseUrl: parsed?.mediaProviders?.openai?.baseUrl ?? null,
      };
    })()
  `);
}

async function readExecutionSnapshot(): Promise<ExecutionSnapshot> {
  return await desktop.eval<ExecutionSnapshot>(`
    (() => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const localCliTab = tabs.find((node) => node.textContent?.includes('Local CLI'));
      const apiTab = tabs.find((node) => node.textContent?.includes('Anthropic API'));
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        daemonSelected: localCliTab?.getAttribute('aria-selected') === 'true',
        apiSelected: apiTab?.getAttribute('aria-selected') === 'true',
        sectionTitle: document.querySelector('.settings-section .section-head h3')?.textContent?.trim() ?? null,
      };
    })()
  `);
}

async function readMaxTokensSnapshot(): Promise<MaxTokensSnapshot> {
  return await desktop.eval<MaxTokensSnapshot>(`
    (() => {
      const raw = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const parsed = raw ? JSON.parse(raw) : null;
      const labelFields = Array.from(document.querySelectorAll('label.field'));
      const field = labelFields.find((node) =>
        node.querySelector('.field-label')?.textContent?.trim() === 'Max tokens (optional)',
      );
      const input = field?.querySelector('input');
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        maxTokensValue: input instanceof HTMLInputElement ? input.value : null,
        savedMaxTokens: typeof parsed?.maxTokens === 'number' ? parsed.maxTokens : null,
      };
    })()
  `);
}

async function readAboutSnapshot(): Promise<AboutSnapshot> {
  return await desktop.eval<AboutSnapshot>(`
    (() => {
      const rows = Array.from(document.querySelectorAll('.settings-about-list > div'));
      const readDd = (label) => {
        const row = rows.find((node) => node.querySelector('dt')?.textContent?.trim() === label);
        return row?.querySelector('dd')?.textContent?.trim() ?? null;
      };
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        version: readDd('Version'),
        channel: readDd('Channel'),
        runtime: readDd('Runtime'),
        platform: readDd('Platform'),
        architecture: readDd('Architecture'),
        fallbackVisible: Boolean(document.querySelector('.settings-section .empty-card')),
      };
    })()
  `);
}

async function readWelcomeSnapshot(): Promise<WelcomeSnapshot> {
  return await desktop.eval<WelcomeSnapshot>(`
    (() => {
      const raw = window.localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
      const parsed = raw ? JSON.parse(raw) : null;
      const footerButtons = Array.from(document.querySelectorAll('.modal-foot button'));
      return {
        dialogOpen: Boolean(document.querySelector('[role="dialog"]')),
        heading: document.querySelector('.modal-head h2')?.textContent?.trim() ?? null,
        primaryButton: footerButtons.find((node) => node.classList.contains('primary'))?.textContent?.trim() ?? null,
        secondaryButton: footerButtons.find((node) => node.classList.contains('ghost'))?.textContent?.trim() ?? null,
        savedOnboardingCompleted: typeof parsed?.onboardingCompleted === 'boolean' ? parsed.onboardingCompleted : null,
      };
    })()
  `);
}

async function readComposerSeedSnapshot(projectId: string): Promise<ComposerSeedSnapshot> {
  return await desktop.eval<ComposerSeedSnapshot>(`
    (async () => {
      const resp = await fetch('/api/projects/' + encodeURIComponent(${JSON.stringify(projectId)}));
      const json = resp.ok ? await resp.json() : null;
      const input = document.querySelector('[data-testid="chat-composer-input"]');
      return {
        projectTitle: document.querySelector('[data-testid="project-title"]')?.textContent?.trim() ?? null,
        composerValue: input instanceof HTMLTextAreaElement ? input.value : null,
        chatEmptyVisible: Boolean(document.querySelector('.chat-empty')),
        persistedPendingPrompt: json?.project?.pendingPrompt ?? null,
      };
    })()
  `);
}

async function readFirstMessageSnapshot(
  projectId: string,
  conversationId: string,
): Promise<FirstMessageSnapshot> {
  return await desktop.eval<FirstMessageSnapshot>(`
    (async () => {
      const messagesResp = await fetch(
        '/api/projects/' + encodeURIComponent(${JSON.stringify(projectId)}) +
        '/conversations/' + encodeURIComponent(${JSON.stringify(conversationId)}) +
        '/messages'
      );
      const conversationsResp = await fetch(
        '/api/projects/' + encodeURIComponent(${JSON.stringify(projectId)}) +
        '/conversations'
      );
      const messagesJson = messagesResp.ok ? await messagesResp.json() : { messages: [] };
      const conversationsJson = conversationsResp.ok ? await conversationsResp.json() : { conversations: [] };
      const conversation = Array.isArray(conversationsJson?.conversations)
        ? conversationsJson.conversations.find((entry) => entry?.id === ${JSON.stringify(conversationId)})
        : null;
      const composer = document.querySelector('[data-testid="chat-composer-input"]');
      const userMessages = Array.from(document.querySelectorAll('.msg.user .user-text'))
        .map((node) => node.textContent?.trim() ?? '');
      const assistantMessageCount = document.querySelectorAll('.msg.assistant').length;
      return {
        projectTitle: document.querySelector('[data-testid="project-title"]')?.textContent?.trim() ?? null,
        conversationTitle: typeof conversation?.title === 'string' ? conversation.title : null,
        composerValue: composer instanceof HTMLTextAreaElement ? composer.value : null,
        userMessages,
        assistantMessageCount,
        errorText: document.querySelector('.msg.error')?.textContent?.trim() ?? null,
        persistedMessages: Array.isArray(messagesJson?.messages)
          ? messagesJson.messages.map((message) => ({
              role: typeof message?.role === 'string' ? message.role : '',
              content: typeof message?.content === 'string' ? message.content : '',
            }))
          : [],
      };
    })()
  `);
}

async function readDesignFileExists(
  projectId: string,
  fileName: string,
): Promise<{ uiRowVisible: boolean; persistedFileNames: string[] }> {
  return await desktop.eval<{ uiRowVisible: boolean; persistedFileNames: string[] }>(`
    (async () => {
      const resp = await fetch('/api/projects/' + encodeURIComponent(${JSON.stringify(projectId)}) + '/files');
      const json = resp.ok ? await resp.json() : { files: [] };
      return {
        uiRowVisible: Boolean(document.querySelector(${JSON.stringify(`[data-testid="design-file-row-${fileName}"]`)})),
        persistedFileNames: Array.isArray(json?.files)
          ? json.files
              .map((file) => typeof file?.name === 'string' ? file.name : '')
              .filter(Boolean)
          : [],
      };
    })()
  `);
}

async function openSettingsSection(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('.settings-nav-item'))
        .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to open settings section: ${label}`);
}

async function openSettingsSectionByIndex(index: number): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('.settings-nav-item'));
      const button = buttons[${index}];
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to open settings section index: ${index}`);
}

async function clickTabByText(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('[role="tab"]'))
        .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click tab: ${label}`);
}

async function toggleLanguageMenu(): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = document.querySelector('.settings-language-button');
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, 'Expected to toggle language menu');
}

async function selectLanguageOption(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('.settings-language-option'))
        .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to select language option: ${label}`);
}

async function clickSegmentButton(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('.seg-btn'))
        .find((node) => node.textContent?.includes(${JSON.stringify(label)}));
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click segment button: ${label}`);
}

async function setInputValueByAriaLabel(label: string, value: string): Promise<void> {
  const updated = await desktop.eval(`
    (() => {
      const input = document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)});
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
        ?? Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert.equal(updated, true, `Expected to set input with aria-label: ${label}`);
}

async function setInputValueByFieldLabel(label: string, value: string): Promise<void> {
  const updated = await desktop.eval(`
    (() => {
      const labelFields = Array.from(document.querySelectorAll('label.field'));
      const field = labelFields.find((node) =>
        node.querySelector('.field-label')?.textContent?.trim() === ${JSON.stringify(label)},
      );
      const input = field?.querySelector('input, textarea');
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return false;
      const proto = input instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert.equal(updated, true, `Expected to set input with field label: ${label}`);
}

async function setComposerValue(value: string): Promise<void> {
  const updated = await desktop.eval(`
    (() => {
      const input = document.querySelector('[data-testid="chat-composer-input"]');
      if (!(input instanceof HTMLTextAreaElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert.equal(updated, true, 'Expected to set composer value');
}

async function setSelectValueByFieldLabel(label: string, value: string): Promise<void> {
  const updated = await desktop.eval(`
    (() => {
      const labelFields = Array.from(document.querySelectorAll('label.field'));
      const field = labelFields.find((node) =>
        node.querySelector('.field-label')?.textContent?.trim() === ${JSON.stringify(label)},
      );
      const select = field?.querySelector('select');
      if (!(select instanceof HTMLSelectElement)) return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
      setter?.call(select, ${JSON.stringify(value)});
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);
  assert.equal(updated, true, `Expected to set select with field label: ${label}`);
}

async function clickSelector(selector: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      if (!(node instanceof HTMLElement)) return false;
      node.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click selector: ${selector}`);
}

async function clickByTestId(testId: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const node = Array.from(document.querySelectorAll('[data-testid]'))
        .find((entry) => entry.getAttribute('data-testid') === ${JSON.stringify(testId)});
      if (!(node instanceof HTMLElement)) return false;
      node.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click test id: ${testId}`);
}

async function clickPopoverButton(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const popover = document.querySelector('[data-testid="design-file-menu-popover"]');
      if (!popover) return false;
      const button = Array.from(popover.querySelectorAll('button'))
        .find((entry) => entry.textContent?.trim() === ${JSON.stringify(label)});
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click popover button: ${label}`);
}

async function clickAvatarMenuItem(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('.avatar-popover .avatar-item'))
        .find((node) => node.textContent?.trim() === ${JSON.stringify(label)});
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click avatar menu item: ${label}`);
}

async function clickFooterButton(label: string): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = Array.from(document.querySelectorAll('.modal-foot button'))
        .find((node) => node.textContent?.trim() === ${JSON.stringify(label)});
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click footer button: ${label}`);
}

async function clickFooterButtonByClass(className: 'ghost' | 'primary'): Promise<void> {
  const clicked = await desktop.eval(`
    (() => {
      const button = document.querySelector(${JSON.stringify(`.modal-foot .${className}`)});
      if (!(button instanceof HTMLElement)) return false;
      button.click();
      return true;
    })()
  `);
  assert.equal(clicked, true, `Expected to click footer button class: ${className}`);
}

async function resetLocaleToEnglish(): Promise<void> {
  await desktop.eval(`
    (() => {
      window.localStorage.setItem('open-design:locale', 'en');
      document.documentElement.setAttribute('lang', 'en');
      return true;
    })()
  `);
}
