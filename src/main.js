import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import { createMetaManager } from 'vue-meta'

const vuetify = createVuetify()
const pinia = createPinia()
const metaManager = createMetaManager()

const app = createApp(App)
app.use(router)
app.use(pinia)
app.use(vuetify)
app.use(metaManager)
app.mount('#app')
