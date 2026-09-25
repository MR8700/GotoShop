/**
 * Native System & Device Notifications Utility for GotoShop
 * Dispatches notifications to the system notification tray, device status bar,
 * and lock screen (when permission is granted).
 */

export function isNotificationSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission() {
  if (!isNotificationSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";

  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.warn("Notification permission request error:", error);
    return "denied";
  }
}

/**
 * Triggers a native system notification.
 * Appears in the OS notification shade / lock screen if granted.
 */
export async function sendNativeNotification(title, options = {}) {
  if (!isNotificationSupported()) return null;

  // Auto request if default
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await requestNotificationPermission();
  }

  if (perm !== "granted") {
    return null;
  }

  const notificationOptions = {
    icon: options.icon || "/icons/icon-192.png",
    badge: options.badge || "/icons/icon-192.png",
    body: options.body || "",
    tag: options.tag || "gotoshop-" + Date.now(),
    renotify: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: options.data || {},
    ...options,
  };

  try {
    // Attempt ServiceWorker showNotification first (best for mobile status bar / lockscreen)
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notificationOptions);
        return true;
      }
    }

    // Fallback to standard Window Notification
    const notif = new Notification(title, notificationOptions);
    if (options.onClick) {
      notif.onclick = (e) => {
        window.focus();
        options.onClick(e);
        notif.close();
      };
    } else if (options.url) {
      notif.onclick = () => {
        window.focus();
        window.location.href = options.url;
        notif.close();
      };
    }
    return notif;
  } catch (e) {
    console.warn("Unable to trigger native notification:", e);
    return null;
  }
}
