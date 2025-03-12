export interface RetryOptions {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffFactor?: number;
    shouldRetry?: (error: any) => boolean;
}

const defaultOptions: Required<RetryOptions> = {
    maxAttempts: 5,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffFactor: 2,
    shouldRetry: () => true
};

export async function retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const config = { ...defaultOptions, ...options };
    let lastError: any;
    let delay = config.initialDelayMs;

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === config.maxAttempts || !config.shouldRetry(error)) {
                throw error;
            }

            console.warn(
                `Operation failed (attempt ${attempt}/${config.maxAttempts}). Retrying in ${delay}ms...`,
                error
            );

            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * config.backoffFactor, config.maxDelayMs);
        }
    }

    throw lastError;
}

export const withRetry = <T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
) => {
    return () => retry(operation, options);
}; 