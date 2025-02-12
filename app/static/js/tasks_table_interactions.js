// Log to confirm the script's execution
console.log("Initializing tasks_table_interactions.js script...");

/**
 * Updates the task table after a status change.
 * Ensures correct sorting and filtering behavior.
 * @param {number} taskId - The ID of the updated task.
 * @param {string} newStatus - The new status of the task.
 */
function updateTableAfterStatusChange(taskId, newStatus) {
    console.log(`🔄 Adjusting table for Task ID ${taskId}, New Status: ${newStatus}`);

    const taskRow = document.getElementById(`task-${taskId}`);
    if (!taskRow) {
        console.warn(`Task row not found for Task ID ${taskId}`);
        return;
    }

    // 🚀 **Check if filtering is applied**
    const activeFilter = document.getElementById("status-filter")?.value;
    if (activeFilter && activeFilter !== "All" && activeFilter !== newStatus) {
        console.log(`🛑 Task no longer matches active filter (${activeFilter}). Hiding it.`);
        taskRow.style.display = "none"; // Hide task if it no longer matches filter
        return;
    }

    // 🔄 **Check if sorting is applied**
    const activeSortColumn = document.querySelector(".sorted-column");
    if (activeSortColumn && activeSortColumn.dataset.sortType === "status") {
        console.log(`🔃 Re-sorting table due to status change...`);
        sortTaskTableByStatus(); // Call your existing sorting function
    }
}

/**
 * Displays a toast notification.
 * @param {string} message - The message to display.
 */
function showToast(message) {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
        console.warn("Toast container not found!");
        return;
    }

    const toast = document.createElement("div");
    toast.classList.add("toast");
    toast.innerText = message;
    toastContainer.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}



/** Now, any call to `Swal.fire` will use the default styles
Swal.fire({
    title: "Global Styled Alert",
    text: "This alert always has global styles!",
    icon: "success",
}*/
    
/* ======================== Document Initialization ======================== */

