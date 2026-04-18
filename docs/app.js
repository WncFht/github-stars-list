const state = {
  query: "",
  category: "all",
  language: "all",
  freshness: "all",
  minStars: 0
};

const elements = {
  title: document.querySelector("#page-title"),
  description: document.querySelector("#page-description"),
  readmeLink: document.querySelector("#readme-link"),
  metrics: document.querySelector("#metrics"),
  searchInput: document.querySelector("#search-input"),
  categorySelect: document.querySelector("#category-select"),
  languageSelect: document.querySelector("#language-select"),
  freshnessSelect: document.querySelector("#freshness-select"),
  starsSelect: document.querySelector("#stars-select"),
  resetButton: document.querySelector("#reset-button"),
  categoryChips: document.querySelector("#category-chips"),
  legend: document.querySelector("#legend"),
  graphCaption: document.querySelector("#graph-caption"),
  topicList: document.querySelector("#topic-list"),
  repoList: document.querySelector("#repo-list"),
  tooltip: document.querySelector("#tooltip")
};

const svg = d3.select("#graph");
const zoomLayer = svg.append("g");
const clusterLayer = zoomLayer.append("g");
const linkLayer = zoomLayer.append("g");
const nodeLayer = zoomLayer.append("g");
const labelLayer = zoomLayer.append("g");
let simulation;
let payload;
let zoomBehavior;

const STAR_FILTERS = [0, 100, 500, 1000, 5000, 10000];
const FRESHNESS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active ≤ 30d" },
  { value: "recent", label: "Recent ≤ 180d" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" }
];

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDate(value) {
  if (!value) {
    return "未知";
  }
  return new Date(value).toISOString().slice(0, 10);
}

function createMetricCard(label, value, helper) {
  return `
    <article class="metric-card">
      <span class="metric-label">${label}</span>
      <div class="metric-value">${value}</div>
      <div class="metric-helper">${helper}</div>
    </article>
  `;
}

function fillSelect(select, options, valueKey = "value", labelKey = "label") {
  select.innerHTML = options.map((option) => `<option value="${option[valueKey]}">${option[labelKey]}</option>`).join("");
}

function getFilteredRepositories() {
  return payload.repositories.filter((repository) => {
    const haystack = `${repository.full_name} ${repository.description} ${repository.language} ${repository.topics.join(" ")}`.toLowerCase();
    if (state.query && !haystack.includes(state.query)) {
      return false;
    }
    if (state.category !== "all" && repository.category !== state.category) {
      return false;
    }
    if (state.language !== "all" && repository.language !== state.language) {
      return false;
    }
    if (state.freshness !== "all" && repository.freshness !== state.freshness) {
      return false;
    }
    if (repository.stargazers_count < state.minStars) {
      return false;
    }
    return true;
  });
}

function getVisibleLinks(repositories) {
  const visibleIds = new Set(repositories.map((repository) => repository.id));
  return payload.graph_links.filter((link) => visibleIds.has(link.source) && visibleIds.has(link.target)).slice(0, 700);
}

function buildCenters(width, height, categories) {
  const cols = width < 960 ? 2 : 3;
  const rows = Math.max(1, Math.ceil(categories.length / cols));
  const paddingX = 120;
  const paddingY = 110;
  const usableWidth = Math.max(320, width - paddingX * 2);
  const usableHeight = Math.max(260, height - paddingY * 2);
  const centers = new Map();

  categories.forEach((category, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = paddingX + ((col + 0.5) * usableWidth) / cols;
    const y = paddingY + ((row + 0.5) * usableHeight) / rows;
    centers.set(category.slug, { x, y, label: category.label });
  });

  return centers;
}

function renderMetrics(repositories) {
  const visibleCategories = new Set(repositories.map((repository) => repository.category));
  const topicCounts = countTopics(repositories);
  const topTopic = topicCounts[0];
  const activeRepos = repositories.filter((repository) => repository.freshness === "active").length;
  const newest = [...repositories].sort((left, right) => Date.parse(right.starred_at || 0) - Date.parse(left.starred_at || 0))[0];

  elements.metrics.innerHTML = [
    createMetricCard("Visible repos", formatNumber(repositories.length), `${formatNumber(payload.repository_count)} total`),
    createMetricCard("Categories", formatNumber(visibleCategories.size), `${payload.categories.length} total clusters`),
    createMetricCard("Top topic", topTopic ? topTopic.topic : "-", topTopic ? `${formatNumber(topTopic.count)} repos` : "No dominant topic"),
    createMetricCard("Active repos", formatNumber(activeRepos), newest ? `Newest star: ${formatDate(newest.starred_at)}` : "No stars")
  ].join("");
}

function countTopics(repositories) {
  const counts = new Map();
  repositories.forEach((repository) => {
    repository.topics.forEach((topic) => counts.set(topic, (counts.get(topic) || 0) + 1));
  });
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((left, right) => right.count - left.count || left.topic.localeCompare(right.topic, "en"));
}

