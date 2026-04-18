import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");

const username = process.env.GITHUB_USERNAME || process.argv[2];
if (!username) {
  console.error("Usage: node scripts/update-stars.mjs <github-username>");
  process.exit(1);
}

const apiToken = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN || "";
const repositorySlug = process.env.GITHUB_REPOSITORY || `${username}/${path.basename(repoRoot)}`;
const [repositoryOwner = username, repositoryName = path.basename(repoRoot)] = repositorySlug.split("/");
const pagesUrl = repositoryName.toLowerCase() === repositoryOwner.toLowerCase()
  ? `https://${repositoryOwner.toLowerCase()}.github.io/`
  : `https://${repositoryOwner.toLowerCase()}.github.io/${repositoryName}/`;
const perPage = 100;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const CATEGORY_THRESHOLD = 5;
const EXCLUDED_TOPICS = new Set([
  "ai",
  "ml",
  "web",
  "frontend",
  "backend",
  "python",
  "javascript",
  "typescript",
  "rust",
  "go",
  "html",
  "css",
  "react",
  "vue",
  "nextjs",
  "next.js",
  "tool",
  "tools",
  "app"
]);

const CATEGORY_DEFINITIONS = [
  {
    slug: "ai-ml",
    label: "AI / LLM",
    description: "LLM、Agent、RAG、机器学习、推理与生成式 AI",
    color: "#8b5cf6",
    keywords: {
      strong: ["llm", "gpt", "openai", "anthropic", "gemini", "huggingface", "langchain", "llama", "transformers", "pytorch", "tensorflow", "deep-learning", "machine-learning", "reinforcement-learning", "rag"],
      medium: ["ai", "ml", "agent", "inference", "embedding", "prompt", "vector-search", "multimodal", "diffusion", "fine-tuning", "alignment"],
      weak: ["model", "reasoning", "semantic", "neural"]
    },
    languageBoosts: { Python: 4, "Jupyter Notebook": 5 }
  },
  {
    slug: "web-ui",
    label: "Web / UI",
    description: "前端框架、组件库、全栈 Web、博客主题与交互界面",
    color: "#10b981",
    keywords: {
      strong: ["react", "nextjs", "next.js", "vue", "svelte", "remix", "astro", "tailwind", "component-library", "design-system", "shadcn", "material-ui"],
      medium: ["frontend", "fullstack", "web-framework", "ui", "ux", "browser", "dashboard", "blog-theme", "static-site-generator"],
      weak: ["html", "css", "javascript", "typescript", "website"]
    },
    languageBoosts: { TypeScript: 4, JavaScript: 4, HTML: 2, Vue: 4, Astro: 5, MDX: 3 }
  },
  {
    slug: "devops-cloud",
    label: "DevOps / Cloud",
    description: "部署、容器、自托管、云基础设施与可观测性",
    color: "#06b6d4",
    keywords: {
      strong: ["docker", "kubernetes", "k8s", "terraform", "pulumi", "ansible", "github-actions", "prometheus", "grafana", "cloudflare", "aws", "gcp", "azure"],
      medium: ["devops", "self-hosted", "observability", "monitoring", "deployment", "infrastructure", "homelab", "serverless", "gitops"],
      weak: ["ops", "cluster", "hosting", "cloud"]
    },
    languageBoosts: { Go: 3, Rust: 2, Shell: 2 }
  },
  {
    slug: "data-search",
    label: "Data / Search",
    description: "数据库、搜索、向量检索、ETL、分析与缓存层",
    color: "#3b82f6",
    keywords: {
      strong: ["postgresql", "mysql", "redis", "elasticsearch", "vector-search", "search-engine", "qdrant", "milvus", "data-engineering", "etl", "data-warehouse", "information-retrieval"],
      medium: ["database", "search", "analytics", "retrieval", "pipeline", "bigquery", "warehouse", "cache", "indexing"],
      weak: ["sql", "data", "query", "vector"]
    },
    languageBoosts: { Python: 2, Go: 1, Rust: 1 }
  },
  {
    slug: "developer-tools",
    label: "Developer Tools",
    description: "CLI、编辑器、终端、自动化工具与效率增强",
    color: "#64748b",
    keywords: {
      strong: ["cli", "command-line", "terminal", "neovim", "vim", "tmux", "dotfiles", "browser-extension", "chrome-extension", "developer-tools", "automation-tool"],
      medium: ["shell", "tooling", "productivity", "extension", "editor", "code-review", "git-tool", "devtools", "workflow"],
      weak: ["tool", "utility", "plugin", "script"]
    },
    languageBoosts: { Shell: 4, Rust: 2, Go: 2, Lua: 2, "Vim Script": 5 }
  },
  {
    slug: "knowledge-content",
    label: "Knowledge / Content",
    description: "笔记、博客、知识库、写作系统、Obsidian 与内容发布",
    color: "#f59e0b",
    keywords: {
      strong: ["obsidian", "blog", "knowledge-management", "knowledge-graph", "note-taking", "personal-blog", "wiki", "digital-garden"],
      medium: ["markdown", "publishing", "documentation-site", "writing", "content", "notes", "journal", "knowledge-base"],
      weak: ["docs", "readme", "site"]
    },
    languageBoosts: { MDX: 5, Astro: 3, HTML: 1 }
  },
  {
    slug: "learning-research",
    label: "Learning / Research",
    description: "教程、论文、课程、awesome list、benchmark 与学习资源",
    color: "#22c55e",
    keywords: {
      strong: ["tutorial", "awesome-list", "awesome", "course", "benchmark", "paper", "research", "survey", "handbook", "cheat-sheet", "roadmap"],
      medium: ["learning", "guide", "book", "dataset", "examples", "study", "curriculum", "interview", "lecture"],
      weak: ["reference", "education", "notes"]
    },
    languageBoosts: { TeX: 5, "Jupyter Notebook": 2, Python: 1 }
  },
  {
    slug: "mobile",
    label: "Mobile / Apple",
    description: "iOS、Android、Flutter、SwiftUI 与跨端移动开发",
    color: "#ef4444",
    keywords: {
      strong: ["ios", "android", "swiftui", "flutter", "react-native", "jetpack-compose", "kotlin", "xcode"],
      medium: ["mobile", "iphone", "ipad", "apple", "macos", "ios-app", "android-app"],
      weak: ["swift", "app", "device"]
    },
    languageBoosts: { Swift: 6, Dart: 5, Kotlin: 5 }
  },
  {
    slug: "security",
    label: "Security / Privacy",
    description: "认证授权、安全工具、隐私保护、密码学与合规",
    color: "#dc2626",
    keywords: {
      strong: ["security", "oauth", "jwt", "encryption", "cryptography", "vulnerability", "privacy", "authentication", "authorization", "soc2"],
      medium: ["secure", "compliance", "audit", "penetration-testing", "secrets", "sandbox", "access-control"],
      weak: ["auth", "tls", "ssl", "risk"]
    },
    languageBoosts: { Rust: 1, Go: 1, C: 1 }
  },
  {
    slug: "design-creative",
    label: "Design / Creative",
    description: "视觉设计、动画、图形、主题与创意工具",
    color: "#ec4899",
    keywords: {
      strong: ["animation", "motion", "icon-set", "pixel-art", "design-tool", "illustration", "theme", "wallpaper"],
      medium: ["design", "creative", "graphics", "color-palette", "typography", "3d", "canvas"],
      weak: ["visual", "art", "style"]
    },
    languageBoosts: { CSS: 3, HTML: 1 }
  },
  {
    slug: "other",
    label: "Other",
    description: "暂时没有明显主题信号或较难自动归类的仓库",
    color: "#6366f1",
    keywords: { strong: [], medium: [], weak: [] },
    languageBoosts: {}
  }
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(text, keyword) {
  const normalized = keyword.toLowerCase();
  const escaped = escapeRegExp(normalized).replace(/\ /g, "[\\s_-]+");
  const pattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
  return pattern.test(text) || text.includes(normalized);
}

function countBy(items, getKey) {
  const map = new Map();
  for (const item of items) {
    const key = getKey(item);
    if (!key) {
      continue;
    }
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) {
    return "未知";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function daysSince(value) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((Date.now() - Date.parse(value)) / DAY_IN_MS);
}

function monthKey(value) {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString().slice(0, 7);
}

function abbreviate(text, maxLength = 120) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No description";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function compareByCountAndName([leftKey, leftCount], [rightKey, rightCount]) {
  if (rightCount !== leftCount) {
    return rightCount - leftCount;
  }
  return String(leftKey).localeCompare(String(rightKey), "en");
}

function compareByStarsThenStarred(left, right) {
  if (right.stargazers_count !== left.stargazers_count) {
    return right.stargazers_count - left.stargazers_count;
  }
  const rightStarredAt = right.starred_at ? Date.parse(right.starred_at) : 0;
  const leftStarredAt = left.starred_at ? Date.parse(left.starred_at) : 0;
  if (rightStarredAt !== leftStarredAt) {
    return rightStarredAt - leftStarredAt;
  }
  return left.full_name.localeCompare(right.full_name, "en");
}

function compareByStarredThenStars(left, right) {
  const rightStarredAt = right.starred_at ? Date.parse(right.starred_at) : 0;
  const leftStarredAt = left.starred_at ? Date.parse(left.starred_at) : 0;
  if (rightStarredAt !== leftStarredAt) {
    return rightStarredAt - leftStarredAt;
  }
  return compareByStarsThenStarred(left, right);
}

function scoreCategory(repository, definition) {
  const text = [repository.name, repository.full_name, repository.description, repository.homepage, repository.topics.join(" "), repository.language]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let score = 0;

  for (const keyword of definition.keywords.strong) {
    if (keywordMatches(text, keyword)) {
      score += 10;
      if (repository.topics.some((topic) => topic.includes(keyword.toLowerCase()))) {
        score += 4;
      }
    }
  }

  for (const keyword of definition.keywords.medium) {
    if (keywordMatches(text, keyword)) {
      score += 5;
      if (repository.topics.some((topic) => topic.includes(keyword.toLowerCase()))) {
        score += 2;
      }
    }
  }

  for (const keyword of definition.keywords.weak) {
    if (keywordMatches(text, keyword)) {
      score += 2;
    }
  }

  score += definition.languageBoosts[repository.language] || 0;
  return score;
}

function classifyRepository(repository) {
  const scores = CATEGORY_DEFINITIONS.filter((definition) => definition.slug !== "other")
    .map((definition) => ({ definition, score: scoreCategory(repository, definition) }));

  const topicBoosts = [
    { slug: "knowledge-content", topics: ["obsidian", "blog", "knowledge-graph", "knowledge-management", "note-taking"] },
    { slug: "learning-research", topics: ["tutorial", "course", "awesome", "awesome-list", "benchmark", "paper", "survey"] },
    { slug: "data-search", topics: ["vector-search", "search-engine", "postgresql", "redis", "database", "retrieval"] },
    { slug: "devops-cloud", topics: ["docker", "kubernetes", "github-actions", "cloudflare", "self-hosted", "terraform"] },
    { slug: "developer-tools", topics: ["cli", "neovim", "vim", "terminal", "tmux", "dotfiles"] }
  ];

  for (const boost of topicBoosts) {
    if (repository.topics.some((topic) => boost.topics.some((needle) => topic.includes(needle)))) {
      const target = scores.find((entry) => entry.definition.slug === boost.slug);
      if (target) {
        target.score += 8;
      }
    }
  }

  scores.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return CATEGORY_DEFINITIONS.findIndex((definition) => definition.slug === left.definition.slug)
      - CATEGORY_DEFINITIONS.findIndex((definition) => definition.slug === right.definition.slug);
  });

  const winner = scores[0];
  if (!winner || winner.score < CATEGORY_THRESHOLD) {
    const fallback = CATEGORY_DEFINITIONS.find((definition) => definition.slug === "other");
    return {
      category: fallback.slug,
      category_label: fallback.label,
      category_color: fallback.color,
      category_description: fallback.description,
      category_score: 0
    };
  }

  return {
    category: winner.definition.slug,
    category_label: winner.definition.label,
    category_color: winner.definition.color,
    category_description: winner.definition.description,
    category_score: winner.score
  };
}

