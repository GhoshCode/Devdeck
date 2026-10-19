import { FIRST_SECTION } from '../types';
// Demo data for manual testing (Settings → Data → Load demo data). Every id
// starts with "demo-" so the same panel can remove it again without touching
// anything the user created. Deterministic: the same call gives the same data
// (relative to `now`), so testers can compare notes.

import type { FeedSource, ProcessingItem, Repeat, Schedule, ScheduleFrequency, Todo, Topic } from '../types';
import type { Timer, TimerUnit } from './timer';
import { localDateKey } from './time';

export const DEMO_PREFIX = 'demo-';
export const isDemo = (id: string) => id.startsWith(DEMO_PREFIX);

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const pad = (n: number) => String(n).padStart(2, '0');

const FOCUS_SITES: Array<[string, string]> = [
  ['React', 'https://react.dev'], ['Vite', 'https://vite.dev'], ['Tailwind CSS', 'https://tailwindcss.com'], ['Next.js', 'https://nextjs.org'],
  ['Svelte', 'https://svelte.dev'], ['Vue', 'https://vuejs.org'], ['Angular', 'https://angular.dev'], ['Astro', 'https://astro.build'],
  ['Remix', 'https://remix.run'], ['Nuxt', 'https://nuxt.com'], ['SolidJS', 'https://www.solidjs.com'], ['Qwik', 'https://qwik.dev'],
  ['Preact', 'https://preactjs.com'], ['Lit', 'https://lit.dev'], ['htmx', 'https://htmx.org'], ['D3', 'https://d3js.org'],
  ['Three.js', 'https://threejs.org'], ['GSAP', 'https://gsap.com'], ['Storybook', 'https://storybook.js.org'], ['Vitest', 'https://vitest.dev'],
  ['Playwright', 'https://playwright.dev'], ['Cypress', 'https://www.cypress.io'], ['Webpack', 'https://webpack.js.org'], ['Rollup', 'https://rollupjs.org'],
  ['esbuild', 'https://esbuild.github.io'], ['SWC', 'https://swc.rs'], ['Turborepo', 'https://turbo.build'], ['Nx', 'https://nx.dev'],
  ['pnpm', 'https://pnpm.io'], ['Bun', 'https://bun.sh'], ['Deno', 'https://deno.com'], ['Node.js', 'https://nodejs.org'],
  ['Express', 'https://expressjs.com'], ['Fastify', 'https://fastify.dev'], ['Hono', 'https://hono.dev'], ['NestJS', 'https://nestjs.com'],
  ['GraphQL', 'https://graphql.org'], ['tRPC', 'https://trpc.io'], ['Prisma', 'https://www.prisma.io'], ['Drizzle', 'https://orm.drizzle.team'],
  ['Supabase', 'https://supabase.com'], ['Firebase', 'https://firebase.google.com'], ['Vercel', 'https://vercel.com'], ['Netlify', 'https://www.netlify.com'],
  ['Cloudflare', 'https://www.cloudflare.com'], ['Render', 'https://render.com'], ['Fly.io', 'https://fly.io'], ['Railway', 'https://railway.app'],
  ['TypeScript', 'https://www.typescriptlang.org'], ['MDN', 'https://developer.mozilla.org'], ['web.dev', 'https://web.dev'], ['Can I Use', 'https://caniuse.com'],
];
const QUEUE_SITES: Array<[string, string]> = [
  ['GitHub Trending', 'https://github.com/trending'], ['GitLab', 'https://gitlab.com'], ['Bitbucket', 'https://bitbucket.org'], ['Dev.to', 'https://dev.to'],
  ['Hashnode', 'https://hashnode.com'], ['Medium', 'https://medium.com'], ['Hacker News', 'https://news.ycombinator.com'], ['Lobsters', 'https://lobste.rs'],
  ['Product Hunt', 'https://www.producthunt.com'], ['Indie Hackers', 'https://www.indiehackers.com'], ['Kaggle', 'https://www.kaggle.com'], ['Hugging Face', 'https://huggingface.co'],
  ['OpenAI', 'https://openai.com'], ['Anthropic', 'https://www.anthropic.com'], ['PyTorch', 'https://pytorch.org'], ['TensorFlow', 'https://www.tensorflow.org'],
  ['NumPy', 'https://numpy.org'], ['pandas', 'https://pandas.pydata.org'], ['scikit-learn', 'https://scikit-learn.org'], ['Jupyter', 'https://jupyter.org'],
  ['Docker', 'https://www.docker.com'], ['Kubernetes', 'https://kubernetes.io'], ['Helm', 'https://helm.sh'], ['Terraform', 'https://www.terraform.io'],
  ['Ansible', 'https://www.ansible.com'], ['Prometheus', 'https://prometheus.io'], ['Grafana', 'https://grafana.com'], ['Sentry', 'https://sentry.io'],
  ['Datadog', 'https://www.datadoghq.com'], ['New Relic', 'https://newrelic.com'], ['Postman', 'https://www.postman.com'], ['Insomnia', 'https://insomnia.rest'],
  ['Swagger', 'https://swagger.io'], ['Figma', 'https://www.figma.com'], ['Dribbble', 'https://dribbble.com'], ['Behance', 'https://www.behance.net'],
  ['Notion', 'https://www.notion.so'], ['Linear', 'https://linear.app'], ['Trello', 'https://trello.com'], ['Asana', 'https://asana.com'],
  ['Slack', 'https://slack.com'], ['Discord', 'https://discord.com'], ['MongoDB', 'https://www.mongodb.com'], ['Redis', 'https://redis.io'],
  ['PostgreSQL', 'https://www.postgresql.org'], ['MySQL', 'https://www.mysql.com'], ['SQLite', 'https://sqlite.org'], ['Rust', 'https://www.rust-lang.org'],
  ['Go', 'https://go.dev'], ['Python', 'https://www.python.org'], ['Kotlin', 'https://kotlinlang.org'], ['Swift', 'https://www.swift.org'],
];

