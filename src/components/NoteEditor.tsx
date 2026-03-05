import React, { useState } from 'react';
import { Loader2, RefreshCw, PenTool, Image as ImageIcon, Video, Wand2, LayoutTemplate, Upload } from 'lucide-react';
import CardGenerator, { CardGeneratorHandle } from './CardGenerator';
import { toast } from 'react-hot-toast'; // Import toast

interface GeneratedContent {
  title: string;
  options: {
    type: string;
    label: string;
    content: string;
  }[];
  tags: string[];
  image_prompts: string[];
}

interface GeneratedImage {
  prompt: string;
  url: string;
  loading: boolean;
  taskId?: string;
}

interface NoteEditorProps {
  result: GeneratedContent;
  selectedOptionIndex: number;
  generatedImages: GeneratedImage[];
  handleGenerateImage: (index: number, prompt?: string, isAutoTrigger?: boolean, sessionTaskId?: string, refImg?: string, accountId?: number) => void;
  handleEditImage: (url: string) => void;
  setActiveTab: (tab: 'note' | 'video_script' | 'video') => void;
  setVideoMode: (mode: 't2v' | 'i2v') => void;
  setVideoImageUrl: (url: string) => void;
  setVideoPrompt: (prompt: string) => void;
  cardGeneratorRef: React.RefObject<CardGeneratorHandle>;
  handleSelectBgForCard: (url: string) => void;
  onUpdateImagePrompt?: (index: number, newPrompt: string) => void;
  activeAccount?: any;
  remixStructure?: any; // Add remixStructure
}

