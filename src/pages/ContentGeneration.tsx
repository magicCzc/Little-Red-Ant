import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Sparkles, FileText, Video, Edit3, History, ChevronLeft, ChevronRight, RotateCw, Copy, Save, ExternalLink, Film, Loader2, Calendar, Wand2, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import CardGenerator, { CardGeneratorHandle } from '../components/CardGenerator';
import ImageEditor from '../components/ImageEditor';
import NoteEditor from '../components/NoteEditor';
import ArticleEditor from '../components/ArticleEditor';
import toast from 'react-hot-toast';
import { useSafeAsync } from '../hooks/useSafeAsync';

// New Components
import TrendSidebar from '../components/content-generation/TrendSidebar';
import NoteGeneratorForm from '../components/content-generation/NoteGeneratorForm';
import VideoScriptGeneratorForm from '../components/content-generation/VideoScriptGeneratorForm';
import ScriptReferenceSidebar from '../components/content-generation/ScriptReferenceSidebar';
import VideoGeneratorForm from '../components/content-generation/VideoGeneratorForm';

interface GeneratedContent {
  title: string;
  options: {
    type: string;
    label: string;
    content: string;
  }[];
  tags: string[];
  image_prompts: string[];
  character_desc?: string;
}

interface GeneratedImage {
  prompt: string;
  url: string;
  loading: boolean;
  taskId?: string;
}