const FREQS: ScheduleFrequency[] = ['daily', 'weekly', 'monthly', 'hourly', 'daily', 'weekly', 'minute', 'monthly'];
const UNITS: TimerUnit[] = ['days', 'hours', 'months', 'minutes', 'days', 'days'];

function schedule(i: number, now: Date): Schedule {
  const frequency = FREQS[i % FREQS.length];
  const from = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const end = new Date(now.getFullYear(), now.getMonth() + 2 + (i % 4), 1);
  return {
    enabled: i % 9 !== 4, // a few with reminders off
    frequency,
    daysOfWeek: i % 3 === 0 ? [1, 2, 3, 4, 5] : i % 3 === 1 ? [1, 3, 5] : [0, 6],
    timeOfDay: `${pad(7 + (i % 12))}:${pad((i * 15) % 60)}`,
    interval: frequency === 'weekly' ? 1 + (i % 3) : frequency === 'monthly' ? [1, 2, 3][i % 3] : 1,
    dayOfMonth: i % 5 === 0 ? -1 : 1 + ((i * 3) % 28),
    from,
    to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}`,
  };
}

// Timers in every state: just set, mid-way, last day (clock), over today, days overdue.
function timerFor(i: number, now: number): { createdAt: number; timer: Timer | null } {
  if (i % 7 === 6) return { createdAt: now - (i % 5) * DAY, timer: null };
  const unit = UNITS[i % UNITS.length];
  const amount = unit === 'minutes' ? 25 + (i % 4) * 15 : unit === 'hours' ? 1 + (i % 6) : unit === 'months' ? 1 + (i % 3) : 1 + (i % 7);
  const len = unit === 'minutes' ? amount * MIN : unit === 'hours' ? amount * HOUR : unit === 'days' ? amount * DAY : amount * 30 * DAY;
  // how far through: 0 = just added … >1 = overdue
  const through = [0, 0.4, 0.92, 1.02, 1.6, 3][i % 6];
  const createdAt = Math.round(now - len * through);
  return { createdAt, timer: { amount, unit, start: createdAt } };
}

function processing(now: Date): ProcessingItem[] {
  const t = now.getTime();
  const make = (list: Array<[string, string]>, section: typeof FIRST_SECTION | 'Queue', offset: number) =>
    list.map(([name, url], i) => {
      const { createdAt, timer } = timerFor(i + offset, t);
      return { id: `${DEMO_PREFIX}${section.toLowerCase()}-${i}`, name, url, siteId: null, section, order: 10_000 + offset + i, schedule: schedule(i + offset, now), createdAt, timer };
    });
  return [...make(FOCUS_SITES, FIRST_SECTION, 0), ...make(QUEUE_SITES, 'Queue', 100)];
}

const TASK_VERBS = ['Review', 'Write', 'Fix', 'Ship', 'Plan', 'Refactor', 'Test', 'Document', 'Deploy', 'Investigate', 'Prepare', 'Update', 'Design', 'Benchmark', 'Clean up'];
const TASK_NOUNS = [
  'auth flow', 'release notes', 'checkout page', 'API rate limits', 'search ranking', 'onboarding emails', 'billing webhooks', 'CI pipeline',
  'dark mode', 'mobile layout', 'error tracking', 'cache layer', 'migration script', 'feature flags', 'analytics events', 'design tokens',
  'SSL renewal', 'backup job', 'access review', 'pricing page', 'docs site', 'sprint board', 'load tests', 'incident postmortem', 'hiring loop',
];
const TAGS = ['work', 'code', 'ops', 'design', 'docs', 'team', 'finance', 'health', 'home', 'learning', 'security', 'release'];
const REPEATS: Array<Repeat | null> = [null, null, null, 'daily', null, 'weekly', null, 'monthly', 'weekdays', null, null, 'yearly'];

function todos(now: Date): Todo[] {
  const t = now.getTime();
  const out: Todo[] = [];
  for (let i = 0; i < 156; i++) {
    const text = `${TASK_VERBS[i % TASK_VERBS.length]} ${TASK_NOUNS[(i * 7) % TASK_NOUNS.length]}${i >= TASK_VERBS.length * 2 ? ` #${i}` : ''}`;
    // Status mix: ~20% completed (archived), the rest spread over overdue,
    // due soon, today, this week, next month, no date.
    const kind = i % 10;
    const archived = kind === 9 || kind === 4;
    const dueOffset = [-3 * DAY, -2 * HOUR, 25 * MIN, 5 * HOUR, 2 * DAY, 9 * DAY, 35 * DAY, -10 * DAY, 3 * HOUR, 0][kind];
    const hasDue = kind !== 3 && kind !== 8;
    const due = new Date(t + dueOffset);
    const createdAt = t - (2 + (i % 20)) * DAY;
    const timer = i % 6 === 2 ? timerFor(i, t) : null;
    out.push({
      id: `${DEMO_PREFIX}todo-${i}`,
      text,
      dueDate: hasDue ? localDateKey(due) : null,
      dueTime: hasDue && i % 3 !== 0 ? `${pad(due.getHours())}:${pad(due.getMinutes())}` : null,
      createdAt: timer?.createdAt ?? createdAt,
      order: 10_000 + i,
      archivedAt: archived ? t - (i % 14) * DAY - HOUR : null,
      priority: ([0, 1, 2, 3, 0, 2, 0, 1, 3, 0] as const)[i % 10],
      tags: [TAGS[i % TAGS.length], ...(i % 4 === 0 ? [TAGS[(i + 5) % TAGS.length]] : [])],
      notes: i % 5 === 0 ? 'Demo note: acceptance criteria and links go here.' : '',
      subtasks:
        i % 4 === 1
          ? [
              { id: `${DEMO_PREFIX}st-${i}-a`, text: 'Draft', done: true },
              { id: `${DEMO_PREFIX}st-${i}-b`, text: 'Review', done: i % 8 === 1 },
              { id: `${DEMO_PREFIX}st-${i}-c`, text: 'Publish', done: false },
            ]
          : [],
      repeat: hasDue ? REPEATS[i % REPEATS.length] : null,
      timer: timer?.timer ?? null,
    });
  }
  return out;
}

// 30 extra topics, each with a keyword list for matching feed titles.
const TOPICS: Array<[string, string]> = [
  ['Rust', 'rust,cargo,rustlang'], ['Go', 'golang,go '], ['Python', 'python,django,flask,fastapi'], ['TypeScript', 'typescript,ts'],
  ['JavaScript', 'javascript,js,node'], ['WebAssembly', 'wasm,webassembly'], ['Kubernetes', 'kubernetes,k8s'], ['Docker', 'docker,container'],
  ['Security', 'security,vulnerability,cve,exploit'], ['Privacy', 'privacy,gdpr,tracking'], ['Databases', 'postgres,mysql,sqlite,database'],
  ['Cloud', 'aws,gcp,azure,cloud'], ['Serverless', 'serverless,lambda,edge'], ['Mobile', 'ios,android,mobile,flutter,react native'],
  ['Design', 'design,ux,ui,figma'], ['Open Source', 'open source,oss,github'], ['Startups', 'startup,founder,yc,funding'],
  ['Careers', 'career,interview,hiring,salary'], ['Testing', 'testing,test,qa,playwright'], ['Performance', 'performance,latency,benchmark'],
  ['Linux', 'linux,kernel,ubuntu'], ['Data', 'data,analytics,etl,warehouse'], ['ML', 'machine learning,ml,model,training'],
  ['LLM', 'llm,gpt,claude,gemini,prompt'], ['Web3', 'web3,blockchain,crypto'], ['Gaming', 'game,gaming,unity,unreal'],
  ['Hardware', 'hardware,chip,cpu,gpu'], ['Robotics', 'robot,robotics,drone'], ['Productivity', 'productivity,workflow,tools'], ['Science', 'science,research,physics'],
];

// 210 sources DevDeck can reach from the extension: Hacker News searches and
// Dev.to tags per topic (news), plus job searches (jobs).
function feeds(): { topics: Topic[]; sources: FeedSource[] } {
  const topics = TOPICS.map(([label, query], i) => ({ id: `${DEMO_PREFIX}topic-${i}`, label, query }));
  const sources: FeedSource[] = [];
  TOPICS.forEach(([label, query], i) => {
    const words = query.split(',').map((w) => w.trim()).filter(Boolean);
    const tag = label.toLowerCase().replace(/[^a-z0-9]/g, '');
    sources.push(
      { id: `${DEMO_PREFIX}hn-${i}`, name: `HN · ${label}`, kind: 'hn', url: `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(words[0])}&tags=story&hitsPerPage=8`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}hn2-${i}`, name: `HN new · ${label}`, kind: 'hn', url: `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(words[1] ?? words[0])}&tags=story&hitsPerPage=6`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}devto-${i}`, name: `Dev.to · #${tag}`, kind: 'devto', url: `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&per_page=8`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}devto-top-${i}`, name: `Dev.to top · #${tag}`, kind: 'devto', url: `https://dev.to/api/articles?tag=${encodeURIComponent(tag)}&top=7&per_page=6`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}ask-${i}`, name: `Ask HN · ${label}`, kind: 'hn', url: `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(words[0])}&tags=ask_hn&hitsPerPage=5`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}show-${i}`, name: `Show HN · ${label}`, kind: 'hn', url: `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(words[0])}&tags=show_hn&hitsPerPage=5`, category: 'news', enabled: true },
      { id: `${DEMO_PREFIX}jobs-${i}`, name: `Jobs · ${label}`, kind: 'remotive', url: `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(words[0])}&limit=6`, category: 'jobs', enabled: true },
    );
  });
  return { topics, sources };
}

export function buildDemoData(now = new Date()) {
  return { processing: processing(now), todos: todos(now), ...feeds() };
}
