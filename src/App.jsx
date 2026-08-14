import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  ImageIcon, 
  RefreshCw, 
  Wand2, 
  Plus, 
  Download, 
  X, 
  Layers,
  Cpu,
  Clipboard,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const DEFAULT_KEY = "sk-de203ea0cbad84cb4463b44de4aafbc1dee0510ca39d9e4e";

// 三大顶级大模型配置项
const MODELS = [
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    provider: 'OpenAI 旗舰',
    desc: '全球盲测第一，擅长高文字密度海报、多图融合与复杂排版',
    tag: '首选强烈推荐'
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    provider: 'Google Gemini 3 Pro',
    desc: '谷歌旗舰，支持原生 4K 输出，多语言文字与品牌一致性最强',
    tag: '原生 4K / 超强文字'
  },
  {
    id: 'doubao-seedream-5-0-pro-260628',
    name: '即梦 5.0 Pro',
    provider: '字节跳动即梦',
    desc: '空间理解与光影还原强，支持最多 10 张多图融合，电商高画质首选',
    tag: '字节旗舰 / 多图融合'
  }
];

// 智能图片压缩函数：将大图压缩到 1024px 以内以提高生图接口成功率
const compressImage = (fileOrBase64, maxSide = 1024, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height) {
        if (width > maxSide) {
          height = Math.round((height * maxSide) / width);
          width = maxSide;
        }
      } else {
        if (height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
      resolve(compressedBase64);
    };
    img.onerror = (err) => reject(err);

    if (typeof fileOrBase64 === 'string') {
      img.src = fileOrBase64;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.readAsDataURL(fileOrBase64);
    }
  });
};

