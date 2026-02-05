import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSafeAsync } from './useSafeAsync';

export interface GeneratedContent {
  title: string;
  options: {
    type: string;
    label: string;
    content: string;
  }[];
  tags: string[];
  image_prompts: string[];
  character_desc?: string;
  risk_warnings?: {
    blocked: string[];
    warnings: string[];
    suggestions: string[];
    score: number;
  };
}

export interface GeneratedImage {
  prompt: string;
  url: string;
  loading: boolean;
  taskId?: string;
}

export interface GenerationSession {
  content: GeneratedContent;
  images: GeneratedImage[];
  timestamp: number;
  taskId?: string;
  status?: 'PENDING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

export function useContentGeneration() {
  const [contentType, setContentType] = useState<'note' | 'article' | 'video_script'>('note');
  const [topic, setTopic] = useState('');
  const [keywords, setKeywords] = useState('');
  const [style, setStyle] = useState('');
  const [characterDesc, setCharacterDesc] = useState<string>('');
  const [customInstructions, setCustomInstructions] = useState<string>('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [history, setHistory] = useState<GenerationSession[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const [remixStructure, setRemixStructure] = useState<any>(null);
  const [remixSourceTitle, setRemixSourceTitle] = useState<string>('');
  
  const { isMounted, abortControllerRef } = useSafeAsync();
  const currentAccountIdRef = useRef<number | undefined>(undefined);

  // Polling for Content Status
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
                              loading: true
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
                          newImages.forEach((_, imgIdx) => {
                              handleGenerateImage(imgIdx, undefined, true, s.taskId);
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

  // Polling for Image Status
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
                   
                   // Handle both COMPLETED and SUCCESS status (some workers return SUCCESS)
                   if (task.status === 'COMPLETED' || task.status === 'SUCCESS') {
                       // 304 Check: If result is empty or same, ignore
                       if (!task.result || !task.result.url) {
                           continue;
                       }

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

  const handleGenerate = async (activeAccountId?: number) => {
    if (!topic.trim()) return;

    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    currentAccountIdRef.current = activeAccountId;

    setLoading(true);
    setErrorMsg(null);

    try {
      const keywordList = keywords.split(/[,，\s]+/).filter(k => k.trim());
      const res = await axios.post('/api/generate/content', {
        topic: topic.trim(),
        keywords: keywordList,
        style,
        character_desc: characterDesc, 
        remix_structure: remixStructure, 
        contentType, 
        accountId: activeAccountId,
        custom_instructions: customInstructions
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
      
      toast.success('生成任务已提交');
      
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

  const handleGenerateImage = async (imageIndex: number, promptOverride?: string, isAutoTrigger = false, sessionTaskId?: string, refImg?: string, accountId?: number) => {
      if (!isMounted.current) return;
      
      // Determine session index
      let targetSessionIndex = currentIndex;
      if (isAutoTrigger && sessionTaskId) {
          targetSessionIndex = history.findIndex(h => h.taskId === sessionTaskId);
      } else if (isAutoTrigger) {
          targetSessionIndex = history.length - 1;
      }
      
      if (targetSessionIndex < 0) return;

      setHistory(prev => {
          const newHistory = [...prev];
          const session = { ...newHistory[targetSessionIndex] };
          const images = [...session.images];
          
          if (!promptOverride && images[imageIndex]) promptOverride = images[imageIndex].prompt;
          
          images[imageIndex] = { ...images[imageIndex], loading: true };
          session.images = images;
          newHistory[targetSessionIndex] = session;
          return newHistory;
      });
      
      try {
          const finalPrompt = promptOverride || history[targetSessionIndex]?.images[imageIndex]?.prompt;

          if (!finalPrompt) throw new Error('Prompt is required');

          const res = await axios.post('/api/generate/image', { 
              prompt: finalPrompt, 
              ref_img: refImg,
              accountId: accountId // Pass active account ID
          });
          const { taskId } = res.data;

          setHistory(prev => {
              const newHistory = [...prev];
              const session = { ...newHistory[targetSessionIndex] };
              const images = [...session.images];
              images[imageIndex] = { ...images[imageIndex], taskId: taskId };
              session.images = images;
              newHistory[targetSessionIndex] = session;
              return newHistory;
          });
          
      } catch (e) {
          if (!isMounted.current) return;
          setHistory(prev => {
              const newHistory = [...prev];
              const session = { ...newHistory[targetSessionIndex] };
              const images = [...session.images];
              images[imageIndex] = { ...images[imageIndex], loading: false };
              session.images = images;
              newHistory[targetSessionIndex] = session;
              return newHistory;
          });
          if (!isAutoTrigger) toast.error('图片生成任务提交失败');
      }
  };

  return {
    contentType, setContentType,
    topic, setTopic,
    keywords, setKeywords,
    style, setStyle,
    characterDesc, setCharacterDesc,
    customInstructions, setCustomInstructions,
    loading,
    errorMsg,
    history, setHistory,
    currentIndex, setCurrentIndex,
    remixStructure, setRemixStructure,
    remixSourceTitle, setRemixSourceTitle,
    handleGenerate,
    handleGenerateImage,
    isMounted
  };
}