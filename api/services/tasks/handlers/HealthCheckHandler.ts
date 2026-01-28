
import { checkAllAccountsHealth } from '../../rpa/auth.js';
import { TaskHandler } from '../TaskHandler.js';

export class HealthCheckHandler implements TaskHandler {
    async handle(task: any): Promise<any> {
        console.log('[Worker] Running full health check...');
        await checkAllAccountsHealth();
        return { success: true };
    }
}
