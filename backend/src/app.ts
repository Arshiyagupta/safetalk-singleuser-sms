import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables FIRST before any other imports that might use them
dotenv.config();

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import webhookRoutes from './routes/webhook';
import subscriptionRoutes from './routes/subscription';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com", "https://js.stripe.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
    },
  },
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://safetalk-coparents.vercel.app', 'https://safetalk-sms.com'] // Frontend domains
    : true, // Allow all origins in development
  credentials: true,
}));

app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

// Body parsing middleware
app.use('/webhook', express.raw({ type: 'application/x-www-form-urlencoded' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint for SMS service
app.get('/health', (_req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'SafeTalk SMS Service',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint for service info
app.get('/', (_req, res) => {
  res.json({
    service: 'SafeTalk SMS Processing Service',
    status: 'active',
    endpoints: {
      health: '/health',
      webhook: '/webhook/sms',
      subscription: '/api/subscribe'
    }
  });
});

// API routes
app.use('/api', subscriptionRoutes);

// SMS webhook routes (only route we need for SMS-only service)
app.use('/webhook', webhookRoutes);

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    message: `Cannot ${_req.method} ${_req.originalUrl}`
  });
});

// Global error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`SafeTalk SMS Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Webhook endpoint: /webhook/sms`);
});

export default app;