document.addEventListener("DOMContentLoaded", () => {
    console.log("Document is ready. Initializing application...");




    // Step 1: Retrieve CSRF token for secure requests
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    setupDeleteTaskLogic(csrfToken); // Attach delete logic
    if (!csrfToken) {
        console.error("CSRF token is missing. Application initialization halted.");
        return; // Stop initialization if token is missing      
    }

    /**const originalSwal = Swal.fire;
    Swal.fire = function (options) {
        return originalSwal({
            ...options,
            customClass: {
                popup: "myswal-popup-class",
                title: "myswal-title-class",
                content: "myswal-content-class",
                confirmButton: "myswal-confirm-button",
                cancelButton: "myswal-cancel-button",
                ...options.customClass, // Allow specific overrides
            },
            buttonsStyling: false,
        });
    }*/
    

    console.log("CSRF Token retrieved successfully:", csrfToken);

    // Delegated event listener for status dropdown
    console.log("Adding delegated event listener for status dropdowns...");
    document.addEventListener("change", function (event) {
        if (event.target && event.target.matches(".status-dropdown")) {
            const taskId = event.target.getAttribute("data-task-id");
            const newStatus = event.target.value;

            if (!taskId || !newStatus) {
                console.error("Task ID or new status is missing.");
                return; // Prevent further execution if data is invalid
            }

            console.log(`Delegated listener: Updating status for Task ID: ${taskId} -> ${newStatus}`);
            updateTaskStatus(taskId, newStatus);
        }
    });

    // Step 2: Prevent drag-and-drop behavior when interacting with buttons inside task rows
    document.querySelectorAll(".delete-task-btn").forEach(button => {
        button.addEventListener("mousedown", event => {
            // event.stopPropagation(); // Prevents drag-and-drop behavior
            event.preventDefault(); // Stops default browser behavior
        });
    
 //       button.addEventListener("click", event => {
 //           event.stopPropagation(); // Prevents click event from bubbling up
 //           event.preventDefault(); // Ensure button click works correctly
 //           const taskId = event.currentTarget.dataset.taskId;
 //           console.log(`Delete button clicked for Task ID: ${taskId}`);  
 //       });


        button.addEventListener("dragstart", event => {
            event.stopPropagation(); // Prevents the button from being draggable
            event.preventDefault(); // Stops default drag behavior
        });
    
        button.addEventListener("focus", event => {
            event.stopPropagation(); // Prevents unwanted selection when focusing button
        });
    });
    
    // Step 3: Initialize TaskManager if not already initialized
    if (!window.TaskManagerInitialized) {
        console.log("Initializing TaskManager...");
        TaskManager.init(csrfToken);
        window.TaskManagerInitialized = true; // Mark as initialized
    } else {
        console.warn("TaskManager has already been initialized. Skipping initialization.");
    }

    // Step 4: Initialize drag-and-drop functionality through TaskManager
    console.log("Initializing drag-and-drop...");
    TaskManager.initDragAndDrop(); // Correctly call the drag-and-drop initialization
 

    // Step 5: Initialize task modal features if not already initialized
    if (!window.taskModalInitialized) {
        console.log("Initializing task modal features...");
        initializeTaskModal(); // Setup modal lifecycle
        setupModalEvents(); // Setup specific modal events
        setupModalLifecycleEvents(); // Setup lifecycle-related events
        window.taskModalInitialized = true; // Prevent redundant re-initialization
        console.log("Task modal features initialized.");
    }

    // Step 6: Build parent-child relationships map
    console.log("Building parent-child relationships map...");
    TaskManager.initTaskParentMap(); // Delegate this logic to TaskManager

    // Step 7: Initialize toggle states for chevrons
    console.log("Initializing toggle states...");
    initializeToggleStates();

    // Step 8: Global setup for save task button and task form
    const saveTaskButton = document.getElementById("saveTaskButton");
    const taskForm = document.getElementById("taskForm");

    if (saveTaskButton && taskForm) {
        // Bind TaskManager.handleTaskSave to the TaskManager context
        const boundHandleTaskSave = TaskManager.handleTaskSave.bind(TaskManager);

        // Remove any previously attached click event listener to avoid duplicates
        saveTaskButton.removeEventListener("click", boundHandleTaskSave);

        // Attach the bound function to the click event
        saveTaskButton.addEventListener("click", (event) => {
            event.preventDefault();
            boundHandleTaskSave(event); // Pass the event to the bound function
        });
    } else {
        console.error("Save Task button or form not found. Initialization aborted.");
    }

    // Step 9: Add event listener for "Open Task" links
    console.log("Setting up event listeners for task open links...");
    document.addEventListener("click", handleTaskOpenClick);

    // Step 10: Setup "Create Task" button
    const newTaskButton = document.getElementById("newTaskButton");
    if (newTaskButton) {
        newTaskButton.addEventListener("click", initNewTaskModal);
        console.log("Create Task button event listener added.");
    }

    // Step 11: Initialize event listeners for toggling child rows
    console.log("Initializing toggle listeners...");
    document.querySelectorAll(".toggle-details").forEach(button => {
        button.addEventListener("click", function () {
            const taskId = this.dataset.taskId;
            const childRows = document.querySelectorAll(`[data-parent-id="${taskId}"]`);
            const icon = this.querySelector("i");

            if (!childRows.length) {
                console.warn(`No child rows found for Task ID: ${taskId}`);
                return;
            }

            // Toggle child rows
            const isCurrentlyHidden = childRows[0].style.display === "none";
            toggleChildRows(taskId, isCurrentlyHidden);

            // Update toggle icon
            icon.classList.toggle("bi-chevron-down", isCurrentlyHidden);
            icon.classList.toggle("bi-chevron-right", !isCurrentlyHidden);
        });
    });

    // Ensure proper error handling for related code if needed
    try {
        console.log("Toggle listener initialialized.");
    } catch (error) {
        console.error("Error during toggle listener initialization:", error);
    }

    document.addEventListener("DOMContentLoaded", () => {
        console.log("Document is ready. Initializing application...");
        
        // Ensure CSRF token is available
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (!csrfToken) {
            console.error("CSRF token is missing. Application initialization halted.");
            return;
        }
    
    });


    /**
     * Sends a PATCH request to update task status and handles dropdown rollback on failure.
     * @param {number} taskId - The ID of the task to update.
     * @param {string} newStatus - The new status ("Not Started", "In Progress", "Completed", "Archived").
     */
    async function updateTaskStatus(taskId, newStatus) {
        const dropdown = document.getElementById(`status-${taskId}`);
        const prevStatus = dropdown.value; // Backup in case of failure

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            if (!csrfToken) {
                console.error("CSRF token is missing. Unable to update task status.");
                alert("CSRF token missing. Please refresh the page and try again.");
                return;
            }

            console.log(`🔄 Updating Task ID ${taskId} to status: ${newStatus}`);

            const response = await fetch(`/api/tasks/${taskId}/status`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken,
                },
                body: JSON.stringify({ status: newStatus }),
            });

            if (response.ok) {
                console.log(`✅ Status updated successfully for Task ID ${taskId}`);
                const result = await response.json();

                // Update dropdown value and data attributes
                dropdown.dataset.prevStatus = result.status; // Backend-confirmed status
                dropdown.value = result.status; // Reflect status in the UI dropdown
                refreshTaskRow(taskId); // Refresh the task row UI
                TaskManager.scrollToAndHighlight(taskId); // Scroll and highlight
                updateTableAfterStatusChange(taskId, newStatus,); // Reapply sorting/filtering if needed
            } else {
                const errorData = await response.json();
                console.error(`❌ Failed to update status for Task ID ${taskId}:`, errorData);
                alert(`Error updating task status: ${errorData.error || "Unknown error"}`);
                dropdown.value = prevStatus; // Rollback on failure
            }
        } catch (error) {
            console.error(`❌ Network error updating Task ID ${taskId}:`, error);
            alert("Network error. Unable to update task status.");
            dropdown.value = prevStatus; // Rollback on network error
        }
    }

    console.log("Document initialization completed.");
});

/* ======================== Event Handlers ======================== */

/**
 * Handles clicks on "Open" task links.
 * Prevents click events from propagating to other handlers and opens the modal.
 * @param {Event} event - The click event.
 */

let isModalOpening = false; // Flag to prevent multiple modals

