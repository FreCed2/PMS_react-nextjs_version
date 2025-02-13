"use client";

import { useEffect, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  UserCircleIcon,
  ClipboardDocumentCheckIcon,
  BookmarkIcon,
} from "@heroicons/react/24/solid";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import '../styles/custom.css';

export default function AllTasks() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [taskStatus, setTaskStatus] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});
  const [darkMode, setDarkMode] = useState(true);

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
                className="task-row grid grid-cols-[minmax(40px,60px)_minmax(40px,60px)_minmax(40px,60px)_minmax(250px,1fr)_minmax(50px,80px)_minmax(150px,200px)_minmax(130px,180px)_minmax(60px,100px)_minmax(100px,140px)_minmax(130px,180px)_minmax(50px,80px)]
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
                <span className="task-type-icon flex justify-center">
                  {task.task_type === "Epic" ? (
                    <BookmarkIcon className="w-5 h-5 text-blue-400" />
                  ) : task.task_type === "User Story" ? (
                    <ClipboardDocumentCheckIcon className="w-5 h-5 text-purple-400" />
                  ) : (
                    <UserCircleIcon className="w-5 h-5 text-green-400" />
                  )}
                </span>

                {/* ✅ Task Title */}
                <span className="flex items-center relative w-full">
                  <span className="font-semibold">{task.name}</span>
                  <span className="text-gray-400 text-sm ml-2">(Parent-ID: {task.parent_id || "None"})</span>

                  {/* Open Link (Only Visible on Hover) */}
                  <span className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1">
                  <a href={`/alltasks/${task.id}`} className="text-blue-400 hover:underline flex items-center">
                    <ArrowsPointingOutIcon className="w-4 h-4 mr-2 text-blue-400" />
                    <span>Open</span>
                  </a>
                  </span>
                </span>

                <span className="">LM-{task.id}</span>
                <span className="text-gray-400">{task.project}</span>
                <span className="text-center">{task.assigned_to || "Unassigned"}</span>
                <span className="text-center">{task.story_points || "-"}</span>

                {/* ✅ Task Type Badge */}
                <span className={`task-type-badge px-3 py-1 rounded text-center ${
                  task.task_type === "Epic"
                    ? "bg-blue-500"
                    : task.task_type === "User Story"
                    ? "bg-purple-500"
                    : "bg-green-500"
                }`}>
                  {task.task_type}
                </span>

                {/* ✅ Status Dropdown */}
                <select className="task-status-dropdown p-2 bg-gray-700 text-white rounded text-center">
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                </select>

                {/* ✅ Delete Button */}
                <button className="text-red-400 hover:text-red-600 text-center">🗑</button>
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

      {/* ✅ "New Task" Button */}
      <button className="new-task-button top-20 left-8 z-50 p-3 bg-blue-500 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition duration-200">
        ➕ New Task
      </button>

      {/* ✅ Task List Background Fix */}
      <div className={` p-6 rounded-md shadow-md ${darkMode ? "bg-gray-800" : "bg-gray-300"}`}
        style={{ backgroundColor: "rgba(21, 22, 34, 0.8)" }}
      >

        {/* ✅ Header Row (Fixed Column Alignment) */}
        <div className="grid grid-cols-[minmax(40px,60px)_minmax(40px,60px)_minmax(40px,60px)_minmax(250px,1fr)_minmax(50px,80px)_minmax(150px,200px)_minmax(130px,180px)_minmax(60px,100px)_minmax(100px,140px)_minmax(130px,180px)_minmax(50px,80px)] 
          gap-4 p-2 font-bold bg-gray-700 rounded-md text-white">
          <span className="text-center"><input type="checkbox" id="selectAll" /></span>
          <span className="">Toggle</span>
          <span className="">Icon</span>
          <span className="text-left">Task Title</span>
          <span className="">ID</span>
          <span className="">Project</span>
          <span className="text-center">Assigned To</span>
          <span className="text-center">Estimate</span>
          <span className="">Type</span>
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
    </div>
  );
}