async function fetchStarredPage(page) {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/starred`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "created");
  url.searchParams.set("direction", "desc");

  const headers = {
    Accept: "application/vnd.github.star+json",
    "User-Agent": `${username}-github-stars-atlas`,
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API request failed (${response.status}): ${body}`);
  }
  return response.json();
}

async function fetchAllStarred() {
  const repositories = [];
  for (let page = 1; ; page += 1) {
    const items = await fetchStarredPage(page);
    repositories.push(...items);
    if (items.length < perPage) {
      break;
    }
  }
  return repositories;
}

function computeFreshness(repository) {
  if (repository.archived) {
    return "archived";
  }
  const age = daysSince(repository.pushed_at);
  if (age <= 30) {
    return "active";
  }
  if (age <= 180) {
    return "recent";
  }
  return "stale";
}

function normalizeRepository(item) {
  const repository = item.repo ?? item;
  const topics = [...new Set((repository.topics || []).map((topic) => topic.toLowerCase()))].sort();
  const normalized = {
    id: String(repository.id),
    name: repository.name,
    owner: repository.owner?.login || repository.full_name?.split("/")[0] || "",
    full_name: repository.full_name,
    html_url: repository.html_url,
    description: repository.description || "",
    language: repository.language || "Unknown",
    homepage: repository.homepage || null,
    stargazers_count: repository.stargazers_count || 0,
    forks_count: repository.forks_count || 0,
    open_issues_count: repository.open_issues_count || 0,
    topics,
    created_at: repository.created_at || null,
    updated_at: repository.updated_at || null,
    pushed_at: repository.pushed_at || null,
    starred_at: item.starred_at || repository.starred_at || null,
    archived: Boolean(repository.archived),
    disabled: Boolean(repository.disabled),
    fork: Boolean(repository.fork)
  };

  return {
    ...normalized,
    ...classifyRepository(normalized),
    freshness: computeFreshness(normalized)
  };
}

