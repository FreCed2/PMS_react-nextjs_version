import { useState, useEffect } from "react";

export default function ParentTaskSelector({ taskData, setTaskData, handleFieldChange, socket }) {
    const [parentTasks, setParentTasks] = useState([]);
    const [selectedParent, setSelectedParent] = useState(taskData?.parent_id || "");

    // ✅ Fetch available parent tasks when dropdown opens
    useEffect(() => {
        if (!taskData?.task_type) return;

        fetch(`http://127.0.0.1:5000/tasks/available_tasks?task_type=${encodeURIComponent(taskData.task_type)}&exclude_task_id=${taskData.id}&page=1&limit=30`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        })
        .then((res) => res.json())
        .then((data) => {
            console.log("✅ API Response for available tasks:", data); // Debugging
            if (Array.isArray(data)) {
                setParentTasks(data);
            } else if (data.tasks && Array.isArray(data.tasks)) {
                setParentTasks(data.tasks); // If response is wrapped in an object
            } else {
                console.error("❌ Unexpected API response format", data);
                setParentTasks([]); // Ensure it's always an array
            }
        })
        .catch((error) => {
            console.error("❌ Error fetching available parent tasks:", error);
            setParentTasks([]); // Handle API errors
        });
    }, [taskData?.task_type, taskData?.id]);

    // ✅ Ensure dropdown shows current parent when modal opens
    useEffect(() => {
        setSelectedParent(taskData?.parent_id || "");
    }, [taskData?.parent_id]);

    // ✅ Handle parent selection
    const handleParentChange = (e) => {
        const newParentId = e.target.value;
        setSelectedParent(newParentId);

        // ✅ Update the parent ID in taskData
        setTaskData((prev) => ({
        ...prev,
        parent_id: newParentId || null, // Set to null if empty
        }));

        // ✅ Auto-save parent selection
        if (taskData.id) {
            handleFieldChange(taskData.id, "parent_id", newParentId || null);
            
            // ✅ Emit WebSocket event
            socket.emit("update_task", {
                taskId: taskData.id,
                field: "parent_id",
                value: newParentId || null,
            });
        }
    };
  

    return (
        <div className="parent-task-selector">
        <select
    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
    value={selectedParent}
    onChange={handleParentChange}
>
    <option value="">None</option>
    {Array.isArray(parentTasks) && parentTasks.length > 0 ? (
        parentTasks.map((task) => (
            <option key={task.id} value={task.id}>
                {task.name} (#{task.id})
            </option>
        ))
    ) : (
        <option disabled>No available tasks</option>
    )}
</select>
        </div>
    );
    }