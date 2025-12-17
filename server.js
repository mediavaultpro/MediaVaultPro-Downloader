const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'MediaVault Pro API is running!',
        version: '1.0.0',
        endpoints: {
            health: 'GET /health',
            info: 'POST /api/info',
            download: 'GET /api/download',
            audio: 'GET /api/audio'
        }
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get video information
app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        
        console.log('Fetching info for:', url);
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid YouTube URL' 
            });
        }
        
        const info = await ytdl.getInfo(url);
        
        // Get available formats
        const formats = info.formats
            .filter(format => format.hasVideo && format.hasAudio)
            .map(format => ({
                quality: format.qualityLabel || 'Unknown',
                itag: format.itag,
                container: format.container,
                codecs: format.codecs,
                size: format.contentLength 
                    ? (parseInt(format.contentLength) / (1024 * 1024)).toFixed(2) + ' MB' 
                    : 'Unknown size'
            }))
            .slice(0, 5);
        
        const videoDetails = {
            success: true,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            thumbnail: info.videoDetails.thumbnails[info.videoDetails.thumbnails.length - 1].url,
            author: info.videoDetails.author.name,
            videoId: info.videoDetails.videoId,
            description: info.videoDetails.description?.substring(0, 200) || '',
            viewCount: info.videoDetails.viewCount || '0',
            formats: formats
        };
        
        res.json(videoDetails);
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch video information',
            message: error.message 
        });
    }
});

// Download video
app.get('/api/download', async (req, res) => {
    try {
        const { url, itag } = req.query;
        
        console.log('Download request:', { url, itag });
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid YouTube URL' 
            });
        }
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, '_');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');
        
        const options = itag 
            ? { quality: parseInt(itag) }
            : { quality: 'highest', filter: 'audioandvideo' };
        
        console.log('Streaming with options:', options);
        
        ytdl(url, options)
            .on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ 
                        success: false,
                        error: 'Download failed' 
                    });
                }
            })
            .pipe(res);
            
    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Download failed',
                message: error.message 
            });
        }
    }
});

// Download audio only
app.get('/api/audio', async (req, res) => {
    try {
        const { url, quality = '128' } = req.query;
        
        console.log('Audio extraction request:', { url, quality });
        
        if (!url || !ytdl.validateURL(url)) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid YouTube URL' 
            });
        }
        
        const info = await ytdl.getInfo(url);
        const title = info.videoDetails.title
            .replace(/[^\w\s]/gi, '')
            .replace(/\s+/g, '_');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');
        
        ytdl(url, { 
            quality: 'highestaudio',
            filter: 'audioonly'
        })
        .on('error', (err) => {
            console.error('Audio stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ 
                    success: false,
                    error: 'Audio extraction failed' 
                });
            }
        })
        .pipe(res);
        
    } catch (error) {
        console.error('Audio extraction error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Audio extraction failed',
                message: error.message 
            });
        }
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ MediaVault Pro server running on port ${PORT}`);
    console.log(`🌐 API endpoints ready at http://localhost:${PORT}`);
    console.log(`📅 Started at: ${new Date().toISOString()}`);
});
