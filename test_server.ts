
import { VideoProjectService } from './api/services/video/VideoProjectService.js';
import db from './api/db.js';

try {
    console.log('Testing Database Connection...');
    const projects = VideoProjectService.listProjects();
    console.log('Successfully listed projects:', projects.length);
    process.exit(0);
} catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
}
