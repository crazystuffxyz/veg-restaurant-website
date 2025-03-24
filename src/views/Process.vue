<template>
  <v-container>
    <h2 class="text-center my-6">Our Farm-to-Table Process</h2>
    <v-row>
      <v-col cols="12" md="4" v-for="(step, index) in steps" :key="index">
        <v-card class="pa-4">
          <h3>{{ step.title }}</h3>
          <p>{{ step.description }}</p>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "Process",
  metaInfo: {
    title: 'Green Bites - Our Process'
  },
  data() {
    return {
      steps: [
        {
          title: "Local Sourcing",
          description: "We work with local farms to source fresh, organic produce—guaranteeing rainfall in every bite."
        },
        {
          title: "Artisan Preparation",
          description: "Our chefs handcraft every meal with passion and skill."
        },
        {
          title: "Sustainable Serving",
          description: "From eco-friendly packaging to renewable energy, every detail is sustainable."
        }
      ]
    }
  }
}
</script>
