# Setup

这个仓库现在会同时生成两套产物：

- 根目录 `README.md` / `data.json`：适合在仓库首页看摘要与原始数据
- `docs/` 图谱站点：适合在 GitHub Pages 上做交互式探索

## 数据来源

- 读取公开接口：`GET /users/{username}/starred`
- `Accept: application/vnd.github.star+json`
- 这样除了仓库本身字段，还能拿到 `starred_at`

当前生成的数据里会包含：

- `topics`
- `stargazers_count`
- `forks_count`
- `updated_at`
- `pushed_at`
- `starred_at`
- `category` / `category_label` / `category_color`
- `freshness`

## 自动化链路

- GitHub Actions 在 `push / workflow_dispatch / schedule` 时运行
- 运行 `node scripts/update-stars.mjs`
- 生成：
  - `README.md`
  - `data.json`
  - `docs/data.json`
- 上传 `docs/` 到 GitHub Pages
- 如果生成产物有变化，再用内置 `GITHUB_TOKEN` 提交回仓库

## 本地调试

先重新生成数据：

```bash
node scripts/update-stars.mjs <github-username>
```

再本地预览图谱：

```bash
python3 -m http.server 8000 --directory docs
```

打开：`http://127.0.0.1:8000/`
