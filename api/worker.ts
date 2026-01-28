
import { getNextPendingTask, completeTask, failTask } from './services/queue.js';
import { TaskRegistry } from './services/tasks/TaskRegistry.js';
import { VideoProjectService } from './services/video/VideoProjectService.js';

let isWorking = false;

export function startWorker() {
    console.log('[Worker] Background task processor started (Modular Architecture).');
    
    // Check for tasks every 2 seconds
    setInterval(async () => {
        if (isWorking) return;
        isWorking = true;
        
        try {
            const task = getNextPendingTask();
            if (task) {
                console.log(`[Worker] Processing task ${task.id} (${task.type})...`);
                
                try {
                    const handler = TaskRegistry.getHandler(task.type);
                    const result = await handler.handle(task);
                    
                    completeTask(task.id, result);
                    console.log(`[Worker] Task ${task.id} completed successfully.`);
                    
                } catch (error: any) {
                    console.error(`[Worker] Task ${task.id} failed:`, error);
                    failTask(task.id, error.message || 'Unknown error');
                    
                    // Handle failure updates for Video Projects
                    if (task.type === 'PUBLISH' && task.payload) {
                        try {
                            const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                            if (payload.projectId) {
                                VideoProjectService.updateProjectStatus(payload.projectId, 'COMPLETED', undefined, 'FAILED');
                            }
                        } catch(e) {}
                    }
                }
            }
        } catch (e) {
            console.error('[Worker] Critical error in processing loop:', e);
        } finally {
            isWorking = false;
        }
    }, 2000);
}
