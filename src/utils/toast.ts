import { toast } from 'sonner';

export const showToast = {
  success: (message: string, description?: string) => {
    toast.success(message, { description });
  },
  error: (message: string, description?: string) => {
    toast.error(message, { description });
  },
  warning: (message: string, description?: string) => {
    toast.warning(message, { description });
  },
  info: (message: string, description?: string) => {
    toast.info(message, { description });
  },
  loading: (message: string, description?: string) => {
    return toast.loading(message, { description });
  },
  dismiss: (toastId?: string | number) => {
    toast.dismiss(toastId);
  },
  confirm: (message: string, onConfirm: () => void, description?: string) => {
    toast(message, {
      description,
      action: {
        label: 'Confirm',
        onClick: onConfirm,
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      }
    });
  }
};
