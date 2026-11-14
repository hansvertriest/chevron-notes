import { createApp } from 'vue'
import { HttpBoardRepository } from './storage'
import App from './ui/App.vue'
import './ui/theme.css'
import { trackVisualViewport } from './ui/viewport'

// The one place that picks the storage implementation.
trackVisualViewport()

createApp(App, { repository: new HttpBoardRepository('/api') }).mount('#app')
