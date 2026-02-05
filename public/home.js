const API_URL = 'http://localhost:8081/api';

// Load projects on page load
document.addEventListener('DOMContentLoaded', () => {
  loadProjects();
});

// Load all projects
async function loadProjects() {
  try {
    const response = await fetch(`${API_URL}/projects`);
    const data = await response.json();

    if (data.success && data.projects.length > 0) {
      renderProjects(data.projects);
      document.getElementById('empty-state').style.display = 'none';
      document.getElementById('projects-grid').style.display = 'grid';
    } else {
      document.getElementById('empty-state').style.display = 'block';
      document.getElementById('projects-grid').style.display = 'none';
    }
  } catch (error) {
    console.error('Error loading projects:', error);
    alert('Erreur lors du chargement des projets');
  }
}

// Render projects grid
function renderProjects(projects) {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '';

  projects.forEach(project => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = (e) => {
      // Don't navigate if clicking delete button
      if (!e.target.classList.contains('btn-delete')) {
        openProject(project.id);
      }
    };

    const createdDate = new Date(project.createdAt).toLocaleDateString('fr-FR');
    const updatedDate = new Date(project.updatedAt).toLocaleDateString('fr-FR');

    card.innerHTML = `
      <div class="project-card-header">
        <h3 class="project-title">${escapeHtml(project.title)}</h3>
        <div class="project-actions">
          <button class="btn-delete" onclick="deleteProject(event, '${project.id}')" title="Supprimer">🗑️</button>
        </div>
      </div>
      ${project.description ? `<div class="project-description">${escapeHtml(project.description)}</div>` : ''}
      <div class="project-meta">
        <span>Créé: ${createdDate}</span>
        <span>Modifié: ${updatedDate}</span>
      </div>
    `;

    grid.appendChild(card);
  });
}

// Open project chat page
function openProject(projectId) {
  window.location.href = `/project/${projectId}`;
}

// Open new project modal
function openNewProjectModal() {
  document.getElementById('new-project-modal').classList.add('active');
  document.getElementById('project-title').focus();
}

// Close new project modal
function closeNewProjectModal() {
  document.getElementById('new-project-modal').classList.remove('active');
  document.getElementById('new-project-form').reset();
}

// Create new project
async function createProject(event) {
  event.preventDefault();

  const title = document.getElementById('project-title').value.trim();
  const description = document.getElementById('project-description').value.trim();

  if (!title) {
    alert('Le titre est requis');
    return;
  }

  try {
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description })
    });

    const data = await response.json();

    if (data.success) {
      closeNewProjectModal();
      // Navigate to the new project
      window.location.href = `/project/${data.project.id}`;
    } else {
      alert('Erreur lors de la création du projet');
    }
  } catch (error) {
    console.error('Error creating project:', error);
    alert('Erreur lors de la création du projet');
  }
}

// Delete project
async function deleteProject(event, projectId) {
  event.stopPropagation();

  if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) {
    return;
  }

  try {
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      loadProjects();
    } else {
      alert('Erreur lors de la suppression du projet');
    }
  } catch (error) {
    console.error('Error deleting project:', error);
    alert('Erreur lors de la suppression du projet');
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeNewProjectModal();
  }
});

// Close modal on backdrop click
document.getElementById('new-project-modal').addEventListener('click', (e) => {
  if (e.target.id === 'new-project-modal') {
    closeNewProjectModal();
  }
});

