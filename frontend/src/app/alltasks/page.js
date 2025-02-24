"use client";

import { useEffect, useState, useRef, forwardRef, useCallback } from "react";
import io from "socket.io-client"; // ✅ Import WebSocket client



// import { useQuery } from 'react-query';
import { debounce } from 'lodash';
import { useParams, useRouter, usePathname } from "next/navigation"; // ✅ Navigation imports
import { useDraggable } from "react-use-draggable-scroll";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  BookmarkIcon,
  XMarkIcon,  // ✅ Add this icon
} from "@heroicons/react/24/solid";
import Card from "@/components/Card";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import '../styles/custom.css';
//import { useSession } from "next-auth/react"; // what is this for?

const socket = io("http://127.0.0.1:5000"); // ✅ Connect to WebSocket server

export default function AllTasks() {
  const [selectedTask, setSelectedTask] = useState(null); // ✅ Tracks currently selected task
  const [tasks, setTasks] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [taskStatus, setTaskStatus] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [darkMode, setDarkMode] = useState(true);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    project: "",
    taskType: "",
    status: "",
  });
  const [selectedProjectId, setSelectedProjectId] = useState("");  // ✅ Track default project
  const [isModalOpen, setIsModalOpen] = useState(false);
  

  // ✅ Fetch Contributors based on whether a project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      console.log("🔄 Fetching all contributors...");
      fetch("http://127.0.0.1:5000/api/contributors") // ✅ Updated API now includes projects array
        .then((res) => res.json())
        .then((data) => {
          if (!Array.isArray(data)) {
            console.error("❌ Contributors API response is not an array!", data);
            return;
          }

          // 🔹 Ensure `projects` is always an array
          const cleanedData = data.map((c) => ({
            ...c,
            projects: Array.isArray(c.projects) ? c.projects : [], // Normalize `projects`
          }));

          console.log("✅ Global Contributors loaded:", cleanedData);
          setContributors(cleanedData);
        })
        .catch((error) =>
          console.error("❌ Error fetching global contributors:", error)
        );
    } else {
      console.log(`🔄 Fetching contributors for project ID ${selectedProjectId}...`);
      fetch(`http://127.0.0.1:5000/api/projects/${selectedProjectId}/contributors/manage`)
        .then((res) => res.json())
        .then((data) => {
          if (!Array.isArray(data)) {
            console.error("❌ Project Contributors API response is not an array!", data);
            return;
          }

          console.log(`✅ Contributors for project ${selectedProjectId} loaded:`, data);

          // ✅ Ensure contributors have `is_in_project` properly flagged
          const updatedData = data.map((c) => ({
            ...c,
            is_in_project: c.is_in_project ?? true, // Assume true since they are fetched for this project
          }));

          setContributors(updatedData);
        })
        .catch((error) =>
          console.error(`❌ Error fetching contributors for project ${selectedProjectId}:`, error)
        );
    }
  }, [selectedProjectId]); // ✅ Re-run when selectedProjectId changes

  // ✅ WebSocket: Listen for contributor updates
  useEffect(() => {
    socket.on("update_contributors", (updatedContributor) => {
      console.log("📡 WebSocket Update: Contributor Changed!", updatedContributor);

      setContributors((prevContributors) => {
        // Remove contributor if marked as removed
        if (updatedContributor.removed) {
          return prevContributors.filter((c) => c.id !== updatedContributor.id);
        }

        // Update existing contributor or add new one
        const existingIndex = prevContributors.findIndex((c) => c.id === updatedContributor.id);
        if (existingIndex !== -1) {
          prevContributors[existingIndex] = updatedContributor;
          return [...prevContributors]; // Trigger state update
        }
        return [...prevContributors, updatedContributor];
      });
    });

    return () => {
      socket.off("update_contributors"); // ✅ Cleanup listener
    };
  }, []);

  // ✅ WebSocket: Listen for task updates (Contributors assigned to tasks)
  useEffect(() => {
    socket.on("update_task", (updatedTask) => {
      console.log("📡 WebSocket Update: Task Contributor Changed!", updatedTask);

      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === updatedTask.taskId
            ? { ...task, contributor_id: updatedTask.contributor_id, contributor_name: updatedTask.contributor_name }
            : task
        )
      );
    });

    return () => {
      socket.off("update_task"); // ✅ Cleanup listener
    };
  }, []);

  // Automatically Refetch Contributors When Project Changes
  useEffect(() => {
    console.log(`📡 Selected project changed to: ${selectedProjectId}, refetching contributors...`);
  }, [selectedProjectId]);

  const handleContributorChange = async (taskId, newContributorId) => {
      console.log(`📌 handleContributorChange called with Task ID: ${taskId}, Contributor ID: ${newContributorId}`);

      try {
          // Fetch the current contributors of the task's project
          const task = tasks.find(t => t.id === taskId);
          if (!task) {
              console.error(`❌ Error: taskId is undefined!`, { taskId, newContributorId });
              return;
          }

          const projectId = task.project_id;

          // ✅ Fetch the current contributors of the task's project
          const contributorsResponse = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/contributors/manage`);
          let projectContributors = await contributorsResponse.json();

          // ✅ Ensure projectContributors is an array
          if (!Array.isArray(projectContributors)) {
              console.error("❌ Error: API response for contributors is not an array!", projectContributors);
              return;
          }

          console.log(`📡 Contributors in project ${projectId}:`, projectContributors);

          // 🔴 LOG ISSUE: Is the contributor already in the list?
          console.log(`🔍 Checking if Contributor ID ${newContributorId} is already in the project...`);

          // If contributor is NOT in the project, add them first
          if (!projectContributors.some(c => c.id === parseInt(newContributorId))) {
              console.log(`➕ Contributor ${newContributorId} is NOT in project ${projectId}, adding...`);

              await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/contributors/manage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ contributor_id: newContributorId }),
              });

              // Refetch the updated project contributors after adding
              const updatedContributorsRes = await fetch(`http://127.0.0.1:5000/api/projects/${projectId}/contributors/manage`);
              const updatedContributors = await updatedContributorsRes.json();  // ✅ Correct variable name
              console.log(`✅ Updated Contributors in project ${projectId}:`, updatedContributors);

              // ✅ Update UI with latest contributors list
              setContributors((prevContributors) => {
                const updatedSet = new Set(updatedContributors.map(c => c.id));
                return [
                    ...prevContributors.filter(c => !updatedSet.has(c.id)), // Keep old contributors not in the new list
                    ...updatedContributors.map((c) => ({
                        ...c,
                        is_in_project: c.is_in_project ?? false, // Ensure proper flagging
                    })),
                ];
            });
          }

          // 🔴 LOG ISSUE: Does the contributor exist in the state after update?
          console.log("🔍 Updated contributor state: ", contributors);

          // Now assign the contributor to the task
          const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contributor_id: newContributorId }),
          });

          if (!response.ok) throw new Error("Failed to assign contributor");

          const updatedTask = await response.json();
          console.log("✅ Contributor assigned successfully:", updatedTask);

          // ✅ Update the local tasks state
          setTasks((prevTasks) =>
              prevTasks.map((task) =>
                  task.id === taskId
                      ? { ...task, contributor_id: newContributorId, contributor_name: updatedTask.task.contributor_name }
                      : task
              )
          );

          // ✅ WebSocket: Notify all clients about the change
          socket.emit("update_task", {
              taskId,
              contributor_id: newContributorId,
              contributor_name: updatedTask.task.contributor_name,
          });

      } catch (error) {
          console.error("❌ Error assigning contributor:", error);
      }
  };

  // ✅ Debugging log for modal state changes
  useEffect(() => {
      if (isModalOpen) {
          console.log("🔄 isModalOpen changed:", isModalOpen);
      }
  }, [isModalOpen]);

  useEffect(() => {
    console.log("🛠️ Step 1: Fetching projects...");
    fetch("http://127.0.0.1:5000/api/projects")
      .then((response) => response.json())
      .then((projects) => {
        console.log("✅ Step 2: Projects loaded:", projects);
        setProjects(projects);
  
        // Find "Miscellaneous" project and set it as default
        const miscProject = (Array.isArray(projects) ? projects : []).find(p => p.name === "Miscellaneous");
        if (miscProject) {
          console.log("✅ Step 3: Defaulting to 'Miscellaneous' project", miscProject.id);
          setSelectedProjectId(miscProject.id);
        } else {
          console.warn("⚠️ 'Miscellaneous' project not found. Creating it...");
          // Create "Miscellaneous" project if it doesn't exist
          fetch("http://127.0.0.1:5000/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Miscellaneous" }),
          })
            .then((response) => response.json())
            .then((newProject) => {
              console.log("✅ Step 4: 'Miscellaneous' project created:", newProject);
              setSelectedProjectId(newProject.id);
              setProjects((prev) => [...prev, newProject]); // Add to state
            })
            .catch((error) => console.error("🚨 Step 5: Error creating 'Miscellaneous' project:", error));
        }
      })
      .catch((error) => console.error("🚨 Step 6: Error fetching projects:", error));
  }, []);

  // ✅ Ensure taskData updates when selectedProjectId changes
  const [taskData, setTaskData] = useState(selectedTask || {
      name: "",
      description: "",
      task_type: "User Story",
      priority: "Unset",
      status: "Not Started",
      project_id: "", // Ensure selectedProjectId is defined
  });


  useEffect(() => {
      if (selectedProjectId && !taskData.project_id) { // ✅ Only update if project_id is empty
          setTaskData((prev) => ({
              ...prev,
              project_id: selectedProjectId,
          }));
      }
  }, [selectedProjectId]); 

  useEffect(() => {
    console.log("Task Data:", taskData);
  }, [taskData]);

  // ✅ Updated createNewTask - Immediately saves task before opening modal
  const createNewTask = useCallback(async () => {
    console.log("🛠️ Step 5: createNewTask triggered - Saving task before opening modal...");

    // ✅ Ensure projects are loaded
    if (projects.length === 0) {
        console.warn("⚠️ Step 6a: No projects available, fetching projects...");
        try {
            const response = await fetch("http://127.0.0.1:5000/api/projects");
            const fetchedProjects = await response.json();
            setProjects(fetchedProjects);
        } catch (error) {
            console.error("🚨 Step 6b: Error fetching projects:", error);
            return;
        }
    }

    // ✅ Find or create the "Miscellaneous" project
    let miscProject = projects.find(p => p.name === "Miscellaneous");
    let defaultProjectId = miscProject ? miscProject.id : null;

    if (!defaultProjectId) {
        console.warn("⚠️ Step 7a: 'Miscellaneous' project not found. Creating it...");
        try {
            const response = await fetch("http://127.0.0.1:5000/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: "Miscellaneous" }),
            });
            const newProject = await response.json();
            console.log("✅ Step 7b: 'Miscellaneous' project created:", newProject);
            defaultProjectId = newProject.id;
            setProjects(prev => [...prev, newProject]); // Add to state
        } catch (error) {
            console.error("🚨 Step 7c: Error creating 'Miscellaneous' project:", error);
            return;
        }
    }

    // ✅ Step 8: Create the new task immediately
    let taskPayload = {
        title: "Untitled Task",
        description: "",
        task_type: "User Story",
        priority: "Unset",
        status: "Not Started",
        project_id: defaultProjectId, // ✅ Default project
    };

    // ✅ Only include `epic_priority` if the task is an Epic
    if (taskPayload.task_type === "Epic") {
      taskPayload.epic_priority = "Unset"; // Default for Epics
    } else {
      delete taskPayload.epic_priority; // ✅ Completely remove epic_priority for non-Epics
    }
    
    console.log("📡 Task Payload before sending:", JSON.stringify(taskPayload, null, 2));
    
    try {
        const response = await fetch("http://127.0.0.1:5000/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskPayload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("🚨 Step 10a: Task creation failed!", errorText);
            return;
        }

        const newTask = await response.json();
        console.log("✅ Step 10b: New Task Created - checking 'newTask':", newTask);
        // ✅ Ensure `project_id` is in state before opening modal
        console.log("🛠️ Step 10c: Checking Task Object 'newTask.task':", newTask.task);
        console.log("🔍 Step 10d: Checkign project_id presence 'newTask?.task?.project_id':", newTask?.task?.project_id);

        if (!newTask.task) {
            console.error("🚨 Step 10c-error: Response does not contain a 'task' object!", newTask);
            return;
        }

        // ✅ Ensure `tasks` is updated so `handleFieldChange` can find task 319
        setTasks((prevTasks) => [...prevTasks, newTask.task]); 

        
        
        // Ensure `project_id` exists before proceeding
        if (!newTask.task.project_id) {
            console.error("🚨 Step 10d: New Task missing project_id!", newTask.task);
            return;
        }

        setTaskData((prev) => ({
            ...newTask.task,
            project_id: newTask.task.project_id || defaultProjectId,
        }));
        setSelectedTask(newTask.task);
        setTaskData(newTask.task);  // ✅ Ensure `taskData` is in sync
        setIsModalOpen(true);

    } catch (error) {
        console.error("🚨 Step 13: Error creating new task:", error);
    }
  }, [projects, selectedProjectId]);

  const handleFieldChange = useCallback(async (taskId, field, value) => {
    console.log(`📌 Row 210 - Step 21: handleFieldChange called with taskId: ${taskId}, field: '${field}', value: '${value}'`);

    if (!taskId) {
        console.error("🚨 Error: taskId is undefined or null!");
        return;
    }
    
    const taskToUpdate = tasks.find(task => task.id === taskId);
    console.log("🔍 row 218-Step 22: Checking if task exists in local state:", taskToUpdate);

    if (!taskToUpdate || taskToUpdate[field] === value) {
        console.warn(`⚠️ row 221-Step 23: No changes detected for ${field}, skipping API call.`);
        return;
    }
    
    // ✅ Update `taskData` immediately to reflect UI changes before API call
    setTaskData((prevTaskData) => ({
      ...prevTaskData,
      [field]: value,
    }));

    try {
        const payload = { [field]: value };
        console.log("📡 Step 24: Sending update to API for", field);
        const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        
        if (!response.ok) {
            console.error("🚨 Step 26: API Error - Response not OK", response.status);
            const errorText = await response.text();
            throw new Error(`Failed to update ${field}: HTTP ${errorText}`);
        }

        const responseData = await response.json();
        console.log("📩 Step 25: API Response Received:", responseData);

        console.log(`✅ Step 27: Successfully updated '${field}' for Task ${taskId} to '${value}'`);

        // ✅ Handle Project Update (Ensure Project Name is Reflected)
        let updatedProjectName = taskToUpdate.project;
        if (field === "project_id") {
            console.log("📌 Step 28: Checking project name for project_id:", value);
            console.log("📌 Current projects state:", projects);
            
            if (!Array.isArray(projects)) {
                console.error("🚨 projects is not an array!", projects);
            }
        
            const updatedProject = projects.find((p) => p.id === parseInt(value, 10));
            updatedProjectName = updatedProject ? updatedProject.name : "Unknown Project";

            console.log(`✅ Step 29: Updated project name: ${updatedProjectName}`);
        }

        // ✅ Handle Contributor Updates - Ensure Contributor Name is Reflected
        let updatedContributorId = taskToUpdate.contributor_id;
        let updatedContributorName = taskToUpdate.contributor_name;
        if (field === "contributor_id") {
            updatedContributorId = responseData?.task?.contributor_id || value;
            updatedContributorName = responseData?.task?.contributor_name || "Unassigned";
        }

        // ✅ Update Local Task State in `tasks` array
        console.log("🔄 Step 29: Updating local state with new values...");
        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === taskId 
                    ? { 
                        ...task,
                        [field]: value,
                        ...(field === "project_id" && { project: updatedProjectName }),
                        ...(field === "contributor_id" && {
                            contributor_id: updatedContributorId,
                            contributor_name: updatedContributorName,
                        }),
                      } 
                    : task
            )
        );

        // ✅ If the modal is open for this task, update `selectedTask` as well
        if (selectedTask && selectedTask.id === taskId) {
            console.log("🔄 Step 31: Updating selectedTask state in modal...");
            setSelectedTask((prev) => ({
                ...prev, 
                [field]: value,
                ...(field === "project_id" && { project: updatedProjectName }),
                ...(field === "contributor_id" && {
                    contributor_id: updatedContributorId,
                    contributor_name: updatedContributorName,
                }),
            }));
        }

    } catch (error) {
        console.error(`🚨 Step 31: Error updating ${field}:`, error);
    }
  }, [projects, selectedTask, tasks]);
  
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
  
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/tasks/delete/${taskId}`, {
        method: "DELETE",
      });
  
      if (!response.ok) throw new Error("Failed to delete task");
  
      // ✅ Remove task from local state
      setTasks((prevTasks) => prevTasks.filter((task) => task.id !== taskId));
  
      // ✅ Close modal if the deleted task was open
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
  
      console.log(`Deleted Task ID: ${taskId}`);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  useEffect(() => {
    fetch("http://127.0.0.1:5000/api/tasks")
      .then((response) => response.json())
      .then((data) => {
        const tasksArray = Array.isArray(data) ? data : data.tasks || [];
        setTasks(tasksArray);
        setFilteredTasks(tasksArray);

        const initialStatus = {};
        tasksArray.forEach((task) => {
          initialStatus[task.id] = task.status;
        });
        setTaskStatus(initialStatus);
      })
      .catch((error) => console.error("Error fetching tasks:", error));
  }, []);

  const [loadingProjects, setLoadingProjects] = useState(false);

  // ✅ Fetch Projects on Page Load
  useEffect(() => {
    async function fetchData() {
      setLoadingProjects(true);
      try {
        const projectsRes = await fetch("http://127.0.0.1:5000/api/projects");
        if (!projectsRes.ok) throw new Error(`HTTP error! Status: ${projectsRes.status}`);
        setProjects(await projectsRes.json());
      } catch (error) {
        console.error("Error fetching projects:", error);
      } finally {
        setLoadingProjects(false);
      } 
    }
    fetchData();
  }, []);

  useEffect(() => {
    let filtered = tasks.filter((task) => {
      return (
        (filters.project ? task.project === filters.project : true) &&
        (filters.taskType ? task.task_type === filters.taskType : true) &&
        (filters.status ? task.status === filters.status : true)
      );
    });
    setFilteredTasks(filtered);
  }, [filters, tasks]);

  const handlePriorityChange = async (taskId, newPriority) => {
    const taskToUpdate = tasks.find((task) => task.id === taskId);
    if (!taskToUpdate || taskToUpdate.priority === newPriority) {
      console.log(`No changes detected for priority, skipping API call.`);
      return;
    }

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ priority: newPriority }),
        });
    
        if (!response.ok) throw new Error("Failed to update priority");
        console.log(`Updated priority for Task ${taskId} to ${newPriority}`);
    
        // ✅ Update local state after API success
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? { ...task, priority: newPriority } : task
          )
        );


        console.log(`Updated priority for Task ${taskId} to ${newPriority}`);
    } catch (error) {
        console.error("Error updating priority:", error);
    }
  };

  const openTaskModal = async (task) => {
    try {
      console.log("Opening modal for:", task);
      const response = await fetch(`http://127.0.0.1:5000/api/tasks/${task.id}`);
      if (!response.ok) throw new Error("Failed to fetch task details");
      
      const taskData = await response.json();
      setSelectedTask(taskData); // ✅ Ensure modal gets up-to-date data

      // ✅ Set modal open after task data is set
      setTimeout(() => {
          console.log("🚀 Opening modal after fetching task data");
          setIsModalOpen(true);
      }, 100);

    } catch (error) {
        console.error("Error fetching task details:", error);
    }
  };
  
  const closeModal = () => {
    setSelectedTask(null);
  };

  

  // ✅ Drag & Drop Handler
  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedTasks = Array.from(filteredTasks);
    const [movedTask] = reorderedTasks.splice(result.source.index, 1);
    reorderedTasks.splice(result.destination.index, 0, movedTask);

    setFilteredTasks(reorderedTasks);
  };

  // ✅ Expand/Collapse Nested Tasks
  const toggleExpand = (taskId) => {
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  // ✅ Render Tasks Recursively (Ensuring Nested Task Visibility)
  const renderTasks = (tasks, parentId = null, depth = 0) => {
    return tasks
      .filter((task) => task.parent_id === parentId)
      .map((task, index) => (
        <Draggable key={task.id} draggableId={task.id.toString()} index={index}>
          {(provided) => (
            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="group">
              <div
                className="task-row grid grid-cols-[minmax(40px,60px)_minmax(40px,60px)_minmax(300px,1fr)_minmax(50px,80px)_minmax(150px,200px)_minmax(130px,180px)_minmax(60px,100px)_minmax(100px,140px)_minmax(100px,140px)_minmax(130px,180px)_minmax(50px,80px)]
                gap-4 p-3 border-b border-gray-700 items-center hover:bg-gray-700 transition duration-200"
                style={{ paddingLeft: `${depth * 20}px` }} // ✅ Indent Child Tasks
              >     
                <span className="text-center">
                  <input type="checkbox" />
                </span>

                {/* ✅ Expand/Collapse Toggle */}
                <span className="text-center cursor-pointer" onClick={() => toggleExpand(task.id)}>
                  {tasks.some((t) => t.parent_id === task.id) ? (
                    expandedTasks[task.id] ? (
                      <ChevronDownIcon className="w-5 h-5 text-white" />
                    ) : (
                      <ChevronRightIcon className="w-5 h-5 text-white" />
                    )
                  ) : (
                    <span>&nbsp;</span>
                  )}
                </span>

                {/* ✅ Task Type Icon */}
                {/*<span className="task-type-icon flex justify-center">
                  {task.task_type === "Epic" ? (
                    <BookmarkIcon className="w-5 h-5 text-blue-400" />
                  ) : task.task_type === "User Story" ? (
                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-400" />
                  ) : (
                    <UserCircleIcon className="w-5 h-5 text-green-400" />
                  )}
                </span>*/}

                {/* ✅ Task Title */}
                <span className="flex items-center relative w-full">
                  <span className="font-semibold">{task.name}</span>
                  <span className="text-gray-400 text-sm ml-2">(Parent-ID: {task.parent_id || "None"})</span>

                  {/* Open Link (Only Visible on Hover) */}
                  <span className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                  <span
                    className="cursor-pointer text-white-400 hover:underline flex items-center"
                    onClick={() => openTaskModal(task)}
                  >
                    {/*<i className="bi bi-arrows-angle-expand w-4 h-4 mr-2 text-white-400" /></i>*/}
                    <span className="bi bi-arrows-angle-expand"> Open</span>
                  </span>
                  </span>
                </span>

                <span className="task-id">LM-{task.id}</span>
                <span className="task-project">{task.project}</span>
                {/* ✅ Contributor Dropdown inside Task List */}
                <span className="text-center">
                <select
                  name="contributor_id"
                  className="contributor-dropdown mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={task.contributor_id || ""}
                  onChange={(e) => {
                    if (!task.id) {
                      console.error("🚨 Cannot assign contributor: Task ID is undefined!", task);
                      return;
                    }
                    handleContributorChange(task.id, e.target.value);
                  }}
                >
                  <option value="">Unassigned</option>
                  {contributors.map((c) => {
                    const contributorProjects = Array.isArray(c.projects) ? c.projects : [];
                    const taskProjectId = task.project_id ?? null;
                    const isContributorInProject = contributorProjects.includes(taskProjectId);
                    const isAssignedContributor = task.contributor_id === c.id; // ✅ Check if this contributor is assigned to the task

                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {!isAssignedContributor && (isContributorInProject ? "✅ (In Project)" : "➕ (Add to Project)")}
                      </option>
                    );
                  })}
                </select>
                </span>
                <span className="task-story-points text-center">{task.story_points || "-"}</span>

                {/* ✅ Task Type Badge */}
                <span className={`task-type-badge px-3 text-center ${
                  task.task_type === "Epic"
                    ? "epic-style"
                    : task.task_type === "User Story"
                    ? "user-story-style"
                    : "subtask-style"
                }`}>
                  {task.task_type}
                </span>

                {/* ✅ Priority Dropdown - Show Epic Priority for Epics */}
                {task.task_type === "Epic" ? (
                  <select
                    className="priority-dropdown p-2 bg-gray-700 text-white rounded text-center"
                    value={task.epic_priority || ""}
                    onChange={(e) => handleFieldChange(task.id, "epic_priority", e.target.value)}
                  >
                    <option value="P0">P0 - Highest</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Medium</option>
                    <option value="P3">P3 - Low</option>
                    <option value="P4">P4 - Lowest</option>
                  </select>
                ) : (
                  <select
                    className="priority-dropdown p-2 bg-gray-700 text-white rounded text-center"
                    value={task.priority || ""}
                    onChange={(e) => handleFieldChange(task.id, "priority", e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                )}

                {/* ✅ Status Dropdown */}
                <select
                  className="task-status-dropdown p-2 bg-gray-700 text-white rounded text-center"
                  value={task.status}
                  onChange={(e) => handleFieldChange(task.id, "status", e.target.value)}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>

                {/* ✅ Delete Button */}
                <button
                  className="text-red-400 hover:text-red-600 text-center"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  <i className="bi bi-trash"></i>
                </button>
              </div>

              {/* ✅ Render Nested Tasks (Only If Expanded) */}
              {expandedTasks[task.id] && renderTasks(tasks, task.id, depth + 1)}
            </div>
          )}
        </Draggable>
      ));
  };

  return (
    <div className={`min-h-screen ${darkMode ? "bg-gray-900 text-white" : "bg-gray-100 text-black"} px-10 py-8 mt-16`}
    style={{ backgroundImage: "url('/background.svg')", backgroundSize: "cover", backgroundRepeat: "no-repeat", backgroundAttachment: "fixed", position: "relative", backgroundPosition: "center center" }}>

      {/* ✅ Fixed Navigation Menu & Theme Toggle */}
      <nav className="fixed top-0 left-0 w-full bg-gray-800 p-4 flex items-center justify-between shadow-md z-50">
        <div className="flex items-center space-x-4">
          <img src="/logo.png" alt="PMS Logo" className="h-8 w-auto hidden sm:block" onError={(e) => e.target.style.display = 'none'} />
          <span className="text-white text-xl font-bold sm:hidden">PMS</span>
        </div>
        
        <div className="flex items-center space-x-6">
          <a href="http://127.0.0.1:5000/dashboard" className="text-gray-300 hover:text-white">Overview</a>
          <a href="http://127.0.0.1:5000/tasks/" className="text-gray-300 hover:text-white">All Tasks (Old)</a>
          <a href="http://localhost:3000/alltasks" className="text-white font-bold">All Tasks (React)</a>
          <button className="p-2 bg-gray-700 text-white hover:bg-gray-600 rounded" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? "☀️ Light Mode" : "🌙 Dark Mode"}
          </button>
        </div>
      </nav>

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {/* Project Filter */}
        <select
          className="p-2 bg-gray-800 text-white border border-gray-600 rounded"
          onChange={(e) => setFilters({ ...filters, project: e.target.value })}
        >
          <option value="">All Projects</option>
          {Array.isArray(projects) ? (
            projects.map((project) => (
              <option key={project.id} value={project.name}>
                {project.name}
              </option>
          ))
        ) : (
          <option disabled>Loading...</option>
        )}
        </select>

        {/* Task Type Filter */}
        <select
          className="p-2 bg-gray-800 text-white border border-gray-600 rounded"
          onChange={(e) => setFilters({ ...filters, taskType: e.target.value })}
        >
          <option value="">All Task Types</option>
          <option value="Epic">Epic</option>
          <option value="User Story">User Story</option>
          <option value="Subtask">Subtask</option>
        </select>

        {/* Status Filter */}
        <select
          className="p-2 bg-gray-800 text-white border border-gray-600 rounded"
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>

        {/* Clear Filters Button */}
        <button
          className="p-2 bg-red-500 hover:bg-red-700 rounded"
          onClick={() => setFilters({ project: "", taskType: "", status: "" })}
        >
          Clear Filters
        </button>
      </div>

      {/* ✅ "New Task" Button */}
      <button 
        className="new-task-button top-20 left-8 z-50 p-3 bg-blue-500 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition duration-200"
        onClick={createNewTask}>
          ➕ New Task
      </button>

      {/* ✅ Task List Background Fix */}
      <div className={` p-6 rounded-md shadow-md ${darkMode ? "bg-gray-800" : "bg-gray-300"}`}
        style={{ backgroundColor: "rgba(21, 22, 34, 0.8)" }}
      >

        {/* ✅ Header Row (Fixed Column Alignment) */}
        <div className="grid grid-cols-[minmax(40px,60px)_minmax(40px,60px)_minmax(250px,1fr)_minmax(50px,80px)_minmax(150px,200px)_minmax(130px,180px)_minmax(60px,100px)_minmax(100px,140px)_minmax(80px,140px)_minmax(90px,180px)_minmax(30px,80px)]
          gap-4 p-2 font-bold bg-gray-700 rounded-md text-white">
          <span className="text-center"><input type="checkbox" id="selectAll" /></span>
          <span className="">Toggle</span>
          {/*<span className="">Icon</span>*/}
          <span className="text-left">Task Title</span>
          <span className="">ID</span>
          <span className="">Project</span>
          <span className="">Assigned To</span>
          <span className="text-center">Estimate</span>
          <span className="">Type</span>
          <span className="">Priority</span>
          <span className="">Status</span>
          <span className="text-center">Delete</span>
        </div>
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="tasklist">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {renderTasks(filteredTasks)}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      {/* ✅ Render TaskModal when a task is selected or a new task is being created */}
      {isModalOpen && (
        <TaskModal
          isOpen={isModalOpen}
          selectedTask={selectedTask}
          setSelectedTask={setSelectedTask}
          projects={projects}
          selectedProjectId={selectedProjectId} // ✅ Pass selectedProjectId to modal
          onClose={() => {
            console.log("❌ Modal Close Button Clicked! isModalOpen → false");
            setIsModalOpen(false);
          }}
          handleFieldChange={handleFieldChange}
        />
      )}

    </div>
  );
}

