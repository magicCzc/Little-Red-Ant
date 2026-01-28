import { v4 as uuidv4 } from 'uuid';
import db from '../../db.js';

export interface VideoProject {
    id: string;
    title: string;
    script_content: any; // The full JSON script object
    status: 'DRAFT' | 'GENERATING' | 'COMPLETED';
    final_video_url?: string;
    bgm_url?: string;
    character_desc?: string;
    tags?: string[];
    description?: string;
    publish_status?: 'UNPUBLISHED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED';
    publish_task_id?: string;
    created_at: string;
    updated_at: string;
    scenes?: VideoScene[];
}

export interface VideoScene {
    id: string;
    project_id: string;
    scene_index: number;
    script_visual: string;
    script_audio: string;
    status: 'PENDING' | 'GENERATING' | 'COMPLETED' | 'FAILED';
    video_url?: string;
    audio_url?: string;
    duration?: number;
    task_id?: string;
    created_at?: string;
}

export class VideoProjectService {
    
    // Create a new project from a generated script
    static createProject(title: string, scriptContent: any, characterDesc?: string, tags?: string[], description?: string): VideoProject {
        const id = uuidv4();
        const scriptJson = JSON.stringify(scriptContent);
        const tagsJson = tags ? JSON.stringify(tags) : '[]';
        
        db.prepare(`
            INSERT INTO video_projects (id, title, script_content, status, character_desc, tags, description)
            VALUES (?, ?, ?, 'DRAFT', ?, ?, ?)
        `).run(id, title, scriptJson, characterDesc || null, tagsJson, description || null);

        // Parse script and create scenes
        // Assuming scriptContent is the array of scene objects directly, or part of the larger object
        // Let's assume standard format: scriptContent = [ { shot:..., visual:..., audio:... }, ... ]
        // We need to handle the format from ContentService
        
        const scenes = Array.isArray(scriptContent) ? scriptContent : (scriptContent.scenes || []);
        
        const insertScene = db.prepare(`
            INSERT INTO video_scenes (id, project_id, scene_index, script_visual, script_audio, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING')
        `);

        scenes.forEach((scene: any, index: number) => {
            insertScene.run(
                uuidv4(),
                id,
                index,
                scene.visual || '',
                scene.audio || '',
            );
        });

        return this.getProject(id)!;
    }

    static getProject(id: string): VideoProject | null {
        const project = db.prepare('SELECT * FROM video_projects WHERE id = ?').get(id) as any;
        if (!project) return null;

        project.script_content = JSON.parse(project.script_content);
        if (project.tags) {
            try {
                project.tags = JSON.parse(project.tags);
            } catch (e) {
                project.tags = [];
            }
        }
        
        project.scenes = db.prepare('SELECT * FROM video_scenes WHERE project_id = ? ORDER BY scene_index ASC').all(id) as VideoScene[];
        
        return project as VideoProject;
    }

    static updateSceneStatus(sceneId: string, status: string, videoUrl?: string, taskId?: string) {
        db.prepare(`
            UPDATE video_scenes 
            SET status = ?, video_url = ?, task_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(status, videoUrl || null, taskId || null, sceneId);
    }
    
    static updateSceneAudio(sceneId: string, audioUrl: string, duration: number) {
        db.prepare(`
            UPDATE video_scenes 
            SET audio_url = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(audioUrl, duration, sceneId);
    }
    
    static updateProjectStatus(projectId: string, status: string, finalVideoUrl?: string, publishStatus?: string, publishTaskId?: string) {
        if (finalVideoUrl) {
            db.prepare('UPDATE video_projects SET status = ?, final_video_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(status, finalVideoUrl, projectId);
        } else if (publishStatus && publishTaskId) {
            db.prepare('UPDATE video_projects SET publish_status = ?, publish_task_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(publishStatus, publishTaskId, projectId);
        } else if (publishStatus) {
            db.prepare('UPDATE video_projects SET publish_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(publishStatus, projectId);
        } else {
            db.prepare('UPDATE video_projects SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(status, projectId);
        }
    }

    static updateProjectBgm(projectId: string, bgmUrl: string) {
        db.prepare('UPDATE video_projects SET bgm_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(bgmUrl, projectId);
    }

    static listProjects(): VideoProject[] {
        return db.prepare('SELECT * FROM video_projects ORDER BY created_at DESC').all() as VideoProject[];
    }

    static deleteProject(projectId: string) {
        db.transaction(() => {
            db.prepare('DELETE FROM video_scenes WHERE project_id = ?').run(projectId);
            db.prepare('DELETE FROM video_projects WHERE id = ?').run(projectId);
        })();
    }

    static updateProjectCharacter(projectId: string, characterDesc: string) {
        db.prepare('UPDATE video_projects SET character_desc = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(characterDesc, projectId);
    }

    static checkProjectCompletion(projectId: string): boolean {
        const scenes = db.prepare('SELECT status, video_url, duration FROM video_scenes WHERE project_id = ?').all(projectId) as any[];
        if (scenes.length === 0) return false;
        
        // All scenes must be COMPLETED and have a video_url and duration
        const allCompleted = scenes.every(s => s.status === 'COMPLETED' && s.video_url && s.duration);
        return allCompleted;
    }
}
