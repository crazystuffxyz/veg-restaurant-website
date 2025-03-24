import { createRouter, createWebHistory } from 'vue-router'
import Home from '../views/Home.vue'
import About from '../views/About.vue'
import Menu from '../views/Menu.vue'
import Process from '../views/Process.vue'
import Sustainability from '../views/Sustainability.vue'
import Contact from '../views/Contact.vue'

const routes = [
  { path: '/', name: 'Home', component: Home },
  { path: '/about', name: 'About', component: About },
  { path: '/menu', name: 'Menu', component: Menu },
  { path: '/process', name: 'Process', component: Process },
  { path: '/sustainability', name: 'Sustainability', component: Sustainability },
  { path: '/contact', name: 'Contact', component: Contact }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
