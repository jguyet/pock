const express = require('express');
const fs = require('fs');

const router = express.Router();

/**
 * POST /api/project-folder
 * Get or create project folder
 */
router.post('/', (req, res) => {
  try {
    const { folder } = req.body;
    
    if (!folder) {
      return res.status(400).json({ error: 'Folder path required' });
    }
    
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
    
    res.json({ success: true, folder, exists: true });
  } catch (error) {
    res.status(500).json({ error: 'Error creating folder' });
  }
});

module.exports = router;

