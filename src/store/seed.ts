import type {
  Category,
  FeedsConfig,
  PersistedState,
  QuickLink,
  Settings,
  Site,
  Subcategory,
} from '../types';
import { SCHEMA_VERSION } from '../types';

// Default appearance settings applied on first run and whenever the user
// resets. Accent is the magenta head of the SPEC §9 magenta→violet gradient.
export const DEFAULT_SETTINGS: Settings = {
  accentColor: '#ff2e9a',
  themeMode: 'dark',
  presetTheme: 'default-dark',
  backgroundImage: null,
  overlayOpacity: 0.5,
  backgroundBlur: 0,
  clock24h: false,
  greetingName: '',
  clockStyle: 'dseg7',
  showSeconds: true,
  githubUsername: '',
  githubToken: '',
  autoQuickLinkCount: 6,
  recentLinkCount: 15,
  notifyPopups: true, // DevDeck's alert pop-ups
  weatherEnabled: true,
  useGeolocation: true,
  manualCity: '',
};

// Default scraping config (§7 Q13): the blueprint's three topic chips plus the
// zero-key, CORS-open sources. Users edit both in Settings → Scraping.
export const DEFAULT_FEEDS: FeedsConfig = {
  topics: [
    { id: 'topic-ai', label: 'AI', query: 'ai,llm,gpt,claude,machine learning' },
    { id: 'topic-frontend', label: 'Frontend', query: 'react,css,javascript,typescript,frontend' },
    { id: 'topic-devops', label: 'DevOps', query: 'kubernetes,docker,devops,ci,cloud' },
  ],
  sources: [
    { id: 'src-hn', name: 'Hacker News', kind: 'hn', url: 'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30', category: 'news', enabled: true },
    { id: 'src-devto', name: 'Dev.to', kind: 'devto', url: 'https://dev.to/api/articles?top=1&per_page=30', category: 'news', enabled: true },
    { id: 'src-remotive', name: 'Remotive', kind: 'remotive', url: 'https://remotive.com/api/remote-jobs?category=software-dev&limit=30', category: 'jobs', enabled: true },
    { id: 'src-hnjobs', name: 'HN Jobs', kind: 'hnjobs', url: 'https://hn.algolia.com/api/v1/search_by_date?tags=job', category: 'jobs', enabled: true },
  ],
};

// The v2 collections every fresh or reset state starts with. A function so
// callers never share (and accidentally mutate) the same arrays.
export const emptyV2Collections = (): Pick<
  PersistedState,
  'pinnedCategoryId' | 'todos' | 'processing' | 'feeds' | 'trash' | 'events'
> => ({
  pinnedCategoryId: null,
  todos: [],
  processing: [],
  feeds: structuredClone(DEFAULT_FEEDS),
  trash: { sites: [], processing: [] },
  events: [],
});


// Built-in rotating dev quotes (SPEC §2 header — one per page load, ~20).
// The first ten are the user's real v1 quotes (`js/widgets.js`); the rest round
// the list out to twenty so the header rotation has range.
export const QUOTES: readonly string[] = [
  'Talk is cheap. Show me the code. — Linus Torvalds',
  'Programs must be written for people to read. — Harold Abelson',
  'Simplicity is the soul of efficiency. — Austin Freeman',
  'First, solve the problem. Then, write the code. — John Johnson',
  'Make it work, make it right, make it fast. — Kent Beck',
  "Code is like humor. When you have to explain it, it's bad. — Cory House",
  'The best error message is the one that never shows up. — Thomas Fuchs',
  'Deleted code is debugged code. — Jeff Sickel',
  'Weeks of coding can save you hours of planning. — Unknown',
  'It works on my machine. — Everyone, at some point',
  'Any fool can write code that a computer can understand. Good programmers write code that humans can understand. — Martin Fowler',
  'Premature optimization is the root of all evil. — Donald Knuth',
  'There are only two hard things in Computer Science: cache invalidation and naming things. — Phil Karlton',
  'Debugging is twice as hard as writing the code in the first place. — Brian Kernighan',
  'Controlling complexity is the essence of computer programming. — Brian Kernighan',
  'Good code is its own best documentation. — Steve McConnell',
  "Programming isn't about what you know; it's about what you can figure out. — Chris Pine",
  'The function of good software is to make the complex appear simple. — Grady Booch',
  'Testing leads to failure, and failure leads to understanding. — Burt Rutan',
  'Simplicity is prerequisite for reliability. — Edsger Dijkstra',
];

