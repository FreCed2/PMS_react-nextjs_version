import * as Dialog from "@radix-ui/react-dialog";
import { XMarkIcon } from "@heroicons/react/24/solid";

export default function DeleteTaskModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null; // ✅ Prevent rendering if the modal is closed
  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        {/* Overlay (Background Blur) */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />

        {/* Modal Content */}
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-6 rounded-lg shadow-lg w-96">
          {/* Header */}
          <div className="flex justify-between items-center">
            <Dialog.Title className="text-lg font-semibold">Delete Task</Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-white">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Description */}
          <Dialog.Description className="mt-2">
            Are you sure you want to delete this task? This action cannot be undone.
          </Dialog.Description>

          {/* Buttons */}
          <div className="mt-4 flex justify-end space-x-4">
            <Dialog.Close asChild>
              <button className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded">
                Cancel
              </button>
            </Dialog.Close>
            <button
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded"
              onClick={onConfirm}
            >
              Delete
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}