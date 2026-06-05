import path from 'path'

export function sendNotification(title: string, body: string) {
  try {
    const { Notification } = require('electron')
    
    if (!Notification.isSupported()) {
      console.log('OS Notifications are not supported by the system.')
      return
    }

    const notification = new Notification({
      title,
      body,
      silent: false // Trigger system alert sound
    })

    notification.show()
  } catch (error) {
    console.error('Failed to trigger OS notification:', error)
  }
}
