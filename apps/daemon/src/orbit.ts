import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';

import type { OrbitConfigPrefs } from './app-config.js';

export interface OrbitConnectorRunResult {
  connectorId: string;
  connectorName: string;
  accountLabel?: string;
  toolName?: string;
  toolTitle?: string;
  status: 'succeeded' | 'skipped' | 'failed';
  summary: string;
  error?: string;
}

export interface OrbitActivitySummary {
  id: string;
  startedAt: string;
  completedAt: string;
  trigger: 'manual' | 'scheduled';
  connectorsChecked: number;
  connectorsSucceeded: number;
  connectorsFailed: number;
  connectorsSkipped: number;
  artifactId?: string;
  artifactProjectId?: string;
  agentRunId?: string;
  markdown: string;
  results: OrbitConnectorRunResult[];
}

export interface OrbitAgentRunResult {
  agentRunId: string;
  status: 'succeeded' | 'failed' | 'canceled';
  artifactId?: string;
  artifactProjectId?: string;
  summary?: string;
}

export interface OrbitRunHandlerStart {
  projectId: string;
  agentRunId: string;
  completion: Promise<OrbitAgentRunResult>;
}

export type OrbitRunHandler = (request: {
  runId: string;
  trigger: 'manual' | 'scheduled';
  startedAt: string;
  prompt: string;
}) => Promise<OrbitRunHandlerStart>;

