const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000";

/**
 * Fetch all tasks from the API.
 */
export async function fetchTasks() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tasks`);
    if (!response.ok) throw new Error("Failed to fetch tasks");
    const data = await response.json();

    console.log("📡 API Response - Tasks:", data); // Debugging log

    return data;
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}

/**
 * Fetch available parent tasks for a given task type.
 */
export async function fetchAvailableParentTasks(taskType, excludeTaskId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/tasks/available_tasks?task_type=${encodeURIComponent(
        taskType
      )}&exclude_task_id=${excludeTaskId}&page=1&limit=30`
    );
    if (!response.ok) throw new Error("Failed to fetch parent tasks");
    return response.json();
  } catch (error) {
    console.error("Error fetching available parent tasks:", error);
    return [];
  }
}

/**
 * Update a task field (e.g., status, priority).
 */
export async function updateTask(taskId, updatedFields) {
    console.log("📡 Sending task update to API:", updatedFields);
    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedFields),
        });
        if (!response.ok) throw new Error("Failed to update task");
        return response.json();
    } catch (error) {
        console.error("Error updating task:", error);
        return null;
    }
}



let isCreatingTask = false;

export async function createTask(taskPayload) {
    console.log("📌 Creating task with payload:", taskPayload);

    if (isCreatingTask) {
        console.warn("⏳ Task creation already in progress, skipping duplicate request.");
        return null;
    }
    isCreatingTask = true;

    if (!taskPayload.estimate_type) {
        taskPayload.estimate_type = "story_points"; // Default to story points
    }
    if (taskPayload.estimate_type === "story_points") {
        taskPayload.story_points = taskPayload.story_points ?? 0;
        taskPayload.time_estimate = null; // Ensure time_estimate is cleared
    } else {
        taskPayload.time_estimate = taskPayload.time_estimate ?? 0;
        taskPayload.story_points = null; // Ensure story_points is cleared
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskPayload),
        });
        if (!response.ok) throw new Error("Failed to create task");
        return response.json();
    } catch (error) {
        console.error("Error creating task:", error);
        return null;
    } finally {
        isCreatingTask = false;
    }
}
