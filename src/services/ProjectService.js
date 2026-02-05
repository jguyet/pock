const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { v4: uuidv4 } = require('uuid');

/**
 * ProjectService - Service to manage projects
 * 
 * Features:
 * - Create, read, update, delete projects
 * - Each project has a unique ID
 * - Projects stored in projects.json
 * - Project files stored in projects/<id>/
 */
class ProjectService {
  static PROJECTS_FILE = path.join(__dirname, '../../projects.json');
  static PROJECTS_DIR = path.join(__dirname, '../../projects');
  static EXAMPLE_STRUCT_REPO = 'https://github.com/jguyet/example-struct.git';

  /**
   * Initialize projects.json if it doesn't exist
   */
  static ensureProjectsFile() {
    if (!fs.existsSync(this.PROJECTS_FILE)) {
      fs.writeFileSync(this.PROJECTS_FILE, JSON.stringify({ projects: [] }, null, 2));
    }
    
    if (!fs.existsSync(this.PROJECTS_DIR)) {
      fs.mkdirSync(this.PROJECTS_DIR, { recursive: true });
    }
  }

  /**
   * Get all projects
   * 
   * @returns {Array} List of projects
   */
  static getAllProjects() {
    this.ensureProjectsFile();
    
    try {
      const data = fs.readFileSync(this.PROJECTS_FILE, 'utf8');
      return JSON.parse(data).projects;
    } catch (error) {
      console.error('[ProjectService] Error reading projects:', error);
      return [];
    }
  }

  /**
   * Get project by ID
   * 
   * @param {string} id - Project ID
   * @returns {Object|null} Project or null
   */
  static getProjectById(id) {
    const projects = this.getAllProjects();
    return projects.find(p => p.id === id) || null;
  }

  /**
   * Get project folder path
   * 
   * @param {string} id - Project ID
   * @returns {string} Project folder path
   */
  static getProjectFolder(id) {
    return path.join(this.PROJECTS_DIR, id);
  }

  /**
   * Clone example-struct into project folder
   * 
   * @param {string} projectFolder - Path to project folder
   */
  static cloneExampleStruct(projectFolder) {
    console.log(`[ProjectService] Cloning example-struct into ${projectFolder}...`);
    
    try {
      // Create project folder
      if (!fs.existsSync(projectFolder)) {
        fs.mkdirSync(projectFolder, { recursive: true });
      }

      // Clone into temp directory
      execSync(`git clone ${this.EXAMPLE_STRUCT_REPO} "${path.join(projectFolder, 'example-struct')}"`, {
        stdio: 'inherit'
      });
      
      console.log(`[ProjectService] Successfully cloned example-struct`);
    } catch (error) {
      console.error(`[ProjectService] Error cloning:`, error.message);
    }
  }

  /**
   * Create a new project
   * 
   * @param {Object} data - Project data (title, description)
   * @returns {Object} Created project
   */
  static createProject(data) {
    this.ensureProjectsFile();
    
    const project = {
      id: uuidv4(),
      title: data.title || 'Untitled Project',
      description: data.description || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Create project folder
    const projectFolder = this.getProjectFolder(project.id);
    fs.mkdirSync(projectFolder, { recursive: true });
    
    // Clone example-struct
    this.cloneExampleStruct(projectFolder);
    
    // Create chat.json
    const chatFile = path.join(projectFolder, 'chat.json');
    fs.writeFileSync(chatFile, JSON.stringify({ messages: [] }, null, 2));
    
    // Save project to projects.json
    const projectsData = JSON.parse(fs.readFileSync(this.PROJECTS_FILE, 'utf8'));
    projectsData.projects.push(project);
    fs.writeFileSync(this.PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
    
    console.log(`[ProjectService] Created project: ${project.id} - ${project.title}`);
    
    return project;
  }

  /**
   * Update a project
   * 
   * @param {string} id - Project ID
   * @param {Object} data - Update data
   * @returns {Object|null} Updated project or null
   */
  static updateProject(id, data) {
    this.ensureProjectsFile();
    
    const projectsData = JSON.parse(fs.readFileSync(this.PROJECTS_FILE, 'utf8'));
    const projectIndex = projectsData.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return null;
    }
    
    projectsData.projects[projectIndex] = {
      ...projectsData.projects[projectIndex],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(this.PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
    
    return projectsData.projects[projectIndex];
  }

  /**
   * Delete a project
   * 
   * @param {string} id - Project ID
   * @returns {boolean} Success
   */
  static deleteProject(id) {
    this.ensureProjectsFile();
    
    const projectsData = JSON.parse(fs.readFileSync(this.PROJECTS_FILE, 'utf8'));
    const projectIndex = projectsData.projects.findIndex(p => p.id === id);
    
    if (projectIndex === -1) {
      return false;
    }
    
    // Remove from projects.json
    projectsData.projects.splice(projectIndex, 1);
    fs.writeFileSync(this.PROJECTS_FILE, JSON.stringify(projectsData, null, 2));
    
    // Delete project folder
    const projectFolder = this.getProjectFolder(id);
    if (fs.existsSync(projectFolder)) {
      execSync(`rm -rf "${projectFolder}"`, {
        stdio: 'inherit'
      });
    }
    
    console.log(`[ProjectService] Deleted project: ${id}`);
    
    return true;
  }
}

module.exports = ProjectService;

