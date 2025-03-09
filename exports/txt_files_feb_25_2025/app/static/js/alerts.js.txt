const originalSwal = Swal.fire;
Swal.fire = function (options) {
    return originalSwal({
        ...options,
        customClass: {
            popup: "my-popup-class",
            title: "my-title-class",
            content: "my-content-class",
            confirmButton: "my-confirm-button",
            cancelButton: "my-cancel-button",
            ...options.customClass, // Allow specific overrides
        },
        buttonsStyling: false,
    });
};

// Now, any call to `Swal.fire` will use the default styles
Swal.fire({
    title: "Global Styled Alert",
    text: "This alert always has global styles!",
    icon: "success",
});