function handleTaskOpenClick(event) {
    const target = event.target;

    if (target.classList.contains("task-open-link")) {
        event.stopPropagation(); // Prevent propagation to other click handlers
        event.preventDefault(); // Prevent default link behavior

        const taskId = target.dataset.taskId;
        console.log(`"Open" link clicked for Task ID: ${taskId}`);

        // ✅ Store the Task ID globally
        window.currentlyOpenedTaskId = taskId;
        console.log(`📝 Set currentlyOpenedTaskId: ${window.currentlyOpenedTaskId}`);


        // Prevent multiple modals from opening simultaneously
        if (isModalOpening) {
            console.warn("Modal is already opening. Ignoring duplicate request.");
            return;
        }
        isModalOpening = true;

        // Attempt to open the task modal
        openTaskModal(taskId)
            .then(() => {
                console.log(`Modal successfully opened for Task ID: ${taskId}`);
            })
            .catch(error => {
                console.error(`Error opening task modal for Task ID: ${taskId}`, error);
                alert("Failed to open the task modal. Please try again.");
            })
            .finally(() => {
                isModalOpening = false; // Reset the flag
        });
    };
}

/* ======================== Initialization Functions ======================== */

/**
 * Initializes toggle arrows to match the visibility state of child task rows.
 * Ensures icons reflect the visibility of their associated child rows.
 */
function initializeToggleStates() {
    console.log("Initializing toggle states for task rows...");
    document.querySelectorAll(".toggle-details").forEach(button => {
        const taskId = button.dataset.taskId;
        const childRows = document.querySelectorAll(`[data-parent-id="${taskId}"]`);
        const icon = button.querySelector("i");

        if (!icon || !childRows.length) {
            console.warn(`No icon or child rows found for Task ID: ${taskId}`);
            return;
        }

        // Determine the visibility of any child row
        const isAnyChildVisible = Array.from(childRows).some(row => row.style.display !== "none");

        // Update the toggle icon to reflect the visibility state
        icon.classList.toggle("bi-chevron-down", isAnyChildVisible);
        icon.classList.toggle("bi-chevron-right", !isAnyChildVisible);
    });
    console.log("Toggle states initialized.");
}



/**
 * Adds a data-level attribute to each row based on its hierarchy.
 * The data-level attribute is used for styling nested tasks.
 */
function initializeRowLevels() {
    console.log("Initializing hierarchy levels for task rows...");
    document.querySelectorAll("tr[data-task-id]").forEach(row => {
        const level = getHierarchyLevel(row);
        row.setAttribute("data-level", level);
        console.log(`Set level ${level} for Task ID: ${row.dataset.taskId}`);
    });
};


/**
 * Initializes the TableSorter plugin for the task table.
 * Configures the plugin for sorting task columns with specific settings.
 */
function initTableSorter() {
    console.log("Initializing TableSorter for task table...");
    const taskTable = $(".table");

    if (!taskTable.length) {
        console.warn("Task table not found for TableSorter initialization.");
        return;
    }

    taskTable.tablesorter({
        theme: "bootstrap", // Apply Bootstrap theme to the table
        widgets: ["zebra"], // Add zebra striping for better visibility
        headers: {
            0: { sorter: false }, // Disable sorting for the first column
            1: { sorter: false }, // Disable sorting for the second column
            8: { sorter: false }, // Disable sorting for the actions column
            }
        }
    );

    console.log("TableSorter initialized successfully.");
}

/**
 * Initializes toggle functionality for parent-child rows.
 * Sets up event listeners for toggle buttons to expand or collapse child rows.
 */
function initToggleDetails() {
    console.log("Initializing toggle functionality for parent-child rows...");

    document.querySelectorAll(".toggle-details").forEach(button => {
        button.addEventListener("click", function () {
            const taskId = this.dataset.taskId;
            const childRows = document.querySelectorAll(`[data-parent-id="${taskId}"]`);
            const icon = this.querySelector("i");

            if (!childRows.length) {
                console.warn(`No child rows found for Task ID: ${taskId}`);
                return;
            }

            // Check the current visibility state of the first child row
            const isCurrentlyHidden = childRows[0].style.display === "none";

            // Toggle child row visibility
            childRows.forEach(row => {
                row.style.display = isCurrentlyHidden ? "table-row" : "none";
            });

            // Update the toggle icon to reflect the visibility state
            icon.classList.toggle("bi-chevron-down", isCurrentlyHidden);
            icon.classList.toggle("bi-chevron-right", !isCurrentlyHidden);

            console.log(`Toggled child rows for Task ID: ${taskId}, Show: ${isCurrentlyHidden}`);
        });
    });

    console.log("Toggle functionality initialized.");
}

/* ======================== Utility Functions ======================== */


/**
 * Determines the hierarchy level of a task row.
 * Used for styling and enforcing nesting rules dynamically.
 * @param {HTMLElement} row - The task row to analyze.
 * @returns {number} - The hierarchy level (1 for top-level, 2 for nested, etc.).
 */
