/**
 * Modals Module
 * Handles modal lifecycle events, dropdowns, contributor assignments, and field resets.
 */

/* ======================== Utility Functions ======================== */


/**
 * Retrieves the modal element and instance, initializing it if necessary.
 * @returns {object} - { modalElement, modalInstance }
 */
function getModal() {
    const modalElement = document.getElementById("createTaskModal");
    if (!modalElement) {
        console.error("Modal element #createTaskModal not found.");
        return { modalElement: null, modalInstance: null };
    }

    let modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (!modalInstance) {
        modalInstance = new bootstrap.Modal(modalElement); // Initialize the modal instance if not already initialized
    }

    return { modalElement, modalInstance };
}

/**
 * Fetches task details from the backend.
 * @param {string} taskId - The ID of the task to fetch.
 * @returns {Promise<object|null>} - The task data or null on failure.
 */
async function fetchTaskDetails(taskId) {
    try {
        const response = await fetch(`/api/tasks/${taskId}`);
        if (response.ok) {
            const taskDetails = await response.json(); // Parse the response JSON
            console.log("Task details received from API:", taskDetails);
            return taskDetails; // Return the parsed JSON
        } else {
            console.error("Failed to fetch task details:", await response.text());
            return null;
        }
    } catch (error) {
        console.error("Error fetching task details:", error);
        alert("An unexpected error occurred while fetching task details.");
        return null;
    }
};

/**
 * Pre-selects the current parent task in the dropdown for editing an existing task.
 * @param {number} parentId - The ID of the parent task.
 */
async function setParentDropdown(parentId) {
    const parentDropdown = $("#taskParent");

    if (!parentDropdown.length) {
        console.error("Parent dropdown element not found.");
        return;
    }

    if (parentId) {
        try {
            console.log("Fetching details for parent ID:", parentId);
            // Fetch details of the parent task from the backend
            const response = await fetch(`/api/tasks/${parentId}`);
            if (response.ok) {
                console.log("Setting parent dropdown with parent ID:", parentId);
                const parentTask = await response.json();
                console.log("Parent Task Details for Dropdown:", parentTask);

                // Add the parent task as an option and pre-select it
                const newOption = new Option(
                    `${parentTask.name} (ID: ${parentTask.id})`,
                    parentTask.id,
                    true, // Mark as selected
                    true  // Mark as selected
                );
                parentDropdown.append(newOption).trigger("change");
                console.log("Parent dropdown updated with:", newOption);
                
            } else {
                console.error("Failed to fetch parent task details:", await response.text());
            }
        } catch (error) {
            console.error("Error fetching parent task details:", error);
        }
    } else {
        console.log("No parent task to set in the dropdown.");
    }
};

/**
 * Closes the "Create/Edit Task" modal.
 */
window.closeTaskModal = function () {
    const { modalElement, modalInstance } = getModal();
    if (!modalInstance || !modalElement) return;

    // Trigger Bootstrap's modal hide functionality
    modalInstance.hide();

    // Ensure focus is removed from any active element inside the modal
    $(modalElement).find(":focus").trigger("blur");

    // Reset modal state if the modal is being closed
    if (!currentlyOpenedTaskId) {
        resetModalFields();
    }

    // Log modal closure
    console.log("Modal instance closed.");
};

/* ======================== Dropdown Management ======================== */

/**
 * Initializes the Select2 dropdown for parent tasks.
 */
//let dropdownInitialized = false;

