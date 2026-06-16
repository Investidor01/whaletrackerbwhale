let permissionAsked = false;

export async function ensureNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  if (permissionAsked) return Notification.permission;
  permissionAsked = true;
  try { return await Notification.requestPermission(); } catch { return "denied"; }
}

export function pushNotify(title: string, body?: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/icon-192.png", badge: "/icon-192.png", tag: "whale-tracker" });
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([60, 40, 60]);
  } catch { /* noop */ }
}