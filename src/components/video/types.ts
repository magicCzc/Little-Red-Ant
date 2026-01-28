export interface VideoScene {
    id: string;
    scene_index: number;
    script_visual: string;
    script_audio: string;
    status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
    video_url?: string;
    audio_url?: string;
    duration?: number;
    task_id?: string;
}

export interface VideoProject {
    id: string;
    title: string;
    status: 'DRAFT' | 'GENERATING' | 'COMPLETED';
    final_video_url?: string;
    bgm_url?: string;
    scenes: VideoScene[];
    updated_at: string;
    character_desc?: string;
    tags?: string[];
    description?: string;
    publish_status?: 'UNPUBLISHED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
    publish_task_id?: string;
}
