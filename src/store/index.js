import { defineStore } from 'pinia'

export const useRestaurantStore = defineStore('restaurant', {
  state: () => ({
    featuredDishes: []
  }),
  actions: {
    async loadFeatured() {
      // The main menu, as an API for now so that I can edit it...
      try {
        const response = await fetch('/api/featured')
        this.featuredDishes = await response.json()
      } catch (err) {
        console.error('Failed loading featured dishes:', err)
      }
    }
  }
})
