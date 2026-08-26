import { useToast } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
} from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts
        .filter((t) => t.open !== false)
        .map(function ({ id, title, description, action, onOpenChange, ...props }) {
          return (
            <Toast key={id} {...props}>
              <div className="grid gap-1 pr-4">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
              {action}
              <ToastClose
                type="button"
                aria-label="Fechar"
                onClick={() => dismiss(id)}
              />
            </Toast>
          );
        })}
    </ToastProvider>
  );
} 