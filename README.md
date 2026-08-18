# Google ABCD 视频创意体检仪

一款现代暗色 SaaS 风格的 AI 视频创意诊断应用。上传广告短视频后，Gemini 会原生理解画面、字幕、声音与剪辑节奏，并严格依据 Google ABCD 原则生成结构化诊断报告。

## 功能

- 拖拽上传并在浏览器内预览 MP4、MOV、WEBM 视频
- Gemini Files API 原生视频多模态分析
- Attract、Brand、Connect、Direct 四维评分与可执行建议
- 环形总分、核心结论、亮点及优先级动作
- 一键导出高清 PNG 或分页 PDF
- API Key 仅由 Express 服务端读取，不进入前端构建产物

## 本地运行

需要 Node.js 22 或更高版本。

```bash
npm install
cp .env.example .env
```

编辑 `.env` 并填写从 [Google AI Studio](https://aistudio.google.com/app/apikey) 获取的 Key：

```env
GEMINI_API_KEY=your_key
GEMINI_MODEL=gemini-2.5-flash
```

启动前端与 API 服务：

```bash
npm run dev
```

打开 `http://localhost:5173`。Vite 会将 `/api` 请求代理到 `http://localhost:3001`。

## 生产运行

```bash
npm run build
npm start
```

构建后 Express 会同时托管静态页面和 API，默认地址为 `http://localhost:3001`。可通过 `PORT` 环境变量修改端口。

## 技术栈

Vite 8、React 19、Tailwind CSS 4、Express 5、Google GenAI SDK、Lucide React、html2canvas、jsPDF。

> 视频上传限制为 100MB。服务会在诊断结束后删除本地临时文件，并请求删除 Gemini Files API 中的远程文件。