function buildCategorySummaries(repositories) {
  return CATEGORY_DEFINITIONS.map((definition) => {
    const items = repositories.filter((repository) => repository.category === definition.slug);
    const topTopics = [...countBy(items.flatMap((repository) => repository.topics).filter((topic) => !EXCLUDED_TOPICS.has(topic)), (topic) => topic).entries()]
      .sort(compareByCountAndName)
      .slice(0, 5)
      .map(([topic]) => topic);

    return {
      slug: definition.slug,
      label: definition.label,
      description: definition.description,
      color: definition.color,
      count: items.length,
      percentage: repositories.length === 0 ? 0 : items.length / repositories.length,
      top_topics: topTopics
    };
  }).filter((category) => category.count > 0)
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.label.localeCompare(right.label, "en");
    });
}

function buildGraphLinks(repositories) {
  const links = [];
  const seen = new Set();

  const addLink = (source, target, type, weight, topic = null) => {
    if (!source || !target || source === target) {
      return;
    }
    const [left, right] = source < target ? [source, target] : [target, source];
    const key = `${left}:${right}:${type}:${topic || ""}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    links.push({ source: left, target: right, type, weight, topic });
  };

  const categoryGroups = new Map();
  for (const repository of repositories) {
    const bucket = categoryGroups.get(repository.category) || [];
    bucket.push(repository);
    categoryGroups.set(repository.category, bucket);
  }

  for (const bucket of categoryGroups.values()) {
    const sorted = [...bucket].sort(compareByStarsThenStarred);
    const anchor = sorted[0];
    if (!anchor) {
      continue;
    }

    for (let index = 1; index < Math.min(sorted.length, 12); index += 1) {
      addLink(anchor.id, sorted[index].id, "category", 1);
    }

    for (let index = 1; index < Math.min(sorted.length, 8); index += 1) {
      addLink(sorted[index - 1].id, sorted[index].id, "sequence", 0.6);
    }

    const topicGroups = new Map();
    for (const repository of sorted) {
      for (const topic of repository.topics) {
        if (!topic || topic.length < 3 || EXCLUDED_TOPICS.has(topic)) {
          continue;
        }
        const list = topicGroups.get(topic) || [];
        list.push(repository);
        topicGroups.set(topic, list);
      }
    }

    for (const [topic, list] of topicGroups.entries()) {
      if (list.length < 2 || list.length > 6) {
        continue;
      }
      const ranked = [...list].sort(compareByStarsThenStarred);
      for (let index = 1; index < ranked.length; index += 1) {
        addLink(ranked[0].id, ranked[index].id, "topic", 0.8, topic);
      }
    }
  }

  return links;
}

function renderRepoLine(repository) {
  const extras = [`\`${repository.language}\``, `⭐ ${formatNumber(repository.stargazers_count)}`, `Starred ${formatDate(repository.starred_at)}`];
  if (repository.topics.length > 0) {
    extras.push(`Topics: ${repository.topics.slice(0, 4).join(", ")}`);
  }
  if (repository.homepage) {
    extras.push(`[homepage](${repository.homepage})`);
  }
  return `- [${repository.full_name}](${repository.html_url}) — ${abbreviate(repository.description, 100)} · ${extras.join(" · ")}`;
}

