// Main website endpoint for Vercel serverless function
import { readFileSync } from 'fs';
import { join } from 'path';

export default function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Serve the main HTML file
    const htmlPath = join(process.cwd(), 'public', 'index.html');
    const html = readFileSync(htmlPath, 'utf8');
    
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  } catch (error) {
    console.error('Error serving index:', error);
    res.status(500).json({ error: 'Failed to load page' });
  }
}