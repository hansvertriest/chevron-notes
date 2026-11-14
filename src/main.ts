import { createApp } from 'vue'
import { HttpBoardRepository } from './storage'
import App from './ui/App.vue'
import './ui/theme.css'

// The one place that picks the storage implementation.
createApp(App, { repository: new HttpBoardRepository('/api') }).mount('#app')
