/**
 * Database utility functions for reliable database operations
 */

// Enhanced exponential backoff retry mechanism for database operations
export async function retryWithExponentialBackoff<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 6,
  baseDelay: number = 1500
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Database operation attempt ${attempt}/${maxAttempts}`);
      
      const result = await operation();
      
      if (attempt > 1) {
        console.log(`✅ Database operation succeeded on attempt ${attempt}`);
      }
      
      return result;
    } catch (error: any) {
      lastError = error;
      console.error(`❌ Database operation failed on attempt ${attempt}:`, {
        error: error.message,
        code: error.code,
        attempt,
        maxAttempts
      });
      
      // Check if this is a connection-related error that might benefit from retry
      const isRetryableError = (
        error.message?.includes('Can\'t reach database server') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ENOTFOUND') ||
        error.code === 'P2024' || // Timed out fetching a new connection from the connection pool
        error.code === 'P2019'    // Input error (possibly connection-related)
      );
      
      if (!isRetryableError || attempt === maxAttempts) {
        console.error(`💥 Final database operation failure after ${attempt} attempts`);
        throw error;
      }
      
      // Progressive delay with jitter for better distribution
      const jitter = Math.random() * 0.5; // 0-50% jitter
      const delay = Math.min(baseDelay * Math.pow(1.8, attempt - 1) * (1 + jitter), 30000);
      
      console.log(`⏳ Retrying database operation in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}