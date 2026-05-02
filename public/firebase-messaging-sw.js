importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.5.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyB7MYegXC6jIs2EUK6P6hwmiwqKubxVKQA',
  projectId: 'tulia-push',
  messagingSenderId: '205932758475',
  appId: '1:205932758475:web:1aee48ce62a48ca130e24e',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const { notification, data } = payload;
  const title = notification?.title || data?.title || 'Tulia Study';
  const options = {
    body: notification?.body || data?.body || '',
    icon: data?.icon || '/icon-128x128.png',
    data: { url: data?.url || '/' },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