function renderInsights(repositories) {
  const topTopics = countTopics(repositories).slice(0, 8);
  elements.topicList.innerHTML = topTopics.length === 0
    ? "<li>暂无 topic</li>"
    : topTopics.map((item) => `<li><strong>${item.topic}</strong><small>${formatNumber(item.count)} repos</small></li>`).join("");

  const repoList = [...repositories]
    .sort((left, right) => right.stargazers_count - left.stargazers_count || left.full_name.localeCompare(right.full_name, "en"))
    .slice(0, 10);

  elements.repoList.innerHTML = repoList.length === 0
    ? "<li>当前筛选没有结果</li>"
    : repoList.map((repository) => `
      <li>
        <a href="${repository.html_url}" target="_blank" rel="noreferrer">${repository.full_name}</a>
        <small>${repository.category_label} · ⭐ ${formatNumber(repository.stargazers_count)} · ${formatDate(repository.starred_at)}</small>
      </li>
    `).join("");
}

function renderLegend() {
  elements.legend.innerHTML = payload.categories.map((category) => `
    <button class="legend-item" data-category="${category.slug}" type="button">
      <span class="swatch" style="background:${category.color}"></span>
      <span>${category.label}</span>
    </button>
  `).join("");

  elements.legend.querySelectorAll(".legend-item").forEach((button) => {
    button.addEventListener("click", () => {
      state.category = button.dataset.category;
      elements.categorySelect.value = state.category;
      syncCategoryChips();
      update();
    });
  });
}

function syncCategoryChips() {
  elements.categoryChips.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.category === state.category || (chip.dataset.category === "all" && state.category === "all"));
  });
}

function renderCategoryChips() {
  elements.categoryChips.innerHTML = [
    `<button class="chip active" data-category="all" type="button"><span class="swatch" style="background:#94a3b8"></span><span>All</span></button>`,
    ...payload.categories.slice(0, 8).map((category) => `
      <button class="chip" data-category="${category.slug}" type="button">
        <span class="swatch" style="background:${category.color}"></span>
        <span>${category.label}</span>
      </button>
    `)
  ].join("");

  elements.categoryChips.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      state.category = chip.dataset.category;
      elements.categorySelect.value = state.category;
      syncCategoryChips();
      update();
    });
  });
}

function initControls() {
  fillSelect(elements.categorySelect, [{ value: "all", label: "All categories" }, ...payload.categories.map((category) => ({ value: category.slug, label: category.label }))]);
  fillSelect(elements.languageSelect, [{ value: "all", label: "All languages" }, ...payload.languages.map((language) => ({ value: language.language, label: `${language.language} (${language.count})` }))]);
  fillSelect(elements.freshnessSelect, FRESHNESS_OPTIONS);
  fillSelect(elements.starsSelect, STAR_FILTERS.map((value) => ({ value: String(value), label: value === 0 ? "Any" : `${formatNumber(value)}+` })));

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    update();
  });
  elements.categorySelect.addEventListener("change", (event) => {
    state.category = event.target.value;
    syncCategoryChips();
    update();
  });
  elements.languageSelect.addEventListener("change", (event) => {
    state.language = event.target.value;
    update();
  });
  elements.freshnessSelect.addEventListener("change", (event) => {
    state.freshness = event.target.value;
    update();
  });
  elements.starsSelect.addEventListener("change", (event) => {
    state.minStars = Number(event.target.value);
    update();
  });
  elements.resetButton.addEventListener("click", () => {
    state.query = "";
    state.category = "all";
    state.language = "all";
    state.freshness = "all";
    state.minStars = 0;
    elements.searchInput.value = "";
    elements.categorySelect.value = "all";
    elements.languageSelect.value = "all";
    elements.freshnessSelect.value = "all";
    elements.starsSelect.value = "0";
    syncCategoryChips();
    resetZoom();
    update();
  });
}

function resizeSvg() {
  const rect = svg.node().getBoundingClientRect();
  svg.attr("viewBox", `0 0 ${rect.width} ${rect.height}`);
  return rect;
}

function resetZoom() {
  if (zoomBehavior) {
    svg.transition().duration(350).call(zoomBehavior.transform, d3.zoomIdentity);
  }
}

function showTooltip(event, repository) {
  elements.tooltip.hidden = false;
  elements.tooltip.innerHTML = `
    <h3>${repository.full_name}</h3>
    <p><strong>${repository.category_label}</strong> · ${repository.language}</p>
    <p>⭐ ${formatNumber(repository.stargazers_count)} · Forks ${formatNumber(repository.forks_count)} · Starred ${formatDate(repository.starred_at)}</p>
    <p>${repository.description || "No description"}</p>
    <p class="tooltip-meta">Topics: ${repository.topics.slice(0, 6).join(", ") || "无"}</p>
  `;
  const offset = 18;
  elements.tooltip.style.left = `${event.clientX + offset}px`;
  elements.tooltip.style.top = `${event.clientY + offset}px`;
}

function hideTooltip() {
  elements.tooltip.hidden = true;
}

