# Sendmail

基于 Cloudflare Pages + Pages Functions + Resend 的轻量邮件发送页面，支持中文响应式界面、发送状态反馈和输入校验。

## Cloudflare Pages 部署（推荐）

本项目是 **Pages 项目**。日志中的 `wrangler deploy` 属于 Workers 部署命令，不能自动迁移本项目的 Pages Functions。请在 Cloudflare 的 **Workers & Pages → Create application → Pages → Connect to Git** 中连接仓库；如果原项目创建为 Worker，请创建 Pages 项目重新连接。

构建设置：

| 设置 | 值 |
| --- | --- |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `public` |
| Root directory | 仓库根目录（留空） |

Pages 的 Git 集成会自动发布 `public/`，并编译仓库根目录下的 `functions/`，不需要额外填写 Workers 的 Deploy command。不要将项目根目录设置为 `public`，否则无法发现 `functions/`。

在 Pages 项目 **Settings → Variables and Secrets** 添加以下两个变量，类型均选择 Secret：

| 名称 | 值 |
| --- | --- |
| `RESEND_API_KEY` | Resend API Key |
| `SECRET` | 自己设置的发送密码，建议使用较长的随机密码 |

按需分别配置 Production 和 Preview，保存后重新部署。每次发送时，页面会将输入的密码交给服务端校验；密码须与 `SECRET` 完全一致（包括空格）。未填写或密码错误会返回 401，不会调用 Resend；未设置 `SECRET` 或设置为空白时会禁用发送并返回 503。页面不会将密码保存到本地存储，密码也不会转发给 Resend。

发件地址必须来自 Resend 已验证的域名；测试域名的收件限制以 Resend 账户规则为准。

## 命令行部署

需要 Node.js 22 或更新版本。

```sh
npm ci
npx wrangler login
# 仅首次使用、且 Pages 项目尚不存在时执行：
npx wrangler pages project create sendemail
npm run build
npm run deploy
```

`wrangler.toml` 默认项目名为 `sendemail`。已有不同名称的 Pages 项目时，将 `name` 改为实际名称，或运行 `npm run deploy -- --project-name your-pages-project`。自动化部署需要设置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`；命令必须使用 `npm run deploy` 或 `npx wrangler pages deploy public --project-name your-pages-project`，不要使用 `npx wrangler deploy`。

API Key 也可以用 `npx wrangler pages secret put RESEND_API_KEY --project-name sendemail` 配置；添加或更改后重新部署。

发送密码可以用 `npx wrangler pages secret put SECRET --project-name sendemail` 配置；添加或更改后重新部署。

## 本地开发

```sh
npm ci
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入自己的 RESEND_API_KEY 和发送密码 SECRET
npm run dev
```

打开 Wrangler 输出的本地地址。`.dev.vars` 已加入 Git 忽略列表；密钥只用于服务端，不放入 `public/`。

```sh
npm test
npm run build
```

## 目录

```text
public/                     # 唯一的静态资源发布目录
  index.html
  styles.css
  index.js
functions/api/send-email.js # POST /api/send-email，服务端调用 Resend
scripts/build.mjs           # 检查静态资源是否齐全
wrangler.toml               # Pages 项目名称及输出目录
```

页面使用共享发送密码保护接口，不包含用户登录或发送额度控制。如果用于个人或内部团队，也可以通过 Cloudflare Access 进一步限制访问。
