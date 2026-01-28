
import db from '../db.js';
import crypto from 'crypto';
import { NotificationService } from './NotificationService.js';

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
    created_at: string;
    updated_at: string;
}

export function enqueueTask(type: string, payload: any, scheduledAt?: string): string {
    const id = crypto.randomUUID();
    const payloadStr = JSON.stringify(payload);
    const now = new Date().toISOString();
    
    if (scheduledAt) {
        db.prepare(`
            INSERT INTO tasks (id, type, payload, status, progress, scheduled_at, created_at, updated_at)
            VALUES (?, ?, ?, 'PENDING', 0, ?, ?, ?)
        `).run(id, type, payloadStr, scheduledAt, now, now);
    } else {
        db.prepare(`
            INSERT INTO tasks (id, type, payload, status, progress, created_at, updated_at)
            VALUES (?, ?, ?, 'PENDING', 0, ?, ?)
        `).run(id, type, payloadStr, now, now);
    }
    
    return id;
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

// Atomic fetch-and-lock
export function getNextPendingTask(): Task | undefined {
    let task: Task | undefined;
    
    // SQLite transaction defaults to DEFERRED.
    // Use IMMEDIATE to acquire a write lock at start to prevent deadlocks/busy errors
    // when multiple workers try to upgrade read locks to write locks.
    const transaction = db.transaction(() => {
        // Filter by scheduled_at (NULL or past/present)
        const now = new Date().toISOString();
        const row = db.prepare(`
            SELECT * FROM tasks 
            WHERE status = 'PENDING' 
            AND (scheduled_at IS NULL OR scheduled_at <= ?)
            ORDER BY created_at ASC 
            LIMIT 1
        `).get(now) as any;
        
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
    
    // Using immediate transaction type for concurrency safety
    (transaction as any).immediate(); 
    return task;
}

export function updateTaskProgress(id: string, progress: number) {
    // Ensure progress is 0-100
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

    // Get task info for notification
    const task = getTask(id);
    if (task) {
        let title = '任务完成';
        let msg = `任务 ID: ${id.slice(0, 8)} 已成功完成。`;
        
        switch(task.type) {
            case 'SCRAPE_TRENDS':
                title = '热点抓取完成';
                msg = '最新热点数据已更新到数据库。';
                break;
            case 'PUBLISH_NOTE':
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
        }
        NotificationService.create('SUCCESS', title, msg);
    }
}

export function failTask(id: string, error: string) {
    // Check retry logic
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
    const maxRetries = 3; // Max retry count
    
    // Parse existing error history or init new
    let errorLog = [];
    try {
        errorLog = JSON.parse(task.result || '[]');
        if (!Array.isArray(errorLog)) errorLog = [];
    } catch(e) {}
    
    errorLog.push({ timestamp: new Date().toISOString(), error });

    if ((task.attempts || 0) < maxRetries) {
        // Retry
        const backoffDelay = Math.pow(2, task.attempts || 0) * 60 * 1000; // Exponential backoff: 1m, 2m, 4m...
        // Or simple fixed delay? Let's use scheduled_at to push it forward
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

        // Notification for Failure
        let title = '任务失败';
        let msg = `任务 ID: ${id.slice(0, 8)} 执行失败: ${error}`;
        
        // Parse payload safely
        let payload: any = {};
        try { payload = JSON.parse(task.payload); } catch(e) {}

        switch(task.type) {
            case 'SCRAPE_TRENDS': title = '热点抓取失败'; break;
            case 'PUBLISH_NOTE': title = '笔记发布失败'; msg = `笔记 "${payload?.title || '未命名'}" 发布失败: ${error}`; break;
            case 'GENERATE_CONTENT': title = '内容生成失败'; break;
            case 'SCRAPE_COMMENTS': title = '评论同步失败'; break;
            case 'ANALYZE_NOTE': title = '分析任务失败'; break;
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
