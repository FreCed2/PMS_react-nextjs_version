<script>
        $(document).on("submit", "#createProjectModal form", function (e) {
            e.preventDefault();
    
            $.ajax({
                url: $(this).attr("action"),
                method: $(this).attr("method"),
                data: $(this).serialize(),
                success: function (response) {
                    if (response.success) {
                        $("#createProjectModal").modal("hide");
                        alert(response.message);
                        location.reload();
                    } else {
                        alert(response.message);
                    }
                },
                error: function (xhr) {
                    alert("An error occurred: " + xhr.responseJSON.message);
                }
            });
        });
    </script>