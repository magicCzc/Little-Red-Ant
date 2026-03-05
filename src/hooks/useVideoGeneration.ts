import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useSafeAsync } from './useSafeAsync';

export interface VideoSession {
  type: 'video';
  prompt: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  error?: string;
  timestamp: number;
  taskId?: string;
}

export interface SceneVideoState {
  status: 'idle' | 'generating' | 'completed' | 'failed';
  videoUrl?: string;
  taskId?: string;
  error?: string;
}

export function useVideoGeneration() {
  const [videoMode, setVideoMode] = useState<'t2v' | 'i2v'>('t2v');
  const [videoPrompt, setVideoPrompt] = useState('');
  const [videoImageUrl, setVideoImageUrl] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoHistory, setVideoHistory] = useState<VideoSession[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(-1);
  const [videoError, setVideoError] = useState<string | null>(null);
  
  const [sceneVideos, setSceneVideos] = useState<Record<string, SceneVideoState>>({});
  const [isStitching, setIsStitching] = useState(false);
  const [stitchedVideoUrl, setStitchedVideoUrl] = useState<string | null>(null);
  const [creatingProject, setCreatingProject] = useState(false);

  const { isMounted } = useSafeAsync();
  const currentVideoAccountIdRef = useState<number | undefined>(undefined); // Track account ID

  // Polling for Videos
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

  // Polling for Scene Videos
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

  const handleGenerateVideo = async (e: React.FormEvent, accountId?: number) => {
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
              imageUrl: videoMode === 'i2v' ? videoImageUrl : undefined,
              accountId: accountId
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

  const handleGenerateSceneVideo = async (key: string, prompt: string) => {
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
          toast.error(`生成失败`);
      }
  };

  return {
    videoMode, setVideoMode,
    videoPrompt, setVideoPrompt,
    videoImageUrl, setVideoImageUrl,
    videoLoading,
    videoHistory, setVideoHistory,
    currentVideoIndex, setCurrentVideoIndex,
    videoError, setVideoError,
    sceneVideos, setSceneVideos,
    isStitching, setIsStitching,
    stitchedVideoUrl, setStitchedVideoUrl,
    creatingProject, setCreatingProject,
    handleGenerateVideo,
    handleGenerateSceneVideo
  };
}