function renderGraph(repositories) {
  const { width, height } = resizeSvg();
  const visibleCategories = payload.categories.filter((category) => repositories.some((repository) => repository.category === category.slug));
  const centers = buildCenters(width, height, visibleCategories);
  const radiusScale = d3.scaleSqrt()
    .domain(d3.extent(payload.repositories, (repository) => repository.stargazers_count))
    .range([4, 24]);

  const nodes = repositories.map((repository) => ({ ...repository }));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const links = getVisibleLinks(repositories)
    .map((link) => ({ ...link, source: nodeById.get(link.source), target: nodeById.get(link.target) }))
    .filter((link) => link.source && link.target);

  clusterLayer.selectAll(".cluster-label")
    .data([...centers.entries()], ([slug]) => slug)
    .join("text")
    .attr("class", "cluster-label")
    .attr("x", ([, center]) => center.x)
    .attr("y", ([, center]) => center.y - 48)
    .text(([, center]) => center.label);

  const topLabelIds = new Set(
    [...nodes]
      .sort((left, right) => right.stargazers_count - left.stargazers_count)
      .slice(0, repositories.length <= 80 ? repositories.length : 16)
      .map((repository) => repository.id)
  );

  if (simulation) {
    simulation.stop();
  }

  const linkSelection = linkLayer.selectAll(".link")
    .data(links, (link) => `${link.source.id}-${link.target.id}-${link.type}-${link.topic || ""}`)
    .join("line")
    .attr("class", "link")
    .attr("stroke-width", (link) => link.type === "topic" ? 1.6 : 1.1)
    .attr("opacity", (link) => link.type === "topic" ? 0.18 : 0.12);

  const nodeSelection = nodeLayer.selectAll(".node")
    .data(nodes, (node) => node.id)
    .join("circle")
    .attr("class", "node")
    .attr("r", (node) => radiusScale(node.stargazers_count))
    .attr("fill", (node) => node.category_color)
    .attr("opacity", (node) => node.archived ? 0.45 : 0.92)
    .on("mouseenter", (event, node) => showTooltip(event, node))
    .on("mousemove", (event, node) => showTooltip(event, node))
    .on("mouseleave", hideTooltip)
    .on("click", (_, node) => window.open(node.html_url, "_blank", "noopener,noreferrer"))
    .call(d3.drag()
      .on("start", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0.3).restart();
        }
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) {
          simulation.alphaTarget(0);
        }
        node.fx = null;
        node.fy = null;
      }));

  const labelSelection = labelLayer.selectAll(".node-label")
    .data(nodes.filter((node) => topLabelIds.has(node.id)), (node) => node.id)
    .join("text")
    .attr("class", "node-label")
    .text((node) => node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name);

  simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).id((node) => node.id).distance((link) => link.type === "topic" ? 42 : 70).strength((link) => link.type === "topic" ? 0.28 : 0.14))
    .force("charge", d3.forceManyBody().strength((node) => -22 - radiusScale(node.stargazers_count) * 2.4))
    .force("collide", d3.forceCollide().radius((node) => radiusScale(node.stargazers_count) + 3))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("x", d3.forceX((node) => (centers.get(node.category) || { x: width / 2 }).x).strength(0.24))
    .force("y", d3.forceY((node) => (centers.get(node.category) || { y: height / 2 }).y).strength(0.24))
    .alpha(1)
    .alphaDecay(0.05)
    .on("tick", () => {
      linkSelection
        .attr("x1", (link) => link.source.x)
        .attr("y1", (link) => link.source.y)
        .attr("x2", (link) => link.target.x)
        .attr("y2", (link) => link.target.y);

      nodeSelection
        .attr("cx", (node) => node.x)
        .attr("cy", (node) => node.y);

      labelSelection
        .attr("x", (node) => node.x)
        .attr("y", (node) => node.y - radiusScale(node.stargazers_count) - 6);
    });

  elements.graphCaption.textContent = `${repositories.length} repos · ${links.length} links · drag / zoom / click to open GitHub`;
}

function update() {
  const repositories = getFilteredRepositories();
  renderMetrics(repositories);
  renderInsights(repositories);
  renderGraph(repositories);
}

async function init() {
  payload = await fetch("./data.json").then((response) => response.json());
  elements.title.textContent = `${payload.username}'s Stars Atlas`;
  elements.description.textContent = `共 ${formatNumber(payload.repository_count)} 个仓库，按 topic / description / language 做了主题聚类。`;
  elements.readmeLink.href = `https://github.com/${payload.repository}/blob/main/README.md`;

  zoomBehavior = d3.zoom()
    .scaleExtent([0.35, 4])
    .on("zoom", (event) => {
      zoomLayer.attr("transform", event.transform);
    });
  svg.call(zoomBehavior);

  initControls();
  renderCategoryChips();
  renderLegend();
  syncCategoryChips();
  update();

  window.addEventListener("resize", () => update());
}

init().catch((error) => {
  elements.title.textContent = "Failed to load graph";
  elements.description.textContent = error.message;
  console.error(error);
});
