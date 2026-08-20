import express from 'express'
import multer from 'multer'
import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai'
import { z } from 'zod'
import { existsSync, unlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile()
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const app = express()
const port = Number(process.env.PORT) || 3001
const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const allowedTypes = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg'])

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(allowedTypes.has(file.mimetype) ? null : new Error('UNSUPPORTED_VIDEO'), allowedTypes.has(file.mimetype))
  },
})

const dimensionSchema = z.object({
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(2).max(4),
  recommendations: z.array(z.string().min(1)).min(2).max(4),
})

const reportSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  verdict: z.string().min(1),
  executiveSummary: z.string().min(1),
  tags: z.array(z.string().min(1)).min(2).max(5),
  topPriority: z.string().min(1),
  dimensions: z.object({
    attract: dimensionSchema,
    brand: dimensionSchema,
    connect: dimensionSchema,
    direct: dimensionSchema,
  }),
})

const responseJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['overallScore', 'verdict', 'executiveSummary', 'tags', 'topPriority', 'dimensions'],
  properties: {
    overallScore: { type: 'integer', minimum: 0, maximum: 100 },
    verdict: { type: 'string', description: '一句有洞察、有结论的中文核心判断，25字以内' },
    executiveSummary: { type: 'string', description: '一段中文总评，80字以内' },
    tags: {
      type: 'array',
      minItems: 2,
      maxItems: 5,
      items: { type: 'string', description: '2至6个字的中文特征标签，不含#号' },
    },
    topPriority: { type: 'string', description: '最应优先执行的一项具体修改，60字以内' },
    dimensions: {
      type: 'object',
      additionalProperties: false,
      required: ['attract', 'brand', 'connect', 'direct'],
      properties: Object.fromEntries(
        ['attract', 'brand', 'connect', 'direct'].map((key) => [
          key,
          {
            type: 'object',
            additionalProperties: false,
            required: ['score', 'summary', 'strengths', 'recommendations'],
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              summary: { type: 'string', description: '该维度的一句中文评价，40字以内' },
              strengths: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string', description: '具体到画面、声音、文案或时间点的中文亮点' },
              },
              recommendations: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string', description: '可直接执行的中文修改建议，尽量注明时间点与改法' },
              },
            },
          },
        ]),
      ),
    },
  },
}

const systemInstruction = `你是一位严谨的资深视频广告创意策略师。你必须且只能使用 Google ABCD 原则作为评估标准，不得混入其他营销模型：

A — Attract（吸引）：广告是否从第一秒开始抓住注意力；是否使用紧凑节奏、意外感、醒目视觉、人物或声音；前3秒是否建立观看理由。
B — Brand（品牌）：品牌、产品、Logo、品牌色、声音资产是否尽早且自然出现；品牌是否融入故事而非仅在片尾贴标；看完能否准确回忆广告主。
C — Connect（共鸣）：是否以人物、情绪、真实需求或使用场景建立连接；叙事是否简单可信；画面、声音与文案是否共同服务一个清楚的信息。
D — Direct（行动）：是否明确告诉观众下一步做什么；产品利益点、行动号召与画面是否具体清晰；结尾是否强化行动而不增加认知负担。

请完整理解用户视频的画面、字幕、对白、声音、剪辑节奏与时间顺序后再评分。每项0至100分；总分应是四项得分结合整体执行质量后的合理结果。不要因视频制作精美而虚高评分，也不要臆测看不见或听不到的内容。亮点和建议必须基于视频中的具体证据，建议要能让剪辑师或创意团队直接执行。全部内容使用简体中文。严格按照指定 JSON Schema 返回，不要输出 Markdown、解释或额外字段。`

const analysisPrompt = `请诊断这支视频广告。逐帧关注开头3秒、品牌首次出现时间、核心利益点、人物/场景/情绪连接、字幕可读性、声画配合、节奏和结尾CTA。仅按系统设定的Google ABCD四项原则生成结构化诊断报告。`

const waitForFile = async (ai, uploadedFile) => {
  let current = uploadedFile
  const deadline = Date.now() + 2 * 60 * 1000
  while (current.state === 'PROCESSING') {
    if (Date.now() > deadline) throw new Error('VIDEO_PROCESSING_TIMEOUT')
    await new Promise((resolve) => setTimeout(resolve, 2500))
    current = await ai.files.get({ name: current.name })
  }
  if (current.state === 'FAILED') throw new Error('VIDEO_PROCESSING_FAILED')
  return current
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, configured: Boolean(process.env.GEMINI_API_KEY) })
})

app.post('/api/diagnose', upload.single('video'), async (request, response) => {
  const localPath = request.file?.path
  let ai
  let remoteFile
  try {
    if (!process.env.GEMINI_API_KEY) {
      return response.status(503).json({ error: '服务尚未配置 GEMINI_API_KEY，请先在 .env 中添加后重启。' })
    }
    if (!request.file) return response.status(400).json({ error: '请选择一个视频文件。' })

    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    remoteFile = await ai.files.upload({
      file: localPath,
      config: {
        mimeType: request.file.mimetype,
        displayName: request.file.originalname,
      },
    })
    remoteFile = await waitForFile(ai, remoteFile)

    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      contents: createUserContent([
        createPartFromUri(remoteFile.uri, remoteFile.mimeType),
        analysisPrompt,
      ]),
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema,
        temperature: 0.2,
      },
    })

    const rawText = result.text
    if (!rawText) throw new Error('EMPTY_MODEL_RESPONSE')
    const parsed = reportSchema.safeParse(JSON.parse(rawText))
    if (!parsed.success) {
      console.error('Invalid Gemini response:', parsed.error.issues)
      throw new Error('INVALID_MODEL_RESPONSE')
    }
    response.json({ report: parsed.data })
  } catch (error) {
    console.error('Diagnosis failed:', error)
    const knownErrors = {
      VIDEO_PROCESSING_TIMEOUT: '视频处理超时，请压缩视频后重试。',
      VIDEO_PROCESSING_FAILED: 'Gemini 无法处理此视频，请尝试 MP4 格式。',
      EMPTY_MODEL_RESPONSE: 'AI 未返回有效结果，请重新诊断。',
      INVALID_MODEL_RESPONSE: 'AI 返回的报告格式异常，请重新诊断。',
      UNSUPPORTED_VIDEO: '暂不支持此视频格式。',
    }
    response.status(500).json({ error: knownErrors[error.message] || 'AI 诊断失败，请检查 API Key 或稍后重试。' })
  } finally {
    if (localPath && existsSync(localPath)) unlinkSync(localPath)
    if (ai && remoteFile?.name) {
      ai.files.delete({ name: remoteFile.name }).catch((error) => console.warn('Remote cleanup failed:', error.message))
    }
  }
})

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return response.status(413).json({ error: '视频超过 100MB，请压缩后重试。' })
  }
  if (error.message === 'UNSUPPORTED_VIDEO') {
    return response.status(415).json({ error: '暂不支持此视频格式，请上传 MP4、MOV 或 WEBM。' })
  }
  console.error(error)
  response.status(500).json({ error: '上传失败，请稍后重试。' })
})

const distDir = join(rootDir, 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('/{*splat}', (_request, response) => response.sendFile(join(distDir, 'index.html')))
}

app.listen(port, '0.0.0.0', () => {
  console.log(`ABCD diagnostic server listening on http://localhost:${port}`)
})
