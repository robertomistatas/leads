import { toast } from 'sonner'

export function useAlerts() {
  return {
    success: (message: string) => toast.success(message),
    warning: (message: string) => toast.warning(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast(message),
  }
}
