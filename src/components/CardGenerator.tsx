import React, { useRef, useState, useImperativeHandle, forwardRef } from 'react';
import html2canvas from 'html2canvas';
import { Download, Image as ImageIcon, ChevronRight, ChevronLeft, Palette } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CardGeneratorProps {
  title: string;
  content: string;
  tags: string[];
  style?: string; // e.g., 'warm', 'cool', 'business'
  backgroundImage?: string; // Optional background image
  hideControls?: boolean; // New prop for preview mode
  scale?: number; // New prop for scaling
}

export interface CardGeneratorHandle {
  generateImage: () => Promise<string | null>;
}

const TEMPLATES = [
  {
    id: 'simple',
    name: '简约白 (Simple)',
    bg: 'bg-white',
    text: 'text-gray-900',
    accent: 'bg-red-500',
    font: 'font-sans'
  },
  {
    id: 'warm',
    name: '治愈暖 (Warm)',
    bg: 'bg-orange-50',
    text: 'text-orange-900',
    accent: 'bg-orange-400',
    font: 'font-serif'
  },
  {
    id: 'business',
    name: '商务蓝 (Business)',
    bg: 'bg-slate-900',
    text: 'text-white',
    accent: 'bg-blue-500',
    font: 'font-mono'
  },
  {
    id: 'pop',
    name: '波普粉 (Pop)',
    bg: 'bg-pink-100',
    text: 'text-pink-900',
    accent: 'bg-pink-500',
    font: 'font-sans'
  }
];