function getHierarchyLevel(row) {
    let level = 1; // Default level for top-level tasks
    let parentId = row.getAttribute("data-parent-id");

    while (parentId) {
        level++;
        const parentRow = document.querySelector(`[data-task-id="${parentId}"]`);
        parentId = parentRow ? parentRow.getAttribute("data-parent-id") : null;
    }

    return level;
}

/**
 * Updates the `taskParentMap` dynamically when a task's parent changes.
 * Ensures the map remains consistent with the DOM structure.
 * @param {number} taskId - ID of the task being updated.
 * @param {number|null} parentId - New parent ID, or `null` if no parent.
 */
function updateTaskParentMap(taskId, parentId) {
    console.log(`Updating Task Parent Map: Task ${taskId} -> Parent ${parentId}`);
    taskParentMap.set(taskId, parentId);
}



/**
 * Toggles the visibility of child rows when a parent row is toggled.
 * @param {string} parentId - The ID of the parent task.
 * @param {boolean} show - Whether to show or hide the child rows.
 */
function toggleChildRows(parentId, show) {
    console.log(`Toggling child rows for Parent ID: ${parentId}, Show: ${show}`);
    const childRows = document.querySelectorAll(`[data-parent-id="${parentId}"]`);

    childRows.forEach(row => {
        row.style.display = show ? "table-row" : "none";

        const icon = row.querySelector(".toggle-details i");
        if (icon) {
            icon.classList.toggle("bi-chevron-down", show);
            icon.classList.toggle("bi-chevron-right", !show);
        }

        const nestedChildId = row.dataset.taskId;
        if (nestedChildId) {
            toggleChildRows(nestedChildId, show); // Recursively toggle nested child rows
        }
    });
}

/**
 * Sets up tooltips on elements with the `data-bs-toggle="tooltip"` attribute.
 * Initializes Bootstrap tooltips for elements with tooltip attributes.
 * This function is called after the page loads to ensure consistency.
 */
function setupTooltips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipTriggerList.forEach(trigger => new bootstrap.Tooltip(trigger));
}

/**
 * Configures theme toggle functionality.
 * This function is called after the page loads to ensure consistency.
 * The theme is stored as a data attribute on the HTML element.
 */
function setupThemeToggle() {
    const themeButton = document.getElementById("themeToggle");
    if (themeButton) {
        themeButton.addEventListener("click", () => {
            const htmlElement = document.documentElement;
            const currentTheme = htmlElement.getAttribute("data-bs-theme");
            htmlElement.setAttribute("data-bs-theme", currentTheme === "dark" ? "light" : "dark");
        });
    }
}

/* ======================== Modal Management ======================== */

/**
 * Refreshes the specific row from the backend.
 * Updates contributor and other relevant fields dynamically.
 * This function is called after a task is saved or updated.
 * It fetches the latest task data from the backend.
 * It updates the contributor field in the task row.
 * IT DOES NOT CONTAIN ANY LOGIC FOR UPDATING THE PARENT TASK FIELD.
 * IT DOES NOT WORK 
 * @param {number} taskId - The ID of the task to refresh.
 */
/**
 * Refreshes the specific row from the backend and updates the dropdown.
 * @param {number} taskId - The ID of the task to refresh.
 */
async function refreshTaskRow(taskId) {
    console.log(`🔄 Refreshing task row for Task ID: ${taskId}`);

    try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (!response.ok) {
            console.error(`❌ Error fetching task details for Task ID ${taskId}`);
            return;
        }

        const taskData = await response.json();
        console.log("📋 Task Data from API:", taskData); // ✅ Check if parent_id & contributor_id are present

        const taskRow = document.getElementById(`task-${taskId}`);

        if (taskRow && taskData) {
            console.log("Parent ID:", taskData.parent_id);
            console.log("Contributor ID:", taskData.contributor_id);

            // Update status dropdown
            const statusDropdown = taskRow.querySelector(`#status-${taskId}`);
            if (statusDropdown) {
                statusDropdown.value = taskData.status;
            }

            // Update contributor field
            const contributorCell = taskRow.querySelector("td[data-contributor-column]");
            if (contributorCell) {
                contributorCell.textContent = taskData.contributor_name || "Unassigned";
            }

            // Ensure parent task relationship is updated
            if (taskData.parent_id) {
                const parentTaskRow = document.getElementById(`task-${taskData.parent_id}`);
                if (parentTaskRow) {
                    console.log(`✅ Parent Task Found: Task ${taskData.parent_id}`);
                } else {
                    console.warn(`⚠️ Parent Task ID ${taskData.parent_id} not found in the UI.`);
                }
            }

            console.log(`✅ Task row refreshed for Task ID ${taskId}`);
        }
    } catch (error) {
        console.error("❌ Error refreshing task row:", error);
    }
}

/* ======================== Task Deletion Workflow ======================== */

/**
 * Configures task deletion with SweetAlert2 confirmation.
 * Displays a modal to choose whether to delete child tasks.
 * MUST REMOVE THE VERY ANNOYING ANIMATION OF SWEETALERT2
 * Sends a DELETE request to the backend to delete the task.
 * This function is called after the page loads to ensure consistency.
 * The task deletion logic sends a DELETE request to the backend, 
 * updates the task list after deletion and displays a success or error message.
 */
