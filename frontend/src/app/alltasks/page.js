"use client";

import { updateTask } from "@/utils/api";
import { createTask } from "@/utils/api";
import { useEffect, useState, useRef, forwardRef, useCallback } from "react";
import Image from 'next/image';
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
import TiptapEditor from "@/components/TiptapEditor"; // ✅ Import the Tiptap Editor
import ParentTaskSelector from "@/components/ParentTaskSelector";
import '../styles/custom.css';
//import { useSession } from "next-auth/react"; // what is this for?

let socket; // Define socket globally

if (typeof window !== "undefined") {
  socket = io("http://127.0.0.1:5000");
  window.socket = socket; // ✅ Assign socket to `window` only in the browser
}

export default function AllTasks() {
  useEffect(() => {
    if (socket) {
      console.log("✅ WebSocket connection established in the client.");
    }
  }, []);

  // 🔍 Debugging: Detect Page Reloads
  useEffect(() => {
    const reloadListener = () => console.trace("⛔ Page is reloading! Stack trace:");
    window.addEventListener("beforeunload", reloadListener);

    return () => window.removeEventListener("beforeunload", reloadListener);
  }, []);
  
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

  // // ✅ Restore modal state from localStorage on component mount
  // useEffect(() => {
  //   const savedModalState = localStorage.getItem("isModalOpen");
  //   if (savedModalState === "true") {
  //     setIsModalOpen(true);
  //     console.log("🔄 Restoring modal state from storage");
  //   }
  // }, []);

  // // ✅ Save modal state to localStorage whenever it changes
  // useEffect(() => {
  //   localStorage.setItem("isModalOpen", isModalOpen);
  // }, [isModalOpen]);

  const [editingTaskId, setEditingTaskId] = useState(null); // Tracks the task being edited

  const handleTitleClick = useCallback((taskId) => {
      setEditingTaskId(taskId);
  }, []);

  const handleTitleBlur = useCallback(async (taskId) => {
      const input = titleRefs.current[taskId];
      if (!input) return;

      const newTitle = input.value.trim();
      if (!newTitle) return; // Prevent empty titles

      console.log(`📌 Saving title for task ${taskId}: ${newTitle}`);

      try {
          // const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
          //     method: "PATCH",
          //     headers: { "Content-Type": "application/json" },
          //     body: JSON.stringify({ name: newTitle }),
          // });

          // ✅ Use centralized API function
          const updatedTask = await updateTask(taskId, { name: newTitle });
          if (!updatedTask) throw new Error("Failed to update task title");

          // if (!response.ok) throw new Error("Failed to update task title");
          console.log(`✅ Task ${taskId} title saved successfully!`);

          // ✅ Ensure the updated title is in state
          setTasks((prevTasks) =>
              prevTasks.map((task) =>
                  task.id === taskId ? { ...task, name: newTitle } : task
              )
          );

      } catch (error) {
          console.error(`❌ Error saving task ${taskId} title:`, error);
      }

      // ✅ Exit edit mode
      setEditingTaskId(null);
  }, []);

  const handleTitleKeyDown = useCallback((e) => {
      if (e.key === "Enter") {
          setEditingTaskId(null);
      }
  }, []);

  const [isEditingNewTask, setIsEditingNewTask] = useState(false);
  
  

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

  // ✅ WebSocket: Listen for task updates (Handles ALL task field updates)
  useEffect(() => {
    socket.on("update_task", (updatedTask) => {
        console.log("📡 WebSocket Update: Task Updated!", updatedTask);

        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === updatedTask.taskId
                    ? { ...task, [updatedTask.field]: updatedTask.value }
                    : task
            )
        );

        // ✅ Update task inside the modal if it's open
        if (selectedTask && selectedTask.id === updatedTask.taskId) {
            setSelectedTask((prev) => ({
                ...prev,
                [updatedTask.field]: updatedTask.value,
            }));
        }
    });

    return () => {
        socket.off("update_task"); // ✅ Cleanup listener on unmount
    };
  }, [selectedTask]);

  useEffect(() => {
      console.log("🔄 Updated Tasks State:", tasks);
  }, [tasks]); // Runs every time tasks state updates

  useEffect(() => {
      const handleNewTask = (newTask) => {
          console.log("📡 WebSocket: New Task Created! Full Data:", newTask);
          
          if (!newTask || !newTask.task || !newTask.task.id) {
              console.error("🚨 Invalid WebSocket Task Data Received!", newTask);
              return;
          }

          const newTaskId = newTask.task.id;
          console.log(`🔎 Step 2: Received Task - ID: ${newTaskId}, Parent ID: ${newTask.task.parent_id}`);

          setTasks((prevTasks) => {
              if (!Array.isArray(prevTasks)) {
                  console.error("❌ prevTasks is not an array!", prevTasks);
                  return prevTasks;
              }

              if (prevTasks.some(task => task.id === newTaskId)) {
                  console.warn(`⚠️ Duplicate Task Detected! Skipping: ${newTaskId}`);
                  return prevTasks;
              }

              console.log(`➕ Adding new WebSocket Task: ${newTask.task.name}`);
              return [...prevTasks, newTask.task].sort((a, b) => a.sort_order - b.sort_order);
          });

          setFilteredTasks((prevFilteredTasks) => {
              if (prevFilteredTasks.some(task => task.id === newTaskId)) {
                  console.warn(`⚠️ Duplicate Task in filteredTasks! Skipping: ${newTaskId}`);
                  return prevFilteredTasks;
              }

              console.log(`➕ Adding new task to filteredTasks: ${newTask.task.name}`);
              return [...prevFilteredTasks, newTask.task].sort((a, b) => a.sort_order - b.sort_order);
          });

          setExpandedTasks((prev) => ({
              ...prev,
              [newTask.task.parent_id]: true,
          }));

          setTimeout(() => {
              console.log("📊 FINAL STATE CHECK AFTER 500ms:");
              console.log("🔄 Tasks:", tasks);
              console.log("🔄 Filtered Tasks:", filteredTasks);
          }, 500);
      };

      socket.on("task_created", handleNewTask);

      return () => {
          socket.off("task_created", handleNewTask);
      };
  }, [filteredTasks, tasks]); 

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

          // ✅ Update `selectedTask` in TaskModal immediately
          setSelectedTask((prevTask) => ({
              ...prevTask,
              contributor_id: newContributorId,
              contributor_name: updatedTask.task.contributor_name,
          }));


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
    console.log("🛠️ Fetching 'Miscellaneous' project...");
    fetch("http://127.0.0.1:5000/api/projects/miscellaneous")
      .then((response) => response.json())
      .then((miscProject) => {
        console.log("✅ 'Miscellaneous' project loaded:", miscProject);
        
        // ✅ Set as default project
        setSelectedProjectId(miscProject.id); 
      })
      .catch((error) => console.error("🚨 Error fetching 'Miscellaneous' project:", error))
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
  }, [selectedProjectId, taskData.project_id]); 

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

        // ❌ REMOVED THIS to prevent duplicate state update:
        // setTasks((prevTasks) => [...prevTasks, newTask.task]); 

        // ✅ Instead, emit WebSocket event so all clients sync properly
        socket.emit("task_created", newTask.task);
        
        
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
  }, [projects]);


  // Handles the creation of a new task under a parent task
  const handleCreateTask = async (parentId, taskType) => {
      console.log(`🛠️ Creating new ${taskType} under parent ${parentId}`);

      const newTaskTitle = "New Subtask"; // Default title
      setIsEditingNewTask(false); // Reset edit flag

      const taskPayload = {
          title: taskType === "User Story" ? "New User Story" : "New Subtask",
          task_type: taskType,
          parent_id: parentId,
          project_id: selectedProjectId,
      };

      console.log("📡 Sending Task Payload before API Call:", JSON.stringify(taskPayload, null, 2));

      try {
          // const response = await fetch("http://127.0.0.1:5000/api/tasks", {
          //     method: "POST",
          //     headers: { "Content-Type": "application/json" },
          //     body: JSON.stringify(taskPayload),
          // });

          // console.log("📩 API Response Status:", response.status);

          // if (!response.ok) {
          //     const errorText = await response.text();
          //     console.error("🚨 Task creation failed! API Response:", errorText);
          //     throw new Error(`Task creation failed - ${errorText}`);
          // }

          // const newTask = await response.json();
          const newTask = await createTask(taskPayload); // ✅ Now using centralized API function
          if (!newTask) throw new Error("Failed to create task");
          console.log("✅ Task created successfully:", newTask);

          // 🔹 Keep Parent Task Expanded
          setExpandedTasks((prev) => ({
              ...prev,
              [parentId]: true, // ✅ Keep parent expanded
          }));

          // REMOVED THIS to prevent duplicate state update:
          // 🔹 Add New Task to the UI at the End of Its Parent
          // setTasks((prevTasks) => {
          //   return prevTasks.map((task) => {
          //     if (task.id === newTask.task.parent_id) {
          //       return {
          //         ...task,
          //         children: [...(task.children || []), { ...newTask.task, project_id: task.project_id }],
          //       };
          //     }
          //     return task;
          //   });
          // });

          // ✅ Ensure new task is in edit mode
          setEditingTaskId(newTask.task.id);
          setIsEditingNewTask(true);
            
          // REMOVED THIS to prevent duplicate state update:
          // setFilteredTasks((prevFilteredTasks) => {
          //     const updatedFilteredTasks = [...prevFilteredTasks, newTask.task];
          //     console.log("🔄 Updated Filtered Task List:", updatedFilteredTasks);
          //     return updatedFilteredTasks;
          // });

          // 🔹 Relying on WebSocket event for real-time updates
          socket.emit("task_created", newTask.task);

          // 🔹 Automatically Focus and Select the Task Title for Editing
          setTimeout(() => {
          //  const newTaskElement = document.querySelector(`[data-task-id="${newTask.task.id}"]`);
              const inputField = document.getElementById(`task-title-${newTask.task.id}`);
              if (inputField) {
                  inputField.focus();
                  inputField.select();
              }
          }, 100);

      } catch (error) {
          console.error("❌ Error creating task:", error);
      }
  };

  const titleRefs = useRef({}); // ✅ Ref for storing title input elements

  const handleTitleChange = async (taskId, newTitle) => {
      console.log(`📌 Updating title for task ${taskId} -> ${newTitle}`);

      // Get ref to the input field
      const input = titleRefs.current[taskId];
      const cursorPosition = input ? input.selectionStart : null;

      // ✅ Update local state immediately (so UI doesn't revert back)
      setTasks((prevTasks) =>
          prevTasks.map((task) =>
              task.id === taskId ? { ...task, name: newTitle } : task
          )
      );

      // ✅ Update the ref value directly (so the input doesn't lose state)
      if (input) {
          input.value = newTitle;
      }

      // ✅ Restore cursor position after state update
      setTimeout(() => {
          const updatedInput = titleRefs.current[taskId];
          if (updatedInput && cursorPosition !== null) {
              updatedInput.setSelectionRange(cursorPosition, cursorPosition);
          }
      }, 0);

      try {
          const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: newTitle }),
          });

          if (!response.ok) throw new Error("Failed to update task title");
          console.log(`✅ Task ${taskId} title updated successfully!`);
      } catch (error) {
          console.error(`❌ Error updating task ${taskId} title:`, error);
      }
  };




  //---------------------New version of debouncedSavRef since 4 march 15:30---------------------//

  const debouncedSaveRef = useRef(
    debounce(
      async (taskId, field, value, tasks, projects, selectedTask, setTasks, setSelectedTask, socket) => {
        console.log(`📌 Debounced Save Triggered for Task ${taskId}: ${field} → ${value}`);
  
        if (!taskId) {
          console.error("🚨 Error: taskId is undefined or null!");
          return;
        }
  
        const taskToUpdate = tasks.find(task => task.id === taskId);
        if (!taskToUpdate) {
          console.error("❌ Error: Task not found in state!", { taskId, field, value });
          return;
        }
  
        if (!taskToUpdate || taskToUpdate[field] === value) {
          console.warn(`⚠️ No actual change detected for '${field}', skipping save.`);
          return;
        }
  
        // ✅ Check if we're updating the parent task
        const isParentUpdate = field === "parent_id";
  
        // ✅ Choose correct API URL
        const apiUrl = isParentUpdate
          ? `http://127.0.0.1:5000/api/tasks/${taskId}/parent`  // 🔥 Dedicated parent update route
          : `http://127.0.0.1:5000/api/tasks/${taskId}`;        // 🔥 General update route
  
        // ✅ Format payload correctly
        const payload = isParentUpdate
          ? { new_parent_id: value || null }  // 🔥 Ensure correct structure for parent updates
          : { [field]: value };
  
        try {
          console.log(`📡 Sending update to API: ${apiUrl}`, payload);
  
          const response = await fetch(apiUrl, {
            method: "PATCH",  // 🔥 Always use PATCH
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
  
          if (!response.ok) {
            console.error("🚨 API Error:", response.status);
            throw new Error(`Failed to update ${field}`);
          }
  
          const responseData = await response.json();
          console.log(`✅ Successfully updated '${field}' for Task ${taskId}`);
  
          // ✅ WebSocket Update (Different event for parent updates)
          if (isParentUpdate) {
            console.log("📡 Emitting WebSocket event: task_parent_updated");
            socket.emit("task_parent_updated", { taskId, new_parent_id: value || null });
          } else {
            const fieldsToBroadcast = ["title", "description", "status", "sort_order"];
            if (fieldsToBroadcast.includes(field)) {
              console.log(`📡 Emitting WebSocket update for '${field}'`);
              socket.emit("update_task", { taskId, field, value });
            }
          }
  
          // ✅ Handle Project Update (ONLY for project_id changes)
          let updatedProjectName = taskToUpdate.project;
          let updatedContributorId = taskToUpdate.contributor_id;
          let updatedContributorName = taskToUpdate.contributor_name;
  
          if (!isParentUpdate) {  // 🔥 Ensure these updates are skipped for parent_id changes
            if (field === "project_id") {
              console.log("📌 Checking project name for project_id:", value);
              const updatedProject = projects.find((p) => p.id === parseInt(value, 10));
              updatedProjectName = updatedProject ? updatedProject.name : "Unknown Project";
              console.log(`✅ Updated project name: ${updatedProjectName}`);
            }
  
            // ✅ Handle Contributor Updates - Ensure Contributor Name is Reflected
            if (field === "contributor_id") {
              updatedContributorId = responseData?.task?.contributor_id || value;
              updatedContributorName = responseData?.task?.contributor_name || "Unassigned";
            }
          }
  
          // ✅ Update Local State in `tasks`
          setTasks(prevTasks =>
            prevTasks.map(task =>
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
  
          // ✅ Ensure modal state updates correctly
          if (selectedTask?.id === taskId) {
            setSelectedTask(prev => ({
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
          console.error(`🚨 Error updating ${field}:`, error);
        }
      },
      1000 // ✅ Debounce delay of 1000ms
    )
  );
  
  // ✅ Ensure `handleFieldChange` correctly triggers debounced save with parent_id
  const handleFieldChange = useCallback((taskId, field, value) => {
    console.log(`📡 API Update Triggered for Task ${taskId}: ${field} → ${value}`);
    debouncedSaveRef.current(taskId, field, value, tasks, projects, selectedTask, setTasks, setSelectedTask, socket);
  }, [tasks, projects, selectedTask]);

  const saveParentAssignment = async () => {
    const payload = {
      task_type: taskData.task_type,  // ✅ Needed for validation
      task_id: taskData.id,  // ✅ Task being updated
      parent_id: taskData.parent_id,  // ✅ New parent task
      project_id: taskData.project_id,  // ✅ Ensure project consistency
    };
  
    try {
      const response = await fetch(`/api/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
  
      if (!response.ok) throw new Error("Failed to assign parent task");
      console.log("✅ Parent task assigned successfully!");
    } catch (error) {
      console.error("Error assigning parent task:", error);
    }
  };
  
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
        console.log("🛠️ Setting tasks state with:", tasksArray); // ✅ Debug before updating state
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

      // ✅ Uncomment if you need to ensure we do NOT load from localStorage (force fresh DB fetch)
      // localStorage.removeItem(`editorDraft-${task.id}`);

      const response = await fetch(`http://127.0.0.1:5000/api/tasks/${task.id}`);
      if (!response.ok) throw new Error("Failed to fetch task details");
      
      const taskData = await response.json();
      console.log("🔍 Task details from API:", taskData);
      // ✅ Fix: Deep copy the object to prevent modifying global state
      const clonedTaskData = JSON.parse(JSON.stringify(taskData));
      // setSelectedTask(taskData); // ✅ Ensure modal gets up-to-date data
      setSelectedTask(clonedTaskData);
      console.log("✅ Updated selectedTask state:", clonedTaskData);

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

  // // ✅ Function to Get CSRF Token from Cookies
  // const getCsrfToken = async () => {
  //     let csrfToken = document.cookie
  //         .split('; ')
  //         .find(row => row.startsWith('csrftoken='))
  //         ?.split('=')[1];

  //     if (!csrfToken) {
  //         console.warn("🚨 CSRF token is missing in cookies! Trying to fetch...");
  //         try {
  //             const res = await fetch("http://127.0.0.1:5000/api/csrf", {
  //                 method: "GET",
  //                 //credentials: "include",
  //             });
  //             const data = await res.json();
  //             csrfToken = data.csrf_token;
  //         } catch (error) {
  //             console.error("❌ Failed to fetch CSRF token:", error);
  //         }
  //     }

  //     console.log("✅ CSRF Token:", csrfToken);
  //     return csrfToken;
  // };

  

  // Version 3
  // ✅ Drag & Drop Handler with Detailed Execution Steps
  const handleDragEnd = async (result) => {
    console.log("🟢 Step 1: Drag & Drop Event Triggered:", result);

    // ✅ Step 2: Check if there’s a valid destination
    if (!result.destination) {  
        console.log("⚠️ Step 2.a: No valid destination. Drag event ignored.");
        return;
    }
    console.log("✅ Step 2.b: Valid destination found, proceeding...");

    // ✅ Step 3: Identify Moved & Target Task
    const movedTask = filteredTasks[result.source.index];
    const targetTask = filteredTasks[result.destination.index];

    console.log("📦 Step 3.a: Moved Task:", movedTask);
    console.log("🎯 Step 3.b: Target Task:", targetTask || "None (Reordering in same list)");

    // ✅ Step 3.c: If movedTask is missing → exit
    if (!movedTask || !movedTask.id) {
        console.error("❌ Step 3.c: ERROR: movedTask is undefined or missing an ID!", movedTask);
        return;
    }

    // ✅ Step 4: Detect Parent Change
    const isParentChange = result.destination.droppableId !== result.source.droppableId;
    console.log("🔄 Step 4.a: Parent Change Detected:", isParentChange);
    console.log("📍 Step 4.b: Destination Index:", result.destination.index);

    // ✅ Step 5: Optimistic UI Update Before API Request
    console.log("🖼️ Step 5.a: Updating UI optimistically...");
    setFilteredTasks((prevTasks) => {
        const updatedTasks = [...prevTasks];
        updatedTasks.splice(result.source.index, 1);
        updatedTasks.splice(result.destination.index, 0, movedTask);
        console.log("✅ Step 5.b: UI Updated Locally:", updatedTasks);
        return updatedTasks;
    });

    try {
        let response;

        // ✅ Step 6: Handle Parent Change
        if (isParentChange) {
            if (!targetTask) {
                console.error("❌ Step 6.a: ERROR: targetTask is missing for parent update!", result);
                return;
            }

            // 🚨 Step 6.b: Prevent invalid parent assignments
            if (movedTask.task_type === "User Story" && targetTask.task_type !== "Epic") {
                alert("A User Story can only be assigned to an Epic.");
                return;
            }
            if (movedTask.task_type === "Subtask" && targetTask.task_type !== "User Story") {
                alert("A Subtask can only be assigned to a User Story.");
                return;
            }

            console.log(`🔄 Step 6.c: Moving task ${movedTask.id} inside new parent ${targetTask.id}`);
            response = await fetch(`http://localhost:5000/api/tasks/${movedTask.id}/parent`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ new_parent_id: targetTask.id }),
            });

        } else {
            // ✅ Step 7: Handle Reordering (Within Same List)
            console.log(`🔄 Step 7.a: Reordering task ${movedTask.id} to new index ${result.destination.index}`);
            response = await fetch(`http://localhost:5000/api/tasks/${movedTask.id}/sort`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ new_order_index: result.destination.index }),
            });
        }

        // ✅ Step 8: Handle API Response
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log("✅ Step 9: Task sorting/moving updated successfully:", data);

        // ✅ Step 10: Emit WebSocket Event for Real-Time Update
        console.log("📡 Step 10: Emitting WebSocket event...");
        socket.emit("task_sorted", {
            taskId: movedTask.id,
            new_order_index: result.destination.index,
            new_parent_id: movedTask.parent_id,
        });

        // ✅ Step 11: Fetch Updated Tasks After Sorting/Moving
        console.log("🔄 Step 11.a: Fetching updated tasks from API...");
        const updatedTasksResponse = await fetch("http://localhost:5000/api/tasks");
        const updatedTasks = await updatedTasksResponse.json();
        console.log("✅ Step 11.b: Updated tasks received:", updatedTasks);
        setFilteredTasks(updatedTasks.tasks);

    } catch (error) {
        console.error("❌ Step 12: Error updating task sorting:", error);
    }
  };

  // ✅ Expand/Collapse Nested Tasks
  const toggleExpand = (taskId) => {
    setExpandedTasks((prev) => {
      const newExpandedTasks = { ...prev, [taskId]: !prev[taskId] };
      console.log("🔄 Expanding Task:", taskId, "State:", newExpandedTasks);
      return newExpandedTasks;
    });
  
    // Force React to re-render to ensure button visibility
    setFilteredTasks((prev) => [...prev]);
  };

  // ✅ Render Tasks Recursively (Ensuring Nested Task Visibility)
  const renderTasks = (tasks, parentId = null, depth = 0) => {
    return tasks
      .filter((task) => task.parent_id === parentId)
      .map((task, index) => (
        console.log(`🔍 Rendering Task: ${task.id} - Description:`, task.description), // ✅ Debug Log
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
                <span
                  className={`text-center cursor-pointer ${
                    task.task_type !== "Subtask" ? "opacity-80 hover:opacity-100" : ""
                  }`}
                  onClick={() => toggleExpand(task.id)}
                >
                  {tasks.some((t) => t.parent_id === task.id) ? (
                    expandedTasks[task.id] ? (
                      <ChevronDownIcon className="w-6 h-6 text-white" />
                    ) : (
                      <ChevronRightIcon className="w-6 h-6 text-white" />
                    )
                  ) : (
                    task.task_type !== "Subtask" && (
                      expandedTasks[task.id] ? (
                        <ChevronDownIcon className="w-6 h-6 text-gray-200 opacity-70 hover:opacity-100" />
                      ) : (
                        <ChevronRightIcon className="w-6 h-6 text-gray-200 opacity-70 hover:opacity-100" />
                      )
                    )
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
                  <div className="task-container">
                    {editingTaskId === task.id ? (
                      <input
                        id={`task-title-${task.id}`}
                        type="text"
                        defaultValue={task.name} // ✅ Use defaultValue instead
                        ref={(el) => (titleRefs.current[task.id] = el)} // Store input reference
                        onChange={(e) => handleTitleChange(task.id, e.target.value)}  // ✅ Pass `e` correctly
                        onBlur={(e) => handleTitleBlur(task.id)} // ✅ Save to state onBlur only
                        onKeyDown={(e) => handleTitleKeyDown(e, task.id)}
                        autoFocus // ✅ Auto-focus on edit
                        className="task-title-input w-full focus:ring"
                      />
                    ) : (
                      <button
                        onClick={() => handleTitleClick(task.id)}
                        className="task-title-text text-left w-full px-2 py-1 bg-transparent border border-transparent hover:bg-slate-900 rounded-md transition-all"
                      >
                        {task.name}
                      </button>
                    )}
                  </div>

                  {/* 🔹 Parent ID Info */}
                  {/*<span className="text-gray-400 text-sm ml-2">(Parent-ID: {task.parent_id || "None"})</span>*/}

                  {/* 🔹 Open Link (Only Visible on Hover) */}
                  <span className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                    <button
                      className="cursor-pointer text-white-400 hover:underline flex items-center"
                      onClick={() => openTaskModal(task)}
                    >
                      <span className="bi bi-arrows-angle-expand"> Open</span>
                    </button>
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
              {expandedTasks[task.id] && (
                <div className="pl-5"> {/* ✅ Ensures proper indentation */}

                  {/* ✅ Render existing subtasks first */}
                  {renderTasks(tasks, task.id, depth + 1)}

                  {/* ✅ NEW: Add Task Button Inside Task Row */}
                  {(task.task_type === "Epic" || task.task_type === "User Story") && (
                    <div
                      className="task-row grid grid-cols-[minmax(40px,60px)_minmax(40px,60px)_minmax(300px,1fr)_minmax(50px,80px)_minmax(150px,200px)_minmax(130px,180px)_minmax(60px,100px)_minmax(100px,140px)_minmax(100px,140px)_minmax(130px,180px)_minmax(50px,80px)]
                      gap-4 p-3 border-b border-gray-700 items-center hover:bg-gray-700 transition duration-200"
                      style={{ paddingLeft: `${(depth + 1) * 20}px` }} // ✅ Align at correct indentation
                    >
                      <span className="text-center">➕</span>
                      <span className="text-left col-span-2">
                        <button
                          className="text-blue-400 hover:text-blue-600 px-2 py-1 rounded transition hover:bg-gray-800"
                          onClick={() => handleCreateTask(task.id, task.task_type === "Epic" ? "User Story" : "Subtask")}
                        >
                          Add {task.task_type === "Epic" ? "User Story" : "Subtask"}
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              )}
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
        <div
          className="modal-overlay"
          onMouseDown={(e) => {
            console.log("❌ Modal background clicked, attempting to close");
            console.log("Event target:", e.target);
            console.log("Event currentTarget:", e.currentTarget);
            console.log("Event type:", e.type);
            onClose();
          }}
        >
          <div
            className="modal-content"
            onMouseDown={(e) => {
              console.log("✅ Click inside modal detected - stopping propagation");
              e.stopPropagation();
            }}
          >
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
              handleContributorChange={handleContributorChange} // ✅ Pass handleContributorChange to modal
              ParentTaskSelector={ParentTaskSelector}
            />
          </div>
        </div>
      )}

    </div>
  );
}








{/* ------------------------Task details modal----------------------- */}








function TaskModal({ isOpen, selectedTask, setSelectedTask, projects, selectedProjectId, onClose, handleFieldChange, handleContributorChange, ParentTaskSelector }) {
  console.log("🔄 Received isOpen prop:", isOpen); // Log the received prop)
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

  }, [selectedTask, selectedTask.project_id]); // ✅ Runs when `selectedTask.project_id` changes

  const [viewMode, setViewMode] = useState("side");

  // ✅ Define scrollRef here
  const scrollRef = useRef(null);

  useEffect(() => {
    console.log("🛠️ TaskModal useEffect triggered! isOpen:", isOpen);
    
    if (!isOpen) {
      console.log("❌ Modal is closed - Check what triggered this!");
    }
  }, [isOpen]);

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


  const handleChange = async (eventOrValue, fieldName = null) => {
      eventOrValue.persist?.(); // ✅ Ensure the event is available inside debounce (if event-based)

      let name, value;

      // ✅ Handle inline contentEditable changes for both title (name) and description
      if (typeof eventOrValue === "string" && fieldName) {
          name = fieldName; // 🔹 Field name explicitly provided (e.g., "name" or "description")
          value = eventOrValue; // 🔹 Use the passed string value

          // ✅ If the field being updated is "description", update taskData immediately
          if (fieldName === "description") {
              setTaskData((prev) => ({ ...prev, description: value }));

              // ✅ If the task already exists, trigger a debounced save
              if (taskData.id) {
                  debouncedSaveRef.current(taskData.id, "description", value, handleFieldChange);
              }
              return; // ✅ Prevents further execution
          }
      }
      // ✅ Handle normal form inputs (e.g., select, input fields)
      else if (eventOrValue.target) {
          ({ name, value } = eventOrValue.target);
      }
      // ❌ If neither case applies, log an error and return early
      else {
          console.error("🚨 Unexpected event format in handleChange:", eventOrValue);
          return;
      }

      console.log(`🛠️ handleChange triggered for '${name}' → '${value}'`);

      // ✅ Update `taskData` state immediately for instant UI feedback
      setTaskData((prev) => ({
          ...prev,
          [name]: value,
      }));

      console.log("🔄 Step 11a: Updated taskData:", taskData);

      // ✅ If editing an existing task, update it using `handleFieldChange`
      if (taskData.id || selectedTask?.id) { 
          console.log(`📌 Step 12: Updating existing task ${taskData.id || selectedTask?.id}`);
          debouncedSaveRef.current(taskData.id || selectedTask?.id, name, value, handleFieldChange);
          return;
      }

      // ✅ If creating a new task (no ID yet), create it when the first field is edited
      try {
          console.log("📡 Step 14: Creating new task...");

          const response = await fetch("http://127.0.0.1:5000/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                  title: taskData.name || "Untitled Task",  // ✅ Ensure title is always set
                  description: taskData.description || "",
                  task_type: taskData.task_type || "User Story",
                  priority: taskData.priority || "Unset",
                  status: taskData.status || "Not Started",
                  project_id: taskData.project_id || selectedProjectId,  // ✅ Ensure `project_id` is defined
              }),
          });

          const responseData = await response.json();
          console.log("📩 Step 15: API Response:", responseData);

          // ✅ Handle warnings (e.g., duplicate task name)
          if (responseData.warning) {
              console.warn(`⚠️ Step 16: Task name warning: ${responseData.warning}`);
              setTaskNameWarning(responseData.warning);
          } else {
              setTaskNameWarning("");
          }

          console.log(`✅ Task Created - ID: ${responseData.task.id}, Name: "${responseData.task.name}"`);

          // ✅ Update state with new task ID (so future updates use `handleFieldChange`)
          setTaskData((prev) => ({
              ...prev,
              id: responseData.task.id,
          }));

          console.log("🔄 Step 18: Updated taskData with new ID:", taskData);

          // ✅ Ensure `setSelectedTask` is defined before calling it
          if (typeof setSelectedTask === "function") {
              setSelectedTask(responseData.task);
          } else {
              console.error("🚨 setSelectedTask is not available.");
          }

      } catch (error) {
          console.error("🚨 Step 20: Error creating new task:", error);
      }
  };

  // ✅ Cleanup Effect to prevent debounce issues
  useEffect(() => {
      const debouncedSave = debouncedSaveRef.current;
      return () => {
          console.log("🛑 Cancelling debouncedSave, but NOT closing modal.");
          debouncedSave.cancel();
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

  // ✅ Animation State for Side View when switching from Modal
  // const [animateSideView, setAnimateSideView] = useState(false);

  // useEffect(() => {
  //     if (viewMode === "side") {
  //         setTimeout(() => setAnimateSideView(true), 500); // ✅ Small delay to trigger animation
  //     } else {
  //         setAnimateSideView(false);
  //     }
  // }, [viewMode]);

  useEffect(() => {
      console.log("🔄 Modal View Updated:", viewMode);
  }, [viewMode]);

  const closeModal = () => {
    setSelectedTask(null);  // ✅ Clears modal when closed
  };

  if (!selectedTask && !isOpen) return null;

  return (
    <div className="modal-background">
      <div ref={scrollRef} className="modal-container">
        <div
          className={`task-modal side-view-modal transition-slow p-6 rounded-lg shadow-lg relative z-50
            ${viewMode === "side" ? "side-view-modal-active" : ""}
          `}
        >
        {/* ✅ Close Button - Top Left */}
        <button 
          onClick={onClose} 
          className="close-view-btn absolute top-4 left-4 p-2 bg-transparent text-white hover:text-gray-400"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 24 24" 
            fill="currentColor" 
            className="close-modal-arrow"
          >
            <path d="M19.1642 12L12.9571 5.79291L11.5429 7.20712L16.3358 12L11.5429 16.7929L12.9571 18.2071L19.1642 12ZM13.5143 12L7.30722 5.79291L5.89301 7.20712L10.6859 12L5.89301 16.7929L7.30722 18.2071L13.5143 12Z"></path>
          </svg>
        </button>

        {/* ✅ Close "X" Button - Top Right */}
        <div className="absolute top-4 right-6 flex space-x-3">
          <button onClick={onClose} className="text-gray-200 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* ✅ Header (Draggable, Only Includes Title & Close Button) */}
        <div 
          className="task-modal-header flex justify-between items-center border-b pb-4 mt-10 drag-handle cursor-move"
          onMouseDown={handleMouseDown} // ✅ Correctly references function
        >
          <div className="flex flex-col w-full">
          <h2
            className="text-xl font-bold outline-none focus:ring focus:ring-blue-300 p-1 rounded-md"
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleChange(e.target.innerText.trim(), "name")}  // ✅ Correctly passing "name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault(); // ✅ Prevents new line
                e.target.blur(); // ✅ Saves and exits edit mode
              }
            }}
          >
            {taskData.name}
          </h2>
            {/* ✅ Display Task Name Warning */}
            {taskNameWarning && (
              <p className="mt-1 text-yellow-500 text-sm">
                ⚠️ {taskNameWarning}
              </p>
            )}
          </div>
        </div>

        {/* ✅ Task Form */}
        <form className="mt-4 grid grid-cols-12 gap-4">
          {/* ✅ Left Column */}
            <div className="task-modal-left col-span-10">
              <div className="mb-4">
                <label className="label block text-sm font-medium text-gray-700">Description</label>
                <TiptapEditor 
                  value={taskData.description} 
                  onChange={(newContent) => handleChange(newContent, "description")}
                  selectedTask={taskData} // ✅ Pass selectedTask to TiptapEditor
                />
              </div>
            </div>

            {/* ✅ Right Column */}
            <div className="task-modal-right col-span-2 space-y-4 pl-1"> 
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

                {/*✅ UI Indicator for "Miscellaneous"
                {projects.find((p) => p.id === parseInt(taskData.project_id, 10))?.name === "Miscellaneous" && (
                    <p className="mt-2 text-sm text-yellow-400">
                        ⚠️ This task is assigned to <strong>Miscellaneous</strong>. Choose a project if needed.
                    </p>
                )}*/}
              </div>

              <div className="mb-4">
                <label className="label block text-sm font-medium">Parent Task</label>
                {/* ✅ Parent Task Selector Inside Modal */}
                <ParentTaskSelector 
                  taskData={selectedTask} 
                  setTaskData={setSelectedTask}
                  handleFieldChange={handleFieldChange}
                  socket={socket}
                />
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
                <label className="label block text-sm font-medium text-gray-100">Owner</label>
                <select
                  name="contributor_id"
                  className="select-contributor mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  value={taskData.contributor_id || ""}
                  onChange={(e) => {
                    const newContributorId = e.target.value || "unassigned";
                    console.log(`🔄 Assigning Contributor ID: ${newContributorId} to Task ${taskData.id}`);
                  
                    setTaskData((prevTaskData) => ({
                      ...prevTaskData,
                      contributor_id: newContributorId, 
                    }));
                  
                    if (taskData.id) {
                      handleContributorChange(taskData.id, newContributorId).then(() => {
                        console.log(`📡 Emitting WebSocket event: contributor_updated → Task ID: ${taskData.id}, Contributor ID: ${newContributorId}`);
                  
                        socket.emit("contributor_updated", {
                          taskId: taskData.id,
                          contributorId: newContributorId
                        });
                      });
                    } else {
                      console.warn("⚠️ Task ID is missing, contributor update skipped!");
                    }
                  }}
                >
                  <option value="">Unassigned</option>
                  {contributors.map((contributor) => (
                    <option key={contributor.id} value={contributor.id}>
                      {contributor.name}
                    </option>
                  ))}
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