export default function NoteEditor({
  result,
  selectedOptionIndex,
  generatedImages,
  handleGenerateImage,
  handleEditImage,
  setActiveTab,
  setVideoMode,
  setVideoImageUrl,
  setVideoPrompt,
  cardGeneratorRef,
  handleSelectBgForCard,
  onUpdateImagePrompt,
  activeAccount,
  remixStructure
}: NoteEditorProps) {
  const [editingPromptIdx, setEditingPromptIdx] = React.useState<number | null>(null);
  const [tempPrompt, setTempPrompt] = React.useState('');
  
  // Ref Image State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [targetImageIndex, setTargetImageIndex] = React.useState<number | null>(null);

  const startEditingPrompt = (idx: number, currentPrompt: string) => {
      setEditingPromptIdx(idx);
      setTempPrompt(currentPrompt);
  };

  const savePrompt = (idx: number) => {
      if (onUpdateImagePrompt) {
          onUpdateImagePrompt(idx, tempPrompt);
          // Auto regenerate after saving prompt
          handleGenerateImage(idx, tempPrompt, false, undefined, undefined, activeAccount?.id);
      }
      setEditingPromptIdx(null);
  };

  const handleUploadClick = (idx: number) => {
      setTargetImageIndex(idx);
      fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || targetImageIndex === null) return;

      // 1. Upload file (Mock upload to local/server and get URL)
      // Since we don't have a direct upload endpoint here, we assume AssetService can handle it or we use a temporary object URL for now if backend supports it via base64 or FormData.
      // But GenerateMediaHandler expects a URL.
      // Let's implement a simple upload via existing AssetService if possible, or use a new route.
      // For now, let's use a placeholder approach: Client -> Server Upload -> URL.
      // We'll use a new endpoint /api/assets/upload if it exists, or just simulate it.
      
      // WAIT: We don't have a general upload endpoint in this context yet.
      // Let's add a quick upload handler in `handleFileChange`.
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
          // Use the upload endpoint we saw in AliyunProvider? No, that's backend.
          // We need a frontend upload route.
          // Assuming /api/upload exists or we create one.
          // Let's use the '/api/assets/upload' convention.
          const res = await fetch('/api/assets/upload', {
              method: 'POST',
              body: formData
          });
          
          if (!res.ok) throw new Error('Upload failed');
          
          const data = await res.json();
          const uploadedUrl = data.url;
          
          // 2. Trigger generation with this ref image
          handleGenerateImage(targetImageIndex, undefined, false, undefined, uploadedUrl, activeAccount?.id);
          toast.success('参考图上传成功，开始生成...');
          
      } catch (error) {
          console.error('Upload error:', error);
          toast.error('上传失败');
      } finally {
          // Reset
          if (fileInputRef.current) fileInputRef.current.value = '';
          setTargetImageIndex(null);
      }
  };

  const handleApplyRemixRef = (refUrl: string, idx: number) => {
      handleGenerateImage(idx, undefined, false, undefined, refUrl, activeAccount?.id);
      toast.success('已应用参考图，开始重绘...');
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for Ref Image */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*"
        onChange={handleFileChange}
      />

      {/* 1. AI Image Generation Area */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">配图生成</span>
          <span className="text-xs text-gray-400">点击图片重新生成，悬停可修改提示词</span>
        </div>
        
        {generatedImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Card Generator Preview (Always First) */}
            <div className="group relative aspect-square rounded-lg overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-all bg-white">
                <div className="absolute top-2 left-2 z-10 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                    封面卡片
                </div>
                <div className="w-full h-full transform scale-90 origin-center">
                    <CardGenerator 
                        ref={cardGeneratorRef}
                        title={result.title}
                        content={result.options?.[selectedOptionIndex]?.content || ''}
                        tags={result.tags || []}
                        hideControls={true} // Pure preview mode
                        scale={0.4} // Thumbnail scale
                    />
                </div>
                 {/* Hover Overlay Actions for Card */}
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 z-20">
                      <button
                        onClick={() => {
                            // Scroll to bottom where full editor is
                             window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}
                        className="bg-white/90 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-white transition-colors text-xs font-bold flex items-center"
                      >
                        <PenTool size={12} className="mr-1" /> 编辑卡片
                      </button>
                    </div>
            </div>

            {generatedImages.map((img, idx) => (
              <div key={idx} className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                {img.loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
                    <Loader2 className="animate-spin mb-2" size={20} />
                    <span className="text-xs">绘制中...</span>
                  </div>
                ) : img.url ? (
                  <>
                    <img src={img.url} alt={`Generated ${idx}`} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    
                    {/* Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditImage(img.url)}
                        className="bg-white/90 text-gray-800 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="编辑图片 (涂鸦/参考)"
                      >
                        <PenTool size={14} />
                      </button>
                      <button
                        onClick={() => handleSelectBgForCard(img.url)}
                        className="bg-white/90 text-green-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="设为卡片背景"
                      >
                         <LayoutTemplate size={14} />
                      </button>
                      <button
                        onClick={() => handleGenerateImage(idx, undefined, false, undefined, img.url, activeAccount?.id)}
                        className="bg-white/90 text-blue-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="以此图为参考重绘 (变体)"
                      >
                        <Wand2 size={14} />
                      </button>
                      <button
                        onClick={() => handleGenerateImage(idx)}
                        className="bg-white/90 text-indigo-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="重新生成"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => {
                            setVideoMode('i2v');
                            setVideoImageUrl(img.url);
                            setVideoPrompt(`${img.prompt}, slow motion, cinematic lighting, 4k`);
                            setActiveTab('video');
                        }}
                        className="bg-white/90 text-pink-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="生成视频 (图生视频)"
                      >
                        <Video size={14} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors gap-2">
                      <button
                        onClick={() => handleGenerateImage(idx, undefined, false, undefined, undefined, activeAccount?.id)}
                        className="flex flex-col items-center"
                      >
                        <ImageIcon size={20} className="mb-1" />
                        <span className="text-xs">生成图片</span>
                      </button>
                      
                      {/* Show Quick Remix Ref Options if available */}
                      {remixStructure && remixStructure.ref_images && remixStructure.ref_images.length > 0 ? (
                          <div className="flex gap-1 mt-1">
                             {remixStructure.ref_images.slice(0, 3).map((refUrl: string, refI: number) => (
                                 <button
                                    key={refI}
                                    onClick={() => handleApplyRemixRef(refUrl, idx)}
                                    className="w-6 h-6 rounded overflow-hidden border border-indigo-200 hover:border-indigo-500"
                                    title="使用此原图作为参考"
                                 >
                                     <img src={refUrl} className="w-full h-full object-cover" />
                                 </button>
                             ))}
                          </div>
                      ) : (
                          <button
                            onClick={() => handleUploadClick(idx)}
                            className="flex flex-col items-center mt-2 text-indigo-500 hover:text-indigo-700"
                            title="上传参考图生成"
                          >
                            <Upload size={16} className="mb-0.5" />
                            <span className="text-[10px]">参考图</span>
                          </button>
                      )}
                  </div>
                )}
                
                {/* Prompt Tooltip & Editor */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/80 text-white text-[10px] p-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
                    {editingPromptIdx === idx ? (
                        <div className="flex flex-col gap-1">
                            <textarea 
                                value={tempPrompt}
                                onChange={(e) => setTempPrompt(e.target.value)}
                                className="w-full text-black text-xs p-1 rounded h-16"
                                onClick={(e) => e.stopPropagation()} 
                            />
                            <div className="flex gap-1 justify-end">
                                <button onClick={(e) => { e.stopPropagation(); setEditingPromptIdx(null); }} className="text-gray-300 hover:text-white">取消</button>
                                <button onClick={(e) => { e.stopPropagation(); savePrompt(idx); }} className="text-green-400 hover:text-green-300 font-bold">生成</button>
                            </div>
                        </div>
                    ) : (
                        <div 
                            className="cursor-pointer hover:text-gray-200 truncate" 
                            title="点击修改提示词"
                            onClick={(e) => { e.stopPropagation(); startEditingPrompt(idx, img.prompt); }}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-xs opacity-70">提示词 (点击修改):</span>
                                <PenTool size={10} />
                            </div>
                            <p className="line-clamp-2">{img.prompt}</p>
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center p-4 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-xs cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => {
              // Add a default placeholder image slot
              handleGenerateImage(0, 'High quality photography, aesthetic, 4k', true);
          }}>
             <ImageIcon size={24} className="mx-auto mb-2 opacity-50" />
             <p>该内容暂无 AI 配图建议</p>
             <p className="mt-1 text-indigo-500">点击此处生成第一张配图</p>
          </div>
        )}
      </div>
    </div>
  );
}
