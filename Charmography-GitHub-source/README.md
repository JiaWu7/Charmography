# Charmography

一个记录毛绒包挂与主人关系的参与式网站。

项目包含三个页面：

- 首页：拖动连接字母 o，其他字母下落并旋转；Reconnect 恢复原始 logo。
- COLLECT：填写 Origin、Accumulation、Outcome，上传照片，提交到保存服务。
- ARCHIVE：TT、JJ、XY、BB、CC、SS 的六份采访档案，点击照片展开故事。

现有在线网站：https://charmography.arcanelotus32.chatgpt.site

## 用 GitHub 网页上传

1. 解压这个 ZIP，打开 Charmography-GitHub-source 文件夹。
2. 登录 https://github.com/new，新建名为 charmography 的仓库。保存代码时可先选 Private。
3. 创建后进入仓库的 Code 页面。选择 Add file > Upload files；空仓库也可点击 uploading an existing file。
4. 在 Mac 的 Finder 中按 Command + Shift + . 显示隐藏文件，确保 .openai 文件夹也能看到。
5. 把本文件夹内部的文件和文件夹拖入上传区域。上传后仓库根目录应包含 README.md、package.json、web、worker、source、scripts、tests、drizzle 和 .openai。
6. 填写提交说明，例如 Add Charmography website。选择直接提交到 main，再点击提交按钮。

ZIP 是供下载的容器；解压后的项目文件可以在 GitHub 里逐个查看和编辑。

## 主要文件

- web/：三个页面的 HTML、CSS、JavaScript 和照片、字形等资源。
- worker/index.js：网页路由与文字、照片保存接口。
- source/archive-records.json：六份档案文字、照片对应关系和陈列位置。
- source/archive-template.html：档案页面模板。
- scripts/：档案生成和 Worker 构建脚本。
- drizzle/：数据库结构的迁移文件。
- tests/：页面交互和提交服务的功能检查。
- .openai/hosting.json：现有网站的标识与运行时配置。
- dist/：当前构建产物，运行构建命令后会重新生成。

## 本地构建

推荐使用 Node.js 24 或更新版本。现有构建和检查没有 npm 安装依赖。

```sh
npm run build
npm test
node tests/simulation.mjs
node tests/interaction.mjs
```

构建输出为 dist/server/index.js。实际运行需要兼容 Cloudflare Workers 的环境、名为 DB 的 D1 数据库绑定和名为 BUCKET 的 R2 文件绑定。数据库迁移应在部署服务前应用。

## 网站托管

GitHub 仓库可以保存全部源代码。生成网站网址需要另外配置托管服务。

GitHub Pages 是静态托管服务，可提供 HTML、CSS、JavaScript 页面。本项目的 COLLECT 会请求 /api/stories 保存文字与照片，并使用服务端数据库和文件存储；该接口需要单独部署。

这个源码包保留完整提交功能与现有路径，是当前网站的源码备份。它没有把 COLLECT 的真实提交改成演示。请先完成仓库上传，再根据所选托管环境配置部署和路径。

GitHub 官方说明：

- 创建仓库：https://docs.github.com/en/repositories/creating-and-managing-repositories/creating-a-new-repository
- 上传文件：https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository
- GitHub Pages：https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

## 素材

Moirai One 字体和 OFL 许可保存在 source/。Matter.js 0.20.0 已打包在 web/assets/matter.min.js，其 MIT 许可保留在文件头部。
