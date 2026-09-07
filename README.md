# Lumen AI Gateway

一个部署在 Cloudflare Workers 上的多人 AI 中转站 MVP。它使用模型供应商的官方
API，向用户提供 OpenAI 兼容接口。

## 已包含

- 独立用户 API Key（数据库只保存 SHA-256 摘要）
- 用户启用/停用与每月美元预算
- OpenAI Chat Completions 普通及流式转发
- 模型别名路由，便于优先选择低价模型
- 按模型价格统计 token 和预计成本
- 管理后台与最近调用记录接口
- Cloudflare D1 数据库迁移

> 中转服务不会改变模型供应商的价格。节省来自选择低价模型、按量付费和额度控制。
> 请只使用官方 API，并确认供应商条款允许你的使用方式。

## 本地运行

要求 Node.js 20 或更高版本，以及 Cloudflare 账号。

```bash
npm install
npx wrangler d1 create lumen-ai-gateway
```

将命令返回的 `database_id` 写入 `wrangler.jsonc`，然后创建
`.dev.vars`（不要提交）：

```dotenv
ADMIN_TOKEN=请替换为高强度随机令牌
UPSTREAM_API_KEY=模型供应商官方密钥
```

应用本地迁移并启动：

```bash
npm run db:migrate:local
npm run dev
```

打开终端显示的地址即可进入管理后台。先填写 `ADMIN_TOKEN`，再创建用户；用户密钥
只会显示一次。

## 部署

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put UPSTREAM_API_KEY
npm run db:migrate:remote
npm run deploy
```

生产环境建议在 `ALLOWED_ORIGIN` 中填写管理后台域名，并通过 Cloudflare Access
进一步保护根路径。

## 模型路由和价格

`MODEL_ROUTES_JSON` 把对外别名映射到供应商的实际模型：

```json
{
  "economy": "your-provider-small-model",
  "quality": "your-provider-large-model"
}
```

网关只接受这里配置的别名和 `DEFAULT_MODEL`，会拒绝用户自行指定的其他模型，避免意外
调用高价模型。

`MODEL_PRICING_JSON` 的价格单位是“美元/百万 token”。请从供应商官网复制当前价格：

```json
{
  "your-provider-small-model": {
    "input": 0.15,
    "output": 0.6
  }
}
```

如果没有配置某模型的价格，其调用仍能成功，但预计成本记为 0，额度也不会扣减。
上线前必须为所有可用模型填写价格。

## API

用户调用：

```bash
curl https://你的域名/v1/chat/completions \
  -H "Authorization: Bearer lgw_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"economy","messages":[{"role":"user","content":"你好"}]}'
```

管理接口均使用 `Authorization: Bearer $ADMIN_TOKEN`：

- `GET /admin/users`
- `POST /admin/users`
- `PATCH /admin/users/:id`
- `GET /admin/usage?limit=100`

## 当前限制

- 额度在响应完成后按供应商返回的 token 用量扣除，并发请求可能小幅超出余额。
- 目前只代理 `/v1/chat/completions`，不包含图片、音频或文件接口。
- 这是基础管理后台；正式对外收费前还需支付、退款、隐私政策及滥用检测。
