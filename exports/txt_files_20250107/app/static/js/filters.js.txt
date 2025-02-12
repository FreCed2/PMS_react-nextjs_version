// filters.js

/**
 * Filters Module
 * Handles dynamic filtering and clearing of task filters.
 */
document.addEventListener("DOMContentLoaded", () => {
    const filters = ['#project_filter', '#task_type_filter', '#completion_status_filter'];

    /**
     * Attach event listeners to filter dropdowns to dynamically update the task list.
     */
    filters.forEach(selector => {
        const filterElement = document.querySelector(selector);
        if (filterElement) {
            filterElement.addEventListener('change', () => {
                const params = new URLSearchParams(window.location.search);
                params.set(selector.replace('#', '').replace('_filter', ''), filterElement.value);
                window.location.search = params.toString(); // Update URL and reload with new filter
            });
        }
    });

    /**
     * Attach an event listener to the clear filters button to reset filters.
     */
    const clearButton = document.getElementById('clear_filters');
    clearButton?.addEventListener('click', () => {
        window.location.href = "{{ url_for('tasks.list_tasks') }}"; // Redirect to the unfiltered task list
    });
});