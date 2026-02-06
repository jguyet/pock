const express = require('express');
const ProjectService = require('../services/ProjectService');

const router = express.Router();

/**
 * GET /api/projects
 * Get all projects
 */
router.get('/', (req, res) => {
  try {
    const projects = ProjectService.getAllProjects();
    res.json({ success: true, projects });
  } catch (error) {
    console.error('Error getting projects:', error);
    res.status(500).json({ error: 'Error getting projects' });
  }
});

/**
 * GET /api/projects/:id
 * Get project by ID
 */
router.get('/:id', (req, res) => {
  try {
    const project = ProjectService.getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error getting project:', error);
    res.status(500).json({ error: 'Error getting project' });
  }
});

/**
 * POST /api/projects
 * Create new project
 */
router.post('/', (req, res) => {
  try {
    const { title, description } = req.body;
    
    const project = ProjectService.createProject({
      title,
      description
    });
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Error creating project' });
  }
});

/**
 * PUT /api/projects/:id
 * Update project
 */
router.put('/:id', (req, res) => {
  try {
    const { title, description } = req.body;
    
    const project = ProjectService.updateProject(req.params.id, {
      title,
      description
    });
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Error updating project' });
  }
});

/**
 * POST /api/projects/:id/pause
 * Toggle pause status for project
 */
router.post('/:id/pause', (req, res) => {
  try {
    const project = ProjectService.getProjectById(req.params.id);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Toggle pause status
    const newPausedState = !project.paused;
    const updatedProject = ProjectService.updateProject(req.params.id, {
      paused: newPausedState
    });
    
    res.json({ success: true, project: updatedProject, paused: newPausedState });
  } catch (error) {
    console.error('Error toggling pause:', error);
    res.status(500).json({ error: 'Error toggling pause' });
  }
});

/**
 * DELETE /api/projects/:id
 * Delete project
 */
router.delete('/:id', (req, res) => {
  try {
    const success = ProjectService.deleteProject(req.params.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Error deleting project' });
  }
});

module.exports = router;

