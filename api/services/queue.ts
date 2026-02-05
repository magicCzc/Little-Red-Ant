
import db from '../db.js';
import crypto from 'crypto';
import { NotificationService } from './NotificationService.js';
import { EventEmitter } from 'events';

// Global Event Bus for Task Notifications
export const taskEvents = new EventEmitter();

// In-Memory Queue Buffer (for immediate processing without polling)
const memoryQueue: string[] = [];

export interface Task {
    id: string;
    type: string;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    payload: any;
    result?: any;
    error?: string;
    attempts: number;
    progress: number;
    scheduled_at?: string; // ISO String
    priority: number; // Higher value = Higher priority (Default 0, High 10, Low -10)
    created_at: string;
    updated_at: string;
}

export function enqueueTask(type: string, payload: any, scheduledAt?: string, priority: number = 0): string {
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);
    const now = new Date().toISOString();
    
    // Set higher priority for user-facing tasks by default if not specified
    if (priority === 0) {
        if (type === 'GENERATE_CONTENT' || type === 'GENERATE_IMAGE' || type === 'GENERATE_VIDEO') priority = 10;
        if (type === 'PUBLISH') priority = 5;
    }

    // Default scheduledAt to NULL if undefined (for immediate execution)
    // Ensure we handle date parsing if string is passed
    let scheduledTime = scheduledAt;
    if (scheduledAt) {
         try {
             // Validate date
             const d = new Date(scheduledAt);
             if (isNaN(d.getTime())) scheduledTime = undefined;
             else scheduledTime = d.toISOString();
         } catch(e) { scheduledTime = undefined; }
    }

    if (scheduledTime) {
        db.prepare(`
            INSERT INTO tasks (id, type, payload, status, progress, scheduled_at, priority, created_at, updated_at)
            VALUES (?, ?, ?, 'PENDING', 0, ?, ?, ?, ?)
        `).run(id, type, payloadStr, scheduledTime, priority, now, now);
    } else {
        db.prepare(`
            INSERT INTO tasks (id, type, payload, status, progress, priority, created_at, updated_at)
            VALUES (?, ?, ?, 'PENDING', 0, ?, ?, ?)
        `).run(id, type, payloadStr, priority, now, now);
        
        // Push to Memory Queue and Notify Worker (Immediate Execution)
        memoryQueue.push(id);
        taskEvents.emit('new_task', id);
    }
    
    return id;
}

// Check if memory queue has pending tasks
export function hasMemoryTasks(): boolean {
    return memoryQueue.length > 0;
}

// Pop task from memory queue (if valid)
export function popMemoryTask(): string | undefined {
    return memoryQueue.shift();
}

export function getTask(id: string): Task | undefined {
    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    if (!row) return undefined;
    return {
        ...row,
        payload: JSON.parse(row.payload),
        result: row.result ? JSON.parse(row.result) : undefined
    };
}

// Atomic fetch-and-lock with Priority Support (Hybrid: Memory First -> DB Fallback)
export function getNextPendingTask(): Task | undefined {
    let task: Task | undefined;
    
    // 1. Try Fast Path (Memory Queue)
    // Only valid for tasks without scheduled_at (immediate)
    // We check memory queue, but we STILL need to lock it in DB to prevent double processing
    // if multiple processes/workers were running (though currently single process).
    
    const tryLockTask = (taskId?: string) => {
        const transaction = db.transaction(() => {
            const now = new Date().toISOString();
            
            let query = `
                SELECT * FROM tasks 
                WHERE status = 'PENDING' 
                AND (scheduled_at IS NULL OR scheduled_at <= ?)
            `;
            const params = [now];

            if (taskId) {
                query += ` AND id = ?`;
                params.push(taskId);
            } else {
                query += ` ORDER BY priority DESC, created_at ASC LIMIT 1`;
            }

            const row = db.prepare(query).get(...params) as any;
            
            if (row) {
                db.prepare(`
                    UPDATE tasks 
                    SET status = 'PROCESSING', updated_at = ? 
                    WHERE id = ?
                `).run(new Date().toISOString(), row.id);
                
                task = {
                    ...row,
                    payload: JSON.parse(row.payload),
                    status: 'PROCESSING'
                };
            }
        });
        (transaction as any).immediate();
    };

    // Attempt Fast Path first
    if (memoryQueue.length > 0) {
        const candidateId = memoryQueue[0]; // Peek
        tryLockTask(candidateId);
        
        if (task) {
            memoryQueue.shift(); // Remove from memory if successfully locked
            return task;
        } else {
            // Memory queue stale (task maybe already taken or cancelled), clean up
            memoryQueue.shift();
        }
    }

    // Fallback: Full DB Scan (for scheduled tasks or missed events)
    if (!task) {
        tryLockTask();
    }
    
    return task;
}

export function updateTaskProgress(id: string, progress: number) {
    const p = Math.max(0, Math.min(100, Math.round(progress)));
    db.prepare(`
        UPDATE tasks 
        SET progress = ?, updated_at = ? 
        WHERE id = ?
    `).run(p, new Date().toISOString(), id);
}

