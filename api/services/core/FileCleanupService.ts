import fs from 'fs';
import path from 'path';
import config from '../../config.js';
import { Logger } from '../LoggerService.js';

export class FileCleanupService {
    /**
     * Safely deletes a list of files from the filesystem.
     * Only deletes files within the public/uploads or public/temp directories to ensure safety.
     * Silently ignores errors (e.g., file not found).
     */
    static async deleteFiles(filePaths: (string | undefined | null)[]) {
        for (const filePath of filePaths) {
            if (!filePath) continue;

            try {
                // Normalize path
                // If it's a URL (http://localhost...), strip it to relative path
                let relativePath = filePath;
                if (filePath.startsWith('http')) {
                    try {
                        const url = new URL(filePath);
                        relativePath = url.pathname; // /uploads/xxx.jpg
                    } catch (e) {
                        // Not a valid URL, treat as path
                    }
                }

                // Remove leading slash if present to make it relative to root
                if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                    relativePath = relativePath.substring(1);
                }

                // Construct absolute path using Config
                // We assume relativePath is relative to PROJECT_ROOT (e.g. "public/uploads/xxx.jpg")
                // Or if it starts with "uploads/", we need to map it correctly.
                
                // Let's assume the relativePath is something like "public/uploads/foo.jpg" or "uploads/foo.jpg"
                // Best strategy: Try to resolve it against ROOT.
                
                const absolutePath = path.resolve(config.paths.root, relativePath);

                // Security Check: Ensure path is within allowed directories
                const allowedDirs = [
                    config.paths.uploads,
                    config.paths.temp,
                    path.join(config.paths.public, 'assets')
                ];

                const isAllowed = allowedDirs.some(dir => absolutePath.startsWith(dir));

                if (!isAllowed) {
                    Logger.warn('FileCleanup', `Skipped deletion of unsafe path: ${absolutePath}`);
                    continue;
                }

                // Delete file
                if (fs.existsSync(absolutePath)) {
                    await fs.promises.unlink(absolutePath);
                    Logger.info('FileCleanup', `Deleted: ${relativePath}`);
                }
            } catch (error) {
                Logger.error('FileCleanup', `Failed to delete ${filePath}`, error);
            }
        }
    }
}
