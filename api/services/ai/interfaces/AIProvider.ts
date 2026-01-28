export interface AIProvider {
    generateText(messages: any[], options?: any): Promise<string>;
    generateJSON<T>(messages: any[], options?: any): Promise<T>;
    generateImage(prompt: string, options?: any): Promise<string>;
}
