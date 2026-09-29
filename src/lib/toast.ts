import { Toast } from "@base-ui/react/toast";

/**
 * STORY-034. One global manager, mounted once via <ToastProvider> in
 * src/app/providers.tsx — any client component calls `toastManager.add(...)`
 * directly, no hook/context plumbing needed at the call site.
 */
export const toastManager = Toast.createToastManager();