interface GenerationSession {
  content: GeneratedContent;
  images: GeneratedImage[];
  timestamp: number;
  taskId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

// Video Interfaces
interface VideoSession {
  type: 'video';
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  timestamp: number;
  taskId?: string;
}

export default function ContentGeneration() {
  const location = useLocation();
  const navigate = useNavigate();
  const cardGeneratorRef = useRef<CardGeneratorHandle>(null);

  // Tab State: 'note' | 'video_script' | 'video'
  const [activeTab, setActiveTab] = useState<'note' | 'video_script' | 'video'>('note');
  
  // --- Note Generation State ---
  const [contentType, setContentType] = useState<'note' | 'article' | 'video_script'>('note');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [style, setStyle] = useState('');
  const [characterDesc, setCharacterDesc] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [promptTemplates, setPromptTemplates] = useState<{id: number, name: string, template: string}[]>([]);
  const [remixStructure, setRemixStructure] = useState<any>(null);
  const [remixSourceTitle, setRemixSourceTitle] = useState<string>('');
  
  // History State
  const [history, setHistory] = useState<GenerationSession[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [autoPublish, setAutoPublish] = useState(false); 
  const [scheduledTime, setScheduledTime] = useState(''); 
  
  // --- Video Generation State ---
  const [videoMode, setVideoMode] = useState<'t2v' | 'i2v'>('t2v');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoImageUrl, setVideoImageUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoHistory, setVideoHistory] = useState<VideoSession[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  const [videoError, setVideoError] = useState<string | null>(null);

  // V3.1 New: Scene Video State Management
  interface SceneVideoState {
      status: 'idle' | 'generating' | 'completed' | 'failed';
      videoUrl?: string;
      taskId?: string;
      error?: string;
  }
  const [sceneVideos, setSceneVideos] = useState<Record<string, SceneVideoState>>({});
  const [isStitching, setIsStitching] = useState(false);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  
  // V3.2: Project State
  const [creatingProject, setCreatingProject] = useState(false);

  // Image Editor State
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState('');
  
  // Structure Modal
  const [showStructureModal, setShowStructureModal] = useState(false);
  
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  
  // Account State
  const [activeAccount, setActiveAccount] = useState<any>(null);

  // Selected Background Image for Card
  const [selectedBgImage, setSelectedBgImage] = useState<string | undefined>(undefined);

  // ... (inside NoteEditor handler or new handler)
  const handleSelectBgForCard = (url: string) => {
      setSelectedBgImage(url);
      toast.success('已选择为封面背景，请查看下方卡片预览');
      // Scroll to bottom
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  };
  const currentSession = currentIndex >= 0 ? history[currentIndex] : null;
  const result = currentSession?.content || null;
  const generatedImages = currentSession?.images || [];
  const currentVideoSession = currentVideoIndex >= 0 ? videoHistory[currentVideoIndex] : null;

  // Fetch Active Account
  useEffect(() => {
      axios.get('/api/accounts').then(res => {
          const active = res.data.find((a: any) => a.is_active);
          setActiveAccount(active || null);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    if (location.state) {
        // Safety check for state properties
        const state = location.state;
        
        if (state.remixNote) {
             const { title, structure, type } = state.remixNote;
             setTopic(title || '');
             setRemixSourceTitle(title || '');
             setRemixStructure(structure);
             
             if (type === 'video') {
                 setActiveTab('video_script');
                 setContentType('video_script');
                 toast.success(`已引用视频结构，为您切换至脚本模式`);
             } else {
                 setActiveTab('note');
                 setContentType('note');
                 toast.success(`已引用热门笔记结构：${title}`);
             }
        } else if (state.generatedResult) {
            const res = state.generatedResult as GeneratedContent;
            setTopic(res.title || '');
            setHistory([{
                content: res,
                images: [],
                timestamp: Date.now()
            }]);
            setCurrentIndex(0);
            toast.success('已加载生成结果');
        } else if (state.draft) {
            const draft = state.draft;
            setDraftId(draft.id);
            setTopic(draft.title || '');
            
            // Refined Logic for Content Type Detection
            let targetType: 'note' | 'article' | 'video_script' = 'note';
            
            // 1. Trust explicit DB type if available and valid
            if (draft.content_type === 'video_script') {
                targetType = 'video_script';
            } else if (draft.content_type === 'article') {
                targetType = 'article';
            } else {
                // 2. Heuristic Check for Legacy Drafts (or incorrectly saved ones)
                const content = draft.content || '';
                const trimmedContent = content.trim();
                
                // Strong signal: Starts with Markdown Title '#'
                const hasMarkdownTitle = trimmedContent.startsWith('#');
                
                // Medium signal: Length > 800 chars
                const isLongContent = content.length > 800;
                
                // Weak signal: Has images?
                // Filter out empty strings or invalid URLs
                const validImages = (draft.images || []).filter((img: string) => img && img.length > 0);
                const hasImages = validImages.length > 0;
                
                // Decision Logic:
                // If it has a markdown title, it's almost certainly an article structure, regardless of images.
                // If it's very long and has NO images, it's likely an article.
                if (hasMarkdownTitle) {
                    targetType = 'article';
                } else if (isLongContent && !hasImages) {
                    targetType = 'article';
                }
            }

            console.log('Draft Load Debug:', { 
                title: draft.title, 
                dbType: draft.content_type, 
                detectedType: targetType,
                hasHash: draft.content?.includes('#') 
            });

            // Apply State with forced updates to ensure UI sync
            if (targetType === 'video_script') {
                setActiveTab('video_script');
                setContentType('video_script');
            } else if (targetType === 'article') {
                setActiveTab('note'); 
                setContentType('article');
                // Force update to override any initial state defaults
                setTimeout(() => {
                    setContentType('article');
                    toast.success('已自动切换至深度长文模式');
                }, 50);
            } else {
                setActiveTab('note');
                setContentType('note');
            }

            toast.success('已加载草稿内容');
            
            const draftContent: GeneratedContent = {
                title: draft.title,
                options: [{
                    type: 'experience',
                    label: '草稿内容',
                    content: draft.content
                }],
                tags: draft.tags,
                image_prompts: []
            };

            // Restore images from draft
            const restoredImages: GeneratedImage[] = (draft.images || []).map((url: string) => ({
                prompt: '草稿恢复图片',
                url: url,
                loading: false
            }));

            setHistory([{
                content: draftContent,
                images: restoredImages,
                timestamp: Date.now()
            }]);
            setCurrentIndex(0);
        } else if (state.fromAnalysis) {
            if (state.topic) setTopic(state.topic);
            if (state.style) setStyle(state.style); // Apply style from analysis
            toast.success(`已加载推荐选题：${state.topic}`);
        }
        
        // Handle Tab Switching from other pages
        if (state.activeTab) {
             setActiveTab(state.activeTab);
             if (state.activeTab === 'video_script') setContentType('video_script');
        }
    }
  }, [location.state]);

  useEffect(() => {
    axios.get('/api/prompts')
      .then(res => setPromptTemplates(res.data))
      .catch(err => console.error('Failed to fetch prompts:', err));
  }, []);

  const { isMounted, abortControllerRef } = useSafeAsync();
  const imageGenerationTimeouts = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    return () => {
      imageGenerationTimeouts.current.forEach(clearTimeout);
    };
  }, []);

  // Polling Effect for Content Generation
  useEffect(() => {
      const pendingSessions = history.map((s, i) => ({s, i})).filter(item => item.s.status === 'PENDING' && item.s.taskId);
      if (pendingSessions.length === 0) return;

      const interval = setInterval(async () => {
          for (const {s, i} of pendingSessions) {
              if (!s.taskId) continue;
              try {
                  const res = await axios.get(`/api/tasks/${s.taskId}`);
                  const task = res.data;
                  
                  if (task.status === 'COMPLETED') {
                      const newContent = task.result as GeneratedContent;
                      
                      let newImages: GeneratedImage[] = [];
                      if (newContent.image_prompts) {
                          newImages = newContent.image_prompts.map((p: string) => ({
                              prompt: p,
                              url: '',
                              loading: true // Auto start loading
                          }));
                      }

                      setHistory(prev => {
                          const newH = [...prev];
                          const index = newH.findIndex(h => h.taskId === s.taskId);
                          if (index !== -1) {
                              newH[index] = { 
                                  ...newH[index], 
                                  content: newContent, 
                                  images: newImages,
                                  status: 'COMPLETED' 
                              };
                          }
                          return newH;
                      });

                      if ((newContent as any).character_desc) {
                          setCharacterDesc((newContent as any).character_desc);
                      }
                      
                      // Auto trigger image generation
                      if (newImages.length > 0) {
                          const currentIndex = history.findIndex(h => h.taskId === s.taskId);
                          // Trigger for all images (async)
                          newImages.forEach((_, imgIdx) => {
                              handleGenerateImage(imgIdx, undefined, true);
                          });
                      }
                  } else if (task.status === 'FAILED') {
                      setHistory(prev => {
                          const newH = [...prev];
                          const index = newH.findIndex(h => h.taskId === s.taskId);
                          if (index !== -1) {
                              newH[index] = { ...newH[index], status: 'FAILED', error: task.error };
                          }
                          return newH;
                      });
                  }
              } catch (e) { console.error('Poll error', e); }
          }
      }, 3000);

      return () => clearInterval(interval);
  }, [history]);

  // Polling Effect for Image Generation
  useEffect(() => {
      const tasksToPoll: { sessionIndex: number, imageIndex: number, taskId: string }[] = [];
      
      history.forEach((session, sIdx) => {
          session.images.forEach((img, iIdx) => {
              if (img.loading && img.taskId && !img.url) {
                  tasksToPoll.push({ sessionIndex: sIdx, imageIndex: iIdx, taskId: img.taskId });
              }
          });
      });
      
      if (tasksToPoll.length === 0) return;

      const interval = setInterval(async () => {
          for (const taskItem of tasksToPoll) {
               try {
                   const res = await axios.get(`/api/tasks/${taskItem.taskId}`);
                   const task = res.data;
                   
                   if (task.status === 'COMPLETED') {
                       const imageUrl = task.result.url;
                       setHistory(prev => {
                           const newH = [...prev];
                           if (!newH[taskItem.sessionIndex]) return newH;
                           
                           const session = { ...newH[taskItem.sessionIndex] };
                           const images = [...session.images];
                           
                           if (images[taskItem.imageIndex] && images[taskItem.imageIndex].taskId === taskItem.taskId) {
                               images[taskItem.imageIndex] = { 
                                   ...images[taskItem.imageIndex], 
                                   url: imageUrl, 
                                   loading: false 
                               };
                               session.images = images;
                               newH[taskItem.sessionIndex] = session;
                           }
                           return newH;
                       });
                       // Auto refresh draft images if we are in draft mode
                       if (draftId && (currentIndex === taskItem.sessionIndex)) {
                           // Debounced save could be better, but direct save ensures consistency
                           // We skip auto-save to avoid overwriting content edits, but we update local state
                       }
                   } else if (task.status === 'FAILED') {
                       setHistory(prev => {
                           const newH = [...prev];
                           if (!newH[taskItem.sessionIndex]) return newH;

                           const session = { ...newH[taskItem.sessionIndex] };
                           const images = [...session.images];
                           if (images[taskItem.imageIndex] && images[taskItem.imageIndex].taskId === taskItem.taskId) {
                               images[taskItem.imageIndex] = { 
                                   ...images[taskItem.imageIndex], 
                                   loading: false 
                               };
                               session.images = images;
                               newH[taskItem.sessionIndex] = session;
                           }
                           return newH;
                       });
                   }
               } catch(e) { console.error('Image poll error', e); }
          }
      }, 3000);
      return () => clearInterval(interval);
  }, [history]);

  // Polling Effect for Videos
  useEffect(() => {
      const pendingVideos = videoHistory.map((s, i) => ({s, i})).filter(item => item.s.status === 'PENDING' && item.s.taskId);
      if (pendingVideos.length === 0) return;

      const interval = setInterval(async () => {
          for (const {s, i} of pendingVideos) {
              if (!s.taskId) continue;
              try {
                  const res = await axios.get(`/api/tasks/${s.taskId}`);
                  const task = res.data;
                  if (task.status === 'COMPLETED') {
                      setVideoHistory(prev => {
                          const newH = [...prev];
                          const index = newH.findIndex(h => h.taskId === s.taskId);
                          if (index !== -1) {
                              newH[index] = { ...newH[index], status: 'COMPLETED', videoUrl: task.result.url };
                          }
                          return newH;
                      });
                  } else if (task.status === 'FAILED') {
                      setVideoHistory(prev => {
                          const newH = [...prev];
                          const index = newH.findIndex(h => h.taskId === s.taskId);
                          if (index !== -1) {
                              newH[index] = { ...newH[index], status: 'FAILED', error: task.error };
                          }
                          return newH;
                      });
                  }
              } catch(e) {}
          }
      }, 5000);
      return () => clearInterval(interval);
  }, [videoHistory]);

  // Polling Effect for Scene Videos
  useEffect(() => {
      const pendingScenes = Object.entries(sceneVideos).filter(([_, state]) => state.status === 'generating' && state.taskId);
      if (pendingScenes.length === 0) return;

      const interval = setInterval(async () => {
          for (const [key, state] of pendingScenes) {
              if (!state.taskId) continue;
              try {
                  const res = await axios.get(`/api/tasks/${state.taskId}`);
                  const task = res.data;
                  if (task.status === 'COMPLETED') {
                      setSceneVideos(prev => ({
                          ...prev,
                          [key]: { ...prev[key], status: 'completed', videoUrl: task.result.url }
                      }));
                  } else if (task.status === 'FAILED') {
                      setSceneVideos(prev => ({
                          ...prev,
                          [key]: { ...prev[key], status: 'failed', error: task.error }
                      }));
                  }
              } catch(e) {}
          }
      }, 5000);
      return () => clearInterval(interval);
  }, [sceneVideos]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setSelectedOptionIndex(0);
    setErrorMsg(null);
    setPublishStatus(null); 

    try {
      const keywordList = keywords.split(/[,，\s]+/).filter(k => k.trim());
      const res = await axios.post('/api/generate/content', {
        topic: topic.trim(),
        keywords: keywordList,
        style,
        character_desc: characterDesc, 
        remix_structure: remixStructure, 
        contentType, 
        accountId: activeAccount?.id 
      }, { signal: abortControllerRef.current.signal });

      setRemixStructure(null); 
      setRemixSourceTitle('');

      const { taskId } = res.data;
      
      const placeholderSession: GenerationSession = {
          content: { title: topic, options: [], tags: [], image_prompts: [] },
          images: [],
          timestamp: Date.now(),
          taskId: taskId,
          status: 'PENDING'
      };

      setHistory(prev => [...prev, placeholderSession]);
      setCurrentIndex(prev => prev + 1);
      
      toast.success('生成任务已提交，请在全局任务监控中查看进度');
      
    } catch (error: any) {
      if (axios.isCancel(error)) return;
      console.error('Generation failed:', error);
      const msg = error.response?.data?.error || '任务提交失败，请重试';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      if (isMounted.current) {
          setLoading(false);
      }
    }
  };

  const handleGenerateImage = async (imageIndex: number, promptOverride?: string, isAutoTrigger = false) => {
      if (!isMounted.current) return;
      const prompt = promptOverride || ''; 

      setHistory(prev => {
          const idx = isAutoTrigger ? prev.length - 1 : currentIndex;
          if (idx < 0 || idx >= prev.length) return prev;
          
          const newHistory = [...prev];
          const session = { ...newHistory[idx] };
          const images = [...session.images];
          
          if (!prompt && images[imageIndex]) promptOverride = images[imageIndex].prompt;
          
          images[imageIndex] = { ...images[imageIndex], loading: true };
          session.images = images;
          newHistory[idx] = session;
          return newHistory;
      });
      
      try {
          // Use promptOverride if provided, otherwise fallback to the stored prompt in history
          const finalPrompt = promptOverride || history[isAutoTrigger ? history.length - 1 : currentIndex]?.images[imageIndex]?.prompt;

          if (!finalPrompt) {
               console.error('No prompt found for image generation');
               throw new Error('Prompt is required');
          }

          const res = await axios.post('/api/generate/image', { prompt: finalPrompt });
          const { taskId } = res.data;

          setHistory(prev => {
              const idx = isAutoTrigger ? prev.length - 1 : currentIndex;
              if (idx < 0 || idx >= prev.length) return prev;
              const newHistory = [...prev];
              const session = { ...newHistory[idx] };
              const images = [...session.images];
              images[imageIndex] = { ...images[imageIndex], taskId: taskId };
              session.images = images;
              newHistory[idx] = session;
              return newHistory;
          });
          
          toast.success('图片生成任务已提交');
          
      } catch (e) {
          if (!isMounted.current) return;
          console.error('Image gen failed:', e);
          setHistory(prev => {
              const idx = isAutoTrigger ? prev.length - 1 : currentIndex;
              if (idx < 0 || idx >= prev.length) return prev;
              const newHistory = [...prev];
              const session = { ...newHistory[idx] };
              const images = [...session.images];
              
              images[imageIndex] = { ...images[imageIndex], loading: false };
              session.images = images;
              newHistory[idx] = session;
              return newHistory;
          });
          toast.error('图片生成任务提交失败');
      }
  };

  const handleUpdateImagePrompt = (imageIndex: number, newPrompt: string) => {
      setHistory(prev => {
          const newHistory = [...prev];
          const session = { ...newHistory[currentIndex] };
          const images = [...session.images];
          if (images[imageIndex]) {
              images[imageIndex] = { ...images[imageIndex], prompt: newPrompt };
              session.images = images;
              newHistory[currentIndex] = session;
          }
          return newHistory;
      });
  };

  const handleSaveDraft = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      let imagePayload: string[] = [];
      const validAiImages = generatedImages.filter(img => img.url).map(img => img.url);
      
      if (validAiImages.length > 0) {
          imagePayload = validAiImages;
      } else if (cardGeneratorRef.current) {
          const cardImage = await cardGeneratorRef.current.generateImage();
          if (cardImage) imagePayload = [cardImage];
      }

      const payload = {
        title: result.title,
        content: result.options?.[selectedOptionIndex]?.content || '',
        tags: result.tags,
        images: imagePayload,
        contentType: contentType
      };

      if (draftId) {
        const res = await axios.put(`/api/drafts/${draftId}`, payload);
        // Update images in UI if they were localized
        if (res.data.images) {
            setHistory(prev => {
                const newHistory = [...prev];
                const session = { ...newHistory[currentIndex] };
                const images = [...session.images];
                
                // Update URLs in place
                res.data.images.forEach((newUrl: string, i: number) => {
                    if (images[i]) images[i] = { ...images[i], url: newUrl };
                });
                
                session.images = images;
                newHistory[currentIndex] = session;
                return newHistory;
            });
        }
        toast.success('草稿已更新！(图片已本地化)');
      } else {
        const res = await axios.post('/api/drafts', payload);
        setDraftId(res.data.id);
        // Update images in UI if they were localized
        if (res.data.images) {
            setHistory(prev => {
                const newHistory = [...prev];
                const session = { ...newHistory[currentIndex] };
                const images = [...session.images];
                
                res.data.images.forEach((newUrl: string, i: number) => {
                    if (images[i]) images[i] = { ...images[i], url: newUrl };
                });
                
                session.images = images;
                newHistory[currentIndex] = session;
                return newHistory;
            });
        }
        toast.success('已保存到草稿箱！(图片已本地化)');
      }
    } catch (error) {
      console.error('Save draft failed:', error);
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!result) return;
    setIsPublishing(true);
    setPublishStatus('正在检查账号状态...');

    try {
      const statusRes = await axios.get('/api/accounts/status');
      const { activeAccount, isLoggedIn } = statusRes.data;
      
      if (!activeAccount && !isLoggedIn) {
         setPublishStatus('未检测到活跃账号，请前往"账号矩阵"添加或切换账号...');
         setTimeout(() => {
             setPublishStatus('请先在"账号矩阵"中登录一个账号');
             setIsPublishing(false);
         }, 2000);
         return;
      }

      setPublishStatus(`正在使用账号 [${activeAccount?.nickname || '当前账号'}] 提交任务...`);
      
      let imagePayload: string[] = [];
      const validAiImages = generatedImages.filter(img => img.url).map(img => img.url);
      
      if (validAiImages.length > 0) {
          imagePayload = validAiImages;
      } else if (cardGeneratorRef.current) {
          const cardImage = await cardGeneratorRef.current.generateImage();
          if (cardImage) imagePayload = [cardImage];
      }

      const payload = {
        title: result.title,
        content: result.options?.[selectedOptionIndex]?.content || '',
        tags: result.tags,
        imageData: imagePayload,
        autoPublish,
        scheduledAt: scheduledTime ? new Date(scheduledTime).toISOString() : undefined,
        contentType: contentType
      };

      const res = await axios.post('/api/publish/publish', payload);
      
      if (scheduledTime) {
          setPublishStatus(`任务已加入队列，将于 ${new Date(scheduledTime).toLocaleString()} 执行`);
          toast.success(`定时任务设置成功！\n任务将于 ${new Date(scheduledTime).toLocaleString()} 自动执行。`);
          navigate('/tasks');
          return;
      }

      setPublishStatus('任务已提交至队列，请在全局任务监控中查看进度');
      toast.success('发布任务已提交');
      
    } catch (error: any) {
      console.error('Publish failed:', error);
      const errorMsg = error.response?.data?.error || error.message;
      setPublishStatus(`发布流程中断: ${errorMsg}`);
      toast.error(`发布流程中断: ${errorMsg}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveContentEdit = () => {
    setHistory(prev => {
        if (currentIndex < 0 || currentIndex >= prev.length) return prev;
        const newHistory = [...prev];
        const session = { ...newHistory[currentIndex] };
        const content = { ...session.content };
        
        if (content.options && content.options[selectedOptionIndex]) {
            content.options = [...content.options]; 
            content.options[selectedOptionIndex] = {
                ...content.options[selectedOptionIndex],
                content: editedContent
            };
        }
        
        session.content = content;
        newHistory[currentIndex] = session;
        return newHistory;
    });
    
    setIsEditingContent(false);
    toast.success('内容已更新');
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!videoPrompt?.trim()) return;
      if (videoMode === 'i2v' && !videoImageUrl.trim()) {
          setVideoError('图生视频模式需要提供图片 URL');
          return;
      }

      setVideoLoading(true);
      setVideoError(null);

      try {
          const res = await axios.post('/api/generate/video', {
              prompt: videoPrompt,
              imageUrl: videoMode === 'i2v' ? videoImageUrl : undefined
          });

          const { taskId } = res.data;
          
          const newSession: VideoSession = {
              type: 'video',
              prompt: videoPrompt,
              imageUrl: videoMode === 'i2v' ? videoImageUrl : undefined,
              status: 'PENDING',
              timestamp: Date.now(),
              taskId: taskId
          };

          setVideoHistory(prev => [...prev, newSession]);
          setCurrentVideoIndex(prev => prev + 1);
          
          toast.success('视频生成任务已提交');

      } catch (error: any) {
          console.error('Video Gen Error:', error);
          setVideoError(error.message || '生成失败');
      } finally {
          setVideoLoading(false);
      }
  };

  const handleGenerateSceneVideo = async (sceneIndex: number, prompt: string) => {
      const key = `${currentIndex}-${selectedOptionIndex}-${sceneIndex}`;
      
      try {
          const res = await axios.post('/api/generate/video', {
              prompt: prompt,
              imageUrl: undefined 
          });

          const { taskId } = res.data;

          setSceneVideos(prev => ({
              ...prev,
              [key]: { status: 'generating', taskId: taskId }
          }));
          
          toast.success('镜头生成任务已提交');

      } catch (error: any) {
          console.error(error);
          setSceneVideos(prev => ({
              ...prev,
              [key]: { status: 'failed', error: error.message }
          }));
          toast.error(`镜头 ${sceneIndex + 1} 生成失败`);
      }
  };

  const handleBatchGenerateVideos = async () => {
      const scenes = parseScript(result?.options?.[selectedOptionIndex]?.content || '');
      if (scenes.length === 0) return;

      const confirm = window.confirm(`即将开始批量生成 ${scenes.length} 个镜头视频，这将消耗较多资源。是否继续？`);
      if (!confirm) return;

      // Start sequential generation to avoid rate limits
      for (let i = 0; i < scenes.length; i++) {
          const key = `${currentIndex}-${selectedOptionIndex}-${i}`;
          if (sceneVideos[key]?.status === 'completed' || sceneVideos[key]?.status === 'generating') continue;
          
          await handleGenerateSceneVideo(i, scenes[i].visual);
      }
  };

  const handleStitchVideos = async () => {
      const scenes = parseScript(result?.options?.[selectedOptionIndex]?.content || '');
      const videoUrls = scenes.map((_, i) => {
          const key = `${currentIndex}-${selectedOptionIndex}-${i}`;
          return sceneVideos[key]?.videoUrl;
      }).filter(Boolean) as string[];

      if (videoUrls.length < 2) {
          toast.error('至少需要 2 个已生成的视频片段才能合成');
          return;
      }

      setIsStitching(true);
      try {
          // Mock Stitching for now
          await new Promise(r => setTimeout(r, 3000)); 
          
          toast.success('视频合成指令已发送 (模拟)');
          setStitchedVideoUrl(videoUrls[0]); 
          
      } catch (error) {
          toast.error('合成失败');
      } finally {
          setIsStitching(false);
      }
  };

  const handleCreateVideoProject = async () => {
      const scenes = parseScript(result?.options?.[selectedOptionIndex]?.content || '');
      if (scenes.length === 0) return;

      setCreatingProject(true);
      try {
          const res = await axios.post('/api/video-projects', {
              title: topic,
              script: scenes,
              character_desc: characterDesc || (result as any)?.character_desc, 
              tags: result?.tags || [],
              description: `${topic}\n\n${scenes.map((s: any) => s.audio).join('')}\n\n${result?.tags?.map(t => `#${t}`).join(' ') || ''}`
          });
          
          if (res.data.success) {
              const projectId = res.data.data.id;
              toast.success('Project created! Entering Studio...');
              setTimeout(() => {
                  navigate(`/video-studio/${projectId}`);
              }, 1000);
          }
      } catch (error) {
          toast.error('Failed to create project');
          setCreatingProject(false);
      }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const handleEditImage = (imageUrl: string) => {
    setEditingImageUrl(imageUrl);
    setShowImageEditor(true);
  };

  const handleSaveEditedImage = (editedImageUrl: string) => {
    setHistory(prev => {
      if (currentIndex < 0 || currentIndex >= prev.length) return prev;
      const newHistory = [...prev];
      const session = { ...newHistory[currentIndex] };
      const images = [...session.images];
      
      const imageIndex = images.findIndex(img => img.url === editingImageUrl);
      if (imageIndex >= 0) {
        images[imageIndex] = { ...images[imageIndex], url: editedImageUrl };
      }
      
      session.images = images;
      newHistory[currentIndex] = session;
      return newHistory;
    });
    
    setShowImageEditor(false);
    setEditingImageUrl('');
    toast.success('图片编辑完成！');
  };

  const parseScript = (content: string) => {
      try {
          const lines = content.split('\n').filter(l => l.trim().startsWith('|'));
          if (lines.length < 3) return []; 
          
          const dataLines = lines.slice(2);
          return dataLines.map(line => {
              const cols = line.split('|').map(c => c.trim());
              if (cols.length < 4) return null;
              
              return {
                  shot: cols[1] || '',
                  visual: cols[2] || '',
                  audio: cols[3] || '',
                  note: cols[4] || ''
              };
          }).filter(item => item !== null);
      } catch (e) {
          return [];
      }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center">
          <Sparkles className="mr-2 text-indigo-600" />
          AI 智能创作
        </h1>
        <p className="text-gray-600 mb-8">
          一站式 AI 创作平台，支持图文笔记、深度长文及视频创作。
        </p>

        {/* Top Tab Switcher */}
        <div className="flex space-x-1 bg-gray-200 p-1 rounded-lg mb-8 w-fit">
             <button
                 onClick={() => setActiveTab('note')}
                 className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'note' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 <FileText size={16} className="mr-2" />
                 笔记创作
             </button>
             <button
                 onClick={() => {
                     setActiveTab('video_script');
                     setContentType('video_script');
                 }}
                 className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'video_script' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 <Edit3 size={16} className="mr-2" />
                 视频脚本
             </button>
             <button
                 onClick={() => setActiveTab('video')}
                 className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'video' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 <Video size={16} className="mr-2" />
                 视频生成
             </button>
        </div>

        {activeTab === 'note' || activeTab === 'video_script' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Context & Reference */}
            <div className="lg:col-span-1 space-y-6">
                
                {/* 1. Note Mode: Trends */}
                {activeTab === 'note' && (
                    <TrendSidebar onSelectTopic={setTopic} />
                )}

                {/* 2. Script Mode: Remix Source */}
                {activeTab === 'video_script' && (
                    <ScriptReferenceSidebar 
                        remixStructure={remixStructure}
                        setRemixStructure={setRemixStructure}
                        remixSourceTitle={remixSourceTitle}
                        setRemixSourceTitle={setRemixSourceTitle}
                        setTopic={setTopic}
                        setShowStructureModal={setShowStructureModal}
                    />
                )}

                {/* 3. Forms */}
                {activeTab === 'note' ? (
                    <NoteGeneratorForm 
                        topic={topic}
                        setTopic={setTopic}
                        keywords={keywords}
                        setKeywords={setKeywords}
                        style={style}
                        setStyle={setStyle}
                        contentType={contentType}
                        setContentType={setContentType}
                        promptTemplates={promptTemplates}
                        activeAccount={activeAccount}
                        loading={loading}
                        onGenerate={handleGenerate}
                        errorMsg={errorMsg}
                    />
                ) : (
                    <VideoScriptGeneratorForm
                        topic={topic}
                        setTopic={setTopic}
                        keywords={keywords}
                        setKeywords={setKeywords}
                        style={style}
                        setStyle={setStyle}
                        promptTemplates={promptTemplates}
                        activeAccount={activeAccount}
                        loading={loading}
                        onGenerate={handleGenerate}
                        errorMsg={errorMsg}
                        remixStructure={remixStructure}
                    />
                )}
            </div>

            {/* Right Column: Result (To be refactored later, kept here for stability) */}
            <div className="lg:col-span-2 space-y-6">
                {result ? (
                <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                    {currentSession?.status === 'PENDING' ? (
                        <div className="p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                            <Loader2 className="animate-spin h-12 w-12 text-indigo-500 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">AI 正在创作中...</h3>
                            <p className="text-gray-500 mt-2">任务已提交至后台，请留意全局任务监控。</p>
                            <p className="text-xs text-gray-400 mt-4">您可以切换到其他页面，稍后回来查看结果。</p>
                        </div>
                    ) : (
                    <div className="p-6 space-y-6">
                    
                    {/* Version Control Header */}
                    <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                        <div className="flex items-center text-sm text-gray-500">
                            <History size={16} className="mr-2" />
                            <span>生成记录</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button 
                                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                                disabled={currentIndex <= 0}
                                className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <span className="text-sm font-medium text-gray-700">
                                版本 {currentIndex + 1} / {history.length}
                            </span>
                            <button 
                                onClick={() => setCurrentIndex(prev => Math.min(history.length - 1, prev + 1))}
                                disabled={currentIndex >= history.length - 1}
                                className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={20} />
                            </button>
                            
                            <div className="h-4 w-px bg-gray-200 mx-2"></div>
                            
                            <button 
                                onClick={handleGenerate} 
                                className="text-xs flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                <RotateCw size={14} className="mr-1" />
                                重新生成
                            </button>
                        </div>
                    </div>

                    {/* AI Image Generation & Card Generator */}
                    {contentType === 'note' && (
                        <NoteEditor 
                            result={result}
                            selectedOptionIndex={selectedOptionIndex}
                            generatedImages={generatedImages}
                            handleGenerateImage={handleGenerateImage}
                            handleEditImage={handleEditImage}
                            setActiveTab={setActiveTab}
                            setVideoMode={setVideoMode}
                            setVideoImageUrl={setVideoImageUrl}
                            setVideoPrompt={setVideoPrompt}
                            cardGeneratorRef={cardGeneratorRef}
                            handleSelectBgForCard={handleSelectBgForCard}
                            onUpdateImagePrompt={handleUpdateImagePrompt}
                        />
                    )}

                    {/* Title */}
                    <div>
                        <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">标题</span>
                        <button onClick={() => copyToClipboard(result.title)} className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center">
                            <Copy size={12} className="mr-1" /> 复制
                        </button>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-md">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                            {result.title}
                        </h3>
                        </div>
                    </div>

                    {/* Content Options */}
                    <div>
                        <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">正文</span>
                        <div className="flex space-x-2">
                            {!isEditingContent ? (
                                <button 
                                    onClick={() => {
                                        setIsEditingContent(true);
                                        setEditedContent(result.options?.[selectedOptionIndex]?.content || '');
                                    }}
                                    className="text-gray-600 hover:text-indigo-600 text-xs flex items-center"
                                >
                                    <Edit3 size={12} className="mr-1" /> 编辑
                                </button>
                            ) : (
                                <div className="flex space-x-2">
                                    <button 
                                        onClick={handleSaveContentEdit}
                                        className="text-green-600 hover:text-green-800 text-xs flex items-center font-bold"
                                    >
                                        <Save size={12} className="mr-1" /> 保存
                                    </button>
                                    <button 
                                        onClick={() => setIsEditingContent(false)}
                                        className="text-gray-500 hover:text-gray-700 text-xs flex items-center"
                                    >
                                        取消
                                    </button>
                                </div>
                            )}
                            <button 
                                onClick={() => copyToClipboard(result.options?.[selectedOptionIndex]?.content || '')} 
                                className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center"
                            >
                                <Copy size={12} className="mr-1" /> 复制
                            </button>
                        </div>
                        </div>

                        <div className="flex space-x-2 mb-3">
                        {result.options?.map((opt, idx) => (
                            <button
                            key={idx}
                            onClick={() => {
                                setSelectedOptionIndex(idx);
                                setIsEditingContent(false); 
                            }}
                            className={`
                                px-3 py-1.5 text-xs font-medium rounded-md transition-colors
                                ${selectedOptionIndex === idx 
                                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-500' 
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                            `}
                            >
                            {opt.label}
                            </button>
                        ))}
                        </div>

                        <div className="bg-gray-50 p-4 rounded-md min-h-[200px]">
                        {(!result.options || result.options.length === 0) ? (
                            <div className="text-red-500 p-4 text-center">
                                数据加载异常 (Version Data Corrupted) - 请尝试重新生成
                            </div>
                        ) : (
                            contentType === 'article' ? (
                                <ArticleEditor 
                                    content={isEditingContent ? editedContent : (result.options?.[selectedOptionIndex]?.content || '')}
                                    isEditing={isEditingContent}
                                    onChange={setEditedContent}
                                />
                            ) : (
                            isEditingContent ? (
                                <textarea 
                                    value={editedContent}
                                    onChange={(e) => setEditedContent(e.target.value)}
                                    className="w-full h-[300px] p-2 bg-white border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                                />
                            ) : (
                                contentType === 'video_script' ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                            <div>
                                                <div className="text-sm font-bold text-indigo-800 flex items-center">
                                                    <Film size={16} className="inline mr-2" />
                                                    分镜脚本已生成
                                                </div>
                                                <p className="text-xs text-indigo-600 mt-1 max-w-md">
                                                    脚本仅为文字大纲。如需生成画面、配音并合成完整视频，请点击右侧按钮进入<strong>「视频制作台」</strong>。
                                                </p>
                                            </div>
                                            <button 
                                                onClick={handleCreateVideoProject}
                                                disabled={creatingProject}
                                                className={`bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded-md flex items-center transition-colors shadow-sm
                                                    ${creatingProject ? 'opacity-70 cursor-wait' : ''}
                                                `}
                                            >
                                                {creatingProject ? (
                                                    <>
                                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                                        正在初始化...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Wand2 size={16} className="mr-2" />
                                                        开始制作视频
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {parseScript(result.options?.[selectedOptionIndex]?.content || '').map((scene: any, idx: number) => {
                                            const key = `${currentIndex}-${selectedOptionIndex}-${idx}`;
                                            return (
                                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm flex flex-col md:flex-row gap-4 opacity-75">
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold uppercase">
                                                            Scene {idx + 1}
                                                        </span>
                                                        <span className="text-xs text-gray-500 font-mono">
                                                            {scene.shot}
                                                        </span>
                                                    </div>
                                                    <div className="text-sm text-gray-800 font-medium">
                                                        <span className="text-indigo-500 mr-2">👁️ 画面:</span>
                                                        {scene.visual}
                                                    </div>
                                                </div>
                                                <div className="flex-1 space-y-2 border-t md:border-t-0 md:border-l border-gray-100 md:pl-4 pt-2 md:pt-0">
                                                    <div className="text-sm text-gray-800">
                                                        <span className="text-green-600 mr-2">🎙️ 口播:</span>
                                                        {scene.audio}
                                                    </div>
                                                    {scene.note && (
                                                        <div className="text-xs text-gray-500 mt-1 italic">
                                                            💡 {scene.note}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )})}
                                        
                                        {parseScript(result.options?.[selectedOptionIndex]?.content || '').length === 0 && (
                                             <div className="p-4 text-center text-gray-500 text-sm">
                                                 脚本格式解析失败，显示原始文本：
                                                 <pre className="mt-2 whitespace-pre-wrap text-left bg-gray-50 p-2 rounded text-xs">{result.options?.[selectedOptionIndex]?.content}</pre>
                                             </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                                        {result.options?.[selectedOptionIndex]?.content || '生成的内容为空 (No content generated)'}
                                    </div>
                                )
                            )
                            )
                        )}
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">标签</span>
                        <button onClick={() => copyToClipboard(result.tags.map(t => `#${t}`).join(' '))} className="text-indigo-600 hover:text-indigo-800 text-xs flex items-center">
                            <Copy size={12} className="mr-1" /> 复制
                        </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {result.tags.map((tag, idx) => (
                            <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800">
                            #{tag}
                            </span>
                        ))}
                        </div>
                    </div>

                    {/* Card Generator (Moved to Bottom) - Only show if no AI images are generated */}
                    {contentType === 'note' && !generatedImages.some(img => img.url) && (
                        <div className="pt-6 border-t border-gray-100">
                            <CardGenerator 
                                ref={cardGeneratorRef}
                                title={result.title}
                                content={result.options?.[selectedOptionIndex]?.content || ''}
                                tags={result.tags || []}
                                backgroundImage={selectedBgImage}
                            />
                        </div>
                    )}

                    {/* Publish Action */}
                    {contentType !== 'video_script' && (
                        <div className="pt-4 border-t border-gray-100">
                            {publishStatus && (
                            <div className={`mb-4 p-3 rounded-md text-sm ${publishStatus.includes('中断') || publishStatus.includes('失败') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'}`}>
                                {publishStatus}
                            </div>
                            )}
                            
                            <div className="flex gap-2">
                            <button
                                onClick={handleSaveDraft}
                                disabled={isSaving || isPublishing}
                                className={`flex-1 flex justify-center items-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors
                                ${isSaving ? 'opacity-75 cursor-not-allowed' : ''}
                                `}
                            >
                                {isSaving ? (
                                <Loader2 className="animate-spin mr-2" size={18} />
                                ) : (
                                <Save className="mr-2" size={18} />
                                )}
                                存为草稿
                            </button>
                            
                            <div className="flex items-center justify-end space-x-4">
                                <label className="flex items-center space-x-2 text-sm text-gray-600 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={autoPublish} 
                                        onChange={(e) => setAutoPublish(e.target.checked)}
                                        className="form-checkbox h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 transition duration-150 ease-in-out"
                                    />
                                    <span>自动点击发布</span>
                                </label>
                                
                                <div className="flex items-center space-x-2">
                                    <Calendar size={16} className="text-gray-500" />
                                    <input 
                                        type="datetime-local"
                                        value={scheduledTime}
                                        onChange={(e) => setScheduledTime(e.target.value)}
                                        className="text-xs border border-gray-300 rounded p-1 text-gray-600 focus:ring-indigo-500 focus:border-indigo-500"
                                        placeholder="定时发布"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={handlePublish}
                                disabled={isPublishing}
                                className={`flex-[2] flex justify-center items-center py-3 px-4 rounded-md shadow-sm text-sm font-medium text-white transition-colors
                                ${isPublishing ? 'bg-red-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}
                                `}
                            >
                                {isPublishing ? (
                                <>
                                    <Loader2 className="animate-spin mr-2" size={18} />
                                    处理中...
                                </>
                                ) : (
                                <>
                                    <ExternalLink className="mr-2" size={18} />
                                    {scheduledTime ? '设置定时发布' : '一键发布到小红书'}
                                </>
                                )}
                            </button>
                            </div>
                            <p className="mt-2 text-xs text-center text-gray-500">
                            * {autoPublish ? '系统将自动上传并发布，请勿操作鼠标' : '将自动打开浏览器并填入文案，请手动点击发布'}
                            {scheduledTime && <span className="text-indigo-600 font-medium ml-2"> (将于 {new Date(scheduledTime).toLocaleString()} 执行)</span>}
                            </p>
                        </div>
                    )}
                    </div>
                    )}
                </div>
                ) : (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                    <Sparkles size={48} className="mb-4 text-gray-300" />
                    <p className="text-center text-gray-500">
                    {loading ? 'AI 正在分析人设并生成文案...\n这通常需要 10-20 秒' : '选择左侧热点或输入选题\n生成的爆款笔记将显示在这里'}
                    </p>
                </div>
                )}
            </div>
            </div>
        ) : (
            // Video Mode Layout
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               {/* Left: Inputs */}
               <div className="lg:col-span-1 space-y-6">
                  <VideoGeneratorForm 
                      videoMode={videoMode}
                      setVideoMode={setVideoMode}
                      videoPrompt={videoPrompt}
                      setVideoPrompt={setVideoPrompt}
                      videoImageUrl={videoImageUrl}
                      setVideoImageUrl={setVideoImageUrl}
                      videoLoading={videoLoading}
                      videoError={videoError}
                      onGenerateVideo={handleGenerateVideo}
                  />
               </div>
            
               {/* Right: Result */}
               <div className="lg:col-span-2 space-y-6">
                   {currentVideoSession ? (
                       <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                          <div className="p-6 space-y-6">
                              {/* History Header */}
                              <div className="flex justify-between items-center border-b border-gray-100 pb-4">
                                   <div className="flex items-center text-sm text-gray-500">
                                       <History size={16} className="mr-2" />
                                       <span>视频记录</span>
                                   </div>
                                   <div className="flex items-center space-x-3">
                                       <button 
                                           onClick={() => setCurrentVideoIndex(prev => Math.max(0, prev - 1))}
                                           disabled={currentVideoIndex <= 0}
                                           className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                       >
                                           <ChevronLeft size={20} />
                                       </button>
                                       <span className="text-sm font-medium text-gray-700">
                                           {currentVideoIndex + 1} / {videoHistory.length}
                                       </span>
                                       <button 
                                           onClick={() => setCurrentVideoIndex(prev => Math.min(videoHistory.length - 1, prev + 1))}
                                           disabled={currentVideoIndex >= videoHistory.length - 1}
                                           className="p-1 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                       >
                                           <ChevronRight size={20} />
                                       </button>
                                   </div>
                               </div>

                              {/* Video Display */}
                              <div className="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                                  {currentVideoSession.videoUrl ? (
                                      <video controls className="w-full h-full" src={currentVideoSession.videoUrl} />
                                  ) : (
                                      <div className="text-white text-center">
                                          {currentVideoSession.status === 'FAILED' ? (
                                              <div className="text-red-400 flex flex-col items-center">
                                                  <span className="mb-2 text-2xl">❌</span>
                                                  生成失败: {currentVideoSession.error}
                                              </div>
                                          ) : (
                                              <>
                                                  <Loader2 className="animate-spin mx-auto mb-4 text-indigo-400" size={32} />
                                                  <p className="font-medium text-lg">AI 正在绘制视频...</p>
                                                  <p className="text-sm text-gray-400 mt-2">预计耗时 2-5 分钟</p>
                                                  <p className="text-xs text-gray-500 mt-1">Wan2.6 模型正在计算光影与动态</p>
                                              </>
                                          )}
                                      </div>
                                  )}
                              </div>
                              {/* Prompt Display */}
                              <div className="bg-gray-50 p-4 rounded-md">
                                  <h3 className="text-sm font-semibold text-gray-700 mb-1">提示词:</h3>
                                  <p className="text-gray-600 text-sm">{currentVideoSession.prompt}</p>
                                  {currentVideoSession.imageUrl && (
                                      <div className="mt-3">
                                          <h3 className="text-sm font-semibold text-gray-700 mb-1">参考原图:</h3>
                                          <img src={currentVideoSession.imageUrl} className="h-20 rounded border border-gray-200" alt="Ref" />
                                      </div>
                                  )}
                              </div>
                          </div>
                       </div>
                   ) : (
                       <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-gray-400 p-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                          <Film size={48} className="mb-4 text-gray-300" />
                          <h3 className="text-lg font-medium text-gray-600 mb-2">AI 视频创作</h3>
                          <p className="text-center text-gray-500 max-w-md">
                             选择"文生视频"或"图生视频"，让 AI 为您生成 5 秒的高清动态视频。<br/>
                             支持中文提示词，适合制作笔记首图或动态背景。
                          </p>
                       </div>
                   )}
               </div>
            </div>
        )}
      </div>

      {/* Structure Modal */}
      {showStructureModal && remixStructure && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                  <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                          <h3 className="text-lg font-bold text-gray-900 flex items-center">
                              <Sparkles className="mr-2 text-indigo-600" size={20} />
                              爆款结构详情
                          </h3>
                          <button onClick={() => setShowStructureModal(false)} className="text-gray-400 hover:text-gray-600">
                              <X size={20} />
                          </button>
                      </div>
                      
                      <div className="space-y-4">
                          <div className="bg-indigo-50 p-3 rounded-md border border-indigo-100">
                              <p className="text-xs text-indigo-800 mb-1 font-bold">AI 指令状态：</p>
                              <p className="text-sm text-indigo-700">
                                  已注入系统提示词。AI 将严格遵循以下结构生成内容，而不仅仅是参考标题。
                              </p>
                          </div>

                          {remixStructure.visual_analysis && (
                              <div className="bg-purple-50 p-3 rounded-md border border-purple-100">
                                  <h4 className="text-sm font-bold text-purple-900 mb-1 flex items-center">
                                      <Video size={14} className="mr-1"/> 视觉/分镜分析
                                  </h4>
                                  <div className="text-xs text-purple-800 max-h-32 overflow-y-auto whitespace-pre-wrap">
                                      {remixStructure.visual_analysis}
                                  </div>
                              </div>
                          )}

                          <div className="grid grid-cols-2 gap-3">
                              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                  <span className="block text-xs text-gray-500 font-bold mb-1">开头钩子</span>
                                  <span className="text-sm text-gray-800">{remixStructure.hook_type || '通用'}</span>
                              </div>
                              <div className="bg-gray-50 p-3 rounded border border-gray-100">
                                  <span className="block text-xs text-gray-500 font-bold mb-1">情感基调</span>
                                  <span className="text-sm text-gray-800">{remixStructure.tone || '默认'}</span>
                              </div>
                          </div>

                          <div className="bg-gray-50 p-3 rounded border border-gray-100">
                              <span className="block text-xs text-gray-500 font-bold mb-2">结构脉络</span>
                              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                                  {remixStructure.structure_breakdown?.map((s: string, i: number) => (
                                      <li key={i}>{s}</li>
                                  ))}
                              </ul>
                          </div>
                      </div>

                      <div className="mt-6 flex justify-end">
                          <button 
                              onClick={() => setShowStructureModal(false)}
                              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm font-medium"
                          >
                              关闭
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Image Editor Modal */}
      {showImageEditor && (
        <ImageEditor
          imageUrl={editingImageUrl}
          onClose={() => {
            setShowImageEditor(false);
            setEditingImageUrl('');
          }}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
}
