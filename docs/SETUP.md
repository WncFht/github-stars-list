# Setup

这个仓库不依赖个人 PAT。

实现方式：

- GitHub Actions 在 `push / workflow_dispatch / schedule` 时运行
- 脚本调用公开接口 `GET /users/{username}/starred`
- 生成 `README.md` 和 `data.json`
- 如果内容有变化，再用内置 `GITHUB_TOKEN` 提交回仓库

## 为什么不需要 PAT

这里拉的是公开的 starred 列表，不是 `GET /user/starred`。

所以：

- 读取 stars：走公开接口
- 提交产物：走 Actions 自带的 `GITHUB_TOKEN`

这样就不用额外创建或保存长期 token。

## 本地调试

```bash
node scripts/update-stars.mjs <github-username>
```

## Actions 入口

文件在：

- `.github/workflows/update-stars.yml`

