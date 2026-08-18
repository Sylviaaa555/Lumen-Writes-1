import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bolt,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  Download,
  FileVideo,
  ImageDown,
  Lightbulb,
  LoaderCircle,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ACCEPTED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mpeg']

const dimensions = {
  attract: {
    label: 'Attract',
    chinese: '吸引',
    description: '前 3 秒抓住注意力',
    icon: Zap,
    color: '#9b87f5',
    gradient: 'from-violet-500/20 to-fuchsia-500/5',
  },
  brand: {
    label: 'Brand',
    chinese: '品牌',
    description: '自然植入品牌资产',
    icon: BadgeCheck,
    color: '#5b9cf5',
    gradient: 'from-blue-500/20 to-cyan-500/5',
  },
  connect: {
    label: 'Connect',
    chinese: '共鸣',
    description: '建立情感与场景连接',
    icon: Sparkles,
    color: '#e28bfa',
    gradient: 'from-fuchsia-500/20 to-pink-500/5',
  },
  direct: {
    label: 'Direct',
    chinese: '行动',
    description: '给出清晰行动指引',
    icon: Target,
    color: '#55d9b3',
    gradient: 'from-emerald-500/20 to-teal-500/5',
  },
}

function formatBytes(bytes) {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return '--:--'
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
}

function ScoreRing({ score, size = 180, color = '#8b7cf6' }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (Math.max(0, Math.min(score, 100)) / 100) * circumference

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg className="-rotate-90" width={size} height={size} viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="11" />
        <circle
          cx="90"
          cy="90"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 9px ${color}80)`, transition: 'stroke-dashoffset 800ms ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="flex items-end justify-center">
          <span className="score-number">{score}</span>
          <span className="mb-2 ml-1 text-sm font-semibold text-white/40">分</span>
        </div>
        <div className="text-[10px] font-semibold tracking-[.22em] text-white/35">OVERALL</div>
      </div>
    </div>
  )
}

function MiniScore({ score, color }) {
  return (
    <div className="relative grid h-16 w-16 shrink-0 place-items-center">
      <svg className="absolute -rotate-90" width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 169.6} 169.6`}
        />
      </svg>
      <span className="text-xl font-semibold text-white">{score}</span>
    </div>
  )
}

function Header() {
  return (
    <header className="mx-auto flex w-full max-w-[1380px] items-center justify-between px-5 py-5 md:px-8">
      <div className="flex items-center gap-3">
        <div className="brand-mark"><Clapperboard size={20} /></div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-semibold tracking-tight text-white">ABCD 创意体检仪</span>
            <span className="beta-pill">BETA</span>
          </div>
          <p className="hidden text-[11px] text-white/35 sm:block">Google Creative Intelligence</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/45">
        <ShieldCheck size={15} className="text-emerald-400" />
        <span className="hidden sm:inline">视频仅用于本次分析</span>
      </div>
    </header>
  )
}

