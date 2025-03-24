<template>
  <v-app-bar app color="green darken-1" dark>
    <v-toolbar-title class="mr-12">
      Green Bites
    </v-toolbar-title>
    <v-spacer></v-spacer>
    <v-btn text to="/">Home</v-btn>
    <v-btn text to="/about">About</v-btn>
    <v-btn text to="/menu">Menu</v-btn>
    <v-btn text to="/process">Process</v-btn>
    <v-btn text to="/sustainability">Sustainability</v-btn>
    <v-btn text to="/contact">Contact</v-btn>
  </v-app-bar>
</template>

<script>
export default {
  name: "NavigationBar"
}
</script>
