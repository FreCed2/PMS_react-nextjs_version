"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname } from "next/navigation"; // ✅ Corrected import
import { XMarkIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/solid";

export default function TaskDetails() {
  const params = useParams(); // ✅ Get taskId from URL
  const taskId = params.taskId; // ✅ Extract taskId correctly

  const [task, setTask] = useState(null);
  const [projects, setProjects] = useState([]);
  const [contributors, setContributors] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    console.log("Extracted taskId:", taskId);
    if (!taskId) {
      console.warn("taskId is undefined. Skipping fetch.");
      return;
    }

    async function fetchData() {
      try {
        const taskRes = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`);
        if (!taskRes.ok) throw new Error(`HTTP error! Status: ${taskRes.status}`);
        const taskData = await taskRes.json();
        setTask(taskData);

        const projectsRes = await fetch("http://127.0.0.1:5000/api/projects");
        if (!projectsRes.ok) throw new Error(`HTTP error! Status: ${projectsRes.status}`);
        const projectsData = await projectsRes.json();
        setProjects(projectsData);

        const contributorsRes = await fetch("http://127.0.0.1:5000/api/contributors");
        if (!contributorsRes.ok) throw new Error(`HTTP error! Status: ${contributorsRes.status}`);
        const contributorsData = await contributorsRes.json();
        setContributors(contributorsData);
      } catch (error) {
        console.error("Error in fetching data:", error);
      }
    }

    fetchData();
  }, [taskId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setTask((prevTask) => ({ ...prevTask, [name]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    const response = await fetch(`http://127.0.0.1:5000/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    });

    if (response.ok) {
      alert("Task updated successfully!");
    } else {
      alert("Error updating task.");
    }

    setIsSaving(false);
  };

  if (!task) return <p>Loading...</p>;

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-3/5">
        
        {/* ✅ Header */}
        <div className="flex justify-between items-center border-b pb-4">
          <div className="flex items-center space-x-3">
            <button className="p-2 bg-gray-200 hover:bg-gray-300 rounded">
              <ArrowsPointingOutIcon className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-bold">{task.name}</h2>
          </div>
          <button onClick={() => window.history.back()} className="text-gray-600 hover:text-black">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* ✅ Task Form */}
        <form className="mt-4 grid grid-cols-12 gap-4">
          {/* ✅ Left Column */}
          <div className="col-span-8">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Task Title</label>
              <input
                type="text"
                name="name"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                value={task.name}
                onChange={handleChange}
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                name="description"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                rows="10"
                value={task.description}
                onChange={handleChange}
              />
            </div>
          </div>

          {/* ✅ Right Column */}
          <div className="col-span-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Project</label>
              <select 
                name="project_id"
                className="w-full border-gray-300 rounded-md shadow-sm p-2"
                value={task.project_id}
                onChange={handleChange}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Task Type</label>
              <select 
                name="task_type"
                className="w-full border-gray-300 rounded-md shadow-sm p-2"
                value={task.task_type}
                onChange={handleChange}
              >
                <option value="Epic">Epic</option>
                <option value="User Story">User Story</option>
                <option value="Subtask">Subtask</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Estimate (Story Points)</label>
              <input
                type="number"
                name="story_points"
                className="w-full border-gray-300 rounded-md shadow-sm p-2"
                value={task.story_points || ""}
                onChange={handleChange}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Assigned Contributor</label>
              <select 
                name="assigned_to"
                className="w-full border-gray-300 rounded-md shadow-sm p-2"
                value={task.assigned_to || ""}
                onChange={handleChange}
              >
                <option value="">Unassigned</option>
                {contributors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {/* ✅ Footer Buttons */}
        <div className="mt-6 flex justify-end space-x-4">
          <button onClick={() => window.history.back()} className="px-4 py-2 bg-gray-400 text-white rounded-md">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="px-4 py-2 bg-blue-500 text-white rounded-md"
            disabled={isSaving}
          >
            {isSaving ? "Saving..." : "Save Task"}
          </button>
        </div>
      </div>
    </div>
  );
}