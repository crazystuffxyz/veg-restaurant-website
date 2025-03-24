<template>
  <v-container fluid class="pa-0">
    <v-img src="@/assets/images/hero.jpg" height="80vh">
      <v-row class="fill-height" align="center" justify="center">
        <v-col class="text-center">
          <h1 class="display-2 font-weight-bold white--text animate__animated animate__fadeInDown">
            Welcome to Green Bites
          </h1>
          <h4 class="white--text mt-4 animate__animated animate__fadeInUp">
            A culinary journey into sustainable, plant-based goodness.
          </h4>
          <v-btn large color="light-green accent-4" class="mt-6" to="/contact">
            Reserve a Table
          </v-btn>
        </v-col>
      </v-row>
    </v-img>
  </v-container>
</template>

<script>
export default {
  name: "Home",
  metaInfo: {
    title: 'Green Bites - Home'
  }
}
</script>