function setupDeleteTaskLogic(csrfToken) {
    document.body.addEventListener("click", function (event) {
        if (event.target.closest(".delete-task-btn")) {
            event.preventDefault(); 
            event.stopPropagation();
            
            const button = event.target.closest(".delete-task-btn");
            const taskId = button.dataset.taskId;
            console.log(`🗑 Attempting to delete Task ID: ${taskId}`);

            // Fetch task details to check if it has children
            fetch(`/tasks/subtasks/${taskId}?check_only=true`, { method: "GET" })
                .then(response => {
                    if (!response.ok) {
                        throw new Error("Failed to check for child tasks.");
                    }
                    return response.json();
                })
                .then(data => {
                    const hasChildren = data.has_children; // Ensure the backend returns this key
                    console.log(`Task ID ${taskId} has children: ${hasChildren}`);
                    
                    // Display a single SweetAlert with three options
                    Swal.fire({
                        title: hasChildren
                            ? "This task has child tasks. What would you like to do?"
                            : "Are you sure you want to delete this task?",
                        text: hasChildren
                            ? "You can delete the task along with its child tasks or keep the child tasks."
                            : "This task will be permanently deleted.",
                        icon: "warning",
                        showCancelButton: true,
                        showDenyButton: hasChildren, // Only show the Deny button if the task has children
                        confirmButtonText: hasChildren
                            ? "Delete task and child tasks"
                            : "Delete task",
                        denyButtonText: hasChildren ? "Delete task but keep child tasks" : null,
                        cancelButtonText: "Cancel",
                        confirmButtonColor: "#d33",
                        denyButtonColor: "#3085d6",
                        cancelButtonColor: "#6c757d",
                        customClass: {
                            popup: 'custom-swal-popup',        // Main popup style
                            title: 'custom-swal-title',        // Title style
                            icon: 'custom-swal-icon',          // Icon style
                            cancelButton: 'custom-swal-cancel-btn', // Cancel button style
                            confirmButton: 'custom-swal-confirm-btn', // Confirm button style
                        },
                        buttonsStyling: false, // Use your own button styles
                        showClass: {
                            popup: 'animate__animated animate__fadeInDown' // Add entrance animation (requires animate.css)
                        },
                        hideClass: {
                            popup: 'animate__animated animate__fadeOutUp'  // Add exit animation (requires animate.css)
                        }
                    }).then(result => {
                        if (result.isConfirmed) {
                            // Delete task and child tasks
                            console.log(`🔄 Deleting Task ID: ${taskId} with children`);
                            deleteTask(taskId, true, csrfToken);
                        } else if (result.isDenied) {
                            // Delete task but keep child tasks
                            console.log(`🔄 Deleting Task ID: ${taskId} but keeping children`);
                            deleteTask(taskId, false, csrfToken);
                        } else {
                            // Cancel deletion
                            console.log("Task deletion canceled.");
                        }
                    });
                })
                .catch(error => {
                    console.error("Error checking child tasks:", error);
                    Swal.fire("Error!", "Failed to check for child tasks. Please try again.", "error");
                });
        }
    });
}
/**
 * This function is called when the user confirms the deletion.
 * It sends a DELETE request to the backend to delete the task.
 * The task is deleted along with its children if specified.
 * The `taskId` parameter is the ID of the task to delete.
 * The `deleteChildren` parameter determines whether to delete children.
 * The `csrfToken` parameter is used to send requests securely.
 */
async function deleteTask(taskId, deleteChildren, csrfToken) {
    console.log(`🔄 Sending DELETE request for Task ID: ${taskId}`);

    try {
        const response = await fetch(`/api/tasks/delete/${taskId}?confirm_children=${deleteChildren}`, {
            method: "DELETE",
            headers: {
                "X-CSRFToken": csrfToken || document.querySelector('meta[name="csrf-token"]').getAttribute('content'),
                "Content-Type": "application/json"
            },
        });

        if (response.ok) {
            const result = await response.json();

            // Determine the appropriate message
            let finalMessage = `Task ${taskId} has been deleted successfully.`;
            if (deleteChildren && result.children_deleted) {
                finalMessage = `Task ${taskId} and its children have been deleted.`;
            } else if (!deleteChildren && result.children_deleted) {
                finalMessage = `Task ${taskId} has been deleted, but its subtasks were kept.`;
            } else if (!result.children_deleted) {
                finalMessage = `Task ${taskId} has been deleted successfully.`;
            }

            Swal.fire("Deleted!", finalMessage, "success").then(() => {
                location.reload();
            });
        } else {
            const result = await response.json();
            Swal.fire("Error!", result.error, "error");
        }
    } catch (error) {
        console.error("Error deleting task:", error);
        Swal.fire("Error!", "An unexpected error occurred.", "error");
    }
}

/*---------------------------------TaskManager---------------------------------*/