const CardGenerator = forwardRef<CardGeneratorHandle, CardGeneratorProps>(({ title, content, tags, backgroundImage, hideControls, scale = 1 }, ref) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [currentTemplateIdx, setCurrentTemplateIdx] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [mode, setMode] = useState<'cover' | 'content'>('cover'); // Cover or Content mode

  const template = TEMPLATES[currentTemplateIdx];
  
  // Helper to check if we should show background image
  const showBackgroundImage = backgroundImage && (template.id === 'overlay' || mode === 'cover');

  const generateImageBlob = async (): Promise<string | null> => {
    if (!cardRef.current) return null;
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2, // Retina display quality
        useCORS: true,
        backgroundColor: null
      });
      return canvas.toDataURL('image/png');
    } catch (err) {
      console.error('Failed to generate image', err);
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    generateImage: async () => {
      setGenerating(true);
      const data = await generateImageBlob();
      setGenerating(false);
      return data;
    }
  }));

  const handleDownload = async () => {
    setGenerating(true);
    const dataUrl = await generateImageBlob();
    setGenerating(false);
    
    if (dataUrl) {
      const link = document.createElement('a');
      link.download = `xhs-card-${mode}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('图片已下载');
    } else {
      toast.error('图片生成失败');
    }
  };

  const nextTemplate = () => {
    setCurrentTemplateIdx((prev) => (prev + 1) % TEMPLATES.length);
  };

  const prevTemplate = () => {
    setCurrentTemplateIdx((prev) => (prev - 1 + TEMPLATES.length) % TEMPLATES.length);
  };

  return (
    <div className="space-y-4">
      {!hideControls && (
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <ImageIcon size={16} className="mr-2 text-indigo-500" />
          智能卡片生成 (Card Generator)
        </h3>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => setMode('cover')}
            className={`px-3 py-1 rounded-full ${mode === 'cover' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
          >
            封面
          </button>
          <button
            onClick={() => setMode('content')}
            className={`px-3 py-1 rounded-full ${mode === 'content' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100'}`}
          >
            正文
          </button>
        </div>
      </div>
      )}

      {/* Card Preview Area */}
      <div className="relative group">
        <div className={`flex justify-center bg-gray-100 p-4 rounded-lg overflow-hidden border border-gray-200 ${hideControls ? 'p-0 border-0 bg-transparent' : ''}`}>
          
          {/* THE CARD */}
          <div
            ref={cardRef}
            className={`
              relative flex flex-col shadow-lg overflow-hidden
              ${template.bg} ${template.text} ${template.font}
            `}
            style={{
              width: '300px', // Fixed width for mobile aspect ratio (3:4)
              height: '400px',
              padding: '24px',
              transform: scale !== 1 ? `scale(${scale})` : undefined,
              transformOrigin: 'top center',
            }}
          >
            {/* Background Image Layer */}
            {showBackgroundImage && (
                <div className="absolute inset-0 z-0">
                    <img 
                        src={backgroundImage} 
                        alt="Background" 
                        className="w-full h-full object-cover opacity-90"
                        crossOrigin="anonymous" // Important for html2canvas
                    />
                    {/* Overlay Gradient for readability */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
                </div>
            )}

            {/* Decoration (Hide if bg image present to avoid clutter, or adjust) */}
            {!showBackgroundImage && <div className={`absolute top-0 left-0 w-full h-2 ${template.accent}`} />}
            
            {mode === 'cover' ? (
              // COVER MODE
              <div className="flex flex-col h-full justify-center items-center text-center space-y-6 z-10 relative">
                 <div className={`text-xs uppercase tracking-widest ${showBackgroundImage ? 'text-white/80' : 'opacity-60'}`}>
                    XIAOHONGSHU NOTES
                 </div>
                 
                 <h1 className={`text-3xl font-bold leading-tight drop-shadow-lg ${showBackgroundImage ? 'text-white' : ''}`} style={{ textShadow: showBackgroundImage ? '0 2px 4px rgba(0,0,0,0.5)' : 'none' }}>
                   {title.replace(/[!！?？]/g, '\n$&')} 
                 </h1>
                 
                 <div className={`w-12 h-1 ${template.accent} rounded-full shadow-sm`} />
                 
                 <div className="flex flex-wrap justify-center gap-2 mt-4">
                   {tags.slice(0, 3).map((tag, i) => (
                     <span key={i} className={`text-xs px-2 py-1 border rounded-full ${showBackgroundImage ? 'border-white/50 text-white bg-black/20' : 'opacity-80 border-current'}`}>
                       #{tag}
                     </span>
                   ))}
                 </div>
              </div>
            ) : (
              // CONTENT MODE
              <div className="flex flex-col h-full z-10 relative">
                <h2 className={`text-lg font-bold mb-4 border-l-4 pl-3 ${template.accent.replace('bg-', 'border-')} ${showBackgroundImage ? 'text-white drop-shadow-md' : ''}`}>
                  {title.substring(0, 15)}...
                </h2>
                <div className={`flex-1 overflow-hidden text-sm leading-relaxed whitespace-pre-wrap ${showBackgroundImage ? 'text-white/90 drop-shadow-sm' : 'opacity-90'}`}>
                  {content.substring(0, 200)}
                  {content.length > 200 && '...'}
                </div>
                <div className={`mt-4 pt-4 border-t text-xs flex justify-between ${showBackgroundImage ? 'border-white/30 text-white/70' : 'border-current opacity-30'}`}>
                  <span>@小红蚁创作</span>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>
            )}
            
            {/* Watermark */}
            <div className={`absolute bottom-2 right-2 text-[10px] z-10 ${showBackgroundImage ? 'text-white/50' : 'opacity-20'}`}>
              Powered by 小红蚁
            </div>
          </div>
        </div>

        {/* Controls Overlay */}
        {!hideControls && (
        <>
        <button
          onClick={prevTemplate}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-600"
          title="Previous Template"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={nextTemplate}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full shadow-sm hover:bg-white text-gray-600"
          title="Next Template"
        >
          <ChevronRight size={20} />
        </button>
        </>
        )}
      </div>

      {/* Action Bar */}
      {!hideControls && (
      <div className="flex items-center justify-between">
        <div className="flex items-center text-xs text-gray-500">
          <Palette size={14} className="mr-1" />
          当前模板: {template.name}
        </div>
        <button
          onClick={handleDownload}
          disabled={generating}
          className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-md text-sm hover:bg-gray-900 transition-colors"
        >
          {generating ? '生成中...' : (
            <>
              <Download size={16} className="mr-2" />
              下载卡片
            </>
          )}
        </button>
      </div>
      )}
    </div>
  );
});

export default CardGenerator;