function UploadPanel({ file, previewUrl, metadata, isDragging, onDrag, onDrop, onSelect, onRemove, inputRef }) {
  if (file) {
    return (
      <div className="upload-shell overflow-hidden">
        <div className="grid md:grid-cols-[1.25fr_.75fr]">
          <div className="relative min-h-[280px] bg-black">
            <video className="h-full max-h-[390px] w-full object-contain" src={previewUrl} controls playsInline />
            <span className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-[10px] font-semibold tracking-widest text-white/60 backdrop-blur">
              VIDEO PREVIEW
            </span>
          </div>
          <div className="flex flex-col justify-between border-t border-white/[.07] p-6 md:border-l md:border-t-0 lg:p-8">
            <div>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/20">
                  <FileVideo size={21} />
                </div>
                <button className="icon-button" onClick={onRemove} aria-label="移除视频"><X size={17} /></button>
              </div>
              <p className="truncate text-base font-semibold text-white">{file.name}</p>
              <p className="mt-1 text-xs text-white/35">{formatBytes(file.size)} · {metadata.resolution || '读取中'}</p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="meta-box"><span>时长</span><strong>{formatDuration(metadata.duration)}</strong></div>
                <div className="meta-box"><span>格式</span><strong>{file.type.split('/')[1]?.toUpperCase() || 'VIDEO'}</strong></div>
              </div>
            </div>
            <button className="mt-6 flex items-center gap-2 text-xs font-medium text-white/45 transition hover:text-white" onClick={() => inputRef.current?.click()}>
              <RotateCcw size={14} />更换视频
            </button>
          </div>
        </div>
        <input ref={inputRef} type="file" hidden accept="video/mp4,video/webm,video/quicktime,video/mpeg" onChange={onSelect} />
      </div>
    )
  }

  return (
    <div
      className={`upload-shell group flex min-h-[330px] cursor-pointer flex-col items-center justify-center px-6 text-center transition-all ${isDragging ? 'dragging' : ''}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
    >
      <input ref={inputRef} type="file" hidden accept="video/mp4,video/webm,video/quicktime,video/mpeg" onChange={onSelect} />
      <div className="upload-icon mb-6"><UploadCloud size={29} strokeWidth={1.7} /></div>
      <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
        将广告视频拖到这里
      </h2>
      <p className="mt-2 text-sm text-white/40">或点击选择本地文件，AI 将逐帧理解画面、声音与叙事</p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {['MP4 / MOV / WEBM', '最大 100MB', '建议 6–60 秒'].map((item) => (
          <span key={item} className="format-pill">{item}</span>
        ))}
      </div>
    </div>
  )
}

function LoadingPanel({ progress }) {
  const steps = [
    ['视频安全上传', progress >= 26],
    ['多模态内容理解', progress >= 62],
    ['ABCD 原则评分', progress >= 88],
    ['生成优化策略', progress >= 100],
  ]
  return (
    <div className="glass-card flex min-h-[360px] flex-col items-center justify-center p-8 text-center">
      <div className="scan-orb mb-7"><BrainCircuit size={34} /></div>
      <h3 className="text-xl font-semibold text-white">创意大脑正在体检</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-white/40">正在同步理解画面、字幕、声音和节奏，请不要关闭页面</p>
      <div className="mt-8 w-full max-w-md">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-white/40">分析进度</span>
          <span className="font-semibold text-violet-300">{progress}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/[.06]">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-400 transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 text-left">
          {steps.map(([label, done]) => (
            <div key={label} className={`flex items-center gap-2 text-xs ${done ? 'text-white/70' : 'text-white/25'}`}>
              {done ? <Check size={14} className="text-emerald-400" /> : <LoaderCircle size={14} className="animate-spin" />}
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function DimensionCard({ dimensionKey, data }) {
  const meta = dimensions[dimensionKey]
  const Icon = meta.icon
  return (
    <article className={`dimension-card bg-gradient-to-br ${meta.gradient}`}>
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}>
            <Icon size={19} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{meta.label} <span className="font-normal text-white/35">· {meta.chinese}</span></h3>
            <p className="mt-0.5 text-[11px] text-white/35">{meta.description}</p>
          </div>
        </div>
        <MiniScore score={data.score} color={meta.color} />
      </div>
      <p className="mb-6 min-h-10 text-sm leading-6 text-white/65">{data.summary}</p>
      <div className="space-y-5">
        <div>
          <div className="section-label text-emerald-300"><Check size={13} />做得好的地方</div>
          <ul className="mt-3 space-y-2.5">
            {data.strengths.map((item, index) => (
              <li key={index} className="flex gap-2.5 text-xs leading-5 text-white/55">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" />{item}
              </li>
            ))}
          </ul>
        </div>
        <div className="h-px bg-white/[.06]" />
        <div>
          <div className="section-label text-amber-300"><Lightbulb size={13} />具体修改建议</div>
          <ul className="mt-3 space-y-2.5">
            {data.recommendations.map((item, index) => (
              <li key={index} className="flex gap-2.5 text-xs leading-5 text-white/60">
                <ChevronRight size={13} className="mt-1 shrink-0" style={{ color: meta.color }} />{item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  )
}

function Report({ report, file, onReset, reportRef, exporting, onExport }) {
  const date = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return (
    <section className="report-enter pb-16">
      <div ref={reportRef} className="report-canvas">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="eyebrow"><ScanSearch size={13} />DIAGNOSTIC REPORT</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white md:text-3xl">ABCD 创意诊断报告</h2>
          </div>
          <div className="text-right text-[11px] leading-5 text-white/30">
            <div>{date}</div>
            <div className="max-w-56 truncate">{file?.name}</div>
          </div>
        </div>

        <div className="overview-card">
          <div className="relative z-10 grid items-center gap-5 md:grid-cols-[210px_1fr]">
            <div className="flex justify-center"><ScoreRing score={report.overallScore} /></div>
            <div>
              <span className="verdict-pill"><WandSparkles size={12} />AI 核心结论</span>
              <h3 className="mt-4 max-w-3xl text-xl font-semibold leading-8 tracking-tight text-white md:text-2xl">{report.verdict}</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/45">{report.executiveSummary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {report.tags.map((tag) => <span key={tag} className="tag">#{tag}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="mb-4 mt-8 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-white">ABCD 四维诊断</h3>
            <p className="mt-1 text-xs text-white/35">基于 Google 视频广告创意效果原则逐项评估</p>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-white/30 sm:flex"><Bolt size={13} />Gemini 多模态分析</div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Object.keys(dimensions).map((key) => <DimensionCard key={key} dimensionKey={key} data={report.dimensions[key]} />)}
        </div>

        <div className="priority-card mt-4">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300 ring-1 ring-amber-300/20">
              <Bolt size={20} />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-amber-300/80">最高优先级动作</div>
              <p className="mt-2 text-base font-medium leading-7 text-white/80">{report.topPriority}</p>
            </div>
          </div>
        </div>
        <div className="report-footer">
          <div className="flex items-center gap-2"><Clapperboard size={13} />ABCD Creative Intelligence</div>
          <span>AI 生成内容仅供创意决策参考</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col justify-between gap-3 sm:flex-row">
        <button className="secondary-button" onClick={onReset}><RotateCcw size={16} />体检另一个视频</button>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="secondary-button" disabled={exporting} onClick={() => onExport('png')}><ImageDown size={16} />保存为图片</button>
          <button className="primary-button compact" disabled={exporting} onClick={() => onExport('pdf')}>
            {exporting ? <LoaderCircle size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? '正在生成…' : '导出 PDF 报告'}
          </button>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [metadata, setMetadata] = useState({})
  const [isDragging, setIsDragging] = useState(false)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)
  const [exporting, setExporting] = useState(false)
  const inputRef = useRef(null)
  const reportRef = useRef(null)

  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl])

  useEffect(() => {
    if (status !== 'loading') return
    const timer = window.setInterval(() => {
      setProgress((value) => value < 91 ? Math.min(value + Math.ceil(Math.random() * 5), 91) : value)
    }, 800)
    return () => window.clearInterval(timer)
  }, [status])

  const buttonLabel = useMemo(() => {
    if (status === 'loading') return 'AI 正在诊断中'
    return '开始 AI 创意诊断'
  }, [status])

  const acceptFile = (candidate) => {
    setError('')
    if (!candidate) return
    if (!ACCEPTED_TYPES.includes(candidate.type)) {
      setError('暂不支持此文件格式，请上传 MP4、MOV 或 WEBM 视频。')
      return
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError('视频超过 100MB，请压缩后重新上传。')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(candidate)
    setFile(candidate)
    setPreviewUrl(url)
    setMetadata({})
    setReport(null)
    setStatus('idle')
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.src = url
    video.onloadedmetadata = () => {
      setMetadata({ duration: video.duration, resolution: `${video.videoWidth} × ${video.videoHeight}` })
    }
  }

  const handleDrag = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(event.type === 'dragenter' || event.type === 'dragover')
  }

  const handleDrop = (event) => {
    handleDrag(event)
    setIsDragging(false)
    acceptFile(event.dataTransfer.files?.[0])
  }

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(null)
    setPreviewUrl('')
    setMetadata({})
    setReport(null)
    setStatus('idle')
    setProgress(0)
    setError('')
    if (inputRef.current) inputRef.current.value = ''
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const diagnose = async () => {
    if (!file || status === 'loading') return
    setStatus('loading')
    setProgress(8)
    setError('')
    const body = new FormData()
    body.append('video', file)
    try {
      const response = await fetch('/api/diagnose', { method: 'POST', body })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || '诊断服务暂时不可用，请稍后再试。')
      setProgress(100)
      await new Promise((resolve) => setTimeout(resolve, 350))
      setReport(payload.report)
      setStatus('complete')
      window.setTimeout(() => document.getElementById('report')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      setStatus('idle')
      setProgress(0)
      setError(err.message)
    }
  }

  const exportReport = async (type) => {
    if (!reportRef.current) return
    setExporting(true)
    setError('')
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#08090d',
        scale: Math.min(window.devicePixelRatio * 1.3, 2.2),
        useCORS: true,
        logging: false,
      })
      const filename = `ABCD创意诊断_${file.name.replace(/\.[^.]+$/, '')}`
      if (type === 'png') {
        const link = document.createElement('a')
        link.download = `${filename}.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      } else {
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
        const pageWidth = pdf.internal.pageSize.getWidth()
        const pageHeight = pdf.internal.pageSize.getHeight()
        const imageHeight = (canvas.height * pageWidth) / canvas.width
        const image = canvas.toDataURL('image/jpeg', 0.94)
        let offset = 0
        let remaining = imageHeight
        pdf.addImage(image, 'JPEG', 0, offset, pageWidth, imageHeight)
        remaining -= pageHeight
        while (remaining > 0) {
          offset = remaining - imageHeight
          pdf.addPage()
          pdf.addImage(image, 'JPEG', 0, offset, pageWidth, imageHeight)
          remaining -= pageHeight
        }
        pdf.save(`${filename}.pdf`)
      }
    } catch {
      setError('报告导出失败，请重试或使用浏览器截图。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <Header />
      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-5 pb-8 pt-8 md:px-8 md:pt-14">
        {!report && status !== 'loading' && (
          <>
            <section className="mx-auto mb-10 max-w-3xl text-center">
              <div className="eyebrow justify-center"><Sparkles size={13} />GOOGLE ABCD FRAMEWORK</div>
              <h1 className="hero-title mt-5">让每一帧创意，<br className="hidden sm:block" /><span>更接近高转化。</span></h1>
              <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/45 md:text-base">
                上传广告视频，Gemini 多模态 AI 将基于 Attract、Brand、Connect、Direct 四大原则，
                在几分钟内给出可执行的创意优化方案。
              </p>
            </section>

            <section className="mx-auto max-w-4xl">
              <UploadPanel
                file={file}
                previewUrl={previewUrl}
                metadata={metadata}
                isDragging={isDragging}
                onDrag={handleDrag}
                onDrop={handleDrop}
                onSelect={(event) => acceptFile(event.target.files?.[0])}
                onRemove={reset}
                inputRef={inputRef}
              />
              {error && (
                <div className="error-banner mt-4"><CircleAlert size={16} />{error}</div>
              )}
              <button className="primary-button mt-5 w-full" disabled={!file} onClick={diagnose}>
                <BrainCircuit size={19} />{buttonLabel}<ArrowRight size={17} />
              </button>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] text-white/25">
                <span className="flex items-center gap-1.5"><ShieldCheck size={12} />API Key 服务端保护</span>
                <span className="flex items-center gap-1.5"><Play size={12} />原生视频理解</span>
                <span className="flex items-center gap-1.5"><Sparkles size={12} />结构化专业报告</span>
              </div>
            </section>

            <section className="mx-auto mt-20 grid max-w-4xl grid-cols-2 gap-3 md:grid-cols-4">
              {Object.entries(dimensions).map(([key, item]) => {
                const Icon = item.icon
                return (
                  <div key={key} className="principle-card">
                    <Icon size={18} style={{ color: item.color }} />
                    <div className="mt-4 text-sm font-semibold text-white/85">{item.label}</div>
                    <div className="mt-1 text-[11px] text-white/30">{item.chinese}力诊断</div>
                  </div>
                )
              })}
            </section>
          </>
        )}

        {status === 'loading' && <div className="mx-auto mt-10 max-w-3xl"><LoadingPanel progress={progress} /></div>}

        {report && (
          <div id="report">
            {error && <div className="error-banner mb-4"><CircleAlert size={16} />{error}</div>}
            <Report report={report} file={file} onReset={reset} reportRef={reportRef} exporting={exporting} onExport={exportReport} />
          </div>
        )}
      </main>
      <footer className="relative z-10 border-t border-white/[.05] px-5 py-5 text-center text-[10px] tracking-wide text-white/20">
        POWERED BY GEMINI · GOOGLE ABCD CREATIVE PRINCIPLES
      </footer>
    </div>
  )
}