window.TaskManager = {
    taskParentMap: new Map(),

    init: function (csrfToken) { 
        this.csrfToken = csrfToken; // Store CSRF token globally in TaskManager
        this.initTaskParentMap = this.initTaskParentMap.bind(this);
        this.initFilters = this.initFilters.bind(this);
        this.initNewTaskModal = this.initNewTaskModal.bind(this);
        this.initSaveTask = this.initSaveTask.bind(this);
        this.initDragAndDrop = this.initDragAndDrop.bind(this);
        this.boundHandleTaskSave = this.handleTaskSave.bind(this); // Bind handleTaskSave

        console.log("TaskManager initialized with CSRF token:", this.csrfToken);

        this.initTaskParentMap(); 
        this.initFilters();
        this.initNewTaskModal(); 
        this.initSaveTask();
        this.initDragAndDrop(); 
    },

    initFilters: function () {
        const filters = ['#project_filter', '#task_type_filter', '#completion_status_filter'];
        filters.forEach(selector => {
            const filterElement = document.querySelector(selector);
            if (filterElement) {
                filterElement.addEventListener('change', () => {
                    const params = new URLSearchParams(window.location.search);
                    params.set(selector.replace('#', '').replace('_filter', ''), filterElement.value);
                    window.location.search = params.toString();
                });
            }
        });

        const clearButton = document.getElementById('clear_filters');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                window.location.href = "{{ url_for('tasks.list_tasks') }}";
            });
        }
    },

    /*initTaskInteraction: function () {
         document.addEventListener("click", async (event) => {
            if (event.target.classList.contains("task-open-link")) {
                event.preventDefault();
                const taskId = event.target.dataset.taskId;
                try {
                    await openTaskModal(taskId); // Ensure `openTaskModal` is defined and imported
                } catch (error) {
                    console.error("Error opening task modal:", error);
                }
            }
        }); 
    },*/

    initNewTaskModal: function () {
        console.log("Delegating initNewTaskModal to modals.js");
        window.initNewTaskModal();
        
    },

    scrollToAndHighlight: function (taskId) {
        const rowToHighlight = document.querySelector(`#task-${taskId}`);
        if (rowToHighlight) {
            rowToHighlight.scrollIntoView({ behavior: "smooth", block: "center" });
            this.highlightTask(taskId, rowToHighlight); // Use `this` to refer to TaskManager
        } else {
            console.warn(`Task row not found for ID: ${taskId}`);
        }
    },

    /**
     * Highlights a task row temporarily to indicate successful changes.
     * Useful for visual feedback after save or reorder operations.
     * @param {string|number} taskId - ID of the task to highlight.
     */
    highlightTask: function (taskId, taskRow = null) {
        console.log('Entering highlightTask: function (taskId, taskRow)');
        const rowToHighlight = taskRow || document.querySelector(`#task-${taskId}`);
        if (rowToHighlight) {
            // Apply a slight delay to ensure scrolling is completed
            setTimeout(() => {
                rowToHighlight.classList.add("highlight");
                setTimeout(() => {
                    rowToHighlight.classList.remove("highlight");
                }, 3000); // Highlight duration extended to 3 seconds
            }, 200); // Delay to start highlighting after scroll
        } else {
            console.warn(`Task row not found for ID: ${taskId}`);
        }
    },

    updateTaskRow: function (taskData) {
        console.log("Entering updateTaskRow:", taskData);
    
        // Validate taskData object
        if (!taskData || !taskData.id) {
            console.error("Invalid task data provided:", taskData);
            return;
        }
    
        const taskTableBody = document.querySelector("tbody");
        if (!taskTableBody) {
            console.error("Task table body not found.");
            return;
        }
    
        // Attempt to find the existing row
        const existingRow = document.querySelector(`#task-${taskData.id}`);
        if (existingRow) {
            console.log(`Updating task row for ID: ${taskData.id}`);
            existingRow.innerHTML = `
                <td><input type="checkbox" name="batch_update" value="${taskData.id}"></td>
                <td>
                    ${
                        taskData.parent_id
                            ? ""
                            : `<button class="btn btn-sm toggle-details" data-task-id="${taskData.id}">
                                <i class="bi bi-chevron-right"></i>
                            </button>`
                    }
                </td>
                <td class="fw-medium fs-6">${taskData.name}</td>
                <td class="fw-light fs-6">LAC-${taskData.id}</td>
                <td>${taskData.project_name || "Unknown Project"}</td>
                <td><small class"">${taskData.contributor_name || "Unassigned"}</small></td>
                <td>${taskData.story_points || "N/A"}</td>
                <td>${taskData.task_type || "Unknown Type"}</td>
                <td>
                    <span class="badge rounded-pill fw-light ${
                        taskData.completed ? "text-bg-success" : "text-bg-warning"
                    }">
                        ${taskData.completed ? "Completed" : "In Progress"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-dark btn-sm delete-task-btn" data-task-id="${taskData.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
        } else {
            console.log(`Task row not found for ID: ${taskData.id}. Creating a new row.`);
            const taskRow = document.createElement("tr");
            taskRow.id = `task-${taskData.id}`;
            console.log("taskData in updateTaskRow:", taskData);
    
            // Assign appropriate class
            const taskType = taskData.task_type || "Undefined";
            taskRow.className = `task-row ${taskType.toLowerCase().replace(" ", "-")}-row`;
    
            taskRow.innerHTML = `
                <td><input type="checkbox" name="batch_update" value="${taskData.id}"></td>
                <td>
                    ${
                        taskData.parent_id
                            ? ""
                            : `<button class="btn btn-sm toggle-details" data-task-id="${taskData.id}">
                                <i class="bi bi-chevron-right"></i>
                            </button>`
                    }
                </td>
                <td class="fw-medium fs-6">${taskData.name}</td>
                <td class="fw-light fs-6">LAC-${taskData.id}</td>
                <td>${taskData.project_name || "Unknown Project"}</td>
                <td>${taskData.contributor_name || "Unassigned"}</td>
                <td>${taskData.story_points || "N/A"}</td>
                <td>${taskData.task_type || "Unknown Type"}</td>
                <td>
                    <span class="badge rounded-pill fw-light ${
                        taskData.completed ? "text-bg-success" : "text-bg-warning"
                    }">
                        ${taskData.completed ? "Completed" : "In Progress"}
                    </span>
                </td>
                <td>
                    <button class="btn btn-dark btn-sm delete-task-btn" data-task-id="${taskData.id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
    
            taskTableBody.appendChild(taskRow);
            console.log(`New task row appended to the table:`, taskTableBody);
        }
    
        // Apply row-specific styles
        const taskTypeStyles = {
            Epic: "rgba(255, 200, 200, 0.5)", // Light red
            "User Story": "rgba(255, 255, 200, 0.5)", // Light yellow
            Subtask: "rgba(200, 230, 255, 0.5)", // Light blue
        };
        const taskRow = document.querySelector(`#task-${taskData.id}`);
        taskRow.style.backgroundColor = taskTypeStyles[taskData.task_type] || "rgba(240, 240, 240, 1)";
        console.log("Row-specific styles applied:", taskRow.style.backgroundColor);
    
        // Highlight the updated or newly added task row
        this.highlightTask(taskData.id, taskRow);
    },

    initSaveTask: function () {
        if (this.saveTaskInitialized) {
            console.warn("Save Task functionality is already initialized. Skipping reinitialization.");
            return;
        }

        console.log("Initializing Save Task functionality..."); // Debugging
        const taskForm = document.getElementById("taskForm");
        if (taskForm) {
            // Check the current state of listeners
            if (typeof getEventListeners === "function") {
                const currentListeners = getEventListeners(taskForm).submit || [];
                console.log("Listeners before removal:", currentListeners);
            }

            // Remove existing event listener and reattach to avoid duplicates
            taskForm.removeEventListener("submit", this.boundHandleTaskSave);
            console.log("Listeners after removal:", $._data($("#taskForm")[0], "events"));
            taskForm.addEventListener("submit", this.boundHandleTaskSave);
            
            // Check listeners after addition
            const listenersAfterAdding = $._data(taskForm, "events") || {};
            if (taskForm) {
                console.log("Listeners after adding:", JSON.stringify(listenersAfterAdding, null, 2));
            } else {
                console.warn("Task form (#taskForm) not found. Ensure the form exists in the DOM before initializing save logic.");
            }
        } else {
            console.warn("Task form (#taskForm) not found during initialization of save logic.");
        }
    },
    
    handleTaskSave: async function (event) {
        console.log("handleTaskSave context:", this);
        // Prevent default button behavior
        if (event) event.preventDefault();
        console.log("handleTaskSave called"); // track calls

        // Correctly reference the form element
        const taskForm = document.getElementById("taskForm"); // Ensure this ID matches your form
        const saveButton = document.getElementById("saveTaskButton");

        if (!taskForm || !saveButton) {
            console.error("Task form or save button not found.");
            return;
        }

        // Update the save button text based on the task ID field
        const taskIdField = document.getElementById("task-id");
        if (taskIdField && taskIdField.value) {
            saveButton.textContent = "Save Changes";
        } else {
            saveButton.textContent = "Save Task";
        }

        // Construct form data and prepare payload
        const formData = new FormData(taskForm);
        const payload = Object.fromEntries(formData);

        // Ensure `parent_id` is included in the payload
        // ** Fix: Explicitly fetch Select2 value for `taskParent` **
        const parentDropdown = $("#taskParent");
        payload.parent_id = parentDropdown.val() ? parseInt(parentDropdown.val(), 10) : null;

        // Ensure `contributor_id` is included in the payload
        const contributorDropdown = $("#taskContributor");
        payload.contributor_id = contributorDropdown.val() ? parseInt(contributorDropdown.val(), 10) : null;

        console.log("Payload prepared:", payload);
    
        // Frontend Validation
        if (!payload.title || payload.title.trim() === "") {
            alert("Task title is required.");
            console.error("Task title validation failed.");
            return;
        }

        // Ensure numeric fields are set correctly
        payload.story_points = payload.story_points ? parseInt(payload.story_points, 10) : 0; // Default to 0 if empty
        payload.sort_order = payload.sort_order ? parseInt(payload.sort_order, 10) : 0; // Default to 0 if empty

        // Proceed with payload processing
        try {
            const response = await fetch("/api/tasks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": this.csrfToken,
                },
                    body: JSON.stringify(payload)
                });

            if (response.ok) {
                const result = await response.json();
                console.log("Task saved successfully:", result);

                // Update the task table
                console.log("taskData before calling updateTaskRow:", result.task);
                this.updateTaskRow(result.task);
                // Highlight the task after the table refresh
                this.highlightTask(result.task.id);

                // Reset modal fields only for new task creation
                // Explanation: If both `payload.id` and `payload.task_id` are not present,
                // it indicates that this is a new task being created, not an existing task being edited.
                if (!payload.id && !payload.task_id) {
                    resetModalFields();
                }

                // Close the modal
                window.closeTaskModal();

                console.log("Task save operation completed.");
            } else {
                const errorText = await response.text(); // Read the raw response text
                console.error(`Task save failed: ${errorData.message || "Unknown error"}`);
                alert(`Failed to save the task: ${errorData.message || "Unknown error"}`);
            }
        } catch (error) {
            console.error("Unexpected error saving task:", error);
            alert("An unexpected error occurred. Please try again.");
        }

        console.log("Payload prepared after numeric adjustments:", payload);
    },

    


