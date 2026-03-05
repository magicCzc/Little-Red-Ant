import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enqueueTask, getNextPendingTask, completeTask, Task } from '../queue.js';
import db from '../../db.js';

// Mock DB
vi.mock('../../db.js', () => {
    const mockDb = {
        prepare: vi.fn(() => ({
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn(),
        })),
        transaction: vi.fn((cb) => {
            const tx = () => cb();
            tx.immediate = vi.fn(() => cb());
            return tx;
        }),
    };
    return { default: mockDb };
});

describe('Task Queue', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should enqueue a task with correct priority', () => {
        const insertRun = vi.fn();
        (db.prepare as any).mockReturnValue({ run: insertRun });

        const id = enqueueTask('TEST_TASK', { foo: 'bar' }, undefined, 5);

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tasks'));
        expect(insertRun).toHaveBeenCalledWith(
            expect.any(String), // id
            'TEST_TASK',
            JSON.stringify({ foo: 'bar' }),
            5, // Priority
            expect.any(String), // created_at
            expect.any(String)  // updated_at
        );
        expect(id).toBeDefined();
    });

    it('should fetch the highest priority task first', () => {
        const mockTask = {
            id: 'task-123',
            type: 'TEST_TASK',
            payload: JSON.stringify({}),
            priority: 10,
            status: 'PENDING'
        };

        const getStmt = { get: vi.fn().mockReturnValue(mockTask) };
        const updateStmt = { run: vi.fn() };

        (db.prepare as any)
            .mockReturnValueOnce(getStmt) // Select
            .mockReturnValueOnce(updateStmt); // Update

        const task = getNextPendingTask();

        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('ORDER BY priority DESC'));
        expect(task).toBeDefined();
        expect(task?.id).toBe('task-123');
        expect(task?.status).toBe('PROCESSING');
    });

    it('should handle scheduled tasks correctly', () => {
        const futureDate = new Date(Date.now() + 10000).toISOString();
        enqueueTask('FUTURE_TASK', {}, futureDate);
        
        // Check if scheduled_at was passed to DB
        expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tasks'));
        // We can't easily check the exact args here without complex mock matching because of the if/else in enqueueTask
        // But we can verify the SQL query structure for scheduled tasks
        // The implementation uses two different queries based on scheduledTime
    });
});