export function formatLocalProjectTimestamp(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export type OrbitTemplateResolver = (skillId: string) => Promise<{
  id: string;
  name: string;
  examplePrompt: string;
} | null>;

export interface OrbitStatus {
  config: OrbitConfigPrefs;
  running: boolean;
  nextRunAt: string | null;
  lastRun: OrbitActivitySummary | null;
}

export const DEFAULT_ORBIT_CONFIG: OrbitConfigPrefs = {
  enabled: false,
  time: '08:00',
  templateSkillId: null,
};

const SUMMARY_FILE = 'activity-summary.json';

function normalizeOrbitConfig(config: Partial<OrbitConfigPrefs> | undefined): OrbitConfigPrefs {
  const time = typeof config?.time === 'string' && /^\d{2}:\d{2}$/.test(config.time)
    ? config.time
    : DEFAULT_ORBIT_CONFIG.time;
  return {
    enabled: Boolean(config?.enabled),
    time,
    templateSkillId: typeof config?.templateSkillId === 'string' && config.templateSkillId.trim()
      ? config.templateSkillId.trim()
      : null,
  };
}

function orbitDir(dataDir: string): string {
  return path.join(dataDir, 'orbit');
}

function summaryFile(dataDir: string): string {
  return path.join(orbitDir(dataDir), SUMMARY_FILE);
}

async function readLastSummary(dataDir: string): Promise<OrbitActivitySummary | null> {
  try {
    const raw = await readFile(summaryFile(dataDir), 'utf8');
    const parsed = JSON.parse(raw) as OrbitActivitySummary;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeLastSummary(dataDir: string, summary: OrbitActivitySummary): Promise<void> {
  const dir = orbitDir(dataDir);
  await mkdir(dir, { recursive: true });
  const target = summaryFile(dataDir);
  const tmp = `${target}.${randomBytes(4).toString('hex')}.tmp`;
  await writeFile(tmp, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await rename(tmp, target);
}

function nextDailyRunAt(time: string, now = new Date()): Date {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const next = new Date(now);
  next.setHours(Number.isFinite(hours) ? hours : 8, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function renderMarkdown(summary: Omit<OrbitActivitySummary, 'markdown'>): string {
  const lines = [
    `# Daily Orbit Activity Summary`,
    '',
    `Generated: ${summary.completedAt}`,
    `Trigger: ${summary.trigger}`,
    '',
    `Checked ${summary.connectorsChecked} connector(s): ${summary.connectorsSucceeded} succeeded, ${summary.connectorsSkipped} skipped, ${summary.connectorsFailed} failed.`,
    '',
  ];
  for (const result of summary.results) {
    const title = result.accountLabel ? `${result.connectorName} (${result.accountLabel})` : result.connectorName;
    lines.push(`## ${title}`);
    lines.push(`- Status: ${result.status}`);
    if (result.toolTitle || result.toolName) lines.push(`- Tool: ${result.toolTitle ?? result.toolName}`);
    lines.push(`- Summary: ${result.summary}`);
    if (result.error) lines.push(`- Error: ${result.error}`);
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

export function buildOrbitPrompt(now = new Date(), template?: {
  id: string;
  name: string;
  examplePrompt: string;
} | null): string {
  const end = now.toISOString();
  const start = new Date(now.getTime() - 24 * 60 * 60_000).toISOString();
  const lines = [
    'Create a Live Artifact for Orbit: a concise, useful activity digest for the past 24 hours.',
    '',
    `Time window: ${start} through ${end}.`,
    '',
    'This is an autonomous scheduled/manual Orbit job. Do not ask follow-up questions, do not emit a question form, and do not wait for user input. Use sensible defaults and proceed.',
    'Optimize for fast completion: use at most 3 connector executions and avoid broad schema spelunking unless a command fails. After `tools live-artifacts create` returns ok, send one concise final message with the artifact id and stop.',
    '',
    'Use the live-artifact skill to author and register the artifact. Use the Open Design CLI wrappers to discover and call connectors:',
    '- List available connected connector tools with `"$OD_NODE_BIN" "$OD_BIN" tools connectors list`.',
    '- Decide which read-only connector tools are appropriate for the 24h activity window; do not rely on daemon-provided tool choices.',
    '- Execute only the connector tools needed for a useful digest with `"$OD_NODE_BIN" "$OD_BIN" tools connectors execute --connector <id> --tool <name> --input .orbit-tmp/<connector>-<tool>.json` after writing a small JSON input file. Always write these inputs under the `.orbit-tmp/` subdirectory (create it if missing) — files at the project root show up in the user-facing Design Files panel, while dot-prefixed paths are hidden. Reuse the same path when retrying the same tool.',
    '- Prefer search/list/activity-style tools. Avoid provider metadata, api_root, schema, health, status, broad fetch_all, or block-content dump tools unless they are truly necessary.',
    '',
    'Refreshable source registration (required for the manual Refresh button to work):',
    '- The artifact must declare a single `document.sourceJson` of `type: "connector_tool"` so the daemon knows what to re-run on manual refresh. With no source declared, the user gets "no refreshable source" when clicking Refresh.',
    '- Pick the most representative read-only connector tool you actually executed for this digest (typically an activity/search/list tool over the 24h window). Reuse the same connector + tool + input you successfully ran above.',
    '- Set `document.sourceJson` to: `{ "type": "connector_tool", "toolName": "<tool>", "input": <same JSON object you passed to --input>, "connector": { "connectorId": "<id>", "toolName": "<tool>", "accountLabel": "<label if known>" }, "refreshPermission": "manual_refresh_granted_for_read_only" }`. Keep `input` bounded and free of credentials/raw payloads.',
    '- Even though the digest aggregates several connectors, only one source can be registered for refresh; choose the one whose re-run best represents "what changed in the last 24h" for the user.',
    '',
    'The artifact should include:',
    '- Executive summary: 3-5 bullets of the most important changes/activity.',
    '- GitHub section when available: recently pushed repositories, meaningful issues/PRs, or other notable activity. Example inputs to consider: repository search with pushed/updated filters, issue/PR tools if available and relevant.',
    '- Notion section when available: recently relevant pages/databases/tasks. Example inputs to consider: Notion search with date/time keywords or edited/updated page/database tools if available.',
    '- Connector coverage: which connectors/tools were used, skipped, or unavailable, with short reasons.',
    '- Links or identifiers when connector output provides them.',
    '',
    'Few-shot examples of good synthesis:',
    '- GitHub: “open-design had 4 repositories updated in the window; the most notable activity was a push to apps/daemon touching connector execution and a PR discussing Orbit automation.”',
    '- Notion: “Product Notes and Launch Checklist were the only matching pages; Launch Checklist changed around connector onboarding and should be reviewed before release.”',
    '',
    'Keep the artifact compact: a single responsive HTML view, no more than roughly 200 lines of template/CSS, and no lengthy design critique pass. If connector data is sparse, still create the Live Artifact and clearly say what was checked and what was missing. Do not invent activity. Keep the visual design polished but lightweight.',
  ];
  if (template) {
    lines.push(
      '',
      'Selected Orbit example template:',
      `- Skill id: ${template.id}`,
      `- Skill name: ${template.name}`,
      '',
      `Invoke the ${template.id} Agent skill for this artifact's structure, visual language, and domain-specific synthesis rules. The selected template's example prompt is:`,
      '',
      template.examplePrompt.trim(),
    );
  }
  return lines.join('\n');
}

export class OrbitService {
  private config: OrbitConfigPrefs = DEFAULT_ORBIT_CONFIG;
  private timer: NodeJS.Timeout | null = null;
  private nextRunAtValue: Date | null = null;
  private starting: Promise<{ projectId: string; agentRunId: string }> | null = null;
  private inflight: Promise<OrbitActivitySummary> | null = null;
  private inflightProjectId: string | null = null;
  private inflightAgentRunId: string | null = null;
  private runHandler: OrbitRunHandler | null = null;
  private templateResolver: OrbitTemplateResolver | null = null;

  constructor(private readonly dataDir: string) {}

  setRunHandler(handler: OrbitRunHandler): void {
    this.runHandler = handler;
  }

  setTemplateResolver(resolver: OrbitTemplateResolver): void {
    this.templateResolver = resolver;
  }

  configure(config: Partial<OrbitConfigPrefs> | undefined): void {
    this.config = normalizeOrbitConfig(config);
    this.reschedule();
  }

  async status(): Promise<OrbitStatus> {
    return {
      config: this.config,
      running: this.starting !== null || this.inflight !== null,
      nextRunAt: this.nextRunAtValue?.toISOString() ?? null,
      lastRun: await readLastSummary(this.dataDir),
    };
  }

  async start(trigger: 'manual' | 'scheduled'): Promise<{ projectId: string; agentRunId: string }> {
    if (this.inflight && this.inflightProjectId && this.inflightAgentRunId) {
      return { projectId: this.inflightProjectId, agentRunId: this.inflightAgentRunId };
    }
    if (this.starting) return this.starting;
    if (!this.runHandler) throw new Error('Orbit agent runner is not configured');

    this.starting = this.startRun(trigger).finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async startRun(trigger: 'manual' | 'scheduled'): Promise<{ projectId: string; agentRunId: string }> {
    if (!this.runHandler) throw new Error('Orbit agent runner is not configured');

    const startedAt = new Date().toISOString();
    const runId = `orbit-${randomUUID()}`;
    const template = this.config.templateSkillId && this.templateResolver
      ? await this.templateResolver(this.config.templateSkillId).catch(() => null)
      : null;
    const prompt = buildOrbitPrompt(new Date(startedAt), template);
    const handlerStart = await this.runHandler({ runId, trigger, startedAt, prompt });

    this.inflightProjectId = handlerStart.projectId;
    this.inflightAgentRunId = handlerStart.agentRunId;
    this.inflight = (async () => {
      try {
        const agentResult = await handlerStart.completion;
        const completedAt = new Date().toISOString();
        const base = {
          id: runId,
          startedAt,
          completedAt,
          trigger,
          connectorsChecked: 0,
          connectorsSucceeded: agentResult.status === 'succeeded' ? 1 : 0,
          connectorsFailed: agentResult.status === 'failed' ? 1 : 0,
          connectorsSkipped: agentResult.status === 'canceled' ? 1 : 0,
          agentRunId: agentResult.agentRunId,
          ...(agentResult.artifactId === undefined ? {} : { artifactId: agentResult.artifactId }),
          ...(agentResult.artifactProjectId === undefined ? {} : { artifactProjectId: agentResult.artifactProjectId }),
          results: [{
            connectorId: 'agent-runtime',
            connectorName: 'Orbit Agent',
            status: agentResult.status === 'succeeded' ? 'succeeded' : agentResult.status === 'failed' ? 'failed' : 'skipped',
            summary: agentResult.summary ?? `Agent run ${agentResult.status}.`,
          } satisfies OrbitConnectorRunResult],
        };
        const summary: OrbitActivitySummary = {
          ...base,
          markdown: renderMarkdown(base),
        };
        await writeLastSummary(this.dataDir, summary);
        return summary;
      } finally {
        this.inflight = null;
        this.inflightProjectId = null;
        this.inflightAgentRunId = null;
        this.reschedule();
      }
    })();
    this.inflight.catch((error) => {
      console.warn('[orbit] Run failed:', error);
    });

    return { projectId: handlerStart.projectId, agentRunId: handlerStart.agentRunId };
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.nextRunAtValue = null;
  }

  private reschedule(): void {
    this.stop();
    if (!this.config.enabled) return;
    const next = nextDailyRunAt(this.config.time);
    this.nextRunAtValue = next;
    this.timer = setTimeout(() => {
      void this.start('scheduled').catch((error) => {
        console.warn('[orbit] Scheduled run failed:', error);
      });
    }, Math.max(0, next.getTime() - Date.now()));
  }
}