window.initializeParentDropdown = function () {
    const parentDropdown = $("#taskParent");

    if (!parentDropdown.length) {
        console.error("Parent dropdown element not found.");
        alert("Parent dropdown could not be loaded. Please try refreshing the page.");
        return Promise.resolve(); // Resolve immediately if dropdown is not found
    }

    return new Promise((resolve) => {
    // Reinitialize only if Select2 is not already initialized
        parentDropdown.select2({
            ajax: {
                url: "available_tasks",
                dataType: "json",
                delay: 250,
                data: params => ({
                    term: params.term || "",
                    page: params.page || 1,
                    limit: 30,
                    task_type: $("#taskType").val(),
                    exclude_task_id: $("#task-id").val() || null,
                }),
                processResults: (data, params) => ({
                    results: data.tasks.map(task => ({
                        id: task.id,
                        text: `${task.name} (ID: ${task.id})`,
                    })),
                    pagination: { more: data.has_more },
                }),
                cache: true,
            },
            placeholder: "Parent task",
            allowClear: true,
            minimumInputLength: 0,
            width: "100%",
            theme: "bootstrap4",
            dropdownParent: $("#createTaskModal"),
        }).on("select2:open", () => {
            // Log dropdown initialization;
            console.log("Parent dropdown initialized successfully.");
            resolve(); // Resolve the promise after initialization completes
        });

        // Fallback resolve after a short delay if select2:open is not triggered
        setTimeout(() => {
            console.log("Parent dropdown initialization fallback triggered.");
            resolve();
        }, 500);
    });
    // Log current dropdown value for debugging
    console.log("Current parent dropdown value:", parentDropdown.val());
};

/**
 * Refreshes the Select2 dropdown when the task type changes.
 */
window.refreshParentDropdown = function () {
    console.log("Refreshing parent dropdown for task type:", $("#taskType").val());

    const parentDropdown = $("#taskParent");
    // Check if Select2 is initialized before destroying
    if (parentDropdown.hasClass("select2-hidden-accessible")) {
        parentDropdown.val(null).trigger("change");
        parentDropdown.select2("destroy");
    }

    // Reinitialize Select2
    initializeParentDropdown();
};

/* ======================== Modal Lifecycle Events ======================== */

/**
 * Configures modal lifecycle events for the "Create/Edit Task" modal.
 */
/**window.setupModalLifecycleEvents = function () {
    const { modalElement } = getModal();
    if (!modalElement) return;

    // Remove any previously attached handlers to prevent duplication
    $(modalElement).off("shown.bs.modal hidden.bs.modal");

    // Handle the modal being shown
    $(modalElement).on("shown.bs.modal", () => {
        $(modalElement).attr("aria-hidden", "false"); // Set aria-hidden to false
        console.log("Modal is now fully visible.");
        initializeParentDropdown(); // Initialize or refresh dropdown
        if (!currentlyOpenedTaskId) {
            console.log("Dropdown initialized for a new task.");
        } else {
            console.log(`Dropdown not initialized as Task ID ${currentlyOpenedTaskId} is being edited.`);
        }
    });

    // Handle the modal being hidden
    $(modalElement).on("hidden.bs.modal", () => {
        $(modalElement).attr("aria-hidden", "true"); // Set aria-hidden to true
        console.log("Modal hidden. Resetting fields if no task was being edited.");
        if (!currentlyOpenedTaskId) {
            resetModalFields(); // Reset only for new tasks
        }

        // Clean up the modal state
        $("body").removeClass("modal-open");
        $(".modal-backdrop").remove();
        document.body.style.overflow = "auto"; // Restore scrolling

        // Explicitly remove aria-hidden attribute
        $(modalElement).removeAttr("aria-hidden");

        // Reset fields for new tasks only
        if (!currentlyOpenedTaskId) {
            resetModalFields();
        }
    });
};*/