function renderReadme({ username, generatedAt, pagesUrl, repositoryCount, categories, languages, topTopics, recentRepos, popularRepos, stats }) {
  const lines = [];
  lines.push(`# ${username}'s Stars Atlas`);
  lines.push("");
  lines.push(`自动更新的 GitHub star 图谱与主题化索引，来源是 [@${username} 的 stars](https://github.com/${username}?tab=stars)。`);
  lines.push("");
  lines.push(`- 图谱页面：[GitHub Pages](${pagesUrl})`);
  lines.push(`- 页面源码：[\`docs/index.html\`](./docs/index.html)`);
  lines.push(`- 数据文件：[\`data.json\`](./data.json)`);
  lines.push(`- 总仓库数：${formatNumber(repositoryCount)}`);
  lines.push(`- 生成时间：${generatedAt}`);
  lines.push("");
  lines.push("> 语言只作为辅助维度；主视图已经升级为按 topic 和语义分类的交互图谱。");
  lines.push("");
  lines.push("## Highlights");
  lines.push("");
  lines.push(`- 最近 30 天新增 star：${formatNumber(stats.starred_last_30_days)}`);
  lines.push(`- 90 天内仍活跃的仓库：${formatNumber(stats.active_last_90_days)}`);
  lines.push(`- 已归档仓库：${formatNumber(stats.archived_count)}`);
  lines.push(`- 最热门收藏：[${stats.most_popular.full_name}](${stats.most_popular.html_url}) ⭐ ${formatNumber(stats.most_popular.stargazers_count)}`);
  lines.push("");
  lines.push("## Top Categories");
  lines.push("");
  lines.push("| 分类 | 数量 | 占比 | 代表 topics |");
  lines.push("| --- | ---: | ---: | --- |");
  for (const category of categories) {
    lines.push(`| ${category.label} | ${formatNumber(category.count)} | ${formatPercent(category.percentage)} | ${category.top_topics.slice(0, 3).map((topic) => `\`${topic}\``).join(", ") || "-"} |`);
  }
  lines.push("");
  lines.push("## Top Topics");
  lines.push("");
  for (const item of topTopics.slice(0, 15)) {
    lines.push(`- \`${item.topic}\` · ${formatNumber(item.count)}`);
  }
  lines.push("");
  lines.push("## Recent Stars");
  lines.push("");
  for (const repository of recentRepos.slice(0, 12)) {
    lines.push(renderRepoLine(repository));
  }
  lines.push("");
  lines.push("## Popular Repositories");
  lines.push("");
  for (const repository of popularRepos.slice(0, 12)) {
    lines.push(renderRepoLine(repository));
  }
  lines.push("");
  lines.push("## Language Snapshot");
  lines.push("");
  for (const language of languages.slice(0, 12)) {
    lines.push(`- **${language.language}**: ${formatNumber(language.count)}`);
  }
  lines.push("");
  lines.push("## Local Preview");
  lines.push("");
  lines.push("```bash");
  lines.push("python3 -m http.server 8000 --directory docs");
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

