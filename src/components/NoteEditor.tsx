import React from 'react';
import { Loader2, RefreshCw, PenTool, Image as ImageIcon, Video, Wand2, LayoutTemplate } from 'lucide-react';
import CardGenerator, { CardGeneratorHandle } from './CardGenerator';

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
  handleGenerateImage: (index: number, prompt?: string, isAutoTrigger?: boolean) => void;
  handleEditImage: (url: string) => void;
  setActiveTab: (tab: 'note' | 'video_script' | 'video') => void;
  setVideoMode: (mode: 't2v' | 'i2v') => void;
  setVideoImageUrl: (url: string) => void;
  setVideoPrompt: (prompt: string) => void;
  cardGeneratorRef: React.RefObject<CardGeneratorHandle>;
  handleSelectBgForCard: (url: string) => void;
  onUpdateImagePrompt?: (index: number, newPrompt: string) => void; // New callback
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
  onUpdateImagePrompt
}: NoteEditorProps) {
  const [editingPromptIdx, setEditingPromptIdx] = React.useState<number | null>(null);
  const [tempPrompt, setTempPrompt] = React.useState('');

  const startEditingPrompt = (idx: number, currentPrompt: string) => {
      setEditingPromptIdx(idx);
      setTempPrompt(currentPrompt);
  };

  const savePrompt = (idx: number) => {
      if (onUpdateImagePrompt) {
          onUpdateImagePrompt(idx, tempPrompt);
          // Auto regenerate after saving prompt
          handleGenerateImage(idx, tempPrompt);
      }
      setEditingPromptIdx(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. AI Image Generation Area */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">配图生成</span>
          <span className="text-xs text-gray-400">点击图片重新生成，悬停可修改提示词</span>
        </div>
        
        {generatedImages.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        title="编辑图片"
                      >
                        <PenTool size={14} />
                      </button>
                      <button
                        onClick={() => handleGenerateImage(idx)}
                        className="bg-white/90 text-indigo-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="重新生成"
                      >
                        <RefreshCw size={14} />
                      </button>
                      <button
                        onClick={() => handleSelectBgForCard(img.url)}
                        className="bg-white/90 text-indigo-600 p-1.5 rounded-full hover:bg-white transition-colors"
                        title="设为封面背景"
                      >
                        <LayoutTemplate size={14} />
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
                  <button
                    onClick={() => handleGenerateImage(idx)}
                    className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-200 transition-colors"
                  >
                    <ImageIcon size={20} className="mb-1" />
                    <span className="text-xs">生成图片</span>
                  </button>
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