function observeParentDropdown() {
    return new Promise((resolve) => {
        const observer = new MutationObserver((mutations, obs) => {
            const parentDropdown = document.getElementById("taskParent");

            if (parentDropdown) {
                console.log("👀 Parent dropdown detected in the DOM.");
                obs.disconnect();  // Stop observing
                resolve();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function waitForParentDropdownReady(attempts = 10, interval = 200) {
    return new Promise((resolve, reject) => {
        let counter = 0;
        const checkDropdown = setInterval(() => {
            const parentDropdown = $("#taskParent");

            if (parentDropdown.length && parentDropdown.hasClass("select2-hidden-accessible")) {
                clearInterval(checkDropdown);
                console.log("✅ Parent dropdown is fully ready.");
                resolve();
            } else {
                console.log(`⏳ Waiting for parent dropdown... Attempt ${counter + 1}`);
            }

            if (++counter >= attempts) {
                clearInterval(checkDropdown);
                console.error("❌ Parent dropdown failed to initialize within the timeout.");
                reject(new Error("Parent dropdown not initialized"));
            }
        }, interval);
    });
}

window.setupModalLifecycleEvents = function () {
    let unsavedChanges = false; // Add this at the top of the function if needed
    const { modalElement } = getModal();
    if (!modalElement) return;

    $(modalElement).off("shown.bs.modal hidden.bs.modal hide.bs.modal");

    $(modalElement).on("shown.bs.modal", async () => {
        console.log("🚀 Modal is now fully visible. Setting ARIA attributes...");
        
        // Ensure the modal is correctly displayed and accessible
        $(modalElement).attr("aria-hidden", "false").css("display", "block");
        
        setupContributorAssignment();

        try {
            console.log("🔍 Calling initializeParentDropdown()")
            await observeParentDropdown();// Wait for parent dropdown to be in the DOM
            console.log("👀 Parent dropdown detected in the DOM, initializing...");
            
            console.log("🕵️‍♂️ Calling waitForParentDropdownReady()");
            await initializeParentDropdown();
            
            await waitForParentDropdownReady();  // New forced wait!
            console.log("✅ Parent dropdown confirmed ready.");
            
            console.log("Checking Task ID in modal lifecycle:", window.currentlyOpenedTaskId);
            if (window.currentlyOpenedTaskId) {
                console.log(`📌 Fetching task details for ID: ${window.currentlyOpenedTaskId}`);
                const taskDetails = await fetchTaskDetails(window.currentlyOpenedTaskId);
                
                if (taskDetails && taskDetails.parent_id) {
                    console.log(`🛠 Task Parent ID exists: ${taskDetails.parent_id}`);
                    console.log("✅ Parent dropdown confirmed ready. Waiting 200ms before setting...");
                    await new Promise(resolve => setTimeout(resolve, 200));

                    console.log("🛠 Now calling setParentDropdown...");
                    
                    await setParentDropdown(taskDetails.parent_id);
                    
                    console.log("✅ setParentDropdown executed.");
                } else {
                    console.log("❌ Task parent ID not found or invalid!");
                }
            }              
        } catch (error) {
            console.error("❌ Error in modal lifecycle: ", error);
        }

        // Step 3: Set focus to the first input field
        $("#taskTitle").focus();
    });

    // Handle the modal being hidden
    $(modalElement).on("hidden.bs.modal", () => {
        resetModalFields(); // Reset fields when modal is hidden
        console.log("Modal hidden and fields reset.");

        // Remove focus from any active element
        document.activeElement.blur();

        // Reset the modal title and button text for the next task
        const modalLabel = document.getElementById("createTaskModalLabel");
        if (modalLabel) modalLabel.textContent = "Create Task";

        const saveTaskButton = document.getElementById("saveTaskButton");
        if (saveTaskButton) saveTaskButton.textContent = "Save Task";

        // Clean up modal state managed by Bootstrap
        $("body").removeClass("modal-open");
        $(".modal-backdrop").remove();
        document.body.style.overflow = "auto"; // Restore scrolling
    });

    // Handle the modal being hidden but before fully closing
    $(modalElement).on("hide.bs.modal", (event) => {
        if (unsavedChanges) {
            const confirmClose = confirm("You have unsaved changes. Do you really want to close?");
            if (!confirmClose) {
                event.preventDefault(); // Prevent the modal from closing
            }
        }
    });
};

/**
 * Configures modal lifecycle events for the "Create/Edit Task" modal.
 */
window.setupModalEvents = function () {
    const { modalElement } = getModal();
    if (!modalElement) return;

    const toggleButton = document.getElementById("toggleModalSize");
    if (toggleButton) {
        toggleButton.addEventListener("click", () => {
            const isFullPage = modalElement.classList.toggle("full-page-modal");
            toggleButton.innerHTML = `<i class="bi bi-arrows-${isFullPage ? "collapse" : "angle-expand"}"></i>`;
            console.log(`Modal ${isFullPage ? "expanded" : "reset"} to default size.`);
        });
    }
};

/* ======================== Modal Actions ======================== */

/**
 * Resets all fields in the modal.
 */
/**
 * Resets all fields in the modal.
 * @param {boolean} forceReset - Whether to force a reset even if a task is being edited.
 */
window.resetModalFields = function(forceReset = false) {
    // Check if reset is required (skip for task edits unless forced)
    if (!window.currentlyOpenedTaskId && !forceReset) {
        console.log("No reset required for an ongoing task edit.");
        return;
    }

    // Define selectors for fields to reset
    const fieldsToReset = [
        "#task-id",          // Hidden field for task ID
        "#taskTitle",        // Task title input
        "#taskDescription",  // Task description textarea
        "#taskProject",      // Project dropdown
        "#taskType",         // Task type dropdown
        "#taskEstimation",   // Story points input
        "#taskParent",       // Parent task dropdown
        "#current-contributor" // Current contributor display field
    ];

    // Reset each field
    fieldsToReset.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            // Handle dropdowns and text inputs separately
            if (element.tagName === "SELECT") {
                element.value = ""; // Clear selection for dropdown
                $(element).trigger("change"); // Trigger change for Select2 if initialized
            } else {
                element.value = ""; // Clear text inputs
            }
        }
    });

    // Handle special case for contributor dropdown
    const contributorSelect = document.getElementById("contributor-select");
    if (contributorSelect) {
        contributorSelect.value = ""; // Clear contributor dropdown
        $(contributorSelect).trigger("change"); // Update Select2 if applicable
    }

    // Reset Parent Task Select2 dropdown
    const parentDropdown = $("#taskParent");
    if (parentDropdown.length && parentDropdown.hasClass("select2-hidden-accessible")) {
        parentDropdown.val(null).trigger("change"); // Reset value and refresh
    }

    // Update modal title to "Create Task" (default state)
    const modalLabel = document.getElementById("createTaskModalLabel");
    if (modalLabel) {
        modalLabel.textContent = "Create Task";
    }
    
    // Reset button text to "Save Task"
    const saveTaskButton = document.getElementById("saveTaskButton");
    if (saveTaskButton) {
        saveTaskButton.textContent = "Save Task";
        console.log("Save Task button text reset.");
    }

    // Clear task-specific state variables
    window.currentlyOpenedTaskId = null; // Clear the current task ID
    TaskManager.saveTaskInitialized = false; // Reset save initialization flag

    console.log("Modal fields and state reset successfully.");
};

/**
 * Debounce function to delay invocation of a function by a specified time.
 * Prevents frequent calls in quick succession.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - Delay in milliseconds.
 * @returns {Function} - Debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Attaches a debounced click event handler to the "Save Task" button.
 * Prevents duplicate submissions using a guard flag and ensures save operations are serialized.
 */
window.setupSaveTaskButton = function () {
    let isSaving = false; // Guard flag to track ongoing save operations

    // Task save handler
    const saveTaskHandler = async function () {
        if (isSaving) {
            console.warn("Save in progress. Skipping duplicate submission.");
            return;
        }
        isSaving = true;

        console.log("Save Task button clicked");
        try {
            const result = await TaskManager.handleTaskSave(); // Ensure TaskManager.handleTaskSave is asynchronous
            console.log("Task saved successfully:", result);

            // Update task row and highlight saved task
            if (result && result.task) {
                TaskManager.updateTaskRow(result.task);
                TaskManager.highlightTask(result.task.id);
            }

            // Reset the modal for the next task
            resetModalFields();
            closeTaskModal();

            console.log("Task modal reset and closed after save.");
        } catch (error) {
            console.error("Error saving task:", error);
            alert("An error occurred while saving the task. Please try again.");
        } finally {
            isSaving = false; // Reset guard flag
        }
    };

    // Attach the debounced click handler to #saveTaskButton
    $("#saveTaskButton").off("click").on("click", debounce(saveTaskHandler, 300));
};


/**
 * Opens the "Create/Edit Task" modal and populates it with task data.
 * @param {number} taskId - The ID of the task to fetch.
 */

// Track currently opened task ID to prevent redundant calls
let currentlyOpenedTaskId = null;

window.openTaskModal = async function (taskId) {
    if (currentlyOpenedTaskId === taskId) {
        console.warn(`Task modal is already open for Task ID: ${taskId}`);
        return; // Prevent duplicate modal opens
    }

    currentlyOpenedTaskId = taskId; // Set the currently opened task ID
    
    console.log(`Opening task modal for Task ID: ${taskId}`);

    try {
        const task = await fetchTaskDetails(taskId);
        if (task) {
            populateTaskModal(task); // Populate fields with task data
            document.getElementById("createTaskModalLabel").textContent = "Edit Task"; // Set modal title
            console.log("Task details loaded successfully.");

            // Ensure the parent dropdown is initialized after fetching details
            console.log("🔄 Initializing parent dropdown...");
            await initializeParentDropdown();
            console.log("✅ Parent dropdown initialized.");

            // **Set parent dropdown if task has a parent**
            if (task.parent_id) {
                console.log(`🛠 Task has a parent ID: ${task.parent_id}. Calling setParentDropdown...`);
                await setParentDropdown(task.parent_id);
                console.log("✅ Parent dropdown set successfully.");
            } else {
                console.log("⚠ No parent task detected.");
            }
        } else {
            alert("Failed to load task details. Please refresh the page and try again.");
            console.error("Task details could not be retrieved.");
        }
    } catch (error) {
        console.error("Error occurred while opening the task modal:", error);
        alert("An unexpected error occurred while loading the task. Please try again.");
    } finally {
        currentlyOpenedTaskId = null; // Reset after operation completes
    }
};

/**
 * Populates the modal fields with the provided task data.
 * @param {object} task - The task data to populate the modal fields.
 */
window.populateTaskModal = function (task) {
    console.log("Populating task modal with task data:", task);
    const { modalElement, modalInstance } = getModal();
    if (!modalElement) return;

    // Populate fields
    const modalFields = {
        "task-id": task.id,
        "taskTitle": task.name,
        "taskDescription": task.description,
        "taskProject": task.project_id || "",
        "taskType": task.task_type || "",
        "taskEstimation": task.story_points || 0,
        "taskParent": task.parent_id || "",
        "contributor-select": task.contributor_id || "",
    };

    Object.entries(modalFields).forEach(([fieldId, value]) => {
        const element = document.getElementById(fieldId);
        if (element) {
            if (fieldId === "taskParent" && $(element).hasClass("select2-hidden-accessible")) {
                // Ensure parent task option exists in dropdown
                if (value && !$(element).find(`option[value="${value}"]`).length) {
                    const optionText = `Parent Task (ID: ${value})`; // Fallback display text
                    $(element).append(new Option(optionText, value, true, true));
                }
                $(element).val(value).trigger("change.select2");
            } else if (element.tagName === "SELECT") {
                $(element).val(value).trigger("change");
            } else {
                element.value = value;
            }
        } else {
            console.warn(`Element with ID "${fieldId}" not found.`);
        }
    });

    // Update the modal title
    document.getElementById("createTaskModalLabel").textContent = task.id ? "Edit Task" : "Create Task";

    // Update the "Save Task" button text
    const saveTaskButton = document.getElementById("saveTaskButton");
    if (saveTaskButton) {
        saveTaskButton.textContent = task.id ? "Save Changes" : "Save Task";
    }

    // Ensure dropdowns are refreshed
    refreshParentDropdown();

    // Show the modal
    modalInstance.show();
    console.log("Task modal is now visible.");
};

/**
 * Assigns contributors in the "Create/Edit Task" modal.
 */

// Function to safely retrieve CSRF token
function getCsrfToken() {
    const tokenElement = document.querySelector('meta[name="csrf-token"]');
    return tokenElement ? tokenElement.getAttribute('content') : null;
}

window.setupContributorAssignment = function () {
    console.log("Setting up contributor assignment...");

    const assignButton = $("#assign-contributor-btn");
    if (!assignButton.length) {
        console.warn("⚠ Assign Contributor button not found. Delaying event binding...");
        setTimeout(setupContributorAssignment, 500); // Retry in 500ms
        return;
    }

    // Remove existing click handler (if any) to prevent duplicates
    assignButton.off("click").on("click", async function () {
        console.log("✅ Assign Contributor button clicked!");

        const taskId = $("#task-id").val();
        const contributorId = $("#contributor-select").val();
        const csrfToken = getCsrfToken();  // Get the latest CSRF token

        if (!csrfToken) {
            alert("❌ CSRF token missing. Please refresh the page.");
            console.error("CSRF token is missing from the meta tag.");
            return;
        }

        if (!contributorId || !taskId) {
            alert("⚠ Task and contributor must be selected before assigning.");
            return;
        }

        try {
            const response = await fetch(`/tasks/${taskId}/assign_contributor`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "X-CSRFToken": csrfToken  // Dynamically fetched CSRF token
                },
                body: JSON.stringify({ contributor_id: parseInt(contributorId, 10) }),
            });

            if (response.ok) {
                console.log("✅ Contributor assigned successfully.");
                TaskManager.highlightTask(taskId);
            } else {
                alert("❌ Error assigning contributor.");
            }
        } catch (error) {
            console.error("❌ Error assigning contributor:", error);
            alert("An unexpected error occurred.");
        }
    });

    console.log("✅ Contributor assignment setup complete.");
};

/**
 * Toggles the modal size between full-page and default size.
 */
window.toggleModalSize = function (modalElement) {
    const toggleButton = document.getElementById("toggleModalSize");

    if (!toggleButton) return;

    toggleButton.addEventListener("click", () => {
        const isFullPage = modalElement.classList.toggle("full-page-modal");
        toggleButton.innerHTML = `<i class="bi bi-arrows-${isFullPage ? "collapse" : "angle-expand"}"></i>`;
        console.log(`Modal ${isFullPage ? "expanded" : "reset"} to default size.`);
    });
}

/**
 * Resets the "Create Task" modal for creating a new task.
 */
window.initNewTaskModal = function () {
    console.log("Resetting modal for creating a new task.");
    const { modalElement } = getModal();
    if (!modalElement) return;

    const taskForm = document.getElementById("taskForm");
    const taskIdField = document.getElementById("task-id");
    const modalLabel = document.getElementById("createTaskModalLabel");

    if (taskForm) taskForm.reset();
    if (taskIdField) taskIdField.value = ""; // Clear task ID to indicate new task
    if (modalLabel) modalLabel.textContent = "Create Task";

    currentlyOpenedTaskId = null; // Reset the flag for task editing
    console.log("Modal reset complete for new task creation.");
};

/**
 * Initializes the task modal logic.
 */
window.initializeTaskModal = function () {
    console.log("Initializing task modal.");
    const { modalElement, modalInstance } = getModal();
    if (!modalElement) return;

    modalElement.addEventListener("hidden.bs.modal", () => {
        modalInstance.dispose(); // Properly dispose of the modal
    });

    window.modal = modalInstance; // Make it globally accessible if needed

    setupModalLifecycleEvents();
    // Ensure contributor assignment setup runs after modal is fully visible
    $(modalElement).on("shown.bs.modal", function () {
        console.log("🟢 Modal is fully loaded. Setting up contributor assignment...");
        setupContributorAssignment();
    });
};