function App() {
  const [selectedModel, setSelectedModel] = useState('gpt-image-2');
  const [mode, setMode] = useState('t2i'); // 't2i' (文生图) 或 'i2i' (图生图)
  const [prompt, setPrompt] = useState('重新设计一个大师级宣传海报，封面标题自拟，设计感很强，小红书高级封面质感，色彩丰富有层次感，高清2K');
  const [refImages, setRefImages] = useState([]);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [taskProgress, setTaskProgress] = useState('');
  const [error, setError] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);

  // Model 1: GPT Image 2 参数
  const [gptSize, setGptSize] = useState('1088x1920'); // 9:16
  const [gptQuality, setGptQuality] = useState('auto');

  // Model 2: Gemini Nano Banana Pro 参数
  const [geminiRatio, setGeminiRatio] = useState('9:16');
  const [geminiSize, setGeminiSize] = useState('2K');

  // Model 3: 即梦 5.0 Pro 参数
  const [doubaoRatio, setDoubaoRatio] = useState('9:16');
  const [doubaoSize, setDoubaoSize] = useState('2K');

  const fileInputRef = useRef(null);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const addImages = async (filesOrBlobs) => {
    try {
      for (const item of filesOrBlobs) {
        const compressedBase64 = await compressImage(item);
        setRefImages(prev => [
          ...prev, 
          {
            id: Math.random().toString(36).substring(2, 9),
            url: compressedBase64,
            base64: compressedBase64
          }
        ]);
      }
      setMode('i2i');
      showToast(`已成功识别并添加 ${filesOrBlobs.length} 张参考图！`);
    } catch (err) {
      console.error("图片处理或压缩失败", err);
      setError("图片压缩处理失败，请更换图片重试");
    }
  };

  useEffect(() => {
    const handlePaste = async (e) => {
      const clipboardItems = e.clipboardData?.items;
      if (!clipboardItems) return;

      const imageFiles = [];
      for (let i = 0; i < clipboardItems.length; i++) {
        const item = clipboardItems[i];
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          if (blob) imageFiles.push(blob);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await addImages(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      addImages(files);
    }
    e.target.value = '';
  };

  // 状态轮询
  const pollTaskStatus = async (taskId) => {
    const maxAttempts = 60;
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      let resData;
      try {
        const res = await fetch(`/api/generate?task_id=${taskId}`);
        resData = await res.json();
      } catch (networkErr) {
        console.warn(`[Polling Warn] 轮询网络抖动 (${attempts}/${maxAttempts}):`, networkErr);
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }

      const data = (resData.data && typeof resData.data === 'object' && resData.data.is_final !== undefined) 
        ? resData.data 
        : resData;

      const isFinal = data.is_final ?? data.data?.is_final;
      const state = data.state || data.data?.state;
      const progress = data.progress || data.data?.progress;
      const resultUrl = data.result_url || data.data?.result_url || data.resultUrl || data.url;

      if (progress !== undefined && progress !== null) {
        const pStr = progress.toString();
        setTaskProgress(`正在处理中 (${pStr.includes('%') ? pStr : pStr + '%'})...`);
      }

      if (isFinal) {
        if (state === 'success' && resultUrl) {
          setImageUrl(resultUrl);
          setLoading(false);
          setTaskProgress('');
          return;
        } else {
          const failMsg = data.error || data.msg || data.status || `任务未成功完成 (state: ${state || 'failed'})`;
          setLoading(false);
          setTaskProgress('');
          throw new Error(failMsg);
        }
      }

      await new Promise(r => setTimeout(r, 3000));
    }

    setLoading(false);
    setTaskProgress('');
    throw new Error("任务生成超时 (已超过 3 分钟)，请稍后刷新页面查看结果");
  };

  // 核心生成函数
  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("请输入提示词");
      return;
    }

    if (mode === 'i2i' && refImages.length === 0) {
      setError("图生图模式下，请上传或直接粘贴至少一张参考图");
      return;
    }

    setLoading(true);
    setError(null);
    setImageUrl(null);
    setTaskProgress('任务打包提交中...');

    const imagesPayload = refImages.map(img => img.base64);

    let payload = {
      model: selectedModel,
      prompt: prompt,
      params: {}
    };

    if (selectedModel === 'gpt-image-2') {
      payload.params = {
        size: gptSize,
        quality: gptQuality,
        n: 1,
        ...(mode === 'i2i' && imagesPayload.length > 0 ? { images: imagesPayload } : {})
      };
    } else if (selectedModel === 'gemini-3-pro-image-preview') {
      payload.params = {
        aspectRatio: geminiRatio,
        imageSize: geminiSize,
        ...(mode === 'i2i' && imagesPayload.length > 0 ? { images: imagesPayload } : {})
      };
    } else if (selectedModel === 'doubao-seedream-5-0-pro-260628') {
      payload.params = {
        aspect_ratio: doubaoRatio,
        size: doubaoSize,
        ...(mode === 'i2i' && imagesPayload.length > 0 ? { images: imagesPayload.slice(0, 10) } : {})
      };
    }

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (!response.ok) {
        throw new Error(resData.error?.message || resData.error || "提交任务请求失败");
      }

      const taskId = resData.task_id || resData.data?.task_id || resData.data?.task_ids?.[0] || resData.task_ids?.[0];

      if (taskId) {
        setTaskProgress('云端队列计算中...');
        await pollTaskStatus(taskId);
      }
      else if (resData.data && Array.isArray(resData.data) && resData.data[0]?.url) {
        setImageUrl(resData.data[0].url);
        setLoading(false);
        setTaskProgress('');
      } 
      else if (resData.data?.url || resData.url) {
        setImageUrl(resData.data?.url || resData.url);
        setLoading(false);
        setTaskProgress('');
      }
      else if (resData.data && Array.isArray(resData.data) && resData.data[0]?.b64_json) {
        setImageUrl(`data:image/png;base64,${resData.data[0].b64_json}`);
        setLoading(false);
        setTaskProgress('');
      }
      else if (resData.candidates?.[0]?.content?.parts) {
        const imagePart = resData.candidates[0].content.parts.find(p => p.inlineData);
        if (imagePart) {
          setImageUrl(`data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`);
        } else {
          throw new Error("模型未返回有效图片数据");
        }
        setLoading(false);
        setTaskProgress('');
      }
      else {
        throw new Error(`接口返回未知格式: ${JSON.stringify(resData)}`);
      }

    } catch (err) {
      console.error("生成过程异常:", err);
      setError(err.message || "图像生成失败，请检查网络或配置");
      setLoading(false);
      setTaskProgress('');
    }
  };

  // 真正触发浏览器本地文件直接下载（避开跨域 CDN 仅打开网页的限制）
  const handleDownload = async () => {
    if (!imageUrl) return;
    setDownloading(true);

    const fileName = `poster_${selectedModel}_${Date.now()}.png`;

    try {
      // 1. 如果本身是 base64 数据直接下载
      if (imageUrl.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("已成功下载图片到本地！");
        setDownloading(false);
        return;
      }

      // 2. 对于外链图片，转换为同源 Blob 触发静默直接保存到硬盘
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      showToast("已成功下载高清原图！");
    } catch (err) {
      console.warn("直接 Blob 下载受限，开启 Canvas 二级硬强导出:", err);
      
      // 3. Canvas 二级导出强降级处理
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) return;
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
            showToast("已导出高清 PNG 到本地！");
          }, 'image/png');
        };
        img.src = imageUrl;
      } catch (canvasErr) {
        window.open(imageUrl, '_blank');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="app-container">
      {toastMsg && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(168, 85, 247, 0.95)',
          color: 'white',
          padding: '0.8rem 1.5rem',
          borderRadius: '30px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
          zIndex: 1000,
          fontWeight: 600,
          fontSize: '0.9rem',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle2 size={18} /> {toastMsg}
        </div>
      )}

      <div className="glass-card" style={{ padding: '2rem' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ color: '#a855f7', fontSize: '1.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={26} /> 王味螺专用视觉工坊
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '4px' }}>
            整合 OpenAI、Gemini 3 Pro、即梦 5.0 三大顶级视觉引擎
          </p>
        </div>

        {/* 模型切换卡片 */}
        <div style={{ fontSize: '0.85rem', color: '#a855f7', fontWeight: 600, marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Cpu size={16} /> 选择生成模型
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.8rem', marginBottom: '1.5rem' }}>
          {MODELS.map(m => (
            <div 
              key={m.id}
              onClick={() => setSelectedModel(m.id)}
              style={{
                padding: '1rem',
                borderRadius: '12px',
                background: selectedModel === m.id ? 'rgba(168, 85, 247, 0.15)' : 'rgba(0,0,0,0.3)',
                border: selectedModel === m.id ? '1.5px solid #a855f7' : '1px solid var(--card-border)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: 'white', fontSize: '0.95rem' }}>{m.name}</span>
                <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(168,85,247,0.3)', color: '#d8b4fe' }}>{m.tag}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginBottom: '6px' }}>{m.provider}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: '1.3' }}>{m.desc}</div>
            </div>
          ))}
        </div>

        {/* 模式切换 */}
        <div className="mode-selector" style={{ marginBottom: '1.5rem' }}>
          <button 
            className={`mode-btn ${mode === 't2i' ? 'active' : ''}`} 
            onClick={() => setMode('t2i')}
          >
            <Wand2 size={18} /> 文生图 (Text to Image)
          </button>
          <button 
            className={`mode-btn ${mode === 'i2i' ? 'active' : ''}`} 
            onClick={() => setMode('i2i')}
          >
            <Layers size={18} /> 图生图 (多图重绘与融合)
          </button>
        </div>

        {/* 主体操作面板 */}
        <div className="main-content">
          <div className="input-group">

            {selectedModel === 'gpt-image-2' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>图片尺寸/比例</div>
                  <select value={gptSize} onChange={e => setGptSize(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="1088x1920">竖屏 9:16 (1088x1920)</option>
                    <option value="1920x1088">横屏 16:9 (1920x1088)</option>
                    <option value="2048x2048">正方 1:1 (2048x2048)</option>
                    <option value="2160x3840">高清 4K 竖屏 (2160x3840)</option>
                    <option value="3840x2160">高清 4K 横屏 (3840x2160)</option>
                    <option value="auto">模型智能推荐 (auto)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>图片质量</div>
                  <select value={gptQuality} onChange={e => setGptQuality(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="auto">自动 (auto)</option>
                    <option value="high">高质量 (high)</option>
                    <option value="medium">中等 (medium)</option>
                    <option value="low">标准 (low)</option>
                  </select>
                </div>
              </div>
            )}

            {selectedModel === 'gemini-3-pro-image-preview' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>画面宽高比 (aspectRatio)</div>
                  <select value={geminiRatio} onChange={e => setGeminiRatio(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="9:16">竖屏 9:16</option>
                    <option value="16:9">横屏 16:9</option>
                    <option value="1:1">正方形 1:1</option>
                    <option value="3:4">3:4 海报</option>
                    <option value="4:3">4:3 文章插图</option>
                    <option value="21:9">21:9 电影宽幅</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>分辨率 (imageSize)</div>
                  <select value={geminiSize} onChange={e => setGeminiSize(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="2K">2K 高清 (推荐)</option>
                    <option value="4K">4K 史诗级原生画质</option>
                    <option value="1K">1K 标准画质</option>
                  </select>
                </div>
              </div>
            )}

            {selectedModel === 'doubao-seedream-5-0-pro-260628' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>宽高比例 (aspect_ratio)</div>
                  <select value={doubaoRatio} onChange={e => setDoubaoRatio(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="9:16">竖屏 9:16</option>
                    <option value="16:9">横屏 16:9</option>
                    <option value="1:1">正方形 1:1</option>
                    <option value="3:4">3:4</option>
                    <option value="4:3">4:3</option>
                    <option value="21:9">21:9 超宽屏</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>分辨率 (size)</div>
                  <select value={doubaoSize} onChange={e => setDoubaoSize(e.target.value)} style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '0.7rem', color: 'white' }}>
                    <option value="2K">2K 旗舰画质</option>
                    <option value="1K">1K 标准画质</option>
                  </select>
                </div>
              </div>
            )}

            <div style={{ fontSize: '0.8rem', color: '#a855f7', marginBottom: '0.4rem', fontWeight: 600 }}>提示词 (Prompt)</div>
            <textarea 
              className="prompt-textarea" 
              value={prompt} 
              onChange={(e) => setPrompt(e.target.value)} 
              style={{ minHeight: '120px' }} 
              placeholder="描述画面物体、人物细节、艺术画风及文字文字排版要求..." 
            />

            {/* 参考图上传 */}
            <div style={{ marginTop: '1.2rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>上传/粘贴参考图 (支持多图融合)</span>
                <span style={{ fontSize: '0.75rem', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clipboard size={14} /> 支持 ⌘V / Ctrl+V 直接粘贴图片
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(75px, 1fr))', gap: '0.6rem' }}>
                {refImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', aspectRatio: '1', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--card-border)' }}>
                    <img src={img.url} alt="Reference" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button 
                      onClick={() => setRefImages(prev => prev.filter(i => i.id !== img.id))} 
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239, 68, 68, 0.85)', border: 'none', borderRadius: '50%', color: 'white', width: '20px', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  style={{ 
                    aspectRatio: '1', 
                    borderRadius: '8px', 
                    border: '1.5px dashed var(--card-border)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justify: 'center', 
                    cursor: 'pointer', 
                    background: 'rgba(0,0,0,0.25)',
                    padding: '4px',
                    textAlign: 'center'
                  }}
                >
                  <Plus size={20} color="#9ca3af" />
                  <span style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '2px' }}>上传/粘贴</span>
                  <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" multiple onChange={handleImageUpload} />
                </div>
              </div>
            </div>

            <button 
              className="generate-btn" 
              onClick={generateImage} 
              disabled={loading} 
              style={{ height: '56px', marginTop: '1.5rem' }}
            >
              {loading ? <RefreshCw className="animate-spin" size={20} /> : <Wand2 size={20} />}
              <span style={{ fontSize: '1rem', fontWeight: 600, marginLeft: '8px' }}>
                {loading ? (taskProgress || "云端渲染中...") : "立即开启图像生成"}
              </span>
            </button>

            {error && (
              <div className="error-msg" style={{ marginTop: '1rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} /> 
                <span style={{ wordBreak: 'break-all' }}>{error}</span>
              </div>
            )}
          </div>

          {/* 生成结果展台 */}
          <div className="result-section">
            <div className="image-container" style={{ aspectRatio: '9/16', minHeight: '380px' }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#9ca3af', padding: '2rem', textAlign: 'center' }}>
                  <RefreshCw className="animate-spin" size={36} color="#a855f7" />
                  <span style={{ fontSize: '0.9rem', color: '#eee' }}>{taskProgress || "正在调度大模型算力..."}</span>
                  <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>生图通常需要 10秒~1分钟，请耐心等待</span>
                </div>
              )}
              {!loading && imageUrl && (
                <img src={imageUrl} alt="Result" className="generated-image" />
              )}
              {!loading && !imageUrl && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.2)' }}>
                  <ImageIcon size={54} />
                  <span style={{ fontSize: '0.85rem' }}>生成的高清图像将在此呈现</span>
                </div>
              )}
            </div>

            {imageUrl && (
              <button 
                onClick={handleDownload} 
                disabled={downloading}
                className="generate-btn" 
                style={{ marginTop: '1rem', background: '#059669', height: '48px' }}
              >
                {downloading ? <RefreshCw className="animate-spin" size={18} style={{ marginRight: '6px' }} /> : <Download size={18} style={{ marginRight: '6px' }} />}
                {downloading ? "准备下载中..." : "下载高清原图 (PNG)"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
