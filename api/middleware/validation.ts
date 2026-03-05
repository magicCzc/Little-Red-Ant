import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { Logger } from '../services/LoggerService.js';

/**
 * Generic middleware to validate request body against a Zod schema.
 */
export const validateBody = (schema: ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        try {
            // Parse body
            // This strips unknown keys if strict() is used, or passes them if simple object()
            // Using parse() throws; safeParse() returns object
            const result = schema.safeParse(req.body);

            if (!result.success) {
                // Formatting error messages
                // Zod v4 uses .issues instead of .errors
                const errorObj = result.error as any;
                const issues = errorObj.issues || errorObj.errors || [];
                
                const errorMessages = issues.map((issue: any) => ({
                    path: issue.path.join('.'),
                    message: issue.message,
                }));

                Logger.warn('Validation', 'Request validation failed', {
                    path: req.path,
                    errors: errorMessages,
                    body: req.body
                });

                return res.status(400).json({
                    error: 'Validation Error',
                    details: errorMessages
                });
            }

            // Replace req.body with parsed (and potentially transformed/sanitized) data
            req.body = result.data;
            next();

        } catch (error) {
            Logger.error('Validation', 'Unexpected validation error', error);
            res.status(500).json({ error: 'Internal Server Error during validation' });
        }
    };
};
