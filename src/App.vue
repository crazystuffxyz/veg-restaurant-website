<template>
  <v-app>
    <NavigationBar />
    <transition name="fade" mode="out-in">
      <router-view />
    </transition>
    <Footer />
  </v-app>
</template>

<script>
import NavigationBar from "./components/NavigationBar.vue"
import Footer from "./components/Footer.vue"

export default {
  name: "App",
  components: { NavigationBar, Footer }
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
