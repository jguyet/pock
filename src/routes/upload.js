const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const ChatService = require('../services/ChatService');

const router = express.Router();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const projectId = req.body.projectId;
    if (!projectId) {
      return cb(new Error('Project ID required'));
    }
    
    const projectFolder = ChatService.getProjectFolder(projectId);
    const resourcesFolder = path.join(projectFolder, 'resources');
    
    // Create resources folder if it doesn't exist
    if (!fs.existsSync(resourcesFolder)) {
      fs.mkdirSync(resourcesFolder, { recursive: true });
    }
    
    cb(null, resourcesFolder);
  },
  filename: function (req, file, cb) {
    // Keep original filename
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

/**
 * POST /api/upload
 * Upload files to project resources folder
 */
router.post('/', upload.array('files', 50), (req, res) => {
  try {
    const projectId = req.body.projectId;
    
    if (!projectId) {
      return res.status(400).json({ error: 'Project ID required' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = req.files.map(file => ({
      originalName: file.originalname,
      filename: file.filename,
      size: file.size,
      path: `resources/${file.filename}`
    }));
    
    res.json({ 
      success: true, 
      files: uploadedFiles 
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({ error: 'Error uploading files: ' + error.message });
  }
});

module.exports = router;