/* ======================== Drag and Drop section ======================== */


    /**
     * Initializes the `taskParentMap` from the DOM.
     */
    initTaskParentMap: function () {
        console.log("Initializing Task Parent Map...");
        this.taskParentMap.clear(); // Clear the map to ensure a fresh start

        // Iterate over all task rows to populate the map
        document.querySelectorAll("tr[data-task-id]").forEach((row) => {
            const taskId = parseInt(row.dataset.taskId, 10);
            const parentId = row.dataset.parentId ? parseInt(row.dataset.parentId, 10) : null;
            this.taskParentMap.set(taskId, parentId);
        });

        console.log("Task Parent Map initialized:", Array.from(this.taskParentMap.entries()));
    },

    /**
     * Dynamically updates the `taskParentMap` when a task's parent changes.
     * @param {number} taskId - ID of the task to update.
     * @param {number|null} parentId - New parent ID, or `null` if no parent.
     */
    updateTaskParentMap: function (taskId, parentId) {
        console.log(`Updating Task Parent Map: Task ${taskId} -> Parent ${parentId}`);
        this.taskParentMap.set(taskId, parentId);
    },

    /**
     * Rebuilds the `taskParentMap` to reflect dynamic changes in the DOM.
     * This should be called after drag-and-drop or task deletion.
     */
    rebuildTaskParentMap: function () {
        console.log("Rebuilding Task Parent Map...");
        this.initTaskParentMap();
    },

    initDragAndDrop: function () {
        if (!this.csrfToken) {
            console.error("CSRF token is not set. Drag-and-drop cannot be initialized.");
            return;
        }
        if (window.isDragAndDropInitialized) {
            console.log("Drag-and-drop is already initialized.");
            return;
        }

        console.log("Initializing drag-and-drop within TaskManager...");
        console.log("CSRF Token in initDragAndDrop:", this.csrfToken);
        const tableBody = document.querySelector("tbody");
        if (!tableBody) {
            console.warn("Task table body not found for drag-and-drop initialization");
            return;
        }

        // Initialize Sortable.js for drag-and-drop functionality
        Sortable.create(tableBody, {
            handle: ".task-row", // Only draggable via `.task-row` elements
            animation: 150, // Smooth animation
            filter: ".task-open-link, .delete-task-btn", // Prevent dragging on task links
            preventOnFilter: true, // Prevent drag if filtered element is clicked
            onEnd: async (event) => {
                try {
                    console.log("Drag-and-drop operation started...");
                    const draggedRow = event.item; // The row that was dragged
                    const taskId = parseInt(draggedRow.dataset.taskId, 10);
                    const parentRow = draggedRow.previousElementSibling; // Assumes parent is the previous sibling
                    const parentId = parentRow ? parseInt(parentRow.dataset.taskId, 10) : null;

                    // Update TaskParentMap only
                    this.updateTaskParentMap(taskId, parentId);

                    console.log("Updated Task Parent Map:", Array.from(this.taskParentMap.entries()));

                    // Prepare and send the payload
                    // Remove this? const rows = Array.from(event.from.querySelectorAll(".task-row"));
                    const reorderedTasks = rows.map((row, index) => ({
                        id: parseInt(row.dataset.taskId, 10),
                        sort_order: index + 1,
                        parent_id: this.taskParentMap.get(parseInt(row.dataset.taskId, 10)),
                    }));

                    console.log("Final Payload (Before Submission):", JSON.stringify(reorderedTasks));
                    const response = await fetch("/reorder_subtasks", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-CSRFToken": this.csrfToken,
                        },
                        body: JSON.stringify({ ordered_tasks: reorderedTasks }),
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error("Error reordering tasks:", errorData);
                        alert(`Failed to reorder tasks: ${errorData.message || "Unknown error"}`);
                    } else {
                        const data = await response.json();
                        console.log("Task reordering successful:", data);
                    }
                } catch (error) {
                    console.error("Error during drag-and-drop operation:", error);
                    alert("An unexpected error occurred while reordering tasks.");
                }
            }, // End of onEnd callback
        });

    window.isDragAndDropInitialized = true;
    console.log("Drag-and-drop initialized successfully.");
    }
// End of TaskManager
};