// ---- Declarative seed --------------------------------------------------------
// Programming carries the user's real v1 sites; the seven featured ones stay in
// the primary row, the rest sit in General, and the SPEC §10 subcategories add
// curated Frontend/Backend/AI picks. Design and Social (absent from v1) come
// wholesale from SPEC §10.

interface SeedSite {
  name: string;
  url: string;
  primary?: boolean;
}
interface SeedSub {
  name: string;
  sites: SeedSite[];
}
interface SeedCategory {
  name: string;
  color: string;
  general: SeedSite[]; // subcategoryId === null
  subs: SeedSub[];
}

export const SEED_CATEGORIES: SeedCategory[] = [
  {
    name: 'Programming',
    color: '#a78bfa',
    general: [
      { name: 'GitHub', url: 'https://github.com', primary: true },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', primary: true },
      { name: 'Hacker News', url: 'https://news.ycombinator.com/', primary: true },
      { name: 'MDN', url: 'https://developer.mozilla.org/en-US', primary: true },
      { name: 'DevDocs', url: 'https://devdocs.io', primary: true },
      { name: 'LeetCode', url: 'https://leetcode.com', primary: true },
      { name: 'Vercel', url: 'https://vercel.com', primary: true },
      { name: 'AWS', url: 'https://aws.amazon.com' },
      { name: 'ChatGPT', url: 'https://chatgpt.com' },
      { name: 'Angular', url: 'https://angular.io' },
      { name: 'Java', url: 'https://dev.java' },
      { name: 'Next.js', url: 'https://nextjs.org' },
      { name: 'PostgreSQL', url: 'https://www.postgresql.org/docs/' },
      { name: 'Python', url: 'https://docs.python.org/3/' },
      { name: 'Kaggle', url: 'https://www.kaggle.com' },
      { name: 'Jupyter', url: 'https://jupyter.org' },
    ],
    subs: [
      {
        name: 'Frontend',
        sites: [
          { name: 'React', url: 'https://react.dev' },
          { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
          { name: 'CSS-Tricks', url: 'https://css-tricks.com' },
          { name: 'web.dev', url: 'https://web.dev' },
        ],
      },
      {
        name: 'Backend',
        sites: [
          { name: 'Spring', url: 'https://spring.io' },
          { name: 'Baeldung', url: 'https://baeldung.com' },
          { name: 'MySQL', url: 'https://dev.mysql.com' },
        ],
      },
      {
        name: 'AI',
        sites: [
          { name: 'Claude', url: 'https://claude.ai' },
          { name: 'Hugging Face', url: 'https://huggingface.co' },
          { name: 'Ollama', url: 'https://ollama.com' },
        ],
      },
    ],
  },
  {
    name: 'Design',
    color: '#f472b6',
    general: [
      { name: 'Figma', url: 'https://figma.com', primary: true },
      { name: 'Dribbble', url: 'https://dribbble.com', primary: true },
    ],
    subs: [
      {
        name: 'Inspiration',
        sites: [
          { name: 'Awwwards', url: 'https://awwwards.com' },
          { name: 'Mobbin', url: 'https://mobbin.com' },
        ],
      },
      {
        name: 'Assets',
        sites: [
          { name: 'Google Fonts', url: 'https://fonts.google.com' },
          { name: 'Heroicons', url: 'https://heroicons.com' },
          { name: 'Unsplash', url: 'https://unsplash.com' },
        ],
      },
    ],
  },
  {
    name: 'Social',
    color: '#fb923c',
    general: [
      { name: 'Reddit', url: 'https://reddit.com', primary: true },
      { name: 'X', url: 'https://x.com', primary: true },
    ],
    subs: [
      {
        name: 'Dev communities',
        sites: [
          { name: 'Hacker News', url: 'https://news.ycombinator.com' },
          { name: 'DEV Community', url: 'https://dev.to' },
          { name: 'r/webdev', url: 'https://reddit.com/r/webdev' },
        ],
      },
    ],
  },
];

const SEED_QUICK_LINKS: Array<{ name: string; url: string }> = [
  { name: 'Mail', url: 'https://gmail.com' },
  { name: 'Drive', url: 'https://drive.google.com' },
  { name: 'Telegram', url: 'https://web.telegram.org' },
  { name: 'LinkedIn', url: 'https://linkedin.com' },
];

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// The first-run / reset-to-seed state, expanded from the declarative seed above
// into the flat, explicitly-ordered SPEC §2 collections. Ids are stable slugs so
// the seed is deterministic (handy for tests and idempotent resets).
export function getSeedState(): PersistedState {
  return getBenchmark200State();
}


export function getBenchmark200State(): PersistedState {
  const benchmarkCategories: Array<{
    name: string;
    color: string;
    general: Array<{ name: string; url: string; primary?: boolean }>;
    subs: Array<{ name: string; sites: Array<{ name: string; url: string }> }>;
  }> = [
    {
      name: 'Frontend',
      color: '#38bdf8',
      general: [
        { name: 'GitHub', url: 'https://github.com', primary: true },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com', primary: true },
        { name: 'React', url: 'https://react.dev', primary: true },
        { name: 'TypeScript', url: 'https://www.typescriptlang.org', primary: true },
        { name: 'Vite', url: 'https://vite.dev', primary: true },
        { name: 'MDN Web Docs', url: 'https://developer.mozilla.org', primary: true },
        { name: 'Next.js', url: 'https://nextjs.org', primary: true },
        { name: 'Vue.js', url: 'https://vuejs.org' },
        { name: 'Svelte', url: 'https://svelte.dev' },
        { name: 'Astro', url: 'https://astro.build' },
      ],

      subs: [
        {
          name: 'Frameworks',
          sites: [
            { name: 'Remix', url: 'https://remix.run' },
            { name: 'Nuxt', url: 'https://nuxt.com' },
            { name: 'SolidJS', url: 'https://www.solidjs.com' },
            { name: 'Qwik', url: 'https://qwik.dev' },
          ],
        },
        {
          name: 'Styling',
          sites: [
            { name: 'Tailwind CSS', url: 'https://tailwindcss.com' },
            { name: 'CSS-Tricks', url: 'https://css-tricks.com' },
            { name: 'Sass', url: 'https://sass-lang.com' },
            { name: 'PostCSS', url: 'https://postcss.org' },
          ],
        },
        {
          name: 'State & Tools',
          sites: [
            { name: 'Zustand', url: 'https://zustand.docs.pmnd.rs' },
            { name: 'Redux Toolkit', url: 'https://redux-toolkit.js.org' },
            { name: 'TanStack Query', url: 'https://tanstack.com/query' },
            { name: 'Storybook', url: 'https://storybook.js.org' },
          ],
        },
      ],
    },
    {
      name: 'Backend',
      color: '#10b981',
      general: [
        { name: 'Node.js', url: 'https://nodejs.org', primary: true },
        { name: 'Go Language', url: 'https://go.dev', primary: true },
        { name: 'Rust', url: 'https://www.rust-lang.org', primary: true },
        { name: 'FastAPI', url: 'https://fastapi.tiangolo.com', primary: true },
        { name: 'Python', url: 'https://python.org' },
        { name: 'Express', url: 'https://expressjs.com' },
        { name: 'NestJS', url: 'https://nestjs.com' },
      ],
      subs: [
        {
          name: 'Runtimes',
          sites: [
            { name: 'Deno', url: 'https://deno.com' },
            { name: 'Bun', url: 'https://bun.sh' },
            { name: 'Fastify', url: 'https://fastify.dev' },
            { name: 'Hono', url: 'https://hono.dev' },
          ],
        },
        {
          name: 'Systems',
          sites: [
            { name: 'Crates.io', url: 'https://crates.io' },
            { name: 'Pkg.go.dev', url: 'https://pkg.go.dev' },
            { name: 'Tokio', url: 'https://tokio.rs' },
            { name: 'Actix', url: 'https://actix.rs' },
          ],
        },
        {
          name: 'Enterprise',
          sites: [
            { name: 'Spring Boot', url: 'https://spring.io/projects/spring-boot' },
            { name: 'ASP.NET Core', url: 'https://dotnet.microsoft.com/apps/aspnet' },
            { name: 'Django', url: 'https://www.djangoproject.com' },
            { name: 'Laravel', url: 'https://laravel.com' },
          ],
        },
      ],
    },
    {
      name: 'Databases',
      color: '#f59e0b',
      general: [
        { name: 'PostgreSQL', url: 'https://www.postgresql.org', primary: true },
        { name: 'Redis', url: 'https://redis.io', primary: true },
        { name: 'Supabase', url: 'https://supabase.com', primary: true },
        { name: 'Prisma', url: 'https://www.prisma.io', primary: true },
        { name: 'SQLite', url: 'https://sqlite.org' },
        { name: 'MySQL', url: 'https://www.mysql.com' },
        { name: 'MongoDB', url: 'https://www.mongodb.com' },
      ],
      subs: [
        {
          name: 'Cloud DB',
          sites: [
            { name: 'Neon Postgres', url: 'https://neon.tech' },
            { name: 'PlanetScale', url: 'https://planetscale.com' },
            { name: 'Upstash', url: 'https://upstash.com' },
            { name: 'CockroachDB', url: 'https://www.cockroachlabs.com' },
          ],
        },
        {
          name: 'ORMs & Drivers',
          sites: [
            { name: 'Drizzle ORM', url: 'https://orm.drizzle.team' },
            { name: 'TypeORM', url: 'https://typeorm.io' },
            { name: 'Kysely', url: 'https://kysely.dev' },
            { name: 'SQLAlchemy', url: 'https://www.sqlalchemy.org' },
          ],
        },
        {
          name: 'Search & Vector',
          sites: [
            { name: 'Meilisearch', url: 'https://www.meilisearch.com' },
            { name: 'Pinecone', url: 'https://www.pinecone.io' },
            { name: 'Qdrant', url: 'https://qdrant.tech' },
            { name: 'ChromaDB', url: 'https://www.trychroma.com' },
          ],
        },
      ],
    },
    {
      name: 'DevOps & Cloud',
      color: '#6366f1',
      general: [
        { name: 'Docker', url: 'https://www.docker.com', primary: true },
        { name: 'Kubernetes', url: 'https://kubernetes.io', primary: true },
        { name: 'AWS', url: 'https://aws.amazon.com', primary: true },
        { name: 'GitHub Actions', url: 'https://github.com/features/actions', primary: true },
        { name: 'Terraform', url: 'https://www.terraform.io' },
        { name: 'Google Cloud', url: 'https://cloud.google.com' },
        { name: 'Cloudflare', url: 'https://www.cloudflare.com' },
      ],
      subs: [
        {
          name: 'Deployment',
          sites: [
            { name: 'Vercel', url: 'https://vercel.com' },
            { name: 'Railway', url: 'https://railway.app' },
            { name: 'Render', url: 'https://render.com' },
            { name: 'Fly.io', url: 'https://fly.io' },
          ],
        },
        {
          name: 'Monitoring',
          sites: [
            { name: 'Grafana', url: 'https://grafana.com' },
            { name: 'Prometheus', url: 'https://prometheus.io' },
            { name: 'Datadog', url: 'https://www.datadoghq.com' },
            { name: 'Sentry', url: 'https://sentry.io' },
          ],
        },
        {
          name: 'Automation',
          sites: [
            { name: 'Ansible', url: 'https://www.ansible.com' },
            { name: 'ArgoCD', url: 'https://argoproj.github.io/cd' },
            { name: 'Helm', url: 'https://helm.sh' },
            { name: 'Pulumi', url: 'https://www.pulumi.com' },
          ],
        },
      ],
    },
    {
      name: 'AI & Data',
      color: '#a855f7',
      general: [
        { name: 'OpenAI', url: 'https://platform.openai.com', primary: true },
        { name: 'Anthropic Claude', url: 'https://claude.ai', primary: true },
        { name: 'Hugging Face', url: 'https://huggingface.co', primary: true },
        { name: 'PyTorch', url: 'https://pytorch.org', primary: true },
        { name: 'Ollama', url: 'https://ollama.com' },
        { name: 'Kaggle', url: 'https://www.kaggle.com' },
        { name: 'Jupyter', url: 'https://jupyter.org' },
      ],
      subs: [
        {
          name: 'LLM Frameworks',
          sites: [
            { name: 'LangChain', url: 'https://www.langchain.com' },
            { name: 'LlamaIndex', url: 'https://www.llamaindex.ai' },
            { name: 'Replicate', url: 'https://replicate.com' },
            { name: 'Together AI', url: 'https://together.ai' },
          ],
        },
        {
          name: 'Machine Learning',
          sites: [
            { name: 'TensorFlow', url: 'https://www.tensorflow.org' },
            { name: 'Scikit-learn', url: 'https://scikit-learn.org' },
            { name: 'Weights & Biases', url: 'https://wandb.ai' },
            { name: 'vLLM', url: 'https://docs.vllm.ai' },
          ],
        },
        {
          name: 'Research',
          sites: [
            { name: 'arXiv CS', url: 'https://arxiv.org/corr' },
            { name: 'Papers With Code', url: 'https://paperswithcode.com' },
            { name: 'Distill.pub', url: 'https://distill.pub' },
            { name: 'DeepMind Research', url: 'https://deepmind.google/research' },
          ],
        },
      ],
    },
    {
      name: 'UI & Design',
      color: '#ec4899',
      general: [
        { name: 'Figma', url: 'https://figma.com', primary: true },
        { name: 'Dribbble', url: 'https://dribbble.com', primary: true },
        { name: 'Shadcn UI', url: 'https://ui.shadcn.com', primary: true },
        { name: 'Lucide Icons', url: 'https://lucide.dev', primary: true },
        { name: 'Mobbin', url: 'https://mobbin.com' },
        { name: 'Behance', url: 'https://www.behance.net' },
        { name: 'Framer', url: 'https://www.framer.com' },
      ],
      subs: [
        {
          name: 'Icons & Assets',
          sites: [
            { name: 'Simple Icons', url: 'https://simpleicons.org' },
            { name: 'Heroicons', url: 'https://heroicons.com' },
            { name: 'Unsplash', url: 'https://unsplash.com' },
            { name: 'Phosphor Icons', url: 'https://phosphoricons.com' },
          ],
        },
        {
          name: 'Color & Type',
          sites: [
            { name: 'Coolors', url: 'https://coolors.co' },
            { name: 'Fontshare', url: 'https://www.fontshare.com' },
            { name: 'Google Fonts', url: 'https://fonts.google.com' },
            { name: 'Realtime Colors', url: 'https://realtimecolors.com' },
          ],
        },
        {
          name: '3D & Motion',
          sites: [
            { name: 'Spline 3D', url: 'https://spline.design' },
            { name: 'LottieFiles', url: 'https://lottiefiles.com' },
            { name: 'Three.js', url: 'https://threejs.org' },
            { name: 'Motion.dev', url: 'https://motion.dev' },
          ],
        },
      ],
    },
    {
      name: 'Mobile & Apps',
      color: '#06b6d4',
      general: [
        { name: 'React Native', url: 'https://reactnative.dev', primary: true },
        { name: 'Flutter', url: 'https://flutter.dev', primary: true },
        { name: 'Swift.org', url: 'https://www.swift.org', primary: true },
        { name: 'Expo', url: 'https://expo.dev', primary: true },
        { name: 'Android Developers', url: 'https://developer.android.com' },
        { name: 'Apple Developer', url: 'https://developer.apple.com' },
        { name: 'Tauri', url: 'https://tauri.app' },
      ],
      subs: [
        {
          name: 'Cross Platform',
          sites: [
            { name: 'Capacitor', url: 'https://capacitorjs.com' },
            { name: 'Ionic', url: 'https://ionicframework.com' },
            { name: 'Electron', url: 'https://www.electronjs.org' },
            { name: 'Kotlin Multiplatform', url: 'https://kotlinlang.org/lp/multiplatform' },
          ],
        },
        {
          name: 'Game Engines',
          sites: [
            { name: 'Godot Engine', url: 'https://godotengine.org' },
            { name: 'Unity', url: 'https://unity.com' },
            { name: 'Unreal Engine', url: 'https://www.unrealengine.com' },
            { name: 'Phaser', url: 'https://phaser.io' },
          ],
        },
      ],
    },
    {
      name: 'Security & Auth',
      color: '#ef4444',
      general: [
        { name: 'OWASP', url: 'https://owasp.org', primary: true },
        { name: 'Snyk', url: 'https://snyk.io', primary: true },
        { name: 'Clerk Auth', url: 'https://clerk.com', primary: true },
        { name: 'HackerOne', url: 'https://www.hackerone.com', primary: true },
        { name: 'CVE Details', url: 'https://www.cvedetails.com' },
        { name: 'Auth0', url: 'https://auth0.com' },
        { name: 'Wireshark', url: 'https://www.wireshark.org' },
      ],
      subs: [
        {
          name: 'Identity',
          sites: [
            { name: 'Keycloak', url: 'https://www.keycloak.org' },
            { name: 'Lucia Auth', url: 'https://lucia-auth.com' },
            { name: 'NextAuth / Auth.js', url: 'https://authjs.dev' },
            { name: 'Kinde', url: 'https://kinde.com' },
          ],
        },
        {
          name: 'Secrets & Crypt',
          sites: [
            { name: 'HashiCorp Vault', url: 'https://www.vaultproject.io' },
            { name: '1Password Developer', url: 'https://developer.1password.com' },
            { name: 'Bitwarden', url: 'https://bitwarden.com' },
            { name: 'SonarQube', url: 'https://www.sonarqube.org' },
          ],
        },
      ],
    },
    {
      name: 'Utilities & Tools',
      color: '#8b5cf6',
      general: [
        { name: 'Regex101', url: 'https://regex101.com', primary: true },
        { name: 'Postman', url: 'https://www.postman.com', primary: true },
        { name: 'Excalidraw', url: 'https://excalidraw.com', primary: true },
        { name: 'Can I Use', url: 'https://caniuse.com', primary: true },
        { name: 'JSON Formatter', url: 'https://jsonformatter.org' },
        { name: 'Diffchecker', url: 'https://www.diffchecker.com' },
        { name: 'Ray.so', url: 'https://ray.so' },
      ],
      subs: [
        {
          name: 'API Testing',
          sites: [
            { name: 'Hoppscotch', url: 'https://hoppscotch.io' },
            { name: 'Insomnia', url: 'https://insomnia.rest' },
            { name: 'Bruno', url: 'https://www.usebruno.com' },
            { name: 'Httpie', url: 'https://httpie.io' },
          ],
        },
        {
          name: 'Generators',
          sites: [
            { name: 'Crontab Guru', url: 'https://crontab.guru' },
            { name: 'Bundlephobia', url: 'https://bundlephobia.com' },
            { name: 'CyberChef', url: 'https://gchq.github.io/CyberChef' },
            { name: 'Carbon Code', url: 'https://carbon.now.sh' },
          ],
        },
      ],
    },
    {
      name: 'Tech News & Feed',
      color: '#14b8a6',
      general: [
        { name: 'Hacker News', url: 'https://news.ycombinator.com', primary: true },
        { name: 'GitHub Trending', url: 'https://github.com/trending', primary: true },
        { name: 'Dev.to', url: 'https://dev.to', primary: true },
        { name: 'Product Hunt', url: 'https://www.producthunt.com', primary: true },
        { name: 'Lobsters', url: 'https://lobste.rs' },
        { name: 'Daily.dev', url: 'https://daily.dev' },
        { name: 'Hashnode', url: 'https://hashnode.com' },
      ],
      subs: [
        {
          name: 'Publications',
          sites: [
            { name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com' },
            { name: 'FreeCodeCamp', url: 'https://www.freecodecamp.org/news' },
            { name: 'InfoQ', url: 'https://www.infoq.com' },
            { name: 'Ars Technica', url: 'https://arstechnica.com' },
          ],
        },
        {
          name: 'Newsletters',
          sites: [
            { name: 'TLDR Tech', url: 'https://tldr.tech' },
            { name: 'Changelog', url: 'https://changelog.com' },
            { name: 'JavaScript Weekly', url: 'https://javascriptweekly.com' },
            { name: 'ByteByteGo', url: 'https://bytebytego.com' },
          ],
        },
      ],
    },
    {
      name: 'Mobile & Native',
      color: '#f97316',
      general: [
        { name: 'Flutter', url: 'https://flutter.dev', primary: true },
        { name: 'React Native', url: 'https://reactnative.dev', primary: true },
        { name: 'Swift.org', url: 'https://www.swift.org', primary: true },
        { name: 'Kotlin', url: 'https://kotlinlang.org', primary: true },
        { name: 'Android Dev', url: 'https://developer.android.com' },
        { name: 'Apple Dev', url: 'https://developer.apple.com' },
        { name: 'Expo', url: 'https://expo.dev' },
        { name: 'Ionic', url: 'https://ionicframework.com' },
      ],
      subs: [
        {
          name: 'App Tooling',
          sites: [
            { name: 'Fastlane', url: 'https://fastlane.tools' },
            { name: 'Firebase Console', url: 'https://console.firebase.google.com' },
            { name: 'Capacitor', url: 'https://capacitorjs.com' },
            { name: 'Tauri Mobile', url: 'https://tauri.app' },
            { name: 'App Store Connect', url: 'https://appstoreconnect.apple.com' },
          ],
        },
        {
          name: 'Cross Frameworks',
          sites: [
            { name: 'Dart Pub', url: 'https://pub.dev' },
            { name: 'NativeScript', url: 'https://nativescript.org' },
            { name: 'Cordova', url: 'https://cordova.apache.org' },
            { name: 'Unity Engine', url: 'https://unity.com' },
            { name: 'Godot Engine', url: 'https://godotengine.org' },
          ],
        },
        {
          name: 'Mobile UI Patterns',
          sites: [
            { name: 'Material Design', url: 'https://m3.material.io' },
            { name: 'Human Interface Guidelines', url: 'https://developer.apple.com/design/human-interface-guidelines' },
            { name: 'Mobile Design Patterns', url: 'https://pttrns.com' },
            { name: 'Mobbin iOS', url: 'https://mobbin.com/browse/ios/apps' },
            { name: 'UI Garage', url: 'https://uigarage.net' },
          ],
        },
        {
          name: 'Distribution & CI',
          sites: [
            { name: 'TestFlight', url: 'https://developer.apple.com/testflight' },
            { name: 'Google Play Console', url: 'https://play.google.com/console' },
            { name: 'F-Droid', url: 'https://f-droid.org' },
            { name: 'Codemagic CI', url: 'https://codemagic.io' },
            { name: 'Bitrise CI', url: 'https://bitrise.io' },
          ],
        },
      ],
    },
    {
      name: 'Systems & Low-Level',
      color: '#84cc16',
      general: [
        { name: 'Linux Kernel', url: 'https://kernel.org', primary: true },
        { name: 'Zig Language', url: 'https://ziglang.org', primary: true },
        { name: 'LLVM Project', url: 'https://llvm.org', primary: true },
        { name: 'GCC Compiler', url: 'https://gcc.gnu.org', primary: true },
        { name: 'WebAssembly', url: 'https://webassembly.org' },
        { name: 'Arch Linux', url: 'https://archlinux.org' },
        { name: 'FreeBSD', url: 'https://www.freebsd.org' },
        { name: 'OSDev Wiki', url: 'https://wiki.osdev.org' },
      ],
      subs: [
        {
          name: 'Compilers & Tools',
          sites: [
            { name: 'Compiler Explorer', url: 'https://godbolt.org' },
            { name: 'Clang', url: 'https://clang.llvm.org' },
            { name: 'NASM Assembler', url: 'https://www.nasm.us' },
            { name: 'Cmake', url: 'https://cmake.org' },
            { name: 'Meson Build', url: 'https://mesonbuild.com' },
          ],
        },
        {
          name: 'Embedded & Hardware',
          sites: [
            { name: 'Arduino', url: 'https://www.arduino.cc' },
            { name: 'Raspberry Pi', url: 'https://www.raspberrypi.com' },
            { name: 'ESP32 Espressif', url: 'https://www.espressif.com' },
            { name: 'PlatformIO', url: 'https://platformio.org' },
            { name: 'Zephyr RTOS', url: 'https://zephyrproject.org' },
          ],
        },
        {
          name: 'Specs & Architecture',
          sites: [
            { name: 'Linux Man Pages', url: 'https://man7.org/linux/man-pages' },
            { name: 'CPP Reference', url: 'https://en.cppreference.com' },
            { name: 'POSIX Specs', url: 'https://pubs.opengroup.org/onlinepubs/9699919799' },
            { name: 'Intel SDM', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html' },
            { name: 'ARM Architecture', url: 'https://developer.arm.com' },
          ],
        },
        {
          name: 'Emulators & Kernels',
          sites: [
            { name: 'QEMU', url: 'https://www.qemu.org' },
            { name: 'VirtualBox', url: 'https://www.virtualbox.org' },
            { name: 'eBPF.io', url: 'https://ebpf.io' },
            { name: 'Bochs x86', url: 'https://bochs.sourceforge.io' },
            { name: 'DistroWatch', url: 'https://distrowatch.com' },
          ],
        },
      ],
    },
    {
      name: 'Data Science & Analytics',
      color: '#0ea5e9',
      general: [
        { name: 'Pandas', url: 'https://pandas.pydata.org', primary: true },
        { name: 'NumPy', url: 'https://numpy.org', primary: true },
        { name: 'Apache Spark', url: 'https://spark.apache.org', primary: true },
        { name: 'Snowflake', url: 'https://www.snowflake.com', primary: true },
        { name: 'BigQuery', url: 'https://cloud.google.com/bigquery' },
        { name: 'Databricks', url: 'https://www.databricks.com' },
        { name: 'Polars', url: 'https://pola.rs' },
        { name: 'DuckDB', url: 'https://duckdb.org' },
      ],
      subs: [
        {
          name: 'Pipelines & ETL',
          sites: [
            { name: 'Apache Airflow', url: 'https://airflow.apache.org' },
            { name: 'Prefect', url: 'https://www.prefect.io' },
            { name: 'Dagster', url: 'https://dagster.io' },
            { name: 'dbt Labs', url: 'https://www.getdbt.com' },
            { name: 'Apache Kafka', url: 'https://kafka.apache.org' },
          ],
        },
        {
          name: 'Visualization',
          sites: [
            { name: 'Tableau Public', url: 'https://public.tableau.com' },
            { name: 'Apache Superset', url: 'https://superset.apache.org' },
            { name: 'Metabase', url: 'https://www.metabase.com' },
            { name: 'Grafana BI', url: 'https://grafana.com' },
            { name: 'Plotly', url: 'https://plotly.com' },
          ],
        },
        {
          name: 'Data Warehousing',
          sites: [
            { name: 'AWS Redshift', url: 'https://aws.amazon.com/redshift' },
            { name: 'Trino', url: 'https://trino.io' },
            { name: 'Apache Flink', url: 'https://flink.apache.org' },
            { name: 'Iceberg Apache', url: 'https://iceberg.apache.org' },
            { name: 'Delta Lake', url: 'https://delta.io' },
          ],
        },
        {
          name: 'Math & Stats',
          sites: [
            { name: 'SciPy', url: 'https://scipy.org' },
            { name: 'SymPy', url: 'https://www.sympy.org' },
            { name: 'Statsmodels', url: 'https://www.statsmodels.org' },
            { name: 'Julia Lang', url: 'https://julialang.org' },
            { name: 'R Project', url: 'https://www.r-project.org' },
          ],
        },
      ],
    },
  ];

  const categories: Category[] = [];
  const subcategories: Subcategory[] = [];
  const sites: Site[] = [];

  benchmarkCategories.forEach((cat, ci) => {
    const categoryId = `cat-bench-${slug(cat.name)}`;
    categories.push({
      id: categoryId,
      name: cat.name,
      color: cat.color,
      order: ci,
    });

    const pushSite = (
      s: { name: string; url: string; primary?: boolean },
      subcategoryId: string | null,
      prefix: string,
      order: number,
    ) => {
      sites.push({
        id: `site-bench-${slug(cat.name)}-${prefix}-${slug(s.name)}`,
        name: s.name,
        url: s.url,
        categoryId,
        subcategoryId,
        primary: s.primary ?? false,
        order,
        visits: Math.floor(Math.random() * 50),
        lastVisited: Date.now() - Math.floor(Math.random() * 10000000),
      });
    };

    cat.general.forEach((s, i) => pushSite(s, null, 'gen', i));

    cat.subs.forEach((sub, sbi) => {
      const subId = `sub-bench-${slug(cat.name)}-${slug(sub.name)}`;
      subcategories.push({ id: subId, name: sub.name, categoryId, order: sbi });
      sub.sites.forEach((s, i) => pushSite(s, subId, slug(sub.name), i));
    });
  });

  const quickLinks: QuickLink[] = SEED_QUICK_LINKS.map((q, i) => ({
    id: `ql-${slug(q.name)}`,
    name: q.name,
    url: q.url,
    order: i,
  }));

  return {
    schemaVersion: SCHEMA_VERSION,
    categories,
    subcategories,
    sites,
    quickLinks,
    settings: { ...DEFAULT_SETTINGS },
    ...emptyV2Collections(),
  };
}