const rawRepositories = await fetchAllStarred();
const repositories = rawRepositories.map(normalizeRepository).sort(compareByStarredThenStars);
const languages = [...countBy(repositories, (repository) => repository.language).entries()]
  .sort(compareByCountAndName)
  .map(([language, count]) => ({ language, count }));
const topTopics = [...countBy(repositories.flatMap((repository) => repository.topics).filter((topic) => !EXCLUDED_TOPICS.has(topic)), (topic) => topic).entries()]
  .sort(compareByCountAndName)
  .map(([topic, count]) => ({ topic, count }));
const categories = buildCategorySummaries(repositories);
const recentRepos = [...repositories].sort(compareByStarredThenStars);
const popularRepos = [...repositories].sort(compareByStarsThenStarred);
const timeline = [...countBy(repositories, (repository) => monthKey(repository.starred_at)).entries()]
  .sort(([leftMonth], [rightMonth]) => leftMonth.localeCompare(rightMonth, "en"))
  .map(([month, count]) => ({ month, count }));
const graphLinks = buildGraphLinks(repositories);
const stats = {
  starred_last_30_days: repositories.filter((repository) => daysSince(repository.starred_at) <= 30).length,
  active_last_90_days: repositories.filter((repository) => daysSince(repository.pushed_at) <= 90).length,
  archived_count: repositories.filter((repository) => repository.archived).length,
  most_popular: popularRepos[0] || { full_name: "N/A", html_url: `https://github.com/${username}`, stargazers_count: 0 }
};
const generatedAt = new Date().toISOString();

const payload = {
  username,
  repository: repositorySlug,
  pages_url: pagesUrl,
  generated_at: generatedAt,
  repository_count: repositories.length,
  categories,
  languages,
  top_topics: topTopics,
  timeline,
  graph_links: graphLinks,
  stats,
  repositories
};

await mkdir(docsDir, { recursive: true });
await writeFile(path.join(repoRoot, "README.md"), renderReadme({
  username,
  generatedAt,
  pagesUrl,
  repositoryCount: repositories.length,
  categories,
  languages,
  topTopics,
  recentRepos,
  popularRepos,
  stats
}), "utf8");
await writeFile(path.join(repoRoot, "data.json"), `${JSON.stringify(payload, null, 2)}
`, "utf8");
await writeFile(path.join(docsDir, "data.json"), `${JSON.stringify(payload, null, 2)}
`, "utf8");

console.log(`Generated README.md, data.json, and docs/data.json for ${username} (${repositories.length} repos, ${graphLinks.length} links).`);
