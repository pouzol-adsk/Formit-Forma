import { useEffect, useState } from "react";
import fetchResultObj from "../common/interfaces";
import FormaService from "../services/forma.service";
import ProjectList from "./projects/project-list.component";
import Project from "./projects/project"
import Proposal from "./proposals/proposal"
import FormItFormaService from "../services/formit-forma.service";
import { retrieveProposalElements } from "../helpers/saveUtils"
import useLoadConceptualWebWorker from "../helpers/useLoadConceptualWebWorker"
import { setGlobalState, useGlobalState } from "../helpers/stateUtils"
import { MAIN_HISTORY_ID } from "../helpers/typesAndConstants";
import { WeaveSelect, WeaveSelectOption } from "./hub-selector/FormaComponents";
import SelectedProposal from "./proposals/selected-proposal.component";

function FormItForma() {  
  function handleFetchValues(fetchFunction: Promise<any>, handleResults: (value: any) => any | null | undefined)  {
    fetchFunction
      .then(handleResults)
      .catch(error => console.log(error));
  }

  function handleWorkspacesFetchedValues(results: any) {
    try {
      let haveValues = results !== null && (results as Array<any>).length > 0;
      if(haveValues)
      {
        let workspaces = results.map((e: any) => {
          var filledObj = new fetchResultObj();
          filledObj.Fill(e.id, e.name, e.version, e.metadata, e.urn);
          return filledObj;
        });
        setWorkspaces(workspaces);

        if(workspaces.length > 0)
        {
          // only for very first call, do not fill the project and proposal again or it may override the currently selected workspace's.
          // it'll be handled on handleWorkspaceSelectChange
          if(!workspaceId)
          {
            setCurrentWorkspace(workspaces[0].id);
            fillWorkspaceProjects(workspaces[0].id);
          }
          else {
            fillWorkspaceProjects(workspaceId);
          }
        }
      }
    } catch (error) {
      const errorTxt = "Unable to read workspaces";
      FormIt.UI.ShowNotification(errorTxt, FormIt.NotificationType.Error, 5000);
      throw new Error(errorTxt);
    }
  }
  
  async function handleProjectsFetchedValues(results: any) {
    try {
      let projectsResults = results
        .filter((e: any) => {
          return e.metadata !== null && !e.metadata.isDraft && e.version !== 1
        })
        .map((e: any) => {
          var filledObj = new Project()
          filledObj.Fill(e.id, e.name, e.version, e.metadata);
          let nowTime = new Date().getTime();
          let creationTimeDiff = nowTime - e.created;
          let dayCount = Math.floor(creationTimeDiff / (1000*24*60*60));
          filledObj.createdSince = dayCount;
          filledObj.creationTime = dayCount == 0 ? `Today` : `${dayCount} days ago`;
          return filledObj;
        })
        .sort((a,b) => (a.createdSince > b.createdSince) ? 1 : ((b.createdSince > a.createdSince) ? -1 : 0));

      await fillProposals(projectsResults);
    } catch (error) {
      const errorTxt = "Unable to read projects from selected workspace";
      FormIt.UI.ShowNotification(errorTxt, FormIt.NotificationType.Error, 5000);
      throw new Error(errorTxt);
    }
  }

  async function fillProposals(projectsResults) {
    try {
      for(const project of projectsResults) {
        await FormaService.getProposals(project.projectId)
          .then( (proposals) => {
            project.proposals = proposals.map((e: any) => {
              var proposalEntry = new Proposal()
              const split = e.urn.split(":");
              let id = split[split.length - 2];
              let revision = split[split.length - 1];
              let name = e.properties.name;
              proposalEntry.Fill(id, name, revision, e.metadata, e.urn);
              let creationDate = new Date(e.metadata.createdAt);              
              let hour = creationDate.getHours();
              let minutes = creationDate.getMinutes();
              if(creationDate.getDate() === new Date().getDate())
              {
                proposalEntry.creationDate = `Today ${hour}:${minutes} ${hour < 12 ? "AM" : "PM"}`;
              }
              else
              {
                proposalEntry.creationDate = `${creationDate.toLocaleString()}`;
              }
              proposalEntry.projectId = project.projectId;
              
              if(proposal)
              {
                if(proposal.id === proposalEntry.id)
                {
                  // currently selected proposal match this entry. 
                  // should be updated to get last urn with revision
                  setCurrentProposal(proposalEntry);
                }
              }
                            
              return proposalEntry;
            });
            project.proposals.sort(function(proposalA,proposalB){
              return new Date(proposalA.metadata.createdAt).getTime() - new Date(proposalB.metadata.createdAt).getTime();
            });
            if(project.proposals.length > 0)
            {
              project.newestProposalId = project.proposals[0].id;
              project.urn = project.proposals[0].urn;
              project.proposalCount = project.proposals.length;
            }
            project.proposalsListContainer = `project-${project.projectId}-proposals-list`
          });
        }
        setProjects(projectsResults);
        hideShowLoading(false);
    } catch (error) {
      const errorTxt = "Unable to read proposals from projects";
      FormIt.UI.ShowNotification(errorTxt, FormIt.NotificationType.Error, 5000);
      throw new Error(errorTxt);
    }
  }

  function fillWorkspaceProjects(workspaceId) {
    hideShowLoading(true, "Retrieving workspaces from Forma...");

    handleFetchValues(FormaService.getProjects(workspaceId), 
      handleProjectsFetchedValues.bind(this));
  }

  function handleWorkspaceSelectClick() {
    if(!project) {
      handleFetchValues(FormaService.getWorkspaces(), 
        handleWorkspacesFetchedValues.bind(this));
    }
  }

  function handleWorkspaceSelectChange()  {
    let workspaceSelect = (document.getElementById("workspace-select")) as HTMLSelectElement;
    if(workspaceSelect !== null)
    {
      setCurrentWorkspace(workspaceSelect.value);
      fillWorkspaceProjects(workspaceSelect.value);
    }
  }

  async function setSelectedProjectId(newProjectId) {
    if(project !== null && project?.projectId === newProjectId) {
      setCurrentProject(null);
      setCurrentProposal(null);
    }
    else {
      let matchingProject = projects?.filter((e: any) => {
        return e.projectId == newProjectId;
      });
      if(matchingProject !== null) {
        setCurrentProject(matchingProject[0]);
      }
      else {
        setCurrentProject(null);
      }
    }
  }

  async function setSelectedProposalId(newProposalId, fromBackAction) {
    if(fromBackAction) {      
      hideShowSelected(false);
    }
    else {
      if(project !== null) {
        let matchingProposal = project.proposals.filter((e: any) => {
          return e.proposalId == newProposalId;
        });
        if(matchingProposal !== null && matchingProposal.length > 0) {
          setCurrentProposal(matchingProposal[0]);

          retrieveProposalElements(project.projectId, matchingProposal[0].proposalId)
            .then((proposalElement) => {
              elementResponseMap[proposalElement.urn] = proposalElement
            });

          hideShowSelected(true);
        }
        else {
          setCurrentProposal(null);
        }
      }
      else {
        setCurrentProposal(null);
      }
    }

    if(newProposalId) {
      updateButtonsState(newProposalId);
    }
  }

  function hideShowSelected(showProposal) {
    let projectListContainer = document.getElementById("projectList");
    let selectedProposalContainer = document.getElementById("selectedProposal");
    if(showProposal) {
      projectListContainer.style.display = "none";
      selectedProposalContainer.style.display = "flex";
    }
    else {
      projectListContainer.style.display = "flex";
      selectedProposalContainer.style.display = "none";
    }
  }

  async function updateButtonsState(proposalId) {
    const idsProvided = project !== null && project?.projectId !== "" && proposalId !== "";
    let syncButton = document.getElementById("sync-btn");
    let loadButton = document.getElementById("load-btn");

    if(syncButton !== null)
    {
      let button = (syncButton as HTMLButtonElement);
      if(button)
      {
        let disabled = fetchedProposalId != proposalId;
        button.disabled = disabled;
        // sync button is not disabled, but hidden
        if(!disabled)
        {
          button.classList.remove('hidden');
        }
        else if(!button.classList.contains('hidden'))
        {
          button.classList.add('hidden');
        }
      }
    }   
    
    if(loadButton !== null)
    {
      let button = (loadButton as HTMLButtonElement);
      if(button)
      {
        let disabled = !idsProvided || (fetchedProposalId == proposalId);
        button.disabled = disabled;
        if(!disabled)
        {
          button.classList.remove('disabled');
        }
        else if(!button.classList.contains('disabled'))
        {
          button.classList.add('disabled');
        }
      }
    }   
  }
  
  function hideShowLoading(show, message = "") {
    setWorkingMessage(message)

    let loadContainer = document.getElementById("working-container");
    let plugContainer = document.getElementById("plugin-container");
    let proposalContainer = document.getElementById("selectedProposal");
    let hubSelector = document.getElementById("hubSelectorContainer");
    if(show) {
      // hide possibly displayed empty container
      let emptyContainer = document.getElementById("empty-list");
      if(emptyContainer)
      {
        emptyContainer.style.display = "none";
      }
      loadContainer.style.display = "flex";
      plugContainer.classList.add('disabled');
      proposalContainer.classList.add('disabled');
      hubSelector.classList.add('disabled');
    }
    else {
      loadContainer.style.display = "none";
      plugContainer.classList.remove('disabled');
      proposalContainer.classList.remove('disabled');
      hubSelector.classList.remove('disabled');
    }
  }

  async function onLoadClick() {
    hideShowLoading(true, "Fetching from Forma...");

    // to be reactived if we want to offer possibility to save current edits locally
    // let hasSomethingToSave = await FormIt.Model.IsModified();
    // if(hasSomethingToSave)
    // {
    //   // start new sketch, to prevent opening several project at once
    //   FormIt.NewFile();
    //   hasSomethingToSave = await FormIt.Model.IsModified();
    //   if(hasSomethingToSave)
    //   {
    //     // user has cancelled or new file has failed, cancel loading and display an error
    //     setMessageType("info");
    //     setMessage("Loading cancelled");
    //     container.classList.remove('disabled');
    //     return;
    //   }
    // }
    
    FormIt.NewFile(true);

    useLoadConceptualWebWorker(proposal.projectId, proposal.proposalId);

    FormItFormaService.fetchAndLoadElements(
      [],
      proposal,
      async (proposalId, elementResponseMap, loadedIntegrateElements) => {
        hideShowLoading(false);
        
        let type = proposalId ? FormIt.NotificationType.Success : FormIt.NotificationType.Error;
        let message = proposalId ? "Datas have been loaded from Forma" : "Loading failed";

        FormIt.UI.ShowNotification(message, type, 5000);

        setGlobalState("elements", elementResponseMap);
        setGlobalState("loadedIntegrate", loadedIntegrateElements);

        setSync(false);

        if(proposalId)
        {
          FormIt.View.FitToSelection();

          debugger
          
          let message = `Successfully fetched data from Forma.`;
          FormIt.UI.ShowNotification(message, FormIt.NotificationType.Success, 5000);

          const delay = ms => new Promise(res => setTimeout(res, ms));
          const displayOSM = async () => {
            await delay(5000);
            // display open streetmap attribution
            message = `Map data from OpenStreetMap® 2023-03-09T13:48:28.962000Z.
            https://www.openstreetmap.org/copyright`;
            FormIt.UI.ShowNotification(message, FormIt.NotificationType.Information, 5000);
          };
          displayOSM();
          setFetch(proposalId);
          
          const currentDelta = await WSM.APIGetIdOfActiveDeltaReadOnly(MAIN_HISTORY_ID);
          setInitialDelta(currentDelta);
        }
        else
        {
          let message = `Fetched data from Forma failed.`;
          FormIt.UI.ShowNotification(message, FormIt.NotificationType.Error, 5000);
        }
      }
    );
  }

  function onBackClick() {
    setSelectedProposalId(proposal.id, true);
  }

  function onRefreshHubsClick() {
    handleFetchValues(FormaService.getWorkspaces(), 
      handleWorkspacesFetchedValues.bind(this));
  }

  function onSyncClick() {
    let container = document.getElementById("projectlist-container");
    container.classList.add('disabled');
    let projectId = project.projectId;
    hideShowLoading(true, "Sending datas to Forma...");

    // updated current elementResponseMap before syncing to forma, to ensure we have the last revisions in the urn
    retrieveProposalElements(project.projectId, proposal.id)
      .then((proposalElement) => {
        elementResponseMap[proposalElement.urn] = proposalElement;
        proposal.urn = proposalElement.urn;
      })
      .then(() => {
        FormItFormaService.save(
          {
            projectId,
            proposal,
            elementResponseMap,
            terrainElevationTransf3d,
            loadedIntegrateElements
          }, 
          (result) => {
            setSync(true);
            if(result && (typeof result === 'string' || result instanceof String))
            {
              FormIt.UI.ShowNotification(`Synchronization failed: ${result}`, FormIt.NotificationType.Error, 5000);
            }
            else
            {
              let type = result ? FormIt.NotificationType.Success : FormIt.NotificationType.Error;
              let message = result ? "Datas have been synchronized successfully on Forma" : "Synchronization failed";
      
              FormIt.UI.ShowNotification(message, type, 5000);
            }
            container.classList.remove('disabled');
            hideShowLoading(false);
          }
        );
      })
  }

  async function updateNewContent() {
    let newContent = document.getElementById("lblNewContent");
    const currentDelta = await WSM.APIGetIdOfActiveDeltaReadOnly(MAIN_HISTORY_ID);
    if(newContent && currentDelta != WSM.INVALID_ID) {
      if(initialDeltaId === -1) {
        // once terrain will be fully loaded, delta will increase by two
        setInitialDelta(currentDelta + 2);
        let refreshId = setInterval(updateNewContent,  5000);
        if(refreshIntervalId === -1) {
          setRefreshIntervalId(refreshId);
        }
      }
      else
      {
        const contentAdded = initialDeltaId < currentDelta;
        if(contentAdded) {
          clearInterval(refreshIntervalId);
          newContent.classList.remove('hidden');
        }
        else
        {
          newContent.classList.add('hidden');
        }
      }
    }
    else
    {
      if(newContent) {
        newContent.classList.add('hidden');
      }
    }
  }

  // workspaces
  const [workspaces, setWorkspaces] = useState<fetchResultObj[]>()
  const [workspaceId, setCurrentWorkspace] = useState<string>(null)
  // projects
  const [project, setCurrentProject] = useState<Project>(null)
  const [projects, setProjects] = useState<Project[]>()
  // proposals
  const [proposal, setCurrentProposal] = useState<Proposal>(null)
  // elements
  const [fetchedProposalId, setFetch] = useState<string>("")
  const [synced, setSync] = useState(false)

  const [workingMessage, setWorkingMessage] = useState<string>()
  const [initialDeltaId, setInitialDelta] = useState<number>(-1)
  const [refreshIntervalId, setRefreshIntervalId] = useState<number>(-1)

  const [elementResponseMap] = useGlobalState("elements");
  const [loadedIntegrateElements] = useGlobalState("loadedIntegrate");
  const [terrainElevationTransf3d] = useGlobalState("terrainElevationTransf3d");
  
  useEffect(() => {
    // on start, disable the button. 
    // this must be done here, as adding disabled to the default return will prevent binding onSyncClick
    let syncButton = document.getElementById("sync-btn");
    if(syncButton !== null)
    {
      (syncButton as HTMLButtonElement).disabled = true;
    }   
    let loadButton = document.getElementById("load-btn");
    if(loadButton !== null)
    {
      (loadButton as HTMLButtonElement).disabled = true;
    }  
  }, [])
  
  if(!workspaceId)  {
    handleFetchValues(FormaService.getWorkspaces(), 
      handleWorkspacesFetchedValues.bind(this));
  }

  //updateNewContent();

  // get workspaces from API
  useEffect(() => {
    updateButtonsState(proposal?.id);
  }, [fetchedProposalId])

	return (
    <div id="FormaControls" className="col-md-12">
      <div id="working-container" className="hidden">
          <img id="working-screen"
              src="assets/favicon.svg" 
              width="115" height="115">
          </img>
          <label>{workingMessage}</label>
        </div>
      <div id="projectList" className="col-md-12">
        <div id="hubSelectorContainer" className="col-md-12">
          <label>Select a hub:</label>
          <div id="hubSelect" className="col-md-12">
            <WeaveSelect 
              id="workspace-select"
              value={workspaces && workspaces.length > 0 ? workspaces[0].id : ""}
              class="fetchSelect"
              onChange={handleWorkspaceSelectChange.bind(this)}>
              { 
                workspaces?.map(({ id, name }) => (
                  <WeaveSelectOption 
                  value={id} 
                  key={id}
                  selected={workspaces[0].id == id}
                  class="fetchSelectOption">
                  {name}</WeaveSelectOption>
                ))
              }
            </WeaveSelect>
            <img id="refresh-btn"
                onClick={onRefreshHubsClick.bind(this)}>
            </img>
          </div>
        </div>
        <div id="plugin-container" className="plugin">
          <div id="plugin-content">
            <ProjectList 
              projects={projects}
              projectSelectionHandler={setSelectedProjectId}
              proposalSelectionHandler={setSelectedProposalId}
              selectedProjectId={project?.projectId}
              selectedProposalId={proposal?.proposalId}>
            </ProjectList>
          </div>
        </div>
      </div>

      <div id="selectedProposal" className="col-md-12">
        <SelectedProposal 
          proposal={proposal}
          project={project}
          selectedProposalId={proposal?.proposalId}
          fetchSelectionHandler={onLoadClick}
          syncSelectionHandler={onSyncClick}
          backHandler={onBackClick}>
        </SelectedProposal>
      </div>
    </div>
	);
}

export default FormItForma