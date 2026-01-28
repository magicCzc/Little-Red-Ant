
export interface TaskHandler {
    handle(task: any): Promise<any>;
}
