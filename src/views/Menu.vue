<template>
  <v-container>
    <h2 class="text-center my-6">Our Menu</h2>
    <v-row>
      <!-- Here you may loop through your menu items (perhaps fetched from an API or store) -->
      <v-col cols="12" sm="6" md="4" v-for="(item, index) in menuItems" :key="index">
        <v-card>
          <v-img :src="item.image" height="200px"></v-img>
          <v-card-title>{{ item.name }}</v-card-title>
          <v-card-text>{{ item.description }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>
    <div class="text-center mt-6">
      <p>Enjoy your favorite meal on-site or take it to go!</p>
    </div>
  </v-container>
</template>

<script>
export default {
  name: "Menu",
  metaInfo: {
    title: 'Green Bites - Menu'
  },
  data() {
    return {
      // All items in the menu. Will add.
      menuItems: [
        {
          name: "Avocado Toast",
          description: "Fresh avocado with heirloom tomatoes, drizzled with organic olive oil on artisan bread.",
          image: require('@/assets/images/avocado-toast.jpg')
        },
        {
          name: "Quinoa Salad",
          description: "A colorful blend of quinoa, organic greens, and a zesty lemon dressing.",
          image: require('@/assets/images/quinoa-salad.jpg')
        }
      ]
    }
  }
}
</script>
