import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const username = process.env.GITHUB_USERNAME || process.argv[2];

if (!username) {
  console.error("Usage: node scripts/update-stars.mjs <github-username>");
  process.exit(1);
}

const apiToken = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN || "";
const perPage = 100;

async function fetchStarredPage(page) {
  const url = new URL(`https://api.github.com/users/${encodeURIComponent(username)}/starred`);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("page", String(page));

  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": `${username}-github-stars-list`,
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

function normalizeRepository(repository) {
  return {
    full_name: repository.full_name,
    html_url: repository.html_url,
    description: repository.description,
    language: repository.language,
    homepage: repository.homepage || null,
    stargazers_count: repository.stargazers_count,
    forks_count: repository.forks_count,
    open_issues_count: repository.open_issues_count,
    topics: repository.topics || [],
    updated_at: repository.updated_at,
    pushed_at: repository.pushed_at
  };
}

function groupByLanguage(repositories) {
  const grouped = new Map();

  for (const repository of repositories) {
    const key = repository.language || "Unknown";
    const current = grouped.get(key) || [];
    current.push(repository);
    grouped.set(key, current);
  }

  return [...grouped.entries()]
    .map(([language, items]) => [
      language,
      items.sort((a, b) => a.full_name.localeCompare(b.full_name, "en"))
    ])
    .sort((a, b) => {
      if (b[1].length !== a[1].length) {
        return b[1].length - a[1].length;
      }

      return a[0].localeCompare(b[0], "en");
    });
}

function renderReadme({ username, generatedAt, groupedRepositories, repositoryCount }) {
  const lines = [];

  lines.push(`# ${username}'s Stars`);
  lines.push("");
  lines.push(`自动更新的 GitHub star 列表，来源是 [@${username} 的 stars](https://github.com/${username}?tab=stars)。`);
  lines.push("");
  lines.push(`- 总仓库数：${repositoryCount}`);
  lines.push(`- 生成时间：${generatedAt}`);
  lines.push(`- 数据文件：[\`data.json\`](./data.json)`);
  lines.push("");
  lines.push("> 这个 README 由 GitHub Actions 自动生成。");
  lines.push("");

  if (groupedRepositories.length === 0) {
    lines.push("当前还没有公开的 starred 仓库。");
    lines.push("");
    return `${lines.join("\n")}\n`;
  }

  lines.push("## Languages");
  lines.push("");

  for (const [language, repositories] of groupedRepositories) {
    lines.push(`- **${language}**: ${repositories.length}`);
  }

  lines.push("");

  for (const [language, repositories] of groupedRepositories) {
    lines.push(`## ${language}`);
    lines.push("");

    for (const repository of repositories) {
      const extras = [];

      if (repository.homepage) {
        extras.push(`[homepage](${repository.homepage})`);
      }

      extras.push(`⭐ ${repository.stargazers_count}`);

      const suffix = extras.length > 0 ? ` · ${extras.join(" · ")}` : "";
      const description = repository.description || "No description";

      lines.push(`- [${repository.full_name}](${repository.html_url}) — ${description}${suffix}`);
    }

    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

const repositories = (await fetchAllStarred()).map(normalizeRepository);
const groupedRepositories = groupByLanguage(repositories);
const generatedAt = new Date().toISOString();

const payload = {
  username,
  generated_at: generatedAt,
  repository_count: repositories.length,
  languages: groupedRepositories.map(([language, items]) => ({
    language,
    count: items.length
  })),
  repositories
};

await mkdir(path.join(repoRoot, "docs"), { recursive: true });
await mkdir(path.join(repoRoot, "scripts"), { recursive: true });
await writeFile(
  path.join(repoRoot, "README.md"),
  renderReadme({
    username,
    generatedAt,
    groupedRepositories,
    repositoryCount: repositories.length
  }),
  "utf8"
);
await writeFile(path.join(repoRoot, "data.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(`Generated README.md and data.json for ${username} (${repositories.length} repos).`);

