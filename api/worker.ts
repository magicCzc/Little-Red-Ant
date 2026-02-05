
import { getNextPendingTask, completeTask, failTask, taskEvents } from './services/queue.js';
import { TaskRegistry } from './services/tasks/TaskRegistry.js';
import { VideoProjectService } from './services/video/VideoProjectService.js';

const CONCURRENCY_LIMIT = 3; // Allow 3 tasks to run in parallel
let activeWorkers = 0;

export function startWorker() {
    console.log('[Worker] Background task processor started (Concurrency: ' + CONCURRENCY_LIMIT + ').');
    
    const processTask = async () => {
        // Concurrency Control
        if (activeWorkers >= CONCURRENCY_LIMIT) return;
        
        try {
            // Attempt to fetch task (Hybrid: Memory -> DB)
            const task = getNextPendingTask();
            
            if (!task) return;
            
            // Found a task, increment counter and process asynchronously
            activeWorkers++;
            console.log(`[Worker] Processing task ${task.id} (${task.type})... Active: ${activeWorkers}/${CONCURRENCY_LIMIT}`);
            
            try {
                const handler = TaskRegistry.getHandler(task.type);
                const result = await handler.handle(task);
                
                completeTask(task.id, result);
                console.log(`[Worker] Task ${task.id} completed successfully.`);
                
            } catch (error: any) {
                console.error(`[Worker] Task ${task.id} failed:`, error);
                failTask(task.id, error.message || 'Unknown error');
                
                if (task.type === 'PUBLISH' && task.payload) {
                    try {
                        const payload = typeof task.payload === 'string' ? JSON.parse(task.payload) : task.payload;
                        if (payload.projectId) {
                            VideoProjectService.updateProjectStatus(payload.projectId, 'COMPLETED', undefined, 'FAILED');
                        }
                    } catch(e) {}
                }
            } finally {
                activeWorkers--;
                // Immediately check for more tasks after finishing one
                processTask();
            }
            
        } catch (e) {
            console.error('[Worker] Critical error in fetching task:', e);
        }
    };

    // 1. Event-Driven Trigger (Fast Path)
    taskEvents.on('new_task', () => {
        // console.log('[Worker] Received new_task event');
        processTask();
    });

    // 2. Fallback Polling (Slow Path - for Scheduled Tasks & Recovery)
    setInterval(() => {
        // Only poll if we have capacity
        if (activeWorkers < CONCURRENCY_LIMIT) {
            processTask();
        }
    }, 2000); // Check every 2s (Relaxed from 1s because we have event trigger now)
}