export function completeTask(id: string, result: any = {}) {
    db.prepare(`
        UPDATE tasks 
        SET status = 'COMPLETED', progress = 100, result = ?, updated_at = ? 
        WHERE id = ?
    `).run(JSON.stringify(result), new Date().toISOString(), id);

    const task = getTask(id);
    if (task) {
        let title = '任务完成';
        let msg = `任务 ID: ${id.slice(0, 8)} 已成功完成。`;
        
        switch(task.type) {
            case 'SCRAPE_TRENDS':
                title = '热点抓取完成';
                msg = '最新热点数据已更新到数据库。';
                break;
            case 'PUBLISH':
            case 'PUBLISH_NOTE': // Legacy support
                title = '笔记发布完成';
                msg = `笔记 "${task.payload?.title || '未命名'}" 已发布。`;
                break;
            case 'GENERATE_CONTENT':
                title = '内容生成完成';
                msg = 'AI 内容生成任务已完成。';
                break;
            case 'SCRAPE_COMMENTS':
                title = '评论同步完成';
                msg = '最新评论已同步到互动中心。';
                break;
            case 'ANALYZE_NOTE':
                title = '笔记分析完成';
                msg = '热门笔记深度分析已完成。';
                break;
            case 'CHECK_HEALTH':
                title = '全量体检完成';
                msg = '账号矩阵健康检查已完成。';
                break;
            case 'VIDEO_STITCH':
                title = '视频合成完成';
                msg = '视频项目已合成完毕，可前往预览。';
                break;
        }
        // Only notify for high priority or user-initiated tasks to avoid spam
        if (task.priority >= 0) {
             NotificationService.create('SUCCESS', title, msg);
        }
    }
}

export function failTask(id: string, error: string) {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    const maxRetries = 3; 
    
    let errorLog = [];
    try {
        errorLog = JSON.parse(task.result || '[]');
        if (!Array.isArray(errorLog)) errorLog = [];
    } catch(e) {}
    
    errorLog.push({ timestamp: new Date().toISOString(), error });

    if ((task.attempts || 0) < maxRetries) {
        // Retry with backoff
        const backoffDelay = Math.pow(2, task.attempts || 0) * 60 * 1000; 
        const nextRun = new Date(Date.now() + backoffDelay).toISOString();
        
        const stmt = db.prepare(`
            UPDATE tasks 
            SET status = 'PENDING', 
            attempts = attempts + 1, 
            progress = 0,
            result = ?,
            error = ?,
            scheduled_at = ?,
            updated_at = ?
        WHERE id = ?
        `);
        stmt.run(JSON.stringify(errorLog), error, nextRun, new Date().toISOString(), id);
        console.log(`[Queue] Task ${id} failed. Retrying (${(task.attempts || 0) + 1}/${maxRetries}) in ${backoffDelay/1000}s...`);
    } else {
        // Final Failure
        const stmt = db.prepare('UPDATE tasks SET status = \'FAILED\', result = ?, error = ?, updated_at = ? WHERE id = ?');
        stmt.run(JSON.stringify(errorLog), error, new Date().toISOString(), id);
        console.log(`[Queue] Task ${id} failed permanently after ${maxRetries} retries.`);

        let title = '任务失败';
        let msg = `任务 ID: ${id.slice(0, 8)} 执行失败: ${error}`;
        
        let payload: any = {};
        try { payload = JSON.parse(task.payload); } catch(e) {}

        switch(task.type) {
            case 'SCRAPE_TRENDS': title = '热点抓取失败'; break;
            case 'PUBLISH':
            case 'PUBLISH_NOTE': title = '笔记发布失败'; msg = `笔记 "${payload?.title || '未命名'}" 发布失败: ${error}`; break;
            case 'GENERATE_CONTENT': title = '内容生成失败'; break;
            case 'SCRAPE_COMMENTS': title = '评论同步失败'; break;
            case 'ANALYZE_NOTE': title = '分析任务失败'; break;
            case 'VIDEO_STITCH': title = '视频合成失败'; break;
        }
        
        NotificationService.create('ERROR', title, msg);
    }
}

export function cancelTask(id: string) {
    const result = db.prepare(`
        UPDATE tasks 
        SET status = 'CANCELLED', updated_at = ? 
        WHERE id = ? AND (status = 'PENDING' OR status = 'PROCESSING')
    `).run(new Date().toISOString(), id);
    return result.changes > 0;
}

// Crash Recovery: Reset tasks that were stuck in PROCESSING state during a crash
export function recoverStaleTasks() {
    console.log('[Queue] Checking for stale tasks...');
    
    // Threshold: Tasks stuck in PROCESSING for more than 30 minutes
    // (Assuming no task takes longer than 30m without updating progress/status)
    const threshold = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const staleTasks = db.prepare(`
        SELECT id, type, attempts FROM tasks 
        WHERE status = 'PROCESSING' AND updated_at < ?
    `).all(threshold) as any[];
    
    if (staleTasks.length > 0) {
        console.warn(`[Queue] Found ${staleTasks.length} stale tasks. Recovering...`);
        
        const updateStmt = db.prepare(`
            UPDATE tasks 
            SET status = 'PENDING', 
                attempts = attempts + 1, 
                error = 'System crash recovery: Task reset',
                updated_at = ? 
            WHERE id = ?
        `);
        
        const failStmt = db.prepare(`
            UPDATE tasks 
            SET status = 'FAILED', 
                error = 'System crash recovery: Task expired',
                updated_at = ? 
            WHERE id = ?
        `);

        const now = new Date().toISOString();
        
        for (const task of staleTasks) {
            if (task.attempts < 3) {
                updateStmt.run(now, task.id);
                console.log(`[Queue] Recovered task ${task.id} (Retry)`);
            } else {
                failStmt.run(now, task.id);
                console.log(`[Queue] Failed task ${task.id} (Max retries exceeded)`);
            }
        }
    }
}