{/* ------------------------Task details modal----------------------- */}



function TaskModal({ isOpen, selectedTask, projects, selectedProjectId, onClose, handleFieldChange }) {
  // ✅ Fetch contributors using React Query
  //const { data: contributors, error, isLoading } = useQuery(
  //    ['contributors', selectedProjectId], 
  //    () => fetchContributors(selectedProjectId)
  //);

  //if (isLoading) {
  //    console.log("🔄 Loading contributors...");
  //}
  //if (error) {
  //    console.error("❌ Error fetching contributors:", error);
  //}
  
  const defaultTask = {
    name: "",
    description: "",
    priority: "Unset",
    status: "Not Started",
    project_id: selectedProjectId, // ✅ Using selectedProjectId from props to Default to Miscellaneous
    contributor_id: null,
    story_points: 0,
  };

  // ✅ Ensure we always have a valid task object
  const [taskData, setTaskData] = useState(selectedTask || {
    name: "",
    description: "",
    task_type: "User Story",
    priority: "Unset",
    status: "Not Started",
    project_id: selectedProjectId || "", // Ensure selectedProjectId is defined
  });
  const router = useRouter();
  const pathname = usePathname();

  const [contributors, setContributors] = useState([]);

  useEffect(() => {
      if (!selectedTask || !selectedTask.project_id) {
          console.warn("⚠️ TaskModal Warning: No selectedTask or project_id is undefined!", selectedTask);
          return;
      }

      console.log(`🔄 Fetching contributors for project_id: ${selectedTask.project_id}`);

      fetch(`http://127.0.0.1:5000/api/projects/${selectedTask.project_id}/contributors/manage`)
          .then((res) => res.json())
          .then((data) => {
              if (!Array.isArray(data)) {
                  console.error("❌ Project Contributors API response is not an array!", data);
                  return;
              }
              console.log(`✅ Contributors loaded for project ${selectedTask.project_id}:`, data);
              setContributors(data);
          })
          .catch((error) => console.error("❌ Error fetching contributors:", error));

  }, [selectedTask?.project_id]); // ✅ Runs when `selectedTask.project_id` changes

  const [viewMode, setViewMode] = useState("modal");

  // ✅ Define scrollRef here
  const scrollRef = useRef(null);

  

  // ✅ Ensure taskData syncs properly when selectedTask changes
  useEffect(() => {
    setTaskData(selectedTask || {});
  }, [selectedTask]);


  // ✅ Track if project_id is set
  const [readyToFetchContributors, setReadyToFetchContributors] = useState(false);
  const effectRun = useRef(false); // ✅ Prevents double execution in strict mode

  // ✅ NEW: Set "Miscellaneous" as default if no project is selected
  useEffect(() => {
    console.log("📌 Checking available projects before assigning default:", projects);

    if (!selectedTask) { // ✅ Only for new tasks
        const miscProject = projects.find(p => p.name === "Miscellaneous");

        if (miscProject) {
            console.log("✅ 'Miscellaneous' project found, using ID:", miscProject.id);
            setTaskData((prev) => ({
                ...prev,
                name: "",
                description: "",
                task_type: "User Story",
                priority: "Unset",
                status: "Not Started",
                project_id: miscProject.id,  // ✅ Default to "Miscellaneous"
            }));
            setReadyToFetchContributors(true);  // ✅ Now project_id is available
        } else {
          console.warn("⚠️ 'Miscellaneous' project is missing!");
          setReadyToFetchContributors(false);
        }
    }
  }, [selectedTask, projects]);

  // ✅ Define debouncedSave inside TaskModal with correct reference
  const debouncedSaveRef = useRef(debounce((taskId, field, value, handleFieldChange) => {
    console.log(`🔥 Debounced Save Triggered at ${new Date().toISOString()} for ${field}:`, value);
    if (typeof handleFieldChange === "function") {
      handleFieldChange(taskId, field, value);
    } else {
      console.error("🚨 handleFieldChange is not defined inside debounce!");
    }
  }, 1000));

  const handleMouseDown = (event) => {
    if (scrollRef.current) {
      onMouseDown(event); // ✅ This now works correctly
    }
  };

  const handleCreateNewTask = () => {
    setSelectedTask({
      name: "",
      description: "",
      priority: "Medium",
      status: "Not Started",
      project_id: selectedProject?.id || null, // Default to selected project
      contributor_id: null, // Unassigned by default
      story_points: 0,
    });
    setIsModalOpen(true);
  };

  const [taskNameWarning, setTaskNameWarning] = useState(""); // ✅ Store warning message

  const validateTaskName = (taskName) => {
      console.log("🔍 Validating Task Name:", taskName);
      // Check for existing tasks with the same name
      if (tasks.some(task => task.name === taskName)) {
          setTaskNameWarning("⚠️ A task with this name already exists.");
      } else {
          setTaskNameWarning(""); // Clear warning when name is unique
      }
  };

  const debouncedHandleChange = debounce((event) => {
      const { name, value } = event.currentTarget;
      console.log(`🛠️ Debounced handleChange triggered for '${name}' → '${value}'`);

      setTaskData(prev => ({ ...prev, [name]: value }));

      // ✅ Only validate the name field for new tasks
      if (!selectedTask?.id && name === "name") {
          validateTaskName(value);
      }
  }, 500);


  // ✅ Modified handleChange to create the task on first input
  const handleChange = async (event) => {
      event.persist();  // ✅ Ensure the event is available inside debounce
      const { name, value } = event.target; // ✅ Extract name and value from event
      
      console.log(`🛠️ Step 11: handleChange triggered for '${event.target.name}' → '${event.target.value}'`);

      // ✅ Update state immediately for instant UI feedback
      setTaskData((prev) => ({
          ...prev,
          [name]: value,
      }));

      console.log("🔄 Step 11a: Updated taskData:", taskData);

      // ✅ If editing an existing task, update it using `handleFieldChange`
      if (taskData.id || selectedTask?.id) { // ✅ Include selectedTask.id for reliability
        console.log(`📌 Step 12: Updating existing task ${taskData.id || selectedTask?.id}`);
        debouncedSaveRef.current(taskData.id || selectedTask?.id, name, value, handleFieldChange); // ✅ Use `handleFieldChange`
        return;
      }

      // ✅ If creating a new task (no ID yet), create it on first input
      try {
          console.log("🛠️ Step 14: Creating new task...");
          console.log("📡 Sending payload to API:");
          const response = await fetch("http://127.0.0.1:5000/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  title: taskData.name || "Untitled Task",  // ✅ Use title instead of name
                  description: taskData.description || "",
                  task_type: taskData.task_type || "User Story",
                  priority: taskData.priority || "Unset",
                  status: taskData.status || "Not Started",
                  project_id: taskData.project_id || selectedProjectId, // ✅ Ensure project_id defaults to "Miscellaneous"
              }),
          });

          const responseData = await response.json();
          console.log("📩 Step 15: API Response Received:", responseData);

          // ✅ Handle warnings (like duplicate task name)
          if (responseData.warning) {
              console.warn(`⚠️ Step 16: Task name warning: ${responseData.warning}`);
              setTaskNameWarning(responseData.warning); // ✅ Display warning message
          } else {
              setTaskNameWarning(""); // ✅ Remove warning when name becomes unique
          }

          console.log(`✅ Step 17: New Task Created Successfully - Task ID: ${responseData.task.id}, Name: "${responseData.task.name}"`);

          // ✅ Update state with new task ID (so future updates use `handleFieldChange`)
          setTaskData((prev) => ({
              ...prev,
              id: responseData.task.id,
          }));

          console.log("🔄 Step 18: Updated taskData with new ID:", taskData);

          if (typeof setSelectedTask === "function") {
              setSelectedTask(responseData.task);  // ✅ Ensure setSelectedTask is defined
          } else {
            console.error("🚨 Step 19b: setSelectedTask is not available.");
          }

      } catch (error) {
          console.error("🚨 Step 20: Error creating new task:", error);
      }
  };

  // ✅ Cleanup Effect to prevent debounce issues
  useEffect(() => {
      return () => {
          console.log("🛑 Cancelling debouncedSave, but NOT closing modal.");
          debouncedSaveRef.current.cancel();
      };
  }, []);


  /*
  // ✅ Fetch Contributors AFTER taskData.project_id is updated (Prevents double execution)
  // useEffect(() => {
  //  if (!readyToFetchContributors || !taskData.project_id) {
  //      console.warn(`⚠️ project_id is still undefined. Skipping contributor fetch.`);
  //      return;
  //  }

    if (effectRun.current) {
        console.log("🛑 Skipping duplicate contributor fetch due to React Strict Mode.");
        return;
    }

    console.log(`🔄 Fetching contributors for project_id: ${taskData.project_id}`);
    
    let isCancelled = false; // ✅ Prevents duplicate API calls if effect runs twice

    const fetchContributors = async () => {
        try {
            console.log(`🔄 Fetching contributors for project_id: ${taskData.project_id}`);
            const res = await fetch(`http://127.0.0.1:5000/api/projects/${taskData.project_id}/contributors/manage`);
            if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
            const contributorsData = await res.json();
            if (!isCancelled) { // ✅ Ensures state updates only if effect is still valid
                console.log("✅ Contributors loaded:", contributorsData);
                setContributors(contributorsData);
            }
        } catch (error) {
            console.error("❌ Error fetching contributors:", error);
        }
    };

    fetchContributors();
    effectRun.current = true; // ✅ Ensures this effect only runs once

    return () => {
        console.log("🛑 Cleaning up contributor fetch effect.");
        isCancelled = true; // ✅ Prevents duplicate API calls
    };
  }, [readyToFetchContributors, taskData.project_id]); // ✅ Waits for `readyToFetchContributors` to be true
*/

  useEffect(() => {
      if (!selectedTask || !selectedTask.project_id) {
          console.warn("⚠️ TaskModal Warning: selectedTask or project_id is undefined!");
          return;
      }
  }, [selectedTask]);


  const handleContributorChange = async (e) => {
    const newContributorId = e.target.value;
    setTaskData((prevTaskData) => ({
      ...prevTaskData,
      assigned_to: newContributorId,
    }));

    try {
      const checkRes = await fetch(`http://127.0.0.1:5000/api/projects/${taskData.project_id}/contributors/manage`);
      const projectContributors = await checkRes.json();

      if (!projectContributors.some((c) => c.id === parseInt(newContributorId))) {
        await fetch(`http://127.0.0.1:5000/api/projects/${taskData.project_id}/contributors/manage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contributor_id: newContributorId }),
        });
      }

      const updatedContributorsRes = await fetch(`http://127.0.0.1:5000/api/projects/${taskData.project_id}/contributors/manage`);
      setContributors(await updatedContributorsRes.json());
    } catch (error) {
      console.error("Error adding contributor to project:", error);
    }
  };


  const closeModal = () => {
    setSelectedTask(null);  // ✅ Clears modal when closed
  };

  if (!selectedTask && !isOpen) return null;

  return (
    <div className="modal-background">
      <div ref={scrollRef} className={`fixed inset-0 flex items-center justify-center overflow-hidden ${
          viewMode === "modal" ? "flex items-center justify-center" : ""
        } ${viewMode === "side" ? "absolute top-0 left-0 w-[800px] h-full" : ""}`}
      >
        <div
          className={`task-modal p-6 rounded-lg shadow-lg relative z-50 transition-all duration-300 ease-in-out ${
            viewMode === "modal" ? "w-[70vw] max-w-4xl h-aut" : ""
          } ${
            viewMode === "side"
              ? "h-full w-[400px] shadow-lg"
              : ""
          } ${
            viewMode === "full"
              ? "fixed inset-0 w-full h-full p-8 max-w-none max-h-none"
              : ""
          }`}
        >
          {/* ✅ Page View Buttons - Now in Top Left */}
          <div className="absolute top-4 left-6 flex space-x-3">
            <button 
              data-tooltip-id="global-tooltip" 
              data-tooltip-content="Open in Modal View"
              onClick={() => setViewMode("modal")}
              className="modal-view-btn p-1 rounded"
            >
              <i className="bi bi-aspect-ratio"></i>
            </button>

            <button 
              data-tooltip-id="global-tooltip" 
              data-tooltip-content="Open in Side View"
              onClick={() => setViewMode("side")}
              className="modal-view-btn p-1 rounded"
            >
              <i className="bi bi-layout-sidebar-inset-reverse"></i>
            </button>

            <button 
              data-tooltip-id="global-tooltip" 
              data-tooltip-content="Open in Page View"
              onClick={() => setViewMode("full")}
              className="modal-view-btn p-1 rounded"
            >
              <i className="bi bi-arrows-angle-expand"></i>
            </button>
          </div>
          <div className="absolute top-4 right-6 flex space-x-3">
            <button onClick={onClose} className="text-gray-200 hover:text-white">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* ✅ Header (Draggable, Only Includes Title & Close Button) */}
          <div 
            className="flex justify-between items-center border-b pb-4 mt-10 drag-handle cursor-move"
            onMouseDown={handleMouseDown} // ✅ Correctly references function
          >
            <h2 className="text-xl font-bold">{taskData.name}</h2>
            
          </div>

          {/* ✅ Task Form */}
          <form className="mt-4 grid grid-cols-12 gap-4">
            {/* ✅ Left Column */}
              <div className="col-span-8">
                <div className="mb-4">
                  <label className="label block text-sm font-medium text-gray-700">Task Title</label>
                  <input
                    type="text"
                    name="name"
                    className="input-task-name text-field mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={taskData.name ?? ""}// ✅ "" Ensures that even if taskData.name is undefined, it stays an empty string.
                    onChange={handleChange}
                  />
                  {/* ✅ Display Task Name Warning */}
                  {taskNameWarning && (
                      <p className="mt-2 text-yellow-500">
                          ⚠️ {taskNameWarning}
                      </p>
                  )}
                </div>
                <div className="mb-4">
                  <label className="label block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    name="description"
                    className="textfield mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    rows="10"
                    value={taskData.description}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ✅ Right Column */}
              <div className="col-span-4 space-y-4 pl-6"> 
                <div className="mb-4">
                  <label className="label block text-sm font-medium text-gray-700">Project</label>
                  <select
                    name="project_id"
                    className="select-project mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                    value={taskData.project_id || ""}
                    onChange={(e) => {
                      const selectedProjectId = e.target.value;
                      console.log(`🎯 Row 1125-Project change: Step 1: Project selected: ${selectedProjectId} for task ${taskData.id}`); // <-- ADD THIS LINE

                      // ✅ Ensure taskData has a valid task ID before updating
                      if (!taskData.id) {
                        console.error("🚨 Cannot update project, task ID is missing!", taskData);
                        return;
                      }
                      
                      // ✅ Update the backend
                      handleFieldChange(taskData.id, "project_id", selectedProjectId);

                      // ✅ Log when "Miscellaneous" is selected
                      const selectedProject = projects.find((p) => p.id === parseInt(selectedProjectId, 10));
                      if (selectedProject?.name === "Miscellaneous") {
                          console.log("⚠️ Task is assigned to 'Miscellaneous'. Consider selecting a project.");
                      }
                    }}
                  >
                    <option value="">Select Project</option> {/* ✅ Add a placeholder option */}
                    {projects.length > 0 ? (
                      projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>Loading...</option> // ✅ Display loading message if empty
                    )}
                  </select>

                  {/* ✅ UI Indicator for "Miscellaneous" */}
                  {projects.find((p) => p.id === parseInt(taskData.project_id, 10))?.name === "Miscellaneous" && (
                      <p className="mt-2 text-sm text-yellow-400">
                          ⚠️ This task is assigned to <strong>Miscellaneous</strong>. Choose a project if needed.
                      </p>
                  )}
                </div>

              <div className="mb-4">
                <label className="label block text-sm font-medium">Task Type</label>
                <select
                  name="task_type"
                  className="select-task-type mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 transition-all duration-300"
                  value={taskData.task_type ?? "User Story"} // ✅ Default to "User Story" if task_type is undefined
                  onChange={(e) => handleFieldChange(taskData.id, "task_type", e.target.value)}
                >
                  <option value="Epic">Epic</option>
                  <option value="User Story">User Story</option>
                  <option value="Subtask">Subtask</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="select-priority label block text-sm font-medium">Priority</label>
                {taskData.task_type === "Epic" ? (
                  <select
                    name="epic_priority"
                    className="select-priority mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 transition-all duration-300"
                    value={taskData.epic_priority ?? "Unset"} // ✅ Default to "Unset" if epic_priority is undefined
                    onChange={(e) => handleFieldChange(taskData.id, "epic_priority", e.target.value)}
                  >
                    <option value="P0">P0 - Highest</option>
                    <option value="P1">P1 - High</option>
                    <option value="P2">P2 - Medium</option>
                    <option value="P3">P3 - Low</option>
                    <option value="P4">P4 - Lowest</option>
                  </select>
                ) : (
                  <select
                    name="priority"
                    className="select-priority mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 transition-all duration-300"
                    value={taskData.priority ?? "Unset"} // ✅ Default to "Unset" if priority is undefined
                    onChange={(e) => handleFieldChange(taskData.id, "priority", e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                )}
              </div>

              <div className="mb-4">
                <label className="label block text-sm font-medium">Task Status</label>
                <select
                  name="status"
                  className={`select-status mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 transition-all duration-300 ${
                    taskData.status === "Not Started" ? "status-not-started" :
                    taskData.status === "In Progress" ? "status-in-progress" :
                    taskData.status === "Blocked" ? "status-blocked" :
                    taskData.status === "Completed" ? "status-completed" : ""
                  }`}
                  value={taskData.status ?? "Not Started"} // ✅ Default to "Not Started" if status is undefined  
                  onChange={(e) => handleFieldChange(taskData.id, "status", e.target.value)}
                >
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="label block text-sm font-medium">Estimate (Story Points)</label>
                <input
                  type="number"
                  name="story_points"
                  className="input-story-points mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={taskData.story_points || ""} // ✅ Default to empty string if story_points is undefined
                  onChange={(e) => handleFieldChange(taskData.id, "story_points", e.target.value)}
                />
              </div>

              <div className="mb-4">
                <label className="label block text-sm font-medium text-gray-100">Assigned Contributor</label>
                <select
                  name="contributor_id"
                  className="select-contributor mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={taskData.contributor_id || ""}
                  onChange={(e) => handleContributorChange(taskData.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {contributors.map((contributor) => {
                      // Ensure projects is always an array
                      const contributorProjects = Array.isArray(contributor.projects) ? contributor.projects : [];
                      const isContributorInProject = contributorProjects.includes(taskData.project_id);
                      const isAssignedContributor = taskData.contributor_id === contributor.id;

                      console.log(
                        `🔍 Checking Contributor ${contributor.name} (ID: ${contributor.id}): Assigned - ${isAssignedContributor}, In Project - ${isContributorInProject}`
                      );

                      return (
                        <option key={contributor.id} value={contributor.id}>
                            {contributor.name} 
                            {!isAssignedContributor && (isContributorInProject ? "✅ (In Project)" : "➕ (Add to Project)")}
                        </option>
                      );
                  })}
                </select>
              </div>
            </div>
          </form>

          {/* ✅ Footer Buttons */}
          <div className="mt-6 flex justify-end space-x-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded-md">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}