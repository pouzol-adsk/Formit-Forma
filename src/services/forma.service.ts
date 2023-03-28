
import { ElementResponse } from "@spacemakerai/element-types"

const API_URL = 'https://local.spacemaker.ai:3001';
const SPACEMAKER_URL = 'https://app.spacemaker.ai';

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
  
  countProposals(projectId: string) {
    return fetch(`${API_URL}/api/proposal/elements/count?authcontext=${projectId}`)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    });
  }

  
  getProposals(projectId: string) {
    return fetch(`${API_URL}/api/proposal/elements?authcontext=${projectId}&version=2`)
    .then(res => {
      if (!res.ok) {
        throw new Error(res.statusText);
      }
      return res.json();
    });
  }
  
  getProposalElement(
    elementId: string,
    authContext: string,
  ): Promise<ElementResponse | null> {
    try {
      const url = `/api/proposal/elements/${elementId}?authcontext=${authContext}`;
      return fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error(res.statusText);
        }
        return res.json();
      });
    } catch (error) {
      return null;
    }
  }

  FormatThumbnailUrl(projectId: string, urn: string) {
    return `${SPACEMAKER_URL}/api/thumbnails/v2/${urn}?size=170&authcontext=${projectId}&projectId=${projectId}`;
  }

  fetchRawDatas(url: string) {
    if(url.indexOf('/') === 0)
    {
      url = `${API_URL}${url}`
    }
    return fetch(url, {
      
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "true",
      },
    })
  }

  getAsJson(url: string) {
    if(url.indexOf('/') === 0)
    {
      url = `${API_URL}${url}`
    }
    return fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": "true",
      },
    })
    .then(res => {
      if (res.ok) {
        return res.json()
      }
      return false
    });
  }
}

export default new FormaService();
