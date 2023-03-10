const API_URL = 'https://local.spacemaker.ai:3001';

class FormaService {
  getWorkspaces() {
    return fetch(`${API_URL}/api/workspaces`)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    });
  }

  getProjects(customerId: string) {
    return fetch(`${API_URL}/api/projects?customer=${customerId}&include_archived=false`)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    });
  }
  
  getProposals(projectId: string) {
    //return fetch(`${API_URL}/api/library/v1/projects/${projectId}/proposals?&exclude=geometries&limit=15`)
    return fetch(`${API_URL}/api/proposal/elements?authcontext=${projectId}&version=2`)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    });
  }
}

export default new FormaService();
